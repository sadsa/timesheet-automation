import chalk from 'chalk';

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
}
