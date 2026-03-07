#!/usr/bin/env node
import { execSync } from 'node:child_process';

const date = process.argv[2];

if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('Usage: node scripts/gh-activity.js <YYYY-MM-DD>');
  process.exit(1);
}

function ghApi(path) {
  try {
    const result = execSync(`gh api "${path}"`, { encoding: 'utf8' });
    return JSON.parse(result);
  } catch (err) {
    console.error(`gh api failed for ${path}:\n${err.stderr ?? err.message}`);
    process.exit(1);
  }
}

function fetchEventsForDate(username, targetDate) {
  const events = [];
  let page = 1;

  while (true) {
    const pageEvents = ghApi(`/users/${username}/events?per_page=100&page=${page}`);
    if (pageEvents.length === 0) break;

    for (const event of pageEvents) {
      const eventDate = event.created_at.slice(0, 10);
      if (eventDate === targetDate) {
        events.push(event);
      } else if (eventDate < targetDate) {
        return events;
      }
    }

    page++;
  }

  return events;
}

const user = ghApi('/user');
const rawEvents = fetchEventsForDate(user.login, date);

console.log(JSON.stringify(rawEvents, null, 2));
