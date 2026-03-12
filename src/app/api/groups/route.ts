import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { ObjectId } from "mongodb";

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = await getDb();
  // Find groups where the current user is a member
  const groups = await db
    .collection("groups")
    .find({ memberIds: new ObjectId(sessionUser.id) })
    .toArray();

  return NextResponse.json(
    groups.map((group) => ({
      id: group._id.toString(),
      name: group.name,
      description: group.description ?? "",
      adminId: group.adminId.toString(),
      adminIds: [
        group.adminId.toString(),
        ...(group.adminIds ?? []).map((id: ObjectId) => id.toString()),
      ],
      memberIds: group.memberIds.map((id: ObjectId) => id.toString()),
      createdAt: group.createdAt,
    }))
  );
}

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2) {
    return NextResponse.json({ error: "Group name is too short." }, { status: 400 });
  }

  const db = await getDb();
  const userId = new ObjectId(sessionUser.id);

  const group = {
    name,
    adminId: userId,
    memberIds: [userId],
    createdAt: new Date(),
  };
  const result = await db.collection("groups").insertOne(group);

  return NextResponse.json({
    id: result.insertedId.toString(),
    ...group,
    adminId: group.adminId.toString(),
    memberIds: group.memberIds.map((id: ObjectId) => id.toString()),
  });
}
