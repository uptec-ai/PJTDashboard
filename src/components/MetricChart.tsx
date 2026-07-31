import { sortPoints } from '../lib/metrics'
import type { MetricPoint } from '../types'

/** 월별 지표 막대 차트 (최근 12개월, 자체 SVG) */
export default function MetricChart({ points, unit }: { points: MetricPoint[]; unit: string }) {
  const data = sortPoints(points).slice(-12)
  if (data.length === 0) {
    return <div className="empty">아직 기록된 값이 없습니다.</div>
  }

  const max = Math.max(...data.map((p) => p.value), 0)
  const top = max > 0 ? max * 1.15 : 1

  // 좌표 영역: x 40~306, y 16(top)~129(0)
  const X0 = 40
  const X1 = 306
  const plotW = X1 - X0
  const slot = plotW / data.length
  const barW = Math.min(Math.max(slot - 4, 4), 34)
  const yOf = (v: number) => 129 - (v / top) * 113

  const fmtMonth = (m: string) => `${Number(m.slice(5, 7))}월`
  const fmtVal = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
  const last = data[data.length - 1]

  return (
    <svg
      viewBox="0 0 320 150"
      role="img"
      aria-label={`월별 지표, 최근 ${fmtMonth(last.month)} ${fmtVal(last.value)}${unit}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {/* y 그리드 (절반·최대) */}
      {[top / 2, top].map((v) => (
        <g key={v}>
          <line x1={X0 - 6} y1={yOf(v)} x2={X1} y2={yOf(v)} stroke="var(--grid)" strokeWidth="1" />
          <text x={X0 - 10} y={yOf(v) + 3} textAnchor="end" fontSize="9" fill="var(--muted)">
            {fmtVal(Math.round(v * 10) / 10)}
          </text>
        </g>
      ))}
      <line x1={X0 - 6} y1={129} x2={X1} y2={129} stroke="var(--baseline)" strokeWidth="1" />

      {/* 막대 */}
      {data.map((p, i) => {
        const x = X0 + slot * i + (slot - barW) / 2
        const y = yOf(p.value)
        const h = Math.max(129 - y, 1)
        const isLast = i === data.length - 1
        return (
          <g key={p.month}>
            <rect
              x={x} y={y} width={barW} height={h} rx="2"
              fill="var(--accent)" opacity={isLast ? 1 : 0.55}
            >
              <title>{`${p.month} · ${fmtVal(p.value)}${unit}`}</title>
            </rect>
            {isLast && (
              <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--ink)">
                {fmtVal(p.value)}
              </text>
            )}
          </g>
        )
      })}

      {/* x 라벨 (처음/끝) */}
      <text x={X0 + slot / 2} y={144} textAnchor="middle" fontSize="9" fill="var(--muted)">
        {fmtMonth(data[0].month)}
      </text>
      {data.length > 1 && (
        <text x={X0 + slot * (data.length - 0.5)} y={144} textAnchor="middle" fontSize="9" fill="var(--muted)">
          {fmtMonth(last.month)}
        </text>
      )}
    </svg>
  )
}
