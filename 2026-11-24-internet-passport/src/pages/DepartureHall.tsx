// src/pages/DepartureHall.tsx
// home. the passport preview, today's destination, the departure board,
// surprise me and the current expedition.

import { useEffect, useState } from "react";
import { usePassport, useReducedMotion } from "../lib/store";
import {
  departureBoard,
  expeditionProgress,
  featuredExpedition,
  hasVisited,
  surprise,
  todaysDestination,
  explorerTitle,
} from "../lib/logic";
import { territory } from "../data/territories";
import { destination } from "../data/destinations";
import { ClosedPassport, CatalogStamp, Modal, Progress } from "../components/bits";
import { BoardingPass } from "../components/BoardingPass";
import { ExpeditionPoster } from "./Expeditions";
import { go, href } from "../lib/router";
import { clock, plural } from "../lib/format";
import type { Destination } from "../types";

function FlapText({ text, reduced }: { text: string; reduced: boolean }) {
  // split flap: letters shuffle briefly before settling
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (reduced) {
      setShown(text);
      return;
    }
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let frame = 0;
    const id = setInterval(() => {
      frame++;
      setShown(
        text
          .split("")
          .map((c, i) => (c === " " || i < frame - 2 ? c : chars[Math.floor(Math.random() * chars.length)]))
          .join(""),
      );
      if (frame > text.length + 2) {
        clearInterval(id);
        setShown(text);
      }
    }, 38);
    return () => clearInterval(id);
  }, [text, reduced]);
  return (
    <span className="flap" aria-label={text}>
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}

