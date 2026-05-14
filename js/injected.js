/**
 * Autodrive HITL Core - Injected Script v2.4
 * Script injetado via chrome.scripting.executeScript ou world: MAIN
 * Executa no contexto da página para acessar objetos do jogo diretamente
 * Comunicação com content.js via window.postMessage
 */

(() => {
  'use strict';

  const CHANNEL = 'AUTODRIVE_HITL_INJECTED';
  const VERSION = '2.4.0';

  let isInitialized = false;
  let gameObserver = null;

  /**
   * Envia mensagem para o content.js
   * @param {string} type - Tipo da mensagem
   * @param {Object} payload - Dados a enviar
   */
  function postToExtension(type, payload = {}) {
    window.postMessage({
      source: CHANNEL,
      type,
      payload,
      timestamp: Date.now(),
      version: VERSION
    }, '*');
  }

  /**
   * Extrai estado atual do jogo diretamente dos objetos da página
   * Tenta múltiplas estratégias para diferentes plataformas
   * @returns {Object|null} Estado do jogo ou null se não encontrado
   */
  function extractGameState() {
    // Estratégia 1: Objeto global do jogo
    const gameObjects = [
      window.game, window.Game, window.GameState,
      window.baccaratGame, window.liveGame,
      window.__game, window.__state, window.gameData
    ];

    for (const obj of gameObjects) {
      if (obj && typeof obj === 'object') {
        try {
          const state = {
            results: extractResults(obj),
            currentRound: obj.round || obj.currentRound || obj.roundNumber || null,
            betOptions: extractBetOptions(obj),
            status: obj.status || obj.state || obj.gameStatus || null
          };
          if (state.results && state.results.length > 0) {
            return state;
          }
        } catch (e) {
          // Continue to next strategy
        }
      }
    }

    // Estratégia 2: Redux/Zustand store
    try {
      const store = window.__REDUX_STORE__ || window.store;
      if (store && store.getState) {
        const state = store.getState();
        if (state.game || state.baccarat || state.live) {
          return { source: 'redux', state: state.game || state.baccarat || state.live };
        }
      }
    } catch (e) {}

    // Estratégia 3: DOM parsing (fallback)
    return extractFromDOM();
  }

  /**
   * Extrai resultados de um objeto de jogo
   * @param {Object} gameObj
   * @returns {Array|null}
   */
  function extractResults(gameObj) {
    const possibleKeys = ['results', 'history', 'rounds', 'outcomes', 'gameHistory', 'roundHistory'];
    for (const key of possibleKeys) {
      if (Array.isArray(gameObj[key]) && gameObj[key].length > 0) {
        return gameObj[key];
      }
    }
    return null;
  }

  /**
   * Extrai opções de aposta disponíveis
   * @param {Object} gameObj
   * @returns {Object}
   */
  function extractBetOptions(gameObj) {
    return {
      playerEnabled: !gameObj.playerDisabled && gameObj.bettingOpen !== false,
      bankerEnabled: !gameObj.bankerDisabled && gameObj.bettingOpen !== false,
      tieEnabled: !gameObj.tieDisabled && gameObj.bettingOpen !== false,
      bettingOpen: gameObj.bettingOpen !== false
    };
  }

  /**
   * Extrai estado do jogo a partir do DOM
   * @returns {Object}
   */
  function extractFromDOM() {
    const historyEls = document.querySelectorAll(
      '.game-history td, .round-result, .history-item, .road-map td, .bead-road td'
    );

    if (historyEls.length === 0) return null;

    const results = [];
    historyEls.forEach(el => {
      const text = el.textContent.trim().toUpperCase();
      const cls = el.className.toLowerCase();

      if (text === 'W' || text === 'P' || cls.includes('player') || cls.includes('blue')) {
        results.push({ result: 'W', source: 'dom' });
      } else if (text === 'L' || text === 'B' || cls.includes('banker') || cls.includes('red')) {
        results.push({ result: 'L', source: 'dom' });
      } else if (text === 'T' || cls.includes('tie') || cls.includes('green')) {
        results.push({ result: 'T', source: 'dom' });
      }
    });

    return results.length > 0 ? { results, source: 'dom' } : null;
  }

  /**
   * Inicia observação do DOM para detectar novos resultados
   */
  function startGameObserver() {
    if (gameObserver) gameObserver.disconnect();

    let lastResultCount = 0;

    gameObserver = new MutationObserver((mutations) => {
      let hasGameChange = false;

      for (const mutation of mutations) {
        const target = mutation.target;
        const targetClass = (target.className || '').toLowerCase();
        const targetId = (target.id || '').toLowerCase();

        if (
          targetClass.includes('history') || targetClass.includes('result') ||
          targetClass.includes('road') || targetClass.includes('round') ||
          targetId.includes('history') || targetId.includes('game')
        ) {
          hasGameChange = true;
          break;
        }
      }

      if (hasGameChange) {
        const state = extractGameState();
        if (state) {
          const resultCount = Array.isArray(state.results) ? state.results.length : 0;
          if (resultCount !== lastResultCount) {
            lastResultCount = resultCount;
            postToExtension('GAME_STATE_UPDATE', { state });
          }
        }
      }
    });

    gameObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'data-result', 'data-outcome']
    });

    console.log('[Injected] Game observer started');
  }

  /**
   * Inicializa o script injetado
   */
  function init() {
    if (isInitialized) return;
    isInitialized = true;

    console.log(`[Injected] Autodrive HITL Core v${VERSION} - Injected script ready`);

    // Anunciar presença
    postToExtension('INJECTED_READY', { version: VERSION, url: window.location.href });

    // Coletar estado inicial
    const initialState = extractGameState();
    if (initialState) {
      postToExtension('INITIAL_STATE', { state: initialState });
    }

    // Iniciar observer
    startGameObserver();

    // Ouvir comandos do content.js
    window.addEventListener('message', (event) => {
      if (!event.data || event.data.source !== 'AUTODRIVE_CONTENT') return;

      const { type, payload } = event.data;

      switch (type) {
        case 'GET_STATE':
          postToExtension('GAME_STATE_UPDATE', { state: extractGameState() });
          break;
        case 'STOP_OBSERVER':
          if (gameObserver) {
            gameObserver.disconnect();
            gameObserver = null;
          }
          break;
        case 'START_OBSERVER':
          startGameObserver();
          break;
      }
    });
  }

  // Iniciar quando DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
