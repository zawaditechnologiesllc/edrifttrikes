/**
 * How a product description written as plain text is structured.
 *
 * The admin types descriptions into a textarea, not an editor: blank lines
 * separate paragraphs, lines starting with "-", "*" or "•" are bullets, and
 * "1." / "1)" lines are a numbered list. No HTML or markdown is interpreted, so
 * a description can never inject markup.
 *
 * This lives apart from the React component because the PDF product sheet has
 * to lay out exactly the same blocks. One parser means the printed sheet and
 * the product page can never disagree about where a paragraph ends.
 */

export type RichTextBlock =
  | { type: "p"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

export function parseRichText(text: string): RichTextBlock[] {
  const blocks: RichTextBlock[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ type: "p", lines: para });
    para = [];
  };
  const flushList = () => {
    if (list.length && listType) blocks.push({ type: listType, items: list });
    list = [];
    listType = null;
  };

  for (const raw of String(text ?? "").replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d{1,3}[.)]\s+(.*)$/);
    if (!line) {
      flushPara();
      flushList();
    } else if (bullet) {
      flushPara();
      if (listType !== "ul") flushList();
      listType = "ul";
      list.push(bullet[1]);
    } else if (numbered) {
      flushPara();
      if (listType !== "ol") flushList();
      listType = "ol";
      list.push(numbered[1]);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}
