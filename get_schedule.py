
import requests
from pathlib import Path

base = "https://jour.vsu.ru"
files = [
    "/js/schedule/schedule.js",
    "/js/schedule/schedule_nomodule.js",
]

for path in files:
    url = base + path
    print(f"\nЗагрузка: {url}")

    try:
        response = requests.get(
            url,
            timeout=30,
            headers={"User-Agent": "Mozilla/5.0"}
        )
        print("HTTP:", response.status_code)
        print("Content-Type:", response.headers.get("Content-Type"))

        response.raise_for_status()

        name = Path(path).name
        Path(name).write_text(response.text, encoding="utf-8")
        print(f"Сохранено: {name}")
        print(response.text[:1500])

    except requests.RequestException as error:
        print("Ошибка:", error)
