(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════
  // Секция 1: DOCX ↔ PDF
  // ═══════════════════════════════════════════════════════════════════════
  const dropArea  = document.getElementById('dropArea');
  const fileInput = document.getElementById('fileInput');
  const fileInfo  = document.getElementById('fileInfo');
  const toPdfBtn  = document.getElementById('toPdfBtn');
  const toWordBtn = document.getElementById('toWordBtn');
  const statusEl  = document.getElementById('status');

  let currentFile = null;

  ['dragover', 'drop'].forEach(ev =>
    document.addEventListener(ev, e => e.preventDefault())
  );
  ['dragenter', 'dragover'].forEach(ev =>
    dropArea.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation();
      dropArea.classList.add('highlight');
    })
  );
  ['dragleave', 'drop'].forEach(ev =>
    dropArea.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation();
      if (ev === 'dragleave' && dropArea.contains(e.relatedTarget)) return;
      dropArea.classList.remove('highlight');
    })
  );

  dropArea.addEventListener('drop', e => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) processFile(files[0]);
  });
  dropArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    if (e.target.files.length) processFile(e.target.files[0]);
    fileInput.value = '';
  });

  function processFile(file) {
    const name = file.name.toLowerCase();
    const isDocx = name.endsWith('.docx');
    const isPdf  = name.endsWith('.pdf');

    if (!isDocx && !isPdf) {
      showStatus('Поддерживаются только .docx и .pdf', 'error');
      resetFile();
      return;
    }

    currentFile = file;
    fileInfo.textContent = `${file.name} — ${(file.size / 1024).toFixed(1)} KB`;
    hideStatus();

    toPdfBtn.disabled  = !isDocx;
    toWordBtn.disabled = !isPdf;
    toPdfBtn.classList.toggle('secondary',  !isDocx);
    toWordBtn.classList.toggle('secondary', !isPdf);
  }

  function resetFile() {
    currentFile = null;
    fileInfo.textContent = '';
    toPdfBtn.disabled  = true;
    toWordBtn.disabled = true;
  }

  function showStatus(msg, type, spin) {
    statusEl.className = 'status ' + type;
    statusEl.innerHTML = (spin ? '<span class="spinner"></span>' : '') +
                         msg.replace(/\n/g, '<br>');
  }
  function hideStatus() { statusEl.className = 'status'; statusEl.textContent = ''; }

  async function upload(endpoint, button) {
    if (!currentFile) return;
    const fd = new FormData();
    fd.append('file', currentFile);

    const otherButton = button === toPdfBtn ? toWordBtn : toPdfBtn;
    button.disabled = otherButton.disabled = true;

    showStatus('Отправляю на сервер и конвертирую… (10–60 сек)', 'processing', true);

    try {
      const resp = await fetch(endpoint, { method: 'POST', body: fd });
      if (!resp.ok) {
        let errMsg = `HTTP ${resp.status}`;
        try {
          const j = await resp.json();
          errMsg = j.error || errMsg;
          if (j.details) errMsg += '\n\n' + j.details;
        } catch {}
        throw new Error(errMsg);
      }

      const blob = await resp.blob();
      const filename = currentFile.name.replace(/\.(docx|pdf)$/i, m =>
        m.toLowerCase() === '.docx' ? '.pdf' : '.docx');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      showStatus('✅ Готово! Файл скачивается.', 'success');
    } catch (err) {
      console.error(err);
      showStatus('❌ ' + err.message, 'error');
    } finally {
      const name = currentFile ? currentFile.name.toLowerCase() : '';
      toPdfBtn.disabled  = !name.endsWith('.docx');
      toWordBtn.disabled = !name.endsWith('.pdf');
    }
  }

  toPdfBtn.addEventListener('click',  () => upload('/api/docx-to-pdf', toPdfBtn));
  toWordBtn.addEventListener('click', () => upload('/api/pdf-to-docx', toWordBtn));

  // ═══════════════════════════════════════════════════════════════════════
  // Секция 2: Ссылка → QR-код
  // ═══════════════════════════════════════════════════════════════════════
  const qrForm      = document.getElementById('qrForm');
  const qrUrlInput  = document.getElementById('qrUrl');
  const qrBtn       = document.getElementById('qrBtn');
  const qrResult    = document.getElementById('qrResult');
  const qrImage     = document.getElementById('qrImage');
  const qrUrlShown  = document.getElementById('qrUrlShown');
  const qrDownload  = document.getElementById('qrDownload');
  const qrResetBtn  = document.getElementById('qrResetBtn');
  const qrStatus    = document.getElementById('qrStatus');

  let currentQrObjectUrl = null;
  let currentQrBlob = null;
  let currentQrUrl = '';

  function qrShowStatus(msg, type, spin) {
    qrStatus.className = 'status ' + type;
    qrStatus.innerHTML = (spin ? '<span class="spinner"></span>' : '') +
                         msg.replace(/\n/g, '<br>');
  }
  function qrHideStatus() { qrStatus.className = 'status'; qrStatus.textContent = ''; }

  function qrClear() {
    if (currentQrObjectUrl) {
      URL.revokeObjectURL(currentQrObjectUrl);
      currentQrObjectUrl = null;
    }
    currentQrBlob = null;
    currentQrUrl = '';
    qrImage.removeAttribute('src');
    qrUrlShown.textContent = '';
    qrDownload.removeAttribute('href');
    qrResult.classList.remove('visible');
    qrHideStatus();
  }

  qrResetBtn.addEventListener('click', () => {
    qrUrlInput.value = '';
    qrClear();
    qrUrlInput.focus();
  });

  qrForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    qrHideStatus();

    const raw = qrUrlInput.value.trim();
    if (!raw) {
      qrShowStatus('Введите ссылку', 'error');
      return;
    }

    let parsed;
    try { parsed = new URL(raw); }
    catch { qrShowStatus('Некорректный URL. Пример: https://example.com', 'error'); return; }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      qrShowStatus('Поддерживаются только http:// и https://', 'error');
      return;
    }

    if (currentQrObjectUrl) {
      URL.revokeObjectURL(currentQrObjectUrl);
      currentQrObjectUrl = null;
    }
    currentQrBlob = null;
    qrResult.classList.remove('visible');
    qrDownload.removeAttribute('href');

    qrBtn.disabled = true;
    qrShowStatus('Генерирую QR-код…', 'processing', true);

    try {
      const resp = await fetch('/api/link-to-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: raw, size: 512 }),
      });

      if (!resp.ok) {
        let errMsg = `HTTP ${resp.status}`;
        try {
          const j = await resp.json();
          errMsg = j.error || errMsg;
          if (j.details) errMsg += '\n\n' + j.details;
        } catch {}
        throw new Error(errMsg);
      }

      const blob = await resp.blob();
      currentQrBlob = blob;
      currentQrUrl = raw;

      currentQrObjectUrl = URL.createObjectURL(blob);
      qrImage.src = currentQrObjectUrl;
      qrUrlShown.textContent = raw;

      const host = parsed.host.replace(/[^\w.-]/g, '_').slice(0, 40) || 'link';
      qrDownload.href = currentQrObjectUrl;
      qrDownload.download = `qrcode-${host}.png`;

      qrResult.classList.add('visible');
      qrShowStatus('✅ QR-код готов.', 'success');
    } catch (err) {
      console.error(err);
      qrShowStatus('❌ ' + err.message, 'error');
    } finally {
      qrBtn.disabled = false;
    }
  });
})();