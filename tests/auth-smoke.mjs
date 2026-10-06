import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const origin = process.argv[2] ?? "http://localhost:5173";
const bootstrapKey = process.env.AUTH_TEST_BOOTSTRAP_KEY;
if (!bootstrapKey) throw new Error("Set AUTH_TEST_BOOTSTRAP_KEY before running this local-only smoke test.");
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw new Error("This test may only run against a local Satya Scan preview.");

const admin = { email: "admin@satya.local", displayName: "Satya Administrator", password: "AdminPass2026!" };
const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const inspectorA = { email: `inspector-a-${suffix}@satya.local`, displayName: "Inspector A", password: "InspectorPass2026!" };
const inspectorB = { email: `inspector-b-${suffix}@satya.local`, displayName: "Inspector B", password: "InspectorPass2026!" };

function cookie(response) {
  const value = response.headers.get("set-cookie");
  assert.ok(value, "A successful login must create a session cookie");
  return value.split(";", 1)[0];
}

async function request(path, options = {}, session) {
  const headers = new Headers(options.headers);
  if (session) headers.set("cookie", session);
  return fetch(origin + path, { ...options, headers });
}

async function login(account, requestedRole) {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password, requestedRole }),
  });
  assert.equal(response.status, 200, await response.clone().text());
  return cookie(response);
}

const unauthenticatedHistory = await request("/api/inspections");
assert.equal(unauthenticatedHistory.status, 401, "Inspection history must not be public");

const bootstrap = await request("/api/auth/bootstrap", {
  method: "POST",
  headers: { origin, "content-type": "application/json", "x-satya-bootstrap-key": bootstrapKey },
  body: JSON.stringify(admin),
});
assert.ok([201, 409].includes(bootstrap.status), await bootstrap.clone().text());

const invalidLogin = await request("/api/auth/login", {
  method: "POST",
  headers: { origin, "content-type": "application/json" },
  body: JSON.stringify({ email: admin.email, password: "wrong-password", requestedRole: "ADMIN" }),
});
assert.equal(invalidLogin.status, 401, "Invalid passwords must be rejected");

const incorrectRole = await request("/api/auth/login", {
  method: "POST",
  headers: { origin, "content-type": "application/json" },
  body: JSON.stringify({ email: admin.email, password: admin.password, requestedRole: "INSPECTOR" }),
});
assert.equal(incorrectRole.status, 403, "The role selected in the UI must be verified on the server");

const adminSession = await login(admin, "ADMIN");
const session = await request("/api/auth/session", {}, adminSession);
assert.deepEqual((await session.json()).user.role, "ADMIN");
const adminDashboard = await request("/api/admin/dashboard", {}, adminSession);
assert.equal(adminDashboard.status, 200, "Administrators must be able to load authorized team data");
assert.equal(typeof (await adminDashboard.json()).metrics.total, "number");

const createdInspectors = [];
for (const inspector of [inspectorA, inspectorB]) {
  const created = await request("/api/users", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(inspector),
  }, adminSession);
  assert.equal(created.status, 201, await created.clone().text());
  const createdInspector = (await created.json()).user;
  assert.equal(createdInspector.role, "INSPECTOR");
  createdInspectors.push(createdInspector);
}

const inspectorASession = await login(inspectorA, "INSPECTOR");
const inspectorBSession = await login(inspectorB, "INSPECTOR");
const forbiddenUserManagement = await request("/api/users", {}, inspectorASession);
assert.equal(forbiddenUserManagement.status, 403, "Inspectors must not manage accounts");
const forbiddenAdminDashboard = await request("/api/admin/dashboard", {}, inspectorASession);
assert.equal(forbiddenAdminDashboard.status, 403, "Inspectors must not access administrator team data");

const sample = JSON.parse(readFileSync("public/samples/metadata.json", "utf8")).products[0];
const image = `data:image/png;base64,${readFileSync(`public/samples/${sample.image}`).toString("base64")}`;
const now = new Date().toISOString();
const record = {
  id: crypto.randomUUID(), product: "Role separation verification", inspector: "Spoofed client name", createdAt: now,
  mode: "demo", imageName: sample.image, imageWidth: sample.width, imageHeight: sample.height,
  ocr: { text: sample.text, lines: sample.lines },
  quality: { width: sample.width, height: sample.height, warnings: [], brightness: 230, contrast: 60, sharpness: 1000 },
  config: { version: "demo-prescreen-v1", minimumConfidence: "High", rules: ["manufacturer", "netQuantity", "mrp", "batch", "consumerCare", "visibility"].map(id => ({ id, active: true })) },
  reviews: {}, remarks: "Local role-separation verification.", acknowledged: true,
};
const saved = await request("/api/inspections", {
  method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ record, image }),
}, inspectorASession);
assert.equal(saved.status, 201, await saved.clone().text());
const savedRecord = await saved.json();
assert.equal(savedRecord.inspector, inspectorA.displayName, "The server must bind the inspector identity to the session");
assert.equal(savedRecord.audit.owner.userId, createdInspectors[0].id, "The server must bind record ownership to the signed-in Inspector");
assert.equal(savedRecord.audit.creator.displayName, inspectorA.displayName);
assert.equal(savedRecord.audit.reviewer.displayName, inspectorA.displayName);
assert.equal(savedRecord.audit.ruleSnapshot.version, "demo-prescreen-v1", "Finalized records retain the rules used for their result");
assert.deepEqual(savedRecord.audit.resultHistory.map(event => event.event), ["ANALYZED", "FINALIZED"]);
assert.ok(savedRecord.finalizedAt, "Finalized records require a server timestamp");

