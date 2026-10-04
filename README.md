# dotfiles

Personal macOS + Linux configs. The repo root doubles as `~/.config` — clone it straight there.

## Setup

```sh
git clone <repo-url> ~/.config   # on a fresh machine (or clone elsewhere and copy in)
```

- **Ghostty** — `ghostty/` (Black Metal theme: bg `#141414`, fg `#c1c1c1`, teal `#486e6f`, pink `#dd9999`)
- **Fish** — `fish/` (config, aliases, functions)
- **Neovim** — `nvim/` (LazyVim-style)
- **Tmux** — `tmux/tmux.conf` (XDG path, tmux ≥ 3.1)
- **Starship** — `starship.toml`
- **Vicinae** — `vicinae/`
- **Scripts** — `scripts/` (add to PATH: `fish_add_path ~/.config/scripts`)
- **assets** — screenshots for this README

Everything else in `~/.config` is app-managed state and git-ignored via the whitelist in `.gitignore`.
