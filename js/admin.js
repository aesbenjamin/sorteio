// ============================================================
// Lógica da página de administração
// ============================================================
(function () {
  "use strict";

  const ADMIN_KEY_STORAGE = "sorteador_admin_key";

  // ── Autenticação ─────────────────────────────────────────────
  const loginOverlay   = document.getElementById("login-overlay");
  const loginForm      = document.getElementById("login-form");
  const loginError     = document.getElementById("login-error");
  const btnLogout      = document.getElementById("btn-logout");

  let serviceKey = null;

  function getHeaders() {
    return {
      "apikey":        serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type":  "application/json",
      "Prefer":        "return=representation",
    };
  }

  // Tenta restaurar sessão salva
  const savedKey = sessionStorage.getItem(ADMIN_KEY_STORAGE);
  if (savedKey) {
    serviceKey = savedKey;
    hideOverlay();
    init();
  }

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const key = document.getElementById("service-key").value.trim();
    if (!key) return;

    loginError.textContent = "";

    // Valida tentando buscar a config (autenticado)
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/config?limit=1`, {
        headers: { "apikey": key, "Authorization": `Bearer ${key}` },
      });
      if (!res.ok) throw new Error("Chave inválida");

      serviceKey = key;
      sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
      hideOverlay();
      init();
    } catch {
      loginError.textContent = "Chave inválida ou sem permissão. Verifique e tente novamente.";
    }
  });

  btnLogout?.addEventListener("click", () => {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    location.reload();
  });

  function hideOverlay() {
    if (loginOverlay) loginOverlay.style.display = "none";
  }

  // ── Inicializa o painel ───────────────────────────────────────
  async function init() {
    await Promise.all([loadStats(), loadConfig(), loadWinners()]);
    setupConfigForm();
    setupRefresh();
  }

  // ── Stats ─────────────────────────────────────────────────────
  async function loadStats() {
    try {
      // Config atual
      const cfgRes = await fetch(
        `${SUPABASE_URL}/rest/v1/config?active=eq.true&order=created_at.desc&limit=1`,
        { headers: getHeaders() }
      );
      const cfgs = await cfgRes.json();
      const cfg  = cfgs?.[0];

      if (cfg) {
        document.getElementById("stat-remaining").textContent = cfg.prizes_remaining;
        document.getElementById("stat-total").textContent     = cfg.total_prizes;
        document.getElementById("stat-claimed").textContent   = cfg.total_prizes - cfg.prizes_remaining;

        // Barra de progresso
        const pct = cfg.total_prizes > 0
          ? Math.round((1 - cfg.prizes_remaining / cfg.total_prizes) * 100)
          : 0;
        const bar = document.getElementById("progress-bar");
        if (bar) { bar.style.width = pct + "%"; }
        const pctLabel = document.getElementById("progress-pct");
        if (pctLabel) pctLabel.textContent = pct + "% distribuído";
      }

      // Total de acessos (config mais recente)
      if (cfg) {
        const accRes = await fetch(
          `${SUPABASE_URL}/rest/v1/accesses?config_id=eq.${cfg.id}&select=id`,
          { headers: { ...getHeaders(), "Prefer": "count=exact" } }
        );
        const count = accRes.headers.get("content-range")?.split("/")[1] ?? "—";
        document.getElementById("stat-accesses").textContent = count;

        // Taxa recente (últimos 30 min)
        const windowStart = new Date(Date.now() - 30 * 60_000).toISOString();
        const recentRes = await fetch(
          `${SUPABASE_URL}/rest/v1/accesses?config_id=eq.${cfg.id}&accessed_at=gte.${windowStart}&select=id`,
          { headers: { ...getHeaders(), "Prefer": "count=exact" } }
        );
        const recentCount = parseInt(recentRes.headers.get("content-range")?.split("/")[1] ?? "0");
        const rate = (recentCount / 30).toFixed(1);
        document.getElementById("stat-rate").textContent = `${rate}/min`;
      }
    } catch (err) {
      console.error("Erro ao carregar stats:", err);
    }
  }

  // ── Ganhadores ────────────────────────────────────────────────
  async function loadWinners() {
    const tbody = document.getElementById("winners-body");
    const empty = document.getElementById("winners-empty");
    if (!tbody) return;

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/draws?order=drawn_at.desc&limit=50`,
        { headers: getHeaders() }
      );
      const rows = await res.json();

      tbody.innerHTML = "";

      if (!rows || rows.length === 0) {
        if (empty) empty.style.display = "";
        return;
      }

      if (empty) empty.style.display = "none";

      for (const row of rows) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escHtml(row.winner_name || "<em style='color:var(--neutral-400)'>Aguardando</em>")}</td>
          <td>${escHtml(row.winner_contact || "—")}</td>
          <td>${formatDateStr(row.drawn_at)}</td>
          <td>
            ${row.winner_name
              ? '<span class="badge badge-success">✅ Confirmado</span>'
              : '<span class="badge badge-warning">⏳ Pendente</span>'}
          </td>`;
        tbody.appendChild(tr);
      }
    } catch (err) {
      console.error("Erro ao carregar ganhadores:", err);
    }
  }

  // ── Config form ───────────────────────────────────────────────
  async function loadConfig() {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/config?order=created_at.desc&limit=1`,
        { headers: getHeaders() }
      );
      const cfgs = await res.json();
      const cfg  = cfgs?.[0];
      if (!cfg) return;

      setVal("cfg-event-name",  cfg.event_name);
      setVal("cfg-total",       cfg.total_prizes);
      setVal("cfg-remaining",   cfg.prizes_remaining);
      setVal("cfg-start",       toDatetimeLocal(cfg.start_time));
      setVal("cfg-end",         toDatetimeLocal(cfg.end_time));

      document.getElementById("current-config-id").value = cfg.id;
    } catch (err) {
      console.error("Erro ao carregar config:", err);
    }
  }

  function setupConfigForm() {
    const form    = document.getElementById("config-form");
    const btnSave = document.getElementById("btn-save-config");
    const notice  = document.getElementById("config-notice");

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const id = document.getElementById("current-config-id").value;
      const payload = {
        event_name:       getVal("cfg-event-name"),
        total_prizes:     parseInt(getVal("cfg-total")),
        prizes_remaining: parseInt(getVal("cfg-remaining")),
        start_time:       new Date(getVal("cfg-start")).toISOString(),
        end_time:         new Date(getVal("cfg-end")).toISOString(),
        active:           true,
      };

      if (isNaN(payload.total_prizes) || isNaN(payload.prizes_remaining)) {
        showNotice(notice, "Preencha os campos de quantidade corretamente.", "danger");
        return;
      }

      if (payload.prizes_remaining > payload.total_prizes) {
        showNotice(notice, "Brindes disponíveis não pode ser maior que o total.", "danger");
        return;
      }

      setLoading(btnSave, true);

      try {
        let res;
        if (id) {
          // Atualiza
          res = await fetch(
            `${SUPABASE_URL}/rest/v1/config?id=eq.${id}`,
            { method: "PATCH", headers: getHeaders(), body: JSON.stringify(payload) }
          );
        } else {
          // Cria novo
          res = await fetch(
            `${SUPABASE_URL}/rest/v1/config`,
            { method: "POST", headers: getHeaders(), body: JSON.stringify(payload) }
          );
        }

        if (!res.ok) throw new Error(await res.text());

        showNotice(notice, "Configuração salva com sucesso!", "success");
        await loadStats();
        await loadConfig();
      } catch (err) {
        showNotice(notice, "Erro ao salvar: " + err.message, "danger");
      } finally {
        setLoading(btnSave, false);
      }
    });

    // Botão novo evento
    document.getElementById("btn-new-event")?.addEventListener("click", () => {
      document.getElementById("current-config-id").value = "";
      setVal("cfg-event-name",  "");
      setVal("cfg-total",       "");
      setVal("cfg-remaining",   "");
      setVal("cfg-start",       "");
      setVal("cfg-end",         "");
      notice.style.display = "none";
      document.getElementById("cfg-event-name").focus();
    });
  }

  // ── Auto-refresh a cada 30s ───────────────────────────────────
  function setupRefresh() {
    setInterval(() => {
      loadStats();
      loadWinners();
    }, 30_000);
  }

  // ── Helpers ───────────────────────────────────────────────────
  function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle("spinning", loading);
  }

  function showNotice(el, msg, type) {
    if (!el) return;
    el.className = `alert alert-${type}`;
    el.textContent = msg;
    el.style.display = "";
    setTimeout(() => { el.style.display = "none"; }, 4000);
  }

  function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v ?? ""; }
  function getVal(id)    { const el = document.getElementById(id); return el ? el.value : ""; }

  function toDatetimeLocal(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
      .toISOString().slice(0, 16);
  }

  function formatDateStr(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function escHtml(str) {
    if (typeof str !== "string") return str;
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
})();
