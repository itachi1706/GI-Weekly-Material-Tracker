import { useMemo, useState } from 'react'
import { diffLines, type Change } from 'diff'
import type { CommitPreview as Preview } from '@shared/types'

interface Props {
  preview: Preview
  onApply: () => void
  onBack: () => void
  onDiscard: () => void
  applying: boolean
  error: string | null
}

interface Row {
  id: number
  type: 'add' | 'del' | 'ctx' | 'gap'
  text: string
}

const CONTEXT = 3

const DIFF_GUTTER: Record<string, string> = { add: '+', del: '-' }

/** Rows for one diff part: changed lines verbatim; long unchanged runs trimmed to CONTEXT lines. */
function partToRows(part: Change, i: number, partCount: number): Omit<Row, 'id'>[] {
  const lines = part.value.replace(/\n$/, '').split('\n')
  if (part.added || part.removed) {
    const type = part.added ? 'add' : 'del'
    return lines.map((text) => ({ type, text }))
  }
  // unchanged: keep CONTEXT lines adjacent to a change, collapse the middle
  if (lines.length <= CONTEXT * 2) return lines.map((text) => ({ type: 'ctx', text }))
  const isFirst = i === 0
  const isLast = i === partCount - 1
  const rows: Omit<Row, 'id'>[] = []
  if (!isFirst) for (const l of lines.slice(0, CONTEXT)) rows.push({ type: 'ctx', text: l })
  rows.push({ type: 'gap', text: `… ${lines.length - (isFirst ? CONTEXT : CONTEXT * 2)} unchanged lines …` })
  if (!isLast) for (const l of lines.slice(-CONTEXT)) rows.push({ type: 'ctx', text: l })
  return rows
}

/** Build a compact diff: changed lines plus a few context lines, collapsing long unchanged runs. */
function buildRows(before: string, after: string): Row[] {
  const parts = diffLines(before, after)
  return parts.flatMap((part, i) => partToRows(part, i, parts.length)).map((r, i) => ({ ...r, id: i }))
}

export default function CommitPreview({
  preview,
  onApply,
  onBack,
  onDiscard,
  applying,
  error
}: Readonly<Props>) {
  const rows = useMemo(() => buildRows(preview.before, preview.after), [preview])
  const [showFull, setShowFull] = useState(false)
  const fullRows = useMemo<Row[]>(
    () =>
      showFull
        ? preview.after
            .replace(/\n$/, '')
            .split('\n')
            .map((text, i) => ({ id: i, type: 'ctx' as const, text }))
        : [],
    [showFull, preview]
  )

  const blocked = Boolean(preview.formattingDriftWarning)

  return (
    <div className="preview">
      <header className="preview-head">
        <h2>Preview changes</h2>
        <code className="preview-file">{preview.file}</code>
      </header>

      {preview.imageAction && (
        <div className="preview-image-action">
          <strong>Image{preview.imageAction.includes('\n') ? 's' : ''}:</strong>
          {preview.imageAction.split('\n').filter(Boolean).map((line) => (
            <div key={line} className="preview-image-action-line">{line}</div>
          ))}
        </div>
      )}

      {blocked && <div className="preview-block">{preview.formattingDriftWarning}</div>}
      {error && <div className="preview-block">{error}</div>}

      <div className="diff">
        {(showFull ? fullRows : rows).map((r) => (
          <div key={r.id} className={`diff-line diff-${r.type}`}>
            <span className="diff-gutter">{DIFF_GUTTER[r.type] ?? ''}</span>
            <span className="diff-text">{r.text}</span>
          </div>
        ))}
      </div>

      <button type="button" className="btn-link" onClick={() => setShowFull((s) => !s)}>
        {showFull ? 'Show diff only' : 'Show full file'}
      </button>

      <footer className="preview-actions">
        <button type="button" className="btn-primary" onClick={onApply} disabled={applying || blocked}>
          {applying ? 'Applying…' : 'Apply'}
        </button>
        <button type="button" className="btn-secondary" onClick={onBack} disabled={applying}>
          Back to edit
        </button>
        <button type="button" className="btn-link" onClick={onDiscard} disabled={applying}>
          Discard
        </button>
      </footer>
    </div>
  )
}
