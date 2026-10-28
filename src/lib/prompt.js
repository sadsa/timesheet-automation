import readline from 'readline';
import chalk from 'chalk';

/** Asks a question on the terminal and resolves with the trimmed answer. */
export function ask(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(chalk.yellow(message), answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function waitForEnter(message) {
  await ask(`${message} [Press Enter]`);
}
