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
import { LINKS, ONAIROS_ART, QUESTIONS, pretty, type LinkKind } from "@/data/residency";
import { f } from "@/lib/f/store";
import { r, useR } from "@/lib/f/residency";
import PaintedMark from "../f/PaintedMark";
import VoiceMode from "../f/VoiceMode";
import { AudioBubble, Bubble, Typing } from "../f/Bubbles";
import Glass from "../f/Glass";
import { MARKS, OnairosMark } from "../f/brands";
import { I, Logo, haptic } from "../f/ui";
import Persona from "./Persona";

type Step = "splash" | "connect" | "talk" | "persona";

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
              <Persona
                onDone={() => {
                  haptic("done");
                  r.finish("people");
                }}
              />
            </div>
          </Screen>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Connectors: one page ──
// Your links float at the top as glass bubbles, empty until you add one; then its painting
// comes in and the bubble gives a small pop. Below, one clean pill per link: paste the URL
// and it reads back as the handle.


// Where each bubble floats in the cluster: left as a share of the width, top in px, size.
const CLUSTER: Record<LinkKind | "onairos", { left: string; top: number; size: number; t: number }> = {
  linkedin: { left: "4%", top: 22, size: 78, t: 6.2 },
  instagram: { left: "38%", top: 0, size: 96, t: 7 },
  x: { left: "28%", top: 112, size: 58, t: 5.4 },
  github: { left: "64%", top: 104, size: 70, t: 6.6 },
  site: { left: "77%", top: 8, size: 58, t: 5.8 },
  onairos: { left: "6%", top: 128, size: 50, t: 6.8 },
};

function Floater({ on, spin, size, left, top, t, label, onTap, children, ...g }: { on: boolean; spin?: boolean; size: number; left: string; top: number; t: number; label: string; onTap: () => void; children: React.ReactNode; art: Art; x: number; y: number }) {
  return (
    <motion.button type="button" aria-label={label} onClick={onTap} className="absolute rounded-full" style={{ left, top }} animate={{ y: [0, -6, 0] }} transition={{ duration: t, repeat: Infinity, ease: "easeInOut" }}>
      <motion.span className="block" animate={{ scale: on ? [1, 1.14, 1] : 1 }} transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }} whileTap={{ scale: 0.92 }}>
        <Glass size={size} dim={!on} spin={spin} zoom={240} {...g}>
          {children}
        </Glass>
      </motion.span>
    </motion.button>
  );
}

function LinkRow({ id, kind, name, art, x, y, value, onChange }: { id: string; kind: LinkKind | "extra"; name: string; art: Art; x: number; y: number; value: string; onChange: (v: string) => void }) {
  const [focus, setFocus] = useState(false);
  const on = !!value.trim();
  const M = MARKS[kind];
  const canPaste = typeof navigator !== "undefined" && !!navigator.clipboard?.readText;
  return (
    <label className="flex h-[60px] items-center gap-3 rounded-full bg-paper pl-[10px] pr-4 transition-shadow duration-300" style={{ boxShadow: focus ? "var(--lift-2)" : "var(--lift-1)" }}>
      <motion.span animate={{ scale: on ? [1, 1.12, 1] : 1 }} transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}>
        <Glass size={40} art={art} x={x} y={y} dim={!on} zoom={300}>
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
        {/* Your links, floating */}
        <div className="relative mx-auto mt-4 h-[188px] w-full max-w-[380px]">
          {LINKS.map((l) => {
            const M = MARKS[l.kind];
            const c = CLUSTER[l.kind];
            return (
              <Floater key={l.kind} on={!!links[l.kind]?.trim()} label={l.name} onTap={() => focusLink(l.kind)} art={l.art} x={l.x} y={l.y} {...c}>
                <M size={Math.round(c.size * 0.32)} />
              </Floater>
            );
          })}
          <Floater on={onairos === "on"} spin={onairos === "busy"} label="Onairos" onTap={() => document.getElementById("onairos")?.scrollIntoView({ block: "center", behavior: "smooth" })} {...ONAIROS_ART} {...CLUSTER.onairos}>
            <OnairosMark size={16} />
          </Floater>
        </div>

        <header className="px-1 pb-5 pt-4">
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

        <div id="onairos" className="mt-4 rounded-[28px] bg-paper p-4" style={{ boxShadow: "var(--lift-1)" }}>
          <div className="flex items-center gap-3">
            <Glass size={48} dim={onairos === "off"} spin={onairos === "busy"} zoom={300} {...ONAIROS_ART}>
              <OnairosMark size={18} />
            </Glass>
            <span className="min-w-0 flex-1">
              <span className="block t-nav text-ink">Onairos</span>
              <span className="block t-label text-ink-3">ChatGPT, Instagram, YouTube and more</span>
            </span>
            <button type="button" onClick={() => (haptic(), r.connectOnairos())} disabled={onairos !== "off"} className={`press h-9 shrink-0 rounded-full px-4 t-label font-medium transition-colors duration-300 ${onairos === "on" ? "bg-fill text-ink" : "bg-ink text-paper"} disabled:opacity-100`}>
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
// The recorder: a glass bubble with the dusk painting in it.
const ORB = { art: "hills" as Art, x: 74, y: 18, size: 76 };

function Talk({ onNext }: { onNext: () => void }) {
  const { name, links, onairos } = useR();
  const [lines, setLines] = useState<Line[]>([]);
  const [typing, setTyping] = useState(false);
  const [qi, setQi] = useState(0);
  const [phase, setPhase] = useState<"ask" | "reading" | "done">("ask");
  const [voice, setVoice] = useState<{ x: number; y: number; el: HTMLElement | null } | null>(null);
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
          const first = !prev || prev.from !== m.from || !!prev.reading;
          const nextL = lines[i + 1];
          const last = !nextL || nextL.from !== m.from || !!nextL.reading;
          return (
            <motion.li key={m.id} layout="position" className={`flex ${m.reading ? "justify-center" : m.from === "me" ? "justify-end" : "justify-start"} ${first ? "mt-3" : ""}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", duration: 0.4, bounce: 0 }}>
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
    </div>
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
        animate={disabled ? { scale: 1 } : { scale: [1, 1.035, 1] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        whileTap={{ scale: 0.93 }}
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
