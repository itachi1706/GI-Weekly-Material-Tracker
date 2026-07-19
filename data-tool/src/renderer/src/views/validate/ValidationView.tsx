import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatReport, type Finding, type ValidationReport } from '@shared/validate'

/** Read-only dataset validation, run in-app via the `validate:run` IPC (same rules as `npm run validate`). */
export default function ValidationView({ rootPath }: { rootPath: string }) {
  const [report, setReport] = useState<ValidationReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [severity, setSeverity] = useState<'all' | 'ERROR' | 'WARN'>('all')
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    setCopied(false)
    try {
      setReport(await window.api.validate.run(rootPath))
    } catch (e) {
      setError((e as Error).message)
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [rootPath])

  // Run once on mount / when the dataset folder changes.
  useEffect(() => {
    void run()
  }, [run])

  const categories = useMemo(() => {
    if (!report) return []
    return [...new Set(report.findings.map((f) => f.category))].sort((a, b) => a.localeCompare(b))
  }, [report])

  const filtered = useMemo(() => {
    if (!report) return []
    const q = query.trim().toLowerCase()
    return report.findings.filter(
      (f) =>
        (severity === 'all' || f.severity === severity) &&
        (!category || f.category === category) &&
        (!q || `${f.file} ${f.key} ${f.detail}`.toLowerCase().includes(q))
    )
  }, [report, severity, category, query])

  // Group the filtered findings by category, ERRORs first (mirrors the CLI report ordering).
  const groups = useMemo(() => {
    const byCat = new Map<string, Finding[]>()
    for (const f of filtered) {
      if (!byCat.has(f.category)) byCat.set(f.category, [])
      byCat.get(f.category)!.push(f)
    }
    const sevOf = (c: string): number => (byCat.get(c)!.some((f) => f.severity === 'ERROR') ? 0 : 1)
    return [...byCat.keys()]
      .sort((a, b) => sevOf(a) - sevOf(b) || a.localeCompare(b))
      .map((cat) => ({ cat, items: byCat.get(cat)! }))
  }, [filtered])

  const copyReport = async (): Promise<void> => {
    if (!report) return
    await navigator.clipboard.writeText(formatReport(report.findings, report.fileCount))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="mat-list validate-view">
      <header className="mat-list-head">
        <div>
          <h2>Validation</h2>
          <p className="muted validate-sub">
            Read-only scan for data issues — formatting drift, broken references, bad images, phase/map
            mismatches, markup leakage. Fix findings in the entity editors, then re-run.
          </p>
        </div>
        <div className="validate-actions">
          <button type="button" className="btn-secondary" onClick={copyReport} disabled={!report || loading}>
            {copied ? 'Copied!' : 'Copy report'}
          </button>
          <button type="button" className="btn-primary" onClick={() => void run()} disabled={loading}>
            {loading ? 'Scanning…' : report ? 'Re-run' : 'Run validation'}
          </button>
        </div>
      </header>

      {error && <div className="form-errors">Validation failed: {error}</div>}

      {report && (
        <>
          <div className="validate-summary">
            <span className={`pill ${report.errorCount ? 'pill-bad' : 'pill-ok'}`}>
              {report.errorCount} error{report.errorCount === 1 ? '' : 's'}
            </span>
            <span className={`pill ${report.warnCount ? 'pill-warn' : 'pill-ok'}`}>
              {report.warnCount} warning{report.warnCount === 1 ? '' : 's'}
            </span>
            <span className="muted">across {report.fileCount} files</span>
            {report.errorCount === 0 && report.warnCount === 0 && (
              <span className="validate-clean">✓ Dataset is clean</span>
            )}
          </div>

          <div className="mat-list-filters">
            <input
              type="search"
              placeholder="Search file, key or detail…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}>
              <option value="all">All severities</option>
              <option value="ERROR">Errors</option>
              <option value="WARN">Warnings</option>
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="mat-list-count">
              {filtered.length} of {report.findings.length}
            </span>
          </div>

          <div className="validate-groups">
            {groups.map(({ cat, items }) => {
              const isError = items.some((f) => f.severity === 'ERROR')
              return (
                <section key={cat} className="validate-group">
                  <h3 className="validate-group-head">
                    <span className={`pill ${isError ? 'pill-bad' : 'pill-warn'}`}>
                      {isError ? 'ERROR' : 'WARN'}
                    </span>
                    <span className="validate-cat">{cat}</span>
                    <span className="muted">({items.length})</span>
                  </h3>
                  <ul className="validate-list">
                    {items.map((f, i) => (
                      <li key={`${f.file}:${f.key}:${i}`} className="validate-item">
                        <div className="validate-loc">
                          <span className="validate-file">{f.file}</span>
                          {f.key && <span className="validate-key">{f.key}</span>}
                        </div>
                        <div className="validate-detail">{f.detail}</div>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
            {report.findings.length > 0 && filtered.length === 0 && (
              <p className="muted">No findings match the current filters.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
