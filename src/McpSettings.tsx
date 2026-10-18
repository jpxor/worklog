import { useEffect, useState } from "react";
import { desktop, mcpControl, type McpConfig, type McpStatus } from "./api";

export default function McpSettings() {
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [config, setConfig] = useState<McpConfig | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!desktop) return;
    let active = true;
    mcpControl("status")
      .then((value) => {
        if (active) {
          setStatus(value);
          setConfig(value.config);
        }
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    const id = setInterval(() => {
      mcpControl("status")
        .then((value) => {
          if (active) setStatus(value);
        })
        .catch((e) => {
          if (active) setError(String(e));
        });
    }, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);
  const update = async (action: "start" | "stop" | "save" | "rotate_token") => {
    if (!config) return;
    setBusy(true);
    setError("");
    try {
      const result = await mcpControl(
        action,
        action === "start" || action === "save" ? config : undefined,
      );
      setStatus(result);
      setConfig(result.config);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mcp-settings" aria-label="LLM data access">
      <h3>LLM data access (MCP)</h3>
      <p className="muted small">
        Local and remote LLM apps use the same MCP Streamable HTTP endpoint.
        Sharing provides read-only access to saved notes, time entries and Git
        history in the selected workspace. The LLM creates summaries and follows
        links using its own tools.
      </p>
      {!desktop ? (
        <p>Available in the desktop app.</p>
      ) : !status || !config ? (
        <p role="status">{error || "Loading connection settings…"}</p>
      ) : (
        <>
          <p role="status">
            <strong>
              {status.running ? "Sharing is running" : "Sharing is off"}
            </strong>
            {status.running && status.workspace && <> · {status.workspace}</>}
          </p>
          {(error || status.error) && (
            <p role="alert" className="shortcut-error">
              {error || status.error}
            </p>
          )}
          <fieldset disabled={busy || status.running}>
            <label>
              Listen IP address
              <input
                value={config.bindHost}
                onChange={(e) =>
                  setConfig({ ...config, bindHost: e.target.value })
                }
                placeholder="127.0.0.1"
              />
            </label>
            <label>
              Port
              <input
                type="number"
                min={1}
                max={65535}
                value={config.port}
                onChange={(e) =>
                  setConfig({ ...config, port: Number(e.target.value) })
                }
              />
            </label>
            <p className="muted small">
              Use 127.0.0.1 for this computer, or your specific
              corporate-network interface IP for remote access. Network access
              requires TLS; your LLM server must be able to reach this computer
              and trust the certificate.
            </p>
            <label>
              TLS certificate file (PEM)
              <input
                value={config.certificatePath}
                onChange={(e) =>
                  setConfig({ ...config, certificatePath: e.target.value })
                }
                placeholder="Full path to certificate chain"
              />
            </label>
            <label>
              TLS private key file (PEM)
              <input
                value={config.privateKeyPath}
                onChange={(e) =>
                  setConfig({ ...config, privateKeyPath: e.target.value })
                }
                placeholder="Full path to private key"
              />
            </label>
            <label>
              Additional endpoint hostnames (one per line)
              <textarea
                rows={2}
                value={config.allowedHosts.join("\n")}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    allowedHosts: e.target.value.split("\n"),
                  })
                }
                onBlur={() =>
                  setConfig(
                    (value) =>
                      value && {
                        ...value,
                        allowedHosts: value.allowedHosts
                          .map((host) => host.trim())
                          .filter(Boolean),
                      },
                  )
                }
              />
            </label>
            <label>
              Allowed browser origins (one per line)
              <textarea
                rows={2}
                value={config.allowedOrigins.join("\n")}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    allowedOrigins: e.target.value.split("\n"),
                  })
                }
                onBlur={() =>
                  setConfig(
                    (value) =>
                      value && {
                        ...value,
                        allowedOrigins: value.allowedOrigins
                          .map((origin) => origin.trim())
                          .filter(Boolean),
                      },
                  )
                }
              />
            </label>
            <p className="muted small">
              Usually leave these lists empty. Endpoint hostnames are names
              clients use to reach this computer, not caller IP addresses. An
              Origin is the requesting website URL, such as
              https://llm.mycompany.internal. Server-to-server clients normally
              send no Origin header. If one is sent, explicitly allow it here.
            </p>
          </fieldset>
          <label>
            MCP endpoint
            <input readOnly value={status.endpoint} />
          </label>
          <label>
            Bearer token
            <input
              readOnly
              type={revealed ? "text" : "password"}
              value={status.token}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button type="button" onClick={() => setRevealed((value) => !value)}>
            {revealed ? "Hide token" : "Show token"}
          </button>
          <p className="muted small">
            Configure your harness with this URL and an Authorization: Bearer
            header containing the token. Anyone with the token and network
            access can read this workspace. Keep WorkLog running; sharing starts
            manually after each app launch. Switching workspaces requires
            restarting sharing. Unsaved drafts and binary attachment contents
            are excluded.
          </p>
          <div className="settings-actions">
            <button
              type="button"
              disabled={busy || status.running}
              onClick={() => update("save")}
            >
              Save connection settings
            </button>
            <button
              type="button"
              className={status.running ? "" : "primary"}
              disabled={busy}
              onClick={() => update(status.running ? "stop" : "start")}
            >
              {status.running ? "Stop sharing" : "Start sharing"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => update("rotate_token")}
            >
              Rotate token and stop sharing
            </button>
          </div>
        </>
      )}
    </section>
  );
}
