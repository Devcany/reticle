// Reticle — scan.js
// P3a: Kamera-Zugriff, Live-Preview, Foto-Capture.
// P3c: Scan-UX State Machine, Vorschlag-Karte, Bestätigen-Aktion.
//
// State Machine:
//   idle       — Kamera läuft, keine Karte sichtbar
//   proposing  — Einzelner klarer Treffer, Vorschlag-Karte
//   ambiguous  — Mehrere Treffer, Top-3-Auswahl-Karte (orange Ecken)
//   none       — Kein Marker erkannt
//   duplicate  — Marker schon erkannt, Hinweis-Karte
//   manual     — Manueller Picker (Liste offener Einheiten)

// ─── Kamera-State ──────────────────────────────────────────────────────────
let _stream     = null;
let _videoEl    = null;
let _canvasEl   = null;

// ─── Callbacks ─────────────────────────────────────────────────────────────
let _onCapture  = null;   // (imageData) → void  [app.js runs detection]
let _onBack     = null;   // () → void
let _onConfirm  = null;   // async ({ unitId, modelIndex, markerId, newCount }) → void

// ─── UX State ──────────────────────────────────────────────────────────────
let _state        = 'idle';
let _currentArmy  = null;   // aktive Armee (Referenz, wird von app.js mutiert)
let _pendingMatch = null;   // Match-Objekt das gerade bearbeitet wird
let _pendingUnit  = null;   // Unit-Objekt dazu

// ─── Public API ────────────────────────────────────────────────────────────

export function initScanScreen({ onCapture, onBack, onConfirm } = {}) {
  _onCapture = onCapture || null;
  _onBack    = onBack    || null;
  _onConfirm = onConfirm || null;

  _videoEl  = document.getElementById('scan-video');
  _canvasEl = document.getElementById('scan-canvas');

  _wireStaticListeners();

  return {
    /** Vollständiger Start (army bereits synchron verfügbar) */
    start: startScan,

    /**
     * iOS-sicherer Start: getUserMedia sofort, kein await davor.
     * Army-Label danach per setArmy() setzen.
     */
    startCamera: startCameraOnly,

    /** Army-Label und internen Kontext setzen (nach async-Load). */
    setArmy: (army) => {
      _currentArmy = army;
      _setUnitLabel(army, _countScanned(army));
    },

    /**
     * Detektor-Ergebnis entgegennehmen und passende Karte anzeigen.
     * Wird vom onCapture-Handler in app.js aufgerufen.
     * @param {{ status: 'found'|'none', matches: object[] }} result
     */
    showResult,

    stop: stopCamera,
  };
}

export function startScan(army) {
  _currentArmy = army;
  _setUnitLabel(army, _countScanned(army));
  _setPermissionError(false);
  _enterState('idle');
  _startCamera();
}

export function startCameraOnly() {
  _setUnitLabel(_currentArmy, _countScanned(_currentArmy));
  _setPermissionError(false);
  _enterState('idle');
  _startCamera();
}

export function stopCamera() {
  if (_stream) {
    _stream.getTracks().forEach((t) => t.stop());
    _stream = null;
  }
  if (_videoEl) _videoEl.srcObject = null;
  _setStatusLive(false);
}

export function showResult(result) {
  const army = _currentArmy;

  // Kein Treffer oder kein Marker
  if (!result || result.status === 'none' || !result.matches?.length) {
    _enterState('none');
    return;
  }

  if (result.matches.length === 1) {
    const match = result.matches[0];
    const unit  = army?.units?.find((u) => u.id === match.unitId);
    if (!unit) { _enterState('none'); return; }

    _pendingMatch = match;
    _pendingUnit  = unit;

    if (unit.scannedAt) {
      _populateDuplicate(unit);
      _enterState('duplicate');
    } else {
      _populateFound(unit);
      _enterState('proposing');
    }
    return;
  }

  // Mehrere Treffer — frische (nicht-gescannte) filtern
  const freshMatches = result.matches.filter((m) => {
    const u = army?.units?.find((u2) => u2.id === m.unitId);
    return !u?.scannedAt;
  });

  if (!freshMatches.length) {
    // Alle schon gescannt → Duplicate des größten
    const match = result.matches[0];
    const unit  = army?.units?.find((u) => u.id === match.unitId);
    _pendingMatch = match;
    _pendingUnit  = unit;
    _populateDuplicate(unit);
    _enterState('duplicate');
    return;
  }

  _populateAmbiguous(freshMatches.slice(0, 3));
  _enterState('ambiguous');
}

