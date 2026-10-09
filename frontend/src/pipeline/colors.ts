// One colour and one shape per group, so groups read on a projector and in black and white.
export const GROUP_COLORS = ["#22d3ee", "#f472b6", "#fbbf24"];
export const GREY = "#a1a1aa";
export const OK = "#4ade80";
export const BAD = "#f87171";

// Viridis stops for the kernel grid: dark = different, yellow = alike.
const STOPS = [
  [0, [68, 1, 84]],
  [0.25, [59, 82, 139]],
  [0.5, [33, 145, 140]],
  [0.75, [94, 201, 98]],
  [1, [253, 231, 37]],
] as const;

export function heat(v: number): string {
  const t = Math.min(1, Math.max(0, v));
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i];
    const [t0, c0] = STOPS[i - 1];
    if (t <= t1) {
      const f = (t - t0) / (t1 - t0);
      const c = c0.map((a, k) => Math.round(a + f * (c1[k] - a)));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return "rgb(253,231,37)";
}
