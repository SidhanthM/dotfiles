// Pure projection: spaces -> agents -> child agents. Tabs/panes never become rows.
const STATES = new Set(["idle", "working", "done", "blocked", "error"]);
export const agentStatus = t => typeof t?.status === "string" ? t.status : t?.status?.state;
const isAgent = t => t.program?.agent === true || STATES.has(agentStatus(t));
const cleanTitle = value => (value ?? "").replace(/^(?:π\s*-\s*|\[ [!.] \] |[✦✋⏳⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s*[-·:]?\s*)+/u, "").trim();

export function agentLabel(node) {
  const t = node.terminal;
  const a = node.agent;
  const title = cleanTitle(a?.title || t.title);
  const useful = title && title !== node.address && !/^[~/]|^[A-Za-z]:\\/.test(title) && !title.includes("@");
  return a?.pane_name || t.pane_name || t.name || (useful ? title : null) || t.template || node.program?.name || a?.app || node.address;
}

// Keep only display metadata, never prompts, terminal output, or conversation files.
export function retainAgent(node) {
  const t = node.terminal;
  return { address: node.address, space: node.space, parent: t.parent ?? null,
    name: t.name ?? null, title: node.agent?.title || t.title || "",
    pane_name: node.agent?.pane_name ?? t.pane_name ?? null,
    created_ms: t.created_ms ?? null, program: node.program ?? null };
}

export function buildAgentTree({ spaces = [], agents = [], terminals = [], retained = [], dismissed = new Set() }) {
  const groups = spaces.map(space => ({ space, children: [], count: 0, workingCount: 0, notWorkingCount: 0 }));
  const groupById = new Map(groups.map(g => [g.space.id, g]));
  const all = new Map(terminals.map(t => [t.address, t]));
  const listed = new Map(agents.map(a => [a.address, a]));
  const history = new Map(retained.map(record => [record.address, record]));
  const candidates = new Map();
  for (const a of agents) {
    const t = all.get(a.address);
    if (!t || t.state === "live") candidates.set(a.address, t ?? { address: a.address, state: "live" });
  }
  for (const t of terminals) {
    if (t.state === "live" && isAgent(t) && !candidates.has(t.address)) candidates.set(t.address, t);
  }
  for (const record of retained) {
    if (candidates.has(record.address) || dismissed.has(record.address)) continue;
    const current = all.get(record.address);
    const terminal = { ...record, ...current, address: record.address,
      parent: current?.parent ?? record.parent, program: record.program,
      state: current?.state ?? "finished", retained: true };
    all.set(record.address, terminal);
    candidates.set(record.address, terminal);
  }
  for (const [address, terminal] of candidates) {
    const status = listed.get(address)?.status ?? agentStatus(terminal);
    if (dismissed.has(address) && status !== "working") candidates.delete(address);
  }

  function explicitSpace(address) {
    const a = listed.get(address);
    if (a && groupById.has(a.space)) return a.space;
    const remembered = history.get(address)?.space;
    const label = all.get(address)?.labels?.["herdr.space"];
    if (!label) return groupById.has(remembered) ? remembered : null;
    const slash = address.lastIndexOf("/");
    const qualified = slash < 0 ? label : `${address.slice(0, slash)}/${label}`;
    // Raw remote labels are machine-local; never accidentally match a local space.
    return groupById.has(qualified) ? qualified : null;
  }

  function spaceOf(address) {
    const seen = new Set();
    while (address && !seen.has(address)) {
      seen.add(address);
      const space = explicitSpace(address);
      if (space) return space;
      address = all.get(address)?.parent;
    }
    return null;
  }

  const nodes = new Map();
  for (const [address, terminal] of candidates) {
    const space = spaceOf(address);
    if (!space) continue; // Unrelated terminals never leak into the sidebar.
    const archived = terminal.state !== "live";
    const agent = archived ? null : listed.get(address);
    let status = archived ? "done" : agent?.status ?? agentStatus(terminal);
    if (status === "error") status = "blocked";
    if (!agent && !archived && status === "done") status = "idle";
    nodes.set(address, { address, space, terminal, agent, archived, status: status ?? "unknown",
      program: agent?.program ?? terminal.program, children: [] });
  }

  const parents = new Map();
  for (const node of nodes.values()) {
    const seen = new Set([node.address]);
    let address = node.terminal.parent;
    let parent = null;
    // Skip shells/helpers rather than drawing them, but preserve agent ancestry.
    while (address && !seen.has(address)) {
      seen.add(address);
      const explicit = explicitSpace(address);
      if (explicit && explicit !== node.space) break;
      const ancestor = nodes.get(address);
      if (ancestor) {
        if (ancestor.space === node.space) parent = address;
        break;
      }
      address = all.get(address)?.parent;
    }
    parents.set(node.address, parent);
  }
  // Malformed/cyclic Core parent data must not hide agents or recurse forever.
  for (const address of nodes.keys()) {
    const seen = new Set([address]);
    let parent = parents.get(address);
    while (parent) {
      if (seen.has(parent)) { parents.set(address, null); break; }
      seen.add(parent);
      parent = parents.get(parent);
    }
  }
  for (const node of nodes.values()) {
    const group = groupById.get(node.space);
    group.count++;
    if (node.status === "working") group.workingCount++;
    else group.notWorkingCount++;
    const parent = nodes.get(parents.get(node.address));
    (parent ? parent.children : group.children).push(node);
  }
  return groups;
}

export function flattenAgents(nodes, folded = new Set(), depth = 0) {
  return nodes.flatMap(node => [{ node, depth },
    ...(folded.has(node.address) ? [] : flattenAgents(node.children, folded, depth + 1))]);
}

// A fold hides inactive rows, never active work. Keep ancestors of working children
// as context, so a busy grandchild stays under its actual parent. Explicit Hide all
// wins over this automatic reveal. Counts always come from the full model.
export function visibleAgents(nodes, { folded = new Set(), workingOnly = false, hideAll = false } = {}, depth = 0) {
  if (hideAll) return [];
  return nodes.flatMap(node => {
    const children = visibleAgents(node.children,
      { folded, workingOnly: workingOnly || folded.has(node.address) }, depth + 1);
    if (workingOnly && node.status !== "working" && !children.length) return [];
    return [{ node, depth, contextOnly: workingOnly && node.status !== "working" }, ...children];
  });
}

// Navigation uses the same targets as pointer activation. A hidden child is peeked,
// never adopted into the document or given a new pane merely to show it.
export function agentActions(node) {
  if (node.agent?.pane) return [["agent.focus", { terminal: node.address }]];
  return [["space.select", { id: node.space }], ["terminal.peek", { terminal: node.address }]];
}
