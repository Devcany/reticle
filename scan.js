// Reticle — scan.js
// P3a: Kamera-Zugriff, Live-Preview, Foto-Capture.
// Kein ArUco, keine Logik — nur Bild rein, Bild raus.

let _stream     = null;
let _videoEl    = null;
let _canvasEl   = null;
let _onCapture  = null;
let _onBack     = null;

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Muss einmalig aufgerufen werden (nach DOM-Ready).
 * @param {object} opts
 * @param {function} opts.onCapture  - Callback(imageData, canvas) bei Auslöser-Tap
 * @param {function} opts.onBack     - Callback wenn Zurück gedrückt wird
 */
export function initScanScreen({ onCapture, onBack } = {}) {
  _onCapture = onCapture || null;
  _onBack    = onBack    || null;

  _videoEl  = document.getElementById('scan-video');
  _canvasEl = document.getElementById('scan-canvas');

  const shutterBtn = document.getElementById('scan-shutter');
  const backBtn    = document.getElementById('scan-back');
  const retryBtn   = document.getElementById('scan-retry');

  shutterBtn?.addEventListener('click', handleCapture);
  backBtn?.addEventListener('click', handleBack);
  retryBtn?.addEventListener('click', () => {
    _setPermissionError(false);
    _startCamera();
  });

  return {
    /**
     * Vollständiger Start (army bereits vorhanden): Label + Kamera.
     * Nur nutzen wenn army synchron verfügbar ist — kein await davor!
     */
    start: startScan,

    /**
     * iOS-sicherer Start: Kamera sofort starten (kein await davor),
     * Army-Label erst danach per setArmy() setzen.
     * Pflicht auf iOS Safari: getUserMedia muss im User-Gesture-Stack bleiben.
     */
    startCamera: startCameraOnly,

    /** Army-Label nachträglich setzen, nachdem async-Daten geladen wurden. */
    setArmy: (army) => _setUnitLabel(army, 0),

    stop: stopCamera,
  };
}

/**
 * Vollständiger Start: Label setzen + Kamera.
 * @param {object|null} army
 */
export function startScan(army) {
  _setUnitLabel(army, 0);
  _setPermissionError(false);
  _startCamera();
}

/**
 * iOS-sicherer Kamerastart: getUserMedia sofort, kein await davor.
 * Army-Label separat per setArmy() nachziehen.
 */
export function startCameraOnly() {
  _setUnitLabel(null, 0);   // Reset Label auf — / —
  _setPermissionError(false);
  _startCamera();            // getUserMedia wird hier initiiert — noch im Gesture-Context
}

/**
 * Stream stoppen (immer beim Verlassen des Screens aufrufen).
 */
export function stopCamera() {
  if (_stream) {
    _stream.getTracks().forEach((t) => t.stop());
    _stream = null;
  }
  if (_videoEl) _videoEl.srcObject = null;
  _setStatusLive(false);
}

// ─── Internal ──────────────────────────────────────────────────────────────

async function _startCamera() {
  try {
    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },   // Rückkamera Pflicht, Front als Fallback
        width:  { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    };

    _stream = await navigator.mediaDevices.getUserMedia(constraints);

    if (_videoEl) {
      _videoEl.srcObject = _stream;
      // play() kann auf iOS rejected werden wenn nicht muted + playsinline
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
      NotFoundError:         'Keine Kamera gefunden. Geraet unterstuetzt moeglicherweis keine Kamera.',
      NotReadableError:      'Kamera wird gerade von einer anderen App verwendet.',
      OverconstrainedError:  'Kamera-Parameter nicht unterstuetzt. Versuche es erneut.',
    };
    const msg = msgs[err.name] || `Kamera nicht verfuegbar (${err.name}).`;
    _setPermissionError(true, msg);
  }
}

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

  // Visuelles Feedback
  _triggerFlash();
  _triggerShutterPulse();

  // Debug-Log (Vorbereitung P3b)
  console.log('[Reticle P3a] Captured ImageData:', imageData);

  if (_onCapture) _onCapture(imageData, _canvasEl);
}

function handleBack() {
  stopCamera();
  if (_onBack) _onBack();
}

// ─── UI helpers ────────────────────────────────────────────────────────────

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

  if (errEl)     errEl.hidden          = !show;
  if (shutterEl) shutterEl.hidden      = show;
  if (msgEl && message) msgEl.textContent = message;

  // Video ausblenden damit kein schwarzes Rechteck bleibt
  if (_videoEl) _videoEl.style.visibility = show ? 'hidden' : 'visible';
}

function _setUnitLabel(army, scannedCount) {
  const label = document.getElementById('scan-unit-label');
  if (!label) return;
  if (!army || !army.units || army.units.length === 0) {
    label.textContent = '\u2014 / \u2014';   // — / —
    return;
  }
  label.textContent = `${scannedCount} / ${army.units.length}`;
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
