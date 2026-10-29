"use client";

// "How you come across": what Onairos read from the apps someone connected. On your own page
// it's yours, with the one suggested action under it; on a resident's page it's theirs, only
// because they chose to share it. The archetype, the summary, the strengths as a chart (each
// one's strength within its own trait, never compared with anyone; tap for where it showed),
// why those strengths, and how much Onairos saw.

import { useState } from "react";
import { coverageLine, type OnairosNormalized } from "@/contract/residency";
import { ART_SRC } from "@/data/mira";
import Glass from "../f/Glass";
import { haptic } from "../f/ui";
import { Band } from "./Painted";

const PAINT = { backgroundImage: `url(${ART_SRC.dusk})`, backgroundSize: "400% 1200%", backgroundPosition: "40% 55%" };

// Strengths the way Health draws a week: the selected one large on top with where it showed,
// tall rounded bars on faint gridlines below. Tap a bar to select it; it takes the painting,
// the rest stay soft. Each value is that trait's own strength, out of 100.
function StrengthsChart({ top, mine, p }: { top: OnairosNormalized["positive"]; mine: boolean; p: OnairosNormalized }) {
  const [pick, setPick] = useState(top[0].name);
  const t = top.find((x) => x.name === pick) ?? top[0];
  const H = 168;
  return (
    <figure className="mt-2 rounded-[28px] bg-paper p-5" style={{ boxShadow: "var(--lift-1)" }}>
      <figcaption className="t-meta text-ink-3">Strengths</figcaption>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="t-large tabular-nums text-ink">{t.strength}</span>
        <span className="t-label text-ink-3">of 100</span>
      </div>
      <p className="t-body font-semibold text-ink">{t.name}</p>
      <p className="mt-1 min-h-[40px] t-label text-ink-2">{t.evidence ?? (t.name === top[0].name ? `Shows up most ${mine ? "in what you do" : "for them"}.` : "")}</p>

      <div className="relative mt-5" style={{ height: H }} role="group" aria-label="Strengths chart">
        {[100, 50, 0].map((v) => (
          <div key={v} className="pointer-events-none absolute inset-x-0 flex items-center gap-2" style={{ top: `${((100 - v) / 100) * H - 8}px` }} aria-hidden>
            <span className="h-px flex-1" style={{ backgroundImage: "linear-gradient(to right, rgb(28 27 26 / 0.12) 50%, transparent 0)", backgroundSize: "6px 1px" }} />
            <span className="w-6 text-right t-meta tabular-nums text-ink-4">{v}</span>
          </div>
        ))}
        <div className="absolute inset-y-0 left-0 right-8 flex items-end justify-around gap-2">
          {top.map((x) => {
            const on = x.name === t.name;
            return (
              <button key={x.name} type="button" aria-pressed={on} aria-label={`${x.name}, ${x.strength} of 100`} onClick={() => (haptic(), setPick(x.name))} className="flex h-full max-w-[48px] flex-1 items-end justify-center">
                <span className="block w-full rounded-[10px] transition-[background-color,opacity] duration-200" style={{ height: `${Math.max(4, x.strength)}%`, ...(on ? PAINT : { background: "#e6e3df" }) }} />
              </button>
            );
          })}
        </div>
      </div>
      <div className="mr-8 mt-2 flex justify-around gap-2" aria-hidden>
        {top.map((x) => (
          <span key={x.name} className={`max-w-[64px] flex-1 text-center t-meta leading-tight ${x.name === t.name ? "font-medium text-ink" : "text-ink-3"}`}>
            {x.name}
          </span>
        ))}
      </div>

      {p.explanation && (
        <div className="mt-5 rounded-[20px] bg-fill px-4 py-3">
          <p className="t-meta text-ink-3">Why these strengths</p>
          <p className="mt-1 t-body text-ink">{p.explanation}</p>
        </div>
      )}
      <p className="mt-4 t-meta text-ink-3">
        Each value is how strongly it showed {mine ? "in your apps" : "in their apps"}, never a comparison with anyone. {coverageLine(p)}
      </p>
      <table className="sr-only">
        <caption>Strengths</caption>
        <tbody>
          {top.map((x) => (
            <tr key={x.name}>
              <th>{x.name}</th>
              <td>{x.strength} of 100</td>
            </tr>
          ))}
        </tbody>
      </table>
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

      {top.length > 0 && <StrengthsChart top={top} mine={mine} p={p} />}

      {children}
    </section>
  );
}
