import Link from "next/link";
import { screens, groups } from "@/lib/screens";

export const metadata = {
  title: "All Screens — Design Archive",
  description:
    "Every E-Drift Trikes screen from the Voltage Drift design export — mobile and desktop, all variants — exactly as designed.",
};

export default function ScreensIndex() {
  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen tech-grid">
      {/* Header */}
      <header className="border-b border-white/10 bg-surface-container-lowest/80 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-5 flex items-center justify-between gap-gutter">
          <div>
            <Link
              href="/"
              className="font-headline-md text-headline-md text-secondary tracking-tighter"
            >
              E-DRIFT
            </Link>
            <span className="ml-3 font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant">
              Design Archive
            </span>
          </div>
          <Link
            href="/"
            className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-secondary transition-colors"
          >
            ← Back to site
          </Link>
        </div>
      </header>

      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-16">
        <div className="mb-16 max-w-3xl">
          <h1 className="font-display-lg text-display-lg-mobile md:text-headline-xl text-white uppercase leading-none mb-6">
            EVERY SCREEN<span className="text-secondary">.</span>
          </h1>
          <p className="text-on-surface-variant font-body-lg border-l-4 border-secondary pl-6">
            All {screens.length} screens from the Voltage Drift export — every
            page, mobile and desktop, including each design variant — rendered
            exactly as designed, top to bottom, with all interactions live.
          </p>
        </div>

        {groups.map((group) => {
          const items = screens.filter((s) => s.group === group);
          return (
            <section key={group} className="mb-20">
              <div className="flex items-center gap-4 mb-8">
                <h2 className="font-headline-md text-headline-md text-white uppercase">
                  {group}
                </h2>
                <span className="h-2 w-12 bg-secondary" />
                <span className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-widest">
                  {items.length} {items.length === 1 ? "screen" : "screens"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
                {items.map((s) => (
                  <a
                    key={s.slug}
                    href={`/design/${s.slug}.html`}
                    className="group block bg-surface-container border border-white/10 rounded-lg overflow-hidden hover:border-secondary/60 hover-lift"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-surface-container-lowest">
                      {s.hasThumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/design/thumbs/${s.slug}.jpg`}
                          alt={`${s.title} — ${s.platform}`}
                          loading="lazy"
                          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-outline font-label-bold text-label-bold uppercase tracking-widest">
                          {s.title}
                        </div>
                      )}
                      <span className="absolute top-3 left-3 cut-corner-badge bg-secondary text-on-secondary-fixed font-label-bold text-[10px] uppercase tracking-widest px-3 py-1">
                        {s.platform}
                      </span>
                      {s.variant ? (
                        <span className="absolute top-3 right-3 bg-primary-container text-on-primary-container font-label-bold text-[10px] uppercase tracking-widest px-3 py-1 rounded">
                          {s.variant}
                        </span>
                      ) : null}
                    </div>
                    <div className="p-5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-label-bold text-white uppercase tracking-wide">
                          {s.title}
                        </h3>
                        <p className="text-on-surface-variant text-xs uppercase tracking-widest font-label-bold mt-1">
                          {s.platform}
                          {s.variant ? ` · ${s.variant}` : ""}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-secondary group-hover:translate-x-1 transition-transform">
                        arrow_forward
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          );
        })}
      </main>

      <footer className="border-t border-white/10 bg-surface-container-lowest">
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-10 flex flex-col md:flex-row justify-between gap-4 text-on-surface-variant font-label-bold text-[10px] tracking-widest uppercase">
          <span>© 2024 E-DRIFT MOTORS · VOLTAGE DRIFT DESIGN ARCHIVE</span>
          <span>{screens.length} SCREENS · MOBILE + DESKTOP</span>
        </div>
      </footer>
    </div>
  );
}
