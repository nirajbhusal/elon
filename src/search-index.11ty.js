const { readBody, renderMarkdown, stripHtml } = require("../lib/content");
const { longDate } = require("../lib/dates");
const { publicPath } = require("../lib/urls");

class SearchIndex {
  data() {
    return {
      permalink: "/search-index.json",
      eleventyExcludeFromCollections: true,
    };
  }

  render(data) {
    const items = (data.collections.digests || []).map((item) => ({
      date: item.page.fileSlug,
      dateLabel: longDate(item.date),
      title: item.data.title,
      covers: item.data.covers,
      summary: item.data.summary,
      url: publicPath(item.url),
      text: stripHtml(renderMarkdown(readBody(item.inputPath))),
    }));
    return JSON.stringify(items);
  }
}

module.exports = SearchIndex;
