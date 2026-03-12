import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const ok = request.cookies.get("stagshub_gate")?.value === "1";
  return NextResponse.json({ ok });
}

export async function POST(request: NextRequest) {
  const secret = process.env.STAGSHUB_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: "Missing STAGSHUB_SECRET_KEY." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  if (!body.key || typeof body.key !== "string") {
    return NextResponse.json({ error: "Secret key is required." }, { status: 400 });
  }

  if (body.key !== secret) {
    return NextResponse.json({ error: "Invalid secret key." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("stagshub_gate", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
