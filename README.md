# Word ↔ PDF Converter + QR

Веб-приложение для конвертации документов (DOCX ↔ PDF) и генерации QR-кодов из ссылок.
Работает на Node.js + Express, конвертация выполняется на сервере.

## Возможности

- **DOCX → PDF** через LibreOffice (headless)
- **PDF → DOCX** через `pdf2docx` (Python)
- **Ссылка → QR-код** (PNG) через [`qrcode`](https://www.npmjs.com/package/qrcode)
- Всё в одном сервисе, единый UI на одной странице

## Требования

| Компонент | Версия | Зачем |
|---|---|---|
| Node.js | **18 LTS+** (рекомендуется 20 или 22) | Сервер и `npm` |
| LibreOffice | Writer (любая актуальная) | DOCX → PDF |
| Python | **3.9+** | `pdf2docx` |
| `pdf2docx` | последняя | PDF → DOCX |

### Установка LibreOffice

- **Windows**: скачать установщик с https://ru.libreoffice.org/download/  
  По умолчанию ставится в `C:\Program Files\LibreOffice`. Исполняемый файл для headless-режима — `soffice.com` (не `soffice.exe`).
- **macOS**: `brew install --cask libreoffice`
- **Ubuntu/Debian**: `sudo apt install -y libreoffice-writer fonts-dejavu fonts-liberation fonts-noto-core`

Проверка: `soffice --version` (Linux/macOS) или `"C:\Program Files\LibreOffice\program\soffice.com" --version` (Windows).

### Установка Python и pdf2docx

- **Windows**: установить с https://www.python.org/downloads/ (обязательно отметить «Add Python to PATH»), затем:  
  ```powershell
  python -m pip install pdf2docx