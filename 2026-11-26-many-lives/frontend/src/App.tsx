// frontend/src/App.tsx: the shell. a quiet top bar, the router, and the demo universe banner.
import { useEffect, useState } from "react";
import { api, getUniverse, setUniverse, Universe as U } from "./api";
import { EvidenceProvider } from "./components/Evidence";
import { go, useRoute } from "./hooks";
import Archive from "./pages/Archive";
import Inbox from "./pages/Inbox";
import Library from "./pages/Library";
import Multiverse from "./pages/Multiverse";
import Museum from "./pages/Museum";
import Observatory from "./pages/Observatory";
import Search from "./pages/Search";
import Studio from "./pages/Studio";
import Unknown from "./pages/Unknown";
import Universe from "./pages/Universe";

export default function App() {
  const route = useRoute();
  const [u, setU] = useState<U>(getUniverse());
  const [key, setKey] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const parts = route.split("/").filter(Boolean);
  const place = parts[0] || "universe";

  useEffect(() => {
    api.get("/api/universe").then((d) => setNewCount(d.new_discoveries)).catch(() => {});
    if (["multiverse", "museum", "archive", "library", "observatory", "unknown"].includes(place)) api.post("/api/visit", { place }).catch(() => {});
    window.scrollTo(0, 0);
  }, [route, key]);

  function switchTo(next: U) {
    setUniverse(next);
    setU(next);
    setKey((k) => k + 1);
  }

  let page: React.ReactNode;
  switch (place) {
    case "multiverse": page = <Multiverse id={parts[1]} />; break;
    case "museum": page = <Museum exhibition={parts[1]} />; break;
    case "artifact": page = <Museum artifact={parts[1]} />; break;
    case "archive": page = <Archive id={parts[1]} />; break;
    case "library": page = <Library id={parts[1]} />; break;
    case "observatory": page = <Observatory />; break;
    case "unknown": page = <Unknown />; break;
    case "inbox": page = <Inbox />; break;
    case "studio": page = <Studio />; break;
    case "search": page = <Search />; break;
    default: page = <Universe />;
  }

  return (
    <EvidenceProvider>
      <div className={`app place-${place} ${u === "demo" ? "is-demo" : ""}`} key={key}>
        <a href="#main" className="skip">skip to the content</a>
        {u === "demo" && (
          <div className="demo-banner" role="status">
            this is the demo universe of pip, a made up person. none of it is you.
            <button onClick={() => switchTo("real")}>go to my universe</button>
          </div>
        )}
        <nav className="topbar" aria-label="main">
          <a className="mark" href="#/" aria-label="back to the universe">
            <svg viewBox="0 0 40 40" width="28" height="28" aria-hidden="true"><circle cx="20" cy="20" r="8" fill="#FFD1D3" stroke="#40364D" strokeWidth="2" /><ellipse cx="20" cy="20" rx="17" ry="6" fill="none" stroke="currentColor" strokeWidth="1.6" transform="rotate(-20 20 20)" /></svg>
            <span>the many lives of me</span>
          </a>
          <div className="topbar-links">
            <button className="link" onClick={() => go("/search")}>search</button>
            <a href="#/inbox" className="inbox-link">discoveries{newCount > 0 && <span className="dot">{newCount}</span>}</a>
            <a href="#/studio">sources</a>
            <button className="link universe-switch" onClick={() => switchTo(u === "demo" ? "real" : "demo")}>
              {u === "demo" ? "my universe" : "demo"}
            </button>
          </div>
        </nav>
        <main id="main">{page}</main>
      </div>
    </EvidenceProvider>
  );
}

export function Back({ to = "/", label = "back to the universe" }: { to?: string; label?: string }) {
  return <a className="back" href={`#${to}`}>{label}</a>;
}

export function Loading({ what = "the universe" }: { what?: string }) {
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const on = (e: Event) => setErr((e as CustomEvent).detail);
    addEventListener("ml-error", on);
    return () => removeEventListener("ml-error", on);
  }, []);
  if (err) return <div className="loading">{what} could not be opened. {err.toLowerCase()}. <a href="#/">back to the universe</a></div>;
  return <div className="loading"><span className="orbit" aria-hidden="true" /> opening {what}...</div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}
