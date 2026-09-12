# Reference brief — Notion

**Company URL:** https://www.notion.so
**Repo URL:** none (Notion is closed-source)

_This brief is written from general product knowledge of Notion rather than a live crawl of the reference site or a repo, since no repo was supplied. It is scoped tightly to the parts of Notion this build actually touches._

## What it does

Notion is a workspace tool built around one core object — the **page** — which can contain freeform content and can be nested under other pages to form a tree, so a team's whole knowledge base is one navigable hierarchy in a sidebar. Pages are made of **blocks**: paragraphs, headings, checklists, images, embeds, and structured views (databases). Multiple people share a **workspace** and can create, nest, and edit any page inside it. Real-time collaboration, permissions, databases, and a large block-type library are the product's depth beyond this core loop.

## Core user flow (the part this build reproduces)

1. **Sign up and land in a workspace.** A new user signs up with email and password. If they're the first person, they get a fresh workspace; if they were invited, they land in the workspace they were invited to.
2. **Create and nest pages.** From the sidebar, a user clicks "New page," gives it a title, and it appears in the tree. Clicking a page's own "+" (or dragging it under another page in the sidebar) nests it as a sub-page.
3. **Write content in blocks.** Inside a page, the user adds blocks — plain text, a heading, or a checklist item — and can toggle a checklist item done.
4. **Invite a teammate.** A workspace member invites a teammate by email. The teammate signs up (or logs in, if they already have an account) and the same workspace — and all its pages — appears in their sidebar.
5. **Shared editing.** Any workspace member can open a page any other member created and edit its blocks; the change is visible to everyone the next time they load that page.

## What we are explicitly not reproducing

Notion's actual depth is enormous — databases and every view type (table, board, calendar, gallery), real-time multiplayer cursors and live co-editing, a huge block library (embeds, code blocks with syntax highlighting, columns, synced blocks, images/files), comments and mentions, granular per-page permissions and sharing links, templates, full-text search, version history, and a public API. All of that is out of scope here — see `docs/scope.md` for the explicit excludes list. This build only reproduces the five-step loop above.

## Who it's for

A small team that wants a lightweight, self-hostable shared wiki — nested pages, basic formatting, a shared workspace — without needing Notion's account, its pricing, or its much larger feature surface.
