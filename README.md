# dotfiles

Personal macOS + Linux configs. The repo root doubles as `~/.config` — clone it straight there.

## Setup

```sh
git clone <repo-url> ~/.config   # on a fresh machine (or clone elsewhere and copy in)
```

zsh needs a two-line `~/.zshenv` (not tracked):

```sh
printf '. "$HOME/.cargo/env"\nexport ZDOTDIR="$HOME/.config/zsh"\n' > ~/.zshenv
```

## Tracked

- **Ghostty** — `ghostty/` (Black Metal theme: bg `#141414`, fg `#c1c1c1`, teal `#486e6f`, pink `#dd9999`)
- **zsh** — `zsh/` (`.zshrc`, `.zprofile`; loaded via `ZDOTDIR`)
- **Herdr** — `herdr/config.toml` (Black Metal overrides, keybinds)
- **Neovim** — `nvim/`
- **Starship** — `starship.toml`
- **assets** — screenshots for this README

## Deliberately untracked

- **Pi** — lives in `~/.pi` (`settings.json`, `themes/`, `extensions/`), app-managed with `auth.json` secrets alongside
- **git / gh** — `~/.gitconfig`, `~/.config/gh/` (gh `hosts.yml` contains tokens)
- everything else in `~/.config` is app state, git-ignored via the whitelist in `.gitignore`
