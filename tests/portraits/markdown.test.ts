import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "../../src/lib/portraits/markdown";

test("renderMarkdown: basic formatting", () => {
  const html = renderMarkdown("Hello **world**");
  assert.ok(html.includes("<strong>world</strong>"));
});

test("renderMarkdown: strips script tags", () => {
  const html = renderMarkdown("hi <script>alert(1)</script>");
  assert.ok(!html.includes("<script>"));
});

test("renderMarkdown: strips onclick handlers", () => {
  const html = renderMarkdown("[x](javascript:alert(1))");
  assert.ok(!html.includes("javascript:"));
});

test("renderMarkdown: empty input", () => {
  assert.equal(renderMarkdown(""), "");
});
