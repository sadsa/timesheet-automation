import chalk from 'chalk';
import checkbox from '@inquirer/checkbox';
import { calculateGap, distributeGap, calculateTotal } from './duration-adjuster.js';

export function displayDurationSummary(tasks, date) {
  console.log(chalk.yellow(`\n=== ${date} ===`));

  // Group by project, then category
  const byProject = {};
  tasks.forEach(task => {
    if (!byProject[task.project]) byProject[task.project] = {};
    if (!byProject[task.project][task.category]) byProject[task.project][task.category] = [];
    byProject[task.project][task.category].push(task);
  });

  let total = 0;

  for (const [project, categories] of Object.entries(byProject)) {
    console.log(chalk.cyan(`\n${project}`));

    for (const [category, categoryTasks] of Object.entries(categories)) {
      console.log(chalk.blue(`  ${category}`));

      categoryTasks.forEach(task => {
        const ticketOrType = task.ticket || `[${task.type}]`;
        console.log(chalk.gray(`    ✓ ${ticketOrType} - ${task.description.substring(0, 60)}... (${task.duration}h)`));
        total += task.duration;
      });
    }
  }

  const warning = total !== 8 ? chalk.red(' ⚠️  (Expected: 8h)') : chalk.green(' ✓');
  console.log(chalk.bold(`\nTotal: ${total}h${warning}`));

  return total;
}

export async function promptForAdjustment(tasks, date) {
  const total = calculateTotal(tasks);
  const gap = calculateGap(tasks);

  if (gap === 0) {
    return tasks;
  }

  console.log(chalk.yellow(`\n${gap}h to distribute to reach 8h`));
  console.log(chalk.gray('(Time added per task depends on number selected)\n'));

  const choices = tasks.map((task, index) => {
    const ticketOrType = task.ticket || `[${task.type}]`;
    return {
      name: `${ticketOrType} - ${task.description.substring(0, 40)}... (${task.duration}h)`,
      value: index
    };
  });

  try {
    const selectedIndices = await checkbox({
      message: `Select tasks to round up (${gap}h to distribute):`,
      choices,
      instructions: false
    });

    if (selectedIndices.length === 0) {
      console.log(chalk.gray('Skipped adjustment'));
      return tasks;
    }

    const adjustedTasks = distributeGap(tasks, selectedIndices, gap);
    const perTask = gap / selectedIndices.length;

    console.log(chalk.green(`\n+${perTask.toFixed(2)}h added to ${selectedIndices.length} task(s)`));
    console.log(chalk.green('\n--- Adjusted Summary ---'));
    displayDurationSummary(adjustedTasks, date);

    return adjustedTasks;

  } catch (error) {
    if (error.message?.includes('User force closed') || error.name === 'ExitPromptError') {
      console.log(chalk.gray('\nSkipped adjustment'));
      return tasks;
    }
    throw error;
  }
}
