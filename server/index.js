// index.js — Nestpad API (Express + SQLite). See docs/api-contract.md — that
// file is law; every route, field name, status code, and error shape here
// must match it exactly.

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const db = require("./db");
const { signToken, requireAuth } = require("./auth");
const {
  normalizeEmail,
  isValidEmail,
  serializeUser,
  serializeWorkspace,
  serializePage,
  serializeBlock,
  serializeTableColumn,
  serializeTableRow,
  serializeRowComment,
  serializeActivity,
  serializeFormResponse,
  errorBody,
} = require("./helpers");

const PORT = process.env.PORT || 3001;

const app = express();

app.use(cors({ origin: "http://localhost:5173" }));

// express.json() with a custom error handler so malformed bodies match the contract.
app.use((req, res, next) => {
  express.json()(req, res, (err) => {
    if (err) {
      return res
        .status(400)
        .json(errorBody("validation_error", "Malformed request body."));
    }
    next();
  });
});

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

// The seeded workspace, used for the public read-only guest demo. Looked up
// by name rather than a schema flag to avoid a migration for one feature.
function getDemoWorkspace() {
  return db
    .prepare(`SELECT * FROM workspaces WHERE name = ? LIMIT 1`)
    .get("Traversaal Team Wiki");
}

function getUserWorkspace(userId) {
  return db
    .prepare(
      `SELECT w.* FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = ?
       LIMIT 1`
    )
    .get(userId);
}

function addMember(workspaceId, userId) {
  db.prepare(
    `INSERT OR IGNORE INTO workspace_members (workspace_id, user_id) VALUES (?, ?)`
  ).run(workspaceId, userId);
}

function findUserByEmail(email) {
  return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
}

function findPendingInvite(email) {
  return db
    .prepare(`SELECT * FROM workspace_invites WHERE email = ? LIMIT 1`)
    .get(email);
}

// Resolves the workspace a (new or existing) user should belong to at auth
// time: a pending invite wins and is consumed; otherwise `fallback()` is used
// (create a new workspace on signup, or the user's existing workspace on login).
function resolveWorkspaceForAuth(email, userId, fallback) {
  const invite = findPendingInvite(email);
  if (invite) {
    db.prepare(`DELETE FROM workspace_invites WHERE id = ?`).run(invite.id);
    addMember(invite.workspace_id, userId);
    return db
      .prepare(`SELECT * FROM workspaces WHERE id = ?`)
      .get(invite.workspace_id);
  }
  return fallback();
}

// Loads a page and checks it belongs to the given workspace. Returns
// { page } on success, or { status, body } describing the error to send.
function loadPageForWorkspace(pageId, workspaceId) {
  const page = db.prepare(`SELECT * FROM pages WHERE id = ?`).get(pageId);
  if (!page) {
    return { status: 404, body: { error: "not_found" } };
  }
  if (page.workspace_id !== workspaceId) {
    return { status: 403, body: { error: "forbidden" } };
  }
  return { page };
}

function loadBlockForWorkspace(blockId, workspaceId) {
  const block = db.prepare(`SELECT * FROM blocks WHERE id = ?`).get(blockId);
  if (!block) {
    return { status: 404, body: { error: "not_found" } };
  }
  const page = db.prepare(`SELECT * FROM pages WHERE id = ?`).get(block.page_id);
  if (!page || page.workspace_id !== workspaceId) {
    return { status: 403, body: { error: "forbidden" } };
  }
  return { block, page };
}

// A locked page can only be edited (title, section, icon, blocks, table
// data) by its creator; everyone in the workspace can still view it. Returns
// null when the edit is allowed, or {status, body} to send back otherwise.
function assertPageEditable(page, userId) {
  if (page.locked && page.created_by !== userId) {
    return {
      status: 403,
      body: errorBody("forbidden", "This page is locked to edits by its owner."),
    };
  }
  return null;
}

function logActivity(pageId, actorId, summary) {
  db.prepare(
    `INSERT INTO page_activity (id, page_id, actor_id, summary, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(uuidv4(), pageId, actorId, summary, new Date().toISOString());
}

// Loads a table's columns + rows (with cells) for embedding into a
// serialized 'table' block. Returns { columns, rows }.
function loadTableData(blockId) {
  const columns = db
    .prepare(`SELECT * FROM table_columns WHERE block_id = ? ORDER BY position ASC`)
    .all(blockId);
  const rowRows = db
    .prepare(`SELECT * FROM table_rows WHERE block_id = ? ORDER BY position ASC`)
    .all(blockId);
  const rows = rowRows.map((r) => {
    const cells = db
      .prepare(`SELECT column_id, value FROM table_cells WHERE row_id = ?`)
      .all(r.id);
    return serializeTableRow(r, cells);
  });
  return { columns: columns.map(serializeTableColumn), rows };
}

// serializeBlock plus, for a 'table' block, its embedded columns/rows.
function serializeBlockWithTable(row) {
  const block = serializeBlock(row);
  if (block.type === "table") {
    block.table = loadTableData(block.id);
  }
  return block;
}

// Verifies a table column/row belongs to a block in the given workspace.
// kind is "table_columns" or "table_rows".
function loadTableChildForWorkspace(kind, childId, workspaceId) {
  const child = db.prepare(`SELECT * FROM ${kind} WHERE id = ?`).get(childId);
  if (!child) {
    return { status: 404, body: { error: "not_found" } };
  }
  const result = loadBlockForWorkspace(child.block_id, workspaceId);
  if (result.status) {
    return result;
  }
  return { child, block: result.block, page: result.page };
}

function nextPosition(table, blockIdColumn, blockId) {
  const row = db
    .prepare(`SELECT COALESCE(MAX(position), -1) AS maxPos FROM ${table} WHERE ${blockIdColumn} = ?`)
    .get(blockId);
  return row.maxPos + 1;
}

// Creates a table block's default shape: three columns and one blank row,
// so a freshly added table isn't an empty grid with nothing to click.
function createDefaultTableShape(blockId, columnNames = ["Name", "Status", "Notes"]) {
  const columnIds = columnNames.map((name, i) => {
    const id = uuidv4();
    db.prepare(
      `INSERT INTO table_columns (id, block_id, name, position) VALUES (?, ?, ?, ?)`
    ).run(id, blockId, name, i);
    return id;
  });
  const rowId = uuidv4();
  db.prepare(`INSERT INTO table_rows (id, block_id, position) VALUES (?, ?, ?)`).run(
    rowId,
    blockId,
    0
  );
  columnIds.forEach((columnId) => {
    db.prepare(
      `INSERT INTO table_cells (id, row_id, column_id, value) VALUES (?, ?, ?, ?)`
    ).run(uuidv4(), rowId, columnId, "");
  });
}

// Creates a small example page tree in a brand-new workspace so a fresh
// signup never lands on an empty sidebar — the same idea as Notion's default
// "Getting Started" page. Only called for a genuinely new workspace (not one
// joined via invite, which already has real content).
function insertBlock(pageId, type, content, position, checked) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO blocks (id, page_id, type, content, checked, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(uuidv4(), pageId, type, content, checked, position, now, now);
}

// `section` only makes sense on a root page (parent_page_id === null) — the
// home dashboard groups root pages by it. Nested pages don't set one; they
// just inherit visibility through their parent's card.
function insertPage(workspaceId, parentPageId, title, createdBy, section = null) {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO pages (id, workspace_id, parent_page_id, title, section, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, workspaceId, parentPageId, title, section, createdBy, now, now);
  return id;
}

// Creates a 'table' block already populated with real columns/rows, rather
// than the empty default shape — for seeded example content only.
function insertTable(pageId, position, columnNames, rowsData) {
  const blockId = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO blocks (id, page_id, type, content, checked, position, created_at, updated_at)
     VALUES (?, ?, 'table', '', NULL, ?, ?, ?)`
  ).run(blockId, pageId, position, now, now);

  const columnIds = columnNames.map((name, i) => {
    const id = uuidv4();
    db.prepare(
      `INSERT INTO table_columns (id, block_id, name, position) VALUES (?, ?, ?, ?)`
    ).run(id, blockId, name, i);
    return id;
  });

  rowsData.forEach((rowValues, rIdx) => {
    const rowId = uuidv4();
    db.prepare(`INSERT INTO table_rows (id, block_id, position) VALUES (?, ?, ?)`).run(
      rowId,
      blockId,
      rIdx
    );
    columnIds.forEach((columnId, cIdx) => {
      db.prepare(
        `INSERT INTO table_cells (id, row_id, column_id, value) VALUES (?, ?, ?, ?)`
      ).run(uuidv4(), rowId, columnId, rowValues[cIdx] || "");
    });
  });

  return blockId;
}

