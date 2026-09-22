import {
  CheckField,
  NumberField,
  SelectField,
  StringList,
  Section,
  TextField,
} from '../../components/ui'
import {
  API_AUTH_TYPES,
  API_KINDS,
  API_SUCCESS_MODES,
  DATE_ORDER,
} from '../../api/types.js'

function emptyIntegration() {
  return {
    id: '',
    display_name: '',
    method: 'GET',
    url: '',
    kind: 'safe_read',
    timeout_ms: 5000,
    auth_type: 'none',
    auth_header_name: '',
    static_headers: {},
    content_type: 'application/json',
    request_map: [],
    response_map: [],
    success: {
      mode: 'http_ok',
      http_ok: [200],
      fail_statuses: [],
      success_requires: [],
      http_only: false,
    },
    idempotency: undefined,
    caps: undefined,
    allow_insecure_http: false,
  }
}

function headersToPairs(obj) {
  return Object.entries(obj && typeof obj === 'object' ? obj : {}).map(([k, v]) => ({
    key: k,
    value: String(v ?? ''),
  }))
}

function pairsToHeaders(pairs) {
  const out = {}
  for (const p of pairs) {
    const k = (p.key ?? '').trim()
    if (k) out[k] = p.value ?? ''
  }
  return Object.keys(out).length ? out : undefined
}

