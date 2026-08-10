import { describe, expect, it } from 'vitest';
import { scheduleTasks, type CapacityDay, type SchedulableTask } from './scheduler';

const day = (date: string, hours: number): CapacityDay => ({ date, hours });

const task = (overrides: Partial<SchedulableTask> = {}): SchedulableTask => ({
  id: 't1', name: 'Task', priority: 'P2', estimateHours: 2, deadlineMode: 'Héritée', ...overrides,
});

describe('scheduleTasks', () => {
  it('places highest priority work in the earliest available capacity', () => {
    const result = scheduleTasks([task({ id: 'low', priority: 'P3' }), task({ id: 'high', priority: 'P0' })], [day('2026-08-03', 4)]);
    expect(result.tasks.map((item) => item.id)).toEqual(['high', 'low']);
    expect(result.tasks.map((item) => item.scheduledStart)).toEqual(['2026-08-03', '2026-08-03']);
  });

  it('splits work across days when a day has insufficient capacity', () => {
    const result = scheduleTasks([task({ estimateHours: 5 })], [day('2026-08-03', 3), day('2026-08-04', 3)]);
    expect(result.tasks[0].allocations).toEqual([{ date: '2026-08-03', hours: 3 }, { date: '2026-08-04', hours: 2 }]);
    expect(result.tasks[0].scheduledEnd).toBe('2026-08-04');
  });

  it('does not schedule fixed deadline work after its deadline and flags it at risk', () => {
    const result = scheduleTasks([task({ estimateHours: 5, deadlineMode: 'Fixe', dueDate: '2026-08-03' })], [day('2026-08-03', 3), day('2026-08-04', 4)]);
    expect(result.tasks[0].allocations).toEqual([{ date: '2026-08-03', hours: 3 }]);
    expect(result.tasks[0].atRisk).toBe(true);
    expect(result.unscheduledHours).toBe(2);
  });

  it('honors start-not-before and skips zero-capacity days', () => {
    const result = scheduleTasks([task({ startNotBefore: '2026-08-04' })], [day('2026-08-03', 8), day('2026-08-04', 0), day('2026-08-05', 3)]);
    expect(result.tasks[0].scheduledStart).toBe('2026-08-05');
  });
});
