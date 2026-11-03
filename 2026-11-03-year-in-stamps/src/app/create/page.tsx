import type { Metadata } from "next";
import { CreatePassport } from "@/components/create/CreatePassport";
import { AppHeader } from "@/components/site/AppHeader";

export const metadata: Metadata = { title: "Create your passport" };

export default function CreatePage() {
  return (
    <>
      <AppHeader current="create" />
      <main className="flex flex-1 flex-col">
        <CreatePassport />
      </main>
    </>
  );
}
