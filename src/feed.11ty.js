const site = require("./_data/site");
const { readBody, renderMarkdown, xmlEscape, cdata } = require("../lib/content");
const { rfc822 } = require("../lib/dates");
const { absoluteUrl } = require("../lib/urls");

class Feed {
  data() {
    return {
      permalink: "/feed.xml",
      eleventyExcludeFromCollections: true,
    };
  }

  render(data) {
    const home = absoluteUrl("/");
    const self = absoluteUrl("/feed.xml");
    const digests = data.collections.digests || [];
    const lastBuild = digests.length ? `<lastBuildDate>${rfc822(digests[0].date)}</lastBuildDate>` : "";

    const items = digests
      .map((item) => {
        const link = absoluteUrl(item.url);
        const html = renderMarkdown(readBody(item.inputPath));
        const description = `${item.data.covers} — ${item.data.summary}`.trim();
        return `    <item>
      <title>${xmlEscape(item.data.title)}</title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="true">${xmlEscape(link)}</guid>
      <pubDate>${rfc822(item.date)}</pubDate>
      <description>${xmlEscape(description)}</description>
      <content:encoded>${cdata(html)}</content:encoded>
    </item>`;
      })
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${xmlEscape(site.title)}</title>
    <link>${xmlEscape(home)}</link>
    <atom:link href="${xmlEscape(self)}" rel="self" type="application/rss+xml"/>
    <description>${xmlEscape(site.description)}</description>
    <language>${xmlEscape(site.language)}</language>
    <generator>Eleventy</generator>
    ${lastBuild}
${items}
  </channel>
</rss>
`;
  }
}

module.exports = Feed;
