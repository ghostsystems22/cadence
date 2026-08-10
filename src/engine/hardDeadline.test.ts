import { describe, expect, it } from 'vitest';
import { compressChildrenToDeadline } from './scheduler';

describe('compressChildrenToDeadline', () => {
  it('packs children backwards into capacity before their parent hard deadline', () => {
    expect(compressChildrenToDeadline({ deadline: '2026-08-08', capacityHours: 6, children: [
      { id: 'a', estimateHours: 6 }, { id: 'b', estimateHours: 6 },
    ] })).toEqual([
      { id: 'a', allocations: [{ date: '2026-08-07', hours: 6 }] },
      { id: 'b', allocations: [{ date: '2026-08-08', hours: 6 }] },
    ]);
  });
});
