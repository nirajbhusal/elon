(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ElonSearch = api;
  if (typeof document !== "undefined") boot(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function terms(query) {
    return String(query || "")
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
  }

  function fields(item) {
    return [
      item && item.title,
      item && item.summary,
      item && item.covers,
      item && item.text,
    ].map(function (value) {
      return String(value || "");
    });
  }

  function matches(item, list) {
    if (!list.length) return true;
    var hay = fields(item).join("\n").toLowerCase();
    return list.every(function (term) {
      return hay.indexOf(term) !== -1;
    });
  }

  function firstHit(text, list) {
    var lower = text.toLowerCase();
    var at = -1;
    var len = 0;
    list.forEach(function (term) {
      var found = lower.indexOf(term);
      if (found !== -1 && (at === -1 || found < at)) {
        at = found;
        len = term.length;
      }
    });
    return { at: at, len: len };
  }

  function windowText(text, at, len) {
    var start = Math.max(0, at - 80);
    var end = Math.min(text.length, at + len + 120);
    var slice = text.slice(start, end).replace(/\s+/g, " ").trim();
    if (start > 0) slice = "…" + slice;
    if (end < text.length) slice += "…";
    return slice;
  }

  function snippets(item, list) {
    if (!list.length) return [];
    var found = [];
    var covered = {};
    fields(item).forEach(function (value) {
      if (found.length >= 2) return;
      var missing = list.filter(function (term) {
        return !covered[term];
      });
      if (!missing.length) return;
      var hit = firstHit(value, found.length ? missing : list);
      if (hit.at < 0) return;
      var snippet = windowText(value, hit.at, hit.len);
      found.push(snippet);
      var lower = snippet.toLowerCase();
      list.forEach(function (term) {
        if (lower.indexOf(term) !== -1) covered[term] = true;
      });
    });
    return found;
  }

  function highlight(value, list) {
    var source = String(value == null ? "" : value);
    if (!list || !list.length) return escapeHtml(source);
    var re = new RegExp(list.map(escapeRegExp).join("|"), "ig");
    var out = "";
    var last = 0;
    var match;
    while ((match = re.exec(source))) {
      out += escapeHtml(source.slice(last, match.index));
      out += "<mark>" + escapeHtml(match[0]) + "</mark>";
      last = match.index + match[0].length;
      if (match[0].length === 0) break;
    }
    return out + escapeHtml(source.slice(last));
  }

  function renderItems(index, query) {
    var list = terms(query);
    var ranked = [];
    (index || []).forEach(function (item, i) {
      if (matches(item, list)) ranked.push({ item: item, i: i });
    });
    if (!ranked.length) return "";
    var html = '<ol class="archive-list search-results">';
    ranked.forEach(function (entry) {
      var item = entry.item;
      var extra = snippets(item, list)
        .map(function (snippet) {
          return '<p class="snippet">' + highlight(snippet, list) + "</p>";
        })
        .join("");
      html +=
        '<li class="archive-item">' +
        '<time datetime="' +
        escapeHtml(item.date) +
        '">' +
        highlight(item.dateLabel || item.date, list) +
        "</time>" +
        '<h2><a href="' +
        escapeHtml(item.url) +
        '">' +
        highlight(item.title, list) +
        "</a></h2>" +
        "<p>" +
        highlight(item.summary || "", list) +
        "</p>" +
        extra +
        "</li>";
    });
    html += "</ol>";
    return html;
  }

  return {
    terms: terms,
    matches: matches,
    snippets: snippets,
    highlight: highlight,
    renderItems: renderItems,
  };
});

function boot(api) {
  var form = document.getElementById("search-form");
  if (!form) return;

  var input = document.getElementById("q");
  var status = document.getElementById("search-status");
  var results = document.getElementById("search-results");
  var indexUrl = form.getAttribute("data-index");

  function countLabel(count, filtering) {
    if (filtering) {
      if (count === 0) return "No matches";
      return count === 1 ? "1 match" : count + " matches";
    }
    return count === 1 ? "1 digest" : count + " digests";
  }

  function render(index, query) {
    var list = api.terms(query);
    var html = api.renderItems(index, query);
    var count = html ? (html.match(/<li class="archive-item">/g) || []).length : 0;
    status.textContent = countLabel(count, list.length > 0);
    results.innerHTML = html;
  }

  function writeQuery(query) {
    var url = new URL(window.location.href);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  }

  status.textContent = "Loading search index…";

  fetch(indexUrl)
    .then(function (response) {
      if (!response.ok) throw new Error("bad status");
      return response.json();
    })
    .then(function (index) {
      if (!Array.isArray(index)) throw new Error("bad index");

      function update() {
        render(index, input.value);
        writeQuery(input.value.trim());
      }

      var initial = new URLSearchParams(window.location.search).get("q") || "";
      if (initial) {
        input.value = initial;
        input.setSelectionRange(input.value.length, input.value.length);
      }
      render(index, input.value);

      input.addEventListener("input", update);
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        update();
      });
    })
    .catch(function () {
      status.textContent = "Search index could not be loaded.";
    });
}
