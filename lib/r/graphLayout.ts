// The residency's social graph, Obsidian-style, flat and still: people, what each wants to
// change (intent), the approaches they work through and the archetypes Onairos gave them.
// Approaches and archetypes are shared, so they're the buckets: everyone in one is pulled
// towards it, and the groups show as clusters without anything drawn round them. Force's
// connections and the strengths two people have in common (Onairos) run straight between
// people. You sit in the middle when you're on it. Worked out once, inside a box the width
// of the phone, so nothing scrolls sideways and the same cohort always lands the same way.

import { isConnection, type Connection, type Graph, type GraphNode } from "@/contract/residency";

export type Row = "archetype" | "person" | "intent" | "theme";
export interface Placed {
  n: GraphNode;
  row: Row;
  x: number; // centre of its box
  y: number;
  w: number; // the box it needs, label and all
  h: number;
}
export interface Similar {
  a: string; // person ids
  b: string;
  what: string[]; // the strengths they have in common, by name
}
export interface Layout {
  width: number;
  height: number;
  placed: Map<string, Placed>;
  lines: { a: string; b: string }[]; // everything hangs off a person: intent, approaches, archetype
  links: Connection[]; // Force's, person to person
  similar: Similar[]; // Onairos, person to person
  people: string[];
  members: Map<string, string[]>; // archetype or approach → the people in it
}

const ROW: Record<GraphNode["type"], Row> = { archetype: "archetype", person: "person", intent_problem: "intent", theme_approach: "theme" };

// How big each node is drawn, so the layout can keep labels apart.
export type Measure = (n: GraphNode, row: Row, members: number, me: boolean) => { w: number; h: number };

