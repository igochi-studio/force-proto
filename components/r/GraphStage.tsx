"use client";

// The residency's graph, for the pitch: everyone who approved and shared, in four rows. On
// top, the archetypes Onairos gave the people who chose to show it; then the people; under
// each, what they want to change (intent); at the bottom, the approaches they work through.
// Archetypes and approaches are shared, so they're the buckets people fall into. Force's
// connections run between people as arcs: solid once reviewed, dashed while only suggested.
// Tap anything: it and what it touches stay, the rest fades back. Not part of a resident's
// flow; it's shown at the end.

import { useEffect, useMemo, useRef, useState } from "react";
import { CONNECTION_BADGE, CONNECTION_LABEL, archetypeName, type Connection, type Snapshot } from "@/contract/residency";
import { ME_FACE, artOf, residentById, title } from "@/data/residency";
import { useR } from "@/lib/f/residency";
import { COHORT } from "@/lib/r/api";
import { useCohort } from "@/lib/r/cohort";
import { around, layoutGraph, type Layout, type Placed, type Row } from "@/lib/r/graphLayout";
import Glass from "../f/Glass";
import { I, Logo, haptic } from "../f/ui";

const names = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : (xs[0] ?? ""));
const short = (s: string) => (s.split(/\s+/).length > 5 ? title(s, 5) : s);
const NAMES: Record<Row, string> = { archetype: "Archetype", person: "People", intent: "Intent", theme: "Approach" };

// Rows, top to bottom, with the room between them; the gaps grow on a tall screen.
const BASE = { top: 40, archToPerson: 150, personToIntent: 108, intentToTheme: 132, bottom: 48 };
const ORB = 56;
const INTENT_H = 56;
const PILL_H = 32;

let ruler: CanvasRenderingContext2D | null = null;
const textWidth = (s: string) => {
  ruler ??= document.createElement("canvas").getContext("2d");
  if (!ruler) return s.length * 7.4;
  ruler.font = `500 13px ${getComputedStyle(document.body).fontFamily}`;
  return ruler.measureText(s).width;
};

