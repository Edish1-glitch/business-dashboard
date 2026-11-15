import { prisma } from "@/lib/db";

/**
 * Append one audit row per MCP tool call. Never throws — logging must not break
 * a tool. Summaries must stay short and non-sensitive (no file bytes/tokens).
 */
export async function logMcpAction(params: {
  userId: string;
  clientId: string;
  tool: string;
  summary: string;
  ok: boolean;
  result?: string;
}): Promise<void> {
  try {
    await prisma.mcpActionLog.create({
      data: {
        userId: params.userId,
        clientId: params.clientId,
        tool: params.tool,
        summary: params.summary.slice(0, 400),
        ok: params.ok,
        result: params.result?.slice(0, 400) ?? null,
      },
    });
  } catch (e) {
    console.error("logMcpAction failed:", e);
  }
}
