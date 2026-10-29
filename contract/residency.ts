// The residency's shared data contract (Intent & Social Graph Architecture v1.1, 28 Oct 2026).
// One file the frontend and backend both read, so neither side assumes a different shape.
// Plain TypeScript, no DOM, no React: the backend, the web app and the React Native app can
// import it as is.
//
//   Snapshot          the five-field Intent Snapshot, one per resident        (§1, §4)
//   OnairosGeneral    the raw General persona payload, and normalizeOnairos() (§2)
//   synthesize()      answers + contribution + normalized Onairos → snapshot  (fixture-grade)
//   Graph             three node types, two edge families                     (§3, §4)
//   projectGraph()    approved + shared snapshots and connections → graph     (§3, §5)
//   suggestConnections()  automated candidates, each grounded in both snapshots
//
// Rules this file holds to, from the spec: nothing is fabricated (a field Force can't fill is
// null, shown as unknown); Onairos traits support themes but never create an edge on their
// own; only approved AND shared snapshots reach the graph; zero edges is a valid answer;
// automated connections are told apart from manually reviewed ones.

// ── The questions (final wording, §1) ──

export const QUESTIONS = [
  "By the end of this residency, what do you want to have made progress on, and why does it matter to you?",
  "What problem are you trying to solve, who is it for, and what makes it worth solving?",
  "What is the biggest unanswered question or blocker you want to make progress on before the residency ends?",
] as const;

// Quick tags for the two optional contribution fields. Short text can be added to either.
export const OFFER_TAGS = ["Skills", "Experience", "Tools", "Resources", "Perspective"] as const;
export const SEEK_TAGS = ["Feedback", "An introduction", "A skill", "A perspective"] as const;

// ── Intent Snapshot (§1, §4) ──

export type Source = "user_answer:q1" | "user_answer:q2" | "user_answer:q3" | "user_answer" | "user_edit" | "contribution_fields" | "onairos:positive_traits" | "onairos:nudges";

export type SnapshotStatus = "pending_review" | "approved";

export interface NextStep {
  text: string; // starts with a verb, one observable action, 10–30 minutes
  why_it_may_help: string; // grounded in the snapshot
  status: "suggested" | "accepted" | "dismissed";
  source: "force" | "onairos_nudge" | "user";
}

export interface Snapshot {
  id: string;
  resident_id: string;
  name: string;
  // The five fields. null means Force doesn't know yet: show it as unknown, never guess.
  intent: string | null;
  problem: string | null;
  approach: string[]; // empty means unknown
  current_frontier: string | null;
  contribution: { can_offer: string[]; seeking: string[] };
  next_step: NextStep | null; // at most one
  provenance: Partial<Record<"intent" | "problem" | "approach" | "current_frontier" | "contribution", Source[]>>;
  // Which approach entries are inferred (from answers' wording or Onairos) rather than said.
  inferred: string[];
  status: SnapshotStatus;
  shared: boolean; // a separate choice from approval: connecting a source is not consent to publish
  updated_at: string;
  // Optional, for the UI. A backend that doesn't send them still works.
  titles?: { intent?: string; problem?: string }; // two to four words, for map nodes
  noticed?: Noticed[]; // what Force read between the lines; private to the resident, never in the graph
  takes?: { intent?: string; problem?: string; current_frontier?: string; approach?: Record<string, string> }; // Force's own take on each part, private
  source?: "model" | "draft"; // written by the model, or the plain draft from the answers
}

// One thing Force noticed by putting the sources together, with where each part came from.
export interface Noticed {
  text: string;
  from: string[]; // e.g. "Answer 2", "Onairos: Empathy"
}

export const FIELDS = ["intent", "problem", "approach", "current_frontier", "contribution"] as const;
export type Field = (typeof FIELDS)[number];

export const FIELD_LABEL: Record<Field, string> = {
  intent: "Intent",
  problem: "Problem",
  approach: "Approach",
  current_frontier: "Current frontier",
  contribution: "Contribution",
};

