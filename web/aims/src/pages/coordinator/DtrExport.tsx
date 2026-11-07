import { useEffect, useState } from 'react'
import { apiRequest, apiRequestBlob } from '../../services/apiClient'

type Term = { academic_year: string; semester: string }

export function DtrExport({ studentId }: { studentId: string }) {
  const [terms, setTerms] = useState<Term[]>([])
  const [selection, setSelection] = useState('')
  const [approvedOnly, setApprovedOnly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    setError('')
    apiRequest<{ items: Term[]; current: Term }>(`/api/v1/excel/export/dtr/terms?student_id=${encodeURIComponent(studentId)}`)
      .then(result => {
        if (!active) return
        setTerms(result.items)
        const current = result.items.find(term => term.academic_year === result.current.academic_year && term.semester === result.current.semester) ?? result.items[0]
        setSelection(current ? `${current.academic_year}|${current.semester}` : '')
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load semesters.') })
    return () => { active = false }
  }, [studentId, retry])

  async function download() {
    const [year, semester] = selection.split('|')
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const params = new URLSearchParams({ student_id: studentId, academic_year: year, semester, approved_only: String(approvedOnly) })
      const blob = await apiRequestBlob(`/api/v1/excel/export/dtr?${params}`)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `DTR_${year}_Sem${semester}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('DTR report downloaded.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not export DTR records.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="sr-export" aria-label="Export student DTR">
    <label>Export semester <select value={selection} disabled={busy || !terms.length} onChange={event => setSelection(event.target.value)}>
      {!terms.length && <option value="">Loading semesters…</option>}
      {terms.map(term => <option key={`${term.academic_year}|${term.semester}`} value={`${term.academic_year}|${term.semester}`}>AY {term.academic_year} · Semester {term.semester}</option>)}
    </select></label>
    <label><input type="checkbox" checked={approvedOnly} disabled={busy} onChange={event => setApprovedOnly(event.target.checked)} /> Approved entries only</label>
    <button type="button" disabled={busy || !selection} onClick={() => void download()}>{busy ? 'Exporting…' : 'Export Excel'}</button>
    <p>Approved hours match Internship Progress for the selected semester.</p>
    {error && <p className="sr-error" role="alert">{error} <button type="button" disabled={busy} onClick={() => setRetry(value => value + 1)}>Reload semesters</button></p>}
    {notice && <p role="status">{notice}</p>}
  </section>
}
