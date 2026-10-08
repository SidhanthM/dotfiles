# Dotfiles — installation guide

Personal **Apple Silicon macOS** setup: Ghostty → Herdr → Pi, plus zsh, Starship and Neovim. The repository lives directly at `~/.config`; no Stow or dotfiles symlink tree is needed.

**No AI agent is required.** Follow the stages in order and stop at a failed check. Installation downloads executable third-party software; review sources and installer scripts before running them.

## What gets restored

| Component | Tracked declaration | Installation step |
| --- | --- | --- |
| Ghostty | `ghostty/config` | Install app and Nerd Font |
| zsh / Starship | `zsh/`, `starship.toml` | Install shell tools; set `ZDOTDIR` |
| Herdr | `herdr/config.toml` | Install Herdr, then the two plugins below |
| Pi packages | `pi/agent/settings.json` → `packages` | `pi update --extensions` |
| Standalone Pi extensions | `pi/agent/extensions/` | Loaded from the cloned directory; no separate install |
| Pi themes, skills, agents | `pi/agent/themes/`, `skills/`, `agents/` | Loaded from the cloned directory |
| Neovim plugins | `nvim/lua/plugins/`, `nvim/lazy-lock.json` | lazy.nvim bootstrap, then `:Lazy restore` |

Credentials, sessions, history, caches, binaries and third-party plugin checkouts are **not** restored by cloning. GitHub/git identity and authentication are also configured separately.

Reference versions when this guide was checked: **Pi 1.1.0**, **Herdr 0.9.3**. Installers fetch their current releases; Pi package names are not version-pinned. This is a reproducible setup procedure, not a byte-for-byte frozen environment. Herdr plugin revisions below are pinned.

## 1. Install prerequisites

In the macOS Terminal app:

```sh
xcode-select --install
```

