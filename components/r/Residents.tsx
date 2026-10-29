"use client";

// Home, for the residency, in the order you meet it: you (your face, top left, opens your
// snapshot), then two tabs:
//   People: the cohort graph. Everyone who approved and shared their snapshot, what each of
//   them wants to change, and the themes between them; tap any node to go deeper. Under it,
//   your connections, each with its reason. Zero is an honest answer; nothing is added to
//   make the map look fuller.
//   Conversations: Force first, then everyone here, open threads on top.
// Under both, the side quests, as a preview of what comes after the residency.

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ART_SRC } from "@/data/mira";
import { CONNECTION_LABEL, type Connection } from "@/contract/residency";
import { ME_FACE, RESIDENTS, cohortWorld, residentById, type NodeKind } from "@/data/residency";
import { f, useF } from "@/lib/f/store";
import { r, useR } from "@/lib/f/residency";
import Face from "../f/Face";
import Glass from "../f/Glass";
import PatternWorld from "./PatternWorld";
import { otherIn, useCohort } from "@/lib/r/cohort";
import { I, Logo, SPRING, haptic } from "../f/ui";


const thread = (id: string, c?: Connection) => {
  haptic();
  f.openThread(id, c ? { why: c.why_connected, explore: c.what_to_explore } : undefined);
  f.push({ name: "dm", id });
};

type Tab = "conversations" | "people";

export default function Residents() {
  const tab = useR((s) => s.tab);
  const name = useR((s) => s.name);
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ paddingTop: "var(--sat)", paddingBottom: "var(--sab)" }}>
      {/* You first, then the people who share your patterns, then what you've started with them */}
      <header className="flex h-[60px] shrink-0 items-center gap-3 px-4 pt-2">
        <button type="button" aria-label={`${name || "You"}: who Force thinks you are`} onClick={() => (haptic(), f.push({ name: "persona" }))} className="press shrink-0 rounded-full">
          <Glass size={44} {...ME_FACE} zoom={260} />
        </button>
        <div className="flex h-11 flex-1 rounded-full bg-paper p-1" style={{ boxShadow: "var(--lift-1)" }} role="tablist">
          {(["people", "conversations"] as Tab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => (haptic(), r.setTab(t))} className={`relative flex-1 rounded-full t-label font-medium transition-colors duration-200 ${tab === t ? "text-paper" : "text-ink-2"}`}>
              {tab === t && <motion.span layoutId="home-tab" className="absolute inset-0 rounded-full bg-ink" transition={SPRING.ui} />}
              <span className="relative">{t === "conversations" ? "Conversations" : "People"}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-4">
        {tab === "conversations" ? <Conversations /> : <People />}
        <SideQuests />
      </div>
    </div>
  );
}

// ── Conversations ──

function Row({ onClick, icon, title, line, tag }: { onClick: () => void; icon: React.ReactNode; title: string; line: string; tag?: string }) {
  return (
    <button type="button" onClick={onClick} className="press flex h-[68px] w-full items-center gap-3 rounded-full bg-paper pl-3 pr-4 text-left" style={{ boxShadow: "var(--lift-1)" }}>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate t-body font-medium text-ink">{title}</span>
          {tag && <span className="shrink-0 rounded-full bg-fill px-2 py-[1px] t-meta text-ink-2">{tag}</span>}
        </span>
        <span className="block truncate t-label text-ink-3">{line}</span>
      </span>
      <I.Chevron size={16} className="shrink-0 text-ink-4" />
    </button>
  );
}

