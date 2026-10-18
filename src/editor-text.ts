/** Maps DOM text (including block/BR newlines) to stable UTF-16 editing ranges. */
interface Segment {
  start: number;
  end: number;
  node: Node;
  lineBreak?: boolean;
  parent?: Node;
  index?: number;
}
function mapped(root: Node) {
  let text = "";
  const segments: Segment[] = [];
  const line = (node: Node) => {
    const parent = node.parentNode;
    if (!parent) return;
    const index = Array.prototype.indexOf.call(parent.childNodes, node);
    segments.push({
      start: text.length,
      end: text.length + 1,
      node,
      lineBreak: true,
      parent,
      index,
    });
    text += "\n";
  };
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = (node.textContent ?? "").replaceAll("\u00a0", " ");
      segments.push({
        start: text.length,
        end: text.length + value.length,
        node,
      });
      text += value;
      return;
    }
    if (node instanceof HTMLElement && node.tagName === "BR") {
      line(node);
      return;
    }
    const block =
      node !== root &&
      node instanceof HTMLElement &&
      ["DIV", "P", "LI", "BLOCKQUOTE"].includes(node.tagName);
    if (block && text && !text.endsWith("\n")) line(node);
    for (const child of node.childNodes) walk(child);
    if (block && node.nextSibling && text && !text.endsWith("\n"))
      line(node.nextSibling);
  };
  walk(root);
  return { text, segments };
}
export function editorText(root: HTMLElement): string {
  return mapped(root).text;
}
export function editorRange(
  root: HTMLElement,
  offset: number,
  length: number,
): Range | null {
  const { text, segments } = mapped(root);
  if (offset < 0 || length < 0 || offset + length > text.length) return null;
  const point = (at: number, end = false): [Node, number] | null => {
    for (const s of segments) {
      if (s.lineBreak) {
        if (at === s.start) return [s.parent!, s.index!];
        if (at === s.end && end)
          return [
            s.parent!,
            s.index! +
              (s.node instanceof HTMLElement && s.node.tagName === "BR"
                ? 1
                : 0),
          ];
        continue;
      }
      if (at >= s.start && (at < s.end || (end && at === s.end)))
        return [s.node, at - s.start];
    }
    if (at === text.length) return [root, root.childNodes.length];
    return null;
  };
  const start = point(offset),
    end = point(offset + length, true);
  if (!start || !end) return null;
  const range = document.createRange();
  range.setStart(...start);
  range.setEnd(...end);
  return range;
}
export function selectedOffsets(
  root: HTMLElement,
  range: Range,
): { offset: number; length: number } | null {
  if (
    !root.contains(range.startContainer) ||
    !root.contains(range.endContainer) ||
    range.collapsed
  )
    return null;
  const { text, segments } = mapped(root);
  const at = (node: Node, position: number) => {
    if (node === root)
      return position === 0
        ? 0
        : position === root.childNodes.length
          ? text.length
          : null;
    const exact = segments.find((s) => !s.lineBreak && s.node === node);
    if (exact) return exact.start + position;
    const prefix = document.createRange();
    prefix.selectNodeContents(root);
    prefix.setEnd(node, position);
    const raw = prefix.toString().length;
    let seen = 0;
    for (const s of segments) {
      if (s.lineBreak) continue;
      const len = s.end - s.start;
      if (raw <= seen + len) return s.start + raw - seen;
      seen += len;
    }
    return text.length;
  };
  const start = at(range.startContainer, range.startOffset),
    end = at(range.endContainer, range.endOffset);
  return start === null || end === null || end <= start
    ? null
    : { offset: start, length: end - start };
}
