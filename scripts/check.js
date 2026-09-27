const fs = require("fs");
const path = require("path");
const { comingUpFromFile, stripHtml, xmlEscape } = require("../lib/content");

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

function appears(html, text) {
  if (html.includes(text)) return true;
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  return html.includes(escaped);
}

function anchors(html) {
  return html.match(/<a\b[^>]*>/gi) || [];
}

const home = read("index.html");
const seedPage = read("2026-09-27/index.html");
const searchPage = read("search/index.html");
const feed = read("feed.xml");
const indexRaw = read("search-index.json");
const css = read("css/site.css");
read("js/search.js");
read("favicon.svg");
read("404.html");

assert(!fs.existsSync(path.join(siteDir, "digests")), "digest sources were copied into the output");
assert(!fs.existsSync(path.join(siteDir, "src")), "source templates were copied into the output");

let index = [];
try {
  index = JSON.parse(indexRaw);
} catch (error) {
  failures.push(`search-index.json is not JSON: ${error.message}`);
}

assert(Array.isArray(index) && index.length > 0, "search index is empty");

if (Array.isArray(index) && index.length) {
  const newest = index[0];
  assert(newest.url && newest.url.startsWith("/elon/"), `newest url is not under /elon/: ${newest.url}`);
  assert(appears(home, newest.title), "home page is missing the latest title");
  assert(appears(home, newest.summary), "home page is missing the latest summary");
  assert(appears(home, newest.covers), "home page is missing the latest covers line");
  assert(home.includes('id="coming-title"') || comingUpFromFile(path.join(root, "digests", `${newest.date}.md`)).length === 0, "home page dropped Coming up");

  const newestComing = comingUpFromFile(path.join(root, "digests", `${newest.date}.md`));
  if (newestComing.length) {
    const sample = stripHtml(newestComing[0]).split(/[,.—]/)[0].trim();
    assert(sample && appears(home, sample), "home Coming up panel is missing the latest list");
  }

  const archiveHrefs = [...home.matchAll(/class="archive-title"[^>]*href="([^"]+)"/g)].map((match) => match[1]);
  const olderUrls = index.slice(1).map((item) => item.url);
  assert(
    archiveHrefs.length === olderUrls.length && archiveHrefs.every((href, i) => href === olderUrls[i]),
    `archive links ${JSON.stringify(archiveHrefs)} != older digests ${JSON.stringify(olderUrls)}`
  );

  for (const item of index) {
    assert(/^\d{4}-\d{2}-\d{2}$/.test(item.date), `bad index date ${item.date}`);
    assert(item.url === `/elon/${item.date}/`, `index url ${item.url} does not match date ${item.date}`);
    assert(item.title && item.summary && item.covers && item.text, `index entry ${item.date} is missing fields`);
    const page = read(`${item.date}/index.html`);
    assert(appears(page, item.title), `${item.date} page is missing its title`);
    assert(appears(page, item.summary), `${item.date} page is missing its summary`);
    assert(page.includes('href="/elon/"'), `${item.date} page is missing the home link`);
    assert(page.includes('href="/elon/css/site.css"'), `${item.date} page is missing the stylesheet`);

    const tags = anchors(page);
    const xLinks = tags.filter((tag) => /href="https?:\/\/(?:www\.)?(?:x|twitter)\.com\//.test(tag));
    for (const tag of xLinks) {
      assert(/target="_blank"/.test(tag), `x.com link missing target=_blank: ${tag}`);
      assert(/rel="[^"]*noopener/.test(tag), `x.com link missing noopener: ${tag}`);
    }
    const otherExternal = tags.filter(
      (tag) => /href="https?:\/\//.test(tag) && !/href="https?:\/\/(?:www\.)?(?:x|twitter)\.com\//.test(tag)
    );
    for (const tag of otherExternal) {
      assert(!/target=/.test(tag), `non-x link should stay in the same tab: ${tag}`);
    }
    if (item.date === "2026-09-27") {
      assert(xLinks.length > 0, "seed page has no x.com links");
      assert(otherExternal.length > 0, "seed page has no source links");
      assert(page.includes("View on X"), "seed page still shows raw x.com URLs");
    }

    const assetTags = page.match(/<(?:script|link)\b[^>]*>/gi) || [];
    for (const tag of assetTags) {
      if (/rel="canonical"|rel="alternate"|rel="icon"/.test(tag)) continue;
      assert(!/https?:\/\//.test(tag), `external asset on ${item.date}: ${tag}`);
    }
  }
}

assert(appears(seedPage, "September 27, 2026"), "seed page has the wrong date");
assert(appears(seedPage, "2:05 PM NPT"), "seed page is missing the covers line");
assert(seedPage.includes("Who he replied to"), "seed page is not the full digest");
assert(seedPage.includes("Mandate of Heaven"), "seed page is missing body text");

const seedComing = comingUpFromFile(path.join(root, "digests", "2026-09-27.md"));
assert(seedComing.length === 3, `expected 3 coming-up items, got ${seedComing.length}`);
assert(seedComing.some((item) => item.includes("Starship Flight 14")), "coming up is missing Starship");
assert(seedComing.some((item) => item.includes("Tesla Roadster")), "coming up is missing the Roadster");
assert(seedComing.some((item) => stripHtml(item).includes("state dinner")), "coming up is missing the state dinner");
assert(seedPage.includes("Starship Flight 14"), "seed page is missing Starship");

assert(home.includes('href="/elon/css/site.css"'), "home stylesheet is not under /elon/");
assert(home.includes('href="/elon/search/"'), "home is missing the search link");
assert(home.includes('href="/elon/feed.xml"'), "home is missing the feed link");
assert(home.includes("No earlier digests yet.") || index.length > 1, "single-digest archive state is wrong");
assert(!/fonts\.googleapis|googletagmanager|google-analytics|cdn\.jsdelivr/.test(home + css), "page pulls a tracker or remote font");

assert(searchPage.includes('data-index="/elon/search-index.json"'), "search page index path is wrong");
assert(searchPage.includes('src="/elon/js/search.js"'), "search script path is wrong");

assert(feed.includes('<rss version="2.0"'), "feed is not RSS 2.0");
assert(feed.includes("https://nirajbhusal.github.io/elon/feed.xml"), "feed self link is wrong");
assert(feed.includes("+0545"), "feed dates are not Nepal Time");
const itemCount = (feed.match(/<item>/g) || []).length;
assert(itemCount === index.length, `feed has ${itemCount} items, index has ${index.length}`);
if (index[0]) {
  assert(feed.includes(xmlEscape(index[0].title)), "feed is missing the latest title");
  assert(feed.includes("Musk spent the weekend"), "feed is missing the digest body");
}
assert(index.some((item) => item.date === "2026-09-27" && /Colossus/.test(item.text)), "search index is missing the seed body");

const workflow = fs.readFileSync(path.join(root, ".github/workflows/pages.yml"), "utf8");
assert(workflow.includes("workflow_dispatch"), "workflow cannot be run manually");
assert(workflow.includes("actions/deploy-pages"), "workflow does not deploy Pages");
assert(workflow.includes("npm run build"), "workflow does not build");

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`Checked ${index.length} digest(s), home, search, and feed.`);
