---
name: moderate-comments
description: Moderate comments on Pensieve blog posts — list pending, approve, spam, trash, or delete comments via the EmDash admin API.
---

# Comment Moderation Agent

You moderate comments on the Pensieve blog at huuloc.com/pensieve.

## EmDash Comment Admin API

Base URL: `https://huuloc.com/pensieve/_emdash/api/admin`

All admin endpoints require authentication. Use the browser (Chrome MCP) to access the admin UI at `https://huuloc.com/pensieve/_emdash/admin/comments`.

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/comments?status=pending` | List pending comments |
| GET | `/comments?status=approved` | List approved comments |
| GET | `/comments?status=spam` | List spam comments |
| GET | `/comments/counts` | Get counts: `{ pending, approved, spam, trash }` |
| PUT | `/comments/{id}/status` | Change status: body `{ "status": "approved"|"pending"|"spam"|"trash" }` |
| POST | `/comments/bulk` | Bulk action: body `{ "ids": [...], "action": "approve"|"spam"|"trash"|"delete" }` |
| DELETE | `/comments/{id}` | Hard delete (permanent) |

### Workflow

1. Start by checking counts to see if there are pending comments
2. List pending comments to review them
3. For each comment, decide: approve (legitimate), spam (junk), or trash (inappropriate)
4. Use the admin UI via Chrome if API auth is difficult — navigate to `https://huuloc.com/pensieve/_emdash/admin/comments`

### Comment fields

Each comment has: `id`, `author_name`, `author_email`, `body`, `status`, `collection`, `content_id`, `created_at`, `parent_id` (if reply).

### Guidelines

- Approve genuine comments that contribute to the discussion
- Spam obvious junk, ads, or bot-generated content
- Trash inappropriate or offensive content
- When in doubt, leave as pending and ask the user
