import { parse, differenceInMinutes } from 'date-fns';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function calculateDuration(startTime, endTime) {
  const baseDate = '2026-01-01';
  const start = parse(`${baseDate} ${startTime}`, 'yyyy-MM-dd h:mm a', new Date());
  const end = parse(`${baseDate} ${endTime}`, 'yyyy-MM-dd h:mm a', new Date());
  const minutes = differenceInMinutes(end, start);
  return minutes / 60;
}

async function loadProjectsCategories() {
  try {
    const configPath = path.join(__dirname, '../../config/projects-categories.json');
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('Failed to load config/projects-categories.json: File not found');
    } else if (error instanceof SyntaxError) {
      throw new Error(`Failed to load config/projects-categories.json: Invalid JSON - ${error.message}`);
    } else {
      throw new Error(`Failed to load config/projects-categories.json: ${error.message}`);
    }
  }
}

function validateTask(task, lineNumber, projectsCategories) {
  const { project, category, description } = task;

  // Validate non-empty fields
  if (!project || project.trim() === '') {
    throw new Error(`Line ${lineNumber}: Project field cannot be empty`);
  }
  if (!category || category.trim() === '') {
    throw new Error(`Line ${lineNumber}: Category field cannot be empty`);
  }
  if (!description || description.trim() === '') {
    throw new Error(`Line ${lineNumber}: Description field cannot be empty`);
  }

  // Validate project exists in config
  if (!projectsCategories[project]) {
    throw new Error(`Line ${lineNumber}: Unknown project "${project}". Available projects: ${Object.keys(projectsCategories).join(', ')}`);
  }

  // Validate category exists for project
  const validCategories = projectsCategories[project];
  if (!validCategories.includes(category)) {
    throw new Error(`Line ${lineNumber}: Invalid category "${category}" for project "${project}". Valid categories: ${validCategories.join(', ')}`);
  }
}

export async function parseNoteFile(content) {
  const projectsCategories = await loadProjectsCategories();
  const lines = content.split('\n');
  const taskRegex = /- \[ \] (\d{1,2}:\d{2} [AP]M) - (\d{1,2}:\d{2} [AP]M) \| (.+)/;

  const tasks = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
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

      const task = {
        start,
        end,
        duration: calculateDuration(start, end),
        description,
        ticket,
        project,
        category,
        type: ticket ? 'ticket' : (isMeeting ? 'meeting' : 'other')
      };

      // Validate task
      validateTask(task, lineNumber, projectsCategories);

      tasks.push(task);
    }
  }

  return tasks;
}
