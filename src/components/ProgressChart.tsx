interface Point {
  date: Date
  progress: number
}

/** 달성률 추이 라인 차트 — progressHistory 스냅샷 기반 (자체 SVG) */
export default function ProgressChart({ points }: { points: Point[] }) {
  if (points.length === 0) {
    return <div className="empty">아직 추이 데이터가 없습니다. 달성률이 바뀔 때마다 자동 기록됩니다.</div>
  }

  // 좌표 영역: x 40~300, y 18(100%)~129(0%)
  const X0 = 40
  const X1 = 300
  const yOf = (p: number) => 129 - (p / 100) * 111
  const xOf = (i: number) =>
    points.length === 1 ? (X0 + X1) / 2 : X0 + ((X1 - X0) * i) / (points.length - 1)

  const coords = points.map((pt, i) => `${xOf(i)},${yOf(pt.progress)}`)
  const last = points[points.length - 1]
  const lastX = xOf(points.length - 1)
  const lastY = yOf(last.progress)

  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`

  return (
    <svg
      viewBox="0 0 320 150"
      role="img"
      aria-label={`달성률 추이, 현재 ${last.progress}%`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {/* 그리드 */}
      {[
        { y: 18, label: '100' },
        { y: 73.5, label: '50' },
        { y: 129, label: '0' },
      ].map((g) => (
        <g key={g.y}>
          <line x1={X0 - 6} y1={g.y} x2={306} y2={g.y}
            stroke={g.y === 129 ? 'var(--baseline)' : 'var(--grid)'} strokeWidth="1" />
          <text x={X0 - 10} y={g.y + 3} textAnchor="end" fontSize="9" fill="var(--muted)">{g.label}</text>
        </g>
      ))}

      {/* 면적 + 선 */}
      {points.length > 1 && (
        <>
          <polygon
            points={`${coords.join(' ')} ${lastX},129 ${X0},129`}
            fill="var(--accent)" opacity="0.12"
          />
          <polyline
            points={coords.join(' ')}
            fill="none" stroke="var(--accent)" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </>
      )}

      {/* 끝점 강조 + 값 */}
      <circle cx={lastX} cy={lastY} r="4.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
      <text x={lastX} y={lastY - 9} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--ink)">
        {last.progress}%
      </text>

      {/* x축 날짜 (처음/끝) */}
      <text x={X0} y={144} textAnchor="middle" fontSize="9" fill="var(--muted)">{fmt(points[0].date)}</text>
      {points.length > 1 && (
        <text x={lastX} y={144} textAnchor="middle" fontSize="9" fill="var(--muted)">{fmt(last.date)}</text>
      )}
    </svg>
  )
}
