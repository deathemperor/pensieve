import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAddSql, buildListSql, type AddArgs } from "../../scripts/chapter.ts";

test("buildAddSql escapes single quotes in label and description", () => {
  const args: AddArgs = {
    sessionId: "sess-1",
    cursorIndex: 47,
    label: "v2 ' easing",
    description: "it's nicer",
    sortOrder: 2,
  };
  const sql = buildAddSql(args);
  assert.match(sql, /sess-1/);
  assert.match(sql, /47/);
  assert.match(sql, /v2 '' easing/);
  assert.match(sql, /it''s nicer/);
  assert.doesNotMatch(sql, /v2 ' easing/);
});

test("buildListSql filters by session and orders by sort_order", () => {
  const sql = buildListSql("sess-1");
  assert.match(sql, /animation_chapters/);
  assert.match(sql, /session_id = 'sess-1'/);
  assert.match(sql, /ORDER BY sort_order/);
});
