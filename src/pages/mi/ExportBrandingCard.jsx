import { useEffect, useState } from 'react'
import { mi } from '../../api/mi/client'
import { Card, TextField, useToast } from '../../components/ui'
import { miErrorSentence } from '../../lib/miErrors'

// Mirrors the server's ValidateExportBranding limits (MI.40); the server re-checks.
const MAX_LOGO_BYTES = 200 * 1024
const MAX_W = 1000
const MAX_H = 400

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

function imageSize(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => reject(new Error('unreadable image'))
    img.src = src
  })
}

/**
 * Company name, footer text and logo printed on every exported MoM (PDF, Word,
 * Markdown). Read live at export time, so it applies to every meeting of this profile.
 */
export default function ExportBrandingCard({ profileId }) {
  const toast = useToast()
  const [saved, setSaved] = useState(null)
  const [form, setForm] = useState({ company_name: '', footer_text: '', logo_png_base64: '' })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    mi.getExportBranding(profileId)
      .then((b) => {
        if (!live) return
        const v = { company_name: b.company_name ?? '', footer_text: b.footer_text ?? '', logo_png_base64: b.logo_png_base64 ?? '' }
        setSaved(v)
        setForm(v)
      })
      .catch((e) => live && setErr(miErrorSentence(e.code, e.message)))
    return () => {
      live = false
    }
  }, [profileId])

  const dirty = saved && JSON.stringify(saved) !== JSON.stringify(form)

  const pickLogo = async (file) => {
    setErr(null)
    if (!file) return
    if (file.type !== 'image/png') {
      setErr('The logo must be a PNG file.')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setErr(`The logo is ${Math.round(file.size / 1024)} KB; the limit is 200 KB.`)
      return
    }
    try {
      const url = await readAsDataURL(file)
      const { w, h } = await imageSize(url)
      if (w > MAX_W || h > MAX_H) {
        setErr(`The logo is ${w}×${h} px; the limit is ${MAX_W}×${MAX_H}.`)
        return
      }
      setForm((f) => ({ ...f, logo_png_base64: url.slice(url.indexOf(',') + 1) }))
    } catch {
      setErr('That file could not be read as an image.')
    }
  }

  const save = async () => {
    setBusy(true)
    setErr(null)
    try {
      const b = await mi.putExportBranding(profileId, form)
      const v = { company_name: b.company_name ?? '', footer_text: b.footer_text ?? '', logo_png_base64: b.logo_png_base64 ?? '' }
      setSaved(v)
      setForm(v)
      toast.ok('Export branding saved')
    } catch (e) {
      setErr(e.code === 'invalid_branding' ? e.message.replace(/^invalid_branding: /, '') : miErrorSentence(e.code, e.message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title="Export branding"
      hint="Printed on every downloaded MoM (PDF, Word, Markdown) for this profile's meetings, including older ones."
    >
      {err && <div className="probe err">{err}</div>}
      {!saved && !err && <p className="desc">Loading…</p>}
      {saved && (
        <>
          <TextField
            label="Company name"
            value={form.company_name}
            onChange={(v) => setForm((f) => ({ ...f, company_name: v }))}
            placeholder="Coral Telecom"
          />
          <TextField
            label="Footer text"
            value={form.footer_text}
            onChange={(v) => setForm((f) => ({ ...f, footer_text: v }))}
            placeholder="Confidential — internal use"
          />
          <div className="field">
            <label htmlFor={`logo-${profileId}`}>Logo (PNG, up to 200 KB and 1000×400 px)</label>
            <div className="branding-logo">
              {form.logo_png_base64 ? (
                <img src={`data:image/png;base64,${form.logo_png_base64}`} alt="Current logo" />
              ) : (
                <span className="desc">No logo</span>
              )}
              <input
                id={`logo-${profileId}`}
                type="file"
                accept="image/png"
                onChange={(e) => {
                  void pickLogo(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              {form.logo_png_base64 && (
                <button type="button" className="btn ghost sm" onClick={() => setForm((f) => ({ ...f, logo_png_base64: '' }))}>
                  Remove logo
                </button>
              )}
            </div>
          </div>
          <div className="actions tight">
            <button type="button" className="btn sm" disabled={!dirty || busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save branding'}
            </button>
            {dirty && <span className="desc">Unsaved branding changes</span>}
          </div>
        </>
      )}
    </Card>
  )
}
