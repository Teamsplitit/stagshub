import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { hasGate } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!hasGate(request)) {
    return NextResponse.json({ error: "Secret key required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const rawName = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (rawName.length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters." }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ error: "Password must be at least 4 characters." }, { status: 400 });
  }

  const nameKey = rawName.toLowerCase();
  const db = await getDb();
  const userCount = await db.collection("users").countDocuments();
  const existing = await db.collection("users").findOne({ name: nameKey });
  if (existing) {
    return NextResponse.json({ error: "User already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    name: nameKey,
    displayName: rawName,
    passwordHash,
    friends: [],
    isAdmin: userCount === 0,
    createdAt: new Date(),
  };

  const result = await db.collection("users").insertOne(user);
  return NextResponse.json({
    id: result.insertedId.toString(),
    name: user.name,
    displayName: user.displayName,
  });
}
