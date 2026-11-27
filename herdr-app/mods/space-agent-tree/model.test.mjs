import test from "node:test";
import assert from "node:assert/strict";
import { buildAgentTree, flattenAgents, visibleAgents, retainAgent, agentLabel, agentActions } from "./model.js";

const space = (id = "s1") => ({ id, name: id, tabs: [{ id: `${id}-tab` }] });
const terminal = (address, props = {}) => ({ address, state: "live", program: { key: "shell", name: "zsh", shell: true, agent: false }, ...props });
const agent = (address, props = {}) => ({ address, space: "s1", tab: "s1-tab", pane: `p-${address}`, status: "idle", program: { key: "pi", name: "Pi", agent: true }, ...props });
const tree = (agents, terminals, spaces = [space()]) => buildAgentTree({ spaces, agents, terminals });
const addresses = groups => groups.flatMap(g => flattenAgents(g.children).map(r => r.node.address));

test("spaces remain, ordinary terminals/panes/tabs never become rows", () => {
  const groups = tree([agent("a")], [terminal("a"), terminal("shell"), terminal("server", { parent: "a" })], [space(), space("empty")]);
  assert.deepEqual(addresses(groups), ["a"]);
  assert.equal(groups[1].count, 0);
  assert.equal(groups[1].children.length, 0);
});

test("child agents nest through excluded shells/helpers, in arbitrary input order", () => {
  const groups = tree([agent("a")], [terminal("c", { parent: "helper", status: "working" }), terminal("helper", { parent: "a" }), terminal("a")]);
  assert.deepEqual(flattenAgents(groups[0].children).map(r => [r.node.address, r.depth]), [["a", 0], ["c", 1]]);
});

test("grandchildren nest under their actual parent", () => {
  const groups = tree([agent("a")], [terminal("c", { parent: "b", status: "idle" }), terminal("b", { parent: "a", status: "working" }), terminal("a")]);
  assert.deepEqual(flattenAgents(groups[0].children).map(r => [r.node.address, r.depth]), [["a", 0], ["b", 1], ["c", 2]]);
});

test("a child with its own pane appears exactly once, even when pinned", () => {
  const groups = tree([agent("child", { pinned: true }), agent("parent")], [terminal("child", { parent: "parent" }), terminal("parent")]);
  assert.deepEqual(addresses(groups), ["parent", "child"]);
  assert.equal(groups[0].count, 2);
});

test("exited children are omitted even if stale agent data still lists them", () => {
  const groups = tree([agent("a"), agent("old")], [terminal("a"), terminal("old", { parent: "a", state: "finished", status: "done" })]);
  assert.deepEqual(addresses(groups), ["a"]);
});

test("children with another explicit space stay in that space", () => {
  const groups = tree([agent("a"), agent("b", { space: "s2" })], [terminal("a"), terminal("b", { parent: "a" })], [space(), space("s2")]);
  assert.deepEqual(groups.map(g => g.children.map(n => n.address)), [["a"], ["b"]]);
});

test("hidden agent ownership may come from a non-agent ancestor's labels", () => {
  const groups = tree([], [terminal("shell", { labels: { "herdr.space": "s1" } }), terminal("a", { parent: "shell", status: "working" })]);
  assert.deepEqual(addresses(groups), ["a"]);
});

test("unrelated hidden agents are omitted rather than assigned by cwd/name", () => {
  assert.deepEqual(addresses(tree([], [terminal("unrelated", { status: "idle", cwd: "/same" })])), []);
});

test("remote ownership qualifies local label IDs, including colliding space IDs", () => {
  const groups = tree([], [terminal("box/a", { status: "idle", labels: { "herdr.space": "s1" } })], [space(), { ...space("box/s1"), machine: "box" }]);
  assert.equal(groups[0].count, 0);
  assert.deepEqual(groups[1].children.map(n => n.address), ["box/a"]);
});

test("malformed parent cycles neither hide nor duplicate agents", () => {
  const groups = tree([agent("a"), agent("b")], [terminal("a", { parent: "b" }), terminal("b", { parent: "a" })]);
  assert.deepEqual([...addresses(groups)].sort(), ["a", "b"]);
});

test("folding hides descendants but retains the parent and underlying model", () => {
  const groups = tree([agent("a")], [terminal("a"), terminal("b", { parent: "a", status: "idle" })]);
  assert.deepEqual(flattenAgents(groups[0].children, new Set(["a"])).map(r => r.node.address), ["a"]);
  assert.equal(groups[0].count, 2);
  assert.deepEqual(addresses(groups), ["a", "b"]);
});

test("hidden child status normalizes errors/done without mutating source", () => {
  const child = terminal("b", { parent: "a", status: { state: "error" } });
  const groups = tree([agent("a")], [terminal("a"), child]);
  assert.equal(groups[0].children[0].children[0].status, "blocked");
  assert.equal(child.status.state, "error");
});

test("agent labels prefer explicit pane/terminal names, then live titles", () => {
  const node = tree([agent("a", { title: "π - useful task" })], [terminal("a")])[0].children[0];
  assert.equal(agentLabel(node), "useful task");
  node.agent.pane_name = "My agent";
  assert.equal(agentLabel(node), "My agent");
});