export const FIELD_MEANING: Record<Field, string> = {
  intent: "What you want to make progress on here",
  problem: "The challenge underneath, and why it matters",
  approach: "Methods, technical choices, research areas, lenses",
  current_frontier: "The open question or blocker",
  contribution: "What you can offer, and what you're looking for",
};

export const isEmpty = (s: Snapshot, k: Field) =>
  k === "approach" ? s.approach.length === 0 : k === "contribution" ? s.contribution.can_offer.length + s.contribution.seeking.length === 0 : !s[k];

// ── Onairos General persona (§2) ──
// https://docs.onairos.io/persona-data-model/ . Trait values come in two documented formats:
// standard (name → 0–100) and evidence (name → { score, emoji, evidence }).

type RawTrait = number | { score?: number; emoji?: string; evidence?: string };
export interface OnairosGeneral {
  DataAnalysis?: {
    personality_traits?: {
      positive_traits?: Record<string, RawTrait>;
      traits_to_improve?: Record<string, RawTrait>;
      user_summary?: string;
      top_traits_explanation?: string;
      archetype?: string;
      nudges?: { text?: string }[];
    };
  };
  metadata?: {
    total_items_analyzed?: number;
    items_sampled?: number;
    chunks_processed?: number;
    total_chunks?: number;
    coverage?: string;
    platform_breakdown?: Record<string, unknown>;
  };
}

export interface Trait {
  name: string;
  strength: number; // 0–100, strength within its own category: not a percentile, never compared across people
  evidence?: string;
}

// The minimum Force keeps. traits_to_improve stays private to the person and never reaches
// the graph; the raw payload isn't kept at all.
export interface OnairosNormalized {
  positive: Trait[];
  private_growth: Trait[];
  summary: string | null; // an inference, correctable
  explanation: string | null;
  archetype: string | null; // a small personal detail, never a matching key
  nudges: string[]; // candidates only; Force shows at most one, and only if it fits
  coverage: { analyzed: number | null; sampled: number | null; label: string | null; platforms: string[] };
  fixture: boolean; // a labelled sample, not a real response
}

const trait = ([name, v]: [string, RawTrait]): Trait | null => {
  const n = typeof v === "number" ? v : typeof v?.score === "number" ? v.score : NaN;
  if (!name || !Number.isFinite(n)) return null;
  return { name, strength: Math.max(0, Math.min(100, Math.round(n))), evidence: typeof v === "object" && v.evidence ? v.evidence : undefined };
};
const traits = (o?: Record<string, RawTrait>) =>
  Object.entries(o ?? {})
    .map(trait)
    .filter((t): t is Trait => !!t)
    .sort((a, b) => b.strength - a.strength);

export function normalizeOnairos(raw: unknown, fixture = false): OnairosNormalized | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as OnairosGeneral;
  const p = r.DataAnalysis?.personality_traits;
  if (!p) return null;
  const m = r.metadata ?? {};
  const str = (s?: string) => (typeof s === "string" && s.trim() ? s.trim() : null);
  return {
    positive: traits(p.positive_traits),
    private_growth: traits(p.traits_to_improve),
    summary: str(p.user_summary),
    explanation: str(p.top_traits_explanation),
    archetype: str(p.archetype),
    nudges: (p.nudges ?? []).map((n) => str(n?.text)).filter((t): t is string => !!t),
    coverage: {
      analyzed: typeof m.total_items_analyzed === "number" ? m.total_items_analyzed : null,
      sampled: typeof m.items_sampled === "number" ? m.items_sampled : null,
      label: str(m.coverage),
      platforms: Object.keys(m.platform_breakdown ?? {}),
    },
    fixture,
  };
}

