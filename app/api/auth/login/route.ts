import { z } from "zod";
import { createSession, findUserByEmail, sameOrigin, sessionCookie, verifyPassword } from "@/lib/auth";
import type { UserRole } from "@/lib/auth-types";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
  requestedRole: z.enum(["ADMIN", "INSPECTOR"]),
});

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Please sign in from the Satya Scan workspace." }, { status: 403 });
  let input: z.infer<typeof loginSchema>;
  try {
    input = loginSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Enter a valid email address and password." }, { status: 400 });
  }

  try {
    const user = await findUserByEmail(input.email);
    if (!user || !user.active || !(await verifyPassword(input.password, user.passwordHash))) {
      return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    if (user.role !== (input.requestedRole as UserRole)) {
      return Response.json({ error: "This account is not authorized for the selected access type." }, { status: 403 });
    }
    const session = await createSession(user);
    return Response.json({ user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } }, {
      headers: { "Cache-Control": "no-store", "Set-Cookie": sessionCookie(request, session) },
    });
  } catch (error) {
    console.error("Sign-in unavailable", error);
    return Response.json({ error: "Sign-in is temporarily unavailable. Please retry." }, { status: 503 });
  }
}
