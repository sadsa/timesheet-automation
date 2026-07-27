const MEETING_KEYWORDS = ['MEETING', 'meeting', 'zoom', 'call', 'DSU', 'standup', 'sync'];
const EXCLUDE_KEYWORDS = ['lunch', 'break', 'Lunch', 'Break'];

function isMeeting(task) {
  return MEETING_KEYWORDS.some(keyword => task.description.includes(keyword)) || 
         (task.category && task.category.toLowerCase() === 'meetings');
}

function isExcluded(description) {
  return EXCLUDE_KEYWORDS.some(keyword => description.toLowerCase().includes(keyword.toLowerCase()));
}

/**
 * A task written into a daily note is already a claim that the time was worked,
 * so everything is billable except lunch and breaks. A ticket number is not
 * required — real work (docs, CI fixes) often never gets one, and dropping it
 * here would silently reassign those hours to an unrelated ticket.
 * See docs/adr/0002-billable-work-needs-no-ticket.md
 */
export function filterBillableTasks(tasks) {
  return tasks
    .filter(task => !isExcluded(task.description))
    .map(task => {
      if (task.ticket) {
        return task;
      }
      if (isMeeting(task)) {
        return { ...task, type: 'meeting' };
      }
      return task;
    });
}
