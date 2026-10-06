import { z } from "zod";
import { bootstrapKey, createUser, sameOrigin, userCount, validPassword } from "@/lib/auth";

const bootstrapSchema = z.object({
  email: z.string().trim().email().max(254),
  displayName: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(128),
});

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Please bootstrap from the Satya Scan workspace." }, { status: 403 });
  try {
    if (await userCount()) return Response.json({ error: "An administrator account already exists." }, { status: 409 });
    const key = bootstrapKey();
    if (!key || request.headers.get("x-satya-bootstrap-key") !== key) {
      return Response.json({ error: "Administrator bootstrap is not authorized." }, { status: 403 });
    }
    const input = bootstrapSchema.parse(await request.json());
    if (!validPassword(input.password)) {
      return Response.json({ error: "Use at least 12 characters including a letter and a number." }, { status: 400 });
    }
    const user = await createUser({ ...input, role: "ADMIN" });
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Enter a valid name, email address and secure password." }, { status: 400 });
    console.error("Bootstrap unavailable", error);
    return Response.json({ error: "Administrator bootstrap is temporarily unavailable." }, { status: 503 });
  }
}
