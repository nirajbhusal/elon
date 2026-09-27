(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ElonComing = api;
  if (typeof document !== "undefined") api.hidePast(document, Date.now());
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function hidePast(scope, now) {
    if (!scope || !scope.querySelectorAll) return;
    var clock = typeof now === "number" ? now : Date.now();
    var panels = scope.querySelectorAll("[data-coming]");
    Array.prototype.forEach.call(panels, function (panel) {
      var items = panel.querySelectorAll("li");
      var visible = 0;
      Array.prototype.forEach.call(items, function (item) {
        var until = item.getAttribute("data-until");
        var stamp = until ? Date.parse(until) : NaN;
        if (until && !Number.isNaN(stamp) && stamp <= clock) item.hidden = true;
        else visible += 1;
      });
      if (items.length && visible === 0) panel.hidden = true;
    });
  }

  return { hidePast: hidePast };
});
