import type { ExtensionAPI, ExtensionContext, SessionStartEvent } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const containerName = process.env.CONTAINER_NAME || process.env.HOSTNAME;
  if (!containerName) return;

  pi.on("session_start", async (_event: SessionStartEvent, ctx: ExtensionContext) => {
    if (ctx.hasUI) {
      // Display container name in the persistent footer status
      ctx.ui.setStatus("container", ctx.ui.theme.fg("accent", `📦 ${containerName}`));
      // Update terminal tab/window title
      ctx.ui.setTitle(`π [${containerName}]`);
    }
  });
}
