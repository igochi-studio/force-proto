"use client";

// Your pattern map as a world: the same painted goo sphere as memory, without dates. You sit
// in the middle; what you want to change (intents) around you; the themes and methods around
// those, which is where other people come in, hanging off the themes you share. Strands are
// beads of the painting they lead to. It grows out from you once, then turns slowly.
// Drag to turn it, tap a node to bring it and everything it touches forward; the rest fades.

import { useEffect, useRef } from "react";
import { ART_SRC, ART_TONE, type Art } from "@/data/mira";
import type { NodeKind, WNode } from "@/data/residency";
import { painting } from "../f/Goo";
import { haptic } from "../f/ui";

type V3 = [number, number, number];
const norm = (v: V3): V3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const sph = (lon: number, lat: number): V3 => [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];

const RADIUS: Record<NodeKind, number> = { you: 15, intent: 11, theme: 8, person: 9 };
const DIST: Record<NodeKind, number> = { you: 0, intent: 0.66, theme: 1.02, person: 1.3 };
const ORDER: Record<NodeKind, number> = { you: 0, intent: 1, theme: 2, person: 3 };

type PNode = WNode & { p: V3 };

// Intents spread round you; each theme near the intent it came from; each person beyond the
// theme they share with you.
function layout(nodes: WNode[], edges: [string, string][]): PNode[] {
  const parent = (id: string) => edges.find(([, b]) => b === id)?.[0];
  const dir: Record<string, V3> = {};
  const out: PNode[] = [];
  const intents = nodes.filter((n) => n.kind === "intent");
  intents.forEach((n, i) => (dir[n.id] = sph(-0.9 + (i / Math.max(1, intents.length - 1)) * 1.8 + 0.2, (i % 2 ? 0.35 : -0.25))));
  const kids: Record<string, number> = {};
  for (const kind of ["theme", "person"] as NodeKind[])
    nodes
      .filter((n) => n.kind === kind)
      .forEach((n) => {
        const pa = parent(n.id) ?? "you";
        const base = dir[pa] ?? sph(0, 0);
        const k = (kids[pa] = (kids[pa] ?? 0) + 1);
        const a = k * 2.2 + (kind === "person" ? 0.6 : 0);
        const up: V3 = Math.abs(base[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
        const t1 = norm([up[1] * base[2] - up[2] * base[1], up[2] * base[0] - up[0] * base[2], up[0] * base[1] - up[1] * base[0]]);
        const t2: V3 = [base[1] * t1[2] - base[2] * t1[1], base[2] * t1[0] - base[0] * t1[2], base[0] * t1[1] - base[1] * t1[0]];
        const d = kind === "theme" ? 0.55 : 0.3;
        dir[n.id] = norm([base[0] + (t1[0] * Math.cos(a) + t2[0] * Math.sin(a)) * d, base[1] + (t1[1] * Math.cos(a) + t2[1] * Math.sin(a)) * d, base[2] + (t1[2] * Math.cos(a) + t2[2] * Math.sin(a)) * d]);
      });
  nodes.forEach((n) => {
    const d = dir[n.id] ?? [0, 0, 1];
    const r = DIST[n.kind];
    out.push({ ...n, p: n.kind === "you" ? [0, 0, 0.05] : [d[0] * r, d[1] * r, d[2] * r] });
  });
  return out;
}

let BLOB: HTMLCanvasElement | null = null;
function blob() {
  if (BLOB) return BLOB;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    gr.addColorStop(t, `rgba(0,0,0,${Math.pow(1 - t * t, 2).toFixed(3)})`);
  }
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  BLOB = c;
  return c;
}
const SPREAD = 1.7;
const THRESH = 0.42;

export default function PatternWorld({ nodes, edges, focus, onTap, onGrown, interactive = true }: { nodes: WNode[]; edges: [string, string][]; focus: string | null; onTap?: (id: string | null) => void; onGrown?: () => void; interactive?: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const props = useRef({ focus, onTap, onGrown });
  useEffect(() => {
    props.current = { focus, onTap, onGrown };
  });
  const cam = useRef({ yaw: 0, pitch: 0.12, zoom: 1, vy: 0, vp: 0, idleAt: 0 });
  const sig = nodes.map((n) => n.id + n.label).join("|") + edges.join("|");

  useEffect(() => {
    const canvas = cv.current!;
    const ctx = canvas.getContext("2d")!;
    (Object.keys(ART_SRC) as Art[]).forEach(painting);
    const P0 = layout(nodes, edges);
    const byId = new Map(P0.map((n) => [n.id, n]));
    const font = getComputedStyle(document.body).fontFamily || "system-ui";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const born = performance.now();
    let told = false;
    let W = 0;
    let H = 0;
    let dpr = 1;
    let raf = 0;
    let alive = true;
    const C = cam.current;
    C.idleAt = performance.now();
    const proj: { n: PNode; x: number; y: number; r: number }[] = [];

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

    const D = 3.2;
    const project = (p: V3, k: number) => {
      const cy = Math.cos(C.yaw);
      const sy = Math.sin(C.yaw);
      const cp = Math.cos(C.pitch);
      const sp = Math.sin(C.pitch);
      const x1 = p[0] * cy + p[2] * sy;
      const z1 = -p[0] * sy + p[2] * cy;
      const y2 = p[1] * cp - z1 * sp;
      const z2 = p[1] * sp + z1 * cp;
      const base = Math.min(W * 0.9, H * 1.1) * 0.36 * C.zoom;
      const s = (base * D) / (D - z2 * k);
      return { x: W / 2 + x1 * k * s, y: H / 2 - y2 * k * s, z: z2 * k, s: s / base };
    };

    let drag = false;
    const draw = (now: number) => {
      if (!alive) return;
      if (!canvas.width || !canvas.height) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const t = (now - born) / 1000;
      C.yaw += C.vy;
      C.pitch = Math.max(-1, Math.min(1, C.pitch + C.vp));
      C.vy *= 0.94;
      C.vp *= 0.94;
      if (!reduce && !drag && now - C.idleAt > 1800 && !props.current.focus) C.vy += (0.0018 - C.vy) * 0.03;

      // Growth: you first, then what you want, then the themes, then the people.
      const grow = (n: PNode) => {
        if (reduce) return 1;
        const x = Math.max(0, Math.min(1, (t - 0.1 - ORDER[n.kind] * 0.55) / 0.8));
        return 1 - Math.pow(1 - x, 3);
      };
      if (!told && (reduce || t > 0.1 + 3 * 0.55 + 0.9)) {
        told = true;
        props.current.onGrown?.();
      }

      // What you tapped and everything it touches stay; the rest fades back.
      const foc = props.current.focus;
      const near = new Set<string>();
      if (foc) {
        near.add(foc);
        edges.forEach(([a, b]) => {
          if (a === foc) near.add(b);
          if (b === foc) near.add(a);
        });
      }
      const lit = (id: string) => !foc || near.has(id);

      const P = new Map<string, ReturnType<typeof project> & { g: number }>();
      P0.forEach((n) => {
        const g = grow(n);
        P.set(n.id, { ...project(n.p, 0.25 + 0.75 * g), g });
      });
      const blobs: [number, number, number, Art, boolean][] = [];
      edges.forEach(([ai, bi], ei) => {
        const A = byId.get(ai);
        const B = byId.get(bi);
        if (!A || !B) return;
        const g = P.get(bi)!.g;
        if (g <= 0.02) return;
        const a = P.get(ai)!;
        const b = P.get(bi)!;
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.max(6, Math.round(len / 2.4));
        for (let i = 1; i < steps; i++) {
          const u = i / steps;
          if (u > g) break;
          const q = project([A.p[0] + (B.p[0] - A.p[0]) * u, A.p[1] + (B.p[1] - A.p[1]) * u, A.p[2] + (B.p[2] - A.p[2]) * u], 0.25 + 0.75 * g);
          const wave = 0.5 + 0.6 * Math.abs(Math.sin(u * len * 0.28 + ei * 1.7));
          blobs.push([q.x, q.y, 1.3 * q.s * wave, B.art, lit(ai) && lit(bi)]);
        }
      });
      proj.length = 0;
      const labels: { z: number; x: number; y: number; fs: number; w: number; text: string; picked: boolean; dim: boolean; a: number; kind: NodeKind }[] = [];
      P0.forEach((n) => {
        const q = P.get(n.id)!;
        if (q.g <= 0.01) return;
        const r = RADIUS[n.kind] * q.s * (0.3 + 0.7 * q.g);
        blobs.push([q.x, q.y, r, n.art, lit(n.id)]);
        proj.push({ n, x: q.x, y: q.y, r: Math.max(r, 16) });
        const depth = (q.z + 1) / 2;
        const fs = n.kind === "you" ? 13 : n.kind === "intent" ? 12 : 11;
        labels.push({ z: n.kind === "you" ? 9 : q.z, x: q.x, y: q.y + r + fs + 2, fs: fs * (0.85 + 0.25 * depth), w: n.kind === "intent" || n.kind === "you" ? 600 : 500, text: n.label, picked: n.id === foc, dim: !lit(n.id), a: Math.min(1, q.g * 1.5) * (0.5 + 0.5 * depth), kind: n.kind });
      });

      // Goo, one painting at a time, thresholded so the beads fuse like liquid.
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
      const Bl = blob();
      const lo = THRESH * 255 - 14;
      const hi = THRESH * 255 + 14;
      const arts = Array.from(new Set(blobs.map((b) => b[3])));
      for (const art of arts)
        for (const bright of foc ? [false, true] : [true]) {
          mctx.globalCompositeOperation = "source-over";
          mctx.clearRect(0, 0, mw, mh);
          mctx.globalCompositeOperation = "lighter";
          for (const [x, y, r, ba, l] of blobs) {
            if (ba !== art || (foc && l !== bright)) continue;
            const R = r * SPREAD * MS;
            mctx.drawImage(Bl, x * MS - R, y * MS - R, R * 2, R * 2);
          }
          const img = mctx.getImageData(0, 0, mw, mh);
          const d = img.data;
          for (let i = 3; i < d.length; i += 4) {
            const v = d[i];
            d[i] = v <= lo ? 0 : v >= hi ? 255 : ((v - lo) / (hi - lo)) * 255;
          }
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
          ctx.globalAlpha = bright ? 1 : 0.16;
          ctx.drawImage(layer, 0, 0);
          ctx.globalAlpha = 1;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

      // Words under the nodes: the nearest first, so none overlap; you always.
      const placed: [number, number, number, number][] = [];
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      labels
        .sort((a, b) => Number(b.picked) - Number(a.picked) || b.z - a.z)
        .forEach((l) => {
          ctx.font = `${l.w} ${l.fs.toFixed(1)}px ${font}`;
          const w = ctx.measureText(l.text).width;
          const x = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, l.x));
          const box: [number, number, number, number] = [x - w / 2 - 3, l.y - l.fs, x + w / 2 + 3, l.y + 3];
          if (placed.some((p) => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1])) return;
          placed.push(box);
          ctx.globalAlpha = l.dim ? 0.15 : l.a;
          ctx.fillStyle = l.picked || l.kind === "you" || l.kind === "intent" ? "#1c1b1a" : l.kind === "person" ? "#4a4846" : "#6b6966";
          ctx.fillText(l.text, x, l.y);
        });
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    // ── Gestures: drag to turn, tap a node ──
    let start: { x: number; y: number; moved: boolean } | null = null;
    let last = { x: 0, y: 0, t: 0 };
    const local = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect();
      return { x: e.clientX - b.left, y: e.clientY - b.top };
    };
    const hit = (x: number, y: number) => {
      let best: PNode | null = null;
      let bd = Infinity;
      for (const p of proj) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < p.r + 8 && d < bd) {
          bd = d;
          best = p.n;
        }
      }
      return best;
    };
    const down = (e: PointerEvent) => {
      const p = local(e);
      drag = true;
      C.vy = 0;
      C.vp = 0;
      C.idleAt = Infinity;
      start = { ...p, moved: false };
      last = { ...p, t: e.timeStamp };
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const p = local(e);
      if (start && Math.hypot(p.x - start.x, p.y - start.y) > 8) {
        if (!start.moved) canvas.setPointerCapture(e.pointerId);
        start.moved = true;
      }
      if (!start?.moved) return;
      const dt = Math.max(1, e.timeStamp - last.t);
      const dx = p.x - last.x;
      const dy = p.y - last.y;
      C.yaw += dx * 0.009;
      C.pitch = Math.max(-1, Math.min(1, C.pitch + dy * 0.009));
      C.vy = ((dx * 0.009) / dt) * 16;
      C.vp = ((dy * 0.009) / dt) * 16;
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
      drag = false;
      C.idleAt = performance.now();
    };
    if (interactive) {
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      canvas.addEventListener("pointercancel", up);
    }
    raf = requestAnimationFrame(draw);
    const vis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", vis);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sig stands in for nodes and edges
  }, [sig, interactive]);

  return <canvas ref={cv} className="block h-full w-full" style={{ touchAction: "pan-y", pointerEvents: interactive ? "auto" : "none" }} role="img" aria-label={`Your pattern map: ${nodes.filter((n) => n.kind === "intent").map((n) => n.label).join("; ")}`} />;
}
