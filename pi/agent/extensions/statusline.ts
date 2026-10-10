import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CustomEditor, getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";

const color = (hex: string, text: string) => {
  const rgb = hex.match(/[\da-f]{2}/gi)!.map((n) => parseInt(n, 16));
  return `\x1b[38;2;${rgb.join(";")}m${text}\x1b[39m`;
};
const pink = (s: string) => color("#dd9999", s);
const teal = (s: string) => color("#486e6f", s);
const red = (s: string) => color("#a06666", s);
const muted = (s: string) => color("#888888", s);
const text = (s: string) => color("#c1c1c1", s);
const tokens = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${n}`;

export default function (pi: ExtensionAPI) {
  const settingsPath = join(getAgentDir(), "settings.json");
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    const bolt = () => {
      let fast = false;
      try {
        fast = JSON.parse(readFileSync(settingsPath, "utf8"))["pi-effort"]?.fastMode === true;
      } catch { /* Missing or invalid settings: fast mode off. */ }
      const eligible = ["openai", "openai-codex", "azure-openai-responses"].includes(ctx.model?.provider ?? "") && ctx.model?.id.startsWith("gpt-5");
      return !fast ? muted("ϟ") : eligible ? teal("ϟ") : pink("ϟ");
    };

    class FastModeEditor extends CustomEditor {
      protected override renderTopBorder(width: number, hiddenLineCount: number): string {
        const border = super.renderTopBorder(width, hiddenLineCount);
        if (width < 7) return border;
        const inset = Math.min(10, Math.floor((width - 6) / 2));
        const cap = color("#202020", "");
        const badge = cap + `\x1b[48;2;32;32;32m\x1b[1m ${bolt()} \x1b[22;49m` + color("#202020", "");
        return truncateToWidth(border, width - inset - 5, "") + badge + this.borderColor("─".repeat(inset));
      }
    }
    ctx.ui.setEditorComponent((tui, theme, kb) => new FastModeEditor(tui, theme, kb));

    ctx.ui.setFooter((tui, _theme, footer) => {
      const unsubscribe = footer.onBranchChange(() => tui.requestRender());
      return {
        dispose: unsubscribe,
        invalidate() {},
        render(width: number) {
          let input = 0, output = 0, cacheRead = 0, cacheWrite = 0, cost = 0;
          let cacheHit: number | undefined;
          for (const entry of ctx.sessionManager.getEntries()) {
            if (entry.type !== "message" || entry.message.role !== "assistant") continue;
            const usage = entry.message.usage;
            input += usage.input;
            output += usage.output;
            cacheRead += usage.cacheRead;
            cacheWrite += usage.cacheWrite;
            cost += usage.cost.total;
            const promptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
            if (promptTokens) cacheHit = usage.cacheRead / promptTokens * 100;
          }

          const branch = footer.getGitBranch();
          const cwd = ctx.sessionManager.getCwd().replace(process.env.HOME ?? "\0", "~");
          const location = `${pink(cwd)}${branch ? ` ${muted("(")}${teal(branch)}${muted(")")}` : ""}`;
          const separator = muted(" · ");
          const stats = [
            `${teal("↑")}${text(tokens(input))}`,
            `${pink("↓")}${text(tokens(output))}`,
            ...(cacheRead ? [text(`read ${tokens(cacheRead)}`)] : []),
            ...(cacheWrite ? [text(`write ${tokens(cacheWrite)}`)] : []),
            ...(cacheHit !== undefined ? [text(`cache ${cacheHit.toFixed(1)}%`)] : []),
            red(`$${cost.toFixed(3)}`),
          ].join(separator);
          const compactStats = [
            `${teal("↑")}${text(tokens(input))}`,
            `${pink("↓")}${text(tokens(output))}`,
            ...(cacheRead ? [text(`R${tokens(cacheRead)}`)] : []),
            ...(cacheWrite ? [text(`W${tokens(cacheWrite)}`)] : []),
            ...(cacheHit !== undefined ? [text(`C${Math.round(cacheHit)}%`)] : []),
            red(`$${cost.toFixed(3)}`),
          ].join(separator);
          const usage = ctx.getContextUsage();
          const contextPct = usage?.percent == null ? "?" : `${usage.percent.toFixed(1)}%`;
          const context = Number(usage?.percent ?? 0) > 90 ? red(contextPct) : teal(contextPct);
          const contextInfo = `ctx ${context}/${tokens(usage?.contextWindow ?? ctx.model?.contextWindow ?? 0)} ${muted("(auto)")}`;
          const compactContext = `ctx ${context}`;
          const model = `${ctx.model?.provider ?? "no-provider"}/${ctx.model?.id ?? "no-model"}:${ctx.thinkingLevel ?? "off"}`;
          const statuses = [...footer.getExtensionStatuses()]
            .filter(([key, value]) => key !== "ponytail" && Boolean(value))
            .map(([, value]) => value)
            .join("  ");
          const fullLine = [location, stats, contextInfo, pink(model), statuses].filter(Boolean).join(separator);
          const mediumLine = [compactStats, contextInfo, pink(model)].join(separator);
          // Footer values are ASCII apart from the single-cell arrows; strip ANSI
          // before measuring so the layout can adapt before the TUI clips it.
          const visibleLength = (value: string) => value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").length;
          if (visibleLength(fullLine) <= width) return [fullLine];
          if (visibleLength(mediumLine) <= width) return [mediumLine];

          // In narrow panes, give the model/provider/effort its own row. Keep
          // context, cost and token flow on the second row instead of losing the
          // right-hand side to arbitrary truncation.
          const modelLine = pink(model);
          const compactCost = red(`$${cost.toFixed(3)}`);
          const compactUsage = [compactContext, compactCost].join(separator);
          const narrowStats = [
            `${teal("↑")}${text(tokens(input))}`,
            `${pink("↓")}${text(tokens(output))}`,
            ...(cacheHit !== undefined ? [text(`C${Math.round(cacheHit)}%`)] : []),
          ].join(separator);
          const narrowLine = [narrowStats, compactUsage].join(separator);
          return [truncateToWidth(modelLine, width), truncateToWidth(narrowLine, width)];
        },
      };
    });
  });
}
