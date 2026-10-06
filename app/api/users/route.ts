import { z } from "zod";
import { createUser, currentUser, sameOrigin, validPassword } from "@/lib/auth";
import { storage } from "@/lib/database";

const inspectorSchema = z.object({
  email: z.string().trim().email().max(254),
  displayName: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(128),
});

async function admin(request: Request) {
  const user = await currentUser(request);
  return user?.role === "ADMIN" ? user : null;
}

export async function GET(request: Request) {
  try {
    if (!(await admin(request))) return Response.json({ error: "Administrator access is required." }, { status: 403 });
    const { results } = await storage().DB.prepare("SELECT id, email, display_name AS displayName, role, active, created_at AS createdAt FROM users ORDER BY created_at ASC").all();
    return Response.json(results, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("User list unavailable", error);
    return Response.json({ error: "User management is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Please create users from the Satya Scan workspace." }, { status: 403 });
  try {
    if (!(await admin(request))) return Response.json({ error: "Administrator access is required." }, { status: 403 });
    const input = inspectorSchema.parse(await request.json());
    if (!validPassword(input.password)) return Response.json({ error: "Use at least 12 characters including a letter and a number." }, { status: 400 });
    const user = await createUser({ ...input, role: "INSPECTOR" });
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Enter a valid inspector name, email address and secure password." }, { status: 400 });
    console.error("Inspector creation unavailable", error);
    return Response.json({ error: "Unable to create this inspector. The email address may already be in use." }, { status: 409 });
  }
}
