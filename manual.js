// Reticle — manual.js
// Manual unit entry screen: form + autocomplete + live list.
// P3c: renderOpenUnitsList — Manuell-Hebel im Scan-Screen.

import { goBack, showToast } from './ui.js';
import { saveArmy, setActiveArmyId, getAllUnitNames } from './storage.js';

export function initManualScreen(onDone) {
  const backBtn    = document.getElementById('manual-back');
  const nameInput  = document.getElementById('manual-name');
  const countInput = document.getElementById('manual-count');
  const minusBtn   = document.getElementById('manual-count-minus');
  const plusBtn    = document.getElementById('manual-count-plus');
  const ptsInput   = document.getElementById('manual-points');
  const addBtn     = document.getElementById('manual-add');
  const doneBtn    = document.getElementById('manual-done');
  const listEl     = document.getElementById('manual-unit-list');
  const titleEl    = document.getElementById('manual-title');
  const acEl       = document.getElementById('manual-autocomplete');

  let units = [];
  let seq = 1;
  let knownNames = [];

  async function loadNames() {
    try { knownNames = await getAllUnitNames(); }
    catch { knownNames = []; }
  }

  loadNames();

  // --- Counter ---
  function getCount() { return Math.max(1, parseInt(countInput.value, 10) || 1); }
  function setCount(n) { countInput.value = Math.max(1, n); }

  if (minusBtn) minusBtn.addEventListener('click', () => setCount(getCount() - 1));
  if (plusBtn)  plusBtn.addEventListener('click',  () => setCount(getCount() + 1));

  // --- Autocomplete ---
  function showAC(val) {
    if (!val.trim() || !acEl) { hideAC(); return; }
    const lower = val.toLowerCase();
    const hits = knownNames
      .filter((n) => n.toLowerCase().includes(lower) && n.toLowerCase() !== lower)
      .slice(0, 3);
    if (!hits.length) { hideAC(); return; }
    acEl.innerHTML = '';
    hits.forEach((h) => {
      const li = document.createElement('li');
      li.className = 'ac-item';
      li.textContent = h;
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        nameInput.value = h;
        hideAC();
      });
      acEl.appendChild(li);
    });
    acEl.hidden = false;
  }

  function hideAC() { if (acEl) acEl.hidden = true; }

  if (nameInput) {
    nameInput.addEventListener('input', () => showAC(nameInput.value));
    nameInput.addEventListener('blur',  () => setTimeout(hideAC, 150));
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addUnit(); }
    });
  }

  // --- List render ---
  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = '';
    units.forEach((u) => {
      const li = document.createElement('li');
      li.className = 'mu-item';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'mu-name';
      nameSpan.textContent = `${u.name} \u00d7${u.count}`;
      const ptsSpan = document.createElement('span');
      ptsSpan.className = 'mu-pts';
      ptsSpan.textContent = `${u.points} Pkt.`;
      li.appendChild(nameSpan);
      li.appendChild(ptsSpan);
      listEl.appendChild(li);
    });
    if (titleEl) titleEl.textContent = `MANUELL \u00b7 ${units.length}`;
  }

  // --- Add unit ---
  function addUnit() {
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) {
      showToast('Einheitenname fehlt', 'warn');
      if (nameInput) nameInput.focus();
      return;
    }
    const count = getCount();
    const pts = Math.max(0, parseInt(ptsInput.value, 10) || 0);

    units.push({
      id: `unit-${String(seq).padStart(3, '0')}`,
      name,
      count,
      maxCount: count,   // P4: Soll-Stärke = Anfangswert
      points: pts,
      status: 'active',
      scannedAt: null,
    });
    seq++;

    if (!knownNames.includes(name)) knownNames.push(name);

    if (nameInput)  nameInput.value  = '';
    if (countInput) countInput.value = '1';
    if (ptsInput)   ptsInput.value   = '';
    hideAC();
    renderList();
    if (nameInput) nameInput.focus();
  }

  // --- Finalize ---
  async function finalize() {
    if (!units.length) {
      showToast('Mindestens eine Einheit benoetigt', 'warn');
      return;
    }
    const now = new Date().toISOString();
    const army = {
      schemaVersion: '1.0',
      id: `army-${Date.now()}`,
      name: `Army ${new Date().toLocaleDateString('de-DE')}`,
      createdAt: now,
      updatedAt: now,
      units: [...units],
      totalPoints: units.reduce((s, u) => s + u.points, 0),
    };
    try {
      await saveArmy(army);
      await setActiveArmyId(army.id);
      showToast('Liste gespeichert', 'success');
      const saved = army;
      resetState();
      onDone(saved);
    } catch (err) {
      showToast('Fehler beim Speichern', 'error');
      console.error('[Reticle] save error:', err);
    }
  }

  function resetState() {
    units = [];
    seq   = 1;
    if (nameInput)  nameInput.value  = '';
    if (countInput) countInput.value = '1';
    if (ptsInput)   ptsInput.value   = '';
    hideAC();
    renderList();
    loadNames();
  }

  if (addBtn)  addBtn.addEventListener('click',  addUnit);
  if (doneBtn) doneBtn.addEventListener('click',  finalize);

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (units.length > 0 && !window.confirm('Nicht gespeicherte Eintraege gehen verloren. Trotzdem zurueck?')) return;
      resetState();
      goBack('screen-setup');
    });
  }

  return { reset: resetState };
}

/**
 * Rendert eine Liste offener (noch nicht gescannter) Einheiten in einen Container.
 * Wird vom Scan-Screen "Manuell"-Picker aufgerufen.
 *
 * @param {HTMLElement} containerEl  - Ziel-Element (wird geleert und befüllt)
 * @param {object[]}    openUnits    - Einheiten mit scannedAt === null
 * @param {function}    onPick       - (unit) => void  — aufgerufen bei Auswahl
 */
export function renderOpenUnitsList(containerEl, openUnits, onPick) {
  if (!containerEl) return;
  containerEl.innerHTML = '';

  if (!openUnits?.length) {
    const msg = document.createElement('p');
    msg.className = 'scan-picker-empty';
    msg.textContent = 'Alle Einheiten bereits erkannt. \u2713';
    containerEl.appendChild(msg);
    return;
  }

  openUnits.forEach((unit) => {
    const btn = document.createElement('button');
    btn.className = 'scan-picker-item';
    btn.innerHTML = `
      <span class="scan-picker-item-name">${unit.name}</span>
      <span class="scan-picker-item-meta">\u00d7${unit.count}\u00a0\u00b7\u00a0${unit.points}\u00a0Pkt.</span>
    `;
    btn.addEventListener('click', () => onPick(unit));
    containerEl.appendChild(btn);
  });
}