// "Based on 240 of 1,200 items from YouTube and ChatGPT": said plainly, so nobody mistakes
// a partial read for certainty.
export function coverageLine(o: OnairosNormalized) {
  const c = o.coverage;
  const items = c.sampled != null && c.analyzed != null ? `${c.sampled.toLocaleString("en")} of ${c.analyzed.toLocaleString("en")} items` : c.analyzed != null ? `${c.analyzed.toLocaleString("en")} items` : null;
  const from = c.platforms.length ? `from ${c.platforms.length > 1 ? `${c.platforms.slice(0, -1).join(", ")} and ${c.platforms.at(-1)}` : c.platforms[0]}` : null;
  const parts = [items, from].filter(Boolean).join(" ");
  return parts ? `Based on ${parts}${c.label ? ` (${c.label} coverage)` : ""}.` : c.label ? `${c.label} coverage.` : "Coverage unknown.";
}

// ── Synthesis (fixture-grade) ──
// What POST /api/residency/intent/synthesize returns. This version is extractive: it keeps
// the resident's own words, trims them, and marks anything inferred. The backend's model
// replaces it behind the same input and output; this one is the fallback if that's down.

export interface SynthInput {
  resident_id: string;
  name: string;
  answers: [string, string, string] | string[];
  contribution: { can_offer: string[]; seeking: string[] };
  onairos: OnairosNormalized | null;
  public?: Finding[]; // what the resident let Force read about them online, minus what they removed
  voice?: VoiceSignal[]; // how each recorded answer was said
}

// What Force found about you in public, with its sources. Only with your say-so, only what
// you keep, private to you: it can shape your snapshot but never goes into the graph itself.
export interface Finding {
  id: string;
  label: string; // "Known for", "Makes", "Writes about", "Into"…
  text: string;
  sources: { title: string; url: string }[];
}

// Measured from the recording itself, never inferred: length, pace, pauses.
export interface VoiceSignal {
  answer: number; // 1–3
  secs: number;
  pace: number; // words a minute while speaking, 0 if unknown
  pauses: number;
  longest_pause: number; // seconds
}

// The first sentence or two, at most ~28 words, in the person's own words.
export function condense(s: string, words = 28) {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const sentences = t.match(/[^.!?]+[.!?]*/g) ?? [t];
  let out = "";
  for (const x of sentences) {
    const next = (out + " " + x).trim();
    if (out && next.split(" ").length > words) break;
    out = next;
  }
  const w = out.split(" ");
  return w.length > words ? `${w.slice(0, words).join(" ").replace(/[,;:]$/, "")}…` : out;
}

// Methods, fields and lenses that show up in what people say. A word only counts if the
// resident actually used it; nothing here is invented.
const LENSES: [RegExp, string][] = [
  [/\binterview|talking to|conversations? with|user research|field ?work|ethnograph/i, "User research"],
  [/\bprototyp|build(ing)? (a|an|the) |ship|mvp\b/i, "Prototyping"],
  [/\bmachine learning|\bml\b|\bllm|\bai\b|model(s)?\b|agent/i, "AI"],
  [/\bmemory|longitudinal/i, "Personal memory"],
  [/\bhuman[- ]computer|interface|ux\b|design/i, "Design"],
  [/\bdata\b|dataset|analytics|measur/i, "Data"],
  [/\bcommunity|cohort|people i|together/i, "Community"],
  [/\bwrit(e|ing)|essay|book|story|stories/i, "Writing"],
  [/\bfilm|video|documentar|photograph/i, "Film"],
  [/\bmusic|sound|audio|song/i, "Music"],
  [/\bhardware|sensor|electronics|solder/i, "Hardware"],
  [/\bpolicy|government|public sector/i, "Policy"],
  [/\bclimate|water|energy|farm|agri/i, "Climate & land"],
  [/\beducation|school|teach|learn(ing|ers)/i, "Education"],
  [/\bhealth|care\b|clinic/i, "Health"],
  [/\bpric|market|business model|revenue/i, "Markets"],
  [/\bopen[- ]source|github/i, "Open source"],
  [/\bart\b|artist|paint|install/i, "Art"],
];

export function lensesIn(text: string) {
  return LENSES.filter(([re]) => re.test(text)).map(([, l]) => l);
}

