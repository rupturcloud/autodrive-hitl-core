/**
 * Autodrive HITL Core - Content Script v2.4
 * Roda em betboom.bet.br - Ponto de entrada principal
 * Recebe dados do iframe do jogo via window.postMessage
 * e coordena todos os motores
 */

console.log('[Content] Autodrive HITL Core v2.4 inicializando...');

(async () => {
  'use strict';

  const VERSION = '2.4.0';
  const IFRAME_MSG_SOURCE = 'AUTODRIVE_IFRAME_AGENT';

  // Estado interno
  const state = {
    running: false,
    history: [],         // Historico normalizado ['P','B','T']
    galeLevel: 0,
    sessionProfit: 0,
    roundsPlayed: 0,
    bettingPhaseActive: false
  };

  /**
   * Inicializa todos os modulos
   */
  function initModules() {
    // Iniciar DecisionEngine
    if (typeof DecisionEngine !== 'undefined') {
      DecisionEngine.start();
    }

    // Iniciar Overlay
    if (typeof Overlay !== 'undefined') {
      Overlay.init();
      Overlay.log('Sistema v2.4 inicializado', 'info');
    }

    console.log('[Content] Sistema inicializado. Aguardando dados do jogo via iframe...');
  }

  /**
   * Normaliza resultado do iframe para formato interno
   */
  function normalizeResult(raw) {
    if (!raw) return null;
    const r = String(raw).toUpperCase().trim();
    if (r === 'P' || r === 'PLAYER' || r === 'JOGADOR' || r === 'A' || r === 'AZUL') return 'P';
    if (r === 'B' || r === 'BANKER' || r === 'BANCA' || r === 'V' || r === 'VERMELHO') return 'B';
    if (r === 'T' || r === 'TIE' || r === 'EMPATE' || r === 'E') return 'T';
    return null;
  }

  /**
   * Processa atualizacao de dados do jogo
   */
  async function onGameDataUpdate(payload) {
    const { results, latestResult, bettingPhase, totalRounds } = payload;

    // Atualiza fase de apostas
    if (bettingPhase !== undefined) {
      state.bettingPhaseActive = bettingPhase;
    }

    // Atualiza historico se recebeu novos resultados
    if (Array.isArray(results) && results.length > 0) {
      const normalized = results.map(normalizeResult).filter(Boolean);
      if (normalized.length !== state.history.length) {
        state.history = normalized;
        console.log('[Content] Historico atualizado:', state.history.length, 'rodadas');

        // Atualizar overlay tabuleiro
        if (typeof Overlay !== 'undefined') {
          Overlay.updateTabuleiro(state.history);
        }

        // Atualizar HistoryStore
        if (typeof HistoryStore !== 'undefined') {
          HistoryStore.setHistory(state.history);
        }
      }
    }

    // Se temos novo resultado e o motor esta rodando, tomar decisao
    if (state.running && state.history.length >= 5) {
      await runDecisionCycle();
    }
  }

  /**
   * Ciclo de decisao principal
   */
  async function runDecisionCycle() {
    try {
      if (typeof DecisionEngine === 'undefined') return;

      const decision = await DecisionEngine.executarFluxoCompleto(state.history);

      if (decision && decision.shouldBet) {
        console.log('[Content] Decisao:', decision.cor, '| Conviction:', decision.convictionScore);

        if (typeof Overlay !== 'undefined') {
          Overlay.log(
            decision.autoExecute
              ? 'Autodrive: ' + decision.cor.toUpperCase()
              : 'Sugestao HITL: ' + decision.cor.toUpperCase() + ' (' + decision.convictionScore + '%)',
            'success'
          );
        }
      }
    } catch (e) {
      console.error('[Content] Erro no ciclo de decisao:', e);
    }
  }

  /**
   * Listener para mensagens do iframe do jogo
   */
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.source !== IFRAME_MSG_SOURCE) return;

    switch (data.type) {
      case 'AGENT_READY':
        console.log('[Content] IframeAgent conectado em:', data.payload.url);
        if (typeof Overlay !== 'undefined') {
          Overlay.log('Agente do jogo conectado!', 'success');
        }
        break;

      case 'GAME_DATA_UPDATE':
        onGameDataUpdate(data.payload);
        break;

      case 'BETTING_PHASE_ACTIVE':
        state.bettingPhaseActive = true;
        break;

      default:
        break;
    }
  });

  /**
   * Listener para mensagens do background/popup
   */
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case 'START':
        state.running = true;
        if (typeof DecisionEngine !== 'undefined') DecisionEngine.start();
        if (typeof Overlay !== 'undefined') Overlay.log('Engine INICIADO pelo operador', 'success');
        console.log('[Content] Motor INICIADO');
        sendResponse({ ok: true });
        break;

      case 'STOP':
        state.running = false;
        if (typeof DecisionEngine !== 'undefined') DecisionEngine.stop();
        if (typeof Overlay !== 'undefined') Overlay.log('Engine PARADO', 'warn');
        console.log('[Content] Motor PARADO');
        sendResponse({ ok: true });
        break;

      case 'GET_STATE':
        sendResponse({
          running: state.running,
          historyLength: state.history.length,
          galeLevel: state.galeLevel,
          sessionProfit: state.sessionProfit,
          roundsPlayed: state.roundsPlayed
        });
        break;

      case 'SET_CONFIG':
        if (msg.config && typeof DecisionEngine !== 'undefined') {
          DecisionEngine.setConfig(msg.config);
        }
        sendResponse({ ok: true });
        break;
    }
    return true; // async
  });

  /**
   * Observador de DOM como fallback (para paginas sem iframe separado)
   */
  function setupDOMFallback() {
    const observer = new MutationObserver(() => {
      if (!state.running) return;

      // Tenta extrair resultados do DOM do proprio betboom
      if (typeof InteractionIntelligence !== 'undefined') {
        const domResults = InteractionIntelligence.extractHistoryFromDOM();
        if (domResults && domResults.length > state.history.length) {
          state.history = domResults;
          if (typeof Overlay !== 'undefined') {
            Overlay.updateTabuleiro(state.history);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: false,
      attributes: false
    });

    console.log('[Content] DOM fallback observer ativo');
  }

  // Inicializar
  initModules();
  setupDOMFallback();

  console.log('[Content] Content script v2.4 pronto. Aguardando dados do iframe...');

})();
