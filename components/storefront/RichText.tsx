import { Fragment } from "react";

/**
 * Render plain text the way the admin wrote it: blank lines separate
 * paragraphs, lines starting with "-", "*", or "•" become bullet lists, and
 * "1." / "1)" lines become numbered lists. Single newlines inside a paragraph
 * become line breaks. Plain string parsing — no HTML/markdown is interpreted,
 * so product descriptions can never inject markup.
 */

type Block =
  | { type: "p"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
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

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
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

export default function RichText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const blocks = parseBlocks(text);
  return (
    <div className={className}>
      {blocks.map((block, i) =>
        block.type === "p" ? (
          <p key={i} className="leading-relaxed [&:not(:first-child)]:mt-4">
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </p>
        ) : block.type === "ul" ? (
          <ul key={i} className="list-disc pl-5 space-y-1 [&:not(:first-child)]:mt-4">
            {block.items.map((item, j) => (
              <li key={j} className="leading-relaxed">{item}</li>
            ))}
          </ul>
        ) : (
          <ol key={i} className="list-decimal pl-5 space-y-1 [&:not(:first-child)]:mt-4">
            {block.items.map((item, j) => (
              <li key={j} className="leading-relaxed">{item}</li>
            ))}
          </ol>
        )
      )}
    </div>
  );
}
