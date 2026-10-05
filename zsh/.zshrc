# ── Homebrew (Apple Silicon) ──
# Ensure Homebrew tools take precedence over stale /usr/local so `node`
# resolves to Homebrew's Node 22 instead of the old Intel Node 20.12.2.
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
export TERMINAL="ghostty"
export MANPAGER="nvim +Man!"

# ── PATH ──
export PATH="$HOME/.local/bin:$PATH"
export PATH="$HOME/Scripts:$PATH"
export PATH="$HOME/dev-tools/flutter/bin:$PATH"
export PATH="$HOME/.pub-cache/bin:$PATH"
export PATH="$HOME/.spicetify/bin:$PATH"

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
  # /opt/homebrew/share is group-writable (admin group), which compaudit
  # flags as insecure. Single-user machine, so use completions without
  # the security check.
  autoload -Uz compinit
  compinit -u
fi

# ── Keybinds ──
function sessionizer() { $HOME/Scripts/sessionX; }
bindkey -s '^k' 'sessionizer\n'
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
alias cd='z'
alias cdi='zi'
alias ..='cd ..'
alias ...='cd ../..'

# Editors
alias n='nvim'
alias zed='zeditor'
alias c='code .'

# Config
alias zfile='nvim ~/.zshrc'

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
alias ghp='gh repo create --public $(basename "$PWD") --source=. --description="desc" --push'

# Mobile & Android
alias emu='~/Library/Android/sdk/emulator/emulator -avd Pixel_9 &'

# Media
alias rip='yt-dlp -x --audio-format=mp3'

# Safety wrappers
alias mkdir='mkdir -p'
alias ping='ping -c 10'
alias tar='tar -xvf'

# System
alias pg='ping -c 10 google.com'
alias folders='du -h -d 1'
alias flushdns='sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder'
alias showfiles='defaults write com.apple.finder AppleShowAllFiles YES && killall Finder'
alias hidefiles='defaults write com.apple.finder AppleShowAllFiles NO && killall Finder'

# Package management (Homebrew)
alias brewup='brew update && brew upgrade'
alias brewclean='brew autoremove && brew cleanup'

# Shell switching
alias tobash="chsh -s /bin/bash && echo 'Log out and log back in for change to take effect.'"
alias tozsh="chsh -s /bin/zsh && echo 'Log out and log back in for change to take effect.'"

# Tmux
alias tmuxk='tmux kill-session'

# Misc
alias chx='chmod +x'
alias x='exit'

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

# Flutter: hot-reload watcher inside tmux
function flutter-watch() {
    local pid_file="/tmp/tf1.pid"
    touch "$pid_file"
    tmux send-keys "flutter run $* --pid-file=$pid_file" Enter \; \
         split-window -v \; \
         send-keys 'npx -y nodemon -e dart -x "cat /tmp/tf1.pid | xargs kill -s USR1"' Enter \; \
         resize-pane -y 5 -t 1 \; \
         select-pane -t 0 \;
}

# >>> conda initialize >>>
# !! Contents within this block are managed by 'conda init' !!
__conda_setup="$('/Users/sid_m/anaconda3/bin/conda' 'shell.zsh' 'hook' 2> /dev/null)"
if [ $? -eq 0 ]; then
    eval "$__conda_setup"
else
    if [ -f "/Users/sid_m/anaconda3/etc/profile.d/conda.sh" ]; then
        . "/Users/sid_m/anaconda3/etc/profile.d/conda.sh"
    else
        export PATH="/Users/sid_m/anaconda3/bin:$PATH"
    fi
fi
unset __conda_setup
# <<< conda initialize <<<
