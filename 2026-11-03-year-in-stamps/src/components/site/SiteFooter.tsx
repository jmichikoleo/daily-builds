import Link from "next/link";
import { Wordmark } from "./Wordmark";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Wordmark />
        <div className="max-w-md space-y-1.5 text-xs leading-relaxed">
          <p>
            No account needed. Your passport is saved only in this browser.{" "}
            <Link href="/privacy" className="text-burgundy underline underline-offset-2">
              Privacy &amp; your data
            </Link>
          </p>
          <p>
            Place data from{" "}
            <a href="https://www.geonames.org/" className="underline underline-offset-2 hover:text-burgundy">
              GeoNames
            </a>{" "}
            (CC BY 4.0) and{" "}
            <a href="https://www.naturalearthdata.com/" className="underline underline-offset-2 hover:text-burgundy">
              Natural Earth
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
