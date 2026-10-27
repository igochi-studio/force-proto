"use client";

// Who Force thinks you are, after three answers and your links. Short enough to read in one
// go: what it heard in your words, how you show up (from Onairos), what it found online, and
// one or two moves. Every part can be corrected: edit a line, say "not me" to a namesake,
// add what it missed. Then you tell it how close it got.

import { useState } from "react";
import { MOVES, TRAITS } from "@/data/residency";
import { f } from "@/lib/f/store";
import { r, useR, type Fit } from "@/lib/f/residency";
import Nav from "../f/Nav";
import { I, haptic } from "../f/ui";
import { Primary } from "./Onboarding";

const card = { boxShadow: "var(--lift-1)" };

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="px-1 t-title text-ink">{title}</h2>
      {note && <p className="mt-1 px-1 t-label text-ink-3">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

// On a white card it's grey; on a grey card it's white.
function Small({ children, onClick, ink, paper }: { children: React.ReactNode; onClick: () => void; ink?: boolean; paper?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`press hit flex h-8 items-center gap-1 rounded-full px-3 t-label font-medium ${ink ? "bg-ink text-paper" : paper ? "bg-paper text-ink" : "bg-fill text-ink"}`}>
      {children}
    </button>
  );
}

function PointRow({ id, text, why }: { id: string; text: string; why: string }) {
  const [edit, setEdit] = useState<string | null>(null);
  return (
    <li className="px-4 py-4">
      {edit === null ? (
        <>
          <p className="t-body text-ink">{text}</p>
          <p className="mt-1 t-label text-ink-3">{why}</p>
          <div className="mt-3 flex gap-2">
            <Small onClick={() => setEdit(text)}>
              <I.Edit size={14} /> Edit
            </Small>
            <Small
              onClick={() => {
                haptic();
                r.dropPoint(id);
                f.toast("Removed. Force won't use it.");
              }}
            >
              <I.Close size={14} /> Not me
            </Small>
          </div>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (edit.trim()) r.editPoint(id, edit.trim());
            setEdit(null);
          }}
        >
          <textarea value={edit} onChange={(e) => setEdit(e.target.value)} autoFocus rows={3} aria-label="Edit this line" className="block w-full resize-none rounded-[18px] bg-fill px-4 py-3 t-body text-ink outline-none" />
          <div className="mt-3 flex gap-2">
            <button type="submit" className="press hit flex h-8 items-center gap-1 rounded-full bg-ink px-3 t-label font-medium text-paper">
              <I.Check size={14} /> Save
            </button>
            <Small onClick={() => setEdit(null)}>Cancel</Small>
          </div>
        </form>
      )}
    </li>
  );
}

const FITS: { k: Fit; label: string }[] = [
  { k: "spot", label: "Spot on" },
  { k: "mostly", label: "Mostly" },
  { k: "no", label: "Not really" },
];

