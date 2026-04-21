// src/lib/hol/types.ts
export type Forum = {
  id: number;
  name: string;
  description: string | null;
  thread_count?: number;
  post_count?: number;
};

export type Thread = {
  id: number;
  forum_id: number;
  title: string;
  title_slug: string;
  created_at: number | null;
  last_post_at: number | null;
  view_count: number | null;
  reply_count: number | null;
  is_sticky: boolean;
  is_locked: boolean;
  post_count?: number;
};

export type Post = {
  id: number;
  thread_id: number;
  page_num: number;
  position_in_thread: number;
  author_user_id: number | null;
  author_username: string | null;
  posted_at: number | null;
  body_html: string;
  body_text: string;
  has_broken_images: boolean;
  is_partial: boolean;
};

export type SearchHit = {
  post_id: number;
  thread_id: number;
  thread_title: string;
  thread_slug: string;
  forum_id: number;
  author_username: string | null;
  posted_at: number | null;
  snippet: string;
};

export type PageParams = { page: number; pageSize: number };
