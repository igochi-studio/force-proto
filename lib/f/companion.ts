// What Force says back. Short, warm, a little witty, and specific to her: it uses what it
// remembers, offers a choice instead of a verdict, and never decides for her. Two or three
// lines at most; anything longer belongs in a thread.

import { detectThemes, themeById, type Entry } from "@/data/mira";
import { PEOPLE, questOfTheme } from "@/data/social";
import type { Msg, Opt } from "./store";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const when = (d: string) => `${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;

const FOLLOW = ["Say more?", "What part of that is still with you?", "And how did that sit with you?", "What would you want to happen next?"];

const ASKED: Record<string, string> = {
  ambition: "What would a good week at work leave room for?",
  workshop: "What were your hands doing?",
  aai: "What would you want her to know this week?",
  running: "Where did it go quiet?",
  nights: "Solve it tonight, or set it down till morning?",
};

// The most recent time she said something close, quoted short.
function lastSaid(entries: Entry[], theme: string) {
  const past = entries.filter((e) => e.themes.includes(theme)).sort((a, b) => b.date.localeCompare(a.date));
  return past.length >= 2 ? { n: past.length, last: past[0] } : null;
}

const has = (t: string, ...ws: string[]) => ws.some((w) => new RegExp(`\\b${w}`, "i").test(t));

export function replyTo(input: { kind: "text" | "audio" | "image" | "video"; text: string }, chat: Msg[], entries: Entry[]): { text: string; options?: Opt[] } {
  const mineSoFar = chat.filter((m) => m.from === "me").length;
  const t = input.text;
  const mira = entries.length > 0;

  if (input.kind === "image" || input.kind === "video") return { text: mineSoFar > 1 ? "Kept. What made you want this one?" : "Kept. What's happening in it?" };

  // Quick replies she tapped
  if (/^something solo$/i.test(t))
    return mira
      ? { text: "Then the table. Dev's downstairs till 9 and that chair sketch is still half-done. One hour?", options: [{ label: "Going" }, { label: "Not tonight" }] }
      : { text: "A long walk somewhere you've never turned left. Phone on silent. Go?", options: [{ label: "Going" }, { label: "Not tonight" }] };
  if (/^something social$/i.test(t))
    return {
      text: "Two people on your side quests are nearby. Kavya has a spare bench at her makerspace Saturday. Leah's group runs Sankey Sunday at 6:15.",
      options: [
        { label: "Kavya", go: "energy:kavya" },
        { label: "Leah", go: "energy:leah" },
      ],
    };
  if (/^going$/i.test(t)) return { text: "Good. Tell me how it went after. I'll keep it with your side quests." };
  if (/^not tonight$/i.test(t)) return { text: "Fair. Rest counts too. Want me to hold it for Saturday?", options: [{ label: "Hold it" }, { label: "Let it go" }] };
  if (/^(hold it|let it go)$/i.test(t)) return { text: /hold/i.test(t) ? "Held. Saturday, the table." : "Gone. No guilt." };

  // Point A: bored, stuck, wanting a plan
  if (has(t, "bored", "scroll", "nothing to do", "what should i do", "plan", "weekend", "tonight"))
    return {
      text: mira ? "You always say your best weeks have one unplanned thing in them. Let's make one. Solo, or with people?" : "Let's make tonight count. Solo, or with people?",
      options: [{ label: "Something solo" }, { label: "Something social" }],
    };
  if (has(t, "stuck", "don't know", "confused", "lost", "struggling"))
    return { text: "Okay. In one line: what's the part you keep circling?" };

  const themes = detectThemes(t);
  const said = chat.filter((m) => m.from === "force" && m.kind === "text").map((m) => (m as { text: string }).text).join(" ");
  const fresh = themes.find((th) => !said.includes(`“${themeById(th)!.name}”`) && !said.includes(ASKED[th]));

  if (input.kind === "audio") return fresh ? { text: `Got it. That's ${themeById(fresh)!.name.toLowerCase()} again. ${ASKED[fresh]}` } : { text: "Got it. Keep going, I'm listening." };

  if (fresh) {
    const quest = questOfTheme(fresh);
    const seen = lastSaid(entries, fresh);
    const others = quest ? PEOPLE.filter((p) => p.shares === quest.id).length : 0;
    const opts: Opt[] = [{ label: "Map this", go: "pattern" }];
    if (quest && others) opts.push({ label: "Same energy", go: "energy" });
    if (seen) return { text: `${seen.n} times now, last in ${when(seen.last.date)}. ${ASKED[fresh]}`, options: opts };
    return { text: ASKED[fresh], options: opts };
  }

  return { text: FOLLOW[(mineSoFar - 1 + FOLLOW.length) % FOLLOW.length] };
}
