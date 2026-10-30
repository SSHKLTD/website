#!/usr/bin/env node
// Builds a plain-text Markdown copy of every page (index.md, about.md, ...)
// from the HTML that is actually published, so AI agents and other
// text-only readers get the same content without the layout.
//
// No dependencies. Run from the repository root after editing any page:
//
//   node scripts/build-md.mjs
//
// Then commit the regenerated *.md files together with the HTML change.
// Decorative markup is skipped: <nav>, <script>, <style>, <svg>, anything
// with aria-hidden="true" or the `hidden` attribute.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const SITE = 'https://www.sshk.ltd';
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr']);
const SKIP = new Set(['head','script','style','svg','noscript','nav','template','iframe','button','input','textarea','select','canvas','video','audio']);
const BLOCK = new Set(['#root','body','html','nav','p','div','section','header','main','article','aside','footer','figure','figcaption','ul','ol','li','h1','h2','h3','h4','h5','h6','blockquote','form','label','table','tr','dl','dt','dd','hr','br']);

const decode = (s) => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘')
  .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
  .replace(/&hellip;/g, '…').replace(/&middot;/g, '·').replace(/&times;/g, '×').replace(/&divide;/g, '÷')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

function attrs(src) {
  const out = {};
  for (const m of src.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

// Minimal HTML -> tree parser (good enough for these hand-written pages).
function parse(html) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[4] !== undefined) { top.children.push({ text: m[4] }); continue; }
    if (!m[2]) continue; // comment
    const tag = m[2].toLowerCase();
    if (m[1]) { // closing tag
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) { stack.length = i; break; }
      }
      continue;
    }
    const node = { tag, attrs: attrs(m[3]), children: [] };
    top.children.push(node);
    if (tag === 'script' || tag === 'style') { // raw text: skip to the end tag
      const end = html.indexOf(`</${tag}`, re.lastIndex);
      re.lastIndex = end === -1 ? html.length : end;
      stack.push(node);
      continue;
    }
    if (!VOID.has(tag) && !/\/\s*$/.test(m[3])) stack.push(node);
  }
  return root;
}

