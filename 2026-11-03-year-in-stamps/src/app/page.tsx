import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { HeroCollage } from "@/components/site/HeroCollage";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { MOTIF_PATHS, type MotifId } from "@/lib/stamps/motifs";

const STEPS: { title: string; body: string; motif: MotifId }[] = [
  {
    title: "Pick your year",
    body: "Open a fresh passport for the year you want to remember, and give it a name if you like.",
    motif: "compass",
  },
  {
    title: "Collect your stamps",
    body: "Add the countries and cities you visited. Each one is pressed into an illustrated stamp.",
    motif: "plane",
  },
  {
    title: "Make your collage",
    body: "Arrange your stamps on a page, choose a look, and size it for your story.",
    motif: "blossom",
  },
];

function StepMotif({ id }: { id: MotifId }) {
  return (
    <svg viewBox="-4 -4 48 48" className="h-12 w-12 text-burgundy" aria-hidden="true">
      <circle cx="20" cy="20" r="23" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="0 4" strokeLinecap="round" />
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" transform="translate(6 6) scale(0.7)">
        {MOTIF_PATHS[id].map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 md:grid-cols-[1.05fr_1fr] md:gap-10 md:pb-24 md:pt-16">
          <div>
            <p className="font-stamp text-xs uppercase tracking-[0.32em] text-burgundy">A passport for the year you had</p>
            <h1 className="mt-5 font-serif text-[3.1rem] leading-[0.95] tracking-tight text-charcoal sm:text-7xl lg:text-[5.25rem]">
              Your year,
              <br />
              <span className="italic text-burgundy">in stamps.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
              Everywhere you went. Everything you collected. One little passport.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/create"
                className="inline-flex items-center justify-center gap-2 rounded-sm bg-burgundy px-6 py-3.5 font-medium text-ivory transition-colors hover:bg-charcoal"
              >
                Create my passport
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center px-2 py-3 text-sm text-charcoal underline decoration-rose underline-offset-4 hover:text-burgundy"
              >
                See how it works
              </Link>
            </div>
            <p className="mt-6 font-mono text-[11px] tracking-[0.14em] text-muted">NO SIGN-UP · SAVED ON THIS DEVICE</p>
          </div>
          <HeroCollage />
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 border-y border-line bg-paper/60">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
                Three steps, <span className="italic text-burgundy">one passport.</span>
              </h2>
              <p className="max-w-sm text-sm text-muted">No itineraries, no maps to fill in. Just the places that made your year.</p>
            </div>
            <ol className="mt-10 grid gap-px overflow-hidden border border-line bg-line md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex flex-col gap-4 bg-ivory p-6 sm:p-8">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-5xl italic leading-none text-rose">{String(i + 1).padStart(2, "0")}</span>
                    <StepMotif id={step.motif} />
                  </div>
                  <h3 className="font-serif text-xl">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 md:py-24">
          <p className="font-stamp text-xs uppercase tracking-[0.32em] text-burgundy">Ready when you are</p>
          <h2 className="mx-auto mt-4 max-w-xl font-serif text-3xl tracking-tight sm:text-5xl">
            Where did this year <span className="italic text-burgundy">take you?</span>
          </h2>
          <Link
            href="/create"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-sm bg-burgundy px-6 py-3.5 font-medium text-ivory transition-colors hover:bg-charcoal"
          >
            Create my passport
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
