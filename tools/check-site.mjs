#!/usr/bin/env node
// Static site checker for Coaching Academy. No dependencies; run with `node tools/check-site.mjs`.
//  - validates courses.json (fields, unique ids, published courses have an index.html)
//  - checks every href/src in HTML and url() in CSS resolves to a real file, with exact
//    filename case (GitHub Pages is case-sensitive, Windows/macOS file systems are not)
//  - rejects root-absolute links ("/x"), which break under the /Coaching/ project base path
//  - checks "#fragment" links point to an existing id (numeric slide anchors excepted)
//  - warns about course folders that are not listed in courses.json
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IGNORE = new Set([".git", ".github", "tools", "node_modules", "_site"]);
const STATUSES = ["published", "coming-soon", "draft"];
const errors = [];
const warnings = [];
const rel = (p) => relative(ROOT, p).split(sep).join("/");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORE.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// existsSync is case-insensitive on Windows/macOS; compare every path segment exactly.
function existsExact(abs) {
  if (!existsSync(abs)) return false;
  const parts = relative(ROOT, abs).split(sep).filter(Boolean);
  let cur = ROOT;
  for (const part of parts) {
    if (part === "..") return false;
    if (!readdirSync(cur).includes(part)) return false;
    cur = join(cur, part);
  }
  return true;
}

// Resolve a site-relative URL to a file: "dir/" -> "dir/index.html".
function resolveTarget(fromFile, url) {
  const clean = decodeURI(url.split("#")[0].split("?")[0]);
  let abs = clean === "" ? fromFile : join(dirname(fromFile), clean);
  if (clean.endsWith("/") || (existsSync(abs) && statSync(abs).isDirectory())) abs = join(abs, "index.html");
  return abs;
}

const isExternal = (u) => /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(u);

// ---------- courses.json ----------
let courses = [];
try {
  const data = JSON.parse(readFileSync(join(ROOT, "courses.json"), "utf8"));
  if (!Array.isArray(data.courses)) throw new Error('missing "courses" array');
  courses = data.courses;
} catch (e) {
  errors.push(`courses.json: ${e.message}`);
}
const ids = new Set();
for (const [i, c] of courses.entries()) {
  const at = `courses.json[${i}]${c && c.id ? ` (${c.id})` : ""}`;
  for (const k of ["id", "title", "path", "status"]) if (!c[k]) errors.push(`${at}: missing "${k}"`);
  if (c.id && !/^[a-z0-9][a-z0-9-]*$/.test(c.id)) errors.push(`${at}: id must be lowercase letters, digits and dashes`);
  if (ids.has(c.id)) errors.push(`${at}: duplicate id`);
  ids.add(c.id);
  if (c.status && !STATUSES.includes(c.status)) errors.push(`${at}: status must be one of ${STATUSES.join(", ")}`);
  if (c.path && (isExternal(c.path) || c.path.startsWith("/"))) errors.push(`${at}: path must be relative to the site root, e.g. "${c.id}/"`);
  else if (c.path && !c.path.endsWith("/")) errors.push(`${at}: path must end with "/"`);
  if (c.color && !/^#[0-9a-f]{3,8}$/i.test(c.color)) errors.push(`${at}: color must be a hex value like "#0b7a75"`);
  if (c.status === "published" && c.path && !c.path.startsWith("/") && !existsExact(resolveTarget(join(ROOT, "index.html"), c.path)))
    errors.push(`${at}: published but ${c.path}index.html does not exist`);
  for (const l of c.links || []) {
    if (!l.path || isExternal(l.path) || l.path.startsWith("/")) errors.push(`${at}: link "${l.label}" needs a relative path`);
    else if (!existsExact(resolveTarget(join(ROOT, "index.html"), l.path))) errors.push(`${at}: link "${l.label}" -> ${l.path} not found`);
  }
}
const listed = new Set(courses.map((c) => (c.path || "").replace(/\/$/, "")));
for (const name of readdirSync(ROOT)) {
  if (IGNORE.has(name) || name === "assets" || name.startsWith(".")) continue;
  const p = join(ROOT, name);
  if (statSync(p).isDirectory() && existsSync(join(p, "index.html")) && !listed.has(name))
    warnings.push(`${name}/ has an index.html but is not listed in courses.json`);
}

// ---------- links & assets ----------
const files = walk(ROOT);
const idCache = new Map();
function idsOf(file) {
  if (!idCache.has(file)) idCache.set(file, new Set([...readFileSync(file, "utf8").matchAll(/\sid=["']([^"']+)["']/g)].map((m) => m[1])));
  return idCache.get(file);
}
let checked = 0;
function check(file, url, kind) {
  url = url.trim().replace(/&amp;/g, "&");
  if (!url || url === "#") return;
  if (isExternal(url) || url.startsWith("data:")) return;
  checked++;
  if (url.startsWith("/")) {
    errors.push(`${rel(file)}: root-absolute ${kind} "${url}" breaks under the /Coaching/ base path — use a relative path`);
    return;
  }
  const target = resolveTarget(file, url);
  if (!existsExact(target)) {
    errors.push(`${rel(file)}: ${kind} "${url}" -> ${rel(target)} not found (check spelling and letter case)`);
    return;
  }
  const frag = url.includes("#") ? url.slice(url.indexOf("#") + 1) : "";
  if (frag && !/^\d+$/.test(frag) && target.endsWith(".html") && !idsOf(target).has(decodeURIComponent(frag)))
    errors.push(`${rel(file)}: "${url}" -> no element with id="${frag}" in ${rel(target)}`);
}

let pages = 0;
for (const file of files) {
  if (file.endsWith(".html")) {
    pages++;
    // Ignore scripts and comments: they may contain href/src text that is not markup.
    const html = readFileSync(file, "utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (m) => m.match(/^<script\b[^>]*>/i)[0])
      .replace(/<!--[\s\S]*?-->/g, "");
    for (const m of html.matchAll(/\s(href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) check(file, m[2] ?? m[3], m[1].toLowerCase());
    if (!/<meta\s+name=["']viewport["']/i.test(html)) warnings.push(`${rel(file)}: no <meta name="viewport"> (not mobile friendly)`);
    if (!/<title>[^<]+<\/title>/i.test(html)) warnings.push(`${rel(file)}: missing <title>`);
  } else if (file.endsWith(".css")) {
    const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) check(file, m[1], "url()");
  }
}

// ---------- report ----------
const courseCount = courses.filter((c) => c.status === "published").length;
console.log(`Checked ${pages} HTML pages, ${checked} internal references, ${courses.length} catalog entries (${courseCount} published).`);
for (const w of warnings) console.log(`  warning: ${w}`);
for (const e of errors) console.log(`  ERROR:   ${e}`);
if (errors.length) {
  console.log(`\n${errors.length} error(s). Fix them before deploying.`);
  process.exit(1);
}
console.log("OK — no broken internal links or assets.");
