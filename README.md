# sshk.ltd — Social Strategy Hong Kong

The live SSHK company site: nine static pages, no build step, no framework.
Each page is self-contained HTML with its CSS inlined in a `<style>` block.

## Structure

```
index.html          Home — Make noise. Kill noise.
about.html          The agency, leadership, history
services.html       Social Sentiment / Social Appearance Management
works.html          Case studies
production.html     704 Production — in-house video studio
clients.html        Client wall
training.html       Corporate training & speaking
careers.html        Openings
contact.html        Address, phone, enquiry

assets/             Images (149 files): client logos, case-study key
                    visuals, team portraits, 704 Production stills
privacy.html        Privacy policy (PDPO)
404.html            Plain not-found page (404.md for Markdown clients)
robots.txt          Allow all, points at the sitemap and llms.txt
sitemap.xml         All pages
llms.txt            Site summary for AI agents (llmstxt.org)
*.md                Markdown copy of each page, generated — do not edit by hand
scripts/build-md.mjs  Regenerates the *.md copies from the HTML

favicon.svg         Brand mark, vector — source of truth for every icon size.
                    Geometry measured from the master logo (assets/SSHK_Logo-01.png),
                    brand blue #00A0DD. Cropped to the lightning bolt and
                    enlarged so it stays legible at 16px, bleeding off the
                    left and right edges.
favicon.ico         16/32/48 raster fallback, generated from favicon.svg
apple-touch-icon.png  180x180, generated from favicon.svg
```

Regenerate the raster icons after editing `favicon.svg` — they are rendered
from it, not drawn by hand.

## Markdown copies for AI agents

Each page has a Markdown twin (`about.html` → `about.md`) linked from its
`<head>` with `rel="alternate" type="text/markdown"`. On Vercel, a request
with `Accept: text/markdown` to `/`, `/about`, ... gets the Markdown copy
(see `routes` in `vercel.json`). After editing any page, regenerate:

```sh
node scripts/build-md.mjs
```

## Local preview

Any static server works:

```sh
python3 -m http.server 8000
# then open http://127.0.0.1:8000/
```

## Deployment

Deployed on Vercel as the `sshk-website` project (team PBHK). Zero-config
static hosting: no build command, no output directory — the repository root
is served as-is.

Video embeds come from Vimeo and fonts from Google Fonts; both are external
and will not load without network access.
