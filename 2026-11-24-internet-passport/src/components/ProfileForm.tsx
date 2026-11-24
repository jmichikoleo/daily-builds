// src/components/ProfileForm.tsx
// the explorer details form. used in onboarding (one step at a time) and in
// the profile page (all at once) so editing works the same way as issuing.

import { useState, type ReactNode } from "react";
import type { TerritoryId } from "../types";
import { REGULAR_TERRITORIES } from "../data/territories";
import { resizePhoto } from "../lib/image";
import { Emblem } from "./bits";

export interface ProfileDraft {
  name: string;
  alias: string;
  photo: string | null;
  homeCountry: string;
  favoriteTerritories: TerritoryId[];
  motto: string;
  coverColor: string;
}

export const COVER_COLORS = [
  { hex: "#783B49", name: "passport burgundy" },
  { hex: "#496B8A", name: "postal blue" },
  { hex: "#5E6F55", name: "deep sage" },
  { hex: "#382D29", name: "ink brown" },
  { hex: "#B8616B", name: "rose" },
  { hex: "#2F4A4A", name: "harbour teal" },
];

export const MOTTO_IDEAS = [
  "the long way round is the good way",
  "one more tab",
  "curious, not lost",
  "follow the strange link",
  "slow down and look closer",
];

type Part = "names" | "photo" | "territories" | "motto";

export function ProfileFields({ draft, set, parts }: { draft: ProfileDraft; set: (d: ProfileDraft) => void; parts: Part[] }) {
  const [photoError, setPhotoError] = useState("");
  const [busy, setBusy] = useState(false);

  const blocks: Record<Part, ReactNode> = {
    names: (
      <div className="fields" key="names">
        <label className="field">
          <span>explorer name</span>
          <input
            value={draft.name}
            onChange={(e) => set({ ...draft, name: e.target.value })}
            maxLength={40}
            autoComplete="off"
            placeholder="what should the passport call you"
            required
          />
        </label>
        <label className="field">
          <span>explorer alias <em>optional</em></span>
          <input value={draft.alias} onChange={(e) => set({ ...draft, alias: e.target.value })} maxLength={40} autoComplete="off" placeholder="the tab hoarder" />
        </label>
        <label className="field">
          <span>home country <em>optional</em></span>
          <input value={draft.homeCountry} onChange={(e) => set({ ...draft, homeCountry: e.target.value })} maxLength={40} autoComplete="off" placeholder="anywhere is fine" />
        </label>
      </div>
    ),
    photo: (
      <div className="fields photo-field" key="photo">
        <div className="photo-frame">
          {draft.photo ? <img src={draft.photo} alt="your explorer photograph" /> : <span aria-hidden="true">{draft.name.trim()[0]?.toUpperCase() ?? "?"}</span>}
        </div>
        <div>
          <label className="btn file-btn">
            {draft.photo ? "choose another photo" : "choose a photo"}
            <input
              type="file"
              accept="image/*"
              className="visually-hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setBusy(true);
                setPhotoError("");
                try {
                  set({ ...draft, photo: await resizePhoto(f) });
                } catch (err) {
                  setPhotoError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          {draft.photo && (
            <button type="button" className="btn btn-quiet" onClick={() => set({ ...draft, photo: null })}>
              remove photo
            </button>
          )}
          <p className="muted small">
            {busy ? "developing the photo..." : "the photo is shrunk and kept only in this browser. it is never uploaded anywhere. a drawing or your pet is also allowed."}
          </p>
          {photoError && (
            <p className="error" role="alert">
              {photoError}
            </p>
          )}
        </div>
      </div>
    ),
    territories: (
      <fieldset className="fields" key="territories">
        <legend>favourite internet territories <em>pick up to three, or none</em></legend>
        <div className="territory-picks">
          {REGULAR_TERRITORIES.map((t) => {
            const on = draft.favoriteTerritories.includes(t.id);
            const full = !on && draft.favoriteTerritories.length >= 3;
            return (
              <label key={t.id} className={`territory-pick ${on ? "on" : ""}`} style={{ ["--accent" as string]: t.color }}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={full}
                  onChange={() =>
                    set({
                      ...draft,
                      favoriteTerritories: on ? draft.favoriteTerritories.filter((x) => x !== t.id) : [...draft.favoriteTerritories, t.id],
                    })
                  }
                />
                <Emblem t={t} size={44} />
                <span>
                  <strong>{t.short}</strong>
                  <small>{t.theme}</small>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    ),
    motto: (
      <div className="fields" key="motto">
        <label className="field">
          <span>personal explorer motto <em>optional</em></span>
          <input value={draft.motto} onChange={(e) => set({ ...draft, motto: e.target.value })} maxLength={90} placeholder="a line to live by, or travel by" />
        </label>
        <div className="chips" aria-label="motto ideas">
          {MOTTO_IDEAS.map((m) => (
            <button type="button" className="chip" key={m} onClick={() => set({ ...draft, motto: m })}>
              {m}
            </button>
          ))}
        </div>
        <fieldset className="cover-picks">
          <legend>passport cover colour</legend>
          {COVER_COLORS.map((c) => (
            <label key={c.hex} className={`cover-pick ${draft.coverColor === c.hex ? "on" : ""}`}>
              <input type="radio" name="cover" value={c.hex} checked={draft.coverColor === c.hex} onChange={() => set({ ...draft, coverColor: c.hex })} />
              <span className="cover-swatch" style={{ background: c.hex }} aria-hidden="true" />
              <span>{c.name}</span>
            </label>
          ))}
        </fieldset>
      </div>
    ),
  };

  return <>{parts.map((p) => blocks[p])}</>;
}
