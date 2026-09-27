# Elon

An unofficial personal digest of Elon Musk, compiled from public sources by Niraj Bhusal. It is not affiliated with Elon Musk, Tesla, SpaceX, or X. Every time on the site is Nepal Time (NPT, UTC+5:45).

The site is static and is published at [nirajbhusal.github.io/elon](https://nirajbhusal.github.io/elon/).

## Adding a digest

Add one markdown file and nothing else:

```
digests/YYYY-MM-DD.md
```

`YYYY-MM-DD` is the digest’s calendar date in Nepal Time. Use that form only: four-digit year, two-digit month, two-digit day, hyphens, no time and no timezone. The filename and the front matter `date` must be the same bare `YYYY-MM-DD`. Do not use slashes (`09/27/2026`), day-first numbers (`27-09-2026`), month names, or a time in either place.

The site rebuilds and deploys on every push to the default branch. A new file is picked up on its own. Do not edit layouts, config, styles, or other digests when publishing a day.

### Front matter

All four fields are required. Values are strings. `date` is a bare `YYYY-MM-DD` and must match the filename.

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
| `date` | Calendar date, bare `YYYY-MM-DD`. Same value as the filename. Shown as the digest date. |
| `title` | Headline on the home page, the digest page, search, the feed, and the social card. |
| `covers` | The window of time the file covers, including the “as of” moment in NPT. Shown under the date. |
| `summary` | Short standfirst. Shown under the title, in the archive, in search, and in the feed. |

`digests/2026-09-27.md` is the reference for tone and shape.

### Body

Markdown after the front matter. Use `##` headings. The usual sections are:

- `## His top posts`
- `## Who he replied to`
- `## What he boosted`
- `## Interviews and podcasts`
- `## Travel and appearances` — past events, as prose. This section is not the Coming up panel.
- `## Coming up` — future items only. See below.
- `## Company news`
- `## Government, AI policy and South Asia`
- `## This week in numbers` — Sunday digests. See below.

Each file becomes a page at `/elon/YYYY-MM-DD/`.

Write clock times in Nepal Time and say NPT when a time could be ambiguous. Bare `https://x.com/...` URLs are linked as “View on X”, given an accessible name from the words before the URL, and open in a new tab. Other links stay in the same tab. Use a normal markdown link when the link text should be the words themselves, including notable replies: `[the reply text](https://x.com/elonmusk/status/ID)`.

### Coming up

Put future items under the heading `## Coming up`, as one flat bullet list. The home page and the digest page show that list in the Coming up panel and do not repeat it in the article body. If `## Coming up` is missing, the panel falls back to a list under `## Travel and what's coming up`. New digests should use `## Coming up` and should not put past events in it.

Each bullet may start with a date so the site can hide it after that moment in Nepal Time. Put the date first, in bold, then a colon:

```markdown
## Coming up
- **Mon Sep 28, 6:00–7:15 PM NPT**: What happens, and where.
- **Fri Oct 2, 6:15 AM NPT**: A point in time.
- **Fri Oct 2** (UNCONFIRMED): Date only. Hidden after 23:59 NPT that day.
- **2026-09-28 18:00**: Same idea as a bare date. 24-hour Nepal Time. No timezone suffix.
- **2026-09-28**: Bare date with no clock. Hidden after 23:59 NPT.
```

Date rules:

- Human form: optional weekday, English month, day, then an optional clock. A clock is `H:MM` or `H` with `AM` or `PM`. A range such as `6:00–7:15 PM NPT` uses the end time. `NPT` is optional.
- Bare form, when you are not using a month name: `YYYY-MM-DD` or `YYYY-MM-DD HH:MM` only. Do not write `09/28/2026`, `28-09-2026`, or `Sep 28 2026 6pm` without the comma-and-clock shape above.
- The year is the digest filename’s year. If that month and day falls more than 180 days before the digest date, the next year is used, so a December file can list January.
- A bullet with no parseable leading date stays visible.
- Items whose time has passed are hidden in the browser, so the panel does not sit stale between digests. Still drop them when you write the next file.
- Mark anything unsettled by including `UNCONFIRMED` or `(unconfirmed)` in the bullet. The site styles those items.
- One list. A nested bullet stays inside its parent item; it is not a separate panel row. Extra notes go in the same bullet or in a nested bullet, not in a second top-level list.

### This week in numbers

Sunday digests can include:

```markdown
## This week in numbers

One short sentence of context is optional.

- Originals: 17%
- Replies: 47%
- Reposts: 36%

| Day | Posts |
| --- | --- |
| 2026-09-21 | 40 |
| 2026-09-22 | 44 |

### Top accounts
- @someone: what the exchange was

### Top posts
- The post, with its link and why it was on top
```

A list item whose whole text is `Label: NN%` (a number, then a percent sign) is drawn as a bar. Any other list item stays text. The first table in the section is drawn as a compact grid. `###` headings inside the section are for top accounts, top posts, or posts per day. Do not add a charting library or extra files; the table and the percent list are the whole format. Counts that are not percentages stay in the table or in ordinary bullets (`Posts: 312` is text, not a bar).

## What the site generates

- Home (`/elon/`): the latest digest, with Coming up taken out of the article and shown once in the panel, then earlier digests newest first.
- One page per digest, with previous and next links once more than one file exists.
- Search (`/elon/search/`): client-side, from `search-index.json` built at compile time. Every word must match somewhere in the title, summary, covers line, or body. The result shows a short snippet around the hit.
- Atom feed (`/elon/feed.xml`), the latest 30 digests. Each item is dated 8:04 AM Nepal Time on the digest date.
- `sitemap.xml`, `favicon.ico`, and a 1200×630 social image per digest.

## Local preview

Requires Node.js 20 or newer. Social images need Liberation Sans or DejaVu Sans installed (the `fonts-liberation` package on Ubuntu).

```bash
npm install
npm run build
npm run check
npm run axe
npm start
```

Open [http://localhost:8080/elon/](http://localhost:8080/elon/). `npm run check` confirms the built pages, the Coming up parser, search, the feed, and social tags. `npm run axe` serves the build and checks the home page, a digest, and search in the dark and light themes.

## GitHub Pages

The workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) builds the site on every push to `main`, on pull requests, and when run by hand (`workflow_dispatch`). Pull requests build and check only. Pushes to `main`, and a manual run on `main`, deploy with GitHub Actions.

The Pages source is GitHub Actions. The public URL is `https://nirajbhusal.github.io/elon/`.