// ─── State Machine ─────────────────────────────────────────────────────────

function _enterState(state) {
  _state = state;

  const proposal = document.getElementById('scan-proposal');
  const shutter  = document.getElementById('scan-shutter');
  const picker   = document.getElementById('scan-picker');

  // Reset alles
  _hideAllBlocks();
  if (proposal) proposal.hidden = true;
  if (picker)   picker.hidden   = true;
  if (shutter)  shutter.hidden  = false;
  _setCorners('normal');
  _clearProposalMod();

  switch (state) {
    case 'idle':
      break;

    case 'proposing':
      if (proposal) proposal.hidden = false;
      if (shutter)  shutter.hidden  = true;
      _showBlock('sp-found');
      _setProposalMod('found');
      break;

    case 'ambiguous':
      if (proposal) proposal.hidden = false;
      if (shutter)  shutter.hidden  = true;
      _showBlock('sp-ambiguous');
      _setProposalMod('ambiguous');
      _setCorners('ambiguous');
      break;

    case 'none':
      if (proposal) proposal.hidden = false;
      if (shutter)  shutter.hidden  = true;
      _showBlock('sp-none');
      break;

    case 'duplicate':
      if (proposal) proposal.hidden = false;
      if (shutter)  shutter.hidden  = true;
      _showBlock('sp-duplicate');
      _setProposalMod('found');  // gleicher Border-Ton
      break;

    case 'manual':
      if (picker)  picker.hidden  = true;   // Hide first to reset
      _renderPicker();
      if (picker)  picker.hidden  = false;
      if (shutter) shutter.hidden = true;
      break;
  }
}

