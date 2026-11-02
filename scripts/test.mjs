import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const url = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const datesUrl = url(await readFile('src/dates.js', 'utf8'));
const modelUrl = url((await readFile('src/model.js', 'utf8')).replace("'./dates.js'", `'${datesUrl}'`));
const storageUrl = url((await readFile('src/storage.js', 'utf8')).replace("'./dates.js'", `'${datesUrl}'`));
const dates = await import(datesUrl);
const model = await import(modelUrl);
const storage = await import(storageUrl);

assert.equal(dates.dateKey(new Date(2026, 10, 2)), '2026-11-02');
assert.equal(dates.addDays('2026-12-31', 1), '2027-01-01');
assert.equal(dates.addDays('2026-03-08', 1), '2026-03-09');
assert.equal(dates.validDateKey('2026-02-30'), false);

const data = storage.emptyData();
const monday = { id: 'math', createdDate: '2026-10-01', archivedDate: null, order: 0, revisions: [
  { from: '2026-10-01', name: '수학', targetMinutes: 60, repeatDays: [0], active: true },
  { from: '2026-11-03', name: '새 수학', targetMinutes: 30, repeatDays: [0], active: true }
] };
const daily = { id: 'reading', createdDate: '2026-10-01', archivedDate: null, order: 1, revisions: [
  { from: '2026-10-01', name: '독서', targetMinutes: null, repeatDays: [0, 1, 2, 3, 4, 5, 6], active: true }
] };
data.habits.push(monday, daily);
assert.equal(model.entriesFor(data, '2026-11-02').length, 2);
assert.equal(model.entriesFor(data, '2026-11-03').length, 1);
assert.equal(model.entriesFor(data, '2026-11-09')[0].targetMinutes, 30);
assert.equal(model.dayRate(data, '2026-11-01'), 0);
storage.upsertRecord(data, '2026-11-02', 'math', { minutes: 45 });
storage.upsertRecord(data, '2026-11-02', 'reading', { completed: true });
assert.equal(model.dayRate(data, '2026-11-02'), 88);
storage.upsertRecord(data, '2026-11-02', 'math', { minutes: 90 });
assert.equal(model.dayRate(data, '2026-11-02'), 100);
assert.equal(data.records.find(record => record.habitId === 'math').snapshot.targetMinutes, 60);
monday.archivedDate = '2026-11-03';
assert.equal(model.entriesFor(data, '2026-11-02').length, 2);
assert.equal(model.entriesFor(data, '2026-11-09').length, 1);
storage.upsertJournal(data, '2026-11-02', '좋은 하루');
storage.upsertJournal(data, '2026-11-02', '수정한 하루');
assert.equal(data.journals.length, 1);
assert.equal(data.journals[0].content, '수정한 하루');
storage.validateData(data);
const copy = structuredClone(data);
copy.records[0].minutes = -1;
assert.throws(() => storage.validateData(copy));
copy.records[0].minutes = 90;
copy.journals.push({ ...copy.journals[0] });
assert.throws(() => storage.validateData(copy));
const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
storage.saveData(data);
assert.deepEqual(storage.loadData(), data);
console.log('Date, schedule, completion, snapshots, journal, validation, persistence: passed');
