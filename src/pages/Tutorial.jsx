import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../api/catalog'
import { api } from '../api/client'
import { Card, useAsync } from '../components/ui'
import { readinessChecklist } from '../lib/setupSteps'
import { FIELD_GUIDE, REQ_LABEL } from '../lib/fieldGuide'

/**
 * Hidden walkthrough at /CC/admin/tutorial (legacy /tutorial redirects here).
 *
 * Linked from the dashboard first-run strip. Canvas layout is browser
 * localStorage only — never write `cx` on the flow document.
 *
 * It shows live status per step, so it doubles as a progress tracker on a fresh
 * database rather than being static prose.
 */

function Step({ n, title, done, optional, children }) {
  return (
    <div
      className="card"
      style={{ borderLeft: `3px solid ${done ? 'var(--ok)' : 'var(--border-2)'}` }}
    >
      <h2>
        <span
          style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: 22,
            height: 22,
            borderRadius: '50%',
            fontSize: 12,
            flex: '0 0 22px',
            background: done ? 'var(--ok)' : 'var(--panel-2)',
            color: done ? '#0e1116' : 'var(--muted)',
            border: done ? 'none' : '1px solid var(--border-2)',
          }}
        >
          {done ? '✓' : n}
        </span>
        {title}
        {optional && <span className="badge">optional</span>}
        {done && <span className="badge ok">done</span>}
      </h2>
      <div style={{ marginTop: '0.7rem' }}>{children}</div>
    </div>
  )
}

