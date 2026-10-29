"use client";

// Your pattern map as a world: the same painted goo sphere as memory, without dates. You sit
// in the middle; what you want to change around you; the themes around those, which is where
// other people come in, hanging off the themes you share. Strands are beads of the painting
// they lead to. The far side fades nearly away, so only the face of the world turned to you
// reads; turn it and the rest comes forward. Each node is named in a word or two.
// It grows out from you once, then turns slowly. Drag to turn it; tap a node to bring it and
// everything it touches forward.
//
// The geometry is in lib/f/world.ts (no DOM); this file only draws it and handles touch.

import { useEffect, useRef } from "react";
import { ART_SRC, ART_TONE, type Art } from "@/data/mira";
import type { NodeKind, WNode } from "@/data/residency";
import { BAND_ALPHA, GROWN_AT, ORDER_COHORT, RADIUS, bandOf, growth, layout, layoutCohort, nearness, project, type Camera, type PNode } from "@/lib/f/world";
import { painting } from "../f/Goo";
import { haptic } from "../f/ui";

// A soft round brush; overlapping ones add up and fuse once they cross the threshold.
let BLOB: HTMLCanvasElement | null = null;
function blob() {
  if (BLOB) return BLOB;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (let i = 0; i <= 10; i++) gr.addColorStop(i / 10, `rgba(0,0,0,${Math.pow(1 - (i / 10) ** 2, 2).toFixed(3)})`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  BLOB = c;
  return c;
}
const SPREAD = 1.7;
const THRESH = 0.42;
const DIM = -1; // a band for what's faded back behind the node you tapped
const INK: Record<NodeKind, string> = { you: "#1c1b1a", intent: "#1c1b1a", theme: "#6b6966", person: "#4a4846" };

type Bead = { x: number; y: number; r: number; art: Art; band: number };

// layout: "you" puts you in the middle of your own map; "cohort" spreads everyone out.
export default function PatternWorld({ nodes, edges, focus, onTap, onGrown, interactive = true, layout: mode = "you" }: { nodes: WNode[]; edges: [string, string][]; focus: string | null; onTap?: (id: string | null) => void; onGrown?: () => void; interactive?: boolean; layout?: "you" | "cohort" }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const props = useRef({ focus, onTap, onGrown });
  useEffect(() => {
    props.current = { focus, onTap, onGrown };
  });
  const cam = useRef<Camera & { vy: number; vp: number; idleAt: number }>({ yaw: 0, pitch: 0.12, zoom: 1, vy: 0, vp: 0, idleAt: 0 });
  const sig = nodes.map((n) => n.id + n.title).join("|") + edges.join("|");

  useEffect(() => {
    const canvas = cv.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    (Object.keys(ART_SRC) as Art[]).forEach(painting);
    const world = mode === "cohort" ? layoutCohort(nodes, edges) : layout(nodes, edges);
    const order = mode === "cohort" ? ORDER_COHORT : undefined;
    const byId = new Map(world.map((n) => [n.id, n]));
    const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const born = performance.now();
    const C = cam.current;
    C.idleAt = born;
    let told = false;
    let W = 0;
    let H = 0;
    let dpr = 1;
    let raf = 0;
    let alive = true;
    let dragging = false;
    const hits: { n: PNode; x: number; y: number; r: number }[] = [];

    const size = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(canvas);
    const layer = document.createElement("canvas");
    const lctx = layer.getContext("2d")!;
    const mask = document.createElement("canvas");
    const mctx = mask.getContext("2d", { willReadFrequently: true })!;

    let shown = true; // on screen; off screen it stops drawing
    const draw = (now: number) => {
      if (!alive || !shown) return;
      if (!canvas.width || !canvas.height) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const t = (now - born) / 1000;

      // Camera: inertia after a drag, then a slow idle turn.
      C.yaw += C.vy;
      C.pitch = Math.max(-1, Math.min(1, C.pitch + C.vp));
      C.vy *= 0.94;
      C.vp *= 0.94;
      if (!reduce && !dragging && now - C.idleAt > 1800 && !props.current.focus && mode !== "cohort") C.vy += (0.0018 - C.vy) * 0.03;
      if (!told && (reduce || t > GROWN_AT)) {
        told = true;
        props.current.onGrown?.();
      }

      // What you tapped and everything it touches come forward; the rest fades back.
      const foc = props.current.focus;
      const near = new Set<string>();
      if (foc) {
        near.add(foc);
        for (const [a, b] of edges) {
          if (a === foc) near.add(b);
          if (b === foc) near.add(a);
        }
      }
      const lit = (id: string) => !foc || near.has(id);
      const bandFor = (z: number, on: boolean, always = false) => (!on ? DIM : foc || always ? 2 : bandOf(nearness(z)));

      const P = new Map(world.map((n) => {
        const g = reduce ? 1 : growth(n.kind, t, order);
        return [n.id, { ...project(n.p, C, W, H, 0.25 + 0.75 * g), g }];
      }));
      const beads: Bead[] = [];
      edges.forEach(([ai, bi], ei) => {
        const A = byId.get(ai);
        const B = byId.get(bi);
        if (!A || !B) return;
        const a = P.get(ai)!;
        const b = P.get(bi)!;
        if (b.g <= 0.02) return;
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.max(6, Math.round(len / 2.4));
        for (let i = 1; i < steps; i++) {
          const u = i / steps;
          if (u > b.g) break;
          const q = project([A.p[0] + (B.p[0] - A.p[0]) * u, A.p[1] + (B.p[1] - A.p[1]) * u, A.p[2] + (B.p[2] - A.p[2]) * u], C, W, H, 0.25 + 0.75 * b.g);
          const wave = 0.5 + 0.6 * Math.abs(Math.sin(u * len * 0.28 + ei * 1.7));
          beads.push({ x: q.x, y: q.y, r: 1.3 * q.s * wave, art: B.art, band: bandFor(q.z, lit(ai) && lit(bi)) });
        }
      });
      hits.length = 0;
      const labels: { x: number; y: number; z: number; size: number; weight: number; text: string; alpha: number; color: string; first: boolean }[] = [];
      world.forEach((n) => {
        const q = P.get(n.id)!;
        if (q.g <= 0.01) return;
        const r = RADIUS[n.kind] * q.s * (0.3 + 0.7 * q.g);
        const band = bandFor(q.z, lit(n.id), n.kind === "you");
        beads.push({ x: q.x, y: q.y, r, art: n.art, band });
        hits.push({ n, x: q.x, y: q.y, r: Math.max(r, 18) });
        const size = (n.kind === "you" ? 13 : n.kind === "intent" ? 12.5 : 11.5) * (0.85 + 0.2 * nearness(q.z));
        labels.push({
          x: q.x,
          y: q.y + r + size + 2,
          z: n.kind === "you" ? 9 : q.z,
          size,
          weight: n.kind === "you" || n.kind === "intent" ? 600 : 500,
          text: n.title,
          alpha: Math.min(1, q.g * 1.5) * (band === DIM ? 0.12 : BAND_ALPHA[band]),
          color: n.id === foc ? "#1c1b1a" : INK[n.kind],
          first: n.id === foc,
        });
      });

      // Goo: for each painting and each depth band, sum the beads into a mask, threshold it so
      // they fuse like liquid, and show the painting through it at that band's strength.
      const MS = 0.75;
      const mw = Math.max(1, Math.round(W * MS));
      const mh = Math.max(1, Math.round(H * MS));
      if (mask.width !== mw || mask.height !== mh) {
        mask.width = mw;
        mask.height = mh;
      }
      if (layer.width !== canvas.width || layer.height !== canvas.height) {
        layer.width = canvas.width;
        layer.height = canvas.height;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const brush = blob();
      const lo = THRESH * 255 - 14;
      const hi = THRESH * 255 + 14;
      const passes = new Map<string, { art: Art; band: number }>();
      beads.forEach((b) => passes.set(`${b.band}:${b.art}`, { art: b.art, band: b.band }));
      [...passes.values()]
        .sort((a, b) => a.band - b.band) // far first, so the near side paints over it
        .forEach(({ art, band }) => {
          mctx.globalCompositeOperation = "source-over";
          mctx.clearRect(0, 0, mw, mh);
          mctx.globalCompositeOperation = "lighter";
          for (const b of beads) {
            if (b.art !== art || b.band !== band) continue;
            const R = b.r * SPREAD * MS;
            mctx.drawImage(brush, b.x * MS - R, b.y * MS - R, R * 2, R * 2);
          }
          const img = mctx.getImageData(0, 0, mw, mh);
          const d = img.data;
          for (let i = 3; i < d.length; i += 4) d[i] = d[i] <= lo ? 0 : d[i] >= hi ? 255 : ((d[i] - lo) / (hi - lo)) * 255;
          mctx.putImageData(img, 0, 0);
          lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          lctx.globalCompositeOperation = "source-over";
          lctx.clearRect(0, 0, W, H);
          const pi = painting(art);
          if (pi.complete && pi.naturalWidth) {
            const sc = Math.max(W / pi.naturalWidth, H / pi.naturalHeight) * 1.1;
            lctx.drawImage(pi, (W - pi.naturalWidth * sc) / 2, (H - pi.naturalHeight * sc) / 2, pi.naturalWidth * sc, pi.naturalHeight * sc);
          } else {
            lctx.fillStyle = ART_TONE[art].main;
            lctx.fillRect(0, 0, W, H);
          }
          lctx.globalCompositeOperation = "destination-in";
          lctx.drawImage(mask, 0, 0, W, H);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalAlpha = band === DIM ? 0.14 : BAND_ALPHA[band];
          ctx.drawImage(layer, 0, 0);
          ctx.globalAlpha = 1;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        });

      // Names under the nodes, nearest first so none overlap; the one you tapped always.
      const placed: [number, number, number, number][] = [];
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      labels
        .sort((a, b) => Number(b.first) - Number(a.first) || b.z - a.z)
        .forEach((l) => {
          if (l.alpha < 0.05) return;
          ctx.font = `${l.weight} ${l.size.toFixed(1)}px ${font}`;
          const w = ctx.measureText(l.text).width;
          const x = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, l.x));
          const box: [number, number, number, number] = [x - w / 2 - 3, l.y - l.size, x + w / 2 + 3, l.y + 3];
          if (placed.some((p) => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1])) return;
          placed.push(box);
          ctx.globalAlpha = l.alpha;
          ctx.fillStyle = l.color;
          ctx.fillText(l.text, x, l.y);
        });
      ctx.globalAlpha = 1;
      // A map you can't touch settles once it has grown: one still frame, nothing running.
      if (!interactive && told) return;
      raf = requestAnimationFrame(draw);
    };

    // ── Touch: drag to turn, tap a node ──
    let start: { x: number; y: number; moved: boolean } | null = null;
    let last = { x: 0, y: 0, t: 0 };
    const local = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect();
      return { x: e.clientX - b.left, y: e.clientY - b.top };
    };
    const hit = (x: number, y: number) => {
      let best: PNode | null = null;
      let bd = Infinity;
      for (const h of hits) {
        const d = Math.hypot(h.x - x, h.y - y);
        if (d < h.r + 8 && d < bd) {
          bd = d;
          best = h.n;
        }
      }
      return best;
    };
    const down = (e: PointerEvent) => {
      const p = local(e);
      dragging = true;
      C.vy = 0;
      C.vp = 0;
      C.idleAt = Infinity;
      start = { ...p, moved: false };
      last = { ...p, t: e.timeStamp };
    };
    const move = (e: PointerEvent) => {
      if (!dragging || !start) return;
      const p = local(e);
      if (!start.moved && Math.hypot(p.x - start.x, p.y - start.y) > 8) {
        start.moved = true;
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {}
      }
      if (!start.moved) return;
      const dt = Math.max(1, e.timeStamp - last.t);
      const dx = (p.x - last.x) * 0.009;
      const dy = (p.y - last.y) * 0.009;
      C.yaw += dx;
      C.pitch = Math.max(-1, Math.min(1, C.pitch + dy));
      C.vy = (dx / dt) * 16;
      C.vp = (dy / dt) * 16;
      last = { ...p, t: e.timeStamp };
    };
    const up = (e: PointerEvent) => {
      if (start && !start.moved) {
        const p = local(e);
        const n = hit(p.x, p.y);
        if (n) haptic();
        props.current.onTap?.(n ? n.id : null);
      }
      if (e.timeStamp - last.t > 80) {
        C.vy = 0;
        C.vp = 0;
      }
      start = null;
      dragging = false;
      C.idleAt = performance.now();
    };
    const cancel = () => {
      start = null;
      dragging = false;
      C.idleAt = performance.now();
    };
    if (interactive) {
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      canvas.addEventListener("pointercancel", cancel);
    }
    const resume = () => {
      cancelAnimationFrame(raf);
      if (shown && !document.hidden) raf = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", resume);
    const io = new IntersectionObserver(([e]) => {
      shown = e.isIntersecting;
      resume();
    });
    io.observe(canvas);
    raf = requestAnimationFrame(draw);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", resume);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sig stands in for nodes and edges
  }, [sig, interactive, mode]);

  return <canvas ref={cv} className="block h-full w-full" style={{ touchAction: "pan-y", pointerEvents: interactive ? "auto" : "none" }} role="img" aria-label={mode === "cohort" ? `The residency's graph: ${nodes.filter((n) => n.kind === "person" || n.kind === "you").map((n) => n.title).join(", ")}` : `Your pattern map: ${nodes.filter((n) => n.kind === "intent").map((n) => n.title).join(", ")}`} />;
}
