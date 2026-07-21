# Custom Pi Extensions

Place your custom TypeScript/JavaScript extensions (`*.ts` or `*.js`) in this directory. They will be loaded automatically on startup and can be hot-reloaded using `/reload` in the Pi interactive interface.

## Example Extension Structure (`hello.ts`)
```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("My custom extension loaded successfully!", "info");
  });
}
```
