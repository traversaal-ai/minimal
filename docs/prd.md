# Minimal — PRD

_Built with Sprint Zero. Reference: Notion. Level: MVP._

## 1. Problem statement

Small teams want a shared place to write things down — onboarding notes, team norms, a running doc — that lives in one navigable tree instead of scattered files or chat threads. Notion does this well but arrives with accounts, pricing tiers, databases, and a large surface area a small self-hosted team doesn't need just to get pages up and shared.

Minimal is the smallest version of that: one shared workspace per team, pages that nest under other pages, three block types (text, heading, checklist), and teammates invited by email who can all view and edit the same pages. It runs locally with no external account, so a team can self-host it on any machine and point everyone at one URL.

## 2. Goals

1. Let a new user sign up and land in a workspace with no configuration.
2. Let a user create a page, nest it under another page, and write blocks into it in under a minute.
3. Let a workspace member invite a teammate by email, and have that teammate see the same page tree once they sign up or log in.
4. Let any workspace member edit any page's blocks, with the change visible to teammates on their next load.
5. Ship with a seeded demo workspace and page tree so the product is immediately clickable on first launch.

## 3. Non-goals

Per `docs/scope.md`, this build will not include: real-time multiplayer editing, databases/table/board views, a rich formatting toolbar beyond text/heading/checklist, comments, per-page permissions or roles, file/image uploads, templates, full-text search, page version history, public share links, integrations/API, native mobile apps, or multiple workspaces per user.

## 4. Users & use cases

**Amara, setting up the team wiki.** Amara signs up, gets a fresh workspace, creates an "Onboarding" page, and nests "Week 1 checklist" and "Tools we use" underneath it. She adds a few paragraphs and a checklist to each. She invites two teammates by email.

**Ravi, a teammate.** Ravi gets the invite, signs up with that same email, and immediately sees "Onboarding" and its two sub-pages in his sidebar — the same tree Amara built. He opens "Week 1 checklist" and ticks off two items he's already done. Amara sees those checked the next time she opens the page.

**Priya, editing someone else's page.** Priya opens "Tools we use," which Amara wrote, adds a paragraph about a tool the team just adopted, and saves. The next person to open that page sees her addition — there's no ownership lock on who can edit what inside the shared workspace.

## 5. User stories

### Must-have

**Authentication**
1. As a new user, I want to sign up with email and password so that I can access the product.
2. As a returning user, I want to log in so that I see my workspace and its pages.
3. As a signed-in user, I want my session to persist across reloads.
4. As a signed-in user, I want to log out so that my session ends.

**Workspace**
5. As a new user with no invite, I want a workspace created for me automatically on signup.
6. As a workspace member, I want to invite a teammate by email so that they land in my workspace, not a new one, when they sign up.
7. As an invited teammate, I want to see the workspace's existing page tree the first time I log in.

**Pages and blocks**
8. As a workspace member, I want to create a page with a title so that I have somewhere to write.
9. As a workspace member, I want to nest a page under another page so that I can build a tree.
10. As a workspace member, I want to see the full page tree in a sidebar so that I can navigate it.
11. As a workspace member, I want to add a text block, a heading block, or a checklist item to a page.
12. As a workspace member, I want to toggle a checklist item done or not done.
13. As a workspace member, I want to edit a page another member created, with my change visible to them on their next load.

**Demo readiness**
14. As a person evaluating the product, I want a fresh install to come with a seeded demo workspace, two demo users, and a small real page tree so I have something to click through immediately.

### Should-have
15. As a workspace member, I want to rename a page.
16. As a workspace member, I want to delete a page (and its blocks) I no longer need.
17. As a workspace member, I want to see who else is in my workspace.

### Nice-to-have
18. As a workspace member, I want to reorder blocks within a page.
19. As a workspace member, I want to collapse/expand a page's children in the sidebar.
20. As a workspace member, I want a page's content to autosave as I type instead of needing an explicit save.

## 6. Acceptance criteria

MVP: real accounts, real data that survives a restart, full sign-up → session → reload → logout dance on the core loop.

**Story 1/2 — Sign up / log in:** duplicate email is rejected with a clear error; wrong password is rejected; successful signup/login returns a session and the user's workspace.

**Story 3/4 — Session / logout:** reload keeps the session; logout ends it and protected routes redirect to login afterward.

**Story 5/6/7 — Workspace + invite:** a brand-new user (no invite pending for their email) gets a new workspace on signup. Inviting an email that has no account yet records the invite; when that email later signs up, it joins the inviting workspace instead of creating a new one, and the existing page tree is visible immediately. Inviting an email that already has an account attaches that existing user to the workspace right away.

**Story 8/9/10 — Pages and tree:** creating a page with no parent puts it at the tree's root; creating one with a parent nests it visibly under that parent in the sidebar; the full tree for the workspace is fetchable in one call.

**Story 11/12 — Blocks:** a page can hold any number of blocks of type text, heading, or checklist, in order; a checklist block's checked state can be toggled and persists.

**Story 13 — Shared editing:** a block added or edited by one workspace member appears for a different member of the same workspace on their next load of that page, with no ownership restriction inside the workspace.

**Story 14 — Seed:** the seed script creates one demo workspace ("Traversaal Team Wiki"), two demo users already members of it (credentials printed to stdout), an "Onboarding" page with two nested sub-pages, and a "Team norms" page with a checklist that has both checked and unchecked items.

## 7. Risks & assumptions

**Risks**
- No real-time sync means two people editing the same page around the same time can overwrite each other (last write wins on save). Acceptable at MVP; flagged as a known limitation, not hidden.
- No permissions system means any workspace member can edit or delete any page, including one they didn't create. This is a deliberate simplification for MVP, not an oversight — see `docs/decisions.md`.

**Assumptions**
- `[ASSUMPTION]` One workspace per user at MVP: a user is a member of exactly one workspace, chosen at signup time (new workspace, or the one they were invited into).
- `[ASSUMPTION]` An invite is just an email address added to a workspace's membership list ahead of that person's signup — no invite token or expiry, since email sending is out of scope.
- `[ASSUMPTION]` Deleting a page also deletes its blocks and re-parents (or also deletes) its children; the API contract decides which.

## 8. Open questions

- When a page with children is deleted, do the children move to the root, or get deleted too? Left to the API contract.
- Is there any limit to nesting depth? Assumed unlimited at MVP.

## 9. Success metrics

- A fresh clone reaches a nested, editable page tree (signup → create page → nest a page → add blocks) in one uninterrupted run with no configuration.
- A second seeded user can log in and see the first user's full page tree immediately.
- The full core loop (signup, create/nest pages, add/toggle blocks, invite, teammate sees shared tree and edits a page) passes end to end in a real browser.
