// Reticle — setup.js
// Setup screen: three-option entry point.

import { navigate, showToast } from './ui.js';

export function initSetupScreen(hasArmies, onManualSelected) {
  const backBtn = document.getElementById('setup-back');
  const optImport = document.getElementById('setup-opt-import');
  const optManual = document.getElementById('setup-opt-manual');
  const optScan = document.getElementById('setup-opt-scan');

  if (backBtn) {
    backBtn.style.visibility = hasArmies ? 'visible' : 'hidden';
    backBtn.addEventListener('click', () => {
      import('./ui.js').then(({ goBack }) => goBack('screen-list-select'));
    });
  }

  if (optImport) {
    optImport.addEventListener('click', () => navigate('screen-import'));
  }

  if (optManual) {
    optManual.addEventListener('click', () => {
      if (onManualSelected) onManualSelected();
      navigate('screen-manual');
    });
  }

  if (optScan) {
    optScan.addEventListener('click', () => {
      showToast('Verfuegbar ab Paeckchen 3', 'info');
    });
  }
}
