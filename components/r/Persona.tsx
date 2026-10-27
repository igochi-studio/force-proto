"use client";

// Who Force thinks you are: a pattern map of you, the same shape as every other pattern map.
// Your map first (you in the middle, everything Force read strung to you in its painting),
// one line that says what it adds up to, the patterns in your words, your voice, how you show
// up, what it found online, the next small moves. Every line is yours to correct, the same
// way moves are: swipe right if it's you, left if it isn't, tap to rewrite. Then how close
// it got, and the people with this energy.

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import type { Art } from "@/data/mira";
import { HEADLINE, LINKS, MOVES, ONAIROS_ART, TRAITS, type Point } from "@/data/residency";
import { voiceFor } from "@/lib/f/analyse";
import { f } from "@/lib/f/store";
import { r, useR, type Fit } from "@/lib/f/residency";
import Glass from "../f/Glass";
import Goo, { string, type Blob } from "../f/Goo";
import Nav from "../f/Nav";
import { MoveRow, Voice } from "../f/Sheet";
import { MARKS, OnairosMark } from "../f/brands";
import { I, SPRING, haptic } from "../f/ui";
import { Primary } from "./Onboarding";

const ME: { art: Art; x: number; y: number } = { art: "park", x: 45, y: 30 };

// ── Your map ──
// You in the middle; what Force read from strung round you in beads of its painting.
function YouMap({ name }: { name: string }) {
  const { links, onairos } = useR();
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(361);
  const H = 260;
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const around = useMemo(
    () => [
      ...LINKS.filter((l) => links[l.kind]?.trim()).map((l) => ({ key: l.kind, art: l.art, x: l.x, y: l.y, mark: MARKS[l.kind] })),
      ...(onairos === "on" ? [{ key: "onairos", ...ONAIROS_ART, mark: OnairosMark }] : []),
      { key: "answers", art: "hills" as Art, x: 74, y: 18, mark: ({ size }: { size?: number }) => <I.Wave size={size} /> },
    ],
    [links, onairos],
  );
  const { spots, blobs } = useMemo(() => {
    const k = H / w;
    const me: Blob = { x: 0.5, y: 0.5, r: 0, art: ME.art };
    const blobs: Blob[] = [];
    const n = around.length;
    const spots = around.map((s, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2 + 0.4;
      const d = 0.34 + (i % 2) * 0.06;
      const x = 0.5 + Math.cos(a) * d * k * 1.25;
      const y = 0.5 + Math.sin(a) * d;
      blobs.push(...string(me, { x, y, r: 0, art: s.art }, s.art, 12, 0.012));
      return { ...s, px: x, py: y };
    });
    return { spots, blobs };
  }, [around, w]);
  return (
    <div ref={box} className="relative overflow-hidden rounded-[28px] bg-paper" style={{ height: H, boxShadow: "var(--lift-1)" }}>
      <Goo blobs={blobs} w={w} h={H} className="absolute inset-0" />
      {spots.map((s, i) => {
        const M = s.mark;
        return (
          <motion.span key={s.key} className="absolute" style={{ left: `${s.px * 100}%`, top: `${s.py * 100}%`, x: "-50%", y: "-50%" }} animate={{ y: ["-50%", "-58%", "-50%"] }} transition={{ duration: 5 + i * 0.7, repeat: Infinity, ease: "easeInOut" }}>
            <Glass size={44} art={s.art} x={s.x} y={s.y} zoom={280}>
              <M size={17} />
            </Glass>
          </motion.span>
        );
      })}
      <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        <Glass size={92} {...ME} zoom={220} />
        {name && <span className="mt-2 rounded-full bg-paper px-3 py-[3px] t-label font-medium text-ink" style={{ boxShadow: "var(--lift-1)" }}>{name}</span>}
      </span>
    </div>
  );
}

// ── Swipe to say ──
// The same gesture as a next move: pull right for "that's me", left for "not me".
function Swipe({ onRight, onLeft, right, left, children, className = "", style }: { onRight?: () => void; onLeft: () => void; right?: string; left: string; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const x = useMotionValue(0);
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

function PatternCard({ p, agreed }: { p: Point; agreed: boolean }) {
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
    <Swipe right="That's me" left="Not me" onRight={() => r.agree(p.id)} onLeft={() => (r.dropPoint(p.id), f.toast("Gone. Force won't use it."))} className="rounded-[28px] bg-fill p-5">
      <button type="button" onClick={() => setEdit(p.text)} className="block w-full text-left">
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

export default function Persona({ onDone }: { onDone?: () => void }) {
  const { name, points, found, removed, fit, onairos, agreed, clips, links } = useR();
  const [own, setOwn] = useState("");
  const shown = found.filter((x) => !removed.includes(x.id));
  const first = name.trim().split(/\s+/)[0];
  const voices = useMemo(() => voiceFor(clips), [clips]);
  const nLinks = LINKS.filter((l) => links[l.kind]?.trim()).length;
  const summary = points.length ? HEADLINE : "Force needs a little more of you first.";

  return (
    <div className={onDone ? "px-4 pb-8 pt-4" : "no-scrollbar relative h-full overflow-y-auto px-4 pb-10 pt-[64px]"}>
      {!onDone && <Nav title="You" />}

      <YouMap name={first} />

      <p className="mt-6 px-1 t-title text-ink">{summary}</p>
      <p className="mt-2 px-1 t-body text-ink-3">
        From your three answers{nLinks ? `, ${nLinks} ${nLinks === 1 ? "link" : "links"}` : ""}
        {onairos === "on" ? ", Onairos" : ""} and what&apos;s public under your name.
      </p>

      <section className="mt-8">
        <H hint="Swipe right if it's you, left if it isn't. Tap one to say it your way.">The patterns</H>
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {points.map((p) => (
              <motion.div key={p.id} layout exit={{ opacity: 0, height: 0, transition: { duration: 0.25 } }} transition={SPRING.move}>
                <PatternCard p={p} agreed={agreed.includes(p.id)} />
              </motion.div>
            ))}
          </AnimatePresence>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              r.addPoint(own);
              setOwn("");
            }}
            className="option flex h-14 items-center gap-2 rounded-[28px] pl-5 pr-2"
          >
            <input value={own} onChange={(e) => setOwn(e.target.value)} placeholder="Something Force missed…" aria-label="Add something Force missed" enterKeyHint="done" className="min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-ink-3" />
            {own.trim() && (
              <button type="submit" aria-label="Add" className="press grid h-10 w-10 place-items-center rounded-full bg-ink text-paper">
                <I.Up size={16} />
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

      {onDone && (
        <div className="mt-10">
          <Primary onClick={onDone}>Find people with this energy</Primary>
        </div>
      )}
    </div>
  );
}
