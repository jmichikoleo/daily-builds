// src/pages/Journal.tsx
// the travel journal: postcards about discoveries, newest first, plus the
// "places i want to return to" shelf of saved destinations.

import { useMemo, useState } from "react";
import { usePassport } from "../lib/store";
import { DESTINATIONS, destination } from "../data/destinations";
import { territory } from "../data/territories";
import { isOpen, localDateKey, uid, visitedSet } from "../lib/logic";
import { CatalogStamp, Empty, Modal, Stars } from "../components/bits";
import { DestinationCard } from "../components/DestinationCard";
import { go, href } from "../lib/router";
import { niceDate } from "../lib/format";
import type { JournalEntry } from "../types";

export const JOURNAL_PROMPTS = [
  "what surprised you here?",
  "what did you learn?",
  "what made this destination worth visiting?",
  "would you recommend this place to another explorer?",
];

function Editor({ entry, prompt, onDone }: { entry: JournalEntry; prompt?: string; onDone: () => void }) {
  const { state, saveJournal } = usePassport();
  const [e, setE] = useState<JournalEntry>(() => ({
    ...entry,
    reflection: entry.reflection || (prompt ? `${prompt}\n\n` : ""),
  }));
  const [tagText, setTagText] = useState(entry.tags.join(", "));
  const seen = visitedSet(state);
  const options = useMemo(() => {
    const open = DESTINATIONS.filter((d) => isOpen(state, d));
    return [...open.filter((d) => seen.has(d.id)), ...open.filter((d) => !seen.has(d.id))];
  }, [state, seen]);
  const isNew = !state.journal.some((j) => j.id === entry.id);
  const valid = e.reflection.trim().length > 0 || e.favorite.trim().length > 0;

  return (
    <form
      className="journal-editor paper"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!valid) return;
        saveJournal({
          ...e,
          favorite: e.favorite.trim(),
          reflection: e.reflection.trim(),
          tags: tagText
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
            .slice(0, 12),
        });
        onDone();
      }}
    >
      <h1 className="display">{isNew ? "write a postcard" : "edit postcard"}</h1>
      <div className="fields two">
        <label className="field">
          <span>destination</span>
          <select value={e.destinationId ?? ""} onChange={(ev) => setE({ ...e, destinationId: ev.target.value || null })}>
            <option value="">somewhere on the internet</option>
            <optgroup label="places you have stamped">
              {options
                .filter((d) => seen.has(d.id))
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </optgroup>
            <optgroup label="other destinations">
              {options
                .filter((d) => !seen.has(d.id))
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </optgroup>
          </select>
        </label>
        <label className="field">
          <span>date</span>
          <input type="date" value={e.date} onChange={(ev) => setE({ ...e, date: ev.target.value || localDateKey(new Date()) })} required />
        </label>
      </div>
      <fieldset className="rating">
        <legend>personal rating</legend>
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={n && n <= e.rating ? "on" : ""}>
            <input type="radio" name="rating" value={n} checked={e.rating === n} onChange={() => setE({ ...e, rating: n })} />
            <span aria-hidden="true">{n === 0 ? "none" : "★"}</span>
            <span className="visually-hidden">{n === 0 ? "no rating" : `${n} stars`}</span>
          </label>
        ))}
      </fieldset>
      <label className="field">
        <span>favourite discovery</span>
        <input value={e.favorite} onChange={(ev) => setE({ ...e, favorite: ev.target.value })} maxLength={200} placeholder="the one thing you will remember" />
      </label>
      <label className="field">
        <span>reflection</span>
        <textarea value={e.reflection} onChange={(ev) => setE({ ...e, reflection: ev.target.value })} rows={7} maxLength={6000} placeholder="dear diary, today i went somewhere strange..." />
      </label>
      <div className="chips" aria-label="prompts, tap to add one">
        {JOURNAL_PROMPTS.map((p) => (
          <button type="button" key={p} className="chip" onClick={() => setE({ ...e, reflection: `${e.reflection}${e.reflection && !e.reflection.endsWith("\n") ? "\n\n" : ""}${p}\n` })}>
            {p}
          </button>
        ))}
      </div>
      <label className="field">
        <span>
          personal tags <em>separated by commas</em>
        </span>
        <input value={tagText} onChange={(ev) => setTagText(ev.target.value)} placeholder="rainy day, show mum, bookmark" />
      </label>
      <label className="check">
        <input type="checkbox" checked={e.revisit} onChange={(ev) => setE({ ...e, revisit: ev.target.checked })} />
        i would revisit this website
      </label>
      {!valid && <p className="muted small">write a reflection or a favourite discovery to save the postcard.</p>}
      <div className="row wrap">
        <button type="submit" className="btn btn-primary" disabled={!valid}>
          {isNew ? "keep this postcard" : "save changes"}
        </button>
        <button type="button" className="btn" onClick={onDone}>
          cancel
        </button>
      </div>
    </form>
  );
}

