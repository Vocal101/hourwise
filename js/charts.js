// Small hand-rolled SVG charts. Colors come in with the data; text uses currentColor.
import { esc } from './ui.js';

export function ring(pct, { size = 168, stroke = 16, color = 'var(--green)', track = 'var(--track)', over = false, children = '' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${over ? 'var(--red)' : color}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>
    <div class="ring-label">${children}</div>
  </div>`;
}

export function donut(slices, { size = 180, stroke = 28, center = '' } = {}) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = total > 0 ? slices.map((s) => {
    const len = (s.value / total) * c;
    const gap = slices.length > 1 ? Math.min(2, len / 3) : 0;
    const arc = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}"
      stroke-dasharray="${Math.max(0, len - gap)} ${c}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${size / 2} ${size / 2})"><title>${esc(s.label)}</title></circle>`;
    offset += len;
    return arc;
  }).join('') : '';
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Spending by category">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>${arcs}
    </svg>
    <div class="ring-label">${center}</div>
  </div>`;
}

// Vertical bars with an optional dashed budget line. bars: [{label, value, color?, title?}]
export function bars(data, { height = 170, line = null, format = (v) => v } = {}) {
  const w = 320, padTop = 18, padBottom = 26;
  const max = Math.max(1, line || 0, ...data.map((d) => d.value)) * 1.08;
  const slot = w / Math.max(1, data.length);
  const bw = Math.min(34, slot * 0.6);
  const y = (v) => padTop + (height - padTop - padBottom) * (1 - v / max);
  const cols = data.map((d, i) => {
    const x = i * slot + (slot - bw) / 2;
    const top = y(d.value);
    const h = Math.max(d.value > 0 ? 3 : 0, height - padBottom - top);
    return `<g><title>${esc(d.title || `${d.label}: ${format(d.value)}`)}</title>
      <rect x="${x}" y="${height - padBottom - h}" width="${bw}" height="${h}" rx="6" fill="${d.color || 'var(--accent-strong)'}"/>
      <text x="${x + bw / 2}" y="${height - 8}" text-anchor="middle" class="axis">${esc(d.label)}</text></g>`;
  }).join('');
  const budgetLine = line ? `<line x1="0" x2="${w}" y1="${y(line)}" y2="${y(line)}" stroke="var(--red)" stroke-width="1.5" stroke-dasharray="5 5"/>
    <text x="2" y="${y(line) - 5}" class="axis budget-label">Budget ${esc(format(line))}</text>` : '';
  return `<svg class="bars" viewBox="0 0 ${w} ${height}" role="img" aria-label="Monthly totals">${cols}${budgetLine}</svg>`;
}

export function progressBar(pct, color = 'var(--green)') {
  const p = Math.max(0, Math.min(1, pct));
  return `<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p * 100)}"><span style="width:${p * 100}%;background:${color}"></span></div>`;
}
