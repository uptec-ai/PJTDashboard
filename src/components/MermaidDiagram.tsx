import { useEffect, useState } from 'react'
import type { Mermaid } from 'mermaid'

let renderSeq = 0 // 렌더마다 고유 id — 같은 id 재사용 시 mermaid 내부 충돌 방지
let mermaidPromise: Promise<Mermaid> | null = null

/** mermaid는 용량이 커서 다이어그램이 실제로 필요할 때만 내려받는다 (초기 로딩 최적화) */
function loadMermaid(): Promise<Mermaid> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => {
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
      mermaid.initialize({
        startOnLoad: false,
        theme: dark ? 'dark' : 'neutral',
        fontFamily: 'system-ui, "Malgun Gothic", sans-serif',
        // 실패 시 mermaid가 "Syntax error in text..." 오류 그림을 DOM에 직접 그리는 것을 막고,
        // 아래 catch에서 원문을 보여주도록 한다.
        suppressErrorRendering: true,
      })
      return mermaid
    })
  }
  return mermaidPromise
}

/** Mermaid 코드 → 다이어그램. 코드가 잘못되면 원문을 그대로 보여준다. */
export default function MermaidDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const trimmed = code.trim()
    if (!trimmed) { setSvg(''); setFailed(true); return }

    let active = true
    setSvg('')
    setFailed(false)

    const id = `mmd-${Date.now().toString(36)}-${renderSeq++}`
    // 먼저 문법 검사 → 통과한 것만 렌더 (오류 그림이 끼어들 여지를 없앤다)
    loadMermaid()
      .then(async (mermaid) => {
        await mermaid.parse(trimmed)
        return mermaid.render(id, trimmed)
      })
      .then(({ svg: out }) => { if (active) setSvg(out) })
      .catch(() => { if (active) setFailed(true) })
      .finally(() => {
        // mermaid가 남긴 임시 노드 정리 (렌더 실패 시 잔여물이 화면에 남는 것 방지)
        document.getElementById(id)?.remove()
        document.getElementById(`d${id}`)?.remove()
      })

    return () => { active = false }
  }, [code])

  if (failed) {
    return (
      <>
        <p className="hint muted">다이어그램을 그릴 수 없어 원본 코드를 표시합니다.</p>
        <pre className="doc-body">{code}</pre>
      </>
    )
  }
  if (!svg) {
    return <div className="muted" style={{ fontSize: 12.5 }}>다이어그램 그리는 중…</div>
  }
  return <div className="mermaid-box" dangerouslySetInnerHTML={{ __html: svg }} />
}
