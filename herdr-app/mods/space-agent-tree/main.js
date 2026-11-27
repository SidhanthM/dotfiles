import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, agents, terminals, focused, theme, shared, setShared, setAgentOrder,
  run, openOverlay, props, layout, nextCommand, checking, settings, notify } from "herdr";
import { buildAgentTree, flattenAgents, visibleAgents, retainAgent, agentLabel, agentActions } from "./model.js";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) { const result = find(child, id); if (result) return result; }
  return null;
}
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? 268) < 160;
const ROW = 28, ICON = 16, STEP = 20;
// Agent icons sit at x = 1 + AGENT_X + depth*STEP; a child's guide runs under
// its parent's icon center.
const AGENT_X = 13, GUIDE_X = 1 + AGENT_X + ICON / 2 - STEP;
const CLEAR = "#00000000";
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };
const PALETTE = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
function savedArray(key) {
  try { const value = JSON.parse(localStorage.getItem(key) ?? "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
}

export default class SpaceAgentTree extends View {
  init(_props, cx) {
    // A zero-height copy that only listens for Cmd+K, so the toggle works
    // whichever sidebar view (this tree or the classic lists) is showing.
    this.toggleOnly = props()?.toggle === true;
    if (this.toggleOnly) {
      if (!checking()) cx.spawn(async () => {
        for (;;) {
          const cmd = await nextCommand();
          const showing = find(layout(), "sidebar-lists")?.active;
          if (cmd !== "toggle-sidebar") continue;
          run("layout.select", { stack: "sidebar-lists", child: showing === "sidebar-classic" ? "sidebar-tree" : "sidebar-classic" });
        }
      });
      return;
    }
    this.handle = cx.focus_handle();
    this.selected = null;
    this.hovered = null;
    try {
      const saved = JSON.parse(localStorage.getItem("folded") ?? "[]");
      this.folded = new Set(Array.isArray(saved) ? saved.filter(k => typeof k === "string") : []);
    } catch { this.folded = new Set(); }
    this.hideAll = localStorage.getItem("hideAllAgents") === "true";
    this.retained = savedArray("retained").filter(r => r && typeof r.address === "string" && typeof r.space === "string");
    this.historyJson = JSON.stringify(this.retained);
    this.dismissed = new Set(savedArray("dismissed").filter(address => typeof address === "string"));
    if (checking()) return;
    cx.spawn(async cx => {
      for (;;) {
        const command = await nextCommand();
        if (command === "focus") this.handle.focus();
        else if (command === "hide-all") this.setHideAll(true, cx);
        else if (command === "show-all") this.setHideAll(false, cx);
        else if (command.startsWith("dismiss:")) this.dismiss(command.slice(8), cx);
        else if (command.startsWith("retain:")) {
          try {
            const record = JSON.parse(command.slice(7));
            if (typeof record.address === "string" && spaces().some(s => s.id === record.space) && record.program?.agent) {
              this.retained = [...this.retained.filter(r => r.address !== record.address), record];
              this.saveHistory();
            }
          } catch { /* Ignore malformed imported metadata. */ }
        }
        else if (command.startsWith("fold:")) this.toggle(command.slice(5), cx);
        else if (command.startsWith("pick:")) {
          const key = command.slice(5);
          const row = this.rows().find(r => r.key === key) ?? this.groups().flatMap(group =>
            flattenAgents(group.children).map(r => ({ ...r, group, key: `ag:${r.node.address}` }))).find(r => r.key === key);
          if (row) this.activate(row);
        } else if (command.startsWith("key:")) this.onKey({ key: command.slice(4) }, cx);
        cx.notify();
      }
    });
  }

  saveHistory() {
    const json = JSON.stringify(this.retained);
    if (json !== this.historyJson) { localStorage.setItem("retained", json); this.historyJson = json; }
  }

  groups() {
    const currentSpaces = spaces();
    const groups = buildAgentTree({ spaces: currentSpaces, agents: agents(), terminals: terminals(),
      retained: this.retained, dismissed: this.dismissed });
    const ids = new Set(currentSpaces.map(s => s.id));
    const history = new Map(this.retained.filter(r => ids.has(r.space) && !this.dismissed.has(r.address)).map(r => [r.address, r]));
    let changedDismissals = false;
    for (const group of groups) for (const { node } of flattenAgents(group.children)) {
      if (!node.archived) history.set(node.address, retainAgent(node));
      if (node.status === "working" && this.dismissed.delete(node.address)) changedDismissals = true;
    }
    this.retained = [...history.values()];
    this.saveHistory();
    if (changedDismissals) localStorage.setItem("dismissed", JSON.stringify([...this.dismissed]));
    return groups;
  }

  rows(groups = this.groups()) {
    const foldedAgents = new Set([...this.folded].filter(k => k.startsWith("ag:")).map(k => k.slice(3)));
    return groups.flatMap(group => {
      const key = `sp:${group.space.id}`;
      const children = visibleAgents(group.children, { folded: foldedAgents,
        workingOnly: this.folded.has(key), hideAll: this.hideAll })
        .map(row => ({ ...row, key: `ag:${row.node.address}`, group }));
      return [{ key, group, depth: -1 }, ...children];
    });
  }

  setHideAll(hidden, cx) {
    this.hideAll = hidden;
    localStorage.setItem("hideAllAgents", String(hidden));
    cx.notify();
  }

  dismiss(address, cx) {
    const node = this.groups().flatMap(g => flattenAgents(g.children)).find(r => r.node.address === address)?.node;
    if (!node || node.status === "working") return;
    this.dismissed.add(address);
    localStorage.setItem("dismissed", JSON.stringify([...this.dismissed]));
    this.retained = this.retained.filter(r => r.address !== address);
    this.saveHistory();
    cx.notify();
  }

  toggle(key, cx) {
    if (this.hideAll) { this.setHideAll(false, cx); this.folded.delete(key); }
    else this.folded.has(key) ? this.folded.delete(key) : this.folded.add(key);
    localStorage.setItem("folded", JSON.stringify([...this.folded]));
    this.selected = key;
    cx.notify();
  }

  activate(row) {
    this.selected = row.key;
    if (!row.node) run("space.select", { id: row.group.space.id });
    else if (row.node.archived) notify({ title: "Agent has exited", level: "info",
      body: "Herdr’s built-in peek only opens running terminals. This completed entry will stay in the sidebar until you dismiss it." });
    else for (const [command, args] of agentActions(row.node)) run(command, args);
  }

  onKey(event, cx) {
    const key = event.key?.toLowerCase().replace(/^arrow/, "");
    const rows = this.rows();
    if (!rows.length) return;
    let at = rows.findIndex(r => r.key === this.selected);
    if (at < 0) at = Math.max(0, rows.findIndex(r => !r.node && r.group.space.active));
    const row = rows[at];
    const hasKids = row.node ? row.node.children.length > 0 : row.group.children.length > 0;
    if (key === "down" || key === "up") at = Math.max(0, Math.min(rows.length - 1, at + (key === "down" ? 1 : -1)));
    else if (key === "home") at = 0;
    else if (key === "end") at = rows.length - 1;
    else if (key === "enter" || key === "space") this.activate(row);
    else if (key === "right") {
      if (hasKids && this.folded.has(row.key)) this.toggle(row.key, cx);
      else if (hasKids) at = Math.min(rows.length - 1, at + 1);
    } else if (key === "left") {
      if (hasKids && !this.folded.has(row.key)) this.toggle(row.key, cx);
      else { for (let i = at - 1; i >= 0; i--) if (rows[i].depth < row.depth) { at = i; break; } }
    } else if (key === "escape") {
      const pane = focused()?.pane;
      if (pane) run("pane.focus", { pane });
    } else return;
    this.selected = rows[at].key;
    cx.stop_propagation();
    cx.notify();
  }

  // Shared row chrome: a 1px border that is always present (transparent unless
  // keyboard-selected) so focus never shifts content sideways.
  ring(el, key) {
    const t = theme();
    return el.border(1).border_color(this.handle.is_focused() && this.selected === key ? t.accent : CLEAR);
  }

  hoverTrack(el, key) {
    return el.on_hover((hovered, cx) => {
      const next = hovered ? key : this.hovered === key ? null : this.hovered;
      if (next !== this.hovered) { this.hovered = next; cx.notify(); }
    });
  }

  status(status, t, archived = false) {
    const box = h_flex().size(ICON).flex_none().items_center().justify_center();
    if (archived) return box.child(svg("mods/workspace-chrome/check.svg").size(11).text_color(t.dim));
    if (status === "working") return box.child(svg("mods/workspace-chrome/spinner.svg").size(11).text_color(t.working).spin(900));
    if (status === "blocked") return box.child(div().text_size(11).font_bold().text_color(t.blocked).child("!"));
    return box.child(div().size(6).rounded(3)
      .when(status === "idle", el => el.border(1.5).border_color(t.dim))
      .when(status !== "idle", el => el.bg(t[status] ?? t.dim)));
  }

  spaceRow(row, t, compact, first, highlight) {
    const s = row.group.space;
    const index = spaces().findIndex(space => space.id === s.id);
    const chosen = shared("space.colors")?.[s.id] ?? PALETTE[Math.max(0, index) % PALETTE.length];
    const color = chosen.startsWith("#") ? chosen : MARK[chosen] ?? t[chosen] ?? t.accent;
    const kids = row.group.children.length > 0;
    const folded = this.hideAll || this.folded.has(row.key);
    const el = h_flex().id(row.key).h(ROW).flex_none().px(compact ? 3 : 6).gap(8).rounded(7).items_center()
      .when(!first && !compact, el => el.mt(6))
      .when(highlight, el => el.bg(t.selected))
      .when(!highlight, el => el.hover(el => el.bg(t.hover))).cursor_pointer()
      .tooltip(`${s.name}${s.machine ? ` · ${s.machine}` : ""} · ${row.group.count} agent${row.group.count === 1 ? "" : "s"}`)
      .on_click(() => this.activate(row))
      .on_mouse_down("right", () => openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260,
        props: { tab: "space", target: { id: s.id } } }))
      .child(h_flex().size(18).flex_none().rounded(5).bg(color).items_center().justify_center()
        .text_color("#ffffff").text_size(10.5).font_bold().child([...s.name][0]?.toUpperCase() ?? "?"))
      .when(!compact, el => el.child(h_flex().flex_1().min_w(0).gap(4).items_center()
          .child(div().flex_initial().min_w(0).truncate().font_medium()
            .text_color(s.active ? t.foreground : t.muted).child(s.name))
          .when(kids, el => el.child(h_flex().id(`fold-${row.key}`).size(16).flex_none().rounded(4)
            .items_center().justify_center().cursor_pointer().hover(s => s.bg(t.hover))
            .tooltip(this.hideAll ? "Show agents" : folded ? "Show all agents" : "Show only working agents")
            .on_click((_event, cx) => { cx.stop_propagation(); this.handle.focus(); this.toggle(row.key, cx); })
            .child(svg(`mods/workspace-chrome/chevron-${folded ? "right" : "down"}.svg`).size(11).text_color(t.dim)))))
        .when(Boolean(s.machine), el => el.child(div().flex_none().text_size(11).text_color(t.dim).child(s.machine))));
    return this.ring(el, row.key);
  }

  agentRow(row, t, on) {
    const node = row.node;
    const program = node.program;
    const label = agentLabel(node);
    const hovered = this.hovered === row.key;
    const dismissable = node.status !== "working";
    const kids = node.children.length;
    const folded = this.folded.has(row.key);
    const pic = program?.icon ? (program.tint ? svg(program.icon).size(14).text_color(t.foreground)
      : image(program.icon).w(14).h(14)) : div().text_size(12).text_color(t.muted).child("◇");
    const el = h_flex().id(row.key).relative().h(ROW).flex_none().pl(AGENT_X + row.depth * STEP).pr(4).gap(7)
      .items_center().rounded(7).cursor_pointer()
      .when(on, el => el.bg(t.selected))
      .when(!on, el => el.hover(el => el.bg(t.hover)))
      .tooltip(`${label} · ${program?.name ?? "Agent"} · ${node.archived ? "completed · terminal exited" : node.status} · ${node.address}`)
      .on_click(() => this.activate(row))
      .when(Boolean(node.agent?.pane), el => el.on_mouse_down("right", () => openOverlay({
        mod: "menu", kind: "popup", width: 220, height: 300,
        props: { tab: "pane", target: { pane: node.agent.pane, terminal: node.address } } })))
      // Continuous guide under the parent's icon (rows have no vertical gap).
      .when(row.depth > 0, el => el.child(div().absolute().left(GUIDE_X + row.depth * STEP).top(0).bottom(0).w(1).bg(t.border)))
      .child(h_flex().size(ICON).flex_none().items_center().justify_center().child(pic))
      .child(div().flex_1().min_w(0).truncate()
        .text_color(on ? t.foreground : node.archived ? t.dim : node.status === "idle" ? t.muted : t.foreground)
        .child(label))
      .when(kids > 0, el => el.child(h_flex().id(`fold-${row.key}`).h(18).px(4).gap(2).flex_none().rounded(4)
        .items_center().text_size(10.5).text_color(t.dim).cursor_pointer().hover(s => s.bg(t.hover))
        .tooltip(folded ? "Show child agents" : "Hide child agents")
        .on_click((_event, cx) => { cx.stop_propagation(); this.handle.focus(); this.toggle(row.key, cx); })
        .child(String(kids))
        .child(svg(`mods/workspace-chrome/chevron-${folded ? "right" : "down"}.svg`).size(10))))
      // Status and dismiss share one slot: hover swaps the dot for ×.
      .child(hovered && dismissable
        ? h_flex().id(`dismiss-${node.address}`).size(ICON).flex_none().rounded(4).items_center().justify_center()
          .cursor_pointer().text_color(t.muted).hover(el => el.bg(t.hover).text_color(t.foreground))
          .tooltip("Dismiss from sidebar (keeps terminal and conversation)")
          .on_click((_event, cx) => { cx.stop_propagation(); this.dismiss(node.address, cx); })
          .child(svg("mods/workspace-chrome/x.svg").size(11))
        : this.status(node.status, t, node.archived));
    return this.ring(this.hoverTrack(el, row.key), row.key);
  }

  render() {
    if (this.toggleOnly) return div();
    const t = theme();
    const compact = narrow();
    const all = this.groups();
    const rows = this.rows(all);
    const current = focused();
    const isOn = address => current?.terminal === address || current?.shown === address || current?.agent === address;
    // Retained history is not a live keyboard-navigation destination.
    setAgentOrder(all.flatMap(g => flattenAgents(g.children).filter(r => r.node.agent && !r.node.archived).map(r => r.node.address)));
    return v_flex().size_full().min_h(0).bg(t.chrome).text_size(13)
      .id("space-agent-tree").track_focus(this.handle).on_key_down((event, cx) => this.onKey(event, cx))
      .when(!compact, el => el.child(h_flex().h(34).flex_none().pl(16).pr(10).items_center().justify_between()
        .child(div().text_size(11.5).font_medium().text_color(t.dim).child("Spaces"))
        .child(h_flex().gap(8).items_center()
          .child(div().id("space-agent-hide-all").px(6).py(2).rounded(5).cursor_pointer().text_size(11).text_color(t.muted)
            .hover(el => el.bg(t.hover).text_color(t.foreground)).tooltip(this.hideAll ? "Show agents again" : "Hide every agent row, including working agents")
            .on_click((_event, cx) => this.setHideAll(!this.hideAll, cx)).child(this.hideAll ? "Show agents" : "Hide all"))
          .child(h_flex().id("space-agent-new").size(24).rounded(6).items_center().justify_center().cursor_pointer().text_color(t.muted)
            .hover(el => el.bg(t.hover).text_color(t.foreground)).tooltip("New space")
            .on_click(() => run("space.new"))
            .child(svg("mods/workspace-chrome/plus.svg").size(14))))))
      .child(v_flex().id("space-agent-list").flex_1().min_h(0).px(compact ? 4 : 8).pb(8).overflow_y_scrollbar()
        .children(rows.filter(row => !compact || !row.node).map((row, i) => {
          if (row.node) return this.agentRow(row, t, isOn(row.node.address));
          // Highlight the active space only when none of its shown agents is focused.
          const own = rows.filter(r => r.node && r.group === row.group);
          return this.spaceRow(row, t, compact, i === 0, row.group.space.active && (compact || !own.some(r => isOn(r.node.address))));
        })))
      .when(compact, el => el.child(div().id("space-agent-expand").h(28).text_center().text_color(t.muted)
        .cursor_pointer().tooltip("Expand sidebar").hover(el => el.text_color(t.foreground))
        .on_click(() => { setShared("sidebar.collapsed", false); run("layout.resize", { id: "sidebar", px: shared("sidebar.width") ?? 268 }); })
        .child("»")));
  }
}
