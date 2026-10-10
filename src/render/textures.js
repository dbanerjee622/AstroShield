import * as THREE from 'three';

/* Procedural canvas textures for the sky, sun and planets. */

export function nebulaTexture(rgb, alpha) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'), gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, `rgba(${rgb},${alpha})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function canvasTex(w, h, paint) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}

export function blotchy(base, spots) {
  return canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      x.fillStyle = spots[(Math.random() * spots.length) | 0];
      x.globalAlpha = 0.12 + Math.random() * 0.35;
      x.beginPath();
      x.ellipse(Math.random() * w, Math.random() * h, 3 + Math.random() * 30, 2 + Math.random() * 14, Math.random() * 3, 0, Math.PI * 2);
      x.fill();
    }
  });
}

export function banded(colors) {
  return canvasTex(512, 256, (x, w, h) => {
    let y = 0;
    while (y < h) {
      const bh = 3 + Math.random() * 14;
      x.fillStyle = colors[(Math.random() * colors.length) | 0]; x.fillRect(0, y, w, bh + 1); y += bh;
    }
    x.globalAlpha = 0.3;
    for (let i = 0; i < 60; i++) {
      x.fillStyle = colors[(Math.random() * colors.length) | 0];
      x.fillRect(Math.random() * w, Math.random() * h, 30 + Math.random() * 90, 2 + Math.random() * 3);
    }
  });
}

export function glowTexture(rgb, alpha) {
  return canvasTex(256, 256, (x) => {
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, `rgba(${rgb},${alpha})`); g.addColorStop(0.35, `rgba(${rgb},${alpha * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  });
}
