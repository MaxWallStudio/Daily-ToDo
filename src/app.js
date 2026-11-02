import { addDays, dateKey, monthKey, moveMonth, parseDate, prettyDate, prettyMonth, todayKey } from './dates.js';
import { DAYS, dayRate, entriesFor, entryRate, revisionFor, statistics } from './model.js';
import { emptyData, loadData, newHabit, saveData, upsertJournal, upsertRecord, upsertRevision, validateData } from './storage.js';

const app = document.querySelector('#app');
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
let data;
try { data = loadData(); } catch (error) { app.innerHTML = `<main class="fatal"><h1>데이터를 열 수 없습니다</h1><p>${escapeHtml(error.message)}</p><p>브라우저 개발자 도구에서 저장소를 확인하거나 백업이 있다면 데이터를 복원해 주세요.</p></main>`; throw error; }
const state = { view: 'today', selected: todayKey(), month: monthKey(todayKey()) + '-01', editing: null, toast: '' };
let journalTimer;
let pendingJournal = null;
let installPrompt = null;
let installCompleted = false;
const standaloneMode = window.matchMedia('(display-mode: standalone)');
const isStandalone = () => standaloneMode.matches || navigator.standalone === true;
const isIosSafari = () => {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);
};
function installSettings() {
  if (installCompleted || isStandalone()) return '';
  if (installPrompt) return '<section class="settings-card install-card"><h2>앱 설치</h2><p>홈 화면에서 오늘의 기록을 바로 열 수 있어요.</p><button class="accent-button" data-action="install-app">앱 설치하기</button></section>';
  if (isIosSafari()) return '<section class="settings-card install-card"><h2>홈 화면에 추가</h2><p>Safari의 공유 버튼을 누른 뒤 <strong>홈 화면에 추가</strong>를 선택하세요.</p></section>';
  return '';
}
function refreshInstallSettings() { if (state.view === 'settings') render(); }
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  if (installCompleted || isStandalone()) return;
  installPrompt = event;
  refreshInstallSettings();
});
window.addEventListener('appinstalled', () => {
  installCompleted = true;
  installPrompt = null;
  refreshInstallSettings();
});
if (standaloneMode.addEventListener) standaloneMode.addEventListener('change', refreshInstallSettings);
else standaloneMode.addListener?.(refreshInstallSettings);
const icon = name => ({ today: '◉', calendar: '▦', journal: '▤', rules: '☷', settings: '⚙' })[name];
const labels = { today: '오늘', calendar: '달력', journal: '일기', rules: '활동', settings: '설정' };
const percent = rate => rate === null ? '휴식일' : `${rate}%`;
const rateLevel = rate => rate === null || rate === 0 ? 0 : rate < 50 ? 1 : rate < 80 ? 2 : rate < 100 ? 3 : 4;

