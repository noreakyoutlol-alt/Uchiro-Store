const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#818CF8" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#818CF8" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#312E81"/>
      <stop offset="50%" stop-color="#1E1B4B"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#A5B4FC"/>
      <stop offset="100%" stop-color="#6366F1"/>
    </linearGradient>
    <linearGradient id="dpadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="100%" stop-color="#1E293B"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#4F46E5" flood-opacity="0.4"/>
    </filter>
  </defs>

  <!-- Ambient Glow -->
  <circle cx="128" cy="128" r="110" fill="url(#bgGlow)"/>

  <!-- Controller Body -->
  <g filter="url(#shadow)">
    <!-- Main ergonomic gamepad shell -->
    <path d="M72 80 C50 80, 28 105, 32 155 C34 175, 46 200, 70 200 C88 200, 98 182, 110 162 C116 152, 122 148, 128 148 C134 148, 140 152, 146 162 C158 182, 168 200, 186 200 C210 200, 222 175, 224 155 C228 105, 206 80, 184 80 Z"
          fill="url(#bodyGrad)"
          stroke="url(#borderGrad)"
          stroke-width="5"
          stroke-linejoin="round"/>

    <!-- Subtle Inner Highlight -->
    <path d="M74 88 C58 88, 42 108, 44 148 C46 160, 52 180, 68 185"
          fill="none"
          stroke="#C7D2FE"
          stroke-width="2.5"
          stroke-linecap="round"
          opacity="0.5"/>
  </g>

  <!-- D-Pad Cross -->
  <g transform="translate(68, 126)">
    <!-- D-Pad Shadow Base -->
    <rect x="-18" y="-7" width="36" height="14" rx="3" fill="#0F172A"/>
    <rect x="-7" y="-18" width="14" height="36" rx="3" fill="#0F172A"/>
    <!-- D-Pad Buttons -->
    <rect x="-17" y="-6" width="34" height="12" rx="2.5" fill="url(#dpadGrad)" stroke="#64748B" stroke-width="1"/>
    <rect x="-6" y="-17" width="12" height="34" rx="2.5" fill="url(#dpadGrad)" stroke="#64748B" stroke-width="1"/>
    <!-- Center Dimple -->
    <circle cx="0" cy="0" r="3" fill="#0F172A"/>
  </g>

  <!-- Action Buttons (ABXY diamond layout) -->
  <g transform="translate(186, 126)">
    <!-- Top button (Y - Amber) -->
    <circle cx="0" cy="-14" r="7.5" fill="#F59E0B" stroke="#FDE68A" stroke-width="1.5"/>
    <circle cx="-2" cy="-16" r="2.5" fill="#FFF" opacity="0.6"/>

    <!-- Left button (X - Blue) -->
    <circle cx="-14" cy="0" r="7.5" fill="#3B82F6" stroke="#BFDBFE" stroke-width="1.5"/>
    <circle cx="-16" cy="-2" r="2.5" fill="#FFF" opacity="0.6"/>

    <!-- Right button (B - Red) -->
    <circle cx="14" cy="0" r="7.5" fill="#EF4444" stroke="#FECACA" stroke-width="1.5"/>
    <circle cx="12" cy="-2" r="2.5" fill="#FFF" opacity="0.6"/>

    <!-- Bottom button (A - Green) -->
    <circle cx="0" cy="14" r="7.5" fill="#10B981" stroke="#A7F3D0" stroke-width="1.5"/>
    <circle cx="-2" cy="12" r="2.5" fill="#FFF" opacity="0.6"/>
  </g>

  <!-- Thumbsticks -->
  <g transform="translate(104, 156)">
    <circle cx="0" cy="0" r="14" fill="#0F172A" stroke="#334155" stroke-width="2"/>
    <circle cx="-1" cy="-1" r="10" fill="#334155"/>
    <circle cx="-2" cy="-2" r="7" fill="#1E293B"/>
    <circle cx="-3" cy="-3" r="2" fill="#64748B" opacity="0.7"/>
  </g>
  <g transform="translate(152, 156)">
    <circle cx="0" cy="0" r="14" fill="#0F172A" stroke="#334155" stroke-width="2"/>
    <circle cx="-1" cy="-1" r="10" fill="#334155"/>
    <circle cx="-2" cy="-2" r="7" fill="#1E293B"/>
    <circle cx="-3" cy="-3" r="2" fill="#64748B" opacity="0.7"/>
  </g>

  <!-- Center Menu Buttons & LED -->
  <circle cx="128" cy="116" r="4" fill="#818CF8" filter="url(#shadow)"/>
  <rect x="110" y="114" width="7" height="3" rx="1.5" fill="#64748B"/>
  <rect x="139" y="114" width="7" height="3" rx="1.5" fill="#64748B"/>
</svg>`;

const html = `<!DOCTYPE html>
<html>
<body>
<canvas id="c" width="256" height="256"></canvas>
<div id="out"></div>
<script>
const c = document.getElementById('c');
const ctx = c.getContext('2d');
const img = new Image();
const svgStr = ${JSON.stringify(svg)};
img.onload = () => {
  ctx.drawImage(img, 0, 0, 256, 256);
  const dataUrl = c.toDataURL('image/webp');
  document.getElementById('out').innerText = 'DATAURL:' + dataUrl;
};
img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
</script>
</body>
</html>`;

const tempFile = path.resolve('temp_render.html');
fs.writeFileSync(tempFile, html);

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const out = execFileSync(chrome, ['--headless', '--disable-gpu', '--virtual-time-budget=2000', '--dump-dom', tempFile], { encoding: 'utf8' });

try { fs.unlinkSync(tempFile); } catch(e){}

const match = out.match(/DATAURL:data:image\/webp;base64,([A-Za-z0-9+/=]+)/);
if (match) {
  const buf = Buffer.from(match[1], 'base64');
  fs.writeFileSync('client-store/public/emojis/gamepad.webp', buf);
  fs.writeFileSync('client-admin/public/emojis/gamepad.webp', buf);
  if (fs.existsSync('client-store/dist/emojis')) {
    fs.writeFileSync('client-store/dist/emojis/gamepad.webp', buf);
  }
  if (fs.existsSync('client-admin/dist/emojis')) {
    fs.writeFileSync('client-admin/dist/emojis/gamepad.webp', buf);
  }
  console.log('SUCCESS! gamepad.webp written successfully! Size:', buf.length, 'bytes');
} else {
  console.error('Failed to extract data URL from Chrome output');
  console.log(out.slice(0, 500));
  process.exit(1);
}
