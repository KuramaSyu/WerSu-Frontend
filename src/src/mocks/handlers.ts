import { http, HttpResponse, delay } from "msw";
import type {
  FakeActivity,
  FakeDb,
  FakeDirectory,
  FakeNote,
  FakeShare,
  FakeShelf,
} from "./types";
import { getFakeDb } from "./types";

/**
 * MSW handlers for the Wersu frontend.
 *
 * Goals:
 *  - Cover every endpoint the production code currently hits so a
 *    user can click around the UI with the real backend stopped.
 *  - Keep fixtures editable: PATCH/POST/DELETE mutate the in-memory
 *    `db` so the next GET reflects the change.
 *  - Stay responsive: a tiny `delay()` simulates realistic latency
 *    for loading states.
 *
 * Path matching notes:
 *  - All paths are written as `<any-host>/api/...` so they match both
 *    same-origin (`/api/notes/1`) and cross-origin
 *    (`https://backend.example.com/api/notes/1`) requests.
 */

let nextNoteSeq = 100;
let nextDirSeq = 100;

const json = (body: unknown, init?: ResponseInit) =>
  HttpResponse.json(body, init);

const notFound = (msg: string) => json({ error: msg }, { status: 404 });

const okNoContent = () => new HttpResponse(null, { status: 204 });

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Convert seeded `FakeActivity` rows into the production
 * `NoteVersionSummaryReply` shape. Each `note_viewed` / `note_edited`
 * event becomes one synthetic version entry with a stable
 * `version_index` derived from its position in the input list.
 */
function synthesizeNoteVersionSummaries(events: FakeActivity[]) {
  let versionCounter = 1;
  return events.map((a) => ({
    author_id: a.actor_id,
    created_at: a.at,
    is_snapshot: a.action === "note_edited",
    note_id: a.note_id,
    snapshot_id: a.action === "note_edited" ? a.id : "",
    version_id: a.id,
    version_index: versionCounter++,
  }));
}

function noteWireShape(db: FakeDb, n: FakeNote) {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    stripped_content: n.stripped_content,
    author_id: n.author_id,
    updated_at: n.updated_at,
    directory_ids: n.directory_ids,
    tag_ids: n.tag_ids,
    attachment_ids: n.attachment_ids,
    permissions: [],
  };
}

function directoryWireShape(d: FakeDirectory) {
  return {
    id: d.id,
    name: d.display_name,
    display_name: d.display_name,
    slug: d.slug,
    description: d.description ?? "",
    parent_dir_ids: d.parent_dir_ids,
    child_dir_ids: d.child_dir_ids,
    child_note_ids: d.child_note_ids,
    relationships: [],
  };
}

