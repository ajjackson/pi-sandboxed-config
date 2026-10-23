/**
 * pi-vertex-filter - Configurable model filtering wrapper for @lhl/pi-vertex
 *
 * Filters out unwanted models (e.g. Grok, Claude, Gemini) while registering
 * Vertex Model-as-a-Service (MaaS) open models (Llama, Mistral, DeepSeek, Qwen, GLM, etc.).
 *
 * Also provides built-in additions for newer MaaS models (e.g. DeepSeek V4.1 Flash)
 * and supports custom model registration via configuration.
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
 *     "includeModels": [],
 *     "customModels": [
 *       {
 *         "id": "deepseek-v4.1-flash",
 *         "name": "DeepSeek V4.1 Flash",
 *         "apiId": "deepseek-ai/deepseek-v4.1-flash-maas",
 *         "publisher": "deepseek-ai"
 *       }
 *     ]
 *   }
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Api, Context, Model } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionContext,
	InputEvent,
	SessionStartEvent,
} from "@earendil-works/pi-coding-agent";

import {
	ALL_MODELS,
	getModelById,
	hasAdcCredentials,
	loadConfig,
	resolveProjectId,
	type StreamOptions,
	streamVertex,
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
	/** Additional custom Vertex models to register */
	customModels?: VertexModelConfig[];
}

const DEFAULT_FILTER: VertexFilterConfig = {
	excludePublishers: ["xai", "anthropic", "google"],
	excludePatterns: ["grok-*", "claude-*", "gemini-*"],
};

/**
 * Built-in model additions for newer Vertex MaaS models not yet in @lhl/pi-vertex release.
 */
const BUILTIN_ADDITIONAL_MODELS: VertexModelConfig[] = [
	{
		id: "deepseek-v4.1-flash",
		name: "DeepSeek V4.1 Flash",
		apiId: "deepseek-ai/deepseek-v4.1-flash-maas",
		publisher: "deepseek-ai",
		endpointType: "maas",
		contextWindow: 1048576,
		maxTokens: 64000,
		input: ["text", "image"],
		reasoning: true,
		tools: true,
		cost: {
			input: 0.3,
			output: 1.2,
			cacheRead: 0.03,
			cacheWrite: 0,
		},
		region: "global",
	},
];

function normalizeCustomModel(
	raw: Partial<VertexModelConfig> & { id: string },
): VertexModelConfig {
	const publisher =
		raw.publisher ??
		(raw.apiId?.includes("/")
			? raw.apiId.split("/")[0]
			: raw.id.startsWith("deepseek")
				? "deepseek-ai"
				: "custom");
	const apiId =
		raw.apiId ?? (raw.id.includes("/") ? raw.id : `${publisher}/${raw.id}`);
	return {
		id: raw.id,
		name: raw.name ?? raw.id,
		apiId,
		publisher,
		endpointType: raw.endpointType ?? "maas",
		contextWindow: raw.contextWindow ?? 1048576,
		maxTokens: raw.maxTokens ?? 64000,
		input: raw.input ?? ["text"],
		reasoning: raw.reasoning ?? true,
		tools: raw.tools ?? true,
		cost: raw.cost ?? {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
		},
		costRegional: raw.costRegional,
		region: raw.region ?? "global",
	};
}

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
				const parsed = JSON.parse(raw) as VertexFilterConfig & {
					customModels?: Array<Partial<VertexModelConfig> & { id: string }>;
				};
				const customModels = Array.isArray(parsed.customModels)
					? parsed.customModels
							.filter(
								(m): m is Partial<VertexModelConfig> & { id: string } =>
									typeof m?.id === "string",
							)
							.map(normalizeCustomModel)
					: [];

				return {
					excludePublishers:
						parsed.excludePublishers ?? DEFAULT_FILTER.excludePublishers,
					excludePatterns:
						parsed.excludePatterns ?? DEFAULT_FILTER.excludePatterns,
					includePublishers:
						parsed.includePublishers ?? DEFAULT_FILTER.includePublishers,
					includeModels: parsed.includeModels ?? DEFAULT_FILTER.includeModels,
					customModels,
				};
			} catch (err) {
				console.warn(
					`[pi-vertex-filter] Failed to parse ${configPath}: ${err}`,
				);
			}
		}
	}

	return DEFAULT_FILTER;
}

function matchesFilter(
	model: VertexModelConfig,
	filter: VertexFilterConfig,
): boolean {
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
	if (
		config.googleApplicationCredentials &&
		!process.env.GOOGLE_APPLICATION_CREDENTIALS
	) {
		process.env.GOOGLE_APPLICATION_CREDENTIALS =
			config.googleApplicationCredentials;
	}

	const projectId = resolveProjectId();
	if (!projectId || !hasAdcCredentials()) {
		return;
	}

	const filter = loadFilterConfig(process.cwd());

	const modelMap = new Map<string, VertexModelConfig>();
	for (const m of ALL_MODELS) {
		modelMap.set(m.id, m);
	}
	for (const m of BUILTIN_ADDITIONAL_MODELS) {
		if (!modelMap.has(m.id)) {
			modelMap.set(m.id, m);
		}
	}
	for (const m of filter.customModels ?? []) {
		modelMap.set(m.id, m);
	}

	const allAvailableModels = Array.from(modelMap.values());
	const models = allAvailableModels.filter((m) => matchesFilter(m, filter));

	// Register provider with filtered models
	pi.registerProvider("vertex", {
		baseUrl: "https://aiplatform.googleapis.com",
		apiKey: "GOOGLE_CLOUD_PROJECT",
		api: "vertex-unified",
		models: models.map(toPiModel),
		streamSimple: (
			model: Model<Api>,
			context: Context,
			options?: StreamOptions,
		) => {
			const vertexModel =
				modelMap.get(model.id) ??
				getModelById(model.id) ??
				allAvailableModels.find(
					(m) => m.apiId === model.id || m.apiId.endsWith(`/${model.id}`),
				);
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

	pi.on(
		"session_start",
		async (_event: SessionStartEvent, ctx: ExtensionContext) => {
			ctx.ui.setWidget(
				"pi-vertex-startup",
				(
					_tui: unknown,
					theme: { fg: (color: string, text: string) => string },
				) => ({
					render: () => [
						...startupLines.map((l: string) => theme.fg("muted", l)),
						"",
					],
					invalidate: () => {},
				}),
			);
		},
	);

	pi.on("input", async (_event: InputEvent, ctx: ExtensionContext) => {
		ctx.ui.setWidget("pi-vertex-startup", undefined);
	});
}
