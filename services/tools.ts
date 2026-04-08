/**
 * Tool Responses — instant answers without hitting Ollama.
 * Date, time, day, simple math.
 */

const TIME_PATTERNS = [
  /what time is it/i,
  /what's the time/i,
  /current time/i,
  /tell me the time/i,
];

const DATE_PATTERNS = [
  /what(?:'s| is) the date/i,
  /what(?:'s| is) today(?:'s)? date/i,
  /current date/i,
  /today's date/i,
];

const DAY_PATTERNS = [
  /what day is it/i,
  /what day is today/i,
  /what(?:'s| is) today\b/i,
];

const MATH_PATTERNS = [
  /what(?:'s| is)\s+([\d.+\-*/()^\s%]+)/i,
  /calculate\s+([\d.+\-*/()^\s%]+)/i,
  /([\d]+\s*[+\-*/^%]\s*[\d]+)/,
];

/**
 * Check if the text can be handled locally without Ollama.
 * Returns the instant response or null if it needs Ollama.
 */
export function getToolResponse(text: string): string | null {
  const now = new Date();

  // Time
  for (const p of TIME_PATTERNS) {
    if (p.test(text)) {
      return `It's ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}.`;
    }
  }

  // Date
  for (const p of DATE_PATTERNS) {
    if (p.test(text)) {
      return `Today is ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
    }
  }

  // Day
  for (const p of DAY_PATTERNS) {
    if (p.test(text)) {
      return `It's ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`;
    }
  }

  // Math
  for (const p of MATH_PATTERNS) {
    const match = text.match(p);
    if (match) {
      const expr = (match[1] || match[0]).trim();
      // Must contain at least one operator and one digit
      if (/\d/.test(expr) && /[+\-*/^%]/.test(expr)) {
        return safeMath(expr);
      }
    }
  }

  return null;
}

/**
 * Safely evaluate a math expression.
 */
function safeMath(expr: string): string | null {
  try {
    // Only allow digits, operators, parens, dots, spaces
    const cleaned = expr.replace(/\^/g, '**').trim();
    if (!/^[\d.+\-*/()%\s]+$/.test(cleaned)) {
      return null;
    }
    // Use Function constructor for safe eval (no globals access)
    const result = new Function(`"use strict"; return (${cleaned})`)();
    if (typeof result !== 'number' || !isFinite(result)) {
      return "I couldn't calculate that.";
    }
    const display = Number.isInteger(result) ? result : Math.round(result * 10000) / 10000;
    return `That's ${display}.`;
  } catch {
    return "I couldn't calculate that.";
  }
}
