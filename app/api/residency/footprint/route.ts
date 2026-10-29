// POST /api/residency/footprint: with the resident's say-so, what's public about them, from
// the links they gave and a search of their name, each finding with its sources. Nothing is
// kept on the server; the resident keeps or removes each finding on their own page.

import { hasClaude, readFootprint } from "@/server/claude";

export const maxDuration = 120;

export async function POST(req: Request) {
  let body: { name?: string; links?: string[]; consent?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected a name and links." }, { status: 400 });
  }
  if (!body.consent) return Response.json({ error: "Only with the resident's say-so." }, { status: 403 });
  const name = (body.name ?? "").trim();
  if (!name) return Response.json({ findings: [], read: [] });
  if (!hasClaude()) return Response.json({ findings: [], read: [] }, { status: 503 });
  try {
    return Response.json(await readFootprint(name, (body.links ?? []).filter((l) => typeof l === "string" && l.trim()).slice(0, 8)));
  } catch (e) {
    console.error("footprint failed", e);
    return Response.json({ findings: [], read: [], ...(process.env.NODE_ENV !== "production" && { detail: String(e) }) }, { status: 502 });
  }
}
