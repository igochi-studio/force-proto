"use client";

// "How you come across": what Onairos read from the apps someone connected. On your own page
// it's yours, with the one suggested action under it; on a resident's page it's theirs, only
// because they chose to share it. The archetype, the summary, the strengths by name (no
// scores), why those strengths, and what Onairos read: how much, and from where.

import { useState } from "react";
import type { OnairosNormalized } from "@/contract/residency";
import { ART_SRC } from "@/data/mira";
import Glass from "../f/Glass";
import { haptic } from "../f/ui";
import { Band, cropOf } from "./Painted";

const PAINT = { backgroundImage: `url(${ART_SRC.dusk})`, backgroundSize: "400% 1200%", backgroundPosition: "40% 55%" };

// Strengths by name only, strongest first: the team doesn't show Onairos's numbers. Each is
// a painted tile; tap one for where it showed when Onairos says.
function Strengths({ top, mine, p }: { top: OnairosNormalized["positive"]; mine: boolean; p: OnairosNormalized }) {
  const [pick, setPick] = useState<string | null>(null);
  const t = top.find((x) => x.name === pick);
  return (
    <div className="mt-2 rounded-[28px] bg-paper p-5" style={{ boxShadow: "var(--lift-1)" }}>
      <p className="t-meta text-ink-3">{mine ? "Your strengths" : "Strengths"} · strongest first</p>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {top.map((x, i) => {
          const [art, cx, cy] = cropOf(i);
          const on = pick === x.name;
          return (
            <li key={x.name}>
              <button type="button" aria-pressed={on} disabled={!x.evidence} onClick={() => (haptic(), setPick(on ? null : x.name))} className="press flex h-full w-full flex-col overflow-hidden rounded-[20px] bg-fill text-left">
                <span className="block h-12 bg-cover" style={{ backgroundImage: `url(${ART_SRC[art]})`, backgroundPosition: `${cx}% ${cy}%`, backgroundSize: "300%" }} aria-hidden />
                <span className="block px-3 pb-3 pt-2 t-label font-medium leading-snug text-ink">{x.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {t?.evidence && <p className="mt-3 rounded-[16px] bg-fill px-3 py-2 t-label text-ink-2">{t.evidence}</p>}
      {p.explanation && (
        <div className="mt-4 rounded-[20px] bg-fill px-4 py-3">
          <p className="t-meta text-ink-3">Why these strengths</p>
          <p className="mt-1 t-body text-ink">{p.explanation}</p>
        </div>
      )}
    </div>
  );
}

// What Onairos actually read: how much of the data, and what each platform showed. A meter,
// because it's about the data, not a measure of the person.
function WhatItRead({ p, mine }: { p: OnairosNormalized; mine: boolean }) {
  const c = p.coverage;
  const share = c.sampled != null && c.analyzed ? c.sampled / c.analyzed : c.label ? parseFloat(c.label) / 100 : null;
  if (share == null && !p.sources?.length) return null;
  return (
    <figure className="mt-2 rounded-[28px] bg-paper p-5" style={{ boxShadow: "var(--lift-1)" }}>
      <figcaption className="t-meta text-ink-3">What Onairos read</figcaption>
      {share != null && (
        <>
          <p className="mt-1 t-body font-semibold text-ink">
            {c.sampled != null && c.analyzed != null ? `${c.sampled.toLocaleString("en")} of ${mine ? "your" : "their"} ${c.analyzed.toLocaleString("en")} items` : `${Math.round(share * 100)}% of ${mine ? "your" : "their"} data`}
          </p>
          <div className="mt-3 h-3 w-full rounded-[6px] bg-fill" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} aria-label="How much Onairos read">
            <div className="h-full rounded-[6px]" style={{ width: `${Math.max(4, Math.min(100, share * 100))}%`, ...PAINT }} />
          </div>
          <p className="mt-2 t-meta text-ink-3">{c.label ?? `${Math.round(share * 100)}%`} coverage · a read from a sample, so it can be wrong</p>
        </>
      )}
      {!!p.sources?.length && (
        <ul className="mt-4 flex flex-col">
          {p.sources.map((x, i) => (
            <li key={x.platform} className={`flex gap-3 py-3 ${i ? "border-t border-[var(--fill)]" : ""}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fill t-label font-semibold text-ink-2" aria-hidden>
                {x.platform[0]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block t-label font-medium text-ink">{x.platform}</span>
                <span className="block t-label text-ink-2">{x.summary}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

export default function Traits({ p, who, children }: { p: OnairosNormalized; who?: string; children?: React.ReactNode }) {
  const top = p.positive.slice(0, 5);
  if (!p.archetype && !p.summary && !top.length) return null;
  const mine = !who;
  return (
    <section className="mt-8">
      <h3 className="mb-3 flex items-center gap-2 px-1 t-body font-medium text-ink">
        <Glass size={26} art="dusk" x={40} y={55} zoom={300} /> {mine ? "How you come across" : `How ${who} comes across`}
        <span className="t-meta font-normal text-ink-3">{p.fixture ? "Onairos · sample data" : "Onairos"}</span>
      </h3>
      <div className="overflow-hidden rounded-[28px] bg-paper" style={{ boxShadow: "var(--lift-1)" }}>
        <div className="relative">
          <Band art="dusk" h={88} />
          <span className="absolute -bottom-6 left-5">
            <Glass size={52} art="dusk" x={40} y={55} zoom={320} />
          </span>
        </div>
        <div className="px-5 pb-5 pt-9">
          {p.archetype && (
            <>
              <p className="t-meta text-ink-3">{mine ? "Your archetype" : "Archetype"}</p>
              <p className="mt-1 t-title text-ink">The {p.archetype.replace(/^the\s+/i, "")}</p>
            </>
          )}
          {p.summary && <p className={`${p.archetype ? "mt-3" : ""} t-body text-ink-2`}>{p.summary}</p>}
        </div>
      </div>

      {top.length > 0 && <Strengths top={top} mine={mine} p={p} />}
      <WhatItRead p={p} mine={mine} />

      {children}
    </section>
  );
}
