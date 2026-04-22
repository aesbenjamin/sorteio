import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Service role bypassa RLS — necessário para inserir em draws e accesses
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    // 1. Busca a configuração ativa
    const { data: configs, error: configError } = await supabase
      .from("config")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1);

    if (configError) throw configError;

    if (!configs || configs.length === 0) {
      return json({ status: "no_event", message: "Nenhum evento ativo no momento." });
    }

    const config = configs[0];
    const now = new Date();
    const startTime = new Date(config.start_time);
    const endTime = new Date(config.end_time);

    // 2. Verifica se está dentro do período
    if (now < startTime) {
      return json({ status: "not_started", message: "O sorteio ainda não começou." });
    }
    if (now > endTime) {
      return json({ status: "ended", message: "O período do sorteio encerrou." });
    }

    // 3. Modo bloqueado — retorna no_win silenciosamente (transparente ao usuário)
    if (config.mode === "blocked") {
      return json({ status: "no_win", message: "Não foi dessa vez!" });
    }

    // 4. Verifica se ainda há brindes
    if (config.prizes_remaining <= 0) {
      return json({ status: "no_prizes", message: "Todos os brindes já foram sorteados!" });
    }

    // 5. Registra o acesso para o algoritmo adaptativo (não registra em modo bloqueado)
    await supabase.from("accesses").insert({ config_id: config.id });

    // 6. Decide se sorteia: força ganho ou usa algoritmo adaptativo
    let shouldWin: boolean;
    if (config.mode === "force_win") {
      shouldWin = true;
    } else {
      const probability = await calculateProbability(supabase, config, now, endTime);
      const roll = Math.random();
      shouldWin = roll < probability;
    }

    if (!shouldWin) {
      return json({ status: "no_win", message: "Não foi dessa vez!" });
    }

    // 7. Tenta decrementar atomicamente via RPC (evita race condition)
    const { data: decremented, error: decrementError } = await supabase
      .rpc("try_claim_prize", { p_config_id: config.id });

    if (decrementError) throw decrementError;

    if (!decremented) {
      // Outro usuário ganhou o último brinde no mesmo instante
      return json({ status: "no_prizes", message: "Todos os brindes já foram sorteados!" });
    }

    // 8. Registra o sorteio (apenas timestamp, sem dados pessoais)
    const { error: drawError } = await supabase
      .from("draws")
      .insert({ config_id: config.id });

    if (drawError) throw drawError;

    return json({
      status: "win",
      message: "Parabéns! Você foi sorteado!",
    });

  } catch (err) {
    console.error(err);
    return json({ error: "Erro interno. Tente novamente." }, 500);
  }
});

// ----------------------------------------------------------------
// Algoritmo de distribuição adaptativa com janela rotativa de 5 min
//
// Fórmula:
//   taxa_necessária  = prizes_remaining / minutos_restantes
//   taxa_de_acesso   = acessos_últimos_5min / 5   (mín. 1 acesso = pessoa atual)
//   P = taxa_necessária / taxa_de_acesso
//
// Comportamento:
//   - Alta demanda nos últimos 5 min  → P cai  (muita gente competindo)
//   - Baixa demanda nos últimos 5 min → P sobe (poucos concorrentes)
//   - Poucos brindes + pouco tempo    → taxa_necessária alta → urgência
//   - P sempre limitado a [0, 1]
// ----------------------------------------------------------------
async function calculateProbability(
  supabase: ReturnType<typeof createClient>,
  config: { id: number; prizes_remaining: number },
  now: Date,
  endTime: Date,
): Promise<number> {
  const WINDOW_MINUTES = 5;

  // Minutos restantes até o fim do evento (mínimo 1 para evitar divisão por zero)
  const minutesRemaining = Math.max(1, (endTime.getTime() - now.getTime()) / 60_000);

  // Contagem de acessos na janela rotativa de 5 minutos
  const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60_000).toISOString();
  const { count: recentCount } = await supabase
    .from("accesses")
    .select("*", { count: "exact", head: true })
    .eq("config_id", config.id)
    .gte("accessed_at", windowStart);

  // A pessoa atual já foi inserida antes deste cálculo, então count >= 1
  const accessesInWindow = Math.max(1, recentCount ?? 1);

  // Taxa de chegada atual (pessoas/minuto) baseada na janela de 5 min
  const demandRate = accessesInWindow / WINDOW_MINUTES;

  // Taxa necessária para distribuir todos os brindes restantes no tempo restante
  const targetRate = config.prizes_remaining / minutesRemaining;

  // P = quanto de cada "pessoa esperada" deve ganhar para atingir a meta
  const probability = targetRate / demandRate;

  return Math.min(1, Math.max(0, probability));
}

// ----------------------------------------------------------------
// Helper
// ----------------------------------------------------------------
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
