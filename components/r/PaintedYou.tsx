"use client";

// You, painted. Each thing Force read from (a link, Onairos, your voice) lays one stroke of
// oil pastel in its own painting: in from the edge, curving as a hand would, thickening as
// it nears the middle. Then a few loose loops in all of their colours, and the strokes have
// become one warm, uneven body: you, made of everything you gave it. Painted once, in front
// of you, the same way the mark is painted on the way in; then it stays still.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Art } from "@/data/mira";
import { painting } from "../f/Goo";

export type Source = { key: string; label: string; art: Art; x: number; y: number };

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

// Catmull-Rom through the points, so the pastel moves in curves, not corners.
function along(pts: [number, number][], u: number): [number, number] {
  const n = pts.length - 1;
  const f = Math.max(0, Math.min(n - 1e-6, u * n));
  const i = Math.floor(f);
  const t = f - i;
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[Math.min(n, i + 1)];
  const p3 = pts[Math.min(n, i + 2)];
  const c = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t * t + (-a + 3 * b - 3 * cc + d) * t * t * t);
  return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
}

type Stroke = { pts: [number, number][]; w0: number; w1: number; t0: number; dur: number; src: number };

export default function PaintedYou({ sources, name, height = 280 }: { sources: Source[]; name?: string; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(0);
  const [labels, setLabels] = useState<{ key: string; label: string; x: number; y: number; t0: number }[]>([]);
  const [t, setT] = useState(0);
  const sig = sources.map((s) => s.key).join(",");

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = cv.current;
    if (!c || !w || !sources.length) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const H = height;
    c.width = Math.round(w * dpr);
    c.height = Math.round(H * dpr);
    const ctx = c.getContext("2d")!;
    const layer = document.createElement("canvas");
    layer.width = c.width;
    layer.height = c.height;
    const L = layer.getContext("2d")!;
    L.scale(dpr, dpr);

    // Paper tooth: fine noise the pastel skips over
    const grain = document.createElement("canvas");
    grain.width = grain.height = 64;
    const G = grain.getContext("2d")!;
    const gr = rng(11);
    const gi = G.createImageData(64, 64);
    for (let i = 0; i < gi.data.length; i += 4) {
      const v = gr();
      gi.data[i] = gi.data[i + 1] = gi.data[i + 2] = 255;
      gi.data[i + 3] = v < 0.45 ? 0 : v < 0.72 ? 110 : 255;
    }
    G.putImageData(gi, 0, 0);
    const tooth = L.createPattern(grain, "repeat")!;

    const R = rng(sig.length * 97 + 13);
    const cx = w / 2;
    const cy = H * 0.45;
    const n = sources.length;
    const rx = Math.min(w * 0.36, H * 0.52);
    const ry = H * 0.36;
    const STEP = 0.34;
    const strokes: Stroke[] = [];
    const tags: typeof labels = [];
    // Each source is one long sweeping stroke round the middle, at its own distance, drifting
    // a little inward as the hand goes round, so together they make a loose painted nest.
    sources.forEach((s, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2 + (R() - 0.5) * 0.4;
      const sweep = 2.1 + R() * 1.1;
      const rb = 0.62 + (i % 3) * 0.14 + R() * 0.08;
      const phase = R() * Math.PI * 2;
      const pts = Array.from({ length: 9 }, (_, j) => {
        const u = j / 8;
        const aa = a + sweep * u;
        const rr = rb * (1 + 0.1 * Math.sin(u * Math.PI * 2 + phase)) * (1 - 0.32 * u);
        return [cx + Math.cos(aa) * rx * rr, cy + Math.sin(aa) * ry * rr] as [number, number];
      });
      strokes.push({ pts, w0: 9 + R() * 5, w1: 24 + R() * 10, t0: i * STEP, dur: 1.05, src: i });
      // Its word sits outside the painting, in the direction its stroke begins
      tags.push({ key: s.key, label: s.label, x: Math.max(42, Math.min(w - 42, cx + Math.cos(a) * (rx * 1.12 + 34))), y: Math.max(16, Math.min(H - 44, cy + Math.sin(a) * (ry * 1.12 + 16))), t0: i * STEP });
    });
    // The body: overlapping spirals, each in a different source's painting, worked out from
    // the middle until it's one full, uneven shape.
    const loops = 3;
    const bodyAt = n * STEP + 0.3;
    for (let k = 0; k < loops; k++) {
      const start = R() * Math.PI * 2;
      const rOut = 20 + R() * 10;
      const pts: [number, number][] = Array.from({ length: 12 }, (_, j) => {
        const u = j / 11;
        const aa = start + u * Math.PI * 2 * 1.4;
        const rr = 4 + u * rOut;
        return [cx + Math.cos(aa) * rr * 1.15 + (R() - 0.5) * 3, cy + Math.sin(aa) * rr + (R() - 0.5) * 3];
      });
      strokes.push({ pts, w0: 20 + R() * 6, w1: 22 + R() * 8, t0: bodyAt + k * 0.18, dur: 0.85, src: (k * 3 + 1) % n });
    }
    const END = bodyAt + loops * 0.16 + 0.8;
    setLabels(tags);

    // Each source's painting, fixed to the canvas: the pastel reveals it where it goes, with
    // the crop that source is known by sitting at the middle.
    const imgs = sources.map((s) => painting(s.art));
    const pats: (CanvasPattern | null)[] = sources.map(() => null);
    const patOf = (i: number) => {
      if (pats[i]) return pats[i];
      const img = imgs[i];
      if (!img.complete || !img.naturalWidth) return null;
      const p = L.createPattern(img, "repeat")!;
      const sc = (Math.max(w, H) * 1.6) / img.naturalWidth;
      const s = sources[i];
      p.setTransform(new DOMMatrix().translate(cx - (s.x / 100) * img.naturalWidth * sc, cy - (s.y / 100) * img.naturalHeight * sc).scale(sc));
      return (pats[i] = p);
    };

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const laid = strokes.map(() => 0);
    const born = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const tt = still ? END + 1 : (now - born) / 1000;
      strokes.forEach((s, si) => {
        const p = Math.max(0, Math.min(1, (tt - s.t0) / s.dur));
        const eased = 1 - Math.pow(1 - p, 2);
        if (eased <= laid[si]) return;
        const pat = patOf(s.src);
        if (!pat) return; // its painting is still loading; pick up from here next frame
        const steps = Math.max(1, Math.round((eased - laid[si]) * 120));
        for (let i = 1; i <= steps; i++) {
          const u = laid[si] + ((eased - laid[si]) * i) / steps;
          const [x, y] = along(s.pts, u);
          const [x2, y2] = along(s.pts, Math.min(1, u + 0.02));
          const ang = Math.atan2(y2 - y, x2 - x);
          const press = 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.2));
          const bw = (s.w0 + (s.w1 - s.w0) * u) * (0.85 + 0.3 * R()) * press;
          L.globalCompositeOperation = "source-over";
          L.globalAlpha = 0.5 + 0.4 * press;
          L.fillStyle = pat;
          L.beginPath();
          L.ellipse(x + (R() - 0.5) * 2, y + (R() - 0.5) * 2, 3.4, bw / 2, ang, 0, Math.PI * 2);
          L.fill();
          // The paper's tooth takes a little back, more where the pressure was light
          L.globalCompositeOperation = "destination-out";
          L.globalAlpha = 0.22 * (1 - press) + 0.04;
          L.fillStyle = tooth;
          L.beginPath();
          L.ellipse(x, y, 4, bw / 2, ang, 0, Math.PI * 2);
          L.fill();
        }
        laid[si] = eased;
      });
      L.globalCompositeOperation = "source-over";
      L.globalAlpha = 1;

      // A soft bloom of colour under the strokes, then the strokes themselves
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.save();
      ctx.filter = `blur(${8 * dpr}px)`;
      ctx.globalAlpha = 0.4;
      ctx.drawImage(layer, 0, 0);
      ctx.restore();
      ctx.drawImage(layer, 0, 0);
      setT(tt);
      if (tt < END) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sig stands in for sources
  }, [w, height, sig]);

  return (
    <div ref={box} className="relative overflow-hidden rounded-[28px] bg-paper" style={{ height, boxShadow: "var(--lift-1)" }}>
      <canvas ref={cv} className="absolute inset-0" style={{ width: w || "100%", height }} role="img" aria-label={`${name || "You"}, painted from ${sources.map((s) => s.label).join(", ")}`} />
      {labels.map((l) => (
        <span key={l.key} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap t-meta text-ink-3 transition-opacity duration-500" style={{ left: l.x, top: l.y, opacity: t > l.t0 ? 1 : 0 }} aria-hidden>
          {l.label}
        </span>
      ))}
      {name && (
        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 t-label font-medium text-ink-2 transition-opacity duration-700" style={{ bottom: 14, opacity: labels.length && t > labels.length * 0.34 + 0.6 ? 1 : 0 }}>
          {name}
        </span>
      )}
    </div>
  );
}
