/**
 * Autodrive HITL Core - injected.js v2.4.4
 * Roda DENTRO do iframe do Evolution (billing-boom / evo-games)
 * Extrai resultados do road map e envia ao top frame via postMessage.
 *
 * Merge das duas linhas (v2.4.0 + v2.4.2):
 *  - Estrategias multiplas de extracao (SVG fill, classes Evolution, fallback texto)
 *  - 3 tipos de mensagens (GAME_DATA_UPDATE, BETTING_PHASE_ACTIVE, AGENT_READY)
 *  - Emite tambem ROUND_HISTORY (compat com content.js do Grok)
 *  - Polling 800ms + MutationObserver
 *  - Listener bidirecional (parent -> iframe)
 *  - Dedupe por hash de historico
 */

(() => {
  'use strict';

  const VERSION = '2.4.4';
  const MSG_SOURCE = 'AUTODRIVE_IFRAME_AGENT';
  const POLL_INTERVAL = 800;

  let lastResultCount = 0;
  let lastHistoryHash = '';
  let observer = null;
  let pollTimer = null;

  function sendToParent(type, payload) {
    try {
      window.top.postMessage({
        source: MSG_SOURCE,
        type,
        payload,
        timestamp: Date.now(),
        version: VERSION
      }, '*');
    } catch (e) {
      // cross-origin policy: silencioso
    }
  }

  /**
   * Extracao em camadas - usa o que casar primeiro.
   * Codigo de cor unificado: 'P' (Player/Azul), 'B' (Banker/Vermelho), 'T' (Tie/Empate).
   */
  function extractResults() {
    const results = [];

    // 1) SVG circles/ellipses com fill colorido (mais confiavel no Evolution)
    const svgCircles = document.querySelectorAll('svg circle[fill], svg ellipse[fill]');
    if (svgCircles.length > 0) {
      svgCircles.forEach((el) => {
        const fill = (el.getAttribute('fill') || '').toLowerCase();
        if (fill.includes('blue') || fill === '#0000ff' || fill === '#1e90ff' || fill.includes('3b82f6')) {
          results.push('P');
        } else if (fill.includes('red') || fill === '#ff0000' || fill === '#ef4444') {
          results.push('B');
        } else if (fill.includes('green') || fill === '#00ff00' || fill === '#22c55e') {
          results.push('T');
        }
      });
    }

    // 2) Classes CSS do road map (Evolution Bac Bo)
    if (results.length === 0) {
      const playerEls = document.querySelectorAll(
        '[class*="player"][class*="win"], [class*="Player"], [data-outcome="player"], [class*="blue-ball"], [class*="blueBall"]'
      );
      const bankerEls = document.querySelectorAll(
        '[class*="banker"][class*="win"], [class*="Banker"], [data-outcome="banker"], [class*="red-ball"], [class*="redBall"]'
      );
      const tieEls = document.querySelectorAll(
        '[class*="tie"], [class*="Tie"], [data-outcome="tie"], [class*="green-ball"], [class*="greenBall"]'
      );
      const maxLen = Math.max(playerEls.length, bankerEls.length, tieEls.length);
      if (maxLen > 0) {
        playerEls.forEach(() => results.push('P'));
        bankerEls.forEach(() => results.push('B'));
        tieEls.forEach(() => results.push('T'));
      }
    }

    // 3) Classes genericas + data-result + .roadmap-item
    if (results.length === 0) {
      document.querySelectorAll('[class*="result"], [class*="bead"], [data-result], .roadmap-item').forEach((el) => {
        const text = ((el.textContent || el.getAttribute('data-result') || '') + ' ' + (el.className || '') + '').toLowerCase();
        if (text.includes('player') || text.includes('azul')) results.push('P');
        else if (text.includes('banker') || text.includes('vermelho')) results.push('B');
        else if (text.includes('tie') || text.includes('empate')) results.push('T');
      });
    }

    // 4) Fallback texto bruto (so se nada acima funcionou)
    if (results.length === 0) {
      const allText = document.body ? (document.body.innerText || '') : '';
      const matches = allText.match(/\b(Player|Banker|Tie|PLAYER|BANKER|TIE|Jogador|Banca|Empate)\b/g);
      if (matches) {
        matches.forEach((m) => {
          const lower = m.toLowerCase();
          if (lower.includes('player') || lower.includes('jogador')) results.push('P');
          else if (lower.includes('banker') || lower.includes('banca')) results.push('B');
          else if (lower.includes('tie') || lower.includes('empate')) results.push('T');
        });
      }
    }

    return results;
  }

  function extractLatestResult() {
    const bigResult = document.querySelector(
      '[class*="result"][class*="display"], [class*="roundResult"], [class*="gameResult"], [class*="outcomeLabel"]'
    );
    if (bigResult) {
      const text = bigResult.textContent.trim().toLowerCase();
      if (text.includes('player') || text.includes('jogador')) return { result: 'P', source: 'bigDisplay' };
      if (text.includes('banker') || text.includes('banca'))   return { result: 'B', source: 'bigDisplay' };
      if (text.includes('tie') || text.includes('empate'))     return { result: 'T', source: 'bigDisplay' };
    }
    return null;
  }

  function isBettingPhase() {
    const betButtons = document.querySelectorAll(
      '[class*="player-bet"]:not([disabled]), [class*="banker-bet"]:not([disabled]), button[class*="bet"]:not([disabled])'
    );
    return betButtons.length > 0;
  }

  function monitorGame() {
    const results = extractResults();
    const latestResult = extractLatestResult();
    const bettingPhase = isBettingPhase();

    const currentHash = results.join('|') + '#' + (latestResult ? latestResult.result : '');
    const changed = (currentHash !== lastHistoryHash) || (results.length !== lastResultCount);

    if (changed && results.length > 0) {
      lastResultCount = results.length;
      lastHistoryHash = currentHash;

      // Mensagem rica (formato v2.4.0)
      sendToParent('GAME_DATA_UPDATE', {
        results: results.slice(-50),
        latestResult,
        bettingPhase,
        totalRounds: results.length,
        url: window.location.href
      });

      // Mensagem simplificada (compat com qualquer consumidor que so escute ROUND_HISTORY)
      sendToParent('ROUND_HISTORY', {
        history: results.slice(-50),
        latest: results[results.length - 1] || null,
        total: results.length
      });

      console.log('[Injected] Nova rodada - ' + results.slice(-5).join(' '));
    }

    if (bettingPhase) {
      sendToParent('BETTING_PHASE_ACTIVE', { timestamp: Date.now() });
    }
  }

  function startMonitoring() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(monitorGame, POLL_INTERVAL);

    if (observer) observer.disconnect();
    observer = new MutationObserver(monitorGame);
    const target = document.body || document.documentElement;
    if (target) {
      observer.observe(target, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'data-result', 'fill']
      });
    }

    sendToParent('AGENT_READY', { url: window.location.href, version: VERSION });
    console.log('[Injected] Agente iniciado v' + VERSION + ' em ' + window.location.host);
  }

  function stop() {
    if (pollTimer) clearInterval(pollTimer);
    if (observer) observer.disconnect();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMonitoring);
  } else {
    startMonitoring();
  }

  // Listener bidirecional - comandos do parent para o iframe
  window.addEventListener('message', (event) => {
    if (!event.data || event.data.target !== MSG_SOURCE) return;
    if (event.data.command === 'GET_RESULTS') monitorGame();
    if (event.data.command === 'STOP') stop();
    if (event.data.command === 'START') startMonitoring();
  });

  window.AutodriveInjected = { start: startMonitoring, stop, extractResults, monitorGame };
})();

console.log('[Injected] Script carregado dentro do iframe Evolution');