// A richer starter tree for a brand-new workspace: a landing page, a
// "Projects" area with two sub-pages (one holding a table), and a "Team"
// area with meeting notes — using every block type (text, heading,
// checklist, bulleted_list, table) plus internal links, so a fresh signup
// feels like an actual product on first look instead of a blank page.
// Internal links use the [label](/app/pages/<id>) syntax the frontend
// renders as a real, clickable in-app link.
function createExamplePages(workspaceId, userId) {
  const welcomeId = insertPage(workspaceId, null, "Welcome to Nestpad", userId, "Getting started");
  const projectsId = insertPage(workspaceId, null, "Projects", userId, "Projects & Roadmap");
  const teamId = insertPage(workspaceId, null, "Team", userId, "Team & Culture");

  // --- Welcome ---------------------------------------------------------
  insertBlock(welcomeId, "heading", "This is a page", 0, null);
  insertBlock(
    welcomeId,
    "text",
    "Pages are the building block of Nestpad. Every page has a title and a body made of blocks. Click any block's text to edit it. Two more pages are already set up for you — take a look at [Projects](/app/pages/" +
      projectsId +
      ") and [Team](/app/pages/" +
      teamId +
      ").",
    1,
    null
  );
  insertBlock(welcomeId, "heading", "What you can do here", 2, null);
  insertBlock(welcomeId, "bulleted_list", "Nest pages under other pages to build a tree", 3, null);
  insertBlock(welcomeId, "bulleted_list", "Write text, headings, and checklist blocks", 4, null);
  insertBlock(welcomeId, "bulleted_list", "Add a table for anything list-shaped — tasks, goals, contacts", 5, null);
  insertBlock(welcomeId, "bulleted_list", "Invite a teammate so you both see and edit the same pages", 6, null);
  insertBlock(welcomeId, "heading", "Example: a code block", 7, null);
  insertBlock(
    welcomeId,
    "text",
    "Blocks aren't just text — a code block preserves whitespace, so it's the one to reach for when you need a diagram or a snippet to line up correctly.",
    8,
    null
  );
  insertBlock(
    welcomeId,
    "code",
    "+-----------+      +---------+      +----------+\n" +
      "| Workspace | ---> |  Pages  | ---> |  Blocks  |\n" +
      "+-----------+      +---------+      +----------+\n" +
      "                        |\n" +
      "                        v\n" +
      "                  +-----------+\n" +
      "                  | Sub-pages |\n" +
      "                  +-----------+",
    9,
    null
  );
  insertBlock(welcomeId, "heading", "Try it", 10, null);
  insertBlock(welcomeId, "checklist", "Check off this box", 11, 0);
  insertBlock(welcomeId, "checklist", "Create a new page from the sidebar", 12, 0);
  insertBlock(welcomeId, "checklist", "Open a table below and edit a cell", 13, 0);

  const subPageId = insertPage(workspaceId, welcomeId, "Example: a nested page", userId);
  insertBlock(
    subPageId,
    "text",
    "This page is nested under \"Welcome to Nestpad\" — that's what the back link above does. Any page can have sub-pages, and those can have their own sub-pages, as deep as you like.",
    0,
    null
  );
  insertBlock(subPageId, "checklist", "Nest another page under this one to see the tree grow", 1, 0);

  // --- Projects ----------------------------------------------------------
  insertBlock(projectsId, "heading", "Projects", 0, null);
  insertBlock(
    projectsId,
    "text",
    "Everything the team is currently building lives under this page. See [Welcome to Nestpad](/app/pages/" +
      welcomeId +
      ") for how pages and blocks work.",
    1,
    null
  );

  const redesignId = insertPage(workspaceId, projectsId, "Website Redesign", userId);
  insertBlock(redesignId, "heading", "Website Redesign", 0, null);
  insertBlock(redesignId, "text", "Refreshing the marketing site before the Q4 launch.", 1, null);
  insertBlock(redesignId, "bulleted_list", "New homepage hero and messaging", 2, null);
  insertBlock(redesignId, "bulleted_list", "Rebuild the pricing page", 3, null);
  insertBlock(redesignId, "bulleted_list", "Swap the old screenshots for the new product shots", 4, null);
  insertTable(
    redesignId,
    5,
    ["Task", "Owner", "Status"],
    [
      ["Homepage hero", "Amara", "In progress"],
      ["Pricing page", "Leo", "Not started"],
      ["Product screenshots", "Amara", "Done"],
    ]
  );

  const roadmapId = insertPage(workspaceId, projectsId, "Q4 Roadmap", userId);
  insertBlock(roadmapId, "heading", "Q4 Roadmap", 0, null);
  insertBlock(roadmapId, "text", "Top-level goals for the quarter, owner, and where each one stands.", 1, null);
  insertTable(
    roadmapId,
    2,
    ["Goal", "Owner", "Status"],
    [
      ["Ship the website redesign", "Amara", "In progress"],
      ["Onboard two new teammates", "Leo", "Not started"],
      ["Write the Q3 retro", "Leo", "Done"],
    ]
  );

  // --- Team ----------------------------------------------------------
  insertBlock(teamId, "heading", "Team", 0, null);
  insertBlock(teamId, "text", "Who's who, and where meeting notes live.", 1, null);
  insertBlock(teamId, "bulleted_list", "Amara — product & design", 2, null);
  insertBlock(teamId, "bulleted_list", "Leo — engineering", 3, null);

  const meetingNotesId = insertPage(workspaceId, teamId, "Meeting Notes", userId);
  insertBlock(meetingNotesId, "heading", "Weekly sync", 0, null);
  insertBlock(
    meetingNotesId,
    "text",
    "Notes go here instead of chat, per the norms — see the [Website Redesign](/app/pages/" +
      redesignId +
      ") table for what's in flight.",
    1,
    null
  );
  insertBlock(meetingNotesId, "bulleted_list", "Reviewed the homepage hero draft", 2, null);
  insertBlock(meetingNotesId, "bulleted_list", "Agreed to cut the old pricing tiers", 3, null);
  insertBlock(meetingNotesId, "checklist", "Send the updated roadmap to the team", 4, 0);
  insertBlock(meetingNotesId, "checklist", "Book the design review for next week", 5, 0);

  // --- Customers -----------------------------------------------------------
  const customersId = insertPage(workspaceId, null, "Customers", userId, "Customers & Growth");
  insertBlock(customersId, "heading", "Customers", 0, null);
  insertBlock(customersId, "text", "Who we're working with, and where each account stands.", 1, null);
  insertTable(
    customersId,
    2,
    ["Company", "Contact", "Plan", "Status"],
    [
      ["Northwind Traders", "Priya Shah", "Team", "In progress"],
      ["Acme Corp", "Sam Diaz", "Starter", "Done"],
      ["Globex", "Jamie Lee", "Team", "Not started"],
      ["Initech", "Robin Chen", "Enterprise", "Blocked"],
    ]
  );

  // --- Learning --------------------------------------------------------------
  const learningId = insertPage(workspaceId, null, "Learning", userId, "Team & Culture");
  insertBlock(learningId, "heading", "Learning", 0, null);
  insertBlock(learningId, "text", "Courses, talks, and internal know-how the team is picking up.", 1, null);
  insertBlock(learningId, "bulleted_list", "Internal workshop: writing a good design doc", 2, null);
  insertBlock(learningId, "bulleted_list", "Course: intro to product analytics", 3, null);
  insertBlock(learningId, "bulleted_list", "Talk recording: customer interviews that actually help", 4, null);
  insertBlock(learningId, "heading", "This quarter", 5, null);
  insertBlock(learningId, "checklist", "Everyone finishes the analytics course", 6, 0);
  insertBlock(learningId, "checklist", "Amara runs the design-doc workshop for new hires", 7, 0);

  const bookClubId = insertPage(workspaceId, learningId, "Book club", userId);
  insertBlock(bookClubId, "heading", "Book club", 0, null);
  insertBlock(bookClubId, "text", "One book a quarter, discussed over lunch.", 1, null);
  insertBlock(bookClubId, "bulleted_list", "Currently reading: a book on product thinking", 2, null);
  insertBlock(bookClubId, "checklist", "Pick next quarter's book", 3, 0);

  // --- Q1 Focus --------------------------------------------------------------
  const q1FocusId = insertPage(workspaceId, null, "Q1 Focus", userId, "Projects & Roadmap");
  insertBlock(q1FocusId, "heading", "Q1 Focus", 0, null);
  insertBlock(
    q1FocusId,
    "text",
    "The handful of things that matter most this quarter — see [Projects](/app/pages/" +
      projectsId +
      ") for the full list of work in flight.",
    1,
    null
  );
  insertTable(
    q1FocusId,
    2,
    ["Focus area", "Owner", "Status"],
    [
      ["Land the website redesign", "Amara", "In progress"],
      ["Grow customer accounts to Team plan", "Leo", "Not started"],
      ["Ship the Learning hub for new hires", "Amara", "Done"],
    ]
  );

  // --- Hiring (demonstrates the mock form block) ------------------------------
  const hiringId = insertPage(workspaceId, null, "Hiring", userId, "Customers & Growth");
  insertBlock(hiringId, "heading", "Open roles", 0, null);
  insertBlock(hiringId, "text", "Share this application form with candidates.", 1, null);
  insertBlock(
    hiringId,
    "form",
    JSON.stringify({
      icon: "🚀",
      cover: { type: "gradient", value: "bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400" },
      title: "Data Science Researcher — Application",
      description:
        "Thanks for your interest in joining the data science team. Tell us a bit about your background below.",
      isPublic: true,
      fields: [
        { id: "f1", label: "Full name", type: "text", required: true },
        { id: "f2", label: "Email", type: "email", required: true },
        { id: "f3", label: "Phone number", type: "phone", required: true },
        { id: "f4", label: "LinkedIn profile", type: "url", required: true },
        { id: "f5", label: "GitHub link", type: "url", required: true },
        { id: "f6", label: "Tell us about your data science experience", type: "textarea", required: true },
        { id: "f7", label: "Resume", type: "file", required: true },
      ],
    }),
    2,
    null
  );

  // --- Task Tracker (demonstrates opening a row as its own detail view) ------
  const taskTrackerId = insertPage(workspaceId, null, "Task Tracker", userId, "Projects & Roadmap");
  insertBlock(taskTrackerId, "heading", "Task Tracker", 0, null);
  insertBlock(
    taskTrackerId,
    "text",
    "Hover a row and click Open to see its full detail view — every column as a labeled property, plus a comment box.",
    1,
    null
  );
  insertTable(
    taskTrackerId,
    2,
    ["Task #", "Task", "Description", "Owner", "Status", "Due Date"],
    [
      [
        "1",
        "Prepare the onboarding walkthrough",
        "Turn the current onboarding notes into a short walkthrough a new hire can follow on their own first day, without needing someone to sit with them.",
        "Amara",
        "In progress",
        "",
      ],
      [
        "2",
        "Set up the customer health check",
        "Define what 'healthy' looks like for a Team-plan account and put it on the Customers page so status isn't just a gut feeling.",
        "Leo",
        "Not started",
        "",
      ],
      [
        "3",
        "Redesign the Q1 focus page",
        "The current layout buries the goals table below too much text. Lead with the table, move context below it.",
        "Amara",
        "Done",
        "",
      ],
      [
        "4",
        "Write the book club recap",
        "One paragraph per chapter discussed so far, posted to the Book club page for anyone who missed a session.",
        "Leo",
        "Not started",
        "",
      ],
    ]
  );

  // --- AI Engineering Docs (demonstrates the code/diagram block) ------------
  const RAG_DIAGRAM = `+-------------+       +----------------+       +----------------+
|   User      | ----> |  Query Encoder | ----> |  Vector Store  |
|  Question   |       |  (Embeddings)  |       |  (Similarity   |
+-------------+       +----------------+       |   Search)      |
                                                +--------+-------+
                                                         |
                                                         v
+-------------+       +----------------+       +----------------+
|   Answer    | <----- |   LLM Generator | <----- |  Top-K Chunks  |
|             |       |  (Prompt +     |       |  (Retrieved    |
+-------------+       |   Context)     |       |   Passages)    |
                       +----------------+       +----------------+`;

  const VECTOR_DIAGRAM = `+--------------+     +----------------+     +------------------+
| Raw Documents| --> |   Chunking     | --> |  Embedding Model |
| (PDF, HTML,  |     | (fixed size or |     |  (text -> vector)|
|  Markdown)   |     |  semantic)     |     +--------+---------+
+--------------+     +----------------+              |
                                                       v
                                             +------------------+
                                             |   Vector Index   |
                                             | (HNSW / IVF /    |
                                             |  Flat)           |
                                             +--------+---------+
                                                       |
                                                       v
                                             +------------------+
                                             |  Similarity Query|
                                             |  (top-k nearest) |
                                             +------------------+`;

  const docsHomeId = insertPage(workspaceId, null, "AI Engineering Docs", userId, "Documentation");

  const part1Title = "Part 1: Retrieval-Augmented Generation — Architecture & Core Concepts";
  const part2Title = "Part 2: Vector Databases & Embedding Pipelines";
  const part1Id = insertPage(workspaceId, docsHomeId, part1Title, userId);
  const part2Id = insertPage(workspaceId, docsHomeId, part2Title, userId);

  insertBlock(docsHomeId, "heading", "AI Engineering Docs", 0, null);
  insertBlock(
    docsHomeId,
    "bulleted_list",
    "[" + part1Title + "](/app/pages/" + part1Id + ")",
    1,
    null
  );
  insertBlock(
    docsHomeId,
    "bulleted_list",
    "[" + part2Title + "](/app/pages/" + part2Id + ")",
    2,
    null
  );

  // Part 1
  insertBlock(part1Id, "heading", part1Title, 0, null);
  insertBlock(
    part1Id,
    "text",
    "Retrieval-Augmented Generation (RAG) grounds an LLM's answers in retrieved passages instead of relying only on what the model memorized during training. This doc covers the moving parts and the trade-offs between them.",
    1,
    null
  );
  insertBlock(part1Id, "heading", "Table of Contents", 2, null);
  insertBlock(part1Id, "bulleted_list", "System Overview", 3, null);
  insertBlock(part1Id, "bulleted_list", "Core Components", 4, null);
  insertBlock(part1Id, "bulleted_list", "Architecture Diagram", 5, null);
  insertBlock(part1Id, "bulleted_list", "Key Trade-offs", 6, null);
  insertBlock(part1Id, "heading", "System Overview", 7, null);
  insertBlock(
    part1Id,
    "text",
    "A user's question is embedded into a vector, compared against a store of pre-embedded document chunks, and the closest matches are pulled back as context. That context is assembled into a prompt alongside the original question and handed to the LLM, which writes an answer grounded in the retrieved text rather than free-associating from its training data alone.",
    8,
    null
  );
  insertBlock(part1Id, "heading", "Architecture Diagram", 9, null);
  insertBlock(part1Id, "code", RAG_DIAGRAM, 10, null);
  insertBlock(part1Id, "heading", "Core Components", 11, null);
  insertBlock(part1Id, "bulleted_list", "Query encoder — turns the incoming question into the same vector space as the stored chunks", 12, null);
  insertBlock(part1Id, "bulleted_list", "Vector store — holds embedded chunks and answers nearest-neighbor queries quickly", 13, null);
  insertBlock(part1Id, "bulleted_list", "Retriever — decides how many chunks to pull back and in what order", 14, null);
  insertBlock(part1Id, "bulleted_list", "Generator — the LLM that turns retrieved context plus the question into a written answer", 15, null);
  insertBlock(part1Id, "heading", "Key Trade-offs", 16, null);
  insertBlock(part1Id, "bulleted_list", "Freshness vs. latency — re-indexing new content often keeps answers current but costs compute", 17, null);
  insertBlock(part1Id, "bulleted_list", "Chunk size vs. recall — smaller chunks retrieve more precisely but can lose surrounding context", 18, null);
  insertBlock(part1Id, "bulleted_list", "Top-k vs. context cost — pulling back more chunks improves recall but grows the prompt (and the bill)", 19, null);

  // Part 2
  insertBlock(part2Id, "heading", part2Title, 0, null);
  insertBlock(
    part2Id,
    "text",
    "A vector database is what makes retrieval in a RAG system fast at scale — it stores embeddings and answers 'find me the closest matches' queries in milliseconds instead of scanning every document.",
    1,
    null
  );
  insertBlock(part2Id, "heading", "Table of Contents", 2, null);
  insertBlock(part2Id, "bulleted_list", "Embedding Pipeline", 3, null);
  insertBlock(part2Id, "bulleted_list", "Architecture Diagram", 4, null);
  insertBlock(part2Id, "bulleted_list", "Index Types", 5, null);
  insertBlock(part2Id, "bulleted_list", "Key Trade-offs", 6, null);
  insertBlock(part2Id, "heading", "Embedding Pipeline", 7, null);
  insertBlock(
    part2Id,
    "text",
    "Raw documents are split into chunks, each chunk is passed through an embedding model to produce a fixed-length vector, and those vectors are written into an index built for fast similarity search.",
    8,
    null
  );
  insertBlock(part2Id, "heading", "Architecture Diagram", 9, null);
  insertBlock(part2Id, "code", VECTOR_DIAGRAM, 10, null);
  insertBlock(part2Id, "heading", "Index Types", 11, null);
  insertBlock(part2Id, "bulleted_list", "HNSW — a graph-based index; fast and accurate, higher memory use", 12, null);
  insertBlock(part2Id, "bulleted_list", "IVF — clusters vectors first, then searches only the nearest clusters; lighter but less exact", 13, null);
  insertBlock(part2Id, "bulleted_list", "Flat — brute-force comparison against every vector; exact, but doesn't scale", 14, null);
  insertBlock(part2Id, "heading", "Key Trade-offs", 15, null);
  insertBlock(part2Id, "bulleted_list", "Recall vs. speed — an exact index is always correct but slow at scale; approximate indexes trade a little accuracy for a lot of speed", 16, null);
  insertBlock(part2Id, "bulleted_list", "Memory vs. accuracy — higher-recall index settings usually cost more RAM per vector", 17, null);
  insertBlock(part2Id, "bulleted_list", "Batch vs. real-time updates — some indexes rebuild cheaply on the fly, others need periodic re-indexing", 18, null);
}

