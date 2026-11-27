import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import postgres from "postgres";

const SLUG = "ypl-week-2-lead-session";
const DB = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/ypl_e2e";
const sql = postgres(DB, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

async function register(page: Page, p: { name: string; email: string; chapter: string; title: string; category: RegExp }) {
  await page.goto(`/e/${SLUG}/register`);
  await page.getByLabel("Name", { exact: true }).fill(p.name);
  await page.getByLabel("Chapter").fill(p.chapter);
  await page.getByLabel("Email").fill(p.email);
  await page.getByLabel("Your need, in one line").fill(p.title);
  await page.getByText(p.category).click();
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.getByText("You're registered ✓")).toBeVisible();
}

async function signIn(page: Page, email: string) {
  await page.goto(`/e/${SLUG}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function newPage(browser: Browser) {
  const ctx = await browser.newContext();
  return ctx.newPage();
}

test("register → sign in by email → offer and rate leads → notes → PowerPoint → automatic summaries", async ({ page, browser, request }) => {
  // 1. Ann registers, signs out, and signs back in with just her email.
  await register(page, { name: "Ann Able", email: "Ann@Example.com", chapter: "Boston", title: "Find healthcare investors", category: /^Fundraising$/ });
  await page.goto(`/e/${SLUG}/live`);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page, "ann@example.com");
  await expect(page).toHaveURL(/\/live$/);

  // 2. She edits her need on My Need; it autosaves.
  await page.getByRole("link", { name: "My Need" }).click();
  await page.getByLabel("Headline").fill("Find healthcare family-office investors");
  await expect(page.getByText("Saved ✓").first()).toBeVisible();
  expect((await sql`select title from needs`)[0].title).toBe("Find healthcare family-office investors");

  // 3. Bob registers on another phone.
  const bob = await newPage(browser);
  await register(bob, { name: "Bob Baker", email: "bob@example.com", chapter: "Chicago", title: "Hire a CFO", category: /^Professional Services$/ });

  // 4. The facilitator signs in, enters the PIN and goes live.
  const fac = await newPage(browser);
  await signIn(fac, "facilitator@example.com");
  await expect(fac).toHaveURL(/\/admin$/);
  await fac.getByLabel("PIN").fill("2468");
  await fac.getByRole("button", { name: "Unlock admin" }).click();
  await fac.getByRole("button", { name: "3. Go live" }).click();
  await expect(fac.getByText("Live", { exact: true }).first()).toBeVisible();

  // 5. Bob sees Ann presenting and checks "I have a lead for Ann" with a note.
  await bob.goto(`/e/${SLUG}/live`);
  await expect(bob.getByRole("heading", { name: "Ann Able" })).toBeVisible();
  await bob.getByText("I have a lead for Ann").click();
  await bob.getByPlaceholder("Who or what is the lead?").fill("My old boss runs a family office");
  await expect(bob.getByText("Saved ✓").first()).toBeVisible();

  // 6. Ann sees the offer arrive and rates it 5.
  await page.goto(`/e/${SLUG}/live`);
  await expect(page.getByText("Check your leads")).toBeVisible();
  await expect(page.getByText("“My old boss runs a family office”")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "5 Strong" }).click();
  await expect.poll(async () => (await sql`select strength from leads`)[0]?.strength).toBe(5);

  // 7. Bob cannot rate Ann's leads, and Ann cannot offer a lead on her own need.
  const [needAnn] = await sql`select n.id from needs n join participants p on p.id = n.participant_id where p.email = 'ann@example.com'`;
  const [bobRow] = await sql`select id from participants where email = 'bob@example.com'`;
  const bobRate = await bob.request.post(`/api/e/${SLUG}/leads`, { data: { needId: needAnn.id, giverId: bobRow.id, strength: 1 } });
  expect(bobRate.status()).toBe(403);
  const annSelf = await page.request.post(`/api/e/${SLUG}/offers`, { data: { needId: needAnn.id, checked: true } });
  expect(annSelf.status()).toBe(403);
  // Bob can no longer withdraw a rated offer.
  const withdraw = await bob.request.post(`/api/e/${SLUG}/offers`, { data: { needId: needAnn.id, checked: false } });
  expect(withdraw.status()).toBe(409);

  // 8. Notes autosave and survive a reload; private by default.
  await page.getByLabel("My notes on this need").fill("Follow up with Bob on Monday");
  await expect(page.getByText("Saved ✓").last()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("My notes on this need")).toHaveValue("Follow up with Bob on Monday");
  expect((await sql`select visibility from notes`)[0].visibility).toBe("private");

  // 9. The Index groups needs by category.
  await bob.getByRole("link", { name: "Index" }).click();
  await expect(bob.getByRole("heading", { name: /Fundraising/ })).toBeVisible();
  await expect(bob.getByText("Find healthcare family-office investors")).toBeVisible();

  // 10. The facilitator generates the PowerPoint.
  await fac.goto(`/e/${SLUG}/admin`);
  const [download] = await Promise.all([fac.waitForEvent("download"), fac.getByRole("link", { name: "Generate PowerPoint" }).click()]);
  expect(download.suggestedFilename()).toBe("YPL-Week2-Lead-Session-2027-01-20.pptx");
  const file = await download.path();
  expect(fs.readFileSync(file).subarray(0, 2).toString()).toBe("PK");
  const slide1 = execFileSync("unzip", ["-p", file, "ppt/slides/slide1.xml"]).toString();
  expect(slide1).toContain("Ann Able");
  expect(slide1).toContain("Bob Baker");
  expect(slide1).toContain("5/5");

  // 11. Close the session; summaries send automatically after the delay, exactly once.
  fac.once("dialog", (d) => d.accept());
  await fac.getByRole("button", { name: "4. Close session" }).click();
  await expect(fac.getByText(/Summaries will email automatically at/)).toBeVisible();
  const [ev] = await sql`select send_due_at from events where slug = ${SLUG}`;
  const later = new Date(new Date(ev.send_due_at).getTime() + 60_000).toISOString();
  for (let i = 0; i < 2; i++) {
    const r = await request.get(`/api/cron/send-summaries?now=${encodeURIComponent(later)}`, { headers: { Authorization: "Bearer e2e-cron" } });
    expect(r.ok()).toBeTruthy();
  }
  const log = await sql<{ kind: string; to_email: string }[]>`select kind, to_email from email_log order by kind, to_email`;
  expect(log.map((r) => `${r.kind}:${r.to_email}`)).toEqual([
    "digest:ann@example.com",
    "digest:bob@example.com",
    "personal:ann@example.com",
    "personal:bob@example.com",
  ]);
  const annMail = (await sql`select text_body from email_log where kind = 'personal' and to_email = 'ann@example.com'`)[0].text_body as string;
  expect(annMail).toContain("Bob Baker (★★★★★)");
  expect(annMail).toContain("My old boss runs a family office");
  expect(annMail).toContain("Follow up with Bob on Monday"); // her own private note, only to her
  const bobMail = (await sql`select text_body from email_log where kind = 'personal' and to_email = 'bob@example.com'`)[0].text_body as string;
  expect(bobMail).not.toContain("Follow up with Bob on Monday");
  expect(bobMail).toContain("LEADS YOU OFFERED");

  await fac.reload();
  await expect(fac.getByText("4 of 4 emails sent")).toBeVisible();
});

test("unauthorized cron calls are rejected", async ({ request }) => {
  expect((await request.get(`/api/cron/send-summaries`)).status()).toBe(401);
});
