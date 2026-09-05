#!/usr/bin/env python3
"""SSHK Radar — fetch candidate Hong Kong PR/social incidents from Google News RSS.

Usage:  python3 fetch.py [--days 2] [--out radar_raw.json]
Output: JSON list of {title, source, date, lang, link, query}; also a table on stdout.

Only headlines/source/date are reliable. Google's article links land on a JS
interstitial, so the caller must find original articles by searching the title.
"""
import argparse, html, json, re, sys, urllib.parse, urllib.request
from datetime import datetime

QUERIES = {
    "zh": ["公關災難", "道歉 聲明 香港", "澄清 聲明 香港", "品牌 爭議 網民 香港",
           "機構 回應 爭議 香港", "投訴 網民 熱議 香港"],
    "en": ["Hong Kong (apology OR backlash OR scandal OR controversy)",
           "Hong Kong company statement (backlash OR outrage)"],
}
LOCALE = {"zh": ("zh-HK", "HK:zh-Hant"), "en": ("en-HK", "HK:en")}
UA = "Mozilla/5.0 (compatible; SSHK-Radar/1.0)"

def fetch(query, lang, days):
    hl, ceid = LOCALE[lang]
    url = ("https://news.google.com/rss/search?q=%s+when:%dd&hl=%s&gl=HK&ceid=%s"
           % (urllib.parse.quote(query), days, hl, ceid))
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read().decode("utf-8", "replace")

def parse(xml, lang, query):
    out = []
    for m in re.finditer(r"<item>(.*?)</item>", xml, re.S):
        it = m.group(1)
        g = lambda t: html.unescape((re.search(r"<%s[^>]*>(.*?)</%s>" % (t, t), it, re.S) or [None, ""])[1]).strip()
        title = re.sub(r"\s*-\s*[^-]+$", "", g("title"))
        if not title: continue
        try: date = datetime.strptime(g("pubDate")[:25], "%a, %d %b %Y %H:%M:%S").strftime("%Y-%m-%d %H:%M")
        except Exception: date = g("pubDate")[:16]
        out.append(dict(title=title, source=g("source"), date=date, lang=lang, link=g("link"), query=query))
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=2)
    ap.add_argument("--out", default="radar_raw.json")
    a = ap.parse_args()
    seen, items, errors = {}, [], []
    for lang, qs in QUERIES.items():
        for q in qs:
            try:
                for it in parse(fetch(q, lang, a.days), lang, q):
                    if it["title"] not in seen:
                        seen[it["title"]] = it; items.append(it)
            except Exception as e:
                errors.append(f"{lang} {q!r}: {e}")
    items.sort(key=lambda x: x["date"], reverse=True)
    json.dump(items, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    zh = sum(1 for i in items if i["lang"] == "zh")
    print(f"# {len(items)} unique items (zh {zh} / en {len(items)-zh}), window {a.days}d, {len(errors)} query errors")
    for e in errors: print("#   error:", e, file=sys.stderr)
    for i, it in enumerate(items, 1):
        print(f"{i:>3}. [{it['date'][:10]}] {it['source'][:12]:<12} {it['title'][:78]}")

if __name__ == "__main__":
    main()
