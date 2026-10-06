import { currentUser } from "@/lib/auth";
import { storage } from "@/lib/database";

type MetricRow = { total: number; passed: number; checking: number; missing: number };
type ActiveRow = { active: number };

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    if (user?.role !== "ADMIN") return Response.json({ error: "Administrator access is required." }, { status: 403 });
    const { DB } = storage();
    const [metricsRow, activeRow, reviewRows, activityRows, inspectorRows] = await Promise.all([
      DB.prepare(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN status = 'PASS' THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN status = 'CHECK' THEN 1 ELSE 0 END) AS checking,
        SUM(CASE WHEN status = 'NOT DETECTED' THEN 1 ELSE 0 END) AS missing
        FROM inspections`).first<MetricRow>(),
      DB.prepare("SELECT COUNT(*) AS active FROM users WHERE role = 'INSPECTOR' AND active = 1").first<ActiveRow>(),
      DB.prepare(`SELECT inspections.id, inspections.product, inspections.status, inspections.mode, inspections.created_at AS createdAt,
        inspections.owner_user_id AS inspectorId, COALESCE(users.display_name, 'Legacy record') AS inspectorName
        FROM inspections LEFT JOIN users ON users.id = inspections.owner_user_id
        WHERE inspections.status IN ('CHECK', 'NOT DETECTED')
        ORDER BY inspections.created_at DESC LIMIT 100`).all(),
      DB.prepare(`SELECT inspections.id, inspections.product, inspections.status, inspections.mode, inspections.created_at AS createdAt,
        inspections.owner_user_id AS inspectorId, COALESCE(users.display_name, 'Legacy record') AS inspectorName
        FROM inspections LEFT JOIN users ON users.id = inspections.owner_user_id
        ORDER BY inspections.created_at DESC LIMIT 12`).all(),
      DB.prepare(`SELECT users.id, users.display_name AS displayName, users.email, users.active,
        COUNT(inspections.id) AS total,
        SUM(CASE WHEN inspections.status = 'PASS' THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN inspections.status = 'CHECK' THEN 1 ELSE 0 END) AS checking,
        SUM(CASE WHEN inspections.status = 'NOT DETECTED' THEN 1 ELSE 0 END) AS missing,
        MAX(inspections.created_at) AS lastInspectionAt
        FROM users LEFT JOIN inspections ON inspections.owner_user_id = users.id
        WHERE users.role = 'INSPECTOR'
        GROUP BY users.id
        ORDER BY users.active DESC, lastInspectionAt DESC, users.display_name ASC`).all(),
    ]);
    const metrics = metricsRow ?? { total: 0, passed: 0, checking: 0, missing: 0 };
    return Response.json({
      metrics: { total: Number(metrics.total ?? 0), passed: Number(metrics.passed ?? 0), checking: Number(metrics.checking ?? 0), missing: Number(metrics.missing ?? 0), activeInspectors: Number(activeRow?.active ?? 0) },
      reviewQueue: reviewRows.results,
      recentActivity: activityRows.results,
      inspectors: inspectorRows.results,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin dashboard unavailable", error);
    return Response.json({ error: "The administration dashboard is temporarily unavailable." }, { status: 503 });
  }
}
