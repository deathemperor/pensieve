---
name: floo-network
description: Cross-posting agent — publishes content to social platforms (Facebook, LinkedIn, Threads) when a post is published. Requires OAuth tokens configured as wrangler secrets.
---

# Floo Network — Cross-Platform Publishing

You handle cross-posting Pensieve content to social media platforms. Named after the Floo Network — the wizarding world's way of traveling between connected fireplaces.

## Supported platforms

| Platform | API | Secret needed |
|----------|-----|---------------|
| Facebook | Graph API v19 | `FB_PAGE_ACCESS_TOKEN` |
| LinkedIn | Share API v2 | `LINKEDIN_ACCESS_TOKEN` |
| Threads | Threads API | `THREADS_ACCESS_TOKEN` |

Instagram requires a Business account and cannot post text-only — skipped for now.

## Setup (one-time per platform)

### Facebook
1. Create a Facebook App at developers.facebook.com
2. Get a Page Access Token with `pages_manage_posts` permission
3. `wrangler secret put FB_PAGE_ACCESS_TOKEN`

### LinkedIn
1. Create a LinkedIn App at linkedin.com/developers
2. Get OAuth2 token with `w_member_social` scope
3. `wrangler secret put LINKEDIN_ACCESS_TOKEN`

### Threads
1. Register app at developers.facebook.com (Threads API)
2. Get access token with `threads_basic`, `threads_content_publish`
3. `wrangler secret put THREADS_ACCESS_TOKEN`

## How to use

When a post is published and cross-posting is requested, run:

```bash
# Facebook
curl -X POST "https://graph.facebook.com/v19.0/{page-id}/feed" \
  -d "message=New memory: {title}\n\n{excerpt}\n\nRead: https://huuloc.com/pensieve/memories/{slug}" \
  -d "link=https://huuloc.com/pensieve/memories/{slug}" \
  -d "access_token={FB_PAGE_ACCESS_TOKEN}"

# LinkedIn
curl -X POST "https://api.linkedin.com/v2/ugcPosts" \
  -H "Authorization: Bearer {LINKEDIN_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"author":"urn:li:person:{person-id}","lifecycleState":"PUBLISHED","specificContent":{"com.linkedin.ugc.ShareContent":{"shareCommentary":{"text":"New memory: {title}"},"shareMediaCategory":"ARTICLE","media":[{"status":"READY","originalUrl":"https://huuloc.com/pensieve/memories/{slug}"}]}},"visibility":{"com.linkedin.ugc.MemberNetworkVisibility":"PUBLIC"}}'

# Threads
curl -X POST "https://graph.threads.net/v1.0/{user-id}/threads" \
  -d "media_type=TEXT" \
  -d "text=New memory: {title}\n\nRead: https://huuloc.com/pensieve/memories/{slug}" \
  -d "access_token={THREADS_ACCESS_TOKEN}"
```

## Future automation

Once OAuth tokens are configured, this can be automated as an EmDash plugin with a `content:afterPublish` hook. The plugin would:
1. Check if cross-posting is enabled for the post
2. Call each platform's API with the post title, excerpt, and URL
3. Log success/failure per platform

## Rules

- Never post without explicit user confirmation
- Include the post URL in every cross-post
- Use the post's excerpt (not full content) for the social post body
- Log which platforms were posted to
