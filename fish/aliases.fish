# ┌─────────┐
# │ Aliases │
# └─────────┘

# ── Listing ──
alias ls 'eza -1 --icons=auto'
alias l 'eza -lh --icons=auto'
alias ll 'eza -lha --icons=auto --sort=name --group-directories-first'
alias ld 'eza -lhD --icons=auto'
alias lt 'eza --icons=auto --tree'
alias ltt 'eza --tree --level=2 --long --icons --git'
alias lta 'lt -a'

# ── Navigation ──
alias cd 'z'
alias .. 'cd ..'
alias ... 'cd ../..'

# ── Editors ──
alias zed 'zeditor'
abbr -a c 'code .'

# ── Config files ──
alias bfile 'nvim ~/.bashrc'
alias ffile 'nvim ~/.config/fish/config.fish'

# ── Search & history ──
abbr -a h "history | grep "

# ── Dev tools ──
abbr -a fr 'flutter-watch'
abbr -a nd 'npm run dev'
abbr -a mr 'make run'
abbr -a lg lazygit
abbr -a d docker
abbr -a gits 'git status'
abbr -a gdd 'git diff --stat'
abbr -a ghp 'gh repo create --private $(basename "$PWD") --source=. --description="desc" --push'
abbr -a ghpp 'git init; git add .; git commit -m "initial commit"; gh repo create --private $(basename "$PWD") --source=. --description="desc" --push'
# abbr -a fr flutter run

# ── Mobile & Android ──
alias emu "~/Android/Sdk/emulator/emulator -avd Pixel_9_Pro &"
alias devices "~/Android/Sdk/emulator/emulator -list-avds"

# ── Media ──
alias rip "yt-dlp -x --audio-format=\"mp3\""

# ── GitHub Stars ──
alias stars "gh repo list vyrx-dev --limit 1000 --json stargazerCount | jq '[.[].stargazerCount] | add'"

# ── Safety wrappers ──
abbr -a mkdir 'mkdir -p'
abbr -a ping 'ping -c 10'
abbr -a tar "tar -xvf"

# ── System ──
abbr -a pg 'ping -c 10 google.com'
alias folders 'du -h --max-depth=1'

# ── Tmux ──
abbr -a tmuxk 'tmux kill-session'

# ── Misc ──
abbr -a chx 'chmod +x'
abbr -a x exit

# ── Snapper / BTRFS ──
abbr -a slsr 'sudo snapper -c root list'
abbr -a slsh 'sudo snapper -c home list'
abbr -a sdu 'sudo btrfs filesystem du -s /.snapshots/*'
abbr -a sdelr 'sudo snapper -c root delete'
abbr -a sdelh 'sudo snapper -c home delete --sync'
abbr -a sbdel 'sudo btrfs subvolume delete'
