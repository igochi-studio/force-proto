// Walks the whole residency flow in WebKit (iPhone Safari's engine), Chromium (Android) and
// Firefox, and reports page errors, console errors and any step that didn't happen.
// Screenshots of every step land in scripts/.shots/.
//
//   npm run dev                      (or npm run build && npm start)
//   npx playwright install webkit chromium firefox   (once)
//   npm run test:browsers            (URL=… to point it somewhere else)
import { chromium, devices, firefox, webkit } from "playwright";

const URL = process.env.URL ?? "http://localhost:3000/residency";
const OUT = new URL_("./.shots/", import.meta.url);
function URL_(p, base) {
  return new globalThis.URL(p, base);
}
import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

const runs = [
  { name: "webkit-iphone", type: webkit, ctx: { ...devices["iPhone 14"] }, noMic: true },
  { name: "chromium-android", type: chromium, ctx: { ...devices["Pixel 7"] }, launch: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] }, mic: true },
  { name: "firefox", type: firefox, ctx: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: false }, launch: { firefoxUserPrefs: { "media.navigator.streams.fake": true, "media.navigator.permission.disabled": true } }, mic: false },
];

const results = [];
let failed = false;
for (const run of runs) {
  const errors = [];
  const fails = [];
  const browser = await run.type.launch(run.launch ?? {});
  const context = await browser.newContext({ ...run.ctx, ...(run.mic ? { permissions: ["microphone"] } : {}) });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  const shot = (n) => page.screenshot({ path: new globalThis.URL(`${run.name}-${n}.png`, OUT).pathname });
  const step = async (label, fn) => {
    try {
      await fn();
    } catch (e) {
      fails.push(`${label}: ${String(e.message).split("\n")[0]}`);
      await shot(`FAIL-${label.replace(/\W+/g, "-")}`).catch(() => {});
    }
  };
  const tap = (loc) => (run.ctx.hasTouch ? loc.tap() : loc.click());

  await step("load", () => page.goto(URL, { waitUntil: "networkidle" }));
  await step("splash -> connect", () => page.getByRole("heading", { name: "Connect what's yours" }).waitFor({ timeout: 12000 }));
  await shot("1-connect");
  await step("fill links", async () => {
    await page.getByLabel("Your name").fill("Arushi Upmanyu");
    await page.locator("#link-linkedin").fill("https://www.linkedin.com/in/arushiupmanyu/");
    await page.locator("#link-instagram").fill("instagram.com/arushiupmanyu");
    await page.getByLabel("Your name").click();
    const shown = await page.locator("#link-linkedin").inputValue();
    if (shown !== "arushiupmanyu") throw new Error(`handle shown as "${shown}"`);
  });
  await step("onairos says what it reads first", () => page.getByText("What Force keeps:").waitFor({ timeout: 3000 }));
  // Looking you up is off until you say so; the iPhone run says yes and checks what comes back.
  await step("look-up is off by default", async () => {
    const sw = page.getByRole("switch", { name: "Let Force look you up" });
    if ((await sw.getAttribute("aria-checked")) !== "false") throw new Error("look-up was on before you chose it");
    if (run.name === "webkit-iphone") await tap(sw);
  });
  await step("onairos", async () => {
    await tap(page.getByRole("button", { name: "Connect with Onairos" }));
    await page.getByRole("button", { name: "Connected" }).waitFor({ timeout: 4000 });
    await page.getByRole("button", { name: "Disconnect" }).waitFor({ timeout: 2000 });
  });
  await step("continue", () => tap(page.getByRole("button", { name: "Continue", exact: true })));
  await step("first question", () => page.getByText("By the end of this residency").waitFor({ timeout: 8000 }));
  await shot("2-questions");

  const typeAnswer = async (text) => {
    const field = page.getByLabel("Your answer");
    if (!(await field.isVisible().catch(() => false))) await tap(page.getByRole("button", { name: "Type instead" }));
    await field.fill(text);
    await field.press("Enter");
    await page.getByText(text).waitFor({ timeout: 4000 });
  };
  const idle = () => page.waitForFunction(() => !document.querySelector('[role=status][aria-label="Force is writing"]'), null, { timeout: 8000 });

  // Answer 1 out loud (fake mic in Chromium and Firefox), 2 and 3 typed. WebKit's test build
  // has no microphone at all: there, voice mode opens and is cancelled, and all three are typed.
  // A recording with no words Force could catch must ask for a typed line, never fill one in.
  const A1 = "A working prototype of a memory tool for small teams, because good ideas get lost.";
  if (run.noMic)
    await step("voice mode opens and cancels", async () => {
      await tap(page.getByRole("button", { name: "Tap to answer out loud" }));
      await page.getByRole("dialog", { name: /Voice mode/ }).waitFor({ timeout: 4000 });
      await page.waitForTimeout(1500);
      await shot("3-voice");
      await tap(page.getByRole("button", { name: "Cancel" }));
      await page.getByRole("dialog", { name: /Voice mode/ }).waitFor({ state: "detached", timeout: 3000 });
      await typeAnswer(A1);
    });
  else await step("answer 1 by voice", async () => {
    await tap(page.getByRole("button", { name: "Tap to answer out loud" }));
    await page.getByRole("dialog", { name: /Voice mode/ }).waitFor({ timeout: 4000 });
    await page.waitForTimeout(2200);
    await shot("3-voice");
    await page.getByRole("dialog", { name: /Voice mode/ }).click({ position: { x: 100, y: 300 } });
    await page.getByText("Answer 1").waitFor({ timeout: 8000 });
    await idle();
    if (await page.getByText("couldn't catch the words").isVisible()) await typeAnswer(A1);
  });
  for (const [i, text] of [
    [2, "Small teams forget why they made decisions. It's for founders and early teams."],
    [3, "How do I get people to talk honestly in a single visit?"],
  ]) {
    await step(`answer ${i} typed`, async () => {
      await page.getByRole("button", { name: "Tap to answer out loud" }).or(page.getByLabel("Your answer")).waitFor({ timeout: 8000 });
      await idle();
      await typeAnswer(text);
    });
  }
  await step("what you can offer", async () => {
    await page.getByText("What could you help other residents with").waitFor({ timeout: 8000 });
    await idle();
    await tap(page.getByRole("button", { name: "Skills", exact: true }));
    await tap(page.getByRole("button", { name: "Done" }));
  });
  await step("what you'd value", async () => {
    await page.getByText("And what would you value help with").waitFor({ timeout: 8000 });
    await idle();
    await tap(page.getByRole("button", { name: "Feedback", exact: true }));
    await tap(page.getByRole("button", { name: "Done" }));
  });
  await step("snapshot grows in the chat", async () => {
    await page.getByText("Intent snapshot").waitFor({ timeout: 8000 });
    await page.getByRole("button", { name: "Check what Force understood" }).waitFor({ timeout: 60000 });
  });
  await shot("4-snapshot-in-chat");
  await step("open your snapshot", async () => {
    await tap(page.getByRole("button", { name: "Check what Force understood" }));
    await page.getByText("Is this right?").waitFor({ timeout: 5000 });
    await page.getByText("Here's what Force understands so far").last().waitFor({ timeout: 2000 });
  });
  await page.waitForTimeout(2600);
  await shot("5-your-snapshot");
  await step("all five parts render", async () => {
    for (const k of ["Intent", "Problem", "Approach", "Current frontier", "Contribution"]) await page.getByText(k, { exact: true }).first().waitFor({ timeout: 2000 });
  });
  await step("tap the middle node", async () => {
    const c = page.locator('canvas[aria-label^="Your pattern map"]').last();
    const b = await c.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.getByRole("button", { name: "Close" }).first().waitFor({ timeout: 3000 });
  });
  await shot("6-node-open");
  await step("got it closes the tip", async () => {
    await tap(page.getByRole("button", { name: "Got it" }));
    await page.getByText("Is this right?").waitFor({ state: "detached", timeout: 3000 });
  });
  await step("correct the intent", async () => {
    // A recording Force couldn't make sense of leaves Intent unknown, which is right; add it.
    await tap(page.getByRole("button", { name: /^Intent(:|\s+Force doesn)/ }).first());
    await page.getByLabel("Intent, in your words").fill("Ship a memory prototype that five teams use daily.");
    await tap(page.getByRole("button", { name: "Save" }));
    await page.getByText("Ship a memory prototype that five teams use daily.").waitFor({ timeout: 2000 });
  });
  await step("one next step, with why (or a prompt to choose one)", () => page.getByText("Why this may help:").or(page.getByLabel("Your next step")).first().waitFor({ timeout: 2000 }));
  await step("what Force noticed", () => page.getByText("What Force noticed").first().waitFor({ timeout: 2000 }));
  if (run.name === "webkit-iphone") await step("what Force found about you, with sources", () => page.getByText("What Force found about you").waitFor({ timeout: 3000 }));
  await step("share is its own choice", async () => {
    const sw = page.getByRole("switch", { name: "Share with the residency" });
    if ((await sw.getAttribute("aria-checked")) !== "false") throw new Error("sharing was on before you chose it");
    await tap(sw);
    await page.getByRole("button", { name: "Approve and share" }).waitFor({ timeout: 2000 });
  });
  await shot("7-approve");
  await step("approve and on to the residency", () => tap(page.getByRole("button", { name: "Approve and share" })));
  await step("home: cohort graph", async () => {
    await page.getByRole("tab", { name: "People", selected: true }).waitFor({ timeout: 6000 });
    await page.locator('canvas[aria-label^="The residency\'s graph"]').waitFor({ timeout: 3000 });
    if (await page.locator('canvas[aria-label*="Arjun"]').count()) throw new Error("an unapproved resident is in the graph");
  });
  await page.waitForTimeout(1500);
  await shot("8-home-graph");
  await step("people cards, connections first, with their reason", async () => {
    await page.getByText("People here").waitFor({ timeout: 3000 });
    await page.waitForFunction(() => !document.body.innerText.includes("Force is reading everyone"), null, { timeout: 60000 });
    await tap(page.getByRole("button", { name: /, (Shared problem|Complementary approach|Shared exploration|Potential contribution)$/ }).first());
    await page.getByText("Something to explore together").waitFor({ timeout: 3000 });
    await page.getByText("Suggested by Force, not yet reviewed").waitFor({ timeout: 2000 });
  });
  await shot("9-connection");
  await step("message from the connection", async () => {
    await tap(page.getByRole("button", { name: /^Say hi to / }));
    await page.getByText("Force drafted this from both snapshots").waitFor({ timeout: 3000 });
    await tap(page.getByRole("button", { name: "Send" }));
    await page.getByText("Something to explore together:").first().waitFor({ timeout: 3000 });
    await page.getByLabel("Message").fill("Would love to compare notes");
    await page.getByLabel("Message").press("Enter");
    await page.getByText("Would love to compare notes").last().waitFor({ timeout: 5000 });
  });
  await shot("10-thread");
  await step("survives a refresh", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "People", selected: true }).waitFor({ timeout: 8000 });
    await page.getByText("People here").waitFor({ timeout: 3000 });
  });
  await step("talk to Force", async () => {
    await tap(page.getByRole("tab", { name: "Conversations" }));
    await tap(page.getByRole("button", { name: /^Force/ }));
    await page.getByText("What's on your mind?").waitFor({ timeout: 5000 });
    await page.getByLabel("Share your thoughts").fill("Long day of interviews");
    await page.getByLabel("Share your thoughts").press("Enter");
    await page.getByText("Saved to memory").first().waitFor({ timeout: 6000 });
  });
  await shot("11-force");

  // The failure paths, once, in Chromium: Onairos not answering and synthesis failing must
  // each leave a readable way on, never an endless spinner.
  if (run.name === "chromium-android") {
    const fp = await context.newPage();
    const u = new globalThis.URL(URL);
    u.searchParams.set("reset", "1");
    u.searchParams.set("onairos", "fail");
    u.searchParams.set("synth", "fail");
    await step("failure: onairos", async () => {
      await fp.goto(u.toString(), { waitUntil: "networkidle" });
      await fp.getByRole("heading", { name: "Connect what's yours" }).waitFor({ timeout: 12000 });
      await fp.getByRole("button", { name: "Connect with Onairos" }).tap();
      await fp.getByText("Onairos didn't answer").waitFor({ timeout: 5000 });
      await fp.getByRole("button", { name: "Continue without these" }).or(fp.getByRole("button", { name: "Continue", exact: true })).tap();
    });
    await step("failure: synthesis has a way on", async () => {
      for (const t of ["Progress on a memory tool.", "Teams forget decisions.", "Will people use it daily?"]) {
        await fp.getByRole("button", { name: "Tap to answer out loud" }).waitFor({ timeout: 8000 });
        await fp.waitForFunction(() => !document.querySelector('[role=status][aria-label="Force is writing"]'), null, { timeout: 8000 });
        await fp.getByRole("button", { name: "Type instead" }).tap();
        await fp.getByLabel("Your answer").fill(t);
        await fp.getByLabel("Your answer").press("Enter");
      }
      for (let i = 0; i < 2; i++) {
        await fp.getByRole("button", { name: "Skip" }).waitFor({ timeout: 8000 });
        await fp.waitForFunction(() => !document.querySelector('[role=status][aria-label="Force is writing"]'), null, { timeout: 8000 });
        await fp.getByRole("button", { name: "Skip" }).tap();
      }
      await fp.getByRole("button", { name: "Use a plain draft from my answers" }).waitFor({ timeout: 10000 });
      await fp.screenshot({ path: new globalThis.URL(`${run.name}-12-synth-failed.png`, OUT).pathname });
      await fp.getByRole("button", { name: "Use a plain draft from my answers" }).tap();
      await fp.getByRole("button", { name: "Check what Force understood" }).waitFor({ timeout: 14000 });
    });
    await fp.close();
  }
  // Safari ignores the Android-only interactive-widget viewport key and says so; that's fine.
  const real = [...new Set(errors)].filter((e) => !e.includes("interactive-widget"));
  if (fails.length || real.length) failed = true;
  results.push({ run: run.name, fails, errors: real });
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
process.exit(failed ? 1 : 0);
