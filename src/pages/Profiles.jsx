import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCatalog } from '../api/catalog'
import { api, getTenant } from '../api/client'
import {
  Card,
  CheckField,
  ChipMulti,
  Empty,
  Field,
  NumberField,
  SelectField,
  StringList,
  Section,
  TextField,
  useAsync,
  useToast,
} from '../components/ui'
import { validateProfile } from '../lib/profileValidate'
/**
 * Full profile document editor.
 *
 * The old console only exposed modes, sample rate, one persona voice, three
 * routers and the speak_* block — so publishing from it silently dropped
 * `language`, `skills`, `rules`, `playbook`, `response`, `fallback`,
 * `grounding`, `knowledge`, `templates` and `analytics`. Every section of
 * internal/profile/validate.go Document is editable here, and anything this UI
 * does not model is preserved through the Advanced JSON escape hatch.
 */

const emptyDoc = (id) => ({
  id,
  tenant_id: getTenant(),
  metadata: {
    display_name: '',
    family: '',
  },
  audio: {
    canonical_sample_rate_hz: 16000,
    frame_ms: 20,
  },
  modes: {
    listen: true,
    speak: true,
    think: true,
    talk: true,
  },
  persona: {
    voice: {},
  },
  language: {
    behaviour: 'none',
    primary: 'en-IN',
    allowed: ['en-IN'],
    auto_detect: true,
    mid_call_switch: false,
  },
  routers: {
    listen: {
      providers: [],
    },
    think: {
      providers: [],
    },
    speak: {
      providers: [],
    },
  },
  speak_render: 'configured',
  speak_canonical_locale: 'en-IN',
  speak_locale_strict: false,
  speak_allow_canonical_fallback: true,
})
export default function Profiles() {
  const { catalog, gateways, idsFor, reloadStatus } = useCatalog()
  const toast = useToast()
  const list = useAsync(() => api.listProfiles(), [])
  const [selected, setSelected] = useState('')
  const [doc, setDoc] = useState(null)
  const [version, setVersion] = useState(null)
  const [busy, setBusy] = useState(false)
  const [rawMode, setRawMode] = useState(false)
  const [rawText, setRawText] = useState('')
  const [rawErr, setRawErr] = useState('')
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const locales = catalog?.tts_locales_v1 ?? []
  const issues = useMemo(() => (doc ? validateProfile(doc, gateways) : []), [doc, gateways])
  const errors = issues.filter((i) => i.level === 'error')

  /** Shallow-merge a patch into the document. */
  const patch = useCallback((p) => {
    setDoc((d) =>
      d
        ? {
            ...d,
            ...p,
          }
        : d,
    )
  }, [])

  /** Merge into a nested object section without clobbering sibling keys. */
  const patchIn = useCallback((key, p) => {
    setDoc((d) =>
      d
        ? {
            ...d,
            [key]: {
              ...(d[key] ?? {}),
              ...p,
            },
          }
        : d,
    )
  }, [])
  const loadProfile = useCallback(
    async (id) => {
      setSelected(id)
      setVersion(null)
      try {
        const v = await api.getProfileVersion(id, 'latest')
        const got = v.document ?? v.doc ?? null
        setDoc(
          got
            ? {
                ...got,
                id,
              }
            : emptyDoc(id),
        )
        setVersion(v.version ?? null)
      } catch (e) {
        // A profile with no published version yet is normal.
        if (e.status === 404) {
          setDoc(emptyDoc(id))
          return
        }
        toast.fail(e, 'Load profile')
      }
    },
    [toast],
  )
  useEffect(() => {
    if (doc) setRawText(JSON.stringify(doc, null, 2))
  }, [doc])

  // With a single profile there is nothing to choose — open it straight away.
  useEffect(() => {
    const only = list.data?.profiles
    if (!selected && only?.length === 1) void loadProfile(only[0].id)
  }, [list.data, selected, loadProfile])
  const createProfile = async () => {
    const id = newId.trim()
    if (!id) {
      toast.push('err', 'Profile id required')
      return
    }
    setBusy(true)
    try {
      await api.createProfile({
        id,
        tenant_id: getTenant(),
        display_name: newName.trim(),
      })
      toast.ok(`Created ${id}`)
      setNewId('')
      setNewName('')
      await list.reload()
      await loadProfile(id)
    } catch (e) {
      toast.fail(e, 'Create profile')
    } finally {
      setBusy(false)
    }
  }
  const publish = async () => {
    if (!doc || !selected) return
    if (errors.length) {
      toast.push('err', `Fix ${errors.length} error(s) before publishing`)
      return
    }
    setBusy(true)
    try {
      const got = await api.publishProfile(selected, doc)
      setVersion(got.version)
      toast.ok(`Published ${selected} version ${got.version}`)
      void reloadStatus()
    } catch (e) {
      toast.fail(e, 'Publish profile')
    } finally {
      setBusy(false)
    }
  }
  const applyRaw = () => {
    try {
      const parsed = JSON.parse(rawText)
      setDoc(parsed)
      setRawErr('')
      setRawMode(false)
      toast.ok('Applied JSON to the form')
    } catch (e) {
      setRawErr(e.message)
    }
  }
  const speakGw = doc?.routers?.speak?.providers?.[0] ?? ''
  return (
    <div className="content">
      <div className="page-head">
        <h1>Profiles</h1>
        <p>
          A profile is the bot's identity: which engines it routes to, what languages it speaks, its
          voice, and how it renders speech. Versions are immutable — publishing always creates a new
          one.
        </p>
      </div>

      <div className="split">
        <div>
          <div className="list">
            {(list.data?.profiles ?? []).map((p) => (
              <div
                key={p.id}
                className={`list-item ${selected === p.id ? 'active' : ''}`}
                onClick={() => void loadProfile(p.id)}
              >
                <div className="mono">{p.id}</div>
                <div className="sub">{p.display_name || 'no display name'}</div>
              </div>
            ))}
            {!list.data?.profiles?.length && <div className="empty">No profiles yet</div>}
          </div>

          <Card title="Create profile">
            <TextField
              label="Profile id"
              value={newId}
              onChange={setNewId}
              placeholder="coral-voice-desk"
              mono
            />
            <TextField
              label="Display name"
              value={newName}
              onChange={setNewName}
              placeholder="Coral AI Voice Bot"
            />
            <div className="actions">
              <button className="btn" onClick={createProfile} disabled={busy}>
                Create
              </button>
              <button className="btn secondary" onClick={() => void list.reload()}>
                Reload
              </button>
            </div>
          </Card>
        </div>

        <div>
          {!doc && (
            <Card>
              <Empty>Select a profile on the left, or create one.</Empty>
            </Card>
          )}

          {doc && (
            <>
              <Card>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                    }}
                  >
                    {selected}
                  </h2>
                  {version != null ? (
                    <span className="badge">published v{version}</span>
                  ) : (
                    <span className="badge warn">no published version</span>
                  )}
                  <div
                    style={{
                      flex: 1,
                    }}
                  />
                  <button className="btn secondary sm" onClick={() => setRawMode((v) => !v)}>
                    {rawMode ? 'Back to form' : 'Advanced JSON'}
                  </button>
                  <button className="btn" onClick={publish} disabled={busy || errors.length > 0}>
                    {busy ? 'Publishing…' : 'Publish version'}
                  </button>
                </div>

                {!!issues.length && (
                  <div className="issues">
                    {issues.map((i, n) => (
                      <div key={n} className={`issue ${i.level}`}>
                        <span>{i.level === 'error' ? '✕' : '!'}</span>
                        <span>{i.message}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!issues.length && (
                  <div className="probe ok">Document is valid — ready to publish.</div>
                )}
              </Card>

              {rawMode ? (
                <Card
                  title="Advanced JSON"
                  hint="The complete document. Anything this form does not model is preserved here — edit and apply to keep it."
                  actions={
                    <>
                      <button className="btn" onClick={applyRaw}>
                        Apply to form
                      </button>
                      <button
                        className="btn secondary"
                        onClick={() => setRawText(JSON.stringify(doc, null, 2))}
                      >
                        Reset
                      </button>
                    </>
                  }
                >
                  <textarea
                    rows={26}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    spellCheck={false}
                  />
                  {rawErr && <div className="probe err">{rawErr}</div>}
                </Card>
              ) : (
                <>
                  <Section title="Identity" open>
                    <div className="row">
                      <TextField
                        label="Display name"
                        value={doc.metadata?.display_name ?? ''}
                        onChange={(v) =>
                          patchIn('metadata', {
                            display_name: v,
                          })
                        }
                      />
                      <TextField
                        label="Family"
                        value={doc.metadata?.family ?? ''}
                        onChange={(v) =>
                          patchIn('metadata', {
                            family: v,
                          })
                        }
                        placeholder="voice-desk"
                        desc="Free-form grouping label."
                      />
                    </div>
                  </Section>

                  <Section title="Modes & audio" open>
                    <div className="row tight">
                      {['listen', 'speak', 'think', 'talk'].map((k) => (
                        <CheckField
                          key={k}
                          label={k}
                          checked={!!doc.modes?.[k]}
                          onChange={(v) =>
                            patchIn('modes', {
                              [k]: v,
                            })
                          }
                        />
                      ))}
                    </div>
                    <p className="desc">
                      At least one mode must be on. Talk or Speak additionally requires a persona
                      voice.
                    </p>
                    <div className="row">
                      <NumberField
                        label="Canonical sample rate (Hz)"
                        value={doc.audio?.canonical_sample_rate_hz}
                        onChange={(v) =>
                          patchIn('audio', {
                            canonical_sample_rate_hz: v,
                          })
                        }
                        desc="8000–48000. 16000 is the lab default."
                      />
                      <NumberField
                        label="Frame (ms)"
                        value={doc.audio?.frame_ms}
                        onChange={(v) =>
                          patchIn('audio', {
                            frame_ms: v,
                          })
                        }
                        placeholder="20"
                      />
                    </div>
                  </Section>

                  <Section title="Persona" open>
                    <div className="row">
                      <TextField
                        label="Name"
                        value={doc.persona?.name ?? ''}
                        onChange={(v) =>
                          patchIn('persona', {
                            name: v,
                          })
                        }
                      />
                      <TextField
                        label="Default voice id"
                        value={doc.persona?.voice_id ?? ''}
                        onChange={(v) =>
                          patchIn('persona', {
                            voice_id: v,
                          })
                        }
                        desc="Used when no per-gateway voice is set."
                      />
                    </div>
                    <Field label="Instructions">
                      <textarea
                        rows={3}
                        value={doc.persona?.instructions ?? ''}
                        onChange={(e) =>
                          patchIn('persona', {
                            instructions: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Voice per speak gateway"
                      desc="Speaker id sent to that TTS vendor. Sarvam bulbul:v3 examples: shubh, aditya, rahul, ritu, priya, neha."
                    >
                      {idsFor('speak').map((gw) => (
                        <div
                          key={gw}
                          className="row tight"
                          style={{
                            marginBottom: '0.35rem',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                            }}
                          >
                            <code
                              style={{
                                fontSize: 12,
                              }}
                            >
                              {gw}
                            </code>
                            {gw === speakGw && <span className="badge ok">bound</span>}
                          </div>
                          <input
                            value={doc.persona?.voice?.[gw] ?? ''}
                            placeholder="speaker id"
                            onChange={(e) =>
                              patchIn('persona', {
                                voice: {
                                  ...(doc.persona?.voice ?? {}),
                                  [gw]: e.target.value,
                                },
                              })
                            }
                          />
                        </div>
                      ))}
                    </Field>
                  </Section>

                  <Section title="Language" tag="dropped by the old console" open>
                    <div className="row">
                      <TextField
                        label="Behaviour"
                        value={doc.language?.behaviour ?? ''}
                        onChange={(v) =>
                          patchIn('language', {
                            behaviour: v,
                          })
                        }
                        desc='Use "none" unless you have translate providers bound.'
                      />
                      <SelectField
                        label="Primary locale"
                        value={doc.language?.primary ?? ''}
                        onChange={(v) =>
                          patchIn('language', {
                            primary: v,
                          })
                        }
                        options={locales}
                      />
                    </div>
                    <ChipMulti
                      label="Allowed locales"
                      options={locales}
                      selected={doc.language?.allowed ?? []}
                      onChange={(v) =>
                        patchIn('language', {
                          allowed: v,
                        })
                      }
                      desc="Must be a subset of what the bound TTS and STT gateways support. Sarvam bulbul:v3 covers these 11."
                    />
                    <div className="row tight">
                      <CheckField
                        label="Auto-detect language"
                        checked={!!doc.language?.auto_detect}
                        onChange={(v) =>
                          patchIn('language', {
                            auto_detect: v,
                          })
                        }
                      />
                      <CheckField
                        label="Mid-call switch"
                        checked={!!doc.language?.mid_call_switch}
                        onChange={(v) =>
                          patchIn('language', {
                            mid_call_switch: v,
                          })
                        }
                        desc="EC-24 — not implemented in the runtime yet."
                      />
                    </div>
                  </Section>

                  <Section title="Routers" tag="5 ports" open>
                    <p
                      className="desc"
                      style={{
                        marginBottom: '0.6rem',
                      }}
                    >
                      Ordered provider lists. Each id must be registered on that exact port or
                      publish fails with 422.
                    </p>
                    {['listen', 'think', 'speak', 'knowledge', 'translate'].map((port) => (
                      <StringList
                        key={port}
                        label={`routers.${port}.providers`}
                        values={doc.routers?.[port]?.providers ?? []}
                        onChange={(v) =>
                          patchIn('routers', {
                            [port]: {
                              providers: v,
                            },
                          })
                        }
                        placeholder={idsFor(port)[0] ?? `${port} gateway id`}
                        desc={`Registered: ${idsFor(port).join(', ') || 'none'}`}
                      />
                    ))}
                  </Section>

                  <Section title="Speak render policy" tag="doc 16">
                    <div className="row">
                      <SelectField
                        label="speak_render"
                        value={doc.speak_render ?? 'configured'}
                        onChange={(v) =>
                          patch({
                            speak_render: v,
                          })
                        }
                        options={catalog?.speak_render_modes ?? ['configured', 'smart']}
                        allowEmpty={false}
                        desc="configured = play the prompt pack verbatim. smart = let Think paraphrase it."
                      />
                      <SelectField
                        label="Canonical locale"
                        value={doc.speak_canonical_locale ?? 'en-IN'}
                        onChange={(v) =>
                          patch({
                            speak_canonical_locale: v,
                          })
                        }
                        options={locales}
                      />
                    </div>
                    <StringList
                      label="Fallback locales (ordered)"
                      values={doc.speak_fallback_locales ?? []}
                      onChange={(v) =>
                        patch({
                          speak_fallback_locales: v,
                        })
                      }
                      placeholder="hi-IN"
                    />
                    <div className="row tight">
                      <CheckField
                        label="Locale strict"
                        checked={!!doc.speak_locale_strict}
                        onChange={(v) =>
                          patch({
                            speak_locale_strict: v,
                          })
                        }
                        desc="Fail closed rather than leak another locale's text."
                      />
                      <CheckField
                        label="Allow canonical fallback"
                        checked={!!doc.speak_allow_canonical_fallback}
                        onChange={(v) =>
                          patch({
                            speak_allow_canonical_fallback: v,
                          })
                        }
                      />
                    </div>
                  </Section>

                  <Section title="Grounding & knowledge">
                    <CheckField
                      label="Grounding required"
                      checked={!!doc.grounding?.required}
                      onChange={(v) =>
                        patchIn('grounding', {
                          required: v,
                        })
                      }
                      desc="When on, at least one knowledge provider is mandatory."
                    />
                    <TextField
                      label="knowledge.http_kb.gateway"
                      value={doc.knowledge?.http_kb?.gateway ?? ''}
                      onChange={(v) =>
                        patch({
                          knowledge: v.trim()
                            ? {
                                http_kb: {
                                  gateway: v,
                                },
                              }
                            : {
                                http_kb: null,
                              },
                        })
                      }
                      desc={`Must be a knowledge gateway. Registered: ${idsFor('knowledge').join(', ') || 'none'}`}
                    />
                  </Section>

                  <Section title="Skills">
                    <StringList
                      label="skills.allowed"
                      values={doc.skills?.allowed ?? []}
                      onChange={(v) =>
                        patchIn('skills', {
                          allowed: v,
                        })
                      }
                      desc="Every name here needs a definition below, or publish fails."
                    />
                    {(doc.skills?.allowed ?? []).map((name) => {
                      const def = doc.skills?.definitions?.[name] ?? {}
                      const setDef = (p) =>
                        patchIn('skills', {
                          definitions: {
                            ...(doc.skills?.definitions ?? {}),
                            [name]: {
                              ...def,
                              ...p,
                            },
                          },
                        })
                      return (
                        <div className="card sub" key={name}>
                          <div className="label">{name}</div>
                          <div className="row tight">
                            <SelectField
                              label="Gateway"
                              value={def.gateway ?? ''}
                              onChange={(v) =>
                                setDef({
                                  gateway: v,
                                })
                              }
                              options={idsFor('skill')}
                            />
                            <SelectField
                              label="Authority"
                              value={def.authority ?? ''}
                              onChange={(v) =>
                                setDef({
                                  authority: v,
                                })
                              }
                              options={['inform', 'decide', 'act']}
                            />
                            <CheckField
                              label="Confirm before acting"
                              checked={!!def.confirm}
                              onChange={(v) =>
                                setDef({
                                  confirm: v,
                                })
                              }
                            />
                          </div>
                        </div>
                      )
                    })}
                  </Section>

                  <Section title="Response ladder">
                    <StringList
                      label="response.ladder"
                      values={doc.response?.ladder ?? []}
                      onChange={(v) =>
                        patch({
                          response: {
                            ...(doc.response ?? {}),
                            ladder: v,
                          },
                        })
                      }
                      placeholder="clip | template | llm"
                      desc="Ordered tiers tried for a turn reply. Only clip, template and llm are accepted."
                    />
                    <ClipEditor
                      label="response.clips"
                      value={doc.response?.clips ?? {}}
                      onChange={(clips) =>
                        patch({
                          response: {
                            ...(doc.response ?? {}),
                            clips,
                          },
                        })
                      }
                    />
                    <ClipEditor
                      label="response.templates"
                      value={doc.response?.templates ?? {}}
                      onChange={(templates) =>
                        patch({
                          response: {
                            ...(doc.response ?? {}),
                            templates,
                          },
                        })
                      }
                    />
                  </Section>

                  <Section title="Fallback (hop degradation)">
                    <p
                      className="desc"
                      style={{
                        marginBottom: '0.6rem',
                      }}
                    >
                      What to do when a hop is down. <code>speak_canned</code> must name a clip
                      defined above.
                    </p>
                    {['listen_down', 'think_down', 'speak_down'].map((hop) => {
                      const cur = doc.fallback?.[hop] ?? {}
                      const set = (p) =>
                        patch({
                          fallback: {
                            ...(doc.fallback ?? {}),
                            [hop]: {
                              ...cur,
                              ...p,
                            },
                          },
                        })
                      return (
                        <div className="card sub" key={hop}>
                          <div className="label">{hop}</div>
                          <div className="row tight">
                            <SelectField
                              label="speak_canned"
                              value={cur.speak_canned ?? ''}
                              onChange={(v) =>
                                set({
                                  speak_canned: v,
                                })
                              }
                              options={Object.keys(doc.response?.clips ?? {})}
                            />
                            <SelectField
                              label="skill"
                              value={cur.skill ?? ''}
                              onChange={(v) =>
                                set({
                                  skill: v,
                                })
                              }
                              options={doc.skills?.allowed ?? []}
                            />
                            <CheckField
                              label="text sink"
                              checked={!!cur.text_sink}
                              onChange={(v) =>
                                set({
                                  text_sink: v,
                                })
                              }
                            />
                          </div>
                        </div>
                      )
                    })}
                  </Section>

                  <Section title="Rules">
                    <RulesEditor
                      value={doc.rules ?? []}
                      onChange={(rules) =>
                        patch({
                          rules,
                        })
                      }
                      skills={doc.skills?.allowed ?? []}
                    />
                  </Section>

                  <Section title="Templates & analytics">
                    <div className="row">
                      <TextField
                        label="templates.disposition.id"
                        value={doc.templates?.disposition?.id ?? ''}
                        onChange={(v) =>
                          patchIn('templates', {
                            disposition: v.trim()
                              ? {
                                  id: v,
                                }
                              : null,
                          })
                        }
                      />
                      <TextField
                        label="templates.mom.id"
                        value={doc.templates?.mom?.id ?? ''}
                        onChange={(v) =>
                          patchIn('templates', {
                            mom: v.trim()
                              ? {
                                  id: v,
                                }
                              : null,
                          })
                        }
                      />
                    </div>
                    <StringList
                      label="analytics.emit"
                      values={doc.analytics?.emit ?? []}
                      onChange={(v) =>
                        patchIn('analytics', {
                          emit: v,
                        })
                      }
                      placeholder="metric name"
                    />
                    <StringList
                      label="hot_swap_allowed"
                      values={doc.hot_swap_allowed ?? []}
                      onChange={(v) =>
                        patch({
                          hot_swap_allowed: v,
                        })
                      }
                    />
                  </Section>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- sub-editors */

function ClipEditor({ label, value, onChange }) {
  const [newKey, setNewKey] = useState('')
  return (
    <Field label={label}>
      {Object.entries(value).map(([k, v]) => (
        <div
          className="row tight"
          key={k}
          style={{
            marginBottom: '0.35rem',
          }}
        >
          <code
            style={{
              fontSize: 12,
              alignSelf: 'center',
            }}
          >
            {k}
          </code>
          <input
            value={v.text ?? ''}
            placeholder="text"
            onChange={(e) =>
              onChange({
                ...value,
                [k]: {
                  ...v,
                  text: e.target.value,
                },
              })
            }
          />
          <button
            className="btn danger sm"
            onClick={() => {
              const next = {
                ...value,
              }
              delete next[k]
              onChange(next)
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
        }}
      >
        <input value={newKey} placeholder="new id" onChange={(e) => setNewKey(e.target.value)} />
        <button
          className="btn secondary sm"
          onClick={() => {
            const k = newKey.trim()
            if (!k) return
            onChange({
              ...value,
              [k]: {
                text: '',
              },
            })
            setNewKey('')
          }}
        >
          Add
        </button>
      </div>
    </Field>
  )
}
function RulesEditor({ value, onChange, skills }) {
  const set = (i, p) =>
    onChange(
      value.map((r, n) =>
        n === i
          ? {
              ...r,
              ...p,
            }
          : r,
      ),
    )
  return (
    <>
      {value.map((r, i) => (
        <div className="card sub" key={i}>
          <div className="row tight">
            <TextField
              label="id"
              value={r.id ?? ''}
              onChange={(v) =>
                set(i, {
                  id: v,
                })
              }
              mono
            />
            <TextField
              label="phase"
              value={r.phase ?? ''}
              onChange={(v) =>
                set(i, {
                  phase: v,
                })
              }
            />
            <TextField
              label="action"
              value={r.action ?? ''}
              onChange={(v) =>
                set(i, {
                  action: v,
                })
              }
            />
            <SelectField
              label="skill"
              value={r.skill ?? ''}
              onChange={(v) =>
                set(i, {
                  skill: v,
                })
              }
              options={skills}
            />
          </div>
          <div className="row tight">
            <TextField
              label="message"
              value={r.message ?? ''}
              onChange={(v) =>
                set(i, {
                  message: v,
                })
              }
            />
            <TextField
              label="text"
              value={r.text ?? ''}
              onChange={(v) =>
                set(i, {
                  text: v,
                })
              }
            />
          </div>
          <div className="actions tight">
            <button
              className="btn danger sm"
              onClick={() => onChange(value.filter((_, n) => n !== i))}
            >
              Remove rule
            </button>
          </div>
        </div>
      ))}
      <div className="actions tight">
        <button
          className="btn secondary sm"
          onClick={() =>
            onChange([
              ...value,
              {
                id: `rule_${value.length + 1}`,
              },
            ])
          }
        >
          Add rule
        </button>
      </div>
    </>
  )
}
