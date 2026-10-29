"use client";

// "Here's what Force understands so far": your Intent Snapshot, the five parts Force drafted
// from your answers, each with where it came from, each yours to correct. Your map first
// (you, what you want to change, the approaches around it, the people you're connected with),
// then the five parts, one useful next step, what Onairos added, and two separate choices:
// approve it, and whether the residency can see it. Nothing that ranks you, nothing that grades your personality.
//
// Correcting works the way next moves do: swipe right if it's right, left if it isn't (it
// clears, for you to say it your way), tap to rewrite.

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { CONNECTION_LABEL, FIELDS, FIELD_LABEL, FIELD_MEANING, OFFER_TAGS, SEEK_TAGS, coverageLine, isEmpty, type Field, type Snapshot } from "@/contract/residency";
import { residentById, youWorld, type NodeKind } from "@/data/residency";
import { f } from "@/lib/f/store";
import { r, useR } from "@/lib/f/residency";
import { otherIn, useCohort } from "@/lib/r/cohort";
import Nav from "../f/Nav";
import PatternWorld from "./PatternWorld";
import { LinkList, NameField, OnairosCard } from "./Links";
import { I, SPRING, haptic } from "../f/ui";

// ── Your map ──
export function useYouWorld() {
  const snapshot = useR((s) => s.snapshot);
  const name = useR((s) => s.name);
  const { mine } = useCohort();
  return useMemo(() => youWorld(snapshot, name, mine), [snapshot, name, mine]);
}

const KIND: Record<NodeKind, string> = { you: "You", intent: "Intent & problem", theme: "Theme & approach", person: "Connected in the residency" };