function _hideAllBlocks() {
  ['sp-found', 'sp-ambiguous', 'sp-none', 'sp-duplicate'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
}

function _showBlock(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = false;
}

function _setProposalMod(mod) {
  const el = document.getElementById('scan-proposal');
  if (!el) return;
  el.dataset.mod = mod;
}

function _clearProposalMod() {
  const el = document.getElementById('scan-proposal');
  if (!el) return;
  delete el.dataset.mod;
}

// ─── Corner Colors ─────────────────────────────────────────────────────────

function _setCorners(style) {
  const screen = document.getElementById('screen-scan');
  if (!screen) return;
  screen.classList.remove('scan-corners--ambiguous', 'scan-corners--confirmed');
  if (style === 'ambiguous') screen.classList.add('scan-corners--ambiguous');
  if (style === 'confirmed') screen.classList.add('scan-corners--confirmed');
}

function _pulseConfirmed() {
  _setCorners('confirmed');
  setTimeout(() => _setCorners('normal'), 700);
}

// ─── Card Content ──────────────────────────────────────────────────────────

function _populateFound(unit) {
  const nameEl  = document.getElementById('sp-name');
  const subEl   = document.getElementById('sp-sub');
  const countEl = document.getElementById('sp-count');

  if (nameEl)  nameEl.textContent  = unit.name;
  if (subEl)   subEl.textContent   = `${unit.count} Modelle · ${unit.points} Pkt.`;
  if (countEl) { countEl.value = unit.count; countEl.min = 1; countEl.max = 999; }
}

function _populateAmbiguous(matches) {
  const list     = document.getElementById('sp-ambig-list');
  const countEl  = document.getElementById('sp-ambig-count');
  const army     = _currentArmy;

  if (countEl) countEl.textContent = `${matches.length} Treffer`;
  if (!list)   return;

  list.innerHTML = '';
  matches.forEach((match) => {
    const unit = army?.units?.find((u) => u.id === match.unitId);
    if (!unit) return;

    const btn = document.createElement('button');
    btn.className = 'sp-ambig-item';
    btn.innerHTML = `
      <span class="sp-ambig-name">${unit.name}</span>
      <span class="sp-ambig-meta">\u00d7${unit.count}&nbsp;&middot;&nbsp;${unit.points}&nbsp;Pkt.</span>
    `;
    btn.addEventListener('click', () => {
      _pendingMatch = match;
      _pendingUnit  = unit;
      _populateFound(unit);
      _enterState('proposing');
    });
    list.appendChild(btn);
  });
}

function _populateDuplicate(unit) {
  const textEl = document.getElementById('sp-dup-text');
  if (!textEl) return;
  const ts = unit?.scannedAt
    ? new Date(unit.scannedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;
  textEl.textContent = ts
    ? `Bereits erkannt: ${unit.name} (${ts})`
    : `Bereits erkannt: ${unit.name}`;
}

// ─── Manual Picker ─────────────────────────────────────────────────────────

function _renderPicker() {
  const list = document.getElementById('scan-picker-list');
  if (!list) return;
  list.innerHTML = '';

  const army = _currentArmy;
  if (!army?.units?.length) {
    list.innerHTML = '<p class="scan-picker-empty">Keine Einheiten in der Liste.</p>';
    return;
  }

  const openUnits = army.units.filter((u) => !u.scannedAt);
  if (!openUnits.length) {
    list.innerHTML = '<p class="scan-picker-empty">Alle Einheiten bereits erkannt. &#10003;</p>';
    return;
  }

  openUnits.forEach((unit) => {
    const btn = document.createElement('button');
    btn.className = 'scan-picker-item';
    btn.innerHTML = `
      <span class="scan-picker-item-name">${unit.name}</span>
      <span class="scan-picker-item-meta">\u00d7${unit.count}&nbsp;&middot;&nbsp;${unit.points}&nbsp;Pkt.</span>
    `;
    btn.addEventListener('click', () => {
      _pendingMatch = { unitId: unit.id, modelIndex: null, markerId: null, diagonal: 0 };
      _pendingUnit  = unit;
      _populateFound(unit);
      _enterState('proposing');
    });
    list.appendChild(btn);
  });
}

// ─── Confirm Action ────────────────────────────────────────────────────────

async function _handleConfirm() {
  const match = _pendingMatch;
  const unit  = _pendingUnit;
  if (!match || !unit) return;

  const countEl  = document.getElementById('sp-count');
  const newCount = Math.max(1, parseInt(countEl?.value, 10) || 1);

  // UI sofort schließen
  _pendingMatch = null;
  _pendingUnit  = null;
  _enterState('idle');

  // Persistenz in app.js
  if (_onConfirm) {
    await _onConfirm({
      unitId:     unit.id,
      modelIndex: match.modelIndex ?? null,
      markerId:   match.markerId   ?? null,
      newCount,
    });
  }

  // Visuelles Feedback + Counter — _currentArmy wurde von app.js mutiert
  _pulseConfirmed();
  _setUnitLabel(_currentArmy, _countScanned(_currentArmy));
}

// ─── Static Event Listeners (einmalig verdrahtet) ──────────────────────────

function _wireStaticListeners() {
  // Kamera-Auslöser
  document.getElementById('scan-shutter')?.addEventListener('click', handleCapture);

  // Zurück-Pfeil
  document.getElementById('scan-back')?.addEventListener('click', handleBack);

  // Permission-Retry
  document.getElementById('scan-retry')?.addEventListener('click', () => {
    _setPermissionError(false);
    _startCamera();
  });

  // ── Proposal: Counter ──
  document.getElementById('sp-minus')?.addEventListener('click', () => {
    const el = document.getElementById('sp-count');
    if (el) el.value = Math.max(1, (parseInt(el.value, 10) || 1) - 1);
  });
  document.getElementById('sp-plus')?.addEventListener('click', () => {
    const el = document.getElementById('sp-count');
    if (el) el.value = Math.min(999, (parseInt(el.value, 10) || 1) + 1);
  });

  // ── Proposal: Bestätigen ──
  document.getElementById('sp-confirm')?.addEventListener('click', _handleConfirm);

  // ── Proposal: Verwerfen / Näher ran / OK ──
  // Alle Buttons mit Klasse sp-dismiss gehen zurück zu idle
  document.getElementById('scan-proposal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('sp-dismiss')) {
      _pendingMatch = null;
      _pendingUnit  = null;
      _enterState('idle');
    }
  });

  // ── Proposal: Manuell ──
  document.getElementById('scan-proposal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('sp-open-manual')) {
      _enterState('manual');
    }
  });

  // ── Duplicate: Trotzdem überschreiben ──
  document.getElementById('sp-dup-override')?.addEventListener('click', () => {
    if (_pendingUnit) {
      _populateFound(_pendingUnit);
      _enterState('proposing');
    }
  });

  // ── Manual Picker: Schließen ──
  document.getElementById('scan-picker-close')?.addEventListener('click', () => {
    _enterState('idle');
  });
}

