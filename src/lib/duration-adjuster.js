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

  const rawPerTask = gap / selectedIndices.length;
  const roundedPerTask = Math.floor(rawPerTask * 4) / 4; // Round down to 0.25
  const distributed = roundedPerTask * selectedIndices.length;
  const remainder = gap - distributed;

  return tasks.map((task, index) => {
    if (!selectedIndices.includes(index)) {
      return { ...task };
    }

    // First selected task gets the remainder
    const isFirstSelected = index === selectedIndices[0];
    const addition = isFirstSelected ? roundedPerTask + remainder : roundedPerTask;

    return { ...task, duration: task.duration + addition };
  });
}

export function calculateTotal(tasks) {
  return tasks.reduce((sum, t) => sum + t.duration, 0);
}
