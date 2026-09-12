# User stories

_Level: MVP. Expanded from `docs/prd.md`._

Data-testid values named below are the contract between the frontend and QA. The frontend must use them exactly. The first eight (`hero-cta-signup`, `nav-login`, `go-to-signup`, `email-input`, `password-input`, `signup-button`, `login-button`, `logout-button`) are fixed by the kit's QA agent and must not be renamed. App screens live under `/app`; sign-up and log-in are `/signup` and `/login`.

## Must-have

### Story 1 — Sign up with email and password

**Story:** As a new user, I want to sign up with email and password so that I can access the product.

**Acceptance criteria:**
- Given I am on the landing page, when I click `hero-cta-signup` (or `nav-login` then `go-to-signup`), then the URL is `/signup` and `email-input`, `password-input`, `signup-button` are visible.
- Given I fill `email-input` with an unused email and `password-input` with 8+ characters and click `signup-button`, then a session is created, the URL becomes `/app`, and `logout-button` is visible.
- Given an account already exists for that email, when I submit `/signup` again with the same email, then an error containing "already" is shown, the URL stays `/signup`, and no second account is created.
- Given I submit with an empty email or password, then a validation message is shown and no request succeeds.

**Priority:** Must-have · **Effort:** Small

### Story 2 — Log in with email and password

**Story:** As a returning user, I want to log in so that I see my workspace and its pages.

**Acceptance criteria:**
- Given I am signed out, when I click `nav-login`, then the URL is `/login` and `email-input`, `password-input`, `login-button` are visible.
- Given correct credentials, when I click `login-button`, then the URL becomes `/app` and the sidebar shows my workspace's page tree.
- Given a correct email and wrong password, then a message containing "Invalid" is shown, the URL stays `/login`, and `logout-button` is not present.

**Priority:** Must-have · **Effort:** Small

### Story 3 — Session persists across reload

**Acceptance criteria:**
- Given I am signed in on `/app`, when I reload, then I remain signed in and my page tree is shown without a login form appearing.
- Given I am signed in and viewing a page, when I reload, then the same page is open with its saved title and blocks.

**Priority:** Must-have · **Effort:** Small

### Story 4 — Log out

**Acceptance criteria:**
- Given I am signed in, when I click `logout-button`, then the URL becomes `/login` (or the landing page) and `nav-login` is visible.
- Given I have logged out, when I navigate directly to `/app`, then I am redirected to `/login`.

**Priority:** Must-have · **Effort:** Small

### Story 5 — New workspace on signup (no pending invite)

**Story:** As a new user with no invite waiting, I want a workspace created for me automatically so I have somewhere to start.

**Acceptance criteria:**
- Given no invite exists for my email, when I sign up, then a new workspace is created, I am its member, and my sidebar shows an empty page tree with a `new-page-button`.

**Priority:** Must-have · **Effort:** Small

### Story 6 — Invite a teammate by email

**Story:** As a workspace member, I want to invite a teammate by email so they land in my workspace, not a new one.

**Acceptance criteria:**
- Given I am signed in, when I open `invite-panel` (from the sidebar), fill `invite-email-input` with a teammate's email, and click `invite-button`, then a confirmation `invite-confirmation` is shown and the email is recorded as pending for my workspace.
- Given I submit an email that is not a valid address, then a validation message is shown and nothing is recorded.
- Given I submit an email already invited to my workspace, then the confirmation is still shown and no duplicate invite is created.

**Priority:** Must-have · **Effort:** Small

### Story 7 — Invited teammate joins the existing workspace

**Story:** As an invited teammate, I want to see the workspace's existing page tree the first time I sign up or log in.

**Acceptance criteria:**
- Given my email has a pending invite to a workspace, when I sign up with that exact email, then I become a member of that existing workspace (not a new one) and my sidebar immediately shows its full current page tree.
- Given my email has a pending invite and I already have an account elsewhere (edge case out of scope — assume one account per email), this does not apply; every email has at most one account.
- Given I log in (not sign up) with an email that was invited after my account already existed, then I am added to that workspace on login and my sidebar shows its page tree from that point on.

**Priority:** Must-have · **Effort:** Medium

### Story 8 — Create a page

**Story:** As a workspace member, I want to create a page with a title so I have somewhere to write.

