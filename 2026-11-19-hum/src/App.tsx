// src/App.tsx — tiny hash router: #/ is the library, #/song/<id> is the studio.
import { useEffect, useState } from "react";
import Library from "./components/Library";
import Studio from "./components/Studio";
import { player } from "./audio/player";

const parse = () => {
  const m = location.hash.match(/^#\/song\/([\w-]+)/);
  return m ? { view: "song" as const, id: m[1] } : { view: "library" as const, id: null };
};

export default function App() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onHash = () => { player.stop(); setRoute(parse()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route.view === "song" && route.id ? <Studio key={route.id} songId={route.id} /> : <Library />;
}

export const go = (path: string) => { location.hash = path; };