// One small, concrete, explainable action, or none. An Onairos nudge only if it shares words
// with what the person said they're stuck on; otherwise one built from the frontier itself;
// with nothing to go on, null (the UI asks the person to choose instead).
export function nextStepFor(frontier: string | null, intent: string | null, o: OnairosNormalized | null): NextStep | null {
  if (!frontier && !intent) return null;
  const words = new Set((frontier ?? "").toLowerCase().match(/[a-z]{5,}/g) ?? []);
  const nudge = o?.nudges.find((n) => (n.toLowerCase().match(/[a-z]{5,}/g) ?? []).some((w) => words.has(w)));
  if (nudge && /^[A-Z][a-z]+\b/.test(nudge))
    return { text: nudge.replace(/\.$/, ""), why_it_may_help: `It speaks to what you said you're stuck on: “${condense(frontier!, 12)}”`, status: "suggested", source: "onairos_nudge" };
  if (frontier)
    return { text: "Write your open question as one sentence and ask one resident it this week", why_it_may_help: `You named this as your biggest blocker: “${condense(frontier, 12)}”`, status: "suggested", source: "force" };
  return { text: "Tell one resident what you want to have made progress on by the end", why_it_may_help: `Saying it out loud early is how people here find you: “${condense(intent!, 12)}”`, status: "suggested", source: "force" };
}

export function synthesize(i: SynthInput, now = new Date()): Snapshot {
  const a = [0, 1, 2].map((k) => (i.answers[k] ?? "").trim());
  const intent = condense(a[0]) || null;
  const problem = condense(a[1]) || null;
  const current_frontier = condense(a[2]) || null;
  const said = lensesIn(a.join(" "));
  // Onairos can support a theme the person already touched on; it can't add a new one by itself.
  const supported = new Set((i.onairos?.positive ?? []).flatMap((t) => lensesIn(`${t.name} ${t.evidence ?? ""}`)));
  const approach = said.slice(0, 4);
  const provenance: Snapshot["provenance"] = {};
  if (intent) provenance.intent = ["user_answer:q1"];
  if (problem) provenance.problem = ["user_answer:q2"];
  if (current_frontier) provenance.current_frontier = ["user_answer:q3"];
  if (approach.length) provenance.approach = approach.some((x) => supported.has(x)) ? ["user_answer", "onairos:positive_traits"] : ["user_answer"];
  const contribution = { can_offer: i.contribution.can_offer.filter(Boolean), seeking: i.contribution.seeking.filter(Boolean) };
  if (contribution.can_offer.length + contribution.seeking.length) provenance.contribution = ["contribution_fields"];
  return {
    id: `snapshot_${i.resident_id}`,
    resident_id: i.resident_id,
    name: i.name.trim() || "You",
    intent,
    problem,
    approach,
    current_frontier,
    contribution,
    next_step: nextStepFor(current_frontier, intent, i.onairos),
    provenance,
    inferred: approach, // read from wording, so the person checks them
    status: "pending_review",
    shared: false,
    updated_at: now.toISOString(),
    source: "draft",
  };
}

// ── Graph (§3, §4) ──

export type NodeType = "person" | "intent_problem" | "theme_approach";
export type StructuralEdge = "person_has_intent" | "intent_has_theme";
export type ConnectionType = "shared_problem" | "complementary_approach" | "shared_exploration" | "potential_contribution";

// Short badges for people cards, Gigi-style, each with its colour.
export const CONNECTION_BADGE: Record<ConnectionType, { label: string; hue: "rose" | "sage" | "sky" | "amber" }> = {
  shared_problem: { label: "Same problem", hue: "rose" },
  complementary_approach: { label: "Complements you", hue: "sage" },
  shared_exploration: { label: "Same question", hue: "sky" },
  potential_contribution: { label: "Can help", hue: "amber" },
};

export const CONNECTION_LABEL: Record<ConnectionType, string> = {
  shared_problem: "Shared problem",
  complementary_approach: "Complementary approach",
  shared_exploration: "Shared exploration",
  potential_contribution: "Potential contribution",
};

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  resident_id?: string; // person nodes, and whose intent an intent_problem node is
}

