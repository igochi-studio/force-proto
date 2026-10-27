"use client";

// The residency's way in. No number, no permission screens: the browser asks for the mic
// when it needs it. The mark paints itself and the app moves on by itself to one page of
// connectors. Then the three questions, as your first conversation with Force, answered by
// recording (tap, talk, tap done) or by typing. Force reads it all into a persona you can
// correct, then shows you who here thinks like you, and you're in the conversations.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Keyboard } from "lucide-react";
import type { Clip } from "@/data/mira";
import { LINKS, QUESTIONS, RESIDENTS } from "@/data/residency";
import { f } from "@/lib/f/store";
import { r, useR } from "@/lib/f/residency";
import { record, type Recording } from "@/lib/f/audio";
import PaintedMark from "../f/PaintedMark";
import { AudioBubble, Bubble, Typing } from "../f/Bubbles";
import { Live } from "../f/Composer";
import Face from "../f/Face";
import { I, Logo, haptic } from "../f/ui";
import Persona from "./Persona";

type Step = "splash" | "connect" | "talk" | "persona" | "people";

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
            <Talk onNext={() => go("persona")} />
          </Screen>
        )}
        {step === "persona" && (
          <Screen k="persona">
            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
              <Persona onDone={() => go("people")} />
            </div>
          </Screen>
        )}
        {step === "people" && (
          <Screen k="people">
            <People />
          </Screen>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Connectors: one page ──

function Mark({ children }: { children: React.ReactNode }) {
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill t-meta font-semibold text-ink">{children}</span>;
}

function Connect({ onNext }: { onNext: () => void }) {
  const { name, links, extra, onairos } = useR();
  const filled = LINKS.filter((l) => links[l.kind]?.trim()).length + extra.filter((x) => x.trim()).length;
  return (
    <>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <header className="px-1 pb-6 pt-6">
          <h1 className="t-large text-ink">Connect what&apos;s yours</h1>
          <p className="mt-2 t-body text-ink-3">Force reads what&apos;s public to get a first sense of you. Add as many as you like, and correct anything it gets wrong later.</p>
        </header>

        <label className="flex h-[52px] items-center gap-3 rounded-full bg-paper pl-5 pr-5" style={{ boxShadow: "var(--lift-1)" }}>
          <span className="t-body text-ink-3">Name</span>
          <input value={name} onChange={(e) => r.setName(e.target.value)} autoComplete="name" placeholder="Your full name" aria-label="Your name" className="min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-ink-4" />
        </label>

        <h2 className="mt-8 px-1 pb-2 t-label font-medium text-ink-3">Your links</h2>
        <ul className="overflow-hidden rounded-[28px] bg-paper" style={{ boxShadow: "var(--lift-1)" }}>
          {LINKS.map((l, i) => {
            const on = !!links[l.kind]?.trim();
            return (
              <li key={l.kind}>
                <label className="flex h-[60px] items-center gap-3 px-4">
                  <Mark>{l.mark}</Mark>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="t-meta text-ink-3">{l.name}</span>
                    <input value={links[l.kind] ?? ""} onChange={(e) => r.setLink(l.kind, e.target.value)} placeholder={l.placeholder} aria-label={l.name} autoCapitalize="off" autoCorrect="off" spellCheck={false} inputMode="url" className="min-w-0 bg-transparent t-body text-ink outline-none placeholder:text-ink-4" />
                  </span>
                  {on && <I.Check size={18} className="shrink-0 text-ink" />}
                </label>
                {(i < LINKS.length - 1 || extra.length > 0) && <div className="ml-[64px] h-px bg-[var(--line)]" />}
              </li>
            );
          })}
          {extra.map((x, i) => (
            <li key={`x${i}`}>
              <label className="flex h-[60px] items-center gap-3 px-4">
                <Mark>
                  <I.Link size={16} />
                </Mark>
                <input value={x} onChange={(e) => r.setExtra(i, e.target.value)} autoFocus={!x} placeholder="Any other link" aria-label="Another link" autoCapitalize="off" autoCorrect="off" spellCheck={false} inputMode="url" className="min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-ink-4" />
                {x.trim() && <I.Check size={18} className="shrink-0 text-ink" />}
              </label>
              {i < extra.length - 1 && <div className="ml-[64px] h-px bg-[var(--line)]" />}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => r.addExtra()} className="press mt-2 flex h-11 items-center gap-2 px-2 t-label text-ink-2">
          <I.Plus size={16} /> Add another link
        </button>

        <h2 className="mt-6 px-1 pb-2 t-label font-medium text-ink-3">Apps</h2>
        <div className="rounded-[28px] bg-paper p-4" style={{ boxShadow: "var(--lift-1)" }}>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink t-body font-semibold text-paper">O</span>
            <span className="min-w-0 flex-1">
              <span className="block t-nav text-ink">Onairos</span>
              <span className="block t-label text-ink-3">ChatGPT, Instagram, YouTube and more</span>
            </span>
            <button type="button" onClick={() => (haptic(), r.connectOnairos())} disabled={onairos !== "off"} className={`press h-9 shrink-0 rounded-full px-4 t-label font-medium ${onairos === "on" ? "bg-fill text-ink" : "bg-ink text-paper"} disabled:opacity-100`}>
              {onairos === "on" ? (
                <span className="flex items-center gap-1">
                  <I.Check size={14} /> Connected
                </span>
              ) : onairos === "busy" ? (
                "Connecting…"
              ) : (
                "Connect"
              )}
            </button>
          </div>
          <p className="mt-3 rounded-[18px] bg-fill px-4 py-3 t-label text-ink-2">Reads even private accounts and hands Force a short read of your personality. Force never sees your chats or posts.</p>
        </div>
      </div>
      <div className="shrink-0 px-4 pb-3 pt-2">
        <Primary onClick={onNext}>{filled || onairos === "on" ? "Continue" : "Continue without links"}</Primary>
      </div>
    </>
  );
}

// ── The three questions ──

type Line = { id: string; from: "force" | "me"; text?: string; clip?: Clip; reading?: boolean };
const LIMIT = 90;

function Talk({ onNext }: { onNext: () => void }) {
  const { name, links, onairos } = useR();
  const [lines, setLines] = useState<Line[]>([]);
  const [typing, setTyping] = useState(false);
  const [qi, setQi] = useState(0);
  const [phase, setPhase] = useState<"ask" | "reading" | "done">("ask");
  const answers = useRef<string[]>([]);
  const clips = useRef<Clip[]>([]);
  const list = useRef<HTMLUListElement>(null);

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
      await say(`${first ? `Hi ${first}. ` : ""}Three questions about you and the residency. Record your answer, or type it if you'd rather.`, 700);
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
    // Typed answers are kept as written moments; recordings as voice notes.
    if (qi + 1 < QUESTIONS.length) {
      setQi(qi + 1);
      await say(qi === 0 ? "Thank you. Next one." : "Last one.", 700);
      await say(QUESTIONS[qi + 1], 900);
      return;
    }
    setPhase("reading");
    await say("That's all three. I'm reading your answers alongside your links now.", 800);
    setLines((l) => [...l, { id: "reading", from: "force", reading: true }]);
    r.read(answers.current);
    // Your answers are your first moments in memory.
    if (clips.current.length) f.keepClips(clips.current);
    f.keepTexts(lines.filter((l) => l.from === "me" && l.text).map((l) => l.text!).concat(a.text ? [a.text] : []));
  };

  const sources = [
    ...LINKS.filter((l) => links[l.kind]?.trim()).map((l) => l.name),
    ...(onairos === "on" ? ["Onairos"] : []),
    "Public search for your name",
    "Your three answers",
  ];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ul ref={list} aria-live="polite" className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 pb-3 pt-2">
        <li className="flex justify-center pb-5 pt-3" aria-hidden>
          <Logo size={34} className="text-ink" />
        </li>
        {lines.map((m, i) => {
          const prev = lines[i - 1];
          const first = !prev || prev.from !== m.from || !!prev.reading;
          const nextL = lines[i + 1];
          const last = !nextL || nextL.from !== m.from || !!nextL.reading;
          return (
            <motion.li key={m.id} layout="position" className={`flex ${m.from === "me" ? "justify-end" : "justify-start"} ${first ? "mt-3" : ""}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", duration: 0.4, bounce: 0 }}>
              {m.reading ? (
                <Reading sources={sources} onDone={() => setPhase("done")} />
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

      <div className="shrink-0 px-4 pb-3 pt-1">
        {phase === "done" ? (
          <Primary onClick={onNext}>
            See what Force found <I.Arrow size={18} />
          </Primary>
        ) : phase === "ask" ? (
          <Answer key={qi} disabled={typing} at={qi} onAnswer={answered} />
        ) : (
          <div className="h-[52px]" />
        )}
      </div>
    </div>
  );
}

// Where Force is reading from, ticked off one by one.
function Reading({ sources, onDone }: { sources: string[]; onDone: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= sources.length) {
      const id = setTimeout(onDone, 400);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setN((x) => x + 1), 650);
    return () => clearTimeout(id);
  }, [n, sources.length, onDone]);
  return (
    <ul className="w-full max-w-[300px] rounded-[20px] bg-fill px-4 py-3">
      {sources.map((s, i) => (
        <li key={s} className={`flex h-8 items-center gap-3 t-body ${i < n ? "text-ink" : "text-ink-3"}`}>
          <span className="grid h-5 w-5 shrink-0 place-items-center">{i < n ? <I.Check size={16} /> : i === n ? <span className="h-[6px] w-[6px] rounded-full bg-ink-3" /> : null}</span>
          {s}
        </li>
      ))}
    </ul>
  );
}

// Answering: one clear black button to record, or type instead. While recording, the pill is
// your voice: cancel on the left, done on the right. Tap and tap; no holding, so it works the
// same on every phone.
function Answer({ disabled, at, onAnswer }: { disabled: boolean; at: number; onAnswer: (a: { clip?: Clip; text?: string }) => void }) {
  const [mode, setMode] = useState<"idle" | "starting" | "rec" | "saving" | "type">("idle");
  const [rec, setRec] = useState<{ r: Recording; since: number } | null>(null);
  const [text, setText] = useState("");

  const start = async () => {
    if (mode !== "idle") return;
    haptic("soft");
    setMode("starting");
    try {
      const x = await record();
      if (!x.real) f.toast("No microphone access, so this records a sample.");
      setRec({ r: x, since: performance.now() });
      setMode("rec");
    } catch {
      f.toast("Recording isn't available here. Type your answer instead.");
      setMode("type");
    }
  };
  const stop = async () => {
    if (!rec) return;
    haptic("done");
    setMode("saving");
    const clip = await rec.r.stop();
    setRec(null);
    onAnswer({ clip: { ...clip, name: `Answer ${at + 1}` } });
  };
  const cancel = () => {
    rec?.r.cancel();
    setRec(null);
    setMode("idle");
  };

  // A long answer stops itself.
  useEffect(() => {
    if (mode !== "rec" || !rec) return;
    const id = setTimeout(stop, LIMIT * 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stop reads the latest rec
  }, [mode, rec]);

  if (mode === "rec" && rec)
    return (
      <div className="flex h-[52px] items-center gap-2 rounded-full bg-paper pl-1 pr-[6px]" style={{ boxShadow: "var(--lift-1)" }}>
        <button type="button" aria-label="Cancel recording" onClick={cancel} className="press hit grid h-10 w-10 shrink-0 place-items-center text-ink-3">
          <I.Close size={16} />
        </button>
        <Live rec={rec.r} since={rec.since} hint="" />
        <button type="button" onClick={stop} className="press flex h-10 shrink-0 items-center gap-1 rounded-full bg-ink pl-3 pr-4 t-label font-medium text-paper">
          <I.Check size={16} /> Done
        </button>
      </div>
    );

  if (mode === "type")
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
        <button type="button" aria-label="Record instead" onClick={() => setMode("idle")} className="press grid h-10 w-10 shrink-0 place-items-center text-ink">
          <I.Mic size={20} />
        </button>
        <button type="submit" aria-label="Send" disabled={!text.trim() || disabled} onPointerDown={(e) => e.preventDefault()} className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-paper disabled:opacity-20">
          <I.Up size={18} />
        </button>
      </form>
    );

  return (
    <div className="flex items-center gap-2" style={{ opacity: disabled ? 0.5 : 1 }}>
      <button type="button" disabled={disabled || mode !== "idle"} onClick={start} className="press pill-ink h-[52px] flex-1 justify-center gap-2 t-body font-medium">
        {mode === "idle" ? (
          <>
            <I.Mic size={20} /> Record your answer
          </>
        ) : (
          "One moment…"
        )}
      </button>
      <button type="button" aria-label="Type instead" disabled={disabled || mode !== "idle"} onClick={() => setMode("type")} className="press pill h-[52px] w-[52px] shrink-0 justify-center p-0">
        <Keyboard size={20} strokeWidth={1.75} absoluteStrokeWidth aria-hidden />
      </button>
    </div>
  );
}

// ── People here with your patterns ──

function People() {
  const near = RESIDENTS.filter((p) => p.pattern);
  const open = (id?: string) => {
    haptic("done");
    r.finish();
    if (id) setTimeout(() => (f.openThread(id), f.push({ name: "dm", id })), 350);
  };
  return (
    <>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <header className="px-1 pb-6 pt-6">
          <h1 className="t-large text-ink">People here who think like you</h1>
          <p className="mt-2 t-body text-ink-3">From the patterns you kept. Everyone in the residency is on Force, so you can start a conversation now.</p>
        </header>
        <ul className="flex flex-col gap-2">
          {near.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => open(p.id)} className="press flex w-full items-center gap-3 rounded-[28px] bg-paper p-4 text-left" style={{ boxShadow: "var(--lift-1)" }}>
                <Face face={p.face} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block t-nav text-ink">{p.name}</span>
                  <span className="block t-label text-ink-3">{p.work}</span>
                  <span className="mt-2 inline-flex h-7 items-center rounded-full bg-fill px-3 t-meta text-ink">{p.pattern}</span>
                </span>
                <I.Chevron size={18} className="shrink-0 text-ink-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="shrink-0 px-4 pb-3 pt-2">
        <Primary onClick={() => open()}>Go to conversations</Primary>
      </div>
    </>
  );
}
