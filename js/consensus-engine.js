/**
 * Autodrive HITL Core - Consensus Engine v2.4
 * Valida que múltiplos sinais independentes concordam antes de executar
 * Evita falsos positivos por sinal único
 */

const ConsensusEngine = (() => {

  const consensusHistory = [];
  const MAX_HISTORY = 50;

  /**
   * Verifica consenso entre padrão principal e padrões secundários
   * @param {Object} primarySignal - { name, confidence, direction }
   * @param {Array} secondarySignals - [{ name, confidence, direction }]
   * @returns {Object} { hasConsensus, score, agreeing, total, reason }
   */
  function evaluate(primarySignal, secondarySignals = []) {
    if (!primarySignal || !primarySignal.name) {
      return {
        hasConsensus: false,
        score: 0,
        agreeing: 0,
        total: 0,
        reason: 'Sem sinal primário'
      };
    }

    const allSignals = [primarySignal, ...secondarySignals];
    const total = allSignals.length;

    if (total === 1) {
      // Apenas sinal primário - consenso parcial
      return {
        hasConsensus: primarySignal.confidence >= 0.70,
        score: primarySignal.confidence,
        agreeing: 1,
        total: 1,
        reason: 'Sinal único - consenso baseado em confiança'
      };
    }

    // Verificar concordância de direção
    const primaryDirection = primarySignal.direction || null;
    let agreeing = 0;
    let totalWeight = 0;
    let weightedScore = 0;

    for (const signal of allSignals) {
      const sameDirection = !primaryDirection || !signal.direction || signal.direction === primaryDirection;
      if (sameDirection && signal.confidence >= 0.50) {
        agreeing++;
        const weight = signal === primarySignal ? 2.0 : 1.0; // Primário tem peso dobrado
        weightedScore += signal.confidence * weight;
        totalWeight += weight;
      }
    }

    const score = totalWeight > 0 ? weightedScore / totalWeight : 0;
    const agreementRatio = agreeing / total;
    const hasConsensus = agreementRatio >= 0.6 && score >= 0.65;

    const entry = {
      timestamp: Date.now(),
      primarySignal: primarySignal.name,
      total,
      agreeing,
      score,
      hasConsensus
    };

    consensusHistory.push(entry);
    if (consensusHistory.length > MAX_HISTORY) consensusHistory.shift();

    let reason;
    if (hasConsensus && score >= 0.85) {
      reason = 'Forte consenso entre sinais';
    } else if (hasConsensus) {
      reason = 'Consenso moderado - prosseguir com cautela';
    } else if (agreementRatio >= 0.5) {
      reason = 'Consenso fraco - aguardar confirmação humana';
    } else {
      reason = 'Sem consenso - sinais divergentes';
    }

    return {
      hasConsensus,
      score: Math.round(score * 100) / 100,
      agreeing,
      total,
      agreementRatio: Math.round(agreementRatio * 100) / 100,
      reason
    };
  }

  /**
   * Verifica consenso temporal: o mesmo padrão se confirma em múltiplas rodadas?
   * @param {string} patternName - Nome do padrão
   * @param {Array} recentDetections - Detecções recentes [{ pattern, confidence, timestamp }]
   * @param {number} windowMs - Janela temporal em ms (default: 60000 = 1 min)
   * @returns {Object} { temporalConsensus, count, reason }
   */
  function evaluateTemporal(patternName, recentDetections = [], windowMs = 60000) {
    const now = Date.now();
    const inWindow = recentDetections.filter(d =>
      d.pattern === patternName && (now - d.timestamp) <= windowMs
    );

    const count = inWindow.length;
    const avgConfidence = count > 0
      ? inWindow.reduce((sum, d) => sum + d.confidence, 0) / count
      : 0;

    const temporalConsensus = count >= 2 && avgConfidence >= 0.65;

    return {
      temporalConsensus,
      count,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      reason: temporalConsensus
        ? `Padrão confirmado ${count}x na janela temporal`
        : `Padrão detectado apenas ${count}x - aguardando mais dados`
    };
  }

  /**
   * Consenso combinado (sinal + temporal)
   */
  function evaluateCombined(primarySignal, secondarySignals, recentDetections, windowMs) {
    const signalResult = evaluate(primarySignal, secondarySignals);
    const temporalResult = evaluateTemporal(
      primarySignal ? primarySignal.name : '',
      recentDetections,
      windowMs
    );

    const combined = signalResult.hasConsensus && temporalResult.temporalConsensus;
    const combinedScore = (signalResult.score + temporalResult.avgConfidence) / 2;

    return {
      hasConsensus: combined,
      combinedScore: Math.round(combinedScore * 100) / 100,
      signal: signalResult,
      temporal: temporalResult,
      reason: combined
        ? 'Consenso completo (sinal + temporal)'
        : 'Consenso incompleto: ' + (!signalResult.hasConsensus ? 'sinais divergentes' : 'padrão não confirmado temporalmente')
    };
  }

  function getHistory() {
    return [...consensusHistory];
  }

  function reset() {
    consensusHistory.length = 0;
  }

  return {
    evaluate,
    evaluateTemporal,
    evaluateCombined,
    getHistory,
    reset
  };

})();
