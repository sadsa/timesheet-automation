const MEETING_KEYWORDS = ['MEETING', 'meeting', 'zoom', 'call', 'DSU', 'standup', 'sync'];

function isMeeting(description) {
  return MEETING_KEYWORDS.some(keyword => description.includes(keyword));
}

export function filterBillableTasks(tasks) {
  return tasks
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
