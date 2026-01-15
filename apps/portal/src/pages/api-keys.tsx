import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ApiKey = {
  id: string;
  name: string;
  prefix: string; // e.g. "pbi_live_ABC123"
  createdAt: string; // ISO
  lastUsedAt?: string | null; // ISO | null
  revokedAt?: string | null; // ISO | null
};

type KeysResp = {
  keys: ApiKey[];
  customer?: { plan?: "starter" | "pro" | "enterprise"; quotaPerMonth?: string };
};

const API_BASE = (process.env.NEXT_PUBLIC_PBI_API_BASE ?? "https://api.kojib.com").replace(/\/+$/, "");

function fmt(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

export default function ApiKeysPage() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean>(true);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [plan, setPlan] = useState<string>("—");
  const [quota, setQuota] = useState<string>("—");

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string>("");

  const [revoking, setRevoking] = useState<string | null>(null);
  const [err, setErr] = useState<string>("");

  async function load() {
    setErr("");
    setNewKey("");
    setLoading(true);

    try {
      const r = await fetch(`${API_BASE}/v1/portal/api-keys`, { credentials: "include" });

      if (r.status === 401 || r.status === 403) {
        setAuthed(false);
        setKeys([]);
        return;
      }
      if (!r.ok) {
        setErr("Failed to load API keys.");
        return;
      }

      const j = (await r.json()) as KeysResp;
      setKeys(j.keys ?? []);
      setPlan(j.customer?.plan?.toUpperCase?.() ?? "—");
      setQuota(j.customer?.quotaPerMonth ?? "—");
      setAuthed(true);
    } catch {
      setErr("Network error loading API keys.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setNewKey("");

    const nm = name.trim();
    if (!nm) {
      setErr("Please enter a name for this key.");
      return;
    }

    setCreating(true);
    try {
      const r = await fetch(`${API_BASE}/v1/portal/api-keys`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nm })
      });

      if (r.status === 401 || r.status === 403) {
        setAuthed(false);
        return;
      }
      if (!r.ok) {
        setErr("Could not create API key.");
        return;
      }

      // expected: { apiKey: "pbi_live_..." , key: {...} } (but tolerate variants)
      const j = (await r.json()) as any;
      const apiKey: string | undefined = j.apiKey ?? j.key ?? j.token ?? j.secret;
      if (!apiKey) {
        setErr("API key created, but secret was not returned.");
      } else {
        setNewKey(apiKey);
      }

      setName("");
      await load();
    } catch {
      setErr("Network error creating API key.");
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    setErr("");
    setNewKey("");
    setRevoking(id);

    try {
      const r = await fetch(`${API_BASE}/v1/portal/api-keys/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include"
      });

      if (r.status === 401 || r.status === 403) {
        setAuthed(false);
        return;
      }
      if (!r.ok) {
        setErr("Could not revoke API key.");
        return;
      }

      await load();
    } catch {
      setErr("Network error revoking API key.");
    } finally {
      setRevoking(null);
    }
  }

  const activeKeys = useMemo(() => keys.filter((k) => !k.revokedAt), [keys]);
  const revokedKeys = useMemo(() => keys.filter((k) => !!k.revokedAt), [keys]);

  function copy(text: string) {
    try {
      void navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return (
    <div style={pageStyle}>
      <style>{css}</style>

      <div style={wrapStyle}>
        <header className="portalTopbar">
          <div className="portalBrand">
            <span className="portalDot" />
            <div className="portalBrandText">
              <div className="portalTitle">PBI Client Portal</div>
              <div className="portalSub">API Keys</div>
            </div>
          </div>

          <nav className="portalNav" aria-label="Portal navigation">
            <Link href="/" className="portalNavLink">Dashboard</Link>
            <Link href="/billing" className="portalNavLink">Billing</Link>
            <Link href="/terms" className="portalNavLink">Terms</Link>
          </nav>
        </header>

        <main style={cardStyle}>
          <div className="topRow">
            <div>
              <h1 style={h1Style}>API Keys</h1>
              <p style={pStyle}>
                Create keys for server-side calls to PBI. Keys inherit your plan limits automatically. Treat secrets like
                passwords—store them once, securely.
              </p>
            </div>

            <div className="currentPill" aria-label="Plan summary">
              <span style={{ opacity: 0.75 }}>Plan</span>
              <span style={{ fontWeight: 950, letterSpacing: 0.3 }}>{plan}</span>
              <span style={{ opacity: 0.75 }}>{quota}/mo</span>
            </div>
          </div>

          {err ? <div style={errorStyle}>{err}</div> : null}

          {!loading && !authed ? (
            <div style={noticeStyle}>
              <div style={{ fontWeight: 950 }}>You’re not signed in.</div>
              <div style={{ opacity: 0.8, marginTop: 6 }}>Sign in to manage API keys.</div>
              <div style={{ marginTop: 12 }}>
                <Link href="/login" style={btnPrimaryStyle}>Go to Login</Link>
              </div>
            </div>
          ) : null}

          {/* Create */}
          <section className="sectionCard" aria-label="Create API key">
            <div className="sectionHead">
              <div>
                <div className="sectionKicker">Create</div>
                <div className="sectionTitle">New API Key</div>
              </div>
              <div className="sectionHint">Name keys by service (e.g., “payments-prod”, “governance-worker”).</div>
            </div>

            <form className="formRow" onSubmit={createKey}>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Key name (required)"
                autoComplete="off"
                spellCheck={false}
              />
              <button className="btnPrimary" type="submit" disabled={creating || !authed}>
                {creating ? "Creating…" : "Create key"}
              </button>
            </form>

            {newKey ? (
              <div className="secretBox" role="status" aria-live="polite">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div className="secretTitle">Your new API key (shown once)</div>
                    <div className="secretSub">
                      Copy it now. You won’t be able to view it again.
                    </div>
                  </div>
                  <button type="button" className="btnGhost" onClick={() => copy(newKey)}>
                    Copy
                  </button>
                </div>

                <pre className="secretCode">{newKey}</pre>

                <div className="secretFoot">
                  Store in your server env (e.g. <code className="inlineCode">PBI_API_KEY</code>) and send as{" "}
                  <code className="inlineCode">Authorization: Bearer &lt;key&gt;</code>.
                </div>
              </div>
            ) : null}
          </section>

          {/* Active keys */}
          <section className="sectionCard" aria-label="Active API keys" style={{ marginTop: 14 }}>
            <div className="sectionHead">
              <div>
                <div className="sectionKicker">Active</div>
                <div className="sectionTitle">Keys</div>
              </div>
              <button type="button" className="btnGhost" onClick={() => load()} disabled={loading}>
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            <div className="table">
              <div className="row head">
                <div className="cell">Name</div>
                <div className="cell">Prefix</div>
                <div className="cell">Created</div>
                <div className="cell">Last used</div>
                <div className="cell right">Action</div>
              </div>

              {loading ? (
                <div className="row">
                  <div className="cell" style={{ opacity: 0.8 }}>Loading…</div>
                  <div className="cell" />
                  <div className="cell" />
                  <div className="cell" />
                  <div className="cell" />
                </div>
              ) : activeKeys.length === 0 ? (
                <div className="row">
                  <div className="cell" style={{ opacity: 0.8 }}>No active keys yet.</div>
                  <div className="cell" />
                  <div className="cell" />
                  <div className="cell" />
                  <div className="cell" />
                </div>
              ) : (
                activeKeys.map((k) => (
                  <div className="row" key={k.id}>
                    <div className="cell">
                      <div style={{ fontWeight: 900 }}>{k.name}</div>
                      <div className="mutedSmall">{k.id}</div>
                    </div>
                    <div className="cell">
                      <code className="inlineCode">{k.prefix}</code>
                    </div>
                    <div className="cell">{fmt(k.createdAt)}</div>
                    <div className="cell">{fmt(k.lastUsedAt ?? null)}</div>
                    <div className="cell right">
                      <button
                        type="button"
                        className="btnDanger"
                        disabled={revoking === k.id || !authed}
                        onClick={() => revokeKey(k.id)}
                      >
                        {revoking === k.id ? "Revoking…" : "Revoke"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Revoked keys */}
          {revokedKeys.length ? (
            <section className="sectionCard" aria-label="Revoked API keys" style={{ marginTop: 14 }}>
              <div className="sectionHead">
                <div>
                  <div className="sectionKicker">History</div>
                  <div className="sectionTitle">Revoked Keys</div>
                </div>
                <div className="sectionHint">Revoked keys can’t be used again.</div>
              </div>

              <div className="table">
                <div className="row head">
                  <div className="cell">Name</div>
                  <div className="cell">Prefix</div>
                  <div className="cell">Created</div>
                  <div className="cell">Revoked</div>
                </div>

                {revokedKeys.map((k) => (
                  <div className="row" key={k.id}>
                    <div className="cell">
                      <div style={{ fontWeight: 900 }}>{k.name}</div>
                      <div className="mutedSmall">{k.id}</div>
                    </div>
                    <div className="cell">
                      <code className="inlineCode">{k.prefix}</code>
                    </div>
                    <div className="cell">{fmt(k.createdAt)}</div>
                    <div className="cell">{fmt(k.revokedAt ?? null)}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div style={hrStyle} />

          <div style={footerRowStyle}>
            <Link href="/" style={btnGhostStyle}>Back</Link>
            <Link href="/privacy" style={btnGhostStyle}>Privacy</Link>
          </div>
        </main>
      </div>
    </div>
  );
}

/* -------------------- styles -------------------- */

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(1200px 800px at 20% 10%, rgba(120,255,231,.10), transparent 55%)," +
    "radial-gradient(900px 700px at 80% 20%, rgba(140,155,255,.08), transparent 60%)," +
    "linear-gradient(180deg,#05070e,#070b18)",
  color: "white",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  padding: 16
};

const wrapStyle: React.CSSProperties = { maxWidth: 1040, margin: "0 auto" };

const cardStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 22,
  padding: 22,
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.14)",
  boxShadow: "0 18px 50px rgba(0,0,0,.55)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)"
};

const h1Style: React.CSSProperties = { margin: 0, fontSize: 22, letterSpacing: 0.2 };
const pStyle: React.CSSProperties = { marginTop: 10, lineHeight: 1.55, fontSize: 13, color: "rgba(255,255,255,.82)" };

const hrStyle: React.CSSProperties = {
  height: 1,
  background: "linear-gradient(90deg, transparent, rgba(120,255,231,.30), rgba(150,170,255,.20), transparent)",
  opacity: 0.9,
  margin: "16px 0"
};

const errorStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,138,160,.35)",
  background: "rgba(255,138,160,.10)",
  color: "rgba(255,255,255,.92)",
  fontSize: 13
};

const noticeStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 14,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,.14)",
  background: "rgba(0,0,0,.22)"
};

const footerRowStyle: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 };

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,.16)",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 800
};

const btnPrimaryStyle: React.CSSProperties = {
  ...btnBase,
  background: "#78ffe7",
  color: "#05070e",
  borderColor: "rgba(120,255,231,.55)"
};

const btnGhostStyle: React.CSSProperties = {
  ...btnBase,
  background: "rgba(255,255,255,.06)",
  color: "rgba(255,255,255,.92)"
};

const css = `
.portalTopbar{
  display:grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items:center;
  padding: 14px 6px;
}
.portalBrand{
  display:flex;
  align-items:center;
  gap: 12px;
  min-width: 0;
}
.portalDot{
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(120,255,231,.92);
  box-shadow: 0 0 0 3px rgba(120,255,231,.14), 0 0 18px rgba(120,255,231,.22);
  flex: 0 0 auto;
}
.portalBrandText{ min-width:0; }
.portalTitle{
  font-weight: 900;
  letter-spacing: .2px;
  font-size: 13px;
  white-space: nowrap;
}
.portalSub{
  opacity: .7;
  font-size: 12px;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 54vw;
}
.portalNav{
  display:flex;
  gap: 10px;
  white-space: nowrap;
  flex-wrap: nowrap;
  align-items:center;
  justify-content:flex-end;
}
.portalNavLink{
  text-decoration:none;
  color: rgba(255,255,255,.9);
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  padding: 8px 10px;
  border-radius: 12px;
  flex: 0 0 auto;
}
.portalNavLink:hover{ background: rgba(255,255,255,.09); }

.topRow{
  display:flex;
  justify-content:space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.currentPill{
  border-radius: 999px;
  padding: 10px 12px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.22);
  display:inline-flex;
  gap: 10px;
  align-items:center;
  white-space: nowrap;
}

.sectionCard{
  margin-top: 14px;
  border-radius: 18px;
  padding: 16px;
  background: rgba(0,0,0,.18);
  border: 1px solid rgba(255,255,255,.12);
}
.sectionHead{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap: 12px;
  flex-wrap: wrap;
}
.sectionKicker{
  font-size: 11px;
  opacity: .65;
}
.sectionTitle{
  font-weight: 950;
  margin-top: 4px;
}
.sectionHint{
  font-size: 12px;
  opacity: .7;
  max-width: 420px;
}

.formRow{
  margin-top: 12px;
  display:flex;
  gap: 10px;
  flex-wrap: wrap;
}
.input{
  flex: 1 1 260px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.22);
  padding: 10px 12px;
  color: rgba(255,255,255,.92);
  outline: none;
}
.input::placeholder{ color: rgba(255,255,255,.45); }
.input:focus{ border-color: rgba(120,255,231,.35); }

.btnPrimary{
  border-radius: 14px;
  padding: 10px 14px;
  font-weight: 900;
  border: 1px solid rgba(120,255,231,.55);
  background: rgba(120,255,231,.95);
  color: #05070e;
  cursor: pointer;
}
.btnPrimary:disabled{ opacity: .65; cursor: not-allowed; }

.btnGhost{
  border-radius: 14px;
  padding: 10px 14px;
  font-weight: 900;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  cursor: pointer;
}

.btnDanger{
  border-radius: 14px;
  padding: 9px 12px;
  font-weight: 900;
  border: 1px solid rgba(255,138,160,.40);
  background: rgba(255,138,160,.10);
  color: rgba(255,255,255,.92);
  cursor: pointer;
}
.btnDanger:disabled{ opacity:.65; cursor:not-allowed; }

.secretBox{
  margin-top: 12px;
  border-radius: 16px;
  border: 1px solid rgba(120,255,231,.28);
  background: rgba(120,255,231,.08);
  padding: 12px;
}
.secretTitle{ font-weight: 950; }
.secretSub{ font-size: 12px; opacity: .75; margin-top: 4px; }
.secretCode{
  margin-top: 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.25);
  padding: 10px;
  overflow:auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace;
  font-size: 12px;
  color: rgba(255,255,255,.92);
}
.secretFoot{
  margin-top: 10px;
  font-size: 12px;
  opacity: .8;
}
.inlineCode{
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
}

.table{
  margin-top: 12px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.12);
  overflow: hidden;
}
.row{
  display:grid;
  grid-template-columns: 1.4fr 1.2fr 1fr 1fr 0.8fr;
  gap: 10px;
  padding: 12px;
  border-top: 1px solid rgba(255,255,255,.08);
  align-items:center;
}
.row.head{
  border-top: 0;
  background: rgba(255,255,255,.04);
  font-size: 12px;
  opacity: .85;
}
.cell{ min-width: 0; }
.right{ text-align: right; }
.mutedSmall{ font-size: 11px; opacity: .6; margin-top: 4px; }

@media (max-width: 820px){
  .portalTopbar{
    grid-template-columns: 1fr;
    align-items:start;
    gap: 10px;
  }
  .portalNav{
    justify-content:flex-start;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: 2px;
  }
  .portalNav::-webkit-scrollbar{ display:none; }

  .row{
    grid-template-columns: 1fr;
    gap: 8px;
    text-align: left;
  }
  .right{ text-align: left; }
}
`;