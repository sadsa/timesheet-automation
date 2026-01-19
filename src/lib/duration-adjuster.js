const TARGET_HOURS = 8;

export function calculateGap(tasks) {
  const total = tasks.reduce((sum, t) => sum + t.duration, 0);
  const gap = TARGET_HOURS - total;
  return gap > 0 ? gap : 0;
}

export function distributeGap(tasks, selectedIndices, gap) {
  if (selectedIndices.length === 0 || gap <= 0) {
    return tasks;
  }

  const perTask = gap / selectedIndices.length;

  return tasks.map((task, index) => {
    if (selectedIndices.includes(index)) {
      return { ...task, duration: task.duration + perTask };
    }
    return { ...task };
  });
}
