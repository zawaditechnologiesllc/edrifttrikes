import { COMPANY } from "@/lib/company";

export const metadata = {
  title: "Not available in your region",
  robots: { index: false, follow: false },
};

/**
 * What a visitor from a blocked country sees.
 *
 * Middleware rewrites every page here with a 403. The wording is deliberately
 * plain and unaccusatory: the overwhelming majority of people who land on this
 * page are ordinary customers who happen to live somewhere the store has had to
 * stop shipping, and telling them they look like a fraudster would be both
 * wrong and unkind. It gives them a real address to write to, because
 * occasionally the edge places someone in the wrong country entirely.
 */
export default function UnavailablePage() {
  return (
    <div className="bg-surface text-on-surface min-h-screen flex items-center justify-center px-6">
      <main className="max-w-lg text-center space-y-6">
        <p className="font-label-bold uppercase tracking-widest text-xs text-secondary">
          {COMPANY.name}
        </p>
        <h1 className="font-display-lg text-display-lg-mobile text-white uppercase leading-none">
          Not available in your region
        </h1>
        <p className="text-on-surface-variant leading-relaxed">
          We&apos;re sorry — we aren&apos;t able to take orders from your location at the
          moment. This isn&apos;t about you personally, and nothing you did caused it.
        </p>
        <p className="text-on-surface-variant leading-relaxed">
          If you believe you&apos;re seeing this by mistake — travelling, or on a
          network that reports the wrong country — email us and a person will
          look into it.
        </p>
        <a
          href={`mailto:${COMPANY.supportEmail}`}
          className="inline-block bg-secondary text-on-secondary-fixed px-8 py-4 rounded-lg font-label-bold uppercase tracking-widest text-sm hover:brightness-105 transition-all"
        >
          {COMPANY.supportEmail}
        </a>
      </main>
    </div>
  );
}