const abs = (href) => {
  if (!href || /^(https?:|mailto:|tel:|#)/.test(href)) return href;
  let p = href.replace(/^\.?\//, '');
  if (p === 'index.html' || p === '') return `${SITE}/`;
  p = p.replace(/\.html(?=$|[#?])/, '');
  return `${SITE}/${p}`;
};

// Sibling elements written back-to-back (<span>A</span><span>B</span>) are
// visually separate on the page; keep them apart in text too.
function joinKids(children) {
  let out = '', prevEl = false;
  for (const c of children) {
    const s = inline(c);
    const isEl = c.text === undefined;
    if (isEl && prevEl && s && /\S$/.test(out) && /^[^\s,.;:!?)]/.test(s)) out += ' · ';
    if (s) { out += s; prevEl = isEl; } else if (!isEl) prevEl = false;
  }
  return out;
}

function hasBlockOrSpan(node) {
  return (node.children || []).some((c) => c.tag && (BLOCK.has(c.tag) || c.tag === 'span' || hasBlockOrSpan(c)));
}

function inline(node) {
  if (node.text !== undefined) return decode(node.text).replace(/\s+/g, ' ');
  const a = node.attrs, t = node.tag;
  if (SKIP.has(t) || a['aria-hidden'] === 'true' || 'hidden' in a) return '';
  if (t === 'br') return '\n';
  if (t === 'img') return a.alt ? `![${a.alt}](${abs(a.src)})` : '';
  const inner = joinKids(node.children);
  if (BLOCK.has(t)) return `\n${inner}\n`;
  if (t === 'a') {
    const txt = inner.replace(/\s+/g, ' ').trim();
    if (!txt) return '';
    const href = abs(a.href || '');
    return href && !href.startsWith('#') ? `[${txt}](${href})` : txt;
  }
  if ((t === 'b' || t === 'strong') && inner.trim()) return ` **${inner.trim()}** `;
  if ((t === 'em' || t === 'i') && inner.trim()) return ` *${inner.trim()}* `;
  return inner;
}

function block(node, out) {
  if (node.text !== undefined) { out.push({ k: 'inline', v: inline(node) }); return; }
  const a = node.attrs, t = node.tag;
  if (SKIP.has(t) || a['aria-hidden'] === 'true' || 'hidden' in a) return;
  const h = /^h([1-6])$/.exec(t);
  if (h) { out.push({ k: 'para', v: `${'#'.repeat(+h[1])} ${flat(node)}` }); return; }
  if (t === 'li') { out.push({ k: 'li', v: `- ${flat(node)}` }); return; }
  if (t === 'p' || t === 'figcaption' || t === 'blockquote') { out.push({ k: 'para', v: (t === 'blockquote' ? '> ' : '') + flat(node, true) }); return; }
  if (t === 'a' && hasBlockOrSpan(node) && a.href && !a.href.startsWith('#')) {
    // Card-style links (a whole tile is one link) become one list item each.
    const txt = flat(node).replace(/\s*·\s*/g, ' · ').replace(/^· | ·$/g, '');
    if (txt) out.push({ k: 'li', v: `- [${txt}](${abs(a.href)})` });
    return;
  }
  if (!BLOCK.has(t)) { out.push({ k: 'inline', v: inline(node) }); return; }
  out.push({ k: 'break' });
  for (const c of node.children) block(c, out);
  out.push({ k: 'break' });
}

function flat(node, keepBreaks = false) {
  let s = joinKids(node.children);
  s = keepBreaks ? s.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/\n{2,}/g, '\n') : s.replace(/\s*\n\s*/g, ' ');
  return s.replace(/[ \t]+/g, ' ').replace(/ ([,.;:!?])/g, '$1').trim();
}

function render(items) {
  const paras = [];
  let buf = '';
  const flush = () => {
    const s = buf.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/ ([,.;:!?])/g, '$1').trim();
    for (const part of s.split(/\n{2,}/)) if (part.trim()) paras.push({ s: part.trim(), li: false });
    buf = '';
  };
  for (const it of items) {
    if (it.k === 'inline') { buf += it.v; continue; }
    flush();
    if (it.k === 'para' && it.v.replace(/^#+\s*/, '').trim()) paras.push({ s: it.v, li: false });
    if (it.k === 'li' && it.v.length > 2) paras.push({ s: it.v, li: true });
  }
  flush();
  // A run of image-only paragraphs (logo walls) reads better as a list of names.
  const img = (p) => p && /^!\[([^\]]*)\]\([^)]*\)$/.exec(p.s);
  paras.forEach((p, i) => {
    const m = img(p);
    if (m && (img(paras[i - 1]) || img(paras[i + 1]))) p.alt = m[1];
  });
  for (const p of paras) if (p.alt !== undefined) { p.s = `- ${p.alt}`; p.li = true; }
  let md = '';
  paras.forEach((p, i) => {
    const prev = paras[i - 1];
    md += i === 0 ? '' : (p.li && prev?.li ? '\n' : '\n\n');
    md += p.s;
  });
  return md.replace(/\)\[/g, ') · [').replace(/\n{3,}/g, '\n\n');
}

const pages = readdirSync('.').filter((f) => f.endsWith('.html') && f !== '404.html').sort();
for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const title = decode((/<title>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || file).trim();
  const desc = decode((/<meta name="description" content="([^"]*)"/i.exec(html) || [])[1] || '').trim();
  const url = abs(file);
  const body = parse(html.slice(html.search(/<body[\s>]/i)));
  const items = [];
  block(body, items);
  const md = [
    `# ${title}`,
    desc && `> ${desc}`,
    `Source: ${url}`,
    '---',
    render(items),
    '',
  ].filter(Boolean).join('\n\n');
  const out = file.replace(/\.html$/, '.md');
  writeFileSync(out, md);
  console.log(`${file} -> ${out} (${md.length} chars)`);
}
