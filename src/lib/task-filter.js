export function filterBillableTasks(tasks) {
  return tasks.filter(task => task.ticket !== null);
}