export interface Evidence {
  snapshot_id: string;
  field: Field;
  text: string; // a short quote from an approved snapshot, never raw source content
}

export interface Connection {
  id: string;
  source: string; // person node id
  target: string;
  type: ConnectionType;
  why_connected: string; // one sentence, 8–20 words
  what_to_explore: string; // one suggested question
  evidence_refs: string[]; // snapshot ids, both sides
  evidence: Evidence[];
  origin: "reviewed" | "automated"; // the demo tells these apart
  reviewed_by?: string;
  opener?: string; // a first message you could send, drafted by Force; never sent by itself
}

export type GraphEdge = { source: string; target: string; type: StructuralEdge } | (Connection & { type: ConnectionType });

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const personId = (resident: string) => `person_${resident}`;
export const visible = (s: Snapshot) => s.status === "approved" && s.shared;
export const isConnection = (e: GraphEdge): e is Connection => "why_connected" in e;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

// A connection the UI may show: grounded in both snapshots, with a why of 8–20 words.
export const validConnection = (c: Connection, ids: Set<string>) =>
  ids.has(c.evidence_refs[0]) && ids.has(c.evidence_refs[1]) && words(c.why_connected) >= 8 && words(c.why_connected) <= 20 && !!c.what_to_explore.trim();

// GET /api/residency/graph: cohort-visible nodes and edges, from approved and shared
// snapshots only. A connection touching anyone not visible is dropped, not hidden.
export function projectGraph(snapshots: Snapshot[], connections: Connection[], titleOf: (s: Snapshot) => string = (s) => s.intent ?? "Unknown"): Graph {
  const shown = snapshots.filter(visible);
  const ids = new Set(shown.map((s) => s.id));
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const themes = new Map<string, GraphNode>();
  for (const s of shown) {
    const pid = personId(s.resident_id);
    nodes.push({ id: pid, type: "person", label: s.name, resident_id: s.resident_id });
    if (!s.intent && !s.problem) continue;
    const iid = `intent_${s.resident_id}`;
    nodes.push({ id: iid, type: "intent_problem", label: titleOf(s), resident_id: s.resident_id });
    edges.push({ source: pid, target: iid, type: "person_has_intent" });
    for (const a of s.approach) {
      const tid = `theme_${slug(a)}`;
      if (!themes.has(tid)) themes.set(tid, { id: tid, type: "theme_approach", label: a });
      edges.push({ source: iid, target: tid, type: "intent_has_theme" });
    }
  }
  nodes.push(...themes.values());
  for (const c of connections) if (validConnection(c, ids)) edges.push(c);
  return { nodes, edges };
}

// ── Automated candidates ──
// Pairs come from problem, frontier, approach and offer/need, never from Onairos alone. Each
// carries a sentence and a question built from what both people actually said. Returns
// nothing rather than something thin.

const STOP = new Set("about after again also always because been before being both could doing even every from have here into just know like make more most much need only other really right should some something still than that their them then there these they thing think this those through very want what when where which while will with would your youre residency progress problem question blocker matter matters".split(" "));
// Words that carry meaning, by stem, each remembered as the person wrote it.
const keyWords = (s: string | null) => {
  const m = new Map<string, string>();
  for (const w of (s ?? "").toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/)) {
    const stem = w.replace(/(ies|es|s)$/, "");
    if (w.length > 4 && !STOP.has(w) && !STOP.has(stem) && !m.has(stem)) m.set(stem, w);
  }
  return m;
};
const overlap = (a: Map<string, string>, b: Map<string, string>) => [...a.keys()].filter((w) => b.has(w)).map((w) => a.get(w)!);
const both = (w: string[]) => `“${w[0]}” and “${w[1]}”`;

