// Reticle — edit.js
// P4: Live-Edit-Screen. Einheit antippen → Modellanzahl anpassen → sofort speichern.
//
// Callbacks:
//   onBack(army)      — Zurück zum Dashboard (army-Referenz mutiert)
//   onNextScan()      — Direkt zum nächsten Scan
//   onSave(army)      — Persistenz-Hook (app.js ruft saveArmy)

import { unitStatus, calcUnitPoints } from './dashboard.js';

// ─── State ─────────────────────────────────────────────────────────────────
let _army      = null;
let _unit      = null;
let _unitIndex = null;
let _onBack    = null;
let _onNextScan = null;
let _onSave    = null;

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Einmalige Verdrahtung der statischen Listener.
 * @param {{ onBack, onNextScan, onSave }} opts
 */
export function initEditScreen({ onBack, onNextScan, onSave } = {}) {
  _onBack     = onBack     || null;
  _onNextScan = onNextScan || null;
  _onSave     = onSave     || null;

  document.getElementById('edit-back')?.addEventListener('click', _handleBack);
  document.getElementById('edit-minus')?.addEventListener('click', () => _changeCount(-1));
  document.getElementById('edit-plus')?.addEventListener('click',  () => _changeCount(+1));
  document.getElementById('edit-next-scan')?.addEventListener('click', _handleNextScan);
}

/**
 * Edit-Screen für eine bestimmte Einheit öffnen.
 * @param {object} unit       - Referenz aus army.units (wird direkt mutiert)
 * @param {object} army       - Volle Armee (für Kontext und Speichern)
 * @param {number} unitIndex  - Position in army.units (für Counter X/Y)
 */
export function openUnit(unit, army, unitIndex) {
  _army      = army;
  _unit      = unit;
  _unitIndex = unitIndex;
  _render();
}

// ─── Internal ──────────────────────────────────────────────────────────────

function _render() {
  if (!_unit || !_army) return;

  const maxCount = _unit.maxCount || _unit.count || 1;
  const count    = _unit.count;
  const status   = unitStatus(_unit);
  const curPts   = calcUnitPoints(_unit);
  const origPts  = _unit.points || 0;
  const ptsDelta = curPts - origPts;

  // ── Header ──
  const titleEl   = document.getElementById('edit-title');
  const counterEl = document.getElementById('edit-counter');
  if (titleEl)   titleEl.textContent   = 'EINHEIT';
  if (counterEl) counterEl.textContent = `${String(_unitIndex + 1).padStart(2, '0')} / ${String(_army.units.length).padStart(2, '0')}`;

  // ── Name & Sub ──
  _setText('edit-unit-name', _unit.name);
  _setText('edit-unit-sub', _army.name);

  // ── Status-Klasse auf Karte ──
  const nameCard = document.getElementById('edit-name-card');
  if (nameCard) {
    nameCard.classList.remove('edit-name-card--full', 'edit-name-card--reduced', 'edit-name-card--fallen');
    nameCard.classList.add(`edit-name-card--${status}`);
  }

  // ── Modell-Count ──
  _setText('edit-count-val', String(count));
  _setText('edit-count-max', `\u00a0/\u00a0${maxCount}`);

  // Minus-Button deaktivieren wenn 0, kein oberes Limit
  const minusBtn = document.getElementById('edit-minus');
  if (minusBtn) minusBtn.disabled = count <= 0;

  // "war N" Hinweis
  const wasEl = document.getElementById('edit-count-was');
  if (wasEl) {
    if (count !== maxCount && count > 0) {
      wasEl.textContent = `\u2193 war ${maxCount}`;
      wasEl.hidden = false;
    } else if (count === 0) {
      wasEl.textContent = `Gefallen — war ${maxCount}`;
      wasEl.hidden = false;
    } else {
      wasEl.hidden = true;
    }
  }

  // ── Punkte ──
  _setText('edit-pts-val', String(curPts));

  const ptsWasEl   = document.getElementById('edit-pts-was');
  const ptsDeltaEl = document.getElementById('edit-pts-delta');

  if (curPts !== origPts) {
    if (ptsWasEl)   { ptsWasEl.textContent   = `war\u00a0${origPts}`; ptsWasEl.hidden   = false; }
    if (ptsDeltaEl) { ptsDeltaEl.textContent = ptsDelta < 0 ? `\u2212${Math.abs(ptsDelta)}` : `+${ptsDelta}`; ptsDeltaEl.hidden = false; }
  } else {
    if (ptsWasEl)   ptsWasEl.hidden   = true;
    if (ptsDeltaEl) ptsDeltaEl.hidden = true;
  }
}

function _changeCount(delta) {
  if (!_unit) return;

  const maxCount = _unit.maxCount || _unit.count || 1;
  const newCount = Math.max(0, _unit.count + delta);

  _unit.count = newCount;

  // Status-Feld synchronisieren
  if (newCount === 0)              _unit.status = 'fallen';
  else if (newCount >= maxCount)   _unit.status = 'active';
  else                             _unit.status = 'reduced';

  // totalPoints neu berechnen
  if (_army) {
    _army.totalPoints = _army.units.reduce((s, u) => s + (u.points || 0), 0);
  }

  // Sofort speichern (fire & forget)
  if (_onSave && _army) _onSave(_army);

  _render();
}

function _handleBack() {
  if (_onBack && _army) _onBack(_army);
}

function _handleNextScan() {
  if (_onNextScan) _onNextScan();
}

function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
