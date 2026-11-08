/* Summarize recorded GUI evidence. This command never drives a browser or marks a case passed. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultPlan = fileURLToPath(new URL("./user-web-acceptance.json", import.meta.url));
const planFile = process.argv[2] ? path.resolve(process.argv[2]) : defaultPlan;
const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
assert.equal(plan.schema_version, 1, "Unsupported acceptance plan version");
assert.ok(Array.isArray(plan.cases) && plan.cases.length, "An acceptance plan must have cases");
const statuses = new Set(["passed", "failed", "blocked", "not_run"]);
const ids = new Set();
const groups = {};
const summary = { required: 0, passed: 0, failed: 0, blocked: 0, not_run: 0 };
for (const item of plan.cases) {
  assert.ok(item.id && !ids.has(item.id), "Case IDs must be unique");
  ids.add(item.id);
  assert.ok(statuses.has(item.status), "Invalid case status: " + item.id);
  assert.ok(item.expected?.trim(), "Missing acceptance criterion: " + item.id);
  if (item.status === "passed" || item.status === "failed") {
    assert.ok(plan.execution_run_id && item.execution_run_id === plan.execution_run_id, "Observation must belong to the final GUI run: " + item.id);
    assert.ok(item.observed_at && Number.isFinite(Date.parse(item.observed_at)), "Missing observation timestamp: " + item.id);
    assert.ok(["browser_observation", "user_handoff"].includes(item.evidence?.kind), "GUI evidence required: " + item.id);
    assert.ok(item.evidence?.description?.trim(), "Observation description required: " + item.id);
  }
  if (!item.required) continue;
  summary.required++;
  summary[item.status]++;
  groups[item.group] ??= { required: 0, passed: 0, failed: 0, blocked: 0, not_run: 0 };
  groups[item.group].required++;
  groups[item.group][item.status]++;
}
assert.ok(summary.required, "There must be required GUI cases");
const executed = summary.passed + summary.failed;
const percentage = (part, total) => total ? Number((100 * part / total).toFixed(2)) : null;
const report = {
  ...summary,
  completion_percent: percentage(executed, summary.required),
  passed_of_required_percent: percentage(summary.passed, summary.required),
  pass_rate_of_executed_percent: percentage(summary.passed, executed),
  open_blockers: (plan.blockers || []).filter(item => item.status === "open"),
  gui_ready_to_close: summary.passed === summary.required && !(plan.blockers || []).some(item => item.status === "open"),
  technical_gates: "Reported separately; passing this GUI gate alone does not certify build/API/performance.",
  groups,
};
console.log(JSON.stringify(report, null, 2));
if (!report.gui_ready_to_close) process.exitCode = 2;
