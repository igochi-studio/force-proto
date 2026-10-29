"use client";

// Why you and a resident are connected, the v1.1 connection detail: the kind of connection,
// one sentence on why, one question you could explore together, and the evidence from both
// approved snapshots. Whether a person reviewed it or Force suggested it is always said.
// Never raw private content. Without a connection, it says so rather than inventing one.

import { CONNECTION_LABEL, FIELD_LABEL, type Evidence } from "@/contract/residency";
import { ME_FACE, residentById } from "@/data/residency";
import { f } from "@/lib/f/store";
import { useR } from "@/lib/f/residency";
import { useCohort } from "@/lib/r/cohort";
import Face from "../f/Face";
import Glass from "../f/Glass";
import Nav from "../f/Nav";
import { haptic } from "../f/ui";

export default function ConnectionPage({ id }: { id: string }) {
  const me = useR((s) => s.me);
  const snapshot = useR((s) => s.snapshot);
  const { graph } = useCohort();
  const p = residentById(id);
  const pid = `person_${id}`;
  const c = graph.edges.find((e) => "why_connected" in e && (e.source === pid || e.target === pid) && (e.source === `person_${me}` || e.target === `person_${me}`));
  const conn = c && "why_connected" in c ? c : null;
  const theirs = conn?.evidence.find((e) => e.snapshot_id !== snapshot?.id);
  const yours = conn?.evidence.find((e) => e.snapshot_id === snapshot?.id);
  if (!p) return null;
  return (
    <div className="relative flex h-full flex-col">
      <Nav title={p.name} />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-[72px]">
        <div className="flex items-center justify-center">
          <Glass size={64} {...ME_FACE} zoom={240} />
          <span className="-ml-3">
            <Face face={p.face} size={64} />
          </span>
        </div>
        {conn ? (
          <>
            <p className="mt-4 text-center t-label text-ink-3">{CONNECTION_LABEL[conn.type]}</p>
            <p className="mt-2 px-2 text-center t-title text-ink">{conn.why_connected}</p>
            <p className="mt-3 flex items-center justify-center gap-[6px] t-meta text-ink-3">
              <span className="h-[6px] w-[6px] rounded-full" style={{ background: conn.origin === "reviewed" ? "var(--sage-4)" : "var(--grey-300)" }} aria-hidden />
              {conn.origin === "reviewed" ? `Reviewed by ${conn.reviewed_by ?? "the Force team"}` : "Suggested by Force, not yet reviewed"}
            </p>

            <section className="mt-8">
              <h3 className="mb-3 px-1 t-body text-ink-3">Something to explore together</h3>
              <p className="rounded-[28px] bg-paper p-5 t-body font-semibold text-ink" style={{ boxShadow: "var(--lift-1)" }}>
                {conn.what_to_explore}
              </p>
            </section>

            <section className="mt-8">
              <h3 className="mb-1 px-1 t-body text-ink-3">Why Force thinks so</h3>
              <p className="mb-3 px-1 t-label text-ink-3">From both of your approved snapshots.</p>
              <ul className="flex flex-col gap-2">
                {theirs && <Quote who={p.name} e={theirs} />}
                {yours && <Quote who="You" e={yours} />}
              </ul>
            </section>
          </>
        ) : (
          <>
            <p className="mt-4 text-center t-title text-ink">{p.name}</p>
            <p className="mt-2 px-4 text-center t-body text-ink-3">{p.work}</p>
            <p className="mt-6 rounded-[28px] bg-fill p-5 t-body text-ink-2">Force hasn&apos;t found a clear reason to connect you two yet. It only suggests a connection when it can say why.</p>
          </>
        )}
      </div>
      <div className="shrink-0 px-4 pb-3 pt-2">
        <button
          type="button"
          onClick={() => {
            haptic();
            f.openThread(id, conn ? { why: conn.why_connected, explore: conn.what_to_explore } : undefined);
            f.push({ name: "dm", id });
          }}
          className="press pill-ink h-[52px] w-full justify-center gap-2 t-body font-medium"
        >
          Message {p.name}
        </button>
      </div>
    </div>
  );
}

function Quote({ who, e }: { who: string; e: Evidence }) {
  return (
    <li className="rounded-[28px] bg-fill p-5">
      <p className="t-meta text-ink-3">
        {who} · {FIELD_LABEL[e.field]}
      </p>
      <p className="mt-1 t-body text-ink">“{e.text}”</p>
    </li>
  );
}
