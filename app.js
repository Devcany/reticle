// Reticle — app.js
// Paeckchen 0: Service-Worker-Registrierung

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => console.log('[Reticle] SW registered:', reg.scope))
      .catch((err) => console.error('[Reticle] SW registration failed:', err));
  });
}
