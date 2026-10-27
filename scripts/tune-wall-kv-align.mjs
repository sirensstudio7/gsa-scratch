/**
 * Headless alignment helper (run: node scripts/tune-wall-kv-align.mjs).
 * Requires: npm i canvas (optional dev dependency).
 *
 * Without canvas, prints recommended slot-level contain geometry only.
 */

const SLOTS = {
  buku: { fw: 1163, fh: 1132, cw: 1024, ch: 558 },
  globe: { fw: 932, fh: 972, cw: 1024, ch: 1024 },
};

function contain(iw, ih, boxW, boxH) {
  const s = Math.min(boxW / iw, boxH / ih);
  return { s, w: iw * s, h: ih * s };
}

for (const [name, { fw, fh, cw, ch }] of Object.entries(SLOTS)) {
  const slot = name === "buku" ? [208, 182] : [148, 156];
  const outline = contain(fw, fh, slot[0], slot[1]);
  const colorInOutline = contain(cw, ch, outline.w, outline.h);
  console.log(
    `${name}: outline in slot ${outline.w.toFixed(1)}×${outline.h.toFixed(1)} | color (contain in outline) ${colorInOutline.w.toFixed(1)}×${colorInOutline.h.toFixed(1)} → needs rotate+scale in wall-kv-layout.ts`,
  );
}
