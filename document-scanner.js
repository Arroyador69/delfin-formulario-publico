/**
 * Escaneo opcional de documento (DNI/NIE/pasaporte) — 100 % en el navegador.
 * No sube imágenes al servidor. Solo rellena campos identificativos.
 */
(function () {
  'use strict';

  const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/+esm';
  const MRZ_URL = 'https://cdn.jsdelivr.net/npm/mrz@4.2.1/+esm';
  const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js';

  let libsPromise = null;
  let activeTraveler = '1';
  let scanState = { step: 'front', frontData: null, docKind: 'PAS' };

  function t(key) {
    if (typeof window.getTranslation === 'function') return window.getTranslation(key);
    return key;
  }

  function fieldNames(which) {
    if (which === '2') {
      return {
        nombre: 'nombre2',
        apellido1: 'apellido1_2',
        apellido2: 'apellido2_2',
        fechaNacimiento: 'fechaNacimiento2',
        tipoDocumento: 'tipoDocumento2',
        numeroDocumento: 'numeroDocumento2',
        soporteDocumento: 'soporteDocumento2',
        sexo: 'sexo2',
      };
    }
    return {
      nombre: 'nombre',
      apellido1: 'apellido1',
      apellido2: 'apellido2',
      fechaNacimiento: 'fechaNacimiento',
      tipoDocumento: 'tipoDocumento',
      numeroDocumento: 'numeroDocumento',
      soporteDocumento: 'soporteDocumento',
      sexo: 'sexo',
    };
  }

  function getDocKindFromSelect(which) {
    const f = fieldNames(which);
    const el = document.querySelector('[name="' + f.tipoDocumento + '"]');
    const v = String(el && el.value ? el.value : 'PAS').toUpperCase();
    if (v === 'NIF' || v === 'NIE') return v;
    return 'PAS';
  }

  function loadLibs() {
    if (!libsPromise) {
      libsPromise = Promise.all([
        import(ZXING_URL),
        import(MRZ_URL),
        import(TESSERACT_URL),
      ]).then(([zxing, mrz, tesseract]) => ({ zxing, mrz, tesseract }));
    }
    return libsPromise;
  }

  function dniLetter(num) {
    const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
    const n = parseInt(String(num).replace(/\D/g, ''), 10);
    if (Number.isNaN(n)) return null;
    return letters[n % 23];
  }

  function validateNifNumber(n) {
    const m = String(n).toUpperCase().replace(/\s/g, '').match(/^(\d{7,8})([A-Z])$/);
    if (!m) return false;
    return dniLetter(m[1]) === m[2];
  }

  function validateNieNumber(n) {
    const m = String(n).toUpperCase().replace(/\s/g, '').match(/^([XYZ])(\d{7})([A-Z])$/);
    if (!m) return false;
    const map = { X: '0', Y: '1', Z: '2' };
    return dniLetter(map[m[1]] + m[2]) === m[3];
  }

  function mrzSexToForm(sex) {
    const s = String(sex || '').toLowerCase();
    if (s === 'female' || s === 'f') return 'M';
    if (s === 'male' || s === 'm') return 'H';
    return 'O';
  }

  function yyMmDdToIso(yymmdd) {
    if (!yymmdd || yymmdd.length !== 6) return '';
    const yy = parseInt(yymmdd.slice(0, 2), 10);
    const mm = yymmdd.slice(2, 4);
    const dd = yymmdd.slice(4, 6);
    const century = yy >= 30 ? 1900 : 2000;
    return century + yy + '-' + mm + '-' + dd;
  }

  function splitSurnames(lastName) {
    const parts = String(lastName || '')
      .split(/[\s<]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return { apellido1: '', apellido2: '' };
    if (parts.length === 1) return { apellido1: parts[0], apellido2: '' };
    return { apellido1: parts[0], apellido2: parts.slice(1).join(' ') };
  }

  function parseNamesFromMrz(fields) {
    let apellido1 = '';
    let apellido2 = '';
    let nombre = '';

    if (fields.lastName) {
      const raw = String(fields.lastName).replace(/</g, ' ').trim();
      const bits = raw.split(/\s+/).filter(Boolean);
      apellido1 = bits[0] || '';
      apellido2 = bits.slice(1).join(' ');
    }
    if (fields.firstName) {
      nombre = String(fields.firstName).replace(/</g, ' ').trim();
    }
    return { nombre, apellido1, apellido2 };
  }

  function normalizeMrzLines(text) {
    return String(text || '')
      .toUpperCase()
      .split(/\r?\n/)
      .map((l) => l.replace(/[^A-Z0-9<]/g, ''))
      .filter((l) => l.length >= 28 && l.includes('<'));
  }

  function pickMrzGroups(lines) {
    const td3 = lines.filter((l) => l.length >= 42);
    if (td3.length >= 2) {
      const a = td3.find((l) => l.startsWith('P<')) || td3[0];
      const b = td3.find((l) => l !== a && /^\d/.test(l.charAt(0) + l.charAt(1))) || td3[1];
      if (a && b) return [a.slice(0, 44).padEnd(44, '<'), b.slice(0, 44).padEnd(44, '<')];
    }
    const td1 = lines.filter((l) => l.length >= 28 && l.length <= 32);
    if (td1.length >= 3) {
      return td1.slice(0, 3).map((l) => l.slice(0, 30).padEnd(30, '<'));
    }
    if (lines.length >= 2) {
      const joined = lines.join('\n');
      const m44 = joined.match(/P<[A-Z]{3}[A-Z0-9<]{39}\d[A-Z0-9<]{43}/);
      if (m44) {
        const block = m44[0];
        return [block.slice(0, 44), block.slice(44, 88)];
      }
    }
    return null;
  }

  function parseMrzText(text, parseFn) {
    const lines = normalizeMrzLines(text);
    const group = pickMrzGroups(lines);
    if (!group) return null;
    try {
      const result = parseFn(group);
      if (!result || !result.valid) return null;
      return result;
    } catch {
      return null;
    }
  }

  function extractPatterns(text) {
    const u = String(text || '').toUpperCase();
    const out = {};
    const dni = u.match(/\b(\d{8}[A-HJ-NP-TV-Z])\b/);
    const nie = u.match(/\b([XYZ]\d{7}[A-HJ-NP-TV-Z])\b/);
    const soporte = u.match(/\b([A-Z]{3}\d{6})\b/);
    if (dni) out.numeroDocumento = dni[1];
    if (nie) out.numeroDocumento = nie[1];
    if (soporte) out.soporteDocumento = soporte[1];
    return out;
  }

  function mrzToPayload(result, docKindHint) {
    const f = result.fields || {};
    const names = parseNamesFromMrz(f);
    let numero = String(f.documentNumber || '').replace(/</g, '').trim();
    let tipo = docKindHint || 'PAS';
    const optional = String(f.optional1 || f.optional2 || '').replace(/</g, '').trim();

    if (f.documentCode && String(f.documentCode).startsWith('P')) tipo = 'PAS';
    else if (f.issuingState === 'ESP' || f.nationality === 'ESP') {
      if (/^[XYZ]/.test(numero)) tipo = 'NIE';
      else if (/^\d/.test(numero)) tipo = 'NIF';
    }
    if (/^[XYZ]\d{7}[A-Z]$/.test(numero)) tipo = 'NIE';
    if (/^\d{7,8}[A-Z]$/.test(numero)) tipo = 'NIF';

    const payload = {
      nombre: names.nombre,
      apellido1: names.apellido1,
      apellido2: names.apellido2,
      numeroDocumento: numero,
      fechaNacimiento: yyMmDdToIso(f.birthDate),
      sexo: mrzSexToForm(f.sex),
      tipoDocumento: tipo,
      soporteDocumento: '',
    };

    if (/^[A-Z]{3}\d{6}$/.test(optional)) payload.soporteDocumento = optional;
    return payload;
  }

  function mergePayload(base, extra) {
    const out = Object.assign({}, base || {});
    Object.keys(extra || {}).forEach((k) => {
      if (extra[k] && String(extra[k]).trim()) out[k] = extra[k];
    });
    return out;
  }

  function validatePayload(data, docKind) {
    const issues = [];
    if (!data.nombre || !data.apellido1) issues.push('names');
    if (!data.numeroDocumento) issues.push('document');
    if (docKind === 'NIF' && !validateNifNumber(data.numeroDocumento)) issues.push('nif');
    if (docKind === 'NIE' && !validateNieNumber(data.numeroDocumento)) issues.push('nie');
    if ((docKind === 'NIF' || docKind === 'NIE') && !data.soporteDocumento) issues.push('soporte');
    if (!data.fechaNacimiento) issues.push('birth');
    return issues;
  }

  async function fileToCanvas(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      const maxW = 1600;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function cropCanvas(canvas, topRatio, heightRatio) {
    const y = Math.floor(canvas.height * topRatio);
    const h = Math.floor(canvas.height * heightRatio);
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = h;
    out.getContext('2d').drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    return out;
  }

  async function decodePdf417(canvas, zxing) {
    const {
      MultiFormatReader,
      RGBLuminanceSource,
      BinaryBitmap,
      HybridBinarizer,
      DecodeHintType,
      BarcodeFormat,
    } = zxing;
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new MultiFormatReader();
    reader.setHints(hints);

    const attempts = [canvas, cropCanvas(canvas, 0.35, 0.65), cropCanvas(canvas, 0.5, 0.5)];
    for (const c of attempts) {
      try {
        const imgData = c.getContext('2d').getImageData(0, 0, c.width, c.height);
        const source = new RGBLuminanceSource(imgData.data, c.width, c.height);
        const bitmap = new BinaryBitmap(new HybridBinarizer(source));
        const result = reader.decode(bitmap);
        if (result && result.getText()) return result.getText();
      } catch {
        /* try next crop */
      }
    }
    return null;
  }

  async function ocrMrz(canvas, tesseract) {
    const regions = [
      cropCanvas(canvas, 0.55, 0.45),
      cropCanvas(canvas, 0.62, 0.38),
      cropCanvas(canvas, 0.68, 0.32),
    ];
    const worker = await tesseract.createWorker('eng');
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
    });
    let best = '';
    for (const region of regions) {
      try {
        const { data } = await worker.recognize(region);
        if (data.text && data.text.length > best.length) best = data.text;
      } catch {
        /* continue */
      }
    }
    await worker.terminate();
    return best;
  }

  async function processImage(file, side) {
    const { zxing, mrz, tesseract } = await loadLibs();
    const canvas = await fileToCanvas(file);
    const docKind = scanState.docKind;
    let payload = null;

    const pdfText = await decodePdf417(canvas, zxing);
    if (pdfText) {
      const mrzFromPdf = parseMrzText(pdfText, mrz.parse);
      if (mrzFromPdf) payload = mrzToPayload(mrzFromPdf, docKind);
      else payload = mergePayload(extractPatterns(pdfText), {});
    }

    const ocrText = await ocrMrz(canvas, tesseract);
    if (ocrText) {
      const mrzFromOcr = parseMrzText(ocrText, mrz.parse);
      if (mrzFromOcr) payload = mergePayload(payload, mrzToPayload(mrzFromOcr, docKind));
      payload = mergePayload(payload, extractPatterns(ocrText));
    }

    if (side === 'front' && docKind !== 'PAS') {
      const patterns = extractPatterns(ocrText + ' ' + (pdfText || ''));
      payload = mergePayload(payload, patterns);
      scanState.frontData = payload;
      return payload;
    }

    if (side === 'back' && scanState.frontData) {
      payload = mergePayload(scanState.frontData, payload);
    }

    if (docKind === 'PAS' && payload) payload.tipoDocumento = 'PAS';

    return payload;
  }

  function setField(name, value) {
    const el = document.querySelector('[name="' + name + '"]');
    if (!el || value == null || String(value).trim() === '') return;
    el.value = String(value).trim();
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applyToForm(data, which) {
    const f = fieldNames(which);
    setField(f.nombre, data.nombre);
    setField(f.apellido1, data.apellido1);
    setField(f.apellido2, data.apellido2);
    setField(f.fechaNacimiento, data.fechaNacimiento);
    setField(f.numeroDocumento, data.numeroDocumento);
    setField(f.sexo, data.sexo);
    if (data.tipoDocumento) setField(f.tipoDocumento, data.tipoDocumento);
    if (data.soporteDocumento) setField(f.soporteDocumento, data.soporteDocumento);
    if (window.delfinToggleSoporteDoc) window.delfinToggleSoporteDoc(which);
  }

  function ensureModal() {
    let modal = document.getElementById('delfinDocScanModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'delfinDocScanModal';
    modal.className = 'fixed inset-0 z-50 hidden';
    modal.innerHTML =
      '<div class="absolute inset-0 bg-black/50" data-close="1"></div>' +
      '<div class="relative mx-auto mt-8 max-w-lg rounded-lg bg-white shadow-xl p-6 m-4">' +
      '<h3 id="delfinDocScanTitle" class="text-lg font-semibold text-gray-900 mb-2"></h3>' +
      '<p id="delfinDocScanStep" class="text-sm text-gray-600 mb-2"></p>' +
      '<p id="delfinDocScanPrivacy" class="text-xs text-gray-500 mb-4"></p>' +
      '<p id="delfinDocScanNationality" class="text-xs text-blue-700 mb-4"></p>' +
      '<div id="delfinDocScanReview" class="hidden mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm"></div>' +
      '<div id="delfinDocScanError" class="hidden mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"></div>' +
      '<div class="flex flex-wrap gap-2 mb-4">' +
      '<label class="btn-primary cursor-pointer inline-flex items-center">' +
      '<span id="delfinDocScanCameraLabel">📷</span>' +
      '<input type="file" accept="image/*" capture="environment" class="hidden" id="delfinDocScanCameraInput" />' +
      '</label>' +
      '<label class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm cursor-pointer bg-white hover:bg-gray-50">' +
      '<span id="delfinDocScanUploadLabel">📁</span>' +
      '<input type="file" accept="image/*" class="hidden" id="delfinDocScanFileInput" />' +
      '</label>' +
      '</div>' +
      '<p id="delfinDocScanProcessing" class="hidden text-sm text-gray-600 mb-4">…</p>' +
      '<div class="flex justify-end gap-2">' +
      '<button type="button" id="delfinDocScanCancel" class="px-4 py-2 text-sm text-gray-700 border rounded-md"></button>' +
      '<button type="button" id="delfinDocScanApply" class="hidden btn-primary text-sm"></button>' +
      '</div></div>';
    document.body.appendChild(modal);

    modal.querySelector('[data-close]').addEventListener('click', closeModal);
    document.getElementById('delfinDocScanCancel').addEventListener('click', closeModal);
    document.getElementById('delfinDocScanCameraInput').addEventListener('change', onFileSelected);
    document.getElementById('delfinDocScanFileInput').addEventListener('change', onFileSelected);
    document.getElementById('delfinDocScanApply').addEventListener('click', onApply);

    return modal;
  }

  function refreshModalTexts() {
    const modal = ensureModal();
    document.getElementById('delfinDocScanTitle').textContent = t('scan.modalTitle');
    document.getElementById('delfinDocScanPrivacy').textContent = t('scan.privacy');
    document.getElementById('delfinDocScanNationality').textContent = t('scan.nationalityManual');
    document.getElementById('delfinDocScanCameraLabel').textContent = '📷 ' + t('scan.captureCamera');
    document.getElementById('delfinDocScanUploadLabel').textContent = '📁 ' + t('scan.uploadFile');
    document.getElementById('delfinDocScanCancel').textContent = t('scan.cancel');
    document.getElementById('delfinDocScanApply').textContent = t('scan.apply');
    updateStepText();
    modal.classList.toggle('hidden', modal.classList.contains('hidden'));
  }

  function updateStepText() {
    const el = document.getElementById('delfinDocScanStep');
    if (!el) return;
    if (scanState.docKind === 'PAS') el.textContent = t('scan.stepPassport');
    else if (scanState.step === 'front') el.textContent = t('scan.stepFront');
    else el.textContent = t('scan.stepBack');
  }

  function showError(msg) {
    const box = document.getElementById('delfinDocScanError');
    box.textContent = msg;
    box.classList.remove('hidden');
  }

  function hideError() {
    document.getElementById('delfinDocScanError').classList.add('hidden');
  }

  function showReview(data) {
    const box = document.getElementById('delfinDocScanReview');
    const lines = [
      t('scan.reviewTitle'),
      data.nombre + ' ' + data.apellido1 + (data.apellido2 ? ' ' + data.apellido2 : ''),
      data.numeroDocumento || '',
      data.soporteDocumento ? t('travelers.documentSupportDni').replace(' *', '') + ': ' + data.soporteDocumento : '',
      data.fechaNacimiento || '',
    ].filter(Boolean);
    box.innerHTML = lines.map((l) => '<div>' + escapeHtml(l) + '</div>').join('');
    box.classList.remove('hidden');
    document.getElementById('delfinDocScanApply').classList.remove('hidden');
    scanState.pendingData = data;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function openModal(which) {
    activeTraveler = which;
    scanState = {
      step: 'front',
      frontData: null,
      docKind: getDocKindFromSelect(which),
      pendingData: null,
    };
    hideError();
    document.getElementById('delfinDocScanReview').classList.add('hidden');
    document.getElementById('delfinDocScanApply').classList.add('hidden');
    document.getElementById('delfinDocScanProcessing').classList.add('hidden');
    refreshModalTexts();
    ensureModal().classList.remove('hidden');
  }

  function closeModal() {
    const modal = document.getElementById('delfinDocScanModal');
    if (modal) modal.classList.add('hidden');
    scanState.pendingData = null;
  }

  async function onFileSelected(ev) {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    hideError();
    document.getElementById('delfinDocScanReview').classList.add('hidden');
    document.getElementById('delfinDocScanApply').classList.add('hidden');

    const proc = document.getElementById('delfinDocScanProcessing');
    proc.textContent = t('scan.processing');
    proc.classList.remove('hidden');

    try {
      const side = scanState.step;
      const data = await processImage(file, side);
      proc.classList.add('hidden');

      if (!data || !data.numeroDocumento) {
        showError(t('scan.errorNoData'));
        return;
      }

      const kind = scanState.docKind;
      if (kind === 'PAS') {
        data.tipoDocumento = 'PAS';
        const issues = validatePayload(data, 'PAS');
        if (issues.includes('names') || issues.includes('document')) {
          showError(t('scan.errorBadImage'));
          return;
        }
        showReview(data);
        return;
      }

      if (side === 'front') {
        scanState.step = 'back';
        updateStepText();
        if (!data.soporteDocumento) {
          showError('');
          document.getElementById('delfinDocScanError').classList.add('hidden');
        }
        return;
      }

      data.tipoDocumento = kind;
      const issues = validatePayload(data, kind);
      if (issues.length && (issues.includes('nif') || issues.includes('nie') || issues.includes('soporte'))) {
        showError(t('scan.errorBadImage'));
        showReview(data);
        return;
      }
      showReview(data);
    } catch (e) {
      proc.classList.add('hidden');
      console.error('Document scan error:', e);
      showError(t('scan.errorLib'));
    }
  }

  function onApply() {
    if (scanState.pendingData) {
      applyToForm(scanState.pendingData, activeTraveler);
    }
    closeModal();
  }

  function injectButtons() {
    const sections = document.querySelectorAll('.border.rounded-lg.p-6.mb-4.bg-gray-50');
    sections.forEach((sec, idx) => {
      const which = idx === 0 ? '1' : '2';
      if (which === '2' && sec.id !== 'traveler2Section') return;
      if (which === '2' && sec.classList.contains('hidden')) return;
      const id = 'delfinScanBtn' + which;
      if (document.getElementById(id)) return;
      const h4 = sec.querySelector('h4');
      if (!h4) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = id;
      btn.className =
        'mb-4 inline-flex items-center px-3 py-2 border border-emerald-300 rounded-md text-sm font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100';
      btn.setAttribute('data-i18n', 'scan.button');
      btn.textContent = t('scan.button');
      btn.addEventListener('click', () => openModal(which));
      h4.insertAdjacentElement('afterend', btn);
    });
  }

  function init() {
    injectButtons();
    const addT2 = document.getElementById('addTraveler2');
    if (addT2) addT2.addEventListener('click', () => setTimeout(injectButtons, 100));
    const orig = window.changeLanguage;
    if (typeof orig === 'function') {
      window.changeLanguage = function (lang) {
        orig(lang);
        document.querySelectorAll('[data-i18n="scan.button"]').forEach((el) => {
          el.textContent = t('scan.button');
        });
        if (document.getElementById('delfinDocScanModal') && !document.getElementById('delfinDocScanModal').classList.contains('hidden')) {
          refreshModalTexts();
        }
      };
    }
  }

  window.delfinDocumentScanner = { init, open: openModal };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
