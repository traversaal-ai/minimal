// integration.test.js — API-level integration tests for Nestpad, against a
// running server at http://localhost:3001. Uses native fetch, no framework.
// Run with: node server/tests/integration.test.js

const BASE = "http://localhost:3001";

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

async function api(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = null;
    }
  }
  return { status: res.status, data };
}

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

async function main() {
  // --- Signup ---
  const userAEmail = uniqueEmail("qa-a");
  const userAPassword = "password123";
  const signupA = await api("/auth/signup", {
    method: "POST",
    body: { email: userAEmail, password: userAPassword },
  });
  ok(signupA.status === 201, "signup: 201 for new user");
  ok(
    signupA.data && signupA.data.access_token && signupA.data.user && signupA.data.workspace,
    "signup: response has access_token, user, workspace"
  );
  const tokenA = signupA.data && signupA.data.access_token;
  const workspaceAId = signupA.data && signupA.data.workspace && signupA.data.workspace.id;

  // duplicate signup
  const dupSignup = await api("/auth/signup", {
    method: "POST",
    body: { email: userAEmail, password: userAPassword },
  });
  ok(dupSignup.status === 409 && dupSignup.data.error === "email_taken", "signup: duplicate email rejected 409");

  // --- Login ---
  const loginA = await api("/auth/login", {
    method: "POST",
    body: { email: userAEmail, password: userAPassword },
  });
  ok(loginA.status === 200 && loginA.data.access_token, "login: 200 with access_token for correct creds");

  const badLogin = await api("/auth/login", {
    method: "POST",
    body: { email: userAEmail, password: "wrongpassword" },
  });
  ok(badLogin.status === 401 && badLogin.data.error === "invalid_credentials", "login: wrong password rejected 401");

  // --- /auth/me ---
  const me = await api("/auth/me", { token: tokenA });
  ok(me.status === 200 && me.data.user.email === userAEmail, "auth/me: returns current user with valid token");

  // --- Negative: protected endpoint without / with invalid token ---
  const noToken = await api("/pages");
  ok(noToken.status === 401, "negative: GET /pages without token -> 401");

  const badToken = await api("/pages", { token: "not-a-real-token" });
  ok(badToken.status === 401, "negative: GET /pages with invalid token -> 401");

  // --- Create / nest pages ---
  const rootPage = await api("/pages", {
    method: "POST",
    body: { title: "QA Root Page", parent_page_id: null },
    token: tokenA,
  });
  ok(rootPage.status === 201 && rootPage.data.title === "QA Root Page", "pages: create root page");

  const childPage = await api("/pages", {
    method: "POST",
    body: { title: "QA Child Page", parent_page_id: rootPage.data.id },
    token: tokenA,
  });
  ok(
    childPage.status === 201 && childPage.data.parent_page_id === rootPage.data.id,
    "pages: create nested child page"
  );

  const listPages = await api("/pages", { token: tokenA });
  const ids = (listPages.data.pages || []).map((p) => p.id);
  ok(
    listPages.status === 200 && ids.includes(rootPage.data.id) && ids.includes(childPage.data.id),
    "pages: GET /pages includes both root and child"
  );

  // --- Add blocks ---
  const textBlock = await api(`/pages/${rootPage.data.id}/blocks`, {
    method: "POST",
    body: { type: "text", content: "Some paragraph text.", position: 0 },
    token: tokenA,
  });
  ok(textBlock.status === 201 && textBlock.data.type === "text", "blocks: create text block");

  const headingBlock = await api(`/pages/${rootPage.data.id}/blocks`, {
    method: "POST",
    body: { type: "heading", content: "A Heading", position: 1 },
    token: tokenA,
  });
  ok(headingBlock.status === 201 && headingBlock.data.type === "heading", "blocks: create heading block");

  const checklistBlock = await api(`/pages/${rootPage.data.id}/blocks`, {
    method: "POST",
    body: { type: "checklist", content: "Do the thing", position: 2 },
    token: tokenA,
  });
  ok(
    checklistBlock.status === 201 && checklistBlock.data.checked === false,
    "blocks: create checklist block, defaults unchecked"
  );

  // --- Toggle checklist item ---
  const toggled = await api(`/blocks/${checklistBlock.data.id}`, {
    method: "PUT",
    body: { checked: true },
    token: tokenA,
  });
  ok(toggled.status === 200 && toggled.data.checked === true, "blocks: toggle checklist item checked");

  const getPageWithBlocks = await api(`/pages/${rootPage.data.id}`, { token: tokenA });
  ok(
    getPageWithBlocks.status === 200 && getPageWithBlocks.data.blocks.length === 3,
    "pages: GET /pages/:id returns page with its 3 blocks"
  );

  // --- Invite flow: new email (pending invite consumed on signup) ---
  const inviteeEmail = uniqueEmail("qa-invitee");
  const invite1 = await api("/workspace/invite", {
    method: "POST",
    body: { email: inviteeEmail },
    token: tokenA,
  });
  ok(
    invite1.status === 201 && invite1.data.invited === true && invite1.data.already_member === false,
    "invite: inviting a brand-new email creates pending invite (201)"
  );

  // idempotent re-invite
  const invite1Again = await api("/workspace/invite", {
    method: "POST",
    body: { email: inviteeEmail },
    token: tokenA,
  });
  ok(
    invite1Again.status === 200 && invite1Again.data.already_member === false,
    "invite: re-inviting same pending email is idempotent (200)"
  );

  const inviteeSignup = await api("/auth/signup", {
    method: "POST",
    body: { email: inviteeEmail, password: "password123" },
  });
  ok(
    inviteeSignup.status === 201 && inviteeSignup.data.workspace.id === workspaceAId,
    "invite: invited email joins the inviting workspace on signup (not a new one)"
  );

  const inviteePages = await api("/pages", { token: inviteeSignup.data.access_token });
  const inviteePageIds = (inviteePages.data.pages || []).map((p) => p.id);
  ok(
    inviteePageIds.includes(rootPage.data.id),
    "invite: invited user immediately sees the workspace's existing page tree"
  );

  // --- Invite flow: existing user (immediate membership) ---
  const userCEmail = uniqueEmail("qa-c");
  const userCSignup = await api("/auth/signup", {
    method: "POST",
    body: { email: userCEmail, password: "password123" },
  });
  const userCWorkspaceId = userCSignup.data.workspace.id;
  ok(
    userCSignup.status === 201 && userCWorkspaceId !== workspaceAId,
    "invite: pre-existing signup unrelated to invite gets its own workspace"
  );

  const inviteExisting = await api("/workspace/invite", {
    method: "POST",
    body: { email: userCEmail },
    token: tokenA,
  });
  ok(
    inviteExisting.status === 200 &&
      inviteExisting.data.invited === true &&
      inviteExisting.data.already_member === true,
    "invite: inviting an existing user's email attaches them immediately (200, already_member true)"
  );

  const membersOfA = await api("/workspace/members", { token: tokenA });
  const memberEmails = (membersOfA.data.members || []).map((m) => m.email);
  ok(
    memberEmails.includes(userCEmail),
    "invite: existing-user invite reflected in GET /workspace/members"
  );

  // --- Summary ---
  console.log("");
  console.log(`Total: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
  if (failures.length) {
    console.log("Failed tests:");
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test run crashed:", err);
  process.exit(1);
});
