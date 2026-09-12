# Decisions

_Sprint Zero build (Minimal) compared to Notion. Level: MVP._

## Why this document exists

We built Minimal, a shared team wiki with one loop: sign up, land in a workspace, create and nest pages, write text/heading/checklist blocks, invite a teammate, and edit each other's pages. We compared it to Notion, whose relevant surface is in `docs/reference-brief.md`. Notion is a vast product — databases, real-time multiplayer, dozens of block types, granular sharing. At MVP we keep real accounts and real shared data on the core loop and cut everything else.

## Scope decisions

### One workspace per user, not per-user multi-workspace switching
- **Reference does:** Notion lets one account belong to many workspaces, with a switcher.
- **We chose to:** One workspace per user at MVP.
- **Reason:** Listed in scope excludes. The core loop is "a team shares one workspace"; multi-workspace switching is a convenience for people juggling several teams, not part of proving the loop.

### Three block types instead of Notion's full library
- **Reference does:** Dozens of block types — text, headings, images, embeds, code, columns, synced blocks, and full database views.
- **We chose to:** Paragraph text, heading, and checklist only.
- **Reason:** Listed in scope excludes. These three prove "a page holds structured content," which is the point of the loop; the rest is surface area that doesn't change whether nesting and sharing work.

### No databases / table / board / calendar views
- **Reference does:** A page can be a database with multiple views (table, board, calendar, gallery, list), properties, filters, and sorts.
- **We chose to:** Every page is a plain page of blocks. No database concept exists.
- **Reason:** Listed in scope excludes. Databases are effectively a second product inside Notion; the core loop only needs page nesting and block content.

### Last-write-wins instead of real-time multiplayer
- **Reference does:** Live cursors and character-by-character collaborative editing via CRDT/OT.
- **We chose to:** A page's blocks are loaded on open and saved on submit. If two people edit around the same time, the later save wins.
- **Reason:** Listed in scope excludes. Real-time sync is a significant infrastructure investment (websockets, conflict resolution) that isn't necessary to prove "a teammate can edit a shared page" — it just needs to work when done sequentially, which is the realistic case for a small team's async wiki use.

### No per-page permissions — every workspace member can edit every page
- **Reference does:** Fine-grained sharing per page (view/comment/edit, specific people or groups) layered on top of workspace membership.
- **We chose to:** Any member of a workspace can view and edit any page in it. No page-level ownership lock.
- **Reason:** Listed in scope excludes. This is the PRD's explicit "risk, not oversight" — it directly enables Story 13 (shared editing) without building a permissions model, which is real complexity Notion needs because it supports much larger organizations.

### Invite by email with no token, no email sending
- **Reference does:** Invite links or emailed invitations with expiring tokens, accepted via a URL.
- **We chose to:** A workspace member submits a teammate's email; this creates a pending membership row keyed by that email. When someone signs up with that email, they're attached to that workspace instead of getting a new one. If the email already has an account, it's attached to the workspace immediately (no separate accept step).
- **Reason:** Real email sending is out of scope, so there's no channel to deliver an invite link through. This still delivers the actual promise in the PRD ("teammate sees the same page tree on signup/login") in one step, communicated to the invited person out-of-band (Slack, in person) rather than by email.

### No comments, mentions, or notifications
- **Reference does:** Inline comments, @-mentions of people and pages, and a notification inbox.
- **We chose to:** None of these.
- **Reason:** Listed in scope excludes. They're collaboration features layered on top of a working page tree, not part of proving the tree itself works.

### No templates, no template gallery
- **Reference does:** A large built-in and community template gallery for starting new pages.
- **We chose to:** New pages start blank with just a title.
- **Reason:** Listed in scope excludes. Templates are pre-filled block content; once blocks work, templates are just data, not new capability.

### No full-text search
- **Reference does:** Instant search across all workspace content.
- **We chose to:** Navigation is via the sidebar tree only.
- **Reason:** Listed in scope excludes. With a small seeded tree, the sidebar is sufficient to reach any page; search is an optimization for large workspaces.