function persist() {
  try { saveData(data); return true; }
  catch (error) { notify(`저장 실패: ${error.message}`); return false; }
}
function notify(message) {
  state.toast = message;
  const toast = document.querySelector('.toast');
  if (toast) { toast.textContent = message; toast.hidden = false; }
  setTimeout(() => { if (state.toast === message) { state.toast = ''; if (toast) toast.hidden = true; } }, 5000);
}
function flushJournal() {
  clearTimeout(journalTimer);
  if (!pendingJournal) return;
  const { date, content } = pendingJournal;
  pendingJournal = null;
  upsertJournal(data, date, content);
  const saved = persist();
  const status = document.querySelector('.save-status');
  if (status) status.textContent = saved ? '✓ 저장됨' : '저장 실패';
}
function navigate(view) {
  flushJournal(); state.view = view; if (view === 'today') state.selected = todayKey(); render();
}
function rateBar(rate) { return `<div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${rate || 0}"><span style="width:${rate || 0}%"></span></div>`; }
function dayEditor(date, compact = false) {
  const entries = entriesFor(data, date);
  const rate = dayRate(data, date);
  const today = date === todayKey();
  const journal = data.journals.find(item => item.date === date);
  return `<section class="day-panel">
    ${compact ? `<div class="section-heading"><h2>${prettyDate(date)}</h2><span class="pill">${percent(rate)}</span></div>` : `<div class="hero"><div><span class="eyebrow">${today ? 'TODAY' : 'DAY LOG'}</span><h1>${prettyDate(date)}</h1><p>${rate === null ? '예정된 활동이 없어요.' : `${entries.filter(item => entryRate(item) >= 1).length} / ${entries.length} 완료`}</p></div><div class="hero-rate">${percent(rate)}</div></div>${rateBar(rate)}`}
    <div class="section-heading activity-heading"><h2>활동</h2><span>${entries.length ? `${entries.length}개 예정` : '휴식일'}</span></div>
    ${entries.length ? `<div class="activity-list">${entries.map(entry => activityCard(entry, date)).join('')}</div>` : `<div class="empty-card"><p>이 날짜에 예정된 활동이 없습니다.</p>${today ? '<button class="text-button" data-action="go-rules">활동 추가하기 →</button>' : ''}</div>`}
    <div class="section-heading journal-heading"><h2>${today ? '오늘의 일기' : '이날의 일기'}</h2><span class="save-status" aria-live="polite">${journal ? '✓ 저장됨' : '선택 사항'}</span></div>
    <textarea class="journal-editor" data-date="${date}" aria-label="${prettyDate(date)} 일기" placeholder="오늘 있었던 일이나 생각을 자유롭게 적어 보세요.">${escapeHtml(journal?.content || '')}</textarea>
  </section>`;
}
function activityCard(entry, date) {
  const { habit, targetMinutes, record, name } = entry;
  const done = entryRate(entry) >= 1;
  const minutes = record?.minutes || 0;
  return `<article class="activity-card ${done ? 'is-done' : ''}"><div class="activity-top"><div><h3>${escapeHtml(name)}</h3>${targetMinutes === null ? '<p>완료 여부 기록</p>' : `<label class="minute-label"><input class="minutes-input" type="number" min="0" max="100000" step="1" value="${minutes}" data-id="${habit.id}" data-date="${date}" aria-label="${escapeHtml(name)} 기록 시간"> <span>/ ${targetMinutes}분</span></label>`}</div><span class="status-mark" aria-label="${done ? '완료' : '미완료'}">${done ? '✓' : '○'}</span></div><div class="activity-actions">${targetMinutes === null ? `<button class="primary-action ${done ? 'done' : ''}" data-action="toggle" data-id="${habit.id}" data-date="${date}">${done ? '✓ 완료 취소' : '완료'}</button>` : `<button data-action="minutes" data-delta="-10" data-id="${habit.id}" data-date="${date}" aria-label="${escapeHtml(name)} 10분 빼기" ${minutes === 0 ? 'disabled' : ''}>−10분</button><button data-action="minutes" data-delta="10" data-id="${habit.id}" data-date="${date}" aria-label="${escapeHtml(name)} 10분 더하기">+10분</button><button class="primary-action ${done ? 'done' : ''}" data-action="fill" data-id="${habit.id}" data-date="${date}" ${done ? 'disabled' : ''}>${done ? '✓ 완료' : '목표 채우기'}</button>`}</div></article>`;
}
function todayView() {
  const stats = statistics(data);
  const recent = stats.lastSeven.map(date => `<div class="mini-day"><span>${parseDate(date).getDate()}</span><b class="level-${rateLevel(dayRate(data, date))}" title="${prettyDate(date)} ${percent(dayRate(data, date))}"></b></div>`).join('');
  return `${dayEditor(todayKey())}<section class="stats-section"><div class="section-heading"><h2>한눈에 보기</h2></div><div class="stats-grid"><div><strong>${stats.streak}일</strong><span>연속 달성</span></div><div><strong>${percent(stats.week)}</strong><span>이번 주 평균</span></div><div><strong>${percent(stats.month)}</strong><span>이번 달 평균</span></div></div><div class="recent"><span>최근 7일</span><div>${recent}</div></div></section>`;
}
function calendarView() {
  const first = parseDate(state.month);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: offset }, () => '<span class="calendar-blank"></span>');
  for (let day = 1; day <= days; day++) {
    const key = dateKey(new Date(first.getFullYear(), first.getMonth(), day));
    const rate = key > todayKey() ? null : dayRate(data, key);
    const journal = data.journals.some(item => item.date === key);
    cells.push(`<button class="calendar-day level-${rateLevel(rate)} ${key === state.selected ? 'selected' : ''} ${key > todayKey() ? 'future' : ''}" data-action="select-date" data-date="${key}" ${key > todayKey() ? 'disabled' : ''} aria-label="${prettyDate(key)} ${key > todayKey() ? '미래' : percent(rate)}${journal ? ', 일기 있음' : ''}"><span>${day}</span><small>${key > todayKey() ? '' : rate === null ? '쉼' : `${rate}%`}</small>${journal ? '<i aria-hidden="true"></i>' : ''}</button>`);
  }
  return `<section class="calendar-panel"><div class="page-title"><div><span class="eyebrow">CALENDAR</span><h1>달력</h1></div><p>꾸준히 쌓아 온 날들을 살펴보세요.</p></div><div class="month-control"><button data-action="month" data-delta="-1" aria-label="이전 달">‹</button><h2>${prettyMonth(state.month)}</h2><button data-action="month" data-delta="1" aria-label="다음 달">›</button></div><div class="calendar-grid weekdays">${DAYS.map(day => `<span>${day}</span>`).join('')}</div><div class="calendar-grid dates">${cells.join('')}</div><div class="legend"><span>달성률</span>${[0, 1, 2, 3, 4].map((level, i) => `<span><b class="level-${level}"></b>${['0', '1–49', '50–79', '80–99', '100'][i]}%</span>`).join('')}</div><p class="calendar-hint">날짜를 누르면 기록과 일기를 볼 수 있어요. · 점은 일기가 있는 날</p></section>${monthKey(state.selected) === monthKey(state.month) ? dayEditor(state.selected, true) : ''}`;
}
function journalView() {
  const journals = [...data.journals].sort((a, b) => b.date.localeCompare(a.date));
  return `<section class="page-title"><span class="eyebrow">JOURNAL</span><h1>일기</h1><p>그날의 생각을 다시 꺼내 보세요.</p></section>${journals.length ? `<div class="journal-list">${journals.map(item => `<button class="journal-item" data-action="open-journal" data-date="${item.date}"><strong>${prettyDate(item.date)}</strong><span>${escapeHtml(item.content.replace(/\s+/g, ' ').slice(0, 110))}</span><b>→</b></button>`).join('')}</div>` : '<div class="empty-card"><p>아직 작성한 일기가 없어요.</p><button class="text-button" data-action="go-today">오늘 일기 쓰기 →</button></div>'}`;
}
function rulesView() {
  const habits = [...data.habits].filter(item => !item.archivedDate).sort((a, b) => a.order - b.order);
  return `<section class="page-title split"><div><span class="eyebrow">RULES</span><h1>활동 관리</h1><p>매일 반복할 활동을 설정하세요.</p></div><button class="accent-button" data-action="new-rule">+ 활동 추가</button></section>${habits.length ? `<div class="rules-list">${habits.map((habit, index) => { const rule = revisionFor(habit, todayKey()); return `<article class="rule-card ${rule.active ? '' : 'inactive'}"><div class="rule-main"><div><h2>${escapeHtml(rule.name)}</h2><p>${rule.targetMinutes ? `목표 ${rule.targetMinutes}분 · ` : ''}${rule.repeatDays.length === 7 ? '매일' : rule.repeatDays.map(day => DAYS[day]).join(' · ')}</p></div><span class="pill">${rule.active ? '활성' : '비활성'}</span></div><div class="rule-actions"><button data-action="edit-rule" data-id="${habit.id}">수정</button><button data-action="toggle-rule" data-id="${habit.id}">${rule.active ? '비활성화' : '활성화'}</button><button data-action="move-rule" data-id="${habit.id}" data-delta="-1" ${index === 0 ? 'disabled' : ''} aria-label="${escapeHtml(rule.name)} 위로 이동">↑</button><button data-action="move-rule" data-id="${habit.id}" data-delta="1" ${index === habits.length - 1 ? 'disabled' : ''} aria-label="${escapeHtml(rule.name)} 아래로 이동">↓</button><button class="danger-text" data-action="delete-rule" data-id="${habit.id}">삭제</button></div></article>`; }).join('')}</div>` : '<div class="empty-card"><p>아직 활동이 없습니다. 첫 활동을 추가해 보세요.</p></div>'}`;
}
function settingsView() {
  return `<section class="page-title"><span class="eyebrow">SETTINGS</span><h1>설정</h1><p>내 기록을 안전하게 관리하세요.</p></section><section class="settings-card"><h2>화면 모드</h2><p>시스템 설정에 맞추거나 직접 선택할 수 있어요.</p><div class="segmented">${[['system', '시스템'], ['light', '라이트'], ['dark', '다크']].map(([value, label]) => `<button data-action="theme" data-theme="${value}" class="${data.settings.theme === value ? 'active' : ''}">${label}</button>`).join('')}</div></section><section class="settings-card"><h2>데이터 백업</h2><p>이 기기의 브라우저에만 기록이 저장됩니다. 정기적으로 JSON 파일을 내려받아 보관하세요.</p><div class="settings-actions"><button data-action="export">JSON 내보내기</button><button data-action="import">JSON 가져오기</button><input id="import-file" type="file" accept=".json,application/json" hidden></div></section><section class="settings-card danger-zone"><h2>전체 데이터 초기화</h2><p>활동, 기록, 일기가 모두 지워집니다.</p><button data-action="reset">전체 데이터 삭제</button></section>`;
}
function ruleDialog() {
  if (state.editing === null) return '';
  const habit = state.editing === 'new' ? null : data.habits.find(item => item.id === state.editing);
  const rule = habit ? revisionFor(habit, todayKey()) : { name: '', targetMinutes: null, repeatDays: [0, 1, 2, 3, 4, 5, 6] };
  return `<div class="modal-backdrop" data-action="close-dialog"><form class="rule-dialog" id="rule-form" data-id="${habit?.id || ''}"><div class="section-heading"><h2>${habit ? '활동 수정' : '새 활동'}</h2><button type="button" class="icon-button" data-action="close-dialog" aria-label="닫기">×</button></div><label>활동 이름<input name="name" maxlength="100" required autofocus placeholder="예: 독서" value="${escapeHtml(rule.name)}"></label><label>목표 시간 <span class="muted">(선택)</span><div class="input-suffix"><input name="target" type="number" min="1" max="1440" step="1" placeholder="시간 목표 없음" value="${rule.targetMinutes ?? ''}"><span>분</span></div></label><fieldset><legend>반복 요일</legend><div class="day-choices">${DAYS.map((day, index) => `<label><input type="checkbox" name="day" value="${index}" ${rule.repeatDays.includes(index) ? 'checked' : ''}><span>${day}</span></label>`).join('')}</div></fieldset><p class="form-error" aria-live="polite"></p><button class="accent-button wide" type="submit">${habit ? '변경 저장' : '활동 추가'}</button></form></div>`;
}
function applyTheme() { document.documentElement.dataset.theme = data.settings.theme; document.querySelector('meta[name="theme-color"]').content = data.settings.theme === 'dark' ? '#171e1a' : '#f6f8f6'; }
function render() {
  applyTheme();
  const views = { today: todayView, calendar: calendarView, journal: journalView, rules: rulesView, settings: settingsView };
  app.innerHTML = `<div class="app-shell"><aside class="sidebar"><div class="brand"><span class="brand-icon">✓</span><span>오늘의 기록<small>나의 하루, 차곡차곡</small></span></div><nav aria-label="주 메뉴">${Object.keys(labels).map(view => `<button class="nav-item ${state.view === view ? 'active' : ''}" data-view="${view}"><span aria-hidden="true">${icon(view)}</span>${labels[view]}</button>`).join('')}</nav><div class="sidebar-foot">오늘을 기록하는 작은 습관</div></aside><main class="content">${views[state.view]()}</main><nav class="bottom-nav" aria-label="주 메뉴">${Object.keys(labels).map(view => `<button class="${state.view === view ? 'active' : ''}" data-view="${view}"><span aria-hidden="true">${icon(view)}</span>${labels[view]}</button>`).join('')}</nav></div><div class="toast" role="status" ${state.toast ? '' : 'hidden'}>${escapeHtml(state.toast)}</div>${ruleDialog()}`;
  if (state.view === 'settings') document.querySelector('.settings-card')?.insertAdjacentHTML('beforebegin', installSettings());
  if (state.editing !== null) document.querySelector('.rule-dialog input[name="name"]')?.focus();
}

