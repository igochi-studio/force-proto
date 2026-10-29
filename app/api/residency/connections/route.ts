// POST /api/residency/connections: your approved, shared snapshot → the few residents worth
// meeting, each with why, what to explore and evidence from both snapshots. Compared only
// against other approved, shared snapshots; never Onairos. Falls back to the rule-based
// candidates in the contract if the model isn't available.

import cohort from "@/contract/fixtures/cohort.json";
import { suggestConnections, validConnection, visible, type Snapshot } from "@/contract/residency";
import { hasClaude, readConnections } from "@/server/claude";

export const maxDuration = 60;
const COHORT = cohort.snapshots as Snapshot[];

export async function POST(req: Request) {
  let me: Snapshot;
  try {
    me = ((await req.json()) as { me: Snapshot }).me;
    if (!me?.resident_id) throw new Error();
  } catch {
    return Response.json({ error: "Expected your snapshot." }, { status: 400 });
  }
  // Optional now: the app no longer asks what you'd offer or look for.
  me.contribution = { can_offer: me.contribution?.can_offer ?? [], seeking: me.contribution?.seeking ?? [] };
  if (!visible(me)) return Response.json({ mine: [] });
  const others = COHORT.filter((s) => visible(s) && s.resident_id !== me.resident_id);
  if (!hasClaude()) return Response.json({ mine: suggestConnections(me, others), source: "rules" });
  try {
    // Only what the graph can show: grounded in both snapshots, with a reason of 8–20 words.
    const ids = new Set([me.id, ...others.map((s) => s.id)]);
    return Response.json({ mine: (await readConnections(me, others)).filter((c) => validConnection(c, ids)), source: "model" });
  } catch (e) {
    console.error("connections: model failed, sending rule-based candidates", e);
    return Response.json({ mine: suggestConnections(me, others), source: "rules" });
  }
}
