/**
 * Autodrive HITL Core - History Normalizer v2.4
 * Normaliza e valida resultados brutos de diferentes plataformas
 * Converte formatos proprietários para o formato padrão interno: 'W' | 'L' | 'T'
 */

const HistoryNormalizer = (() => {

  // Mapeamentos de resultados por plataforma
  const RESULT_MAPS = {
    // Mapeamento genérico (inglês)
    generic: {
      win: 'W', won: 'W', w: 'W', winner: 'W', player: 'W',
      loss: 'L', lose: 'L', lost: 'L', l: 'L', banker: 'L', loser: 'L',
      tie: 'T', tied: 'T', t: 'T', draw: 'T', push: 'T'
    },
    // Mapeamento português
    ptBR: {
      vitoria: 'W', vitória: 'W', ganhou: 'W', venceu: 'W', jogador: 'W',
      derrota: 'L', perdeu: 'L', banca: 'L', bancário: 'L',
      empate: 'T', empatou: 'T'
    },
    // Mapeamento de cores (comum em rodes de baccarat)
    colors: {
      blue: 'W', azul: 'W',   // Player = azul
      red: 'L', vermelho: 'L', // Banker = vermelho
      green: 'T', verde: 'T'  // Tie = verde
    },
    // Mapeamento numérico
    numeric: {
      1: 'W', '1': 'W',
      0: 'L', '0': 'L',
      '-1': 'T', 2: 'T', '2': 'T'
    }
  };

  /**
   * Normaliza um resultado bruto para o formato padrão
   * @param {string|number} rawResult - Resultado bruto
   * @param {string} platform - Plataforma opcional para mapeamento específico
   * @returns {string|null} 'W' | 'L' | 'T' | null (se não reconhecido)
   */
  function normalize(rawResult, platform = 'generic') {
    if (rawResult === null || rawResult === undefined) return null;

    // Já no formato correto?
    const str = String(rawResult).trim();
    if (str === 'W' || str === 'L' || str === 'T') return str;

    const lower = str.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Tentar todos os mapeamentos
    for (const map of Object.values(RESULT_MAPS)) {
      if (map[lower] !== undefined) return map[lower];
      if (map[str] !== undefined) return map[str];
    }

    // Tentar por inclusão parcial
    if (lower.includes('win') || lower.includes('player') || lower.includes('jogador')) return 'W';
    if (lower.includes('loss') || lower.includes('banker') || lower.includes('banca') || lower.includes('derrota')) return 'L';
    if (lower.includes('tie') || lower.includes('empate') || lower.includes('draw')) return 'T';

    console.warn(`[HistoryNormalizer] Cannot normalize: "${rawResult}"`);
    return null;
  }

  /**
   * Normaliza um array de resultados
   * @param {Array} rawResults - Array de resultados brutos
   * @param {string} platform - Plataforma opcional
   * @returns {Array} Array de resultados normalizados (sem nulls)
   */
  function normalizeArray(rawResults = [], platform = 'generic') {
    return rawResults
      .map(r => normalize(r, platform))
      .filter(r => r !== null);
  }

  /**
   * Valida se um resultado normalizado é válido
   * @param {string} result
   * @returns {boolean}
   */
  function isValid(result) {
    return result === 'W' || result === 'L' || result === 'T';
  }

  /**
   * Extrai e normaliza resultados de um texto HTML
   * Útil para parsing de tabelas de histórico
   * @param {string} htmlText - Texto HTML com resultados
   * @returns {Array} Array de resultados normalizados
   */
  function extractFromText(htmlText) {
    if (!htmlText) return [];

    const results = [];

    // Regex patterns para detectar resultados
    const patterns = [
      /(W|L|T)/g,           // Letras isoladas
      /(Win|Loss|Tie)/gi,   // Palavras em inglês
      /(Vitória|Derrota|Empate)/gi,  // Palavras em português
      /(Player|Banker|Tie)/gi,       // Termos de baccarat
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(htmlText)) !== null) {
        const normalized = normalize(match[0]);
        if (normalized) results.push(normalized);
      }
      if (results.length > 0) break;
    }

    return results;
  }

  /**
   * Normaliza e deduplica histórico
   * Remove entradas duplicadas consecutivas suspeitas
   * @param {Array} rawResults - Resultados brutos
   * @param {Object} options - Opções de normalização
   * @returns {Object} { normalized, duplicatesRemoved, invalidRemoved }
   */
  function normalizeAndClean(rawResults = [], options = {}) {
    const { removeDuplicates = false } = options;

    const normalized = normalizeArray(rawResults);
    const invalidRemoved = rawResults.length - normalized.length;

    let finalResults = normalized;
    let duplicatesRemoved = 0;

    if (removeDuplicates) {
      // Remove duplicatas consecutivas (3+ iguais seguidos)
      const cleaned = [];
      let consecutiveCount = 1;
      for (let i = 0; i < normalized.length; i++) {
        if (i > 0 && normalized[i] === normalized[i-1]) {
          consecutiveCount++;
          if (consecutiveCount <= 5) { // Máximo 5 consecutivos
            cleaned.push(normalized[i]);
          } else {
            duplicatesRemoved++;
          }
        } else {
          consecutiveCount = 1;
          cleaned.push(normalized[i]);
        }
      }
      finalResults = cleaned;
    }

    return {
      normalized: finalResults,
      duplicatesRemoved,
      invalidRemoved,
      total: finalResults.length
    };
  }

  /**
   * Estatísticas de distribuição dos resultados
   * @param {Array} results - Array de 'W'|'L'|'T'
   * @returns {Object} Distribuição percentual
   */
  function getDistribution(results = []) {
    if (results.length === 0) return { W: 0, L: 0, T: 0, total: 0 };
    const counts = { W: 0, L: 0, T: 0 };
    results.forEach(r => { if (counts[r] !== undefined) counts[r]++; });
    const total = results.length;
    return {
      W: Math.round((counts.W / total) * 100) / 100,
      L: Math.round((counts.L / total) * 100) / 100,
      T: Math.round((counts.T / total) * 100) / 100,
      total,
      counts
    };
  }

  return {
    normalize,
    normalizeArray,
    normalizeAndClean,
    extractFromText,
    isValid,
    getDistribution
  };

})();
