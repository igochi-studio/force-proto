"use client";

// Who Force thinks you are: a pattern map of you, the same shape as every other pattern map.
// Your map first (you in the middle, everything Force read strung to you in its painting),
// one line that says what it adds up to, the patterns in your words, your voice, how you show
// up, what it found online, the next small moves. Every line is yours to correct, the same
// way moves are: swipe right if it's you, left if it isn't, tap to rewrite. Then how close
// it got, and the people with this energy.

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import type { Art } from "@/data/mira";
import { HEADLINE, LINKS, MOVES, ONAIROS_ART, TRAITS, type Point } from "@/data/residency";
import { voiceFor } from "@/lib/f/analyse";
import { f } from "@/lib/f/store";
import { r, useR, type Fit } from "@/lib/f/residency";
import Glass from "../f/Glass";
import Nav from "../f/Nav";
import { MoveRow, Voice } from "../f/Sheet";
import { MARKS } from "../f/brands";
import PaintedYou, { type Source } from "./PaintedYou";
import { LinkList, NameField, OnairosCard } from "./Links";
import { I, SPRING, haptic } from "../f/ui";


// ── You, painted ──
// Everything Force read from becomes a stroke of its painting, and the strokes become you.
export function usePaintSources(): Source[] {
  const { links, onairos } = useR();
  return [
    ...LINKS.filter((l) => links[l.kind]?.trim()).map((l) => ({ key: l.kind, label: l.kind === "site" ? "Website" : l.name, art: l.art, x: l.x, y: l.y })),
    ...(onairos === "on" ? [{ key: "onairos", label: "Onairos", ...ONAIROS_ART }] : []),
    { key: "voice", label: "Your voice", art: "hills" as Art, x: 74, y: 18 },
    { key: "search", label: "What's public", art: "meadow" as Art, x: 40, y: 60 },
  ];
}

function YouMap({ name }: { name: string }) {
  return <PaintedYou sources={usePaintSources()} name={name} />;
}