// ─── Capture ───────────────────────────────────────────────────────────────

function handleCapture() {
  if (!_stream || !_videoEl || !_canvasEl) return;

  const vw = _videoEl.videoWidth;
  const vh = _videoEl.videoHeight;
  if (!vw || !vh) return;

  _canvasEl.width  = vw;
  _canvasEl.height = vh;

  const ctx = _canvasEl.getContext('2d');
  ctx.drawImage(_videoEl, 0, 0, vw, vh);
  const imageData = ctx.getImageData(0, 0, vw, vh);

  _triggerFlash();
  _triggerShutterPulse();

  console.log('[Reticle P3a] Captured ImageData:', imageData.width, '\u00d7', imageData.height);

  if (_onCapture) _onCapture(imageData, _canvasEl);
}

function handleBack() {
  stopCamera();
  _enterState('idle');
  if (_onBack) _onBack();
}

// ─── Camera ────────────────────────────────────────────────────────────────

async function _startCamera() {
  try {
    _stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });

    if (_videoEl) {
      _videoEl.srcObject = _stream;
      await _videoEl.play().catch(() => {});
    }

    _setStatusLive(true);
    _setPermissionError(false);

  } catch (err) {
    console.warn('[Scan] Camera error:', err.name, err.message);
    _setStatusLive(false);
    const msgs = {
      NotAllowedError:       'Kamera-Zugriff verweigert. Bitte erlaube den Zugriff in den Browser-Einstellungen.',
      PermissionDeniedError: 'Kamera-Zugriff verweigert. Bitte erlaube den Zugriff in den Browser-Einstellungen.',
      NotFoundError:         'Keine Kamera gefunden.',
      NotReadableError:      'Kamera wird gerade von einer anderen App verwendet.',
      OverconstrainedError:  'Kamera-Parameter nicht unterstuetzt. Versuche es erneut.',
    };
    _setPermissionError(true, msgs[err.name] || `Kamera nicht verfuegbar (${err.name}).`);
  }
}

// ─── UI Helpers ────────────────────────────────────────────────────────────

function _setStatusLive(live) {
  const dot = document.getElementById('scan-status-dot');
  if (!dot) return;
  dot.classList.toggle('scan-status--live', live);
  dot.classList.toggle('scan-status--idle', !live);
  dot.title = live ? 'Live' : 'Idle';
}

function _setPermissionError(show, message) {
  const errEl     = document.getElementById('scan-permission-error');
  const shutterEl = document.getElementById('scan-shutter');
  const msgEl     = document.getElementById('scan-error-msg');

  if (errEl)     errEl.hidden     = !show;
  if (shutterEl && !show) shutterEl.hidden = false;  // nur freigeben, nicht forcieren
  if (msgEl && message) msgEl.textContent = message;
  if (_videoEl) _videoEl.style.visibility = show ? 'hidden' : 'visible';
}

function _setUnitLabel(army, scannedCount) {
  const label = document.getElementById('scan-unit-label');
  if (!label) return;
  if (!army?.units?.length) { label.textContent = '\u2014 / \u2014'; return; }
  label.textContent = `${scannedCount} / ${army.units.length}`;
}

function _countScanned(army) {
  return army?.units?.filter((u) => u.scannedAt)?.length ?? 0;
}

function _triggerFlash() {
  const flash = document.getElementById('scan-flash');
  if (!flash) return;
  flash.classList.add('scan-flash--active');
  setTimeout(() => flash.classList.remove('scan-flash--active'), 160);
}

function _triggerShutterPulse() {
  const btn = document.getElementById('scan-shutter');
  if (!btn) return;
  btn.classList.add('scan-shutter--pulse');
  setTimeout(() => btn.classList.remove('scan-shutter--pulse'), 400);
}
