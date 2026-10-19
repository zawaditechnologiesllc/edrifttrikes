/**
 * Every static file the built pages ask for must be in the asset bundle.
 *
 * ═══ WHY THIS EXISTS ═══════════════════════════════════════════════════════
 *
 * A Worker deploy ships two things that have to agree: the server bundle,
 * which renders HTML, and `.open-next/assets`, which serves `/_next/static/*`.
 * Next names those files by the HASH OF THEIR CONTENTS, so any change to a
 * stylesheet or a chunk renames it. Change a Tailwind class and
 * `249293bb70624759.css` becomes `741446c60f6961f3.css`.
 *
 * Ship the server bundle without the matching assets and every page comes back
 * 200 OK, referencing a stylesheet that 404s. The site renders as raw HTML —
 * no layout, no colours, nothing broken enough to trip a health check that
 * only looks at status codes. That outage has happened here.
 *
 * Nothing in `next build` or `wrangler deploy` compares these two halves, so
 * this does. It is cheap, it runs on the real build output, and it turns a
 * silent visual outage into a red CI run.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.argv[2] || ".open-next";
const ASSETS = join(ROOT, "assets");

if (!existsSync(ASSETS)) {
  console.error(
    `No asset bundle at ${ASSETS}.\n` +
      `The build produced no assets to upload, which usually means the build ` +
      `command was \`next build\` rather than \`opennextjs-cloudflare build\` ` +
      `(npm run cf:build).`
  );
  process.exit(1);
}

/** Every file under a directory, recursively. */
function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

/*
 * Which files to read references OUT of.
 *
 * HTML for the prerendered pages, and the server's own JS: a dynamically
 * rendered page has its asset list compiled into the server bundle rather than
 * sitting in a .html file, and those references are the ones that matter most
 * — they are every page that is not static.
 */
const SOURCES = [...walk(ROOT)].filter(
  (f) =>
    (f.endsWith(".html") || f.endsWith(".js") || f.endsWith(".json")) &&
    !f.startsWith(ASSETS) &&
    // Library sources, not emitted output. next/font's loader contains the
    // literal `/_next/static/media/${hash}.woff2`, which reads as a reference
    // to a file called `_.woff2` once the interpolation is stripped — a file
    // that never exists, in any build.
    !f.includes(`${sep}node_modules${sep}`) &&
    statSync(f).size < 12_000_000
);

const REFERENCE = /\/_next\/static\/[A-Za-z0-9._\/-]+?\.(?:css|js|woff2?|ttf)/g;

const referenced = new Map(); // path -> the file that asked for it
for (const src of SOURCES) {
  let text;
  try {
    text = readFileSync(src, "utf8");
  } catch {
    continue; // binary, or unreadable — nothing to extract
  }
  for (const hit of text.match(REFERENCE) ?? []) {
    if (!referenced.has(hit)) referenced.set(hit, relative(ROOT, src));
  }
}

if (referenced.size === 0) {
  console.error(
    "Found no /_next/static references in the build output at all.\n" +
      "That is not a healthy build — expected at least a stylesheet."
  );
  process.exit(1);
}

const missing = [];
for (const [ref, askedBy] of referenced) {
  if (!existsSync(join(ASSETS, ref))) missing.push({ ref, askedBy });
}

if (missing.length > 0) {
  console.error(
    `${missing.length} of ${referenced.size} static files are referenced by the ` +
      `build but are NOT in ${ASSETS}:\n`
  );
  for (const { ref, askedBy } of missing.slice(0, 25)) {
    console.error(`  ${ref}\n      asked for by ${askedBy}`);
  }
  if (missing.length > 25) console.error(`  …and ${missing.length - 25} more`);
  console.error(
    `\nDeploying this would serve pages that reference files returning 404 — ` +
      `the site would render as unstyled HTML.`
  );
  process.exit(1);
}

console.log(
  `All ${referenced.size} referenced static files are present in the asset bundle.`
);
