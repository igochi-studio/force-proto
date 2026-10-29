// POST /api/residency/intent/synthesize (v1.1 §4): three answers, optional offer/need, the
// normalized Onairos subset → a provisional five-field snapshot with at most one next step.
// Written by the model when there's a key; otherwise, or if it fails, the plain draft.

import cohort from "@/contract/fixtures/cohort.json";
import { synthesize, visible, type Snapshot, type SynthInput } from "@/contract/residency";
import { hasClaude, readSnapshot } from "@/server/claude";

export const maxDuration = 60;
const THEMES = [...new Set((cohort.snapshots as Snapshot[]).filter(visible).flatMap((s) => s.approach))];

export async function POST(req: Request) {
  let input: SynthInput;
  try {
    input = (await req.json()) as SynthInput;
    if (!input?.resident_id || !Array.isArray(input.answers)) throw new Error();
  } catch {
    return Response.json({ error: "Expected answers and a resident id." }, { status: 400 });
  }
  // Optional now: the app no longer asks what you'd offer or look for.
  input.contribution = { can_offer: input.contribution?.can_offer ?? [], seeking: input.contribution?.seeking ?? [] };
  const draft = synthesize(input);
  if (!hasClaude()) return Response.json(draft);
  try {
    // Within the function's time, or the plain draft: never a timeout the resident sees.
    const budget = new Promise<never>((_, no) => setTimeout(() => no(new Error("took too long")), 45000));
    return Response.json(await Promise.race([readSnapshot(input, draft, THEMES), budget]));
  } catch (e) {
    console.error("synthesize: model failed, sending the plain draft", e);
    return Response.json(draft);
  }
}
