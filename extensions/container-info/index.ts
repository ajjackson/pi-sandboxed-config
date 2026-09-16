import type { ExtensionAPI, ExtensionContext, SessionStartEvent } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { existsSync, readFileSync, statSync, watch, type FSWatcher } from "node:fs";
import { dirname, join, resolve } from "node:path";

const containerName = process.env.CONTAINER_NAME || process.env.HOSTNAME;

function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
  return `${Math.round(count / 1000000)}M`;
}

/**
 * Locate the HEAD file for the current workspace.
 * Handles standard repositories (.git is a directory) and Git worktrees (.git is a file with gitdir: ...).
 */
function findGitHeadPath(cwd = "/workspace"): string | null {
  try {
    const gitPath = join(cwd, ".git");
    if (!existsSync(gitPath)) return null;

    const stat = statSync(gitPath);
    if (stat.isFile()) {
      const content = readFileSync(gitPath, "utf8").trim();
      if (content.startsWith("gitdir: ")) {
        const rawPath = content.slice(8).trim();
        const gitDir = resolve(cwd, rawPath);
        const headPath = join(gitDir, "HEAD");
        if (existsSync(headPath)) return headPath;
      }
    } else if (stat.isDirectory()) {
      const headPath = join(gitPath, "HEAD");
      if (existsSync(headPath)) return headPath;
    }
  } catch {
    // Ignore read errors
  }
  return null;
}

/**
 * Read the current Git ref directly from HEAD.
 * Returns the branch name if on a branch, or the 8-character commit hash if in a detached worktree.
 */
function readLiveGitRef(headPath: string | null): string | null {
  if (!headPath) return null;
  try {
    const content = readFileSync(headPath, "utf8").trim();
    if (content.startsWith("ref: refs/heads/")) {
      return content.slice(16);
    }
    // Detached HEAD: contains raw commit hash (40 hex characters) -> return 8-char short hash
    if (/^[0-9a-fA-F]{40}$/.test(content)) {
      return content.slice(0, 8);
    }
    return content.slice(0, 8);
  } catch {
    return null;
  }
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
    // Line 1: 📦 <container-name> • (<branch-or-commit>) • /workspace
    // Line 2: Stats (tokens, cost, context %) and Model name
    ctx.ui.setFooter((tui, theme, footerData) => {
      const headPath = findGitHeadPath();

      // Watch HEAD's directory for changes (atomic writes when commits/resets occur on the host)
      let watcher: FSWatcher | null = null;
      if (headPath) {
        try {
          watcher = watch(dirname(headPath), (_eventType, filename) => {
            if (!filename || filename === "HEAD") {
              tui.requestRender();
            }
          });
        } catch {
          // Ignore watch errors (e.g. if watching not supported on mount)
        }
      }

      const unsubBranch = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose() {
          watcher?.close();
          unsubBranch();
        },
        invalidate() {},
        render(width: number): string[] {
          // Line 1: Container name, live git branch or 8-char commit hash, and workspace
          let gitRef = readLiveGitRef(headPath);
          if (!gitRef) {
            const footerBranch = footerData.getGitBranch();
            gitRef = footerBranch && footerBranch !== "detached"
              ? footerBranch
              : (process.env.GIT_REF || process.env.GIT_BRANCH || (footerBranch === "detached" ? footerBranch : null));
          }

          const gitPart = gitRef ? ` • (${gitRef})` : "";
          const cwd = "/workspace";
          const leftLine1 = `${theme.fg("accent", `📦 ${containerName}`)}${theme.fg("dim", `${gitPart} • ${cwd}`)}`;
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
