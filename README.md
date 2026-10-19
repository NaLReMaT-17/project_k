# Word ↔ PDF Converter + QR

Локальный сервер для конвертации документов и генерации QR-кодов.

## Возможности

- **DOCX → PDF** через LibreOffice (headless)
- **PDF → DOCX** через `pdf2docx` (Python)
- **Ссылка → QR-код** (PNG) через `qrcode`

## Требования

- Node.js 18+
- **LibreOffice** (Writer достаточно)
- **Python 3.9+** и пакет `pdf2docx`

### Установка LibreOffice

- Windows: https://ru.libreoffice.org/download/ (установщик `.exe`)
- macOS: `brew install --cask libreoffice`
- Ubuntu/Debian: `sudo apt install -y libreoffice-writer`

Проверка: `soffice --version`

### Установка Python и pdf2docx

- Windows: https://www.python.org/downloads/ (галочка «Add Python to PATH»)
- macOS / Linux: обычно предустановлен

Затем: `python -m pip install pdf2docx` (на macOS/Linux — `python3 -m pip install --user pdf2docx`)

## Установка и запуск

```bash
npm install
npm start
```

Открыть `http://localhost:3000`.

## Проверка окружения

`http://localhost:3000/api/health` — покажет, найдены ли `soffice` и `pdf2docx`.

## API

| Метод | Endpoint | Описание |
|---|---|---|
| POST | `/api/docx-to-pdf` | Форма с полем `file` (DOCX), возвращает PDF |
| POST | `/api/pdf-to-docx` | Форма с полем `file` (PDF), возвращает DOCX |
| POST | `/api/link-to-qr` | JSON `{ "url": "...", "size": 512 }`, возвращает PNG |
| GET | `/api/health` | Статус бинарников |

## Ограничения

- PDF без текстового слоя (сканы) → DOCX даст пустой файл. Нужен OCR.
- Если `soffice` не в PATH, задайте `SOFFICE_PATH` при запуске.