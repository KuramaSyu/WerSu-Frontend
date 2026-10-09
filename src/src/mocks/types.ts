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
  /** Shelves this directory is bound to. */
  shelf_ids: string[];
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
    /**
     * Stress-test fixture for the note renderer. Carries every markdown
     * shape the editor claims to support: nested headings, GFM tables
     * (with and without alignment), ordered and unordered lists, inline
     * code, fenced code with a language tag, blockquotes (including
     * nested ones), bold/italic emphasis, and links. Content is a
     * paraphrased excerpt of the TempleOS Wikipedia entry, included for
     * layout testing only.
     */
    {
      id: "note-8",
      title: "TempleOS",
      content: `# TempleOS

TempleOS (formerly *J Operating System*, *LoseThos*, and *SparrowOS*) is a Biblical-themed lightweight operating system designed to be the Third Temple from the Hebrew Bible. It was created by American computer programmer Terry A. Davis, who developed it alone over the course of a decade.

The system was characterized as a modern x86-64 Commodore 64, using an interface similar to a mixture of DOS and Turbo C. Davis proclaimed that the system's features, such as its 640x480 resolution, 16-color display, and single-voice audio, were designed according to explicit instructions from God.

## Specifications

| Field | Value |
| --- | --- |
| Developer | Terry A. Davis |
| Written in | HolyC and x86 Assembly |
| Source model | Open-source |
| Initial release | 2005 (as J Operating System); 2013 (as TempleOS) |
| Latest release | 5.03 / November 20, 2017 |
| Supported platforms | x64 |
| Kernel type | Monolithic |
| Default UI | 16-color graphics, 640x480 |
| License | Public domain |
| Official website | https://templeos.org |

## Background

Terry A. Davis was an electrical engineer from Wisconsin. He began developing TempleOS circa 1993. One of its early names was the "J Operating System" before renaming it to "LoseThos", a reference to a scene from the 1986 film *Platoon*. In 2008, Davis wrote that LoseThos was "primarily for making video games. It has no networking or Internet support. As far as I'm concerned, that would be reinventing the wheel". Another name he used was "SparrowOS" before settling on "TempleOS".

## System overview

TempleOS is a 64-bit, multi-core, **cooperative multitasking** operating system. It does not feature any preemption. All tasks must voluntarily yield. It was released into the public domain and has source code making it both libre software as well as open source software.

Key features at a glance:

- No kernel-user separation: all tasks run in ring-0 only.
- All tasks share a single address space.
- No networking or Internet support.
- Ships with an original flight simulator, compiler, and kernel.
- 640x480 resolution, 16-color display, single-voice audio.

## HolyC

HolyC (formerly *C+*), possibly a pun on *Holy See*, is a middle ground between the C and C++ programming languages with some unique differences, designed by Terry A. Davis specifically for TempleOS. It functions as both a general-purpose language for application development and a scripting language for automating tasks within TempleOS.

### Syntax and features

| Feature | C | HolyC |
| --- | --- | --- |
| Top-level execution | forbidden | allowed (acts as REPL) |
| Function address | decays implicitly | requires explicit \`&\` |
| Macros | supported | not supported |
| \`switch\` ranges | not supported | supported (\`case 0...10:\`) |
| Integer default | platform-dependent | 64-bit |
| Linker | external | none, single compilation unit |
| Inline assembly | via intrinsics | direct \`asm\` blocks |

Notable syntactic points:

1. No \`main()\` function is required. Top-level expressions run sequentially during compilation.
2. Function addresses require the explicit \`&\` operator (for example, \`&MyFunction\`).
3. \`class\` declarations define aggregate types, supporting inheritance.
4. The \`switch\` statement supports range cases (for example, \`case 0...10:\`).
5. All integer types default to 64-bit behavior on access, with explicit casting functions such as \`ToI64()\`.

\`\`\`c
class MyClass {
  I64 value;
};

MyClass *c = MAlloc(sizeof(MyClass));
c->value = 42;
"Value: %d\\n", c->value;
\`\`\`

## Critical reception

TempleOS received mostly "sympathetic" reviews. Tech journalist David Cassel opined that "programming websites tried to find the necessary patience and understanding to accommodate Davis".

> "TempleOS is a testament to the dedication and passion of one man displaying his technological prowess. It doesn't need to be anything more." -- James Sanders, TechRepublic
>
> OSNews editor Kroc Camen wrote that the OS "shows that computing can still be a hobby; why is everybody so serious these days? If I want to code an OS that uses interpretive dance as the input method, I should be allowed to do so, companies like Apple be damned."

In 2017, the OS was shown as a part of an outsider art exhibition in Bourgogne, France.

## Legacy

After Davis' death in 2018, OSNews editor Thom Holwerda wrote:

> "Davis was clearly a gifted programmer - writing an entire operating system is no small feat - and it was sad to see him affected by his mental illness."

A computer engineer compared the development of TempleOS to a one-man-built skyscraper, adding that it "actually boggles my mind that one man wrote all that".

## See also

- Creativity and mental health
- Biblical software
- Religion and video games

## References

1. Hicks, Jesse (November 25, 2014). "God's Lonely Programmer". VICE Motherboard.
2. Cassel, David (September 23, 2018). "The Troubled Legacy of Terry Davis, 'God's Lonely Programmer'". The New Stack.
3. Davis, Terry A. (2008). "The LoseThos IBM PC Operating System". LoseThos. Archived from the original on December 16, 2008.
4. Sanders, James (January 21, 2014). "TempleOS: an educational tool for programming experiments". TechRepublic.

---

*Source: Wikipedia, "TempleOS". Text is available under the Creative Commons Attribution-ShareAlike 4.0 License. Included in this fixture as test content only.*
`,
      stripped_content:
        "TempleOS is a Biblical-themed 64-bit operating system written by Terry A. Davis in HolyC, released into the public domain. Last release was 5.03 in November 2017.",
      author_id: userId,
      updated_at: ago(1),
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
        shelf_ids: [],
      },
      {
        id: dirWorkId,
        display_name: "Work",
        slug: "work",
        parent_dir_ids: [dirRootId],
        child_dir_ids: [],
        child_note_ids: workNotes.map((n) => n.id),
        shelf_ids: ["shelf-research"],
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
