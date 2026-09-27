const { renderMarkdown, readBody, stripHtml } = require("./content");

const NPT_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

const MONTHS = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const PREFERRED_HEADING = "coming up";
const FALLBACK_HEADING = "travel and what's coming up";

function nptToIso(year, monthIndex, day, hour, minute) {
  const utc = Date.UTC(year, monthIndex, day, hour, minute) - NPT_OFFSET_MS;
  return new Date(utc).toISOString();
}

function contextParts(contextIso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(contextIso || "");
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

function yearFor(monthIndex, day, contextIso) {
  const context = contextParts(contextIso);
  const year = context ? context.y : new Date().getUTCFullYear();
  if (!context) return year;
  const digest = Date.UTC(context.y, context.m, context.d);
  const candidate = Date.UTC(year, monthIndex, day);
  if (candidate < digest - 180 * 24 * 60 * 60 * 1000) return year + 1;
  return year;
}

function clock(hourText, minuteText, meridiem) {
  let hour = Number(hourText);
  const minute = minuteText == null ? 0 : Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (meridiem) {
    const pm = meridiem.toLowerCase() === "pm";
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
  }
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function parseUntil(text, contextIso) {
  const source = String(text || "")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[t ](\d{2}):(\d{2}))?\b/i.exec(source);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]) - 1;
    const day = Number(iso[3]);
    if (iso[4]) return nptToIso(year, month, day, Number(iso[4]), Number(iso[5]));
    return nptToIso(year, month, day, 23, 59);
  }

  let rest = source.replace(/^~+\s*/, "");
  rest = rest.replace(/^(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s+/i, "");
  rest = rest.replace(/^~+\s*/, "");
  const human =
    /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,)?(?:\s+(\d{1,2})(?::(\d{2}))?(?:\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?)?\s*(am|pm)?)?(?:\s*npt)?\b/i.exec(
      rest
    );
  if (!human) return null;
  const month = MONTHS[human[1].toLowerCase()];
  const day = Number(human[2]);
  if (month == null || day < 1 || day > 31) return null;
  const year = yearFor(month, day, contextIso);
  if (!human[3]) return nptToIso(year, month, day, 23, 59);
  const end = human[5] ? clock(human[5], human[6], human[7]) : clock(human[3], human[4], human[7]);
  if (!end) return nptToIso(year, month, day, 23, 59);
  return nptToIso(year, month, day, end.hour, end.minute);
}

function headingLabel(html) {
  return stripHtml(html)
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findSections(html) {
  const re = /<h2\b[^>]*>[\s\S]*?<\/h2>/gi;
  const marks = [];
  let match;
  while ((match = re.exec(html))) {
    marks.push({
      start: match.index,
      headingEnd: match.index + match[0].length,
      label: headingLabel(match[0]),
      html: match[0],
    });
  }
  return marks.map((mark, index) => ({
    ...mark,
    end: index + 1 < marks.length ? marks[index + 1].start : html.length,
  }));
}

function balancedElement(html, tag) {
  const openRe = new RegExp(`<${tag}\\b[^>]*>`, "i");
  const open = openRe.exec(html);
  if (!open) return null;
  const tokenRe = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, "gi");
  tokenRe.lastIndex = open.index;
  let depth = 0;
  let token;
  while ((token = tokenRe.exec(html))) {
    depth += token[0][1] === "/" ? -1 : 1;
    if (depth === 0) {
      const innerStart = open.index + open[0].length;
      return html.slice(innerStart, token.index);
    }
  }
  return null;
}

function topLevelItems(listInner) {
  const tokenRe = /<li\b[^>]*>|<\/li>/gi;
  const marks = [];
  let token;
  while ((token = tokenRe.exec(listInner))) {
    marks.push({
      index: token.index,
      length: token[0].length,
      open: token[0][1] !== "/",
    });
  }
  const items = [];
  let depth = 0;
  let start = null;
  for (const mark of marks) {
    if (mark.open) {
      if (depth === 0) start = mark.index + mark.length;
      depth += 1;
    } else {
      depth -= 1;
      if (depth === 0 && start != null) items.push(listInner.slice(start, mark.index).trim());
      if (depth < 0) depth = 0;
    }
  }
  return items.filter(Boolean);
}

function sectionItems(region, contextIso) {
  const listInner = balancedElement(region, "ul") || balancedElement(region, "ol");
  if (listInner == null) return [];
  return topLevelItems(listInner).map((html) => {
    const text = stripHtml(html);
    return {
      html,
      text,
      until: parseUntil(text, contextIso),
      unconfirmed: /unconfirmed|\(unconfirmed\)/i.test(text),
    };
  });
}

function chooseSection(sections) {
  return (
    sections.find((section) => section.label === PREFERRED_HEADING) ||
    sections.find((section) => section.label === FALLBACK_HEADING) ||
    null
  );
}

function comingUpFromHtml(html, contextIso) {
  const sections = findSections(html || "");
  const section = chooseSection(sections);
  if (!section) return [];
  const region = html.slice(section.headingEnd, section.end);
  return sectionItems(region, contextIso);
}

function contextFromPath(inputPath) {
  const match = /(\d{4}-\d{2}-\d{2})\.md$/.exec(inputPath || "");
  return match ? match[1] : null;
}

function comingUpFromFile(inputPath) {
  if (!inputPath) return [];
  return comingUpFromHtml(renderMarkdown(readBody(inputPath)), contextFromPath(inputPath));
}

function stripComingSection(html) {
  const sections = findSections(html || "");
  const section = chooseSection(sections);
  if (!section) return html || "";
  return `${html.slice(0, section.start)}${html.slice(section.end)}`.replace(/\n{3,}/g, "\n\n");
}

function escapeText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decorateStats(html) {
  const sections = findSections(html || "");
  const section = sections.find((item) => item.label === "this week in numbers");
  if (!section) return html || "";
  let region = html.slice(section.headingEnd, section.end);
  const listInner = balancedElement(region, "ul");
  if (listInner != null) {
    const listHtml = `<ul>${listInner}</ul>`;
    const items = topLevelItems(listInner)
      .map((item) => {
        const text = stripHtml(item).replace(/\s+/g, " ").trim();
        const share = /^(.+?):\s*(\d{1,3}(?:\.\d+)?)%$/.exec(text);
        if (!share) return `<li>${item}</li>`;
        const pct = Math.max(0, Math.min(100, Number(share[2])));
        return `<li class="stat-row"><span class="stat-name">${escapeText(share[1])}</span><span class="stat-track" aria-hidden="true"><span class="stat-fill" style="width:${pct}%"></span></span><span class="stat-value">${escapeText(share[2])}%</span></li>`;
      })
      .join("");
    region = region.replace(listHtml, `<ul class="stat-list">${items}</ul>`);
  }
  region = region.replace(/<table\b/gi, '<table class="stat-table"');
  const wrapped = `<section class="stats">${section.html}${region}</section>`;
  return `${html.slice(0, section.start)}${wrapped}${html.slice(section.end)}`;
}

function pageBody(html) {
  return decorateStats(stripComingSection(html));
}

module.exports = {
  parseUntil,
  comingUpFromHtml,
  comingUpFromFile,
  stripComingSection,
  decorateStats,
  pageBody,
  topLevelItems,
};
