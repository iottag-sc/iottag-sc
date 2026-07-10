#!/usr/bin/env node
// figma-watch/check.mjs — daily Figma design-drift watcher.
//
// Reads targets.txt (one Figma link per line), checks each file's version (near-free),
// and only when the version changed re-fetches the watched frames, normalizes them to a
// structural tree, and diffs against baseline/. MAJOR changes (frames added/removed/renamed,
// text copy changes, layout restructure, image swaps) produce reports/YYYY-MM-DD.md,
// a git commit+push, and a Windows toast. Cosmetic changes (colors, margins/padding,
// fonts, effects, radii, positions) are stripped during normalization so they can never alert.
//
// Run:  node --use-system-ca --env-file=.env check.mjs      (from this folder)
// Exit: 0 ok/no-change · 2 config error · 3 rate-limited (retry next run)

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(HERE);
const B = (...p) => path.join(HERE, ...p);
const log = (...a) => console.log(`[${new Date().toISOString()}]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TOKEN = process.env.FIGMA_TOKEN;
if (!TOKEN) { log("FATAL: FIGMA_TOKEN missing — put it in figma-watch/.env"); process.exit(2); }

const now = new Date();
const TODAY = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

// ---------- Figma API ----------
class RateLimited extends Error {}
async function api(pathname) {
  const r = await fetch(`https://api.figma.com${pathname}`, { headers: { "X-Figma-Token": TOKEN } });
  if (r.status === 429) throw new RateLimited(`429 on ${pathname} (retry-after ${r.headers.get("retry-after")}s)`);
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${pathname}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// Cheap change gate: /meta costs almost nothing; fall back to a depth-1 file fetch.
async function fileGate(key) {
  try {
    const j = await api(`/v1/files/${key}/meta`);
    const m = j.file ?? j;
    return { gate: `${m.version ?? ""}|${m.last_touched_at ?? m.lastModified ?? ""}`, name: m.name ?? key };
  } catch (e) {
    if (e instanceof RateLimited) throw e;
    const j = await api(`/v1/files/${key}?depth=1`);
    return { gate: `${j.version}|${j.lastModified}`, name: j.name ?? key };
  }
}

// ---------- targets ----------
async function loadTargets() {
  const raw = await readFile(B("targets.txt"), "utf8").catch(() => "");
  const targets = [];
  for (const line of raw.split(/\r?\n/)) {
    const s = line.replace(/#.*$/, "").trim();
    if (!s) continue;
    const [url, label] = s.split("|").map((x) => x.trim());
    const key = url.match(/figma\.com\/(?:design|file|board)\/([A-Za-z0-9]+)/)?.[1];
    const nid = url.match(/node-id=([0-9]+[-:][0-9]+)/)?.[1]?.replace("-", ":");
    if (!key || !nid) { log(`WARN: cannot parse target line, skipped: ${s}`); continue; }
    targets.push({ key, id: nid, label: label || nid });
  }
  return targets;
}

// ---------- normalization (this is where cosmetic changes are made invisible) ----------
// Kept: id, name, type, children order, TEXT characters, image fill refs, instance
// componentId, container width/height rounded to 8px.
// Dropped (=> never alerts): colors/solid fills, strokes, effects, corner radius,
// padding/itemSpacing, fonts/text styling, opacity, constraints, x/y positions, geometry.
const CONTAINER = new Set(["FRAME", "SECTION", "COMPONENT", "COMPONENT_SET", "INSTANCE", "GROUP"]);
const VECTORISH = new Set(["VECTOR", "BOOLEAN_OPERATION", "STAR", "LINE", "ELLIPSE", "POLYGON", "REGULAR_POLYGON"]);
function normalize(n) {
  const out = { id: n.id, name: n.name, type: n.type };
  if (n.type === "TEXT" && n.characters != null) out.text = n.characters;
  if (n.type === "INSTANCE" && n.componentId) out.cmp = n.componentId;
  const imgs = (n.fills || []).filter((f) => f.type === "IMAGE" && f.imageRef).map((f) => f.imageRef);
  if (imgs.length) out.img = imgs;
  if (CONTAINER.has(n.type) && n.absoluteBoundingBox) {
    out.w = Math.round(n.absoluteBoundingBox.width / 8) * 8;
    out.h = Math.round(n.absoluteBoundingBox.height / 8) * 8;
  }
  // Don't descend into vector internals — icon path edits are cosmetic noise.
  if (n.children?.length && !VECTORISH.has(n.type)) out.children = n.children.map(normalize);
  return out;
}

// ---------- diff ----------
const squash = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const clip = (s, n = 110) => (s.length > n ? s.slice(0, n) + "…" : s);

// Watch scope (user rule 2026-07-09): SECTIONs are the unit of detection.
// - CANVAS level: keep SECTION children only — every loose canvas node (frames like
//   "CONSTRUCTION"/"Section Title", icons, sliders, component sets, text) is ignored.
// - INSIDE a section: everything is diffed — all frames big or small, text, images.
// isPageNode is only used to ATTRIBUTE findings to their page frame (grouping + renders).
const PAGE_MIN_W = 1000, PAGE_MIN_H = 2000;
const isPageNode = (n) =>
  (n.type === "SECTION" || n.type === "FRAME") && (n.w ?? 0) >= PAGE_MIN_W && (n.h ?? 0) >= PAGE_MIN_H;
const isGallery = (n) => n.type === "CANVAS" || n.type === "SECTION";

// `sec` = nearest SECTION (grouping); `page` = nearest page-sized frame (attribution + render).
function diffNode(a, b, findings, sec, page) {
  const F = (kind, id, detail, pg) => findings.push({ kind, id, detail, sec, page: pg ?? page });
  if (a.name !== b.name)
    F("renamed", b.id, `“${a.name}” renamed to “${b.name}”`);
  if (a.type === "TEXT" && squash(a.text) !== squash(b.text))
    F("copy", b.id, `“${clip(squash(a.text))}” → “${clip(squash(b.text))}”`);
  if (JSON.stringify(a.img ?? []) !== JSON.stringify(b.img ?? []))
    F("image", b.id, `image replaced in “${b.name}”`);
  if (a.cmp && b.cmp && a.cmp !== b.cmp)
    F("image", b.id, `component/icon swapped in “${b.name}”`);
  if (a.w != null && b.w != null) {
    const dw = Math.abs(a.w - b.w) / Math.max(a.w, 1), dh = Math.abs(a.h - b.h) / Math.max(a.h, 1);
    if (dw > 0.1 || dh > 0.1)
      F("layout", b.id, `“${b.name}” resized ${a.w}×${a.h} → ${b.w}×${b.h}`);
  }
  let ac = a.children ?? [], bc = b.children ?? [];
  if (b.type === "CANVAS") { ac = ac.filter((c) => c.type === "SECTION"); bc = bc.filter((c) => c.type === "SECTION"); }
  const am = new Map(ac.map((c) => [c.id, c])), bm = new Map(bc.map((c) => [c.id, c]));
  const asPage = (c) => (isPageNode(c) && c.type !== "SECTION" ? { name: c.name, id: c.id, w: c.w, h: c.h } : undefined);
  for (const c of ac) if (!bm.has(c.id))
    F("removed", c.id, `${c.type.toLowerCase()} “${c.name}” removed from “${a.name}”`, asPage(c));
  for (const c of bc) if (!am.has(c.id))
    F("added", c.id, `new ${c.type.toLowerCase()} “${c.name}” in “${b.name}”`, asPage(c));
  const aShared = ac.filter((c) => bm.has(c.id)).map((c) => c.id);
  const bShared = bc.filter((c) => am.has(c.id)).map((c) => c.id);
  if (aShared.join("\n") !== bShared.join("\n"))
    F("layout", b.id, `children reordered in “${b.name}”`);
  const delta = Math.abs(ac.length - bc.length);
  if (delta >= 2 && delta / Math.max(ac.length, 1) >= 0.2)
    F("layout", b.id, `“${b.name}” child count ${ac.length} → ${bc.length}`);
  for (const id of aShared) {
    const c = bm.get(id);
    const childSec = b.type === "CANVAS" || c.type === "SECTION"
      ? { name: c.name, id: c.id, w: c.w, h: c.h } : sec;
    const childPage = isGallery(b) && isPageNode(c) && c.type !== "SECTION"
      ? { name: c.name, id: c.id, w: c.w, h: c.h } : page;
    diffNode(am.get(id), c, findings, childSec, childPage);
  }
}

// ---------- main ----------
const targets = await loadTargets();
if (!targets.length) { log("No targets in targets.txt — paste Figma links (one per line). Nothing to do."); process.exit(0); }

const byKey = new Map();
for (const t of targets) (byKey.get(t.key) ?? byKey.set(t.key, []).get(t.key)).push(t);

const results = []; // { target, fileName, ver, findings: [], isNew }
const gates = new Map(); // fileKey -> figma version id (for commit/report traceability)
let rateLimited = false;

for (const [key, list] of byKey) {
  const metaPath = B("baseline", `${key}.meta.json`);
  const nodeFile = (t) => B("baseline", key, `${t.id.replace(":", "_")}.json`);
  let meta = null;
  try { meta = JSON.parse(await readFile(metaPath, "utf8")); } catch {}

  let gate;
  try { gate = await fileGate(key); }
  catch (e) {
    if (e instanceof RateLimited) { log(`${key}: rate limited — will retry next run. ${e.message}`); rateLimited = true; }
    else log(`${key}: gate check failed — ${e.message}`);
    continue;
  }

  gates.set(key, gate.gate.split("|")[0]);
  const missing = list.filter((t) => !existsSync(nodeFile(t)));
  if (meta && meta.gate === gate.gate && !missing.length) {
    log(`${key} (${gate.name}): no change (version gate ${gate.gate.split("|")[0]})`);
    continue;
  }
  const toFetch = meta && meta.gate === gate.gate ? missing : list;
  log(`${key} (${gate.name}): ${meta ? `version changed — checking ${toFetch.length} frame(s)` : "first run — creating baseline"}`);

  // Fetch watched frames in small throttled batches; 429 aborts this file untouched.
  const fetched = new Map();
  try {
    for (let i = 0; i < toFetch.length; i += 4) {
      const batch = toFetch.slice(i, i + 4);
      const j = await api(`/v1/files/${key}/nodes?ids=${batch.map((t) => t.id).join(",")}`);
      for (const t of batch) fetched.set(t.id, j.nodes?.[t.id]?.document ?? null);
      if (i + 4 < toFetch.length) await sleep(2000);
    }
  } catch (e) {
    if (e instanceof RateLimited) { log(`${key}: rate limited mid-fetch — baseline untouched, retry next run. ${e.message}`); rateLimited = true; }
    else log(`${key}: node fetch failed — ${e.message}`);
    continue;
  }

  await mkdir(B("baseline", key), { recursive: true });
  for (const t of toFetch) {
    const doc = fetched.get(t.id);
    if (!doc) {
      results.push({ target: t, fileName: gate.name, findings: [{ kind: "removed", id: t.id, detail: "WATCHED FRAME NO LONGER EXISTS in the file (deleted or moved)" }] });
      continue; // keep old baseline so it re-alerts until resolved
    }
    const cur = normalize(doc);
    let base = null;
    try { base = JSON.parse(await readFile(nodeFile(t), "utf8")); } catch {}
    if (!base) {
      results.push({ target: t, fileName: gate.name, findings: [], isNew: true });
    } else {
      const findings = [];
      diffNode(base, cur, findings, { name: t.label, id: t.id, w: cur.w, h: cur.h });
      if (findings.length) results.push({ target: t, fileName: gate.name, findings });
    }
    await writeFile(nodeFile(t), JSON.stringify(cur));
  }
  await writeFile(metaPath, JSON.stringify({ gate: gate.gate, name: gate.name, checkedAt: new Date().toISOString() }, null, 1));
}

// ---------- report / renders ----------
const major = results.filter((r) => r.findings.length);
const bootstrapped = results.filter((r) => r.isNew);
const deepLink = (key, id) => `https://www.figma.com/design/${key}/?node-id=${id.replace(":", "-")}`;

if (major.length || bootstrapped.length) {
  // Multiple runs per day (08/12/15h) APPEND to the same day file, one "## Run HH:MM" each.
  const stamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const lines = [`## Run ${stamp}`, ""];
  if (major.length) {
    lines.push(`**${major.reduce((n, r) => n + r.findings.length, 0)} major change(s).**`, "");
    for (const r of major) {
      lines.push(`### ${r.target.label} — [open in Figma](${deepLink(r.target.key, r.target.id)})`, "");
      lines.push(`_File: ${r.fileName} · node \`${r.target.id}\` · Figma version \`${gates.get(r.target.key) ?? "?"}\` (rollback point: this commit; the design itself can be restored from Figma's version history)_`, "");
      const bySec = new Map();
      for (const f of r.findings) {
        const sec = f.sec?.name ?? r.target.label;
        const k = f.page && f.page.name !== sec ? `${sec} › ${f.page.name}` : sec;
        (bySec.get(k) ?? bySec.set(k, []).get(k)).push(f);
      }
      for (const [secName, fs] of bySec) {
        lines.push(`#### ${secName} (${fs.length}) — [open](${deepLink(r.target.key, fs[0].page?.id ?? fs[0].sec?.id ?? r.target.id)})`, "");
        for (const f of fs)
          lines.push(`- **${f.kind}** — ${f.detail} ([node](${deepLink(r.target.key, f.id)}))`);
        lines.push("");
      }
    }
    lines.push("> Ignored by design: colors, margins/padding, fonts, shadows, corner radius, position shifts,", "> and everything on the canvas that is not inside a SECTION (loose frames, icons, component sets).", "");
  }
  if (bootstrapped.length)
    lines.push(`Baseline created for: ${bootstrapped.map((r) => r.target.label).join(", ")}.`, "");
  await mkdir(B("reports"), { recursive: true });
  const reportPath = B("reports", `${TODAY}.md`);
  const prev = await readFile(reportPath, "utf8").catch(() => null);
  await writeFile(reportPath, (prev ? prev.trimEnd() + "\n\n" : `# Figma design watch — ${TODAY}\n\n`) + lines.join("\n") + "\n");
  log(`Report ${prev ? "appended" : "written"}: reports/${TODAY}.md (run ${stamp})`);
}

// Render a PNG of each CHANGED SECTION for visual confirmation (separate rate budget).
// Scale adapts so huge sections stay under ~2000px; capped at 8 renders per run.
if (major.length) {
  await mkdir(B("reports", TODAY), { recursive: true });
  const toRender = new Map();
  for (const r of major) for (const f of r.findings) {
    // Prefer the page frame (1440-wide) over its 13k-wide section — far cheaper to render.
    let s = f.page ?? f.sec ?? { name: r.target.label, id: r.target.id };
    // still the watched node itself (e.g. a whole canvas, too big to render) → render the finding's node
    if (s.id === r.target.id) s = { name: f.id.replace(":", "-"), id: f.id };
    if (s.id && !toRender.has(s.id)) toRender.set(s.id, { ...s, key: r.target.key });
  }
  for (const s of [...toRender.values()].slice(0, 8)) {
    try {
      const maxDim = Math.max(s.w ?? 0, s.h ?? 0);
      const scale = maxDim ? Math.min(0.5, 2500 / maxDim).toFixed(2) : 1;
      const j = await api(`/v1/images/${s.key}?ids=${s.id}&format=png&scale=${scale}`);
      const url = j.images?.[s.id];
      if (!url) continue;
      const png = Buffer.from(await (await fetch(url)).arrayBuffer());
      const safe = s.name.replace(/[^\w.-]+/g, "-");
      await writeFile(B("reports", TODAY, `${safe}.png`), png);
      log(`Rendered reports/${TODAY}/${safe}.png`);
    } catch (e) { log(`render skipped for ${s.name}: ${e.message}`); }
  }
  if (toRender.size > 8) log(`(${toRender.size - 8} more changed sections not rendered — see report links)`);
}

// ---------- git commit + push ----------
const NO_GIT = process.argv.includes("--no-git"); // for manual testing
const git = (...args) => spawnSync("git", args, { cwd: REPO, encoding: "utf8" });
const dirty = NO_GIT ? "" : git("status", "--porcelain", "--", "figma-watch/baseline", "figma-watch/reports").stdout.trim();
if (dirty) {
  git("add", "--", "figma-watch/baseline", "figma-watch/reports");
  const vtag = gates.size ? ` [figma v${[...gates.values()].join(",")}]` : "";
  const msg = (major.length
    ? `figma-watch: ${major.reduce((n, r) => n + r.findings.length, 0)} major change(s) on ${major.map((r) => r.target.label).join(", ")} — ${TODAY}`
    : bootstrapped.length
      ? `figma-watch: baseline created (${bootstrapped.map((r) => r.target.label).join(", ")}) — ${TODAY}`
      : `figma-watch: baseline refresh (cosmetic-only version bump) — ${TODAY}`) + vtag;
  const c = git("commit", "-m", msg);
  log(c.status === 0 ? `Committed: ${msg}` : `git commit failed: ${c.stderr || c.stdout}`);
  if (c.status === 0) {
    const p = git("push");
    log(p.status === 0 ? "Pushed." : `git push failed (non-fatal): ${(p.stderr || "").trim()}`);
  }
}

// ---------- toast ----------
if (major.length && !process.argv.includes("--no-toast")) {
  const msg = `${major.reduce((n, r) => n + r.findings.length, 0)} major design change(s) on: ${major.map((r) => r.target.label).join(", ")}. See figma-watch/reports/${TODAY}.md`;
  const t = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", B("notify.ps1"), "-Message", msg]);
  log(t.status === 0 ? "Toast shown." : "Toast failed (non-fatal).");
}

log(major.length ? `DONE — ${major.length} page(s) with major changes.` : "DONE — no major changes.");
process.exit(rateLimited ? 3 : 0);
