// One-off WCAG contrast checker for the teal design system refactor.
// Mirrors the token values in web/src/styles.css — keep in sync while tuning.
// Usage: node .trellis/tasks/08-29-refactor-design-system/research/contrast-check.mjs

// ---------- oklch -> sRGB ----------
function oklchToLinearSrgb(L, C, H) {
  const rad = (H * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b2 = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [r, g, b2];
}

function luminance([r, g, b]) {
  return (
    0.2126 * Math.min(Math.max(r, 0), 1) +
    0.7152 * Math.min(Math.max(g, 0), 1) +
    0.0722 * Math.min(Math.max(b, 0), 1)
  );
}

function contrast(l1, l2) {
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE_LUM = 1;
const DARK111_LUM = 0.00562; // relative luminance of #111111

function report(name, fgLum, bgLum, pass = 4.5) {
  const ratio = contrast(fgLum, bgLum);
  const ok = ratio >= pass ? "PASS" : "FAIL";
  console.log(`${ok}  ${ratio.toFixed(2)}:1  ${name}`);
  return ratio >= pass;
}

function lum(L, C, H) {
  return luminance(oklchToLinearSrgb(L, C, H));
}

// ---------- token candidates (keep in sync with styles.css) ----------
const light = {
  background: [0.985, 0.005, 220],
  foreground: [0.22, 0.02, 230],
  primary: [0.5, 0.11, 200],
  primaryForeground: [0.985, 0.005, 220],
  secondary: [0.945, 0.012, 225],
  secondaryForeground: [0.28, 0.02, 230],
  mutedForeground: [0.46, 0.02, 230],
  accent: [0.945, 0.012, 225],
  accentForeground: [0.28, 0.02, 230],
};

const dark = {
  background: [0.165, 0.015, 230],
  foreground: [0.93, 0.01, 220],
  primary: [0.78, 0.1, 195],
  primaryForeground: [0.2, 0.03, 220],
  secondary: [0.26, 0.015, 230],
  secondaryForeground: [0.93, 0.01, 220],
  mutedForeground: [0.72, 0.012, 225],
  accent: [0.28, 0.016, 230],
  accentForeground: [0.93, 0.01, 220],
};

// category palette: unified L=0.63 C=0.11, hues spread around the wheel,
// teal/cyan zone (~185-225) reserved for primary.
const categoryHues = [10, 50, 95, 140, 240, 280, 320, 350];

let allPass = true;

console.log("== Light theme ==");
const lBg = lum(...light.background);
allPass &= report("foreground x background", lum(...light.foreground), lBg);
allPass &= report("primary x primary-foreground", lum(...light.primaryForeground), lum(...light.primary));
allPass &= report("muted-foreground x background", lum(...light.mutedForeground), lBg);
allPass &= report("secondary-foreground x secondary", lum(...light.secondaryForeground), lum(...light.secondary));
allPass &= report("accent-foreground x accent", lum(...light.accentForeground), lum(...light.accent));

console.log("\n== Dark theme ==");
const dBg = lum(...dark.background);
allPass &= report("foreground x background", lum(...dark.foreground), dBg);
allPass &= report("primary x primary-foreground", lum(...dark.primaryForeground), lum(...dark.primary));
allPass &= report("muted-foreground x background", lum(...dark.mutedForeground), dBg);
allPass &= report("secondary-foreground x secondary", lum(...dark.secondaryForeground), lum(...dark.secondary));
allPass &= report("accent-foreground x accent", lum(...dark.accentForeground), lum(...dark.accent));

console.log("\n== Category palette (contrastText picks white vs #111) ==");
for (const [i, h] of categoryHues.entries()) {
  const blockLum = lum(0.63, 0.11, h);
  const cWhite = contrast(WHITE_LUM, blockLum);
  const cDark = contrast(blockLum, DARK111_LUM);
  const chosen = cWhite >= cDark ? ["#fff", cWhite] : ["#111", cDark];
  const ok = chosen[1] >= 4.5 ? "PASS" : "FAIL";
  if (chosen[1] < 4.5) allPass = false;
  console.log(`${ok}  ${chosen[1].toFixed(2)}:1  --category-${i + 1} hue ${h} -> text ${chosen[0]} (white ${cWhite.toFixed(2)} / dark ${cDark.toFixed(2)})`);
}

console.log(`\n${allPass ? "ALL PASS" : "SOME FAILED"}`);