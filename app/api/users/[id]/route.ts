import { z } from "zod";
import { currentUser, sameOrigin } from "@/lib/auth";
import { storage } from "@/lib/database";

const updateSchema = z.object({ active: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Please manage accounts from the Satya Scan workspace." }, { status: 403 });
  try {
    const admin = await currentUser(request);
    if (admin?.role !== "ADMIN") return Response.json({ error: "Administrator access is required." }, { status: 403 });
    const input = updateSchema.parse(await request.json());
    const { id } = await params;
    const { DB } = storage();
    const target = await DB.prepare("SELECT id, email, display_name AS displayName, role, active, created_at AS createdAt FROM users WHERE id = ?").bind(id).first<{ id: string; email: string; displayName: string; role: string; active: number; createdAt: string }>();
    if (!target || target.role !== "INSPECTOR") return Response.json({ error: "Inspector account not found." }, { status: 404 });
    await DB.batch([
      DB.prepare("UPDATE users SET active = ? WHERE id = ?").bind(input.active ? 1 : 0, id),
      ...(input.active ? [] : [DB.prepare("DELETE FROM user_sessions WHERE user_id = ?").bind(id)]),
    ]);
    return Response.json({ user: { ...target, active: input.active ? 1 : 0 } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Choose whether this Inspector account is active." }, { status: 400 });
    console.error("Inspector update unavailable", error);
    return Response.json({ error: "Unable to update this Inspector account." }, { status: 503 });
  }
}
