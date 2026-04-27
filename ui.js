// Reticle — ui.js
// Shared UI utilities: screen router, toast, helpers.

let _current = null;
const _stack = [];

export function showScreen(id) {
  if (_current === id) return;
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('screen--active'));
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('screen--active');
    _current = id;
    window.scrollTo(0, 0);
  }
}

export function navigate(id) {
  if (_current) _stack.push(_current);
  showScreen(id);
}

export function goBack(fallback) {
  const prev = _stack.pop();
  showScreen(prev || fallback || 'screen-setup');
}

export function currentScreen() {
  return _current;
}

let _toastTimer = null;

export function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast toast--${type} toast--visible`;
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.remove('toast--visible');
  }, 3500);
}
