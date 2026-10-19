const express = require('express');
const multer  = require('multer');
const { spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Пути ────────────────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'outputs');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Бинарники ───────────────────────────────────────────────────────────────
// Можно переопределить через переменные окружения.
const SOFFICE = process.env.SOFFICE_PATH ||
  (process.platform === 'darwin'
    ? '/Applications/LibreOffice.app/Contents/MacOS/soffice'
    : process.platform === 'win32'
      ? 'C:\\Program Files\\LibreOffice\\program\\soffice.com'
      : 'soffice');

const PYTHON = process.env.PYTHON_PATH ||
  (process.platform === 'win32' ? 'python' : 'python3');

// ─── Multer ──────────────────────────────────────────────────────────────────
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ─── Утилиты ─────────────────────────────────────────────────────────────────
const uid = () => crypto.randomBytes(8).toString('hex');

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { ...opts, windowsHide: true });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited with code ${code}\n${stderr || stdout}`));
    });
  });
}

function safeBaseName(originalName) {
  const base = path.basename(originalName, path.extname(originalName));
  return base.replace(/[^\w\-. а-яА-ЯёЁ]/g, '_').slice(0, 100) || 'result';
}

function cleanup(...paths) {
  for (const p of paths) {
    try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
  }
}

// ─── Статика ─────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── DOCX → PDF (LibreOffice) ────────────────────────────────────────────────
app.post('/api/docx-to-pdf', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });

  const inputPath = req.file.path;
  const outDir    = path.join(OUTPUT_DIR, uid());
  fs.mkdirSync(outDir, { recursive: true });

  try {
    await run(SOFFICE, [
      '--headless',
      '--norestore',
      '--nolockcheck',
      '--nodefault',
      '--convert-to', 'pdf',
      '--outdir', outDir,
      inputPath,
    ], { timeout: 90_000 });

    const files = fs.readdirSync(outDir);
    if (!files.length) throw new Error('LibreOffice не создал файл');

    const outFile = path.join(outDir, files[0]);
    const downloadName = safeBaseName(req.file.originalname) + '.pdf';

    res.download(outFile, downloadName, () => {
      cleanup(outDir, inputPath);
    });
  } catch (err) {
    console.error('[docx-to-pdf]', err);
    cleanup(outDir, inputPath);
    res.status(500).json({
      error: 'Не удалось сконвертировать. Проверьте, что LibreOffice установлен и путь SOFFICE_PATH корректен.',
      details: err.message,
    });
  }
});

// ─── PDF → DOCX (pdf2docx через Python) ──────────────────────────────────────
app.post('/api/pdf-to-docx', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });

  const inputPath = req.file.path;
  const outFile   = path.join(OUTPUT_DIR, uid() + '.docx');

  try {
    await run(PYTHON, [
      path.join(__dirname, 'convert.py'),
      inputPath,
      outFile,
    ], { timeout: 180_000 });

    if (!fs.existsSync(outFile)) throw new Error('pdf2docx не создал файл');

    const downloadName = safeBaseName(req.file.originalname) + '.docx';

    res.download(outFile, downloadName, () => {
      cleanup(outFile, inputPath);
    });
  } catch (err) {
    console.error('[pdf-to-docx]', err);
    cleanup(outFile, inputPath);
    res.status(500).json({
      error: 'Не удалось сконвертировать. Проверьте, что установлен Python и пакет pdf2docx (pip install pdf2docx).',
      details: err.message,
    });
  }
});

// ─── Ссылка → QR-код ─────────────────────────────────────────────────────────
app.post('/api/link-to-qr', express.json({ limit: '4kb' }), async (req, res) => {
  const { url, size } = req.body || {};

  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'URL не указан' });
  }

  const trimmed = url.trim();

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return res.status(400).json({ error: 'Некорректный URL. Пример: https://example.com' });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Поддерживаются только http:// и https://' });
  }

  const width = Math.min(Math.max(parseInt(size, 10) || 512, 128), 1024);

  try {
    const buffer = await QRCode.toBuffer(trimmed, {
      type: 'png',
      width,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (err) {
    console.error('[link-to-qr]', err);
    res.status(500).json({ error: 'Не удалось сгенерировать QR-код', details: err.message });
  }
});

// ─── Health-check ────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  const info = { soffice: SOFFICE, python: PYTHON, ok: true, errors: [] };
  try { await run(SOFFICE, ['--version'], { timeout: 10_000 }); }
  catch (e) { info.ok = false; info.errors.push('soffice: ' + e.message); }
  try { await run(PYTHON, ['-c', 'import pdf2docx'], { timeout: 10_000 }); }
  catch (e) { info.ok = false; info.errors.push('pdf2docx: ' + e.message); }
  res.json(info);
});

// ─── Старт ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ▶  http://localhost:${PORT}\n`);
  console.log(`  SOFFICE = ${SOFFICE}`);
  console.log(`  PYTHON  = ${PYTHON}\n`);
});