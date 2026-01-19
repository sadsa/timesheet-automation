const TARGET_HOURS = 8;

export function calculateGap(tasks) {
  const total = tasks.reduce((sum, t) => sum + t.duration, 0);
  const gap = TARGET_HOURS - total;
  return gap > 0 ? gap : 0;
}
