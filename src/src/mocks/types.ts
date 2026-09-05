/**
 * Shared in-memory fixtures for the MSW handlers.
 *
 * Kept module-level so the UI feels persistent across requests within
 * a single browser session: create a note, refresh the list, see it.
 *
 * Survival rules:
 *  - resets on full page reload (no localStorage by default).
 *  - tests that need a known starting state call `__resetFakeDb()` from
 *    `setup` hooks; production code never imports this module.
 */

export interface FakeUser {
  id: string;
  username: string;
  email: string;
  email_verified_at: string;
  is_active: boolean;
  avatar_url: string;
}

export interface FakeTag {
  id: string;
  display_name: string;
  slug: string;
}

export interface FakeDirectory {
  id: string;
  display_name: string;
  slug: string;
  description?: string;
  parent_dir_ids: string[];
  child_dir_ids: string[];
  child_note_ids: string[];
}

export interface FakeNote {
  id: string;
  title: string;
  content: string;
  stripped_content: string;
  author_id: string;
  updated_at: string;
  directory_ids: string[];
  tag_ids: string[];
  attachment_ids: string[];
}

export interface FakeServiceCheck {
  reachable: boolean;
  address?: string;
  latency_ms?: number;
  detail?: string;
  error?: string;
}

export interface FakeServiceStatus {
  address: string;
  dns: FakeServiceCheck;
  service: FakeServiceCheck;
  reachable: boolean;
  detail?: string;
  error?: string;
}

export interface FakeShare {
  id: string;
  note_id: string;
  permission: "read" | "write";
  created_at: string;
}

/**
 * Mirror of the production `ShelfReply` for MSW. Kept narrow on
 * purpose: handlers only fill the fields the menu and tests read.
 */
export interface FakeShelf {
  id: string;
  slug: string;
  display_name: string;
  description?: string;
  image_url?: string;
  readme_note_id?: string;
  book_ids: string[];
}

export interface FakeActivity {
  id: string;
  actor_id: string;
  action:
    | "note_viewed"
    | "note_created"
    | "note_edited"
    | "note_deleted"
    | "note_published"
    | "note_shared"
    | "note_unshared"
    | "note_restored"
    | "note_archived"
    | "note_version_restored"
    | "note_attachment_added"
    | "directory_created"
    | "directory_viewed"
    | "directory_edited"
    | "directory_deleted";
  note_id: string;
  directory_id: string;
  role_id: string;
  at: string;
  metadata_json: string;
}

export interface FakeDb {
  users: FakeUser[];
  currentUserId: string;
  notes: FakeNote[];
  directories: FakeDirectory[];
  tags: FakeTag[];
  services: FakeServiceStatus[];
  shares: FakeShare[];
  shelves: FakeShelf[];
  activity: FakeActivity[];
  accessToken: string;
}

