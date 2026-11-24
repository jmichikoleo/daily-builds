// src/pages/Onboarding.tsx
// the passport issuance desk. five short steps and an animated issuing.

import { useEffect, useMemo, useState } from "react";
import { usePassport, useReducedMotion } from "../lib/store";
import { classify, makePassportNumber } from "../lib/logic";
import { ProfileFields, type ProfileDraft } from "../components/ProfileForm";
import { ClosedPassport, CoverEmblem } from "../components/bits";
import { niceDate } from "../lib/format";
import { go } from "../lib/router";
import type { ExplorerProfile } from "../types";

const STEPS = ["welcome", "names", "photo", "territories", "motto", "review"] as const;

export function Onboarding() {
  const { issue } = usePassport();
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [issuing, setIssuing] = useState<ExplorerProfile | null>(null);
  const [phase, setPhase] = useState(0);
  const passportNumber = useMemo(() => makePassportNumber(), []);
  const [draft, setDraft] = useState<ProfileDraft>({
    name: "",
    alias: "",
    photo: null,
    homeCountry: "",
    favoriteTerritories: [],
    motto: "",
    coverColor: "#783B49",
  });

  const name = STEPS[step];
  const canNext = name !== "names" || draft.name.trim().length > 0;

  useEffect(() => {
    document.getElementById("step-heading")?.focus();
  }, [step, issuing]);

  // the issuing sequence: open book, type the details, stamp, close
  useEffect(() => {
    if (!issuing) return;
    if (reduced) {
      setPhase(4);
      return;
    }
    const timers = [600, 1700, 2600, 3500].map((ms, i) => setTimeout(() => setPhase(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [issuing, reduced]);

  if (issuing) {
    return (
      <main id="main" className="onboarding issuing" aria-live="polite">
        <h1 id="step-heading" tabIndex={-1} className="visually-hidden">
          issuing your passport
        </h1>
        <div className={`issue-stage phase-${phase}`}>
          {phase < 3 ? (
            <div className="issue-page paper">
              <p className="kicker">department of internet exploration, issuing desk</p>
              <div className="issue-id">
                <div className="photo-frame small">{issuing.photo ? <img src={issuing.photo} alt="" /> : <span>{issuing.name[0]?.toUpperCase()}</span>}</div>
                <dl>
                  <dt>name</dt>
                  <dd className="type-in">{issuing.name}</dd>
                  <dt>passport no.</dt>
                  <dd className="type-in delay">{issuing.passportNumber}</dd>
                  <dt>class</dt>
                  <dd className="type-in delay2">{issuing.classification}</dd>
                </dl>
              </div>
              {phase >= 2 && <div className="issued-mark" aria-hidden="true">issued</div>}
            </div>
          ) : (
            <div className="issue-closed">
              <ClosedPassport color={issuing.coverColor} name={issuing.name} number={issuing.passportNumber} />
            </div>
          )}
        </div>
        <p className="issue-caption">
          {phase < 2 ? "typing your details..." : phase < 3 ? "approved and stamped" : "your passport is ready"}
        </p>
        {phase >= 4 && (
          <button
            className="btn btn-primary btn-big"
            onClick={() => {
              issue(issuing);
              go("/");
            }}
            autoFocus
          >
            walk into the departure hall
          </button>
        )}
      </main>
    );
  }

  return (
    <main id="main" className="onboarding">
      <div className="desk paper">
        <header className="desk-head">
          <CoverEmblem />
          <div>
            <p className="kicker">the department of internet exploration</p>
            <p className="muted small">
              passport issuing desk, step {step + 1} of {STEPS.length}
            </p>
          </div>
        </header>

        <ol className="steps" aria-label="steps">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? "now" : i < step ? "done" : ""} aria-current={i === step ? "step" : undefined}>
              <span className="visually-hidden">{s}</span>
            </li>
          ))}
        </ol>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canNext) return;
            if (step < STEPS.length - 1) setStep(step + 1);
            else
              setIssuing({
                ...draft,
                name: draft.name.trim(),
                alias: draft.alias.trim(),
                homeCountry: draft.homeCountry.trim(),
                motto: draft.motto.trim(),
                passportNumber,
                issuedAt: new Date().toISOString(),
                classification: classify(draft.favoriteTerritories),
              });
          }}
        >
          {name === "welcome" && (
            <>
              <h1 id="step-heading" tabIndex={-1} className="display big">
                the internet is a world worth exploring.
              </h1>
              <p className="lede">
                welcome, traveller. before you go anywhere you will need a passport. it takes a minute. you will collect stamps from strange, lovely and
                useful corners of the web, find hidden places and keep a journal of what you saw.
              </p>
              <p className="muted small">
                this is a fictional travel document, a collectible for fun. it is not an official identity document of any kind. everything stays in this
                browser.
              </p>
            </>
          )}
          {name === "names" && (
            <>
              <h1 id="step-heading" tabIndex={-1} className="display">
                who is travelling?
              </h1>
              <ProfileFields draft={draft} set={setDraft} parts={["names"]} />
            </>
          )}
          {name === "photo" && (
            <>
              <h1 id="step-heading" tabIndex={-1} className="display">
                a photograph for the identity page
              </h1>
              <ProfileFields draft={draft} set={setDraft} parts={["photo"]} />
            </>
          )}
          {name === "territories" && (
            <>
              <h1 id="step-heading" tabIndex={-1} className="display">
                where do you like to wander?
              </h1>
              <ProfileFields draft={draft} set={setDraft} parts={["territories"]} />
            </>
          )}
          {name === "motto" && (
            <>
              <h1 id="step-heading" tabIndex={-1} className="display">
                a motto and a cover
              </h1>
              <ProfileFields draft={draft} set={setDraft} parts={["motto"]} />
            </>
          )}
          {name === "review" && (
            <>
              <h1 id="step-heading" tabIndex={-1} className="display">
                check your details
              </h1>
              <div className="review">
                <div className="photo-frame">{draft.photo ? <img src={draft.photo} alt="your explorer photograph" /> : <span aria-hidden="true">{draft.name[0]?.toUpperCase()}</span>}</div>
                <dl className="review-list">
                  <dt>name</dt>
                  <dd>{draft.name}</dd>
                  <dt>alias</dt>
                  <dd>{draft.alias || "none"}</dd>
                  <dt>home</dt>
                  <dd>{draft.homeCountry || "the internet"}</dd>
                  <dt>passport no.</dt>
                  <dd className="mono">{passportNumber}</dd>
                  <dt>date of issue</dt>
                  <dd>{niceDate(new Date())}</dd>
                  <dt>classification</dt>
                  <dd>{classify(draft.favoriteTerritories)}</dd>
                  <dt>motto</dt>
                  <dd>{draft.motto || "none yet"}</dd>
                </dl>
              </div>
              <p className="muted small">you can change all of this later from your explorer profile.</p>
            </>
          )}

          <div className="row desk-actions">
            {step > 0 && (
              <button type="button" className="btn" onClick={() => setStep(step - 1)}>
                back
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={!canNext}>
              {step === 0 ? "start my application" : step === STEPS.length - 1 ? "issue my passport" : "next"}
            </button>
          </div>
          {name === "names" && !canNext && <p className="muted small">a name is the only thing the passport needs.</p>}
        </form>
      </div>
    </main>
  );
}