function Conversations() {
  const dms = useF((s) => s.dms);
  const me = useR((s) => s.me);
  const { mine } = useCohort();
  const conn = (id: string) => mine.find((c) => otherIn(c, me) === id);
  const last = (id: string) => {
    const m = dms[id];
    const x = m ? ([...m].reverse().find((y) => y.from !== "force") ?? m[m.length - 1]) : null;
    return x ? (x.from === "me" ? `You: ${x.text}` : x.text) : null;
  };
  // Threads you've opened first, then the ones nearest your patterns, then everyone.
  const people = [...RESIDENTS].sort((a, b) => Number(!!dms[b.id]) - Number(!!dms[a.id]) || Number(!!conn(b.id)) - Number(!!conn(a.id)));
  return (
    <ul className="flex flex-col gap-2">
      <li>
        <Row
          onClick={() => (haptic(), f.push({ name: "force" }))}
          icon={
            <Glass size={44} art="dusk" x={40} y={40} zoom={300}>
              <Logo size={20} />
            </Glass>
          }
          title="Force"
          line="Talk, type or add a photo. It all becomes memory."
        />
      </li>
      {people.map((p) => (
        <li key={p.id}>
          <Row onClick={() => thread(p.id, conn(p.id))} icon={<Face face={p.face} size={44} />} title={p.name} line={last(p.id) ?? p.work} tag={conn(p.id) ? CONNECTION_LABEL[conn(p.id)!.type] : undefined} />
        </li>
      ))}
    </ul>
  );
}

// ── People: the cohort graph ──

const KIND: Record<NodeKind, string> = { you: "You", person: "In the residency", intent: "Intent & problem", theme: "Theme & approach" };

