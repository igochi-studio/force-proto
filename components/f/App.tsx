"use client";

// The whole app is one light canvas with paper laid over it.
//   Home / companion: the conversation, straight on the canvas.
//   Memory (the world, your side quests, your moments) and the Energy map: full pages that
//   grow out of the two pills at the top of home.
//   Pattern maps: a card that rises over whatever you're on.

import { useEffect, useRef } from "react";
import { AnimatePresence, LayoutGroup, animate, motion, useMotionValue } from "motion/react";
import { f, useF, type Screen } from "@/lib/f/store";
import Companion from "./Companion";
import EntryView from "./EntryView";
import Memory from "./Memory";
import Energy, { DivePage, DmPage } from "./Energy";
import Onboarding from "./Onboarding";
import Profile from "./Profile";
import { QuestPage } from "./Quests";
import SheetHost from "./Sheet";
import { SPRING, haptic } from "./ui";

const keyOf = (s: Screen) => ("id" in s ? `${s.name}-${s.id}` : s.name);
// Which pill the page grows out of.
const surfaceOf = (s: Screen) => (["energy", "dm", "dive", "profile"].includes(s.name) ? "energy-surface" : "memory-surface");

function Page({ s }: { s: Screen }) {
  switch (s.name) {
    case "memory":
      return <Memory />;
    case "entry":
      return <EntryView id={s.id} />;
    case "quest":
      return <QuestPage id={s.id} />;
    case "energy":
      return <Energy focus={s.focus} />;
    case "dive":
      return <DivePage id={s.id} from={s.from} />;
    case "dm":
      return <DmPage id={s.id} />;
    case "profile":
      return <Profile />;
  }
}

function Panel() {
  const stack = useF((s) => s.stack);
  const top = stack[stack.length - 1];
  // Memory sits to the left of the chat: swipe it back to the left and it follows your finger
  // off the screen. Every other page goes back the iOS way, from the left edge.
  const dir = -1;
  const pageSwipe = !!top && surfaceOf(stack[0]) === "memory-surface";
  const x = useMotionValue(0);
  const g = useRef<{ id: number; x0: number; y0: number; edge: boolean; on: boolean | null; hist: { x: number; t: number }[] } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const start = (e: React.PointerEvent, edge: boolean) => {
    if (!edge && (!pageSwipe || (e.target as HTMLElement).closest("canvas, .scroll-row, [data-swipe], input, textarea, [role=dialog], [draggable=true]"))) return;
    g.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, edge, on: edge ? true : null, hist: [{ x: e.clientX, t: e.timeStamp }] };
    if (edge)
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
  };
  const onMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (s.on === null) {
      if (Math.hypot(dx, dy) < 12) return;
      // Only a clearly sideways pull, in the closing direction, takes the page
      s.on = Math.abs(dx) > Math.abs(dy) * 1.6 && Math.sign(dx) === dir;
      if (!s.on) {
        g.current = null;
        return;
      }
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
    }
    s.hist.push({ x: e.clientX, t: e.timeStamp });
    if (s.hist.length > 5) s.hist.shift();
    const d = s.edge ? Math.max(0, dx) : dir > 0 ? Math.max(0, dx) : Math.min(0, dx);
    x.set(d);
  };
  const onUp = (e: React.PointerEvent) => {
    const s = g.current;
    g.current = null;
    if (!s || s.id !== e.pointerId || !s.on) return;
    const w = box.current?.clientWidth ?? 393;
    const h = s.hist;
    const vel = h.length > 1 ? (h[h.length - 1].x - h[0].x) / Math.max(1, h[h.length - 1].t - h[0].t) : 0;
    const way = s.edge ? 1 : dir;
    if (Math.abs(x.get()) > w * 0.3 || vel * way > 0.6) {
      haptic("soft");
      animate(x, way * w, { ...SPRING.move, velocity: vel * 1000 }).then(() => {
        f.pop();
        x.set(0);
      });
    } else animate(x, 0, { ...SPRING.ui, velocity: vel * 1000 });
  };

  return (
    <AnimatePresence>
      {top && (
        <motion.div
          key="paper"
          ref={box}
          className="absolute inset-0 z-20 overflow-hidden bg-canvas"
          style={{ transformOrigin: surfaceOf(stack[0]) === "energy-surface" ? "100% 0%" : "0% 0%", borderRadius: 36 }}
          initial={{ scale: 0.18, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, borderRadius: 0 }}
          exit={{ scale: 0.18, opacity: 0, borderRadius: 36, transition: { type: "spring", duration: 0.38, bounce: 0 } }}
          transition={SPRING.surface}
        >
          {stack.length > 1 && <div className="absolute inset-0 bg-canvas opacity-60" aria-hidden />}
          <motion.div key={keyOf(top)} className="absolute inset-0 bg-canvas" style={{ paddingTop: top.name === "dive" ? 0 : "var(--sat)", paddingBottom: top.name === "dive" ? 0 : "var(--sab)", x }} onPointerDown={(e) => start(e, false)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            <Page s={top} />
          </motion.div>
          <div className="absolute inset-y-0 left-0 z-30 w-5" style={{ touchAction: "pan-y" }} onPointerDown={(e) => start(e, true)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-hidden />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Toast() {
  const toast = useF((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => f.clearToast(), 3200);
    return () => clearTimeout(id);
  }, [toast]);
  return (
    <div className="pointer-events-none absolute inset-x-0 z-[80] flex justify-center px-4" style={{ top: "calc(var(--sat) + 64px)" }}>
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            role="status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={SPRING.ui}
            className="pill pointer-events-auto h-10 max-w-full t-label"
          >
            <span className="truncate">{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const open = useF((s) => s.stack.length > 0);
  const sheet = useF((s) => !!s.sheet);
  const onboarded = useF((s) => s.onboarded);
  // Escape closes the top-most layer: a sheet, then the paper.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const st = useF.getState();
      if (st.sheet) f.closeSheet();
      else if (st.stack.length) f.pop();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  return (
    <LayoutGroup>
      <motion.div className="absolute inset-0" animate={{ scale: open ? 0.96 : 1, opacity: open ? 0 : 1 }} transition={SPRING.move} aria-hidden={open || sheet} inert={open || sheet}>
        <Companion />
      </motion.div>
      <div inert={sheet} aria-hidden={sheet || undefined}>
        <Panel />
      </div>
      <SheetHost />
      <Toast />
      <AnimatePresence>{!onboarded && <Onboarding key="onboarding" />}</AnimatePresence>
    </LayoutGroup>
  );
}
