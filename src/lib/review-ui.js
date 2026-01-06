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