export const handlers = [
  // ───────────────────────── auth / user ─────────────────────────

  http.post("*/api/auth/access-token", async () => {
    await delay(50);
    return json({ token: getFakeDb().accessToken });
  }),

  http.post("*/api/auth/refresh", async () => {
    await delay(50);
    return json({ token: getFakeDb().accessToken });
  }),

  /**
   * `fetchUser()` reads `GET /api/auth/user` (singular). Returns a
   * `WersuUser`-shaped payload so the Zustand user store and the
   * topbar avatar render correctly in fake mode.
   */
  http.get("*/api/auth/user", async () => {
    await delay(50);
    const db = getFakeDb();
    const u = db.users.find((x) => x.id === db.currentUserId);
    return u ? json(u) : notFound("not authenticated");
  }),

  http.post("*/api/auth/users", async () => {
    await delay(50);
    return json(getFakeDb().users);
  }),

  http.post("*/api/auth/logout", async () => okNoContent()),

  // ─────────────────────────── status ───────────────────────────

  /**
   * `getStatus()` expects a `StatusResponse` whose top-level keys
   * are the named services (`wersu`, `garage`, `spicedb`,
   * `imgproxy`, `postgres`). Each value is a full `ServiceStatus`
   * with `dns`/`service` checks that include `latency_ms`. We pick
   * five entries from the fake services array in that order.
   */
  http.get("*/api/status", async () => {
    await delay(80);
    const db = getFakeDb();
    const [wersu, garage, spicedb, imgproxy, postgres] = db.services;
    return json({
      overall_ok: db.services.every((s) => s.reachable),
      wersu,
      garage: garage ?? wersu,
      spicedb: spicedb ?? wersu,
      imgproxy: imgproxy ?? wersu,
      postgres: postgres ?? wersu,
      checked_at: nowIso(),
    });
  }),

  // ─────────────────────────── notes ────────────────────────────

  http.get("*/api/notes", async () => {
    await delay(80);
    const db = getFakeDb();
    return json(db.notes.map((n) => noteWireShape(db, n)));
  }),

  http.get("*/api/notes/:id", async ({ params }) => {
    await delay(50);
    const db = getFakeDb();
    const note = db.notes.find((n) => n.id === params.id);
    return note ? json(noteWireShape(db, note)) : notFound("note not found");
  }),

  http.post("*/api/notes", async ({ request }) => {
    await delay(80);
    const db = getFakeDb();
    const body = (await request.json()) as {
      title?: string;
      content?: string;
    };
    const id = `note-${nextNoteSeq++}`;
    const note: FakeNote = {
      id,
      title: body.title ?? "Untitled",
      content: body.content ?? "",
      stripped_content: body.content ?? "",
      author_id: db.currentUserId,
      updated_at: nowIso(),
      directory_ids: [],
      tag_ids: [],
      attachment_ids: [],
    };
    db.notes.push(note);
    return json(noteWireShape(db, note), { status: 201 });
  }),

  /**
   * `NoteApi.patch()` sends `PATCH /api/notes` (no `:id` segment) with
   * the target id plus the patch fields in the body. Body shape:
   *   `{ id: string; title?: string; content?: string;
   *      directory_ids?: string[]; tag_ids?: string[] }`
   */
  http.patch("*/api/notes", async ({ request }) => {
    await delay(80);
    const db = getFakeDb();
    const patch = (await request.json()) as Partial<FakeNote> & { id?: string };
    const id = patch.id;
    if (!id) return notFound("note id missing in body");
    const idx = db.notes.findIndex((n) => n.id === id);
    if (idx < 0) return notFound("note not found");
    const { id: _ignored, ...fields } = patch;
    const merged: FakeNote = {
      ...db.notes[idx],
      ...fields,
      updated_at: nowIso(),
      stripped_content: fields.content ?? db.notes[idx].stripped_content,
    };
    db.notes[idx] = merged;
    return json(noteWireShape(db, merged));
  }),

  http.delete("*/api/notes/:id", async ({ params }) => {
    await delay(80);
    const db = getFakeDb();
    const before = db.notes.length;
    db.notes = db.notes.filter((n) => n.id !== params.id);
    return db.notes.length < before
      ? okNoContent()
      : notFound("note not found");
  }),

  // ───────────────────────── directories ─────────────────────────

  http.get("*/api/directories", async ({ request }) => {
    await delay(80);
    const db = getFakeDb();
    const url = new URL(request.url);
    const parentId = url.searchParams.get("parent_id") ?? undefined;
    const list = parentId
      ? db.directories.filter((d) => d.parent_dir_ids.includes(parentId))
      : db.directories;
    return json(list.map(directoryWireShape));
  }),

  http.get("*/api/directories/:id", async ({ params }) => {
    await delay(50);
    const db = getFakeDb();
    const d = db.directories.find((x) => x.id === params.id);
    return d ? json(directoryWireShape(d)) : notFound("directory not found");
  }),

  http.get("*/api/directories/:id/notes", async ({ params }) => {
    await delay(80);
    const db = getFakeDb();
    const dir = db.directories.find((d) => d.id === params.id);
    if (!dir) return notFound("directory not found");
    const notes = db.notes.filter((n) => n.directory_ids.includes(dir.id));
    return json({
      notes: notes.map((n) => noteWireShape(db, n)),
      directories: [],
      tags: [],
    });
  }),

  http.post("*/api/directories", async ({ request }) => {
    await delay(80);
    const db = getFakeDb();
    const body = (await request.json()) as {
      name?: string;
      display_name?: string;
      parent_ids?: string[];
    };
    const id = `dir-${nextDirSeq++}`;
    const dir: FakeDirectory = {
      id,
      display_name: body.display_name ?? body.name ?? "New",
      slug: (body.display_name ?? body.name ?? "new").toLowerCase(),
      parent_dir_ids: body.parent_ids ?? [],
      child_dir_ids: [],
      child_note_ids: [],
    };
    db.directories.push(dir);
    for (const pid of dir.parent_dir_ids) {
      const p = db.directories.find((x) => x.id === pid);
      if (p) p.child_dir_ids.push(id);
    }
    return json(directoryWireShape(dir), { status: 201 });
  }),

  http.patch("*/api/directories/:id", async ({ params, request }) => {
    await delay(80);
    const db = getFakeDb();
    const idx = db.directories.findIndex((d) => d.id === params.id);
    if (idx < 0) return notFound("directory not found");
    const patch = (await request.json()) as Partial<FakeDirectory>;
    db.directories[idx] = { ...db.directories[idx], ...patch };
    return json(directoryWireShape(db.directories[idx]));
  }),

  http.delete("*/api/directories/:id", async ({ params }) => {
    await delay(80);
    const db = getFakeDb();
    const before = db.directories.length;
    db.directories = db.directories.filter((d) => d.id !== params.id);
    return db.directories.length < before
      ? okNoContent()
      : notFound("directory not found");
  }),

  // ─────────────────────────── search ───────────────────────────

  /**
   * Mirrors `SearchNotesApi.search()`. The production client sends
   * `GET /api/notes/search?search_type=...&query=...&include_*=...`
   * with CSV-style repeated keys for id lists. We filter the seeded
   * `notes` array against the query and the include/exclude bags,
   * then trim each hit down to the `MinimalNote` shape (the search
   * endpoint doesn't carry `content` / `attachment_ids`).
   */
  http.get("*/api/notes/search", async ({ request }) => {
    await delay(80);
    const db = getFakeDb();
    const params = new URL(request.url).searchParams;

    const query = (params.get("query") ?? "").toLowerCase();
    const searchType = params.get("search_type") ?? "keyword";

    const includeDirs = params.getAll("include_directory_ids");
    const excludeDirs = params.getAll("exclude_directory_ids");
    const includeTags = params.getAll("include_tag_ids");
    const excludeTags = params.getAll("exclude_tag_ids");
    const includeShelves = params.getAll("include_shelf_ids");
    const excludeShelves = params.getAll("exclude_shelf_ids");

    const dateFrom = params.get("date_from");
    const dateUntil = params.get("date_until");

    const limit = Number(params.get("limit") ?? "50");
    const offset = Number(params.get("offset") ?? "0");

    const matches = db.notes.filter((n) => {
      // `search_type=latest` skips the text match and just returns
      // the most recent. Other modes do a case-insensitive substring
      // match on title + stripped_content.
      if (searchType === "latest") return true;
      if (query === "") return true;
      return (
        n.title.toLowerCase().includes(query) ||
        n.stripped_content.toLowerCase().includes(query)
      );
    });

    const filtered = matches.filter((n) => {
      if (includeDirs.length > 0) {
        if (!n.directory_ids.some((d) => includeDirs.includes(d))) return false;
      }
      if (excludeDirs.length > 0) {
        if (n.directory_ids.some((d) => excludeDirs.includes(d))) return false;
      }
      if (includeTags.length > 0) {
        if (!n.tag_ids.some((t) => includeTags.includes(t))) return false;
      }
      if (excludeTags.length > 0) {
        if (n.tag_ids.some((t) => excludeTags.includes(t))) return false;
      }
      // Shelves aren't modelled in fixtures; treat empty as "no filter"
      // and non-empty as "match none" so callers don't see surprise hits.
      if (includeShelves.length > 0) return false;
      if (excludeShelves.length > 0) return false;
      if (dateFrom && n.updated_at < dateFrom) return false;
      if (dateUntil && n.updated_at > dateUntil) return false;
      return true;
    });

    // `latest` -> recency desc; everything else keeps insertion order.
    if (searchType === "latest") {
      filtered.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }

    const page = filtered.slice(offset, offset + limit).map((n) => ({
      id: n.id,
      title: n.title,
      author_id: n.author_id,
      updated_at: n.updated_at,
      stripped_content: n.stripped_content,
      directory_ids: n.directory_ids,
      tag_ids: n.tag_ids,
    }));

    return json({
      notes: page,
      directories: db.directories.map((d) => ({
        id: d.id,
        display_name: d.display_name,
        slug: d.slug,
      })),
      tags: db.tags.map((t) => ({
        id: t.id,
        display_name: t.display_name,
        slug: t.slug,
      })),
    });
  }),

  // ─────────────────────────── shelves ───────────────────────────

  /**
   * Mirrors `GET /api/shelves`. Reads from the in-memory db and
   * honours `limit` / `offset` / `include_books` so the production
   * client gets back the same shape it expects from the real
   * backend. `include_books=true` already populates `book_ids` on
   * every row in the fixture, so no extra work is needed here.
   */
  http.get("*/api/shelves", async ({ request }) => {
    await delay(50);
    const db = getFakeDb();
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const page = db.shelves.slice(offset, offset + limit);
    return json(page);
  }),

  http.get("*/api/shelves/:id", async ({ params }) => {
    await delay(50);
    const db = getFakeDb();
    const shelf = db.shelves.find((s) => s.id === params.id);
    return shelf ? json(shelf) : notFound("shelf not found");
  }),

  http.get("*/api/shelves/:id/books", async ({ params }) => {
    await delay(50);
    const db = getFakeDb();
    const shelf = db.shelves.find((s) => s.id === params.id);
    return shelf
      ? json({ book_ids: shelf.book_ids })
      : notFound("shelf not found");
  }),

  http.post("*/api/shelves", async ({ request }) => {
    await delay(80);
    const db = getFakeDb();
    const body = (await request.json()) as Partial<FakeShelf>;
    if (!body.slug) {
      return json({ error: "slug required" }, { status: 400 });
    }
    const shelf: FakeShelf = {
      id: `shelf-${db.shelves.length + 1}`,
      slug: body.slug,
      display_name: body.display_name ?? body.slug,
      description: body.description,
      image_url: body.image_url,
      readme_note_id: body.readme_note_id,
      book_ids: body.book_ids ?? [],
    };
    db.shelves.push(shelf);
    return json({ shelf }, { status: 201 });
  }),

  http.patch("*/api/shelves", async ({ request }) => {
    await delay(80);
    const db = getFakeDb();
    const body = (await request.json()) as Partial<FakeShelf> & { id: string };
    const idx = db.shelves.findIndex((s) => s.id === body.id);
    if (idx === -1) return notFound("shelf not found");
    db.shelves[idx] = { ...db.shelves[idx], ...body };
    return json(db.shelves[idx]);
  }),

  http.delete("*/api/shelves", async ({ request }) => {
    await delay(80);
    const db = getFakeDb();
    const body = (await request.json()) as { id: string; dry?: boolean };
    const shelf = db.shelves.find((s) => s.id === body.id);
    if (!shelf) return notFound("shelf not found");
    const affected = [...shelf.book_ids];
    const binding_count = affected.length;
    if (!body.dry) {
      db.shelves = db.shelves.filter((s) => s.id !== body.id);
    }
    return json({ affected_book_ids: affected, binding_count, dry: body.dry });
  }),

  // ─────────────────────────── shares ───────────────────────────

  http.get("*/api/shares", async () => {
    await delay(50);
    const db = getFakeDb();
    return json({ shares: db.shares });
  }),

  http.post("*/api/shares", async ({ request }) => {
    await delay(80);
    const db = getFakeDb();
    const body = (await request.json()) as Partial<FakeShare>;
    const share: FakeShare = {
      id: `share-${db.shares.length + 1}`,
      note_id: body.note_id ?? "",
      permission: body.permission ?? "read",
      created_at: nowIso(),
    };
    db.shares.push(share);
    return json(share, { status: 201 });
  }),

  http.delete("*/api/shares/:id", async ({ params }) => {
    await delay(80);
    const db = getFakeDb();
    const before = db.shares.length;
    db.shares = db.shares.filter((s) => s.id !== params.id);
    return db.shares.length < before
      ? okNoContent()
      : notFound("share not found");
  }),

  http.post("*/api/auth/public-access-token", async () => {
    await delay(50);
    return json({ token: "fake-share-jwt" });
  }),

  // ─────────────────────── history / activity ─────────────────────

  /**
   * Returns the seeded activity stream filtered by `mode`.
   * `mode=history` -> the raw log (used by "last used" and "recent
   * activity"). `mode=most_used` -> `(note_id, score)` aggregated
   * from the log (used by "frequently used").
   *
   * Honors the production-side filter params the panels send:
   *   - `actions` (CSV / repeated): include only these action kinds
   *   - `days` (int): include only events newer than `now - days`
   *   - `note_id` / `directory_id` / `actor_id` / `role_id`: scope
   *   - `limit` / `offset`: pagination
   *
   * `metadata_json` is populated with the note title/description so
   * `extractNoteMetadata` in HistoryRowFeatures lifts useful labels
   * onto each row instead of returning empty strings.
   */
  http.get("*/api/history", async ({ request }) => {
    await delay(60);
    const db = getFakeDb();
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") ?? "history";
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const offset = Number(url.searchParams.get("offset") ?? "0");

    const allowedActions = url.searchParams.getAll("actions");
    const days = Number(url.searchParams.get("days") ?? "0");
    const cutoffMs = days > 0 ? Date.now() - days * 24 * 60 * 60 * 1000 : 0;
    const noteId = url.searchParams.get("note_id");
    const dirId = url.searchParams.get("directory_id");
    const actorId = url.searchParams.get("actor_id");
    const roleId = url.searchParams.get("role_id");

    /**
     * Helper to enrich a FakeActivity with a metadata_json payload
     * the panels can read for title/description. Mirrors the keys
     * `parseRowMetadata` in HistoryRowFeatures looks for: `note_name`,
     * `note_title`, `note_content`. Without this, `extractNoteMetadata`
     * returns empty strings and rows render with the variant label
     * only — useful but no title.
     */
    const withMetadata = (a: FakeActivity) => {
      const note = db.notes.find((n) => n.id === a.note_id);
      const metadata: Record<string, string> = {};
      if (note) {
        metadata.note_name = note.title;
        metadata.note_title = note.title;
        metadata.note_content = note.stripped_content;
      }
      return {
        ...a,
        metadata_json: JSON.stringify(metadata),
      };
    };

    const passesFilters = (a: FakeActivity) => {
      if (allowedActions.length > 0 && !allowedActions.includes(a.action)) {
        return false;
      }
      if (days > 0 && new Date(a.at).getTime() < cutoffMs) {
        return false;
      }
      if (noteId && a.note_id !== noteId) return false;
      if (dirId && a.directory_id !== dirId) return false;
      if (actorId && a.actor_id !== actorId) return false;
      if (roleId && a.role_id !== roleId) return false;
      return true;
    };

    if (mode === "most_used") {
      const counts = new Map<string, number>();
      for (const a of db.activity) {
        if (!passesFilters(a)) continue;
        if (!a.note_id) continue;
        counts.set(a.note_id, (counts.get(a.note_id) ?? 0) + 1);
      }
      const scored = [...counts.entries()].map(([note_id, score]) => {
        const note = db.notes.find((n) => n.id === note_id);
        return {
          note_id,
          score,
          title: note?.title,
          stripped_content: note?.stripped_content,
        };
      });
      scored.sort((a, b) => b.score - a.score);
      return json(scored.slice(offset, offset + limit));
    }

    // Default: history stream, newest first, after filters.
    const filtered = db.activity.filter(passesFilters);
    const sorted = [...filtered]
      .sort((a, b) => b.at.localeCompare(a.at))
      .map(withMetadata);
    return json(sorted.slice(offset, offset + limit));
  }),

  /**
   * Top-level activity stream. Mirrors the production
   * `ActivityApi.getDirectoryActivity()` shape: `NoteVersionSummaryReply[]`,
   * NOT the `ActivityReply[]` shape used by `/api/history`.
   *
   * `FolderCard` (Home > left panel) reads this to render the "last
   * modified" timestamp on each favourite directory card. We synthesize
   * one `NoteVersionSummaryReply` per seeded note_viewed event so the
   * card shows a realistic recency for the most recently touched note.
   */
  http.get("*/api/directories/activity", async ({ request }) => {
    await delay(60);
    const db = getFakeDb();
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const summary = synthesizeNoteVersionSummaries(db.activity);
    const sorted = [...summary].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    return json(sorted.slice(offset, offset + limit));
  }),

  /**
   * Per-directory activity stream. Mirrors the production
   * `ActivityApi.getDirectoryActivityById(id)` shape:
   * `NoteVersionSummaryReply[]`. Filters to events for notes that
   * live in the given directory.
   */
  http.get("*/api/directories/:id/activity", async ({ params, request }) => {
    await delay(60);
    const db = getFakeDb();
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const dir = db.directories.find((d) => d.id === params.id);
    if (!dir) return notFound("directory not found");

    const noteIdsInDir = new Set(
      db.notes.filter((n) => n.directory_ids.includes(dir.id)).map((n) => n.id),
    );
    const events = db.activity.filter((a) => noteIdsInDir.has(a.note_id));
    const summary = synthesizeNoteVersionSummaries(events);
    const sorted = [...summary].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    return json(sorted.slice(offset, offset + limit));
  }),

  /**
   * Per-note version summaries. Mirrors the production
   * `ActivityApi.getNoteActivity(noteId)` shape. Each call returns a
   * single version summary per seeded view event for the note.
   */
  http.get("*/api/notes/:id/versions", async ({ params, request }) => {
    await delay(60);
    const db = getFakeDb();
    const note = db.notes.find((n) => n.id === params.id);
    if (!note) return notFound("note not found");
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "30");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const events = db.activity.filter(
      (a) => a.note_id === note.id && a.action !== "note_deleted",
    );
    const summary = synthesizeNoteVersionSummaries(events);
    const sorted = [...summary].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    return json(sorted.slice(offset, offset + limit));
  }),

  // ──────────────────────── everything else ─────────────────────

  /**
   * Catch-all: any `/api/*` not matched above returns a 501 so the
   * UI surfaces "not implemented in fake mode" instead of silently
   * passing through to the network (which yields the noisy
   * `TypeError: NetworkError when attempting to fetch resource`
   * the service worker logs when the real backend is down).
   */
  http.all("*/api/*", async ({ request }) => {
    return json(
      {
        error: "not_implemented_in_fake_mode",
        detail: `[msw] no handler for ${request.method} ${new URL(request.url).pathname}`,
      },
      { status: 501 },
    );
  }),
];
