// The residency's API, one function per endpoint in the v1.1 contract (§4). Synthesis and
// connections run through this app's own routes (app/api/residency/*, the model behind them
// when there's a key). With NEXT_PUBLIC_RESIDENCY_API set, every call goes to the backend at
// that address instead. The cohort itself is the known-good fixture until the backend serves
// it (fallback rung 2: live synthesis + reviewed edges).
//
//   POST /api/residency/intent/synthesize    synthesize()
//   POST /api/residency/intent/approve       approve()
//   GET  /api/residency/intent/snapshot      the store keeps it (lib/f/residency.ts)
//   GET  /api/residency/graph                graph()
//   GET  /api/residency/graph/connection     connectionWith()
//   POST /api/residency/connections          connections()  (this app's addition)
//
// To rehearse the failure paths: ?onairos=fail, ?synth=fail.

import cohort from "@/contract/fixtures/cohort.json";
import onairosSample from "@/contract/fixtures/onairos-general.json";
import { normalizeOnairos, personId, projectGraph, synthesize as localSynth, visible, type Connection, type Graph, type OnairosNormalized, type Snapshot, type SynthInput } from "@/contract/residency";

const BASE = process.env.NEXT_PUBLIC_RESIDENCY_API?.replace(/\/$/, "") ?? "";
export const live = !!BASE;

const flag = (k: string) => typeof window !== "undefined" && new URLSearchParams(window.location.search).get(k) === "fail";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, body === undefined ? { credentials: "include" } : { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} answered ${res.status}`);
  return res.json() as Promise<T>;
}

export const COHORT = cohort.snapshots as Snapshot[];
const REVIEWED = cohort.connections as Connection[];

// Onairos: the real SDK's onComplete hands its payload to normalizeOnairos. Until it's wired,
// a labelled sample stands in after a short wait.
export async function onairos(raw?: unknown): Promise<OnairosNormalized> {
  if (raw !== undefined) {
    const n = normalizeOnairos(raw);
    if (!n) throw new Error("Onairos sent something Force couldn't read");
    return n;
  }
  await wait(1400);
  if (flag("onairos")) throw new Error("Onairos didn't answer");
  return normalizeOnairos(onairosSample, true)!;
}

export async function synthesize(input: SynthInput): Promise<Snapshot> {
  if (flag("synth")) {
    await wait(1200);
    throw new Error("Synthesis didn't answer");
  }
  return call<Snapshot>("/api/residency/intent/synthesize", input);
}

// Who you're connected with, once your snapshot is approved and shared.
export async function connections(me: Snapshot): Promise<Connection[]> {
  if (!visible(me)) return [];
  return (await call<{ mine: Connection[] }>("/api/residency/connections", { me })).mine;
}

// The draft Force can always make from the answers alone, if synthesis is down.
export const draft = (input: SynthInput) => localSynth(input);

export async function approve(s: Snapshot, shared: boolean): Promise<Snapshot> {
  const body = { snapshot_id: s.id, fields: { intent: s.intent, problem: s.problem, approach: s.approach, current_frontier: s.current_frontier, contribution: s.contribution, next_step: s.next_step }, approved: true, shared };
  if (live) return call<Snapshot>("/api/residency/intent/approve", body);
  return { ...s, status: "approved", shared, updated_at: new Date().toISOString() };
}

// The cohort graph, with you in it only once you've approved and shared. Your connections
// come from connections(); everyone else's are the reviewed ones.
export function localGraph(me: Snapshot | null, mine: Connection[] = []): { graph: Graph; mine: Connection[] } {
  const others = COHORT.filter((s) => s.resident_id !== me?.resident_id);
  const graph = projectGraph(me ? [...others, me] : others, [...REVIEWED, ...mine], (s) => s.intent ?? s.problem ?? "Unknown");
  return { graph, mine };
}

export async function graph(me: Snapshot | null): Promise<{ graph: Graph; mine: Connection[] }> {
  if (!live) return localGraph(me);
  const g = await call<Graph>("/api/residency/graph");
  const pid = me ? personId(me.resident_id) : "";
  return { graph: g, mine: g.edges.filter((e): e is Connection => "why_connected" in e && (e.source === pid || e.target === pid)) };
}

export async function connectionWith(mine: Connection[], resident: string): Promise<Connection | null> {
  if (live) return call<Connection | null>(`/api/residency/graph/connection?resident=${encodeURIComponent(resident)}`);
  const pid = personId(resident);
  return mine.find((c) => c.source === pid || c.target === pid) ?? null;
}
