import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
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
  pi.on("session_start", (_event, ctx) => {
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
          const stats = [
            `${teal("↑")}${text(tokens(input))}`,
            `${pink("↓")}${text(tokens(output))}`,
            ...(cacheRead ? [text(`read ${tokens(cacheRead)}`)] : []),
            ...(cacheWrite ? [text(`write ${tokens(cacheWrite)}`)] : []),
            ...(cacheHit !== undefined ? [text(`cache ${cacheHit.toFixed(1)}%`)] : []),
            red(`$${cost.toFixed(3)}`),
          ].join(muted(" · "));
          const usage = ctx.getContextUsage();
          const contextPct = usage?.percent == null ? "?" : `${usage.percent.toFixed(1)}%`;
          const context = Number(usage?.percent ?? 0) > 90 ? red(contextPct) : teal(contextPct);
          const contextInfo = `ctx ${context}/${tokens(usage?.contextWindow ?? ctx.model?.contextWindow ?? 0)} ${muted("(auto)")}`;
          const model = `${ctx.model?.provider ?? "no-provider"} · ${ctx.model?.id ?? "no-model"} · ${ctx.thinkingLevel ?? "off"}`;
          const statuses = [...footer.getExtensionStatuses()]
            .filter(([key, value]) => key !== "ponytail" && Boolean(value))
            .map(([, value]) => value)
            .join("  ");
          const line = [location, stats, contextInfo, pink(model), statuses].filter(Boolean).join(muted(" · "));
          return [truncateToWidth(line, width)];
        },
      };
    });
  });
}
