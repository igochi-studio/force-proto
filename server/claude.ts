// Server only (kept out of lib/ so no client bundle can import it): Force reading a resident. Two jobs, both through Claude:
//   readSnapshot()   three answers (+ what they offer and seek, + Onairos) → the five fields,
//                    written clean, plus what Force noticed between the lines
//   readConnections() two or more approved snapshots → the few connections worth making
// The key lives in ANTHROPIC_API_KEY and never reaches the browser. If the model is down or
// declines, the callers fall back to the plain draft in contract/residency.ts.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { QUESTIONS, type Connection, type ConnectionType, type Field, type Finding, type Snapshot, type SynthInput } from "@/contract/residency";

const MODEL = "claude-opus-5-5";
export const hasClaude = () => !!process.env.ANTHROPIC_API_KEY;
const client = () => new Anthropic();

// Who Force is. Written from the founder's own description of the personality.
const FORCE = `You are Force, a companion for the people at the Dhun residency.

You read people the way a sharp friend who has known them for years does. You hear the intent under the words and the direction of what someone is doing, and you name what they're after before they've quite said it. You never treat anyone as a person in need of help or fixing: no self-help tone, no therapy words, no flattery, no pep talk. You push people toward the best version of their work while keeping their ambition, light and energy intact. Your job is to bring their attention back to what matters to them, and sharpen it.

Write in plain, warm, specific English. Short sentences. No jargon, no buzzwords, no emoji.`;

const ask = async <T extends z.ZodType>(schema: T, system: string, user: string): Promise<z.infer<T>> => {
  const res = await client().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: (process.env.FORCE_EFFORT as "low" | "medium" | "high" | undefined) ?? "medium", format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") throw new Error("declined");
  if (!res.parsed_output) throw new Error("unreadable");
  return res.parsed_output as z.infer<T>;
};

// ── The snapshot ──

const SnapshotOut = z.object({
  intent: z.string().nullable(),
  intent_title: z.string().nullable(),
  problem: z.string().nullable(),
  problem_title: z.string().nullable(),
  approach: z.array(z.string()),
  approach_inferred: z.array(z.string()),
  current_frontier: z.string().nullable(),
  next_step: z
    .object({
      text: z.string(),
      why_it_may_help: z.string(),
      from_onairos_nudge: z.boolean(),
    })
    .nullable(),
  noticed: z.array(z.object({ text: z.string(), from: z.array(z.string()) })),
  takes: z.object({
    intent: z.string().nullable(),
    problem: z.string().nullable(),
    current_frontier: z.string().nullable(),
    approach: z.array(z.object({ name: z.string(), take: z.string() })),
  }),
});

const SNAPSHOT_TASK = `A resident has just answered three questions, by voice or by typing. Voice answers are machine transcripts and may mishear words (the product is called "Force", so "forest" or "forced" usually means Force). Read all three answers together and write their Intent Snapshot.

How to write each field:
- Write it the way they'd put it on their clearest day. Fix typos and mishearings, use the other answers to make vague words specific, and keep their meaning. Don't add facts they didn't give.
- The questions map to fields like this. Answer 1 is intent. Answer 2 is problem. Answer 3 has two halves: how they're approaching it (approach) and what they're still trying to figure out (current_frontier).
- intent: what they're working toward right now, and why it matters to them. One sentence, starting with a verb, at most 25 words.
- problem: the problem, question or opportunity they're focused on, in their framing (an opportunity stays an opportunity; don't turn it into a problem). One sentence, at most 25 words.
- current_frontier: what they're still trying to figure out, from the second half of Answer 3, written as the sharp question it really is. At most 20 words. If Answer 3 only covers their approach, use the clearest open question from the other answers, or null.
- intent_title, problem_title: two to four words each, a noun phrase for a map node (for example "Proof of demand", "Forgotten decisions").
- approach: one to four lenses they work through: methods, fields, technical choices or research areas, one to three words each, mainly from the first half of Answer 3 (how they're approaching it). Include ones clearly implied by how they talk about the work, and list any you implied (rather than ones they said) again in approach_inferred. Onairos strengths may support a lens they already touched on but must never introduce one by themselves.
- If an answer is empty, or too thin to understand without guessing, return null for that field. Never invent.
- next_step: one small action, starting with a verb, doable in 10 to 30 minutes or one conversation, that moves their current frontier. why_it_may_help: at most 20 words, grounded in what they said. If an Onairos suggestion genuinely fits their frontier, adapt it and set from_onairos_nudge true. If there's too little to go on, return null.
- noticed: one to three things you read between the lines by putting the answers (and Onairos, if given) together: a tension, the real question under the stated one, or what their words show about how they work. Second person, at most 25 words each, specific to them. No compliments, no personality labels, no scores. For each, list where it came from, like "Answer 1", "Answer 3", "Onairos: Curiosity".
- takes: your own short take on each part (intent, problem, current_frontier, and each approach lens by the same name): what you make of it, what it tells you, or where you'd push. One or two sentences, at most 30 words, second person, an opinion rather than a restatement. Null for any part that's null.`;

