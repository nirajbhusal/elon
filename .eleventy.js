const fs = require("fs");
const path = require("path");
const site = require("./src/_data/site");
const { markdown, comingUpFromFile } = require("./lib/content");
const { isoDate, longDate, shortDate, rfc822 } = require("./lib/dates");

module.exports = function (eleventyConfig) {
  eleventyConfig.on("eleventy.before", () => {
    fs.rmSync(path.join(__dirname, "_site"), { recursive: true, force: true });
  });

  eleventyConfig.setLibrary("md", markdown);
  eleventyConfig.setTemplateFormats(["md", "njk", "11ty.js"]);

  eleventyConfig.addPassthroughCopy({ "src/css": "css" });
  eleventyConfig.addPassthroughCopy({ "src/js": "js" });
  eleventyConfig.addPassthroughCopy({ "src/favicon.svg": "favicon.svg" });

  eleventyConfig.ignores.add("README.md");
  eleventyConfig.ignores.add("**/README.md");

  eleventyConfig.addFilter("isoDate", isoDate);
  eleventyConfig.addFilter("digestDate", longDate);
  eleventyConfig.addFilter("digestDateShort", shortDate);
  eleventyConfig.addFilter("rfc822", rfc822);
  eleventyConfig.addFilter("comingUp", comingUpFromFile);

  eleventyConfig.addFilter("digestNav", (collection, url) => {
    if (!Array.isArray(collection)) return { older: null, newer: null };
    const index = collection.findIndex((item) => item.url === url);
    if (index === -1) return { older: null, newer: null };
    return {
      older: collection[index + 1] || null,
      newer: index > 0 ? collection[index - 1] : null,
    };
  });

  eleventyConfig.addCollection("digests", (api) => {
    const items = api.getFilteredByTag("digest").slice();
    for (const item of items) {
      const slug = item.page.fileSlug;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(slug)) {
        throw new Error(`${item.inputPath} must be named digests/YYYY-MM-DD.md.`);
      }
      const fromFrontMatter = isoDate(item.date);
      if (fromFrontMatter !== slug) {
        throw new Error(
          `${item.inputPath} is named ${slug}.md but front matter date is ${fromFrontMatter}. They must match.`
        );
      }
      for (const field of ["title", "covers", "summary"]) {
        if (typeof item.data[field] !== "string" || item.data[field].trim() === "") {
          throw new Error(`${item.inputPath} is missing front matter "${field}".`);
        }
      }
    }
    items.sort((a, b) => {
      const byDate = b.date - a.date;
      if (byDate !== 0) return byDate;
      return a.page.fileSlug < b.page.fileSlug ? 1 : -1;
    });
    return items;
  });

  return {
    pathPrefix: site.basePath,
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk",
    dir: {
      input: ".",
      includes: "src/_includes",
      data: "src/_data",
      output: "_site",
    },
  };
};
