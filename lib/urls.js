const site = require("../src/_data/site");

function publicPath(urlPath) {
  const prefix = site.basePath || "/";
  if (!urlPath || urlPath === "/") {
    return prefix.endsWith("/") ? prefix : `${prefix}/`;
  }
  if (urlPath === prefix || urlPath.startsWith(prefix)) return urlPath;
  const root = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return root + (urlPath.startsWith("/") ? urlPath : `/${urlPath}`);
}

function absoluteUrl(urlPath) {
  return site.url.replace(/\/$/, "") + publicPath(urlPath);
}

module.exports = { publicPath, absoluteUrl };
