// Reticle — import.js
// JSON import flow: file picker, validation, preview, confirm & save.

import { goBack, showToast } from './ui.js';
import { saveArmy, setActiveArmyId } from './storage.js';
import { validateArmy } from './validator.js';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const PREVIEW_MAX = 4;

export function initImportScreen(onDone) {
  const backBtn    = document.getElementById('import-back');
  const fileInput  = document.getElementById('import-file-input');
  const dropzone   = document.getElementById('import-dropzone');
  const confirmBtn = document.getElementById('import-confirm');
  const retryBtn   = document.getElementById('import-error-retry');

  let pending = null;

  // --- Back ---
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      reset();
      goBack('screen-setup');
    });
  }

  // --- File input ---
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const f = fileInput.files[0];
      if (f) handle(f);
    });
  }

  // --- Drag & drop ---
  if (dropzone) {
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dropzone--over');
    });
    ['dragleave', 'dragend'].forEach((ev) =>
      dropzone.addEventListener(ev, () => dropzone.classList.remove('dropzone--over'))
    );
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dropzone--over');
      const f = e.dataTransfer.files[0];
      if (f) handle(f);
    });
  }

  // --- Confirm ---
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (!pending) return;
      try {
        await saveArmy(pending);
        await setActiveArmyId(pending.id);
        showToast('Liste gespeichert', 'success');
        const army = pending;
        reset();
        onDone(army);
      } catch (err) {
        showToast('Fehler beim Speichern', 'error');
        console.error('[Reticle] save error:', err);
      }
    });
  }

  // --- Retry ---
  if (retryBtn) {
    retryBtn.addEventListener('click', () => reset());
  }

  // --- Handlers ---

  function handle(file) {
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      showFatal('Nur .json-Dateien werden unterstuetzt.');
      return;
    }
    if (file.size > MAX_BYTES) {
      showFatal('Datei zu gross (max 5 MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      let raw;
      try { raw = JSON.parse(e.target.result); }
      catch { showFatal('Ungueltige JSON-Datei. Bitte Inhalt pruefen.'); return; }
      process(raw);
    };
    reader.onerror = () => showFatal('Datei konnte nicht gelesen werden.');
    reader.readAsText(file);
  }

  function process(raw) {
    const { army, problems, unclear, skipped } = validateArmy(raw);

    const previewWrap  = document.getElementById('import-preview');
    const previewCard  = document.getElementById('import-preview-card');
    const previewName  = document.getElementById('import-preview-name');
    const previewCount = document.getElementById('import-preview-count');
    const previewList  = document.getElementById('import-preview-units');
    const previewMore  = document.getElementById('import-preview-more');
    const warnCard     = document.getElementById('import-warn-card');
    const warnText     = document.getElementById('import-warn-text');
    const errCard      = document.getElementById('import-error-card');
    const errText      = document.getElementById('import-error-text');
    const btn          = document.getElementById('import-confirm');

    // Reset state
    previewWrap.hidden = false;
    previewCard.hidden = true;
    warnCard.hidden    = true;
    errCard.hidden     = true;
    btn.hidden         = true;

    if (!army) {
      errCard.hidden = false;
      errText.textContent = problems[0] || 'Datei konnte nicht verarbeitet werden.';
      pending = null;
      return;
    }

    // Preview card
    previewCard.hidden = false;
    previewName.textContent = army.name;
    previewCount.textContent =
      `${army.units.length} Einheit${army.units.length !== 1 ? 'en' : ''} erkannt \u00b7 ${army.totalPoints} Pkt.`;

    previewList.innerHTML = '';
    army.units.slice(0, PREVIEW_MAX).forEach((u) => {
      const li = document.createElement('li');
      li.className = 'preview-unit' + (u.status === 'unclear' ? ' preview-unit--unclear' : '');
      li.textContent = `${u.name} \u00d7${u.count} (${u.points} Pkt.)`;
      if (u.status === 'unclear') {
        const tag = document.createElement('span');
        tag.className = 'tag tag--warn';
        tag.textContent = 'unklar';
        li.appendChild(tag);
      }
      previewList.appendChild(li);
    });

    if (army.units.length > PREVIEW_MAX) {
      previewMore.hidden = false;
      previewMore.textContent = `+ ${army.units.length - PREVIEW_MAX} weitere`;
    } else {
      previewMore.hidden = true;
    }

    // Warning
    if (unclear > 0) {
      warnCard.hidden = false;
      warnText.textContent =
        `${unclear} Eintrag${unclear !== 1 ? 'e' : ''} unklar \u2014 nach Import korrigierbar.`;
    }

    btn.hidden = false;
    pending = army;
  }

  function showFatal(message) {
    const previewWrap = document.getElementById('import-preview');
    const previewCard = document.getElementById('import-preview-card');
    const warnCard    = document.getElementById('import-warn-card');
    const errCard     = document.getElementById('import-error-card');
    const errText     = document.getElementById('import-error-text');
    const btn         = document.getElementById('import-confirm');

    previewWrap.hidden = false;
    previewCard.hidden = true;
    warnCard.hidden    = true;
    errCard.hidden     = false;
    errText.textContent = message;
    btn.hidden         = true;
    pending = null;
  }

  function reset() {
    if (fileInput) fileInput.value = '';
    const previewWrap = document.getElementById('import-preview');
    if (previewWrap) previewWrap.hidden = true;
    pending = null;
  }
}
