import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';

export async function loadCategories() {
  try {
    const data = await fs.readFile('config/categories.json', 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return ['Meetings', 'OneDrive', 'Teams App', 'Dropbox'];
  }
}

export async function saveCategories(categories) {
  await fs.writeFile('config/categories.json', JSON.stringify(categories, null, 2));
}

export async function promptForCategory(task, categories) {
  console.log(chalk.blue(`\nTask: ${task.description}`));
  console.log(chalk.gray(`Duration: ${task.duration} hours`));

  const choices = [
    ...categories.map((cat, idx) => ({ name: cat, value: cat })),
    { name: chalk.green('[Add new category]'), value: '__new__' }
  ];

  const { category } = await inquirer.prompt([
    {
      type: 'list',
      name: 'category',
      message: 'Select category:',
      choices
    }
  ]);

  if (category === '__new__') {
    const { newCategory } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newCategory',
        message: 'Enter new category name:'
      }
    ]);
    categories.push(newCategory);
    await saveCategories(categories);
    return newCategory;
  }

  return category;
}

export function displayDurationSummary(tasks, date) {
  console.log(chalk.yellow(`\n=== ${date} ===`));

  let total = 0;
  tasks.forEach((task, idx) => {
    console.log(`${idx + 1}. [${task.category}] ${task.description.substring(0, 40)}... ${task.duration}h`);
    total += task.duration;
  });

  const warning = total !== 8 ? chalk.red(' ⚠️') : chalk.green(' ✓');
  console.log(chalk.bold(`\n                                      Total: ${total}h / 8.0h${warning}`));
}

export async function promptDurationAction() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Options:',
      choices: [
        { name: 'Continue', value: 'continue' },
        { name: 'Edit durations', value: 'edit' },
        { name: 'Quit', value: 'quit' }
      ]
    }
  ]);

  return action;
}

export async function editTaskDuration(tasks) {
  const { taskIndex } = await inquirer.prompt([
    {
      type: 'number',
      name: 'taskIndex',
      message: `Which entry to adjust? (1-${tasks.length}):`,
      validate: (input) => {
        const num = parseInt(input);
        return num >= 1 && num <= tasks.length || 'Invalid entry number';
      }
    }
  ]);

  const task = tasks[taskIndex - 1];
  console.log(chalk.gray(`Current: ${task.description} - ${task.duration}h`));

  const { newDuration } = await inquirer.prompt([
    {
      type: 'number',
      name: 'newDuration',
      message: 'New duration in hours:',
      validate: (input) => input > 0 || 'Duration must be positive'
    }
  ]);

  task.duration = newDuration;
  return tasks;
}
