"""Локальный сервер «Лавочки»: расписание ВГУ, новости и предложка.
Запуск: python server.py. Никаких сторонних Python-пакетов не нужно.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode
from urllib.request import Request, urlopen
import json
import os
import sqlite3
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
HOST = "0.0.0.0"  # Разрешаем подключения извне на хостинге.
PORT = int(os.environ.get("PORT", 8000))
FACULTY_ID = '000000003'
API_URL = 'https://jour.vsu.ru/js/schedule/callapi.php'
DB_FILE = ROOT / 'lavochka.db'
USER_AGENT = 'Mozilla/5.0 (compatible; LavochkaSchedule/1.0)'
NEWS_SEED = [
    ('Добро пожаловать в «Лавочку»', 'Это главная страница студенческого сайта журфака. Здесь будут появляться новости, события и полезные объявления.', 'ОТ ЛАВОЧКИ'),
    ('Есть идея для публикации?', 'Присылай новости, вопросы и темы, которые стоит обсудить. Предложку можно заполнить анонимно.', 'ПРЕДЛОЖКА'),
    ('Расписание всегда под рукой', 'Выбери курс и свою группу в разделе «Расписание». Числитель и знаменатель переключаются автоматически.', 'ПОЛЕЗНОЕ'),
]


def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec='seconds')


def db():
    conn = sqlite3.connect(DB_FILE, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with db() as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS news (
            id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'НОВОСТИ', created_at TEXT NOT NULL)''')
        conn.execute('''CREATE TABLE IF NOT EXISTS suggestions (
            id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, title TEXT NOT NULL,
            body TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'new')''')
        count = conn.execute('SELECT COUNT(*) FROM news').fetchone()[0]
        if count == 0:
            for title, body, category in NEWS_SEED:
                conn.execute('INSERT INTO news(title, body, category, created_at) VALUES(?,?,?,?)',
                             (title, body, category, now_iso()))


def fetch_official(params):
    url = API_URL + '?' + urlencode(params)
    req = Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json, text/plain, */*', 'Referer': 'https://jour.vsu.ru/rasp-html/'})
    with urlopen(req, timeout=20) as response:
        raw = response.read().decode('utf-8-sig', errors='replace')
    return json.loads(raw)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get('Content-Length', '0'))
        if length > 20000:
            raise ValueError('Сообщение слишком большое')
        raw = self.rfile.read(length).decode('utf-8')
        value = json.loads(raw or '{}')
        if not isinstance(value, dict):
            raise ValueError('Ожидался JSON-объект')
        return value

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/groups':
            try:
                data = fetch_official({'url': f'group/{FACULTY_ID}'})
                if not isinstance(data, list):
                    raise ValueError('Официальный API вернул не список групп')
                groups = []
                for item in data:
                    if not isinstance(item, dict) or not item.get('Код') or not item.get('Группа'):
                        continue
                    groups.append({'id': str(item['Код']), 'name': str(item['Группа']), 'course': item.get('Курс'), 'specialty': item.get('Специальность', '')})
                groups.sort(key=lambda g: (int(g['course']) if str(g.get('course', '')).isdigit() else 99, g['name'].casefold()))
                self.send_json(groups)
            except Exception as exc:
                self.send_json({'error': 'Не удалось загрузить группы с официального API ВГУ', 'details': str(exc)}, 502)
            return
        if parsed.path == '/api/schedule':
            group_id = (parse_qs(parsed.query).get('group') or [''])[0]
            if not group_id.isdigit() or len(group_id) > 24:
                self.send_json({'error': 'Некорректный идентификатор группы'}, 400); return
            try:
                data = fetch_official({'url': f'schedule/{FACULTY_ID}', 'data': f'groupID:{group_id}'})
                if not isinstance(data, list): raise ValueError('Официальный API вернул неожиданный формат расписания')
                self.send_json(data)
            except Exception as exc:
                self.send_json({'error': 'Не удалось загрузить расписание с официального API ВГУ', 'details': str(exc)}, 502)
            return
        if parsed.path == '/api/news':
            with db() as conn:
                rows = conn.execute('SELECT id,title,body,category,created_at FROM news ORDER BY id DESC LIMIT 50').fetchall()
            self.send_json([dict(row) for row in rows]); return
        if parsed.path == '/api/admin/suggestions':
            with db() as conn:
                rows = conn.execute('SELECT id,type,title,body,name,created_at,status FROM suggestions ORDER BY CASE status WHEN \'new\' THEN 0 ELSE 1 END, id DESC LIMIT 200').fetchall()
            self.send_json([dict(row) for row in rows]); return
        if parsed.path.startswith('/api/'):
            self.send_json({'error': 'Неизвестный API-маршрут'}, 404); return
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        try:
            data = self.read_json()
            if parsed.path == '/api/suggestions':
                kind = str(data.get('type', 'other')).strip()[:30]
                title = str(data.get('title', '')).strip()[:120]
                body = str(data.get('body', '')).strip()[:5000]
                name = str(data.get('name', '')).strip()[:80]
                if not title or not body:
                    self.send_json({'error': 'Заполни заголовок и подробности'}, 400); return
                if kind not in {'news', 'idea', 'question', 'event', 'other'}: kind = 'other'
                with db() as conn:
                    cursor = conn.execute('INSERT INTO suggestions(type,title,body,name,created_at) VALUES(?,?,?,?,?)', (kind,title,body,name,now_iso()))
                self.send_json({'ok': True, 'id': cursor.lastrowid}, 201); return
            if parsed.path == '/api/admin/news':
                title = str(data.get('title', '')).strip()[:160]
                body = str(data.get('body', '')).strip()[:5000]
                category = str(data.get('category', 'НОВОСТИ')).strip()[:40] or 'НОВОСТИ'
                if not title or not body:
                    self.send_json({'error': 'Нужны заголовок и текст новости'}, 400); return
                with db() as conn:
                    cursor = conn.execute('INSERT INTO news(title,body,category,created_at) VALUES(?,?,?,?)', (title,body,category,now_iso()))
                self.send_json({'ok': True, 'id': cursor.lastrowid}, 201); return
            self.send_json({'error': 'Неизвестный API-маршрут'}, 404)
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json({'error': str(exc) or 'Некорректный запрос'}, 400)
        except Exception as exc:
            self.send_json({'error': 'Ошибка сервера', 'details': str(exc)}, 500)

    def do_PATCH(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith('/api/admin/suggestions/'):
            try:
                suggestion_id = int(parsed.path.rsplit('/', 1)[1])
                data = self.read_json()
                status = str(data.get('status', 'reviewed'))
                if status not in {'new', 'reviewed'}: status = 'reviewed'
                with db() as conn:
                    cursor = conn.execute('UPDATE suggestions SET status=? WHERE id=?', (status, suggestion_id))
                self.send_json({'ok': bool(cursor.rowcount)}); return
            except Exception as exc:
                self.send_json({'error': str(exc)}, 400); return
        self.send_json({'error': 'Неизвестный API-маршрут'}, 404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith('/api/admin/suggestions/'):
            try:
                suggestion_id = int(parsed.path.rsplit('/', 1)[1])
                with db() as conn:
                    cursor = conn.execute('DELETE FROM suggestions WHERE id=?', (suggestion_id,))
                self.send_json({'ok': bool(cursor.rowcount)}); return
            except Exception as exc:
                self.send_json({'error': str(exc)}, 400); return
        self.send_json({'error': 'Неизвестный API-маршрут'}, 404)

    def log_message(self, fmt, *args):
        print('[Лавочка] ' + (fmt % args))


if __name__ == '__main__':
    init_db()
    print(f'Лавочка запущена: http://{HOST}:{PORT}')
    print(f'Редактор новостей и предложки: http://{HOST}:{PORT}/admin.html')
    print('Сайт и данные хранятся локально на этом компьютере. Остановить: Ctrl+C')
    try:
        ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print('\nСервер остановлен.')
