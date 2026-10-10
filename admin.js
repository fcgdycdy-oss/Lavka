const el = id => document.getElementById(id);
const typeNames = { news: 'Новость', idea: 'Идея', question: 'Вопрос', event: 'Событие', other: 'Другое' };
function dateText(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); }
async function request(url, options = {}) {
  const response = await fetch(url, options); const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Ошибка запроса'); return data;
}
el('newsForm').addEventListener('submit', async event => {
  event.preventDefault(); const button = el('newsForm').querySelector('button[type="submit"]'); const status = el('newsStatus'); button.disabled = true; status.textContent = 'Публикуем…';
  try {
    await request('/api/admin/news', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: el('newsCategory').value.trim(), title: el('newsTitle').value.trim(), body: el('newsBody').value.trim() }) });
    el('newsTitle').value = ''; el('newsBody').value = ''; status.textContent = 'Новость опубликована на главной.'; status.className = 'form-status success';
  } catch (error) { status.textContent = error.message; status.className = 'form-status error'; }
  finally { button.disabled = false; }
});
async function updateSuggestion(id, method, status) {
  const options = { method };
  if (method === 'PATCH') { options.headers = { 'Content-Type': 'application/json' }; options.body = JSON.stringify({ status }); }
  await request(`/api/admin/suggestions/${id}`, options); await loadSuggestions();
}
async function loadSuggestions() {
  const root = el('suggestionInbox'); root.replaceChildren();
  try {
    const items = await request('/api/admin/suggestions');
    if (!items.length) { const empty = document.createElement('div'); empty.className = 'inbox-empty'; empty.textContent = 'Пока сообщений нет. Когда кто-то заполнит предложку, оно появится здесь.'; root.append(empty); return; }
    items.forEach(item => {
      const card = document.createElement('article'); card.className = `inbox-item${item.status === 'reviewed' ? ' is-reviewed' : ''}`;
      const meta = document.createElement('div'); meta.className = 'inbox-meta';
      const tag = document.createElement('span'); tag.className = 'inbox-tag'; tag.textContent = `${typeNames[item.type] || 'Другое'} · ${item.status === 'reviewed' ? 'просмотрено' : 'новое'}`;
      const date = document.createElement('span'); date.textContent = dateText(item.created_at); meta.append(tag, date);
      const title = document.createElement('h3'); title.textContent = item.title;
      const body = document.createElement('p'); body.textContent = item.body;
      const author = document.createElement('div'); author.className = 'inbox-meta'; author.textContent = item.name ? `Автор: ${item.name}` : 'Автор: анонимно';
      const actions = document.createElement('div'); actions.className = 'inbox-actions';
      const review = document.createElement('button'); review.textContent = item.status === 'reviewed' ? 'Вернуть в новые' : 'Отметить просмотренным'; review.addEventListener('click', () => updateSuggestion(item.id, 'PATCH', item.status === 'reviewed' ? 'new' : 'reviewed').catch(showError));
      const del = document.createElement('button'); del.textContent = 'Удалить'; del.addEventListener('click', () => { if (confirm('Удалить это сообщение без возможности восстановления?')) updateSuggestion(item.id, 'DELETE').catch(showError); });
      actions.append(review, del); card.append(meta, title, body, author, actions); root.append(card);
    });
  } catch (error) { const message = document.createElement('p'); message.className = 'inbox-empty'; message.textContent = `${error.message}. Проверь, запущен ли python server.py.`; root.append(message); }
}
function showError(error) { alert(error.message || 'Что-то пошло не так'); }
el('refreshSuggestions').addEventListener('click', loadSuggestions);
loadSuggestions();
