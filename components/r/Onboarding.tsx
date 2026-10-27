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
import { HEADLINE, LINKS, ONAIROS_ART, QUESTIONS, pretty, type LinkKind } from "@/data/residency";
import { f } from "@/lib/f/store";
import { r, useR } from "@/lib/f/residency";
import PaintedMark from "../f/PaintedMark";
import VoiceMode from "../f/VoiceMode";
import { AudioBubble, Bubble, Typing } from "../f/Bubbles";
import Glass from "../f/Glass";
import { MARKS, OnairosMark } from "../f/brands";
import { I, Logo, Paint, haptic } from "../f/ui";
import Persona, { usePaintSources } from "./Persona";
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

function LinkRow({ id, kind, name, art, x, y, value, onChange }: { id: string; kind: LinkKind | "extra"; name: string; art: Art; x: number; y: number; value: string; onChange: (v: string) => void }) {
  const [focus, setFocus] = useState(false);
  const on = !!value.trim();
  const M = MARKS[kind];
  const canPaste = typeof navigator !== "undefined" && !!navigator.clipboard?.readText;
  return (
    <label className="flex h-[60px] items-center gap-3 rounded-full bg-paper pl-[10px] pr-4 transition-shadow duration-300" style={{ boxShadow: focus ? "var(--lift-2)" : "var(--lift-1)" }}>
      <motion.span animate={{ scale: on ? [1, 1.1, 1] : 1 }} transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}>
        <Glass size={40} art={art} x={x} y={y} zoom={300}>
          <M size={16} />
        </Glass>
      </motion.span>
      <input
        id={id}
        value={focus ? value : on ? pretty(kind, value) : ""}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        placeholder={name}
        aria-label={name}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="url"
        enterKeyHint="next"
        className="min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-ink-3"
      />
      <AnimatePresence initial={false} mode="popLayout">
        {on ? (
          <motion.span key="ok" className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-ink text-paper" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ type: "spring", duration: 0.35, bounce: 0.3 }}>
            <I.Check size={13} />
          </motion.span>
        ) : focus && canPaste ? (
          <motion.button
            key="paste"
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={async () => {
              try {
                const t = await navigator.clipboard.readText();
                if (!t.trim()) return;
                haptic();
                onChange(t.trim());
              } catch {}
            }}
            className="press h-8 shrink-0 rounded-full bg-fill px-3 t-label font-medium text-ink"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            Paste
          </motion.button>
        ) : null}
      </AnimatePresence>
    </label>
  );
}

