// Google Drive v3 client. Uses the same refresh token as Phase 8 Google
// Contacts sync (KV key: portraits:integration:google:refresh). Requires the
// token to have been issued with `drive.readonly` scope.

import type { KVNamespace } from "@cloudflare/workers-types";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  modifiedTime: string;
  size?: string;
}

export type DriveResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function getAccessToken(
  kv: KVNamespace,
  clientId: string,
  clientSecret: string,
): Promise<DriveResult<string>> {
  const refresh = await kv.get("portraits:integration:google:refresh");
  if (!refresh) return { ok: false, error: "not_connected" };

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { ok: false, error: `refresh_failed_${res.status}: ${txt.slice(0, 300)}` };
  }
  const body = await res.json() as { access_token?: string };
  if (!body.access_token) return { ok: false, error: "no_access_token" };
  return { ok: true, value: body.access_token };
}

export async function listImageFilesInFolder(
  accessToken: string,
  folderId: string,
  maxFiles = 500,
): Promise<DriveResult<DriveFile[]>> {
  const q =
    `'${folderId}' in parents and trashed = false and (` +
    `mimeType = 'image/jpeg' or mimeType = 'image/png' or mimeType = 'image/webp' or mimeType = 'image/heic' or mimeType = 'image/heif')`;

  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 20; i++) {
    const params = new URLSearchParams({
      q,
      fields: "files(id,name,mimeType,createdTime,modifiedTime,size),nextPageToken",
      pageSize: "200",
      orderBy: "createdTime desc",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `drive_list_${res.status}: ${txt.slice(0, 300)}` };
    }
    const body = await res.json() as { files?: DriveFile[]; nextPageToken?: string };
    if (body.files) out.push(...body.files);
    if (out.length >= maxFiles) { out.length = maxFiles; break; }
    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }
  return { ok: true, value: out };
}

export async function downloadFile(
  accessToken: string,
  fileId: string,
): Promise<DriveResult<{ bytes: Uint8Array; mimeType: string }>> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { ok: false, error: `drive_get_${res.status}: ${txt.slice(0, 300)}` };
  }
  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg";
  const buf = await res.arrayBuffer();
  return { ok: true, value: { bytes: new Uint8Array(buf), mimeType } };
}

export function parseFolderId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return s;
  return null;
}
