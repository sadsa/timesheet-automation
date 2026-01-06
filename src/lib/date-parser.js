import { eachDayOfInterval, parseISO, format, subWeeks, startOfWeek, endOfWeek } from 'date-fns';

export function parseDateInput(input) {
  if (input === 'last') {
    const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
    const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
    const dates = eachDayOfInterval({ start: lastWeekStart, end: lastWeekEnd });
    return dates.map(date => format(date, 'yyyy-MM-dd'));
  }

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
