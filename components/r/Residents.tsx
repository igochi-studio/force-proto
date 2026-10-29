"use client";

// Home, for the residency, in the order you meet it: you (your face, top left, opens your
// snapshot), then two tabs:
//   People: the cohort graph. Everyone who approved and shared their snapshot, what each of
//   them wants to change, and the themes between them; tap any node to go deeper. Under it,
//   your connections, each with its reason. Zero is an honest answer; nothing is added to
//   make the map look fuller.
//   Conversations: Force first, then everyone here, open threads on top.
// Under both, the side quests, as a preview of what comes after the residency.

import { useMemo } from "react";
import { motion } from "motion/react";
import { ART_SRC } from "@/data/mira";
import { CONNECTION_LABEL, type Connection } from "@/contract/residency";
import { ME_FACE, RESIDENTS, cohortWorld, residentById, type NodeKind, type WNode } from "@/data/residency";
import { f, useF } from "@/lib/f/store";
import { r, useR } from "@/lib/f/residency";
import Face from "../f/Face";
import Glass from "../f/Glass";
import MapFrame from "./MapFrame";
import { Badge } from "./Connection";
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
  const snapshot = useR((s) => s.snapshot);
  // Under your name: what you're here for, in a few words, or where your snapshot stands.
  const line = snapshot?.titles?.intent ? `Here for: ${snapshot.titles.intent.toLowerCase()}` : snapshot?.status === "approved" ? (snapshot.shared ? "Shared with the residency" : "Approved, private") : "Your snapshot";
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ paddingTop: "var(--sat)", paddingBottom: "var(--sab)" }}>
      {/* You first, on your own row; then the two halves of the residency underneath */}
      <header className="shrink-0 px-4 pt-3">
        <button type="button" aria-label={`${name || "You"}: what Force understands about you`} onClick={() => (haptic(), f.push({ name: "persona" }))} className="press flex w-full items-center gap-3 rounded-full text-left">
          <Glass size={44} {...ME_FACE} zoom={260} />
          <span className="min-w-0 flex-1">
            <span className="block truncate t-body font-semibold text-ink">{name.trim() || "You"}</span>
            <span className="block truncate t-label text-ink-3">{line}</span>
          </span>
          <I.Chevron size={16} className="shrink-0 text-ink-4" />
        </button>
        <div className="mt-3 flex h-11 rounded-full bg-paper p-1" style={{ boxShadow: "var(--lift-1)" }} role="tablist">
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
  // Only the people you've actually talked to, newest first. Everyone else is in People.
  const people = RESIDENTS.filter((p) => dms[p.id]?.length).sort((a, b) => (dms[b.id]?.length ?? 0) - (dms[a.id]?.length ?? 0));
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
      {!people.length && <li className="px-1 pt-2 t-label text-ink-3">Say hi to someone in People and your conversation shows up here.</li>}
    </ul>
  );
}

// ── People: the cohort graph ──

const KIND: Record<NodeKind, string> = { you: "You", person: "In the residency", intent: "Intent & problem", theme: "Theme & approach" };

// Names in a sentence: "Meera, Zoya and you".
const names = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : (xs[0] ?? ""));

