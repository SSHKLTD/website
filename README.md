# sshk.ltd — Social Strategy Hong Kong

Modern, minimal redesign of [www.sshk.ltd](https://www.sshk.ltd/), replacing the
previous Wix build with a fast, dependency-free static site.

## Design

- **Brand colour kept**: the original theme red `#AF1B08` drives all accents,
  on a warm-paper background (`#FAF9F7`) with near-black ink (`#141412`).
- **Typography**: Space Grotesk (display) + Inter (body), via Google Fonts.
- **Editorial minimal layout**: numbered sections, hairline rules, a
  works index list, client marquee, and a dark contact section.
- **Accessible & responsive**: semantic HTML, skip link, keyboard-friendly
  mobile nav, `prefers-reduced-motion` support, WCAG AA colour contrast.
- **No build step, no framework**: plain HTML/CSS/JS. Deploy anywhere
  (GitHub Pages, Netlify, any static host).

## Structure

```
index.html          Single-page site (Home, About, Services, Works, Clients, Team, Contact)
assets/css/style.css
assets/js/main.js   Header state, mobile nav, reveal-on-scroll
favicon.svg         Brand mark, vector (source of truth for all icon sizes).
                    Geometry traced from the master logo (assets/SSHK_Logo-01.png
                    on the live site), brand blue #00A0DD. Cropped to the bolt
                    and enlarged so it stays legible at 16px, bleeding off the
                    left and right edges
favicon.ico         16/32/48 raster fallback, generated from favicon.svg
apple-touch-icon.png  180x180, generated from favicon.svg
```

Regenerate the raster icons after editing `favicon.svg` — they are rendered
from it, not drawn by hand.

## Local preview

Any static server works:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```
