-- Black Metal colorscheme
-- Ported from fu-chen's VS Code "Black Metal" theme
-- Pure black background, muted greys, rusty red keywords, pale red strings, teal accents

vim.cmd 'highlight clear'
if vim.fn.exists 'syntax_on' == 1 then
  vim.cmd 'syntax reset'
end

vim.o.termguicolors = true
vim.g.colors_name = 'black-metal'

local c = {
  bg = 'NONE', -- transparent: ghostty bg (#141414 @ 91% opacity) shows through
  fg = '#c1c1c1',

  -- greys
  grey1 = '#f0f0f0', -- bright fg (badges, cursor on selection)
  grey2 = '#aaaaaa', -- functions, tags
  grey3 = '#999999', -- types, punctuation, active line nr
  grey4 = '#888888', -- comments, inactive fg
  grey5 = '#555555', -- line numbers
  grey6 = '#404040', -- borders, active indent guide
  grey7 = '#2a2a2a', -- whitespace chars
  grey8 = '#202020', -- indent guides, rulers
  grey9 = '#0f0f0f', -- inputs, title bars
  grey10 = '#0a0a0a', -- peek result bg
  grey11 = '#050505', -- hover / activity bar bg

  -- accents
  red = '#a06666', -- keywords, warnings, removed
  pale_red = '#dd9999', -- strings, constants, errors
  teal = '#486e6f', -- focus border, info, inserted, buttons
  teal_hover = '#568081',

  none = 'NONE',
}

local function hi(group, opts)
  vim.api.nvim_set_hl(0, group, opts)
end

-- ============================================================================
-- Editor UI
-- ============================================================================
hi('Normal', { fg = c.fg, bg = c.bg })
hi('NormalNC', { fg = c.fg, bg = c.bg })
hi('NormalFloat', { fg = c.fg, bg = c.grey11 })
hi('FloatBorder', { fg = c.grey6, bg = c.grey11 })
hi('FloatTitle', { fg = c.fg, bg = c.grey9, bold = true })
hi('Cursor', { fg = '#000000', bg = c.fg })
hi('lCursor', { link = 'Cursor' })
hi('CursorLine', { bg = '#080808' }) -- editor.lineHighlightBackground #ffffff08
hi('CursorColumn', { bg = '#080808' })
hi('ColorColumn', { bg = c.grey8 })
hi('LineNr', { fg = c.grey5 })
hi('CursorLineNr', { fg = c.grey3, bold = true })
hi('SignColumn', { bg = c.bg })
hi('FoldColumn', { fg = c.grey5, bg = c.bg })
hi('Folded', { fg = c.grey4, bg = c.grey9 })
hi('Visual', { bg = '#333333' }) -- editor.selectionBackground #c1c1c140
hi('VisualNOS', { link = 'Visual' })
hi('Search', { bg = '#3d2a2a' }) -- findMatchBackground #a0666644
hi('IncSearch', { bg = '#4d3333', bold = true })
hi('CurSearch', { link = 'IncSearch' })
hi('Substitute', { link = 'IncSearch' })
hi('MatchParen', { bg = '#1c2c2c', underline = true }) -- bracketMatch #486e6f20/66
hi('NonText', { fg = c.grey7 })
hi('Whitespace', { fg = c.grey7 })
hi('SpecialKey', { fg = c.grey7 })
hi('EndOfBuffer', { fg = '#000000' })
hi('Conceal', { fg = c.grey4 })
hi('Directory', { fg = c.grey2 })
hi('Title', { fg = c.fg, bold = true })
hi('Question', { fg = c.teal_hover })
hi('MoreMsg', { fg = c.teal_hover })
hi('ModeMsg', { fg = c.fg })
hi('ErrorMsg', { fg = c.pale_red })
hi('WarningMsg', { fg = c.red })
hi('WinSeparator', { fg = c.grey8 })
hi('VertSplit', { link = 'WinSeparator' })
hi('StatusLine', { fg = c.fg, bg = c.grey9 })
hi('StatusLineNC', { fg = c.grey4, bg = c.grey11 })
hi('TabLine', { fg = c.grey4, bg = c.grey9 })
hi('TabLineFill', { bg = c.grey11 })
hi('TabLineSel', { fg = c.fg, bg = c.none, bold = true })
hi('Pmenu', { fg = c.fg, bg = c.grey9 })
hi('PmenuSel', { fg = c.grey1, bg = c.teal })
hi('PmenuSbar', { bg = c.grey9 })
hi('PmenuThumb', { bg = c.grey6 })
hi('PmenuKind', { fg = c.grey2, bg = c.grey9 })
hi('PmenuKindSel', { fg = c.grey1, bg = c.teal })
hi('PmenuExtra', { fg = c.grey4, bg = c.grey9 })
hi('PmenuExtraSel', { fg = c.grey1, bg = c.teal })
hi('WildMenu', { link = 'PmenuSel' })
hi('QuickFixLine', { bg = c.grey8 })
hi('SpellBad', { sp = c.pale_red, undercurl = true })
hi('SpellCap', { sp = c.teal, undercurl = true })
hi('SpellLocal', { sp = c.teal, undercurl = true })
hi('SpellRare', { sp = c.red, undercurl = true })
hi('CursorIM', { link = 'Cursor' })
hi('TermCursor', { link = 'Cursor' })
hi('TermCursorNC', { fg = c.grey5, bg = c.grey5 })
hi('WinBar', { fg = c.fg })
hi('WinBarNC', { fg = c.grey4 })
hi('DiffAdd', { bg = '#14211f' }) -- inserted #486e6f22
hi('DiffChange', { bg = '#141414' })
hi('DiffDelete', { bg = '#221414' }) -- removed #a0666622
hi('DiffText', { bg = '#1c2c2c' })
hi('Added', { fg = c.teal_hover })
hi('Removed', { fg = c.red })
hi('Changed', { fg = c.grey2 })
hi('Underlined', { underline = true })
hi('Ignore', { fg = c.grey5 })
hi('Error', { fg = c.pale_red })
hi('Todo', { fg = c.teal_hover, bold = true })

-- ============================================================================
-- Syntax (legacy groups; treesitter links to these)
-- ============================================================================
hi('Comment', { fg = c.grey4, italic = true })
hi('Constant', { fg = c.pale_red })
hi('String', { fg = c.pale_red })
hi('Character', { fg = c.pale_red })
hi('Number', { fg = c.pale_red })
hi('Boolean', { fg = c.pale_red })
hi('Float', { fg = c.pale_red })
hi('Identifier', { fg = c.fg })
hi('Function', { fg = c.grey2 })
hi('Statement', { fg = c.red })
hi('Conditional', { fg = c.red })
hi('Repeat', { fg = c.red })
hi('Label', { fg = c.red })
hi('Operator', { fg = c.grey3 })
hi('Keyword', { fg = c.red })
hi('Exception', { fg = c.red })
hi('PreProc', { fg = c.red })
hi('Include', { fg = c.red })
hi('Define', { fg = c.red })
hi('Macro', { fg = c.red })
hi('PreCondit', { fg = c.red })
hi('Type', { fg = c.grey3 })
hi('StorageClass', { fg = c.red })
hi('Structure', { fg = c.grey3 })
hi('Typedef', { fg = c.grey3 })
hi('Special', { fg = c.grey2 })
hi('SpecialChar', { fg = c.pale_red })
hi('Tag', { fg = c.grey2 })
hi('Delimiter', { fg = c.grey3 })
hi('SpecialComment', { fg = c.grey4 })
hi('Debug', { fg = c.red })

-- ============================================================================
-- Treesitter
-- ============================================================================
hi('@variable', { fg = c.fg })
hi('@variable.builtin', { fg = c.pale_red })
hi('@variable.parameter', { fg = c.fg })
hi('@variable.member', { fg = c.fg }) -- semantic: property
hi('@constant', { fg = c.pale_red })
hi('@constant.builtin', { fg = c.pale_red })
hi('@constant.macro', { fg = c.pale_red })
hi('@module', { fg = c.grey3 })
hi('@label', { fg = c.red })
hi('@string', { fg = c.pale_red })
hi('@string.escape', { fg = c.pale_red })
hi('@string.special', { fg = c.pale_red })
hi('@string.regexp', { fg = c.pale_red })
hi('@character', { fg = c.pale_red })
hi('@boolean', { fg = c.pale_red })
hi('@number', { fg = c.pale_red })
hi('@float', { fg = c.pale_red })
hi('@type', { fg = c.grey3 })
hi('@type.builtin', { fg = c.grey2 }) -- semantic: type.defaultLibrary
hi('@type.definition', { fg = c.grey3 })
hi('@attribute', { fg = c.grey2 })
hi('@property', { fg = c.fg })
hi('@function', { fg = c.grey2 })
hi('@function.builtin', { fg = c.grey2 })
hi('@function.call', { fg = c.grey2 })
hi('@function.macro', { fg = c.grey2 })
hi('@function.method', { fg = c.grey2 })
hi('@function.method.call', { fg = c.grey2 })
hi('@constructor', { fg = c.grey3 })
hi('@operator', { fg = c.grey3 })
hi('@keyword', { fg = c.red })
hi('@keyword.function', { fg = c.red })
hi('@keyword.operator', { fg = c.red })
hi('@keyword.return', { fg = c.red })
hi('@keyword.conditional', { fg = c.red })
hi('@keyword.repeat', { fg = c.red })
hi('@keyword.exception', { fg = c.red })
hi('@keyword.import', { fg = c.red })
hi('@punctuation', { fg = c.grey3 })
hi('@punctuation.delimiter', { fg = c.grey3 })
hi('@punctuation.bracket', { fg = c.grey3 })
hi('@punctuation.special', { fg = c.grey3 })
hi('@comment', { fg = c.grey4, italic = true })
hi('@comment.todo', { fg = c.teal_hover, bold = true })
hi('@comment.error', { fg = c.pale_red, bold = true })
hi('@comment.warning', { fg = c.red, bold = true })
hi('@comment.note', { fg = c.teal, bold = true })
hi('@markup.heading', { fg = c.fg, bold = true })
hi('@markup.strong', { fg = c.fg, bold = true })
hi('@markup.italic', { fg = c.fg, italic = true })
hi('@markup.strikethrough', { strikethrough = true })
hi('@markup.underline', { underline = true })
hi('@markup.list', { fg = c.fg })
hi('@markup.link', { fg = c.teal_hover, underline = true })
hi('@markup.link.url', { fg = c.teal_hover, underline = true })
hi('@markup.raw', { fg = c.pale_red })
hi('@markup.quote', { fg = c.grey4, italic = true })
hi('@tag', { fg = c.grey2 })
hi('@tag.attribute', { fg = c.grey2 })
hi('@tag.delimiter', { fg = c.grey3 })
hi('@diff.plus', { fg = c.teal_hover })
hi('@diff.minus', { fg = c.red })
hi('@diff.delta', { fg = c.grey2 })

-- ============================================================================
-- LSP
-- ============================================================================
hi('DiagnosticError', { fg = c.pale_red })
hi('DiagnosticWarn', { fg = c.red })
hi('DiagnosticInfo', { fg = c.teal })
hi('DiagnosticHint', { fg = c.teal })
hi('DiagnosticOk', { fg = c.teal_hover })
hi('DiagnosticVirtualTextError', { fg = c.pale_red, bg = '#1a1010' })
hi('DiagnosticVirtualTextWarn', { fg = c.red, bg = '#161212' })
hi('DiagnosticVirtualTextInfo', { fg = c.teal, bg = '#101414' })
hi('DiagnosticVirtualTextHint', { fg = c.teal, bg = '#101414' })
hi('DiagnosticUnderlineError', { sp = c.pale_red, undercurl = true })
hi('DiagnosticUnderlineWarn', { sp = c.red, undercurl = true })
hi('DiagnosticUnderlineInfo', { sp = c.teal, undercurl = true })
hi('DiagnosticUnderlineHint', { sp = c.teal, undercurl = true })
hi('LspReferenceText', { bg = '#161616' }) -- wordHighlight #aaaaaa14
hi('LspReferenceRead', { bg = '#161616' })
hi('LspReferenceWrite', { bg = '#1c1c1c' }) -- wordHighlightStrong #aaaaaa22
hi('LspSignatureActiveParameter', { fg = c.pale_red, bold = true })
hi('LspInlayHint', { fg = c.grey5, bg = '#0a0a0a' })

hi('@lsp.type.variable', { fg = c.fg })
hi('@lsp.type.parameter', { fg = c.fg })
hi('@lsp.type.property', { fg = c.fg })
hi('@lsp.mod.readonly', { fg = c.pale_red })
hi('@lsp.typemod.variable.readonly', { fg = c.pale_red })
hi('@lsp.typemod.type.defaultLibrary', { fg = c.grey2 })
hi('@lsp.typemod.function.defaultLibrary', { fg = c.grey2 })

-- ============================================================================
-- Plugins: gitsigns, telescope, which-key, mini, blink.cmp, todo-comments
-- ============================================================================
hi('GitSignsAdd', { fg = c.teal_hover })
hi('GitSignsChange', { fg = c.grey2 })
hi('GitSignsDelete', { fg = c.red })

hi('TelescopeNormal', { fg = c.fg, bg = c.grey11 })
hi('TelescopeBorder', { fg = c.grey6, bg = c.grey11 })
hi('TelescopePromptNormal', { fg = c.fg, bg = c.grey9 })
hi('TelescopePromptBorder', { fg = c.grey6, bg = c.grey9 })
hi('TelescopePromptTitle', { fg = c.grey1, bg = c.teal, bold = true })
hi('TelescopePreviewTitle', { fg = c.grey1, bg = c.teal, bold = true })
hi('TelescopeResultsTitle', { fg = c.grey4, bg = c.grey11 })
hi('TelescopeSelection', { bg = c.grey8 })
hi('TelescopeSelectionCaret', { fg = c.teal_hover, bg = c.grey8 })
hi('TelescopeMatching', { fg = c.pale_red, bold = true })

hi('WhichKey', { fg = c.grey2 })
hi('WhichKeyGroup', { fg = c.teal_hover })
hi('WhichKeyDesc', { fg = c.fg })
hi('WhichKeySeparator', { fg = c.grey5 })
hi('WhichKeyNormal', { bg = c.grey11 })
hi('WhichKeyBorder', { fg = c.grey6, bg = c.grey11 })

hi('MiniStatuslineModeNormal', { fg = c.grey1, bg = c.teal, bold = true })
hi('MiniStatuslineModeInsert', { fg = '#000000', bg = c.pale_red, bold = true })
hi('MiniStatuslineModeVisual', { fg = c.grey1, bg = c.red, bold = true })
hi('MiniStatuslineModeReplace', { fg = c.grey1, bg = c.red, bold = true })
hi('MiniStatuslineModeCommand', { fg = c.grey1, bg = c.teal_hover, bold = true })
hi('MiniStatuslineModeOther', { fg = c.grey1, bg = c.teal, bold = true })
hi('MiniStatuslineDevinfo', { fg = c.fg, bg = c.grey8 })
hi('MiniStatuslineFilename', { fg = c.grey4, bg = c.grey9 })
hi('MiniStatuslineFileinfo', { fg = c.fg, bg = c.grey8 })
hi('MiniStatuslineInactive', { fg = c.grey4, bg = c.grey11 })
hi('MiniIndentscopeSymbol', { fg = c.grey6 })
hi('MiniIndentscopePrefix', { nocombine = true })
hi('MiniPickNormal', { fg = c.fg, bg = c.grey11 })
hi('MiniPickBorder', { fg = c.grey6, bg = c.grey11 })
hi('MiniPickMatchCurrent', { bg = c.grey8 })
hi('MiniPickMatchMarked', { fg = c.teal_hover, bg = c.grey8 })
hi('MiniPickPrompt', { fg = c.fg, bg = c.grey9 })
hi('MiniFilesNormal', { fg = c.fg, bg = c.grey11 })
hi('MiniFilesBorder', { fg = c.grey6, bg = c.grey11 })
hi('MiniFilesDirectory', { fg = c.grey2 })
hi('MiniFilesCursorLine', { bg = c.grey8 })
hi('MiniHipatternsFixme', { fg = '#000000', bg = c.pale_red, bold = true })
hi('MiniHipatternsHack', { fg = '#000000', bg = c.red, bold = true })
hi('MiniHipatternsNote', { fg = '#000000', bg = c.teal, bold = true })
hi('MiniHipatternsTodo', { fg = '#000000', bg = c.teal_hover, bold = true })

hi('BlinkCmpMenu', { link = 'Pmenu' })
hi('BlinkCmpMenuBorder', { link = 'FloatBorder' })
hi('BlinkCmpMenuSelection', { link = 'PmenuSel' })
hi('BlinkCmpLabelMatch', { fg = c.pale_red, bold = true })
hi('BlinkCmpLabelDeprecated', { fg = c.grey5, strikethrough = true })
hi('BlinkCmpKind', { fg = c.grey2 })
hi('BlinkCmpDoc', { link = 'NormalFloat' })
hi('BlinkCmpDocBorder', { link = 'FloatBorder' })
hi('BlinkCmpSignatureHelp', { link = 'NormalFloat' })
hi('BlinkCmpSignatureHelpBorder', { link = 'FloatBorder' })

hi('TodoFgTODO', { fg = c.teal_hover, bold = true })
hi('TodoBgTODO', { fg = '#000000', bg = c.teal_hover, bold = true })
hi('TodoSignTODO', { fg = c.teal_hover })
hi('TodoFgFIX', { fg = c.pale_red, bold = true })
hi('TodoBgFIX', { fg = '#000000', bg = c.pale_red, bold = true })
hi('TodoSignFIX', { fg = c.pale_red })
hi('TodoFgWARN', { fg = c.red, bold = true })
hi('TodoBgWARN', { fg = '#000000', bg = c.red, bold = true })
hi('TodoSignWARN', { fg = c.red })
hi('TodoFgNOTE', { fg = c.teal, bold = true })
hi('TodoBgNOTE', { fg = '#000000', bg = c.teal, bold = true })
hi('TodoSignNOTE', { fg = c.teal })

hi('FidgetTitle', { fg = c.teal_hover })
hi('FidgetTask', { fg = c.grey4 })

hi('IblIndent', { fg = c.grey8 })
hi('IblScope', { fg = c.grey6 })

-- lazy.nvim / mason / vim.pack UIs (just in case)
hi('LazyNormal', { fg = c.fg, bg = c.grey11 })
hi('MasonNormal', { fg = c.fg, bg = c.grey11 })
hi('MasonHeader', { fg = c.grey1, bg = c.teal, bold = true })
hi('MasonHighlight', { fg = c.teal_hover })
hi('MasonHighlightBlock', { fg = c.grey1, bg = c.teal })
hi('MasonMuted', { fg = c.grey5 })
hi('MasonMutedBlock', { fg = c.grey4, bg = c.grey8 })