export default function Persona({ onDone }: { onDone?: () => void }) {
  const { name, points, found, removed, moves, fit, onairos } = useR();
  const [own, setOwn] = useState("");
  const shown = found.filter((x) => !removed.includes(x.id));
  const first = name.trim().split(/\s+/)[0];

  return (
    <div className={`px-4 pb-6 ${onDone ? "" : "relative h-full overflow-y-auto no-scrollbar pt-[56px]"}`}>
      {!onDone && <Nav title="You" />}
      <header className="px-1 pt-6">
        <h1 className="t-large text-ink">{onDone ? "Here's who Force thinks you are" : first || "Your persona"}</h1>
        <p className="mt-2 t-body text-ink-3">Read from your three answers, your links and what&apos;s public. Edit or remove anything that isn&apos;t you, and Force learns from it.</p>
      </header>

      <Section title="In your words">
        <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-[28px] bg-paper" style={card}>
          {points.map((p) => (
            <PointRow key={p.id} {...p} />
          ))}
          <li className="px-4 py-3">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                r.addPoint(own);
                setOwn("");
              }}
            >
              <I.Plus size={18} className="shrink-0 text-ink-3" />
              <input value={own} onChange={(e) => setOwn(e.target.value)} placeholder="Add something Force missed" aria-label="Add something Force missed" enterKeyHint="done" className="h-10 min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-ink-3" />
              {own.trim() && (
                <button type="submit" aria-label="Add" className="press grid h-8 w-8 place-items-center rounded-full bg-ink text-paper">
                  <I.Up size={16} />
                </button>
              )}
            </form>
          </li>
        </ul>
      </Section>

      {onairos === "on" && (
        <Section title="How you show up" note="Onairos, from the apps you connected">
          <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-[28px] bg-paper" style={card}>
            {TRAITS.map((t) => (
              <li key={t.name} className="px-4 py-3">
                <p className="t-label text-ink-3">{t.name}</p>
                <p className="mt-[2px] t-body text-ink">{t.read}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Found online" note="If any of it is someone else with your name, tap Not me.">
        <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-[28px] bg-paper" style={card}>
          {shown.map((x) => (
            <li key={x.id} className="flex items-start gap-3 px-4 py-4">
              <span className="min-w-0 flex-1">
                <span className="block t-label text-ink-3">
                  {x.source}
                  {x.byName && " · found by your name"}
                </span>
                <span className="mt-[2px] block t-body text-ink">{x.text}</span>
              </span>
              <Small
                onClick={() => {
                  haptic();
                  r.notMe(x.id);
                }}
              >
                Not me
              </Small>
            </li>
          ))}
          {!shown.length && <li className="px-4 py-4 t-body text-ink-3">Nothing left. Force will go by your answers.</li>}
        </ul>
        {removed.length > 0 && (
          <button type="button" onClick={() => r.undoNotMe()} className="press mt-2 flex h-11 items-center px-2 t-label text-ink-2">
            {removed.length} removed · Undo
          </button>
        )}
      </Section>

      <Section title="One or two moves" note="Keep one and Force will nudge you. Let go of the rest.">
        <ul className="flex flex-col gap-2">
          {MOVES.map((m, i) => {
            const v = moves[m];
            return (
              <li key={m} className="flex gap-3 rounded-[28px] bg-fill p-4" style={{ opacity: v === "dropped" ? 0.45 : 1 }}>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-paper t-label font-medium text-ink">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block t-body text-ink">{m}</span>
                  <span className="mt-3 flex gap-2">
                    {v ? (
                      <span className="flex h-8 items-center gap-1 t-label text-ink-2">
                        {v === "kept" ? (
                          <>
                            <I.Check size={14} /> Kept
                          </>
                        ) : (
                          "Let go"
                        )}
                        <button type="button" onClick={() => r.move(m, v === "kept" ? "dropped" : "kept")} className="press ml-2 h-8 px-1 t-label text-ink-3 underline underline-offset-2">
                          Change
                        </button>
                      </span>
                    ) : (
                      <>
                        <Small
                          ink
                          onClick={() => {
                            haptic("done");
                            r.move(m, "kept");
                            f.keepMove(m);
                          }}
                        >
                          Keep
                        </Small>
                        <Small paper onClick={() => (r.move(m, "dropped"), f.dropMove(m))}>
                          Let go
                        </Small>
                      </>
                    )}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="How close is this?">
        <div className="flex gap-2">
          {FITS.map((x) => (
            <button key={x.k} type="button" onClick={() => (haptic(), r.setFit(x.k))} aria-pressed={fit === x.k} className={`press h-11 flex-1 rounded-full t-body ${fit === x.k ? "chip-on" : "chip"}`}>
              {x.label}
            </button>
          ))}
        </div>
        {fit && fit !== "spot" && <p className="mt-3 px-1 t-label text-ink-3">Thank you. Edit the lines above that are off; Force will ask again after a few conversations.</p>}
      </Section>

      {onDone && (
        <div className="mt-8">
          <Primary onClick={onDone}>
            {fit === "no" ? "Continue anyway" : "This is me"} <I.Arrow size={18} />
          </Primary>
        </div>
      )}
    </div>
  );
}
