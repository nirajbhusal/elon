const fs = require("fs");
const MarkdownIt = require("markdown-it");

const X_HOST = /^https?:\/\/(?:www\.)?(?:mobile\.)?(?:x|twitter)\.com\//i;

function snippetBefore(children, index) {
  const parts = [];
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const token = children[cursor];
    if (token.type === "text") parts.unshift(token.content);
    else if (token.type === "softbreak" || token.type === "hardbreak") parts.unshift(" ");
    else if (/^(?:strong|em|s)_/.test(token.type)) continue;
    else break;
  }
  const snippet = parts.join("").replace(/\s+/g, " ").trim();
  if (!snippet) return "";
  return snippet.length > 160 ? snippet.slice(-160).trim() : snippet;
}

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
        const bare = text.content === href;
        const generic = bare || /^view on x$/i.test(text.content.trim());
        if (!generic) continue;
        if (bare) text.content = "View on X";
        const snippet = snippetBefore(children, i);
        const label = snippet ? `View on X: ${snippet}` : "View on X";
        children[i].attrSet("aria-label", label);
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

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

module.exports = {
  markdown,
  renderMarkdown,
  readBody,
  stripHtml,
  xmlEscape,
};
