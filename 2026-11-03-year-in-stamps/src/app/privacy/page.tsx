import type { Metadata } from "next";
import { ClearDataButton } from "@/components/site/ClearDataButton";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = {
  title: "Privacy & your data",
  description: "Your Year in Stamps keeps your passport in your own browser. No account, no tracking, no uploads.",
};

const POINTS: { title: string; body: string }[] = [
  {
    title: "No account, nothing uploaded",
    body: "There is no sign-up and no server-side database. Your places, dates and designs never leave your device. Images are drawn and saved on your device too.",
  },
  {
    title: "Stored in this browser only",
    body: "Your passport draft is saved in this browser’s local storage, so it is still here when you come back on the same device and browser. It doesn’t sync to other devices.",
  },
  {
    title: "Clearing browser data deletes it",
    body: "If you clear site data or browsing data, use a private window, or the browser frees up space, your draft can be deleted. Save your collage as an image to keep it.",
  },
  {
    title: "No tracking",
    body: "No analytics, advertising or tracking scripts, and no location access. The destination list is a file served with the app; searching it happens on your device.",
  },
];

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 md:py-16">
        <p className="font-stamp text-xs uppercase tracking-[0.32em] text-burgundy">Privacy</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
          Your passport stays <span className="italic text-burgundy">with you.</span>
        </h1>
        <dl className="mt-10 divide-y divide-line border-y border-line">
          {POINTS.map((p) => (
            <div key={p.title} className="grid gap-1 py-5 sm:grid-cols-[13rem_1fr] sm:gap-6">
              <dt className="font-serif text-lg">{p.title}</dt>
              <dd className="text-sm leading-relaxed text-muted">{p.body}</dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="clear-heading" className="mt-10">
          <h2 id="clear-heading" className="font-serif text-2xl">
            Clear my data
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Removes your passport draft and its backup copies from this browser. Only Your Year in Stamps’ own saved data is deleted; nothing else in your browser is affected.
          </p>
          <div className="mt-4">
            <ClearDataButton />
          </div>
        </section>

        <section aria-labelledby="credits-heading" className="mt-12 border-t border-line pt-8">
          <h2 id="credits-heading" className="font-serif text-2xl">
            Credits
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Place names and city data from{" "}
            <a href="https://www.geonames.org/" className="text-burgundy underline underline-offset-2">
              GeoNames
            </a>
            , licensed under{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" className="text-burgundy underline underline-offset-2">
              CC BY 4.0
            </a>
            . Country and territory classification from{" "}
            <a href="https://www.naturalearthdata.com/" className="text-burgundy underline underline-offset-2">
              Natural Earth
            </a>{" "}
            (public domain). Typefaces Fraunces, Inter, Oswald, DM Mono, Cormorant Garamond and Space Grotesk are used under the SIL Open Font License.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