app.addEventListener('click', async event => {
  const button = event.target.closest('[data-view], [data-action]');
  if (!button) return;
  if (button.dataset.view) { navigate(button.dataset.view); return; }
  if (button.classList.contains('modal-backdrop') && event.target !== button) return;
  const action = button.dataset.action;
  if (action === 'install-app') {
    if (!installPrompt || installCompleted || isStandalone()) return;
    const prompt = installPrompt;
    try {
      const result = prompt.prompt();
      installPrompt = null;
      refreshInstallSettings();
      await result;
      await prompt.userChoice;
    } catch (error) {
      installPrompt = null;
      refreshInstallSettings();
      notify('설치 안내를 열 수 없습니다. 브라우저 메뉴에서 설치를 시도해 주세요.');
    }
    return;
  }
  if (action === 'go-rules') return navigate('rules');
  if (action === 'go-today') return navigate('today');
  if (action === 'close-dialog') { state.editing = null; render(); return; }
  if (action === 'new-rule' || action === 'edit-rule') { state.editing = action === 'new-rule' ? 'new' : button.dataset.id; render(); return; }
  if (action === 'select-date') { flushJournal(); state.selected = button.dataset.date; render(); document.querySelector('.day-panel:last-child')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (action === 'open-journal') { state.selected = button.dataset.date; state.month = monthKey(state.selected) + '-01'; navigate('calendar'); setTimeout(() => document.querySelector('.journal-editor')?.focus(), 0); return; }
  if (action === 'month') { flushJournal(); state.month = moveMonth(state.month, Number(button.dataset.delta)); state.selected = state.month <= todayKey() ? state.month : todayKey(); render(); return; }
  if (['minutes', 'toggle', 'fill'].includes(action)) {
    flushJournal();
    const date = button.dataset.date;
    const entry = entriesFor(data, date).find(item => item.habit.id === button.dataset.id);
    if (!entry) return;
    const current = entry.record;
    if (action === 'minutes') upsertRecord(data, date, entry.habit.id, { minutes: Math.min(100000, Math.max(0, (current?.minutes || 0) + Number(button.dataset.delta))), completed: false });
    if (action === 'toggle') upsertRecord(data, date, entry.habit.id, { completed: !current?.completed });
    if (action === 'fill') upsertRecord(data, date, entry.habit.id, { minutes: Math.max(current?.minutes || 0, entry.targetMinutes), completed: true });
    persist(); render(); return;
  }
  if (action === 'toggle-rule' || action === 'delete-rule' || action === 'move-rule') {
    const habit = data.habits.find(item => item.id === button.dataset.id);
    if (!habit) return;
    if (action === 'delete-rule') {
      if (!confirm(`“${revisionFor(habit, todayKey()).name}” 활동을 삭제할까요? 과거 기록은 보존됩니다.`)) return;
      habit.archivedDate = todayKey();
    } else if (action === 'toggle-rule') {
      const rule = revisionFor(habit, todayKey());
      Object.assign(habit, upsertRevision(habit, { name: rule.name, targetMinutes: rule.targetMinutes, repeatDays: rule.repeatDays, active: !rule.active }));
    } else {
      const active = data.habits.filter(item => !item.archivedDate).sort((a, b) => a.order - b.order);
      const index = active.findIndex(item => item.id === habit.id);
      const other = active[index + Number(button.dataset.delta)];
      if (!other) return;
      [habit.order, other.order] = [other.order, habit.order];
    }
    persist(); render(); return;
  }
  if (action === 'theme') { data.settings.theme = button.dataset.theme; persist(); render(); return; }
  if (action === 'export') {
    flushJournal();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `오늘의-기록-${todayKey()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return;
  }
  if (action === 'import') { document.querySelector('#import-file').click(); return; }
  if (action === 'reset') {
    if (!confirm('활동, 기록, 일기를 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return;
    if (!confirm('마지막 확인: 전체 데이터를 초기화합니다. 계속할까요?')) return;
    const next = emptyData(); if (!saveSafely(next)) return; data = next; state.selected = todayKey(); state.month = monthKey(state.selected) + '-01'; navigate('today'); notify('전체 데이터가 초기화되었습니다.');
  }
});
function saveSafely(next) { try { saveData(next); return true; } catch (error) { notify(`저장 실패: ${error.message}`); return false; } }
app.addEventListener('submit', event => {
  if (event.target.id !== 'rule-form') return;
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const name = String(formData.get('name') || '').trim();
  const targetRaw = String(formData.get('target') || '').trim();
  const targetMinutes = targetRaw ? Number(targetRaw) : null;
  const repeatDays = formData.getAll('day').map(Number).sort((a, b) => a - b);
  const error = form.querySelector('.form-error');
  if (!name || name.length > 100) { error.textContent = '활동 이름을 입력해 주세요.'; return; }
  if (targetMinutes !== null && (!Number.isInteger(targetMinutes) || targetMinutes < 1 || targetMinutes > 1440)) { error.textContent = '목표 시간은 1~1440분으로 입력해 주세요.'; return; }
  if (!repeatDays.length) { error.textContent = '반복 요일을 하나 이상 선택해 주세요.'; return; }
  const habit = data.habits.find(item => item.id === form.dataset.id);
  if (habit) { const active = revisionFor(habit, todayKey()).active; Object.assign(habit, upsertRevision(habit, { name, targetMinutes, repeatDays, active })); }
  else data.habits.push(newHabit(name, targetMinutes, repeatDays, Math.max(-1, ...data.habits.map(item => item.order)) + 1));
  persist(); state.editing = null; render();
});
app.addEventListener('input', event => {
  if (!event.target.matches('.journal-editor')) return;
  pendingJournal = { date: event.target.dataset.date, content: event.target.value };
  document.querySelector('.save-status').textContent = '저장 중...';
  clearTimeout(journalTimer);
  journalTimer = setTimeout(flushJournal, 550);
});
app.addEventListener('change', async event => {
  if (event.target.matches('.minutes-input')) {
    const input = event.target;
    const minutes = Number(input.value);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 100000) { notify('기록 시간은 0~100000분으로 입력해 주세요.'); render(); return; }
    flushJournal();
    upsertRecord(data, input.dataset.date, input.dataset.id, { minutes, completed: false });
    persist(); render(); return;
  }
  if (event.target.id !== 'import-file') return;
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = validateData(JSON.parse(await file.text()));
    if (!confirm('현재 기록을 백업 파일의 내용으로 교체할까요?')) return;
    if (!saveSafely(parsed)) return;
    data = parsed; state.selected = todayKey(); state.month = monthKey(state.selected) + '-01'; navigate('today'); notify('백업을 가져왔습니다.');
  } catch (error) { notify(`가져오기 실패: ${error.message}`); }
  event.target.value = '';
});
window.addEventListener('pagehide', flushJournal);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushJournal(); });
render();
let lastToday = todayKey();
setInterval(() => { const now = todayKey(); if (now !== lastToday) { lastToday = now; flushJournal(); if (state.view === 'today') state.selected = now; state.month = monthKey(now) + '-01'; render(); } }, 60000);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {}));
