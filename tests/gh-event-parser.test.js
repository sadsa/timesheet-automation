import { test } from 'node:test';
import assert from 'node:assert';
import { parseEvent, parseEvents } from '../src/lib/gh-event-parser.js';

function makeEvent(type, payload, repo = 'canva-vendors/onedrive-app', time = '2026-03-05T09:00:00Z') {
  return { type, payload, repo: { name: repo }, created_at: time };
}

test('parseEvent - PushEvent extracts ticket from commit message', () => {
  const event = makeEvent('PushEvent', {
    commits: [{ message: 'fix: ENTELECT-2018 resolve folder picker error' }],
  });
  const result = parseEvent(event);
  assert.strictEqual(result.type, 'commit');
  assert.strictEqual(result.ticket, 'ENTELECT-2018');
  assert.ok(result.description.includes('resolve folder picker error'));
});

test('parseEvent - PushEvent with no ticket returns null ticket', () => {
  const event = makeEvent('PushEvent', {
    commits: [{ message: 'chore: update deps' }],
  });
  const result = parseEvent(event);
  assert.strictEqual(result.ticket, null);
});

test('parseEvent - PushEvent handles null commit message without crashing', () => {
  const event = makeEvent('PushEvent', {
    commits: [{ message: null }, { message: 'ENTELECT-2099 real fix' }],
  });
  const result = parseEvent(event);
  assert.strictEqual(result.ticket, 'ENTELECT-2099');
});

test('parseEvent - PullRequestEvent extracts ticket from PR title', () => {
  const event = makeEvent('PullRequestEvent', {
    action: 'opened',
    pull_request: { title: 'ENTELECT-2068 fix publish button overlap', head: { ref: 'feature/fix' }, body: '' },
  });
  const result = parseEvent(event);
  assert.strictEqual(result.type, 'pr');
  assert.strictEqual(result.ticket, 'ENTELECT-2068');
});

test('parseEvent - PullRequestReviewEvent extracts ticket from branch name', () => {
  const event = makeEvent('PullRequestReviewEvent', {
    pull_request: { title: 'Fix export', head: { ref: 'ENTELECT-2099-fix-export' } },
  });
  const result = parseEvent(event);
  assert.strictEqual(result.type, 'review');
  assert.strictEqual(result.ticket, 'ENTELECT-2099');
});

test('parseEvent - IssueCommentEvent extracts ticket from issue title', () => {
  const event = makeEvent('IssueCommentEvent', {
    issue: { title: 'ENTELECT-1234 something broken', number: 42 },
  });
  const result = parseEvent(event);
  assert.strictEqual(result.type, 'comment');
  assert.strictEqual(result.ticket, 'ENTELECT-1234');
});

test('parseEvent - unknown event type returns null', () => {
  const event = makeEvent('WatchEvent', {});
  const result = parseEvent(event);
  assert.strictEqual(result, null);
});

test('parseEvents - filters nulls and sorts by time ascending', () => {
  const events = [
    makeEvent('PushEvent', { commits: [{ message: 'fix' }] }, 'repo', '2026-03-05T11:00:00Z'),
    makeEvent('WatchEvent', {}, 'repo', '2026-03-05T09:00:00Z'),
    makeEvent('PullRequestEvent', {
      action: 'opened',
      pull_request: { title: 'PR', head: { ref: 'branch' }, body: '' }
    }, 'repo', '2026-03-05T10:00:00Z'),
  ];
  const result = parseEvents(events);
  assert.strictEqual(result.length, 2);
  assert.ok(new Date(result[0].time) < new Date(result[1].time));
});
