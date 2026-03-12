import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { hasGate } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!hasGate(request)) {
    return NextResponse.json({ error: "Secret key required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const rawName = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const nameKey = rawName.toLowerCase();
  const db = await getDb();
  const user = await db.collection("users").findOne({ name: nameKey });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  const token = randomUUID();
  await db.collection("sessions").insertOne({
    token,
    userId: user._id,
    createdAt: new Date(),
  });

  const response = NextResponse.json({
    id: user._id.toString(),
    name: user.name,
    displayName: user.displayName,
    isAdmin: Boolean(user.isAdmin),
  });
  response.cookies.set("stagshub_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
