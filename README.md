# dotfiles

My shell, prompt, editor and Herdr app configuration for macOS (Apple Silicon). My Pi setup lives in [pi-config](https://github.com/SidhanthM/pi-config).

## Contents

| Path | What it configures |
| --- | --- |
| `zsh/` | zsh: aliases, completions, plugins, fzf and zoxide |
| `starship.toml` | Starship prompt (Black Metal palette) |
| `nvim/` | Neovim, based on [kickstart.nvim](https://github.com/nvim-lua/kickstart.nvim) (MIT, see `nvim/LICENSE.md`) |
| `herdr-app/` | Herdr app: custom themes and mods |

## Requirements

```bash
brew install git neovim starship zoxide eza fzf ripgrep fd \
  zsh-autosuggestions zsh-syntax-highlighting zsh-completions
brew install --cask font-jetbrains-mono-nerd-font
```

## Use it

Browse and copy the pieces you want. Back up any existing file before replacing it.

```bash
git clone https://github.com/SidhanthM/dotfiles.git ~/.dotfiles
mkdir -p ~/.config/zsh
cp -i ~/.dotfiles/zsh/.zshrc ~/.config/zsh/
cp -i ~/.dotfiles/starship.toml ~/.config/
cp -R -i ~/.dotfiles/nvim ~/.config/
```

Then add this to `~/.zshenv` and open a new terminal:

```bash
export ZDOTDIR="$HOME/.config/zsh"
```

## Herdr app

### Themes

| Theme | Credit | My changes |
| --- | --- | --- |
| `gruvbox-salmon` | [Gruvbox](https://github.com/morhetz/gruvbox) by morhetz, via Herdr's `gruvbox-dark` | Salmon accent (`#dd9999`), darker ANSI bright black, and set colors for the app's background, panels, hover, selection and borders |
| `one-dark-salmon` | One Dark, from [Atom](https://github.com/atom/atom), via Herdr's `one-dark` | Salmon accent and cursor, sage green in place of ANSI blue and for the working status, darker ANSI bright black |
| `rose-pine-salmon` | [Rosé Pine](https://github.com/rose-pine/rose-pine-theme); compared against Herdr's `rose-pine-moon` | Darker base background, rose accent and cursor, adjusted terminal colors and selection, full app interface colors |
| `tokyo-night-pink` | [Tokyo Night](https://github.com/enkia/tokyo-night-vscode-theme) by enkia, via Herdr's `tokyo-night-default` | Pink accent and cursor, brighter ANSI bright colors, full app interface colors |
| `graphite-bone` | Custom theme in my setup | Graphite background with bone text and a salmon accent |

### Mods

Three mods are modified copies of mods bundled with [Herdr](https://herdr.dev). The original work belongs to Herdr's authors and is under Apache 2.0 ([`herdr-app/LICENSE-herdr`](herdr-app/LICENSE-herdr)).

| Mod | Original | My changes |
| --- | --- | --- |
| `agents-peek` | `agents` 0.1.18 | Option+click peeks at an agent over the current tab instead of switching to it. A plain click on a nested entry goes to its pane if it has one, and peeks otherwise |
| `pane-bright-controls` | `pane` 0.1.17 | Brighter header buttons with accent-colored hover; a red-highlighted unzoom button; buttons stay visible while zoomed; Option+click on the header peeks at the terminal |
| `tabs-with-git` | `tabs` 0.1.17 | Adds a Git Graph panel button when the layout includes the `git-graph` panel |
| `space-agent-tree` | Local mod, no upstream source recorded | Tree view of spaces, their agents and child agents |

Copy what you want, then select it in Herdr. A mod may also need to be referenced by your layout.

```bash
mkdir -p ~/.config/herdr-app/themes ~/.config/herdr-app/mods
cp -i ~/.dotfiles/herdr-app/themes/*.json ~/.config/herdr-app/themes/
cp -R -i ~/.dotfiles/herdr-app/mods/tabs-with-git ~/.config/herdr-app/mods/
```

### Third-party mods I also use

These aren't copied here. Get them from their authors:

- [herdr-git-graph](https://github.com/rabeeh-ta/herdr-git-graph) by [rabeeh-ta](https://github.com/rabeeh-ta). `tabs-with-git` needs it for the Git Graph button.
- [herdr-customize](https://github.com/wapenshaw/herdr-customize) by [wapenshaw](https://github.com/wapenshaw)

## Private settings

Put machine-specific paths, tool initializers and secrets in `$ZDOTDIR/local.zsh`. `.zshrc` loads it if it exists, and Git ignores it.
