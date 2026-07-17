# iottag — Website

Static marketing site for **iottag** (Operational Intelligence). Plain HTML, CSS
and vanilla JavaScript — no build step, no framework, no dependencies.

## Quick start

Shared header/footer load at runtime with `fetch()`, so open the site through a
**web server** (not `file://`):

```bash
python3 -m http.server 8000      # then open http://localhost:8000
# or: npx serve .
```

## URL structure (SEO-friendly, future-proof)

Clean directory URLs — add new pages by dropping a folder in, no restructuring:

```
/                                   index.html            (Home)
/solutions/                         solutions/index.html  (overview)
/solutions/operational-digital-twin/
/solutions/fatal-risk-intelligence/
/solutions/production-intelligence/
/platform/  + operational-intelligence, workforce-visibility, fleet-visibility,
              asset-visibility, environmental-monitoring, executive-visibility
/industries/ + mining, tunnelling, construction-infrastructure,
               bridge-construction-maintenance, critical-infrastructure
/technology/ + vector-tag, positioning-technologies,
               iot-security-governance, integrations-ecosystem
/resources/  + case-studies, video-library, articles-insights, white-papers
/company/    + about, why-iottag, partners, careers, contact
```

Each section has an **overview** (`/<section>/`) plus **detail pages**
(`/<section>/<slug>/`). 35 pages total.

## Project layout

```
.
├── index.html                  # Home
├── <section>/index.html        # 6 section overviews
├── <section>/<slug>/index.html # 28 detail pages
├── partials/
│   ├── header.html             # shared header + mega-menu nav
│   └── footer.html             # shared footer
├── assets/
│   ├── css/main.css            # design tokens + components + sections
│   ├── js/main.js              # includes, active nav, mega-menu, mobile menu
│   └── img/                    # images
├── sitemap.xml                 # all 35 URLs
├── robots.txt
└── README.md
```

## How it fits together

- **Paths are relative + depth-aware.** Every page declares its depth on the
  `<body>` tag, e.g. `data-base="../../"`. The page's own `<head>`/body links use
  that prefix. `assets/js/main.js` reads `data-base` and rewrites the shared
  partials' root-relative links (`/solutions/…`) to the correct prefix when it
  injects them — so one header file works at every depth, and the site works
  whether hosted at a domain root or under a sub-path.
- **Shared header/footer** live in `partials/`. Edit nav/footer in one place.
- **Mega-menu:** hovering a top-level nav item opens a full-width dropdown of
  that section's detail pages (desktop). Mobile shows top-level links via the
  hamburger.
- **Active nav:** each page sets `<body data-page="solutions">`; the matching nav
  link gets `aria-current="page"`.

## SEO

- One `<h1>` per page; semantic `header/nav/main/section/article/footer`; ordered
  headings.
- Per-page `<title>`, `<meta name="description">`, **canonical**, robots, Open
  Graph, Twitter Card.
- **JSON-LD**: Organization + WebSite on Home; WebPage + BreadcrumbList on inner
  pages. Visible breadcrumb on detail pages.
- `sitemap.xml` + `robots.txt` at the root.
- Images carry `alt`; key images have `width`/`height` (CLS) and `loading="lazy"`
  below the fold / `fetchpriority="high"` for the hero.

### ⚠ Before going live — confirm with the team
- **Production domain:** canonical/OG/sitemap currently use the placeholder
  `https://www.iottag.com`. Find-and-replace it with the real domain.
- **Meta titles/descriptions** on the 28 detail pages are drafted from the Figma
  section names — review/replace with approved marketing copy.
- Detail-page body copy is concise/on-brand placeholder where the Figma had no
  finished content; swap in real copy as it's ready.

## Editing guide

| Task | Where |
|------|-------|
| Brand colour / font / spacing | `:root` tokens in `assets/css/main.css` |
| Nav links / mega-menu | `partials/header.html` |
| Footer | `partials/footer.html` |
| Add a detail page | Create `/<section>/<new-slug>/index.html` (copy an existing one, fix `data-base`, add it to the mega-menu + `sitemap.xml`) |
| Swap an image | Replace the file in `assets/img/` |
| Change the domain | Find-replace `https://www.iottag.com` across all files + `sitemap.xml` |
