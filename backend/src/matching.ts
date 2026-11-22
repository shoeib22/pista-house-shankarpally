/** Anything at or above this cost is "not allowed" (hard constraint violated). */
export const INF = 1e6;

/**
 * Minimum-cost assignment of rows (orders) to columns (riders) with the
 * Kuhn-Munkres (Hungarian) algorithm, O(n^2 * m). Works for rectangular
 * matrices: each row gets at most one column and each column at most one row.
 * Pairs whose cost is >= INF are never returned.
 */
export function hungarian(cost: number[][]): Map<number, number> {
  const rows = cost.length,
    cols = rows ? cost[0].length : 0;
  const result = new Map<number, number>();
  if (!rows || !cols) return result;
  // The classic formulation needs rows <= cols; transpose otherwise.
  const flip = rows > cols;
  const n = flip ? cols : rows,
    m = flip ? rows : cols;
  const a = (i: number, j: number) => (flip ? cost[j][i] : cost[i][j]);
  const u = new Array<number>(n + 1).fill(0),
    v = new Array<number>(m + 1).fill(0),
    p = new Array<number>(m + 1).fill(0),
    way = new Array<number>(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(m + 1).fill(Infinity),
      used = new Array<boolean>(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity,
        j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = a(i0 - 1, j - 1) - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  for (let j = 1; j <= m; j++) {
    if (!p[j]) continue;
    const r = flip ? j - 1 : p[j] - 1,
      c = flip ? p[j] - 1 : j - 1;
    if (cost[r][c] < INF) result.set(r, c);
  }
  return result;
}

/**
 * Cheap fallback when the matrix is too large for the latency budget: take the
 * lowest-cost valid pairs first. Rows are expected to be ordered by priority
 * (oldest order first) and are served in that order.
 */
export function greedy(cost: number[][]): Map<number, number> {
  const result = new Map<number, number>(),
    usedCols = new Set<number>();
  for (let r = 0; r < cost.length; r++) {
    let best = -1;
    for (let c = 0; c < cost[r].length; c++) {
      if (usedCols.has(c) || cost[r][c] >= INF) continue;
      if (best < 0 || cost[r][c] < cost[r][best]) best = c;
    }
    if (best >= 0) {
      result.set(r, best);
      usedCols.add(best);
    }
  }
  return result;
}

/** Hungarian for normal sizes, greedy beyond the latency budget. */
export function assignBest(cost: number[][], limit = 80) {
  const big = cost.length > limit || (cost[0]?.length ?? 0) > limit;
  return {
    pairs: big ? greedy(cost) : hungarian(cost),
    method: big ? "greedy" : "hungarian",
  } as const;
}
