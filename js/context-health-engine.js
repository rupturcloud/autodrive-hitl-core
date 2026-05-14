/**
 * Autodrive HITL Core - Context Health Engine v2.4
 * Avalia a saúde do contexto atual: estabilidade, volatilidade e ruído
 * Fornece um score de saúde que modula a Conviction antes de executar
 */

const ContextHealthEngine = (() => {

  const healthHistory = [];
  const MAX_HISTORY = 100;

  /**
   * Calcula volatilidade baseada em variação de resultados
   * @param {Array} results - Últimos resultados ['W','L','T']
   * @returns {number} Volatilidade entre 0 e 1
   */
  function calcVolatility(results = []) {
    if (results.length < 4) return 0.5; // Dados insuficientes = volatilidade média
    const last8 = results.slice(-8);
    let changes = 0;
    for (let i = 1; i < last8.length; i++) {
      if (last8[i] !== last8[i-1]) changes++;
    }
    return changes / (last8.length - 1);
  }

  /**
   * Calcula estabilidade baseada em consistência dos resultados
   * @param {Array} results - Últimos resultados
   * @returns {number} Estabilidade entre 0 e 1
   */
  function calcStability(results = []) {
    if (results.length < 3) return 0.5;
    const last6 = results.slice(-6);
    const wCount = last6.filter(r => r === 'W').length;
    const lCount = last6.filter(r => r === 'L').length;
    const dominant = Math.max(wCount, lCount);
    return dominant / last6.length;
  }

  /**
   * Calcula nível de ruído baseado em empates e resultados inesperados
   * @param {Array} results - Últimos resultados
   * @returns {number} Ruído entre 0 e 1
   */
  function calcNoise(results = []) {
    if (results.length === 0) return 0.3;
    const last10 = results.slice(-10);
    const ties = last10.filter(r => r === 'T').length;
    const noiseRatio = ties / last10.length;
    return Math.min(1, noiseRatio * 1.5); // Empates aumentam ruído
  }

  /**
   * Detecta se estamos em zona segura (safe zone) para operar
   * @param {Object} params - Parâmetros de saúde
   * @returns {boolean}
   */
  function isInSafeZone({ volatility, stability, noise }) {
    return volatility < 0.6 && stability > 0.4 && noise < 0.4;
  }

  /**
   * Calcula o score de saúde do contexto
   * @param {Object} params
   * @param {Array} params.recentResults - Resultados recentes ['W','L','T']
   * @param {number} params.sessionAge - Tempo de sessão em minutos
   * @param {number} params.roundsPlayed - Total de rodadas na sessão
   * @param {number} params.bankrollPercentage - % do bankroll restante (0-1)
   * @returns {Object} { health, volatility, stability, noise, safeZone, reason }
   */
  function evaluate({
    recentResults = [],
    sessionAge = 0,
    roundsPlayed = 0,
    bankrollPercentage = 1.0
  } = {}) {

    const volatility = calcVolatility(recentResults);
    const stability = calcStability(recentResults);
    const noise = calcNoise(recentResults);
    const safeZone = isInSafeZone({ volatility, stability, noise });

    // Penalidade por sessão muito longa (fadiga operacional)
    const sessionPenalty = sessionAge > 120 ? 0.10 : sessionAge > 60 ? 0.05 : 0;

    // Penalidade por bankroll baixo
    const bankrollPenalty = bankrollPercentage < 0.3 ? 0.20 : bankrollPercentage < 0.5 ? 0.10 : 0;

    // Bônus por poucos dados (conservador por padrão)
    const dataBonus = roundsPlayed < 10 ? -0.10 : roundsPlayed > 30 ? 0.05 : 0;

    // Fórmula de saúde
    let health = stability * (1 - volatility * 0.5) * (1 - noise * 0.3);
    health = health - sessionPenalty - bankrollPenalty + dataBonus;
    health = Math.min(1, Math.max(0, health));

    // Nível de saúde
    let level, reason;
    if (health >= 0.75) {
      level = 'HEALTHY';
      reason = 'Contexto saudável - condições favoráveis';
    } else if (health >= 0.50) {
      level = 'MODERATE';
      reason = 'Contexto moderado - proceder com cautela';
    } else if (health >= 0.30) {
      level = 'DEGRADED';
      reason = 'Contexto degradado - alta cautela necessária';
    } else {
      level = 'CRITICAL';
      reason = 'Contexto crítico - recomendado pausar operação';
    }

    if (!safeZone) {
      reason += ' (fora da zona segura)';
    }

    if (bankrollPercentage < 0.3) {
      reason += ' | Bankroll crítico';
    }

    const entry = {
      timestamp: Date.now(),
      health,
      level,
      volatility,
      stability,
      noise,
      safeZone
    };

    healthHistory.push(entry);
    if (healthHistory.length > MAX_HISTORY) healthHistory.shift();

    return {
      health: Math.round(health * 100) / 100,
      level,
      safeZone,
      reason,
      metrics: {
        volatility: Math.round(volatility * 100) / 100,
        stability: Math.round(stability * 100) / 100,
        noise: Math.round(noise * 100) / 100,
        sessionPenalty,
        bankrollPenalty,
        dataBonus
      }
    };
  }

  /**
   * Retorna tendência de saúde (melhorando/piorando)
   */
  function getTrend() {
    if (healthHistory.length < 3) return 'INSUFFICIENT_DATA';
    const recent = healthHistory.slice(-5);
    const first = recent[0].health;
    const last = recent[recent.length - 1].health;
    const diff = last - first;
    if (diff > 0.1) return 'IMPROVING';
    if (diff < -0.1) return 'DEGRADING';
    return 'STABLE';
  }

  /**
   * Retorna histórico de saúde
   */
  function getHistory() {
    return [...healthHistory];
  }

  /**
   * Reseta histórico
   */
  function reset() {
    healthHistory.length = 0;
  }

  return {
    evaluate,
    getTrend,
    getHistory,
    reset
  };

})();
