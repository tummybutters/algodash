import { describe, it, expect } from 'vitest';
import { insertAt, reorderList } from '@/lib/newsletters/ordering';

describe('ordering helpers', () => {
    it('reorders items without mutating the original list', () => {
        const original = [1, 2, 3, 4];
        const result = reorderList(original, 0, 2);

        expect(result).toEqual([2, 3, 1, 4]);
        expect(original).toEqual([1, 2, 3, 4]);
    });

    it('inserts items at a specific index', () => {
        const original = ['a', 'b', 'c'];
        const result = insertAt(original, 'x', 1);

        expect(result).toEqual(['a', 'x', 'b', 'c']);
        expect(original).toEqual(['a', 'b', 'c']);
    });
});
