import { clearedSessionCookie, deleteCurrentSession, sameOrigin } from "@/lib/auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Please sign out from the Satya Scan workspace." }, { status: 403 });
  try {
    await deleteCurrentSession(request);
  } catch (error) {
    console.error("Sign-out cleanup unavailable", error);
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": clearedSessionCookie(request) } });
}