export function layoutGraph(full: Graph, similar: Similar[], width: number, measure: Measure, me?: string, fit?: number): Layout {
  // A bucket only one person is in groups no one: it stays on their card, off the graph.
  const inBucket = new Map<string, Set<string>>();
  const ownerOfIntent = new Map(full.edges.filter((e) => !isConnection(e) && e.type === "person_has_intent").map((e) => [e.target, e.source]));
  for (const e of full.edges) {
    if (isConnection(e)) continue;
    const who = e.type === "person_has_archetype" ? e.source : e.type === "intent_has_theme" ? ownerOfIntent.get(e.source) : undefined;
    if (who) inBucket.set(e.target, (inBucket.get(e.target) ?? new Set()).add(who));
  }
  const lone = new Set([...inBucket].filter(([, ps]) => ps.size < 2).map(([id]) => id));
  const g: Graph = { nodes: full.nodes.filter((n) => !lone.has(n.id)), edges: full.edges.filter((e) => !lone.has(e.source) && !lone.has(e.target)) };
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const people = g.nodes.filter((n) => n.type === "person").map((n) => n.id);
  const lines: Layout["lines"] = [];
  const members = new Map<string, string[]>();
  const intentOf = new Map<string, string>();
  const join = (bucket: string, p: string) => {
    if (!(members.get(bucket) ?? []).includes(p)) members.set(bucket, [...(members.get(bucket) ?? []), p]);
  };
  for (const e of g.edges) {
    if (isConnection(e) || !byId.has(e.source) || !byId.has(e.target)) continue;
    if (e.type === "person_has_intent") intentOf.set(e.source, e.target);
    if (e.type === "person_has_archetype") join(e.target, e.source);
  }
  // The contract hangs approaches off the intent; drawn, they hang off the person, so every
  // line starts at someone and who's in which bucket reads at a glance.
  const ownerOf = new Map([...intentOf].map(([p, i]) => [i, p]));
  for (const e of g.edges) if (!isConnection(e) && e.type === "intent_has_theme" && ownerOf.has(e.source)) join(e.target, ownerOf.get(e.source)!);
  for (const [p, i] of intentOf) lines.push({ a: p, b: i });
  for (const [b, ps] of members) for (const p of ps) lines.push({ a: p, b });
  const links = g.edges.filter(isConnection).filter((c) => byId.has(c.source) && byId.has(c.target));
  const sim = similar.filter((s) => byId.has(s.a) && byId.has(s.b));
  const mePid = me ? people.find((p) => byId.get(p)!.resident_id === me) : undefined;

  // A person and their intent move as one block, the intent just under the name, so it can
  // never drift off towards someone else's. Each block, and each bucket, starts in a fixed
  // order: people round a ring (you in the middle), buckets at the middle of their people.
  const own = new Set(intentOf.values());
  const ids = g.nodes.filter((n) => !own.has(n.id)).map((n) => n.id);
  const k = ids.length;
  const at = new Map(ids.map((id, i) => [id, i]));
  const size = (id: string) => measure(byId.get(id)!, ROW[byId.get(id)!.type], members.get(id)?.length ?? 0, id === mePid);
  const STACK = 4; // between a person's name and their intent
  const box = ids.map((id) => {
    const b = size(id);
    const i = intentOf.get(id);
    if (!i) return b;
    const ib = size(i);
    return { w: Math.max(b.w, ib.w), h: b.h + STACK + ib.h };
  });
  const cx = 0;
  const cy = 0;
  const R = Math.max(140, Math.sqrt(k) * 40);
  const pos = ids.map(() => [cx, cy]);
  const ring = people.filter((p) => p !== mePid);
  ring.forEach((p, i) => {
    const a = (i / Math.max(1, ring.length)) * Math.PI * 2 - Math.PI / 2;
    pos[at.get(p)!] = [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
  });
  [...members.keys()].forEach((b, j) => {
    const ps = members.get(b)!.map((p) => pos[at.get(p)!]);
    const mx = ps.reduce((s, p) => s + p[0], 0) / ps.length;
    const my = ps.reduce((s, p) => s + p[1], 0) / ps.length;
    pos[at.get(b)!] = [cx + (mx - cx) * 0.6 + ((j % 3) - 1) * 9, cy + (my - cy) * 0.6 + ((j % 2) * 2 - 1) * 9];
  });

  // Springs: buckets sit between the people in them; people Force connected, or who share
  // a strength, lean towards each other.
  const springs: [number, number, number, number][] = []; // i, j, rest, strength
  for (const { a, b } of lines) if (!own.has(b)) springs.push([at.get(a)!, at.get(b)!, byId.get(b)!.type === "archetype" ? 92 : 88, 0.06]);
  for (const c of links) springs.push([at.get(c.source)!, at.get(c.target)!, 120, 0.03]);
  for (const s of sim) springs.push([at.get(s.a)!, at.get(s.b)!, 130, 0.015]);

  const pinned = mePid ? at.get(mePid)! : -1;
  const steps = 420;
  for (let it = 0; it < steps; it++) {
    const heat = 1 - it / steps;
    const f = pos.map(() => [0, 0]);
    // Everything keeps its distance, more for bigger boxes.
    for (let i = 0; i < k; i++)
      for (let j = i + 1; j < k; j++) {
        const dx = pos[i][0] - pos[j][0] || 0.01 * (i - j);
        const dy = pos[i][1] - pos[j][1] || 0.01;
        const d2 = Math.max(64, dx * dx + dy * dy);
        const push = (1400 * ((box[i].w + box[j].w) / 160)) / d2;
        f[i][0] += dx * push;
        f[i][1] += dy * push;
        f[j][0] -= dx * push;
        f[j][1] -= dy * push;
      }
    for (const [i, j, rest, s] of springs) {
      const dx = pos[j][0] - pos[i][0];
      const dy = pos[j][1] - pos[i][1];
      const d = Math.hypot(dx, dy) || 0.01;
      const pull = (d - rest) * s;
      f[i][0] += (dx / d) * pull;
      f[i][1] += (dy / d) * pull;
      f[j][0] -= (dx / d) * pull;
      f[j][1] -= (dy / d) * pull;
    }
    for (let i = 0; i < k; i++) {
      if (i === pinned) continue;
      // Pulled in harder up and down than sideways, so it settles about as wide as it is
      // tall instead of into a long chain; fitted to the phone afterwards.
      f[i][0] += (cx - pos[i][0]) * 0.008;
      f[i][1] += (cy - pos[i][1]) * 0.018;
      const m = Math.hypot(f[i][0], f[i][1]);
      const cap = 14 * heat + 0.5;
      const sc = m > cap ? cap / m : 1;
      pos[i][0] += f[i][0] * sc;
      pos[i][1] += f[i][1] * sc;
    }
  }

  // Fitted to the space: squeezed if it's bigger, spread out if it's smaller, so it fills
  // the screen rather than huddling in the middle; with a height to fit, up and down too.
  // Then no two boxes overlap: sideways they stay inside, and the graph grows taller if it
  // has to.
  const left = k ? Math.min(...pos.map((p) => p[0])) : 0;
  const right = k ? Math.max(...pos.map((p) => p[0])) : 0;
  const high = k ? Math.min(...pos.map((p) => p[1])) : 0;
  const low = k ? Math.max(...pos.map((p) => p[1])) : 0;
  const widest = k ? Math.max(...box.map((b) => b.w)) : 0;
  const tallest = k ? Math.max(...box.map((b) => b.h)) : 0;
  // A margin round it on a big screen; stretched no more than about one and a half times,
  // so neighbours still look like neighbours.
  const margin = width > 700 ? 48 : 8;
  const sx = Math.min(1.6, (width - margin * 2 - widest) / Math.max(1, right - left));
  const sy = fit ? Math.max(0.5, Math.min(1.6, (fit - 48 - tallest) / Math.max(1, low - high))) : Math.min(1, sx);
  const ox = width / 2 - ((left + right) / 2) * sx;
  for (const p of pos) {
    p[0] = p[0] * sx + ox;
    p[1] = p[1] * sy;
  }
  const gap = 8;
  for (let it = 0; it < 1200; it++) {
    let moved = false;
    for (let i = 0; i < k; i++)
      for (let j = i + 1; j < k; j++) {
        const dx = (box[i].w + box[j].w) / 2 + gap - Math.abs(pos[i][0] - pos[j][0]);
        const dy = (box[i].h + box[j].h) / 2 + gap - Math.abs(pos[i][1] - pos[j][1]);
        if (dx <= 0 || dy <= 0) continue;
        moved = true;
        // Out along whichever way is shorter (up and down when the sides are full); the
        // pinned one (you) stays put.
        const wi = i === pinned ? 0 : j === pinned ? 1 : 0.5;
        if (dx < dy && dx < 40) {
          const sx = pos[i][0] < pos[j][0] || (pos[i][0] === pos[j][0] && i < j) ? -1 : 1;
          pos[i][0] += sx * dx * wi;
          pos[j][0] -= sx * dx * (1 - wi);
        } else {
          const sy = pos[i][1] < pos[j][1] || (pos[i][1] === pos[j][1] && i < j) ? -1 : 1;
          pos[i][1] += sy * dy * wi;
          pos[j][1] -= sy * dy * (1 - wi);
        }
      }
    for (let i = 0; i < k; i++) pos[i][0] = Math.min(width - box[i].w / 2 - 4, Math.max(box[i].w / 2 + 4, pos[i][0]));
    if (!moved) break;
  }
  const top = k ? Math.min(...pos.map((p, i) => p[1] - box[i].h / 2)) : 0;
  const bottom = k ? Math.max(...pos.map((p, i) => p[1] + box[i].h / 2)) : 0;
  for (const p of pos) p[1] += 12 - top;
  const height = Math.max(240, Math.round(bottom - top + 24));

  const placed = new Map<string, Placed>();
  ids.forEach((id, i) => {
    const n = byId.get(id)!;
    const iid = intentOf.get(id);
    if (!iid) return placed.set(id, { n, row: ROW[n.type], x: pos[i][0], y: pos[i][1], w: box[i].w, h: box[i].h });
    // Unstack the block: the person on top, their intent under them.
    const top = pos[i][1] - box[i].h / 2;
    const b = size(id);
    const ib = size(iid);
    placed.set(id, { n, row: "person", x: pos[i][0], y: top + b.h / 2, w: b.w, h: b.h });
    placed.set(iid, { n: byId.get(iid)!, row: "intent", x: pos[i][0], y: top + b.h + STACK + ib.h / 2, w: ib.w, h: ib.h });
  });
  return { width, height, placed, lines, links, similar: sim, people, members };
}

// What lights up when something's tapped: it, and everything it's directly part of.
export function around(l: Layout, id: string): Set<string> {
  const on = new Set([id]);
  const p = l.placed.get(id);
  if (!p) return on;
  const touch = (x: string) => {
    for (const { a, b } of l.lines) {
      if (a === x) on.add(b);
      if (b === x) on.add(a);
    }
  };
  if (p.row === "person") {
    touch(id);
    for (const x of [...on]) if (l.placed.get(x)?.row === "intent") touch(x);
    for (const c of l.links) if (c.source === id || c.target === id) on.add(c.source === id ? c.target : c.source);
    for (const s of l.similar) if (s.a === id || s.b === id) on.add(s.a === id ? s.b : s.a);
  } else if (p.row === "intent") {
    touch(id);
  } else {
    // A bucket: the people in it, and for an approach, the intents that lead to it.
    for (const q of l.members.get(id) ?? []) on.add(q);
    if (p.row === "theme") for (const { a, b } of l.lines) if (b === id) on.add(a);
  }
  return on;
}
