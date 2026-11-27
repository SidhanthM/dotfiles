# dotfiles

My shell, prompt and editor configuration for macOS (Apple Silicon). My Pi setup lives in [pi-config](https://github.com/SidhanthM/pi-config).

## Contents

| Path | What it configures |
| --- | --- |
| `zsh/` | zsh: aliases, completions, plugins, fzf and zoxide |
| `starship.toml` | Starship prompt (Black Metal palette) |
| `nvim/` | Neovim, based on [kickstart.nvim](https://github.com/nvim-lua/kickstart.nvim) (MIT, see `nvim/LICENSE.md`) |

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

## Private settings

Put machine-specific paths, tool initializers and secrets in `$ZDOTDIR/local.zsh`. `.zshrc` loads it if it exists, and Git ignores it.
