/**
 * Autodrive HITL Core - Conviction Engine v2.4
 * Separa claramente Confidence (do padrão) de Conviction (prontidão para executar)
 * Conviction = Confidence * ContextHealth * MomentumFactor * ConsistencyBonus
 */

const ConvictionEngine = (() => {

  const convictionHistory = [];
  const MAX_HISTORY = 50;

  /**
   * Calcula o fator de momentum baseado em resultados recentes
   * @param {Array} recentResults - Últimos resultados ['W','L','T']
   * @returns {number} Fator entre 0.5 e 1.3
   */
  function calcMomentumFactor(recentResults = []) {
    if (!recentResults || recentResults.length === 0) return 1.0;
    const last5 = recentResults.slice(-5);
    const wins = last5.filter(r => r === 'W').length;
    const losses = last5.filter(r => r === 'L').length;
    if (wins >= 3) return 1.15; // Boa sequência
    if (losses >= 3) return 0.7; // Sequência ruim - cautela
    if (losses >= 2) return 0.85;
    return 1.0;
  }

  /**
   * Calcula bônus de consistência baseado em padrões repetidos
   * @param {string} patternName - Nome do padrão detectado
   * @param {Array} history - Histórico de convicções
   * @returns {number} Bônus entre 0 e 0.15
   */
  function calcConsistencyBonus(patternName, history = []) {
    if (!patternName || history.length < 3) return 0;
    const recent = history.slice(-5);
    const samePattern = recent.filter(h => h.pattern === patternName).length;
    if (samePattern >= 3) return 0.10;
    if (samePattern >= 2) return 0.05;
    return 0;
  }

  /**
   * Calcula a penalidade baseada em perdas recentes
   * @param {Array} recentResults - Últimos resultados
   * @returns {number} Penalidade entre 0 e 0.3
   */
  function calcLossPenalty(recentResults = []) {
    const last3 = recentResults.slice(-3);
    const consecutiveLosses = last3.filter(r => r === 'L').length;
    if (consecutiveLosses === 3) return 0.30;
    if (consecutiveLosses === 2) return 0.15;
    if (consecutiveLosses === 1) return 0.05;
    return 0;
  }

  /**
   * Função principal: calcula Conviction score
   * @param {Object} params
   * @param {number} params.confidence - Confiança do padrão (0-1)
   * @param {number} params.contextHealth - Saúde do contexto (0-1)
   * @param {Array} params.recentResults - Resultados recentes ['W','L','T']
   * @param {string} params.patternName - Nome do padrão detectado
   * @param {number} params.roundsObserved - Quantas rodadas foram observadas
   * @returns {Object} { conviction, level, factors, reason }
   */
  function calculate({ confidence = 0, contextHealth = 1, recentResults = [], patternName = '', roundsObserved = 0 } = {}) {

    if (confidence <= 0) {
      return { conviction: 0, level: 'NONE', factors: {}, reason: 'Sem confiança no padrão' };
    }

    const momentumFactor = calcMomentumFactor(recentResults);
    const consistencyBonus = calcConsistencyBonus(patternName, convictionHistory);
    const lossPenalty = calcLossPenalty(recentResults);

    // Penalidade por poucas observações (dados insuficientes)
    const observationPenalty = roundsObserved < 5 ? 0.1 : 0;

    // Fórmula principal de Conviction
    let conviction = (confidence * contextHealth * momentumFactor) + consistencyBonus - lossPenalty - observationPenalty;

    // Clamp entre 0 e 1
    conviction = Math.min(1, Math.max(0, conviction));

    // Determinar nível
    let level;
    let reason;

    if (conviction >= 0.85) {
      level = 'HIGH';
      reason = 'Alta convicção - Autodrive ativo';
    } else if (conviction >= 0.65) {
      level = 'MEDIUM';
      reason = 'Convicção média - Aguardando confirmação humana';
    } else if (conviction >= 0.40) {
      level = 'LOW';
      reason = 'Baixa convicção - Apenas observando';
    } else {
      level = 'NONE';
      reason = 'Convicção insuficiente - Sem sinal';
    }

    const entry = {
      timestamp: Date.now(),
      pattern: patternName,
      confidence,
      contextHealth,
      conviction,
      level,
      momentumFactor,
      consistencyBonus,
      lossPenalty
    };

    convictionHistory.push(entry);
    if (convictionHistory.length > MAX_HISTORY) convictionHistory.shift();

    return {
      conviction: Math.round(conviction * 100) / 100,
      level,
      reason,
      factors: {
        confidence,
        contextHealth,
        momentumFactor,
        consistencyBonus,
        lossPenalty,
        observationPenalty
      }
    };
  }

  /**
   * Retorna histórico de convicções
   */
  function getHistory() {
    return [...convictionHistory];
  }

  /**
   * Calcula taxa de sucesso histórica
   */
  function getSuccessRate() {
    if (convictionHistory.length === 0) return null;
    const highConviction = convictionHistory.filter(h => h.level === 'HIGH' || h.level === 'MEDIUM');
    return {
      total: convictionHistory.length,
      highMedium: highConviction.length,
      ratio: highConviction.length / convictionHistory.length
    };
  }

  /**
   * Reseta histórico
   */
  function reset() {
    convictionHistory.length = 0;
  }

  return {
    calculate,
    getHistory,
    getSuccessRate,
    reset
  };

})();
