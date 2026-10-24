# Tokyo Brotherhood Lab

Official static project hub for Tokyo Brotherhood Lab. Plain HTML, CSS and JavaScript — no build step.

## Site structure

```
docs/                              published by GitHub Pages
├── index.html                     homepage (projects, contact, about)
├── 404.html                       self-contained "page not found" page
├── sitemap.xml, robots.txt
├── assets/
│   ├── css/style.css              all shared styles (site, header, project pages)
│   ├── js/main.js                 footer year + "copy Discord username"
│   ├── js/releases.js             APK release list (reads data/releases.json)
│   └── images/                    *.webp logos, icon-*.png favicons, og-*.jpg social cards
├── data/releases.json             generated release snapshot (do not edit by hand)
└── projects/
    ├── whats-next.html
    ├── whats-next/releases.html
    └── tokyo-manga-lab.html
tools/fetch_releases.py            builds data/releases.json from the What-Next releases
.github/workflows/update-releases.yml
```

## GitHub Pages setup

Repository **Settings → Pages**: **Deploy from a branch**, branch `main`, folder `/docs`.

## APK release list

`docs/projects/whats-next/releases.html` shows every `.apk` attached to the public
[What-Next releases](https://github.com/tokyo720022-create/What-Next/releases).

- The **Update release data** workflow runs every 3 hours (and on demand from the Actions tab),
  runs `tools/fetch_releases.py`, and commits `docs/data/releases.json` only when something changed.
- The page reads that snapshot, so visitors never hit GitHub's API rate limit.
- If the snapshot is missing or still the empty placeholder, the page falls back to the live GitHub API.
- No APK files are stored in this repository; download buttons point at the original GitHub release assets.

Run the snapshot locally: `python3 tools/fetch_releases.py` (set `GITHUB_TOKEN` for a higher rate limit).

## Adding a project page

1. Copy `docs/projects/tokyo-manga-lab.html` and edit the content. Shared styles (`.project-hero`,
   `.tag`, `.notice`, `.card-icon`, …) already live in `style.css`; keep only page-specific CSS inline.
2. Add a logo as `.webp` (about 640 px), a 64 px `icon-<name>.png`, and a 1200×630 `og-<name>.jpg`.
3. Add a card to `docs/index.html` and the page URL to `docs/sitemap.xml`.
4. The header and footer are copied into each page, so update them in every page if you change them.

## Site URL

Canonical, Open Graph and sitemap URLs assume the site is served at
`https://tokyo720022-create.github.io/tokyo-brotherhood-lab-site/`.
If you add a custom domain, search and replace that URL in `docs/` and `docs/sitemap.xml` / `docs/robots.txt`.