// ── Swipe to say ──
// The same gesture as a next move: pull right for "that's me", left for "not me".
// peek: once, on arrival, the card shows you both sides by itself, the way iOS Mail does.
function Swipe({ onRight, onLeft, right, left, children, className = "", style, peek }: { onRight?: () => void; onLeft: () => void; right?: string; left: string; children: React.ReactNode; className?: string; style?: React.CSSProperties; peek?: boolean }) {
  const x = useMotionValue(0);
  useEffect(() => {
    if (!peek) return;
    const id = setTimeout(() => animate(x, [0, 84, 84, 0, -84, -84, 0], { duration: 2.6, times: [0, 0.16, 0.34, 0.5, 0.66, 0.84, 1], ease: "easeInOut" }), 900);
    return () => clearTimeout(id);
  }, [peek, x]);
  const rightA = useTransform(x, [0, 72], [0, 1]);
  const leftA = useTransform(x, [-72, 0], [1, 0]);
  return (
    <div className="relative overflow-hidden rounded-[28px]">
      {onRight && (
        <motion.span className="absolute inset-0 flex items-center gap-2 pl-5 t-body font-medium" style={{ opacity: rightA, color: "var(--sage-7)", background: "var(--sage-1)" }} aria-hidden>
          <I.Check size={18} /> {right}
        </motion.span>
      )}
      <motion.span className="absolute inset-0 flex items-center justify-end gap-2 pr-5 t-body font-medium" style={{ opacity: leftA, color: "var(--rose-7)", background: "var(--rose-1)" }} aria-hidden>
        {left} <I.Close size={18} />
      </motion.span>
      <motion.div
        className={`relative ${className}`}
        style={{ x, touchAction: "pan-y", ...style }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.6, right: onRight ? 0.6 : 0.05 }}
        onDragEnd={(_, i) => {
          if (onRight && (i.offset.x > 72 || i.velocity.x > 500)) {
            haptic("done");
            onRight();
          } else if (i.offset.x < -72 || i.velocity.x < -500) {
            haptic("soft");
            onLeft();
          }
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

function PatternCard({ p, agreed, peek }: { p: Point; agreed: boolean; peek?: boolean }) {
  const [edit, setEdit] = useState<string | null>(null);
  if (edit !== null)
    return (
      <form
        className="rounded-[28px] bg-paper p-4"
        style={{ boxShadow: "var(--lift-2)" }}
        onSubmit={(e) => {
          e.preventDefault();
          if (edit.trim()) r.editPoint(p.id, edit.trim());
          r.agree(p.id);
          setEdit(null);
        }}
      >
        <textarea value={edit} onChange={(e) => setEdit(e.target.value)} autoFocus rows={3} aria-label="Say it your way" className="block w-full resize-none bg-transparent t-body font-semibold text-ink outline-none" />
        <div className="mt-2 flex items-center justify-end gap-1">
          <button type="button" onClick={() => setEdit(null)} className="press h-9 px-3 t-label text-ink-3">
            Cancel
          </button>
          <button type="submit" className="press h-9 rounded-full bg-ink px-4 t-label font-medium text-paper">
            Save
          </button>
        </div>
      </form>
    );
  return (
    <Swipe peek={peek} right="That's me" left="Not me" onRight={() => (r.agree(p.id), r.tipSeen())} onLeft={() => (r.dropPoint(p.id), r.tipSeen(), f.toast("Gone. Force won't use it."))} className="rounded-[28px] bg-fill p-5 pr-12">
      <span className="pointer-events-none absolute right-4 top-5 text-ink-4" aria-hidden>
        <I.Edit size={16} />
      </span>
      <button type="button" onClick={() => setEdit(p.text)} aria-label={`${p.text} Tap to rewrite.`} className="block w-full text-left">
        <span className="block t-body font-semibold text-ink">{p.text}</span>
        <span className="mt-2 block t-body text-ink-3">{p.why}</span>
        {agreed && (
          <span className="mt-2 flex items-center gap-[6px] t-meta" style={{ color: "var(--sage-7)" }}>
            <span className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--sage-4)" }} aria-hidden />
            That&apos;s you
          </span>
        )}
      </button>
    </Swipe>
  );
}

// How to answer Force, shown big the first time: the gestures people already know from Mail
// and every photo app, spelled out once.
function Tip() {
  const seen = useR((s) => s.tip);
  return (
    <AnimatePresence initial={false}>
      {!seen && (
        <motion.div className="overflow-hidden" exit={{ opacity: 0, height: 0, transition: { duration: 0.25 } }}>
          <div className="mb-3 rounded-[28px] bg-paper p-5" style={{ boxShadow: "var(--lift-1)" }}>
            <p className="t-body font-semibold text-ink">Is this you?</p>
            <p className="mt-1 t-label text-ink-3">These came from your answers. Tell Force what&apos;s right; it learns from every change.</p>
            <ul className="mt-4 flex flex-col gap-3">
              <li className="flex items-center gap-3 t-body text-ink">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: "var(--sage-1)", color: "var(--sage-7)" }}>
                  <I.Arrow size={18} />
                </span>
                <span>
                  <span className="font-medium">Swipe right</span> if it&apos;s you
                </span>
              </li>
              <li className="flex items-center gap-3 t-body text-ink">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: "var(--rose-1)", color: "var(--rose-7)" }}>
                  <I.Arrow size={18} className="rotate-180" />
                </span>
                <span>
                  <span className="font-medium">Swipe left</span> if it isn&apos;t
                </span>
              </li>
              <li className="flex items-center gap-3 t-body text-ink">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill text-ink-2">
                  <I.Edit size={16} />
                </span>
                <span>
                  <span className="font-medium">Tap</span> to say it your way
                </span>
              </li>
            </ul>
            <button type="button" onClick={() => (haptic(), r.tipSeen())} className="press mt-5 h-11 w-full rounded-full bg-fill t-body font-medium text-ink">
              Got it
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const FITS: { k: Fit; label: string }[] = [
  { k: "spot", label: "Spot on" },
  { k: "mostly", label: "Mostly" },
  { k: "no", label: "Not really" },
];

// iOS segmented control: a grey track, a white thumb that slides to what you pick.
function Fit() {
  const fit = useR((s) => s.fit);
  return (
    <div className="flex h-11 rounded-full bg-fill p-1" role="radiogroup" aria-label="How close is this?">
      {FITS.map((x) => (
        <button key={x.k} type="button" role="radio" aria-checked={fit === x.k} onClick={() => (haptic(), r.setFit(x.k))} className="relative flex-1 rounded-full t-label font-medium text-ink">
          {fit === x.k && <motion.span layoutId="fit-thumb" className="absolute inset-0 rounded-full bg-paper" style={{ boxShadow: "var(--lift-1)" }} transition={SPRING.ui} />}
          <span className="relative">{x.label}</span>
        </button>
      ))}
    </div>
  );
}

function H({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <>
      <h3 className={`${hint ? "mb-1" : "mb-3"} px-1 t-body text-ink-3`}>{children}</h3>
      {hint && <p className="mb-3 px-1 t-label text-ink-3">{hint}</p>}
    </>
  );
}

// Your page: you, painted, then the patterns, then where Force looked (your links, editable,
// and what it found), then the moves. The same page from the pattern map in the conversation
// and from your face on home. onContinue: on the way in, it ends by taking you to the people.
export default function Persona({ onBack, onContinue }: { onBack?: () => void; onContinue?: () => void }) {
  const { name, points, found, removed, fit, onairos, agreed, clips, links, tip } = useR();
  const [own, setOwn] = useState("");
  const shown = found.filter((x) => !removed.includes(x.id));
  const first = name.trim().split(/\s+/)[0];
  const voices = useMemo(() => voiceFor(clips), [clips]);
  const nLinks = LINKS.filter((l) => links[l.kind]?.trim()).length;
  const summary = points.length ? HEADLINE : "Force needs a little more of you first.";

  return (
    <div className="relative flex h-full flex-col">
      <Nav title={first || "You"} onBack={onBack} />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-[64px]">
        <YouMap name={first} />

        <p className="mt-6 px-1 t-title text-ink">{summary}</p>
        <p className="mt-2 px-1 t-body text-ink-3">
          From your three answers{nLinks ? `, ${nLinks} ${nLinks === 1 ? "link" : "links"}` : ""}
          {onairos === "on" ? ", Onairos" : ""} and what&apos;s public under your name.
        </p>

        <section className="mt-8">
          <H>The patterns</H>
          <Tip />
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {points.map((p, i) => (
                <motion.div key={p.id} layout exit={{ opacity: 0, height: 0, transition: { duration: 0.25 } }} transition={SPRING.move}>
                  <PatternCard p={p} agreed={agreed.includes(p.id)} peek={!tip && i === 0} />
                </motion.div>
              ))}
            </AnimatePresence>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                r.addPoint(own);
                setOwn("");
              }}
              className="flex h-[52px] items-center gap-2 rounded-full bg-paper pl-5 pr-[6px]"
              style={{ boxShadow: "var(--lift-1)" }}
            >
              <input value={own} onChange={(e) => setOwn(e.target.value)} placeholder="Something Force missed…" aria-label="Add something Force missed" enterKeyHint="done" className="min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-ink-3" />
              {own.trim() && (
                <button type="submit" aria-label="Add" onPointerDown={(e) => e.preventDefault()} className="press grid h-10 w-10 place-items-center rounded-full bg-ink text-paper">
                  <I.Up size={18} />
                </button>
              )}
            </form>
          </div>
        </section>

        {voices.length > 0 && (
          <section className="mt-8">
            <H>In your voice</H>
            <div className="flex flex-col gap-2">
              {voices.map((v) => (
                <Voice key={v.clip.id} clip={v.clip} line={v.line} />
              ))}
            </div>
          </section>
        )}

        {onairos === "on" && (
          <section className="mt-8">
            <H hint="Onairos, from the apps you connected.">How you show up</H>
            <ul className="grid grid-cols-2 gap-2">
              {TRAITS.map((t, i) => (
                <li key={t.name} className={`rounded-[24px] bg-paper p-4 ${i === TRAITS.length - 1 ? "col-span-2" : ""}`} style={{ boxShadow: "var(--lift-1)" }}>
                  <p className="t-meta text-ink-3">{t.name}</p>
                  <p className="mt-1 t-body font-semibold text-ink">{t.level}</p>
                  <p className="mt-1 t-label text-ink-2">{t.line}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          <H hint="Change one and Force reads it again.">Your links</H>
          <NameField />
          <LinkList className="mt-2" />
          <OnairosCard className="mt-2" />
        </section>

        <section className="mt-8">
          <H hint="Someone else with your name? Swipe it away.">Found online</H>
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {shown.map((x) => {
                const l = LINKS.find((k) => k.kind === x.id);
                const M = l ? MARKS[l.kind] : () => <I.Search size={16} />;
                return (
                  <motion.li key={x.id} layout exit={{ opacity: 0, height: 0, transition: { duration: 0.25 } }} transition={SPRING.move}>
                    <Swipe left="Not me" onLeft={() => r.notMe(x.id)} className="flex items-center gap-3 rounded-[28px] bg-paper py-3 pl-3 pr-4" style={{ boxShadow: "var(--lift-1)" }}>
                      <Glass size={40} art={l?.art ?? "water"} x={l?.x ?? 70} y={l?.y ?? 30} zoom={300}>
                        <M size={16} />
                      </Glass>
                      <span className="min-w-0 flex-1">
                        <span className="block t-body text-ink">{x.text}</span>
                        <span className="block t-meta text-ink-3">{x.byName ? "Found by your name" : x.source}</span>
                      </span>
                    </Swipe>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
          {removed.length > 0 && (
            <button type="button" onClick={() => r.undoNotMe()} className="press mt-1 flex h-11 items-center px-2 t-label text-ink-3">
              {removed.length} not you · <span className="ml-1 font-medium text-ink-2">Undo</span>
            </button>
          )}
        </section>

        <section className="mt-8">
          <H hint="Swipe right to keep one and Force will nudge you. Swipe left to let it go.">Next moves</H>
          <ul className="flex flex-col gap-2">
            {MOVES.map((m) => (
              <MoveRow key={m} text={m} />
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <H>How close is this?</H>
          <Fit />
          {fit && fit !== "spot" && <p className="mt-3 px-1 t-label text-ink-3">Thank you. Swipe away what&apos;s off, or tap a pattern to say it your way. Force asks again after a few conversations.</p>}
        </section>
      </div>
      {onContinue && (
        <div className="shrink-0 px-4 pb-3 pt-2">
          <button type="button" onClick={onContinue} className="press pill-ink h-[52px] w-full justify-center t-body font-medium">
            Find people with this energy
          </button>
        </div>
      )}
    </div>
  );
}
