// src/App.tsx
// picks a page from the hash route. no passport yet means onboarding.

import { useEffect } from "react";
import { usePassport, useReducedMotion } from "./lib/store";
import { useRoute } from "./lib/router";
import { Nav } from "./components/Nav";
import { Ceremony } from "./components/Ceremony";
import { InkFilters } from "./components/Stamp";
import { Onboarding } from "./pages/Onboarding";
import { DepartureHall } from "./pages/DepartureHall";
import { Atlas } from "./pages/Atlas";
import { TerritoryPage } from "./pages/TerritoryPage";
import { DestinationPage } from "./pages/DestinationPage";
import { PassportPage } from "./pages/PassportPage";
import { ExpeditionsPage, ExpeditionDetail } from "./pages/Expeditions";
import { JournalPage } from "./pages/Journal";
import { ProfilePage } from "./pages/Profile";
import { Empty } from "./components/bits";

function NotFound() {
  return (
    <main id="main" className="page">
      <Empty title="this gate does not exist">
        <p>the departures board has no record of this place.</p>
        <a className="btn btn-primary" href="#/">
          back to the departure hall
        </a>
      </Empty>
    </main>
  );
}

function StorageProblem() {
  const { problem, acknowledgeProblem } = usePassport();
  return (
    <main id="main" className="page narrow">
      <div className="paper notice">
        <h1 className="display">the passport office found a damaged file</h1>
        {problem === "newer" ? (
          <p>the passport saved in this browser was made by a newer version of internet passport. this version will not touch it.</p>
        ) : (
          <p>the passport saved in this browser could not be read. it might have been edited by hand or cut short.</p>
        )}
        <p>
          you can start a fresh passport here. the unreadable data is set aside in this browser, not deleted, and you can restore a backup file
          afterwards from the explorer profile.
        </p>
        <button className="btn btn-primary" onClick={acknowledgeProblem}>
          set it aside and start fresh
        </button>
      </div>
    </main>
  );
}

export function App() {
  const { state, problem, saveFailed } = usePassport();
  const route = useRoute();
  const reduced = useReducedMotion();
  const [section = "", a, b] = route.path;

  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? "reduced" : "full";
  }, [reduced]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [section, a, b]);

  useEffect(() => {
    if (state.profile) document.documentElement.style.setProperty("--cover", state.profile.coverColor);
  }, [state.profile]);

  if (problem !== "none") return <StorageProblem />;

  if (!state.profile) {
    return (
      <>
        <InkFilters />
        <Onboarding />
        <Ceremony />
      </>
    );
  }

  let page;
  switch (section) {
    case "":
      page = <DepartureHall />;
      break;
    case "atlas":
      page = a ? <TerritoryPage id={a} /> : <Atlas query={route.query} />;
      break;
    case "destination":
      page = a ? <DestinationPage key={a} id={a} /> : <NotFound />;
      break;
    case "passport":
      page = <PassportPage view={a === "collection" ? "collection" : "book"} />;
      break;
    case "expeditions":
      page = a ? <ExpeditionDetail id={a} /> : <ExpeditionsPage />;
      break;
    case "journal":
      page = <JournalPage sub={a} id={b} query={route.query} />;
      break;
    case "profile":
      page = <ProfilePage edit={a === "edit"} />;
      break;
    default:
      page = <NotFound />;
  }

  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>
        skip to content
      </a>
      <InkFilters />
      <Nav current={section} />
      {saveFailed && (
        <p className="save-warning" role="alert">
          your browser refused to save. progress made now may be lost when you close this tab. making a backup from the profile is a good idea.
        </p>
      )}
      {page}
      <footer className="site-foot">
        <p>
          internet passport is a fictional travel document for the web. issued by the department of internet exploration, which is also fictional.
          everything you collect stays in this browser.
        </p>
      </footer>
      <Ceremony />
    </>
  );
}
