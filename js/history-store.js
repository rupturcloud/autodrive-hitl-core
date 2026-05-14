/**
 * Autodrive HITL Core - History Store v2.4
 * Source of Truth para historico de rodadas
 * Deduplicacao robusta + integridade garantida
 */

const HistoryStore = (() => {

  // === Estado ===
  let rounds = [];           // Array de rodadas normalizadas
  let sequence = 0;          // Sequencia monotonica para replay
  const MAX_ROUNDS = 500;    // Maximo de rodadas armazenadas

  // === Adicionar resultado ===
  function push(result, source) {
    const normalized = normalizeResult(result);
    if (!normalized) {
      console.warn('[HistoryStore] Resultado invalido ignorado:', result);
      return false;
    }

    const entry = {
      id: ++sequence,
      result: normalized,
      source: source || 'dom',
      timestamp: Date.now()
    };

    // Verificar duplicata (mesma fonte, menos de 1s)
    const last = rounds[rounds.length - 1];
    if (last && last.result === entry.result && entry.timestamp - last.timestamp < 1000) {
      return false; // Duplicata ignorada
    }

    rounds.push(entry);

    // Manter limite de memoria
    if (rounds.length > MAX_ROUNDS) {
      rounds = rounds.slice(-MAX_ROUNDS);
    }

    return true;
  }

  /**
   * Obter historico simples (array de resultados)
   */
  function getHistory(limit) {
    const data = limit ? rounds.slice(-limit) : rounds;
    return data.map(r => r.result);
  }

  /**
   * Obter historico completo (com metadados)
   */
  function getFullHistory() {
    return [...rounds];
  }

  /**
   * Obter ultima rodada
   */
  function getLast() {
    return rounds[rounds.length - 1] || null;
  }

  /**
   * Limpar historico
   */
  function clear() {
    rounds = [];
    sequence = 0;
    console.log('[HistoryStore] Historico limpo');
  }

  /**
   * Normalizar resultado para formato interno
   * A = Player/Azul, V = Banker/Vermelho, Am = Tie/Amarelo
   */
  function normalizeResult(raw) {
    if (!raw) return null;
    const r = String(raw).toLowerCase().trim();
    if (['player', 'a', 'azul', 'blue', 'p'].includes(r)) return 'A';
    if (['banker', 'v', 'vermelho', 'red', 'b'].includes(r)) return 'V';
    if (['tie', 'am', 'amarelo', 'yellow', 't', 'empate'].includes(r)) return 'Am';
    return null;
  }

  /**
   * Estatisticas
   */
  function getStats() {
    const total = rounds.length;
    const countA = rounds.filter(r => r.result === 'A').length;
    const countV = rounds.filter(r => r.result === 'V').length;
    const countAm = rounds.filter(r => r.result === 'Am').length;
    return {
      total,
      player: countA,
      banker: countV,
      tie: countAm,
      playerPct: total ? Math.round(countA / total * 100) : 0,
      bankerPct: total ? Math.round(countV / total * 100) : 0,
      tiePct: total ? Math.round(countAm / total * 100) : 0,
      sequence
    };
  }

  return {
    push,
    getHistory,
    getFullHistory,
    getLast,
    clear,
    normalizeResult,
    getStats
  };

})();

window.HistoryStore = HistoryStore;
console.log('[HistoryStore] History Store v2.4 carregado');
