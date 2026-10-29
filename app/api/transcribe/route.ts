// POST /api/transcribe: a recorded answer (multipart "file") → its words, via ElevenLabs
// Scribe. Browsers without speech recognition (Dia, Arc, Firefox) need this; the others use
// it too because it's more accurate. The key stays on the server.

export const maxDuration = 60;

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return Response.json({ text: "" }, { status: 503 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob) || !file.size) return Response.json({ error: "Expected an audio file." }, { status: 400 });
  const body = new FormData();
  body.set("model_id", "scribe_v2");
  body.set("file", file, "answer");
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": key }, body });
    if (!res.ok) throw new Error(`ElevenLabs answered ${res.status}`);
    const out = (await res.json()) as { text?: string };
    // Sound tags like "(beeping)" or "[music]" aren't words you said.
    return Response.json({ text: (out.text ?? "").replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim() });
  } catch (e) {
    console.error("transcribe failed", e);
    return Response.json({ text: "" }, { status: 502 });
  }
}
