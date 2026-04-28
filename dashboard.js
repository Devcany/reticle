// Reticle — dashboard.js
// P4: KPI-Berechnung (pure), Status-Logik, Dashboard-Rendering.
//
// Reine Funktionen: computeKPIs / unitStatus
// DOM-Rendering:    renderDashboard

// ─── Pure KPI-Funktionen ──────────────────────────────────────────────────

/**
 * Berechnet alle Dashboard-KPIs für eine Armee.
 * V1-Vereinfachung: count > 0 → voller Punktwert; count == 0 → 0.
 *
 * @param {object} army
 * @returns {{
 *   activePoints: number,
 *   lostPoints:   number,
 *   totalModels:  number,
 *   lostModels:   number,
 *   totalUnits:   number,
 *   fallenUnits:  number,
 *   activePercent: number,
 *   lostPercent:   number,
 * }}
 */
export function computeKPIs(army) {
  const units = army?.units ?? [];

  let activePoints = 0;
  let lostPoints   = 0;
  let totalModels  = 0;
  let lostModels   = 0;
  let fallenUnits  = 0;

  for (const u of units) {
    const maxCount = u.maxCount || u.count || 1;
    const pts      = u.points  || 0;

    if (u.count === 0) {
      lostPoints += pts;
      fallenUnits++;
    } else {
      activePoints += pts;                    // V1: volle Punkte wenn count > 0
      totalModels  += u.count;
      lostModels   += Math.max(0, maxCount - u.count);
    }
  }

  const totalPts     = activePoints + lostPoints;
  const activePercent = totalPts > 0 ? (activePoints / totalPts) * 100 : 100;
  const lostPercent   = totalPts > 0 ? (lostPoints  / totalPts) * 100 : 0;

  return {
    activePoints,
    lostPoints,
    totalModels,
    lostModels,
    totalUnits:  units.length,
    fallenUnits,
    activePercent,
    lostPercent,
  };
}

/**
 * Visueller Status einer Einheit basierend auf count vs maxCount.
 * @param {object} unit
 * @returns {'full' | 'reduced' | 'fallen'}
 */
export function unitStatus(unit) {
  const max = unit.maxCount || unit.count || 1;
  if (unit.count === 0)     return 'fallen';
  if (unit.count >= max)    return 'full';
  return 'reduced';
}

/**
 * Aktuelle Punkte einer Einheit (proportional, für Edit-Screen).
 * @param {object} unit
 * @returns {number}
 */
export function calcUnitPoints(unit) {
  const max = unit.maxCount || unit.count || 1;
  if (unit.count === 0) return 0;
  if (unit.count >= max) return unit.points || 0;
  return Math.round((unit.points || 0) * unit.count / max);
}

// ─── Dashboard-Rendering ──────────────────────────────────────────────────

/**
 * Rendert den vollständigen Dashboard-State für eine Armee.
 *
 * @param {object}   army
 * @param {object}   opts
 * @param {function} opts.onUnitTap  - (unit, index) → void
 */
export function renderDashboard(army, { onUnitTap } = {}) {
  if (!army) return;

  const kpis = computeKPIs(army);

  // ── Header-Titel ──
  const titleEl = document.getElementById('home-title');
  if (titleEl) titleEl.textContent = army.name.toUpperCase();

  // ── Hero-Punkte ──
  _setText('db-active-pts', String(kpis.activePoints));
  _setText('db-lost-pts',   kpis.lostPoints > 0 ? `\u2212${kpis.lostPoints}` : '\u2014');

  // ── Statusbalken ──
  const barActive = document.getElementById('db-bar-active');
  const barLost   = document.getElementById('db-bar-lost');
  if (barActive) barActive.style.flex = String(kpis.activePercent);
  if (barLost)   barLost.style.flex   = String(kpis.lostPercent);

  // ── KPI-Boxen ──
  _setText('db-kpi-units',  String(kpis.totalUnits));
  _setText('db-kpi-models', String(kpis.totalModels));
  const deltaEl = document.getElementById('db-kpi-models-delta');
  if (deltaEl) {
    deltaEl.textContent = kpis.lostModels > 0 ? `\u2212${kpis.lostModels}` : '';
    deltaEl.hidden      = kpis.lostModels === 0;
  }
  _setText('db-kpi-loss', kpis.lostPoints > 0 ? `\u2212${kpis.lostPoints}` : '\u2014');

  // ── Einheitenliste ──
  const listEl = document.getElementById('db-unit-list');
  if (listEl) {
    listEl.innerHTML = '';
    army.units.forEach((unit, idx) => {
      const status   = unitStatus(unit);
      const maxCount = unit.maxCount || unit.count || 1;

      const li = document.createElement('li');
      li.className = `unit-card unit-card--${status}`;

      const isFallen = status === 'fallen';
      li.innerHTML = `
        <div class="unit-card-inner">
          <span class="unit-card-name${isFallen ? ' unit-card-name--fallen' : ''}">${unit.name}</span>
          <span class="unit-card-count">${unit.count}&nbsp;/&nbsp;${maxCount}</span>
          <span class="unit-card-pts">${isFallen ? '\u2014' : unit.points + '\u00a0Pkt.'}</span>
        </div>
      `;

      if (onUnitTap) {
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => onUnitTap(unit, idx));
      }

      listEl.appendChild(li);
    });
  }

  // ── Print-Link ──
  const printWrap = document.getElementById('db-print-wrap');
  if (printWrap) {
    printWrap.innerHTML = `
      <a href="print.html?armyId=${army.id}" class="btn btn--outline btn--block btn--print">
        &#9634; Marker drucken
      </a>
    `;
  }
}

function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
