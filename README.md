# Elon

A personal daily digest of Elon Musk — X posts, replies, reposts, interviews, podcasts, travel, and company news — compiled by Niraj Bhusal. Every time on the site is Nepal Time (NPT, UTC+5:45).

The site is static and is published at [nirajbhusal.github.io/elon](https://nirajbhusal.github.io/elon/).

## Adding a digest

Add one markdown file and nothing else:

```
digests/YYYY-MM-DD.md
```

`YYYY-MM-DD` is the digest’s calendar date in Nepal Time. The site rebuilds and deploys on every push to the default branch, so a new file is picked up on its own. Do not edit layouts, config, or other digests when publishing a day.

### Front matter

All four fields are required. `date` must match the filename.

```yaml
---
date: YYYY-MM-DD
title: "Headline for this day"
covers: "The span this file covers, written in Nepal Time"
summary: "One or two sentences on what mattered."
---
```

| Field | What it is |
| --- | --- |
| `date` | Calendar date (`YYYY-MM-DD`). Same value as the filename. Shown as the digest date. |
| `title` | Headline on the home page, the digest page, search, and the feed. |
| `covers` | The window of time the file covers, including the “as of” moment in NPT. Shown under the date. |
| `summary` | Short standfirst. Shown under the title, in the archive, in search, and in the feed. |

The first file, `digests/2026-09-27.md`, is the reference for tone and shape.

### Body

Markdown after the front matter. Use `##` headings. The usual sections are:

- His top posts
- Who he replied to
- What he boosted
- Interviews and podcasts
- Travel and what's coming up
- Company news
- Government, AI policy and South Asia

**Coming up** on the home page is not a separate data file. It is the bullet list under the heading `Travel and what's coming up` in the latest digest. Keep that heading spelled that way, and keep the items as a flat list. If the heading is missing, the panel is omitted.

Write times in Nepal Time. Bare `https://x.com/...` URLs are linked automatically and open in a new tab. Other links stay in the same tab. Use normal markdown links for sources.

Each file becomes a page at `/elon/YYYY-MM-DD/`.

## What the site generates

- Home (`/elon/`): the latest digest in full, then earlier digests newest first (date, title, summary).
- One page per digest, with previous and next links once more than one file exists.
- Search (`/elon/search/`): client-side, from `search-index.json` built at compile time. No external service.
- RSS 2.0 feed (`/elon/feed.xml`). Item dates are noon Nepal Time on the digest date.

## Local preview

Requires Node.js 20 or newer.

```bash
npm install
npm run build
npm run check
npm start
```

Open [http://localhost:8080/elon/](http://localhost:8080/elon/). `npm run check` confirms the built pages, search index, and feed.

## GitHub Pages

The workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) builds the site on every push to `main`, on pull requests, and when run by hand (`workflow_dispatch`). Pull requests build and check only. Pushes to `main`, and a manual run on `main`, deploy with GitHub Actions.

One repository setting is required. It is not stored in the repo:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.

Leave the site as a project site (no custom domain). The public URL is `https://nirajbhusal.github.io/elon/`.
