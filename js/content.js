/**
 * Autodrive HITL Core - Content Script v2.4
 * Roda em betboom.bet.br - Ponto de entrada principal
 * Recebe dados do iframe do jogo via window.postMessage
 * e coordena todos os motores
 */

console.log('[Content] Autodrive HITL Core v2.4 inicializando...');

(async () => {
  'use strict';

  const VERSION = '2.4.2';
  const IFRAME_SOURCE = 'AUTODRIVE_IFRAME_AGENT';

  // Estado interno
  const state = {
    running: false,
    history: [],         // Historico normalizado ['A','V','E']
    galeLevel: 0,
    sessionProfit: 0,
    roundsPlayed: 0,
    bettingPhaseActive: false
  };

  /**
   * Inicializa todos os modulos
   */
  function initModules() {
    // Inicializa Overlay
    if (typeof Overlay !== 'undefined') {
      Overlay.init();
      console.log('[Content] Overlay inicializado');
    }

    // Inicializa DecisionEngine
    if (typeof DecisionEngine !== 'undefined') {
      DecisionEngine.stop();
      console.log('[Content] DecisionEngine pronto');
    }

    console.log('[Content] Modulos inicializados com sucesso - v' + VERSION);
  }

  /**
   * Listener de mensagens do iframe (IframeAgent)
   */
  function setupMessageListener() {
    window.addEventListener('message', function(event) {
      const data = event.data;

      // Seguranca: so aceita mensagens do nosso agente
      if (!data || data.source !== IFRAME_SOURCE) return;

      console.log('[Content] Mensagem recebida do iframe: ' + data.type);

      switch (data.type) {
        case 'ROUND_HISTORY':
          processNewRound(data.payload);
          break;

        case 'GAME_STATE':
          // Futuro: pode usar para detectar fase de aposta
          console.log('[Content] Game state recebido:', data.payload);
          break;

        default:
          console.warn('[Content] Tipo de mensagem desconhecido:', data.type);
      }
    });

    console.log('[Content] MessageListener ativo - aguardando dados do iframe');
  }

  // ===================== PROCESSA NOVA RODADA =====================
  function processNewRound(payload) {
    const { history, latest, total } = payload;

    if (!history || history.length === 0) return;

    console.log('[Content] Nova rodada detectada! Total: ' + total + ' | Ultima: ' + latest);

    // Atualiza historico global
    if (typeof HistoryStore !== 'undefined') {
      HistoryStore.addMany(history);
    }

    // Atualiza estado interno
    state.history = history;
    state.roundsPlayed = total;

    // Atualiza tabuleiro no Overlay
    if (typeof Overlay !== 'undefined') {
      Overlay.updateTabuleiro(history);
    }

    // Roda ciclo de decisao se estiver ativo
    if (state.running && typeof DecisionEngine !== 'undefined') {
      DecisionEngine.executarFluxoCompleto(history).then(decision => {
        if (decision && decision.shouldBet) {
          console.log('[Content] Decisao: ' + decision.cor + ' | Conviction: ' + decision.convictionScore + '%');
        }
      }).catch(err => {
        console.error('[Content] Erro no ciclo de decisao:', err);
      });
    }
  }

  /**
   * Controles: start / stop / pause
   */
  function startEngine() {
    state.running = true;
    if (typeof DecisionEngine !== 'undefined') DecisionEngine.start();
    if (typeof Overlay !== 'undefined') Overlay.log('[Engine] Iniciado pelo operador', 'success');
    console.log('[Content] Engine INICIADO');
  }

  function stopEngine() {
    state.running = false;
    if (typeof DecisionEngine !== 'undefined') DecisionEngine.stop();
    if (typeof Overlay !== 'undefined') Overlay.log('[Engine] Parado pelo operador', 'warn');
    console.log('[Content] Engine PARADO');
  }

  /**
   * Inicializacao principal
   */
  function init() {
    initModules();
    setupMessageListener();

    // Expor controles globalmente
    window.AutodriveContent = {
      start: startEngine,
      stop: stopEngine,
      getState: () => state,
      VERSION
    };

    console.log('[Content] Autodrive HITL Core v' + VERSION + ' pronto - aguardando dados do iframe');
  }

  // Auto-inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

console.log('[Content] Content Script carregado com sucesso - Bridge com iframe ativo');
