// frontend/src/pages/Unknown.tsx: the hidden room for what the records cannot explain.
// answers and memories are stored as your own words and flow into the library and the archive.
import { useState } from "react";
import { api } from "../api";
import { day, month, useData } from "../hooks";
import { Back, Loading } from "../App";

export default function Unknown() {
  const { data, reload } = useData("/api/unknown");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState("");
  const [err, setErr] = useState("");
  if (!data) return <Loading what="the unknown room" />;
  const open = data.questions.filter((q: any) => !q.answer);
  const done = data.questions.filter((q: any) => q.answer);

  async function addMemory(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/api/memories", { title, body, date: date || null });
      setTitle(""); setBody(""); setDate("");
      reload();
    } catch (x: any) { setErr(x.message); }
  }

  return (
    <div className="unknown page">
      <Back />
      <header className="page-head">
        <p className="eyebrow">you found the unknown room</p>
        <h1>everything the data cannot explain</h1>
        <p className="lede">a digital footprint is a shadow, not a person. this room keeps the gaps, the contradictions and the questions only you can answer. whatever you write here becomes part of the universe, marked as your own words.</p>
      </header>

      <section>
        <h2 className="section-title">questions on the wall</h2>
        <div className="notes-wall">
          {open.map((q: any, i: number) => <Question key={q.key} q={q} i={i} onDone={reload} />)}
          {!open.length && <p className="muted">every question here has an answer. new ones appear as the records grow.</p>}
        </div>
      </section>

      <section className="memory-desk">
        <h2 className="section-title">write down a memory</h2>
        <form className="stack" onSubmit={addMemory}>
          <input placeholder="a title, if it has one" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="memory title" />
          <textarea rows={5} placeholder="something that happened, that no app ever saw" value={body} onChange={(e) => setBody(e.target.value)} aria-label="memory" required />
          <label className="row small">when, roughly <input type="month" value={date} onChange={(e) => setDate(e.target.value)} aria-label="month of the memory" /></label>
          {err && <p className="error">{err}</p>}
          <button className="btn">keep this memory</button>
        </form>
      </section>

      {data.memories.length > 0 && (
        <section>
          <h2 className="section-title">memories outside the records</h2>
          <ul className="memories">
            {data.memories.map((m: any) => (
              <li key={m.id}>
                <span className="muted small">{m.date ? month(m.date.slice(0, 7)) : "undated"}{m.question_key ? ", an answer" : ""}</span>
                {m.title && <strong>{m.title}</strong>}
                <p>{m.body}</p>
                <button className="link small" onClick={async () => { if (confirm("delete this memory? it cannot be undone.")) { await api.del(`/api/memories/${m.id}`); reload(); } }}>delete</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.gaps.length > 0 && (
        <section>
          <h2 className="section-title">missing periods</h2>
          <ul className="plain">{data.gaps.map((g: any) => <li key={g.key}>{month(g.start)} to {month(g.end)}, {g.months} months with no records at all</li>)}</ul>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h2 className="section-title">answered</h2>
          <ul className="plain">{done.map((q: any) => <li key={q.key}><strong>{q.prompt}</strong><br /><span>{q.answer.body}</span> <span className="muted small">{day(q.answer.created_at.slice(0, 10))}</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}

function Question({ q, i, onDone }: { q: any; i: number; onDone: () => void }) {
  const [a, setA] = useState("");
  const [open, setOpen] = useState(false);
  const dateGuess = q.key.match(/(\d{4}-\d{2})/)?.[1];
  return (
    <div className="pinned-note" style={{ ["--r" as any]: `${(i % 5) - 2}deg` }}>
      <span className="note-kind">{q.kind}</span>
      <p className="note-q">{q.prompt}</p>
      <p className="muted small">{q.context}</p>
      {open ? (
        <form className="stack" onSubmit={async (e) => { e.preventDefault(); if (!a.trim()) return; await api.post("/api/memories", { body: a, question_key: q.key, title: q.prompt, date: dateGuess || null }); onDone(); }}>
          <textarea rows={3} value={a} onChange={(e) => setA(e.target.value)} aria-label={`answer to ${q.prompt}`} autoFocus />
          <div className="row"><button className="btn small">keep the answer</button><button type="button" className="link" onClick={() => setOpen(false)}>not now</button></div>
        </form>
      ) : (
        <button className="link" onClick={() => setOpen(true)}>answer</button>
      )}
    </div>
  );
}
