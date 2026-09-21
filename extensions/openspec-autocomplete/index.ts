import type {
  ExtensionAPI,
  ExtensionContext,
  SessionStartEvent,
} from "@earendil-works/pi-coding-agent";
import type {
  AutocompleteItem,
  AutocompleteProvider,
  AutocompleteSuggestions,
} from "@earendil-works/pi-tui";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface OpenSpecTrigger {
  prefix: string;
  filter: string;
  isQuoted: boolean;
}

const OPENSPEC_AUTOCOMPLETE_WRAPPED = Symbol.for("pi.openspec.autocomplete.wrapped");

/**
 * Locate the nearest openspec/changes directory by traversing upward from startDir.
 */
export function findChangesDir(startDir: string): string | null {
  let current = resolve(startDir);
  while (true) {
    const candidate = join(current, "openspec", "changes");
    try {
      if (existsSync(candidate) && statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // Ignore filesystem permission or access errors
    }
    const parent = dirname(current);
    if (parent === current) {
      break; // Reached filesystem root
    }
    current = parent;
  }
  return null;
}

/**
 * Retrieve active change names, excluding hidden directories, files, and 'archive'.
 */
export function getActiveChanges(cwd: string): string[] {
  const changesDir = findChangesDir(cwd);
  if (!changesDir) return [];

  try {
    const entries = readdirSync(changesDir, { withFileTypes: true });
    return entries
      .filter((entry) => {
        if (!entry.isDirectory()) return false;
        if (entry.name.startsWith(".")) return false;
        if (entry.name === "archive") return false;
        return true;
      })
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/**
 * Check if the text before cursor matches an OpenSpec prompt template or --change flag.
 */
export function matchOpenSpecTrigger(textBeforeCursor: string): OpenSpecTrigger | null {
  // Matches /opsx or /opsx-<subcommand> followed by whitespace and an optional argument
  // e.g. "/opsx ", "/opsx-apply ", "/opsx-archive 1-", "/opsx-sync \"1-"
  const opsxMatch = textBeforeCursor.match(/^\/opsx(?:-[\w-]+)?\s+("[^"]*|'[^']*|[^\s]*)$/);
  if (opsxMatch) {
    const raw = opsxMatch[1] ?? "";
    const isQuoted = raw.startsWith('"') || raw.startsWith("'");
    const filter = isQuoted ? raw.slice(1) : raw;
    return { prefix: raw, filter, isQuoted };
  }

  // Matches --change followed by space or '=' and an optional argument
  // e.g. "openspec status --change ", "openspec instructions apply --change 1-", "--change=1-"
  const changeFlagMatch = textBeforeCursor.match(/(?:^|\s)--change(?:=|\s+)("[^"]*|'[^']*|[^\s]*)$/);
  if (changeFlagMatch) {
    const raw = changeFlagMatch[1] ?? "";
    const isQuoted = raw.startsWith('"') || raw.startsWith("'");
    const filter = isQuoted ? raw.slice(1) : raw;
    return { prefix: raw, filter, isQuoted };
  }

  return null;
}

/**
 * Create OpenSpec autocomplete provider wrapper for Pi TUI with idempotency guard.
 */
export function createOpenSpecAutocompleteProvider(
  baseProvider: AutocompleteProvider,
  cwd: string
): AutocompleteProvider {
  if ((baseProvider as any)[OPENSPEC_AUTOCOMPLETE_WRAPPED]) {
    return baseProvider;
  }

  const provider: AutocompleteProvider = {
    triggerCharacters: baseProvider.triggerCharacters,

    async getSuggestions(lines, cursorLine, cursorCol, options): Promise<AutocompleteSuggestions | null> {
      const currentLine = lines[cursorLine] ?? "";
      const textBeforeCursor = currentLine.slice(0, cursorCol);

      const trigger = matchOpenSpecTrigger(textBeforeCursor);
      if (trigger) {
        const changes = getActiveChanges(cwd);
        const filterLower = trigger.filter.toLowerCase();
        const matches = changes.filter((name) => name.toLowerCase().includes(filterLower));

        if (matches.length > 0) {
          const quoteChar = trigger.isQuoted && trigger.prefix.startsWith("'") ? "'" : '"';
          const items: AutocompleteItem[] = matches.map((name) => {
            const needsQuotes = trigger.isQuoted || name.includes(" ");
            const value = needsQuotes ? `${quoteChar}${name}${quoteChar}` : name;
            return {
              value,
              label: name,
              description: "OpenSpec change",
            };
          });

          return {
            prefix: trigger.prefix,
            items,
          };
        }
      }

      return baseProvider.getSuggestions(lines, cursorLine, cursorCol, options);
    },

    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      return baseProvider.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
    },

    shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
      const currentLine = lines[cursorLine] ?? "";
      const textBeforeCursor = currentLine.slice(0, cursorCol);
      if (matchOpenSpecTrigger(textBeforeCursor)) {
        return true;
      }
      return baseProvider.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
    },
  };

  (provider as any)[OPENSPEC_AUTOCOMPLETE_WRAPPED] = true;
  return provider;
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event: SessionStartEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;

    ctx.ui.addAutocompleteProvider((baseProvider: AutocompleteProvider) =>
      createOpenSpecAutocompleteProvider(baseProvider, ctx.cwd)
    );
  });
}
