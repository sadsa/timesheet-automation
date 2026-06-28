const TARGET_HOURS = 8;

const STANDUP_KEYWORDS = ['dsu', 'standup', 'stand-up', 'stand up', 'sync'];

export function isStandup(task) {
  const desc = (task.description || '').toLowerCase();
  return STANDUP_KEYWORDS.some(kw => desc.includes(kw));
}

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

export function autoDistributeGap(tasks, gap) {
  const eligibleIndices = tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => !isStandup(task))
    .map(({ index }) => index);

  if (eligibleIndices.length === 0) {
    throw new Error('Cannot auto-adjust: all tasks are standup meetings. No eligible tasks to distribute gap to.');
  }

  return distributeGap(tasks, eligibleIndices, gap);
}

export function calculateTotal(tasks) {
  return tasks.reduce((sum, t) => sum + t.duration, 0);
}
