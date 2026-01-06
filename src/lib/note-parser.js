import { parse, differenceInMinutes } from 'date-fns';

function calculateDuration(startTime, endTime) {
  const baseDate = '2026-01-01';
  const start = parse(`${baseDate} ${startTime}`, 'yyyy-MM-dd h:mm a', new Date());
  const end = parse(`${baseDate} ${endTime}`, 'yyyy-MM-dd h:mm a', new Date());
  const minutes = differenceInMinutes(end, start);
  return minutes / 60;
}

function extractTicket(description) {
  const ticketMatch = description.match(/ENTELECT-\d+/);
  return ticketMatch ? ticketMatch[0] : null;
}

export function parseNoteFile(content) {
  const lines = content.split('\n');
  const taskRegex = /- \[ \] (\d{1,2}:\d{2} [AP]M) - (\d{1,2}:\d{2} [AP]M) \| (.+)/;

  const tasks = [];
  for (const line of lines) {
    const match = line.match(taskRegex);
    if (match) {
      const start = match[1];
      const end = match[2];
      const description = match[3];
      const ticket = extractTicket(description);

      tasks.push({
        start,
        end,
        duration: calculateDuration(start, end),
        description,
        ticket,
        type: ticket ? 'ticket' : 'other'
      });
    }
  }

  return tasks;
}
