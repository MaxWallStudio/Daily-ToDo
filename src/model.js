import { addDays, parseDate, startOfWeek, todayKey } from './dates.js';

export const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
export const dayIndex = key => (parseDate(key).getDay() + 6) % 7;
export function revisionFor(habit, date) {
  return [...habit.revisions].reverse().find(revision => revision.from <= date);
}
export function scheduled(habit, date) {
  if (habit.createdDate > date || (habit.archivedDate && habit.archivedDate <= date)) return null;
  const revision = revisionFor(habit, date);
  return revision?.active && revision.repeatDays.includes(dayIndex(date)) ? revision : null;
}
export function entriesFor(data, date) {
  const entries = data.habits.flatMap(habit => {
    const record = data.records.find(item => item.date === date && item.habitId === habit.id);
    const revision = scheduled(habit, date);
    if (!revision && !record) return [];
    const snapshot = record?.snapshot || revision;
    return [{ habit, record, name: snapshot.name, targetMinutes: snapshot.targetMinutes, order: habit.order }];
  });
  return entries.sort((a, b) => a.order - b.order);
}
export function entryRate(entry) {
  if (entry.targetMinutes !== null) return Math.min(1, (entry.record?.minutes || 0) / entry.targetMinutes);
  return entry.record?.completed ? 1 : 0;
}
export function dayRate(data, date) {
  const entries = entriesFor(data, date);
  if (!entries.length) return null;
  return Math.round(entries.reduce((sum, entry) => sum + entryRate(entry), 0) / entries.length * 100);
}
export function average(data, dates) {
  const rates = dates.map(date => dayRate(data, date)).filter(rate => rate !== null);
  return rates.length ? Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length) : null;
}
export function statistics(data, today = todayKey()) {
  const weekStart = startOfWeek(today);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter(date => date <= today);
  const monthDates = [];
  for (let date = `${today.slice(0, 7)}-01`; date <= today; date = addDays(date, 1)) monthDates.push(date);
  const lastSeven = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  let streak = 0;
  const first = data.habits.map(habit => habit.createdDate).sort()[0];
  let cursor = dayRate(data, today) === 100 ? today : addDays(today, -1);
  for (let i = 0; first && cursor >= first && i < 10000; i++, cursor = addDays(cursor, -1)) {
    const rate = dayRate(data, cursor);
    if (rate === null) continue;
    if (rate < 100) break;
    streak++;
  }
  return { streak, week: average(data, weekDates), month: average(data, monthDates), lastSeven };
}
