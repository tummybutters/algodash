export function reorderList<T>(list: T[], fromIndex: number, toIndex: number): T[] {
    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
}

export function insertAt<T>(list: T[], item: T, index: number): T[] {
    const next = [...list];
    next.splice(index, 0, item);
    return next;
}
