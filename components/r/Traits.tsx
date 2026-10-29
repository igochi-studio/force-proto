"use client";

// "How you come across": what Onairos read from the apps you connected, on your own page
// only. The archetype first, the summary, the strengths you can open to see what they were
// read from, why those strengths, and how much Onairos actually saw. In words, no numbers;
// each strength's bar is how strongly it showed in your own apps, never a comparison with
// anyone. Its suggestion, when it fits, is your next step below. Never in the graph.

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { coverageLine, type OnairosNormalized } from "@/contract/residency";
import { ART_SRC } from "@/data/mira";
import Glass from "../f/Glass";
import { I, SPRING, haptic } from "../f/ui";
import { Band } from "./Painted";

const PAINT = { backgroundImage: `url(${ART_SRC.dusk})`, backgroundSize: "400% 1200%", backgroundPosition: "40% 55%" };

export default function Traits({ p, nudged, step }: { p: OnairosNormalized; nudged: boolean; step?: { text: string; why: string } | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const top = p.positive.slice(0, 5);
  if (!p.archetype && !p.summary && !top.length) return null;
  return (
    <section className="mt-8">
      <h3 className="mb-3 flex items-center gap-2 px-1 t-body font-medium text-ink">
        <Glass size={26} art="dusk" x={40} y={55} zoom={300} /> How you come across
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
              <p className="t-meta text-ink-3">Your archetype</p>
              <p className="mt-1 t-title text-ink">The {p.archetype.replace(/^the\s+/i, "")}</p>
            </>
          )}
          {p.summary && <p className={`${p.archetype ? "mt-3" : ""} t-body text-ink-2`}>{p.summary}</p>}

          {top.length > 0 && (
            <>
              <p className="mt-6 t-meta text-ink-3">Strengths · tap one to see where it showed</p>
              <ul className="mt-2 flex flex-col">
                {top.map((t, i) => {
                  const on = open === t.name;
                  return (
                    <li key={t.name} className={i ? "border-t border-[var(--fill)]" : ""}>
                      <button type="button" aria-expanded={on} onClick={() => (haptic(), setOpen(on ? null : t.name))} className="press flex w-full items-center gap-3 py-3 text-left" disabled={!t.evidence}>
                        <span className="min-w-0 flex-1">
                          <span className="block t-body font-medium text-ink">{t.name}</span>
                          <span className="mt-2 block h-[6px] w-full rounded-[4px] bg-fill" aria-hidden>
                            <span className="block h-full rounded-[4px]" style={{ width: `${Math.max(8, t.strength)}%`, ...PAINT }} />
                          </span>
                        </span>
                        {t.evidence && (
                          <span className={`shrink-0 text-ink-4 ${on ? "rotate-90" : ""}`} style={{ transition: "rotate 200ms" }}>
                            <I.Chevron size={16} />
                          </span>
                        )}
                      </button>
                      <AnimatePresence initial={false}>
                        {on && t.evidence && (
                          <motion.p className="overflow-hidden t-label text-ink-2" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING.ui}>
                            <span className="block pb-3">{t.evidence}</span>
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {p.explanation && (
            <div className="mt-4 rounded-[20px] bg-fill px-4 py-3">
              <p className="t-meta text-ink-3">Why these strengths</p>
              <p className="mt-1 t-body text-ink">{p.explanation}</p>
            </div>
          )}

          {/* The one suggested action: the same single next step as below, never a list of nudges */}
          {step && (
            <button type="button" onClick={() => (haptic(), document.getElementById("next-step")?.scrollIntoView({ behavior: "smooth", block: "center" }))} className="press mt-3 flex w-full items-start gap-3 rounded-[20px] bg-fill px-4 py-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="block t-meta text-ink-3">{nudged ? "Suggested action · from Onairos" : "Suggested action"}</span>
                <span className="mt-1 block t-body font-medium text-ink">{step.text}</span>
                <span className="mt-1 block t-label text-ink-3">{step.why}</span>
              </span>
              <I.Chevron size={16} className="mt-1 shrink-0 text-ink-4" />
            </button>
          )}

          <p className="mt-4 t-meta text-ink-3">{coverageLine(p)} Only you see this; it never goes to the residency.</p>
        </div>
      </div>
    </section>
  );
}
