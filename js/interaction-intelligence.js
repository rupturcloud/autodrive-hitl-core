/**
 * Autodrive HITL Core - Interaction Intelligence v2.4
 * Detecta e valida o elemento de clique correto na plataforma
 * Responsável por identificar botões W/M/S/G de forma robusta
 */

const InteractionIntelligence = (() => {

  // Mapeamento de plataformas para seus seletores de botões
  const PLATFORM_SELECTORS = {
    betboom: {
      name: 'BetBoom',
      detect: () => window.location.hostname.includes('betboom'),
      buttonSelectors: [
        '[data-outcome="player"]',
        '[data-outcome="banker"]',
        '[data-outcome="tie"]',
        '.bet-button',
        '.outcome-button'
      ],
      resultSelectors: [
        '.game-history td',
        '.round-result',
        '.history-item'
      ]
    },
    brazzer: {
      name: 'Brazzer',
      detect: () => window.location.hostname.includes('brazzer') || window.location.hostname.includes('brzr'),
      buttonSelectors: [
        '[data-bet="player"]',
        '[data-bet="banker"]',
        '[data-bet="tie"]',
        '.bet-option',
        '.game-bet'
      ],
      resultSelectors: [
        '.history-row',
        '.game-result',
        '.round-history'
      ]
    },
    h2: {
      name: 'H2',
      detect: () => window.location.hostname.includes('h2club') || window.location.hostname.includes('h2.club'),
      buttonSelectors: [
        '[class*="player-bet"]',
        '[class*="banker-bet"]',
        '[class*="tie-bet"]',
        '.baccarat-bet',
        '[data-action="bet"]'
      ],
      resultSelectors: [
        '.round-result',
        '[class*="history"]',
        '.bead-road td'
      ]
    },
    generic: {
      name: 'Generic',
      detect: () => true,
      buttonSelectors: [
        '[data-testid*="player"]',
        '[data-testid*="banker"]',
        '[aria-label*="Player"]',
        '[aria-label*="Banker"]',
        'button[class*="player"]',
        'button[class*="banker"]'
      ],
      resultSelectors: [
        '[class*="history"]',
        '[class*="result"]',
        'table.road'
      ]
    }
  };

  let currentPlatform = null;
  let detectedElements = {};

  /**
   * Detecta a plataforma atual
   * @returns {Object} Platform config
   */
  function detectPlatform() {
    for (const [key, platform] of Object.entries(PLATFORM_SELECTORS)) {
      if (key !== 'generic' && platform.detect()) {
        currentPlatform = platform;
        console.log('[InteractionIntelligence] Platform detected:', platform.name);
        return platform;
      }
    }
    currentPlatform = PLATFORM_SELECTORS.generic;
    console.log('[InteractionIntelligence] Using generic platform adapter');
    return currentPlatform;
  }

  /**
   * Encontra elemento de botão para um outcome específico
   * @param {string} outcome - 'P' (Player), 'B' (Banker), 'T' (Tie)
   * @returns {Element|null}
   */
  function findBetButton(outcome) {
    const platform = currentPlatform || detectPlatform();
    const outcomeMap = { P: 'player', B: 'banker', T: 'tie' };
    const outcomeStr = outcomeMap[outcome] || outcome.toLowerCase();

    for (const selector of platform.buttonSelectors) {
      try {
        // Try with outcome in selector
        const specificSelector = selector.replace('player', outcomeStr).replace('banker', outcomeStr).replace('tie', outcomeStr);
        const el = document.querySelector(specificSelector);
        if (el && isElementVisible(el) && isElementInteractable(el)) {
          detectedElements[outcome] = el;
          return el;
        }
      } catch (e) {
        // Selector might be invalid for this outcome - continue
      }
    }

    // Fallback: search by text content
    const allButtons = Array.from(document.querySelectorAll('button, [role="button"], [onclick]'));
    const targetBtn = allButtons.find(btn => {
      const text = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
      if (outcomeStr === 'player') return text.includes('player') || text.includes('jogador');
      if (outcomeStr === 'banker') return text.includes('banker') || text.includes('banca');
      if (outcomeStr === 'tie') return text.includes('tie') || text.includes('empate');
      return false;
    });

    if (targetBtn && isElementVisible(targetBtn)) {
      detectedElements[outcome] = targetBtn;
      return targetBtn;
    }

    return null;
  }

  /**
   * Verifica se elemento está visível
   * @param {Element} el
   * @returns {boolean}
   */
  function isElementVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  /**
   * Verifica se elemento pode ser clicado
   * @param {Element} el
   * @returns {boolean}
   */
  function isElementInteractable(el) {
    if (!el) return false;
    if (el.disabled) return false;
    const style = window.getComputedStyle(el);
    if (style.pointerEvents === 'none') return false;
    return true;
  }

  /**
   * Detecta e valida clique - função principal
   * @param {string} outcome - Outcome para apostar ('P', 'B', 'T')
   * @returns {Object} { canClick, element, reason }
   */
  function detectAndValidateClick(outcome) {
    if (!outcome) {
      return { canClick: false, element: null, reason: 'Sem outcome definido' };
    }

    const platform = currentPlatform || detectPlatform();
    const element = findBetButton(outcome);

    if (!element) {
      return {
        canClick: false,
        element: null,
        reason: `Botão para ${outcome} não encontrado na plataforma ${platform.name}`
      };
    }

    if (!isElementVisible(element)) {
      return {
        canClick: false,
        element: null,
        reason: `Botão para ${outcome} não está visível`
      };
    }

    if (!isElementInteractable(element)) {
      return {
        canClick: false,
        element: null,
        reason: `Botão para ${outcome} não está interagível (desabilitado ou sem pointer-events)`
      };
    }

    return {
      canClick: true,
      element,
      reason: `Botão ${outcome} pronto para clique na plataforma ${platform.name}`
    };
  }

  /**
   * Extrai histórico de resultados da tela
   * @returns {Array} Array de resultados ['W','L','T']
   */
  function extractHistoryFromDOM() {
    const platform = currentPlatform || detectPlatform();
    const results = [];

    for (const selector of platform.resultSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.forEach(el => {
            const text = el.textContent.toLowerCase().trim();
            if (text.includes('w') || text.includes('win') || text.includes('won')) results.push('W');
            else if (text.includes('l') || text.includes('loss') || text.includes('lose')) results.push('L');
            else if (text.includes('t') || text.includes('tie') || text.includes('empate')) results.push('T');
          });
          if (results.length > 0) break;
        }
      } catch (e) {
        // Continue with next selector
      }
    }

    return results;
  }

  /**
   * Reseta detecções armazenadas
   */
  function reset() {
    detectedElements = {};
    currentPlatform = null;
  }

  /**
   * Retorna plataforma atual
   */
  function getCurrentPlatform() {
    return currentPlatform;
  }

  return {
    detectPlatform,
    detectAndValidateClick,
    findBetButton,
    extractHistoryFromDOM,
    isElementVisible,
    isElementInteractable,
    reset,
    getCurrentPlatform
  };

})();
