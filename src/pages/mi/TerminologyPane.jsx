import { useCallback, useEffect, useState } from 'react'
import { mi } from '../../api/mi/client'
import { Card, TextField, useToast } from '../../components/ui'
import { miErrorSentence } from '../../lib/miErrors'

function asList(res) {
  return res?.terms ?? res?.items ?? res?.terminology ?? (Array.isArray(res) ? res : [])
}

/**
 * Confirmed speech-correction glossary — not the people/products directory.
 * Pending alias decisions stay in Memory inbox.
 */
export default function TerminologyPane({ profileId }) {
  const toast = useToast()
  const [terms, setTerms] = useState([])
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [canonical, setCanonical] = useState('')
  const [kind, setKind] = useState('')
  const [aliases, setAliases] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await mi.listTerminology({ profileId })
      setTerms(asList(res))
      setErr(null)
    } catch (e) {
      setErr(miErrorSentence(e.code, e.message))
      setTerms([])
    }
  }, [profileId])

  useEffect(() => {
    void load()
  }, [load])

  const add = async () => {
    if (!canonical.trim()) {
      toast.push('err', 'Canonical term is required')
      return
    }
    setBusy(true)
    try {
      const aliasList = aliases
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
      const body = {
        profile_id: profileId,
        canonical_term: canonical.trim(),
        term: canonical.trim(),
      }
      if (kind.trim()) body.kind = kind.trim()
      if (aliasList.length) body.aliases = aliasList
      await mi.createTerminology(body)
      setCanonical('')
      setKind('')
      setAliases('')
      toast.ok('Terminology saved')
      await load()
    } catch (e) {
      toast.push('err', miErrorSentence(e.code, e.message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title="Terminology glossary"
      hint="Speech correction for STT → MoM. Raw transcript rows are never rewritten. Pending alias suggestions also appear in Memory inbox."
    >
      <p className="desc">
        Confirm pending aliases in the <strong>Memory inbox</strong> above — this card is the confirmed
        glossary and add path, not a second decision queue.
      </p>
      {err && <div className="probe err">{err}</div>}
      {!err && !terms.length && <p className="desc">No terminology entries yet.</p>}
      {!!terms.length && (
        <table className="data">
          <thead>
            <tr>
              <th>Canonical</th>
              <th>Kind</th>
              <th>Aliases</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {terms.map((t) => (
              <tr key={t.id || t.terminology_id || t.canonical_term}>
                <td>{t.canonical_term || t.term || t.name || '—'}</td>
                <td>{t.kind || '—'}</td>
                <td>
                  {Array.isArray(t.aliases)
                    ? t.aliases.map((a) => (typeof a === 'string' ? a : a.alias || a.alias_norm)).join(', ')
                    : t.alias || '—'}
                </td>
                <td>{t.status || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h3 className="section-sub">Add term</h3>
      <TextField label="Canonical term" value={canonical} onChange={setCanonical} />
      <TextField label="Kind (optional)" value={kind} onChange={setKind} placeholder="acronym | product | …" />
      <TextField
        label="Aliases (comma-separated)"
        value={aliases}
        onChange={setAliases}
        placeholder="foo, bar"
      />
      <button type="button" className="btn" disabled={busy} onClick={() => void add()}>
        Add terminology
      </button>
    </Card>
  )
}
