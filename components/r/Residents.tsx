"use client";

// Home, for the residency: the conversations. Force first, because talking to it is how your
// memory grows. Then the side quests Force suggests with people here, then everyone in the
// residency, the ones who share a pattern with you on top.

import { RESIDENTS } from "@/data/residency";
import { MIRA_FACE } from "@/data/social";
import { f, useF } from "@/lib/f/store";
import { useR } from "@/lib/f/residency";
import Face from "../f/Face";
import { I, Logo, haptic } from "../f/ui";

const card = { boxShadow: "var(--lift-1)" };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const thread = (id: string) => {
  haptic();
  f.openThread(id);
  f.push({ name: "dm", id });
};

export default function Residents() {
  const dms = useF((s) => s.dms);
  const name = useR((s) => s.name);
  const people = [...RESIDENTS].sort((a, b) => Number(!!b.pattern) - Number(!!a.pattern));
  const quests = RESIDENTS.filter((p) => p.pattern).slice(0, 2);
  const last = (id: string) => {
    const m = dms[id];
    const x = m?.[m.length - 1];
    return x ? (x.from === "me" ? `You: ${x.text}` : x.text) : null;
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ paddingTop: "var(--sat)", paddingBottom: "var(--sab)" }}>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        <header className="flex items-center justify-between gap-3 px-1 pb-2 pt-6">
          <span className="min-w-0">
            <h1 className="t-large text-ink">Conversations</h1>
            <p className="mt-1 t-label text-ink-3">The residency · {RESIDENTS.length + 1} people on Force</p>
          </span>
          <button type="button" aria-label={`${name || "You"}: your persona`} onClick={() => (haptic(), f.push({ name: "persona" }))} className="press pill h-11 w-11 shrink-0 justify-center p-0">
            <Face face={MIRA_FACE} size={34} />
          </button>
        </header>

        <button type="button" onClick={() => (haptic(), f.push({ name: "force" }))} className="press mt-4 flex w-full items-center gap-3 rounded-[28px] bg-paper p-4 text-left" style={card}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-paper">
            <Logo size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block t-nav text-ink">Force</span>
            <span className="block t-label text-ink-3">Talk, type or add a photo. It all becomes your memory.</span>
          </span>
          <I.Chevron size={18} className="shrink-0 text-ink-4" />
        </button>

        <h2 className="mt-8 px-1 t-title text-ink">Side quests for you</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {quests.map((p, i) => (
            <li key={p.id}>
              <button type="button" onClick={() => thread(p.id)} className="press flex w-full gap-3 rounded-[28px] bg-fill p-4 text-left">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-paper t-label font-medium text-ink">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block t-body text-ink">{cap(p.together.split("Side quest: ")[1] ?? p.together)}</span>
                  <span className="mt-2 flex items-center gap-2 t-label text-ink-3">
                    <Face face={p.face} size={20} /> With {p.name} · {p.pattern}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <h2 className="mt-8 px-1 t-title text-ink">In the residency</h2>
        <ul className="mt-3 divide-y divide-[var(--line)] overflow-hidden rounded-[28px] bg-paper" style={card}>
          {people.map((p) => {
            const l = last(p.id);
            return (
              <li key={p.id}>
                <button type="button" onClick={() => thread(p.id)} className="press flex w-full items-center gap-3 px-4 py-3 text-left">
                  <Face face={p.face} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="t-nav text-ink">{p.name}</span>
                      {p.pattern && <span className="rounded-full bg-fill px-2 py-[2px] t-meta text-ink-2">Same pattern</span>}
                    </span>
                    <span className="block truncate t-label text-ink-3">{l ?? p.work}</span>
                  </span>
                  <I.Chevron size={18} className="shrink-0 text-ink-4" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