function Connect({ onNext }: { onNext: () => void }) {
  const { name, links, extra, onairos } = useR();
  const filled = LINKS.filter((l) => links[l.kind]?.trim()).length + extra.filter((x) => x.trim()).length;
  const focusLink = (k: string) => {
    haptic();
    const el = document.getElementById(`link-${k}`);
    el?.focus();
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  return (
    <>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <header className="px-1 pb-6 pt-10">
          <h1 className="t-large text-ink">Connect what&apos;s yours</h1>
          <p className="mt-2 t-body text-ink-3">Paste your links. Force reads what&apos;s public to get a first sense of you.</p>
        </header>

        <label className="flex h-[60px] items-center rounded-full bg-paper px-5" style={{ boxShadow: "var(--lift-1)" }}>
          <input value={name} onChange={(e) => r.setName(e.target.value)} autoComplete="name" placeholder="Your name" aria-label="Your name" enterKeyHint="next" className="min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-ink-3" />
        </label>

        <div className="mt-6 flex flex-col gap-2">
          {LINKS.map((l) => (
            <LinkRow key={l.kind} id={`link-${l.kind}`} {...l} value={links[l.kind] ?? ""} onChange={(v) => r.setLink(l.kind, v)} />
          ))}
          {extra.map((x, i) => (
            <LinkRow key={`x${i}`} id={`link-x${i}`} kind="extra" name="Any other link" art="meadow" x={20 + i * 25} y={70} value={x} onChange={(v) => r.setExtra(i, v)} />
          ))}
        </div>
        <button type="button" onClick={() => (haptic(), r.addExtra(), setTimeout(() => focusLink(`x${extra.length}`), 50))} className="press mt-2 flex h-11 items-center gap-2 px-3 t-label font-medium text-ink-2">
          <I.Plus size={16} /> Add another link
        </button>

        <div id="onairos" className="mt-6 rounded-[28px] bg-paper p-5" style={{ boxShadow: "var(--lift-1)" }}>
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full" style={{ background: "linear-gradient(160deg, #fff4ee, #eef3fe)" }}>
              <OnairosMark size={40} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block t-body font-semibold text-ink">Onairos</span>
              <span className="block t-label text-ink-3">Your ChatGPT, Instagram and YouTube, even the private parts</span>
            </span>
          </div>
          <p className="mt-4 t-label text-ink-2">Force gets a short read of your personality from it. Never your chats or posts.</p>
          <button type="button" onClick={() => (haptic(), r.connectOnairos())} disabled={onairos !== "off"} className={`press mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full t-body font-medium transition-colors duration-300 ${onairos === "on" ? "bg-fill text-ink" : "bg-ink text-paper"} disabled:opacity-100`}>
            {onairos === "on" ? (
              <>
                <I.Check size={16} /> Connected
              </>
            ) : onairos === "busy" ? (
              "Connecting…"
            ) : (
              "Connect with Onairos"
            )}
          </button>
        </div>
      </div>
      <div className="shrink-0 px-4 pb-3 pt-2">
        <Primary onClick={onNext}>{filled || onairos === "on" ? "Continue" : "Continue without links"}</Primary>
      </div>
    </>
  );
}

// ── The three questions ──

type Line = { id: string; from: "force" | "me"; text?: string; clip?: Clip; reading?: boolean; map?: boolean };
const LIMIT = 90;
// The recorder: a glass bubble with the dusk painting in it.
const ORB = { art: "hills" as Art, x: 74, y: 18, size: 76 };

function Talk({ onNext }: { onNext: () => void }) {
  const { name, links, onairos } = useR();
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
    await say("That's all three. Give me a moment with your answers and your links.", 800);
    setLines((l) => [...l, { id: "reading", from: "force", reading: true }]);
    r.read(answers.current, clips.current.filter((c) => c.src));
    // Your answers are your first moments in memory: recordings as voice notes, typed ones as written.
    if (clips.current.length) f.keepClips(clips.current);
    f.keepTexts(lines.filter((l) => l.from === "me" && l.text).map((l) => l.text!).concat(a.text ? [a.text] : []));
  };

  // Read: the pattern map arrives in the conversation, the way the world used to.
  const read = async () => {
    if (mapped.current) return;
    mapped.current = true;
    setLines((l) => [...l, { id: "map", from: "force", map: true }]);
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

  const sources: Source[] = [
    ...LINKS.filter((l) => links[l.kind]?.trim()).map((l) => ({ key: l.kind, name: l.name, art: l.art, x: l.x, y: l.y, mark: MARKS[l.kind] })),
    ...(onairos === "on" ? [{ key: "onairos", name: "Onairos", ...ONAIROS_ART, mark: OnairosMark }] : []),
    { key: "search", name: "what's public under your name", art: "water" as Art, x: 70, y: 30, mark: ({ size }: { size?: number }) => <I.Search size={size} /> },
    { key: "answers", name: "your three answers", ...ORB, mark: ({ size }: { size?: number }) => <I.Wave size={size} /> },
  ];

  return (
    <div ref={root} className="relative flex min-h-0 flex-1 flex-col">
      <ul ref={list} data-scroll="talk" aria-live="polite" className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 pb-3 pt-2">
        <li className="flex justify-center pb-5 pt-3" aria-hidden>
          <Logo size={34} className="text-ink" />
        </li>
        {lines.map((m, i) => {
          const prev = lines[i - 1];
          const first = !prev || prev.from !== m.from || !!prev.reading || !!prev.map;
          const nextL = lines[i + 1];
          const last = !nextL || nextL.from !== m.from || !!nextL.reading || !!nextL.map;
          return (
            <motion.li key={m.id} layout="position" className={`flex ${m.reading ? "justify-center" : m.from === "me" ? "justify-end" : "justify-start"} ${first || m.map ? "mt-3" : ""}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", duration: 0.4, bounce: 0 }}>
              {m.map ? (
                <MapCard onOpen={() => (haptic("soft"), setOpen(true))} />
              ) : m.reading ? (
                <Reading sources={sources} onDone={read} />
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
      <AnimatePresence>{open && <MapSheet key="map" onClose={() => setOpen(false)} />}</AnimatePresence>
    </div>
  );
}

// The pattern map, in the conversation: you, painted, and the one line. Tap to open it up.
function MapCard({ onOpen }: { onOpen: () => void }) {
  const points = useR((s) => s.points);
  return (
    <button type="button" onClick={onOpen} className="press block w-full overflow-hidden rounded-[24px] bg-paper text-left" style={{ boxShadow: "var(--lift-1)" }}>
      <span className="flex items-center justify-between px-4 pt-3">
        <span className="flex items-center gap-2 t-label font-medium text-ink-2">
          <Paint name="pattern-maps" h={16} /> Pattern map
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-fill text-ink" aria-hidden>
          <I.Expand size={14} />
        </span>
      </span>
      <PaintedYou sources={usePaintSources()} height={220} bare />
      <span className="block px-4 pb-4">
        <span className="block t-body font-semibold text-ink">{HEADLINE}</span>
        <span className="mt-1 block t-label text-ink-3">{points.length} patterns about you · tap to open</span>
      </span>
    </button>
  );
}

// Opened up: the whole pattern map, as a sheet over the conversation.
function MapSheet({ onClose }: { onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-[75]">
      <motion.div className="absolute inset-0 bg-[var(--scrim)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={onClose} />
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label="Pattern map"
        className="absolute inset-x-0 bottom-0 top-3 flex flex-col overflow-hidden bg-canvas"
        style={{ borderRadius: "32px 32px 0 0", boxShadow: "var(--lift-2)" }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%", transition: { type: "spring", duration: 0.4, bounce: 0 } }}
        transition={{ type: "spring", duration: 0.5, bounce: 0 }}
      >
        <div className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-[var(--grey-300)]" />
        <header className="grid shrink-0 grid-cols-[44px_1fr_44px] items-center gap-2 px-4 pb-2 pt-2">
          <span aria-hidden />
          <h2 className="flex items-center justify-center gap-2 t-nav text-ink">
            <Paint name="pattern-maps" h={18} className="text-ink-2" /> Pattern map
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="press hit grid h-11 w-11 place-items-center rounded-full bg-fill text-ink">
            <I.Close size={18} />
          </button>
        </header>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          <Persona sheet />
        </div>
        <div className="shrink-0 px-4 pb-3 pt-2">
          <Primary onClick={onClose}>Done</Primary>
        </div>
      </motion.section>
    </motion.div>
  );
}

type Source = { key: string; name: string; art: Art; x: number; y: number; mark: (p: { size?: number }) => React.ReactNode };

// Where Force is reading from: each source's bubble fills with its painting in turn, a line
// under them says which. No box, no list.
function Reading({ sources, onDone }: { sources: Source[]; onDone: () => void }) {
  const [n, setN] = useState(0);
  const done = n >= sources.length;
  useEffect(() => {
    if (done) {
      const id = setTimeout(onDone, 500);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setN((x) => x + 1), 800);
    return () => clearTimeout(id);
  }, [n, done, onDone]);
  return (
    <div className="flex w-full flex-col items-center py-6">
      <div className="flex flex-wrap justify-center gap-3">
        {sources.map((s, i) => {
          const M = s.mark;
          return (
            <motion.span key={s.key} animate={{ scale: i < n ? [1, 1.14, 1] : 1, y: i === n ? -4 : 0 }} transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}>
              <Glass size={48} art={s.art} x={s.x} y={s.y} zoom={280} dim={i >= n} spin={i === n}>
                <M size={18} />
              </Glass>
            </motion.span>
          );
        })}
      </div>
      <p className="mt-4 t-label text-ink-3" aria-live="polite">
        {done ? "Done. Here's who I think you are." : `Reading ${sources[n].name}…`}
      </p>
    </div>
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
          <Glass {...ORB} size={34} zoom={300}>
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
        <Glass {...ORB} zoom={240}>
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
