/**
 * Autodrive HITL Core - Executor v2.4
 * Responsável pela execução final do clique com retry, guardrails e audit trail
 * Integra com InfraGuardrails para Rate Limiting e Circuit Breaker
 */

const Executor = (() => {

  const executionLog = [];
  const MAX_LOG = 200;

  // Configurações de retry
  const RETRY_CONFIG = {
    maxRetries: 3,
    retryDelayMs: 500,
    backoffMultiplier: 1.5
  };

  /**
   * Aguarda um delay em ms
   * @param {number} ms
   * @returns {Promise}
   */
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Tenta executar o clique com retry automático
   * @param {Element} element - Elemento a ser clicado
   * @param {Object} context - Contexto da execução
   * @returns {Promise<Object>} Resultado da execução
   */
  async function executeWithRetry(element, context = {}) {
    let lastError = null;

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        // Verificar se elemento ainda está disponível
        if (!element || !document.contains(element)) {
          throw new Error('Elemento não está mais no DOM');
        }

        // Verificar se elemento está visível e interagível
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          throw new Error('Elemento não está visível (tamanho zero)');
        }

        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
          throw new Error('Elemento está oculto');
        }

        if (element.disabled) {
          throw new Error('Elemento está desabilitado');
        }

        // Scroll para o elemento se necessário
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await delay(100);

        // Executar clique
        element.click();

        const result = {
          success: true,
          attempt,
          timestamp: Date.now(),
          elementTag: element.tagName,
          elementText: (element.textContent || '').trim().substring(0, 50),
          context
        };

        logExecution(result);
        return result;

      } catch (error) {
        lastError = error;
        console.warn(`[Executor] Attempt ${attempt} failed: ${error.message}`);

        if (attempt < RETRY_CONFIG.maxRetries) {
          const retryDelay = RETRY_CONFIG.retryDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1);
          await delay(retryDelay);
        }
      }
    }

    const failResult = {
      success: false,
      attempt: RETRY_CONFIG.maxRetries,
      timestamp: Date.now(),
      error: lastError ? lastError.message : 'Unknown error',
      context
    };

    logExecution(failResult);
    return failResult;
  }

  /**
   * Executa aposta com todas as proteções
   * @param {Object} params
   * @param {string} params.outcome - 'P', 'B', 'T'
   * @param {number} params.stake - Valor da aposta
   * @param {Object} params.convictionResult - Resultado do ConvictionEngine
   * @param {Object} params.consensusResult - Resultado do ConsensusEngine
   * @returns {Promise<Object>} Resultado completo da execução
   */
  async function executeBet({ outcome, stake, convictionResult, consensusResult, patternName } = {}) {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    console.log(`[Executor] Starting execution ${executionId} - outcome: ${outcome}, stake: ${stake}`);

    // 1. Verificar guardrails
    if (typeof InfraGuardrails !== 'undefined') {
      const guardCheck = InfraGuardrails.checkAll({ outcome, stake });
      if (!guardCheck.allowed) {
        return {
          success: false,
          executionId,
          reason: guardCheck.reason,
          blocked: true,
          timestamp: Date.now()
        };
      }
    }

    // 2. Detectar e validar elemento de clique
    let clickValidation = { canClick: false, element: null, reason: 'InteractionIntelligence not available' };

    if (typeof InteractionIntelligence !== 'undefined') {
      clickValidation = InteractionIntelligence.detectAndValidateClick(outcome);
    }

    if (!clickValidation.canClick || !clickValidation.element) {
      return {
        success: false,
        executionId,
        reason: clickValidation.reason || 'Elemento de clique não encontrado',
        blocked: false,
        timestamp: Date.now()
      };
    }

    // 3. Executar clique com retry
    const clickResult = await executeWithRetry(clickValidation.element, {
      executionId,
      outcome,
      stake,
      pattern: patternName,
      conviction: convictionResult ? convictionResult.conviction : null,
      consensus: consensusResult ? consensusResult.score : null
    });

    // 4. Registrar no InfraGuardrails se sucesso
    if (clickResult.success && typeof InfraGuardrails !== 'undefined') {
      InfraGuardrails.recordExecution({ outcome, stake, executionId });
    }

    return {
      ...clickResult,
      executionId,
      outcome,
      stake,
      pattern: patternName
    };
  }

  /**
   * Registra execução no log
   * @param {Object} result
   */
  function logExecution(result) {
    executionLog.push(result);
    if (executionLog.length > MAX_LOG) executionLog.shift();
  }

  /**
   * Retorna log de execuções
   */
  function getLog() {
    return [...executionLog];
  }

  /**
   * Retorna estatísticas de execução
   */
  function getStats() {
    const total = executionLog.length;
    const successful = executionLog.filter(e => e.success).length;
    const failed = total - successful;
    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? Math.round((successful / total) * 100) / 100 : 0
    };
  }

  /**
   * Reseta log de execuções
   */
  function reset() {
    executionLog.length = 0;
  }

  return {
    executeBet,
    executeWithRetry,
    getLog,
    getStats,
    reset
  };

})();
