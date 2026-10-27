"use client";

// Home, for the residency, in the order you meet it: you (your face, top left, opens your
// pattern map), then two tabs:
//   People: the energy map. You low in the middle, everyone in the residency strung to you in
//   their painting, the shorter the strand the nearer their patterns are to yours. Tap
//   someone and their card grows out of them: what they're on, what you share, where else
//   they are, and a way to talk.
//   Conversations: Force first, then everyone here, open threads on top.
// Under both, the side quests Force suggests, as painted covers.

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ART_SRC } from "@/data/mira";
import { LINKS, ME_FACE, RESIDENTS, type Resident } from "@/data/residency";
import { f, useF } from "@/lib/f/store";
import { r, useR } from "@/lib/f/residency";
import Face from "../f/Face";
import Glass from "../f/Glass";
import Goo, { string, type Blob } from "../f/Goo";
import { MARKS } from "../f/brands";
import { I, Logo, SPRING, haptic } from "../f/ui";


const thread = (id: string) => {
  haptic();
  f.openThread(id);
  f.push({ name: "dm", id });
};

type Tab = "conversations" | "people";

export default function Residents() {
  const tab = useR((s) => s.tab);
  const name = useR((s) => s.name);
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ paddingTop: "var(--sat)", paddingBottom: "var(--sab)" }}>
      {/* You first, then the people who share your patterns, then what you've started with them */}
      <header className="flex h-[60px] shrink-0 items-center gap-3 px-4 pt-2">
        <button type="button" aria-label={`${name || "You"}: who Force thinks you are`} onClick={() => (haptic(), f.push({ name: "persona" }))} className="press shrink-0 rounded-full">
          <Glass size={44} {...ME_FACE} zoom={260} />
        </button>
        <div className="flex h-11 flex-1 rounded-full bg-paper p-1" style={{ boxShadow: "var(--lift-1)" }} role="tablist">
          {(["people", "conversations"] as Tab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => (haptic(), r.setTab(t))} className={`relative flex-1 rounded-full t-label font-medium transition-colors duration-200 ${tab === t ? "text-paper" : "text-ink-2"}`}>
              {tab === t && <motion.span layoutId="home-tab" className="absolute inset-0 rounded-full bg-ink" transition={SPRING.ui} />}
              <span className="relative">{t === "conversations" ? "Conversations" : "People"}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-4">
        {tab === "conversations" ? <Conversations /> : <People />}
        <SideQuests />
      </div>
    </div>
  );
}

// ── Conversations ──

function Row({ onClick, icon, title, line, tag }: { onClick: () => void; icon: React.ReactNode; title: string; line: string; tag?: string }) {
  return (
    <button type="button" onClick={onClick} className="press flex h-[68px] w-full items-center gap-3 rounded-full bg-paper pl-3 pr-4 text-left" style={{ boxShadow: "var(--lift-1)" }}>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate t-body font-medium text-ink">{title}</span>
          {tag && <span className="shrink-0 rounded-full bg-fill px-2 py-[1px] t-meta text-ink-2">{tag}</span>}
        </span>
        <span className="block truncate t-label text-ink-3">{line}</span>
      </span>
      <I.Chevron size={16} className="shrink-0 text-ink-4" />
    </button>
  );
}

function Conversations() {
  const dms = useF((s) => s.dms);
  const last = (id: string) => {
    const m = dms[id];
    const x = m ? ([...m].reverse().find((y) => y.from !== "force") ?? m[m.length - 1]) : null;
    return x ? (x.from === "me" ? `You: ${x.text}` : x.text) : null;
  };
  // Threads you've opened first, then the ones nearest your patterns, then everyone.
  const people = [...RESIDENTS].sort((a, b) => Number(!!dms[b.id]) - Number(!!dms[a.id]) || b.energy - a.energy);
  return (
    <ul className="flex flex-col gap-2">
      <li>
        <Row
          onClick={() => (haptic(), f.push({ name: "force" }))}
          icon={
            <Glass size={44} art="dusk" x={40} y={40} zoom={300}>
              <Logo size={20} />
            </Glass>
          }
          title="Force"
          line="Talk, type or add a photo. It all becomes memory."
        />
      </li>
      {people.map((p) => (
        <li key={p.id}>
          <Row onClick={() => thread(p.id)} icon={<Face face={p.face} size={44} />} title={p.name} line={last(p.id) ?? p.work} tag={p.pattern ? "Same pattern" : undefined} />
        </li>
      ))}
    </ul>
  );
}

// ── People: the energy map ──

const H = 440;
const ME_Y = 0.7;

