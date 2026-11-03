import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, DM_Mono, Fraunces, Inter, Oswald, Space_Grotesk } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], style: ["normal", "italic"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const dmMono = DM_Mono({ variable: "--font-dm-mono", subsets: ["latin"], weight: ["400", "500"] });
// Collage-only faces (Pink Postcard and Editorial Atlas themes).
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"], weight: ["500", "600", "700"] });

const DESCRIPTION = "Everywhere you went. Everything you collected. One little passport. Turn the places you visited this year into a collage of illustrated travel stamps.";

/**
 * Absolute base for Open Graph URLs. Set NEXT_PUBLIC_SITE_URL in production;
 * on Netlify and Vercel the site's own address is picked up automatically.
 */
function siteUrl(): URL | undefined {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  // Netlify sets URL to the site's main address during builds.
  const netlify = process.env.NETLIFY === "true" ? process.env.URL : undefined;
  const value = explicit || netlify || (vercel ? `https://${vercel}` : "");
  try {
    return value ? new URL(value) : undefined;
  } catch {
    return undefined;
  }
}

// Static, brand-only metadata: nothing about anyone's travels is ever put in it.
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: "Your Year in Stamps",
    template: "%s · Your Year in Stamps",
  },
  description: DESCRIPTION,
  applicationName: "Your Year in Stamps",
  openGraph: {
    type: "website",
    siteName: "Your Year in Stamps",
    title: "Your Year in Stamps",
    description: "Everywhere you went. Everything you collected. One little passport.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Your Year in Stamps",
    description: "Everywhere you went. Everything you collected. One little passport.",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF7F2",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${oswald.variable} ${dmMono.variable} ${cormorant.variable} ${grotesk.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
