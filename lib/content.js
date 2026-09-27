const fs = require("fs");
const MarkdownIt = require("markdown-it");

const X_HOST = /^https?:\/\/(?:www\.)?(?:mobile\.)?(?:x|twitter)\.com\//i;

function createMarkdown() {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
    breaks: false,
  });

  const defaultOpen =
    md.renderer.rules.link_open ||
    function (tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };

  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    const href = tokens[idx].attrGet("href") || "";
    if (X_HOST.test(href)) {
      tokens[idx].attrSet("target", "_blank");
      const rel = new Set((tokens[idx].attrGet("rel") || "").split(/\s+/).filter(Boolean));
      rel.add("noopener");
      rel.add("noreferrer");
      tokens[idx].attrSet("rel", [...rel].join(" "));
    }
    return defaultOpen(tokens, idx, options, env, self);
  };

  // Bare status URLs are long and break the measure on a phone. Keep the href.
  md.core.ruler.push("shorten_x_autolinks", (state) => {
    for (const token of state.tokens) {
      if (token.type !== "inline" || !token.children) continue;
      const children = token.children;
      for (let i = 0; i < children.length; i++) {
        if (children[i].type !== "link_open") continue;
        const href = children[i].attrGet("href") || "";
        const text = children[i + 1];
        if (!text || text.type !== "text" || !X_HOST.test(href)) continue;
        if (text.content === href) text.content = "View on X";
      }
    }
  });

  return md;
}

const markdown = createMarkdown();

function renderMarkdown(source) {
  return markdown.render(source || "");
}

function readBody(inputPath) {
  const raw = fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, "");
  if (!raw.startsWith("---")) return raw;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return raw;
  return raw.slice(end + 4).replace(/^\r?\n/, "");
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function comingUpFromHtml(html) {
  const heading = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let match;
  while ((match = heading.exec(html))) {
    const label = stripHtml(match[1]).replace(/[’‘]/g, "'").toLowerCase();
    if (label !== "travel and what's coming up") continue;
    const after = html.slice(match.index + match[0].length);
    const nextHeading = after.search(/<h2\b/i);
    const region = nextHeading === -1 ? after : after.slice(0, nextHeading);
    const list = region.match(/<ul>([\s\S]*?)<\/ul>/i);
    if (!list) return [];
    const items = [];
    const item = /<li>([\s\S]*?)<\/li>/gi;
    let found;
    while ((found = item.exec(list[1]))) {
      const htmlItem = found[1].trim();
      if (htmlItem) items.push(htmlItem);
    }
    return items;
  }
  return [];
}

function comingUpFromFile(inputPath) {
  if (!inputPath) return [];
  return comingUpFromHtml(renderMarkdown(readBody(inputPath)));
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(value) {
  return `<![CDATA[${String(value ?? "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

module.exports = {
  markdown,
  renderMarkdown,
  readBody,
  stripHtml,
  comingUpFromHtml,
  comingUpFromFile,
  xmlEscape,
  cdata,
};
