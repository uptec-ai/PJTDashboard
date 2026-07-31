import { useEffect, useId, useState } from 'react'
import mermaid from 'mermaid'

let initialized = false

function ensureInit() {
  if (initialized) return
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  mermaid.initialize({
    startOnLoad: false,
    theme: dark ? 'dark' : 'neutral',
    fontFamily: 'system-ui, "Malgun Gothic", sans-serif',
  })
  initialized = true
}

/** Mermaid 코드 → 다이어그램 렌더링. 코드가 잘못되면 원문을 그대로 보여준다. */
export default function MermaidDiagram({ code }: { code: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [svg, setSvg] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    setSvg('')
    setFailed(false)
    ensureInit()
    mermaid
      .render(`mmd${id}`, code)
      .then(({ svg: out }) => { if (active) setSvg(out) })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [code, id])

  if (failed) {
    return <pre className="doc-body">{code}</pre>
  }
  if (!svg) {
    return <div className="muted" style={{ fontSize: 12.5 }}>다이어그램 그리는 중…</div>
  }
  return <div className="mermaid-box" dangerouslySetInnerHTML={{ __html: svg }} />
}
