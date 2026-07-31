/** 주간 활동 히트맵 — 일정/이슈/문서/연동 기록을 날짜별로 집계 (최근 12주, 자체 CSS) */

const WEEKS = 12
const DAY_LABELS = ['월', '', '수', '', '금', '', '']

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ActivityHeatmap({ dates }: { dates: Date[] }) {
  // 날짜별 활동 수 집계
  const counts = new Map<string, number>()
  for (const d of dates) {
    const k = dayKey(d)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }

  // 이번 주 월요일 기준으로 12주 전 월요일부터 시작
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const monday = new Date(today)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)) // 이번 주 월요일
  const start = new Date(monday)
  start.setDate(start.getDate() - (WEEKS - 1) * 7)

  const levelOf = (n: number) => (n <= 0 ? 0 : Math.min(n, 5))

  // 열 = 주, 행 = 요일(월~일)
  const cells: { key: string; level: number; label: string; future: boolean }[][] = []
  for (let day = 0; day < 7; day++) {
    const row = []
    for (let week = 0; week < WEEKS; week++) {
      const d = new Date(start)
      d.setDate(d.getDate() + week * 7 + day)
      const k = dayKey(d)
      const n = counts.get(k) ?? 0
      row.push({
        key: k,
        level: levelOf(n),
        label: `${k} · 활동 ${n}건`,
        future: d.getTime() > today.getTime(),
      })
    }
    cells.push(row)
  }

  return (
    <div className="heat">
      <div className="heat-days">
        {DAY_LABELS.map((l, i) => <span key={i}>{l}</span>)}
      </div>
      <div>
        <div className="heat-grid" style={{ gridTemplateColumns: `repeat(${WEEKS}, 16px)` }}>
          {cells.map((row) =>
            row.map((c) => (
              <span
                key={c.key}
                className={`hc ${c.level > 0 ? `h${c.level}` : ''} ${c.future ? 'h-future' : ''}`}
                title={c.future ? '' : c.label}
              />
            )),
          )}
        </div>
        <div className="heat-legend">
          적음 <i className="h1" /><i className="h2" /><i className="h3" /><i className="h4" /><i className="h5" /> 많음
        </div>
      </div>
    </div>
  )
}
