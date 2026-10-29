"use client";

// The residency's own state: who you are, your three answers and what you offer and seek,
// Onairos, and the Intent Snapshot Force drafts from them, with your edits, your approval and
// your sharing choice. It survives a refresh and reopening (the v1.1 definition of done);
// ?reset=1 starts over.

import { create } from "zustand";
import type { Clip } from "@/data/mira";
import type { LinkKind } from "@/data/residency";
import { visible, type Connection, type Field, type NextStep, type OnairosNormalized, type Snapshot, type SynthInput } from "@/contract/residency";
import * as api from "@/lib/r/api";

interface R {
  done: boolean;
  me: string; // your resident id
  name: string;
  links: Partial<Record<LinkKind, string>>;
  extra: string[]; // links that aren't one of the five
  onairos: "off" | "busy" | "on" | "failed";
  persona: OnairosNormalized | null; // the normalized minimum; the raw payload is never kept
  answers: string[];
  contribution: { can_offer: string[]; seeking: string[] };
  snapshot: Snapshot | null;
  synth: "idle" | "busy" | "failed";
  mine: Connection[]; // your connections, once you've approved and shared
  linking: boolean; // Force is looking for them
  clips: Clip[]; // your recorded answers, for this visit only (the audio doesn't survive a refresh)
  tab: "conversations" | "people"; // which half of home is showing
  tip: boolean; // you've seen how to correct the snapshot
}

const KEY = "force.residency.v2";
const id = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const fresh = (): R => ({ done: false, me: id(), name: "", links: {}, extra: [], onairos: "off", persona: null, answers: [], contribution: { can_offer: [], seeking: [] }, snapshot: null, synth: "idle", mine: [], linking: false, clips: [], tab: "people", tip: false });

// Decided before anything renders, so there's never a flash of the wrong step.
const load = (): R => {
  try {
    if (typeof window === "undefined") return fresh();
    if (new URLSearchParams(window.location.search).get("reset") === "1") {
      localStorage.removeItem(KEY);
      return fresh();
    }
    const s = localStorage.getItem(KEY);
    if (!s) return fresh();
    const o = JSON.parse(s) as Partial<R>;
    // Work that was in flight when the page closed isn't any more.
    return { ...fresh(), ...o, clips: [], linking: false, onairos: o.onairos === "on" ? "on" : o.onairos === "busy" ? "off" : (o.onairos ?? "off"), synth: o.synth === "busy" ? (o.snapshot ? "idle" : "failed") : (o.synth ?? "idle") };
  } catch {
    return fresh();
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

const input = (): SynthInput => {
  const s = get();
  return { resident_id: s.me, name: s.name, answers: s.answers, contribution: s.contribution, onairos: s.persona };
};

// Who you're connected with follows what you've approved and shared, and nothing else.
const link = async () => {
  const s = get().snapshot;
  if (!s || !visible(s)) return set({ mine: [], linking: false });
  set({ linking: true });
  try {
    set({ mine: await api.connections(s), linking: false });
  } catch {
    set({ linking: false });
  }
};

// Every change to the snapshot goes through here. Changing what you approved means approving
// it again before the cohort sees the new version.
const patch = (fn: (s: Snapshot) => Snapshot) => {
  const s = get().snapshot;
  if (!s) return;
  const next = fn(s);
  set({ snapshot: { ...next, status: s.status === "approved" ? "pending_review" : next.status, updated_at: new Date().toISOString() } });
};

export const r = {
  setName(name: string) {
    set({ name });
    patch((s) => ({ ...s, name: name.trim() || "You" }));
  },
  setLink(k: LinkKind, v: string) {
    set((s) => ({ links: { ...s.links, [k]: v } }));
  },
  setExtra(i: number, v: string) {
    set((s) => ({ extra: s.extra.map((x, j) => (j === i ? v : x)) }));
  },
  addExtra() {
    set((s) => ({ extra: [...s.extra, ""] }));
  },
  // The real Onairos button hands its payload in as raw; without it, the labelled sample.
  async connectOnairos(raw?: unknown) {
    if (get().onairos === "busy" || get().onairos === "on") return;
    set({ onairos: "busy" });
    try {
      set({ persona: await api.onairos(raw), onairos: "on" });
    } catch {
      set({ onairos: "failed" });
    }
  },
  disconnectOnairos() {
    set({ onairos: "off", persona: null });
  },
  setAnswers(answers: string[], clips: Clip[] = []) {
    set({ answers, clips });
  },
  setContribution(c: R["contribution"]) {
    set({ contribution: c });
  },
  // Answers in: Force drafts the snapshot. A failure leaves a way on, never a spinner.
  async synthesize() {
    set({ synth: "busy" });
    try {
      const snap = await api.synthesize(input());
      set({ snapshot: snap, synth: "idle" });
    } catch {
      set({ synth: "failed" });
    }
  },
  useDraft() {
    set({ snapshot: api.draft(input()), synth: "idle" });
  },
  editField(k: Field, v: string | string[] | Snapshot["contribution"]) {
    patch((s) => {
      const value = k === "approach" ? (v as string[]).map((x) => x.trim()).filter(Boolean) : k === "contribution" ? (v as Snapshot["contribution"]) : ((v as string).trim() || null);
      return { ...s, [k]: value, provenance: { ...s.provenance, [k]: value && (!Array.isArray(value) || value.length) ? ["user_edit"] : [] }, inferred: k === "approach" ? [] : s.inferred };
    });
  },
  confirmField(k: Field) {
    patch((s) => ({ ...s, inferred: k === "approach" ? [] : s.inferred, provenance: { ...s.provenance, [k]: [...new Set([...(s.provenance[k] ?? []), "user_edit" as const])] } }));
  },
  nextStep(status: NextStep["status"]) {
    patch((s) => (s.next_step ? { ...s, next_step: { ...s.next_step, status } } : s));
  },
  // Your own wording, or your own step when Force had nothing good enough to suggest.
  writeNextStep(text: string) {
    const t = text.trim();
    if (!t) return;
    patch((s) => ({ ...s, next_step: { text: t, why_it_may_help: s.next_step?.why_it_may_help ?? "You chose this yourself.", status: "accepted", source: s.next_step && s.next_step.source !== "user" ? s.next_step.source : "user" } }));
  },
  // Sharing is its own choice. Once approved, turning it off takes you out of the graph now.
  async setShared(shared: boolean) {
    const s = get().snapshot;
    if (!s) return;
    if (s.status !== "approved") return set({ snapshot: { ...s, shared } });
    set({ snapshot: await api.approve(s, shared) });
    await link();
  },
  async approve() {
    const s = get().snapshot;
    if (!s) return;
    set({ snapshot: await api.approve(s, s.shared) });
    void link();
  },
  relink: link,
  finish(tab: R["tab"] = "people") {
    set({ done: true, tab });
  },
  tipSeen() {
    if (!get().tip) set({ tip: true });
  },
  setTab(tab: R["tab"]) {
    set({ tab });
  },
  startOver() {
    set(fresh());
  },
};
