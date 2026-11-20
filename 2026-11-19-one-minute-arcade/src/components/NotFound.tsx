// src/components/NotFound.tsx

import { navigate } from "../app/router";
import { Button } from "./ui";

export function NotFound() {
  return (
    <section className="mt-16 text-center">
      <h1 className="display text-4xl">no cartridge here</h1>
      <p className="mt-2 font-bold">this page blew into the wrong slot.</p>
      <Button tone="sun" className="mt-6" onClick={() => navigate("/")}>
        back to the arcade
      </Button>
    </section>
  );
}
