"""Скачивает исходники официального онлайн-расписания ВГУ для изучения API.
Запуск: python inspect_source.py
Результаты появятся в папке source_dump. Никакие cookie или учетные данные не нужны.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urljoin
from html.parser import HTMLParser
import re

BASE = 'https://jour.vsu.ru/rasp-html/'
OUT = Path(__file__).resolve().parent / 'source_dump'
OUT.mkdir(exist_ok=True)

class ScriptParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.scripts=[]; self.inline=[]; self._in_script=False; self._src=None; self._buf=[]
    def handle_starttag(self, tag, attrs):
        if tag.lower() == 'script':
            self._in_script=True; self._src=dict(attrs).get('src'); self._buf=[]
    def handle_data(self, data):
        if self._in_script: self._buf.append(data)
    def handle_endtag(self, tag):
        if tag.lower() == 'script' and self._in_script:
            self.scripts.append(self._src or '')
            if not self._src and ''.join(self._buf).strip(): self.inline.append(''.join(self._buf))
            self._in_script=False; self._src=None; self._buf=[]

def fetch(url):
    req = Request(url, headers={'User-Agent':'Mozilla/5.0 (compatible; LavochkaScheduleInspector/1.0)'})
    with urlopen(req, timeout=25) as r:
        return r.read(), r.headers.get_content_type()

try:
    raw, _ = fetch(BASE)
    html = raw.decode('utf-8', errors='replace')
    (OUT/'page.html').write_text(html, encoding='utf-8')
    parser = ScriptParser(); parser.feed(html)
    lines = [f'Страница: {BASE}', f'HTML сохранен: {OUT / "page.html"}', '', 'Найденные скрипты:']
    seen=set()
    for i, src in enumerate(parser.scripts, 1):
        if not src: continue
        url=urljoin(BASE, src)
        if url in seen: continue
        seen.add(url)
        name=re.sub(r'[^a-zA-Z0-9._-]+','_',url.split('/')[-1].split('?')[0]) or f'script_{i}.js'
        if not name.endswith('.js'): name += '.js'
        try:
            data, _ = fetch(url)
            path=OUT/name
            path.write_bytes(data)
            textdata=data.decode('utf-8', errors='replace')
            lines.append(f'- {url} -> {path.name} ({len(data)} bytes)')
            if any(x in textdata for x in ('getfaculties','getgroups','getschedule','getitems','fetch(','XMLHttpRequest')):
                lines.append(f'  Возможный источник API: {path.name}')
        except Exception as e:
            lines.append(f'- НЕ УДАЛОСЬ скачать {url}: {e}')
    for i, inline in enumerate(parser.inline, 1):
        (OUT/f'inline_{i}.js').write_text(inline, encoding='utf-8')
    (OUT/'REPORT.txt').write_text('\n'.join(lines), encoding='utf-8')
    print('\n'.join(lines))
    print('\nГотово. Пришлите мне папку source_dump (можно архивом), чтобы я подключил реальные группы и расписание.')
except Exception as e:
    print('Не удалось получить официальный сайт:', repr(e))
    print('Проверьте интернет-доступ и повторите: python inspect_source.py')
