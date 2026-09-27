const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const root = path.resolve(__dirname, "..", "_site");
const port = 4173;
const origin = `http://127.0.0.1:${port}`;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
};

function start() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, origin);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/elon") pathname = "/elon/";
    if (!pathname.startsWith("/elon/")) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    let rel = pathname.slice("/elon/".length);
    if (rel === "" || rel.endsWith("/")) rel = path.join(rel, "index.html");
    const file = path.resolve(root, rel);
    const base = path.resolve(root);
    if (file !== base && !file.startsWith(base + path.sep)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

async function open(page, url, theme) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate((value) => {
    if (value) localStorage.setItem("elon-theme", value);
    else localStorage.removeItem("elon-theme");
  }, theme);
  await page.reload({ waitUntil: "networkidle0" });
}

async function violations(page) {
  await page.addScriptTag({ path: require.resolve("axe-core") });
  return page.evaluate(async () => {
    const result = await axe.run(document, { resultTypes: ["violations"] });
    return result.violations.map((item) => ({
      id: item.id,
      impact: item.impact,
      help: item.help,
      nodes: item.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    }));
  });
}

async function main() {
  if (!fs.existsSync(path.join(root, "index.html"))) {
    throw new Error("Build the site before running axe.");
  }
  const server = await start();
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const failures = [];
  try {
    const pages = [
      ["/", "home"],
      ["/2026-09-27/", "digest"],
      ["/search/", "search"],
    ];
    for (const theme of ["dark", "light"]) {
      for (const [url, name] of pages) {
        const page = await browser.newPage();
        await open(page, `${origin}/elon${url}`, theme);
        const themeOnPage = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
        if (themeOnPage !== theme) failures.push(`${name} ${theme} rendered as ${themeOnPage}`);
        const found = await violations(page);
        if (found.length) {
          failures.push(
            `${name} ${theme}:\n` +
              found.map((item) => `  ${item.id} (${item.impact}) ${item.help} [${item.nodes.join("; ")}]`).join("\n")
          );
        }
        await page.close();
      }
    }

    const page = await browser.newPage();
    await open(page, `${origin}/elon/`, null);
    const defaultTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    if (defaultTheme !== "dark") failures.push(`default theme is ${defaultTheme}`);
    const panel = await page.$eval(".coming", (el) => el.innerText);
    if (/state dinner/i.test(panel)) failures.push("Coming up panel includes the state dinner");
    if (!panel.includes("Starship Flight 14")) failures.push("Coming up panel is missing Starship");
    const hidden = await page.evaluate(() => {
      const item = document.createElement("li");
      item.setAttribute("data-until", "2000-01-01T00:00:00.000Z");
      item.textContent = "past item";
      document.querySelector(".coming ul").appendChild(item);
      window.ElonComing.hidePast(document, Date.now());
      return item.hidden === true && document.querySelector(".coming").hidden === false;
    });
    if (!hidden) failures.push("past Coming up items are not hidden");
    await page.close();

    for (const theme of ["dark", "light"]) {
      const search = await browser.newPage();
      await open(search, `${origin}/elon/search/`, theme);
      await search.waitForSelector("#search-results li");
      await search.click("#q", { clickCount: 3 });
      await search.type("#q", "starship roadster");
      await search.waitForFunction(() => {
        const box = document.querySelector("#search-results");
        return box && /2026-09-27/.test(box.innerHTML) && box.querySelector("mark") && /Roadster/.test(box.innerText);
      });
      const found = await violations(search);
      if (found.length) {
        failures.push(
          `search results ${theme}:\n` +
            found.map((item) => `  ${item.id} (${item.impact}) ${item.help} [${item.nodes.join("; ")}]`).join("\n")
        );
      }
      await search.close();
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  if (failures.length) {
    console.error(failures.join("\n\n"));
    process.exit(1);
  }
  console.log("axe: 0 violations in both themes. Search and Coming up checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
