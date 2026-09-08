import { useCatalog } from '../../api/catalog'
import { Field, NumberField, SelectField, StringList, TextField } from '../../components/ui'
/**
 * Right-hand properties panel. Shows the selected node or edge, or the flow's
 * document-level settings when nothing is selected.
 *
 * Every enum here binds to GET /v1/meta/catalog (doc 13 OD-13-3) — the UI must
 * never offer a node type, edge kind, tool or disposition the kernel rejects.
 */
export default function Inspector({
  doc,
  setDoc,
  selNode,
  selEdge,
  onDeleteNode,
  onDeleteEdge,
  bindingIds,
}) {
  const { catalog } = useCatalog()
  const nodeIds = doc.nodes.map((n) => n.id)
  const locales = catalog?.tts_locales_v1 ?? ['en-IN']
  const patchNode = (id, p) =>
    setDoc((d) => ({
      ...d,
      nodes: d.nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              ...p,
            }
          : n,
      ),
    }))
  const patchEdge = (id, p) =>
    setDoc((d) => ({
      ...d,
      edges: d.edges.map((e) =>
        e.id === id
          ? {
              ...e,
              ...p,
            }
          : e,
      ),
    }))

  /** Renaming a node has to carry every reference with it. */
  const renameNode = (oldId, newId) => {
    const id = newId.trim()
    if (!id || id === oldId || nodeIds.includes(id)) return
    setDoc((d) => ({
      ...d,
      entry_node_id: d.entry_node_id === oldId ? id : d.entry_node_id,
      nodes: d.nodes.map((n) =>
        n.id === oldId
          ? {
              ...n,
              id,
            }
          : n,
      ),
      edges: d.edges.map((e) => ({
        ...e,
        from: e.from === oldId ? id : e.from,
        to: e.to === oldId ? id : e.to,
      })),
      cx: d.cx?.layout
        ? {
            ...d.cx,
            layout: Object.fromEntries(
              Object.entries(d.cx.layout).map(([k, v]) => [k === oldId ? id : k, v]),
            ),
          }
        : d.cx,
    }))
  }

  /* ------------------------------------------------------------ node panel */
  if (selNode) {
    const n = selNode
    const promptLocales = doc.prompts[n.prompt_ref ?? ''] ?? {}
    return (
      <>
        <h2
          style={{
            marginTop: 0,
            fontSize: 14,
          }}
        >
          Node
        </h2>
        <TextField
          label="Node id"
          value={n.id}
          onChange={(v) => renameNode(n.id, v)}
          mono
          desc="Renaming updates every edge, the entry pointer and the saved layout."
        />
        <SelectField
          label="Type"
          value={n.type}
          onChange={(v) =>
            patchNode(n.id, {
              type: v,
            })
          }
          options={catalog?.node_types ?? []}
          allowEmpty={false}
        />

        {n.type === 'Tool' && (
          <>
            <SelectField
              label="Tool verb"
              value={n.tool ?? ''}
              onChange={(v) =>
                patchNode(n.id, {
                  tool: v,
                })
              }
              options={catalog?.tools ?? ['transfer', 'hangup']}
              desc="Required on Tool nodes. Arming a tool is irreversible: barge off → closing line → execute."
            />
            {n.tool === 'transfer' && (
              <SelectField
                label="matrix_intent"
                value={n.matrix_intent ?? ''}
                onChange={(v) =>
                  patchNode(n.id, {
                    matrix_intent: v,
                  })
                }
                options={doc.matrix.map((m) => m.intent)}
                desc="Destination comes from the routing matrix — never typed on the node."
              />
            )}
          </>
        )}

        {n.type === 'Inform' && (
          <SelectField
            label="binding_ref"
            value={n.binding_ref ?? ''}
            onChange={(v) =>
              patchNode(n.id, {
                binding_ref: v,
                // Keep binding_refs in step, or publish fails validation.
              })
            }
            options={bindingIds}
            desc="Must also appear in the flow's binding_refs list (Flow tab)."
          />
        )}

        <TextField
          label="prompt_ref"
          value={n.prompt_ref ?? ''}
          onChange={(v) =>
            patchNode(n.id, {
              prompt_ref: v,
            })
          }
          mono
          desc="Key into the prompts table. Needs text in the default locale to publish."
        />

        {n.prompt_ref && (
          <Field label={`Prompt text — ${n.prompt_ref}`}>
            {locales.map((loc) => (
              <div
                key={loc}
                style={{
                  display: 'flex',
                  gap: '0.35rem',
                  marginBottom: '0.25rem',
                }}
              >
                <code
                  style={{
                    fontSize: 10.5,
                    width: 46,
                    flex: '0 0 46px',
                    paddingTop: 6,
                  }}
                >
                  {loc}
                </code>
                <textarea
                  rows={2}
                  value={promptLocales[loc] ?? ''}
                  placeholder={loc === doc.default_locale ? 'required' : 'optional'}
                  onChange={(e) =>
                    setDoc((d) => ({
                      ...d,
                      prompts: {
                        ...d.prompts,
                        [n.prompt_ref]: {
                          ...(d.prompts[n.prompt_ref] ?? {}),
                          [loc]: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </div>
            ))}
          </Field>
        )}

        <div
          className="label"
          style={{
            marginTop: '0.8rem',
          }}
        >
          Repair policy
        </div>
        <NumberField
          label="max_retries"
          value={n.repair?.max_retries}
          onChange={(v) =>
            patchNode(n.id, {
              repair: {
                ...(n.repair ?? {}),
                max_retries: v,
              },
            })
          }
          desc="How many times this node re-asks before the repair ladder exhausts."
        />
        <TextField
          label="unclear_prompt_ref"
          value={n.repair?.unclear_prompt_ref ?? ''}
          onChange={(v) =>
            patchNode(n.id, {
              repair: {
                ...(n.repair ?? {}),
                unclear_prompt_ref: v,
              },
            })
          }
          mono
        />

        <div className="actions">
          <button
            className="btn secondary sm"
            onClick={() =>
              setDoc((d) => ({
                ...d,
                entry_node_id: n.id,
              }))
            }
            disabled={n.type !== 'Entry' || doc.entry_node_id === n.id}
          >
            Make entry
          </button>
          <button className="btn danger sm" onClick={() => onDeleteNode(n.id)}>
            Delete node
          </button>
        </div>
      </>
    )
  }

  /* ------------------------------------------------------------ edge panel */
  if (selEdge) {
    const e = selEdge
    return (
      <>
        <h2
          style={{
            marginTop: 0,
            fontSize: 14,
          }}
        >
          Edge
        </h2>
        <TextField
          label="Edge id"
          value={e.id}
          onChange={(v) =>
            patchEdge(e.id, {
              id: v,
            })
          }
          mono
        />
        <SelectField
          label="Kind"
          value={e.kind}
          onChange={(v) =>
            patchEdge(e.id, {
              kind: v,
            })
          }
          options={catalog?.edge_kinds ?? []}
          allowEmpty={false}
          desc="The closed set of legal moves. The LLM may only pick from edges leaving the current node."
        />
        <div className="row tight">
          <SelectField
            label="From"
            value={e.from}
            onChange={(v) =>
              patchEdge(e.id, {
                from: v,
              })
            }
            options={nodeIds}
            allowEmpty={false}
          />
          <SelectField
            label="To"
            value={e.to}
            onChange={(v) =>
              patchEdge(e.id, {
                to: v,
              })
            }
            options={nodeIds}
            allowEmpty={false}
          />
        </div>
        <TextField
          label="intent"
          value={e.intent ?? ''}
          onChange={(v) =>
            patchEdge(e.id, {
              intent: v,
            })
          }
          desc="Label the classifier matches against for intent edges."
        />
        <TextField
          label="option"
          value={e.option ?? ''}
          onChange={(v) =>
            patchEdge(e.id, {
              option: v,
            })
          }
        />
        <SelectField
          label="matrix_intent"
          value={e.matrix_intent ?? ''}
          onChange={(v) =>
            patchEdge(e.id, {
              matrix_intent: v,
            })
          }
          options={doc.matrix.map((m) => m.intent)}
          desc="Fallback source of a transfer destination when the Tool node has none."
        />
        <div className="actions">
          <button className="btn danger sm" onClick={() => onDeleteEdge(e.id)}>
            Delete edge
          </button>
        </div>
      </>
    )
  }

  /* -------------------------------------------------------- document panel */
  const setMatrix = (i, p) =>
    setDoc((d) => ({
      ...d,
      matrix: d.matrix.map((m, n) =>
        n === i
          ? {
              ...m,
              ...p,
            }
          : m,
      ),
    }))
  return (
    <>
      <h2
        style={{
          marginTop: 0,
          fontSize: 14,
        }}
      >
        Flow document
      </h2>
      <p
        className="desc"
        style={{
          marginBottom: '0.8rem',
        }}
      >
        Select a node or edge on the canvas to edit it. These are the document-level settings.
      </p>

      <SelectField
        label="Entry node"
        value={doc.entry_node_id}
        onChange={(v) =>
          setDoc((d) => ({
            ...d,
            entry_node_id: v,
          }))
        }
        options={doc.nodes.filter((n) => n.type === 'Entry').map((n) => n.id)}
        allowEmpty={false}
        desc="Exactly one Entry node is allowed, and this must point at it."
      />

      <SelectField
        label="Default locale"
        value={doc.default_locale}
        onChange={(v) =>
          setDoc((d) => ({
            ...d,
            default_locale: v,
          }))
        }
        options={locales}
        allowEmpty={false}
        desc="Every prompt must have text in this locale to publish."
      />

      <StringList
        label="binding_refs"
        values={doc.binding_refs}
        onChange={(v) =>
          setDoc((d) => ({
            ...d,
            binding_refs: v,
          }))
        }
        placeholder={bindingIds[0] ?? 'binding id'}
        desc={`Bindings this flow may Inform from. Available: ${bindingIds.join(', ') || 'none'}`}
      />

      <div
        className="label"
        style={{
          marginTop: '1rem',
        }}
      >
        Routing matrix ({doc.matrix.length})
      </div>
      <p className="desc">
        Transfer destinations. A transfer Tool resolves its number through this table.
      </p>
      {doc.matrix.map((m, i) => (
        <div className="card sub" key={i}>
          <div className="row tight">
            <TextField
              label="intent"
              value={m.intent}
              onChange={(v) =>
                setMatrix(i, {
                  intent: v,
                })
              }
              mono
            />
            <TextField
              label="owner"
              value={m.owner}
              onChange={(v) =>
                setMatrix(i, {
                  owner: v,
                })
              }
            />
          </div>
          <div className="row tight">
            <TextField
              label="target"
              value={m.target}
              onChange={(v) =>
                setMatrix(i, {
                  target: v,
                })
              }
            />
            <TextField
              label="number"
              value={m.number}
              onChange={(v) =>
                setMatrix(i, {
                  number: v,
                })
              }
              mono
            />
          </div>
          <div className="row tight">
            <SelectField
              label="action"
              value={m.action}
              onChange={(v) =>
                setMatrix(i, {
                  action: v,
                })
              }
              options={catalog?.matrix_actions ?? ['transfer']}
              allowEmpty={false}
            />
            <SelectField
              label="disposition_code"
              value={m.disposition_code ?? ''}
              onChange={(v) =>
                setMatrix(i, {
                  disposition_code: v,
                })
              }
              options={catalog?.disposition_final ?? []}
            />
          </div>
          <div className="actions tight">
            <button
              className="btn danger sm"
              onClick={() =>
                setDoc((d) => ({
                  ...d,
                  matrix: d.matrix.filter((_, n) => n !== i),
                }))
              }
            >
              Remove row
            </button>
          </div>
        </div>
      ))}
      <div className="actions tight">
        <button
          className="btn secondary sm"
          onClick={() =>
            setDoc((d) => ({
              ...d,
              matrix: [
                ...d.matrix,
                {
                  intent: '',
                  owner: '',
                  target: '',
                  number: '',
                  action: 'transfer',
                  disposition_code: '',
                },
              ],
            }))
          }
        >
          Add matrix row
        </button>
      </div>

      <div
        className="label"
        style={{
          marginTop: '1rem',
        }}
      >
        Prompts ({Object.keys(doc.prompts).length})
      </div>
      <p className="desc">
        Edit a prompt's text by selecting the node that uses it. Orphaned prompts are listed here.
      </p>
      {Object.keys(doc.prompts)
        .filter((k) => !doc.nodes.some((n) => n.prompt_ref === k))
        .map((k) => (
          <div
            key={k}
            style={{
              display: 'flex',
              gap: '0.4rem',
              alignItems: 'center',
              marginBottom: '0.25rem',
            }}
          >
            <code
              style={{
                fontSize: 11,
              }}
            >
              {k}
            </code>
            <span className="badge warn">unused</span>
            <button
              className="btn danger sm"
              style={{
                marginLeft: 'auto',
              }}
              onClick={() =>
                setDoc((d) => {
                  const p = {
                    ...d.prompts,
                  }
                  delete p[k]
                  return {
                    ...d,
                    prompts: p,
                  }
                })
              }
            >
              Remove
            </button>
          </div>
        ))}

      <p
        className="desc"
        style={{
          marginTop: '1rem',
        }}
      >
        {doc.nodes.length} nodes · {doc.edges.length} edges · {Object.keys(doc.prompts).length}{' '}
        prompts · {doc.matrix.length} matrix rows
      </p>
    </>
  )
}
