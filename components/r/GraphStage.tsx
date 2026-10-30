"use client";

// The residency's social graph, the whole page: everyone who approved and shared, and you
// (a sample you until you've shared your own). Four kinds of thing, as Shriyanshi asked:
// people, what each wants to change (intent, under their name), the approaches they work
// through, and the archetypes Onairos gave the people who chose to show it. Approaches and
// archetypes two or more people share are the buckets people gather round. Between people:
// Force's connections, and the strengths two people have in common in what Onairos read.
// Tap anything: it and what it touches stay, the rest fades back, and a card says what it is.

import { useEffect, useMemo, useRef, useState } from "react";
import { CONNECTION_BADGE, CONNECTION_LABEL, archetypeName, visible, type Connection, type GraphNode, type Snapshot } from "@/contract/residency";
import { ME_FACE, SAMPLE_YOU, SAMPLE_YOUR_LINKS, artOf, residentById, title } from "@/data/residency";
import { useR } from "@/lib/f/residency";
import { COHORT, localGraph } from "@/lib/r/api";
import { useCohort } from "@/lib/r/cohort";
import { around, layoutGraph, type Layout, type Placed, type Row, type Similar } from "@/lib/r/graphLayout";
import Glass from "../f/Glass";
import { I, Logo, haptic } from "../f/ui";

const names = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : (xs[0] ?? ""));
const short = (s: string) => (s.split(/\s+/).length > 5 ? title(s, 5) : s);
const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Lines pass behind a name, not through it: a soft edge round the canvas-coloured label.
const HALO: React.CSSProperties = { boxShadow: "0 0 6px 2px var(--canvas)" };

const ORB = 48;
const ORB_ME = 64;
const NAME_H = 18;
const INTENT_W = 120; // text width before an intent wraps to two lines

let ruler: CanvasRenderingContext2D | null = null;
const textWidth = (s: string, px: number, weight = 400) => {
  ruler ??= document.createElement("canvas").getContext("2d");
  if (!ruler) return s.length * px * 0.55;
  ruler.font = `${weight} ${px}px ${getComputedStyle(document.body).fontFamily}`;
  return ruler.measureText(s).width;
};

// How big each node is drawn: the layout keeps these boxes apart. caption: an archetype no
// one else has, written small under the person's name instead of being a node of its own.
const measureWith = (caption: Map<string, string>) => (n: GraphNode, row: Row, members: number, me: boolean) => {
  const count = members > 1 ? 14 : 0;
  if (row === "person") {
    const orb = me ? ORB_ME : ORB;
    const cap = caption.get(n.id);
    return { w: Math.max(orb, textWidth(me ? "You" : n.label, 13, 500), cap ? textWidth(cap, 12) : 0) + 10, h: orb + NAME_H + (cap ? 16 : 0) + 2 };
  }
  if (row === "intent") {
    const tw = textWidth(short(n.label), 12);
    return { w: Math.min(tw, INTENT_W) + 20, h: tw > INTENT_W ? 44 : 28 };
  }
  if (row === "archetype") return { w: textWidth(n.label, 13, 500) + 4 + 18 + 6 + 12 + count, h: 30 };
  return { w: textWidth(n.label, 13) + 24 + count, h: 30 };
};

// Where lines meet a node: a person's orb, or the middle of anything else.
const anchor = (p: Placed, me: boolean) => (p.row === "person" ? { x: p.x, y: p.y - p.h / 2 + (me ? ORB_ME : ORB) / 2 } : { x: p.x, y: p.y });

// A line between two people, bowed a little so it never lies on top of a straight one.
const bow = (a: { x: number; y: number }, b: { x: number; y: number }, side: number) => {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  const k = Math.min(40, d * 0.14) * side;
  return `M${a.x} ${a.y} Q${mx - (dy / d) * k} ${my + (dx / d) * k} ${b.x} ${b.y}`;
};

