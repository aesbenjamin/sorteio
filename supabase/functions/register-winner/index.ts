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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const body = await req.json();
    const { draw_id, winner_name, winner_contact } = body;

    if (!draw_id || !winner_name) {
      return json({ error: "draw_id e winner_name são obrigatórios." }, 400);
    }

    // Só atualiza se ainda não tiver nome preenchido (evita sobrescrever)
    const { error } = await supabase
      .from("draws")
      .update({ winner_name, winner_contact: winner_contact ?? null })
      .eq("id", draw_id)
      .is("winner_name", null);

    if (error) throw error;

    return json({ status: "ok", message: "Dados registrados com sucesso!" });
  } catch (err) {
    console.error(err);
    return json({ error: "Erro ao registrar. Tente novamente." }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
