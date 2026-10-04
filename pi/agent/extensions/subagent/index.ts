/**
 * Subagent Tool - Delegate tasks to specialized agents
 *
 * Spawns a separate `pi` process for each subagent invocation,
 * giving it an isolated context window.
 *
 * Supports three modes:
 *   - Single: { agent: "name", task: "..." }
 *   - Parallel: { tasks: [{ agent: "name", task: "..." }, ...] }
 *   - Chain: { chain: [{ agent: "name", task: "... {previous} ..." }, ...] }
 *
 * Uses JSON mode to capture structured output from subagents.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentToolResult, ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Message } from "@earendil-works/pi-ai";
import { StringEnum } from "@earendil-works/pi-ai";
import { CONFIG_DIR_NAME, type ExtensionAPI, type ExtensionContext, getAgentDir, getMarkdownTheme, withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { type AgentConfig, type AgentScope, discoverAgents } from "./agents.ts";

const MAX_PARALLEL_TASKS = 32;
const MAX_CONCURRENCY = 3;
const MAX_CONCURRENCY_CAP = 16;
const COLLAPSED_ITEM_COUNT = 10;
const BRIEF_OUTPUT_CAP = 8 * 1024;
const FULL_OUTPUT_CAP = 50 * 1024;
const BRIEF_TASK_SUFFIX = "\n\nReport concise findings, relevant paths, checks run, and unknowns.";
const FULL_TASK_SUFFIX = "\n\nProvide the full requested detail.";

function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	return `${(count / 1000000).toFixed(1)}M`;
}

function formatUsageStats(
	usage: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		cost: number;
		contextTokens?: number;
		turns?: number;
	},
	model?: string,
): string {
	const parts: string[] = [];
	if (usage.turns) parts.push(`${usage.turns} turn${usage.turns > 1 ? "s" : ""}`);
	if (usage.input) parts.push(`↑${formatTokens(usage.input)}`);
	if (usage.output) parts.push(`↓${formatTokens(usage.output)}`);
	if (usage.cacheRead) parts.push(`R${formatTokens(usage.cacheRead)}`);
	if (usage.cacheWrite) parts.push(`W${formatTokens(usage.cacheWrite)}`);
	if (usage.cost) parts.push(`$${usage.cost.toFixed(4)}`);
	if (usage.contextTokens && usage.contextTokens > 0) {
		parts.push(`ctx:${formatTokens(usage.contextTokens)}`);
	}
	if (model) parts.push(model);
	return parts.join(" ");
}

function formatToolCall(toolName: string, args: Record<string, unknown>, themeFg: (color: any, text: string) => string): string {
	const shortenPath = (p: string) => {
		const home = os.homedir();
		return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
	};

	switch (toolName) {
		case "bash": {
			const command = (args.command as string) || "...";
			const preview = command.length > 60 ? `${command.slice(0, 60)}...` : command;
			return themeFg("muted", "$ ") + themeFg("toolOutput", preview);
		}
		case "read": {
			const rawPath = (args.file_path || args.path || "...") as string;
			const filePath = shortenPath(rawPath);
			const offset = args.offset as number | undefined;
			const limit = args.limit as number | undefined;
			let text = themeFg("accent", filePath);
			if (offset !== undefined || limit !== undefined) {
				const startLine = offset ?? 1;
				const endLine = limit !== undefined ? startLine + limit - 1 : "";
				text += themeFg("warning", `:${startLine}${endLine ? `-${endLine}` : ""}`);
			}
			return themeFg("muted", "read ") + text;
		}
		case "write": {
			const rawPath = (args.file_path || args.path || "...") as string;
			const filePath = shortenPath(rawPath);
			const content = (args.content || "") as string;
			const lines = content.split("\n").length;
			let text = themeFg("muted", "write ") + themeFg("accent", filePath);
			if (lines > 1) text += themeFg("dim", ` (${lines} lines)`);
			return text;
		}
		case "edit": {
			const rawPath = (args.file_path || args.path || "...") as string;
			return themeFg("muted", "edit ") + themeFg("accent", shortenPath(rawPath));
		}
		case "ls": {
			const rawPath = (args.path || ".") as string;
			return themeFg("muted", "ls ") + themeFg("accent", shortenPath(rawPath));
		}
		case "find": {
			const pattern = (args.pattern || "*") as string;
			const rawPath = (args.path || ".") as string;
			return themeFg("muted", "find ") + themeFg("accent", pattern) + themeFg("dim", ` in ${shortenPath(rawPath)}`);
		}
		case "grep": {
			const pattern = (args.pattern || "") as string;
			const rawPath = (args.path || ".") as string;
			return themeFg("muted", "grep ") + themeFg("accent", `/${pattern}/`) + themeFg("dim", ` in ${shortenPath(rawPath)}`);
		}
		default: {
			const argsStr = JSON.stringify(args);
			const preview = argsStr.length > 50 ? `${argsStr.slice(0, 50)}...` : argsStr;
			return themeFg("accent", toolName) + themeFg("dim", ` ${preview}`);
		}
	}
}

interface UsageStats {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
	cost: number;
	costInput: number;
	costOutput: number;
	costCacheRead: number;
	costCacheWrite: number;
	hasUsage: boolean;
	hasCost: boolean;
	contextTokens: number;
	turns: number;
}

interface SingleResult {
	agent: string;
	agentSource: "user" | "project" | "unknown";
	task: string;
	exitCode: number;
	messages: Message[];
	stderr: string;
	usage: UsageStats;
	model?: string;
	stopReason?: string;
	errorMessage?: string;
	step?: number;
	reportPath?: string;
	herdrAgent?: string;
	herdrTabId?: string;
}

interface SubagentDetails {
	mode: "single" | "parallel" | "chain";
	agentScope: AgentScope;
	projectAgentsDir: string | null;
	results: SingleResult[];
}

function getLastAssistant(messages: Message[]) {
	return [...messages].reverse().find((message) => message.role === "assistant");
}

function getFinalOutput(messages: Message[]): string {
	const message = getLastAssistant(messages);
	return message?.role === "assistant"
		? message.content
				.filter((part) => part.type === "text")
				.map((part) => part.text)
				.join("")
		: "";
}

function isFailedResult(result: SingleResult): boolean {
	return result.exitCode !== 0 || result.stopReason !== "stop" || !getFinalOutput(result.messages).trim();
}

function getResultOutput(result: SingleResult): string {
	if (isFailedResult(result)) {
		return result.errorMessage || result.stderr || getFinalOutput(result.messages) || "(no output)";
	}
	return getFinalOutput(result.messages) || "(no output)";
}

function usageStats(): UsageStats {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: 0,
		costInput: 0,
		costOutput: 0,
		costCacheRead: 0,
		costCacheWrite: 0,
		hasUsage: false,
		hasCost: false,
		contextTokens: 0,
		turns: 0,
	};
}

function addUsage(target: UsageStats, usage: any) {
	if (!usage) return;
	target.hasUsage = true;
	target.input += usage.input || 0;
	target.output += usage.output || 0;
	target.cacheRead += usage.cacheRead || 0;
	target.cacheWrite += usage.cacheWrite || 0;
	target.totalTokens += usage.totalTokens || 0;
	target.contextTokens = usage.totalTokens || target.contextTokens;
	if (usage.cost) {
		target.hasCost = true;
		target.cost += usage.cost.total || 0;
		target.costInput += usage.cost.input || 0;
		target.costOutput += usage.cost.output || 0;
		target.costCacheRead += usage.cost.cacheRead || 0;
		target.costCacheWrite += usage.cost.cacheWrite || 0;
	}
}

function aggregateChildUsage(results: SingleResult[]) {
	const total = usageStats();
	for (const result of results) {
		const usage = result.usage;
		if (!usage.hasUsage) continue;
		addUsage(total, {
			...usage,
			cost: usage.hasCost
				? {
						input: usage.costInput,
						output: usage.costOutput,
						cacheRead: usage.costCacheRead,
						cacheWrite: usage.costCacheWrite,
						total: usage.cost,
					}
				: undefined,
		});
	}
	return total.hasUsage
		? {
				input: total.input,
				output: total.output,
				cacheRead: total.cacheRead,
				cacheWrite: total.cacheWrite,
				totalTokens: total.totalTokens,
				cost: {
					input: total.costInput,
					output: total.costOutput,
					cacheRead: total.costCacheRead,
					cacheWrite: total.costCacheWrite,
					total: total.cost,
				},
			}
		: undefined;
}

function formatToolUsageLine(results: SingleResult[]): string {
	const usage = aggregateChildUsage(results);
	if (!usage) return "";
	const models = [...new Set(results.map((result) => result.model).filter(Boolean))].join(",") || "unknown";
	const cost = results.some((result) => result.usage.hasCost) ? ` cost $${usage.cost.total.toFixed(4)}` : "";
	return `[usage total ${formatTokens(usage.totalTokens)} in ${formatTokens(usage.input)} out ${formatTokens(usage.output)} cache ${formatTokens(usage.cacheRead)}/${formatTokens(usage.cacheWrite)} model ${models}${cost}]`;
}

async function capOutput(result: SingleResult, output: string, mode: "brief" | "full"): Promise<string> {
	const cap = mode === "brief" ? BRIEF_OUTPUT_CAP : FULL_OUTPUT_CAP;
	const bytes = Buffer.byteLength(output, "utf8");
	if (bytes <= cap) return output;
	const dir = path.join(getAgentDir(), "subagent-results");
	await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
	await fs.promises.chmod(dir, 0o700);
	const reportPath = path.join(dir, `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2)}.txt`);
	await fs.promises.writeFile(reportPath, output, {
		encoding: "utf8",
		mode: 0o600,
	});
	result.reportPath = reportPath;
	const marker = `\n\n[Output truncated; full report: ${reportPath}]`;
	const keep = Math.max(0, cap - Buffer.byteLength(marker, "utf8"));
	let truncated = output.slice(0, keep);
	while (Buffer.byteLength(truncated, "utf8") > keep) truncated = truncated.slice(0, -1);
	if (/[\uD800-\uDBFF]$/.test(truncated)) truncated = truncated.slice(0, -1);
	return `${truncated}${marker}`;
}

function taskForOutput(task: string, output: "brief" | "full"): string {
	if (output === "full") return task + FULL_TASK_SUFFIX;
	return /\b(detail|detailed|full|verbose)\b/i.test(task) ? task : task + BRIEF_TASK_SUFFIX;
}

type DisplayItem = { type: "text"; text: string } | { type: "toolCall"; name: string; args: Record<string, any> };

function getDisplayItems(messages: Message[]): DisplayItem[] {
	const items: DisplayItem[] = [];
	for (const msg of messages) {
		if (msg.role === "assistant") {
			for (const part of msg.content) {
				if (part.type === "text") items.push({ type: "text", text: part.text });
				else if (part.type === "toolCall")
					items.push({
						type: "toolCall",
						name: part.name,
						args: part.arguments,
					});
			}
		}
	}
	return items;
}

async function mapWithConcurrencyLimit<TIn, TOut>(items: TIn[], concurrency: number, fn: (item: TIn, index: number) => Promise<TOut>): Promise<TOut[]> {
	if (items.length === 0) return [];
	const limit = Math.max(1, Math.min(concurrency, items.length));
	const results: TOut[] = new Array(items.length);
	let nextIndex = 0;
	const workers = new Array(limit).fill(null).map(async () => {
		while (true) {
			const current = nextIndex++;
			if (current >= items.length) return;
			results[current] = await fn(items[current], current);
		}
	});
	await Promise.all(workers);
	return results;
}

async function writePromptToTempFile(agentName: string, prompt: string): Promise<{ dir: string; filePath: string }> {
	const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-subagent-"));
	const safeName = agentName.replace(/[^\w.-]+/g, "_");
	const filePath = path.join(tmpDir, `prompt-${safeName}.md`);
	await withFileMutationQueue(filePath, async () => {
		await fs.promises.writeFile(filePath, prompt, {
			encoding: "utf-8",
			mode: 0o600,
		});
	});
	return { dir: tmpDir, filePath };
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
	if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}

	const execName = path.basename(process.execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
	if (!isGenericRuntime) {
		return { command: process.execPath, args };
	}

	return { command: "pi", args };
}

type OnUpdateCallback = (partial: AgentToolResult<SubagentDetails>) => void;

interface DispatchDefaults {
	model?: string;
	thinkingLevel?: ThinkingLevel;
}

const MODEL_OVERRIDE_ENTRY = "subagent-model-override";

interface ModelOverrideEntry {
	agent: string;
	model: string | null;
}

async function runSingleAgentHeadless(defaultCwd: string, dispatchDefaults: DispatchDefaults, agents: AgentConfig[], agentName: string, task: string, modelOverride: string | undefined, cwd: string | undefined, fast: boolean | undefined, thinkingLevel: ThinkingLevel | undefined, step: number | undefined, signal: AbortSignal | undefined, onUpdate: OnUpdateCallback | undefined, makeDetails: (results: SingleResult[]) => SubagentDetails): Promise<SingleResult> {
	const agent = agents.find((a) => a.name === agentName);

	if (!agent) {
		const available = agents.map((a) => `"${a.name}"`).join(", ") || "none";
		return {
			agent: agentName,
			agentSource: "unknown",
			task,
			exitCode: 1,
			messages: [],
			stderr: `Unknown agent: "${agentName}". Available agents: ${available}.`,
			usage: usageStats(),
			step,
		};
	}

	const args: string[] = ["--mode", "json", "-p", "--no-session"];
	const model = modelOverride ?? agent.model ?? dispatchDefaults.model;
	const hasExplicitModel = Boolean(modelOverride ?? agent.model);
	if (model) args.push("--model", model);
	if (thinkingLevel ?? (!hasExplicitModel && dispatchDefaults.thinkingLevel)) {
		args.push("--thinking", thinkingLevel ?? dispatchDefaults.thinkingLevel!);
	}
	if (agent.tools && agent.tools.length > 0) args.push("--tools", agent.tools.join(","));
	if (fast) args.push("--fast");

	let tmpPromptDir: string | null = null;
	let tmpPromptPath: string | null = null;

	const currentResult: SingleResult = {
		agent: agentName,
		agentSource: agent.source,
		task,
		exitCode: 0,
		messages: [],
		stderr: "",
		usage: usageStats(),
		model,
		step,
	};

	const emitUpdate = () => {
		if (onUpdate) {
			onUpdate({
				content: [
					{
						type: "text",
						text: getFinalOutput(currentResult.messages) || "(running...)",
					},
				],
				details: makeDetails([currentResult]),
			});
		}
	};

	try {
		if (agent.systemPrompt.trim()) {
			const tmp = await writePromptToTempFile(agent.name, agent.systemPrompt);
			tmpPromptDir = tmp.dir;
			tmpPromptPath = tmp.filePath;
			args.push("--append-system-prompt", tmpPromptPath);
		}

		args.push(`Task: ${task}`);
		let wasAborted = false;

		const exitCode = await new Promise<number>((resolve) => {
			const invocation = getPiInvocation(args);
			const proc = spawn(invocation.command, invocation.args, {
				cwd: cwd ?? defaultCwd,
				shell: false,
				stdio: ["ignore", "pipe", "pipe"],
			});
			let buffer = "";

			const processLine = (line: string) => {
				if (!line.trim()) return;
				let event: any;
				try {
					event = JSON.parse(line);
				} catch {
					return;
				}

				if (event.type === "message_end" && event.message) {
					const msg = event.message as Message;
					currentResult.messages.push(msg);

					if (msg.role === "assistant") {
						currentResult.usage.turns++;
						addUsage(currentResult.usage, msg.usage);
						if (!currentResult.model && msg.model) currentResult.model = msg.model;
						if (msg.stopReason) currentResult.stopReason = msg.stopReason;
						if (msg.errorMessage) currentResult.errorMessage = msg.errorMessage;
					}
					emitUpdate();
				}

				if (event.type === "tool_result_end" && event.message) {
					currentResult.messages.push(event.message as Message);
					emitUpdate();
				}
			};

			proc.stdout.on("data", (data) => {
				buffer += data.toString();
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";
				for (const line of lines) processLine(line);
			});

			proc.stderr.on("data", (data) => {
				currentResult.stderr += data.toString();
			});

			proc.on("close", (code) => {
				if (buffer.trim()) processLine(buffer);
				resolve(code ?? 1);
			});

			proc.on("error", (error) => {
				currentResult.stderr += error.message;
				resolve(1);
			});

			if (signal) {
				const killProc = () => {
					wasAborted = true;
					proc.kill("SIGTERM");
					setTimeout(() => {
						if (!proc.killed) proc.kill("SIGKILL");
					}, 5000);
				};
				if (signal.aborted) killProc();
				else signal.addEventListener("abort", killProc, { once: true });
			}
		});

		currentResult.exitCode = exitCode;
		if (wasAborted) {
			currentResult.stopReason = "aborted";
			currentResult.errorMessage = "Subagent was aborted; inspect prior work before retrying.";
		}
		return currentResult;
	} finally {
		if (tmpPromptPath)
			try {
				fs.unlinkSync(tmpPromptPath);
			} catch {
				/* ignore */
			}
		if (tmpPromptDir)
			try {
				fs.rmdirSync(tmpPromptDir);
			} catch {
				/* ignore */
			}
	}
}

