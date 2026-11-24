// src/pages/Profile.tsx
// explorer identity, statistics, progression, achievements, history and
// settings (motion, sound, backup, restore, reset).

import { useRef, useState } from "react";
import { usePassport } from "../lib/store";
import { ACHIEVEMENTS } from "../data/achievements";
import { REGULAR_TERRITORIES, territory } from "../data/territories";
import { destination, destinationsIn, SECRET_DESTINATIONS } from "../data/destinations";
import {
  TITLES,
  classify,
  completedExpeditions,
  conditionProgress,
  explorerTitle,
  favoriteTerritory,
  nextTitle,
  territoriesExplored,
  visitsIn,
} from "../lib/logic";
import { makeBackup, readBackup } from "../lib/storage";
import { download } from "../lib/image";
import { niceDate } from "../lib/format";
import { go, href } from "../lib/router";
import { CatalogStamp, Emblem, Modal, Progress } from "../components/bits";
import { ProfileFields, type ProfileDraft } from "../components/ProfileForm";
import type { PassportState } from "../types";

function EditProfile() {
  const { state, updateProfile } = usePassport();
  const p = state.profile!;
  const [draft, setDraft] = useState<ProfileDraft>({
    name: p.name,
    alias: p.alias,
    photo: p.photo,
    homeCountry: p.homeCountry,
    favoriteTerritories: p.favoriteTerritories,
    motto: p.motto,
    coverColor: p.coverColor,
  });
  return (
    <main id="main" className="page narrow" tabIndex={-1}>
      <a className="back" href={href("/profile")}>
        back to your profile
      </a>
      <form
        className="paper edit-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.name.trim()) return;
          updateProfile({
            ...p,
            ...draft,
            name: draft.name.trim(),
            alias: draft.alias.trim(),
            homeCountry: draft.homeCountry.trim(),
            motto: draft.motto.trim(),
            classification: classify(draft.favoriteTerritories),
          });
          go("/profile");
        }}
      >
        <h1 className="display">amend your passport</h1>
        <p className="muted small">the passport number and date of issue never change.</p>
        <ProfileFields draft={draft} set={setDraft} parts={["names", "photo", "territories", "motto"]} />
        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={!draft.name.trim()}>
            save changes
          </button>
          <a className="btn" href={href("/profile")}>
            cancel
          </a>
        </div>
      </form>
    </main>
  );
}

