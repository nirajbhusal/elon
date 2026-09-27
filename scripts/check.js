const fs = require("fs");
const path = require("path");
const { comingUpFromFile, comingUpFromHtml, pageBody, parseUntil } = require("../lib/coming");
const { renderMarkdown, stripHtml } = require("../lib/content");
const search = require("../src/js/search");

const root = path.resolve(__dirname, "..");
const siteDir = path.join(root, "_site");
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function read(rel) {
  const full = path.join(siteDir, rel);
  assert(fs.existsSync(full), `missing ${rel}`);
  if (!fs.existsSync(full)) return "";
  return fs.readFileSync(full, "utf8");
}

function decode(value) {
  return String(value)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function appears(html, text) {
  if (html.includes(text)) return true;
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return (
    html.includes(escaped) ||
    html.includes(escaped.replace(/'/g, "&#39;")) ||
    html.includes(escaped.replace(/'/g, "&apos;"))
  );
}

function meta(html, name) {
  const byName = new RegExp(
    `<meta[^>]+(?:property|name)="${name}"[^>]*content="([^"]*)"|<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${name}"`,
    "i"
  );
  const match = byName.exec(html);
  return match ? match[1] || match[2] || "" : "";
}

function pngSize(file) {
  const buf = fs.readFileSync(file);
  assert(buf[0] === 0x89 && buf[1] === 0x50, `${file} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function headingCount(html, label) {
  const headings = html.match(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi) || [];
  return headings.filter((heading) => stripHtml(heading).replace(/\s+/g, " ").trim().toLowerCase() === label).length;
}

function parserTests() {
  assert(parseUntil("Mon Sep 28, 6:00–7:15 PM NPT", "2026-09-27") === "2026-09-28T13:30:00.000Z", "range end time");
  assert(parseUntil("Fri Oct 2, 6:15 AM NPT", "2026-09-27") === "2026-10-02T00:30:00.000Z", "morning NPT");
  assert(parseUntil("Thu Sep 24, 7:00 PM NPT", "2026-09-27") === "2026-09-24T13:15:00.000Z", "recent past stays this year");
  assert(parseUntil("Fri Oct 2", "2026-09-27") === "2026-10-02T18:14:00.000Z", "date only ends at 23:59 NPT");
  assert(parseUntil("2026-09-28 18:00", "2026-09-27") === "2026-09-28T12:15:00.000Z", "ISO time");

  const sample = renderMarkdown(`## Coming up
- **Mon Sep 28, 6:00–7:15 PM NPT**: Parent item
  - nested child
- **Fri Oct 2, 6:15 AM NPT**: Second
- **Thu Sep 24, 7:00 PM NPT**: Old dinner

## Company news
Still here
`);
  const items = comingUpFromHtml(sample, "2026-09-27");
  assert(items.length === 3, `nested list produced ${items.length} items`);
  assert(items[0].text.includes("Parent item") && items[0].text.includes("nested child"), "nested list leaked out of its parent");
  const body = pageBody(sample);
  assert(!/Old dinner/.test(body), "Coming up section was left in the body");
  assert(body.includes("Still here"), "page body dropped the following section");
  assert(headingCount(body, "coming up") === 0, "Coming up heading remained in the body");

  const fallback = comingUpFromHtml(
    renderMarkdown(`## Travel and what's coming up\n- **Mon Sep 28**: Fallback item\n`),
    "2026-09-27"
  );
  assert(fallback.length === 1 && fallback[0].text.includes("Fallback item"), "fallback heading was ignored");

  const preferred = comingUpFromHtml(
    renderMarkdown(`## Travel and what's coming up\n- **Mon Sep 28**: Old list\n\n## Coming up\n- **Fri Oct 2**: New list\n`),
    "2026-09-27"
  );
  assert(preferred.length === 1 && preferred[0].text.includes("New list"), "Coming up should win over the old heading");

  const flagged = comingUpFromHtml(
    renderMarkdown(`## Coming up\n- **Fri Oct 2** (UNCONFIRMED): deliveries\n`),
    "2026-09-27"
  );
  assert(flagged[0] && flagged[0].unconfirmed, "UNCONFIRMED item was not flagged");

  const stats = pageBody(
    renderMarkdown(`## This week in numbers\n- Originals: 17%\n- Replies: 47%\n- Notes: not a share\n\n| Day | Posts |\n| --- | --- |\n| 2026-09-25 | 51 |\n`)
  );
  assert(stats.includes('class="stats"'), "stats section was not wrapped");
  assert(stats.includes('class="stat-row"') && stats.includes("width:17%"), "percent list was not drawn as bars");
  assert(stats.includes('class="stat-table"'), "stats table was not marked");
  assert(stats.includes("not a share"), "non-percent stat item was dropped");
}

function searchTests(index) {
  const query = search.terms("starship roadster");
  const hits = index.filter((item) => search.matches(item, query));
  assert(hits.some((item) => item.date === "2026-09-27"), 'search "starship roadster" missed 2026-09-27');
  assert(!index.some((item) => search.matches(item, search.terms("starship notaword"))), "search matched a missing word");
  const html = search.renderItems(index, "starship roadster");
  assert(html.includes("/elon/2026-09-27/"), "search render omitted the digest url");
  assert(html.includes('class="snippet"'), "search render omitted the snippet");
  assert(/<mark>Starship<\/mark>/.test(html), "search did not highlight Starship");
  assert(/<mark>Roadster<\/mark>/.test(html), "search did not highlight Roadster");
  const titleOnly = search.snippets(
    { title: "Starship notes", summary: "", covers: "", text: "nothing else" },
    search.terms("starship")
  );
  assert(titleOnly.length === 1 && /starship/i.test(titleOnly[0]), "title hit produced no snippet");
}

parserTests();

const home = read("index.html");
const searchPage = read("search/index.html");
const feed = read("feed.xml");
const sitemap = read("sitemap.xml");
const indexRaw = read("search-index.json");
const css = read("css/site.css");
read("js/search.js");
read("js/coming.js");
read("favicon.svg");
read("favicon.ico");
read("404.html");
read("og.png");

assert(!fs.existsSync(path.join(siteDir, "digests")), "digest sources were copied into the output");
assert(!fs.existsSync(path.join(siteDir, "src")), "source templates were copied into the output");

let index = [];
try {
  index = JSON.parse(indexRaw);
} catch (error) {
  failures.push(`search-index.json is not JSON: ${error.message}`);
}

assert(Array.isArray(index) && index.length > 0, "search index is empty");
if (Array.isArray(index) && index.length) searchTests(index);

const siteOg = pngSize(path.join(siteDir, "og.png"));
assert(siteOg.width === 1200 && siteOg.height === 630, `og.png is ${siteOg.width}x${siteOg.height}`);

if (Array.isArray(index)) {
  for (const item of index) {
    assert(/^\d{4}-\d{2}-\d{2}$/.test(item.date), `bad index date ${item.date}`);
    assert(item.url === `/elon/${item.date}/`, `index url ${item.url} does not match date ${item.date}`);
    assert(item.title && item.summary && item.covers && item.text, `index entry ${item.date} is missing fields`);
    const page = read(`${item.date}/index.html`);
    const source = path.join(root, "digests", `${item.date}.md`);
    const upcoming = comingUpFromFile(source);
    assert(appears(page, item.title), `${item.date} page is missing its title`);
    assert(page.includes(`href="/elon/"`), `${item.date} page is missing the home link`);
    assert(headingCount(page, "coming up") === (upcoming.length ? 1 : 0), `${item.date} Coming up heading count is wrong`);
    const aside = (page.match(/<aside class="coming"[\s\S]*?<\/aside>/) || [""])[0];
    if (upcoming.length) {
      assert(aside.includes("data-until"), `${item.date} coming panel has no dates`);
      assert(aside.includes(stripHtml(upcoming[0].html).slice(0, 24)), `${item.date} panel does not match the digest list`);
    } else {
      assert(!aside, `${item.date} rendered an empty Coming up panel`);
    }

    const digestOg = pngSize(path.join(siteDir, "og", `${item.date}.png`));
    assert(digestOg.width === 1200 && digestOg.height === 630, `${item.date} og image size`);
    assert(meta(page, "og:image") === `https://nirajbhusal.github.io/elon/og/${item.date}.png`, `${item.date} og:image`);
    assert(decode(meta(page, "og:title")) === item.title, `${item.date} og:title`);
    assert(meta(page, "twitter:card") === "summary_large_image", `${item.date} twitter card`);
    const canonical = (page.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    assert(canonical === `https://nirajbhusal.github.io/elon/${item.date}/`, `${item.date} canonical`);

    const tags = page.match(/<a\b[^>]*>/gi) || [];
    for (const tag of tags) {
      if (!/href="https?:\/\/(?:www\.)?(?:x|twitter)\.com\//.test(tag)) continue;
      assert(/target="_blank"/.test(tag), `x.com link missing target=_blank: ${tag}`);
      assert(/rel="[^"]*noopener/.test(tag), `x.com link missing noopener: ${tag}`);
    }
    const viewOnX = tags.filter((tag) => /aria-label="View on X/.test(tag));
    const bareStatus = (fs.readFileSync(source, "utf8").match(/https:\/\/x\.com\/elonmusk\/status\/\d+/g) || []).length;
    if (bareStatus) assert(viewOnX.length > 0, `${item.date} bare x.com links have no descriptive label`);
  }
}

assert(meta(home, "og:title").includes("daily digest"), `home og:title is not descriptive: ${meta(home, "og:title")}`);
assert(meta(home, "og:title") !== "Elon", "home og:title is only Elon");
assert(meta(home, "og:description"), "home og:description missing");
assert(meta(home, "og:url") === "https://nirajbhusal.github.io/elon/", `home og:url ${meta(home, "og:url")}`);
assert(meta(home, "og:image") === "https://nirajbhusal.github.io/elon/og.png", `home og:image ${meta(home, "og:image")}`);
assert(meta(home, "twitter:card") === "summary_large_image", "home twitter card");
assert(/<link rel="canonical" href="https:\/\/nirajbhusal\.github\.io\/elon\/"/.test(home), "home canonical");
assert(home.includes("An unofficial personal digest compiled from public sources."), "footer disclaimer missing");
assert(home.includes('href="/elon/css/site.css"'), "home stylesheet path");
assert(home.includes('href="/elon/search/"'), "home search link");
assert(home.includes('href="/elon/feed.xml"'), "home feed link");
assert(home.includes('src="/elon/js/coming.js"'), "coming script missing");
assert(/data-theme/.test(home), "theme hook missing");
assert(!/fonts\.googleapis|fonts\.gstatic|googletagmanager|google-analytics|cdn\.jsdelivr/.test(home + css + searchPage), "remote font or tracker");

const homeAside = (home.match(/<aside class="coming"[\s\S]*?<\/aside>/) || [""])[0];
assert(homeAside, "home Coming up panel missing");
assert(!/state dinner/i.test(homeAside), "Coming up panel still includes the state dinner");
assert(homeAside.includes("Starship Flight 14"), "Coming up panel is missing Starship");
assert(/class="unconfirmed"/.test(homeAside), "unconfirmed items are not marked");

assert(searchPage.includes('data-index="/elon/search-index.json"'), "search index path");
assert(searchPage.includes('src="/elon/js/search.js"'), "search script path");

assert(feed.includes('<feed xmlns="http://www.w3.org/2005/Atom">'), "feed is not Atom");
assert(feed.includes("https://nirajbhusal.github.io/elon/feed.xml"), "feed self link");
assert(feed.includes("T08:04:00+05:45"), "feed times are not 8:04 AM NPT");
assert(!/<pubDate>|<lastBuildDate>|\+0545\b/.test(feed), "feed still uses RFC 822 dates");
const entries = (feed.match(/<entry>/g) || []).length;
assert(entries === Math.min(30, index.length) && entries <= 30, `feed has ${entries} entries`);
if (index[0]) assert(appears(feed, index[0].title), "feed is missing the latest title");

assert(sitemap.includes("<urlset"), "sitemap missing");
assert(sitemap.includes("https://nirajbhusal.github.io/elon/"), "sitemap home");
assert(sitemap.includes("https://nirajbhusal.github.io/elon/search/"), "sitemap search");
if (index[0]) assert(sitemap.includes(`https://nirajbhusal.github.io/elon/${index[0].date}/`), "sitemap digest");

const seedPath = path.join(root, "digests", "2026-09-27.md");
if (fs.existsSync(seedPath)) {
  const seed = fs.readFileSync(seedPath, "utf8");
  const seedPage = read("2026-09-27/index.html");
  assert(!seed.includes("Starbase") && !seedPage.includes("Starbase"), "seed still places him at Starbase");
  assert(seed.includes("weekend in Washington"), "seed no longer says he was in Washington");
  assert(seed.includes("SpaceX acquired xAI in February 2026"), "seed is missing the xAI acquisition");
  assert(!/structure is unconfirmed/i.test(seed), "seed still calls SpaceXAI unconfirmed");
  assert(seed.includes("## Coming up") && seed.includes("## Travel and appearances"), "seed sections were not split");
  assert(!seed.includes("Travel and what's coming up"), "seed still uses the old travel heading");
  for (const id of [
    "2103579616879526057",
    "2103592713249804548",
    "2103539714917609629",
    "2103506666738131032",
    "2103329761690865846",
    "2103892094662349085",
    "2103310060382486715",
    "2103324513526280392",
  ]) {
    assert(seed.includes(`https://x.com/elonmusk/status/${id}`), `seed reply ${id} missing`);
    assert(seedPage.includes(`https://x.com/elonmusk/status/${id}`), `built page reply ${id} missing`);
  }
  const upcoming = comingUpFromFile(seedPath);
  assert(upcoming.length >= 1, "seed Coming up is empty");
  assert(!upcoming.some((item) => /state dinner/i.test(item.text)), "seed Coming up still lists the state dinner");
  assert(upcoming.some((item) => item.unconfirmed), "seed Coming up has no unconfirmed item");
  assert(/aria-label="View on X:/.test(seedPage), "View on X links have no snippet label");
}

const workflow = fs.readFileSync(path.join(root, ".github/workflows/pages.yml"), "utf8");
assert(workflow.includes("workflow_dispatch"), "workflow cannot be run manually");
assert(workflow.includes("actions/deploy-pages"), "workflow does not deploy Pages");
assert(workflow.includes("npm run build") && workflow.includes("npm run check") && workflow.includes("npm run axe"), "workflow steps");

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
assert(readme.includes("## Coming up"), "README does not document Coming up");
assert(readme.includes("## This week in numbers"), "README does not document weekly stats");
assert(readme.includes("YYYY-MM-DD"), "README does not document the date form");

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`Checked ${index.length} digest(s), parser, search, feed, and social tags.`);
