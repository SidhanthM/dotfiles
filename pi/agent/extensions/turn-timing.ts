import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

const ENTRY_TYPE = "turn-timing";

interface TurnTiming {
  durationMs: number;
  completedAt: number;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function (pi: ExtensionAPI) {
  pi.registerEntryRenderer<TurnTiming>(ENTRY_TYPE, (entry, _options, theme) => {
    const { durationMs, completedAt } = entry.data ?? { durationMs: 0, completedAt: Date.now() };
    const time = new Date(completedAt).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    const label = theme.style(`Thought for ${formatDuration(durationMs)} · ${time}`, { fg: "dim", italic: true });
    return new Text(label, 1, 0);
  });

  let startedAt: number | undefined;
  pi.on("agent_start", () => {
    startedAt = performance.now();
  });

  pi.on("agent_end", (event, ctx) => {
    if (startedAt === undefined) return;
    const durationMs = performance.now() - startedAt;
    startedAt = undefined;

    // This entry is a TUI detail, not conversation content sent to the model.
    if (ctx.mode !== "tui" || !event.messages.some((message) => message.role === "assistant")) return;

    pi.appendEntry<TurnTiming>(ENTRY_TYPE, {
      durationMs,
      completedAt: Date.now(),
    });
  });
}