function YouMap() {
  const world = useYouWorld();
  const [focus, setFocus] = useState<string | null>(null);
  const n = world.nodes.find((x) => x.id === focus) ?? null;
  const links = n ? world.edges.flatMap(([a, b]) => (a === n.id ? [b] : b === n.id ? [a] : [])).map((id) => world.nodes.find((x) => x.id === id)!) : [];
  const res = n?.person ? residentById(n.person) : null;
  return (
    <div>
      <div className="relative h-[300px] overflow-hidden rounded-[28px] bg-paper" style={{ boxShadow: "var(--lift-1)" }}>
        <PatternWorld nodes={world.nodes} edges={world.edges} focus={focus} onTap={setFocus} />
        {!n && <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-fill px-3 py-[6px] t-meta text-ink-3">Drag to turn · tap a node</span>}
      </div>
      <AnimatePresence initial={false} mode="popLayout">
        {n && (
          <motion.div key={n.id} className="mt-2 rounded-[24px] bg-paper p-4" style={{ boxShadow: "var(--lift-1)" }} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={SPRING.ui}>
            <div className="flex items-start gap-3">
              <span className="min-w-0 flex-1">
                <span className="block t-meta text-ink-3">{res ? n.from : KIND[n.kind]}</span>
                <span className="mt-[2px] block t-body font-semibold text-ink">{res ? `${res.name} · ${res.work}` : n.label}</span>
                {n.line && <span className="mt-1 block t-label text-ink-2">{n.line}</span>}
                {n.from && !res && <span className="mt-1 block t-label text-ink-3">{n.from}</span>}
              </span>
              <button type="button" aria-label="Close" onClick={() => setFocus(null)} className="press hit grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fill text-ink">
                <I.Close size={14} />
              </button>
            </div>
            {links.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-[6px]">
                {links.map((l) => (
                  <button key={l.id} type="button" onClick={() => (haptic(), setFocus(l.id))} className="press hit h-8 rounded-full bg-fill px-3 t-label text-ink">
                    {l.title}
                  </button>
                ))}
              </div>
            )}
            {res && (
              <button type="button" onClick={() => (haptic(), f.push({ name: "connection", id: res.id }))} className="press pill-ink mt-3 h-11 w-full justify-center t-body font-medium">
                Why you&apos;re connected
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Swipe to say ──
// The same gesture as a next move: pull right for yes, left for no.
// peek: once, on arrival, the card shows you both sides by itself, the way iOS Mail does.
function Swipe({ onRight, onLeft, right, left, children, className = "", style, peek }: { onRight?: () => void; onLeft: () => void; right?: string; left: string; children: React.ReactNode; className?: string; style?: React.CSSProperties; peek?: boolean }) {
  const x = useMotionValue(0);
  const dragged = useRef(false); // a drag that ends over a button isn't a tap on it
  useEffect(() => {
    if (!peek) return;
    const id = setTimeout(() => animate(x, [0, 84, 84, 0, -84, -84, 0], { duration: 2.6, times: [0, 0.16, 0.34, 0.5, 0.66, 0.84, 1], ease: "easeInOut" }), 900);
    return () => clearTimeout(id);
  }, [peek, x]);
  const rightA = useTransform(x, [0, 72], [0, 1]);
  const leftA = useTransform(x, [-72, 0], [1, 0]);
  return (
    <div className="relative overflow-hidden rounded-[28px]">
      {onRight && (
        <motion.span className="absolute inset-0 flex items-center gap-2 pl-5 t-body font-medium" style={{ opacity: rightA, color: "var(--sage-7)", background: "var(--sage-1)" }} aria-hidden>
          <I.Check size={18} /> {right}
        </motion.span>
      )}
      <motion.span className="absolute inset-0 flex items-center justify-end gap-2 pr-5 t-body font-medium" style={{ opacity: leftA, color: "var(--rose-7)", background: "var(--rose-1)" }} aria-hidden>
        {left} <I.Close size={18} />
      </motion.span>
      <motion.div
        className={`relative ${className}`}
        style={{ x, touchAction: "pan-y", ...style }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.6, right: onRight ? 0.6 : 0.05 }}
        onDragStart={() => (dragged.current = true)}
        onClickCapture={(e) => {
          if (!dragged.current) return;
          e.stopPropagation();
          e.preventDefault();
        }}
        onDragEnd={(_, i) => {
          setTimeout(() => (dragged.current = false), 0);
          if (onRight && (i.offset.x > 72 || i.velocity.x > 500)) {
            haptic("done");
            onRight();
          } else if (i.offset.x < -72 || i.velocity.x < -500) {
            haptic("soft");
            onLeft();
          }
        }}
      >
        {children}
      </motion.div>
      {/* The same choices without a swipe, for keyboards and screen readers */}
      <span className="sr-only">
        {onRight && (
          <button type="button" onClick={onRight}>
            {right}
          </button>
        )}
        <button type="button" onClick={onLeft}>
          {left}
        </button>
      </span>
    </div>
  );
}

// ── The five parts ──

const SOURCE: Record<string, string> = {
  "user_answer:q1": "From your answer to question 1",
  "user_answer:q2": "From your answer to question 2",
  "user_answer:q3": "From your answer to question 3",
  user_answer: "Read from the words in your answers",
  user_edit: "You said this",
  contribution_fields: "From what you picked",
};

function sourceOf(s: Snapshot, k: Field, onairos: boolean) {
  const p = s.provenance[k] ?? [];
  if (p.includes("user_edit")) return "You said this";
  const base = SOURCE[p[0]] ?? "";
  if (k === "approach" && s.inferred.length) return `${base}${p.includes("onairos:positive_traits") && onairos ? ", supported by Onairos" : ""}. A guess, so check it.`;
  return base;
}

function valueOf(s: Snapshot, k: Field) {
  if (k === "approach") return s.approach.join(" · ");
  if (k === "contribution") return [s.contribution.can_offer.length ? `Can offer: ${s.contribution.can_offer.join(", ")}` : "", s.contribution.seeking.length ? `Looking for: ${s.contribution.seeking.join(", ")}` : ""].filter(Boolean).join("\n");
  return s[k] ?? "";
}

function Tags({ tags, on, onFlip }: { tags: readonly string[]; on: string[]; onFlip: (t: string) => void }) {
  return (
    <div className="flex flex-wrap gap-[6px]">
      {[...tags, ...on.filter((x) => !tags.includes(x))].map((t) => (
        <button key={t} type="button" aria-pressed={on.includes(t)} onClick={() => (haptic(), onFlip(t))} className={`press h-9 rounded-full px-3 t-label transition-colors duration-200 ${on.includes(t) ? "bg-ink text-paper" : "bg-fill text-ink"}`}>
          {t}
        </button>
      ))}
    </div>
  );
}

function ContributionEdit({ s, onDone }: { s: Snapshot; onDone: () => void }) {
  const [offer, setOffer] = useState(s.contribution.can_offer);
  const [seek, setSeek] = useState(s.contribution.seeking);
  const flip = (set: React.Dispatch<React.SetStateAction<string[]>>) => (t: string) => set((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]));
  return (
    <div className="rounded-[28px] bg-paper p-4" style={{ boxShadow: "var(--lift-2)" }}>
      <p className="mb-2 t-label text-ink-3">I can help others with…</p>
      <Tags tags={OFFER_TAGS} on={offer} onFlip={flip(setOffer)} />
      <p className="mb-2 mt-4 t-label text-ink-3">I would value help with…</p>
      <Tags tags={SEEK_TAGS} on={seek} onFlip={flip(setSeek)} />
      <div className="mt-3 flex items-center justify-end gap-1">
        <button type="button" onClick={onDone} className="press h-9 px-3 t-label text-ink-3">
          Cancel
        </button>
        <button type="button" onClick={() => (r.editField("contribution", { can_offer: offer, seeking: seek }), onDone())} className="press h-9 rounded-full bg-ink px-4 t-label font-medium text-paper">
          Save
        </button>
      </div>
    </div>
  );
}

function FieldCard({ s, k, peek, onairos }: { s: Snapshot; k: Field; peek?: boolean; onairos: boolean }) {
  const [edit, setEdit] = useState<string | null>(null);
  const empty = isEmpty(s, k);
  if (edit !== null && k === "contribution") return <ContributionEdit s={s} onDone={() => setEdit(null)} />;
  if (edit !== null)
    return (
      <form
        className="rounded-[28px] bg-paper p-4"
        style={{ boxShadow: "var(--lift-2)" }}
        onSubmit={(e) => {
          e.preventDefault();
          r.editField(k, k === "approach" ? edit.split(",") : edit);
          setEdit(null);
        }}
      >
        <p className="t-meta text-ink-3">{FIELD_LABEL[k]}</p>
        <textarea value={edit} onChange={(e) => setEdit(e.target.value)} autoFocus rows={3} aria-label={`${FIELD_LABEL[k]}, in your words`} placeholder={FIELD_MEANING[k]} className="mt-1 block w-full resize-none bg-transparent t-body font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-3" />
        {k === "approach" && <p className="t-meta text-ink-3">Separate them with commas.</p>}
        <div className="mt-2 flex items-center justify-end gap-1">
          <button type="button" onClick={() => setEdit(null)} className="press h-9 px-3 t-label text-ink-3">
            Cancel
          </button>
          <button type="submit" className="press h-9 rounded-full bg-ink px-4 t-label font-medium text-paper">
            Save
          </button>
        </div>
      </form>
    );
  const open = () => setEdit(k === "approach" ? s.approach.join(", ") : k === "contribution" ? "" : (s[k] ?? ""));
  const said = (s.provenance[k] ?? []).includes("user_edit");
  if (empty)
    return (
      <button type="button" onClick={open} className="press block w-full rounded-[28px] bg-paper p-5 text-left" style={{ boxShadow: "var(--lift-1)" }}>
        <span className="block t-meta text-ink-3">{FIELD_LABEL[k]}</span>
        <span className="mt-1 block t-body text-ink-3">Force doesn&apos;t know this yet.</span>
        <span className="mt-2 flex items-center gap-1 t-label font-medium text-ink">
          <I.Plus size={14} /> {FIELD_MEANING[k]}
        </span>
      </button>
    );
  return (
    <Swipe peek={peek} right="That's right" left="Not right" onRight={() => (r.confirmField(k), r.tipSeen())} onLeft={() => (r.tipSeen(), open())} className="rounded-[28px] bg-fill p-5 pr-12">
      <span className="pointer-events-none absolute right-4 top-5 text-ink-4" aria-hidden>
        <I.Edit size={16} />
      </span>
      <button type="button" onClick={open} aria-label={`${FIELD_LABEL[k]}: ${valueOf(s, k)}. Tap to rewrite.`} className="block w-full text-left">
        <span className="block t-meta text-ink-3">{FIELD_LABEL[k]}</span>
        <span className="mt-1 block whitespace-pre-line t-body font-semibold text-ink">{valueOf(s, k)}</span>
        <span className="mt-2 flex items-center gap-[6px] t-label" style={said ? { color: "var(--sage-7)" } : undefined}>
          {said && <span className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--sage-4)" }} aria-hidden />}
          <span className={said ? "" : "text-ink-3"}>{sourceOf(s, k, onairos)}</span>
        </span>
      </button>
    </Swipe>
  );
}

// How to answer Force, shown big the first time: the gestures people already know from Mail
// and every photo app, spelled out once.
function Tip() {
  const seen = useR((s) => s.tip);
  return (
    <AnimatePresence initial={false}>
      {!seen && (
        <motion.div className="overflow-hidden" exit={{ opacity: 0, height: 0, transition: { duration: 0.25 } }}>
          <div className="mb-3 rounded-[28px] bg-paper p-5" style={{ boxShadow: "var(--lift-1)" }}>
            <p className="t-body font-semibold text-ink">Is this right?</p>
            <p className="mt-1 t-label text-ink-3">Force drafted these from what you said. Correct anything; your words win.</p>
            <ul className="mt-4 flex flex-col gap-3">
              <li className="flex items-center gap-3 t-body text-ink">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: "var(--sage-1)", color: "var(--sage-7)" }}>
                  <I.Arrow size={18} />
                </span>
                <span>
                  <span className="font-medium">Swipe right</span> if it&apos;s right
                </span>
              </li>
              <li className="flex items-center gap-3 t-body text-ink">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: "var(--rose-1)", color: "var(--rose-7)" }}>
                  <I.Arrow size={18} className="rotate-180" />
                </span>
                <span>
                  <span className="font-medium">Swipe left</span> if it isn&apos;t
                </span>
              </li>
              <li className="flex items-center gap-3 t-body text-ink">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill text-ink-2">
                  <I.Edit size={16} />
                </span>
                <span>
                  <span className="font-medium">Tap</span> to say it your way
                </span>
              </li>
            </ul>
            <button type="button" onClick={() => (haptic(), r.tipSeen())} className="press mt-5 h-11 w-full rounded-full bg-fill t-body font-medium text-ink">
              Got it
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── One useful next step ──
// At most one, tied to what you said. Accept, edit, dismiss; nothing runs by itself. With
// nothing good enough to suggest, Force asks you to choose one.
function NextStep({ s }: { s: Snapshot }) {
  const n = s.next_step;
  const [edit, setEdit] = useState<string | null>(null);
  if (edit !== null || !n || n.status === "dismissed")
    return (
      <div>
        {n?.status === "dismissed" && edit === null && (
          <button type="button" onClick={() => r.nextStep("suggested")} className="press mb-2 flex h-11 items-center px-2 t-label text-ink-3">
            Dismissed · <span className="ml-1 font-medium text-ink-2">Undo</span>
          </button>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            r.writeNextStep(edit ?? "");
            setEdit(null);
          }}
          className="flex min-h-[52px] items-center gap-2 rounded-full bg-paper pl-5 pr-[6px]"
          style={{ boxShadow: "var(--lift-1)" }}
        >
          <input value={edit ?? ""} onChange={(e) => setEdit(e.target.value)} autoFocus={edit !== null} placeholder={n ? "A small step of your own…" : "What one small step would help most?"} aria-label="Your next step" enterKeyHint="done" className="min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-ink-3" />
          {!!edit?.trim() && (
            <button type="submit" aria-label="Save" onPointerDown={(e) => e.preventDefault()} className="press grid h-10 w-10 place-items-center rounded-full bg-ink text-paper">
              <I.Up size={18} />
            </button>
          )}
        </form>
      </div>
    );
  const accepted = n.status === "accepted";
  return (
    <Swipe right="Accept" left="Dismiss" onRight={accepted ? undefined : () => r.nextStep("accepted")} onLeft={() => r.nextStep("dismissed")} className="rounded-[28px] bg-paper p-5 pr-12" style={{ boxShadow: "var(--lift-1)" }}>
      <span className="pointer-events-none absolute right-4 top-5 text-ink-4" aria-hidden>
        <I.Edit size={16} />
      </span>
      <button type="button" onClick={() => setEdit(n.text)} aria-label={`${n.text}. Tap to edit.`} className="block w-full text-left">
        <span className="block t-body font-semibold text-ink">{n.text}</span>
        <span className="mt-2 block t-label text-ink-3">Why this may help: {n.why_it_may_help}</span>
        {n.source === "onairos_nudge" && <span className="mt-1 block t-meta text-ink-3">Picked from Onairos because it fits</span>}
        {accepted && (
          <span className="mt-2 flex items-center gap-[6px] t-meta" style={{ color: "var(--sage-7)" }}>
            <span className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--sage-4)" }} aria-hidden />
            Accepted
          </span>
        )}
      </button>
    </Swipe>
  );
}

// iOS switch, the same as on your profile.
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => (haptic(), onChange(!on))} className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-ink" : "bg-[var(--grey-300)]"}`}>
      <span className="absolute top-1 h-6 w-6 rounded-full bg-paper transition-[left] duration-200" style={{ left: on ? 24 : 4, boxShadow: "0 1px 3px rgb(28 27 26 / 0.2)" }} />
    </button>
  );
}

