#!/usr/bin/env node
// Usage: node scripts/gh-activity.js <YYYY-MM-DD>

const date = process.argv[2];

if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('Usage: node scripts/gh-activity.js <YYYY-MM-DD>');
  process.exit(1);
}

console.log(JSON.stringify([]));
