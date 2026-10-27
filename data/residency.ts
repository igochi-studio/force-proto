// The residency: everyone here is already on Force. The three questions are about the work
// and the room, and the persona Force builds is read from them, from the links you gave, and
// from what's public. Mock data until the developers' agent output lands; every pattern still
// quotes or counts your own answers.

import type { Art } from "./mira";
import type { Person } from "./social";

export const QUESTIONS = [
  "What are you working on here? A sentence or two is plenty.",
  "What's the part of it you keep coming back to, even when nobody asks?",
  "What would make this residency a win for you, beyond the work?",
];

// What the analysis reads when the browser couldn't transcribe an answer.
export const SAMPLE_ANSWERS = [
  "I'm building a tool that helps small farmers in Maharashtra price their crops before they go to market. Right now it's a WhatsApp bot and a lot of phone calls.",
  "Honestly the calls. I keep going back to talking to the farmers themselves, even when I should be writing code. That's where I learn what to build.",
  "If I leave with two or three people I'd call at midnight about this, that's a win. And one decision I've been putting off, finally made.",
];

export type LinkKind = "linkedin" | "x" | "instagram" | "github" | "site";
export const LINKS: { kind: LinkKind; name: string; mark: string; placeholder: string }[] = [
  { kind: "linkedin", name: "LinkedIn", mark: "in", placeholder: "linkedin.com/in/you" },
  { kind: "x", name: "X", mark: "X", placeholder: "@handle" },
  { kind: "instagram", name: "Instagram", mark: "IG", placeholder: "@handle" },
  { kind: "github", name: "GitHub", mark: "GH", placeholder: "github.com/you" },
  { kind: "site", name: "Website or Substack", mark: "www", placeholder: "yoursite.com" },
];

// What each link tells Force, once it's read.
const FROM_LINK: Record<LinkKind, string> = {
  linkedin: "Founder, Mandi Price. Before that, product at a food delivery company.",
  x: "Posts mostly about farming, pricing and the odd cricket match.",
  instagram: "Photos from farm visits around Nashik.",
  github: "Twelve public projects, mostly Python, one WhatsApp bot.",
  site: "Three essays on how small producers set prices.",
};

export interface Found {
  id: string;
  source: string;
  text: string;
  byName?: boolean; // found by searching your name, not from a link you gave
}

export function foundFor(name: string, links: Partial<Record<LinkKind, string>>): Found[] {
  const first = name.trim() || "Someone with your name";
  const out: Found[] = LINKS.filter((l) => links[l.kind]?.trim()).map((l) => ({ id: l.kind, source: l.name, text: FROM_LINK[l.kind] }));
  out.push({ id: "talk", source: "Search", text: "Spoke on a panel about rural tech, Pune, 2024.", byName: true });
  out.push({ id: "namesake", source: "Search", text: `${first}, co-founder of a payments startup in Gurgaon.`, byName: true });
  return out;
}

// Onairos reads the apps you connect it to and hands back a personality read on the Big Five.
// Force shows it in words, never as numbers.
export const TRAITS: { name: string; read: string }[] = [
  { name: "Openness", read: "High. You go looking for new ways in." },
  { name: "Conscientiousness", read: "In bursts. Deep focus, then a reset." },
  { name: "Extraversion", read: "Middle. Energised one-to-one, drained by rooms." },
  { name: "Agreeableness", read: "High. You lead with the other person's side." },
  { name: "Emotional range", read: "Steady, with a short fuse for wasted time." },
];

export interface Point {
  id: string;
  text: string; // what Force thinks
  why: string; // what it's read from: a quote or a count
}

const STOP = new Set("about after again also always because been before being both could didn doing dont even every from have here into just know like little lot make more most much need only other really right said should some something still than that thats their them then there these they thing think this those through time very want what when where which while will with would your youre honestly finally okay yeah kind sort mean actually basically going thing maybe guess right well".split(" "));

// Your own words, short enough to read at a glance.
const clause = (s: string) => {
  const w = s.trim().replace(/[.!?]$/, "").split(/\s+/);
  return w.length <= 16 ? w.join(" ") : `${w.slice(0, 14).join(" ").replace(/[,;:]$/, "")}…`;
};

// A word you used in more than one answer, counted.
function repeated(answers: string[]) {
  const seen = new Map<string, Set<number>>();
  answers.forEach((a, i) =>
    a
      .toLowerCase()
      .replace(/[^a-z\s']/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/'s$/, "").replace(/s$/, ""))
      .filter((w) => w.length > 3 && !STOP.has(w))
      .forEach((w) => seen.set(w, (seen.get(w) ?? new Set()).add(i))),
  );
  return [...seen.entries()].filter(([, s]) => s.size > 1).sort((a, b) => b[1].size - a[1].size)[0];
}

