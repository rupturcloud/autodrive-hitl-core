/**
 * Autodrive HITL Core - Executor v2.5
 * Executa apostas no BetBoom/Evolution clicando nos botoes corretos
 * Tem retry automatico e fallback multi-estrategia
 */

const Executor = (() => {

  const executionLog = [];

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function logExecution(entry) {
    executionLog.push(entry);
    if (executionLog.length > 100) executionLog.shift();
    console.log('[Executor]', JSON.stringify(entry));
  }

  // =========================================================
  // ENCONTRA O BOTAO DE APOSTA NO DOM
  // =========================================================
  function findBetButton(cor) {
    // Mapeamento de cor para texto/atributos dos botoes
    const mappings = {
      blue: {
        texts: ['JOGADOR', 'PLAYER', 'Jogador', 'Player', 'P'],
        attrs: ['player', 'jogador', 'p'],
        classes: ['player', 'bet-player', 'jogador']
      },
      red: {
        texts: ['BANCA', 'BANKER', 'Banca', 'Banker', 'B'],
        attrs: ['banker', 'banca', 'b'],
        classes: ['banker', 'bet-banker', 'banca']
      },
      green: {
        texts: ['EMPATE', 'TIE', 'Empate', 'Tie', 'T'],
        attrs: ['tie', 'empate', 't'],
        classes: ['tie', 'bet-tie', 'empate']
      }
    };

    const map = mappings[cor] || mappings.blue;

    // Estrategia 1: data attributes
    for (const attr of map.attrs) {
      const el = document.querySelector('[data-bet="' + attr + '"], [data-side="' + attr + '"], [data-outcome="' + attr + '"]');
      if (el && !el.disabled) return el;
    }

    // Estrategia 2: aria-label
    for (const text of map.texts) {
      const el = document.querySelector('button[aria-label*="' + text + '"]');
      if (el && !el.disabled) return el;
    }

    // Estrategia 3: texto do botao
    const allBtns = Array.from(document.querySelectorAll('button, [role="button"]'));
    for (const btn of allBtns) {
      const txt = (btn.textContent || '').trim().toUpperCase();
      if (map.texts.some(t => txt === t.toUpperCase() || txt.includes(t.toUpperCase()))) {
        if (!btn.disabled) return btn;
      }
    }

    // Estrategia 4: classes CSS
    for (const cls of map.classes) {
      const el = document.querySelector('.' + cls + ', [class*="' + cls + '"]');
      if (el && !el.disabled) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'button' || el.getAttribute('role') === 'button') return el;
        // Procura botao dentro do elemento
        const btn = el.querySelector('button');
        if (btn && !btn.disabled) return btn;
        return el;
      }
    }

    return null;
  }

  // =========================================================
  // EXECUTA APOSTA COM RETRY
  // =========================================================
  async function executarAposta({ cor, stake, pattern, auto = true }) {
    const startTime = Date.now();
    console.log('[Executor] executarAposta: cor=' + cor + ' stake=' + stake + ' auto=' + auto);

    let btn = null;
    let attempts = 0;

    // Tenta ate 3x encontrar e clicar o botao
    while (attempts < 3 && !btn) {
      btn = findBetButton(cor);
      if (!btn) {
        console.warn('[Executor] Botao nao encontrado para ' + cor + ', tentativa ' + (attempts + 1));
        await delay(500);
        attempts++;
      }
    }

    if (!btn) {
      const result = {
        success: false,
        cor,
        error: 'Botao de aposta nao encontrado para: ' + cor,
        attempts,
        timestamp: startTime
      };
      logExecution(result);
      return result;
    }

    // Clicar no botao
    try {
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await delay(150);
      btn.click();
      await delay(100);
      // Dispara também eventos de mouse para compatibilidade
      btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      const result = {
        success: true,
        cor,
        stake,
        pattern: pattern ? pattern.id : 'unknown',
        auto,
        duration: Date.now() - startTime,
        timestamp: startTime
      };
      logExecution(result);
      console.log('[Executor] APOSTA EXECUTADA: ' + cor.toUpperCase() + ' R$' + stake);
      return result;

    } catch(e) {
      const result = {
        success: false,
        cor,
        error: e.message,
        timestamp: startTime
      };
      logExecution(result);
      return result;
    }
  }

  // Wrapper compativel com interface antiga (outcome = P/B/T)
  async function executeBet({ outcome, stake, cor, pattern, auto } = {}) {
    const corMap = { 'P': 'blue', 'B': 'red', 'T': 'green', 'player': 'blue', 'banker': 'red', 'tie': 'green' };
    const finalCor = cor || corMap[outcome] || 'blue';
    return executarAposta({ cor: finalCor, stake, pattern, auto });
  }

  function getLog(limit = 20) {
    return executionLog.slice(-limit);
  }

  return {
    executarAposta,
    executeBet,
    findBetButton,
    getLog
  };

})();

window.Executor = Executor;
console.log('[Executor] Executor v2.5 carregado - pronto para apostar');
