// Draws the mascot and its room as one SVG.
import { roomItem } from './data.js';

const POS = {
  wallLeft: { x: 62, y: 86, size: 42 },
  wallRight: { x: 300, y: 64, size: 34 },
  shelf: { x: 300, y: 132, size: 28 },
  ceiling: { x: 118, y: 52, size: 30 },
  floorLeft: { x: 52, y: 246, size: 56 },
  floorRight: { x: 306, y: 246, size: 56 },
};

function emoji(item, pos) {
  return `<text x="${pos.x}" y="${pos.y}" font-size="${pos.size}" text-anchor="middle" dominant-baseline="central">${item.emoji}</text>`;
}

function face(mood) {
  if (mood === 'happy') {
    return `<path d="M160 197q4-6 8 0M192 197q4-6 8 0" stroke="#3b2530" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M170 240q10 9 20 0" stroke="#3b2530" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  }
  if (mood === 'sad') {
    return `<circle cx="164" cy="198" r="5" fill="#3b2530"/><circle cx="196" cy="198" r="5" fill="#3b2530"/>
      <path d="M155 192l11-5M205 192l-11-5" stroke="#3b2530" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M171 245q9-7 18 0" stroke="#3b2530" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  }
  return `<circle cx="164" cy="198" r="5" fill="#3b2530"/><circle cx="196" cy="198" r="5" fill="#3b2530"/>
    <circle cx="166" cy="196" r="1.6" fill="#fff"/><circle cx="198" cy="196" r="1.6" fill="#fff"/>
    <path d="M172 242h16" stroke="#3b2530" stroke-width="3" stroke-linecap="round"/>`;
}

export function pigSVG(placed = {}, mood = 'neutral', { label = 'Your pig in its room' } = {}) {
  const get = (slot) => roomItem(placed[slot]);
  const wall = get('wall');
  const wallColor = wall?.color || '#fff1d0';
  const night = wall?.id === 'wall-night';
  const rug = get('rug');
  const hat = get('hat');

  let stars = '';
  if (night) {
    const pts = [[30, 30], [90, 20], [250, 30], [330, 40], [40, 150], [340, 150], [120, 120], [260, 110]];
    stars = pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#fff8c4"/>`).join('');
  }

  const window = get('window') ? `
    <g>
      <rect x="146" y="34" width="88" height="74" rx="8" fill="#9fd8ff" stroke="#8a6a4a" stroke-width="5"/>
      <circle cx="214" cy="56" r="11" fill="#ffd23f"/>
      <path d="M151 96q18-14 34 0t44 0V103H151Z" fill="#7bc96f"/>
      <path d="M190 34v74M146 71h88" stroke="#8a6a4a" stroke-width="4"/>
    </g>` : '';

  const ceiling = get('ceiling')
    ? `<path d="M${POS.ceiling.x} 0v${POS.ceiling.y - 16}" stroke="#6b5844" stroke-width="2"/>${emoji(get('ceiling'), POS.ceiling)}` : '';
  const shelfItem = get('shelf');
  const shelf = shelfItem
    ? `<rect x="262" y="146" width="76" height="7" rx="2" fill="#a07850"/>${emoji(shelfItem, POS.shelf)}` : '';

  return `<svg class="room" viewBox="0 0 360 290" role="img" aria-label="${label}">
    <rect width="360" height="200" fill="${wallColor}"/>
    ${stars}
    <rect y="196" width="360" height="94" fill="#e7c08e"/>
    <path d="M0 222h360M0 252h360M0 280h360" stroke="#d6aa72" stroke-width="2"/>
    <rect y="192" width="360" height="8" fill="#c99a63"/>
    ${window}
    ${get('wallLeft') ? emoji(get('wallLeft'), POS.wallLeft) : ''}
    ${get('wallRight') ? emoji(get('wallRight'), POS.wallRight) : ''}
    ${shelf}
    ${ceiling}
    ${rug ? `<ellipse cx="180" cy="262" rx="104" ry="20" fill="${rug.color}" opacity=".9"/><ellipse cx="180" cy="262" rx="88" ry="14" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2" stroke-dasharray="6 6"/>` : ''}
    ${get('floorLeft') ? emoji(get('floorLeft'), POS.floorLeft) : ''}
    ${get('floorRight') ? emoji(get('floorRight'), POS.floorRight) : ''}
    <g class="pig-body">
      <ellipse cx="180" cy="266" rx="58" ry="8" fill="#000" opacity=".12"/>
      <rect x="146" y="244" width="16" height="22" rx="6" fill="#f79ab5"/>
      <rect x="198" y="244" width="16" height="22" rx="6" fill="#f79ab5"/>
      <path d="M132 168 126 134 158 156Z" fill="#ff9fbd" stroke="#e47c9c" stroke-width="3" stroke-linejoin="round"/>
      <path d="M228 168 234 134 202 156Z" fill="#ff9fbd" stroke="#e47c9c" stroke-width="3" stroke-linejoin="round"/>
      <ellipse cx="180" cy="210" rx="64" ry="50" fill="#ffb8cb" stroke="#e47c9c" stroke-width="3"/>
      <rect x="168" y="163" width="24" height="5" rx="2.5" fill="#c45f80"/>
      <path d="M243 214q14-4 8 8t8 6" stroke="#e47c9c" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="146" cy="222" rx="9" ry="6" fill="#ff8fae" opacity=".55"/>
      <ellipse cx="214" cy="222" rx="9" ry="6" fill="#ff8fae" opacity=".55"/>
      <ellipse cx="180" cy="222" rx="20" ry="14" fill="#ff93b3" stroke="#e47c9c" stroke-width="2.5"/>
      <ellipse cx="173" cy="222" rx="3" ry="4.5" fill="#c45f80"/>
      <ellipse cx="187" cy="222" rx="3" ry="4.5" fill="#c45f80"/>
      ${face(mood)}
      ${hat ? `<text x="180" y="158" font-size="44" text-anchor="middle" dominant-baseline="central">${hat.emoji}</text>` : ''}
    </g>
  </svg>`;
}

// Small standalone pig for cards and onboarding.
export function pigBadge(mood = 'happy', size = 72) {
  return `<svg width="${size}" height="${size}" viewBox="110 128 140 140" aria-hidden="true">
    <path d="M132 168 126 134 158 156Z" fill="#ff9fbd" stroke="#e47c9c" stroke-width="3" stroke-linejoin="round"/>
    <path d="M228 168 234 134 202 156Z" fill="#ff9fbd" stroke="#e47c9c" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="180" cy="210" rx="64" ry="50" fill="#ffb8cb" stroke="#e47c9c" stroke-width="3"/>
    <rect x="168" y="163" width="24" height="5" rx="2.5" fill="#c45f80"/>
    <ellipse cx="180" cy="222" rx="20" ry="14" fill="#ff93b3" stroke="#e47c9c" stroke-width="2.5"/>
    <ellipse cx="173" cy="222" rx="3" ry="4.5" fill="#c45f80"/>
    <ellipse cx="187" cy="222" rx="3" ry="4.5" fill="#c45f80"/>
    ${face(mood)}
  </svg>`;
}
