// e2e.mjs — real headless-Chromium Playwright walk of the Nestpad UI at
// http://localhost:5173. Run with: node server/tests/e2e.mjs
// Requires: npm install --no-save playwright && npx playwright install chromium

import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const TOKEN_KEY = "nestpad_access_token";

let passed = 0;
let failed = 0;
const failures = [];

function ok(cond, label) {
  if (cond) {
    passed++;
    console.log(`PASS: ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`FAIL: ${label}`);
  }
}

function ts() {
  return Date.now().toString();
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", (err) => {
    console.log(`  [page error] ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log(`  [console error] ${msg.text()}`);
  });
  page.on("response", (res) => {
    if (res.url().includes("/blocks") && res.request().method() === "POST") {
      console.log(`  [network] POST ${res.url()} -> ${res.status()}`);
    }
  });

  try {
    // --- Landing page ---
    await page.goto(BASE, { waitUntil: "networkidle" });
    const heroVisible = await page.locator("[data-testid=hero-cta-signup]").isVisible().catch(() => false);
    ok(heroVisible, "landing page renders (hero-cta-signup visible)");

    // --- nav-login -> /login -> go-to-signup -> /signup ---
    await page.click("[data-testid=nav-login]");
    await page.waitForURL(/\/login$/);
    ok(page.url().endsWith("/login"), "clicking nav-login navigates to /login");

    await page.click("[data-testid=go-to-signup]");
    await page.waitForURL(/\/signup$/);
    ok(page.url().endsWith("/signup"), "clicking go-to-signup navigates to /signup");

    // --- Signup with fresh timestamped user ---
    const userAEmail = `qa-e2e-a-${ts()}@example.com`;
    const userAPassword = "password123";

    await page.fill("[data-testid=email-input]", userAEmail);
    await page.fill("[data-testid=password-input]", userAPassword);
    await page.click("[data-testid=signup-button]");
    await page.waitForURL(/\/app/, { timeout: 10000 });
    ok(page.url().includes("/app"), "signup lands in /app");
    const logoutVisibleAfterSignup = await page
      .locator("[data-testid=logout-button]")
      .isVisible()
      .catch(() => false);
    ok(logoutVisibleAfterSignup, "logout-button visible after signup");

    // --- Logout ---
    await page.click("[data-testid=logout-button]");
    await page.waitForURL(/\/login/, { timeout: 10000 });
    ok(page.url().includes("/login"), "logout redirects to /login");

    // --- Log back in ---
    await page.fill("[data-testid=email-input]", userAEmail);
    await page.fill("[data-testid=password-input]", userAPassword);
    await page.click("[data-testid=login-button]");
    await page.waitForURL(/\/app/, { timeout: 10000 });
    ok(page.url().includes("/app"), "login with same creds lands back in /app");

    // --- Expired-token check ---
    await page.evaluate((key) => localStorage.setItem(key, "expired"), TOKEN_KEY);
    await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
    let redirectedOrError = false;
    try {
      await page.waitForURL(/\/login/, { timeout: 5000 });
      redirectedOrError = true;
    } catch (e) {
      // Not redirected — check for a visible auth-error message instead of a crash.
      const bodyText = await page.locator("body").innerText().catch(() => "");
      redirectedOrError = /invalid|unauthorized|expired|log in|login/i.test(bodyText);
    }
    ok(redirectedOrError, "expired token: reload + protected nav redirects to /login or shows auth error, no crash");

    // --- Log back in again for the core loop ---
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill("[data-testid=email-input]", userAEmail);
    await page.fill("[data-testid=password-input]", userAPassword);
    await page.click("[data-testid=login-button]");
    await page.waitForURL(/\/app/, { timeout: 10000 });
    ok(page.url().includes("/app"), "re-login after expired-token check lands in /app");

    // --- Core loop: create page ---
    const pageTitle = "QA Test Page";
    await page.click("[data-testid=new-page-button]");
    await page.fill("[data-testid=page-title-input]", pageTitle);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);

    const treeHasNewPage = await page
      .locator("[data-testid=page-tree]")
      .filter({ hasText: pageTitle })
      .count();
    ok(treeHasNewPage > 0, "created page appears in page-tree");

    // Open the created page (click its link in the tree)
    await page.locator("[data-testid=page-tree]").getByText(pageTitle, { exact: true }).click();
    await page.waitForTimeout(500);
    ok(page.url().includes("/app/pages/"), "opening created page navigates to /app/pages/:id");

    // --- Nest a sub-page ---
    // Note: while the "New sub-page" modal is open, PageDetail's own page-title-input
    // (for renaming the current page) is ALSO in the DOM, so two elements share this
    // testid. The modal's input is rendered last in the DOM, so target it with .last().
    const subPageTitle = "QA Sub Page";
    await page.click("[data-testid=new-subpage-button]");
    await page.locator("[data-testid=page-title-input]").last().fill(subPageTitle);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);

    const treeText = await page.locator("[data-testid=page-tree]").innerText();
    const parentIdx = treeText.indexOf(pageTitle);
    const childIdx = treeText.indexOf(subPageTitle);
    ok(
      parentIdx !== -1 && childIdx !== -1 && childIdx > parentIdx,
      "nested sub-page appears in page-tree (after parent, i.e. nested under it)"
    );

    // --- Add a text block ---
    await page.click("[data-testid=add-block-button]");
    await page.waitForTimeout(300);
    // The add-block control may present a type chooser; try to select "Text" if present.
    const textOption = page.getByText("Text", { exact: true });
    if (await textOption.isVisible().catch(() => false)) {
      await textOption.click();
    }
    const textInputs = page.locator("[data-testid=block-text-input]");
    const lastTextInputIdx = (await textInputs.count()) - 1;
    await textInputs.nth(Math.max(lastTextInputIdx, 0)).fill("This is a QA text block.");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Block content renders as an <input value="...">, not text nodes, so check
    // input values rather than innerText.
    const allInputValues = await page.locator("input").evaluateAll((els) => els.map((el) => el.value));
    ok(
      allInputValues.includes("This is a QA text block."),
      "text block renders after adding"
    );

    // --- Add a checklist block ---
    await page.click("[data-testid=add-block-button]");
    await page.waitForTimeout(300);
    const checklistOption = page.getByText("Checklist", { exact: true });
    if (await checklistOption.isVisible().catch(() => false)) {
      await checklistOption.click();
    }
    const textInputs2 = page.locator("[data-testid=block-text-input]");
    const lastIdx2 = (await textInputs2.count()) - 1;
    await textInputs2.nth(Math.max(lastIdx2, 0)).fill("QA checklist item");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    const checkboxes = page.locator("[data-testid=checklist-item-checkbox]");
    const checkboxCount = await checkboxes.count();
    ok(checkboxCount > 0, "checklist block renders with a checkbox after adding");

    // --- Toggle the checklist item ---
    if (checkboxCount > 0) {
      const box = checkboxes.last();
      const beforeChecked = await box.isChecked().catch(() => null);
      await box.click();
      await page.waitForTimeout(500);
      const afterChecked = await box.isChecked().catch(() => null);
      ok(
        beforeChecked !== null && afterChecked !== null && beforeChecked !== afterChecked,
        "checklist checkbox toggles on click"
      );
    } else {
      ok(false, "checklist checkbox toggles on click (no checkbox found)");
    }

    // --- Shared editing / invite check ---
    // Open invite panel, invite one of the seeded demo emails.
    const seededEmail = "amara@traversaal.ai"; // from server/seed.js stdout
    let invitePanelOpened = false;
    const invitePanelTrigger = page.getByText("Invite teammate", { exact: true }).first();
    if (await invitePanelTrigger.isVisible().catch(() => false)) {
      await invitePanelTrigger.click();
      await page.waitForTimeout(300);
      invitePanelOpened = await page
        .locator("[data-testid=invite-panel]")
        .isVisible()
        .catch(() => false);
    }
    if (!invitePanelOpened) {
      // Try any element referencing invite-panel testid directly (may already be visible).
      invitePanelOpened = await page
        .locator("[data-testid=invite-panel]")
        .isVisible()
        .catch(() => false);
    }
    ok(invitePanelOpened, "invite-panel opens");

    if (invitePanelOpened) {
      await page.fill("[data-testid=invite-email-input]", seededEmail);
      await page.click("[data-testid=invite-button]");
      await page.waitForTimeout(500);
      const confirmVisible = await page
        .locator("[data-testid=invite-confirmation]")
        .isVisible()
        .catch(() => false);
      ok(confirmVisible, "invite-confirmation appears after inviting seeded demo email");
    } else {
      ok(false, "invite-confirmation appears after inviting seeded demo email (panel never opened)");
    }

    // Close the invite panel (its backdrop intercepts clicks otherwise) before
    // moving on — the panel's only close control is an unlabeled "✕" button.
    const closeInviteBtn = page.getByText("✕", { exact: true }).first();
    if (await closeInviteBtn.isVisible().catch(() => false)) {
      await closeInviteBtn.click();
      await page.waitForTimeout(300);
    }

    // Log out user A, log in as the seeded demo user, confirm no error and their
    // existing seeded page tree still loads. NOTE: this does not fully exercise
    // "teammate edits a page and A sees it" (see report) — it confirms workspace
    // attachment didn't break the seeded user's session or existing tree.
    const logoutBtn = page.locator("[data-testid=logout-button]");
    if (await logoutBtn.isVisible().catch(() => false)) {
      await logoutBtn.click();
      await page.waitForURL(/\/login/, { timeout: 10000 });
    } else {
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    }

    await page.fill("[data-testid=email-input]", seededEmail);
    await page.fill("[data-testid=password-input]", "password123");
    await page.click("[data-testid=login-button]");
    await page.waitForURL(/\/app/, { timeout: 10000 });
    ok(page.url().includes("/app"), "seeded demo user logs in successfully after being invited");

    await page.waitForTimeout(500);
    const seededTreeText = await page.locator("[data-testid=page-tree]").innerText().catch(() => "");
    const seededTreeOk = /Onboarding/.test(seededTreeText) && /Team norms/.test(seededTreeText);
    ok(seededTreeOk, "seeded user's existing page tree (Onboarding, Team norms) still loads correctly");

    console.log("");
    console.log(`Total: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
    if (failures.length) {
      console.log("Failed steps:");
      failures.forEach((f) => console.log(`  - ${f}`));
    }
  } catch (err) {
    console.error("e2e run crashed:", err);
    failed++;
    failures.push(`crash: ${err.message}`);
  } finally {
    await browser.close();
  }

  process.exit(failed === 0 ? 0 : 1);
}

main();
