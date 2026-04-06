/**
 * 固定上限的并发池：同一时刻最多 `limit` 个 iterator 在飞行中。
 */
export async function mapLimit<T>(
  items: readonly T[],
  limit: number,
  iterator: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) return
  const n = Math.min(Math.max(1, limit), items.length)
  let next = 0
  const workers = Array.from({ length: n }, async () => {
    while (true) {
      const i = next++
      if (i >= items.length) break
      await iterator(items[i]!, i)
    }
  })
  await Promise.all(workers)
}
