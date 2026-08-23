/**
 * Renders JSON-LD into the page.
 *
 * A server component with no state: the data is decided on the server (see
 * lib/seo.ts) and shipped as a script tag, which is what search engines read.
 * Nothing here runs in the browser.
 *
 * `<` is escaped so no value inside the data — a product name, an address —
 * can close the script tag early and inject markup.
 */
export default function StructuredData({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
