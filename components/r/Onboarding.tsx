"use client";

// The residency's way in. No number, no permission screens: the browser asks for the mic
// when it needs it. The mark paints itself and the app moves on by itself to one page of
// connectors. Then the three questions, as your first conversation with Force, answered by
// recording (tap, talk, tap done) or by typing. Force reads it all into a persona you can
// correct, and you land on the people here with your patterns.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Keyboard } from "lucide-react";
import type { Art, Clip } from "@/data/mira";
import { HEADLINE, LINKS, QUESTIONS } from "@/data/residency";
import { f } from "@/lib/f/store";
import { r, useR } from "@/lib/f/residency";
import PaintedMark from "../f/PaintedMark";
import VoiceMode from "../f/VoiceMode";
import { AudioBubble, Bubble, Typing } from "../f/Bubbles";
import Glass from "../f/Glass";
import { I, Logo, Paint, haptic } from "../f/ui";
import Persona, { usePaintSources } from "./Persona";
import { LinkList, NameField, OnairosCard } from "./Links";
import PaintedYou from "./PaintedYou";

type Step = "splash" | "connect" | "talk";

export function Primary({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="press pill-ink h-[52px] w-full justify-center gap-2 t-body font-medium disabled:bg-fill disabled:text-ink-3">
      {children}
    </button>
  );
}

