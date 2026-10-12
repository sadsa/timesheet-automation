#!/usr/bin/env node
/**
 * Fetches the user's GitHub PR activity for a local date range and prints it as
 * Work Items, already dated in the local timezone and mapped to Project/Category.
 * Step 3 of the generate-timesheet skill.
 *
 * Usage: npm run fetch-activity -- <from> <to>   (YYYY-MM-DD, inclusive, local dates)
 *
 * - Authored PRs: one item per PR, dated by creation.
 * - Reviewed PRs: one item per local day the user submitted a review, whenever the
 *   PR itself was opened. Reviews on the user's own PRs are excluded.
 * Repos missing from config/repo-categories.json come back with project/category
 * null and are listed under unmappedRepos.
 */
import { execFileSync } from 'child_process';
import fs from 'fs/promises';
import { toLocal, extractTicket, cleanTitle, addDays } from './lib/activity.js';

const [from, to] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}$/.test(from ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(to ?? '')) {
  console.error('Usage: npm run fetch-activity -- <from YYYY-MM-DD> <to YYYY-MM-DD>');
  process.exit(1);
}

const repoRoot = new URL('..', import.meta.url);
const readConfig = async name => JSON.parse(await fs.readFile(new URL(`config/${name}`, repoRoot), 'utf-8'));
const { username, org } = await readConfig('github.json');
const repoCategories = await readConfig('repo-categories.json');
const timeZone = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;

const gh = args => execFileSync('gh', args, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
const ghJson = args => JSON.parse(gh(args));
const inRange = date => date >= from && date <= to;

// GitHub search dates are UTC; widen by a day each side and filter on the local date.
const searchFields = 'number,title,body,author,createdAt,repository,url';

const authored = ghJson([
  'search', 'prs', '--author', username, '--owner', org,
  '--created', `${addDays(from, -1)}..${addDays(to, 1)}`,
  '--json', searchFields, '--limit', '1000'
]);

// A review in range means the PR was updated on or after that review, so this is a
// superset of every PR reviewed in range — unlike filtering on the PR's created date.
const reviewed = ghJson([
  'search', 'prs', '--reviewed-by', username, '--owner', org,
  '--updated', `>=${addDays(from, -1)}`,
  '--json', searchFields, '--limit', '1000'
]).filter(pr => pr.author?.login !== username);

const items = [];

for (const pr of authored) {
  const { date, time } = toLocal(pr.createdAt, timeZone);
  if (!inRange(date)) continue;
  // Branch names often carry the ticket when the title doesn't; only fetch when needed.
  const branch = extractTicket(pr.title)
    ? undefined
    : gh(['api', `repos/${pr.repository.nameWithOwner}/pulls/${pr.number}`, '--jq', '.head.ref']).trim();
  items.push(toItem(pr, 'authored', date, time, extractTicket(pr.title, branch, pr.body)));
}

for (const pr of reviewed) {
  const submittedAt = gh([
    'api', '--paginate', `repos/${pr.repository.nameWithOwner}/pulls/${pr.number}/reviews`,
    '--jq', `.[] | select(.user.login == "${username}") | .submitted_at // empty`
  ]).split('\n').filter(Boolean);

  // Earliest review per local day: reviewing the same PR on two days is two days' work.
  const byDate = new Map();
  for (const local of submittedAt.map(ts => toLocal(ts, timeZone)).sort((a, b) => a.time.localeCompare(b.time))) {
    if (inRange(local.date) && !byDate.has(local.date)) byDate.set(local.date, local.time);
  }
  for (const [date, time] of byDate) {
    items.push(toItem(pr, 'reviewed', date, time, extractTicket(pr.title, pr.body)));
  }
}

items.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

const unmappedRepos = [...new Set(items.filter(i => i.project === null).map(i => i.repo))].sort();

// One item per line: compact for an agent to read, still valid JSON.
console.log(`{
  "timeZone": ${JSON.stringify(timeZone)},
  "from": "${from}",
  "to": "${to}",
  "unmappedRepos": ${JSON.stringify(unmappedRepos)},
  "items": [
${items.map(i => `    ${JSON.stringify(i)}`).join(',\n')}
  ]
}`);

function toItem(pr, kind, date, time, ticket) {
  const repo = pr.repository.name;
  const mapping = repoCategories[repo];
  return {
    date,
    time,
    kind,
    repo,
    number: pr.number,
    project: mapping?.project ?? null,
    category: mapping?.category ?? null,
    ...(ticket && { ticket }),
    description: cleanTitle(pr.title),
    title: pr.title
  };
}
