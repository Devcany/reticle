// Reticle — detector.js
// P3b: ArUco-Marker-Erkennung und Einheiten-Mapping.
//
// Abhängigkeiten: vendor/cv.js + vendor/aruco.js müssen als <script>-Tags
// in index.html VOR dem ES-Modul geladen sein. Sie setzen globale AR und CV.
//
// API:
//   detectMarkers(imageData)          → rawMarker[]    (sortiert nach Größe ↓)
//   markersToUnits(markers, army)     → DetectionResult

/* global AR */

// ─── Detektor-Instanz (lazy, einmalig) ────────────────────────────────────

let _detector = null;

function _getDetector() {
  if (!_detector) {
    if (typeof AR === 'undefined' || typeof AR.Detector !== 'function') {
      throw new Error(
        '[Detector] AR.Detector nicht verfügbar. ' +
        'vendor/cv.js und vendor/aruco.js müssen vor dem Modul geladen sein.'
      );
    }
    _detector = new AR.Detector();
  }
  return _detector;
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────

/**
 * Mittlere Diagonale eines Markers aus seinen 4 Eckpunkten.
 * Mittelung beider Diagonalen macht die Größenschätzung rotationsunabhängig.
 *
 * @param {{x:number, y:number}[]} corners  - 4 Eckpunkte vom Detektor
 * @returns {number} Pixel-Diagonale
 */
function _diagonal(corners) {
  if (!corners || corners.length < 4) return 0;
  // Diagonale 1: Ecke 0 ↔ Ecke 2
  const dx1 = corners[2].x - corners[0].x;
  const dy1 = corners[2].y - corners[0].y;
  // Diagonale 2: Ecke 1 ↔ Ecke 3
  const dx2 = corners[3].x - corners[1].x;
  const dy2 = corners[3].y - corners[1].y;
  return (Math.sqrt(dx1 * dx1 + dy1 * dy1) + Math.sqrt(dx2 * dx2 + dy2 * dy2)) * 0.5;
}

// ─── Öffentliche API ──────────────────────────────────────────────────────

/**
 * Erkenne ArUco-Marker in einem RGBA-ImageData-Frame.
 *
 * @param {ImageData} imageData  - canvas.getContext('2d').getImageData(...)
 * @returns {{ id: number, corners: {x:number,y:number}[], diagonal: number }[]}
 *   Sortiert nach Pixelgröße absteigend (größter = nächster zur Kamera).
 *   Leeres Array wenn nichts erkannt oder Fehler.
 */
export function detectMarkers(imageData) {
  let raw;
  try {
    raw = _getDetector().detect(imageData);
  } catch (err) {
    console.error('[Reticle:Detector] Fehler im Detektor:', err);
    return [];
  }

  const markers = raw.map((m) => ({
    id:       m.id,
    corners:  m.corners,
    diagonal: _diagonal(m.corners),
  }));

  // Größte Marker zuerst
  markers.sort((a, b) => b.diagonal - a.diagonal);

  console.log(
    `[Reticle:Detector] detectMarkers → ${markers.length} Marker erkannt:`,
    markers.length
      ? markers.map((m) => `ID ${m.id} (⌀ ${m.diagonal.toFixed(1)} px)`).join(', ')
      : 'keine'
  );

  return markers;
}

/**
 * Mappe erkannte Marker auf Einheiten der aktiven Armeeliste.
 *
 * Sortierung bleibt erhalten (Größe ↓ aus detectMarkers).
 * Marker die nicht in der Liste sind werden gefiltert und geloggt.
 * Mehrfach-Treffer möglich — Auswahl-UX kommt in P3c.
 *
 * @param {{ id: number, corners: {x:number,y:number}[], diagonal: number }[]} markers
 *   Ausgabe von detectMarkers()
 * @param {object|null} army
 *   Armeelistenobjekt aus IndexedDB (muss army.markerMapping.entries haben)
 *
 * @returns {{
 *   status:  'found' | 'none',
 *   matches: { unitId: string, modelIndex: number|null, markerId: number, diagonal: number }[]
 * }}
 */
export function markersToUnits(markers, army) {
  // ── Fall 1: kein Foto / Detektor hat nichts gefunden ──
  if (!markers || markers.length === 0) {
    console.log('[Reticle:Detector] markersToUnits → status: none (Frame ohne Marker)');
    return { status: 'none', matches: [] };
  }

  // ── Fall 2: Liste ohne Mapping (Marker noch nicht gedruckt) ──
  const mapping = army?.markerMapping;
  if (!mapping?.entries?.length) {
    console.warn(
      '[Reticle:Detector] markersToUnits → kein markerMapping in der Liste. ' +
      'Erkannte IDs (ungefiltert):', markers.map((m) => m.id)
    );
    return { status: 'none', matches: [] };
  }

  // Lookup: markerId → mapping-Entry  (O(1) pro Abfrage)
  const lookup = new Map(mapping.entries.map((e) => [e.markerId, e]));

  const matches  = [];
  const unknown  = [];

  for (const marker of markers) {
    const entry = lookup.get(marker.id);
    if (entry) {
      matches.push({
        unitId:     entry.unitId,
        modelIndex: entry.modelIndex ?? null,
        markerId:   marker.id,
        diagonal:   marker.diagonal,
      });
    } else {
      unknown.push(marker.id);
    }
  }

  // ── Console-Ausgabe für DevTools-Test (P3b Akzeptanzkriterium 5) ──
  console.log(
    '[Reticle:Detector] Erkannte IDs:',
    markers.map((m) => m.id)
  );
  if (unknown.length) {
    console.log('[Reticle:Detector] Nicht in Liste (gefiltert):', unknown);
  }
  console.log(
    '[Reticle:Detector] markersToUnits → status:',
    matches.length ? 'found' : 'none',
    '| Matches:', matches
  );

  if (matches.length === 0) {
    return { status: 'none', matches: [] };
  }

  return { status: 'found', matches };
}
