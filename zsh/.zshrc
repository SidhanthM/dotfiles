# ── Homebrew (Apple Silicon) ──
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

# ── Colors ──
autoload -U colors && colors
export CLICOLOR=1
export COLORTERM=truecolor
# eza / ls colors: Black Metal teal directories, salmon executables, blue-gray links
export EZA_COLORS="di=38;2;169;155;208:ex=38;2;209;133;136:ln=38;2;109;154;156:or=38;2;200;92;112:*.tar.gz=38;2;209;133;136:*.iso=38;2;209;133;136:*.dmg=38;2;209;133;136"

# ── Environment ──
export EDITOR="nvim"
export SUDO_EDITOR="$EDITOR"
export VISUAL="nvim"
export MANPAGER="nvim +Man!"

# ── PATH ──
export PATH="$HOME/.local/bin:$PATH"

# ── Tools ──
command -v fzf     &>/dev/null && source <(fzf --zsh)
command -v zoxide  &>/dev/null && eval "$(zoxide init zsh)"
command -v starship &>/dev/null && eval "$(starship init zsh)"

# ── Plugins ──
# zsh-autosuggestions
source /opt/homebrew/share/zsh-autosuggestions/zsh-autosuggestions.zsh
# zsh-syntax-highlighting
source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
# zsh-completions
if type brew &>/dev/null; then
  FPATH="$(brew --prefix)/share/zsh-completions:$FPATH"
  autoload -Uz compinit
  compinit -i
fi

# ── Keybinds ──
bindkey '^[^?' backward-kill-word

# ── Aliases ──

# Listing
if command -v eza &>/dev/null; then
    alias ls='eza -1 --icons=auto'
    alias l='eza -lh --icons=auto'
    alias ll='eza -lha --icons=auto --sort=name --group-directories-first'
    alias ld='eza -lhD --icons=auto'
    alias lt='eza --icons=auto --tree'
    alias ltt='eza --tree --level=2 --long --icons --git'
    alias lta='lt -a'
fi

# Navigation
if command -v zoxide &>/dev/null; then
    alias cd='z'
    alias cdi='zi'
fi
alias ..='cd ..'
alias ...='cd ../..'

# Editors
alias n='nvim'
alias c='code .'

# Config
alias zfile='nvim "$ZDOTDIR/.zshrc"'

# File managers
alias zz='yazi'
alias o='open .'

# Search & history
alias h='history | grep '

# SSH
alias ssh='env TERM=xterm-256color ssh'

# Dev tools
alias nd='npm run dev'
alias mr='make run'
alias lg='lazygit'
alias d='docker'
alias gits='git status'

# Media
alias rip='yt-dlp -x --audio-format=mp3'

# Defaults
alias mkdir='mkdir -p'

# System
alias folders='du -h -d 1'
alias flushdns='sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder'
alias showfiles='defaults write com.apple.finder AppleShowAllFiles YES && killall Finder'
alias hidefiles='defaults write com.apple.finder AppleShowAllFiles NO && killall Finder'

# Package management (Homebrew)
alias brewup='brew update && brew upgrade'
alias brewclean='brew autoremove && brew cleanup'

# Misc
alias chx='chmod +x'

# ── Functions ──

# Yazi: cd into the directory when exiting
function y() {
    local tmp="$(mktemp -t yazi-cwd.XXXXXX)"
    yazi "$@" --cwd-file="$tmp"
    local cwd="$(cat "$tmp")"
    if [ -n "$cwd" ] && [ "$cwd" != "$PWD" ]; then
        builtin cd -- "$cwd"
    fi
    rm -f "$tmp"
}

# ── Machine-specific settings (not tracked) ──
[[ -f "$ZDOTDIR/local.zsh" ]] && source "$ZDOTDIR/local.zsh"