### No file/image uploads
- **Reference does:** Drag-and-drop images, files, and embeds into any page.
- **We chose to:** Text-only blocks.
- **Reason:** Listed in scope excludes. Uploads need storage and serving infrastructure that doesn't change whether nesting and shared editing work.

### No public share links or publishing
- **Reference does:** Publish any page to the public web with its own URL.
- **We chose to:** Every page requires a logged-in workspace member to view.
- **Reason:** Listed in scope excludes. This build is an internal team tool, not a publishing platform; ghost-lite (Sprint Zero's other worked example) already covers the "public reader" pattern.

## Amendment — a real, minimal table block (post-launch)

The original build deliberately excluded databases and table views (see "No databases / table / board / calendar views" above) as scope creep beyond the core nested-page loop. After using the shipped MVP, the PM asked for genuinely editable tables inside a page — not just a static-looking grid — so example content (and real use) would feel like an actual lightweight Notion rather than only text and checklists.

- **What changed:** Added a fifth and sixth block type: `bulleted_list` (a plain bullet item, same shape as `text`/`checklist`) and `table` — a real, editable grid of columns and rows, each cell a plain string. Also added minimal inline-link rendering (`[label](url)`) inside text-like blocks, mainly so example content can link between pages.
- **What is still excluded, deliberately:** No column types (every cell is a string), no filters, sorts, or alternate views (board/calendar/gallery) — this is a lightweight table for lists like tasks or a roadmap, not a database engine. That larger feature is still out of scope; this amendment is narrower than reversing the original decision entirely.
- **Data model:** `table_columns` (id, block_id, name, position), `table_rows` (id, block_id, position), `table_cells` (id, row_id, column_id, value) — a block of type `table` owns a set of columns and rows; a cell is the (row, column) intersection. `docs/api-contract.md` has the full route list (`/tables/:blockId/columns`, `/tables/columns/:id`, `/tables/:blockId/rows`, `/tables/rows/:id`, `/tables/cells`).
- **New workspace defaults:** Every brand-new workspace (on signup, when no invite is pending) is now seeded with example content across three pages (Welcome, Projects, Team) using every block type, including a populated table and internal links between pages — not just one page and a nested stub. This mirrors Notion's own "Getting Started" default and answers the PM's ask that a first-time signup "feel like Notion" immediately, not land on a blank page.

## Amendment — color and a real home dashboard (post-launch)

Purely presentational, no schema or contract change. The PM asked for the app to "feel more alive" and less monochrome.

- Each top-level page gets a stable, deterministic accent color (client-side hash of its id, no backend change) shown as a small colored dot in the sidebar and on its dashboard card.
- A table cell whose value is literally "Done" / "In progress" / "Not started" / "Blocked" (case-insensitive) renders as a colored pill instead of plain text, in both the editable table and the read-only guest view.
- `/app` (previously "Pick a page from the sidebar") is now a real dashboard: a greeting, the workspace name, and a card per top-level page showing its color and sub-page count.
- Example content was widened from three root pages (Welcome/Onboarding, Projects, Team) to six (adding Customers, Learning, Q1 Focus) so a fresh signup and the seeded demo both show more of the range of what the product can hold — not just to look busier, but to give the status-pill coloring and dashboard cards enough variety to actually demonstrate them.

## Amendment — grouped, collapsible home sections (post-launch)

The PM shared a real Notion home page as a reference for the *shape* they wanted — several named sections, each a heading followed by a list of page links, collapsible — and asked for the same structure here, generalized rather than copied.

- **What changed:** Root pages (only root pages — nesting already handles sub-pages) gained an optional `section` text field (`docs/api-contract.md`). The home dashboard (`/app`) groups root pages by `section` into named, collapsible groups instead of one flat grid; pages with no section render ungrouped at the top.
- **How a new section gets created:** There is no separate "manage sections" screen — a section exists exactly as long as at least one page names it. Typing a new name into any root page's section field creates it; renaming every page out of a section makes it disappear. This mirrors how `bulleted_list`/`table` were added — reuse the existing page-edit path rather than a new management surface.
- **Why sections live only on root pages:** A sub-page is already organized by its parent in the tree; letting it also carry an independent section would create two competing hierarchies for the same page. One level of grouping (section → root page → sub-pages) is enough.

## Amendment — a mock form-builder block (post-launch)

The PM shared a real form-builder screenshot (Google-Forms/Tally style: a cover image, an icon, editable fields, a "Form builder"/"Responses" tab pair, and Preview/Share buttons) and asked for an interactive page like it, explicitly calling it a "mock."

- **What it is:** A sixth block type, `form`. It has a cover (a choice of gradients, or a pasted image URL — there's no file upload/storage in this build, so an image means a URL), an emoji icon, a title, a description, a public/private banner, and an editable list of fields (label, type, required). `Preview` toggles a clean respondent-facing rendering; `Share form` copies a link to the clipboard with a real confirmation state.
- **What it deliberately is not:** There is no response-collection backend. The "Submit" button in Preview is disabled, the "Responses" tab always shows an honest empty state explaining it's a mock, and the "shared" link (`https://nestpad.local/f/<blockId>`) doesn't resolve to anything public. Building real public form hosting and response storage is a different, much larger feature (anonymous write access, a responses table, moderation) that wasn't asked for — the ask was for the interactive *builder* experience, not a production forms product.
- **Why it needed no schema change:** A form's entire structure is serialized as JSON and stored in the block's existing `content` column — the same field every other block type already has. The server never parses it; only the frontend (`client/src/lib/formTemplate.js`) knows its shape. This is the cheapest way to add a structurally different block without a `table`-style set of child tables, appropriate for something whose interactivity is all client-side anyway.
- **Example content:** A seeded "Hiring" page (Customers & Growth section) demonstrates it with a data-science-researcher-style application form — original wording, not copied from the reference screenshot, which showed a real internal company form.

## Amendment — open a table row as its own detail view (post-launch)

The PM shared a Notion screenshot of a task database where clicking "OPEN" on a row expands it into a page: a big title, every column as a labeled property below it, and a comment thread. They asked for the same on our tables, with sample data.

- **What it is:** Hovering a row now reveals an "Open" button (first column only, since that's the row's de-facto title, matching the reference). It opens a modal showing that row's first column as a large editable title, every other column as a `label: editable value` row, and a comment box. Editing a property here calls the exact same `PUT /tables/cells` endpoint the inline grid uses — it's the same data, just a different view of it, not a parallel copy.
- **Comments are local-device-only, not a real feature.** They're stored in the browser's `localStorage` keyed by row id — not sent to the server, not shared between users or devices. Building a real shared comment thread needs a table, an endpoint, and write-auth, which is a meaningfully bigger feature than "open a row and see its properties." The UI says so plainly ("Comments are stored on this device only.") rather than implying something it doesn't do — same honesty standard as the mock form block's Responses tab.
- **Guest (read-only) parity:** the guest demo view gets the same "Open" affordance and detail layout, minus editing and minus comments entirely (a guest has no identity to attribute a comment to).
- **Sample data:** a new "Task Tracker" page (Projects & Roadmap section) with Task #/Task/Description/Owner/Status/Due Date columns and four rows with real-looking descriptions, so the feature has something worth opening on first look — wording is original, not copied from the reference screenshot, which showed a real internal tracker.

## Amendment — a monospace code/diagram block, and doc-style example pages (post-launch)

The PM shared a reference doc page containing an ASCII architecture diagram and asked for something similar, explicitly asking for *different* (dummy AI-engineering) content rather than their real internal docs.

- **What changed:** A seventh block type, `code` — plain preformatted text, rendered monospace with whitespace preserved, so ASCII boxes and arrows line up. Technically identical to `text` (a string in `content`, no server-side meaning) but rendered differently, same pattern as every other block type addition here.
- **Example content:** A new root page, "AI Engineering Docs" (Documentation section), links to two sub-pages written from scratch on original AI-engineering topics (RAG architecture, vector databases/embeddings) — each with a table of contents (a plain bulleted list; there's no in-page anchor-linking, so it's descriptive rather than clickable), heading sections, and one `code` block per page holding an ASCII architecture diagram.

## Amendment — a batch of ten requested additions (post-launch)

The PM asked for everything on a suggested list at once. Each is scoped narrowly on purpose — this is still an MVP, not a rewrite — and several deliberately reuse a mechanism already in the app rather than inventing a new one.

- **Page icons.** A free-text `icon` field on any page (typically one emoji), shown in the sidebar and dashboard cards next to the page's color dot.
- **Drag-to-reorder blocks; drag pages between sections.** Both are pure client-side reordering that calls endpoints that already existed (`PUT /blocks/:id` with `position`, `PUT /pages/:id` with `section`) — no new backend surface.
- **Sidebar search.** Client-side filter over the already-fetched page list by title. No new endpoint — with a few hundred pages this is instant; it would need a real search endpoint far before that became false.
- **Page templates.** Reuses **`POST /pages/:id/duplicate`**, a generic "deep-copy this page's blocks into a new root page" endpoint. "Save as template" duplicates into a `"Templates"` section; "use a template" duplicates out of it with a new title. There is no separate templates table or resource — a template is just a page sitting in a section named `Templates`, which also means renaming that section un-templates everything in it. That's an accepted rough edge, not a bug.
- **Page activity ("version history").** A **log**, not snapshots: every rename, lock toggle, and block add/remove appends one row, and `GET /pages/:id/activity` returns the 5 most recent. There is deliberately no restore-to-previous-version — that needs full content snapshots per edit, which is a meaningfully larger feature (storage growth, a diff/restore UI, deciding what to do with the snapshots of a deleted block) than "let people see recent changes."
- **Page presence ("who's viewing this").** Poll-based, not a websocket: the client PUTs a heartbeat every ~10s while a page is open, and a GET lists whoever else's heartbeat is under 30s old. This is the cheapest way to get a real (not simulated) presence signal without adding a socket layer to an Express app that has none.
- **Real, server-side row comments.** This *replaces* the earlier localStorage-only comment box on a table row's detail view with actual `row_comments` rows, shared across the workspace like everything else. The "stored on this device only" caveat from that amendment no longer applies — comments are now exactly as real as any other data here.
- **Page locking (a narrower stand-in for real permissions).** The original MVP decision to give every workspace member edit access to every page (see "No per-page permissions" above) still holds by default. A page's **creator** can now lock it; while locked, every mutating call scoped to that page — from renaming it to editing a table cell inside it — is rejected for everyone else with a 403, while viewing stays open to the whole workspace. This is deliberately coarser than real permissions (view-only vs. edit-only vs. per-person ACLs): one owner, one on/off switch, enforced in one shared helper (`assertPageEditable`) rather than a permissions model.
- **Real form responses.** The mock form block (see its own amendment above) stays a mock everywhere except this: `Preview`'s Submit button and the `Responses` tab are now wired to a real `form_responses` table via `POST`/`GET /forms/:blockId/responses`. Nothing else about the form changed — still no public unauthenticated submission path, since Minimal has no route that serves a single form to a stranger outside the app.

## Amendment — an Obsidian-style knowledge layer: backlinks and a graph view (post-launch)

The PM asked whether an Obsidian-like knowledge layer (bidirectional links, a graph of the whole workspace) could sit on top of Minimal's Notion-style page model, as a real feasibility test rather than a design exercise.

- **What it is:** Every page now has a "Linked mentions" panel listing every other page that links to it, and a new **Graph** view (in the sidebar) rendering the whole workspace as nodes and edges, click a node to open that page.
- **Why it needed no new storage:** An internal link already exists as `[label](/app/pages/<id>)` inside a block's `content` string (the rich-text link syntax added earlier). A "link" is detected by checking whether page B's raw id appears anywhere in page A's block content — no links table, no parsing beyond a substring check. Backlinks and the graph are both computed live from existing data, not maintained as a separate index that could drift out of sync.
- **What's deliberately not here:** Obsidian's local-first Markdown files, its plugin ecosystem, and tags are all out of scope. This amendment is narrowly "can two pages know about each other, and can you see the whole map" — the two properties that make Obsidian's graph view useful, not a reimplementation of Obsidian itself.
- **Layout, not a physics engine:** The graph view places connected pages on one ring and isolated pages on a smaller inner ring, both by simple angle math, no force simulation and no new dependency. It doesn't look as organic as Obsidian's real graph, but it never jitters and needed nothing beyond inline SVG.
- **Verdict on the feasibility question:** yes, cleanly. The reason it dropped in easily is that Minimal's internal links were already just plain text pattern matching (`/app/pages/<id>` inside a string) rather than a structured field, so "does A mention B" is a query, not a schema change.

## Technical decisions

### Stack: React (Vite) frontend, Express backend, local SQLite with self-issued JWT
- **We chose:** The `web-app` project type on the `node-react` profile with the `local` data layer, as `docs/scope.md` specifies. React + Vite in `client/` on port 5173, Express in `server/` on port 3001, a single `better-sqlite3` database file at `server/data.db`, and login by email/password with a self-issued JWT.
- **Reason:** Zero-configuration self-hosting is the whole point — a team should be able to clone this, run two commands, and point everyone at one machine's IP, with no external account.

### Data model: workspaces, memberships, pages (self-referencing parent), blocks
- **We chose:** `workspaces` (id, name), `workspace_members` (workspace_id, user_id — join table), `workspace_invites` (workspace_id, email — pending invites keyed by email, consumed on matching signup), `pages` (id, workspace_id, parent_page_id nullable self-reference, title, created_by), `blocks` (id, page_id, type, content, checked nullable, position).
- **Reason:** The self-referencing `parent_page_id` on `pages` is the simplest way to model an arbitrarily deep tree. Splitting `workspace_invites` from `workspace_members` lets an invite exist before the invited person has an account, which is what Story 6/7 need without email delivery.

### Invite resolution happens at signup, not at invite time
- **We chose:** `POST /auth/signup` checks `workspace_invites` for a pending row matching the submitted email; if found, the new user is added to that workspace (and the invite row is deleted) instead of a new workspace being created for them.
- **Reason:** This is the only point where "does this email have a workspace waiting for it" needs to be resolved, and it keeps the invite table simple (no token, no accept endpoint).

### Blocks are a flat ordered list per page, not a nested tree
- **We chose:** `blocks.position` is an integer per page; blocks render in position order. No block nests inside another block.
- **Reason:** Notion's blocks can nest (a toggle containing more blocks); that's real complexity we're cutting per the "three block types" decision above. A flat ordered list is enough for paragraph/heading/checklist content.

### Seed: two demo users, one shared workspace, two page trees
- **We chose:** The seed script creates one workspace ("Traversaal Team Wiki"), two demo users already members of it (credentials printed to stdout), an "Onboarding" page with two nested children, and a "Team norms" page with a checklist mixing checked and unchecked items.
- **Reason:** The PRD's demo-readiness goal needs something to click through immediately that also demonstrates nesting and the checklist block type on first launch.

### Testing: Playwright via MCP
- **We chose:** Playwright driven by the QA sub-agent, against the resolved ports (5173 and 3001), covering the full auth dance plus the core loop: create a page, nest a page under it, add blocks, toggle a checklist item, invite a second seeded/demo user, log in as that user, and verify they see and can edit the same tree.
- **Reason:** The multi-user sharing behavior (Story 13) can only be verified by actually logging in as two different users in the same browser-driven run and checking each sees the other's changes.

### Build level: MVP
- **We chose:** MVP.
- **Reason:** The goal in `docs/scope.md` is real accounts and real shared data on one core loop, end to end — a clickable mock couldn't prove that two real users share a real workspace, and Prod-level hardening isn't needed to prove the loop works.

## What we'd add next
1. **Per-page permissions.** The biggest real gap versus Notion; the workspace/page split is already in place to layer it on.
2. **Rich text formatting** (bold/italic/links) inside text blocks — high value, low structural change.
3. **Real-time collaboration** via websockets once the loop is proven sequentially.
4. **Full-text search** across a workspace's pages once there's enough content to need it.
5. **File/image blocks** with local disk storage.