test("agent activation focuses existing panes; hidden children are only peeked", () => {
  const groups = tree([agent("a")], [terminal("a"), terminal("b", { parent: "a", status: "idle" })]);
  const parent = groups[0].children[0];
  assert.deepEqual(agentActions(parent), [["agent.focus", { terminal: "a" }]]);
  assert.deepEqual(agentActions(parent.children[0]), [["space.select", { id: "s1" }], ["terminal.peek", { terminal: "b" }]]);
});

test("a fresh snapshot reflects agents starting/stopping without retaining stale rows", () => {
  const input = [terminal("a"), terminal("b", { parent: "a", status: "idle" })];
  assert.deepEqual(addresses(tree([agent("a")], input)), ["a", "b"]);
  input[1].state = "finished";
  assert.deepEqual(addresses(tree([agent("a")], input)), ["a"]);
});

test("counts distinguish actively working from every non-working state, including children", () => {
  const groups = tree([agent("a", { status: "working" }), agent("idle"), agent("blocked", { status: "blocked" }), agent("done", { status: "done" })],
    [terminal("a"), terminal("idle"), terminal("blocked"), terminal("done"), terminal("child", { parent: "a", status: "working" })]);
  assert.equal(groups[0].workingCount, 2);
  assert.equal(groups[0].notWorkingCount, 3);
  assert.equal(groups[0].count, 5);
});

test("folded spaces keep working agents from every space visible, not just the active one", () => {
  const groups = tree([agent("a", { status: "working" }), agent("idle"), agent("b", { space: "s2", status: "working" })],
    [terminal("a"), terminal("idle"), terminal("b")], [space(), space("s2")]);
  assert.deepEqual(groups.map(g => visibleAgents(g.children, { workingOnly: true }).map(r => r.node.address)), [["a"], ["b"]]);
});

test("working descendants remain visible through folded/inactive ancestors with true indentation", () => {
  const groups = tree([agent("a")], [terminal("a"), terminal("b", { parent: "a", status: "idle" }), terminal("c", { parent: "b", status: "working" }), terminal("idle", { parent: "a", status: "idle" })]);
  const rows = visibleAgents(groups[0].children, { workingOnly: true, folded: new Set(["a", "b"]) });
  assert.deepEqual(rows.map(r => [r.node.address, r.depth]), [["a", 0], ["b", 1], ["c", 2]]);
  assert.equal(rows[0].contextOnly, true);
});

test("explicit Hide all wins even over working-agent reveal", () => {
  const groups = tree([agent("a", { status: "working" })], [terminal("a")]);
  assert.deepEqual(visibleAgents(groups[0].children, { hideAll: true }), []);
  assert.equal(groups[0].workingCount, 1);
});

test("retained agents survive task completion and process exit under the same parent", () => {
  const before = tree([agent("a")], [terminal("a"), terminal("b", { parent: "a", name: "demo", status: "working" })]);
  const retained = flattenAgents(before[0].children).map(r => retainAgent(r.node));
  const after = buildAgentTree({ spaces: [space()], agents: [agent("a")], terminals: [terminal("a"), terminal("b", { parent: "a", state: "finished" })], retained });
  assert.deepEqual(addresses(after), ["a", "b"]);
  const child = after[0].children[0].children[0];
  assert.equal(child.archived, true);
  assert.equal(child.status, "done");
  assert.equal(agentLabel(child), "demo");
  assert.equal(after[0].notWorkingCount, 2);
});

test("retained metadata survives restart and Core pruning without storing prompts/output", () => {
  const before = tree([agent("a")], [terminal("a", { argv: ["pi", "private prompt"], output: "private output" })]);
  const retained = JSON.parse(JSON.stringify(flattenAgents(before[0].children).map(r => retainAgent(r.node))));
  assert.equal(JSON.stringify(retained).includes("private"), false);
  const after = buildAgentTree({ spaces: [space()], retained });
  assert.deepEqual(addresses(after), ["a"]);
  assert.equal(after[0].children[0].archived, true);
});

test("dismissed completed agents stay hidden without removing Core terminals", () => {
  const before = tree([agent("a")], [terminal("a")]);
  const retained = flattenAgents(before[0].children).map(r => retainAgent(r.node));
  const after = buildAgentTree({ spaces: [space()], terminals: [terminal("a", { state: "finished" })], retained, dismissed: new Set(["a"]) });
  assert.deepEqual(addresses(after), []);
});

test("dismissed idle agents reappear if they start working again", () => {
  const after = buildAgentTree({ spaces: [space()], agents: [agent("a", { status: "working" })], terminals: [terminal("a")], dismissed: new Set(["a"]) });
  assert.deepEqual(addresses(after), ["a"]);
  assert.equal(after[0].workingCount, 1);
});

test("retained history cannot leak agents into a removed space", () => {
  const retained = [{ address: "a", space: "removed", parent: null, name: "old agent" }];
  assert.deepEqual(addresses(buildAgentTree({ spaces: [space()], retained })), []);
});
