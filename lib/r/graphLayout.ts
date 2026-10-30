// The residency's graph in four rows, so it reads at a glance: archetypes (from Onairos) on
// top, people under them, each person's intent under them, and approaches at the bottom.
// Lines only run between neighbouring rows. Archetypes and approaches are shared, so they're
// the buckets: each sits over the people in it. People who share the most sit side by side,
// which keeps lines short and stops them crossing.

import { isConnection, type Connection, type Graph, type GraphNode } from "@/contract/residency";

export type Row = "archetype" | "person" | "intent" | "theme";
export interface Placed {
  n: GraphNode;
  row: Row;
  x: number; // centre
  w: number; // how wide it's drawn
}
export interface Layout {
  width: number;
  placed: Map<string, Placed>;
  lines: { a: string; b: string }[]; // between neighbouring rows, upper first
  links: Connection[]; // person to person, drawn as arcs
  people: string[]; // left to right
  members: Map<string, string[]>; // archetype or approach → the people in it
}

const MIN_SLOT = 112; // narrow enough for a two-line intent

const ROW: Record<GraphNode["type"], Row> = { archetype: "archetype", person: "person", intent_problem: "intent", theme_approach: "theme" };

// How wide each label is drawn, given a way to measure text.
export interface Sizes {
  slot: number; // room per person, at most 1.6 times this
  pad: number; // at each side
  gap: number; // between pills in a row
  pill: (row: Row, label: string) => number;
}

export function layoutGraph(g: Graph, width: number, s: Sizes): Layout {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const people = g.nodes.filter((n) => n.type === "person").map((n) => n.id);
  const intentOf = new Map<string, string>();
  const archOf = new Map<string, string>();
  const themesOf = new Map<string, string[]>(); // intent → approaches
  const lines: Layout["lines"] = [];
  for (const e of g.edges) {
    if (isConnection(e) || !byId.has(e.source) || !byId.has(e.target)) continue;
    if (e.type === "person_has_intent") intentOf.set(e.source, e.target);
    if (e.type === "person_has_archetype") archOf.set(e.source, e.target);
    if (e.type === "intent_has_theme") themesOf.set(e.source, [...(themesOf.get(e.source) ?? []), e.target]);
  }
  const links = g.edges.filter(isConnection).filter((c) => byId.has(c.source) && byId.has(c.target));
  const themesOfPerson = (p: string) => themesOf.get(intentOf.get(p) ?? "") ?? [];

  // Who shares what with whom: a Force connection counts most, then the archetype, then
  // each approach.
  const near = (p: string, q: string) => {
    const linked = links.some((c) => (c.source === p && c.target === q) || (c.source === q && c.target === p)) ? 3 : 0;
    const arch = archOf.get(p) && archOf.get(p) === archOf.get(q) ? 1.5 : 0;
    const tq = new Set(themesOfPerson(q));
    return linked + arch + themesOfPerson(p).filter((t) => tq.has(t)).length;
  };
  const total = (p: string) => people.reduce((a, q) => a + (q === p ? 0 : near(p, q)), 0);
  // A chain: start from whoever shares the most, then always the closest one left.
  const order: string[] = [];
  const left = new Set(people);
  while (left.size) {
    const last = order[order.length - 1];
    let best = "";
    let top = -1;
    for (const q of left) {
      const v = last ? near(last, q) * 100 + total(q) : total(q);
      if (v > top) {
        best = q;
        top = v;
      }
    }
    order.push(best);
    left.delete(best);
  }

  // People fill the width: closer together (down to a point) before the page scrolls, and
  // further apart when the buckets above and below need the room.
  const need = (t: GraphNode["type"]) => {
    const ws = g.nodes.filter((n) => n.type === t).map((n) => s.pill(ROW[t], n.label) + s.gap);
    return ws.reduce((a, b) => a + b, 0);
  };
  const n = Math.max(order.length, 1);
  const slot = Math.min(Math.max(MIN_SLOT, (width - s.pad * 2) / n, need("archetype") / n, need("theme_approach") / n), s.slot * 1.6);
  s = { ...s, slot };
  const span = Math.max(width, s.pad * 2 + s.slot * order.length);
  const x0 = (span - s.slot * order.length) / 2;
  const placed = new Map<string, Placed>();
  const put = (id: string, row: Row, x: number, w: number) => placed.set(id, { n: byId.get(id)!, row, x, w });
  order.forEach((p, i) => {
    const x = x0 + s.slot * (i + 0.5);
    put(p, "person", x, s.slot);
    const iid = intentOf.get(p);
    if (iid) put(iid, "intent", x, Math.min(s.slot - s.gap, 184));
  });

  // Buckets sit over the middle of the people in them, nudged apart so none overlap.
  const members = new Map<string, string[]>();
  order.forEach((p) => {
    const a = archOf.get(p);
    if (a) members.set(a, [...(members.get(a) ?? []), p]);
    for (const t of themesOfPerson(p)) if (!(members.get(t) ?? []).includes(p)) members.set(t, [...(members.get(t) ?? []), p]);
  });
  const row = (r: Row) => {
    const items = [...members.keys()]
      .filter((id) => ROW[byId.get(id)!.type] === r)
      .map((id) => {
        const xs = members.get(id)!.map((p) => placed.get(p)!.x);
        return { id, want: xs.reduce((a, b) => a + b, 0) / xs.length, w: s.pill(r, byId.get(id)!.label) };
      })
      .sort((a, b) => a.want - b.want || members.get(b.id)!.length - members.get(a.id)!.length);
    let edge = -Infinity;
    const at = items.map((it) => {
      const x = Math.max(it.want, edge + s.gap + it.w / 2);
      edge = x + it.w / 2;
      return x;
    });
    if (!items.length) return 0;
    // Back toward where they want to be, as a row, but never past the left edge. A row too
    // long for the page makes the page wider.
    const shift = Math.max(items.reduce((a, it, i) => a + it.want - at[i], 0) / items.length, s.pad + items[0].w / 2 - at[0]);
    items.forEach((it, i) => put(it.id, r, at[i] + shift, it.w));
    return edge + shift + s.pad;
  };
  const wide = Math.max(span, row("archetype"), row("theme"));

  for (const p of order) {
    const a = archOf.get(p);
    if (a) lines.push({ a, b: p });
    const i = intentOf.get(p);
    if (i) {
      lines.push({ a: p, b: i });
      for (const t of themesOf.get(i) ?? []) lines.push({ a: i, b: t });
    }
  }
  return { width: wide, placed, lines, links, people: order, members };
}

// What lights up when something's tapped: it, and everything it's directly part of.
export function around(l: Layout, id: string): Set<string> {
  const on = new Set([id]);
  const p = l.placed.get(id);
  if (!p) return on;
  const touch = (x: string) =>
    l.lines.forEach(({ a, b }) => {
      if (a === x) on.add(b);
      if (b === x) on.add(a);
    });
  if (p.row === "person") {
    touch(id);
    for (const x of [...on]) if (l.placed.get(x)?.row === "intent") touch(x);
    for (const c of l.links) if (c.source === id) on.add(c.target);
    for (const c of l.links) if (c.target === id) on.add(c.source);
  } else if (p.row === "intent") {
    touch(id);
  } else {
    // A bucket: the people in it, and the line from each of them to it.
    for (const q of l.members.get(id) ?? []) {
      on.add(q);
      if (p.row === "theme") for (const { a, b } of l.lines) if (b === id) on.add(a);
    }
  }
  return on;
}