function H({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <>
      <h3 className={`${hint ? "mb-1" : "mb-3"} px-1 t-body text-ink-3`}>{children}</h3>
      {hint && <p className="mb-3 px-1 t-label text-ink-3">{hint}</p>}
    </>
  );
}

// Your page: the same from the snapshot in the conversation and from your face on home.
// onContinue: on the way in, approving takes you on to the residency.
export default function Persona({ onBack, onContinue }: { onBack?: () => void; onContinue?: () => void }) {
  const { name, snapshot: s, persona, onairos, tip, contribution } = useR();
  const { mine } = useCohort();
  const first = name.trim().split(/\s+/)[0];

  if (!s)
    return (
      <div className="relative flex h-full flex-col">
        <Nav title={first || "You"} onBack={onBack} />
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <p className="t-body text-ink-3">Force hasn&apos;t drafted your snapshot yet.</p>
          <button type="button" onClick={() => (haptic(), r.useDraft())} className="press pill-ink mt-4 h-11 px-5 t-body font-medium">
            Draft it from my answers
          </button>
        </div>
      </div>
    );

  const approved = s.status === "approved";
  const canApprove = !!(s.intent || s.problem);
  const from = ["your three answers", contribution.can_offer.length + contribution.seeking.length ? "what you offer and seek" : "", onairos === "on" ? "Onairos" : ""].filter(Boolean);
  const status = approved ? (s.shared ? "Approved and shared. You're in the cohort graph." : "Approved. Only you can see it.") : "Not approved yet. Only you can see this. Any change needs approving again.";

  return (
    <div className="relative flex h-full flex-col">
      <Nav title={first || "You"} onBack={onBack} />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-[64px]">
        <YouMap />

        <p className="mt-6 px-1 t-title text-ink">Here&apos;s what Force understands so far</p>
        <p className="mt-2 px-1 t-body text-ink-3">
          From {from.length > 1 ? `${from.slice(0, -1).join(", ")} and ${from.at(-1)}` : from[0]}. Check each part. Nothing is shared until you choose.
        </p>

        <section className="mt-8">
          <Tip />
          <div className="flex flex-col gap-2">
            {FIELDS.map((k, i) => (
              <FieldCard key={k} s={s} k={k} onairos={onairos === "on"} peek={!tip && i === 0} />
            ))}
          </div>
        </section>

        <section className="mt-8">
          <H hint="Swipe right to accept, left to dismiss, tap to change it.">A useful next step</H>
          <NextStep s={s} />
        </section>

        {persona && (
          <section className="mt-8">
            <H hint="Used only to help find your themes. Never shared, never used to rank anyone.">What Onairos added</H>
            <div className="rounded-[28px] bg-paper p-5" style={{ boxShadow: "var(--lift-1)" }}>
              {persona.fixture && <span className="mb-2 inline-block rounded-full bg-fill px-2 py-[2px] t-meta text-ink-2">Sample data</span>}
              {persona.summary && <p className="t-body text-ink">{persona.summary}</p>}
              {persona.positive.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-[6px]">
                  {persona.positive.slice(0, 4).map((t) => (
                    <span key={t.name} className="rounded-full bg-fill px-3 py-[6px] t-label text-ink">
                      {t.name}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-3 t-label text-ink-3">{coverageLine(persona)} A guess from a sample, so correct anything above that it got wrong.</p>
            </div>
          </section>
        )}

        <section className="mt-8">
          <H>Who sees this</H>
          <div className="rounded-[28px] bg-paper p-5" style={{ boxShadow: "var(--lift-1)" }}>
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block t-body font-medium text-ink">Share with the residency</span>
                <span className="mt-1 block t-label text-ink-3">Your name and these five parts join the cohort graph, so Force can suggest people. Never your recordings, links or Onairos details.</span>
              </span>
              <Toggle on={s.shared} onChange={(v) => r.setShared(v)} label="Share with the residency" />
            </div>
            <p className="mt-4 flex items-center gap-[6px] t-label" style={{ color: approved ? "var(--sage-7)" : undefined }}>
              <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: approved ? "var(--sage-4)" : "var(--grey-300)" }} aria-hidden />
              <span className={approved ? "" : "text-ink-3"}>{status}</span>
            </p>
          </div>
          {approved && s.shared && mine.length > 0 && (
            <ul className="mt-2 flex flex-col gap-2">
              {mine.map((c) => {
                const p = residentById(otherIn(c, s.resident_id));
                return p ? (
                  <li key={c.id}>
                    <button type="button" onClick={() => (haptic(), f.push({ name: "connection", id: p.id }))} className="press flex w-full items-center gap-3 rounded-[24px] bg-fill px-4 py-3 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block t-meta text-ink-3">{CONNECTION_LABEL[c.type]}</span>
                        <span className="block t-body text-ink">{p.name}</span>
                      </span>
                      <I.Chevron size={16} className="text-ink-4" />
                    </button>
                  </li>
                ) : null;
              })}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <H hint="Optional. Shown on your card to residents you connect with. Force doesn't read them.">Where people can find you</H>
          <NameField />
          <LinkList className="mt-2" />
          <OnairosCard className="mt-2" />
        </section>

        <button
          type="button"
          onClick={() => {
            if (!window.confirm("Start over? Your answers and snapshot on this phone will be cleared.")) return;
            f.home();
            r.startOver();
          }}
          className="press mt-8 flex h-11 w-full items-center justify-center t-label text-ink-3"
        >
          Start over
        </button>
      </div>
      {(!approved || onContinue) && (
        <div className="shrink-0 px-4 pb-3 pt-2">
          {!approved && !canApprove && <p className="mb-2 px-1 text-center t-label text-ink-3">Add your intent or problem first.</p>}
          <button
            type="button"
            disabled={!approved && !canApprove}
            onClick={async () => {
              haptic("done");
              if (!approved) {
                await r.approve();
                f.toast(s.shared ? "Approved and shared with the residency." : "Approved. Only you can see it.");
              }
              onContinue?.();
            }}
            className="press pill-ink h-[52px] w-full justify-center t-body font-medium disabled:bg-fill disabled:text-ink-3"
          >
            {approved ? "Continue to the residency" : s.shared ? "Approve and share" : "Approve, keep it private"}
          </button>
        </div>
      )}
    </div>
  );
}
