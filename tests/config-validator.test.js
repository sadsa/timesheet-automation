import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = join(__dirname, '../config/projects-categories.json');

test('config file is valid JSON', () => {
  let config;

  assert.doesNotThrow(() => {
    const content = readFileSync(configPath, 'utf-8');
    config = JSON.parse(content);
  }, 'Config file should be valid JSON');

  assert.ok(config, 'Config should be parsed successfully');
  assert.strictEqual(typeof config, 'object', 'Config should be an object');
  assert.strictEqual(Array.isArray(config), false, 'Config should be an object, not an array');
});

test('all projects have non-empty category arrays', () => {
  const content = readFileSync(configPath, 'utf-8');
  const config = JSON.parse(content);

  const projects = Object.keys(config);
  assert.ok(projects.length > 0, 'Config should have at least one project');

  for (const projectName of projects) {
    const categories = config[projectName];

    assert.ok(Array.isArray(categories), `Project "${projectName}" should have an array of categories`);
    assert.ok(categories.length > 0, `Project "${projectName}" should have at least one category`);

    // Verify all categories are non-empty strings
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      assert.strictEqual(typeof category, 'string', `Category at index ${i} in project "${projectName}" should be a string`);
      assert.ok(category.trim().length > 0, `Category at index ${i} in project "${projectName}" should not be empty`);
    }
  }
});
