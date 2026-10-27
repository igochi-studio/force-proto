"use client";

// Who you are online: your name, your links, Onairos. The same pieces on the way in and on
// your own page, so you can change them any time; Force reads them again when you do.

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Art } from "@/data/mira";
import { LINKS, pretty, type LinkKind } from "@/data/residency";
import { r, useR } from "@/lib/f/residency";
import Glass from "../f/Glass";
import { MARKS, OnairosMark } from "../f/brands";
import { I, haptic } from "../f/ui";

export function NameField({ className = "" }: { className?: string }) {
  const name = useR((s) => s.name);
  return (
    <label className={`flex h-[60px] items-center rounded-full bg-paper px-5 ${className}`} style={{ boxShadow: "var(--lift-1)" }}>
      <input value={name} onChange={(e) => r.setName(e.target.value)} autoComplete="name" placeholder="Your name" aria-label="Your name" enterKeyHint="next" className="min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-ink-3" />
    </label>
  );
}

export function LinkRow({ id, kind, name, art, x, y, value, onChange }: { id: string; kind: LinkKind | "extra"; name: string; art: Art; x: number; y: number; value: string; onChange: (v: string) => void }) {
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

// One pill per place, then any others you add.
export function LinkList({ className = "" }: { className?: string }) {
  const { links, extra } = useR();
  const focusLink = (k: string) => {
    const el = document.getElementById(`link-${k}`);
    el?.focus();
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  return (
    <div className={className}>
      <div className="flex flex-col gap-2">
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
    </div>
  );
}

export function OnairosCard({ className = "" }: { className?: string }) {
  const onairos = useR((s) => s.onairos);
  return (
    <div id="onairos" className={`rounded-[28px] bg-paper p-5 ${className}`} style={{ boxShadow: "var(--lift-1)" }}>
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
  );
}
