import { disclaimer, type AuditActor, type Inspection } from "./inspection";

export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
}

function actorLabel(actor: AuditActor | null | undefined) {
  return actor ? `${actor.displayName} (${actor.role})` : "Not recorded";
}

export function reportHtml(record: Inspection, image: string) {
  const e = escapeHtml;
  const audit = record.audit;
  const history = audit?.resultHistory ?? [{ event: "LEGACY_IMPORT" as const, at: record.finalizedAt ?? record.createdAt, status: record.status, actor: null }];
  const snapshot = audit?.ruleSnapshot ?? record.config;
  const historyRows = history.map(event => `<tr><td>${e(event.event)}</td><td>${e(event.status)}</td><td>${e(event.at)}</td><td>${e(actorLabel(event.actor))}</td></tr>`).join("");
  const snapshotText = snapshot ? `Configurable / demo rules · ${e(snapshot.version)} · Minimum extraction confidence: ${e(snapshot.minimumConfidence)}<br>${snapshot.rules.map(rule => `${e(rule.name)}: ${rule.active ? "active" : "excluded"}`).join(" · ")}` : "Rule snapshot was not recorded for this legacy report.";
  const checkRows = record.checks.map(check => `<tr><td><b>${e(check.name)}</b><br>${e(check.status)}</td><td>${e(check.value || "Not detected")}<br>${e(check.confidence)} extraction confidence</td><td>${e(check.reason)}<br><small>Original: ${e(check.evidence || "No supporting text region")}${check.line >= 0 ? ` · Line ${check.line + 1}` : ""}</small></td><td>${check.review ? `${e(check.review.decision)}<br>${e(check.review.remark)}<br>${e(check.review.at)}` : "No field correction; covered by final acknowledgement"}</td></tr>`).join("");
  const fieldRows = record.fields.map(field => `<tr><td>${e(field.name)}</td><td>${e(field.value || "Not detected")}</td><td>${e(field.confidence)} · ${e(field.evidence || "No supporting text")}</td></tr>`).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Satya Scan report - ${e(record.product)}</title><style>body{font:15px/1.5 Arial,sans-serif;color:#14273d;max-width:960px;margin:32px auto;padding:0 24px}h1{color:#165aef}h2{margin-top:30px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #cdd7e4;padding:10px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eef3fa}img{max-height:520px;max-width:100%}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f6fa;padding:18px}small{color:#52647a}.note{border-left:4px solid #165aef;padding:12px;background:#f3f6fa}.legacy{border-left-color:#a46d16;background:#fff8e9}@media print{body{margin:0;font-size:12px}button{display:none}thead{display:table-header-group}img{max-height:430px}@page{margin:16mm}}</style></head><body><button onclick="window.print()">Print / Save as PDF</button><h1>SATYA SCAN</h1><p>AI-Assisted Legal Metrology Compliance Platform<br>The Sixth Sense · SIH26034</p><h2>Inspection report · ${e(record.status)}</h2><p><b>${e(record.product)}</b><br>Inspection: ${e(record.id)}<br>Created: ${e(record.createdAt)}<br>Finalized: ${e(record.finalizedAt ?? "Draft — not finalized")}<br>Source: ${record.mode === "demo" ? "Prepared DEMO data (not live OCR)" : "Tesseract OCR of uploaded image"}<br>Image reference: ${e(record.imageName)}</p><div class="note${audit?.legacy ? " legacy" : ""}">${audit?.legacy ? "Legacy record: some original accountability data was not recorded. " : ""}${e(disclaimer)}</div><h2>Accountability and timestamps</h2><table><tbody><tr><th>Owner</th><td>${e(actorLabel(audit?.owner))}</td><th>Creator</th><td>${e(actorLabel(audit?.creator))}</td></tr><tr><th>Reviewer</th><td>${e(actorLabel(audit?.reviewer))}</td><th>Finalized</th><td>${e(audit?.finalizedAt ?? record.finalizedAt ?? "Not recorded")}</td></tr></tbody></table><h2>Result history</h2><table><thead><tr><th>Event</th><th>Result</th><th>Timestamp</th><th>Actor</th></tr></thead><tbody>${historyRows}</tbody></table><h2>Immutable rule snapshot</h2><p>${snapshotText}</p><h2>Analyzed image</h2><img src="${e(image)}" alt="Original analyzed label"><h2>Image quality</h2><p>${e(record.quality.warnings.join(" ") || "No basic quality warnings.")} Manual visual review is still required for glare, obstruction, curved surfaces and hidden declarations.</p><h2>Configured checks and human review</h2><table><thead><tr><th>Check / result</th><th>Value / confidence</th><th>Reason / original evidence</th><th>Human review</th></tr></thead><tbody>${checkRows}</tbody></table><h2>Original structured extraction</h2><table><thead><tr><th>Field</th><th>Original value</th><th>Confidence / evidence</th></tr></thead><tbody>${fieldRows}</tbody></table><h2>Reviewer remarks</h2><p>${e(record.remarks || "No additional remarks.")}</p><p>Final acknowledgement: ${record.acknowledged ? "Confirmed by inspector" : "Pending"}</p><h2>Original OCR text</h2><pre>${e(record.ocr.text)}</pre><p class="note">${e(disclaimer)}</p></body></html>`;
}

export async function downloadReport(record: Inspection) {
  let image = record.image;
  if (!image.startsWith("data:")) {
    const response = await fetch(image);
    if (!response.ok) throw new Error("The report image could not be loaded. Please retry.");
    const blob = await response.blob();
    image = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
  }
  const blob = new Blob([reportHtml(record, image)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = `Satya-Scan-${record.id.slice(0, 8)}.html`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
