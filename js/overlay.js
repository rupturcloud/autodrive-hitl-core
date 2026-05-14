/**
 * Autodrive HITL Core - Overlay UI v2.4
 * Interface premium com HITL forte, explicabilidade e Autodrive visual
 * UI/UX mantida identica - motor interno reconstruido
 */

const Overlay = (() => {

  let overlayEl = null;
  let logEl = null;
  let tabuleiro = null;
  let countdownInterval = null;
  let isVisible = false;

  const COLORS = {
    A: { bg: '#1565C0', label: 'PLAYER', emoji: 'P' },
    V: { bg: '#C62828', label: 'BANKER', emoji: 'B' },
    Am: { bg: '#F9A825', label: 'TIE', emoji: 'T' }
  };

  // === CRIAR OVERLAY NO DOM ===
  function createOverlay() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'autodrive-hitl-overlay';
    overlayEl.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 360px;
      max-height: 90vh;
      background: rgba(10, 10, 20, 0.97);
      color: #fff;
      border-radius: 16px;
      border: 1px solid #2196F3;
      box-shadow: 0 8px 32px rgba(33, 150, 243, 0.4);
      z-index: 999999;
      overflow: hidden;
      font-family: 'Roboto', 'Segoe UI', sans-serif;
      font-size: 13px;
      display: flex;
      flex-direction: column;
    `;

    overlayEl.innerHTML = buildOverlayHTML();
    document.body.appendChild(overlayEl);

    // Referencias
    logEl = overlayEl.querySelector('#hitl-log');
    tabuleiro = overlayEl.querySelector('#hitl-tabuleiro');

    // Botoes HITL
    overlayEl.querySelector('#btn-confirmar').addEventListener('click', () => {
      if (window.DecisionEngine) window.DecisionEngine.confirmEntry();
    });

    overlayEl.querySelector('#btn-cancelar').addEventListener('click', () => {
      if (window.DecisionEngine) window.DecisionEngine.cancelEntry();
    });

    overlayEl.querySelector('#btn-toggle').addEventListener('click', toggleVisibility);
    overlayEl.querySelector('#btn-start').addEventListener('click', startEngine);
    overlayEl.querySelector('#btn-stop').addEventListener('click', stopEngine);

    isVisible = true;
    log('Overlay HITL v2.4 inicializado');
  }

  function buildOverlayHTML() {
    return `
      <div style="background: linear-gradient(135deg, #1a237e, #0d47a1); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; border-radius: 16px 16px 0 0;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">🤖</span>
          <div>
            <div style="font-weight: 700; font-size: 14px; letter-spacing: 0.5px;">Autodrive HITL Core</div>
            <div style="font-size: 10px; opacity: 0.7; letter-spacing: 1px;">v2.4 ENGINE</div>
          </div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button id="btn-start" style="background: #2e7d32; color: #fff; border: none; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 11px; font-weight: 600;">▶ START</button>
          <button id="btn-stop" style="background: #b71c1c; color: #fff; border: none; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 11px; font-weight: 600;">■ STOP</button>
          <button id="btn-toggle" style="background: rgba(255,255,255,0.2); color: #fff; border: none; border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 12px;">−</button>
        </div>
      </div>

      <div id="hitl-main" style="padding: 12px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;">

        <!-- Status -->
        <div id="hitl-status-panel" style="background: rgba(33, 150, 243, 0.1); border: 1px solid rgba(33, 150, 243, 0.3); border-radius: 10px; padding: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span id="hitl-state-badge" style="background: #1565C0; color: #fff; border-radius: 20px; padding: 3px 12px; font-size: 11px; font-weight: 700;">OBSERVANDO</span>
            <span id="hitl-conviction" style="font-size: 20px; font-weight: 700; color: #4CAF50;">--</span>
          </div>
          <div id="hitl-explanation" style="margin-top: 8px; font-size: 12px; color: #90CAF9; min-height: 30px;">Aguardando sinal...</div>
        </div>

        <!-- Sugestao HITL -->
        <div id="hitl-suggestion" style="display: none; background: rgba(255, 152, 0, 0.15); border: 2px solid #FF9800; border-radius: 12px; padding: 14px; text-align: center;">
          <div style="font-size: 12px; color: #FFB74D; font-weight: 600; margin-bottom: 6px;">SUGESTAO DO ENGINE</div>
          <div id="hitl-action-label" style="font-size: 28px; font-weight: 900; color: #fff; margin: 8px 0;">--</div>
          <div id="hitl-countdown" style="font-size: 14px; color: #FF9800; font-weight: 700; margin-bottom: 12px;">Auto em 8s...</div>
          <div style="display: flex; gap: 10px; justify-content: center;">
            <button id="btn-confirmar" style="background: #2e7d32; color: #fff; border: none; border-radius: 10px; padding: 10px 24px; cursor: pointer; font-size: 14px; font-weight: 800; flex: 1;">✅ CONFIRMAR</button>
            <button id="btn-cancelar" style="background: #b71c1c; color: #fff; border: none; border-radius: 10px; padding: 10px 24px; cursor: pointer; font-size: 14px; font-weight: 800; flex: 1;">❌ CANCELAR</button>
          </div>
        </div>

        <!-- Bankroll -->
        <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 10px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; text-align: center;">
          <div>
            <div style="font-size: 10px; color: #888; text-transform: uppercase;">Sessao</div>
            <div id="br-profit" style="font-size: 16px; font-weight: 700; color: #4CAF50;">R$ 0</div>
          </div>
          <div>
            <div style="font-size: 10px; color: #888; text-transform: uppercase;">Gale</div>
            <div id="br-gale" style="font-size: 16px; font-weight: 700; color: #FF9800;">G0</div>
          </div>
          <div>
            <div style="font-size: 10px; color: #888; text-transform: uppercase;">Stake</div>
            <div id="br-stake" style="font-size: 16px; font-weight: 700;">R$ 5</div>
          </div>
        </div>

        <!-- Tabuleiro -->
        <div>
          <div style="font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 6px;">Historico</div>
          <div id="hitl-tabuleiro" style="display: flex; flex-wrap: wrap; gap: 3px; max-height: 80px; overflow-y: auto;"></div>
        </div>

        <!-- Log -->
        <div>
          <div style="font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 4px;">Log</div>
          <div id="hitl-log" style="background: rgba(0,0,0,0.4); border-radius: 8px; padding: 8px; font-size: 11px; color: #aaa; max-height: 80px; overflow-y: auto; font-family: monospace;"></div>
        </div>
      </div>
    `;
  }

  // === UPDATE (chamado pelo DecisionEngine) ===
  function update(data) {
    if (!overlayEl) createOverlay();

    const { state, plan, bankroll, countdown, message } = data;

    if (state) updateState(state, plan, message);
    if (bankroll) updateBankroll(bankroll);
    if (countdown !== undefined) updateCountdown(countdown);
    if (message) log(message);
  }

  function updateState(state, plan, message) {
    const badge = overlayEl.querySelector('#hitl-state-badge');
    const conviction = overlayEl.querySelector('#hitl-conviction');
    const explanation = overlayEl.querySelector('#hitl-explanation');
    const suggestion = overlayEl.querySelector('#hitl-suggestion');
    const actionLabel = overlayEl.querySelector('#hitl-action-label');

    const stateColors = {
      OBSERVING: '#1565C0',
      SIGNAL_FOUND: '#7B1FA2',
      WAITING_HUMAN: '#E65100',
      EXECUTING: '#1B5E20',
      CONFIRMED: '#2E7D32',
      CANCELLED: '#B71C1C',
      PAUSED: '#616161',
      ERROR: '#B71C1C'
    };

    const stateLabels = {
      OBSERVING: 'OBSERVANDO',
      SIGNAL_FOUND: 'SINAL ENCONTRADO',
      WAITING_HUMAN: 'AGUARDANDO OPERADOR',
      EXECUTING: 'EXECUTANDO',
      CONFIRMED: 'CONFIRMADO',
      CANCELLED: 'CANCELADO',
      PAUSED: 'PAUSADO',
      ERROR: 'ERRO'
    };

    if (badge) {
      badge.textContent = stateLabels[state] || state;
      badge.style.background = stateColors[state] || '#555';
    }

    if (state === 'WAITING_HUMAN' && plan) {
      suggestion.style.display = 'block';
      const actionCfg = COLORS[plan.action] || {};
      actionLabel.textContent = actionCfg.label || plan.action;
      actionLabel.style.color = actionCfg.bg || '#fff';
      conviction.textContent = (plan.conviction || '--') + '%';
      if (plan.explanation) explanation.textContent = plan.explanation;
    } else {
      suggestion.style.display = 'none';
    }

    if (message) explanation.textContent = message;
  }

  function updateCountdown(seconds) {
    const cdEl = overlayEl.querySelector('#hitl-countdown');
    if (cdEl) {
      cdEl.textContent = seconds > 0 ? 'Auto em ' + seconds + 's...' : 'Executando...';
      cdEl.style.color = seconds <= 3 ? '#f44336' : '#FF9800';
    }
  }

  function updateBankroll(br) {
    const profit = overlayEl.querySelector('#br-profit');
    const gale = overlayEl.querySelector('#br-gale');
    const stake = overlayEl.querySelector('#br-stake');
    if (profit) {
      profit.textContent = 'R$ ' + (br.sessionProfit || 0).toFixed(2);
      profit.style.color = br.sessionProfit >= 0 ? '#4CAF50' : '#f44336';
    }
    if (gale) gale.textContent = 'G' + (br.galeLevel || 0);
    if (stake) stake.textContent = 'R$ ' + (br.currentStake || 5).toFixed(2);
  }

  function updateTabuleiro(history) {
    if (!tabuleiro || !history) return;
    tabuleiro.innerHTML = '';
    const last30 = history.slice(-30);
    last30.forEach(result => {
      const cfg = COLORS[result] || { bg: '#555', emoji: '?' };
      const cell = document.createElement('div');
      cell.style.cssText = 'width: 22px; height: 22px; border-radius: 50%; background: ' + cfg.bg + '; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: #fff;';
      cell.textContent = cfg.emoji;
      tabuleiro.appendChild(cell);
    });
  }

  function log(msg) {
    if (!logEl) return;
    const line = document.createElement('div');
    line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
    logEl.insertBefore(line, logEl.firstChild);
    while (logEl.children.length > 20) logEl.removeChild(logEl.lastChild);
  }

  function showSuggestion(plan) {
    update({ state: 'WAITING_HUMAN', plan });
  }

  function hideSuggestion() {
    const suggestion = overlayEl && overlayEl.querySelector('#hitl-suggestion');
    if (suggestion) suggestion.style.display = 'none';
  }

  function toggleVisibility() {
    const main = overlayEl.querySelector('#hitl-main');
    const btn = overlayEl.querySelector('#btn-toggle');
    isVisible = !isVisible;
    main.style.display = isVisible ? 'flex' : 'none';
    btn.textContent = isVisible ? '−' : '+';
  }

  function startEngine() {
    if (window.DecisionEngine) {
      window.DecisionEngine.start();
      log('Engine INICIADO pelo operador');
    }
  }

  function stopEngine() {
    if (window.DecisionEngine) {
      window.DecisionEngine.stop();
      log('Engine PARADO pelo operador');
    }
  }

  function init() {
    createOverlay();
    log('Sistema inicializado e pronto');
  }

  // API Publica
  return {
    init: createOverlay,
    update,
    showSuggestion,
    hideSuggestion,
    log,
    updateTabuleiro
  };

})();

// Auto inicializar
if (typeof window !== 'undefined') {
  window.Overlay = Overlay;
  window.OverlayManager = Overlay;
  console.log("[Overlay] Overlay Premium carregado com HITL forte");
}
