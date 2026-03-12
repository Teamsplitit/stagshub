import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.json(sessionUser);
}

export async function PUT(request: NextRequest) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const displayName = body.displayName !== undefined ? String(body.displayName).trim() : null;
  const password = body.password !== undefined ? String(body.password) : null;

  if (displayName !== null && displayName.length < 2) {
    return NextResponse.json(
      { error: "Display name must be at least 2 characters." },
      { status: 400 }
    );
  }

  const updates: any = {};
  if (displayName !== null) updates.displayName = displayName;

  if (password !== null) {
    if (password.length < 4) {
      return NextResponse.json(
        { error: "Password must be at least 4 characters." },
        { status: 400 }
      );
    }
    const bcrypt = await import("bcryptjs");
    updates.passwordHash = await bcrypt.hash(password, 10);
  }

  const db = await getDb();
  if (Object.keys(updates).length > 0) {
    await db
      .collection("users")
      .updateOne({ _id: new ObjectId(sessionUser.id) }, { $set: updates });
  }

  return NextResponse.json({
    id: sessionUser.id,
    name: sessionUser.name,
    displayName: displayName !== null ? displayName : sessionUser.displayName,
    isAdmin: sessionUser.isAdmin,
  });
}