// Steps cross-fade in place: nothing slides, nothing bounces.
function Screen({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <motion.div key={k} className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}

export default function ResidencyOnboarding() {
  const [step, setStep] = useState<Step>("splash");
  const [painted, setPainted] = useState(false);
  const go = (s: Step) => {
    haptic();
    setStep(s);
  };

  // The splash moves on by itself once the line has been read.
  useEffect(() => {
    if (!painted || step !== "splash") return;
    const id = setTimeout(() => setStep("connect"), 1800);
    return () => clearTimeout(id);
  }, [painted, step]);

  return (
    <motion.div className="absolute inset-0 z-[60] flex flex-col bg-canvas" style={{ paddingTop: "var(--sat)", paddingBottom: "var(--sab)" }} exit={{ opacity: 0, transition: { duration: 0.3 } }}>
      <AnimatePresence mode="wait" initial={false}>
        {step === "splash" && (
          <Screen k="splash">
            <button type="button" onClick={() => painted && go("connect")} className="flex flex-1 flex-col items-center justify-center px-6 text-center" aria-label="Continue">
              <PaintedMark size={236} onDone={() => setPainted(true)} />
              <motion.p className="mt-10 max-w-[330px] t-body text-ink-2" initial={{ opacity: 0 }} animate={{ opacity: painted ? 1 : 0 }} transition={{ duration: 0.5 }}>
                A companion that builds your longitudinal memory and helps you find your perfect side quest partnerships.
              </motion.p>
            </button>
          </Screen>
        )}
        {step === "connect" && (
          <Screen k="connect">
            <Connect onNext={() => go("talk")} />
          </Screen>
        )}
        {step === "talk" && (
          <Screen k="talk">
            <Talk
              onNext={() => {
                haptic("done");
                r.finish("people");
              }}
            />
          </Screen>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Connectors: one page ──
// One clean pill per link, its glass bubble holding a crop of a painting and the place's
// mark. Paste the URL and it reads back as the handle. Then Onairos.

function Connect({ onNext }: { onNext: () => void }) {
  const { links, extra, onairos } = useR();
  const filled = LINKS.filter((l) => links[l.kind]?.trim()).length + extra.filter((x) => x.trim()).length;
  return (
    <>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <header className="px-1 pb-6 pt-10">
          <h1 className="t-large text-ink">Connect what&apos;s yours</h1>
          <p className="mt-2 t-body text-ink-3">Paste your links. Force reads what&apos;s public to get a first sense of you.</p>
        </header>

        <NameField />
        <LinkList className="mt-6" />
        <OnairosCard className="mt-6" />
      </div>
      <div className="shrink-0 px-4 pb-3 pt-2">
        <Primary onClick={onNext}>{filled || onairos === "on" ? "Continue" : "Continue without links"}</Primary>
      </div>
    </>
  );
}

// ── The three questions ──

type Line = { id: string; from: "force" | "me"; text?: string; clip?: Clip; map?: boolean };
const LIMIT = 90;
// The recorder: a glass bubble with the dusk painting in it.
const ORB = { art: "hills" as Art, x: 58, y: 34, size: 76, zoom: 150 };

function Talk({ onNext }: { onNext: () => void }) {
  const name = useR((s) => s.name);
  const [lines, setLines] = useState<Line[]>([]);
  const [typing, setTyping] = useState(false);
  const [qi, setQi] = useState(0);
  const [phase, setPhase] = useState<"ask" | "reading" | "done">("ask");
  const [voice, setVoice] = useState<{ x: number; y: number; el: HTMLElement | null } | null>(null);
  const [open, setOpen] = useState(false);
  const mapped = useRef(false);
  const answers = useRef<string[]>([]);
  const clips = useRef<Clip[]>([]);
  const list = useRef<HTMLUListElement>(null);
  const root = useRef<HTMLDivElement>(null);

  const say = (text: string, delay = 900, extra?: Partial<Line>) =>
    new Promise<void>((res) => {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setLines((l) => [...l, { id: `f${l.length}${Date.now()}`, from: "force", text, ...extra }]);
        res();
      }, delay);
    });

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const first = name.trim().split(/\s+/)[0];
      await say(`${first ? `Hi ${first}. ` : ""}Three questions about you and the residency. Tap the bubble and talk, or type if you'd rather.`, 700);
      await say(QUESTIONS[0], 1000);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once
  }, []);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [lines, typing]);

  const answered = async (a: { clip?: Clip; text?: string }) => {
    setLines((l) => [...l, { id: `me${l.length}`, from: "me", ...a }]);
    // A sample recording (no mic) has someone else's words; read the residency sample instead.
    answers.current = [...answers.current, a.clip ? (a.clip.src ? a.clip.transcript : "") : (a.text ?? "")];
    if (a.clip) clips.current = [...clips.current, a.clip];
    if (qi + 1 < QUESTIONS.length) {
      setQi(qi + 1);
      await say(qi === 0 ? "Thank you. Next one." : "Last one.", 700);
      await say(QUESTIONS[qi + 1], 900);
      return;
    }
    setPhase("reading");
    await say("That's all three. Give me a moment.", 800);
    r.read(answers.current, clips.current.filter((c) => c.src));
    setLines((l) => [...l, { id: "map", from: "force", map: true }]);
    // Your answers are your first moments in memory: recordings as voice notes, typed ones as written.
    if (clips.current.length) f.keepClips(clips.current);
    f.keepTexts(lines.filter((l) => l.from === "me" && l.text).map((l) => l.text!).concat(a.text ? [a.text] : []));
  };

  // The pattern map has finished painting: Force says what to do with it.
  const read = async () => {
    if (mapped.current) return;
    mapped.current = true;
    await say("That's my first read of you. Tap it to open it up: keep what's true, fix what isn't.", 1100);
    setPhase("done");
  };

  // The water starts from the middle of the bubble.
  const listen = (el: HTMLElement) => {
    const b = el.getBoundingClientRect();
    const box = root.current?.getBoundingClientRect();
    haptic("soft");
    setVoice({ x: b.left + b.width / 2 - (box?.left ?? 0), y: b.top + b.height / 2 - (box?.top ?? 0), el: root.current });
  };

  return (
    <div ref={root} className="relative flex min-h-0 flex-1 flex-col">
      <ul ref={list} data-scroll="talk" aria-live="polite" className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 pb-3 pt-2">
        <li className="flex justify-center pb-5 pt-3" aria-hidden>
          <Logo size={34} className="text-ink" />
        </li>
        {lines.map((m, i) => {
          const prev = lines[i - 1];
          const first = !prev || prev.from !== m.from || !!prev.map;
          const nextL = lines[i + 1];
          const last = !nextL || nextL.from !== m.from || !!nextL.map;
          return (
            <motion.li key={m.id} layout="position" className={`flex ${m.from === "me" ? "justify-end" : "justify-start"} ${first || m.map ? "mt-3" : ""}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", duration: 0.4, bounce: 0 }}>
              {m.map ? (
                <MapCard onRead={read} onOpen={() => (haptic("soft"), setOpen(true))} />
              ) : m.clip ? (
                <AudioBubble clip={m.clip} />
              ) : (
                <Bubble from={m.from} joinTop={!first} joinBottom={!last}>
                  {m.text}
                </Bubble>
              )}
            </motion.li>
          );
        })}
        {typing && (
          <li className="mt-3 flex justify-start">
            <Typing />
          </li>
        )}
      </ul>

      {/* Kept out of the photograph the water bends, so the orb never wobbles under itself */}
      <div data-no-shot className="shrink-0 px-4 pb-3 pt-1">
        {phase === "done" ? (
          <Primary onClick={onNext}>Find people with this energy</Primary>
        ) : phase === "ask" ? (
          <Answer key={qi} disabled={typing || !!voice} onListen={listen} onAnswer={answered} />
        ) : (
          <div className="h-[116px]" />
        )}
      </div>

      <AnimatePresence>
        {voice && (
          <VoiceMode
            key="voice"
            origin={voice}
            shotOf={voice.el}
            limit={LIMIT}
            orb={{ ...ORB, icon: <I.Mic size={26} /> }}
            onClip={(clip) => answered({ clip: { ...clip, name: `Answer ${qi + 1}` } })}
            onClose={() => setVoice(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{open && <YouPage key="you" onClose={() => setOpen(false)} onContinue={onNext} />}</AnimatePresence>
    </div>
  );
}

// The pattern map, in the conversation. It arrives at once and paints itself while Force
// analyses: one stroke for each thing it's reading. Only when it's done does it become
// something you can open.
function MapCard({ onOpen, onRead }: { onOpen: () => void; onRead: () => void }) {
  const points = useR((s) => s.points);
  const [ready, setReady] = useState(false);
  return (
    <button type="button" disabled={!ready} onClick={onOpen} className="press block w-full overflow-hidden rounded-[24px] bg-paper text-left disabled:active:scale-100" style={{ boxShadow: "var(--lift-1)" }}>
      <span className="flex h-11 items-center justify-between px-4 pt-1">
        <span className="flex items-center gap-2 t-label font-medium text-ink-2">
          <Paint name="pattern-maps" h={16} /> Pattern map
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-fill text-ink transition-opacity duration-500" style={{ opacity: ready ? 1 : 0 }} aria-hidden>
          <I.Expand size={14} />
        </span>
      </span>
      <PaintedYou
        sources={usePaintSources()}
        height={220}
        bare
        onDone={() => {
          setReady(true);
          onRead();
        }}
      />
      <span className="block min-h-[68px] px-4 pb-4">
        {ready ? (
          <>
            <span className="block t-body font-semibold text-ink">{HEADLINE}</span>
            <span className="mt-1 block t-label text-ink-3">{points.length} patterns about you · tap to open</span>
          </>
        ) : (
          <span className="block pt-2 t-label text-ink-3" aria-live="polite">
            Analysing your answers and links…
          </span>
        )}
      </span>
    </button>
  );
}

// Opened up: your page, pushed over the conversation the iOS way. Back returns to the
// conversation; at the bottom, on to the people.
function YouPage({ onClose, onContinue }: { onClose: () => void; onContinue: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-[75] bg-canvas" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%", transition: { type: "spring", duration: 0.4, bounce: 0 } }} transition={{ type: "spring", duration: 0.5, bounce: 0 }} style={{ boxShadow: "var(--lift-2)" }}>
      <Persona onBack={onClose} onContinue={onContinue} />
    </motion.div>
  );
}

// Answering: the glass bubble. Tap it and the screen turns to water from it while you talk;
// tap anywhere when you're done. No holding, so it's the same on every phone. Or type.
function Answer({ disabled, onListen, onAnswer }: { disabled: boolean; onListen: (el: HTMLElement) => void; onAnswer: (a: { text: string }) => void }) {
  const [typing, setTypingMode] = useState(false);
  const [text, setText] = useState("");

  if (typing)
    return (
      <form
        className="flex min-h-[52px] items-center gap-1 rounded-full bg-paper pl-5 pr-[6px]"
        style={{ boxShadow: "var(--lift-1)" }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim() || disabled) return;
          haptic();
          onAnswer({ text: text.trim() });
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder="Type your answer…" aria-label="Your answer" enterKeyHint="send" className="min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-ink-3" />
        <button type="button" aria-label="Talk instead" onClick={() => setTypingMode(false)} className="press grid h-10 w-10 shrink-0 place-items-center">
          <Glass {...ORB} size={34}>
            <I.Mic size={15} />
          </Glass>
        </button>
        <button type="submit" aria-label="Send" disabled={!text.trim() || disabled} onPointerDown={(e) => e.preventDefault()} className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-paper disabled:opacity-20">
          <I.Up size={18} />
        </button>
      </form>
    );

  return (
    <div className="flex flex-col items-center" style={{ opacity: disabled ? 0.55 : 1, transition: "opacity 300ms" }}>
      <motion.button
        type="button"
        aria-label="Tap to answer out loud"
        disabled={disabled}
        onClick={(e) => onListen(e.currentTarget)}
        className="rounded-full"
        whileTap={{ scale: 0.94 }}
      >
        <Glass {...ORB}>
          <I.Mic size={26} />
        </Glass>
      </motion.button>
      <p className="mt-3 flex items-center gap-1 t-label text-ink-3">
        Tap and talk
        <span className="text-ink-4">·</span>
        <button type="button" onClick={() => setTypingMode(true)} className="press hit -my-2 flex h-9 items-center gap-1 px-1 font-medium text-ink-2">
          <Keyboard size={14} strokeWidth={1.75} absoluteStrokeWidth aria-hidden /> Type instead
        </button>
      </p>
    </div>
  );
}
