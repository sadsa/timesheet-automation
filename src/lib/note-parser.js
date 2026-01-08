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
      const afterPipe = match[3];

      // Split on pipe and trim all parts
      const parts = afterPipe.split('|').map(part => part.trim());

      let project = null;
      let category = null;
      let ticket = null;
      let description = null;

      // Detect format based on number of parts
      if (parts.length >= 3) {
        // NEW FORMAT: Project | Category | [Ticket |] Description
        project = parts[0];
        category = parts[1];

        if (parts.length === 3) {
          // 3 parts: Project | Category | Description (no ticket)
          description = parts[2];
          ticket = null;
        } else {
          // 4+ parts: Project | Category | Ticket | Description
          ticket = parts[2];
          description = parts[3];
        }
      } else {
        // OLD FORMAT: Just description after first pipe
        description = afterPipe;
        ticket = extractTicket(description);
        project = null;
        category = null;
      }

      tasks.push({
        start,
        end,
        duration: calculateDuration(start, end),
        description,
        ticket,
        project,
        category,
        type: ticket ? 'ticket' : 'other'
      });
    }
  }

  return tasks;
}
