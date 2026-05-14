/**
 * Autodrive HITL Core - Patterns Engine v2.4
 * Biblioteca de padrões + matching avançado (Sequência, Linha, Diagonal)
 * Inclui padrões WMSG + Padrões do Will
 */

const PatternEngine = (() => {

  const PATTERNS = [
    // === PADRÕES WMSG (Originais) ===
    { id: "WMSG-001", sequence: ["A","A","A","V"],  action: "V", name: "3 Azuis → Vermelho",       type: "streak" },
    { id: "WMSG-002", sequence: ["V","V","V","A"],  action: "A", name: "3 Vermelhos → Azul",       type: "streak" },
    { id: "WMSG-003", sequence: ["A","V","A","V"],  action: "V", name: "Zigue-Zague AVAV",         type: "zigzag" },
    { id: "WMSG-004", sequence: ["V","A","V","A"],  action: "A", name: "Zigue-Zague VAVA",         type: "zigzag" },
    { id: "WMSG-005", sequence: ["A","A","V","V"],  action: "A", name: "Espelho AAVV",             type: "mirror" },
    { id: "WMSG-006", sequence: ["V","V","A","A"],  action: "V", name: "Espelho VVAA",             type: "mirror" },
    { id: "WMSG-007", sequence: ["A","Am","V"],     action: "V", name: "Azul-Amarelo→Vermelho",    type: "yellow" },
    { id: "WMSG-008", sequence: ["V","Am","A"],     action: "A", name: "Vermelho-Amarelo→Azul",    type: "yellow" },
    { id: "WMSG-009", sequence: ["A","A","A","A","A"], action: "V", name: "5 Azuis → Vermelho",   type: "streak" },
    { id: "WMSG-010", sequence: ["V","V","V","V","V"], action: "A", name: "5 Vermelhos → Azul",   type: "streak" },
    { id: "WMSG-011", sequence: ["A","A","A","V","V"],  action: "A", name: "AAAVV → Azul",        type: "mixed" },
    { id: "WMSG-012", sequence: ["V","V","V","A","A"],  action: "V", name: "VVVAA → Vermelho",    type: "mixed" },
    { id: "WMSG-013", sequence: ["Am","Am","A"],    action: "V", name: "2 Amarelos+Azul→Vermelho", type: "yellow" },
    { id: "WMSG-014", sequence: ["Am","Am","V"],    action: "A", name: "2 Amarelos+Verm→Azul",    type: "yellow" },
    { id: "WMSG-015", sequence: ["A","V","A","V","A"], action: "A", name: "Zigue-Zague AVAVA",    type: "zigzag" },
    { id: "WMSG-016", sequence: ["V","A","V","A","V"], action: "V", name: "Zigue-Zague VAVAV",    type: "zigzag" },
    { id: "WMSG-017", sequence: ["Am","A","Am","V"], action: "A", name: "Am-A-Am-V → Azul",       type: "yellow" },
    { id: "WMSG-018", sequence: ["Am","V","Am","A"], action: "V", name: "Am-V-Am-A → Vermelho",   type: "yellow" },

    // === PADRÕES DO WILL (Customizados) ===
    { id: "WILL-001", sequence: ["A","A","A","A","V"],    action: "V", name: "4 Azuis → Vermelho",      type: "streak" },
    { id: "WILL-002", sequence: ["V","V","V","V","A"],    action: "A", name: "4 Vermelhos → Azul",      type: "streak" },
    { id: "WILL-003", sequence: ["A","A","A","A","A","A","A"], action: "V", name: "7 Azuis → Vermelho", type: "streak" },
    { id: "WILL-004", sequence: ["V","V","V","V","V","V","V"], action: "A", name: "7 Vermelhos → Azul", type: "streak" },
    { id: "WILL-005", sequence: ["A","A","V","V","A","V","V"], action: "A", name: "AAVVAVV → Azul",    type: "complex" },
    { id: "WILL-006", sequence: ["V","V","A","A","V","A","A"], action: "V", name: "VVAAVAA → Vermelho", type: "complex" },
    { id: "WILL-007", sequence: ["A","V","A","V","A"],    action: "A", name: "Zigue-Zague AVAVA",       type: "zigzag" },
    { id: "WILL-008", sequence: ["V","A","V","A","V"],    action: "V", name: "Zigue-Zague VAVAV",       type: "zigzag" },
    { id: "WILL-009", sequence: ["Am","Am","A"],          action: "V", name: "2 Amarelos+A → V",        type: "yellow" },
    { id: "WILL-010", sequence: ["Am","Am","V"],          action: "A", name: "2 Amarelos+V → A",        type: "yellow" },
    { id: "WILL-011", sequence: ["A","V","A","V","A"],    action: "A", name: "Zigue-Zague 5 AVAVA",     type: "zigzag" },
    { id: "WILL-012", sequence: ["V","A","V","A","V"],    action: "V", name: "Zigue-Zague 5 VAVAV",     type: "zigzag" },
    { id: "WILL-013", sequence: ["V","A","A","V","V"],    action: "V", name: "VAAVV → Vermelho",        type: "complex" },
    { id: "WILL-014", sequence: ["A","V","V","A","A"],    action: "A", name: "AVVAA → Azul",            type: "complex" },
    { id: "WILL-015", sequence: ["Am","A","Am","V"],      action: "A", name: "Am-A-Am-V → Azul",        type: "yellow" },
    { id: "WILL-016", sequence: ["Am","V","Am","A"],      action: "V", name: "Am-V-Am-A → Vermelho",    type: "yellow" },
  ];

  /**
   * Normaliza cor para código interno: A (Azul/Player), V (Vermelho/Banker), Am (Amarelo/Tie)
   */
  function normalizeColor(raw) {
    if (!raw) return null;
    const r = String(raw).toLowerCase().trim();
    if (r === 'player' || r === 'a' || r === 'azul' || r === 'blue' || r === 'p') return 'A';
    if (r === 'banker' || r === 'v' || r === 'vermelho' || r === 'red' || r === 'b') return 'V';
    if (r === 'tie' || r === 'am' || r === 'amarelo' || r === 'yellow' || r === 't') return 'Am';
    return null;
  }

  /**
   * Verifica se histórico termina com sequência do padrão
   */
  function matchesSequence(history, sequence) {
    if (history.length < sequence.length) return false;
    const tail = history.slice(-sequence.length);
    return sequence.every((s, i) => {
      const normalized = normalizeColor(tail[i]);
      return normalized === s;
    });
  }

  /**
   * Detecta padrões no histórico
   * @param {string[]} history - Array de resultados normalizados
   * @returns {Array} Lista de padrões encontrados com score
   */
  function detectPatterns(history) {
    if (!Array.isArray(history) || history.length < 3) return [];
    
    const normalized = history.map(normalizeColor).filter(Boolean);
    const found = [];

    for (const pattern of PATTERNS) {
      if (matchesSequence(normalized, pattern.sequence)) {
        found.push({
          ...pattern,
          matchedAt: Date.now(),
          score: calculateScore(pattern, normalized),
          confidence: calculateConfidence(pattern, normalized),
        });
      }
    }

    // Sort by score descending
    return found.sort((a, b) => b.score - a.score);
  }

  /**
   * Calcula score do padrão baseado em comprimento e tipo
   */
  function calculateScore(pattern, history) {
    let base = pattern.sequence.length * 10;
    if (pattern.type === 'complex') base *= 1.3;
    if (pattern.type === 'yellow') base *= 1.2;
    return Math.round(base);
  }

  /**
   * Calcula confiança baseada no histórico recente
   */
  function calculateConfidence(pattern, history) {
    const len = pattern.sequence.length;
    const base = Math.min(0.95, 0.5 + len * 0.07);
    return Math.round(base * 100);
  }

  function getAllPatterns() { return [...PATTERNS]; }
  function getPatternById(id) { return PATTERNS.find(p => p.id === id); }

  return {
    detectPatterns,
    getAllPatterns,
    getPatternById,
    PATTERNS
  };

})();

// Expor globalmente
window.PatternEngine = PatternEngine;

console.log("[PatternEngine] ✅ Carregado com", PatternEngine.getAllPatterns().length, "padrões");