function People() {
  const { graph, mine, failed } = useCohort();
  const me = useR((s) => s.me);
  const snapshot = useR((s) => s.snapshot);
  const linking = useR((s) => s.linking);
  const world = useMemo(() => cohortWorld(graph, me), [graph, me]);
  const inGraph = world.nodes.some((x) => x.kind === "you");
  const residents = world.nodes.filter((x) => x.kind === "person").length;
  const connOf = (id: string) => mine.find((c) => otherIn(c, me) === id);
  // Everyone in the graph, the ones Force connected you with first.
  const people = world.nodes
    .filter((x) => x.kind === "person" && x.person)
    .map((x) => residentById(x.person!))
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => Number(!!connOf(b.id)) - Number(!!connOf(a.id)));
  const byId = useMemo(() => new Map(world.nodes.map((x) => [x.id, x])), [world]);
  const around = (id: string) => world.edges.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : [])).map((x) => byId.get(x)!).filter(Boolean);
  const who = (rid?: string) => (rid === me ? "you" : (residentById(rid ?? "")?.name ?? "someone"));
  // What Force can say about a node by putting the cohort together.
  const readOf = (n: WNode): { head: string; body: string } | null => {
    if (n.kind === "theme") {
      const people = [...new Set(around(n.id).filter((x) => x.kind === "intent").map((x) => who(x.person)))];
      return { head: "Who works through this", body: people.length > 1 ? `${names(people)} all work through ${n.label.toLowerCase()}.` : `Only ${people[0]} so far.` };
    }
    if (n.kind === "intent" && n.person !== me) {
      const theirs = new Set(around(n.id).filter((x) => x.kind === "theme").map((x) => x.label));
      const yours = around(`intent_${me}`).filter((x) => x.kind === "theme" && theirs.has(x.label)).map((x) => x.label.toLowerCase());
      return inGraph ? { head: "Next to yours", body: yours.length ? `You both work through ${names(yours)}.` : "Nothing in common with yours yet, which can be a reason to talk too." } : null;
    }
    if (n.kind === "person") {
      const c = n.person ? connOf(n.person) : undefined;
      if (c) return { head: "Why you're connected", body: c.why_connected };
      const intent = around(n.id).find((x) => x.kind === "intent");
      return intent ? { head: "Working on", body: intent.label } : null;
    }
    return null;
  };

  return (
    <div>
      <p className="mb-3 flex items-baseline gap-2 px-1">
        <span className="t-large text-ink">{residents + (inGraph ? 1 : 0)}</span>
        <span className="t-body text-ink-3">{inGraph ? `people in the graph, you included${mine.length ? ` · ${mine.length} worth meeting` : ""}` : "residents have shared what they're working on"}</span>
      </p>
      <MapFrame
        nodes={world.nodes}
        edges={world.edges}
        layout="cohort"
        height={400}
        title="The residency"
        card={(n, setFocus) => {
          const res = n.kind === "person" && n.person ? residentById(n.person) : null;
          const read = readOf(n);
          return (
            <motion.div key={n.id} className="mt-2 rounded-[24px] bg-paper p-4" style={{ boxShadow: "var(--lift-1)" }} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={SPRING.ui}>
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block t-meta text-ink-3">{n.kind === "intent" ? `What ${who(n.person)} want${n.person === me ? "" : "s"} to change` : KIND[n.kind]}</span>
                  <span className="mt-[2px] block t-body font-semibold text-ink">{res ? `${res.name} · ${res.work}` : n.label}</span>
                </span>
                <button type="button" aria-label="Close" onClick={() => setFocus(null)} className="press hit grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fill text-ink">
                  <I.Close size={14} />
                </button>
              </div>
              {read && (
                <div className="mt-3 rounded-[20px] bg-fill px-4 py-3">
                  <p className="flex items-center gap-2 t-meta text-ink-3">
                    <Glass size={20} art={n.art} zoom={320} /> {read.head}
                  </p>
                  <p className="mt-2 t-body text-ink">{read.body}</p>
                </div>
              )}
              {around(n.id).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-[6px]">
                  {around(n.id).map((l) => (
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
          );
        }}
      />

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

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="t-body text-ink-3">People here</h2>
          {inGraph && <span className="t-meta text-ink-3">{linking ? "Force is reading everyone next to you…" : mine.length ? `${mine.length} worth meeting first` : "No clear match yet"}</span>}
        </div>
        <ul className="grid grid-cols-2 gap-3">
          {people.map((p) => {
            const c = connOf(p.id);
            return (
              <li key={p.id} className="flex flex-col rounded-[24px] bg-paper p-3 pt-5" style={{ boxShadow: "var(--lift-1)" }}>
                <button type="button" onClick={() => (haptic(), f.push({ name: "connection", id: p.id }))} className="press flex flex-1 flex-col items-center text-center" aria-label={`${p.name}${c ? `, ${CONNECTION_LABEL[c.type]}` : ""}`}>
                  <span className="relative">
                    <Face face={p.face} size={64} />
                    {c && (
                      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                        <Badge c={c} />
                      </span>
                    )}
                  </span>
                  <span className="mt-4 t-body font-semibold text-ink">{p.name}</span>
                  <span className="mt-[2px] line-clamp-2 t-meta text-ink-3">{p.work}</span>
                  {c && <span className="mt-2 line-clamp-4 t-label text-ink-2">{c.why_connected}</span>}
                </button>
                <button type="button" onClick={() => (haptic(), f.push({ name: "connection", id: p.id, say: true }))} className="press mt-3 h-9 w-full rounded-full bg-fill t-label font-medium text-ink">
                  Say hi
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <p className="mt-4 px-1 t-meta text-ink-3">Only approved, shared snapshots are in the graph.</p>
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
