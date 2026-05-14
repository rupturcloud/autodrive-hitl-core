/**
 * Autodrive HITL Core - Decision Engine v2.4
 * Orquestrador central: Padroes -> Conviction -> Consensus -> ContextHealth -> HITL -> Executor
 * Implementa FSM: OBSERVING -> SIGNAL_FOUND -> WAITING_HUMAN -> EXECUTING -> CONFIRMED
 */

const DecisionEngine = (() => {

  // === FSM States ===
  const STATES = {
    IDLE: 'IDLE',
    OBSERVING: 'OBSERVING',
    SIGNAL_FOUND: 'SIGNAL_FOUND',
    WAITING_HUMAN: 'WAITING_HUMAN',
    EXECUTING: 'EXECUTING',
    CONFIRMED: 'CONFIRMED',
    CANCELLED: 'CANCELLED',
    PAUSED: 'PAUSED'
  };

  // === Config ===
  const CONFIG = {
    autodriveThreshold: 85,    // % conviction para auto-executar
    hitlThreshold: 65,         // % conviction para sugerir e aguardar
    countdownSeconds: 8,       // segundos para auto-confirmar se HITL
    galeMax: 4,                // limite de gales
    stopWin: 0,                // 0 = desabilitado
    stopLoss: 0,               // 0 = desabilitado
    stakeBase: 5.00,           // stake inicial
  };

  // === State ===
  let state = STATES.IDLE;
  let currentPlan = null;
  let bankroll = {
    galeLevel: 0,
    sessionProfit: 0,
    totalBets: 0,
    wins: 0,
    losses: 0,
    currentStake: CONFIG.stakeBase
  };
  let isRunning = false;
  let countdownTimer = null;
  let traceId = null;

  // === Core: Processar nova rodada ===
  function processRound(history) {
    if (!isRunning || state === STATES.PAUSED) return;

    traceId = generateTraceId();
    logEvent('round_processed', { historyLen: history.length, traceId });

    // 1. Detectar padroes
    const patterns = window.PatternEngine
      ? window.PatternEngine.detectPatterns(history)
      : [];

    if (patterns.length === 0) {
      setState(STATES.OBSERVING);
      notifyOverlay({ state: 'OBSERVING', message: 'Aguardando padrao...' });
      return;
    }

    const topPattern = patterns[0];

    // 2. Calcular Conviction
    const conviction = calculateConviction(topPattern, history);

    // 3. Context Health
    const health = calculateContextHealth(history);

    // 4. Consensus
    const consensus = calculateConsensus(patterns);

    // 5. Montar plano
    currentPlan = {
      traceId,
      pattern: topPattern,
      action: topPattern.action,
      conviction,
      consensus,
      health,
      stake: calculateStake(),
      timestamp: Date.now(),
      explanation: buildExplanation(topPattern, conviction, health, consensus)
    };

    setState(STATES.SIGNAL_FOUND);
    logEvent('signal_found', currentPlan);

    // 6. Decidir modo: Autodrive ou HITL
    if (conviction >= CONFIG.autodriveThreshold) {
      autoExecute();
    } else if (conviction >= CONFIG.hitlThreshold) {
      requestHumanConfirmation();
    } else {
      setState(STATES.OBSERVING);
      notifyOverlay({ state: 'OBSERVING', message: 'Confianca insuficiente (' + conviction + '%)' });
    }
  }

  // === Autodrive: execucao automatica ===
  function autoExecute() {
    setState(STATES.EXECUTING);
    notifyOverlay({
      state: 'EXECUTING',
      plan: currentPlan,
      message: 'AUTODRIVE: Executando ' + currentPlan.action + ' (' + currentPlan.conviction + '%)'
    });
    executeAction();
  }

  // === HITL: aguardar confirmacao humana ===
  function requestHumanConfirmation() {
    setState(STATES.WAITING_HUMAN);
    notifyOverlay({
      state: 'WAITING_HUMAN',
      plan: currentPlan,
      countdown: CONFIG.countdownSeconds,
      message: 'AGUARDANDO: Confirme a entrada ou cancele'
    });

    // Countdown para auto-executar
    let remaining = CONFIG.countdownSeconds;
    countdownTimer = setInterval(() => {
      remaining--;
      notifyOverlay({ countdown: remaining });
      if (remaining <= 0) {
        clearInterval(countdownTimer);
        if (state === STATES.WAITING_HUMAN) {
          autoExecute();
        }
      }
    }, 1000);
  }

  // === Confirmar entrada (botao humano) ===
  function confirmEntry() {
    if (state !== STATES.WAITING_HUMAN) return;
    clearInterval(countdownTimer);
    setState(STATES.EXECUTING);
    logEvent('human_confirmed', { traceId });
    executeAction();
  }

  // === Cancelar entrada (botao humano) ===
  function cancelEntry() {
    clearInterval(countdownTimer);
    setState(STATES.CANCELLED);
    logEvent('human_cancelled', { traceId });
    notifyOverlay({ state: 'CANCELLED', message: 'Entrada cancelada pelo operador' });
    setTimeout(() => setState(STATES.OBSERVING), 2000);
  }

  // === Executar acao no DOM ===
  function executeAction() {
    if (!currentPlan) return;

    const action = currentPlan.action;
    const stake = currentPlan.stake;

    // Verificar Stop Win/Loss antes de executar
    if (isStopReached()) return;

    // Delegar ao Executor (interaction-intelligence)
    if (window.Executor) {
      window.Executor.executar({ action, stake, traceId })
        .then(result => {
          if (result.success) {
            onExecutionSuccess(result);
          } else {
            onExecutionFailure(result);
          }
        })
        .catch(err => {
          logEvent('execution_error', { error: err.message, traceId });
          setState(STATES.OBSERVING);
        });
    } else {
      logEvent('executor_not_found', { traceId });
      setState(STATES.OBSERVING);
    }
  }

  function onExecutionSuccess(result) {
    setState(STATES.CONFIRMED);
    bankroll.totalBets++;
    logEvent('execution_success', { result, traceId });
    notifyOverlay({ state: 'CONFIRMED', message: 'Entrada executada!' });
    setTimeout(() => setState(STATES.OBSERVING), 3000);
  }

  function onExecutionFailure(result) {
    logEvent('execution_failure', { result, traceId });
    setState(STATES.OBSERVING);
    notifyOverlay({ state: 'ERROR', message: 'Falha na execucao' });
  }

  // === Atualizar resultado da rodada ===
  function onRoundResult(result) {
    if (!currentPlan) return;
    const won = result.winner === currentPlan.action;

    if (won) {
      bankroll.wins++;
      bankroll.galeLevel = 0;
      bankroll.currentStake = CONFIG.stakeBase;
      bankroll.sessionProfit += currentPlan.stake;
      logEvent('round_win', { profit: currentPlan.stake, traceId });
    } else if (result.winner !== 'Am') {
      bankroll.losses++;
      bankroll.sessionProfit -= currentPlan.stake;
      if (bankroll.galeLevel < CONFIG.galeMax) {
        bankroll.galeLevel++;
        bankroll.currentStake = CONFIG.stakeBase * Math.pow(2, bankroll.galeLevel);
      }
      logEvent('round_loss', { galeLevel: bankroll.galeLevel, traceId });
    }

    notifyOverlay({ bankroll: { ...bankroll } });
    isStopReached();
  }

  // === Calcular stake com gale ===
  function calculateStake() {
    return bankroll.currentStake;
  }

  // === Stop Win / Stop Loss ===
  function isStopReached() {
    if (CONFIG.stopWin > 0 && bankroll.sessionProfit >= CONFIG.stopWin) {
      pause();
      notifyOverlay({ state: 'PAUSED', message: 'Stop Win atingido! Sessao pausada.' });
      return true;
    }
    if (CONFIG.stopLoss > 0 && bankroll.sessionProfit <= -CONFIG.stopLoss) {
      pause();
      notifyOverlay({ state: 'PAUSED', message: 'Stop Loss atingido! Sessao pausada.' });
      return true;
    }
    return false;
  }

  // === Conviction Score ===
  function calculateConviction(pattern, history) {
    let score = pattern.confidence || 70;
    if (pattern.type === 'complex') score += 5;
    if (pattern.type === 'yellow') score += 3;
    if (history.length >= 20) score += 5;
    return Math.min(99, Math.round(score));
  }

  // === Context Health ===
  function calculateContextHealth(history) {
    if (!history || history.length < 5) return { score: 50, stable: false };
    const last10 = history.slice(-10);
    const uniqueRatio = new Set(last10).size / last10.length;
    const score = Math.round(50 + uniqueRatio * 50);
    return { score, stable: score >= 60 };
  }

  // === Consensus Score ===
  function calculateConsensus(patterns) {
    if (patterns.length === 0) return 0;
    const sameAction = patterns.filter(p => p.action === patterns[0].action).length;
    return Math.round((sameAction / patterns.length) * 100);
  }

  // === Explicabilidade ===
  function buildExplanation(pattern, conviction, health, consensus) {
    return pattern.name + ' | Conviction: ' + conviction + '% | Health: ' + health.score + '% | Consensus: ' + consensus + '%';
  }

  // === FSM ===
  function setState(newState) {
    const prev = state;
    state = newState;
    logEvent('state_change', { from: prev, to: newState });
  }

  function start(config) {
    if (config) Object.assign(CONFIG, config);
    isRunning = true;
    setState(STATES.OBSERVING);
    console.log("[DecisionEngine] Motor de Decisao ATIVADO");
  }

  function stop() {
    isRunning = false;
    console.log("[DecisionEngine] Motor de Decisao DESATIVADO");
  }

  function pause() { setState(STATES.PAUSED); }
  function resume() { setState(STATES.OBSERVING); }

  // === Helpers ===
  function generateTraceId() {
    return 'trace_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  function logEvent(type, data) {
    const entry = { type, data, ts: Date.now(), state };
    if (window.EventStore) window.EventStore.push(entry);
    console.debug('[DecisionEngine]', type, data);
  }

  function notifyOverlay(data) {
    if (window.OverlayManager) window.OverlayManager.update(data);
  }

  function getState() { return { state, bankroll: { ...bankroll }, config: { ...CONFIG } }; }
  function updateConfig(cfg) { Object.assign(CONFIG, cfg); }

  return {
    processRound,
    confirmEntry,
    cancelEntry,
    onRoundResult,
    start,
    stop,
    pause,
    resume,
    getState,
    updateConfig,
    STATES
  };

})();

// Expor globalmente
window.DecisionEngine = DecisionEngine;

console.log("[DecisionEngine] Decision Engine v2.4 carregado com HITL + Autodrive");
