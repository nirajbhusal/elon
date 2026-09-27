const { isoDate } = require("../lib/dates");
const { absoluteUrl } = require("../lib/urls");
const { xmlEscape } = require("../lib/content");

class Sitemap {
  data() {
    return {
      permalink: "/sitemap.xml",
      eleventyExcludeFromCollections: true,
    };
  }

  render(data) {
    const digests = data.collections.digests || [];
    const latest = digests[0] ? isoDate(digests[0].date) : "";
    const pages = [
      { loc: absoluteUrl("/"), lastmod: latest },
      { loc: absoluteUrl("/search/"), lastmod: latest },
      ...digests.map((item) => ({
        loc: absoluteUrl(item.url),
        lastmod: isoDate(item.date),
      })),
    ];

    const body = pages
      .map((page) => {
        const lastmod = page.lastmod ? `\n    <lastmod>${xmlEscape(page.lastmod)}</lastmod>` : "";
        return `  <url>\n    <loc>${xmlEscape(page.loc)}</loc>${lastmod}\n  </url>`;
      })
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
  }
}

module.exports = Sitemap;