function StuckClock() {
  const { state, discover } = usePassport();
  const [taps, setTaps] = useState(0);
  const fixed = Boolean(state.discoveries.clock);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    if (!fixed) return;
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, [fixed]);
  const h = fixed ? now.getHours() % 12 : 7;
  const m = fixed ? now.getMinutes() : 19;
  return (
    <button
      type="button"
      className={`hall-clock ${fixed ? "fixed" : ""} ${taps ? `nudge-${taps}` : ""}`}
      aria-label={fixed ? `terminal clock, ${clock(now)}` : "terminal clock, out of order"}
      onClick={() => {
        if (fixed) return;
        const n = taps + 1;
        setTaps(n);
        if (n >= 3) discover("clock");
      }}
    >
      <svg viewBox="0 0 100 100" width="76" height="76" aria-hidden="true">
        <circle cx="50" cy="50" r="44" fill="#F8F1E5" stroke="currentColor" strokeWidth="4" />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1="50" y1="12" x2="50" y2={i % 3 ? 16 : 20} stroke="currentColor" strokeWidth="2.5" transform={`rotate(${i * 30} 50 50)`} />
        ))}
        <line x1="50" y1="50" x2="50" y2="28" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" transform={`rotate(${h * 30 + m / 2} 50 50)`} className="hand" />
        <line x1="50" y1="50" x2="50" y2="18" stroke="#783B49" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${m * 6} 50 50)`} className="hand" />
        <circle cx="50" cy="50" r="3.5" fill="currentColor" />
      </svg>
      <span className="clock-note">{fixed ? "fixed, thank you" : "out of order since 1996"}</span>
    </button>
  );
}

function SurpriseModal({ onClose }: { onClose: () => void }) {
  const { state } = usePassport();
  const reduced = useReducedMotion();
  const [pick, setPick] = useState<Destination | null>(() => surprise(state));
  const [open, setOpen] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    setOpen(false);
    const t = setTimeout(() => setOpen(true), 650);
    return () => clearTimeout(t);
  }, [pick, reduced]);

  return (
    <Modal title="a mystery boarding pass" onClose={onClose} wide>
      {!pick ? (
        <p>you have stamped every open destination on the map. the department is speechless. new places appear when you unlock hidden territories.</p>
      ) : (
        <div className="surprise">
          <div className={`envelope ${open ? "open" : ""}`} aria-hidden={!open}>
            <div className="envelope-flap" aria-hidden="true" />
            <div className="envelope-pass">
              <BoardingPass d={pick} />
            </div>
          </div>
          {open && (
            <p className="surprise-line" aria-live="polite">
              you are flying to <strong>{pick.name}</strong> in the {territory(pick.territory).short}.
            </p>
          )}
          <div className="row center">
            <button
              className="btn btn-primary"
              onClick={() => {
                onClose();
                go(`/destination/${pick.id}`);
              }}
            >
              head to the gate
            </button>
            <button className="btn" onClick={() => setPick(surprise(state, Math.random, pick.id) ?? pick)}>
              draw another
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function DepartureHall() {
  const { state } = usePassport();
  const reduced = useReducedMotion();
  const [now, setNow] = useState(() => new Date());
  const [surpriseOpen, setSurpriseOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const p = state.profile!;

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      setTick((t) => t + 1);
    }, 20_000);
    return () => clearInterval(id);
  }, []);

  const today = todaysDestination(now);
  const t = territory(today.territory);
  const todayDone = hasVisited(state, today.id);
  const board = departureBoard(state, now);
  const exp = featuredExpedition(now);
  const prog = expeditionProgress(state, exp);
  const stampCount = Object.keys(state.stamps).length;
  const statusShift = tick % 3;
  const pending = state.departure ? destination(state.departure.destinationId) : null;

  return (
    <main id="main" className="page hall" tabIndex={-1}>
      <header className="hall-head">
        <div>
          <p className="kicker">departure hall, terminal www</p>
          <h1 className="display big">good to see you, {p.alias || p.name}.</h1>
          <p className="lede">where to today? the board is full of places you have never been.</p>
        </div>
        <StuckClock />
      </header>

      {pending && !hasVisited(state, pending.id) && (
        <a className="return-banner" href={href(`/destination/${pending.id}`)}>
          welcome back from <strong>{pending.name}</strong>. confirm your visit to collect the stamp.
        </a>
      )}

      <div className="hall-grid">
        <section className="hall-passport" aria-labelledby="pp-h">
          <h2 id="pp-h" className="visually-hidden">
            your passport
          </h2>
          <a href={href("/passport")} className="booklet-link" aria-label={`open your passport, ${stampCount} stamps`}>
            <ClosedPassport color={p.coverColor} name={p.name} number={p.passportNumber} stamps={stampCount} />
          </a>
          <p className="muted small center">
            {explorerTitle(state.visits.length)}, {state.visits.length} destinations visited
          </p>
        </section>

        <section className="today ticket" aria-labelledby="today-h" style={{ ["--accent" as string]: t.color, ["--ink-accent" as string]: t.ink }}>
          <div className="ticket-main">
            <p className="kicker">today's destination</p>
            <h2 id="today-h" className="display">
              {today.name}
            </h2>
            <p className="ticket-territory">{t.name}</p>
            <p>{today.description}</p>
            <p className="mono small">about {plural(today.minutes, "minute")} of exploring</p>
            <a className="btn btn-primary" href={href(`/destination/${today.id}`)}>
              {todayDone ? "you have been. go again" : "visit today's destination"}
            </a>
          </div>
          <div className="ticket-stub">
            <CatalogStamp stampId={`dest:${today.id}`} earnedAt={state.stamps[`dest:${today.id}`]?.earnedAt} size={120} faded={!todayDone} title={`stamp preview for ${today.name}`} />
          </div>
        </section>

        <section className="board" aria-labelledby="board-h">
          <div className="board-head">
            <h2 id="board-h">departures</h2>
            <span className="board-clock mono" aria-label={`time ${clock(now)}`}>
              {clock(now)}
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th scope="col">flight</th>
                <th scope="col">destination</th>
                <th scope="col" className="hide-sm">
                  territory
                </th>
                <th scope="col">status</th>
              </tr>
            </thead>
            <tbody>
              {board.map((row, i) => {
                const status = row.status === "landed" ? "landed" : i % 3 === statusShift ? "boarding" : row.status;
                return (
                  <tr key={row.destination.id}>
                    <td className="mono">
                      <FlapText text={row.code} reduced={reduced} />
                    </td>
                    <td>
                      <a href={href(`/destination/${row.destination.id}`)}>
                        <FlapText text={row.destination.name.toUpperCase()} reduced={reduced} />
                      </a>
                    </td>
                    <td className="hide-sm">{territory(row.destination.territory).short}</td>
                    <td className={`status status-${status.replace(/\s/g, "-")}`}>
                      <FlapText text={status.toUpperCase()} reduced={reduced} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="board-note">flight numbers and statuses are just for fun. every gate is open.</p>
        </section>

        <section className="surprise-cta" aria-labelledby="sur-h">
          <h2 id="sur-h" className="display">
            surprise me
          </h2>
          <p>a sealed boarding pass to a random place you have not stamped yet.</p>
          <button className="btn btn-primary btn-big" onClick={() => setSurpriseOpen(true)}>
            open a mystery boarding pass
          </button>
        </section>

        <section className="hall-expedition" aria-labelledby="exp-h">
          <p className="kicker">this week's expedition</p>
          <a href={href(`/expeditions/${exp.id}`)} className="poster-link">
            <ExpeditionPoster e={exp} small />
          </a>
          <h2 id="exp-h" className="display">
            <a href={href(`/expeditions/${exp.id}`)}>{exp.title}</a>
          </h2>
          <Progress value={prog.visited} total={prog.total} label={`${exp.title} progress`} />
          <p className="small">
            {prog.complete ? "complete. the seal is in your passport." : `${prog.visited} of ${prog.total} stops visited. still to go`}
          </p>
          {!prog.complete && (
            <ul className="remaining">
              {prog.remaining.map((id) => {
                const d = destination(id)!;
                return (
                  <li key={id}>
                    <a href={href(`/destination/${id}`)}>{d.name}</a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      {surpriseOpen && <SurpriseModal onClose={() => setSurpriseOpen(false)} />}
    </main>
  );
}
