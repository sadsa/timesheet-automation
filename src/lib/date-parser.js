import { eachDayOfInterval, parseISO, format } from 'date-fns';

export function parseDateInput(input) {
  if (input.includes(':')) {
    const [start, end] = input.split(':');
    const dates = eachDayOfInterval({
      start: parseISO(start),
      end: parseISO(end)
    });
    return dates.map(date => format(date, 'yyyy-MM-dd'));
  }
  return [input];
}