export function pointsFrom(answers: string[]): Point[] {
  const a = answers.map((x, i) => x.trim() || SAMPLE_ANSWERS[i]);
  const r = repeated(a);
  const out: Point[] = [
    { id: "p1", text: "You learn by talking to people, not by reading about them.", why: `Answer 2: “${clause(a[1])}”` },
    { id: "p2", text: "You're building for someone specific, not for a market.", why: `Answer 1: “${clause(a[0])}”` },
    { id: "p3", text: "You came here for people more than for output.", why: `Answer 3: “${clause(a[2])}”` },
  ];
  if (r) out.push({ id: "p4", text: `“${r[0]}” is on your mind.`, why: `It came up in ${r[1].size === 3 ? "all three" : "two"} of your answers.` });
  return out;
}

export const MOVES = ["Ask Meera how she ran her first twenty farmer interviews", "Block one morning this week for the decision you've been putting off"];

// The residency. Faces are painting crops until the real photos come in.
export interface Resident extends Person {
  work: string; // what they're working on, in a line
  pattern?: string; // the pattern you share, when Force found one
}

const r = (p: Omit<Resident, "energy" | "age" | "where" | "km" | "story" | "differs" | "words" | "shares"> & { art: Art }): Resident => ({
  energy: p.pattern ? 0.8 : 0.4,
  age: 0,
  where: "In the residency",
  km: 0,
  story: p.work,
  differs: "",
  words: "",
  shares: "",
  ...p,
});

export const RESIDENTS: Resident[] = [
  r({
    id: "meera",
    name: "Meera",
    art: "meadow",
    face: { art: "meadow", x: 30, y: 25 },
    work: "Field research on how farming families borrow money",
    pattern: "You both learn by talking to people.",
    together: "You've both spent this month on the phone with farmers. Side quest: run one morning of calls together on Thursday, swap what you hear over lunch?",
    quests: [{ name: "Farmer credit research", art: "meadow" }, { name: "Learning Marathi properly", art: "park" }],
    reply: "Hi! Force says you're doing farmer calls too. I have a list of questions that took me months to get right, happy to share.",
  }),
  r({
    id: "kabir",
    name: "Kabir",
    art: "water",
    face: { art: "water", x: 70, y: 40 },
    work: "Cheap water sensors for village tanks",
    pattern: "You both build for someone specific.",
    together: "You're both building for villages you've actually visited. Side quest: a Saturday trip to the tank Kabir's testing at, an hour out of town?",
    quests: [{ name: "Water sensors", art: "water" }, { name: "Soldering on Sundays", art: "hills" }],
    reply: "Hey, I'm heading to the test site Saturday morning. There's a seat in the car if you want to see it.",
  }),
  r({
    id: "ananya",
    name: "Ananya",
    art: "dusk",
    face: { art: "dusk", x: 20, y: 70 },
    work: "A book about the markets of Pune",
    pattern: "You both came here for people.",
    together: "She's writing about markets, you're pricing what's sold in them. Side quest: walk Mandai market together early one morning?",
    quests: [{ name: "Writing a book", art: "dusk" }, { name: "Early morning walks", art: "meadow" }],
    reply: "Mandai at 6 is the best hour. I'm going Friday, come?",
  }),
  r({
    id: "dev",
    name: "Dev",
    art: "hills",
    face: { art: "hills", x: 60, y: 60 },
    work: "AI tutors for government schools",
    together: "You're both shipping to people who don't use apps much. Side quest: trade one user call each and sit in on the other's?",
    quests: [{ name: "Classroom tutors", art: "hills" }],
    reply: "Hi! Always up for comparing notes on building for people who don't live on their phones.",
  }),
  r({
    id: "zoya",
    name: "Zoya",
    art: "park",
    face: { art: "park", x: 45, y: 35 },
    work: "A documentary on the last letter-writers",
    together: "You both collect people's stories for a living. Side quest: an evening of recording, she films, you listen?",
    quests: [{ name: "Documentary", art: "park" }, { name: "Film photography", art: "dusk" }],
    reply: "Hello! Force thought we'd get on. I'm filming in the old city next week if you're curious.",
  }),
  r({
    id: "arjun",
    name: "Arjun",
    art: "water",
    face: { art: "water", x: 15, y: 80 },
    work: "Open maps for small towns",
    together: "His maps could show where your farmers sell. Side quest: one afternoon putting Nashik's markets on the map?",
    quests: [{ name: "Open maps", art: "water" }, { name: "Cycling", art: "meadow" }],
    reply: "Hey. If you send me the markets you know, I'll put them on the map this week.",
  }),
];

export const residentById = (id: string) => RESIDENTS.find((x) => x.id === id);
