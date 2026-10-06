import { currentUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    return Response.json({ user: await currentUser(request) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Authentication is temporarily unavailable." }, { status: 503 });
  }
}
