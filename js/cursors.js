// Um cursor por ação. O hotspot fica na ponta, como no cliente antigo.
function cursor(svg, x, y) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, auto`;
}

const move = cursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <path d="M6 4 L26 16 L16 18 L20 28 L15 30 L11 19 L6 24 Z" fill="#e9fbff" stroke="#0c4a62" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M9 8 L20 15 L14 16 Z" fill="#49c6ef"/>
  </svg>`, 6, 4);

const sit = cursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <rect x="6" y="8" width="16" height="3" rx="1" fill="#f3d48a" stroke="#6a4a16" stroke-width="1"/>
    <rect x="7" y="11" width="3" height="10" fill="#d7b56a" stroke="#6a4a16" stroke-width="1"/>
    <rect x="18" y="11" width="3" height="10" fill="#d7b56a" stroke="#6a4a16" stroke-width="1"/>
    <path d="M8 14 H20" stroke="#6a4a16" stroke-width="1.4"/>
    <circle cx="23" cy="9" r="3.2" fill="#7ee0ff" stroke="#0c4a62" stroke-width="1"/>
  </svg>`, 8, 6);

const lean = cursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <rect x="22" y="4" width="4" height="24" rx="1" fill="#9fd7ea" stroke="#0c4a62" stroke-width="1"/>
    <circle cx="14" cy="9" r="3" fill="#f4e2c2" stroke="#0c4a62" stroke-width="1"/>
    <path d="M14 12 L18 16 L22 15" fill="none" stroke="#e9fbff" stroke-width="2" stroke-linecap="round"/>
    <path d="M14 12 L11 20 L8 26 M14 18 L18 24" fill="none" stroke="#49c6ef" stroke-width="2" stroke-linecap="round"/>
  </svg>`, 14, 8);

const block = cursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <circle cx="16" cy="16" r="10" fill="#2a1214" fill-opacity="0.35" stroke="#ff6b6b" stroke-width="2"/>
    <path d="M9 23 L23 9" stroke="#ff6b6b" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`, 16, 16);

const look = cursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <circle cx="16" cy="16" r="8" fill="none" stroke="#e9fbff" stroke-width="1.6"/>
    <path d="M16 4 V9 M16 23 V28 M4 16 H9 M23 16 H28" stroke="#49c6ef" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`, 16, 16);

const CURSORS = { move, sit, lean, block, look };

export function applyCursor(el, mode) {
  el.style.cursor = CURSORS[mode] || move;
}
