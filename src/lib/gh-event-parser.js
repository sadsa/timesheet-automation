const TICKET_RE = /ENTELECT-\d+/i;

function extractTicket(...strings) {
  for (const s of strings) {
    if (!s) continue;
    const match = s.match(TICKET_RE);
    if (match) return match[0].toUpperCase();
  }
  return null;
}

export function parseEvent(event) {
  const base = {
    time: event.created_at,
    repo: event.repo?.name ?? 'unknown',
    ticket: null,
    description: null,
    type: null,
  };

  switch (event.type) {
    case 'PushEvent': {
      const commits = event.payload?.commits ?? [];
      const messages = commits.map(c => c.message).join(' ');
      const ticket = extractTicket(messages, event.repo?.name);
      const description = commits.map(c => c.message.split('\n')[0]).join('; ');
      return { ...base, type: 'commit', ticket, description };
    }

    case 'PullRequestEvent': {
      const pr = event.payload?.pull_request;
      const ticket = extractTicket(pr?.title, pr?.head?.ref, pr?.body);
      const action = event.payload?.action;
      const description = `${action === 'closed' && pr?.merged ? 'Merged' : action} PR: ${pr?.title}`;
      return { ...base, type: 'pr', ticket, description };
    }

    case 'PullRequestReviewEvent': {
      const pr = event.payload?.pull_request;
      const ticket = extractTicket(pr?.title, pr?.head?.ref);
      const description = `Reviewed PR: ${pr?.title}`;
      return { ...base, type: 'review', ticket, description };
    }

    case 'IssueCommentEvent': {
      const issue = event.payload?.issue;
      const ticket = extractTicket(issue?.title, String(issue?.number ?? ''));
      const description = `Comment on: ${issue?.title}`;
      return { ...base, type: 'comment', ticket, description };
    }

    case 'PullRequestReviewCommentEvent': {
      const pr = event.payload?.pull_request;
      const ticket = extractTicket(pr?.title, pr?.head?.ref);
      const description = `Review comment on PR: ${pr?.title}`;
      return { ...base, type: 'review-comment', ticket, description };
    }

    default:
      return null;
  }
}

export function parseEvents(rawEvents) {
  return rawEvents
    .map(parseEvent)
    .filter(Boolean)
    .sort((a, b) => a.time.localeCompare(b.time));
}