const quote = (s: Snapshot, field: Field): Evidence => ({
  snapshot_id: s.id,
  field,
  text: field === "approach" ? s.approach.join(", ") : field === "contribution" ? [...s.contribution.can_offer.map((x) => `Offers ${x.toLowerCase()}`), ...s.contribution.seeking.map((x) => `Seeks ${x.toLowerCase()}`)].join(" · ") : condense((s[field] as string) ?? "", 16),
});

const need = (tag: string) => tag.toLowerCase().replace(/^an? /, "");
const OFFER_FOR_SEEK: Record<string, string[]> = { feedback: ["experience", "perspective", "skills"], introduction: ["resources", "experience"], skill: ["skills", "tools"], perspective: ["perspective", "experience"] };

export function suggestConnections(me: Snapshot, others: Snapshot[]): Connection[] {
  if (!visible(me)) return [];
  const out: Connection[] = [];
  const mine = { problem: keyWords(me.problem), frontier: keyWords(me.current_frontier) };
  for (const o of others.filter(visible)) {
    if (o.resident_id === me.resident_id) continue;
    const base = { id: `auto_${me.resident_id}_${o.resident_id}`, source: personId(me.resident_id), target: personId(o.resident_id), evidence_refs: [me.id, o.id], origin: "automated" as const };
    const shareProblem = overlap(mine.problem, keyWords(o.problem));
    if (shareProblem.length >= 2) {
      out.push({ ...base, type: "shared_problem", why_connected: `You're working on overlapping problems: both of you wrote about ${both(shareProblem)}.`, what_to_explore: "What has each of you already tried on it, and what didn't work?", evidence: [quote(me, "problem"), quote(o, "problem")] });
      continue;
    }
    const shareFrontier = overlap(mine.frontier, keyWords(o.current_frontier));
    if (shareFrontier.length >= 2) {
      out.push({ ...base, type: "shared_exploration", why_connected: `Your open questions are close: both of you asked about ${both(shareFrontier)}.`, what_to_explore: "What would each of you try first if you had to answer the other's question this week?", evidence: [quote(me, "current_frontier"), quote(o, "current_frontier")] });
      continue;
    }
    const offers = o.contribution.can_offer.map((y) => y.toLowerCase());
    const gives = me.contribution.seeking.find((s) => (OFFER_FOR_SEEK[need(s)] ?? []).some((x) => offers.includes(x)));
    if (gives) {
      const matched = (OFFER_FOR_SEEK[need(gives)] ?? []).find((x) => offers.includes(x))!;
      out.push({ ...base, type: "potential_contribution", why_connected: `You asked for ${gives.toLowerCase()}, and ${o.name} offered ${matched} to anyone in the residency.`, what_to_explore: `What's the one thing you'd want ${o.name}'s ${need(gives)} on first?`, evidence: [quote(me, "contribution"), quote(o, "contribution")] });
      continue;
    }
    const sharedThemes = me.approach.filter((x) => o.approach.includes(x));
    const different = o.approach.filter((x) => !me.approach.includes(x));
    if (sharedThemes.length && different.length && overlap(keyWords(me.intent), keyWords(o.intent)).length) {
      out.push({ ...base, type: "complementary_approach", why_connected: `You both work through ${sharedThemes[0].toLowerCase()}, and ${o.name} adds ${different[0].toLowerCase()} you don't use yet.`, what_to_explore: `How would ${different[0].toLowerCase()} change the next step on what you're making?`, evidence: [quote(me, "approach"), quote(o, "approach")] });
    }
  }
  // Problems and questions first; offer-for-need on broad tags is the weakest reason, so at
  // most one of those. Three at most: a few clear reasons beat a full-looking map.
  const rank: Record<ConnectionType, number> = { shared_problem: 0, shared_exploration: 1, complementary_approach: 2, potential_contribution: 3 };
  const ok = out.filter((c) => words(c.why_connected) >= 8 && words(c.why_connected) <= 20).sort((a, b) => rank[a.type] - rank[b.type]);
  const firstOffer = ok.findIndex((c) => c.type === "potential_contribution");
  return ok.filter((c, i) => c.type !== "potential_contribution" || i === firstOffer).slice(0, 3);
}
