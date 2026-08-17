/**
 * pi-vertex-filter - Configurable model filtering wrapper for @lhl/pi-vertex
 *
 * Filters out unwanted models (e.g. Grok, Claude, Gemini) while registering
 * Vertex Model-as-a-Service (MaaS) open models (Llama, Mistral, DeepSeek, Qwen, GLM, etc.).
 *
 * Configuration resolution (first found wins, merged over defaults):
 *   1. <workspace>/.pi/vertex-filter.json
 *   2. ~/.pi/agent/vertex-filter.json
 *   3. ~/.pi/agent/settings/pi-vertex.json
 *
 * Example vertex-filter.json:
 *   {
 *     "excludePublishers": ["xai", "anthropic", "google"],
 *     "excludePatterns": ["grok-*", "claude-*", "gemini-*"],
 *     "includePublishers": [],
 *     "includeModels": []
 *   }
 */

import type { Api, Context, Model } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
  InputEvent,
  SessionStartEvent,
} from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ALL_MODELS,
  getModelById,
  hasAdcCredentials,
  loadConfig,
  resolveProjectId,
  streamVertex,
  type StreamOptions,
  type VertexModelConfig,
} from "@lhl/pi-vertex";

export interface VertexFilterConfig {
  /** Model publishers to exclude (e.g. "xai", "anthropic", "google") */
  excludePublishers?: string[];
  /** Model ID glob/prefix patterns to exclude (e.g. "grok-*") */
  excludePatterns?: string[];
  /** Model publishers to explicitly include (overrides exclude rules) */
  includePublishers?: string[];
  /** Specific model IDs to explicitly include (overrides exclude rules) */
  includeModels?: string[];
}

const DEFAULT_FILTER: VertexFilterConfig = {
  excludePublishers: ["xai", "anthropic", "google"],
  excludePatterns: ["grok-*", "claude-*", "gemini-*"],
};

function loadFilterConfig(cwd: string): VertexFilterConfig {
  const home = process.env.HOME || "/home/pi";
  const searchPaths = [
    join(cwd, ".pi", "vertex-filter.json"),
    join(home, ".pi", "agent", "vertex-filter.json"),
    join(home, ".pi", "agent", "settings", "pi-vertex.json"),
  ];

  for (const configPath of searchPaths) {
    if (existsSync(configPath)) {
      try {
        const raw = readFileSync(configPath, "utf-8");
        const parsed = JSON.parse(raw) as VertexFilterConfig;
        return {
          excludePublishers: parsed.excludePublishers ?? DEFAULT_FILTER.excludePublishers,
          excludePatterns: parsed.excludePatterns ?? DEFAULT_FILTER.excludePatterns,
          includePublishers: parsed.includePublishers ?? DEFAULT_FILTER.includePublishers,
          includeModels: parsed.includeModels ?? DEFAULT_FILTER.includeModels,
        };
      } catch (err) {
        console.warn(`[pi-vertex-filter] Failed to parse ${configPath}: ${err}`);
      }
    }
  }

  return DEFAULT_FILTER;
}

function matchesFilter(model: VertexModelConfig, filter: VertexFilterConfig): boolean {
  // Explicit inclusions take highest priority
  if (filter.includeModels?.includes(model.id)) return true;
  if (filter.includePublishers?.includes(model.publisher)) return true;

  // Exclude by publisher
  if (filter.excludePublishers?.includes(model.publisher)) return false;

  // Exclude by glob / prefix pattern
  if (
    filter.excludePatterns?.some((pat) => {
      if (pat.endsWith("*")) return model.id.startsWith(pat.slice(0, -1));
      return model.id === pat;
    })
  ) {
    return false;
  }

  return true;
}

function toPiModel(config: VertexModelConfig): Model<Api> {
  return {
    id: config.id,
    name: config.name,
    api: "vertex-unified",
    provider: "vertex",
    baseUrl: "https://aiplatform.googleapis.com",
    reasoning: config.reasoning,
    input: config.input,
    cost: config.cost,
    contextWindow: config.contextWindow,
    maxTokens: config.maxTokens,
    headers: {},
  };
}

export default function (pi: ExtensionAPI) {
  const config = loadConfig();

  // Apply credentialsFile to environment so all Google SDKs pick it up
  if (config.googleApplicationCredentials && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = config.googleApplicationCredentials;
  }

  const projectId = resolveProjectId();
  if (!projectId || !hasAdcCredentials()) {
    return;
  }

  const filter = loadFilterConfig(process.cwd());
  const models = ALL_MODELS.filter((m) => matchesFilter(m, filter));

  // Register provider with filtered models
  pi.registerProvider("vertex", {
    baseUrl: "https://aiplatform.googleapis.com",
    apiKey: "GOOGLE_CLOUD_PROJECT",
    api: "vertex-unified",
    models: models.map(toPiModel),
    streamSimple: (model: Model<Api>, context: Context, options?: StreamOptions) => {
      const vertexModel = getModelById(model.id);
      if (!vertexModel) {
        throw new Error(`Unknown Vertex model: ${model.id}`);
      }
      return streamVertex(vertexModel, context, options);
    },
  });

  const startupLines = [
    `   [pi-vertex-filter] Project: ${projectId}`,
    `   [pi-vertex-filter] Registered ${models.length} MaaS models`,
  ];

  pi.on("session_start", async (_event: SessionStartEvent, ctx: ExtensionContext) => {
    ctx.ui.setWidget("pi-vertex-startup", (_tui: unknown, theme: { fg: (color: string, text: string) => string }) => ({
      render: () => [...startupLines.map((l: string) => theme.fg("muted", l)), ""],
      invalidate: () => {},
    }));
  });

  pi.on("input", async (_event: InputEvent, ctx: ExtensionContext) => {
    ctx.ui.setWidget("pi-vertex-startup", undefined);
  });
}
