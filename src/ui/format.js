/* Display formatting for the HUD and labels. */

export const tag = id => 'D-' + String(id).padStart(2, '0');
export const f1 = v => v.toFixed(1);
export const vmag = v => v ? Math.hypot(v.x, v.y, v.z) : 0;

export function fmtMass(m) { return m < 1 ? Math.round(m * 1000) + ' g' : (m < 100 ? m.toFixed(1) : Math.round(m)) + ' kg'; }
export function fmtTime(t) { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
export function fmtPeriod(T) { return T < 120 ? Math.round(T) + ' s' : (T / 60).toFixed(1) + ' min'; }

export function fmtSci(x) {
  const e = Math.floor(Math.log10(x)), m = x / Math.pow(10, e);
  const sup = String(e).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c] || '⁻').join('');
  return m.toFixed(2) + '×10' + sup;
}

export function fmtForce(n) {
  return n >= 1000 ? (n / 1000).toFixed(2) + ' kN' : n >= 1 ? n.toFixed(1) + ' N' : (n * 1000).toFixed(0) + ' mN';
}

export function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
