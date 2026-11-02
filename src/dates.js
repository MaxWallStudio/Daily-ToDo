export const todayKey = () => dateKey(new Date());
export function dateKey(date) {
  const year = date.getFullYear();
  return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDate(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}
export function validDateKey(key) {
  return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && dateKey(parseDate(key)) === key;
}
export function addDays(key, amount) {
  const date = parseDate(key);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}
export function monthKey(key) { return key.slice(0, 7); }
export function moveMonth(key, amount) {
  const date = parseDate(`${monthKey(key)}-01`);
  date.setMonth(date.getMonth() + amount);
  return dateKey(date);
}
export function prettyDate(key, weekday = true) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', ...(weekday ? { weekday: 'long' } : {}) }).format(parseDate(key));
}
export function prettyMonth(key) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(parseDate(key));
}
export function startOfWeek(key) {
  const day = parseDate(key).getDay();
  return addDays(key, -(day === 0 ? 6 : day - 1));
}
