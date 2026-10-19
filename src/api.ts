import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save, confirm } from "@tauri-apps/plugin-dialog";
import type { Snapshot } from "./model";
export const desktop = isTauri();
export interface McpConfig {
  bindHost: string;
  port: number;
  certificatePath: string;
  privateKeyPath: string;
  allowPrivateNetworkHttp: boolean;
  allowedHosts: string[];
  allowedOrigins: string[];
}
export interface McpStatus {
  config: McpConfig;
  token: string;
  running: boolean;
  endpoint: string;
  workspace: string | null;
  error: string | null;
}
export async function mcpControl(
  action: "status" | "start" | "stop" | "save" | "rotate_token",
  config?: McpConfig,
): Promise<McpStatus> {
  if (!desktop) throw new Error("MCP sharing is available in the desktop app.");
  return invoke("mcp_control", { action, config: config ?? null });
}
export const confirmAction = async (message: string) =>
  desktop
    ? confirm(message, { title: "WorkLog", kind: "warning" })
    : window.confirm(message);
export async function request(
  action: string,
  payload: unknown = {},
): Promise<Snapshot> {
  if (!desktop)
    throw new Error(
      "Open the desktop app to access files. Browser preview does not save your work.",
    );
  return invoke("dispatch", { action, payload });
}
export async function directory() {
  if (!desktop)
    throw new Error("Folder selection is available in the desktop app.");
  return open({ directory: true, multiple: false });
}
export async function readDocument(
  root: string,
  path: string,
): Promise<Uint8Array> {
  if (!desktop) {
    const samples: Record<string, string> = {
      "projects/sample/notes/Sample.svg": "/preview/Sample.svg",
      "projects/sample/notes/Sample.pdf": "/preview/Sample.pdf",
    };
    if (root !== "Desktop preview · files are not connected" || !samples[path])
      throw new Error("Open the desktop app to view project files.");
    const response = await fetch(samples[path]);
    if (!response.ok) throw new Error("Preview file is unavailable");
    return new Uint8Array(await response.arrayBuffer());
  }
  return new Uint8Array(
    await invoke<ArrayBuffer>("read_document", { root, path }),
  );
}
export async function exportFile(
  content: string,
  from: string,
  through: string,
) {
  const path = await save({
    defaultPath: `worklog-report_${from}_to_${through}.md`,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (path) await invoke("export_report", { path, content });
}
