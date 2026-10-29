"use client";

// "How you come across": what Onairos read from the apps someone connected. On your own page
// it's yours, with the one suggested action under it; on a resident's page it's theirs, only
// because they chose to share it. The archetype, the summary, the strengths as a chart (each
// one's strength within its own trait, never compared with anyone; tap for where it showed),
// why those strengths, and how much Onairos saw.

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { coverageLine, type OnairosNormalized } from "@/contract/residency";
import { ART_SRC } from "@/data/mira";
import Glass from "../f/Glass";
import { I, SPRING, haptic } from "../f/ui";
import { Band } from "./Painted";

const PAINT = { backgroundImage: `url(${ART_SRC.dusk})`, backgroundSize: "400% 1200%", backgroundPosition: "40% 55%" };
const GREYS = ["#c9c6c1", "#e2e0dc"];

export default function Traits({ p, who, children }: { p: OnairosNormalized; who?: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
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

      {top.length > 0 && (
        <figure className="mt-2 rounded-[28px] bg-paper p-5" style={{ boxShadow: "var(--lift-1)" }}>
          <figcaption className="t-meta text-ink-3">Strengths · {top.length} Onairos found</figcaption>
          <p className="mt-1 t-body font-semibold text-ink">{top[0].name} shows up most{mine ? " in what you do" : ""}.</p>
          <ul className="mt-4 flex flex-col gap-3">
            {top.map((t, i) => {
              const on = open === t.name;
              return (
                <li key={t.name}>
                  <button type="button" aria-expanded={on} disabled={!t.evidence} onClick={() => (haptic(), setOpen(on ? null : t.name))} className="press block w-full text-left">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="flex items-center gap-1 t-label text-ink">
                        {t.name}
                        {t.evidence && (
                          <span className={`text-ink-4 ${on ? "rotate-90" : ""}`} style={{ transition: "rotate 200ms" }}>
                            <I.Chevron size={13} />
                          </span>
                        )}
                      </span>
                      <span className="t-num text-ink">{t.strength}</span>
                    </span>
                    <span className="mt-[6px] block h-2 w-full rounded-[4px] bg-fill" aria-hidden>
                      <span className="block h-full rounded-[4px]" style={{ width: `${Math.max(6, t.strength)}%`, ...(i === 0 ? PAINT : { background: GREYS[(i - 1) % 2] }) }} />
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {on && t.evidence && (
                      <motion.p className="overflow-hidden t-label text-ink-2" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING.ui}>
                        <span className="block pt-2">{t.evidence}</span>
                      </motion.p>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
          {p.explanation && (
            <div className="mt-4 rounded-[20px] bg-fill px-4 py-3">
              <p className="t-meta text-ink-3">Why these strengths</p>
              <p className="mt-1 t-body text-ink">{p.explanation}</p>
            </div>
          )}
          <p className="mt-4 t-meta text-ink-3">
            Each number is how strongly it showed {mine ? "in your apps" : "in their apps"}, out of 100, never a comparison with anyone. {coverageLine(p)}
          </p>
          <table className="sr-only">
            <caption>Strengths</caption>
            <tbody>
              {top.map((t) => (
                <tr key={t.name}>
                  <th>{t.name}</th>
                  <td>{t.strength} of 100</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      )}

      {children}
    </section>
  );
}