// themes: the approach names already in the residency, so shared lenses meet on the map.
export async function readSnapshot(i: SynthInput, base: Snapshot, themes: string[] = []): Promise<Snapshot> {
  const o = i.onairos;
  const parts = [
    ...QUESTIONS.map((q, k) => `Question ${k + 1}: ${q}\nAnswer ${k + 1}: ${(i.answers[k] ?? "").trim() || "(no answer)"}`),
    `They can help others with: ${i.contribution.can_offer.join(", ") || "(skipped)"}`,
    `They would value help with: ${i.contribution.seeking.join(", ") || "(skipped)"}`,
    o
      ? `Onairos (an inference from a ${o.coverage.label ?? "partial"} sample of their apps, not fact):\nSummary: ${o.summary ?? "none"}\nStrengths: ${o.positive.map((t) => `${t.name}${t.evidence ? ` (${t.evidence})` : ""}`).join("; ") || "none"}\nSuggestions: ${o.nudges.join(" | ") || "none"}`
      : "Onairos: not connected.",
    i.public?.length ? `What's public about them, which they asked Force to read (an outside view; use it to understand them, quote it only through "noticed" sources like "Public: GitHub"):\n${i.public.map((f) => `- ${f.label}: ${f.text} (${f.sources.map((x) => x.title).join(", ")})`).join("\n")}` : "",
    i.voice?.length ? `How they said it (measured from their recordings; mention only a clear difference between answers, sourced like "Voice: answer 3"):\n${i.voice.map((v) => `- Answer ${v.answer}: ${Math.round(v.secs)}s, ${v.pace ? `${v.pace} words a minute` : "pace unknown"}, ${v.pauses} pauses, longest ${v.longest_pause.toFixed(1)}s`).join("\n")}` : "",
    themes.length ? `Approach names other residents already use (reuse one exactly when it genuinely fits; otherwise name your own): ${themes.join(", ")}` : "",
  ].filter(Boolean);
  const out = await ask(SnapshotOut, `${FORCE}\n\n${SNAPSHOT_TASK}`, `Resident: ${i.name || "unnamed"}\n\n${parts.join("\n\n")}`);
  const approach = out.approach.map((a) => a.trim()).filter(Boolean).slice(0, 4);
  const provenance: Snapshot["provenance"] = { ...base.provenance };
  if (out.intent) provenance.intent = ["user_answer:q1"];
  else delete provenance.intent;
  if (out.problem) provenance.problem = ["user_answer:q2"];
  else delete provenance.problem;
  if (out.current_frontier) provenance.current_frontier = ["user_answer:q3"];
  else delete provenance.current_frontier;
  if (approach.length) provenance.approach = o?.positive.length ? ["user_answer:q3", "onairos:positive_traits"] : ["user_answer:q3"];
  else delete provenance.approach;
  return {
    ...base,
    intent: out.intent,
    problem: out.problem,
    current_frontier: out.current_frontier,
    approach,
    inferred: approach.filter((a) => out.approach_inferred.some((x) => x.trim().toLowerCase() === a.toLowerCase())),
    provenance,
    next_step: out.next_step ? { text: out.next_step.text.replace(/\.$/, ""), why_it_may_help: out.next_step.why_it_may_help, status: "suggested", source: out.next_step.from_onairos_nudge ? "onairos_nudge" : "force" } : null,
    titles: { intent: out.intent_title ?? undefined, problem: out.problem_title ?? undefined },
    noticed: out.noticed.slice(0, 3),
    takes: {
      intent: out.takes.intent ?? undefined,
      problem: out.takes.problem ?? undefined,
      current_frontier: out.takes.current_frontier ?? undefined,
      approach: Object.fromEntries(out.takes.approach.filter((x) => approach.some((a) => a.toLowerCase() === x.name.trim().toLowerCase())).map((x) => [approach.find((a) => a.toLowerCase() === x.name.trim().toLowerCase())!, x.take])),
    },
    source: "model",
  };
}

// ── Connections ──

const TYPES = ["shared_problem", "complementary_approach", "shared_exploration", "potential_contribution"] as const;
const FIELDS = ["intent", "problem", "approach", "current_frontier", "contribution"] as const;
const ConnectionsOut = z.object({
  connections: z.array(
    z.object({
      resident_id: z.string(),
      type: z.enum(TYPES),
      why_connected: z.string(),
      what_to_explore: z.string(),
      your_evidence: z.object({ field: z.enum(FIELDS), text: z.string() }),
      their_evidence: z.object({ field: z.enum(FIELDS), text: z.string() }),
      opener: z.string(),
    }),
  ),
});

