export type MapTheme = 'light' | 'dark'

/** 0 = few confirmations, 1 = many — drives yellow intensity */
function voteStrength(openVotes: number): number {
  return Math.min(1, openVotes / 22)
}

/**
 * Leaflet DivIcon HTML for custom spot markers.
 * Brighter yellow ring/glow when more people say it's open.
 */
export function spotPinHtml(
  isActive: boolean,
  mapTheme: MapTheme = 'dark',
  openVotes = 0,
): string {
  const v = voteStrength(openVotes)
  const scale = isActive ? 1.06 : 1

  if (mapTheme === 'light') {
    const borderA = 0.1 + v * 0.55
    const glowA2 = 0.08 + v * 0.35
    const glow = isActive
      ? `0 0 ${10 + v * 18}px rgba(212,165,55,${0.35 + v * 0.45}), 0 2px 10px rgba(0,0,0,${0.08 + (1 - v) * 0.06})`
      : `0 2px 8px rgba(0,0,0,0.1), 0 0 ${6 + v * 14}px rgba(201,160,61,${glowA2})`
    const ring = `1px solid rgba(180,140,45,${borderA})`
    const topLight = Math.round(255 - v * 40)
    const botLight = Math.round(232 - v * 35)
    return `
<div class="mms-pin" style="
  width:40px;
  height:40px;
  transform-origin:center center;
  transform:scale(${scale});
  border-radius:9999px;
  background:linear-gradient(145deg,rgb(${topLight},${topLight - 2},${topLight - 8}),rgb(${botLight},${botLight - 4},${botLight - 12}));
  border:${ring};
  box-shadow:${glow};
  display:flex;
  align-items:center;
  justify-content:center;
  pointer-events:auto;
">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="opacity:${0.85 + v * 0.12}">
    <path d="M6 18c2-4 3-7 3-9a3 3 0 016 0c0 2 1 5 3 9" stroke="${v > 0.45 ? '#8b6914' : '#3d3d3d'}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M8 14c1.5-1 3.5-1 5 0M7 16c2-.5 4.5-.5 6.5 0" stroke="${v > 0.45 ? '#a67c1a' : '#6b6b6b'}" stroke-width="1" stroke-linecap="round" opacity="0.8"/>
  </svg>
</div>`.trim()
  }

  const borderGold = 0.08 + v * 0.52
  const glowGold = 0.2 + v * 0.55
  const glowSpread = 10 + v * 22
  const glow = isActive
    ? `0 0 ${glowSpread}px rgba(245,199,107,${glowGold}), 0 2px 10px rgba(0,0,0,0.5)`
    : `0 2px 8px rgba(0,0,0,0.45), 0 0 ${6 + v * 16}px rgba(245,199,107,${0.12 + v * 0.38})`

  const y1 = Math.round(20 + v * 55)
  const gradTop = `rgb(${y1},${Math.round(y1 * 0.75)},${Math.round(y1 * 0.35)})`
  const bgGrad =
    v > 0.12
      ? `linear-gradient(145deg,${gradTop},#141414)`
      : 'linear-gradient(145deg,#141414,#0a0a0a)'

  return `
<div class="mms-pin" style="
  width:40px;
  height:40px;
  transform-origin:center center;
  transform:scale(${scale});
  border-radius:9999px;
  background:${bgGrad};
  border:1px solid rgba(245,199,107,${borderGold});
  box-shadow:${glow};
  display:flex;
  align-items:center;
  justify-content:center;
  pointer-events:auto;
">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="opacity:${0.82 + v * 0.14}">
    <path d="M6 18c2-4 3-7 3-9a3 3 0 016 0c0 2 1 5 3 9" stroke="${v > 0.35 ? '#f0d78c' : '#c4c4c4'}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M8 14c1.5-1 3.5-1 5 0M7 16c2-.5 4.5-.5 6.5 0" stroke="${v > 0.35 ? '#e8c96b' : '#8a8a8a'}" stroke-width="1" stroke-linecap="round" opacity="0.85"/>
  </svg>
</div>`.trim()
}
