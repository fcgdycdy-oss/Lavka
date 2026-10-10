const $ = (id) => document.getElementById(id);
const group = $('group');
const course = $('course');
let allGroups = [];
let weekOffset = 0;
let loadedSchedule = null;
let selectedGroup = null;
const API_BASE = '/api';
const DAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const TIMES = ['08:00-09:35', '09:45-11:20', '11:30-13:05', '13:25-15:00', '15:10-16:45', '16:55-18:30', '18:40-20:00', '20:10-21:30'];
const WORK_TYPES = { 'Практические': '(пр)', 'Лекции': '(лек)', 'Лабораторные': '(лаб)' };

function showToast(message) {
  const toast = $('toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 3200);
}
function weekStart(offset = weekOffset) {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
function getMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
// Mirrors the official VSU schedule script: alternate weeks from the Monday of the week containing September 1.
function weekTypeFor(date) {
  const targetMonday = getMonday(date);
  const year = targetMonday.getMonth() >= 8 ? targetMonday.getFullYear() : targetMonday.getFullYear() - 1;
  const anchor = getMonday(new Date(year, 8, 1));
  const weeks = Math.round((targetMonday - anchor) / (7 * 24 * 60 * 60 * 1000));
  return ((weeks % 2) + 2) % 2 === 0 ? 'numerator' : 'denominator';
}
function formatDate(date, options = { day: 'numeric', month: 'short' }) {
  return date.toLocaleDateString('ru-RU', options);
}
function updateWeek() {
  const monday = weekStart(); const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  $('dateRange').textContent = `${formatDate(monday)} — ${formatDate(sunday)}`;
  $('weekLabel').textContent = weekOffset === 0 ? 'Текущая неделя' : weekOffset > 0 ? `Через ${weekOffset} нед.` : `${Math.abs(weekOffset)} нед. назад`;
  const type = weekTypeFor(monday);
  $('weekBadge').textContent = type === 'numerator' ? 'Числитель' : 'Знаменатель';
  $('weekBadge').dataset.type = type;
  if (loadedSchedule) renderSchedule(loadedSchedule);
  else if (group.value) loadSchedule();
}
function setStatus(title, text, showLink = true) {
  $('schedule').hidden = true; $('status').hidden = false;
  $('status').querySelector('h3').textContent = title;
  $('status').querySelector('p').textContent = text;
  const link = $('status').querySelector('a'); link.hidden = !showLink;
}
function populateGroupOptions(preferredGroup = '') {
  const selectedCourse = course.value;
  const filtered = allGroups.filter(item => !selectedCourse || String(item.course) === selectedCourse);
  group.replaceChildren(new Option(filtered.length ? 'Выбери свою группу' : 'На этом курсе групп нет', ''));
  for (const item of filtered) {
    const option = new Option(item.name, item.id);
    option.dataset.course = item.course ?? '';
    option.dataset.specialty = item.specialty ?? '';
    group.add(option);
  }
  group.disabled = filtered.length === 0;
  if (preferredGroup && [...group.options].some(option => option.value === preferredGroup)) {
    group.value = preferredGroup;
  }
  $('groupHint').textContent = selectedCourse
    ? `Курс ${selectedCourse}: ${filtered.length} групп. Выбор сохранится на этом устройстве.`
    : `${filtered.length} групп доступно. Можно выбрать курс для быстрого поиска.`;
}

async function loadGroups() {
  group.disabled = true;
  course.disabled = true;
  group.replaceChildren(new Option('Загружаем группы…', ''));
  $('groupHint').textContent = 'Получаем актуальный список с официального источника ВГУ.';
  try {
    const response = await fetch(`${API_BASE}/groups`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.details || data.error || `HTTP ${response.status}`);
    if (!Array.isArray(data) || data.length === 0) throw new Error('Официальный API вернул пустой список групп');
    allGroups = data;
    const courses = [...new Set(allGroups.map(item => Number(item.course)).filter(Number.isFinite))].sort((a, b) => a - b);
    course.replaceChildren(new Option('Все курсы', ''));
    for (const value of courses) course.add(new Option(`${value} курс`, String(value)));
    const savedGroup = localStorage.getItem('lavochka-group') || '';
    const savedCourse = localStorage.getItem('lavochka-course') || '';
    const savedGroupData = allGroups.find(item => item.id === savedGroup);
    course.value = savedGroupData ? String(savedGroupData.course) : (courses.includes(Number(savedCourse)) ? savedCourse : '');
    course.disabled = false;
    populateGroupOptions(savedGroup);
    if (!group.value && savedGroup) {
      course.value = '';
      populateGroupOptions(savedGroup);
    }
    if (group.value) {
      selectedGroup = group.value;
      await loadSchedule();
    }
  } catch (error) {
    group.replaceChildren(new Option('Не удалось загрузить группы', ''));
    course.disabled = true;
    $('groupHint').textContent = 'Проверь подключение к интернету и запущен ли локальный сервер.';
    setStatus('Не удалось подключиться к ВГУ', `Ошибка загрузки списка групп: ${error.message}. Проверь, что сервер запущен командой python server.py.`, true);
    console.error('Groups API error:', error);
  }
}

async function loadSchedule() {
  if (!group.value) {
    loadedSchedule = null;
    setStatus('Твое расписание рядом', 'Выбери свою группу. Тип недели определяется автоматически по календарной логике официального сайта ВГУ.', true);
    $('scheduleTitle').textContent = 'Сначала выбери группу';
    return;
  }
  selectedGroup = group.value;
  localStorage.setItem('lavochka-group', selectedGroup);
  const chosen = group.options[group.selectedIndex];
  $('scheduleTitle').textContent = chosen.textContent;
  setStatus('Загружаем расписание…', 'Получаем пары, преподавателей и аудитории из официального источника ВГУ.', false);
  try {
    const response = await fetch(`${API_BASE}/schedule?group=${encodeURIComponent(selectedGroup)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.details || data.error || `HTTP ${response.status}`);
    if (!Array.isArray(data)) throw new Error('Официальный API вернул неожиданный формат расписания');
    loadedSchedule = data;
    renderSchedule(loadedSchedule);
  } catch (error) {
    loadedSchedule = null;
    setStatus('Не удалось загрузить расписание', `${error.message}. Можно временно открыть официальный сайт ВГУ.`, true);
    console.error('Schedule API error:', error);
  }
}
function safeText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  return String(value).trim();
}
function getGroupText(row) {
  const groups = row['СписокГрупп'];
  if (groups && typeof groups === 'object') return Object.values(groups).filter(Boolean).join(', ');
  return safeText(groups);
}
function getRoom(row) {
  const room = safeText(row['Помещение']);
  const building = safeText(row['Здание']);
  return [room, building ? `корпус ${building}` : ''].filter(Boolean).join(', ');
}
function renderSchedule(rows) {
  const monday = weekStart();
  const type = weekTypeFor(monday);
  const dayOffset = type === 'numerator' ? 0 : 7;
  const dayRows = DAY_NAMES.map((day, index) => {
    const targetNumber = index + 1 + dayOffset;
    const lessons = rows.filter(row => Number(row['НомерДня']) === targetNumber)
      .map(row => ({
        time: safeText(row['ВременноеОкно']),
        subject: [safeText(row['Дисциплина']), WORK_TYPES[safeText(row['ВидНагрузки'])] || ''].filter(Boolean).join(' '),
        teacher: safeText(row['Преподаватель']),
        room: getRoom(row),
        groups: getGroupText(row),
        rawType: safeText(row['ВидНагрузки'])
      }))
      .sort((a, b) => (TIMES.indexOf(a.time) < 0 ? 99 : TIMES.indexOf(a.time)) - (TIMES.indexOf(b.time) < 0 ? 99 : TIMES.indexOf(b.time)));
    const date = new Date(monday); date.setDate(monday.getDate() + index);
    return { day, date: formatDate(date, { day: 'numeric', month: 'long' }), lessons };
  });
  const root = $('schedule'); root.replaceChildren(); root.hidden = false; $('status').hidden = true;
  const chosen = group.options[group.selectedIndex];
  $('scheduleTitle').textContent = chosen ? chosen.textContent : 'Расписание группы';
  for (const day of dayRows) {
    const card = document.createElement('article'); card.className = 'day-card';
    const heading = document.createElement('div'); heading.className = 'day-head';
    const dayName = document.createElement('strong'); dayName.textContent = day.day;
    const date = document.createElement('span'); date.textContent = day.date;
    heading.append(dayName, date); card.append(heading);
    for (const lesson of day.lessons) {
      const item = document.createElement('div'); item.className = 'lesson-card';
      const time = document.createElement('span'); time.className = 'lesson-time'; time.textContent = lesson.time || 'Время не указано';
      const subject = document.createElement('strong'); subject.className = 'lesson-subject'; subject.textContent = lesson.subject || 'Занятие';
      const meta = document.createElement('div'); meta.className = 'lesson-meta';
      [lesson.teacher, lesson.room].filter(Boolean).forEach(value => { const span = document.createElement('span'); span.textContent = value; meta.append(span); });
      item.append(time, subject, meta); card.append(item);
    }
    if (!day.lessons.length) { const empty = document.createElement('p'); empty.className = 'empty-day'; empty.textContent = 'Занятий нет'; card.append(empty); }
    root.append(card);
  }
}
course.addEventListener('change', () => {
  localStorage.setItem('lavochka-course', course.value);
  const currentGroup = group.value;
  populateGroupOptions('');
  loadedSchedule = null;
  selectedGroup = null;
  if (currentGroup && [...group.options].some(option => option.value === currentGroup)) {
    group.value = currentGroup;
    loadSchedule();
  } else {
    localStorage.removeItem('lavochka-group');
    setStatus('Выбери свою группу', 'Сначала выбери группу на выбранном курсе. Тип недели определится автоматически.', true);
    $('scheduleTitle').textContent = 'Сначала выбери группу';
  }
});
group.addEventListener('change', () => { loadedSchedule = null; if (group.value) localStorage.setItem('lavochka-course', course.value); loadSchedule(); });
$('prevWeek').addEventListener('click', () => { weekOffset--; updateWeek(); });
$('nextWeek').addEventListener('click', () => { weekOffset++; updateWeek(); });
$('todayBtn').addEventListener('click', () => { weekOffset = 0; updateWeek(); });
updateWeek(); loadGroups();

// Навигация по разделам сайта. Основной экран — новости, расписание открывается отдельно.
function openPage(page) {
  document.querySelectorAll('.page-section').forEach(section => { section.hidden = section.id !== `page-${page}`; });
  document.querySelectorAll('[data-page-link]').forEach(link => link.classList.toggle('active', link.dataset.pageLink === page && link.classList.contains('nav-link')));
  if (page === 'schedule') updateWeek();
  if (page === 'home') loadNews();
  history.replaceState(null, '', `#${page}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('[data-page-link]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault(); openPage(link.dataset.pageLink);
}));

const NEWS_ARTS = ['art-purple', 'art-orange', 'art-mix'];
function createNewsCard(item, index) {
  const article = document.createElement('article'); article.className = 'news-card';
  const art = document.createElement('div'); art.className = `news-art ${NEWS_ARTS[index % NEWS_ARTS.length]}`;
  const symbol = document.createElement('span'); symbol.textContent = ['Л', '✳', '↗'][index % 3]; art.append(symbol);
  const copy = document.createElement('div'); copy.className = 'news-copy';
  const category = document.createElement('span'); category.className = 'news-category'; category.textContent = item.category || 'НОВОСТИ';
  const title = document.createElement('h3'); title.textContent = item.title;
  const body = document.createElement('p'); body.textContent = item.body;
  const date = document.createElement('small'); date.className = 'news-date';
  if (item.created_at) { const parsed = new Date(item.created_at); date.textContent = Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); }
  copy.append(category, title, body, date); article.append(art, copy); return article;
}
async function loadNews() {
  const grid = $('newsGrid');
  try {
    const response = await fetch(`${API_BASE}/news`); const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Не удалось загрузить новости');
    grid.replaceChildren();
    if (!data.length) {
      const empty = document.createElement('div'); empty.className = 'empty-news';
      const heading = document.createElement('h3'); heading.textContent = 'Пока новостей нет';
      const body = document.createElement('p'); body.textContent = 'Добавь первую публикацию через редактор сайта или отправь идею в предложку.';
      const button = document.createElement('button'); button.className = 'secondary-btn'; button.textContent = 'Предложить новость'; button.addEventListener('click', () => openPage('suggestions'));
      empty.append(heading, body, button); grid.append(empty);
    } else data.forEach((item, index) => grid.append(createNewsCard(item, index)));
    $('newsCount').textContent = `${data.length} публикаций`;
  } catch (error) {
    $('newsCount').textContent = 'Нет связи';
    grid.replaceChildren(); const empty = document.createElement('div'); empty.className = 'empty-news';
    const heading = document.createElement('h3'); heading.textContent = 'Не удалось загрузить новости';
    const body = document.createElement('p'); body.textContent = 'Проверь, что сервер запущен командой python server.py.';
    empty.append(heading, body); grid.append(empty); console.error('News API error:', error);
  }
}

$('suggestionForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('suggestionForm').querySelector('button[type="submit"]');
  const status = $('suggestionStatus'); button.disabled = true; status.textContent = 'Отправляем…'; status.className = 'form-status';
  const payload = { type: $('suggestionType').value, title: $('suggestionTitle').value.trim(), body: $('suggestionText').value.trim(), name: $('suggestionName').value.trim() };
  try {
    const response = await fetch(`${API_BASE}/suggestions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Не удалось отправить сообщение');
    $('suggestionForm').reset(); status.textContent = 'Готово! Сообщение сохранено. Спасибо, что участвуешь в жизни журфака.'; status.classList.add('success');
  } catch (error) { status.textContent = `${error.message}. Убедись, что запущен python server.py.`; status.classList.add('error'); }
  finally { button.disabled = false; }
});

// Открываем раздел по ссылке, например /#schedule. Если хеша нет — показываем главную.
const initialPage = location.hash.replace('#', '');
openPage(['home', 'schedule', 'suggestions'].includes(initialPage) ? initialPage : 'home');
loadNews();
