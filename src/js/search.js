(function () {
  var form = document.getElementById("search-form");
  if (!form) return;

  var input = document.getElementById("q");
  var status = document.getElementById("search-status");
  var results = document.getElementById("search-results");
  var indexUrl = form.getAttribute("data-index");

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlight(value, query) {
    if (!query) return esc(value);
    var re = new RegExp(escapeRegExp(query), "ig");
    var out = "";
    var last = 0;
    var match;
    while ((match = re.exec(value))) {
      out += esc(value.slice(last, match.index));
      out += "<mark>" + esc(match[0]) + "</mark>";
      last = match.index + match[0].length;
      if (match[0].length === 0) break;
    }
    return out + esc(value.slice(last));
  }

  function snippet(text, query) {
    var hay = text.toLowerCase();
    var needle = query.toLowerCase();
    var at = hay.indexOf(needle);
    if (at < 0) return "";
    var start = Math.max(0, at - 70);
    var end = Math.min(text.length, at + needle.length + 110);
    var slice = text.slice(start, end).trim();
    if (start > 0) slice = "…" + slice;
    if (end < text.length) slice += "…";
    return slice;
  }

  function score(item, query) {
    var q = query.toLowerCase();
    if (item.title.toLowerCase().includes(q)) return 0;
    if (item.summary.toLowerCase().includes(q)) return 1;
    if ((item.covers || "").toLowerCase().includes(q)) return 2;
    if ((item.text || "").toLowerCase().includes(q)) return 3;
    return 99;
  }

  function countLabel(count, filtering) {
    if (filtering) {
      if (count === 0) return "No matches";
      return count === 1 ? "1 match" : count + " matches";
    }
    return count === 1 ? "1 digest" : count + " digests";
  }

  function render(index, query) {
    var q = query.trim();
    var ranked = index.map(function (item, i) {
      return { item: item, i: i, score: q ? score(item, q) : 0 };
    });
    if (q) ranked = ranked.filter(function (entry) { return entry.score < 99; });
    ranked.sort(function (a, b) { return a.score - b.score || a.i - b.i; });

    status.textContent = countLabel(ranked.length, Boolean(q));

    if (!ranked.length) {
      results.innerHTML = "";
      return;
    }

    var html = '<ol class="archive-list search-results">';
    ranked.forEach(function (entry) {
      var item = entry.item;
      var extra = "";
      if (q && entry.score === 3) {
        var snip = snippet(item.text || "", q);
        if (snip) extra = '<p class="snippet">' + highlight(snip, q) + "</p>";
      }
      html +=
        '<li class="archive-item">' +
        '<time datetime="' + esc(item.date) + '">' + highlight(item.dateLabel || item.date, q) + "</time>" +
        "<h2><a href=\"" + esc(item.url) + "\">" + highlight(item.title, q) + "</a></h2>" +
        "<p>" + highlight(item.summary || "", q) + "</p>" +
        extra +
        "</li>";
    });
    html += "</ol>";
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
})();
