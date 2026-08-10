export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export interface CapacityDay { date: string; hours: number }
export interface SchedulableTask {
  id: string;
  name: string;
  priority: Priority;
  estimateHours: number;
  deadlineMode: 'Fixe' | 'Jalon' | 'Héritée';
  dueDate?: string;
  startNotBefore?: string;
  blockedBy?: string[];
}
export interface Allocation { date: string; hours: number }
export interface ScheduledTask extends SchedulableTask {
  allocations: Allocation[];
  scheduledStart?: string;
  scheduledEnd?: string;
  atRisk: boolean;
  remainingHours: number;
}
export interface ScheduleResult { tasks: ScheduledTask[]; remainingCapacity: CapacityDay[]; unscheduledHours: number }
export interface PhaseSource { id: string; name: string; taskDates: string[]; milestoneDates: string[] }
export interface PhaseSpan { id: string; name: string; start?: string; end?: string; scheduled: boolean }
export function phaseTimeline(phases: PhaseSource[]): PhaseSpan[] {
  return phases.map((phase) => {
    const dates = [...phase.taskDates, ...phase.milestoneDates].filter(Boolean).sort();
    return { id: phase.id, name: phase.name, start: dates[0], end: dates.at(-1), scheduled: dates.length > 0 };
  });
}

export function compressChildrenToDeadline(input: { deadline: string; capacityHours: number; children: { id: string; estimateHours: number }[] }) {
  const cursor = new Date(`${input.deadline}T00:00:00`);
  let remaining = input.capacityHours;
  const result = input.children.map((child) => ({ id: child.id, allocations: [] as { date: string; hours: number }[] }));
  for (let i = input.children.length - 1; i >= 0; i--) {
    let hours = input.children[i].estimateHours;
    while (hours > 0) {
      const used = Math.min(hours, remaining);
      result[i].allocations.unshift({ date: cursor.toISOString().slice(0, 10), hours: used });
      hours -= used; remaining -= used;
      if (remaining === 0 && hours > 0) { cursor.setDate(cursor.getDate() - 1); remaining = input.capacityHours; }
    }
    if (i > 0) { cursor.setDate(cursor.getDate() - 1); remaining = input.capacityHours; }
  }
  return result;
}

const rank: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

export function scheduleTasks(tasks: SchedulableTask[], capacity: CapacityDay[]): ScheduleResult {
  const days = capacity.map((day) => ({ ...day }));
  const scheduled: ScheduledTask[] = [];
  for (const source of [...tasks].sort((a, b) => rank[a.priority] - rank[b.priority])) {
    let remaining = Math.max(0, source.estimateHours);
    const allocations: Allocation[] = [];
    for (const day of days) {
      if (!remaining) break;
      if (source.startNotBefore && day.date < source.startNotBefore) continue;
      if (source.deadlineMode === 'Fixe' && source.dueDate && day.date > source.dueDate) break;
      const used = Math.min(day.hours, remaining);
      if (!used) continue;
      day.hours -= used;
      remaining -= used;
      allocations.push({ date: day.date, hours: used });
    }
    scheduled.push({
      ...source,
      allocations,
      scheduledStart: allocations[0]?.date,
      scheduledEnd: allocations.at(-1)?.date,
      atRisk: remaining > 0 || Boolean(source.dueDate && allocations.at(-1)?.date && allocations.at(-1)!.date > source.dueDate),
      remainingHours: remaining,
    });
  }
  return { tasks: scheduled, remainingCapacity: days, unscheduledHours: scheduled.reduce((sum, task) => sum + task.remainingHours, 0) };
}
