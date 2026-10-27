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
  await step("onairos", async () => {
    await tap(page.getByRole("button", { name: "Connect with Onairos" }));
    await page.getByRole("button", { name: "Connected" }).waitFor({ timeout: 4000 });
  });
  await step("continue", () => tap(page.getByRole("button", { name: "Continue", exact: true })));
  await step("first question", () => page.getByText("What are you working on here?").waitFor({ timeout: 8000 }));
  await shot("2-questions");

  // Answer 1 out loud (fake mic in Chromium and Firefox), 2 and 3 typed. WebKit's test build
  // has no microphone at all: there, voice mode opens and is cancelled, and all three are typed.
  if (run.noMic)
    await step("voice mode opens and cancels", async () => {
      await tap(page.getByRole("button", { name: "Tap to answer out loud" }));
      await page.getByRole("dialog", { name: /Voice mode/ }).waitFor({ timeout: 4000 });
      await page.waitForTimeout(1500);
      await shot("3-voice");
      await tap(page.getByRole("button", { name: "Cancel" }));
      await page.getByRole("dialog", { name: /Voice mode/ }).waitFor({ state: "detached", timeout: 3000 });
      await tap(page.getByRole("button", { name: "Type instead" }));
      await page.getByLabel("Your answer").fill("Building a pricing tool for small farmers.");
      await page.getByLabel("Your answer").press("Enter");
      await page.getByText("Building a pricing tool for small farmers.").waitFor({ timeout: 4000 });
    });
  else await step("answer 1 by voice", async () => {
    await tap(page.getByRole("button", { name: "Tap to answer out loud" }));
    await page.getByRole("dialog", { name: /Voice mode/ }).waitFor({ timeout: 4000 });
    await page.waitForTimeout(2200);
    await shot("3-voice");
    await page.getByRole("dialog", { name: /Voice mode/ }).click({ position: { x: 100, y: 300 } });
    await page.getByText("Answer 1").waitFor({ timeout: 8000 });
  });
  for (const [i, text] of [
    [2, "Honestly the calls. I keep going back to talking to farmers."],
    [3, "Two or three people I'd call at midnight about this."],
  ]) {
    await step(`answer ${i} typed`, async () => {
      await page.getByRole("button", { name: "Tap to answer out loud" }).waitFor({ timeout: 8000 });
      await page.waitForFunction(() => !document.querySelector('[role=status][aria-label="Force is writing"]'), null, { timeout: 8000 });
      await tap(page.getByRole("button", { name: "Type instead" }));
      await page.getByLabel("Your answer").fill(text);
      await page.getByLabel("Your answer").press("Enter");
      await page.getByText(text).waitFor({ timeout: 4000 });
    });
  }
  await step("map grows and is readable", async () => {
    await page.getByText("Analysing your answers and links").waitFor({ timeout: 8000 });
    await page.getByRole("button", { name: "Find people with this energy" }).waitFor({ timeout: 12000 });
  });
  await shot("4-map-in-chat");
  await step("open your page", async () => {
    await tap(page.getByRole("button", { name: /Pattern map/ }).first());
    await page.getByText("Is this you?").waitFor({ timeout: 5000 });
  });
  await page.waitForTimeout(2600);
  await shot("5-your-page");
  await step("tap the middle node", async () => {
    const c = page.locator('canvas[aria-label^="Your pattern map"]').last();
    const b = await c.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.getByText("What you want to change").first().or(page.getByText("You", { exact: true }).first()).waitFor({ timeout: 3000 });
  });
  await shot("6-node-open");
  await step("got it closes the tip", async () => {
    await tap(page.getByRole("button", { name: "Got it" }));
    await page.getByText("Is this you?").waitFor({ state: "detached", timeout: 3000 });
  });
  await step("links editable on your page", () => page.locator("#link-github").waitFor({ timeout: 3000 }));
  await step("read me again", async () => {
    await tap(page.getByRole("button", { name: "Read me again" }));
    await page.getByText("Force read you again.").waitFor({ timeout: 3000 });
  });
  await step("on to the people", () => tap(page.getByRole("button", { name: "Find people with this energy" }).last()));
  await step("home: people tab", () => page.getByRole("tab", { name: "People", selected: true }).waitFor({ timeout: 6000 }));
  await page.waitForTimeout(800);
  await shot("7-home-people");
  await step("open a thread", async () => {
    await tap(page.getByRole("tab", { name: "Conversations" }));
    await tap(page.getByRole("button", { name: /^Meera/ }));
    await page.getByLabel("Message").fill("Would love your question list");
    await page.getByLabel("Message").press("Enter");
    await page.getByText("I have a list of questions").last().waitFor({ timeout: 5000 });
  });
  await shot("8-thread");
  await step("talk to Force", async () => {
    await tap(page.getByRole("button", { name: "Back" }).first());
    await page.waitForTimeout(700);
    await tap(page.getByRole("button", { name: /^Force/ }));
    await page.getByText("What's on your mind?").waitFor({ timeout: 5000 });
    await page.getByLabel("Share your thoughts").fill("Long day of farmer calls");
    await page.getByLabel("Share your thoughts").press("Enter");
    await page.getByText("Saved to memory").first().waitFor({ timeout: 6000 });
  });
  await shot("9-force");
  // Safari ignores the Android-only interactive-widget viewport key and says so; that's fine.
  const real = [...new Set(errors)].filter((e) => !e.includes("interactive-widget"));
  if (fails.length || real.length) failed = true;
  results.push({ run: run.name, fails, errors: real });
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
process.exit(failed ? 1 : 0);