const CONNECT_TASK = `You suggest connections between residents, from their approved Intent Snapshots only.

For the resident you're writing to ("you"), look at each other resident and connect them only when there is a clear, specific reason in both snapshots. The kinds:
- shared_problem: both are working on materially the same underlying problem.
- complementary_approach: their approaches or skills could complement each other on what they're making.
- shared_exploration: they're actively exploring a related open question.
- potential_contribution: one person's explicitly stated offer may meet the other's explicitly stated need.

Rules: at most three connections, strongest first. Zero is a good answer when nothing is clear; never connect people just to fill the list. why_connected: one sentence of 8 to 20 words, addressed to "you", naming what you and they share in plain words. what_to_explore: one question the two of them could talk through. Evidence: for each side, the field it comes from and a short quote (at most 16 words) close to that snapshot's own words. opener: the first message "you" could send them, in a resident's own casual voice, at most 40 words: name the specific thing you share, then one small, concrete ask (ten minutes, a coffee, one question). No greetings like "I hope you're well", no flattery.`;

const view = (s: Snapshot) =>
  `id: ${s.resident_id}\nname: ${s.name}\nintent: ${s.intent ?? "unknown"}\nproblem: ${s.problem ?? "unknown"}\napproach: ${s.approach.join(", ") || "unknown"}\ncurrent_frontier: ${s.current_frontier ?? "unknown"}\ncan offer: ${s.contribution.can_offer.join(", ") || "none"}\nseeking: ${s.contribution.seeking.join(", ") || "none"}`;

export async function readConnections(me: Snapshot, others: Snapshot[]): Promise<Connection[]> {
  if (!others.length) return [];
  const out = await ask(ConnectionsOut, `${FORCE}\n\n${CONNECT_TASK}`, `You:\n${view(me)}\n\nOther residents:\n\n${others.map(view).join("\n\n")}`);
  const byId = new Map(others.map((s) => [s.resident_id, s]));
  return out.connections
    .filter((c) => byId.has(c.resident_id) && c.resident_id !== me.resident_id)
    .slice(0, 3)
    .map((c) => {
      const o = byId.get(c.resident_id)!;
      return {
        id: `auto_${me.resident_id}_${o.resident_id}`,
        source: `person_${me.resident_id}`,
        target: `person_${o.resident_id}`,
        type: c.type as ConnectionType,
        why_connected: c.why_connected.trim(),
        what_to_explore: c.what_to_explore.trim(),
        evidence_refs: [me.id, o.id],
        evidence: [
          { snapshot_id: me.id, field: c.your_evidence.field as Field, text: c.your_evidence.text },
          { snapshot_id: o.id, field: c.their_evidence.field as Field, text: c.their_evidence.text },
        ],
        origin: "automated" as const,
        opener: c.opener.trim(),
      };
    });
}

// ── What's public about you ──
// Only when the resident has said yes, only from public pages, and only what can be tied to
// them with confidence. Every finding carries its sources so they can check it and remove it.

const FootprintOut = z.object({
  findings: z.array(
    z.object({
      label: z.string(),
      text: z.string(),
      sources: z.array(z.object({ title: z.string(), url: z.string() })),
    }),
  ),
  read: z.array(z.string()),
});

const FOOTPRINT_TASK = `The resident has asked Force to read what's public about them, so it can understand them better before the residency. Use web search and web fetch.

1. Start from the links they gave. Fetch them; if a site blocks fetching (LinkedIn and X often do), use what search results show about that page.
2. Then search their name together with details from those pages, to find talks, articles, interviews, projects, things they've made, and tastes they've shared publicly (writing, Substack, Goodreads, Letterboxd, a portfolio).
3. Keep only what you're confident is this same person. When in doubt, leave it out.
4. Never include private details even if you find them: home address, phone, email, family, finances, health, or anything about purchases.

Return three to six findings, each with a short label (such as "Known for", "Background", "Makes", "Writes about", "Into", "Recently"), one or two sentences written to them in second person, and the sources it came from (page title and URL). In "read", list up to six places you actually read, each one to three words with no explanation (for example "igochi.studio", "GitHub", "2 articles"). If nothing can be confidently tied to them, return no findings.`;

export async function readFootprint(name: string, links: string[]): Promise<{ findings: Finding[]; read: string[] }> {
  const user = `Name: ${name}\nLinks they gave:\n${links.length ? links.map((l) => `- ${l}`).join("\n") : "- none"}`;
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: user }];
  for (let turn = 0; turn < 4; turn++) {
    const res = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(FootprintOut) },
      system: `${FORCE}\n\n${FOOTPRINT_TASK}`,
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: 6 },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: 6 },
      ],
      messages,
    });
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    if (res.stop_reason === "refusal") throw new Error("declined");
    const out = res.parsed_output;
    if (!out) throw new Error("unreadable");
    return {
      findings: out.findings.slice(0, 6).map((f, i) => ({ id: `f${i}`, label: f.label.trim(), text: f.text.trim(), sources: f.sources.filter((x) => /^https?:\/\//.test(x.url)).slice(0, 4) })),
      read: out.read.map((x) => x.trim()).filter((x) => x && x.length <= 32).slice(0, 6),
    };
  }
  throw new Error("took too long");
}
