/**
 * Autodrive HITL Core - injected.js v2.5
 * Roda DENTRO do iframe do Evolution (billing-boom.com / evo-games.com)
 * Extrai resultados do road map (bead road) e envia ao frame pai via postMessage
 */

(() => {
  'use strict';

  const SOURCE = 'AUTODRIVE_IFRAME';
  let lastHash = '';

  // Normaliza resultado para A/V/E
  function normalizeResult(raw) {
    const s = (raw || '').toLowerCase();
    if (s === 'player' || s === 'p' || s === 'blue' || s.includes('player') || s.includes('azul')) return 'A';
    if (s === 'banker' || s === 'b' || s === 'red' || s.includes('banker') || s.includes('banca') || s.includes('vermelho')) return 'V';
    if (s === 'tie' || s === 't' || s === 'green' || s.includes('tie') || s.includes('empate')) return 'E';
    return null;
  }

  // Estrategia 1: data-result attributes (mais comum no Evolution)
  function extractByDataResult() {
    const results = [];
    document.querySelectorAll('[data-result], [data-outcome]').forEach(el => {
      const r = el.getAttribute('data-result') || el.getAttribute('data-outcome') || '';
      const n = normalizeResult(r);
      if (n) results.push(n);
    });
    return results;
  }

  // Estrategia 2: SVG circles por fill color (bead road)
  function extractBySVGFill() {
    const results = [];
    const circles = document.querySelectorAll('svg circle, svg ellipse');
    circles.forEach(el => {
      const fill = (el.getAttribute('fill') || el.style.fill || '').toLowerCase();
      const r = el.getAttribute('r') || el.getAttribute('rx') || '0';
      if (parseFloat(r) < 3) return; // ignora circulos muito pequenos
      if (fill.includes('#0') || fill.includes('blue') || fill === 'rgb(0,0,255)' || fill.includes('3b82') || fill.includes('1d4e')) {
        results.push('A');
      } else if (fill.includes('red') || fill.includes('#e') || fill.includes('ef44') || fill.includes('dc26') || fill === 'rgb(255,0,0)') {
        results.push('V');
      } else if (fill.includes('green') || fill.includes('#0f') || fill.includes('22c5') || fill === 'rgb(0,128,0)') {
        results.push('E');
      }
    });
    return results;
  }

  // Estrategia 3: CSS classes (player/banker/tie)
  function extractByCSS() {
    const results = [];
    const selectors = [
      '.bead-road-cell', '.road-cell', '.result-bead',
      '[class*="player"]', '[class*="banker"]', '[class*="tie"]',
      '[class*="Player"]', '[class*="Banker"]', '[class*="Tie"]'
    ];
    const seen = new Set();
    selectors.forEach(sel => {
      try {
        document.querySelectorAll(sel).forEach(el => {
          if (seen.has(el)) return;
          seen.add(el);
          const cls = (el.className || '').toLowerCase();
          if (cls.includes('player') || cls.includes('azul')) results.push('A');
          else if (cls.includes('banker') || cls.includes('banca')) results.push('V');
          else if (cls.includes('tie') || cls.includes('empate')) results.push('E');
        });
      } catch(e) {}
    });
    return results;
  }

  // Estrategia 4: texto visivel em celulas do road map
  function extractByText() {
    const results = [];
    const cells = document.querySelectorAll('.road td, .bead td, [class*="road"] td, [class*="cell"]');
    cells.forEach(el => {
      const t = (el.textContent || '').trim().toUpperCase();
      if (t === 'P' || t === 'J') results.push('A');
      else if (t === 'B') results.push('V');
      else if (t === 'T' || t === 'E') results.push('E');
    });
    return results;
  }

  function getHistory() {
    let results = extractByDataResult();
    if (results.length < 4) results = extractBySVGFill();
    if (results.length < 4) results = extractByCSS();
    if (results.length < 4) results = extractByText();
    return results;
  }

  function poll() {
    const history = getHistory();
    const hash = history.join('');

    if (hash && hash !== lastHash && history.length >= 4) {
      lastHash = hash;
      window.top.postMessage({
        source: SOURCE,
        type: 'NEW_HISTORY',
        history: history,
        latest: history[history.length - 1],
        total: history.length
      }, '*');
      console.log('[Injected] Historico enviado: ' + history.slice(-6).join(' ') + ' (total=' + history.length + ')');
    }
  }

  // Inicia polling a cada 900ms
  setInterval(poll, 900);

  console.log('[Injected] Autodrive IframeAgent ativo - Evolution Gaming');

})();