const ownRecord = await request(`/api/inspections/${record.id}`, {}, inspectorASession);
assert.equal(ownRecord.status, 200, "An inspector can access their own record");
const ownRecordBody = await ownRecord.json();
assert.deepEqual(ownRecordBody.audit, savedRecord.audit, "A finalized audit snapshot must not be recomputed or changed when read");
const otherRecord = await request(`/api/inspections/${record.id}`, {}, inspectorBSession);
assert.equal(otherRecord.status, 404, "An inspector cannot access another inspector's record");
const otherImage = await request(`/api/inspections/${record.id}/image`, {}, inspectorBSession);
assert.equal(otherImage.status, 404, "An inspector cannot access another inspector's evidence image");
const inspectorHistory = await request("/api/inspections", {}, inspectorBSession);
assert.ok(!(await inspectorHistory.json()).some(item => item.id === record.id), "Inspector history must be ownership-scoped");
const adminRecord = await request(`/api/inspections/${record.id}`, {}, adminSession);
assert.equal(adminRecord.status, 200, "Administrators can access inspectors' records");
const adminHistory = await request("/api/inspections", {}, adminSession);
const adminHistoryRecord = (await adminHistory.json()).find(item => item.id === record.id);
assert.equal(adminHistoryRecord.ownerUserId, createdInspectors[0].id, "Admin history provides the accountable record owner");
assert.equal(adminHistoryRecord.ownerName, inspectorA.displayName);
assert.equal(adminHistoryRecord.reviewerName, inspectorA.displayName);

const legacyId = `legacy-${suffix}`;
const legacyRecord = JSON.stringify({ id: legacyId, legacy: true, note: "Local migration verification only" });
const legacySql = `INSERT INTO inspections (id, product, created_at, status, mode, record) VALUES ('${legacyId}', 'Legacy local inspection', '${now}', 'PASS', 'demo', '${legacyRecord}')`;
execFileSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB", "--local", "--config", ".sites-runtime/migrations.json", "--persist-to", ".wrangler/state", "--command", legacySql], { stdio: "ignore" });
const legacyInspectorRecord = await request(`/api/inspections/${legacyId}`, {}, inspectorBSession);
assert.equal(legacyInspectorRecord.status, 404, "Unowned legacy records must not be visible to inspectors");
const legacyAdminRecord = await request(`/api/inspections/${legacyId}`, {}, adminSession);
assert.equal(legacyAdminRecord.status, 200, "Legacy records must remain visible to administrators");
const legacyBody = await legacyAdminRecord.json();
assert.equal(legacyBody.legacy, true);
assert.equal(legacyBody.audit.legacy, true, "Legacy records are enriched only when read, without rewriting their stored payload");
execFileSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB", "--local", "--config", ".sites-runtime/migrations.json", "--persist-to", ".wrangler/state", "--command", `DELETE FROM inspections WHERE id = '${legacyId}'`], { stdio: "ignore" });

const inspectorBId = createdInspectors[1].id;
const suspended = await request(`/api/users/${inspectorBId}`, { method: "PATCH", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ active: false }) }, adminSession);
assert.equal(suspended.status, 200, "Administrators must be able to suspend Inspector access");
const suspendedAccess = await request("/api/inspections", {}, inspectorBSession);
assert.equal(suspendedAccess.status, 401, "Suspending an Inspector must revoke active sessions");
const restored = await request(`/api/users/${inspectorBId}`, { method: "PATCH", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ active: true }) }, adminSession);
assert.equal(restored.status, 200, "Administrators must be able to restore Inspector access");
const restoredInspectorBSession = await login(inspectorB, "INSPECTOR");
assert.equal((await request("/api/inspections", {}, restoredInspectorBSession)).status, 200, "A restored Inspector can sign in again");

const logout = await request("/api/auth/logout", { method: "POST", headers: { origin } }, inspectorASession);
assert.equal(logout.status, 200);
const loggedOut = await request("/api/inspections", {}, inspectorASession);
assert.equal(loggedOut.status, 401, "Logging out must revoke the server-side session");

console.log("Authentication smoke checks passed: login, logout, role separation, protected Admin data, account provisioning and suspension, plus record isolation.");
