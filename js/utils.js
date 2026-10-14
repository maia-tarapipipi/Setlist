export const $ = (id) => document.getElementById(id);

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromKey(key) {
  const [year, month, day] = String(key || localDateKey())
    .split("-")
    .map(Number);
  return new Date(year, month - 1, day, 12);
}

export function formatDateKey(key) {
  return dateFromKey(key).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function dateKeyFromHistory(entry) {
  if (entry.dateKey) return entry.dateKey;
  if (entry.iso) {
    const date = new Date(entry.iso);
    if (!Number.isNaN(date.getTime())) return localDateKey(date);
  }
  return localDateKey();
}

export function isFutureDate(key) {
  return key > localDateKey();
}

export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}
