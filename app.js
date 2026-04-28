// Reticle — app.js
// Entry point. SW registration + app init + screen routing.

import { getAllArmies, getActiveArmyId, setActiveArmyId, saveArmy } from './storage.js';
import { showScreen, navigate, goBack } from './ui.js';
import { initSetupScreen } from './setup.js';
import { initImportScreen } from './import.js';
import { initManualScreen } from './manual.js';
import { initScanScreen } from './scan.js';
import { detectMarkers, markersToUnits } from './detector.js';
import { renderDashboard } from './dashboard.js';
import { initEditScreen, openUnit } from './edit.js';

// --- Service Worker ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((r) => console.log('[Reticle] SW registered:', r.scope))
      .catch((e) => console.error('[Reticle] SW failed:', e));
  });
}

// --- Dashboard (P4 ersetzt renderHome) ---
function showDashboard(army) {
  renderDashboard(army, {
    onUnitTap: (unit, idx) => {
      openUnit(unit, army, idx);
      navigate('screen-edit');
    },
  });
  navigate('screen-home');
}

// --- List select screen ---
function renderListSelect(armies) {
  const container = document.getElementById('list-select-armies');
  if (!container) return;
  container.innerHTML = '';
  armies.forEach(async (army) => {
    const btn = document.createElement('button');
    btn.className = 'army-card';
    btn.innerHTML = `
      <span class="army-card-name">${army.name}</span>
      <span class="army-card-meta">${army.units.length} Einheiten &middot; ${army.totalPoints} Pkt.</span>
    `;
    btn.addEventListener('click', async () => {
      await setActiveArmyId(army.id);
      showDashboard(army);
    });
    container.appendChild(btn);
  });
}

// --- Static listeners (wired once) ---
function wireStaticListeners(manualCtrl, scanCtrl) {
  const listSelectNew = document.getElementById('list-select-new');
  if (listSelectNew) {
    listSelectNew.addEventListener('click', () => {
      manualCtrl.reset();
      navigate('screen-setup');
    });
  }

  // Header-Zurück und Footer-Übersicht im Dashboard tun dasselbe
  async function goToOverview() {
    const armies = await getAllArmies();
    if (armies.length > 1) {
      renderListSelect(armies);
      showScreen('screen-list-select');
    } else {
      showScreen('screen-setup');
    }
  }

  document.getElementById('home-back')?.addEventListener('click', goToOverview);
  document.getElementById('home-overview-btn')?.addEventListener('click', goToOverview);

  // "SCAN starten" Button auf dem Dashboard-Footer
  const homeScanBtn = document.getElementById('home-scan-btn');
  if (homeScanBtn) {
    homeScanBtn.addEventListener('click', async () => {
      // ⚠️  iOS Safari: getUserMedia muss synchron im Gesture-Handler aufgerufen werden.
      navigate('screen-scan');
      scanCtrl.startCamera();                          // getUserMedia wird HIER gefeuert

      const activeId   = await getActiveArmyId();
      const armies     = await getAllArmies();
      const activeArmy = activeId ? armies.find((a) => a.id === activeId) : null;
      _scanArmy = activeArmy || null;
      scanCtrl.setArmy(_scanArmy);
    });
  }
}

// ─── Aktive Armee für Scan-Kontext (wird beim Scan-Start gesetzt) ──────────
// Referenz bleibt bis zum nächsten Scan-Start aktuell.
let _scanArmy = null;

// --- Init ---
async function initApp() {
  const armies   = await getAllArmies();
  const hasArmies = armies.length > 0;

  function onImportDone(army) { showDashboard(army); }
  function onManualDone(army) { showDashboard(army); }

  // Scan-Screen: Erkennung + Mapping + UX-State-Machine
  const scanCtrl = initScanScreen({
    // ── Capture: Detektor laufen lassen, Ergebnis an Scan-Screen übergeben ──
    onCapture: (imageData) => {
      const markers = detectMarkers(imageData);
      const result  = markersToUnits(markers, _scanArmy);
      scanCtrl.showResult(result);              // P3c: State Machine
    },

    // ── Confirm: Einheit persistieren ──
    onConfirm: async ({ unitId, newCount }) => {
      if (!_scanArmy) return;
      const unit = _scanArmy.units.find((u) => u.id === unitId);
      if (!unit) return;

      // maxCount beim ersten Scan setzen (Soll-Stärke)
      if (!unit.maxCount) unit.maxCount = unit.count;

      unit.status    = 'active';
      unit.scannedAt = new Date().toISOString();
      if (newCount !== unit.count) {
        unit.count = newCount;
        // maxCount überschreiben wenn Scan-Count höher ist (z.B. manuell korrigiert)
        if (newCount > (unit.maxCount || 0)) unit.maxCount = newCount;
      }

      _scanArmy.totalPoints = _scanArmy.units.reduce((s, u) => s + (u.points || 0), 0);
      try { await saveArmy(_scanArmy); }
      catch (err) { console.error('[Reticle] saveArmy failed:', err); }
    },

    onBack: async () => {
      // Stream bereits gestoppt (scan.js)
      const armies     = await getAllArmies();
      const activeId   = await getActiveArmyId();
      const activeArmy = activeId ? armies.find((a) => a.id === activeId) : null;
      if (activeArmy) {
        showDashboard(activeArmy);
      } else {
        goBack('screen-home');
      }
    },
  });

  // ── Edit-Screen (P4) ──
  initEditScreen({
    onBack: (army) => {
      showDashboard(army);
    },
    onNextScan: () => {
      // Direkt zum Scan — iOS-safe (kein await vor startCamera)
      navigate('screen-scan');
      scanCtrl.startCamera();
    },
    onSave: async (army) => {
      try { await saveArmy(army); }
      catch (err) { console.error('[Reticle] edit save failed:', err); }
    },
  });

  const manualCtrl = initManualScreen(onManualDone);
  initSetupScreen(hasArmies, () => manualCtrl.reset());
  initImportScreen(onImportDone);
  wireStaticListeners(manualCtrl, scanCtrl);

  // Determine start screen
  const activeId    = await getActiveArmyId();
  const activeArmy  = activeId ? armies.find((a) => a.id === activeId) : null;

  if (armies.length === 0) {
    showScreen('screen-setup');
  } else if (activeArmy) {
    showDashboard(activeArmy);
  } else if (armies.length === 1) {
    await setActiveArmyId(armies[0].id);
    showDashboard(armies[0]);
  } else {
    renderListSelect(armies);
    showScreen('screen-list-select');
  }
}

initApp().catch((err) => console.error('[Reticle] init failed:', err));
