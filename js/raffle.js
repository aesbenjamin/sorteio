// ============================================================
// Lógica da página de sorteio
// ============================================================
(function () {
  "use strict";

  const COOLDOWN_KEY = "sorteador_cooldown";

  // ── DOM refs ────────────────────────────────────────────────
  const btnTry          = document.getElementById("btn-try");
  const btnTryAgain     = document.getElementById("btn-try-again");
  const initialView     = document.getElementById("initial-view");
  const resultWin       = document.getElementById("result-win");
  const resultLose      = document.getElementById("result-lose");
  const resultError     = document.getElementById("result-error");
  const errorMsg        = document.getElementById("error-msg");
  const cooldownNotice  = document.getElementById("cooldown-notice");
  const cooldownMsgEl   = document.getElementById("cooldown-msg");
  const confettiCanvas  = document.getElementById("confetti-canvas");

  let cooldownTimer = null;

  // ── Verifica cooldown ao carregar ───────────────────────────
  checkCooldown();

  // ── Tentar o sorteio ────────────────────────────────────────
  btnTry?.addEventListener("click", async () => {
    if (isOnCooldown()) return;

    setLoading(btnTry, true);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/draw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      // Grava cooldown após qualquer tentativa válida (ganhou ou não)
      if (["win", "no_win", "no_prizes"].includes(data.status)) {
        setCooldown();
      }

      handleDrawResult(data);
    } catch {
      showView(resultError);
      errorMsg.textContent = "Erro de conexão. Verifique sua internet e tente novamente.";
    } finally {
      setLoading(btnTry, false);
    }
  });

  // ── Tentar de novo ──────────────────────────────────────────
  btnTryAgain?.addEventListener("click", () => {
    showView(initialView);
    checkCooldown();
  });

  // ── Processar resultado ──────────────────────────────────────
  function handleDrawResult(data) {
    switch (data.status) {
      case "win":
        showView(resultWin);
        launchConfetti();
        break;

      case "no_win":
        showView(resultLose);
        document.getElementById("lose-msg").textContent =
          "Não foi dessa vez! Tente novamente mais tarde.";
        break;

      case "no_prizes":
        showView(resultLose);
        document.getElementById("lose-msg").textContent =
          "Todos os brindes já foram distribuídos. Obrigado por participar!";
        if (btnTryAgain) btnTryAgain.style.display = "none";
        break;

      case "not_started":
        showView(resultError);
        errorMsg.textContent = "O sorteio ainda não começou. Volte mais tarde!";
        break;

      case "ended":
        showView(resultError);
        errorMsg.textContent = "O período do sorteio encerrou. Até a próxima!";
        break;

      case "no_event":
        showView(resultError);
        errorMsg.textContent = "Nenhum evento ativo no momento.";
        break;

      default:
        showView(resultError);
        errorMsg.textContent = data.message || data.error || "Erro inesperado.";
    }
  }

  // ── Cooldown ─────────────────────────────────────────────────
  function setCooldown() {
    try { localStorage.setItem(COOLDOWN_KEY, Date.now().toString()); } catch { /* privado */ }
  }

  function isOnCooldown() {
    try {
      const ts = parseInt(localStorage.getItem(COOLDOWN_KEY) || "0");
      return Date.now() - ts < COOLDOWN_MINUTES * 60_000;
    } catch { return false; }
  }

  function checkCooldown() {
    clearInterval(cooldownTimer);

    if (!isOnCooldown()) {
      if (cooldownNotice) cooldownNotice.style.display = "none";
      if (btnTry) btnTry.disabled = false;
      return;
    }

    updateCooldownDisplay();
    cooldownTimer = setInterval(() => {
      if (!isOnCooldown()) {
        clearInterval(cooldownTimer);
        if (cooldownNotice) cooldownNotice.style.display = "none";
        if (btnTry) btnTry.disabled = false;
      } else {
        updateCooldownDisplay();
      }
    }, 10_000);
  }

  function updateCooldownDisplay() {
    if (cooldownMsgEl) {
      cooldownMsgEl.textContent = "Você já participou do sorteio.";
    }
    if (cooldownNotice) cooldownNotice.style.display = "";
    if (btnTry) btnTry.disabled = true;
  }

  // ── Utilitários de UI ────────────────────────────────────────
  function showView(el) {
    [initialView, resultWin, resultLose, resultError].forEach(v => {
      if (v) v.style.display = "none";
    });
    if (el) el.style.display = "";
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle("spinning", loading);
  }

  // ── Confetti ─────────────────────────────────────────────────
  function launchConfetti() {
    if (!confettiCanvas) return;

    const ctx = confettiCanvas.getContext("2d");
    confettiCanvas.width  = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
    confettiCanvas.style.display = "block";

    const colors = ["#6c47ff", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899"];
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * confettiCanvas.width,
      y: Math.random() * -200,
      w: 8 + Math.random() * 8,
      h: 4 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - .5) * .2,
      vx: (Math.random() - .5) * 4,
      vy: 2 + Math.random() * 4,
    }));

    let frame;
    const tick = () => {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      let alive = 0;
      for (const p of pieces) {
        p.x += p.vx; p.y += p.vy; p.vy += .07; p.angle += p.spin;
        if (p.y < confettiCanvas.height + 20) {
          alive++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      }
      if (alive > 0) { frame = requestAnimationFrame(tick); }
      else { confettiCanvas.style.display = "none"; ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); }
    };

    frame = requestAnimationFrame(tick);
    setTimeout(() => { cancelAnimationFrame(frame); confettiCanvas.style.display = "none"; }, 5000);
  }
})();
