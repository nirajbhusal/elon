module.exports = {
  layout: "digest.njk",
  tags: ["digest"],
  ogType: "article",
  eleventyComputed: {
    permalink(data) {
      return `/${data.page.fileSlug}/`;
    },
  },
};
