import { NextResponse } from "next/server";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { checkOptOutToken, normalizeEmail } from "@/lib/email-optout";
import { COMPANY } from "@/lib/company";
import { publicSiteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Stopping the order-reminder emails.
 *
 * ═══ WHY A ROUTE HANDLER AND NOT A PAGE ════════════════════════════════════
 *
 * Because it has to answer POST as well as GET, and mean it.
 *
 *   POST  the one that actually opts someone out. Sent either by a mail
 *         client's one-click unsubscribe — Gmail and Yahoo have required this
 *         of bulk senders since February 2024, and they verify it works, so a
 *         List-Unsubscribe-Post header over an endpoint that 405s is worse
 *         than no header at all — or by the single button on the page below.
 *   GET    a person clicked the link in the footer. Shows that one button.
 *
 * ⚠️ GET DOES NOT UNSUBSCRIBE, and that is deliberate rather than timid.
 * Corporate mail security — Mimecast, Proofpoint, Defender — follows every
 * link in every message before the recipient ever sees it. An unsubscribe that
 * acts on GET therefore opts people out who never clicked anything, and the
 * only symptom is email that quietly stops arriving. One button on a page is a
 * second click; a scanner silently unsubscribing a customer is a support
 * conversation nobody knows to start.
 *
 * The one-click path, which is the one the spam filters actually measure, is
 * POST and stays a single action.
 */

async function optOut(request: Request): Promise<{ status: number; message: string; email: string }> {
  const url = new URL(request.url);
  const email = normalizeEmail(url.searchParams.get("e"));
  const token = String(url.searchParams.get("t") ?? "");

  if (!email || !token) {
    return { status: 400, email, message: "That link is incomplete. Email us and we will remove you by hand." };
  }

  // SIGNED. Without this, anybody could unsubscribe anybody by editing the
  // address in the URL, and the victim's only symptom would be email that
  // quietly stopped arriving.
  const check = await checkOptOutToken(email, token);
  if (!check.ok) {
    return {
      status: check.reason === "expired" ? 410 : 400,
      email,
      message:
        check.reason === "expired"
          ? "That link has expired. Email us and we will remove you straight away."
          : "That link is not valid. Email us and we will remove you straight away.",
    };
  }

  if (!adminConfigured()) {
    return { status: 503, email, message: "We could not reach our database. Email us and we will remove you by hand." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("email_opt_outs")
    .upsert({ email, kind: "order_reminders" }, { onConflict: "email" });

  if (error) {
    console.error("[unsubscribe] could not record opt-out:", error.message);
    return { status: 500, email, message: "Something went wrong saving that. Email us and we will remove you by hand." };
  }

  return { status: 200, email, message: "" };
}

/**
 * The action. A mail client's one-click unsubscribe, or the page's button.
 *
 * Answers HTML to a form post and JSON to a mail client, because the mail
 * client does not render anything and the person does.
 */
export async function POST(request: Request): Promise<Response> {
  const result = await optOut(request);
  const wantsHtml = (request.headers.get("accept") || "").includes("text/html");
  if (!wantsHtml) {
    return NextResponse.json(
      result.status === 200 ? { unsubscribed: true } : { error: result.message },
      { status: result.status }
    );
  }
  return page(request, result, result.status === 200 ? "done" : "error");
}

/** The link in the email footer. Shows the button; changes nothing. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const email = normalizeEmail(url.searchParams.get("e"));
  const token = String(url.searchParams.get("t") ?? "");
  if (!email || !token) {
    return page(
      request,
      { status: 400, email, message: "That link is incomplete. Email us and we will remove you by hand." },
      "error"
    );
  }
  // The token is checked here too, so a bad link says so before asking the
  // reader to press anything.
  const check = await checkOptOutToken(email, token);
  if (!check.ok) {
    return page(
      request,
      {
        status: check.reason === "expired" ? 410 : 400,
        email,
        message:
          check.reason === "expired"
            ? "That link has expired. Email us and we will remove you straight away."
            : "That link is not valid. Email us and we will remove you straight away.",
      },
      "error"
    );
  }
  return page(request, { status: 200, email, message: "" }, "confirm");
}

function page(
  request: Request,
  result: { status: number; message: string; email: string },
  mode: "confirm" | "done" | "error"
): Response {
  const site = publicSiteUrl() || COMPANY.siteUrl;
  const action = escapeHtml(new URL(request.url).pathname + new URL(request.url).search);

  const body =
    mode === "confirm"
      ? `<h1>Stop these emails?</h1>
         <p>We will stop sending order reminders to <strong>${escapeHtml(result.email)}</strong>.</p>
         <form method="post" action="${action}">
           <button type="submit" class="btn primary">Yes, unsubscribe me</button>
         </form>`
      : mode === "done"
        ? `<h1>You're unsubscribed</h1>
           <p>We won't send any more order reminders to <strong>${escapeHtml(result.email)}</strong>.</p>
           <p class="muted">You will still receive emails about an order you place from now on —
           confirmations, shipping updates and receipts. Those are part of the order itself,
           not marketing, and there is no way to turn them off without turning off the order.</p>`
        : `<h1>We couldn't do that</h1>
           <p>${escapeHtml(result.message)}</p>`;

  return new Response(
    `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Unsubscribe · ${escapeHtml(COMPANY.name)}</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#0b0b0f; color:#e7e7ea; font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
         padding:24px; }
  .card { max-width:34rem; }
  h1 { font-size:1.6rem; margin:0 0 1rem; text-transform:uppercase; letter-spacing:-0.01em; }
  p { color:#a9a9b2; line-height:1.65; }
  .muted { font-size:.85rem; color:#8d90a2; }
  .btn { display:inline-block; margin-top:1.5rem; border:1px solid rgba(255,255,255,.25);
         background:none; color:#fff; padding:13px 26px; border-radius:8px; text-decoration:none;
         text-transform:uppercase; letter-spacing:.1em; font-weight:700; font-size:.8rem;
         cursor:pointer; font-family:inherit; }
  .btn.primary { background:#c4f731; border-color:#c4f731; color:#10121a; }
  a { color:#c4f731; }
</style>
</head><body><div class="card">
${body}
<p class="muted">Changed your mind, or need a hand? Email
<a href="mailto:${escapeHtml(COMPANY.supportEmail)}">${escapeHtml(COMPANY.supportEmail)}</a>.</p>
<a class="btn" href="${escapeHtml(site)}">Back to the shop</a>
</div></body></html>`,
    {
      status: result.status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        // Never cached, never indexed: it is a one-off action on one address.
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    }
  );
}

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
