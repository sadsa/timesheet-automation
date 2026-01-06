export function parseNoteFile(content) {
  const lines = content.split('\n');
  const taskRegex = /- \[ \] (\d{1,2}:\d{2} [AP]M) - (\d{1,2}:\d{2} [AP]M) \| (.+)/;

  const tasks = [];
  for (const line of lines) {
    const match = line.match(taskRegex);
    if (match) {
      tasks.push({
        start: match[1],
        end: match[2],
        description: match[3]
      });
    }
  }

  return tasks;
}