export function createInitialFakeDb(): FakeDb {
  const now = new Date();
  const userId = "user-1";
  const dirRootId = "dir-root";
  const dirWorkId = "dir-work";

  /**
   * Returns an ISO timestamp `minutesAgo` minutes before `base`,
   * so the activity stream and "last used" lists read in a natural
   * recency order when sorted desc.
   */
  const ago = (minutesAgo: number): string =>
    new Date(now.getTime() - minutesAgo * 60_000).toISOString();

  const welcome = {
    id: "note-1",
    title: "Welcome",
    content: "# Welcome\n\nThis note is served by MSW.",
    stripped_content: "This note is served by MSW.",
    author_id: userId,
    updated_at: ago(120),
    directory_ids: [dirRootId],
    tag_ids: [],
    attachment_ids: [],
  };

  /**
   * Notes living in the Work folder. Realistic shapes so a developer
   * can exercise search, sort, and hierarchy without editing anything.
   * Titles cover a spread of topics the developer can plausibly
   * recall from their activity feed.
   */
  const workNotes = [
    {
      id: "note-2",
      title: "Q4 product roadmap",
      content:
        "## Q4 Roadmap\n\n- Ship shared-note collaboration\n- Garage file permissions v2\n- Mobile note editor beta\n- Spike on offline-first sync",
      stripped_content:
        "Q4 ship list: collab, garage perms v2, mobile beta, offline-first sync.",
      author_id: userId,
      updated_at: ago(7),
      directory_ids: [dirWorkId],
      tag_ids: ["tag-1"],
      attachment_ids: [],
    },
    {
      id: "note-3",
      title: "Retro: Hocuspocus reconnect storm",
      content:
        "### What happened\n\nConnection churn every 90s, traced to a JWT refresh racing the provider heartbeat.\n\n### Fix\n\nSingle-flight refresh in `useAuthStore`, with a 30s cooldown after a successful refresh.",
      stripped_content:
        "JWT refresh raced the Hocuspocus heartbeat; fixed with single-flight refresh in useAuthStore.",
      author_id: userId,
      updated_at: ago(35),
      directory_ids: [dirWorkId],
      tag_ids: [],
      attachment_ids: [],
    },
    {
      id: "note-4",
      title: "Onboarding checklist",
      content:
        "- [x] Discord OAuth + role sync\n- [x] Passkey registration\n- [ ] Garage token rotation reminder\n- [ ] Welcome email template",
      stripped_content:
        "Discord done, passkey done, garage rotation pending, welcome email pending.",
      author_id: userId,
      updated_at: ago(220),
      directory_ids: [dirWorkId],
      tag_ids: [],
      attachment_ids: [],
    },
    {
      id: "note-5",
      title: "BookStack importer: edge cases",
      content:
        "Long titles get truncated at 120 chars on import; nested chapters > 5 levels deep get flattened; embedded images without alt text fall back to filename.",
      stripped_content:
        "BookStack importer: titles over 120 chars are truncated, deep chapters are flattened, missing alt text falls back to filename.",
      author_id: userId,
      updated_at: ago(900),
      directory_ids: [dirWorkId],
      tag_ids: [],
      attachment_ids: [],
    },
    {
      id: "note-6",
      title: "SpiceDB schema: shelf permissions",
      content:
        "```\ndefinition shelf { ... permission edit = ... }\n```\n\nCaveat: bulk-grant needs `caveat` binding for org_id, not the simpler version we prototyped.",
      stripped_content:
        "SpiceDB shelf permission caveat: bulk-grant needs an org_id binding.",
      author_id: userId,
      updated_at: ago(1800),
      directory_ids: [dirWorkId],
      tag_ids: [],
      attachment_ids: [],
    },
    {
      id: "note-7",
      title: "Travel: Kyoto in November",
      content:
        "Day plan:\n\n- Arashiyama early (avoid crowds)\n- Fushimi Inari late afternoon\n- Nishiki market for dinner\n\nPack: layers, rain jacket, walking shoes with grip.",
      stripped_content:
        "Kyoto trip plan: Arashiyama, Fushimi Inari, Nishiki market; pack layers and walking shoes.",
      author_id: userId,
      updated_at: ago(4320),
      directory_ids: [dirWorkId],
      tag_ids: [],
      attachment_ids: [],
    },
  ];

  /**
   * Activity stream backing the "last used" panel. Counts roughly
   * mirror real-world usage so the most-used ranking feels plausible.
   * `note-2` (Q4 roadmap) is opened often and edited last, so it
   * bubbles to the top of both views.
   */
  const activity: FakeActivity[] = [];
  let activitySeq = 1;
  const addActivity = (
    minutesAgo: number,
    action: FakeActivity["action"],
    noteId: string,
  ) => {
    activity.push({
      id: `act-${activitySeq++}`,
      actor_id: userId,
      action,
      note_id: noteId,
      directory_id: "",
      role_id: "",
      at: ago(minutesAgo),
      metadata_json: "{}",
    });
  };

  // Q4 roadmap: viewed a lot, edited recently
  for (let i = 0; i < 14; i++)
    addActivity(15 + i * 45, "note_viewed", "note-2");
  addActivity(7, "note_edited", "note-2");

  // Hocuspocus retro: viewed once, edited once
  addActivity(40, "note_viewed", "note-3");
  addActivity(35, "note_edited", "note-3");

  // Onboarding: viewed a few times
  for (let i = 0; i < 5; i++)
    addActivity(180 + i * 60, "note_viewed", "note-4");

  // BookStack: viewed, edited
  addActivity(910, "note_viewed", "note-5");
  addActivity(900, "note_edited", "note-5");

  // SpiceDB: viewed twice
  addActivity(1810, "note_viewed", "note-6");
  addActivity(1800, "note_edited", "note-6");

  // Kyoto: just read it once
  addActivity(4325, "note_viewed", "note-7");

  return {
    users: [
      {
        id: userId,
        username: "Haru",
        email: "haru@local",
        email_verified_at: now.toISOString(),
        is_active: true,
        avatar_url: "",
      },
    ],
    currentUserId: userId,
    notes: [welcome, ...workNotes],
    directories: [
      {
        id: dirRootId,
        display_name: "Root",
        slug: "root",
        parent_dir_ids: [],
        child_dir_ids: [dirWorkId],
        child_note_ids: ["note-1"],
      },
      {
        id: dirWorkId,
        display_name: "Work",
        slug: "work",
        parent_dir_ids: [dirRootId],
        child_dir_ids: [],
        child_note_ids: workNotes.map((n) => n.id),
      },
    ],
    tags: [{ id: "tag-1", display_name: "ideas", slug: "ideas" }],
    services: [
      {
        address: "msw://fake-backend",
        dns: {
          reachable: true,
          latency_ms: 1,
          detail: "Handled in-browser by MSW.",
        },
        service: {
          reachable: true,
          latency_ms: 5,
          detail: "MSW intercepted the request.",
        },
        reachable: true,
        detail: "MSW intercepted the request.",
      },
      {
        address: "msw://fake-garage",
        dns: { reachable: true, latency_ms: 2 },
        service: { reachable: true, latency_ms: 8 },
        reachable: true,
      },
      {
        address: "msw://fake-spicedb",
        dns: { reachable: true, latency_ms: 1 },
        service: { reachable: true, latency_ms: 6 },
        reachable: true,
      },
      {
        address: "msw://fake-imgproxy",
        dns: { reachable: true, latency_ms: 1 },
        service: { reachable: true, latency_ms: 4 },
        reachable: true,
      },
      {
        address: "msw://fake-postgres",
        dns: { reachable: true, latency_ms: 1 },
        service: { reachable: true, latency_ms: 3 },
        reachable: true,
      },
    ],
    shares: [],
    shelves: [
      {
        id: "shelf-research",
        slug: "research",
        display_name: "Research",
        description: "Long-form reading notes and paper summaries.",
        book_ids: ["note-2", "note-3"],
      },
      {
        id: "shelf-personal",
        slug: "personal",
        display_name: "Personal",
        description: "Travel plans, journals, life admin.",
        book_ids: ["note-7"],
      },
    ],
    activity,
    accessToken: "fake-access-token",
  };
}

/**
 * Test/reset helper. Not used by the worker itself; exposed so tests
 * can install `setupWorker(...handlers)` and reset state between cases.
 */
export function resetFakeDb(): FakeDb {
  const fresh = createInitialFakeDb();
  db = fresh;
  return fresh;
}

let db: FakeDb = createInitialFakeDb();

export function getFakeDb(): FakeDb {
  return db;
}
