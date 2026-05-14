/**
 * Autodrive HITL Core - Injected.js v2.4
 * Roda DENTRO do iframe do Evolution (billing-boom / evo-games)
 * Extrai resultados do road map e envia pro frame pai via postMessage
 */

(() => {
  'use strict';

  const VERSION = '2.4.2';
  const SOURCE = 'AUTODRIVE_IFRAME_AGENT';

  let lastHistoryHash = '';
  let pollInterval = null;

  function sendToParent(type, payload) {
    try {
      window.top.postMessage({
        source: SOURCE,
        type: type,
        payload: payload,
        timestamp: Date.now(),
        version: VERSION
      }, '*');
    } catch (e) {
      console.warn('[Injected] Nao conseguiu enviar mensagem pro top frame');
    }
  }

  // Extrai resultados do road map do Bac Bo (SVG circles + classes)
  function extractCurrentHistory() {
    const results = [];

    // Estrategia 1: Bolinhas SVG (mais confiavel no Evolution)
    document.querySelectorAll('svg circle, svg ellipse, .bead, .roadmap-item').forEach(el => {
      const fill = (el.getAttribute('fill') || '').toLowerCase();
      const className = (el.className || el.getAttribute('class') || '').toLowerCase();

      if (fill.includes('blue') || className.includes('player') || className.includes('azul')) {
        results.push('A');
      } else if (fill.includes('red') || className.includes('banker') || className.includes('vermelho')) {
        results.push('V');
      } else if (fill.includes('green') || className.includes('tie') || className.includes('empate')) {
        results.push('E');
      }
    });

    // Estrategia 2: Fallback por texto/classe
    if (results.length === 0) {
      document.querySelectorAll('[class*="result"], [class*="bead"], [data-result]').forEach(el => {
        const text = (el.textContent || el.getAttribute('data-result') || '').toLowerCase();
        if (text.includes('player') || text.includes('azul')) results.push('A');
        else if (text.includes('banker') || text.includes('vermelho')) results.push('V');
        else if (text.includes('tie') || text.includes('empate')) results.push('E');
      });
    }

    return results;
  }

  function pollGameState() {
    const currentHistory = extractCurrentHistory();
    const currentHash = currentHistory.join('');

    if (currentHash !== lastHistoryHash && currentHistory.length > 0) {
      lastHistoryHash = currentHash;
      sendToParent('ROUND_HISTORY', {
        history: currentHistory,
        latest: currentHistory[currentHistory.length - 1],
        total: currentHistory.length
      });
      console.log('[Injected] Nova rodada detectada: ' + currentHistory.slice(-5).join(' '));
    }
  }

  // Iniciar polling
  function start() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(pollGameState, 800); // polling agressivo
    console.log('[Injected] Agente dentro do iframe iniciado - v' + VERSION);
  }

  // Parar
  function stop() {
    if (pollInterval) clearInterval(pollInterval);
  }

  // Inicializar automaticamente
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // Exposicao para debug
  window.AutodriveInjected = { start, stop, extractCurrentHistory };

})();

console.log('[Injected] Script carregado dentro do iframe Evolution');
