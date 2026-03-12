import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = await getDb();
  const users = await db
    .collection("users")
    .find({}, { projection: { displayName: 1, name: 1 } })
    .toArray();

  return NextResponse.json(
    users.map((user) => ({
      id: user._id.toString(),
      displayName: user.displayName,
      name: user.name,
    }))
  );
}