export default function GraphStage() {
  const { graph } = useCohort();
  const me = useR((s) => s.me);
  const mine = useR((s) => s.snapshot);
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

  const narrow = size.w < 640;
  const l = useMemo(
    () =>
      size.w
        ? layoutGraph(graph, size.w, {
            slot: narrow ? 112 : 148,
            pad: narrow ? 88 : 104, // room for the row names at the left
            gap: 12,
            pill: (row, label) => textWidth(label) + (row === "archetype" ? 4 + 24 + 6 + 12 : 24) + 20,
          })
        : null,
    [graph, size.w, narrow],
  );

  const base = BASE.top + BASE.archToPerson + BASE.personToIntent + BASE.intentToTheme + BASE.bottom;
  const k = Math.min(1.5, Math.max(1, size.h / base));
  const Y: Record<Row, number> = {
    archetype: BASE.top,
    person: BASE.top + BASE.archToPerson * k,
    intent: BASE.top + (BASE.archToPerson + BASE.personToIntent) * k,
    theme: BASE.top + (BASE.archToPerson + BASE.personToIntent + BASE.intentToTheme) * k,
  };
  const height = Y.theme + BASE.bottom;
  // Where a line leaves a node (below it) and arrives (above it).
  const below = (p: Placed) => Y[p.row] + (p.row === "person" ? ORB / 2 + 24 : p.row === "intent" ? INTENT_H / 2 : PILL_H / 2);
  const above = (p: Placed) => Y[p.row] - (p.row === "person" ? ORB / 2 : p.row === "intent" ? INTENT_H / 2 : PILL_H / 2);

  const snapOf = (rid?: string): Snapshot | undefined => (rid === me && mine ? mine : COHORT.find((s) => s.resident_id === rid));
  const nameOf = (pid: string) => {
    const n = l?.placed.get(pid)?.n;
    return n?.resident_id === me ? "You" : (n?.label ?? "someone");
  };
  // The strengths Onairos named for people who chose to show it, by name only (never a
  // number): which people have one in common. Not a node, so the graph stays at four kinds.
  const shared = new Map<string, string[]>();
  for (const pid of l?.people ?? []) for (const x of snapOf(l?.placed.get(pid)?.n.resident_id)?.persona?.positive.slice(0, 5) ?? []) shared.set(x.name, [...(shared.get(x.name) ?? []), pid]);
  const strengths = new Map([...shared].filter(([, ps]) => ps.length > 1).sort((a, b) => b[1].length - a[1].length));
  const strength = focus?.startsWith("strength:") ? focus.slice("strength:".length) : null;
  const lit = strength ? new Set(strengths.get(strength) ?? []) : focus && l ? around(l, focus) : null;
  const count = (t: string) => graph.nodes.filter((n) => n.type === t).length;
  const links = l?.links ?? [];

  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:h-dvh">
      <header className="flex flex-wrap items-end justify-between gap-4 px-6 pb-3 pt-6 sm:px-10 sm:pt-8">
        <div>
          <p className="flex items-center gap-2 t-label text-ink-3">
            <Glass size={22} art="dusk" x={40} y={40} zoom={300}>
              <Logo size={10} />
            </Glass>
            Force · Dhun residency
          </p>
          <h1 className="mt-2 t-large text-ink">Everyone, by what they&apos;re trying to make happen</h1>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          {[
            ["People", count("person")],
            ["Archetypes", count("archetype")],
            ["Intents", count("intent_problem")],
            ["Approaches", count("theme_approach")],
            ["Connections", links.length],
          ].map(([key, v]) => (
            <div key={key as string}>
              <dt className="t-meta text-ink-3">{key}</dt>
              <dd className="t-title text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </header>
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 px-6 pb-2 t-label text-ink-2 sm:px-10" aria-label="How to read it">
        <li className="flex items-center gap-2">
          <svg width="28" height="10" aria-hidden>
            <path d="M2 8 Q14 -2 26 8" fill="none" stroke="var(--sage-4)" strokeWidth="2" />
          </svg>
          Connection, reviewed
        </li>
        <li className="flex items-center gap-2">
          <svg width="28" height="10" aria-hidden>
            <path d="M2 8 Q14 -2 26 8" fill="none" stroke="var(--sage-4)" strokeWidth="2" strokeDasharray="4 4" />
          </svg>
          Suggested by Force
        </li>
        <li className="text-ink-3">Tap anything</li>
      </ul>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div ref={box} className="no-scrollbar relative h-[580px] shrink-0 overflow-auto lg:h-auto lg:min-h-0 lg:flex-1" onClick={() => setFocus(null)}>
          {l && l.people.length === 0 && <p className="absolute inset-0 grid place-items-center t-body text-ink-3">No one has approved and shared yet.</p>}
          {l && l.people.length > 0 && (
            <div className="relative" style={{ width: l.width, height }}>
              <svg className="pointer-events-none absolute inset-0" width={l.width} height={height} aria-hidden>
                {l.lines.map(({ a, b }) => {
                  const p = l.placed.get(a)!;
                  const q = l.placed.get(b)!;
                  const y1 = below(p);
                  const y2 = above(q);
                  const m = (y1 + y2) / 2;
                  const on = !lit || (lit.has(a) && lit.has(b));
                  return <path key={`${a}-${b}`} d={`M${p.x} ${y1} C${p.x} ${m} ${q.x} ${m} ${q.x} ${y2}`} fill="none" stroke={lit && on ? "var(--ink-3)" : "var(--grey-300)"} strokeWidth={lit && on ? 1.75 : 1.25} opacity={on ? 1 : 0.15} style={{ transition: "opacity 150ms, stroke 150ms" }} />;
                })}
                {links.map((c) => {
                  const p = l.placed.get(c.source)!;
                  const q = l.placed.get(c.target)!;
                  const y = Y.person - ORB / 2 - 2;
                  const lift = Math.min(BASE.archToPerson * k - PILL_H, 28 + Math.abs(q.x - p.x) * 0.2);
                  const on = !lit || (lit.has(c.source) && lit.has(c.target));
                  return (
                    <path key={c.id} d={`M${p.x} ${y} Q${(p.x + q.x) / 2} ${y - lift * 2} ${q.x} ${y}`} fill="none" stroke={`var(--${CONNECTION_BADGE[c.type].hue}-4)`} strokeWidth={2.25} strokeLinecap="round" strokeDasharray={c.origin === "reviewed" ? undefined : "5 5"} opacity={on ? 1 : 0.15} style={{ transition: "opacity 150ms" }} />
                  );
                })}
              </svg>
              {/* What each row is, at its left edge */}
              {(["archetype", "person", "intent", "theme"] as Row[]).map((r) => (
                <span key={r} className="pointer-events-none absolute left-4 -translate-y-1/2 t-meta text-ink-3" style={{ top: Y[r] }} aria-hidden>
                  {NAMES[r]}
                </span>
              ))}
              {[...l.placed.values()].map((p) => (
                <Node key={p.n.id} p={p} y={Y[p.row]} me={p.n.resident_id === me} faded={!!lit && !lit.has(p.n.id)} picked={focus === p.n.id} n={l.members.get(p.n.id)?.length ?? 0} onTap={() => (haptic(), setFocus(focus === p.n.id ? null : p.n.id))} />
              ))}
            </div>
          )}
        </div>

        <aside className="shrink-0 border-[var(--fill)] px-6 pb-8 pt-4 sm:px-10 lg:w-[360px] lg:overflow-y-auto lg:border-l lg:px-6 lg:pt-2">
          {strength && strengths.has(strength) ? (
            <Panel kind="Strength in common" head={strength} onClose={() => setFocus(null)} rows={[["Who", names(strengths.get(strength)!.map(nameOf))], ["Where it's from", "Onairos, by name only, for people who chose to show how they come across. Never a number."]]} />
          ) : focus && l?.placed.get(focus) ? (
            <Card l={l} id={focus} me={me} snapOf={snapOf} nameOf={nameOf} strengths={strengths} onClose={() => setFocus(null)} onPick={setFocus} />
          ) : (
            l && <Groups l={l} nameOf={nameOf} strengths={strengths} onPick={setFocus} />
          )}
        </aside>
      </div>
    </div>
  );
}

function Node({ p, y, me, faded, picked, n, onTap }: { p: Placed; y: number; me: boolean; faded: boolean; picked: boolean; n: number; onTap: () => void }) {
  const style: React.CSSProperties = { left: p.x, top: y, opacity: faded ? 0.15 : 1, transition: "opacity 150ms" };
  const tap = (e: React.MouseEvent) => (e.stopPropagation(), onTap());
  if (p.row === "person") {
    const face = me ? ME_FACE : (residentById(p.n.resident_id ?? "")?.face ?? { art: artOf(p.n.id), x: 50, y: 40 });
    return (
      // The orb's centre sits on the row; the name hangs below it.
      <button type="button" onClick={tap} aria-pressed={picked} aria-label={`${me ? "You" : p.n.label}, person`} className="press absolute flex -translate-x-1/2 flex-col items-center" style={{ ...style, top: y - ORB / 2 }}>
        <Glass size={ORB} art={face.art} x={face.x} y={face.y} zoom={300} />
        <span className="mt-1 max-w-[120px] truncate t-label font-medium text-ink">{me ? "You" : p.n.label}</span>
      </button>
    );
  }
  if (p.row === "intent")
    return (
      <button type="button" onClick={tap} aria-pressed={picked} aria-label={`Intent: ${p.n.detail ?? p.n.label}`} className="press absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[16px] bg-paper px-3 text-center" style={{ ...style, width: p.w, height: INTENT_H, boxShadow: "var(--lift-1)" }}>
        <span className="line-clamp-2 t-label text-ink">{short(p.n.label)}</span>
      </button>
    );
  const arch = p.row === "archetype";
  return (
    <button type="button" onClick={tap} aria-pressed={picked} aria-label={`${arch ? "Archetype" : "Approach"}: ${p.n.label}, ${n} ${n === 1 ? "person" : "people"}`} className={`press absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-[6px] whitespace-nowrap rounded-full ${arch ? "bg-paper pl-1 pr-3" : "bg-paper px-3"}`} style={{ ...style, height: PILL_H, boxShadow: "var(--lift-1)" }}>
      {arch && <Glass size={24} art={artOf(p.n.label)} x={40} y={45} zoom={320} />}
      <span className={`t-label ${arch ? "font-medium text-ink" : "text-ink-2"}`}>{p.n.label}</span>
      {n > 1 && <span className="t-meta text-ink-3">{n}</span>}
    </button>
  );
}

// Nothing tapped: the buckets, biggest first, so the groups read without the graph.
function Groups({ l, nameOf, strengths, onPick }: { l: Layout; nameOf: (pid: string) => string; strengths: Map<string, string[]>; onPick: (id: string) => void }) {
  const of = (r: Row) =>
    [...l.members.entries()]
      .filter(([id]) => l.placed.get(id)?.row === r)
      .sort((a, b) => b[1].length - a[1].length);
  const section = (head: string, hint: string, r: Row) => {
    const all = of(r);
    const xs = all.filter(([, ps]) => ps.length > 1);
    const alone = all.filter(([, ps]) => ps.length === 1);
    if (!all.length) return null;
    const label = (id: string) => (r === "archetype" ? `The ${l.placed.get(id)!.n.label}` : l.placed.get(id)!.n.label);
    return (
      <section className="mt-6 first:mt-0">
        <h2 className="t-body font-medium text-ink">{head}</h2>
        <p className="mt-1 t-label text-ink-3">{hint}</p>
        <ul className="mt-3 flex flex-col gap-2">
          {xs.map(([id, ps]) => {
            const n = l.placed.get(id)!.n;
            return (
              <li key={id}>
                <button type="button" onClick={() => (haptic(), onPick(id))} className="press flex w-full items-start gap-3 rounded-[20px] bg-paper p-3 text-left" style={{ boxShadow: "var(--lift-1)" }}>
                  <span className="min-w-0 flex-1">
                    <span className="block t-label font-medium text-ink">{label(n.id)}</span>
                    <span className="mt-[2px] block t-meta text-ink-3">{names(ps.map(nameOf))}</span>
                  </span>
                  <span className="t-label text-ink-3">{ps.length}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {!xs.length && <p className="mt-3 t-label text-ink-2">No two people share one yet.</p>}
        {alone.length > 0 && (
          <p className="mt-3 t-label text-ink-3">
            Only one person so far:{" "}
            {alone.map(([id], i) => (
              <span key={id}>
                {i > 0 && ", "}
                <button type="button" onClick={() => (haptic(), onPick(id))} className="text-ink-2 underline decoration-[var(--grey-300)] underline-offset-2">
                  {label(id)}
                </button>
              </span>
            ))}
          </p>
        )}
      </section>
    );
  };
  return (
    <>
      {section("Approaches people share", "How they work, from their snapshots.", "theme")}
      {section("Archetypes", "From Onairos, only for people who chose to show how they come across.", "archetype")}
      {strengths.size > 0 && (
        <section className="mt-6">
          <h2 className="t-body font-medium text-ink">Strengths in common</h2>
          <p className="mt-1 t-label text-ink-3">From Onairos, by name. Never a number.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {[...strengths].map(([name, ps]) => (
              <li key={name}>
                <button type="button" onClick={() => (haptic(), onPick(`strength:${name}`))} className="press flex w-full items-start gap-3 rounded-[20px] bg-paper p-3 text-left" style={{ boxShadow: "var(--lift-1)" }}>
                  <span className="min-w-0 flex-1">
                    <span className="block t-label font-medium text-ink">{name}</span>
                    <span className="mt-[2px] block t-meta text-ink-3">{names(ps.map(nameOf))}</span>
                  </span>
                  <span className="t-label text-ink-3">{ps.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

// Something tapped: what Force can say about it, from approved, shared snapshots only.
function Card({ l, id, me, snapOf, nameOf, strengths, onClose, onPick }: { l: Layout; id: string; me: string; snapOf: (rid?: string) => Snapshot | undefined; nameOf: (pid: string) => string; strengths: Map<string, string[]>; onClose: () => void; onPick: (id: string) => void }) {
  const p = l.placed.get(id)!;
  const n = p.n;
  const people = (l.members.get(id) ?? []).map(nameOf);
  const rows: [string, React.ReactNode][] = [];
  let head = n.label;
  let kind = NAMES[p.row];

  if (p.row === "person") {
    const s = snapOf(n.resident_id);
    const who = residentById(n.resident_id ?? "");
    head = n.resident_id === me ? "You" : `${n.label}${who ? ` · ${who.work}` : ""}`;
    kind = "Person";
    if (s?.intent || s?.problem) rows.push(["Wants to", s.intent ?? s.problem]);
    if (s?.approach.length) rows.push(["Approach", s.approach.join(" · ")]);
    if (s?.persona?.archetype) rows.push(["Archetype", `The ${archetypeName(s.persona.archetype)}${s.persona.positive.length ? ` · strongest in ${names(s.persona.positive.slice(0, 3).map((x) => x.name.toLowerCase()))}` : ""}`]);
    // Who they have a strength in common with, by name.
    const alike = new Map<string, string[]>();
    for (const [name, ps] of strengths) if (ps.includes(id)) for (const q of ps) if (q !== id) alike.set(q, [...(alike.get(q) ?? []), name.toLowerCase()]);
    if (alike.size) rows.push(["Strengths in common", names([...alike].map(([q, xs]) => `${nameOf(q)} (${names(xs)})`))]);
    const theirs = l.links.filter((c) => c.source === id || c.target === id);
    rows.push(["Connected", theirs.length ? <Links key="c" cs={theirs} self={id} nameOf={nameOf} onPick={onPick} /> : "No clear reason to connect yet."]);
  } else if (p.row === "intent") {
    head = short(n.label);
    rows.push([`What ${n.resident_id === me ? "you want" : `${snapOf(n.resident_id)?.name ?? "they"} wants`} to change`, n.detail ?? n.label]);
  } else if (p.row === "archetype") {
    head = `The ${n.label}`;
    rows.push(["Who", names(people)]);
    // Strengths everyone in it has, by name; never a number.
    const sets = (l.members.get(id) ?? []).map((pid) => new Set(snapOf(l.placed.get(pid)?.n.resident_id)?.persona?.positive.map((x) => x.name) ?? []));
    const shared = sets.length > 1 ? [...sets[0]].filter((x) => sets.every((s) => s.has(x))) : [];
    if (shared.length) rows.push(["Strengths they share", names(shared.slice(0, 3))]);
    rows.push(["Where it's from", "Onairos, for people who chose to show how they come across."]);
  } else {
    rows.push(["Who works through this", people.length > 1 ? names(people) : `Only ${people[0]} so far.`]);
  }
  return <Panel kind={kind} head={head} rows={rows} onClose={onClose} />;
}

function Panel({ kind, head, rows, onClose }: { kind: string; head: string; rows: [string, React.ReactNode][]; onClose: () => void }) {
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
      <dl className="mt-3 flex flex-col gap-2">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-[20px] bg-fill px-4 py-3">
            <dt className="t-meta text-ink-3">{k}</dt>
            <dd className="mt-1 t-label text-ink">{v}</dd>
          </div>
        ))}
      </dl>
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
