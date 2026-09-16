import type { ExtensionAPI, ExtensionContext, SessionStartEvent } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const containerName = process.env.CONTAINER_NAME || process.env.HOSTNAME;

function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
  return `${Math.round(count / 1000000)}M`;
}

export default function (pi: ExtensionAPI) {
  if (!containerName) return;

  pi.on("session_start", async (_event: SessionStartEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;

    // Set terminal window/tab title
    ctx.ui.setTitle(`π [${containerName}]`);

    // Clear any previous container status text so no extra bottom line is drawn
    ctx.ui.setStatus("container", undefined);

    // Custom 2-line footer:
    // Line 1: 📦 <container-name> • /workspace (branch)
    // Line 2: Stats (tokens, cost, context %) and Model name
    ctx.ui.setFooter((tui, theme, footerData) => {
      const unsub = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: unsub,
        invalidate() {},
        render(width: number): string[] {
          // Line 1: Container name and workspace/branch
          const branch = footerData.getGitBranch();
          const branchStr = branch ? ` (${branch})` : "";
          const cwd = "/workspace";
          const leftLine1 = `${theme.fg("accent", `📦 ${containerName}`)} ${theme.fg("dim", `• ${cwd}${branchStr}`)}`;
          const line1 = truncateToWidth(leftLine1, width, theme.fg("dim", "..."));

          // Line 2: Stats & Model
          let input = 0;
          let output = 0;
          let cost = 0;
          for (const e of ctx.sessionManager.getEntries()) {
            if (e.type === "message" && e.message.role === "assistant" && e.message.usage) {
              input += e.message.usage.input;
              output += e.message.usage.output;
              if (e.message.usage.cost?.total) cost += e.message.usage.cost.total;
            }
          }

          const statsParts: string[] = [];
          if (input) statsParts.push(`↑${formatTokens(input)}`);
          if (output) statsParts.push(`↓${formatTokens(output)}`);
          if (cost > 0) statsParts.push(`$${cost.toFixed(3)}`);

          const usage = ctx.getContextUsage?.();
          if (usage && usage.contextWindow > 0) {
            const pct = usage.percent !== null && usage.percent !== undefined ? `${usage.percent.toFixed(1)}%` : "?";
            statsParts.push(`${pct}/${formatTokens(usage.contextWindow)}`);
          }

          const statsLeft = theme.fg("dim", statsParts.join(" "));
          const model = ctx.model;
          const modelName = model?.id || "no-model";
          const thinking = ctx.thinkingLevel ?? (typeof pi.getThinkingLevel === "function" ? pi.getThinkingLevel() : undefined);
          const rightText = thinking && thinking !== "off" ? `${modelName} • ${thinking}` : modelName;
          const statsRight = theme.fg("dim", rightText);

          const leftW = visibleWidth(statsLeft);
          const rightW = visibleWidth(statsRight);
          const padding = " ".repeat(Math.max(1, width - leftW - rightW));
          const line2 = truncateToWidth(statsLeft + padding + statsRight, width);

          return [line1, line2];
        },
      };
    });
  });
}
