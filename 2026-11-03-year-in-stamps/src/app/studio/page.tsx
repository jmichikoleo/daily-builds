import type { Metadata } from "next";
import { AppHeader } from "@/components/site/AppHeader";
import { Studio } from "@/components/studio/Studio";

export const metadata: Metadata = { title: "Collage studio" };

export default function StudioPage() {
  return (
    <>
      <AppHeader current="studio" />
      <main className="flex flex-1 flex-col">
        <Studio />
      </main>
    </>
  );
}
