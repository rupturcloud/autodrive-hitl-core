/**
 * Autodrive HITL Core - content.js v2.5
 * Ponto de entrada principal no betboom.bet.br
 * Recebe historico do iframe via postMessage e APOSTA conforme padroes indicados
 */

console.log('[Content] Autodrive HITL Core v2.5 iniciando...');

(async () => {
  'use strict';

  const VERSION = '2.5';
  const IFRAME_SOURCE = 'AUTODRIVE_IFRAME';

  let engineRunning = false;
  let currentHistory = [];
  let lastProcessedHash = '';
  let betInProgress = false;

  // ============================================================
  // INICIALIZACAO DOS MODULOS
  // ============================================================
  function waitForModules(maxWait = 8000) {
    return new Promise((resolve) => {
      const check = () => {
        if (typeof PatternEngine !== 'undefined' &&
            typeof Overlay !== 'undefined') {
          resolve(true);
        } else if (maxWait <= 0) {
          resolve(false);
        } else {
          maxWait -= 200;
          setTimeout(check, 200);
        }
      };
      check();
    });
  }

  // ============================================================
  // LISTENER DE MENSAGENS DO IFRAME
  // ============================================================
  function setupIframeBridge() {
    window.addEventListener('message', function(event) {
      const msg = event.data;
      if (!msg || msg.source !== IFRAME_SOURCE) return;
      if (msg.type !== 'NEW_HISTORY') return;

      const history = msg.history || [];
      if (!history.length) return;

      const hash = history.join('');
      if (hash === lastProcessedHash) return;
      lastProcessedHash = hash;

      currentHistory = history;

      console.log('[Content] Nova historia recebida: ' + history.slice(-6).join(' ') + ' (total=' + history.length + ')');

      // Atualiza overlay
      if (typeof Overlay !== 'undefined') {
        Overlay.updateTabuleiro(history);
      }

      // Atualiza HistoryStore
      if (typeof HistoryStore !== 'undefined') {
        HistoryStore.addMany(history);
      }

      // Roda ciclo de decisao
      if (engineRunning && !betInProgress) {
        runDecisionCycle(history);
      }
    });

    console.log('[Content] Bridge iframe ativa - aguardando dados...');
  }

  // ============================================================
  // CICLO DE DECISAO: Detecta padrao e APOSTA
  // ============================================================
  async function runDecisionCycle(history) {
    if (!history || history.length < 5) return;

    // 1. Detectar padroes
    const patterns = (typeof PatternEngine !== 'undefined')
      ? PatternEngine.detectPatterns(history)
      : [];

    if (!patterns || patterns.length === 0) {
      overlayLog('Nenhum padrao detectado (' + history.length + ' rodadas)', 'info');
      return;
    }

    const best = patterns[0];
    overlayLog('Padrao: ' + best.name + ' -> ' + best.action, 'success');

    // 2. Calcular conviction
    let convictionScore = 75;
    if (typeof ConvictionEngine !== 'undefined') {
      const conv = ConvictionEngine.calculateConviction({
        patternConfidence: best.confidence || 80,
        consensusAgreement: patterns.length > 1 ? 78 : 65,
        contextStability: 75,
        bankrollSafety: 90
      });
      convictionScore = conv.convictionScore;
    }

    // 3. Verificar conviccao minima
    const minConviction = (typeof AutodriveConfig !== 'undefined' && AutodriveConfig.minConviction) || 70;
    if (convictionScore < minConviction) {
      overlayLog('Convicção baixa: ' + convictionScore + '% (min=' + minConviction + '%)', 'warn');
      return;
    }

    // 4. Determinar cor da aposta
    const corMap = { 'A': 'blue', 'V': 'red', 'E': 'green', 'blue': 'blue', 'red': 'red', 'green': 'green' };
    const cor = corMap[best.action] || best.action;

    // 5. Mostrar no overlay para HITL ou executar auto
    const autoThreshold = (typeof AutodriveConfig !== 'undefined' && AutodriveConfig.autoExecuteThreshold) || 82;

    if (convictionScore >= autoThreshold) {
      // AUTODRIVE: executa automaticamente
      overlayLog('[AUTO] Apostando ' + cor.toUpperCase() + ' | ' + convictionScore + '%', 'success');
      await executeBet(cor, best);
    } else {
      // HITL: mostra sugestao com countdown
      overlayLog('[HITL] Sugestao: ' + cor.toUpperCase() + ' | ' + convictionScore + '%', 'warn');
      if (typeof Overlay !== 'undefined') {
        Overlay.showSuggestion({
          cor, pattern: best, convictionScore,
          explanation: best.name + ' (' + convictionScore + '%)'
        });
      }
    }
  }

  // ============================================================
  // EXECUCAO DA APOSTA
  // ============================================================
  async function executeBet(cor, pattern) {
    if (betInProgress) return;
    betInProgress = true;

    try {
      if (typeof Executor !== 'undefined') {
        const stake = getStake();
        await Executor.executarAposta({ cor, stake, pattern, auto: true });
        overlayLog('Aposta executada: ' + cor.toUpperCase() + ' R$' + stake, 'success');
      } else {
        // Fallback: clica diretamente no botao de aposta
        const clicked = clickBetButton(cor);
        if (clicked) {
          overlayLog('Bet clicado direto: ' + cor.toUpperCase(), 'success');
        } else {
          overlayLog('ERRO: botao de aposta nao encontrado!', 'error');
        }
      }
    } catch(e) {
      overlayLog('Erro ao apostar: ' + e.message, 'error');
      console.error('[Content] Erro executor:', e);
    } finally {
      // Cooldown de 15s antes de aceitar nova aposta
      setTimeout(() => { betInProgress = false; }, 15000);
    }
  }

  // Fallback direto: clicar no botao de aposta da UI do BetBoom/Evolution
  function clickBetButton(cor) {
    // Botoes de JOGADOR (Player/Azul) e BANCA (Banker/Vermelho)
    const selectors = {
      blue:  ['[data-bet="player"]', '[data-side="player"]', '.bet-player', '.player-bet-btn', 'button[aria-label*="Player"]', 'button[aria-label*="Jogador"]'],
      red:   ['[data-bet="banker"]', '[data-side="banker"]', '.bet-banker', '.banker-bet-btn', 'button[aria-label*="Banker"]', 'button[aria-label*="Banca"]'],
      green: ['[data-bet="tie"]',    '[data-side="tie"]',    '.bet-tie',    '.tie-bet-btn',    'button[aria-label*="Tie"]',    'button[aria-label*="Empate"]']
    };
    const sels = selectors[cor] || [];
    for (const sel of sels) {
      try {
        const btn = document.querySelector(sel);
        if (btn && !btn.disabled) {
          btn.click();
          return true;
        }
      } catch(e) {}
    }
    return false;
  }

  function getStake() {
    if (typeof AutodriveConfig !== 'undefined' && AutodriveConfig.stake) return AutodriveConfig.stake;
    return 5; // stake padrao R$5
  }

  // ============================================================
  // CONTROLES DO ENGINE
  // ============================================================
  function startEngine() {
    engineRunning = true;
    if (typeof DecisionEngine !== 'undefined') DecisionEngine.start();
    overlayLog('Engine INICIADO - monitorando padroes', 'success');
    console.log('[Content] Engine iniciado');
  }

  function stopEngine() {
    engineRunning = false;
    betInProgress = false;
    if (typeof DecisionEngine !== 'undefined') DecisionEngine.stop();
    overlayLog('Engine PARADO', 'warn');
    console.log('[Content] Engine parado');
  }

  function overlayLog(msg, type) {
    if (typeof Overlay !== 'undefined') Overlay.log(msg, type);
    console.log('[Content] ' + msg);
  }

  // ============================================================
  // INICIALIZACAO PRINCIPAL
  // ============================================================
  async function init() {
    const ready = await waitForModules();
    if (!ready) {
      console.warn('[Content] Modulos nao carregaram totalmente, iniciando mesmo assim...');
    }

    if (typeof Overlay !== 'undefined') Overlay.init();

    setupIframeBridge();

    // Expor API global
    window.AutodriveContent = {
      start: startEngine,
      stop: stopEngine,
      getHistory: () => currentHistory,
      isRunning: () => engineRunning,
      VERSION
    };

    console.log('[Content] Autodrive HITL Core v' + VERSION + ' pronto!');
    overlayLog('Sistema pronto - aguardando dados do iframe', 'info');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
