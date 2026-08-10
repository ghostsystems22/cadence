import { describe, expect, it } from 'vitest';
import { phaseTimeline } from './scheduler';

describe('phaseTimeline', () => {
  it('rolls a phase from the earliest task date to its milestone deadline', () => {
    const spans = phaseTimeline([
      { id: 'discovery', name: 'Discovery', taskDates: ['2026-08-04'], milestoneDates: ['2026-08-08'] },
      { id: 'delivery', name: 'Delivery', taskDates: [], milestoneDates: [] },
    ]);
    expect(spans).toEqual([
      { id: 'discovery', name: 'Discovery', start: '2026-08-04', end: '2026-08-08', scheduled: true },
      { id: 'delivery', name: 'Delivery', start: undefined, end: undefined, scheduled: false },
    ]);
  });
});
