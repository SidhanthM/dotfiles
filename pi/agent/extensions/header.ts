/**
 * Ouroboros startup header, rendered as Braille art from the dragon-and-chain reference.
 * Eight dots per Unicode cell retain detail without a terminal image protocol.
 * /builtin-header restores Pi's default header.
 */

import { rgbColor, truncateToWidth } from "@earendil-works/pi-tui";
import {
  type ExtensionAPI,
  VERSION,
  rawKeyHint,
} from "@earendil-works/pi-coding-agent";

const ART_COLOR = rgbColor(255, 255, 255);

// A 56 × 56 dot sample of the reference, packed into 28 columns × 14 rows.
// Braille dots: left column 1/2/3/7, right column 4/5/6/8.
const OUROBOROS = [
  "        ⢀⣠⣆",
  "        ⠸⢿⣿⣷⣤⣠⣤⣾⣠⠄",
  "       ⢰⡤⢤⡙⢻⡟⢩⡉⣿⣿⣿⠤⣴",
  "       ⣿⠰⠆⣹⠛⣷⣤⣴⣿⣿⡇⠶⢈⡇",
  "   ⢤⡴⠒⢶⡟⠙⠛⣁⣼⣿⠟⠋⠉ ⠉⠛⠻⣿⠖⠲⣤⠄",
  "   ⠘⣇⣛⣠⠇  ⠺⣿⡏       ⢿⣘⣃⡾",
  "   ⣠⣼⣟⠁     ⠁        ⠈⣿⣧⣀",
  " ⠠⢾⠁⠦⢹⠆              ⢸⠁⠦⢹⠦",
  "  ⠈⠓⢶⡏               ⠈⣷⡖⠋",
  "   ⢠⡞⣉⠻⡆            ⣴⢋⡙⢧",
  "   ⠼⠧⣬⣴⣇⣀⣀⡀      ⢀⣀⣀⣿⣬⡥⠟⠄",
  "       ⣿⢡⡄⢻⣀⣠⠶⠦⣄⣰⡏⣤⠘⡇",
  "       ⢸⠶⠖⠋⠙⣇⡘⢂⡿⠛⠓⠶⢾⠁",
  "            ⠈⠹⠉",
];

// Independently sampled at 48 × 48 dots for narrower panes.
const COMPACT_OUROBOROS = [
  "       ⢠⣴⡄   ⢀",
  "       ⠙⢿⣿⣶⣤⣶⣧⣖⡀",
  "      ⡼⢛⠲⣭⣿⡰⢂⣿⣿⢛⡛⡄",
  "  ⢀⣀⣠⣤⡷⠬⠴⢃⣿⣿⠿⠟⠛⠬⢴⣧⣠⣄⣀",
  "   ⢯⠰⢈⡇ ⠠⣿⡿⠁     ⢿⠰⢂⡇",
  "  ⢀⣸⣿⠉    ⠁       ⠉⣿⣄",
  " ⠰⣏⠰⢨⠇            ⢸⠰⢆⡷",
  "  ⠈⢹⣿⣀            ⣠⣿⠋",
  "   ⣾⠰⢈⡇          ⢾⠰⢈⡇",
  "  ⠈⠈⠙⠙⡷⢒⠲⡄ ⣀⣀ ⣠⢒⡲⡟⠙⠉⠈",
  "      ⢳⠬⠴⠛⢾⠰⢌⡿⠿⠬⢴⠃",
  "          ⠈⠹⠋",
];

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    ctx.ui.setHeader((_tui, theme) => ({
      render(width: number): string[] {
        if (width < 1) return [];
        const artwork = width >= 28 ? OUROBOROS : width >= 24 ? COMPACT_OUROBOROS : [];
        const title = theme.bold(theme.fg("accent", "Ouroboros")) + theme.fg("dim", ` · Pi v${VERSION}`);
        const hints = [
          rawKeyHint("escape", "interrupt"),
          rawKeyHint("ctrl+c", "clear / exit"),
          rawKeyHint("/", "commands"),
        ].join(theme.fg("dim", "  ·  "));
        return [
          ...artwork.map((line) => theme.style(line, { fg: ART_COLOR })),
          ...(artwork.length ? [""] : []),
          truncateToWidth(title, width),
          truncateToWidth(hints, width),
        ];
      },
      // Colors are applied on every render, so theme changes need no cached-art cleanup.
      invalidate() {},
    }));
  });

  pi.registerCommand("builtin-header", {
    description: "Restore Pi's built-in startup header",
    handler: async (_args, ctx) => {
      ctx.ui.setHeader(undefined);
      ctx.ui.notify("Built-in header restored", "info");
    },
  });
}