function MapTable({ label, rows, onChange, leftKey, rightKey, leftPh, rightPh, desc }) {
  const list = Array.isArray(rows) ? rows : []
  const setRow = (i, p) => onChange(list.map((r, n) => (n === i ? { ...r, ...p } : r)))
  return (
    <div className="field">
      <label>{label}</label>
      {desc && <p className="desc">{desc}</p>}
      {list.map((r, i) => (
        <div key={i} className="row tight" style={{ marginBottom: 6, alignItems: 'flex-end' }}>
          <TextField
            label={leftKey}
            value={r[leftKey] ?? ''}
            onChange={(v) => setRow(i, { [leftKey]: v })}
            mono
            placeholder={leftPh}
          />
          <TextField
            label={rightKey}
            value={r[rightKey] ?? ''}
            onChange={(v) => setRow(i, { [rightKey]: v })}
            mono
            placeholder={rightPh}
          />
          <button
            type="button"
            className="btn secondary sm"
            onClick={() => onChange(list.filter((_, n) => n !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn secondary sm"
        onClick={() => onChange([...list, { [leftKey]: '', [rightKey]: '' }])}
      >
        Add row
      </button>
    </div>
  )
}

function intsFromStrings(vals) {
  return (vals ?? [])
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n))
}

function IntegrationEditor({ api, onChange, onRemove, catalog }) {
  const a = api && typeof api === 'object' ? api : emptyIntegration()
  const success = a.success ?? {}
  const authTypes = catalog?.api_auth_types?.length ? catalog.api_auth_types : API_AUTH_TYPES
  const kinds = API_KINDS
  const modes = catalog?.api_success_modes?.length ? catalog.api_success_modes : API_SUCCESS_MODES
  const headerPairs = headersToPairs(a.static_headers)
  const patch = (p) => onChange({ ...a, ...p })
  const patchSuccess = (p) =>
    patch({
      success: {
        ...success,
        ...p,
      },
    })

  return (
    <div className="card-inset" style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px solid var(--border, #333)', borderRadius: 6 }}>
      <div className="row tight" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <strong className="mono">{a.id || '(new integration)'}</strong>
        <button type="button" className="btn secondary sm" onClick={onRemove}>
          Remove
        </button>
      </div>
      <div className="row tight">
        <TextField
          label="id"
          value={a.id ?? ''}
          onChange={(v) => patch({ id: v })}
          mono
          desc="Stable id referenced by Tool api_id on the flow."
        />
        <TextField
          label="display_name"
          value={a.display_name ?? ''}
          onChange={(v) => patch({ display_name: v })}
        />
      </div>
      <div className="row tight">
        <SelectField
          label="method"
          value={a.method ?? 'GET'}
          onChange={(v) => patch({ method: v })}
          options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE']}
          allowEmpty={false}
        />
        <SelectField
          label="kind"
          value={a.kind ?? 'safe_read'}
          onChange={(v) => patch({ kind: v })}
          options={kinds}
          allowEmpty={false}
        />
        <NumberField
          label="timeout_ms"
          value={a.timeout_ms ?? 5000}
          onChange={(v) => patch({ timeout_ms: v })}
          desc="Hard cap; server max 15000."
        />
      </div>
      <TextField
        label="url"
        value={a.url ?? ''}
        onChange={(v) => patch({ url: v })}
        mono
        desc="Full URL. https required unless lab allow_insecure_http."
      />
      <div className="row tight">
        <SelectField
          label="auth_type"
          value={a.auth_type ?? 'none'}
          onChange={(v) => patch({ auth_type: v })}
          options={authTypes}
          allowEmpty={false}
          desc="Secrets are set in the API secrets panel — never in this document."
        />
        {(a.auth_type === 'api_key' || a.auth_type === 'headers') && (
          <TextField
            label="auth_header_name"
            value={a.auth_header_name ?? ''}
            onChange={(v) => patch({ auth_header_name: v })}
            mono
            placeholder="X-Api-Key"
          />
        )}
      </div>
      <CheckField
        label="allow_insecure_http (lab only)"
        checked={!!a.allow_insecure_http}
        onChange={(v) => patch({ allow_insecure_http: v || undefined })}
      />
      <MapTable
        label="static_headers (non-secret)"
        rows={headerPairs}
        onChange={(pairs) => patch({ static_headers: pairsToHeaders(pairs) })}
        leftKey="key"
        rightKey="value"
        leftPh="Accept"
        rightPh="application/json"
      />
      <MapTable
        label="request_map"
        rows={a.request_map ?? []}
        onChange={(v) => patch({ request_map: v })}
        leftKey="source"
        rightKey="target"
        leftPh="session.ani"
        rightPh="query.phone"
        desc="source: session.* | slot.* | const.* → target: query.* | path.* | header.* | body.*"
      />
      <MapTable
        label="response_map"
        rows={a.response_map ?? []}
        onChange={(v) => patch({ response_map: v })}
        leftKey="path"
        rightKey="slot"
        leftPh="customer.name"
        rightPh="customer_name"
        desc="JSON path → slot key after a successful call."
      />
      <SelectField
        label="success.mode"
        value={success.mode ?? 'http_ok'}
        onChange={(v) => patchSuccess({ mode: v })}
        options={modes}
        allowEmpty={false}
      />
      <StringList
        label="success.http_ok (status codes)"
        values={(success.http_ok ?? []).map(String)}
        onChange={(v) => patchSuccess({ http_ok: intsFromStrings(v) })}
        placeholder="200"
      />
      <StringList
        label="success.fail_statuses"
        values={(success.fail_statuses ?? []).map(String)}
        onChange={(v) => patchSuccess({ fail_statuses: intsFromStrings(v) })}
        placeholder="404"
      />
      {(a.kind === 'write' || (success.mode ?? '') === 'fields') && (
        <StringList
          label="success.success_requires (field paths)"
          values={success.success_requires ?? []}
          onChange={(v) => patchSuccess({ success_requires: v })}
          placeholder="ticket_id"
          desc="Required for kind write unless http_only + 204-only."
        />
      )}
      <CheckField
        label="success.http_only (write may omit success_requires when http_ok is only 204)"
        checked={!!success.http_only}
        onChange={(v) => patchSuccess({ http_only: v || undefined })}
      />
      {(success.mode ?? '') === 'bool' && (
        <div className="row tight">
          <TextField
            label="bool_path"
            value={success.bool_path ?? ''}
            onChange={(v) => patchSuccess({ bool_path: v })}
            mono
          />
          <SelectField
            label="bool_equals"
            value={
              success.bool_equals === true ? 'true' : success.bool_equals === false ? 'false' : ''
            }
            onChange={(v) =>
              patchSuccess({
                bool_equals: v === '' ? undefined : v === 'true',
              })
            }
            options={['true', 'false']}
            emptyLabel="— unset —"
          />
        </div>
      )}
      {(success.mode ?? '') === 'compare' && (
        <div className="row tight">
          <TextField
            label="compare_path"
            value={success.compare_path ?? ''}
            onChange={(v) => patchSuccess({ compare_path: v })}
            mono
          />
          <TextField
            label="compare_op"
            value={success.compare_op ?? ''}
            onChange={(v) => patchSuccess({ compare_op: v })}
            mono
            placeholder="eq"
          />
          <TextField
            label="compare_value"
            value={success.compare_value != null ? String(success.compare_value) : ''}
            onChange={(v) => patchSuccess({ compare_value: v })}
          />
        </div>
      )}
      {(success.mode ?? '') === 'presence' && (
        <div className="row tight">
          <TextField
            label="presence_path"
            value={success.presence_path ?? ''}
            onChange={(v) => patchSuccess({ presence_path: v })}
            mono
          />
          <SelectField
            label="presence_expect"
            value={success.presence_expect ?? ''}
            onChange={(v) => patchSuccess({ presence_expect: v || undefined })}
            options={['present', 'absent', 'nonempty']}
            emptyLabel="— unset —"
          />
        </div>
      )}
      {a.kind === 'write' && (
        <CheckField
          label="idempotency.enabled (Idempotency-Key on writes)"
          checked={a.idempotency?.enabled !== false}
          onChange={(v) =>
            patch({
              idempotency: {
                enabled: v,
                header_name: a.idempotency?.header_name || 'Idempotency-Key',
              },
            })
          }
        />
      )}
      <div className="row tight">
        <NumberField
          label="caps.max_body_bytes"
          value={a.caps?.max_body_bytes ?? ''}
          onChange={(v) =>
            patch({
              caps: {
                ...(a.caps ?? {}),
                max_body_bytes: v || undefined,
              },
            })
          }
        />
        <NumberField
          label="caps.max_path_depth"
          value={a.caps?.max_path_depth ?? ''}
          onChange={(v) =>
            patch({
              caps: {
                ...(a.caps ?? {}),
                max_path_depth: v || undefined,
              },
            })
          }
        />
      </div>
    </div>
  )
}

export default function ApiIntegrations({ doc, patch, catalog }) {
  const list = doc.api_integrations ?? []
  const setList = (next) => patch({ api_integrations: next })
  const dateOrders = catalog?.date_order?.length ? catalog.date_order : DATE_ORDER

  return (
    <>
      <Section title="Timezone & date order" open>
        <div className="row tight">
          <TextField
            label="timezone"
            value={doc.timezone ?? ''}
            onChange={(v) => patch({ timezone: v || undefined })}
            mono
            placeholder="Asia/Kolkata"
            desc="IANA name. Required when any ListenSlot uses date, time, or datetime."
          />
          <SelectField
            label="date_order"
            value={doc.date_order ?? ''}
            onChange={(v) => patch({ date_order: v || undefined })}
            options={dateOrders}
            emptyLabel="— default dmy —"
            desc="Ambiguous numeric dates (01/02)."
          />
        </div>
      </Section>

      <Section title="API integrations" tag="Tool(api)" open>
        <p className="desc" style={{ marginBottom: '0.75rem' }}>
          Non-secret CRM/HTTP definitions for Tool verb <code>api</code>. Put bearer tokens and API
          keys in the secrets panel — never here. Content-Type is application/json in V1.
        </p>
        {list.map((api, i) => (
          <IntegrationEditor
            key={i}
            api={api}
            catalog={catalog}
            onChange={(next) => setList(list.map((row, n) => (n === i ? next : row)))}
            onRemove={() => setList(list.filter((_, n) => n !== i))}
          />
        ))}
        <button
          type="button"
          className="btn secondary sm"
          onClick={() => setList([...list, emptyIntegration()])}
        >
          Add API integration
        </button>
      </Section>
    </>
  )
}
