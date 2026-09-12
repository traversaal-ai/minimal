# Sprint Zero — Scope

## Reference

- **Company URL:** https://www.notion.so
- **Repo URL:** none

## Build configuration

- **Project type:** web-app
- **Stack profile:** node-react
- **Data layer:** local

A React + Vite UI talking to an Express API, with data and auth stored locally in SQLite (no external account needed). Self-hostable: run both servers on any machine and point teammates at it.

## Build level

**MVP**

Real auth and real data on one core loop, end to end.

## Core loop

A user signs up and lands in a workspace. They create a page (title + body), nest it under another page to build a simple tree, and add basic blocks to the body: paragraph text, a heading, and a checklist item that can be toggled done. They invite a teammate to the workspace by email; that teammate signs up (or logs in) and sees the same workspace in their sidebar, can open any page in it, and can edit a page another member created — edits are visible to all members on reload. Seed data is real: the seed script creates one demo workspace ("Traversaal Team Wiki") with two demo users already members of it, and a small real page tree (an "Onboarding" page with two nested sub-pages, and a "Team norms" page with checklist items already ticked/unticked) so the demo has something to click through immediately.

## Excludes

- Real-time multiplayer editing (no live cursors, no operational transform — edits are saved on submit, last write wins)
- Databases / tables / kanban board views
- Rich text formatting toolbar (bold, colors, embeds) beyond plain text, headings, and checklist blocks
- Comments and inline discussion
- Granular permissions and roles (every workspace member can view and edit every page — no owner-only or view-only pages)
- File and image uploads
- Templates and template gallery
- Full-text search across pages
- Page version history and undo
- Public share links / publishing a page to the web
- Third-party integrations, API, and webhooks
- Native mobile apps and offline support
- Multiple workspaces per user (one workspace per user at MVP)
