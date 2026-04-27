// Reticle — print.js
// Print page logic: load army from IndexedDB, build/extend marker mapping, render sheet.

import { getArmy, saveArmy } from './storage.js';
import { generateMarkerSVG } from './marker.js';

const SIZE_MM = { small: 6, medium: 8, large: 12 };

function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

// Build or extend an existing markerMapping without reassigning used IDs.
function buildMapping(army, mode) {
  const existing = army.markerMapping;

  if (existing && existing.mode === mode) {
    // Extend: find the next free ID beyond all existing ones
    let nextId = existing.entries.reduce((max, e) => Math.max(max, e.markerId), -1) + 1;

    if (mode === 'per-unit') {
      const mapped = new Set(existing.entries.map((e) => e.unitId));
      for (const unit of army.units) {
        if (!mapped.has(unit.id)) {
          existing.entries.push({ markerId: nextId++, unitId: unit.id, modelIndex: null });
        }
      }
    } else {
      const mapped = new Set(existing.entries.map((e) => `${e.unitId}:${e.modelIndex}`));
      for (const unit of army.units) {
        for (let m = 1; m <= unit.count; m++) {
          const key = `${unit.id}:${m}`;
          if (!mapped.has(key)) {
            existing.entries.push({ markerId: nextId++, unitId: unit.id, modelIndex: m });
          }
        }
      }
    }
    return existing;
  }

  // Fresh mapping
  const entries = [];
  let nextId = 0;

  if (mode === 'per-unit') {
    for (const unit of army.units) {
      entries.push({ markerId: nextId++, unitId: unit.id, modelIndex: null });
    }
  } else {
    for (const unit of army.units) {
      for (let m = 1; m <= unit.count; m++) {
        entries.push({ markerId: nextId++, unitId: unit.id, modelIndex: m });
      }
    }
  }

  return { mode, entries };
}

// Render marker grid into #marker-sheet
function renderSheet(army, mapping, sizeMm, showLabels) {
  const sheet = document.getElementById('marker-sheet');
  if (!sheet) return;

  const unitMap = Object.fromEntries(army.units.map((u) => [u.id, u]));

  sheet.innerHTML = '';
  sheet.style.setProperty('--marker-size', `${sizeMm}mm`);

  for (const entry of mapping.entries) {
    const unit = unitMap[entry.unitId];
    if (!unit) continue;

    const cell = document.createElement('div');
    cell.className = 'marker-cell';

    cell.innerHTML = generateMarkerSVG(entry.markerId, sizeMm);

    if (showLabels) {
      const label = document.createElement('div');
      label.className = 'marker-label';
      const name = unit.name.length > 14 ? unit.name.slice(0, 13) + '\u2026' : unit.name;
      label.textContent = mapping.mode === 'per-model'
        ? `${name} #${entry.modelIndex}`
        : name;
      cell.appendChild(label);
    }

    sheet.appendChild(cell);
  }

  // Update counter
  const counter = document.getElementById('marker-count');
  if (counter) counter.textContent = `${mapping.entries.length} Marker`;
}

// Main
async function init() {
  const armyId = getParam('armyId');
  const errEl  = document.getElementById('error-msg');
  const nameEl = document.getElementById('army-name');

  if (!armyId) {
    if (errEl) { errEl.textContent = 'Keine Listen-ID in der URL. Bitte zurueck zur App.'; errEl.hidden = false; }
    return;
  }

  const army = await getArmy(armyId);

  if (!army) {
    if (errEl) { errEl.textContent = 'Liste nicht gefunden. Bitte zurueck zur App.'; errEl.hidden = false; }
    return;
  }

  if (nameEl) nameEl.textContent = army.name;

  const sizeCtrl   = document.getElementById('ctrl-size');
  const modeCtrl   = document.getElementById('ctrl-mode');
  const labelsCtrl = document.getElementById('ctrl-labels');

  async function update() {
    const mode      = modeCtrl.value;
    const sizeMm    = SIZE_MM[sizeCtrl.value] || 8;
    const showLabels = labelsCtrl.checked;

    const mapping = buildMapping(army, mode);
    army.markerMapping = mapping;

    try { await saveArmy(army); } catch (e) { console.warn('[Reticle] mapping save failed:', e); }

    renderSheet(army, mapping, sizeMm, showLabels);
  }

  sizeCtrl.addEventListener('change', update);
  modeCtrl.addEventListener('change', update);
  labelsCtrl.addEventListener('change', update);

  await update();
}

init().catch((err) => console.error('[Reticle] print init failed:', err));
