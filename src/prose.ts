/** Hide technical content without changing offsets or sentence boundaries outside it. */
export function proseMask(text: string): string {
  const characters = text.split("");
  const hide = (start: number, length: number) => {
    for (let i = start; i < start + length; i++) characters[i] = " ";
  };
  const patterns = [
    /```[\s\S]*?(?:```|$)/g,
    /~~~[\s\S]*?(?:~~~|$)/g,
    /`[^`\n]+`/g,
    /\b(?:https?:\/\/|www\.)[^\s<>]+/gi,
    /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi,
    /\]\([^\s)]*\)/g,
    /\b(?:[\w-]+\.)+(?:com|org|net|io|dev|app|co|edu|gov)\b(?:\/[^\s]*)?/gi,
    /\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+(?:\([^\n)]*\))?/g,
    /\b\w+(?:_\w+)+\b/g,
    /(?:^|(?<=\s))[@#][\p{L}\p{N}_]+/gu,
    /^(?:\s*)(?:import |export |const |let |var |function |class |\/\/|#include)[^\n]*/gm,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern))
      hide(match.index!, match[0].length);
  }
  return characters.join("");
}
