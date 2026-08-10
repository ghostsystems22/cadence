import { describe, expect, it } from 'vitest';
import { buildPlan, type PlanSettings, type PlanTask } from './planEngine';

const settings: PlanSettings = { defaultDayHours: 8, defaultTaskHours: 1, spillHorizonDays: 3 };
const template = [0, 8, 8, 8, 8, 8, 0];
const task = (overrides: Partial<PlanTask> = {}): PlanTask => ({
  id: 'task-1', name: 'Task', status: 'Backlog', priority: 'P2', createdAt: '2026-08-01', ...overrides,
});
const plan = (tasks: PlanTask[], capacity: Record<string, number> = {}, overrides: Partial<PlanSettings> = {}) =>
  buildPlan(tasks, capacity, template, { ...settings, ...overrides }, '2026-08-03');

describe('buildPlan', () => {
  it('fills a normal day with eligible work up to its capacity', () => {
    const result = plan([task({ id: 'a', estimatedHours: 3 }), task({ id: 'b', estimatedHours: 2 })]);
    expect(result[0]).toMatchObject({ day: '2026-08-03', capacityHours: 8, committedHours: 5, state: 'ok' });
    expect(result[0].items.map((item) => item.taskId)).toEqual(['a', 'b']);
  });

  it('defers a task whole instead of partially filling the remaining hour', () => {
    const result = plan([task({ id: 'first', estimatedHours: 7 }), task({ id: 'second', estimatedHours: 3 })]);
    expect(result[0].items.map((item) => item.taskId)).toEqual(['first']);
    expect(result[1].items).toEqual([expect.objectContaining({ taskId: 'second', costHours: 3, state: 'deferred', originalDay: '2026-08-03' })]);
  });

  it('cascades overflow chronologically across three days without reordering work', () => {
    const result = plan([task({ id: 'a', estimatedHours: 5 }), task({ id: 'b', estimatedHours: 5 }), task({ id: 'c', estimatedHours: 5 })]);
    expect(result.slice(0, 3).map((day) => day.items.map((item) => item.taskId))).toEqual([['a'], ['b'], ['c']]);
    expect(result[1].items[0]).toMatchObject({ state: 'deferred', originalDay: '2026-08-03' });
  });

  it('splits work larger than a day only across consecutive open days', () => {
    const result = plan([task({ id: 'large', estimatedHours: 12 })]);
    expect(result[0].items).toEqual([expect.objectContaining({ taskId: 'large', costHours: 8, totalCostHours: 12, state: 'split', segmentIndex: 1, segmentCount: 2 })]);
    expect(result[1].items).toEqual([expect.objectContaining({ taskId: 'large', costHours: 4, totalCostHours: 12, state: 'split', segmentIndex: 2, segmentCount: 2 })]);
  });

  it('keeps a pinned task on its day even when it exceeds capacity', () => {
    const result = plan([task({ id: 'pinned', estimatedHours: 10, pinnedDay: '2026-08-03' })]);
    expect(result[0]).toMatchObject({ committedHours: 10, state: 'over' });
    expect(result[0].items[0]).toMatchObject({ taskId: 'pinned', state: 'pinned' });
  });

  it('skips a closed day entirely', () => {
    const result = plan([task({ id: 'a', estimatedHours: 2 })], { '2026-08-03': 0 });
    expect(result[0]).toMatchObject({ capacityHours: 0, state: 'closed', items: [] });
    expect(result[1].items[0]).toMatchObject({ taskId: 'a', state: 'deferred', originalDay: '2026-08-03' });
  });

  it('charges an unestimated task at the configured default and marks it', () => {
    const result = plan([task({ id: 'unestimated' })]);
    expect(result[0].items[0]).toMatchObject({ taskId: 'unestimated', costHours: 1, isUnestimated: true });
  });

  it('marks work unplannable once the spill horizon is exhausted', () => {
    const result = plan([task({ id: 'stuck', estimatedHours: 2 })], { '2026-08-03': 0, '2026-08-04': 0, '2026-08-05': 0 }, { spillHorizonDays: 2 });
    expect(result.flatMap((day) => day.items).find((item) => item.taskId === 'stuck')).toMatchObject({ state: 'unplannable' });
  });

  it('orders overdue work then priority before due date and creation order', () => {
    const result = plan([
      task({ id: 'normal', estimatedHours: 8, priority: 'P2', dueDate: '2026-08-03' }),
      task({ id: 'urgent', estimatedHours: 1, priority: 'P0', dueDate: '2026-08-05' }),
      task({ id: 'overdue', estimatedHours: 1, priority: 'P3', dueDate: '2026-08-01' }),
    ]);
    expect(result[0].items.map((item) => item.taskId)).toEqual(['overdue', 'urgent']);
    expect(result[1].items[0]).toMatchObject({ taskId: 'normal', state: 'late' });
  });
});
