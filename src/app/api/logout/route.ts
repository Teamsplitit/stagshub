import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("stagshub_session")?.value;
  if (token) {
    const db = await getDb();
    await db.collection("sessions").deleteOne({ token });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("stagshub_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return response;
}