function FieldTable({ fields, filter }) {
  const shown = fields.filter(
    (f) => !filter || `${f.name} ${f.what} ${f.plain}`.toLowerCase().includes(filter),
  )
  if (!shown.length) return null
  return (
    <div className="table-wrap">
      <table className="data field-table">
        <thead>
          <tr>
            <th style={{ width: '22%' }}>Field</th>
            <th style={{ width: '11%' }} />
            <th>What it does &amp; why it matters</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((f) => {
            const req = REQ_LABEL[f.req] ?? REQ_LABEL.optional
            return (
              <tr key={f.name}>
                <td>
                  <code>{f.name}</code>
                </td>
                <td>
                  <span className={`badge ${req.cls}`}>{req.text}</span>
                </td>
                <td>
                  <div>{f.what}</div>
                  <div className="plain">
                    <strong>In plain terms:</strong> {f.plain}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FieldReference() {
  const [q, setQ] = useState('')
  const filter = q.trim().toLowerCase()

  return (
    <>
      <div className="page-head" style={{ marginTop: '2.2rem' }}>
        <h1>Every field, explained</h1>
        <p>
          What to put in each box, whether it is actually required, and what happens if you get it
          wrong. Every "required" below was checked against the Go validators, and fields the
          runtime does not read yet are labelled honestly rather than quietly recommended.
        </p>
      </div>

      <div className="card">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter fields — try 'voice', 'transfer', 'locale', 'required'…"
          aria-label="Filter field reference"
        />
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            <span className="badge err">required</span> publish or save fails without it
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            <span className="badge warn">conditional</span> required only in the case described
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            <span className="badge">not read yet</span> stored, but no runtime code uses it
          </span>
        </div>
      </div>

      {FIELD_GUIDE.map((sec) => (
        <div className="card" key={sec.step}>
          <h2>
            <span className="nav-num">{sec.step}</span>
            <Link to={sec.to}>{sec.page}</Link>
          </h2>
          <p className="hint">{sec.intro}</p>
          {sec.groups.map((g) => (
            <div key={g.title} style={{ marginTop: '1rem' }}>
              <div className="label">{g.title}</div>
              {g.note && (
                <div className="probe warn" style={{ marginTop: '0.35rem' }}>
                  {g.note}
                </div>
              )}
              <FieldTable fields={g.fields} filter={filter} />
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

export default function Tutorial() {
  const { status } = useCatalog()
  const flows = useAsync(() => api.listFlows(), [])
  const profiles = useAsync(() => api.listProfiles(), [])
  const bindings = useAsync(() => api.listBindings(), [])
  const pins = useAsync(() => api.getAnswerPins(), [])

  const [publishedProfiles, setPublishedProfiles] = useState(new Set())
  useEffect(() => {
    const ids = (profiles.data?.profiles ?? []).map((p) => p.id)
    if (!ids.length) return
    Promise.all(
      ids.map((id) =>
        api
          .getProfileVersion(id, 'latest')
          .then(() => id)
          .catch(() => null),
      ),
    ).then((r) => setPublishedProfiles(new Set(r.filter(Boolean))))
  }, [profiles.data])

  const check = readinessChecklist({
    status,
    profiles: profiles.data?.profiles,
    flows: flows.data?.flows,
    bindings: bindings.data?.bindings,
    pins: pins.data?.pins,
    publishedProfiles,
  })
  const at = (n) => check.find((c) => c.n === n)?.done ?? false

  return (
    <div className="content">
      <div className="page-head">
        <h1>Setting up from an empty database</h1>
        <p>
          Everything needed to take a blank Postgres to a working conversation, in order. Each step
          shows live status from your instance, so you can leave this open while you work.
        </p>
      </div>

      <Card title="Before you start" hint="Two things this console cannot do for you.">
        <p style={{ marginTop: 0 }}>
          <strong>1. Postgres must exist and the orchestrator must be running.</strong> The database
          itself is created outside the app (<code>tools/lab/Init-LabDatabase.ps1</code>, or plain{' '}
          <code>CREATE DATABASE aiorchestrator</code>). On boot the orchestrator applies its 17
          migrations automatically — those create <em>schema only</em> and never insert a single row
          of configuration. That is why a fresh install has nothing in it.
        </p>
        <p>
          <strong>2. Some settings live in a file, not the API.</strong>{' '}
          <code>conf/aiorchestrator.properties</code> holds the HTTP port, the database URL, the
          recording root, and <code>edge.base_url</code> — the address FreeSWITCH dials to reach the
          orchestrator. None of those are reachable from any UI, by design. Editing them means
          editing the file and restarting.
        </p>
        <p style={{ marginBottom: 0, color: 'var(--muted)', fontSize: 12.5 }}>
          FreeSWITCH dialplan and DID wiring are likewise outside this console. You can complete
          every step below and exercise the whole graph over text chat without any telephony.
        </p>
      </Card>

      <Step n={1} title="Bind the engines" done={at(1)}>
        <p style={{ marginTop: 0 }}>
          <Link to="/CC/admin/engines">Engines &amp; credentials</Link> → pick a gateway for{' '}
          <strong>Listen</strong> (STT), <strong>Think</strong> (LLM) and <strong>Speak</strong>{' '}
          (TTS) → Save.
        </p>
        <p>
          Choose <code>fake-listen</code> / <code>fake-think</code> / <code>fake-speak</code> to get
          running without any vendor account — the graph runs identically, you just get stub audio
          and canned LLM output. Choose the <code>sarvam-*</code> trio for real speech.
        </p>
        <div className="inline-note">
          If you pick Sarvam, add the API key in the same screen. The lookup tries gateway ids{' '}
          <code>sarvam</code>, <code>sarvam-stt</code>, <code>sarvam-llm</code>,{' '}
          <code>sarvam-tts</code> in that order and takes the first one set — so a single credential
          saved under <code>sarvam</code> covers all three engines. Without it the adapters error on
          every call, and platform status reports <code>sarvam_credential_missing</code>.
        </div>
      </Step>

      <Step n={2} title="Create and publish a profile" done={at(2)}>
        <p style={{ marginTop: 0 }}>
          <Link to="/CC/admin/profiles">Profiles</Link> → enter an id (e.g. <code>coral-voice-desk</code>) →
          Create. Then fill in the form and hit <strong>Publish version</strong>.
        </p>
        <p>
          New profiles are <code>product: call_center</code> with an empty intent catalog — the bot
          can only follow edges you drew until you add intents. Do not paste a production catalog
          into a demo.
        </p>
        <p>The minimum that will publish:</p>
        <ul style={{ margin: '0.3rem 0 0.7rem 1.1rem', color: 'var(--muted)', fontSize: 13 }}>
          <li>
            at least one <strong>mode</strong> on
          </li>
          <li>
            a <strong>persona voice</strong> — mandatory as soon as talk or speak is on
          </li>
          <li>
            <strong>routers</strong> naming registered gateways, each on the right port
          </li>
          <li>
            <strong>language.allowed</strong> — not enforced by the server, but an empty list means
            the desk advertises no locale to callers
          </li>
        </ul>
        <div className="inline-note">
          Creating a profile is not the same as publishing one. The server's readiness flag counts
          the row and calls you ready; only a published <em>version</em> can actually answer.
        </div>
      </Step>

      <Step n={3} title="Add a binding" done={at(3)} optional>
        <p style={{ marginTop: 0 }}>
          Only needed if your flow answers questions from a knowledge source — an{' '}
          <code>Inform</code> node. Skip it for a pure routing menu.
        </p>
        <p>
          <Link to="/CC/admin/bindings">Bindings</Link> → id, kind <code>knowledge</code>, mode{' '}
          <code>inline_faq</code> → add entries. Each entry has questions to match on and answer
          text per locale. Put intent/product/aliases on each entry — without retrieve keys the FAQ
          will only match questions. Do this <em>before</em> step 4, because the flow has to
          reference a binding that already exists.
        </p>
      </Step>

      <Step n={4} title="Build and publish the flow" done={at(4)}>
        <p style={{ marginTop: 0 }}>
          <Link to="/CC/admin/flows">Flows</Link> → create one. You get a valid{' '}
          <code>Entry → Speak → End</code> starter, so it will publish immediately and you can grow
          it from there. Canvas positions stay in this browser only — they are not part of the
          published flow.
        </p>
        <p>In the builder, the order that avoids fighting the validator:</p>
        <ol style={{ margin: '0.3rem 0 0.7rem 1.1rem', color: 'var(--muted)', fontSize: 13 }}>
          <li>Drop the nodes you need from the toolbar</li>
          <li>Drag handle-to-handle to connect them, then set each edge's kind</li>
          <li>
            Give every <code>Speak</code> a <code>prompt_ref</code> and write the{' '}
            <strong>default-locale</strong> text — that one is required, the other ten are warnings
          </li>
          <li>
            Fill the <strong>routing matrix</strong> before adding any transfer Tool — the Tool
            resolves its number through the matrix and will not validate without a row
          </li>
          <li>
            Add <code>binding_refs</code> for any <code>Inform</code> node, or publish fails
          </li>
          <li>
            Set <code>max_retries</code> and a repair prompt on each Listen node, and draw a{' '}
            <code>repair</code> edge to a hangup Tool
          </li>
        </ol>
        <div className="inline-note">
          The badge in the toolbar turns red with a clickable issue list whenever the graph is
          illegal, and Publish stays disabled until it is clean. Save draft works at any time —
          drafts are never validated.
        </div>
      </Step>

      <Step n={5} title="Pin it, then prove it works" done={at(5)}>
        <p style={{ marginTop: 0 }}>
          <Link to="/CC/admin/pins">Answer pins</Link> → Add pin → choose the profile and flow, leave the
          version as <code>latest</code> → Save.
        </p>
        <p>
          Then hit <strong>Test this pin</strong>. It opens a <code>clock=chat</code> session
          against the pin and shows you what the bot says. Chat runs the same graph and turn machine
          as a real call with the media layer removed, so a greeting coming back means the whole
          chain — engines, profile, flow, pin — is genuinely wired up.
        </p>
        <div className="inline-note">
          <code>latest</code> means republishing the flow takes effect without touching the pin. Pin
          a fixed number when you want a version frozen.
        </div>
      </Step>

      <Step n={6} title="Settings and fallback prompts" done={false} optional>
        <p style={{ marginTop: 0 }}>
          <Link to="/CC/admin/settings">Settings &amp; fallback</Link>. Two things matter here:
        </p>
        <p>
          <code>coral.base_url</code> — the Coral platform address the transfer and CRM gateways
          call. Set it before you expect a transfer Tool to actually move a leg.
        </p>
        <p>
          <code>control.auth_token</code> — until this is set, the Control API has{' '}
          <strong>no authentication at all</strong> and unauthenticated writes succeed. Set it
          before the orchestrator listens on anything but loopback, then put the same value in this
          console's token box.
        </p>
        <div className="inline-note">
          Both are read <strong>once at boot</strong> (<code>cmd/aiorchestrator/main.go</code>), so
          changing either takes an orchestrator restart. Fallback WAVs are picked up live and need
          no restart.
        </div>
      </Step>

      <Card title="When it still does not work">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Symptom</th>
                <th>Cause</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>422 flow_pin_required</code>
                </td>
                <td>No answer pin, or the pin names a flow with no published version — step 5</td>
              </tr>
              <tr>
                <td>
                  <code>422 profile_invalid</code>
                </td>
                <td>
                  Usually a gateway id that is unregistered or on the wrong port, or a missing
                  persona voice — the message names the field
                </td>
              </tr>
              <tr>
                <td>
                  <code>422 flow_invalid</code>
                </td>
                <td>
                  The builder would have caught this — you probably published through the API. The
                  details object names the node or edge
                </td>
              </tr>
              <tr>
                <td>Dashboard says ready, calls still fail</td>
                <td>
                  The server's flag ignores flows and pins. Use the dashboard checklist, not{' '}
                  <code>ready_for_sessions</code>
                </td>
              </tr>
              <tr>
                <td>Bot answers but says nothing</td>
                <td>
                  The Entry node has no Speak after it, or the prompt has no default-locale text
                </td>
              </tr>
              <tr>
                <td>Sarvam engines error on every turn</td>
                <td>No credential saved — step 1</td>
              </tr>
              <tr>
                <td>Transfer says no telephony leg</td>
                <td>
                  Expected on <code>clock=chat</code>. Transfers need a real call
                </td>
              </tr>
              <tr>
                <td>Setting saved but nothing changed</td>
                <td>
                  <code>coral.base_url</code> and <code>control.auth_token</code> are boot-read —
                  restart the orchestrator
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <FieldReference />

      <Card title="What this console deliberately does not cover">
        <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: 13 }}>
          Reviewing transcripts, audit trails, dispositions and recordings belongs to the{' '}
          <strong>Supervisor</strong> console, and holding a conversation belongs to the{' '}
          <strong>Chat</strong> console — both served by the orchestrator itself at{' '}
          <code>:8011/supervisor/</code> and <code>:8011/chat/</code>. Admin is configuration only,
          which is the boundary the project's own doc 13 draws.
        </p>
      </Card>
    </div>
  )
}