function People() {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(361);
  const [focus, setFocus] = useState<string | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { spots, blobs } = useMemo(() => {
    const k = H / w;
    const n = RESIDENTS.length;
    const me: Blob = { x: 0.5, y: ME_Y, r: 0, art: ME_FACE.art };
    const blobs: Blob[] = [];
    const spots = RESIDENTS.map((p, i) => {
      const slot = i % 2 === 0 ? i / 2 : n - 1 - (i - 1) / 2;
      const a = -Math.PI + 0.3 + ((slot + 0.5) / n) * (Math.PI - 0.6);
      const e = p.pattern ? p.energy : 0.35 + ((i * 7) % 5) * 0.05;
      const d = 0.26 + (1 - e) * 0.56;
      const x = Math.max(0.12, Math.min(0.88, 0.5 + Math.cos(a) * d * k));
      const y = Math.max(0.12, ME_Y + Math.sin(a) * d);
      const dim = (focus && focus !== p.id ? 0.3 : 1) * (0.55 + e * 0.45);
      blobs.push(...string(me, { x, y, r: 0, art: p.face.art }, p.face.art, Math.round(10 + d * 30), 0.007 + e * 0.007).map((b) => ({ ...b, a: dim })));
      return { p, x, y };
    });
    return { spots, blobs };
  }, [w, focus]);
  const picked = spots.find((s) => s.p.id === focus) ?? null;

  return (
    <div
      ref={box}
      className="relative overflow-hidden rounded-[28px] bg-paper"
      style={{ height: H, boxShadow: "var(--lift-1)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === "CANVAS") setFocus(null);
      }}
    >
      <Goo blobs={blobs} w={w} h={H} className="absolute inset-0" />
      <span className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: "50%", top: `${ME_Y * 100}%` }}>
        <Glass size={60} {...ME_FACE} zoom={240} />
        <span className="mt-1 t-meta text-ink-3">You</span>
      </span>
      {spots.map(({ p, x, y }) => {
        const on = focus === p.id;
        return (
          <button
            key={p.id}
            type="button"
            aria-label={p.name}
            aria-pressed={on}
            onClick={() => (haptic(), setFocus(on ? null : p.id))}
            className="press absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-opacity duration-300"
            style={{ left: `${x * 100}%`, top: `${y * 100}%`, opacity: focus && !on ? 0.35 : 1 }}
          >
            <Face face={p.face} size={p.pattern ? 46 : 38} />
            <span className={`mt-1 whitespace-nowrap rounded-full px-2 py-[2px] t-meta font-medium ${on ? "bg-ink text-paper" : "bg-paper text-ink"}`} style={on ? undefined : { boxShadow: "var(--lift-1)" }}>
              {p.name}
            </span>
          </button>
        );
      })}
      <AnimatePresence>
        {picked ? (
          <Card key={picked.p.id} p={picked.p} x={picked.x * w} y={picked.y * H} />
        ) : (
          <motion.span key="hint" className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-fill px-3 py-[6px] t-meta text-ink-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            Shorter strand, nearer pattern · tap someone
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

// Their card docks at the bottom of the map and grows out of the face you tapped.
function Card({ p, x, y }: { p: Resident; x: number; y: number }) {
  return (
    <motion.div
      className="absolute inset-x-3 bottom-3 rounded-[24px] bg-paper p-4"
      style={{ boxShadow: "var(--lift-2)", transformOrigin: `${x - 12}px ${y - (H - 12)}px` }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.18 } }}
      transition={SPRING.move}
    >
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="block t-body font-semibold text-ink">{p.name}</span>
          <span className="block t-label text-ink-3">{p.work}</span>
        </span>
        <span className="flex shrink-0 gap-1">
          {p.socials.map((k) => {
            const l = LINKS.find((x) => x.kind === k)!;
            const M = MARKS[k];
            return (
              <button key={k} type="button" aria-label={`${p.name} on ${l.name}`} onClick={() => f.toast(`Opens ${p.name}'s ${l.name}`)} className="press rounded-full">
                <Glass size={30} art={l.art} x={l.x} y={l.y} zoom={320}>
                  <M size={12} />
                </Glass>
              </button>
            );
          })}
        </span>
      </div>
      {p.pattern && <p className="mt-3 rounded-[16px] bg-fill px-3 py-2 t-label text-ink">{p.pattern}</p>}
      <button type="button" onClick={() => thread(p.id)} className="press pill-ink mt-3 h-11 w-full justify-center t-body font-medium">
        Message {p.name}
      </button>
    </motion.div>
  );
}

// ── Side quests: after the residency ──
// A preview of where Force is going: what you and someone here could go and do together.
// Not part of the residency build, so the covers are shown, not opened.
function SideQuests() {
  const quests = RESIDENTS.filter((p) => p.quest);
  const odd = quests.length % 2 === 1;
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="t-body text-ink-3">Side quests</h2>
        <span className="rounded-full bg-fill px-2 py-[2px] t-meta text-ink-2">Coming after the residency</span>
      </div>
      <p className="mb-3 px-1 t-label text-ink-3">Where Force is heading: something real to do together, picked from the patterns you share.</p>
      <ul className="grid grid-cols-2 gap-3" aria-label="Side quests, coming after the residency">
        {quests.map((p, i) => {
          const wide = odd && i === quests.length - 1;
          return (
            <li key={p.id} className={wide ? "col-span-2" : ""}>
              <div className={`relative w-full overflow-hidden rounded-[24px] bg-cover ${wide ? "aspect-[2/1]" : "aspect-[4/5]"}`} style={{ backgroundImage: `url(${ART_SRC[p.face.art]})`, backgroundPosition: `${p.face.x}% ${p.face.y}%`, boxShadow: "var(--lift-1)" }}>
                <span className="absolute inset-0 grid place-items-center p-3">
                  <span className="max-w-full rounded-[16px] px-3 py-[6px] text-center t-label font-medium text-paper backdrop-blur-md" style={{ background: "rgb(28 27 26 / 0.28)" }}>
                    {p.quest}
                  </span>
                </span>
                <span className="absolute bottom-3 left-3 flex items-center gap-[6px] rounded-full py-[3px] pl-[3px] pr-2 t-meta text-paper backdrop-blur-md" style={{ background: "rgb(28 27 26 / 0.28)" }}>
                  <Face face={p.face} size={18} />
                  With {p.name}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
