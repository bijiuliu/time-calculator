"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

require("../js/logic.js");
require("../js/storage.js");
require("../js/history.js");

const logic = globalThis.TimeCalculatorLogic;
const {DEFAULT_SETTINGS, createStorage} = globalThis.TimeCalculatorStorage;
const {createHistory} = globalThis.TimeCalculatorHistory;

function state() {
  return {
    calculator: "time", mode: "diff", direction: "back", filter: "all",
    history: [], settings: {...DEFAULT_SETTINGS}
  };
}

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    data
  };
}

test("time and date calculations keep boundary behavior", () => {
  assert.equal(logic.minutesToTime(23 * 60 + 90), "00:30");
  assert.equal(logic.minutesToTime(-1), "23:59");
  assert.equal(logic.formatDuration(165), "2小时45分");
  assert.equal(logic.formatDuration(0), "0分");
  assert.equal(logic.formatShiftDuration({inputHours: "1", inputMinutes: "30", amountMinutes: 90}), "1小时30分钟");
  assert.equal(logic.dateDiffDays(new Date(2024, 1, 28), new Date(2024, 2, 1)), 2);
  assert.equal(logic.dateToIso(logic.addDays(new Date(2024, 1, 28), 2)), "2024-03-01");
  assert.equal(logic.dateToIso(logic.addDays(new Date(2025, 0, 1), -1)), "2024-12-31");
});

test("saved settings and history still load and trim", () => {
  const savedHistory = Array.from({length: 12}, (_, id) => ({id}));
  const memory = memoryStorage({
    timeCalculatorV2State: JSON.stringify({
      history: savedHistory,
      settings: {...DEFAULT_SETTINGS, historyLimit: 10, defaultCalculator: "date"},
      lastCalculator: "time", lastMode: "shift", lastDirection: "forward"
    })
  });
  const current = state();
  createStorage(current, String, () => memory).loadState();
  assert.equal(current.calculator, "date");
  assert.equal(current.mode, "diff");
  assert.equal(current.direction, "forward");
  assert.equal(current.history.length, 10);
  assert.equal(JSON.parse(memory.data.get("timeCalculatorV2State")).history.length, 10);
});

test("old records and settings still migrate", () => {
  const memory = memoryStorage({
    calculatorSettingsV1: JSON.stringify({appearance: "crystal", inputMode: "native", historyLimit: 20}),
    timeCalculatorHistoryV3: JSON.stringify([{type: "diff", timestamp: 100, start: "22:30", end: "01:15", totalMinutes: 165, crossedDay: true}]),
    dateCalculatorHistoryV1: JSON.stringify([{type: "dateDiff", timestamp: 200, start: "2024年02月28日", end: "2024年03月01日", days: 2}])
  });
  const current = state();
  createStorage(current, value => String(value).padStart(2, "0"), () => memory).loadState();
  assert.equal(current.settings.appearance, "dark");
  assert.equal(current.settings.inputMode, "native");
  assert.deepEqual(current.history.map(item => item.id), [200, 100]);
  assert.equal(current.history[0].start, "2024-02-28");
  assert.equal(current.history[1].totalMinutes, 165);
});

test("history module renders and stores records", () => {
  const current = state();
  const container = {innerHTML: "", offsetHeight: 0};
  const messages = [];
  let saved = 0;
  const history = createHistory({
    state: current,
    $: () => container,
    $$: () => [],
    pad: value => String(value).padStart(2, "0"),
    escapeHtml: value => String(value),
    toast: message => messages.push(message),
    saveState: () => saved++,
    copyText: () => {}, resultCopyText: () => "",
    formatDuration: logic.formatDuration,
    formatShiftDuration: logic.formatShiftDuration,
    setPage: () => {}, renderCalculator: () => {},
    setTimeInput: () => {}, setDateInput: () => {}
  });
  history.renderHistory();
  assert.match(container.innerHTML, /暂无符合条件的记录/);
  history.addHistory({id: Date.now(), kind: "time", mode: "diff", start: "22:30", end: "01:15", totalMinutes: 165, crossedDay: true});
  history.renderHistory();
  assert.match(container.innerHTML, /22:30 → 01:15/);
  assert.equal(saved, 1);
  assert.deepEqual(messages, []);
});

test("page and offline cache load all modules in order", () => {
  const root = path.join(__dirname, "..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const worker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const scripts = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(scripts, ["js/logic.js", "js/storage.js", "js/history.js", "js/calculator.js", "js/app.js"]);
  for (const script of scripts) {
    assert.ok(fs.existsSync(path.join(root, script)), `${script} exists`);
    assert.ok(worker.includes(`"./${script}"`), `${script} is cached offline`);
  }
});

test("browser entry initializes from the five scripts", () => {
  const nodes = new Map();
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {
      classList: {add() {}, remove() {}, toggle() {}, contains() {return false;}},
      style: {}, innerHTML: "", textContent: "", hidden: false,
      listeners: {}, addEventListener(type, callback) {this.listeners[type] = callback;},
      setAttribute() {}, scrollTo() {},
      offsetHeight: 0
    });
    return nodes.get(selector);
  }
  const document = {
    body: node("body"), documentElement: node("html"),
    querySelector: node, querySelectorAll: () => [], getElementById: id => node(`#${id}`),
    addEventListener() {}
  };
  const localStorage = memoryStorage();
  const context = vm.createContext({
    document,
    window: {matchMedia: () => ({matches: false, addEventListener() {}})},
    navigator: {}, location: {protocol: "file:"},
    localStorage,
    requestAnimationFrame: callback => callback(),
    setTimeout, clearTimeout
  });
  for (const script of ["logic.js", "storage.js", "history.js", "calculator.js", "app.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", script), "utf8"), context, {filename: script});
  }
  assert.match(node("#formCard").innerHTML, /id="startHour"/);
  assert.match(node("#historyContainer").innerHTML, /暂无符合条件的记录/);
  node("#startHour").value = "22";
  node("#startMinute").value = "30";
  node("#endHour").value = "01";
  node("#endMinute").value = "15";
  node("#calculateButton").listeners.click();
  assert.match(node("#resultDescription").innerHTML, /165 分钟/);
  const saved = JSON.parse(localStorage.getItem("timeCalculatorV2State"));
  assert.equal(saved.history[0].totalMinutes, 165);
  assert.equal(saved.history[0].crossedDay, true);
});