// Removes everything that references a block as a foreign key — table
// columns/rows/cells, row comments, and form responses — so the block
// itself can be deleted without violating a foreign key constraint.
// Safe to call on any block type: a no-op for whichever of these a given
// block has none of.
function deleteBlockDependents(blockId) {
  const rows = db.prepare(`SELECT id FROM table_rows WHERE block_id = ?`).all(blockId);
  rows.forEach((r) => {
    db.prepare(`DELETE FROM row_comments WHERE row_id = ?`).run(r.id);
    db.prepare(`DELETE FROM table_cells WHERE row_id = ?`).run(r.id);
  });
  db.prepare(`DELETE FROM table_rows WHERE block_id = ?`).run(blockId);
  db.prepare(`DELETE FROM table_columns WHERE block_id = ?`).run(blockId);
  db.prepare(`DELETE FROM form_responses WHERE block_id = ?`).run(blockId);
}

function deletePageRecursive(pageId) {
  const children = db
    .prepare(`SELECT id FROM pages WHERE parent_page_id = ?`)
    .all(pageId);
  for (const child of children) {
    deletePageRecursive(child.id);
  }
  const blocks = db.prepare(`SELECT id FROM blocks WHERE page_id = ?`).all(pageId);
  blocks.forEach((b) => deleteBlockDependents(b.id));
  db.prepare(`DELETE FROM blocks WHERE page_id = ?`).run(pageId);
  db.prepare(`DELETE FROM page_activity WHERE page_id = ?`).run(pageId);
  db.prepare(`DELETE FROM page_presence WHERE page_id = ?`).run(pageId);
  db.prepare(`DELETE FROM pages WHERE id = ?`).run(pageId);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

app.post("/auth/signup", (req, res) => {
  const rawEmail = req.body && req.body.email;
  const password = req.body && req.body.password;
  const email = normalizeEmail(rawEmail);

  if (!email || !isValidEmail(email)) {
    return res
      .status(400)
      .json(errorBody("validation_error", "Please enter a valid email address."));
  }
  if (typeof password !== "string" || password.length < 8) {
    return res
      .status(400)
      .json(errorBody("validation_error", "Password must be at least 8 characters."));
  }

  if (findUserByEmail(email)) {
    return res
      .status(409)
      .json(errorBody("email_taken", "An account with that email already exists."));
  }

  const userId = uuidv4();
  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(
    `INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)`
  ).run(userId, email, passwordHash, now);

  const workspace = resolveWorkspaceForAuth(email, userId, () => {
    const workspaceId = uuidv4();
    const localPart = email.split("@")[0];
    db.prepare(`INSERT INTO workspaces (id, name) VALUES (?, ?)`).run(
      workspaceId,
      `${localPart}'s Workspace`
    );
    addMember(workspaceId, userId);
    createExamplePages(workspaceId, userId);
    return db.prepare(`SELECT * FROM workspaces WHERE id = ?`).get(workspaceId);
  });

  const user = { id: userId, email, created_at: now };
  const token = signToken(user);

  return res.status(201).json({
    access_token: token,
    user: serializeUser(user),
    workspace: serializeWorkspace(workspace),
  });
});

app.post("/auth/login", (req, res) => {
  const rawEmail = req.body && req.body.email;
  const password = req.body && req.body.password;
  const email = normalizeEmail(rawEmail);

  if (!email || typeof password !== "string" || !password) {
    return res
      .status(400)
      .json(errorBody("validation_error", "Email and password are required."));
  }

  const userRow = findUserByEmail(email);
  if (!userRow || !bcrypt.compareSync(password, userRow.password_hash)) {
    return res
      .status(401)
      .json(errorBody("invalid_credentials", "Invalid email or password."));
  }

  const workspace = resolveWorkspaceForAuth(email, userRow.id, () =>
    getUserWorkspace(userRow.id)
  );

  const token = signToken(userRow);

  return res.status(200).json({
    access_token: token,
    user: serializeUser(userRow),
    workspace: serializeWorkspace(workspace),
  });
});

app.get("/auth/me", requireAuth, (req, res) => {
  const userRow = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
  if (!userRow) {
    return res
      .status(401)
      .json(errorBody("unauthorized", "Missing or invalid token."));
  }
  const workspace = getUserWorkspace(userRow.id);
  return res.status(200).json({
    user: serializeUser(userRow),
    workspace: serializeWorkspace(workspace),
  });
});

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

app.post("/workspace/invite", requireAuth, (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  if (!email || !isValidEmail(email)) {
    return res
      .status(400)
      .json(errorBody("validation_error", "Please enter a valid email address."));
  }

  const workspace = getUserWorkspace(req.user.id);
  const existingUser = findUserByEmail(email);

  if (existingUser) {
    addMember(workspace.id, existingUser.id);
    return res.status(200).json({ invited: true, already_member: true });
  }

  const existingInvite = db
    .prepare(
      `SELECT * FROM workspace_invites WHERE workspace_id = ? AND email = ?`
    )
    .get(workspace.id, email);

  if (existingInvite) {
    return res.status(200).json({ invited: true, already_member: false });
  }

  db.prepare(
    `INSERT INTO workspace_invites (id, workspace_id, email) VALUES (?, ?, ?)`
  ).run(uuidv4(), workspace.id, email);

  return res.status(201).json({ invited: true, already_member: false });
});

app.get("/workspace/members", requireAuth, (req, res) => {
  const workspace = getUserWorkspace(req.user.id);
  const members = db
    .prepare(
      `SELECT u.id, u.email FROM users u
       JOIN workspace_members wm ON wm.user_id = u.id
       WHERE wm.workspace_id = ?`
    )
    .all(workspace.id);
  return res.status(200).json({ members });
});

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

app.get("/pages", requireAuth, (req, res) => {
  const workspace = getUserWorkspace(req.user.id);
  const pages = db
    .prepare(`SELECT * FROM pages WHERE workspace_id = ?`)
    .all(workspace.id);
  return res.status(200).json({ pages: pages.map(serializePage) });
});

app.post("/pages", requireAuth, (req, res) => {
  const title = req.body && req.body.title;
  const parentPageId =
    req.body && req.body.parent_page_id !== undefined
      ? req.body.parent_page_id
      : null;
  const section =
    req.body && typeof req.body.section === "string" && req.body.section.trim()
      ? req.body.section.trim()
      : null;
  const icon =
    req.body && typeof req.body.icon === "string" && req.body.icon.trim() ? req.body.icon.trim() : null;

  if (typeof title !== "string" || !title.trim()) {
    return res
      .status(400)
      .json(errorBody("validation_error", "Title is required."));
  }

  const workspace = getUserWorkspace(req.user.id);

  if (parentPageId !== null) {
    const parent = db.prepare(`SELECT * FROM pages WHERE id = ?`).get(parentPageId);
    if (!parent || parent.workspace_id !== workspace.id) {
      return res
        .status(404)
        .json(errorBody("not_found", "Parent page not found."));
    }
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO pages (id, workspace_id, parent_page_id, title, section, icon, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, workspace.id, parentPageId, title, section, icon, req.user.id, now, now);

  logActivity(id, req.user.id, `Created "${title}"`);

  const page = db.prepare(`SELECT * FROM pages WHERE id = ?`).get(id);
  return res.status(201).json(serializePage(page));
});

// Deep-copies a page's own blocks (not its sub-pages) into a new root page —
// the mechanism behind both "save as template" (copy into the Templates
// section) and "use this template" (copy out of it). See docs/decisions.md.
app.post("/pages/:id/duplicate", requireAuth, (req, res) => {
  const workspace = getUserWorkspace(req.user.id);
  const result = loadPageForWorkspace(req.params.id, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }

  const title = req.body && typeof req.body.title === "string" && req.body.title.trim()
    ? req.body.title.trim()
    : result.page.title;
  const section =
    req.body && Object.prototype.hasOwnProperty.call(req.body, "section")
      ? typeof req.body.section === "string" && req.body.section.trim()
        ? req.body.section.trim()
        : null
      : null;

  const newId = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO pages (id, workspace_id, parent_page_id, title, section, icon, created_by, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`
  ).run(newId, workspace.id, title, section, result.page.icon, req.user.id, now, now);

  const blocks = db
    .prepare(`SELECT * FROM blocks WHERE page_id = ? ORDER BY position ASC`)
    .all(result.page.id);
  blocks.forEach((b) => {
    const newBlockId = uuidv4();
    db.prepare(
      `INSERT INTO blocks (id, page_id, type, content, checked, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(newBlockId, newId, b.type, b.content, b.checked, b.position, now, now);
    if (b.type === "table") {
      const columns = db.prepare(`SELECT * FROM table_columns WHERE block_id = ?`).all(b.id);
      const columnIdMap = {};
      columns.forEach((c) => {
        const newColumnId = uuidv4();
        columnIdMap[c.id] = newColumnId;
        db.prepare(
          `INSERT INTO table_columns (id, block_id, name, position) VALUES (?, ?, ?, ?)`
        ).run(newColumnId, newBlockId, c.name, c.position);
      });
      const rows = db.prepare(`SELECT * FROM table_rows WHERE block_id = ?`).all(b.id);
      rows.forEach((r) => {
        const newRowId = uuidv4();
        db.prepare(`INSERT INTO table_rows (id, block_id, position) VALUES (?, ?, ?)`).run(
          newRowId,
          newBlockId,
          r.position
        );
        const cells = db.prepare(`SELECT * FROM table_cells WHERE row_id = ?`).all(r.id);
        cells.forEach((cell) => {
          db.prepare(
            `INSERT INTO table_cells (id, row_id, column_id, value) VALUES (?, ?, ?, ?)`
          ).run(uuidv4(), newRowId, columnIdMap[cell.column_id], cell.value);
        });
      });
    }
  });

  logActivity(newId, req.user.id, `Duplicated from "${result.page.title}"`);

  const page = db.prepare(`SELECT * FROM pages WHERE id = ?`).get(newId);
  return res.status(201).json(serializePage(page));
});

app.get("/pages/:id", requireAuth, (req, res) => {
  const workspace = getUserWorkspace(req.user.id);
  const result = loadPageForWorkspace(req.params.id, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }
  const blocks = db
    .prepare(`SELECT * FROM blocks WHERE page_id = ? ORDER BY position ASC`)
    .all(result.page.id);
  return res.status(200).json({
    page: serializePage(result.page),
    blocks: blocks.map(serializeBlockWithTable),
  });
});

app.put("/pages/:id", requireAuth, (req, res) => {
  const title = req.body && req.body.title;
  const hasSection = req.body && Object.prototype.hasOwnProperty.call(req.body, "section");
  const section = hasSection
    ? typeof req.body.section === "string" && req.body.section.trim()
      ? req.body.section.trim()
      : null
    : undefined;
  const hasIcon = req.body && Object.prototype.hasOwnProperty.call(req.body, "icon");
  const icon = hasIcon
    ? typeof req.body.icon === "string" && req.body.icon.trim()
      ? req.body.icon.trim()
      : null
    : undefined;
  const hasLocked = req.body && Object.prototype.hasOwnProperty.call(req.body, "locked");

  if (typeof title !== "string" || !title.trim()) {
    return res
      .status(400)
      .json(errorBody("validation_error", "Title is required."));
  }

  const workspace = getUserWorkspace(req.user.id);
  const result = loadPageForWorkspace(req.params.id, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }

  if (hasLocked && req.user.id !== result.page.created_by) {
    return res
      .status(403)
      .json(errorBody("forbidden", "Only the page's creator can lock or unlock it."));
  }
  const editCheck = assertPageEditable(result.page, req.user.id);
  if (editCheck) {
    return res.status(editCheck.status).json(editCheck.body);
  }

  const now = new Date().toISOString();
  const fields = ["title = ?"];
  const values = [title];
  if (hasSection) {
    fields.push("section = ?");
    values.push(section);
  }
  if (hasIcon) {
    fields.push("icon = ?");
    values.push(icon);
  }
  if (hasLocked) {
    fields.push("locked = ?");
    values.push(req.body.locked ? 1 : 0);
  }
  fields.push("updated_at = ?");
  values.push(now);
  values.push(result.page.id);

  db.prepare(`UPDATE pages SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  if (title !== result.page.title) {
    logActivity(result.page.id, req.user.id, `Renamed to "${title}"`);
  }
  if (hasLocked) {
    logActivity(result.page.id, req.user.id, req.body.locked ? "Locked this page" : "Unlocked this page");
  }

  const page = db.prepare(`SELECT * FROM pages WHERE id = ?`).get(result.page.id);
  return res.status(200).json(serializePage(page));
});

app.delete("/pages/:id", requireAuth, (req, res) => {
  const workspace = getUserWorkspace(req.user.id);
  const result = loadPageForWorkspace(req.params.id, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }
  const editCheck = assertPageEditable(result.page, req.user.id);
  if (editCheck) {
    return res.status(editCheck.status).json(editCheck.body);
  }
  deletePageRecursive(result.page.id);
  return res.status(204).send();
});

// ---------------------------------------------------------------------------
// Page activity ("version history" as a short edit log — see docs/decisions.md)
// ---------------------------------------------------------------------------

app.get("/pages/:id/activity", requireAuth, (req, res) => {
  const workspace = getUserWorkspace(req.user.id);
  const result = loadPageForWorkspace(req.params.id, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }
  const rows = db
    .prepare(`SELECT * FROM page_activity WHERE page_id = ? ORDER BY created_at DESC LIMIT 5`)
    .all(result.page.id);
  const activity = rows.map((r) => {
    const actor = db.prepare(`SELECT email FROM users WHERE id = ?`).get(r.actor_id);
    return serializeActivity(r, actor ? actor.email : "unknown");
  });
  return res.status(200).json({ activity });
});

// ---------------------------------------------------------------------------
// Page presence ("who's viewing this page right now")
// ---------------------------------------------------------------------------

const PRESENCE_WINDOW_MS = 30_000;

app.put("/pages/:id/presence", requireAuth, (req, res) => {
  const workspace = getUserWorkspace(req.user.id);
  const result = loadPageForWorkspace(req.params.id, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO page_presence (page_id, user_id, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(page_id, user_id) DO UPDATE SET updated_at = excluded.updated_at`
  ).run(result.page.id, req.user.id, now);
  return res.status(204).send();
});

app.get("/pages/:id/presence", requireAuth, (req, res) => {
  const workspace = getUserWorkspace(req.user.id);
  const result = loadPageForWorkspace(req.params.id, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }
  const cutoff = new Date(Date.now() - PRESENCE_WINDOW_MS).toISOString();
  const rows = db
    .prepare(
      `SELECT u.email FROM page_presence p
       JOIN users u ON u.id = p.user_id
       WHERE p.page_id = ? AND p.updated_at >= ? AND p.user_id != ?`
    )
    .all(result.page.id, cutoff, req.user.id);
  return res.status(200).json({ viewers: rows.map((r) => r.email) });
});

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

// 'table' carries no inline content — its data lives in table_columns/rows/cells.
// 'form' carries its whole structure (title, cover, description, fields) as an
// opaque JSON string in content — the server never parses or validates it,
// same as it never parses 'text' content. See docs/decisions.md: it's a mock
// form builder (Preview/Share are real UI, but there is no response backend).
const BLOCK_TYPES = ["text", "heading", "checklist", "bulleted_list", "table", "form", "code"];

app.post("/pages/:id/blocks", requireAuth, (req, res) => {
  const { type, position } = req.body || {};
  const content = type === "table" ? "" : req.body && req.body.content;

  if (!BLOCK_TYPES.includes(type)) {
    return res
      .status(400)
      .json(
        errorBody(
          "validation_error",
          "type must be one of text, heading, checklist, bulleted_list, table, form, code."
        )
      );
  }
  if (type !== "table" && (typeof content !== "string" || content.length === 0)) {
    return res
      .status(400)
      .json(errorBody("validation_error", "content is required."));
  }
  if (typeof position !== "number") {
    return res
      .status(400)
      .json(errorBody("validation_error", "position is required."));
  }

  const workspace = getUserWorkspace(req.user.id);
  const result = loadPageForWorkspace(req.params.id, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }
  const editCheck = assertPageEditable(result.page, req.user.id);
  if (editCheck) {
    return res.status(editCheck.status).json(editCheck.body);
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const checked = type === "checklist" ? 0 : null;

  db.prepare(
    `INSERT INTO blocks (id, page_id, type, content, checked, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, result.page.id, type, content || "", checked, position, now, now);

  if (type === "table") {
    createDefaultTableShape(id);
  }

  logActivity(result.page.id, req.user.id, `Added a ${type} block`);

  const block = db.prepare(`SELECT * FROM blocks WHERE id = ?`).get(id);
  return res.status(201).json(serializeBlockWithTable(block));
});

app.put("/blocks/:id", requireAuth, (req, res) => {
  const body = req.body || {};
  const hasContent = Object.prototype.hasOwnProperty.call(body, "content");
  const hasChecked = Object.prototype.hasOwnProperty.call(body, "checked");
  const hasPosition = Object.prototype.hasOwnProperty.call(body, "position");

  if (!hasContent && !hasChecked && !hasPosition) {
    return res
      .status(400)
      .json(errorBody("validation_error", "At least one field is required."));
  }

  const workspace = getUserWorkspace(req.user.id);
  const result = loadBlockForWorkspace(req.params.id, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }
  const editCheck = assertPageEditable(result.page, req.user.id);
  if (editCheck) {
    return res.status(editCheck.status).json(editCheck.body);
  }

  if (hasChecked && result.block.type !== "checklist") {
    return res
      .status(400)
      .json(
        errorBody(
          "validation_error",
          "checked can only be set on a checklist block."
        )
      );
  }

  const fields = [];
  const values = [];

  if (hasContent) {
    fields.push("content = ?");
    values.push(body.content);
  }
  if (hasChecked) {
    fields.push("checked = ?");
    values.push(body.checked ? 1 : 0);
  }
  if (hasPosition) {
    fields.push("position = ?");
    values.push(body.position);
  }

  const now = new Date().toISOString();
  fields.push("updated_at = ?");
  values.push(now);
  values.push(result.block.id);

  db.prepare(`UPDATE blocks SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  const block = db.prepare(`SELECT * FROM blocks WHERE id = ?`).get(result.block.id);
  return res.status(200).json(serializeBlock(block));
});

app.delete("/blocks/:id", requireAuth, (req, res) => {
  const workspace = getUserWorkspace(req.user.id);
  const result = loadBlockForWorkspace(req.params.id, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }
  const editCheck = assertPageEditable(result.page, req.user.id);
  if (editCheck) {
    return res.status(editCheck.status).json(editCheck.body);
  }
  deleteBlockDependents(result.block.id);
  db.prepare(`DELETE FROM blocks WHERE id = ?`).run(result.block.id);
  logActivity(result.page.id, req.user.id, `Removed a ${result.block.type} block`);
  return res.status(204).send();
});

// ---------------------------------------------------------------------------
// Tables (columns, rows, cells — nested under a 'table' block)
// ---------------------------------------------------------------------------

app.post("/tables/:blockId/columns", requireAuth, (req, res) => {
  const name = req.body && req.body.name;
  if (typeof name !== "string" || !name.trim()) {
    return res
      .status(400)
      .json(errorBody("validation_error", "name is required."));
  }
  const workspace = getUserWorkspace(req.user.id);
  const result = loadBlockForWorkspace(req.params.blockId, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }
  if (result.block.type !== "table") {
    return res
      .status(400)
      .json(errorBody("validation_error", "Block is not a table."));
  }
  const editCheck = assertPageEditable(result.page, req.user.id);
  if (editCheck) {
    return res.status(editCheck.status).json(editCheck.body);
  }

  const id = uuidv4();
  const position = nextPosition("table_columns", "block_id", result.block.id);
  db.prepare(
    `INSERT INTO table_columns (id, block_id, name, position) VALUES (?, ?, ?, ?)`
  ).run(id, result.block.id, name.trim(), position);

  // New column needs a blank cell in every existing row.
  const rows = db.prepare(`SELECT id FROM table_rows WHERE block_id = ?`).all(result.block.id);
  rows.forEach((r) => {
    db.prepare(
      `INSERT INTO table_cells (id, row_id, column_id, value) VALUES (?, ?, ?, ?)`
    ).run(uuidv4(), r.id, id, "");
  });

  const column = db.prepare(`SELECT * FROM table_columns WHERE id = ?`).get(id);
  return res.status(201).json(serializeTableColumn(column));
});

app.put("/tables/columns/:id", requireAuth, (req, res) => {
  const name = req.body && req.body.name;
  if (typeof name !== "string" || !name.trim()) {
    return res
      .status(400)
      .json(errorBody("validation_error", "name is required."));
  }
  const workspace = getUserWorkspace(req.user.id);
  const result = loadTableChildForWorkspace("table_columns", req.params.id, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }
  const editCheck = assertPageEditable(result.page, req.user.id);
  if (editCheck) {
    return res.status(editCheck.status).json(editCheck.body);
  }
  db.prepare(`UPDATE table_columns SET name = ? WHERE id = ?`).run(name.trim(), result.child.id);
  const column = db.prepare(`SELECT * FROM table_columns WHERE id = ?`).get(result.child.id);
  return res.status(200).json(serializeTableColumn(column));
});

app.delete("/tables/columns/:id", requireAuth, (req, res) => {
  const workspace = getUserWorkspace(req.user.id);
  const result = loadTableChildForWorkspace("table_columns", req.params.id, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }
  const editCheck = assertPageEditable(result.page, req.user.id);
  if (editCheck) {
    return res.status(editCheck.status).json(editCheck.body);
  }
  db.prepare(`DELETE FROM table_cells WHERE column_id = ?`).run(result.child.id);
  db.prepare(`DELETE FROM table_columns WHERE id = ?`).run(result.child.id);
  return res.status(204).send();
});

app.post("/tables/:blockId/rows", requireAuth, (req, res) => {
  const workspace = getUserWorkspace(req.user.id);
  const result = loadBlockForWorkspace(req.params.blockId, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }
  if (result.block.type !== "table") {
    return res
      .status(400)
      .json(errorBody("validation_error", "Block is not a table."));
  }
  const editCheck = assertPageEditable(result.page, req.user.id);
  if (editCheck) {
    return res.status(editCheck.status).json(editCheck.body);
  }

  const id = uuidv4();
  const position = nextPosition("table_rows", "block_id", result.block.id);
  db.prepare(`INSERT INTO table_rows (id, block_id, position) VALUES (?, ?, ?)`).run(
    id,
    result.block.id,
    position
  );

  const columns = db.prepare(`SELECT id FROM table_columns WHERE block_id = ?`).all(result.block.id);
  columns.forEach((c) => {
    db.prepare(
      `INSERT INTO table_cells (id, row_id, column_id, value) VALUES (?, ?, ?, ?)`
    ).run(uuidv4(), id, c.id, "");
  });

  const row = db.prepare(`SELECT * FROM table_rows WHERE id = ?`).get(id);
  const cells = db.prepare(`SELECT column_id, value FROM table_cells WHERE row_id = ?`).all(id);
  return res.status(201).json(serializeTableRow(row, cells));
});

app.delete("/tables/rows/:id", requireAuth, (req, res) => {
  const workspace = getUserWorkspace(req.user.id);
  const result = loadTableChildForWorkspace("table_rows", req.params.id, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }
  const editCheck = assertPageEditable(result.page, req.user.id);
  if (editCheck) {
    return res.status(editCheck.status).json(editCheck.body);
  }
  db.prepare(`DELETE FROM table_cells WHERE row_id = ?`).run(result.child.id);
  db.prepare(`DELETE FROM table_rows WHERE id = ?`).run(result.child.id);
  return res.status(204).send();
});

app.put("/tables/cells", requireAuth, (req, res) => {
  const { row_id: rowId, column_id: columnId, value } = req.body || {};
  if (!rowId || !columnId || typeof value !== "string") {
    return res
      .status(400)
      .json(errorBody("validation_error", "row_id, column_id, and value are required."));
  }
  const workspace = getUserWorkspace(req.user.id);
  const rowCheck = loadTableChildForWorkspace("table_rows", rowId, workspace.id);
  if (rowCheck.status) {
    return res.status(rowCheck.status).json(rowCheck.body);
  }
  const editCheck = assertPageEditable(rowCheck.page, req.user.id);
  if (editCheck) {
    return res.status(editCheck.status).json(editCheck.body);
  }
  const column = db.prepare(`SELECT * FROM table_columns WHERE id = ?`).get(columnId);
  if (!column || column.block_id !== rowCheck.child.block_id) {
    return res.status(404).json(errorBody("not_found", "Column not found on this table."));
  }

  const existing = db
    .prepare(`SELECT * FROM table_cells WHERE row_id = ? AND column_id = ?`)
    .get(rowId, columnId);
  if (existing) {
    db.prepare(`UPDATE table_cells SET value = ? WHERE id = ?`).run(value, existing.id);
  } else {
    db.prepare(
      `INSERT INTO table_cells (id, row_id, column_id, value) VALUES (?, ?, ?, ?)`
    ).run(uuidv4(), rowId, columnId, value);
  }
  return res.status(200).json({ row_id: rowId, column_id: columnId, value });
});

// ---------------------------------------------------------------------------
// Row comments (real, server-side — see docs/decisions.md for why this
// replaced the earlier localStorage-only version)
// ---------------------------------------------------------------------------

app.get("/tables/rows/:id/comments", requireAuth, (req, res) => {
  const workspace = getUserWorkspace(req.user.id);
  const result = loadTableChildForWorkspace("table_rows", req.params.id, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }
  const rows = db
    .prepare(`SELECT * FROM row_comments WHERE row_id = ? ORDER BY created_at ASC`)
    .all(result.child.id);
  const comments = rows.map((r) => {
    const author = db.prepare(`SELECT email FROM users WHERE id = ?`).get(r.author_id);
    return serializeRowComment(r, author ? author.email : "unknown");
  });
  return res.status(200).json({ comments });
});

app.post("/tables/rows/:id/comments", requireAuth, (req, res) => {
  const text = req.body && req.body.text;
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json(errorBody("validation_error", "text is required."));
  }
  const workspace = getUserWorkspace(req.user.id);
  const result = loadTableChildForWorkspace("table_rows", req.params.id, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO row_comments (id, row_id, author_id, text, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(id, result.child.id, req.user.id, text.trim(), now);
  const comment = db.prepare(`SELECT * FROM row_comments WHERE id = ?`).get(id);
  return res.status(201).json(serializeRowComment(comment, req.user.email));
});

// ---------------------------------------------------------------------------
// Form responses (real submissions — see docs/decisions.md: Preview's Submit
// button and the Responses tab are wired to this, unlike everything else
// about the form block, which is still a mock)
// ---------------------------------------------------------------------------

app.post("/forms/:blockId/responses", requireAuth, (req, res) => {
  const data = req.body && req.body.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return res.status(400).json(errorBody("validation_error", "data must be an object."));
  }
  const workspace = getUserWorkspace(req.user.id);
  const result = loadBlockForWorkspace(req.params.blockId, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }
  if (result.block.type !== "form") {
    return res.status(400).json(errorBody("validation_error", "Block is not a form."));
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO form_responses (id, block_id, submitted_by, data, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(id, result.block.id, req.user.id, JSON.stringify(data), now);
  const row = db.prepare(`SELECT * FROM form_responses WHERE id = ?`).get(id);
  return res.status(201).json(serializeFormResponse(row));
});

app.get("/forms/:blockId/responses", requireAuth, (req, res) => {
  const workspace = getUserWorkspace(req.user.id);
  const result = loadBlockForWorkspace(req.params.blockId, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }
  const rows = db
    .prepare(`SELECT * FROM form_responses WHERE block_id = ? ORDER BY created_at DESC`)
    .all(result.block.id);
  return res.status(200).json({ responses: rows.map(serializeFormResponse) });
});

// ---------------------------------------------------------------------------
// Knowledge graph (Obsidian-style bidirectional links + a graph view — see
// docs/decisions.md). No new storage: an internal link is already just
// `/app/pages/<id>` inside a block's `content` string (the same [label](url)
// syntax richText.jsx already renders), so a "link" is detected by checking
// whether a page's raw id string appears anywhere in another page's block
// content — good enough at this scale without parsing every content type's
// own rules for what counts as a link.
// ---------------------------------------------------------------------------

app.get("/workspace/graph", requireAuth, (req, res) => {
  const workspace = getUserWorkspace(req.user.id);
  const pages = db.prepare(`SELECT id, title FROM pages WHERE workspace_id = ?`).all(workspace.id);
  if (pages.length === 0) {
    return res.status(200).json({ nodes: [], edges: [] });
  }
  const pageIds = pages.map((p) => p.id);
  const placeholders = pageIds.map(() => "?").join(",");
  const blocks = db
    .prepare(`SELECT page_id, content FROM blocks WHERE page_id IN (${placeholders})`)
    .all(...pageIds);

  const edgeSet = new Set();
  const edges = [];
  blocks.forEach((b) => {
    if (!b.content) return;
    pageIds.forEach((targetId) => {
      if (targetId === b.page_id) return;
      if (b.content.includes(targetId)) {
        const key = `${b.page_id}->${targetId}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({ source: b.page_id, target: targetId });
        }
      }
    });
  });

  return res.status(200).json({ nodes: pages, edges });
});

app.get("/pages/:id/backlinks", requireAuth, (req, res) => {
  const workspace = getUserWorkspace(req.user.id);
  const result = loadPageForWorkspace(req.params.id, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }
  const otherPages = db
    .prepare(`SELECT id, title FROM pages WHERE workspace_id = ? AND id != ?`)
    .all(workspace.id, result.page.id);

  const backlinks = otherPages.filter((p) => {
    const blocks = db.prepare(`SELECT content FROM blocks WHERE page_id = ?`).all(p.id);
    return blocks.some((b) => b.content && b.content.includes(result.page.id));
  });

  return res.status(200).json({ backlinks });
});

// ---------------------------------------------------------------------------
// Guest demo (public, read-only — no auth, no writes)
// ---------------------------------------------------------------------------

app.get("/demo/pages", (req, res) => {
  const workspace = getDemoWorkspace();
  if (!workspace) {
    return res
      .status(404)
      .json(errorBody("not_found", "No demo workspace is seeded yet."));
  }
  const pages = db
    .prepare(`SELECT * FROM pages WHERE workspace_id = ?`)
    .all(workspace.id);
  return res
    .status(200)
    .json({ workspace: serializeWorkspace(workspace), pages: pages.map(serializePage) });
});

app.get("/demo/pages/:id", (req, res) => {
  const workspace = getDemoWorkspace();
  if (!workspace) {
    return res
      .status(404)
      .json(errorBody("not_found", "No demo workspace is seeded yet."));
  }
  const result = loadPageForWorkspace(req.params.id, workspace.id);
  if (result.status) {
    return res.status(result.status).json(result.body);
  }
  const blocks = db
    .prepare(`SELECT * FROM blocks WHERE page_id = ? ORDER BY position ASC`)
    .all(result.page.id);
  return res.status(200).json({
    page: serializePage(result.page),
    blocks: blocks.map(serializeBlockWithTable),
  });
});

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({ error: "not_found" });
});

app.listen(PORT, () => {
  console.log(`Nestpad API listening on http://localhost:${PORT}`);
});

module.exports = app;
