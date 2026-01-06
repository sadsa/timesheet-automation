const MEETING_KEYWORDS = ['MEETING', 'meeting', 'zoom', 'call', 'DSU', 'standup', 'sync'];
const EXCLUDE_KEYWORDS = ['lunch', 'break', 'Lunch', 'Break'];

function isMeeting(description) {
  return MEETING_KEYWORDS.some(keyword => description.includes(keyword));
}

function isExcluded(description) {
  return EXCLUDE_KEYWORDS.some(keyword => description.toLowerCase().includes(keyword.toLowerCase()));
}

export function filterBillableTasks(tasks) {
  return tasks
    .filter(task => !isExcluded(task.description))
    .map(task => {
      if (task.ticket) {
        return task;
      }
      if (isMeeting(task.description)) {
        return { ...task, type: 'meeting' };
      }
      return null;
    })
    .filter(task => task !== null);
}
