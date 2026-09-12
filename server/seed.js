// seed.js — idempotent demo data for Nestpad.
// Creates one workspace ("Traversaal Team Wiki"), two demo users already
// members of it, an "Onboarding" page with two nested sub-pages, and a
// "Team norms" page with a checklist block. Safe to run more than once —
// if the demo users already exist, seeding is skipped.

const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const db = require("./db");

const WORKSPACE_NAME = "Traversaal Team Wiki";
const DEMO_USERS = [
  { email: "amara@traversaal.ai", password: "password123" },
  { email: "leo@traversaal.ai", password: "password123" },
];

function now() {
  return new Date().toISOString();
}

function findUserByEmail(email) {
  return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
}

function createUser(email, password) {
  const id = uuidv4();
  const ts = now();
  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare(
    `INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)`
  ).run(id, email, passwordHash, ts);
  return { id, email, created_at: ts };
}

function addMember(workspaceId, userId) {
  db.prepare(
    `INSERT OR IGNORE INTO workspace_members (workspace_id, user_id) VALUES (?, ?)`
  ).run(workspaceId, userId);
}

function createPage(workspaceId, parentPageId, title, createdBy, section = null) {
  const id = uuidv4();
  const ts = now();
  db.prepare(
    `INSERT INTO pages (id, workspace_id, parent_page_id, title, section, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, workspaceId, parentPageId, title, section, createdBy, ts, ts);
  return id;
}

function createBlock(pageId, type, content, checked, position) {
  const id = uuidv4();
  const ts = now();
  db.prepare(
    `INSERT INTO blocks (id, page_id, type, content, checked, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, pageId, type, content, checked, position, ts, ts);
  return id;
}

// Creates a 'table' block pre-populated with real columns/rows.
function createTable(pageId, position, columnNames, rowsData) {
  const blockId = uuidv4();
  const ts = now();
  db.prepare(
    `INSERT INTO blocks (id, page_id, type, content, checked, position, created_at, updated_at)
     VALUES (?, ?, 'table', '', NULL, ?, ?, ?)`
  ).run(blockId, pageId, position, ts, ts);

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

function seed() {
  const alreadySeeded = DEMO_USERS.every((u) => findUserByEmail(u.email));
  if (alreadySeeded) {
    console.log("Seed already applied — demo users exist. Skipping.");
    console.log("");
    console.log("Demo credentials:");
    DEMO_USERS.forEach((u) => console.log(`  ${u.email} / ${u.password}`));
    return;
  }

  const workspaceId = uuidv4();
  db.prepare(`INSERT INTO workspaces (id, name) VALUES (?, ?)`).run(
    workspaceId,
    WORKSPACE_NAME
  );

  const users = DEMO_USERS.map((u) => {
    const existing = findUserByEmail(u.email);
    const user = existing || createUser(u.email, u.password);
    addMember(workspaceId, user.id);
    return user;
  });

  const creatorId = users[0].id;

  // Three root pages: Onboarding, Projects, Team norms — cross-linked, using
  // every block type (text, heading, checklist, bulleted_list, table) so the
  // seeded demo reads like a real, lived-in workspace rather than a stub.
  const onboardingId = createPage(workspaceId, null, "Onboarding", creatorId, "Team & Culture");
  const projectsId = createPage(workspaceId, null, "Projects", creatorId, "Projects & Roadmap");
  const normsId = createPage(workspaceId, null, "Team norms", creatorId, "Team & Culture");

  // --- Onboarding ----------------------------------------------------------
  createBlock(onboardingId, "heading", "Welcome to the team", null, 0);
  createBlock(
    onboardingId,
    "text",
    "This is your starting point — check the sub-pages below for setup steps and how we work together. See also [Projects](/app/pages/" +
      projectsId +
      ") for what's currently being built and [Team norms](/app/pages/" +
      normsId +
      ") for how we communicate.",
    null,
    1
  );
  createBlock(onboardingId, "heading", "Example: a code block", null, 2);
  createBlock(
    onboardingId,
    "text",
    "A code block preserves whitespace, so it's the one to reach for when you need a diagram or a snippet to line up correctly.",
    null,
    3
  );
  createBlock(
    onboardingId,
    "code",
    "+-----------+      +---------+      +----------+\n" +
      "| Workspace | ---> |  Pages  | ---> |  Blocks  |\n" +
      "+-----------+      +---------+      +----------+\n" +
      "                        |\n" +
      "                        v\n" +
      "                  +-----------+\n" +
      "                  | Sub-pages |\n" +
      "                  +-----------+",
    null,
    4
  );

  const setupId = createPage(workspaceId, onboardingId, "Getting set up", creatorId);
  createBlock(setupId, "heading", "Accounts & access", null, 0);
  createBlock(
    setupId,
    "text",
    "Ask your manager for access to the shared drive and calendar before your first day.",
    null,
    1
  );
  createBlock(setupId, "bulleted_list", "Request a company email and Slack invite", null, 2);
  createBlock(setupId, "bulleted_list", "Get added to the shared calendar", null, 3);
  createBlock(setupId, "bulleted_list", "Set up your laptop with the standard toolset", null, 4);

  const cultureId = createPage(workspaceId, onboardingId, "How we work", creatorId);
  createBlock(cultureId, "heading", "Our working style", null, 0);
  createBlock(
    cultureId,
    "text",
    "We default to async communication and write things down here instead of in chat threads.",
    null,
    1
  );
  createBlock(cultureId, "bulleted_list", "Write meeting notes in the wiki, not just in chat", null, 2);
  createBlock(cultureId, "bulleted_list", "Default to async — don't wait on a reply before moving forward", null, 3);
  createBlock(cultureId, "bulleted_list", "Keep project status current in its table, not just verbally", null, 4);

  // --- Projects --------------------------------------------------------------
  createBlock(projectsId, "heading", "Projects", null, 0);
  createBlock(
    projectsId,
    "text",
    "Everything currently in flight. Each project's own page has a status table.",
    null,
    1
  );

  const redesignId = createPage(workspaceId, projectsId, "Website Redesign", creatorId);
  createBlock(redesignId, "heading", "Website Redesign", null, 0);
  createBlock(redesignId, "text", "Refreshing the marketing site before the Q4 launch.", null, 1);
  createBlock(redesignId, "bulleted_list", "New homepage hero and messaging", null, 2);
  createBlock(redesignId, "bulleted_list", "Rebuild the pricing page", null, 3);
  createBlock(redesignId, "bulleted_list", "Swap the old screenshots for the new product shots", null, 4);
  createTable(
    redesignId,
    5,
    ["Task", "Owner", "Status"],
    [
      ["Homepage hero", "Amara", "In progress"],
      ["Pricing page", "Leo", "Not started"],
      ["Product screenshots", "Amara", "Done"],
    ]
  );

  const roadmapId = createPage(workspaceId, projectsId, "Q4 Roadmap", creatorId);
  createBlock(roadmapId, "heading", "Q4 Roadmap", null, 0);
  createBlock(roadmapId, "text", "Top-level goals for the quarter, owner, and where each stands.", null, 1);
  createTable(
    roadmapId,
    2,
    ["Goal", "Owner", "Status"],
    [
      ["Ship the website redesign", "Amara", "In progress"],
      ["Onboard two new teammates", "Leo", "Not started"],
      ["Write the Q3 retro", "Leo", "Done"],
    ]
  );

  // --- Team norms --------------------------------------------------------------
  createBlock(normsId, "heading", "Team norms", null, 0);
  createBlock(
    normsId,
    "text",
    "How we communicate day to day. See the [Q4 Roadmap](/app/pages/" + roadmapId + ") before planning.",
    null,
    1
  );
  createBlock(normsId, "checklist", "Reply to messages within one business day", 1, 2);
  createBlock(normsId, "checklist", "Write meeting notes in this wiki, not in chat", 1, 3);
  createBlock(normsId, "checklist", "Review the roadmap page before planning", 0, 4);
  createBlock(normsId, "bulleted_list", "Default to async over live meetings", null, 5);
  createBlock(normsId, "bulleted_list", "Keep the project tables up to date, not just verbal status", null, 6);

  // --- Customers ---------------------------------------------------------------
  const customersId = createPage(workspaceId, null, "Customers", creatorId, "Customers & Growth");
  createBlock(customersId, "heading", "Customers", null, 0);
  createBlock(customersId, "text", "Who we're working with, and where each account stands.", null, 1);
  createTable(
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

  // --- Learning ------------------------------------------------------------------
  const learningId = createPage(workspaceId, null, "Learning", creatorId, "Team & Culture");
  createBlock(learningId, "heading", "Learning", null, 0);
  createBlock(learningId, "text", "Courses, talks, and internal know-how the team is picking up.", null, 1);
  createBlock(learningId, "bulleted_list", "Internal workshop: writing a good design doc", null, 2);
  createBlock(learningId, "bulleted_list", "Course: intro to product analytics", null, 3);
  createBlock(learningId, "bulleted_list", "Talk recording: customer interviews that actually help", null, 4);
  createBlock(learningId, "heading", "This quarter", null, 5);
  createBlock(learningId, "checklist", "Everyone finishes the analytics course", 0, 6);
  createBlock(learningId, "checklist", "Amara runs the design-doc workshop for new hires", 0, 7);

  const bookClubId = createPage(workspaceId, learningId, "Book club", creatorId);
  createBlock(bookClubId, "heading", "Book club", null, 0);
  createBlock(bookClubId, "text", "One book a quarter, discussed over lunch.", null, 1);
  createBlock(bookClubId, "bulleted_list", "Currently reading: a book on product thinking", null, 2);
  createBlock(bookClubId, "checklist", "Pick next quarter's book", 0, 3);

  // --- Q1 Focus --------------------------------------------------------------------
  const q1FocusId = createPage(workspaceId, null, "Q1 Focus", creatorId, "Projects & Roadmap");
  createBlock(q1FocusId, "heading", "Q1 Focus", null, 0);
  createBlock(
    q1FocusId,
    "text",
    "The handful of things that matter most this quarter — see [Projects](/app/pages/" + projectsId + ") for the full list.",
    null,
    1
  );
  createTable(
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
  const hiringId = createPage(workspaceId, null, "Hiring", creatorId, "Customers & Growth");
  createBlock(hiringId, "heading", "Open roles", null, 0);
  createBlock(hiringId, "text", "Share this application form with candidates.", null, 1);
  createBlock(
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
    null,
    2
  );

  // --- Task Tracker (demonstrates opening a row as its own detail view) ------
  const taskTrackerId = createPage(workspaceId, null, "Task Tracker", creatorId, "Projects & Roadmap");
  createBlock(taskTrackerId, "heading", "Task Tracker", null, 0);
  createBlock(
    taskTrackerId,
    "text",
    "Hover a row and click Open to see its full detail view — every column as a labeled property, plus a comment box.",
    null,
    1
  );
  createTable(
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

  const docsHomeId = createPage(workspaceId, null, "AI Engineering Docs", creatorId, "Documentation");

  const part1Title = "Part 1: Retrieval-Augmented Generation — Architecture & Core Concepts";
  const part2Title = "Part 2: Vector Databases & Embedding Pipelines";
  const part1Id = createPage(workspaceId, docsHomeId, part1Title, creatorId);
  const part2Id = createPage(workspaceId, docsHomeId, part2Title, creatorId);

  createBlock(docsHomeId, "heading", "AI Engineering Docs", null, 0);
  createBlock(docsHomeId, "bulleted_list", "[" + part1Title + "](/app/pages/" + part1Id + ")", null, 1);
  createBlock(docsHomeId, "bulleted_list", "[" + part2Title + "](/app/pages/" + part2Id + ")", null, 2);

  // Part 1
  createBlock(part1Id, "heading", part1Title, null, 0);
  createBlock(
    part1Id,
    "text",
    "Retrieval-Augmented Generation (RAG) grounds an LLM's answers in retrieved passages instead of relying only on what the model memorized during training. This doc covers the moving parts and the trade-offs between them.",
    null,
    1
  );
  createBlock(part1Id, "heading", "Table of Contents", null, 2);
  createBlock(part1Id, "bulleted_list", "System Overview", null, 3);
  createBlock(part1Id, "bulleted_list", "Core Components", null, 4);
  createBlock(part1Id, "bulleted_list", "Architecture Diagram", null, 5);
  createBlock(part1Id, "bulleted_list", "Key Trade-offs", null, 6);
  createBlock(part1Id, "heading", "System Overview", null, 7);
  createBlock(
    part1Id,
    "text",
    "A user's question is embedded into a vector, compared against a store of pre-embedded document chunks, and the closest matches are pulled back as context. That context is assembled into a prompt alongside the original question and handed to the LLM, which writes an answer grounded in the retrieved text rather than free-associating from its training data alone.",
    null,
    8
  );
  createBlock(part1Id, "heading", "Architecture Diagram", null, 9);
  createBlock(part1Id, "code", RAG_DIAGRAM, null, 10);
  createBlock(part1Id, "heading", "Core Components", null, 11);
  createBlock(part1Id, "bulleted_list", "Query encoder — turns the incoming question into the same vector space as the stored chunks", null, 12);
  createBlock(part1Id, "bulleted_list", "Vector store — holds embedded chunks and answers nearest-neighbor queries quickly", null, 13);
  createBlock(part1Id, "bulleted_list", "Retriever — decides how many chunks to pull back and in what order", null, 14);
  createBlock(part1Id, "bulleted_list", "Generator — the LLM that turns retrieved context plus the question into a written answer", null, 15);
  createBlock(part1Id, "heading", "Key Trade-offs", null, 16);
  createBlock(part1Id, "bulleted_list", "Freshness vs. latency — re-indexing new content often keeps answers current but costs compute", null, 17);
  createBlock(part1Id, "bulleted_list", "Chunk size vs. recall — smaller chunks retrieve more precisely but can lose surrounding context", null, 18);
  createBlock(part1Id, "bulleted_list", "Top-k vs. context cost — pulling back more chunks improves recall but grows the prompt (and the bill)", null, 19);

  // Part 2
  createBlock(part2Id, "heading", part2Title, null, 0);
  createBlock(
    part2Id,
    "text",
    "A vector database is what makes retrieval in a RAG system fast at scale — it stores embeddings and answers 'find me the closest matches' queries in milliseconds instead of scanning every document.",
    null,
    1
  );
  createBlock(part2Id, "heading", "Table of Contents", null, 2);
  createBlock(part2Id, "bulleted_list", "Embedding Pipeline", null, 3);
  createBlock(part2Id, "bulleted_list", "Architecture Diagram", null, 4);
  createBlock(part2Id, "bulleted_list", "Index Types", null, 5);
  createBlock(part2Id, "bulleted_list", "Key Trade-offs", null, 6);
  createBlock(part2Id, "heading", "Embedding Pipeline", null, 7);
  createBlock(
    part2Id,
    "text",
    "Raw documents are split into chunks, each chunk is passed through an embedding model to produce a fixed-length vector, and those vectors are written into an index built for fast similarity search.",
    null,
    8
  );
  createBlock(part2Id, "heading", "Architecture Diagram", null, 9);
  createBlock(part2Id, "code", VECTOR_DIAGRAM, null, 10);
  createBlock(part2Id, "heading", "Index Types", null, 11);
  createBlock(part2Id, "bulleted_list", "HNSW — a graph-based index; fast and accurate, higher memory use", null, 12);
  createBlock(part2Id, "bulleted_list", "IVF — clusters vectors first, then searches only the nearest clusters; lighter but less exact", null, 13);
  createBlock(part2Id, "bulleted_list", "Flat — brute-force comparison against every vector; exact, but doesn't scale", null, 14);
  createBlock(part2Id, "heading", "Key Trade-offs", null, 15);
  createBlock(part2Id, "bulleted_list", "Recall vs. speed — an exact index is always correct but slow at scale; approximate indexes trade a little accuracy for a lot of speed", null, 16);
  createBlock(part2Id, "bulleted_list", "Memory vs. accuracy — higher-recall index settings usually cost more RAM per vector", null, 17);
  createBlock(part2Id, "bulleted_list", "Batch vs. real-time updates — some indexes rebuild cheaply on the fly, others need periodic re-indexing", null, 18);

  console.log("Seed complete.");
  console.log(`Workspace: ${WORKSPACE_NAME}`);
  console.log("");
  console.log("Demo credentials:");
  DEMO_USERS.forEach((u) => console.log(`  ${u.email} / ${u.password}`));
}

seed();
