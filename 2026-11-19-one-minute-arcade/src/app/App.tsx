// src/app/App.tsx
// the arcade shell. picks a page from the url and owns the surprise me shuffle.

import { useCallback, useEffect, useRef, useState } from "react";
import { GameHost } from "../engine/GameHost";
import { pickRandomGame } from "../engine/random";
import { GAME_IDS, getGame } from "../games/registry";
import { Header } from "../components/Header";
import { Home } from "../components/Home";
import { RecordsPage } from "../components/RecordsPage";
import { SettingsPage } from "../components/SettingsPage";
import { NotFound } from "../components/NotFound";
import { navigate, parseRoute, usePathname } from "./router";
import { useStore } from "./store";

export interface Shuffle {
  active: boolean;
  chosen: string | null;
}

const TITLES: Record<string, string> = {
  home: "One Minute Arcade",
  records: "my records at One Minute Arcade",
  settings: "settings at One Minute Arcade",
  notFound: "lost at One Minute Arcade",
};

export function App() {
  const route = parseRoute(usePathname());
  const { records, reducedMotion } = useStore();
  const [shuffle, setShuffle] = useState<Shuffle>({ active: false, chosen: null });
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const lastId = route.name === "play" ? route.id : records.lastGameId;

  const surprise = useCallback(() => {
    if (shuffle.active) return;
    const id = pickRandomGame(GAME_IDS, lastId);
    if (route.name !== "home") navigate("/");
    const spin = reducedMotion ? 120 : 650;
    const hold = reducedMotion ? 80 : 420;
    setShuffle({ active: true, chosen: null });
    timers.current.push(
      window.setTimeout(() => setShuffle({ active: true, chosen: id }), spin),
      window.setTimeout(() => {
        setShuffle({ active: false, chosen: null });
        navigate(`/play/${id}`);
      }, spin + hold),
    );
  }, [lastId, reducedMotion, route.name, shuffle.active]);

  const randomNow = useCallback(() => {
    navigate(`/play/${pickRandomGame(GAME_IDS, lastId)}`);
  }, [lastId]);

  const game = route.name === "play" ? getGame(route.id) : null;

  useEffect(() => {
    document.title = game ? `${game.title} at One Minute Arcade` : (TITLES[route.name] ?? TITLES.home);
  }, [game, route.name]);

  if (route.name === "play" && game) {
    return <GameHost key={game.id} game={game} onExit={() => navigate("/")} onRandom={randomNow} />;
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pb-10 sm:px-6">
      <a href="#main" className="sr-only focus:not-sr-only">
        skip to games
      </a>
      <Header route={route.name} onSurprise={surprise} />
      <main id="main" className="flex-1">
        {route.name === "home" && <Home shuffle={shuffle} onSurprise={surprise} />}
        {route.name === "records" && <RecordsPage />}
        {route.name === "settings" && <SettingsPage />}
        {(route.name === "notFound" || route.name === "play") && <NotFound />}
      </main>
      <footer className="mt-12 text-center text-sm font-bold opacity-70">made in one sitting. played in one minute.</footer>
    </div>
  );
}
