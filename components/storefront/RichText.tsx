import { Fragment } from "react";
import { parseRichText } from "@/lib/rich-text";

/**
 * Render a plain-text description the way the admin wrote it. The block parsing
 * lives in lib/rich-text.ts so the PDF product sheet lays out the same blocks
 * from the same rules.
 */
export default function RichText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const blocks = parseRichText(text);
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
