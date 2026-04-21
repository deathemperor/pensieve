// src/lib/hol/queries.ts
//
// All read queries against HOL_DB. Each function is a thin wrapper over
// a prepared statement so that consuming Astro routes don't write SQL.
import type { Forum, PageParams, Post, SearchHit, Thread } from "./types";

export async function listForums(db: D1Database): Promise<Forum[]> {
  // Hide sentinel forum id=0 "(forum unknown)" from public listing.
  const { results } = await db.prepare(`
    SELECT
      f.id, f.name, f.description,
      (SELECT COUNT(*) FROM threads t WHERE t.forum_id = f.id) as thread_count,
      (SELECT COUNT(*) FROM posts p JOIN threads t ON t.id = p.thread_id
         WHERE t.forum_id = f.id) as post_count
    FROM forums f
    WHERE f.id != 0
    ORDER BY post_count DESC, f.name ASC
  `).all<Forum>();
  return results ?? [];
}

export async function getForum(db: D1Database, id: number): Promise<Forum | null> {
  const row = await db.prepare(
    "SELECT id, name, description FROM forums WHERE id = ?",
  ).bind(id).first<Forum>();
  return row ?? null;
}

export async function listThreadsInForum(
  db: D1Database,
  forumId: number,
  { page, pageSize }: PageParams,
): Promise<Thread[]> {
  const offset = (page - 1) * pageSize;
  const { results } = await db.prepare(`
    SELECT
      t.id, t.forum_id, t.title, t.title_slug,
      t.created_at, t.last_post_at, t.view_count, t.reply_count,
      t.is_sticky, t.is_locked,
      (SELECT COUNT(*) FROM posts p WHERE p.thread_id = t.id) as post_count
    FROM threads t
    WHERE t.forum_id = ? AND t.is_hidden = 0
    ORDER BY t.is_sticky DESC,
             COALESCE(t.last_post_at, 0) DESC,
             t.id DESC
    LIMIT ? OFFSET ?
  `).bind(forumId, pageSize, offset).all<Thread>();
  return results ?? [];
}

export async function countThreadsInForum(
  db: D1Database,
  forumId: number,
): Promise<number> {
  const row = await db.prepare(
    "SELECT COUNT(*) as n FROM threads WHERE forum_id = ? AND is_hidden = 0",
  ).bind(forumId).first<{ n: number }>();
  return row?.n ?? 0;
}

export async function getThread(
  db: D1Database,
  id: number,
): Promise<Thread | null> {
  const row = await db.prepare(`
    SELECT id, forum_id, title, title_slug,
           created_at, last_post_at, view_count, reply_count,
           is_sticky, is_locked
    FROM threads WHERE id = ? AND is_hidden = 0
  `).bind(id).first<Thread>();
  return row ?? null;
}

export async function getThreadPosts(
  db: D1Database,
  threadId: number,
  { page, pageSize }: PageParams,
): Promise<Post[]> {
  const offset = (page - 1) * pageSize;
  const { results } = await db.prepare(`
    SELECT id, thread_id, page_num, position_in_thread,
           author_user_id, author_username, posted_at,
           body_html, body_text,
           has_broken_images, is_partial
    FROM posts
    WHERE thread_id = ? AND is_hidden = 0
    ORDER BY position_in_thread ASC
    LIMIT ? OFFSET ?
  `).bind(threadId, pageSize, offset).all<Post>();
  return results ?? [];
}

export async function countPostsInThread(
  db: D1Database,
  threadId: number,
): Promise<number> {
  const row = await db.prepare(
    "SELECT COUNT(*) as n FROM posts WHERE thread_id = ? AND is_hidden = 0",
  ).bind(threadId).first<{ n: number }>();
  return row?.n ?? 0;
}

export async function searchPosts(
  db: D1Database,
  query: string,
  limit = 30,
): Promise<SearchHit[]> {
  if (!query.trim()) return [];

  // Author-name matches first (small, curated set — surface any post by a
  // member whose handle contains the query). These rank above body-text
  // matches so "deathemperor" surfaces his posts before posts about him.
  const authorLike = `%${query}%`;
  const { results: byAuthor } = await db.prepare(`
    SELECT
      p.id as post_id,
      p.thread_id,
      t.title as thread_title,
      t.title_slug as thread_slug,
      t.forum_id,
      p.author_username,
      p.posted_at,
      'Posted by ' || p.author_username as snippet
    FROM posts p
    JOIN threads t ON t.id = p.thread_id
    WHERE p.author_username LIKE ? COLLATE NOCASE
      AND p.is_hidden = 0 AND t.is_hidden = 0
    ORDER BY p.posted_at DESC
    LIMIT ?
  `).bind(authorLike, Math.min(limit, 10)).all<SearchHit>();

  const { results: byBody } = await db.prepare(`
    SELECT
      p.id as post_id,
      p.thread_id,
      t.title as thread_title,
      t.title_slug as thread_slug,
      t.forum_id,
      p.author_username,
      p.posted_at,
      snippet(posts_fts, 0, '<mark>', '</mark>', '…', 20) as snippet
    FROM posts_fts
    JOIN posts p ON p.id = posts_fts.rowid
    JOIN threads t ON t.id = p.thread_id
    WHERE posts_fts MATCH ?
      AND p.is_hidden = 0 AND t.is_hidden = 0
    ORDER BY rank
    LIMIT ?
  `).bind(query, limit).all<SearchHit>();

  // Dedup — if a post matched both an author search and a body search,
  // keep the author version (it ranked higher by intent).
  const seen = new Set<number>();
  const merged: SearchHit[] = [];
  for (const r of [...(byAuthor ?? []), ...(byBody ?? [])]) {
    if (seen.has(r.post_id)) continue;
    seen.add(r.post_id);
    merged.push(r);
    if (merged.length >= limit) break;
  }
  return merged;
}
