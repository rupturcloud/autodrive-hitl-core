# Autodrive HITL Core

**Versão**: 2.4.0  
**Status**: Engine de Automação Inteligente com Human-in-the-Loop + Autodrive

Uma arquitetura moderna de **decisão autonômica** com forte camada de supervisão humana (HITL), projetada para ser agnóstica de plataforma e escalável.

---

## 🎯 Visão Geral

**Autodrive HITL Core** é um motor inteligente de detecção e execução de padrões visuais com:

- **Autodrive** → Execução automática em alta confiança
- **HITL Forte** → Confirmação humana clara quando necessário
- **Explicabilidade** → Toda decisão tem "Por quê?" transparente
- **Auditabilidade Total** → Replay completo + Evidence Engine
- **Arquitetura Profissional** → Clean Architecture + Engines modulares

---

## ✨ Principais Funcionalidades

### Core Engine
- Detecção avançada de padrões (WMSG + custom)
- Conviction Engine (separado de Confidence)
- Consensus Engine
- Context Health Engine (estabilidade, volatilidade, ruído)
- Operational Intelligence + Safe Zones
- Breakpoint Engine + Replay Engine

### HITL (Human-in-the-Loop)
- Countdown visual configurável
- Botão "Confirmar Entrada" (verde)
- Botão "Cancelar" (vermelho)
- Modo Autodrive (alta confiança → execução automática)

### Bankroll Management
- Gale inteligente (Martingale controlado)
- Stop Win configurável
- Stop Loss configurável
- Proteção de Empate

### Observabilidade
- EventStore com sequência monotônica
- Replay determinístico de rodadas
- Evidence Engine + Audit Trail
- Debug Graph UI

---

## 🏗️ Arquitetura

```
autodrive-hitl-core/
├── js/
│   ├── decision.js              # Orquestrador central
│   ├── patterns.js              # Biblioteca de padrões
│   ├── conviction-engine.js
│   ├── consensus-engine.js
│   ├── context-health-engine.js
│   ├── interaction-intelligence.js
│   ├── executor.js
│   ├── overlay.js
│   ├── infra-guardrails.js
│   └── ...
├── css/overlay.css
├── popup.html
├── manifest.json
└── docs/
```

---

## 🔄 Fluxo de Decisão

```
Nova Rodada →
  HistoryStore (Source of Truth) →
    PatternEngine (match) →
      ConvictionEngine →
        ConsensusEngine →
          ContextHealthEngine →
            BreakpointEngine (HITL se necessário) →
              InteractionIntelligence.detectAndValidateClick() →
                Executor (retry + guardrails) →
                  Evidence + Replay
```

---

## 🚀 Como Usar

1. Carregue a extensão no Chrome (Modo Desenvolvedor)
2. Abra o jogo desejado (BetBoom, Brazzer, etc.)
3. Clique no ícone → Ative o robô
4. Configure stake, gale, stops e thresholds de confiança
5. Observe o Overlay (decisões + explicação)

---

## Filosofia de Desenvolvimento

- **UI/UX mantida** (familiar para o operador)
- **Motor interno** reconstruído com padrões profissionais
- **Agnóstico** por design (fácil adicionar novas plataformas)
- **Auditável** (essencial para compliance e confiança)

---

**Desenvolvido com foco em Engenharia de Software de alto nível.**
