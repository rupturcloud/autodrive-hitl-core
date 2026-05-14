/**
 * Autodrive HITL Core - Infra Guardrails v2.4
 * Protecoes de infraestrutura: idempotencia, circuit breaker, rate limiting
 * Camada de seguranca antes de qualquer execucao critica
 */

const InfraGuardrails = (() => {

  // === Circuit Breaker ===
  const circuitBreaker = {
    failures: 0,
    maxFailures: 5,
    state: 'CLOSED', // CLOSED | OPEN | HALF_OPEN
    lastFailure: null,
    resetTimeout: 30000 // 30s
  };

  // === Rate Limiter ===
  const rateLimiter = {
    requests: [],
    maxRequests: 10,
    windowMs: 60000 // 1 minuto
  };

  // === Idempotencia (evitar execucoes duplicadas) ===
  const executedActions = new Map();
  const IDEMPOTENCY_WINDOW = 5000; // 5s

  /**
   * Verificar se acao pode ser executada (circuit breaker)
   */
  function canExecute() {
    if (circuitBreaker.state === 'OPEN') {
      const timeSinceFailure = Date.now() - circuitBreaker.lastFailure;
      if (timeSinceFailure > circuitBreaker.resetTimeout) {
        circuitBreaker.state = 'HALF_OPEN';
        console.log('[Guardrails] Circuit breaker: HALF_OPEN (testando recuperacao)');
      } else {
        return { allowed: false, reason: 'CIRCUIT_OPEN', retryIn: circuitBreaker.resetTimeout - timeSinceFailure };
      }
    }
    return { allowed: true };
  }

  /**
   * Registrar sucesso (fechar circuit breaker)
   */
  function recordSuccess() {
    circuitBreaker.failures = 0;
    circuitBreaker.state = 'CLOSED';
  }

  /**
   * Registrar falha (abrir circuit breaker se necessario)
   */
  function recordFailure(reason) {
    circuitBreaker.failures++;
    circuitBreaker.lastFailure = Date.now();

    if (circuitBreaker.failures >= circuitBreaker.maxFailures) {
      circuitBreaker.state = 'OPEN';
      console.warn('[Guardrails] Circuit breaker ABERTO! Muitas falhas:', reason);
    }
  }

  /**
   * Rate limiting - verificar se pode fazer nova requisicao
   */
  function checkRateLimit() {
    const now = Date.now();
    rateLimiter.requests = rateLimiter.requests.filter(t => now - t < rateLimiter.windowMs);
    
    if (rateLimiter.requests.length >= rateLimiter.maxRequests) {
      return { allowed: false, reason: 'RATE_LIMITED', resetIn: rateLimiter.windowMs };
    }
    
    rateLimiter.requests.push(now);
    return { allowed: true };
  }

  /**
   * Verificar idempotencia - evitar executar mesma acao duplicada
   */
  function checkIdempotency(actionKey) {
    const now = Date.now();
    
    // Limpar acoes antigas
    executedActions.forEach((timestamp, key) => {
      if (now - timestamp > IDEMPOTENCY_WINDOW) {
        executedActions.delete(key);
      }
    });
    
    if (executedActions.has(actionKey)) {
      return { allowed: false, reason: 'DUPLICATE_ACTION' };
    }
    
    executedActions.set(actionKey, now);
    return { allowed: true };
  }

  /**
   * Verificacao completa antes de executar acao
   */
  function validate(actionKey) {
    const cbCheck = canExecute();
    if (!cbCheck.allowed) return cbCheck;

    const rlCheck = checkRateLimit();
    if (!rlCheck.allowed) return rlCheck;

    const idCheck = checkIdempotency(actionKey);
    if (!idCheck.allowed) return idCheck;

    return { allowed: true };
  }

  /**
   * Reset manual (para testes ou recuperacao forcada)
   */
  function reset() {
    circuitBreaker.failures = 0;
    circuitBreaker.state = 'CLOSED';
    circuitBreaker.lastFailure = null;
    rateLimiter.requests = [];
    executedActions.clear();
    console.log('[Guardrails] Reset completo');
  }

  function getStatus() {
    return {
      circuitBreaker: { ...circuitBreaker },
      rateLimiter: {
        requestsInWindow: rateLimiter.requests.length,
        maxRequests: rateLimiter.maxRequests
      },
      pendingIdempotencyKeys: executedActions.size
    };
  }

  return {
    validate,
    canExecute,
    recordSuccess,
    recordFailure,
    checkRateLimit,
    reset,
    getStatus
  };

})();

window.InfraGuardrails = InfraGuardrails;
console.log('[Guardrails] Infra Guardrails v2.4 carregado');
