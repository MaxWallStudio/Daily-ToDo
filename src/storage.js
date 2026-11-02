import { todayKey, validDateKey } from './dates.js';

const KEY = 'daily-life-log:v1';
export const emptyData = () => ({ version: 1, habits: [], records: [], journals: [], settings: { theme: 'system' } });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const target = value => value === null || (Number.isInteger(value) && value > 0 && value <= 1440);
const revision = value => object(value) && validDateKey(value.from) && typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 100 && target(value.targetMinutes) && Array.isArray(value.repeatDays) && value.repeatDays.length > 0 && value.repeatDays.length <= 7 && new Set(value.repeatDays).size === value.repeatDays.length && value.repeatDays.every(day => Number.isInteger(day) && day >= 0 && day <= 6) && typeof value.active === 'boolean';

export function validateData(data) {
  if (!object(data) || data.version !== 1 || !Array.isArray(data.habits) || !Array.isArray(data.records) || !Array.isArray(data.journals) || !object(data.settings) || !['system', 'light', 'dark'].includes(data.settings.theme)) throw new Error('지원하지 않는 백업 형식입니다.');
  const habitIds = new Set();
  for (const habit of data.habits) {
    if (!object(habit) || !id(habit.id) || habitIds.has(habit.id) || !validDateKey(habit.createdDate) || (habit.archivedDate !== null && !validDateKey(habit.archivedDate)) || (habit.archivedDate && habit.archivedDate < habit.createdDate) || !Number.isInteger(habit.order) || !Array.isArray(habit.revisions) || !habit.revisions.length || !habit.revisions.every(revision) || habit.revisions[0].from !== habit.createdDate || habit.revisions.some((r, i) => i > 0 && r.from <= habit.revisions[i - 1].from)) throw new Error('활동 데이터가 올바르지 않습니다.');
    habitIds.add(habit.id);
  }
  const recordKeys = new Set();
  for (const record of data.records) {
    const key = `${record?.date}:${record?.habitId}`;
    if (!object(record) || !validDateKey(record.date) || !habitIds.has(record.habitId) || recordKeys.has(key) || !Number.isInteger(record.minutes) || record.minutes < 0 || record.minutes > 100000 || typeof record.completed !== 'boolean' || !object(record.snapshot) || !revision({ ...record.snapshot, from: record.date })) throw new Error('활동 기록이 올바르지 않습니다.');
    recordKeys.add(key);
  }
  const journalDates = new Set();
  for (const journal of data.journals) {
    if (!object(journal) || !validDateKey(journal.date) || journalDates.has(journal.date) || typeof journal.content !== 'string' || journal.content.length > 1000000 || !Number.isFinite(Date.parse(journal.createdAt)) || !Number.isFinite(Date.parse(journal.updatedAt))) throw new Error('일기 데이터가 올바르지 않습니다.');
    journalDates.add(journal.date);
  }
  return data;
}
export function loadData() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return emptyData();
  try { return validateData(JSON.parse(raw)); }
  catch { throw new Error('저장된 데이터를 읽을 수 없습니다. 브라우저 저장소를 확인해 주세요.'); }
}
export function saveData(data) {
  validateData(data);
  localStorage.setItem(KEY, JSON.stringify(data));
}
export function newHabit(name, targetMinutes, repeatDays, order) {
  const date = todayKey();
  return { id: crypto.randomUUID(), createdDate: date, archivedDate: null, order, revisions: [{ from: date, name, targetMinutes, repeatDays, active: true }] };
}
export function upsertRevision(habit, values) {
  const date = todayKey();
  const revisions = habit.revisions.filter(item => item.from < date);
  revisions.push({ from: date, ...values });
  return { ...habit, revisions };
}
export function upsertRecord(data, date, habitId, update) {
  const habit = data.habits.find(item => item.id === habitId);
  if (!habit) throw new Error('활동을 찾을 수 없습니다.');
  const existing = data.records.find(item => item.date === date && item.habitId === habitId);
  const revision = [...habit.revisions].reverse().find(item => item.from <= date);
  if (!existing && !revision) throw new Error('해당 날짜의 활동을 찾을 수 없습니다.');
  const record = { date, habitId, minutes: 0, completed: false, snapshot: { name: revision.name, targetMinutes: revision.targetMinutes, repeatDays: [...revision.repeatDays], active: revision.active }, ...existing, ...update };
  data.records = [...data.records.filter(item => !(item.date === date && item.habitId === habitId)), record];
}
export function upsertJournal(data, date, content) {
  const existing = data.journals.find(item => item.date === date);
  data.journals = data.journals.filter(item => item.date !== date);
  if (content.trim()) {
    const now = new Date().toISOString();
    data.journals.push({ date, content, createdAt: existing?.createdAt || now, updatedAt: now });
  }
}
