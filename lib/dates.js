const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return {
    y: date.getUTCFullYear(),
    m: date.getUTCMonth(),
    d: date.getUTCDate(),
    w: date.getUTCDay(),
  };
}

function isoDate(value) {
  const p = parts(value);
  return `${p.y}-${String(p.m + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

function longDate(value) {
  const p = parts(value);
  return `${WEEKDAYS[p.w]}, ${MONTHS[p.m]} ${p.d}, ${p.y}`;
}

function shortDate(value) {
  const p = parts(value);
  return `${MONTHS_SHORT[p.m]} ${p.d}, ${p.y}`;
}

// Digest files are a calendar day. Feeds use 8:04 AM Nepal Time (UTC+5:45).
function atomDate(value) {
  const p = parts(value);
  const month = String(p.m + 1).padStart(2, "0");
  const day = String(p.d).padStart(2, "0");
  return `${p.y}-${month}-${day}T08:04:00+05:45`;
}

module.exports = { isoDate, longDate, shortDate, atomDate };