function canUseHerdr(): boolean {
	return process.env.HERDR_ENV === "1" && Boolean(process.env.HERDR_WORKSPACE_ID) && Boolean(process.env.HERDR_PANE_ID);
}

function parseJsonOutput(output: string): any {
	const lines = output.trim().split("\n").reverse();
	for (const line of lines) {
		try {
			return JSON.parse(line);
		} catch {
			// Herdr normally emits one JSON object; tolerate incidental output.
		}
	}
	throw new Error(`Could not parse Herdr response: ${output.slice(0, 500)}`);
}

async function runCommand(command: string, args: string[], signal: AbortSignal | undefined, timeoutMs: number): Promise<{ stdout: string; stderr: string; code: number }> {
	return new Promise((resolve) => {
		const proc = spawn(command, args, {
			shell: false,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		let settled = false;
		const finish = (code: number) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve({ stdout, stderr, code });
		};
		proc.stdout.on("data", (data) => (stdout += data.toString()));
		proc.stderr.on("data", (data) => (stderr += data.toString()));
		proc.on("close", (code) => finish(code ?? 1));
		proc.on("error", (error) => {
			stderr += error.message;
			finish(1);
		});
		const stop = () => {
			proc.kill("SIGTERM");
			setTimeout(() => proc.kill("SIGKILL"), 2000).unref?.();
		};
		const timer = setTimeout(stop, timeoutMs);
		timer.unref?.();
		if (signal) {
			if (signal.aborted) stop();
			else signal.addEventListener("abort", stop, { once: true });
		}
	});
}

function makeHerdrAgentName(agentName: string): string {
	const role =
		agentName
			.toLowerCase()
			.replace(/[^a-z0-9_-]+/g, "-")
			.replace(/^[^a-z]+/, "") || "agent";
	const suffix = `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;
	return `${role.slice(0, 25)}-${suffix}`;
}

function shellQuote(value: string): string {
	return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function readSessionMessages(sessionPath: string): Message[] {
	const messages: Message[] = [];
	const content = fs.readFileSync(sessionPath, "utf8");
	for (const line of content.split("\n")) {
		if (!line.trim()) continue;
		try {
			const entry = JSON.parse(line);
			if (entry.type === "message" && entry.message) messages.push(entry.message as Message);
		} catch {
			// Ignore an incomplete trailing line while Pi flushes its session.
		}
	}
	return messages;
}

function calculateUsage(messages: Message[]): UsageStats {
	const usage = usageStats();
	for (const message of messages) {
		if (message.role !== "assistant") continue;
		usage.turns++;
		addUsage(usage, message.usage);
	}
	return usage;
}

async function runSingleAgentHerdr(defaultCwd: string, dispatchDefaults: DispatchDefaults, agents: AgentConfig[], agentName: string, task: string, modelOverride: string | undefined, cwd: string | undefined, fast: boolean | undefined, thinkingLevel: ThinkingLevel | undefined, step: number | undefined, signal: AbortSignal | undefined, onUpdate: OnUpdateCallback | undefined, makeDetails: (results: SingleResult[]) => SubagentDetails): Promise<SingleResult> {
	const agent = agents.find((candidate) => candidate.name === agentName);
	if (!agent) {
		const available = agents.map((candidate) => `"${candidate.name}"`).join(", ") || "none";
		return {
			agent: agentName,
			agentSource: "unknown",
			task,
			exitCode: 1,
			messages: [],
			stderr: `Unknown agent: "${agentName}". Available agents: ${available}.`,
			usage: usageStats(),
			step,
		};
	}

	const workDir = cwd ?? defaultCwd;
	const herdrAgent = makeHerdrAgentName(agentName);
	const model = modelOverride ?? agent.model ?? dispatchDefaults.model;
	const hasExplicitModel = Boolean(modelOverride ?? agent.model);
	const result: SingleResult = {
		agent: agentName,
		agentSource: agent.source,
		task,
		exitCode: 1,
		messages: [],
		stderr: "",
		usage: usageStats(),
		model,
		step,
		herdrAgent,
	};
	let tabId: string | undefined;
	let promptTemp: { dir: string; filePath: string } | undefined;
	let completed = false;

	try {
		const tabResponse = await runCommand("herdr", ["tab", "create", "--workspace", process.env.HERDR_WORKSPACE_ID!, "--cwd", workDir, "--label", `subagent: ${agentName}`, "--focus"], signal, 30_000);
		if (tabResponse.code !== 0) throw new Error(tabResponse.stderr || tabResponse.stdout);
		const tabJson = parseJsonOutput(tabResponse.stdout);
		tabId = tabJson?.result?.tab?.tab_id;
		const paneId = tabJson?.result?.root_pane?.pane_id;
		if (!tabId || !paneId) throw new Error("Herdr did not return a tab and pane ID");
		result.herdrTabId = tabId;

		const piArgs: string[] = [];
		if (model) piArgs.push("--model", model);
		if (thinkingLevel ?? (!hasExplicitModel && dispatchDefaults.thinkingLevel)) piArgs.push("--thinking", thinkingLevel ?? dispatchDefaults.thinkingLevel!);
		if (agent.tools?.length) piArgs.push("--tools", agent.tools.join(","));
		if (fast) piArgs.push("--fast");
		if (agent.systemPrompt.trim()) {
			promptTemp = await writePromptToTempFile(agent.name, agent.systemPrompt);
			piArgs.push("--append-system-prompt", promptTemp.filePath);
		}

		// Fresh tab panes can briefly be considered busy by `herdr agent start`.
		// Launch through the shell, wait for Pi's integration to report readiness,
		// then assign the stable name used for prompting and collection.
		const launchCommand = ["pi", ...piArgs].map(shellQuote).join(" ");
		const launchResponse = await runCommand("herdr", ["pane", "run", paneId, launchCommand], signal, 15_000);
		if (launchResponse.code !== 0) throw new Error(launchResponse.stderr || launchResponse.stdout);

		let detected = false;
		for (let attempt = 0; attempt < 240; attempt++) {
			if (signal?.aborted) throw new Error("Subagent was aborted");
			const getPaneResponse = await runCommand("herdr", ["agent", "get", paneId], signal, 5_000);
			if (getPaneResponse.code === 0) {
				const paneAgent = parseJsonOutput(getPaneResponse.stdout)?.result?.agent;
				const paneState = paneAgent?.agent_status ?? paneAgent?.status;
				if (paneAgent?.agent === "pi" && ["idle", "done"].includes(paneState)) {
					detected = true;
					break;
				}
			}
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		if (!detected) throw new Error(`Pi subagent did not become ready in Herdr pane ${paneId}`);

		const renameResponse = await runCommand("herdr", ["agent", "rename", paneId, herdrAgent], signal, 10_000);
		if (renameResponse.code !== 0) throw new Error(renameResponse.stderr || renameResponse.stdout);

		onUpdate?.({
			content: [
				{
					type: "text",
					text: `Running as ${herdrAgent} in Herdr tab ${tabId}…`,
				},
			],
			details: makeDetails([result]),
		});

		const promptResponse = await runCommand("herdr", ["agent", "prompt", herdrAgent, `Task: ${task}`, "--wait", "--timeout", "1800000"], signal, 1_810_000);
		if (promptResponse.code !== 0) throw new Error(promptResponse.stderr || promptResponse.stdout);

		const getResponse = await runCommand("herdr", ["agent", "get", herdrAgent], signal, 10_000);
		if (getResponse.code !== 0) throw new Error(getResponse.stderr || getResponse.stdout);
		const agentJson = parseJsonOutput(getResponse.stdout)?.result?.agent;
		const state = agentJson?.agent_status ?? agentJson?.status;
		if (state === "blocked") {
			result.stopReason = "error";
			result.errorMessage = `Subagent is blocked in Herdr tab ${tabId} (${herdrAgent}); the tab was left open.`;
			result.stderr = result.errorMessage;
			return result;
		}
		const sessionPath = agentJson?.agent_session?.kind === "path" ? agentJson.agent_session.value : undefined;
		if (!sessionPath) throw new Error("Herdr did not report the Pi subagent session path");

		for (let attempt = 0; attempt < 20; attempt++) {
			if (fs.existsSync(sessionPath)) {
				result.messages = readSessionMessages(sessionPath);
				if (getFinalOutput(result.messages)) break;
			}
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		result.usage = calculateUsage(result.messages);
		if (!getFinalOutput(result.messages)) throw new Error(`No final assistant output found in ${sessionPath}`);
		const lastAssistant = [...result.messages].reverse().find((message) => message.role === "assistant");
		if (lastAssistant?.role === "assistant") {
			result.stopReason = lastAssistant.stopReason;
			result.errorMessage = lastAssistant.errorMessage;
			if (!result.model && lastAssistant.model) result.model = lastAssistant.model;
		}
		result.exitCode = 0;
		if (isFailedResult(result)) result.exitCode = 1;
		completed = result.exitCode === 0;
		return result;
	} catch (error) {
		result.stderr = error instanceof Error ? error.message : String(error);
		result.errorMessage = result.stderr;
		result.stopReason = signal?.aborted ? "aborted" : "error";
		return result;
	} finally {
		if (promptTemp) {
			await fs.promises.rm(promptTemp.dir, { recursive: true, force: true });
		}
		if (tabId && (completed || signal?.aborted)) {
			await runCommand("herdr", ["tab", "close", tabId], undefined, 10_000);
		}
	}
}

async function runSingleAgent(defaultCwd: string, dispatchDefaults: DispatchDefaults, agents: AgentConfig[], agentName: string, task: string, modelOverride: string | undefined, cwd: string | undefined, fast: boolean | undefined, thinkingLevel: ThinkingLevel | undefined, step: number | undefined, signal: AbortSignal | undefined, onUpdate: OnUpdateCallback | undefined, makeDetails: (results: SingleResult[]) => SubagentDetails, headless?: boolean): Promise<SingleResult> {
	if (canUseHerdr()) { // ponytail: headless param ignored — user wants Herdr tabs always; restore `&& !headless` to re-enable
		return runSingleAgentHerdr(defaultCwd, dispatchDefaults, agents, agentName, task, modelOverride, cwd, fast, thinkingLevel, step, signal, onUpdate, makeDetails);
	}
	return runSingleAgentHeadless(defaultCwd, dispatchDefaults, agents, agentName, task, modelOverride, cwd, fast, thinkingLevel, step, signal, onUpdate, makeDetails);
}

const TaskItem = Type.Object({
	agent: Type.String({ description: "Name of the agent to invoke" }),
	task: Type.String({ description: "Task to delegate to the agent" }),
	model: Type.Optional(Type.String({ description: "Model override for this invocation" })),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
	fast: Type.Optional(
		Type.Boolean({
			description: "Enable fast mode (priority tier) for this invocation",
		}),
	),
	thinkingLevel: Type.Optional(
		StringEnum(["off", "minimal", "low", "medium", "high", "xhigh"] as const, {
			description: "Thinking level for this invocation",
		}),
	),
});

const ChainItem = Type.Object({
	agent: Type.String({ description: "Name of the agent to invoke" }),
	task: Type.String({
		description: "Task with optional {previous} placeholder for prior output",
	}),
	model: Type.Optional(Type.String({ description: "Model override for this invocation" })),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
	fast: Type.Optional(
		Type.Boolean({
			description: "Enable fast mode (priority tier) for this invocation",
		}),
	),
	thinkingLevel: Type.Optional(
		StringEnum(["off", "minimal", "low", "medium", "high", "xhigh"] as const, {
			description: "Thinking level for this invocation",
		}),
	),
});

const AgentScopeSchema = StringEnum(["user", "project", "both"] as const, {
	description: 'Which agent directories to use. Default: "user". Use "both" to include project-local agents.',
	default: "user",
});

const SubagentParams = Type.Object({
	agent: Type.Optional(
		Type.String({
			description: "Name of the agent to invoke (for single mode)",
		}),
	),
	task: Type.Optional(Type.String({ description: "Task to delegate (for single mode)" })),
	model: Type.Optional(
		Type.String({
			description: "Model override for this invocation (single mode)",
		}),
	),
	tasks: Type.Optional(
		Type.Array(TaskItem, {
			description: "Array of {agent, task} for parallel execution",
		}),
	),
	chain: Type.Optional(
		Type.Array(ChainItem, {
			description: "Array of {agent, task} for sequential execution",
		}),
	),
	agentScope: Type.Optional(AgentScopeSchema),
	confirmProjectAgents: Type.Optional(
		Type.Boolean({
			description: "Prompt before running project-local agents. Default: true.",
			default: true,
		}),
	),
	cwd: Type.Optional(
		Type.String({
			description: "Working directory for the agent process (single mode)",
		}),
	),
	fast: Type.Optional(
		Type.Boolean({
			description: "Enable fast mode (priority tier) for the subagent (single mode)",
		}),
	),
	thinkingLevel: Type.Optional(
		StringEnum(["off", "minimal", "low", "medium", "high", "xhigh"] as const, {
			description: "Thinking level for this invocation",
		}),
	),
	headless: Type.Optional(
		Type.Boolean({
			description: "Run headless (no Herdr tabs); subagent output streams back to this chat. Set true when the user says 'headless subagents' or otherwise doesn't want to watch separate tabs.",
		}),
	),
	concurrency: Type.Optional(
		Type.Number({
			description: "Max subagents running at once in parallel mode (default 3, hard cap 16). Clamped to the task count.",
		}),
	),
	output: Type.Optional(
		StringEnum(["brief", "full"] as const, {
			description: "Returned final output per child: brief (default, 8KiB) or full (50KiB). Truncated reports are saved to a private absolute path.",
			default: "brief",
		}),
	),
});

export default function (pi: ExtensionAPI) {
	const namedAgentModels = new Map<string, string>();

	const restoreModelOverrides = (ctx: Pick<ExtensionContext, "sessionManager">) => {
		namedAgentModels.clear();
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== "custom" || entry.customType !== MODEL_OVERRIDE_ENTRY) continue;
			const data = entry.data as Partial<ModelOverrideEntry> | undefined;
			if (typeof data?.agent !== "string") continue;
			if (typeof data.model === "string") namedAgentModels.set(data.agent, data.model);
			else if (data.model === null) namedAgentModels.delete(data.agent);
		}
	};

	pi.on("session_start", async (_event, ctx) => restoreModelOverrides(ctx));
	pi.on("session_tree", async (_event, ctx) => restoreModelOverrides(ctx));
	pi.on("tool_result", async (event) => {
		if (event.toolName !== "subagent") return;
		const details = event.details as SubagentDetails | undefined;
		return {
			isError: !details || details.results.length === 0 || details.results.some(isFailedResult),
		};
	});

	pi.registerCommand("subagent-model", {
		description: "Set, clear, or list session-local subagent model overrides",
		handler: async (args, ctx) => {
			const [agent, model] = args.trim().split(/\s+/, 2);
			if (!agent) {
				const overrides = Array.from(namedAgentModels.entries())
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([name, selectedModel]) => `${name}: ${selectedModel}`);
				ctx.ui.notify(overrides.length ? `Subagent model overrides:\n${overrides.join("\n")}` : "No subagent model overrides.", "info");
				return;
			}
			if (!model) {
				ctx.ui.notify("Usage: /subagent-model [agent] [model|clear]", "error");
				return;
			}

			const value = model.toLowerCase() === "clear" ? null : model;
			if (value === null) namedAgentModels.delete(agent);
			else namedAgentModels.set(agent, value);
			pi.appendEntry<ModelOverrideEntry>(MODEL_OVERRIDE_ENTRY, {
				agent,
				model: value,
			});
			ctx.ui.notify(value === null ? `Cleared model override for ${agent}.` : `${agent} model override: ${value}`, "info");
		},
	});

	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description: ["Delegate explicitly user-authorized, worthwhile tasks to specialized subagents with isolated context.", "Ordinary lookup, reading, editing, and tests stay inline.", "Inside Herdr, subagents open in visible background tabs; otherwise they run headlessly.", "Modes: single (agent + task), parallel (tasks array), chain (sequential with {previous} placeholder).", "Default output is brief (8KiB per child); full returns up to 50KiB. Truncated reports are retained privately at an absolute path.", `Default agent scope is "user" (from ${path.join(getAgentDir(), "agents")}); set agentScope: "both" or "project" for ${CONFIG_DIR_NAME}/agents.`].join(" "),
		promptSnippet: "Delegate explicitly authorized, worthwhile isolated work; keep ordinary lookup/read/edit/test inline",
		promptGuidelines: [
			"Use subagent only for explicitly user-authorized, coarse-grained work worth its isolated context; do ordinary lookup, read, edit, and tests inline.",
			"Give one subagent ownership of each related slice; verify nontrivial completed work once, then re-check concrete fixes as needed, not unchanged code for another opinion.",
			'Use subagent output: "full" when full requested detail is needed; default brief returns concise child reports.',
			"Default to visible Herdr tabs; pass headless: true when the user wants no tabs. Concurrency defaults to 3 (max 16); raising it saves time, not tokens.",
			"Use configured subagent role models; override only when needed. Pass thinkingLevel explicitly. Set fast: true only for gpt-5 OpenAI/Codex agents when the user asks for speed; priority tier bills at about 2x.",
		],
		parameters: SubagentParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const agentScope: AgentScope = params.agentScope ?? "user";
			const dispatchDefaults: DispatchDefaults = {
				model: ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined,
				thinkingLevel: ctx.thinkingLevel,
			};
			const discovery = discoverAgents(ctx.cwd, agentScope);
			const agents = discovery.agents;
			const confirmProjectAgents = params.confirmProjectAgents ?? true;
			const resolveModelOverride = (agentName: string, invocationModel: string | undefined) => invocationModel ?? namedAgentModels.get(agentName);

			const hasChain = (params.chain?.length ?? 0) > 0;
			const hasTasks = (params.tasks?.length ?? 0) > 0;
			const hasSingle = Boolean(params.agent && params.task);
			const modeCount = Number(hasChain) + Number(hasTasks) + Number(hasSingle);

			const makeDetails =
				(mode: "single" | "parallel" | "chain") =>
				(results: SingleResult[]): SubagentDetails => ({
					mode,
					agentScope,
					projectAgentsDir: discovery.projectAgentsDir,
					results,
				});
			const finish = (text: string, details: SubagentDetails) => {
				const usage = aggregateChildUsage(details.results);
				const usageLine = formatToolUsageLine(details.results);
				return {
					content: [
						{
							type: "text" as const,
							text: usageLine ? `${text}\n\n${usageLine}` : text,
						},
					],
					details,
					...(usage ? { usage } : {}),
				};
			};

			if (modeCount !== 1) {
				const available = agents.map((a) => `${a.name} (${a.source})`).join(", ") || "none";
				return {
					content: [
						{
							type: "text",
							text: `Invalid parameters. Provide exactly one mode.\nAvailable agents: ${available}`,
						},
					],
					details: makeDetails("single")([]),
				};
			}

			if ((agentScope === "project" || agentScope === "both") && confirmProjectAgents && ctx.hasUI && !ctx.isProjectTrusted()) {
				const requestedAgentNames = new Set<string>();
				if (params.chain) for (const step of params.chain) requestedAgentNames.add(step.agent);
				if (params.tasks) for (const t of params.tasks) requestedAgentNames.add(t.agent);
				if (params.agent) requestedAgentNames.add(params.agent);

				const projectAgentsRequested = Array.from(requestedAgentNames)
					.map((name) => agents.find((a) => a.name === name))
					.filter((a): a is AgentConfig => a?.source === "project");

				if (projectAgentsRequested.length > 0) {
					const names = projectAgentsRequested.map((a) => a.name).join(", ");
					const dir = discovery.projectAgentsDir ?? "(unknown)";
					const ok = await ctx.ui.confirm("Run project-local agents?", `Agents: ${names}\nSource: ${dir}\n\nProject agents are repo-controlled. Only continue for trusted repositories.`);
					if (!ok)
						return {
							content: [
								{
									type: "text",
									text: "Canceled: project-local agents not approved.",
								},
							],
							details: makeDetails(hasChain ? "chain" : hasTasks ? "parallel" : "single")([]),
						};
				}
			}

			if (params.chain && params.chain.length > 0) {
				const results: SingleResult[] = [];
				let previousOutput = "";

				for (let i = 0; i < params.chain.length; i++) {
					const step = params.chain[i];
					const taskWithContext = taskForOutput(step.task.replace(/\{previous\}/g, previousOutput), params.output ?? "brief");

					// Create update callback that includes all previous results
					const chainUpdate: OnUpdateCallback | undefined = onUpdate
						? (partial) => {
								// Combine completed results with current streaming result
								const currentResult = partial.details?.results[0];
								if (currentResult) {
									const allResults = [...results, currentResult];
									onUpdate({
										content: partial.content,
										details: makeDetails("chain")(allResults),
									});
								}
							}
						: undefined;

					const result = await runSingleAgent(ctx.cwd, dispatchDefaults, agents, step.agent, taskWithContext, resolveModelOverride(step.agent, step.model), step.cwd, step.fast, step.thinkingLevel, i + 1, signal, chainUpdate, makeDetails("chain"), params.headless);
					results.push(result);

					const isError = isFailedResult(result);
					if (isError) {
						const errorMsg = getResultOutput(result);
						return {
							...finish(`Chain stopped at step ${i + 1} (${step.agent}): ${await capOutput(result, errorMsg, params.output ?? "brief")}`, makeDetails("chain")(results)),
						};
					}
					previousOutput = getFinalOutput(result.messages);
				}
				return finish(await capOutput(results[results.length - 1], getFinalOutput(results[results.length - 1].messages) || "(no output)", params.output ?? "brief"), makeDetails("chain")(results));
			}

			if (params.tasks && params.tasks.length > 0) {
				if (params.tasks.length > MAX_PARALLEL_TASKS)
					return {
						content: [
							{
								type: "text",
								text: `Too many parallel tasks (${params.tasks.length}). Max is ${MAX_PARALLEL_TASKS}.`,
							},
						],
						details: makeDetails("parallel")([]),
					};

				// Track all results for streaming updates
				const allResults: SingleResult[] = new Array(params.tasks.length);

				// Initialize placeholder results
				for (let i = 0; i < params.tasks.length; i++) {
					allResults[i] = {
						agent: params.tasks[i].agent,
						agentSource: "unknown",
						task: params.tasks[i].task,
						exitCode: -1, // -1 = still running
						messages: [],
						stderr: "",
						usage: usageStats(),
					};
				}

				const emitParallelUpdate = () => {
					if (onUpdate) {
						const running = allResults.filter((r) => r.exitCode === -1).length;
						const done = allResults.filter((r) => r.exitCode !== -1).length;
						onUpdate({
							content: [
								{
									type: "text",
									text: `Parallel: ${done}/${allResults.length} done, ${running} running...`,
								},
							],
							details: makeDetails("parallel")([...allResults]),
						});
					}
				};

				const concurrency = Math.max(1, Math.min(params.concurrency ?? MAX_CONCURRENCY, MAX_CONCURRENCY_CAP, params.tasks.length));
				const results = await mapWithConcurrencyLimit(params.tasks, concurrency, async (t, index) => {
					const result = await runSingleAgent(
						ctx.cwd,
						dispatchDefaults,
						agents,
						t.agent,
						taskForOutput(t.task, params.output ?? "brief"),
						resolveModelOverride(t.agent, t.model),
						t.cwd,
						t.fast,
						t.thinkingLevel,
						undefined,
						signal,
						// Per-task update callback
						(partial) => {
							if (partial.details?.results[0]) {
								allResults[index] = partial.details.results[0];
								emitParallelUpdate();
							}
						},
						makeDetails("parallel"),
						params.headless,
					);
					allResults[index] = result;
					emitParallelUpdate();
					return result;
				});

				const successCount = results.filter((r) => !isFailedResult(r)).length;
				const summaries = await Promise.all(
					results.map(async (r) => {
						const output = await capOutput(r, getResultOutput(r), params.output ?? "brief");
						const status = isFailedResult(r) ? `failed${r.stopReason && r.stopReason !== "end" ? ` (${r.stopReason})` : ""}` : "completed";
						return `### [${r.agent}] ${status}\n\n${output}`;
					}),
				);
				return finish(`Parallel: ${successCount}/${results.length} succeeded\n\n${summaries.join("\n\n---\n\n")}`, makeDetails("parallel")(results));
			}

			if (params.agent && params.task) {
				const result = await runSingleAgent(ctx.cwd, dispatchDefaults, agents, params.agent, taskForOutput(params.task, params.output ?? "brief"), resolveModelOverride(params.agent, params.model), params.cwd, params.fast, params.thinkingLevel, undefined, signal, onUpdate, makeDetails("single"), params.headless);
				const isError = isFailedResult(result);
				if (isError) {
					const errorMsg = getResultOutput(result);
					return {
						...finish(`Agent ${result.stopReason || "failed"}: ${await capOutput(result, errorMsg, params.output ?? "brief")}`, makeDetails("single")([result])),
					};
				}
				return finish(await capOutput(result, getFinalOutput(result.messages) || "(no output)", params.output ?? "brief"), makeDetails("single")([result]));
			}

			const available = agents.map((a) => `${a.name} (${a.source})`).join(", ") || "none";
			return {
				content: [
					{
						type: "text",
						text: `Invalid parameters. Available agents: ${available}`,
					},
				],
				details: makeDetails("single")([]),
			};
		},

		renderCall(args, theme, _context) {
			const scope: AgentScope = args.agentScope ?? "user";
			if (args.chain && args.chain.length > 0) {
				let text = theme.fg("toolTitle", theme.bold("subagent ")) + theme.fg("accent", `chain (${args.chain.length} steps)`) + theme.fg("muted", ` [${scope}]`);
				for (let i = 0; i < Math.min(args.chain.length, 3); i++) {
					const step = args.chain[i];
					// Clean up {previous} placeholder for display
					const cleanTask = step.task.replace(/\{previous\}/g, "").trim();
					const preview = cleanTask.length > 40 ? `${cleanTask.slice(0, 40)}...` : cleanTask;
					text += "\n  " + theme.fg("muted", `${i + 1}.`) + " " + theme.fg("accent", step.agent) + theme.fg("dim", ` ${preview}`);
				}
				if (args.chain.length > 3) text += `\n  ${theme.fg("muted", `... +${args.chain.length - 3} more`)}`;
				return new Text(text, 0, 0);
			}
			if (args.tasks && args.tasks.length > 0) {
				let text = theme.fg("toolTitle", theme.bold("subagent ")) + theme.fg("accent", `parallel (${args.tasks.length} tasks)`) + theme.fg("muted", ` [${scope}]`);
				for (const t of args.tasks.slice(0, 3)) {
					const preview = t.task.length > 40 ? `${t.task.slice(0, 40)}...` : t.task;
					text += `\n  ${theme.fg("accent", t.agent)}${theme.fg("dim", ` ${preview}`)}`;
				}
				if (args.tasks.length > 3) text += `\n  ${theme.fg("muted", `... +${args.tasks.length - 3} more`)}`;
				return new Text(text, 0, 0);
			}
			const agentName = args.agent || "...";
			const preview = args.task ? (args.task.length > 60 ? `${args.task.slice(0, 60)}...` : args.task) : "...";
			let text = theme.fg("toolTitle", theme.bold("subagent ")) + theme.fg("accent", agentName) + theme.fg("muted", ` [${scope}]`);
			text += `\n  ${theme.fg("dim", preview)}`;
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded }, theme, _context) {
			const details = result.details as SubagentDetails | undefined;
			if (!details || details.results.length === 0) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
			}

			const mdTheme = getMarkdownTheme();

			const renderDisplayItems = (items: DisplayItem[], limit?: number) => {
				const toShow = limit ? items.slice(-limit) : items;
				const skipped = limit && items.length > limit ? items.length - limit : 0;
				let text = "";
				if (skipped > 0) text += theme.fg("muted", `... ${skipped} earlier items\n`);
				for (const item of toShow) {
					if (item.type === "text") {
						const preview = expanded ? item.text : item.text.split("\n").slice(0, 3).join("\n");
						text += `${theme.fg("toolOutput", preview)}\n`;
					} else {
						text += `${theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme))}\n`;
					}
				}
				return text.trimEnd();
			};

			if (details.mode === "single" && details.results.length === 1) {
				const r = details.results[0];
				const isError = isFailedResult(r);
				const icon = isError ? theme.fg("error", "✗") : theme.fg("success", "✓");
				const displayItems = getDisplayItems(r.messages);
				const finalOutput = getFinalOutput(r.messages);

				if (expanded) {
					const container = new Container();
					let header = `${icon} ${theme.fg("toolTitle", theme.bold(r.agent))}${theme.fg("muted", ` (${r.agentSource})`)}`;
					if (isError && r.stopReason) header += ` ${theme.fg("error", `[${r.stopReason}]`)}`;
					container.addChild(new Text(header, 0, 0));
					if (isError && r.errorMessage) container.addChild(new Text(theme.fg("error", `Error: ${r.errorMessage}`), 0, 0));
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── Task ───"), 0, 0));
					container.addChild(new Text(theme.fg("dim", r.task), 0, 0));
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── Output ───"), 0, 0));
					if (displayItems.length === 0 && !finalOutput) {
						container.addChild(new Text(theme.fg("muted", "(no output)"), 0, 0));
					} else {
						for (const item of displayItems) {
							if (item.type === "toolCall") container.addChild(new Text(theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme)), 0, 0));
						}
						if (finalOutput) {
							container.addChild(new Spacer(1));
							container.addChild(new Markdown(finalOutput.trim(), 0, 0, mdTheme));
						}
					}
					const usageStr = formatUsageStats(r.usage, r.model);
					if (usageStr) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", usageStr), 0, 0));
					}
					return container;
				}

				let text = `${icon} ${theme.fg("toolTitle", theme.bold(r.agent))}${theme.fg("muted", ` (${r.agentSource})`)}`;
				if (isError && r.stopReason) text += ` ${theme.fg("error", `[${r.stopReason}]`)}`;
				if (isError && r.errorMessage) text += `\n${theme.fg("error", `Error: ${r.errorMessage}`)}`;
				else if (displayItems.length === 0) text += `\n${theme.fg("muted", "(no output)")}`;
				else {
					text += `\n${renderDisplayItems(displayItems, COLLAPSED_ITEM_COUNT)}`;
					if (displayItems.length > COLLAPSED_ITEM_COUNT) text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
				}
				const usageStr = formatUsageStats(r.usage, r.model);
				if (usageStr) text += `\n${theme.fg("dim", usageStr)}`;
				return new Text(text, 0, 0);
			}

			const aggregateUsage = (results: SingleResult[]) => {
				const total = {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					cost: 0,
					turns: 0,
				};
				for (const r of results) {
					total.input += r.usage.input;
					total.output += r.usage.output;
					total.cacheRead += r.usage.cacheRead;
					total.cacheWrite += r.usage.cacheWrite;
					total.cost += r.usage.cost;
					total.turns += r.usage.turns;
				}
				return total;
			};

			if (details.mode === "chain") {
				const successCount = details.results.filter((r) => !isFailedResult(r)).length;
				const icon = successCount === details.results.length ? theme.fg("success", "✓") : theme.fg("error", "✗");

				if (expanded) {
					const container = new Container();
					container.addChild(new Text(icon + " " + theme.fg("toolTitle", theme.bold("chain ")) + theme.fg("accent", `${successCount}/${details.results.length} steps`), 0, 0));

					for (const r of details.results) {
						const rIcon = !isFailedResult(r) ? theme.fg("success", "✓") : theme.fg("error", "✗");
						const displayItems = getDisplayItems(r.messages);
						const finalOutput = getFinalOutput(r.messages);

						container.addChild(new Spacer(1));
						container.addChild(new Text(`${theme.fg("muted", `─── Step ${r.step}: `) + theme.fg("accent", r.agent)} ${rIcon}`, 0, 0));
						container.addChild(new Text(theme.fg("muted", "Task: ") + theme.fg("dim", r.task), 0, 0));

						// Show tool calls
						for (const item of displayItems) {
							if (item.type === "toolCall") {
								container.addChild(new Text(theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme)), 0, 0));
							}
						}

						// Show final output as markdown
						if (finalOutput) {
							container.addChild(new Spacer(1));
							container.addChild(new Markdown(finalOutput.trim(), 0, 0, mdTheme));
						}

						const stepUsage = formatUsageStats(r.usage, r.model);
						if (stepUsage) container.addChild(new Text(theme.fg("dim", stepUsage), 0, 0));
					}

					const usageStr = formatUsageStats(aggregateUsage(details.results));
					if (usageStr) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", `Total: ${usageStr}`), 0, 0));
					}
					return container;
				}

				// Collapsed view
				let text = icon + " " + theme.fg("toolTitle", theme.bold("chain ")) + theme.fg("accent", `${successCount}/${details.results.length} steps`);
				for (const r of details.results) {
					const rIcon = !isFailedResult(r) ? theme.fg("success", "✓") : theme.fg("error", "✗");
					const displayItems = getDisplayItems(r.messages);
					text += `\n\n${theme.fg("muted", `─── Step ${r.step}: `)}${theme.fg("accent", r.agent)} ${rIcon}`;
					if (displayItems.length === 0) text += `\n${theme.fg("muted", "(no output)")}`;
					else text += `\n${renderDisplayItems(displayItems, 5)}`;
				}
				const usageStr = formatUsageStats(aggregateUsage(details.results));
				if (usageStr) text += `\n\n${theme.fg("dim", `Total: ${usageStr}`)}`;
				text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
				return new Text(text, 0, 0);
			}

			if (details.mode === "parallel") {
				const running = details.results.filter((r) => r.exitCode === -1).length;
				const successCount = details.results.filter((r) => r.exitCode !== -1 && !isFailedResult(r)).length;
				const failCount = details.results.filter((r) => r.exitCode !== -1 && isFailedResult(r)).length;
				const isRunning = running > 0;
				const icon = isRunning ? theme.fg("warning", "⏳") : failCount > 0 ? theme.fg("warning", "◐") : theme.fg("success", "✓");
				const status = isRunning ? `${successCount + failCount}/${details.results.length} done, ${running} running` : `${successCount}/${details.results.length} tasks`;

				if (expanded && !isRunning) {
					const container = new Container();
					container.addChild(new Text(`${icon} ${theme.fg("toolTitle", theme.bold("parallel "))}${theme.fg("accent", status)}`, 0, 0));

					for (const r of details.results) {
						const rIcon = isFailedResult(r) ? theme.fg("error", "✗") : theme.fg("success", "✓");
						const displayItems = getDisplayItems(r.messages);
						const finalOutput = getFinalOutput(r.messages);

						container.addChild(new Spacer(1));
						container.addChild(new Text(`${theme.fg("muted", "─── ") + theme.fg("accent", r.agent)} ${rIcon}`, 0, 0));
						container.addChild(new Text(theme.fg("muted", "Task: ") + theme.fg("dim", r.task), 0, 0));

						// Show tool calls
						for (const item of displayItems) {
							if (item.type === "toolCall") {
								container.addChild(new Text(theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme)), 0, 0));
							}
						}

						// Show final output as markdown
						if (finalOutput) {
							container.addChild(new Spacer(1));
							container.addChild(new Markdown(finalOutput.trim(), 0, 0, mdTheme));
						}

						const taskUsage = formatUsageStats(r.usage, r.model);
						if (taskUsage) container.addChild(new Text(theme.fg("dim", taskUsage), 0, 0));
					}

					const usageStr = formatUsageStats(aggregateUsage(details.results));
					if (usageStr) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", `Total: ${usageStr}`), 0, 0));
					}
					return container;
				}

				// Collapsed view (or still running)
				let text = `${icon} ${theme.fg("toolTitle", theme.bold("parallel "))}${theme.fg("accent", status)}`;
				for (const r of details.results) {
					const rIcon = r.exitCode === -1 ? theme.fg("warning", "⏳") : isFailedResult(r) ? theme.fg("error", "✗") : theme.fg("success", "✓");
					const displayItems = getDisplayItems(r.messages);
					text += `\n\n${theme.fg("muted", "─── ")}${theme.fg("accent", r.agent)} ${rIcon}`;
					if (displayItems.length === 0) text += `\n${theme.fg("muted", r.exitCode === -1 ? "(running...)" : "(no output)")}`;
					else text += `\n${renderDisplayItems(displayItems, 5)}`;
				}
				if (!isRunning) {
					const usageStr = formatUsageStats(aggregateUsage(details.results));
					if (usageStr) text += `\n\n${theme.fg("dim", `Total: ${usageStr}`)}`;
				}
				if (!expanded) text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
				return new Text(text, 0, 0);
			}

			const text = result.content[0];
			return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
		},
	});
}
