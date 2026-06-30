import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import { getArticleBySlug } from "@/lib/db";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const a = await getArticleBySlug(params.slug);
  return { title: a ? a.title : "Article" };
}

export default async function Article({ params }: { params: { slug: string } }) {
  const a = await getArticleBySlug(params.slug);
  if (!a) notFound();

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <SiteHeader />
      <article className="flex-1 w-full">
        <div className="relative h-[45vh] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.cover_url || "/assets/garage-workshop-night.jpg"} alt={a.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full">
            <div className="max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop pb-10">
              <Link href="/tech-lab" className="text-secondary font-label-bold text-xs uppercase tracking-widest hover:underline">← The Tech Lab</Link>
              <h1 className="font-display-lg text-display-lg-mobile md:text-headline-xl text-white uppercase leading-none mt-4">{a.title}</h1>
              <p className="text-on-surface-variant mt-3 font-label-bold uppercase tracking-widest text-sm">
                {a.category} · {a.author} · {a.read_minutes} min read
              </p>
            </div>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop py-12">
          <p className="text-on-surface font-body-lg leading-relaxed border-l-4 border-secondary pl-6 mb-8">{a.excerpt}</p>
          <div className="prose prose-invert max-w-none text-on-surface-variant font-body-lg leading-relaxed whitespace-pre-line">
            {a.body}
          </div>
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}