export default function GraphStage() {
  const cohort = useCohort();
  const myId = useR((s) => s.me);
  const mine = useR((s) => s.snapshot);
  // Until you've shared your own snapshot, a sample you stands in, so the graph always shows
  // how you'd sit in it.
  const sample = !(mine && visible(mine));
  const me = sample ? SAMPLE_YOU.resident_id : myId;
  const graph = useMemo(() => (sample ? localGraph(SAMPLE_YOU, SAMPLE_YOUR_LINKS).graph : cohort.graph), [sample, cohort.graph]);

  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setFocus(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  const snapOf = (rid?: string): Snapshot | undefined => (rid === SAMPLE_YOU.resident_id ? SAMPLE_YOU : rid === myId && mine ? mine : COHORT.find((s) => s.resident_id === rid));

  // Onairos, person to person: the strengths two people have in common, by name only. Never
  // a number, and only for people who chose to show how they come across.
  const people = graph.nodes.filter((n) => n.type === "person");
  const strengthsOf = new Map(people.map((n) => [n.id, (snapOf(n.resident_id)?.persona?.positive ?? []).slice(0, 5).map((x) => x.name)]));
  const similar: Similar[] = [];
  people.forEach((a, i) =>
    people.slice(i + 1).forEach((b) => {
      const theirs = new Set((strengthsOf.get(b.id) ?? []).map((x) => x.toLowerCase()));
      const what = (strengthsOf.get(a.id) ?? []).filter((x) => theirs.has(x.toLowerCase()));
      if (what.length) similar.push({ a: a.id, b: b.id, what });
    }),
  );
  const simKey = similar.map((s) => `${s.a}${s.b}${s.what.join()}`).join("|");
  // Archetypes only one person has: shown under their name, not as a bucket of one.
  const caption = new Map<string, string>();
  for (const a of graph.nodes.filter((x) => x.type === "archetype")) {
    const holders = graph.edges.filter((e) => e.target === a.id && e.type === "person_has_archetype");
    if (holders.length === 1) caption.set(holders[0].source, `The ${a.label}`);
  }
  const capKey = [...caption].join("|");

  const l = useMemo(() => {
    if (!size.w) return null;
    return layoutGraph(graph, similar, size.w, measureWith(caption), me, size.h);
    // similar and caption are rebuilt each render; their keys say when they really changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, size.w, size.h, me, simKey, capKey]);

  const mePid = l?.people.find((p) => l.placed.get(p)?.n.resident_id === me);
  const lit = focus && l ? around(l, focus) : null;
  const nameOf = (pid: string) => (pid === mePid ? "you" : (l?.placed.get(pid)?.n.label ?? "someone"));
  const n = l?.people.length ?? 0;

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 px-6 pb-2 pt-6 sm:px-10 sm:pt-8">
        <div>
          <p className="flex items-center gap-2 t-label text-ink-3">
            <Glass size={22} art="dusk" x={40} y={40} zoom={300}>
              <Logo size={10} />
            </Glass>
            Force · Dhun residency
          </p>
          <h1 className="mt-2 t-large text-ink">Who&apos;s here</h1>
          <p className="mt-1 t-body text-ink-2">
            You and {Math.max(0, n - 1)} {n - 1 === 1 ? "other" : "others"}, gathered round what you share. Tap anyone.
            {sample && <span className="text-ink-3"> “You” is a sample until you share your own snapshot.</span>}
          </p>
        </div>
        <Key />
      </header>

      <div ref={box} className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto" onClick={() => setFocus(null)}>
        {l && (
          <div className="relative" style={{ height: l.height }}>
            <svg className="pointer-events-none absolute inset-0" width={l.width} height={l.height} aria-hidden>
              {l.lines
                .filter(({ b }) => l.placed.get(b)?.row !== "intent")
                .map(({ a, b }) => {
                  const p = anchor(l.placed.get(a)!, a === mePid);
                  const q = anchor(l.placed.get(b)!, b === mePid);
                  const on = !lit || (lit.has(a) && lit.has(b));
                  return <line key={`${a}-${b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={lit && on ? "var(--ink-2)" : "var(--grey-400)"} strokeWidth={lit && on ? 2 : 1.5} opacity={on ? 1 : 0.12} style={{ transition: "opacity 150ms" }} />;
                })}
              {l.similar.map((s) => {
                const on = !lit || (lit.has(s.a) && lit.has(s.b));
                return <path key={`s-${s.a}-${s.b}`} d={bow(anchor(l.placed.get(s.a)!, s.a === mePid), anchor(l.placed.get(s.b)!, s.b === mePid), -1)} fill="none" stroke="var(--grey-500)" strokeWidth={2} strokeDasharray="0.5 6" strokeLinecap="round" opacity={lit ? (on ? 1 : 0.1) : 0.6} style={{ transition: "opacity 150ms" }} />;
              })}
              {l.links.map((c) => {
                const on = !lit || (lit.has(c.source) && lit.has(c.target));
                return <path key={c.id} d={bow(anchor(l.placed.get(c.source)!, c.source === mePid), anchor(l.placed.get(c.target)!, c.target === mePid), 1)} fill="none" stroke={`var(--${CONNECTION_BADGE[c.type].hue}-4)`} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={c.origin === "reviewed" ? undefined : "7 6"} opacity={on ? 1 : 0.12} style={{ transition: "opacity 150ms" }} />;
              })}
            </svg>
            {[...l.placed.values()].map((p) => (
              <Node key={p.n.id} p={p} caption={caption.get(p.n.id)} me={p.n.id === mePid} faded={!!lit && !lit.has(p.n.id)} picked={focus === p.n.id} n={l.members.get(p.n.id)?.length ?? 0} onTap={() => (haptic(), setFocus(focus === p.n.id ? null : p.n.id))} />
            ))}
          </div>
        )}
      </div>

      {/* What's tapped: its card, in the corner */}
      {focus && l?.placed.get(focus) && (
        <div className="no-scrollbar fixed bottom-6 right-6 z-[3] max-h-[70vh] w-[min(380px,calc(100vw-48px))] overflow-y-auto rounded-[24px]">
          <Card l={l} id={focus} mePid={mePid} snapOf={snapOf} nameOf={nameOf} onClose={() => setFocus(null)} onPick={setFocus} />
        </div>
      )}
    </div>
  );
}

// The four kinds of thing and the two kinds of line, drawn as they look on the graph.
function Key() {
  const swatch = "flex items-center gap-[6px]";
  return (
    <div className="flex flex-col gap-2 t-meta text-ink-2" aria-label="How to read it">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={swatch}>
          <Glass size={16} art="meadow" x={30} y={25} zoom={300} /> Person
        </span>
        <span className="rounded-[8px] bg-fill px-2 py-[2px]">Intent</span>
        <span className="rounded-full bg-paper px-2 py-[2px]" style={{ boxShadow: "var(--lift-1)" }}>
          Approach
        </span>
        <span className="flex items-center gap-1 rounded-full bg-paper py-[2px] pl-[3px] pr-2 font-medium text-ink" style={{ boxShadow: "var(--lift-1)" }}>
          <Glass size={14} art="dusk" x={40} y={45} zoom={320} /> Archetype
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className={swatch}>
          <svg width="24" height="8" aria-hidden>
            <path d="M1 6 Q12 0 23 6" fill="none" stroke="var(--sage-4)" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          Force says meet
        </span>
        <span className={swatch}>
          <svg width="24" height="8" aria-hidden>
            <path d="M1 6 Q12 0 23 6" fill="none" stroke="var(--grey-500)" strokeWidth="2" strokeDasharray="0.5 6" strokeLinecap="round" />
          </svg>
          Strengths in common (Onairos)
        </span>
      </div>
    </div>
  );
}

function Node({ p, caption, me, faded, picked, n, onTap }: { p: Placed; caption?: string; me: boolean; faded: boolean; picked: boolean; n: number; onTap: () => void }) {
  const style: React.CSSProperties = { left: p.x - p.w / 2, top: p.y - p.h / 2, width: p.w, height: p.h, opacity: faded ? 0.15 : 1, transition: "opacity 150ms" };
  const tap = (e: React.MouseEvent) => (e.stopPropagation(), onTap());
  if (p.row === "person") {
    const face = me ? ME_FACE : (residentById(p.n.resident_id ?? "")?.face ?? { art: artOf(p.n.id), x: 50, y: 40 });
    return (
      <button type="button" onClick={tap} aria-pressed={picked} aria-label={`${me ? "You" : p.n.label}, person`} className="press absolute flex flex-col items-center" style={style}>
        <Glass size={me ? ORB_ME : ORB} art={face.art} x={face.x} y={face.y} zoom={300} />
        {/* On the canvas colour, so lines leaving the orb pass behind the words */}
        <span className="mt-[2px] flex flex-col items-center rounded-[8px] bg-canvas px-1" style={HALO}>
          <span className={`whitespace-nowrap t-label text-ink ${me ? "font-semibold" : "font-medium"}`}>{me ? "You" : p.n.label}</span>
          {caption && <span className="whitespace-nowrap t-meta text-ink-3">{caption}</span>}
        </span>
      </button>
    );
  }
  if (p.row === "intent")
    return (
      // Quieter than the buckets: it belongs to one person, so it groups no one.
      <button type="button" onClick={tap} aria-pressed={picked} aria-label={`Intent: ${p.n.detail ?? p.n.label}`} className="press absolute grid place-items-center rounded-[12px] bg-fill px-[10px] text-center" style={style}>
        <span className="line-clamp-2 t-meta text-ink-2">{short(p.n.label)}</span>
      </button>
    );
  const arch = p.row === "archetype";
  return (
    <button type="button" onClick={tap} aria-pressed={picked} aria-label={`${arch ? "Archetype" : "Approach"}: ${p.n.label}, ${n} ${n === 1 ? "person" : "people"}`} className={`press absolute flex items-center justify-center gap-[6px] whitespace-nowrap rounded-full bg-paper ${arch ? "pl-1 pr-3" : "px-3"}`} style={{ ...style, boxShadow: "var(--lift-1)" }}>
      {arch && <Glass size={18} art={artOf(p.n.label)} x={40} y={45} zoom={320} />}
      <span className={`t-label ${arch ? "font-medium text-ink" : "text-ink-2"}`}>{p.n.label}</span>
      {n > 1 && <span className="t-meta text-ink-3">{n}</span>}
    </button>
  );
}

// Every way one person is joined to the others: approaches and archetype in common,
// strengths in common. Most joined first.
function whyJoined(l: Layout, pid: string): [string, string[]][] {
  const why = new Map<string, string[]>();
  const add = (q: string, s: string) => q !== pid && why.set(q, [...(why.get(q) ?? []), s]);
  for (const [id, ps] of l.members) {
    if (!ps.includes(pid)) continue;
    const p = l.placed.get(id)!;
    for (const q of ps) add(q, p.row === "archetype" ? `also the ${p.n.label}` : p.n.label.toLowerCase());
  }
  for (const s of l.similar) if (s.a === pid || s.b === pid) add(s.a === pid ? s.b : s.a, s.what.map((x) => x.toLowerCase()).join(", "));
  return [...why].sort((a, b) => b[1].length - a[1].length);
}

// Something tapped: what it is, in plain words.
function Card({ l, id, mePid, snapOf, nameOf, onClose, onPick }: { l: Layout; id: string; mePid?: string; snapOf: (rid?: string) => Snapshot | undefined; nameOf: (pid: string) => string; onClose: () => void; onPick: (id: string) => void }) {
  const p = l.placed.get(id)!;
  const n = p.n;
  const who = upper(names((l.members.get(id) ?? []).map(nameOf)));

  if (p.row === "theme") return <Panel kind="Shared approach" head={n.label} line={`${who} all work through ${n.label.toLowerCase()}.`} onClose={onClose} />;
  if (p.row === "archetype") return <Panel kind="Shared archetype, from Onairos" head={`The ${n.label}`} line={`${who} all came across as the ${n.label}.`} onClose={onClose} />;
  if (p.row === "intent") {
    const owner = l.lines.find((x) => x.b === id)?.a;
    return <Panel kind={owner === mePid ? "What you want to make happen" : `What ${owner ? nameOf(owner) : "they"} wants to make happen`} head={short(n.label)} line={n.detail ?? n.label} onClose={onClose} />;
  }

  const s = snapOf(n.resident_id);
  const rows: [string, React.ReactNode][] = [];
  if (s?.intent || s?.problem) rows.push(["Wants to", s.intent ?? s.problem]);
  if (s?.persona?.archetype) rows.push(["Archetype", `The ${archetypeName(s.persona.archetype)}`]);
  const theirs = l.links.filter((c) => c.source === id || c.target === id);
  if (theirs.length) rows.push(["Force says meet", <Links key="c" cs={theirs} self={id} nameOf={nameOf} onPick={onPick} />]);
  const joined = whyJoined(l, id);
  if (joined.length) rows.push(["In common", joined.map(([q, why]) => `${upper(nameOf(q))}: ${why.join(", ")}`).join("\n")]);
  return <Panel kind={id === mePid ? "Person" : (residentById(n.resident_id ?? "")?.work ?? "Person")} head={id === mePid ? "You" : n.label} rows={rows} onClose={onClose} />;
}

function Panel({ kind, head, line, rows = [], onClose }: { kind: string; head: string; line?: string; rows?: [string, React.ReactNode][]; onClose: () => void }) {
  return (
    <div className="rounded-[24px] bg-paper p-5" style={{ boxShadow: "var(--lift-2)" }}>
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="block t-meta text-ink-3">{kind}</span>
          <span className="mt-[2px] block t-body font-semibold text-ink">{head}</span>
        </span>
        <button type="button" aria-label="Close" onClick={() => (haptic(), onClose())} className="press hit grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fill text-ink">
          <I.Close size={14} />
        </button>
      </div>
      {line && <p className="mt-2 t-body text-ink-2">{line}</p>}
      {rows.length > 0 && (
        <dl className="mt-3 flex flex-col gap-2">
          {rows.map(([k, v]) => (
            <div key={k} className="rounded-[20px] bg-fill px-4 py-3">
              <dt className="t-meta text-ink-3">{k}</dt>
              <dd className="mt-1 whitespace-pre-line t-label text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function Links({ cs, self, nameOf, onPick }: { cs: Connection[]; self: string; nameOf: (pid: string) => string; onPick: (id: string) => void }) {
  return (
    <ul className="flex flex-col gap-3">
      {cs.map((c) => {
        const other = c.source === self ? c.target : c.source;
        return (
          <li key={c.id}>
            <button type="button" onClick={() => (haptic(), onPick(other))} className="press text-left">
              <span className="block font-medium">
                {CONNECTION_LABEL[c.type]} with {nameOf(other)}
              </span>
              <span className="block text-ink-2">{c.why_connected}</span>
              <span className="mt-[2px] block t-meta text-ink-3">{c.origin === "reviewed" ? `Reviewed${c.reviewed_by ? ` by ${c.reviewed_by}` : ""}` : "Suggested by Force, not yet reviewed"}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
