#!/usr/bin/env -S node --import tsx
import puppeteer from "puppeteer";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

interface Args {
  url: string;
  out: string;
  width: number;
  height: number;
  waitMs: number;
}

function parseArgs(): Args {
  const [url = "", out = ""] = process.argv.slice(2);
  if (!url || !out) {
    console.error("usage: snap-animation.ts <url> <out-path> [--w 1280] [--h 720] [--wait 2000]");
    process.exit(1);
  }
  const flag = (name: string, def: number): number => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : def;
  };
  return { url, out, width: flag("w", 1280), height: flag("h", 720), waitMs: flag("wait", 2000) };
}

async function main(): Promise<void> {
  const args = parseArgs();
  await mkdir(dirname(args.out), { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: args.width, height: args.height, deviceScaleFactor: 2 });
    await page.goto(args.url, { waitUntil: "networkidle0", timeout: 10_000 });
    await new Promise((r) => setTimeout(r, args.waitMs));
    const png = await page.screenshot({ type: "png" });
    await writeFile(args.out, png);
    console.error(`snap saved: ${args.out}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("snap failed:", e);
  process.exit(2);
});
