/* Toast messages and the red screen flash on impact. */

let toastTimer = null;
export function toast(msg, bad) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

export function flashScreen() {
  const f = document.getElementById('flash');
  f.classList.add('on');
  requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
}