**Acceptance criteria:**
- Given I am on `/app`, when I click `new-page-button`, enter a title in `page-title-input`, and it saves, then the page appears at the root of the sidebar tree and the URL is `/app/pages/<id>`.
- Given I submit an empty title, then a validation message is shown and no page is created.

**Priority:** Must-have · **Effort:** Small

### Story 9 — Nest a page under another page

**Story:** As a workspace member, I want to nest a page under another page so I can build a tree.

**Acceptance criteria:**
- Given an existing page is open, when I click its `new-subpage-button`, enter a title, and it saves, then the new page appears nested under the parent in the sidebar tree (indented, or under an expand toggle) and its own view shows a `parent-page-link` back to the parent.
- Given a page has two nested children, when I open the sidebar, then both children are listed under their parent, not at the root.

**Priority:** Must-have · **Effort:** Medium

### Story 10 — See the full page tree in the sidebar

**Acceptance criteria:**
- Given my workspace has pages with parents and children, when `/app` loads, then the sidebar (`page-tree`) reflects the full nesting in one request/render — no missing branches.

**Priority:** Must-have · **Effort:** Small

### Story 11 — Add blocks to a page

**Story:** As a workspace member, I want to add a text block, a heading block, or a checklist item to a page.

**Acceptance criteria:**
- Given a page is open, when I click `add-block-button` and choose "Text", type a sentence into the new `block-text-input`, and it saves, then the block appears in the page in that position on reload.
- Given the same page, when I add a "Heading" block and type a heading, then it renders visibly larger/bolder than a text block.
- Given the same page, when I add a "Checklist" block and type an item, then it renders with a checkbox (`checklist-item-checkbox`) next to the text.
- Blocks render in the order they were added.

**Priority:** Must-have · **Effort:** Medium

### Story 12 — Toggle a checklist item

**Acceptance criteria:**
- Given a page has a checklist block, when I click its `checklist-item-checkbox`, then it visually toggles checked/unchecked and the state persists on reload.

**Priority:** Must-have · **Effort:** Small

### Story 13 — Edit a page another member created (shared editing)

**Story:** As a workspace member, I want to edit a page another member created, with my change visible to them.

**Acceptance criteria:**
- Given user A creates a page and adds a block, when user B (same workspace) opens that page, then user B sees the same block, can add another block or edit the existing one, and save.
- Given user B has saved a change, when user A reopens the page, then user A sees user B's change.
- No error or permission block occurs for editing a page created by someone else in the same workspace.

**Priority:** Must-have · **Effort:** Medium

### Story 14 — Seeded demo workspace

**Acceptance criteria:**
- Given a fresh install, when the seed script runs, then it prints two demo users' emails and passwords to the terminal, both members of one workspace ("Traversaal Team Wiki").
- Given the seed has run, when I log in as either demo user, then the sidebar shows an "Onboarding" page with two nested sub-pages, and a "Team norms" page containing a checklist with at least one checked and one unchecked item.
- Given the seed has already run, when it runs again, then there are still exactly two demo users, one workspace, and no duplicate pages.

**Priority:** Must-have · **Effort:** Medium

## Should-have

### Story 15 — Rename a page
**Acceptance criteria:** Given a page is open, when I edit `page-title-input` and it saves, then the sidebar and the page's own header both show the new title on reload.

### Story 16 — Delete a page
**Acceptance criteria:** Given a page with no children, when I click `delete-page-button` and confirm, then it disappears from the sidebar and its blocks are gone. Given a page has children, deleting it also deletes its children (documented behavior, not silent data loss).

### Story 17 — See workspace members
**Acceptance criteria:** Given I open `invite-panel`, then a list of current workspace members' emails is shown alongside the invite form.

## Nice-to-have
- Reorder blocks by drag-and-drop.
- Collapse/expand a page's children in the sidebar tree.
- Autosave block content as I type instead of an explicit save action.

## Edge cases to discuss
- Deleting a page with children: cascade-delete vs. re-parent to the deleted page's parent. Decisions.md and the API contract pick cascade-delete for simplicity.
- Two users editing the same page's same block around the same time: last write wins, no conflict warning at MVP.

## Questions for the team
1. Is there any UI indication when a page was last edited and by whom? Not required at MVP; a `should-have` candidate for a later pass.
