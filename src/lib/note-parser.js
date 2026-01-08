import { parse, differenceInMinutes } from 'date-fns';

function calculateDuration(startTime, endTime) {
  const baseDate = '2026-01-01';
  const start = parse(`${baseDate} ${startTime}`, 'yyyy-MM-dd h:mm a', new Date());
  const end = parse(`${baseDate} ${endTime}`, 'yyyy-MM-dd h:mm a', new Date());
  const minutes = differenceInMinutes(end, start);
  return minutes / 60;
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

      // NEW FORMAT REQUIRED: Project | Category | [Ticket |] Description
      if (parts.length < 3) {
        throw new Error(`Invalid task format: "${line}". Expected format: "Project | Category | [Ticket |] Description"`);
      }

      const project = parts[0];
      const category = parts[1];

      // Validate if parts[2] is a ticket using ENTELECT-XXXX pattern
      const ticketPattern = /^ENTELECT-\d+$/;
      const hasTicket = parts.length >= 4 && ticketPattern.test(parts[2]);

      let ticket = null;
      let description = null;

      if (hasTicket) {
        // 4+ parts with valid ticket: Project | Category | Ticket | Description
        ticket = parts[2];
        description = parts[3];
      } else {
        // 3 parts (no ticket): Project | Category | Description
        description = parts[2];
        ticket = null;
      }

      // Detect meeting type from description keywords
      const meetingKeywords = /MEETING|zoom|call|DSU|standup|sync/i;
      const isMeeting = meetingKeywords.test(description);

      tasks.push({
        start,
        end,
        duration: calculateDuration(start, end),
        description,
        ticket,
        project,
        category,
        type: ticket ? 'ticket' : (isMeeting ? 'meeting' : 'other')
      });
    }
  }

  return tasks;
}
