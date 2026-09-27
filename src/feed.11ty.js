const site = require("./_data/site");
const { readBody, renderMarkdown, xmlEscape } = require("../lib/content");
const { atomDate } = require("../lib/dates");
const { absoluteUrl } = require("../lib/urls");

const FEED_LIMIT = 30;

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
    const digests = (data.collections.digests || []).slice(0, FEED_LIMIT);
    const updated = digests.length ? atomDate(digests[0].date) : new Date().toISOString();

    const entries = digests
      .map((item) => {
        const link = absoluteUrl(item.url);
        const html = renderMarkdown(readBody(item.inputPath));
        const summary = `${item.data.covers} — ${item.data.summary}`.trim();
        const when = atomDate(item.date);
        return `  <entry>
    <title>${xmlEscape(item.data.title)}</title>
    <link href="${xmlEscape(link)}" rel="alternate" type="text/html"/>
    <id>${xmlEscape(link)}</id>
    <published>${when}</published>
    <updated>${when}</updated>
    <summary>${xmlEscape(summary)}</summary>
    <content type="html">${xmlEscape(html)}</content>
  </entry>`;
      })
      .join("\n");

    return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${xmlEscape(site.title)}</title>
  <subtitle>${xmlEscape(site.description)}</subtitle>
  <link href="${xmlEscape(home)}" rel="alternate" type="text/html"/>
  <link href="${xmlEscape(self)}" rel="self" type="application/atom+xml"/>
  <id>${xmlEscape(home)}</id>
  <updated>${updated}</updated>
  <author><name>${xmlEscape(site.author)}</name></author>
${entries}
</feed>
`;
  }
}

module.exports = Feed;