function Settings() {
  const { state, setPreferences, replaceAll, reset } = usePassport();
  const [restoreMsg, setRestoreMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState<PassportState | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const prefs = state.preferences;

  return (
    <section className="settings paper" aria-labelledby="set-h">
      <h2 id="set-h" className="display">
        settings and safekeeping
      </h2>
      <fieldset className="field-row">
        <legend>animations</legend>
        {(["system", "full", "reduced"] as const).map((m) => (
          <label key={m} className="check">
            <input type="radio" name="motion" checked={prefs.motion === m} onChange={() => setPreferences({ motion: m })} />
            {m === "system" ? "follow my device" : m === "full" ? "all the flourishes" : "keep things still"}
          </label>
        ))}
      </fieldset>
      <label className="check">
        <input type="checkbox" checked={prefs.sound} onChange={(e) => setPreferences({ sound: e.target.checked })} />
        play small sound effects (stamp thumps and discovery chimes)
      </label>

      <h3 className="display">backup and restore</h3>
      <p className="small">
        your passport lives only in this browser. clearing site data erases it. a backup file keeps everything, photo included, and works in any
        browser.
      </p>
      <div className="row wrap">
        <button
          className="btn"
          onClick={() => download(new Blob([makeBackup(state)], { type: "application/json" }), `internet-passport-backup-${new Date().toISOString().slice(0, 10)}.json`)}
        >
          download a backup
        </button>
        <button className="btn" onClick={() => file.current?.click()}>
          restore from a backup
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          aria-label="choose a backup file"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (f.size > 20_000_000) {
              setRestoreMsg({ ok: false, text: "that file is too large to be a passport backup." });
              return;
            }
            const r = readBackup(await f.text());
            if (!r.ok) setRestoreMsg({ ok: false, text: r.error });
            else setPending(r.state);
          }}
        />
      </div>
      {restoreMsg && (
        <p className={restoreMsg.ok ? "success" : "error"} role="status">
          {restoreMsg.text}
        </p>
      )}

      <h3 className="display">start over</h3>
      <button className="btn btn-danger" onClick={() => setResetOpen(true)}>
        cancel this passport
      </button>

      {pending && (
        <Modal title="restore this backup?" onClose={() => setPending(null)}>
          <p>
            the backup belongs to <strong>{pending.profile?.name}</strong> with {pending.visits.length} visits, {Object.keys(pending.stamps).length} stamps
            and {pending.journal.length} postcards. it will replace everything in this browser right now.
          </p>
          <div className="row">
            <button
              className="btn btn-primary"
              onClick={() => {
                replaceAll(pending);
                setPending(null);
                setRestoreMsg({ ok: true, text: "backup restored. welcome back." });
              }}
            >
              replace with the backup
            </button>
            <button className="btn" onClick={() => setPending(null)}>
              keep what i have
            </button>
          </div>
        </Modal>
      )}

      {resetOpen && (
        <Modal title="cancel this passport?" onClose={() => setResetOpen(false)}>
          <p>
            this erases your passport, every stamp and every postcard from this browser. it cannot be undone. download a backup first if you might want
            it back.
          </p>
          <label className="field">
            <span>type cancel to confirm</span>
            <input value={resetText} onChange={(e) => setResetText(e.target.value)} autoComplete="off" />
          </label>
          <div className="row">
            <button
              className="btn btn-danger"
              disabled={resetText.trim().toLowerCase() !== "cancel"}
              onClick={() => {
                reset();
                go("/");
              }}
            >
              erase everything
            </button>
            <button className="btn" onClick={() => setResetOpen(false)}>
              never mind
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

export function ProfilePage({ edit }: { edit: boolean }) {
  const { state } = usePassport();
  if (edit) return <EditProfile />;
  const p = state.profile!;
  const visits = state.visits.length;
  const fav = favoriteTerritory(state);
  const next = nextTitle(visits);
  const history = [...state.visits].sort((a, b) => b.visitedAt.localeCompare(a.visitedAt));
  const stats = [
    { n: visits, label: "destinations visited" },
    { n: territoriesExplored(state).length, label: `of ${REGULAR_TERRITORIES.length} territories explored` },
    { n: Object.keys(state.stamps).length, label: "stamps collected" },
    { n: visitsIn(state, "hidden"), label: `of ${SECRET_DESTINATIONS.length} secret places found` },
    { n: completedExpeditions(state).length, label: "expeditions completed" },
  ];

  return (
    <main id="main" className="page profile-page" tabIndex={-1}>
      <header className="profile-head paper">
        <div className="photo-frame">{p.photo ? <img src={p.photo} alt={`photograph of ${p.name}`} /> : <span aria-hidden="true">{p.name[0]?.toUpperCase()}</span>}</div>
        <div>
          <p className="kicker">explorer profile</p>
          <h1 className="display big">{p.name}</h1>
          {p.alias && <p className="handwritten">also known as {p.alias}</p>}
          <p className="mono small">
            {p.passportNumber}, issued {niceDate(p.issuedAt)}
            {p.homeCountry ? `, from ${p.homeCountry}` : ""}
          </p>
          <p className="title-line">
            <strong>{explorerTitle(visits)}</strong>, {p.classification}
          </p>
          {p.motto && <p className="handwritten">"{p.motto}"</p>}
          <a className="btn btn-small" href={href("/profile/edit")}>
            edit passport details
          </a>
        </div>
      </header>

      <section aria-labelledby="stats-h">
        <h2 id="stats-h" className="visually-hidden">
          statistics
        </h2>
        <ul className="stats">
          {stats.map((s) => (
            <li key={s.label}>
              <strong className="display">{s.n}</strong>
              <span className="small">{s.label}</span>
            </li>
          ))}
          <li>
            <strong className="display fav-t">{fav ? territory(fav).short : "none yet"}</strong>
            <span className="small">favourite territory</span>
          </li>
        </ul>
      </section>

      <section className="paper" aria-labelledby="rank-h">
        <h2 id="rank-h" className="display">
          explorer titles
        </h2>
        <ol className="ladder">
          {TITLES.map((t) => (
            <li key={t.title} className={explorerTitle(visits) === t.title ? "now" : visits >= t.min ? "done" : ""}>
              <span className="mono small">{t.min}+</span> {t.title}
            </li>
          ))}
        </ol>
        <p className="small muted">
          {next ? `${next.needed} more destinations until ${next.title}. no rush, no streaks, no leaderboard.` : "you hold the highest title there is."}
        </p>
      </section>

      <section aria-labelledby="terr-h">
        <h2 id="terr-h" className="display">
          territories
        </h2>
        <ul className="territory-list compact">
          {REGULAR_TERRITORIES.map((t) => {
            const total = destinationsIn(t.id).length;
            const n = visitsIn(state, t.id);
            return (
              <li key={t.id}>
                <a href={href(`/atlas/${t.id}`)} className="territory-row">
                  <Emblem t={t} size={40} />
                  <span className="territory-row-text">
                    <strong>{t.short}</strong>
                  </span>
                  <span className="territory-row-progress">
                    <span className="mono small">
                      {n} of {total}
                    </span>
                    <Progress value={n} total={total} label={`${t.name} progress`} color={t.ink} />
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="ach-h">
        <h2 id="ach-h" className="display">
          achievements
        </h2>
        <ul className="achievements">
          {ACHIEVEMENTS.map((a) => {
            const got = state.stamps[`ach:${a.id}`];
            const pr = conditionProgress(state, a.condition);
            const hide = !got && a.rarity === "secret";
            return (
              <li key={a.id} className={got ? "got" : ""}>
                <CatalogStamp stampId={`ach:${a.id}`} earnedAt={got?.earnedAt} size={72} faded={!got} mystery={hide} title="" />
                <div>
                  <strong>{hide ? "a secret achievement" : a.name}</strong>
                  <p className="small">{got ? a.description : hide ? a.hint : `${a.description} ${a.hint}`}</p>
                  {!got && !hide && pr.need > 1 && (
                    <span className="mono small">
                      {pr.have} of {pr.need}
                    </span>
                  )}
                  {got && <span className="mono small">earned {niceDate(got.earnedAt)}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="hist-h">
        <h2 id="hist-h" className="display">
          exploration history
        </h2>
        {history.length === 0 ? (
          <p className="muted">no trips yet. the departure board is waiting.</p>
        ) : (
          <ol className="history">
            {history.map((v) => {
              const d = destination(v.destinationId)!;
              return (
                <li key={v.id}>
                  <span className="mono small">{niceDate(v.visitedAt)}</span>
                  <a href={href(`/destination/${d.id}`)}>{d.name}</a>
                  <span className="small muted">{territory(d.territory).short}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <Settings />
    </main>
  );
}
