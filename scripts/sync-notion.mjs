#!/usr/bin/env node
/**
 * Notion → site content sync.
 *
 * Pulls Works / Clients / Careers from the Notion databases listed in
 * scripts/notion.config.json and rewrites src/data/*.json, downloading any
 * Notion-hosted images into public/images/notion/ (Notion file URLs expire
 * after ~1 hour, so they must be mirrored at build time).
 *
 * Publication gates (rows are skipped unless):
 *   Works:   網站顯示 ✓  AND  可否引用 = 可公開引用
 *   Clients: 網站顯示 ✓
 *   Careers: 網站顯示 ✓  AND  狀態 = Open
 *
 * Only whitelisted properties ever leave Notion — internal fields
 * (目標, Learnings, 摘要, 負責同事, 資料連結 …) are never read.
 *
 * Requires NOTION_TOKEN (internal integration with read access to the three
 * databases). Without it, this script exits 0 and the committed JSON is used.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/notion.config.json'), 'utf8'));
const TOKEN = process.env.NOTION_TOKEN;

if (!TOKEN) {
  console.log('[sync-notion] NOTION_TOKEN not set — keeping committed JSON content.');
  process.exit(0);
}

const API = 'https://api.notion.com/v1';
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  'Notion-Version': '2025-09-03',
  'Content-Type': 'application/json',
};

async function queryAll(dataSourceId, filter) {
  const rows = [];
  let cursor;
  do {
    const res = await fetch(`${API}/data_sources/${dataSourceId}/query`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ filter, start_cursor: cursor, page_size: 100 }),
    });
    if (!res.ok) throw new Error(`Notion query failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    rows.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return rows;
}

const text = (p) => (p?.rich_text ?? p?.title ?? []).map((t) => t.plain_text).join('').trim();
const sel = (p) => p?.select?.name ?? '';
const multi = (p) => (p?.multi_select ?? []).map((m) => m.name);
const num = (p) => p?.number ?? null;
const check = (p) => !!p?.checkbox;
const files = (p) => (p?.files ?? []).map((f) => f?.file?.url ?? f?.external?.url).filter(Boolean);

function slugify(s) {
  return s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function download(url, destRel) {
  const dest = path.join(ROOT, 'public', destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed (${res.status}): ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return '/' + destRel.replace(/\\/g, '/');
}

const extOf = (url) => {
  const m = new URL(url).pathname.match(/\.(png|jpe?g|webp|gif|svg)$/i);
  return m ? m[0].toLowerCase() : '.jpg';
};

// 分類 (Notion industry select) → site display groups
const GROUP_MAP = {
  '地產/物業': 'Property & Conglomerates',
  '銀行/金融': 'Banking, Finance & Insurance',
  '保險': 'Banking, Finance & Insurance',
  '政府/公營機構': 'Government & Public Bodies',
  '交通/旅遊': 'Transport & Aviation',
  '教育': 'Education',
  'NGO/慈善': 'NGO & Community',
  '零售/消費品': 'Consumer, Tech & Lifestyle',
  '餐飲/食品': 'Consumer, Tech & Lifestyle',
  '醫療/健康': 'Consumer, Tech & Lifestyle',
  '科技/初創': 'Consumer, Tech & Lifestyle',
  '媒體/娛樂': 'Consumer, Tech & Lifestyle',
  '奢侈品': 'Consumer, Tech & Lifestyle',
  '體育/活動': 'Events & Campaigns',
  '其他': 'Events & Campaigns',
};
const GROUP_ORDER = [
  'Property & Conglomerates',
  'Banking, Finance & Insurance',
  'Government & Public Bodies',
  'Transport & Aviation',
  'Education',
  'NGO & Community',
  'Consumer, Tech & Lifestyle',
  'Events & Campaigns',
];

// ---------- Works ----------
async function syncWorks() {
  const rows = await queryAll(CONFIG.works.dataSourceId, {
    and: [
      { property: '網站顯示', checkbox: { equals: true } },
      { property: '可否引用', select: { equals: '可公開引用' } },
    ],
  });
  const works = [];
  for (const row of rows) {
    const p = row.properties;
    const slug = text(p['Slug']) || slugify(text(p['網站標題 (EN)']) || text(p['案例名稱']));
    const copyRaw = text(p['網站文案 (EN)']);
    if (!slug || !copyRaw) {
      console.warn(`[works] skipped "${text(p['案例名稱'])}" — missing Slug or 網站文案 (EN)`);
      continue;
    }
    const coverUrls = files(p['封面圖']);
    const galleryUrls = files(p['圖庫']);
    const cover = coverUrls.length
      ? await download(coverUrls[0], `images/notion/works/${slug}/cover${extOf(coverUrls[0])}`)
      : undefined;
    const images = [];
    for (let i = 0; i < galleryUrls.length; i++) {
      images.push(await download(galleryUrls[i], `images/notion/works/${slug}/g${i + 1}${extOf(galleryUrls[i])}`));
    }
    works.push({
      slug,
      title: text(p['網站標題 (EN)']) || text(p['案例名稱']),
      client: text(p['客戶']),
      industry: sel(p['行業']) || 'Other',
      services: multi(p['服務類型']),
      featured: check(p['精選']),
      tagline: '',
      copy: copyRaw.split(/\n{2,}|\n/).map((s) => s.trim()).filter(Boolean),
      results: text(p['成效數據 (EN)']).split('|').map((s) => s.trim()).filter(Boolean),
      order: num(p['網站排序']) ?? 999,
      ...(cover ? { cover } : {}),
      images,
    });
  }
  works.sort((a, b) => a.order - b.order);
  return works;
}

// ---------- Clients ----------
async function syncClients() {
  const rows = await queryAll(CONFIG.clients.dataSourceId, {
    property: '網站顯示',
    checkbox: { equals: true },
  });
  const buckets = new Map(GROUP_ORDER.map((g) => [g, []]));
  for (const row of rows) {
    const p = row.properties;
    const name = text(p['名稱 (EN)']) || text(p['客戶名稱']);
    const slug = slugify(name);
    const group = GROUP_MAP[sel(p['分類'])] ?? 'Consumer, Tech & Lifestyle';
    const logoUrls = files(p['Logo']);
    const entry = { slug, name, order: num(p['網站排序']) ?? 999 };
    if (logoUrls.length) {
      entry.logo = await download(logoUrls[0], `images/notion/clients/${slug}${extOf(logoUrls[0])}`);
    }
    buckets.get(group).push(entry);
  }
  return GROUP_ORDER
    .map((g) => ({
      group: g,
      clients: buckets.get(g).sort((a, b) => a.order - b.order).map(({ order, ...c }) => c),
    }))
    .filter((g) => g.clients.length > 0);
}

// ---------- Careers ----------
async function syncCareers() {
  const rows = await queryAll(CONFIG.careers.dataSourceId, {
    and: [
      { property: '網站顯示', checkbox: { equals: true } },
      { property: '狀態', select: { equals: 'Open' } },
    ],
  });
  return rows.map((row) => {
    const p = row.properties;
    const title = text(p['Title (EN)']) || text(p['職位名稱']);
    return {
      slug: text(p['Slug']) || slugify(title),
      title: title.replace(/\s*\(Internship\)\s*$/i, ''),
      type: sel(p['類型']) || 'Full-time',
      posted: p['刊登日期']?.date?.start ?? new Date().toISOString().slice(0, 10),
      summary: '',
      responsibilities: text(p['Responsibilities (EN)']).split('\n').map((s) => s.trim()).filter(Boolean),
      requirements: text(p['Requirements (EN)']).split('\n').map((s) => s.trim()).filter(Boolean),
    };
  });
}

// ---------- run ----------
const write = (rel, data) =>
  fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(data, null, 2) + '\n');

try {
  const [works, clients, careers] = await Promise.all([syncWorks(), syncClients(), syncCareers()]);
  if (works.length) { write('src/data/works.json', works); console.log(`[works] ${works.length} cases synced`); }
  else console.warn('[works] 0 publishable rows — keeping committed works.json');
  if (clients.length) { write('src/data/clients.json', clients); console.log(`[clients] ${clients.reduce((n, g) => n + g.clients.length, 0)} clients synced`); }
  else console.warn('[clients] 0 publishable rows — keeping committed clients.json');
  if (careers.length) { write('src/data/jobs.json', careers); console.log(`[careers] ${careers.length} openings synced`); }
  else console.warn('[careers] 0 open rows — keeping committed jobs.json');
} catch (err) {
  console.error('[sync-notion] FAILED:', err.message);
  process.exit(1);
}
