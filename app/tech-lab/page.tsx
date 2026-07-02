import Link from "next/link";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import { getArticles } from "@/lib/db";

// ISR: serve cached HTML, refresh in the background.
export const revalidate = 120;

export const metadata = { title: "The Tech Lab" };

export default async function TechLab() {
  const articles = await getArticles();
  const [feature, ...rest] = articles;

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col tech-grid">
      <SiteHeader />
      <main className="flex-1 max-w-max-width w-full mx-auto px-margin-mobile md:px-margin-desktop py-12">
        <header className="mb-12">
          <span className="font-label-bold text-label-bold text-secondary uppercase tracking-widest">Knowledge Base</span>
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-white uppercase leading-none mt-2">The Tech Lab</h1>
          <p className="text-on-surface-variant font-body-lg max-w-2xl mt-4 border-l-4 border-secondary pl-6">
            Guides, schematics and garage knowledge from the engineers building the slide.
          </p>
        </header>

        {articles.length === 0 ? (
          <div className="border border-dashed border-white/10 rounded-lg py-24 text-center">
            <p className="text-on-surface-variant uppercase tracking-widest font-label-bold">No articles published yet</p>
          </div>
        ) : (
          <>
            {feature && (
              <Link href={`/tech-lab/${feature.slug}`} className="group block relative rounded-lg overflow-hidden mb-12 border border-white/10">
                <div className="aspect-[21/9] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={feature.cover_url || "/assets/garage-workshop-night.jpg"} alt={feature.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute bottom-0 left-0 p-8 md:p-12 max-w-2xl">
                  <span className="bg-secondary text-on-secondary-fixed px-3 py-1 font-label-bold text-[10px] uppercase tracking-widest">{feature.category}</span>
                  <h2 className="font-headline-xl text-headline-xl text-white uppercase mt-4 leading-none">{feature.title}</h2>
                  <p className="text-on-surface-variant mt-3">{feature.excerpt}</p>
                </div>
              </Link>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              {rest.map((a) => (
                <Link key={a.id} href={`/tech-lab/${a.slug}`} className="group bg-surface-container border border-white/10 rounded-lg overflow-hidden hover-lift hover:border-secondary/50">
                  <div className="aspect-video overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img loading="lazy" decoding="async" src={a.cover_url || "/assets/garage-workshop-night.jpg"} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="p-6">
                    <span className="font-label-bold text-[10px] text-secondary uppercase tracking-widest">{a.category} · {a.read_minutes} min</span>
                    <h3 className="font-headline-md text-xl text-white uppercase mt-2 leading-tight">{a.title}</h3>
                    <p className="text-on-surface-variant text-sm mt-2 line-clamp-2">{a.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
