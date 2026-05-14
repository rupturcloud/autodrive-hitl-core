/**
 * Autodrive HITL Core - injected.js v2.4
 * Roda como content script DENTRO do iframe do jogo (billing-boom.com / evolution)
 * Extrai resultados do DOM do jogo e envia para o frame pai (betboom.bet.br)
 * via window.top.postMessage
 */

(() => {
  'use strict';

  const VERSION = '2.4.0';
  const MSG_SOURCE = 'AUTODRIVE_IFRAME_AGENT';

  // Intervalo de polling em ms
  const POLL_INTERVAL = 1500;

  let lastResultCount = 0;
  let observer = null;
  let pollTimer = null;

  /**
   * Envia dados para o content script no frame pai
   */
  function sendToParent(type, payload) {
    try {
      window.top.postMessage({
        source: MSG_SOURCE,
        type: type,
        payload: payload,
        timestamp: Date.now(),
        version: VERSION
      }, '*');
    } catch(e) {
      // Pode falhar por restricoes de cross-origin em alguns modos
    }
  }

  /**
   * Estrategias de extracao do Bac Bo / Evolution Gaming
   * O Bac Bo mostra resultados como bolinhas coloridas no road map
   */
  function extractResults() {
    const results = [];

    // === Estrategia 1: Bead Road (Estrada de Contas) ===
    // Evolution usa SVG circles com fill colorido para o historico
    const svgCircles = document.querySelectorAll('svg circle[fill], svg ellipse[fill]');
    if (svgCircles.length > 0) {
      svgCircles.forEach(circle => {
        const fill = (circle.getAttribute('fill') || '').toLowerCase();
        if (fill.includes('blue') || fill === '#0000ff' || fill === '#1e90ff' || fill.includes('3b82f6')) {
          results.push('P'); // Player = Azul
        } else if (fill.includes('red') || fill === '#ff0000' || fill === '#ef4444') {
          results.push('B'); // Banker = Vermelho
        } else if (fill.includes('green') || fill === '#00ff00' || fill === '#22c55e') {
          results.push('T'); // Tie = Verde
        }
      });
    }

    // === Estrategia 2: Classes CSS dos resultados ===
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
        // Combinar em ordem aproximada
        playerEls.forEach(() => results.push('P'));
        bankerEls.forEach(() => results.push('B'));
        tieEls.forEach(() => results.push('T'));
      }
    }

    // === Estrategia 3: texto no DOM ===
    if (results.length === 0) {
      const allText = document.body.innerText || '';
      const matches = allText.match(/\b(Player|Banker|Tie|PLAYER|BANKER|TIE|Jogador|Banca|Empate)\b/g);
      if (matches) {
        matches.forEach(m => {
          const lower = m.toLowerCase();
          if (lower.includes('player') || lower.includes('jogador')) results.push('P');
          else if (lower.includes('banker') || lower.includes('banca')) results.push('B');
          else if (lower.includes('tie') || lower.includes('empate')) results.push('T');
        });
      }
    }

    return results;
  }

  /**
   * Extrai o resultado da ultima rodada (mais recente)
   */
  function extractLatestResult() {
    // Bac Bo especificamente: resultado e mostrado com texto grande apos cada rodada
    const bigResult = document.querySelector(
      '[class*="result"][class*="display"], [class*="roundResult"], [class*="gameResult"], [class*="outcomeLabel"]'
    );
    if (bigResult) {
      const text = bigResult.textContent.trim().toLowerCase();
      if (text.includes('player') || text.includes('jogador')) return { result: 'P', source: 'bigDisplay' };
      if (text.includes('banker') || text.includes('banca')) return { result: 'B', source: 'bigDisplay' };
      if (text.includes('tie') || text.includes('empate')) return { result: 'T', source: 'bigDisplay' };
    }
    return null;
  }

  /**
   * Verifica se o jogo esta aceitando apostas (betting phase)
   */
  function isBettingPhase() {
    // Evolution mostra botao de aposta habilitado durante fase de aposta
    const betButtons = document.querySelectorAll(
      '[class*="player-bet"]:not([disabled]), [class*="banker-bet"]:not([disabled]), button[class*="bet"]:not([disabled])'
    );
    return betButtons.length > 0;
  }

  /**
   * Loop principal de monitoramento
   */
  function monitorGame() {
    const results = extractResults();
    const latestResult = extractLatestResult();
    const bettingPhase = isBettingPhase();

    // Envia atualizacao apenas se houve mudanca no numero de resultados
    if (results.length !== lastResultCount || latestResult) {
      lastResultCount = results.length;

      sendToParent('GAME_DATA_UPDATE', {
        results: results.slice(-50), // ultimos 50 resultados
        latestResult: latestResult,
        bettingPhase: bettingPhase,
        totalRounds: results.length,
        url: window.location.href
      });
    }

    // Sempre informa fase de aposta
    if (bettingPhase) {
      sendToParent('BETTING_PHASE_ACTIVE', {
        timestamp: Date.now()
      });
    }
  }

  /**
   * Inicia monitoramento via MutationObserver + polling
   */
  function startMonitoring() {
    // Polling como fallback
    pollTimer = setInterval(monitorGame, POLL_INTERVAL);

    // Observer para mudancas no DOM
    observer = new MutationObserver(() => {
      monitorGame();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-result', 'fill']
    });

    console.log('[Autodrive-IframeAgent] Monitoramento iniciado em:', window.location.href);
    sendToParent('AGENT_READY', {
      url: window.location.href,
      version: VERSION
    });
  }

  // Iniciar quando DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMonitoring);
  } else {
    startMonitoring();
  }

  // Ouvir comandos do frame pai
  window.addEventListener('message', (event) => {
    if (!event.data || event.data.target !== MSG_SOURCE) return;
    if (event.data.command === 'GET_RESULTS') {
      monitorGame();
    }
  });

})();
