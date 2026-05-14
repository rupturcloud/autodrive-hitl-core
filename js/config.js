/**
 * Autodrive HITL Core - Config v2.4
 * Configuracoes centrais da extensao - editavel pelo operador
 */

const AutodriveConfig = {

  // === Motor de Decisao ===
  engine: {
    autodriveThreshold: 85,    // % conviction para auto-executar
    hitlThreshold: 65,         // % conviction para sugerir e aguardar confirmacao
    countdownSeconds: 8,       // segundos para auto-confirmar no modo HITL
    maxGale: 4,                // maximo de niveis de Gale
    enabled: true              // engine habilitado por padrao
  },

  // === Bankroll ===
  bankroll: {
    stakeBase: 5.00,           // stake inicial (R$)
    stopWin: 0,                // stop win em R$ (0 = desabilitado)
    stopLoss: 0,               // stop loss em R$ (0 = desabilitado)
    galeMultiplier: 2,         // multiplicador do Gale (2 = dobra)
    protectTie: true           // proteger empate (nao contar como perda)
  },

  // === Plataformas suportadas ===
  platforms: {
    betboom: {
      enabled: true,
      domains: ['betboom.com', 'betboom.bet.br', 'br.betboom.com', 'betboom.mx'],
      selectors: {
        roundResult: '[class*="result"], [class*="winner"]',
        history: '[class*="road"], [class*="beads"]'
      }
    },
    evolution: {
      enabled: true,
      domains: ['evo-games.com', 'evolution.com'],
      selectors: {
        roundResult: '[class*="result"]',
        history: '[class*="history"]'
      }
    }
  },

  // === UI ===
  ui: {
    overlayPosition: 'top-right',   // top-right | top-left | bottom-right | bottom-left
    theme: 'dark',                  // dark | light
    showExplanation: true,          // mostrar explicabilidade
    showTabuleiro: true,            // mostrar tabuleiro de historico
    logMaxLines: 20                 // max linhas no log
  },

  // === Debug ===
  debug: {
    enabled: false,                 // modo debug
    verboseLog: false               // log verboso
  }

};

// Expor globalmente
window.AutodriveConfig = AutodriveConfig;

console.log('[Config] Configuracoes carregadas:', AutodriveConfig);