function Postcard({ j, onDelete }: { j: JournalEntry; onDelete: () => void }) {
  const d = j.destinationId ? destination(j.destinationId) : undefined;
  const t = d ? territory(d.territory) : undefined;
  return (
    <article className="postcard" style={{ ["--accent" as string]: t?.color ?? "#FFD1D3" }}>
      <div className="postcard-left">
        <p className="mono small">{niceDate(j.date + "T12:00:00")}</p>
        <h2 className="display">{d ? d.name : "somewhere on the internet"}</h2>
        {j.rating > 0 && <Stars value={j.rating} />}
        {j.favorite && (
          <p>
            <strong>favourite discovery</strong> {j.favorite}
          </p>
        )}
        <p className="handwritten postcard-text">{j.reflection}</p>
        {j.tags.length > 0 && (
          <ul className="tags">
            {j.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}
        {j.revisit && <p className="small revisit">would revisit</p>}
      </div>
      <div className="postcard-right">
        <div className="postcard-stampbox" aria-hidden="true">
          {d ? <CatalogStamp stampId={`dest:${d.id}`} size={84} /> : <span className="handwritten">www</span>}
        </div>
        <div className="postcard-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="row wrap">
          <a className="btn btn-small" href={href(`/journal/edit/${j.id}`)}>
            edit
          </a>
          <button className="btn btn-small btn-quiet" onClick={onDelete}>
            delete
          </button>
        </div>
      </div>
    </article>
  );
}

export function JournalPage({ sub, id, query }: { sub?: string; id?: string; query: Record<string, string> }) {
  const { state, deleteJournal } = usePassport();
  const [confirmDelete, setConfirmDelete] = useState<JournalEntry | null>(null);
  const tab = sub === "saved" ? "saved" : "postcards";

  if (sub === "new" || (sub === "edit" && id)) {
    const existing = sub === "edit" ? state.journal.find((j) => j.id === id) : undefined;
    if (sub === "edit" && !existing) {
      return (
        <main id="main" className="page" tabIndex={-1}>
          <Empty title="that postcard is gone">
            <a className="btn" href={href("/journal")}>
              back to the journal
            </a>
          </Empty>
        </main>
      );
    }
    const dest = query.dest && destination(query.dest) ? query.dest : null;
    const blank: JournalEntry = {
      id: uid(),
      destinationId: dest,
      date: localDateKey(new Date()),
      rating: 0,
      favorite: "",
      reflection: "",
      tags: [],
      revisit: false,
      createdAt: "",
      updatedAt: "",
    };
    return (
      <main id="main" className="page narrow" tabIndex={-1}>
        <a className="back" href={href("/journal")}>
          back to the journal
        </a>
        <Editor key={existing?.id ?? "new"} entry={existing ?? blank} prompt={existing ? undefined : query.prompt} onDone={() => go("/journal")} />
      </main>
    );
  }

  const entries = [...state.journal].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const saved = state.favorites.map((f) => destination(f)).filter((d): d is NonNullable<typeof d> => Boolean(d));

  return (
    <main id="main" className="page" tabIndex={-1}>
      <header className="page-head">
        <p className="kicker">travel journal</p>
        <h1 className="display big">postcards from the internet</h1>
        <p className="lede">a scrapbook of what you found, what surprised you and where you want to go back.</p>
        <div className="row wrap">
          <a className="btn btn-primary" href={href("/journal/new")}>
            write a postcard
          </a>
          <div className="segmented" role="group" aria-label="journal view">
            <a href={href("/journal")} aria-current={tab === "postcards" ? "page" : undefined}>
              postcards ({entries.length})
            </a>
            <a href={href("/journal/saved")} aria-current={tab === "saved" ? "page" : undefined}>
              places i want to return to ({saved.length})
            </a>
          </div>
        </div>
      </header>

      {tab === "postcards" ? (
        entries.length === 0 ? (
          <Empty title="no postcards yet">
            <p>after a visit, jot down what you found. three postcards and a certain library may open its doors.</p>
            <a className="btn" href={href("/journal/new")}>
              write the first one
            </a>
          </Empty>
        ) : (
          <div className="postcards">
            {entries.map((j) => (
              <Postcard key={j.id} j={j} onDelete={() => setConfirmDelete(j)} />
            ))}
          </div>
        )
      ) : saved.length === 0 ? (
        <Empty title="nothing saved yet">
          <p>tap the bookmark on any destination to keep it here for later.</p>
          <a className="btn" href={href("/atlas")}>
            browse the atlas
          </a>
        </Empty>
      ) : (
        <div className="cards">
          {saved.map((d) => (
            <DestinationCard key={d.id} d={d} />
          ))}
        </div>
      )}

      {confirmDelete && (
        <Modal title="delete this postcard?" onClose={() => setConfirmDelete(null)}>
          <p>the postcard from {niceDate(confirmDelete.date + "T12:00:00")} will be removed from your journal. your stamps stay where they are. this cannot be undone.</p>
          <div className="row">
            <button
              className="btn btn-danger"
              onClick={() => {
                deleteJournal(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              delete it
            </button>
            <button className="btn" onClick={() => setConfirmDelete(null)}>
              keep it
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
