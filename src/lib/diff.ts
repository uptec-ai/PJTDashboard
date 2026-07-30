/**
 * 줄 단위 diff (라이브러리 없이 자체 구현)
 * - 공통 앞/뒤 구간을 먼저 제거한 뒤 가운데 부분만 LCS(최장 공통 부분열) 계산
 * - 가운데 부분이 너무 크면(비교 비용 초과) 단순 삭제+추가로 표시
 */

export interface DiffOp {
  type: 'same' | 'add' | 'del'
  line: string
}

const MAX_CELLS = 1_000_000 // LCS 계산 상한 (중간부 n*m)

export function diffLines(oldText: string, newText: string): DiffOp[] {
  const a = oldText.split('\n')
  const b = newText.split('\n')

  // 공통 앞부분
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  // 공통 뒷부분
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }

  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)

  const ops: DiffOp[] = []
  for (let i = 0; i < start; i++) ops.push({ type: 'same', line: a[i] })

  if (midA.length * midB.length > MAX_CELLS) {
    // 너무 큰 문서: 정밀 비교 생략
    for (const line of midA) ops.push({ type: 'del', line })
    for (const line of midB) ops.push({ type: 'add', line })
  } else {
    ops.push(...lcsDiff(midA, midB))
  }

  for (let i = endA; i < a.length; i++) ops.push({ type: 'same', line: a[i] })
  return ops
}

/** 표준 LCS 동적계획법 + 역추적 */
function lcsDiff(a: string[], b: string[]): DiffOp[] {
  const n = a.length
  const m = b.length
  if (n === 0) return b.map((line) => ({ type: 'add' as const, line }))
  if (m === 0) return a.map((line) => ({ type: 'del' as const, line }))

  // dp[i][j] = a[i:], b[j:]의 LCS 길이
  const width = m + 1
  const dp = new Int32Array((n + 1) * width)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * width + j] =
        a[i] === b[j]
          ? dp[(i + 1) * width + (j + 1)] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + (j + 1)])
    }
  }

  const ops: DiffOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: 'same', line: a[i] })
      i++
      j++
    } else if (dp[(i + 1) * width + j] >= dp[i * width + (j + 1)]) {
      ops.push({ type: 'del', line: a[i] })
      i++
    } else {
      ops.push({ type: 'add', line: b[j] })
      j++
    }
  }
  while (i < n) ops.push({ type: 'del', line: a[i++] })
  while (j < m) ops.push({ type: 'add', line: b[j++] })
  return ops
}

export function diffCounts(ops: DiffOp[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const op of ops) {
    if (op.type === 'add') added++
    else if (op.type === 'del') removed++
  }
  return { added, removed }
}
