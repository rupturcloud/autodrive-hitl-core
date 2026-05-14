/**
 * Autodrive HITL Core - Content Script v2.4
 * Ponto de entrada principal - inicializa todos os engines
 * Observa DOM do site alvo e dispara processamento de rodadas
 */

(function() {
  'use strict';

  let initialized = false;
  let lastRoundId = null;
  let roundObserver = null;

  // === Configuracao de seletores por plataforma ===
  const PLATFORM_SELECTORS = {
    betboom: {
      roundResult: '[class*="result"], [class*="winner"], [class*="road-map"]',
      history: '[class*="road"], [class*="beads"]',
      betButtons: '[class*="bet-player"], [class*="bet-banker"], [class*="bet-tie"]'
    }
  };

  // === Inicializar o sistema ===
  function init() {
    if (initialized) return;
    initialized = true;

    console.log('[Content] Autodrive HITL Core v2.4 inicializando...');

    // Aguardar DOM estar pronto
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
      bootstrap();
    }
  }

  function bootstrap() {
    // Inicializar Overlay
    if (window.Overlay) {
      window.Overlay.init();
    }

    // Inicializar DecisionEngine
    if (window.DecisionEngine) {
      window.DecisionEngine.start();
    }

    // Observar mudancas no DOM para detectar novas rodadas
    startObserver();

    console.log('[Content] Sistema inicializado. Observando rodadas...');
  }

  // === Observer de rodadas ===
  function startObserver() {
    roundObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (shouldProcessMutation(mutation)) {
          debounce(processNewRound, 500)();
        }
      });
    });

    roundObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-result', 'data-winner']
    });
  }

  function shouldProcessMutation(mutation) {
    if (!mutation.target) return false;
    const target = mutation.target;
    const cls = (target.className || '').toString();
    return cls.includes('result') || cls.includes('winner') || cls.includes('road') || cls.includes('bead');
  }

  // === Processar nova rodada ===
  function processNewRound() {
    const history = collectHistory();
    if (history.length === 0) return;

    const roundId = generateRoundId(history);
    if (roundId === lastRoundId) return;
    lastRoundId = roundId;

    console.log('[Content] Nova rodada detectada. Historico:', history.length, 'entradas');

    if (window.DecisionEngine) {
      window.DecisionEngine.processRound(history);
    }

    if (window.Overlay) {
      window.Overlay.updateTabuleiro(history);
    }
  }

  // === Coletar historico do DOM ===
  function collectHistory() {
    const history = [];

    // Tentar multiplos seletores
    const selectors = [
      '[class*="road-map"] [class*="circle"]',
      '[class*="beads"] [class*="item"]',
      '[class*="result-list"] [class*="item"]',
      '[data-result]'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        elements.forEach(el => {
          const result = extractResult(el);
          if (result) history.push(result);
        });
        if (history.length > 0) break;
      }
    }

    return history;
  }

  function extractResult(el) {
    const cls = (el.className || '').toString().toLowerCase();
    const dataResult = el.getAttribute('data-result') || '';
    const combined = cls + ' ' + dataResult;

    if (combined.includes('player') || combined.includes('blue') || combined.includes('p ') || combined.includes('-a')) return 'A';
    if (combined.includes('banker') || combined.includes('red') || combined.includes('b ') || combined.includes('-v')) return 'V';
    if (combined.includes('tie') || combined.includes('green') || combined.includes('t ') || combined.includes('-am')) return 'Am';
    return null;
  }

  function generateRoundId(history) {
    return history.slice(-5).join('') + '-' + history.length;
  }

  // === Debounce utility ===
  let debounceTimer = null;
  function debounce(fn, delay) {
    return function(...args) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // === Escutar mensagens do Background ===
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'START_ENGINE') {
        if (window.DecisionEngine) window.DecisionEngine.start(message.config);
        sendResponse({ ok: true });
      } else if (message.type === 'STOP_ENGINE') {
        if (window.DecisionEngine) window.DecisionEngine.stop();
        sendResponse({ ok: true });
      } else if (message.type === 'GET_STATE') {
        const state = window.DecisionEngine ? window.DecisionEngine.getState() : null;
        sendResponse({ state });
      }
    });
  }

  // Iniciar
  init();

})();