function People() {
  const { graph, mine, failed } = useCohort();
  const me = useR((s) => s.me);
  const snapshot = useR((s) => s.snapshot);
  const world = useMemo(() => cohortWorld(graph, me), [graph, me]);
  const [focus, setFocus] = useState<string | null>(null);
  const n = world.nodes.find((x) => x.id === focus) ?? null;
  const near = n ? world.edges.flatMap(([a, b]) => (a === n.id ? [b] : b === n.id ? [a] : [])).map((id) => world.nodes.find((x) => x.id === id)!).filter(Boolean) : [];
  const inGraph = world.nodes.some((x) => x.kind === "you");
  const residents = world.nodes.filter((x) => x.kind === "person").length;
  const res = n?.kind === "person" && n.person ? residentById(n.person) : null;
  const connOf = (id: string) => mine.find((c) => otherIn(c, me) === id);

  return (
    <div>
      <div className="relative h-[400px] overflow-hidden rounded-[28px] bg-paper" style={{ boxShadow: "var(--lift-1)" }}>
        <PatternWorld nodes={world.nodes} edges={world.edges} focus={focus} onTap={setFocus} layout="cohort" />
        {!n && <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-fill px-3 py-[6px] t-meta text-ink-3">Drag to turn · tap a node</span>}
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {n && (
          <motion.div key={n.id} className="mt-2 rounded-[24px] bg-paper p-4" style={{ boxShadow: "var(--lift-1)" }} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={SPRING.ui}>
            <div className="flex items-start gap-3">
              <span className="min-w-0 flex-1">
                <span className="block t-meta text-ink-3">{KIND[n.kind]}</span>
                <span className="mt-[2px] block t-body font-semibold text-ink">{res ? `${res.name} · ${res.work}` : n.label}</span>
                {res && connOf(res.id) && <span className="mt-1 block t-label text-ink-2">{connOf(res.id)!.why_connected}</span>}
                {!res && n.line && <span className="mt-1 block t-label text-ink-2">{n.line}</span>}
              </span>
              <button type="button" aria-label="Close" onClick={() => setFocus(null)} className="press hit grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fill text-ink">
                <I.Close size={14} />
              </button>
            </div>
            {near.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-[6px]">
                {near.map((l) => (
                  <button key={l.id} type="button" onClick={() => (haptic(), setFocus(l.id))} className="press hit h-8 max-w-full truncate rounded-full bg-fill px-3 t-label text-ink">
                    {l.title}
                  </button>
                ))}
              </div>
            )}
            {res && (
              <button type="button" onClick={() => (haptic(), f.push({ name: "connection", id: res.id }))} className="press pill-ink mt-3 h-11 w-full justify-center t-body font-medium">
                {connOf(res.id) ? "Why you're connected" : `About ${res.name}`}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {failed && <p className="mt-3 rounded-[24px] bg-fill p-4 t-label text-ink-2">Couldn&apos;t load the latest graph. Showing what Force had; it tries again when your snapshot changes.</p>}

      {!inGraph && (
        <div className="mt-3 rounded-[28px] bg-paper p-5" style={{ boxShadow: "var(--lift-1)" }}>
          <p className="t-body font-semibold text-ink">You&apos;re not in the graph yet</p>
          <p className="mt-1 t-label text-ink-3">{snapshot?.status === "approved" ? "Your snapshot is approved but private. Share it with the residency to appear here and get connections." : "Approve your snapshot and choose to share it, and Force can suggest people for you."}</p>
          <button type="button" onClick={() => (haptic(), f.push({ name: "persona" }))} className="press mt-4 h-11 w-full rounded-full bg-fill t-body font-medium text-ink">
            Review your snapshot
          </button>
        </div>
      )}

      {inGraph && (
        <section className="mt-8">
          <h2 className="mb-3 px-1 t-body text-ink-3">Your connections</h2>
          {mine.length ? (
            <ul className="flex flex-col gap-2">
              {mine.map((c) => {
                const p = residentById(otherIn(c, me));
                if (!p) return null;
                return (
                  <li key={c.id}>
                    <button type="button" onClick={() => (haptic(), f.push({ name: "connection", id: p.id }))} className="press flex w-full items-start gap-3 rounded-[28px] bg-paper p-4 text-left" style={{ boxShadow: "var(--lift-1)" }}>
                      <Face face={p.face} size={44} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="t-body font-medium text-ink">{p.name}</span>
                          <span className="rounded-full bg-fill px-2 py-[1px] t-meta text-ink-2">{CONNECTION_LABEL[c.type]}</span>
                        </span>
                        <span className="mt-1 block t-label text-ink-2">{c.why_connected}</span>
                        <span className="mt-1 flex items-center gap-[6px] t-meta text-ink-3">
                          <span className="h-[6px] w-[6px] rounded-full" style={{ background: c.origin === "reviewed" ? "var(--sage-4)" : "var(--grey-300)" }} aria-hidden />
                          {c.origin === "reviewed" ? "Reviewed" : "Suggested by Force"}
                        </span>
                      </span>
                      <I.Chevron size={16} className="mt-3 shrink-0 text-ink-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-[28px] bg-fill p-5 t-body text-ink-2">No connections yet. Force only suggests one when it can say why, from both people&apos;s snapshots. More residents are sharing through the day.</p>
          )}
        </section>
      )}
      <p className="mt-4 px-1 t-meta text-ink-3">
        {residents + (inGraph ? 1 : 0)} {residents + (inGraph ? 1 : 0) === 1 ? "person has" : "people have"} approved and shared so far. Only approved, shared snapshots are in the graph.
      </p>
    </div>
  );
}

// ── Side quests: after the residency ──
// A preview of where Force is going: what you and someone here could go and do together.
// Not part of the residency build, so the covers are shown, not opened.
function SideQuests() {
  const quests = RESIDENTS.filter((p) => p.quest);
  const odd = quests.length % 2 === 1;
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="t-body text-ink-3">Side quests</h2>
        <span className="rounded-full bg-fill px-2 py-[2px] t-meta text-ink-2">Coming after the residency</span>
      </div>
      <p className="mb-3 px-1 t-label text-ink-3">Where Force is heading: something real to do together, picked from the patterns you share.</p>
      <ul className="grid grid-cols-2 gap-3" aria-label="Side quests, coming after the residency">
        {quests.map((p, i) => {
          const wide = odd && i === quests.length - 1;
          return (
            <li key={p.id} className={wide ? "col-span-2" : ""}>
              <div className={`relative w-full overflow-hidden rounded-[24px] bg-cover ${wide ? "aspect-[2/1]" : "aspect-[4/5]"}`} style={{ backgroundImage: `url(${ART_SRC[p.face.art]})`, backgroundPosition: `${p.face.x}% ${p.face.y}%`, boxShadow: "var(--lift-1)" }}>
                <span className="absolute inset-0 grid place-items-center p-3">
                  <span className="max-w-full rounded-[16px] px-3 py-[6px] text-center t-label font-medium text-paper backdrop-blur-md" style={{ background: "rgb(28 27 26 / 0.28)" }}>
                    {p.quest}
                  </span>
                </span>
                <span className="absolute bottom-3 left-3 flex items-center gap-[6px] rounded-full py-[3px] pl-[3px] pr-2 t-meta text-paper backdrop-blur-md" style={{ background: "rgb(28 27 26 / 0.28)" }}>
                  <Face face={p.face} size={18} />
                  With {p.name}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
