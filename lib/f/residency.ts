"use client";

// The residency's own state: who you are, what you connected, your three answers, and the
// persona Force read from them, with your edits. Saved in the browser; a visit starts fresh
// unless the address has ?keep=1.

import { create } from "zustand";
import type { Clip } from "@/data/mira";
import { foundFor, pointsFrom, type Found, type LinkKind, type Point } from "@/data/residency";

export type Fit = "spot" | "mostly" | "no";

interface R {
  done: boolean;
  name: string;
  links: Partial<Record<LinkKind, string>>;
  extra: string[]; // links that aren't one of the five
  onairos: "off" | "busy" | "on";
  answers: string[];
  points: Point[];
  found: Found[];
  removed: string[]; // found items that weren't you
  fit: Fit | null;
  clips: Clip[]; // your recorded answers, for this visit only (the audio doesn't survive a refresh)
  agreed: string[]; // points you said were you
  tab: "conversations" | "people"; // which half of home is showing
  tip: boolean; // you've seen how to correct the patterns
}

const KEY = "force.residency";
const FRESH: R = { done: false, name: "", links: {}, extra: [], onairos: "off", answers: [], points: [], found: [], removed: [], fit: null, clips: [], agreed: [], tab: "people", tip: false };

// For the residency demo every visit starts from the beginning, decided here, before anything
// renders, so there's never a flash of last visit. ?keep=1 picks up where you left off.
const load = (): R => {
  try {
    if (typeof window === "undefined" || new URLSearchParams(window.location.search).get("keep") !== "1") return FRESH;
    const s = localStorage.getItem(KEY);
    return s ? { ...FRESH, ...JSON.parse(s), clips: [], onairos: JSON.parse(s).onairos === "on" ? "on" : "off" } : FRESH;
  } catch {
    return FRESH;
  }
};

export const useR = create<R>(load);
const set = useR.setState;
const get = useR.getState;

useR.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, clips: [] }));
  } catch {}
});

// Once Force has read you, changing a link means reading what's online again. What you
// already said wasn't you stays gone, and your rewrites stay yours.
const reread = () => {
  const s = get();
  if (s.answers.length) set({ found: foundFor(s.name, s.links) });
};

export const r = {
  reread,
  setName(name: string) {
    set({ name });
    reread();
  },
  setLink(k: LinkKind, v: string) {
    set((s) => ({ links: { ...s.links, [k]: v } }));
    reread();
  },
  setExtra(i: number, v: string) {
    set((s) => ({ extra: s.extra.map((x, j) => (j === i ? v : x)) }));
  },
  addExtra() {
    set((s) => ({ extra: [...s.extra, ""] }));
  },
  // Connecting Onairos is simulated here; the real one is their OnairosButton.
  connectOnairos() {
    if (get().onairos !== "off") return;
    set({ onairos: "busy" });
    setTimeout(() => set({ onairos: "on" }), 1400);
  },
  // Three answers in: read them, with the links, into a first persona.
  read(answers: string[], clips: Clip[] = []) {
    const s = get();
    set({ answers, clips, points: pointsFrom(answers), found: foundFor(s.name, s.links), removed: [], fit: null, agreed: [] });
  },
  agree(id: string) {
    set((s) => ({ agreed: s.agreed.includes(id) ? s.agreed : [...s.agreed, id] }));
  },
  editPoint(id: string, text: string) {
    set((s) => ({ points: s.points.map((p) => (p.id === id ? { ...p, text } : p)) }));
  },
  dropPoint(id: string) {
    set((s) => ({ points: s.points.filter((p) => p.id !== id) }));
  },
  addPoint(text: string) {
    const t = text.trim();
    if (!t) return;
    set((s) => ({ points: [...s.points, { id: `own${Date.now()}`, text: t, why: "You added this." }] }));
  },
  notMe(id: string) {
    set((s) => ({ removed: [...s.removed, id] }));
  },
  undoNotMe() {
    set((s) => ({ removed: s.removed.slice(0, -1) }));
  },
  setFit(fit: Fit) {
    set({ fit });
  },
  finish(tab: R["tab"] = "people") {
    set({ done: true, tab });
  },
  tipSeen() {
    if (!get().tip) set({ tip: true });
  },
  setTab(tab: R["tab"]) {
    set({ tab });
  },
};