Wait for Command Line Tools to finish. Install [Homebrew](https://brew.sh/) using its official instructions. For Apple Silicon, activate it in this shell:

```sh
eval "$(/opt/homebrew/bin/brew shellenv)"
brew install git node python starship zoxide eza fzf ripgrep fd neovim \
  zsh-autosuggestions zsh-syntax-highlighting zsh-completions
brew install --cask ghostty font-jetbrains-mono-nerd-font
```

Checks:

```sh
uname -m                     # arm64; Intel/Linux need shell-path adaptations
brew --prefix                # /opt/homebrew
node --version               # Pi requires >= 22.19.0
python3 --version
nvim --version
```

The tracked shell files use `/opt/homebrew`. Do not use this guide unchanged on Intel Macs, Linux or Windows.

## 2. Put the repository in place

### Fresh machine: `~/.config` does not exist

```sh
git clone https://github.com/SidhanthM/dotfiles.git "$HOME/.config"
```

HTTPS avoids needing an SSH key just to clone. A private repository still requires GitHub authentication.

### Existing machine: preserve application state

**Do not delete or replace all of `~/.config`.** It may contain unrelated app data and credentials. Clone to a staging directory instead:

```sh
git clone https://github.com/SidhanthM/dotfiles.git "$HOME/dotfiles-staging"
```

Back up the corresponding existing files/directories outside `~/.config`, then copy only the tracked setup: `ghostty`, `zsh`, `nvim`, `starship.toml`, `herdr/config.toml`, and the tracked Pi settings/extensions/themes/skills/agents. Preserve existing Pi `auth.json`, sessions and caches, and Herdr plugin/runtime state. Review conflicting settings rather than blindly overwriting them.

This copy-only route does not turn the existing directory into a Git checkout. Keep the staging checkout for version control, or migrate it into place later after separately backing up and merging app state. The remaining steps assume the selected config files now live under `~/.config`.

Check that the standalone subagent helper is a **real file**, not a machine-specific symlink:

```sh
test -f "$HOME/.config/pi/agent/extensions/subagent/agents.ts" && \
  test ! -L "$HOME/.config/pi/agent/extensions/subagent/agents.ts" && \
  echo 'subagent helper: OK'
```

If this fails, stop: an older revision tracked a symlink into a global Homebrew Pi installation. Use a repository revision containing the actual helper file, rather than recreating that link.

## 3. Connect zsh and Pi to the config directory

`~/.zshenv` is outside this repository. If it already exists, back it up and merge the following lines into it **once**; do not overwrite unrelated settings. On a fresh machine, create it with this content:

```sh
export ZDOTDIR="$HOME/.config/zsh"
export PI_CODING_AGENT_DIR="$HOME/.config/pi/agent"
export PATH="$PI_CODING_AGENT_DIR/bin:$HOME/.local/bin:$PATH"
[ ! -f "$HOME/.cargo/env" ] || . "$HOME/.cargo/env"
```

The Cargo line is optional and safely skips machines without Rust. Rust is not needed for the basic shell/Pi setup.

Some integrations still look under `~/.pi/agent`. On a fresh machine only, provide the compatibility link:

```sh
mkdir -p "$HOME/.pi"
if [ ! -e "$HOME/.pi/agent" ] && [ ! -L "$HOME/.pi/agent" ]; then
  ln -s "$HOME/.config/pi/agent" "$HOME/.pi/agent"
fi
```

If `~/.pi/agent` already exists, inspect and back it up before migrating it. The command intentionally does not replace it.

Open a **new terminal window**, then check:

```sh
printf '%s\n' "$ZDOTDIR" "$PI_CODING_AGENT_DIR"
# Expected: ~/.config/zsh and ~/.config/pi/agent, expanded to absolute paths
command -v starship zoxide eza fzf
zsh -n "$HOME/.config/zsh/.zshrc"
```

If macOS uses a different login shell, select zsh with `chsh -s /bin/zsh` and log out/in.

### Personal shell shortcuts

The shell config also contains optional shortcuts for Flutter, Android, Anaconda, Yazi, tmux and other development tools. These are **not core installation dependencies**. In particular, the `~/Scripts/sessionX` shortcut has no bundled script, and the Conda block contains the original user's absolute paths. Remove or adapt these sections if you do not use them. `alias zfile` should point to `$ZDOTDIR/.zshrc` on a new machine, not a nonexistent `~/.zshrc`.

Do not install an entire development stack just to satisfy an unused alias.

## 4. Install Pi and restore its extensions

In the new shell, download and inspect the official installer, then run it:

```sh
curl -fsSL https://pi.dev/install.sh -o /tmp/pi-install.sh
less /tmp/pi-install.sh
sh /tmp/pi-install.sh
```

Follow the installer's PATH instructions if needed; then open a new shell. The exported `PI_CODING_AGENT_DIR` selects this repository's Pi directory.

```sh
command -v pi
pi --version
pi update --extensions
pi list
```

`pi update --extensions` reconciles the packages already declared in `settings.json`; cloning the declaration alone is not the installation step. Check `pi list` against that file's `packages` array. Do not run `pi install` for the standalone extensions: they already live under the agent directory.

Start Pi from a project directory:

```sh
cd "$HOME"
pi --verbose
```

Inspect startup output for extension errors. The expected local resources include the Black Metal footer, Herdr agent-state extension, standalone subagent tool, `fuji-night` theme and agent definitions. `pi config` can inspect/enable discovered resources.

### Sign in manually

Inside Pi:

1. Run `/login`.
2. For Command Code, select **Use a subscription → Command Code**, then browser login or paste your API key.
3. Run `/model` and select a model your account actually supports.
4. Send a small test prompt to verify a real request succeeds; this incurs model usage.

Authentication is intentionally not in Git. Model IDs in settings and agent definitions can become unavailable; check them with `/model` or `pi --list-models`, rather than assuming an old ID still works. The observational-memory package may also call its separately configured model, so review its model setting before using it.

`mcp.json` is tracked, but servers/credentials are not installed by cloning. The current file declares no servers; if you later add any, document their dependencies and verify them with `pi mcp list`.

## 5. Install Herdr and its plugins

```sh
curl -fsSL https://herdr.dev/install.sh -o /tmp/herdr-install.sh
less /tmp/herdr-install.sh
sh /tmp/herdr-install.sh
```

Open a new shell if its PATH instructions require it:

```sh
herdr --version
herdr config check
herdr plugin install --help
```

**Herdr has a plugin CLI.** Install the plugins directly; no AI or marketplace browsing is needed. Installation previews executable plugin code and asks for approval. These commits came from the working machine's plugin registry:

```sh
herdr plugin install AVGVSTVS96/herdr-drovr \
  --ref 03f38edba501f63d3f7044fc99cf3ae55438401e
herdr plugin install natori-hrj/herdr-lazy \
  --ref 8caad442f3710be6aff6872b03069068a931b38f
herdr plugin list --json
```

Expected: `drovr` **0.4.8** and `herdr-lazy` **0.44.0**, enabled, without missing-manifest warnings. If disabled:

```sh
herdr plugin enable drovr
herdr plugin enable herdr-lazy
```

- **drovr** supplies `Ctrl+Shift+M` (move pane) and `Ctrl+Shift+Option+M` (move tab), as configured in `config.toml`.
- **herdr-lazy** is an optional plugin manager. Installation normally fetches a prebuilt binary; a failed/missing prebuilt can require Rust >= 1.78 to build from source. It may create a recommended plugin list on first start, but installing that recommended bundle is a separate choice. Do not use “install all” or `sync` unless you actually want those extra plugins.

Do not copy `herdr/plugins.json` between machines: it contains absolute paths and generated registration data. These install commands reconstruct the registry. Plugin checkouts, logs, sockets and session snapshots stay ignored.

### Start and verify the stack

From Ghostty, **outside any existing Herdr pane**:

```sh
cd "$HOME"
herdr
```

Inside a Herdr pane:

```sh
printf '%s\n' "$HERDR_ENV" "$PI_CODING_AGENT_DIR"
herdr server reload-config
pi --verbose
```

Check the Black Metal theme, try splitting a pane, and test drovr's move shortcuts. If a shortcut does nothing, check whether macOS or Ghostty consumes it; `Ctrl+B`, then `?` shows Herdr bindings.

To open the optional plugin manager from a Herdr workspace:

```sh
herdr plugin pane open --plugin herdr-lazy --entrypoint manage --focus
```

### Old subagent plugin — not part of this setup

The working machine had a stale `pi-herdr-subagents` registration pointing to a deleted checkout. **Do not reproduce it.** The tracked standalone subagent extension creates Herdr tabs directly and does not depend on that plugin. Installing the separate upstream Pi subagent package as well can create overlapping tool names.

Do not run `herdr server stop` just to reload colors: it stops the persistent session and its panes. Use `herdr server reload-config`; schedule any actual restart when your running work is safe.

## 6. Ghostty appearance

Launch Ghostty after installing the Nerd Font. It reads `~/.config/ghostty/config`. Check that **JetBrainsMono Nerd Font**, Medium, renders correctly; the configured font size is 11.

After editing the config, reload with **Ctrl+Shift+,**. Validation:

```sh
/Applications/Ghostty.app/Contents/MacOS/ghostty +validate-config
```

The config uses charcoal `#141414` with muted pink/teal accents. Opacity and blur are configured in Ghostty; Herdr does not have an independent opacity setting in this setup. Existing Pi tool-panel colors are defined by the Pi theme, not the Herdr config.

## 7. Neovim (optional)

```sh
nvim
```

The first launch downloads lazy.nvim and installs declared plugins. Then run inside Neovim:

```vim
:Lazy restore
:checkhealth
:Mason
```

Use `:Lazy restore` to align plugin revisions with `lazy-lock.json`; `:Lazy update` changes them. Review build failures in `:Lazy`.

Some optional plugins need additional runtimes: Markdown Peek uses Deno; AI/native integrations may need compiler tools or Rust; language/debugger integrations need their own SDKs. Install only the features you use (for example `brew install deno` for Peek), and follow `:checkhealth`/plugin documentation for missing dependencies. Neovim includes personal development integrations and is not a minimal editor-only profile.

## Final checklist

- [ ] New zsh windows load without missing-source errors; Starship/eza/zoxide work.
- [ ] `ZDOTDIR` and `PI_CODING_AGENT_DIR` point into `~/.config`.
- [ ] `pi list` matches the packages in settings; Pi startup has no extension-load failures.
- [ ] `/login`, `/model` and one real prompt succeed.
- [ ] `herdr config check` succeeds; its plugin list shows drovr and herdr-lazy without warnings.
- [ ] Ghostty font/colors are correct; Herdr move shortcuts work.
- [ ] Optional: `:Lazy restore` and Neovim health checks have been reviewed.

## Updates, backups and Git hygiene

```sh
brew update && brew upgrade
pi update                       # Pi itself (official installer)
pi update --extensions          # declared Pi packages
herdr update                    # Herdr itself (official installer)
git -C "$HOME/.config" status --short
```

Herdr plugins are pinned above. To upgrade one, intentionally choose a new ref, install it, test it, and update this guide's command. A plain clone does not restore running sessions. Back up Pi's ignored auth/session data and Herdr state separately if you want to migrate them.

Before publishing changes, inspect both the file list and content:

```sh
git -C "$HOME/.config" diff
git -C "$HOME/.config" diff --cached
git -C "$HOME/.config" status --short
```

Never commit API keys, Pi auth/session files, zsh history, Herdr runtime registries or GitHub tokens. The `.gitignore` whitelist is intentional; avoid broad exceptions for entire app-state directories.

**Optional agent assistance:** an agent may read this guide and report which checks passed, failed or could not be verified. It should not install additional software, overwrite existing configs, expose credentials, or stop Herdr sessions without explicit approval. The guide and checks remain usable without an agent.

## Sources / troubleshooting

- [Homebrew installation](https://brew.sh/)
- [Pi installation and docs](https://github.com/earendil-works/pi/tree/main/packages/coding-agent)
- [Herdr installation](https://herdr.dev/docs/install/), [plugins](https://herdr.dev/docs/plugins/), [keyboard](https://herdr.dev/docs/keyboard/)
- [herdr-lazy](https://github.com/natori-hrj/herdr-lazy)
- [drovr](https://github.com/AVGVSTVS96/herdr-drovr)

When a command differs in a newer release, check that tool's `--help` and official documentation. Do not continue past an unexplained failure or replace a known command with a guessed one.
