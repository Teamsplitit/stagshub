import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = await getDb();
  const user = await db
    .collection("users")
    .findOne({ _id: new ObjectId(sessionUser.id) }, { projection: { friends: 1 } });

  const friends = user?.friends ?? [];
  if (!friends.length) {
    return NextResponse.json([]);
  }

  const friendDocs = await db
    .collection("users")
    .find({ _id: { $in: friends } }, { projection: { name: 1, displayName: 1 } })
    .toArray();

  return NextResponse.json(
    friendDocs.map((friend) => ({
      id: friend._id.toString(),
      name: friend.name,
      displayName: friend.displayName,
    }))
  );
}

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const friendId = typeof body.userId === "string" ? body.userId : "";
  if (!ObjectId.isValid(friendId)) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }
  if (friendId === sessionUser.id) {
    return NextResponse.json({ error: "Cannot add yourself." }, { status: 400 });
  }

  const db = await getDb();
  const userObjectId = new ObjectId(sessionUser.id);
  const friendObjectId = new ObjectId(friendId);

  await db.collection("users").updateOne(
    { _id: userObjectId },
    { $addToSet: { friends: friendObjectId } } as any
  );
  await db.collection("users").updateOne(
    { _id: friendObjectId },
    { $addToSet: { friends: userObjectId } } as any
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const friendId = typeof body.userId === "string" ? body.userId : "";
  if (!ObjectId.isValid(friendId)) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  const db = await getDb();
  const userObjectId = new ObjectId(sessionUser.id);
  const friendObjectId = new ObjectId(friendId);
  await db.collection("users").updateOne(
    { _id: userObjectId },
    { $pull: { friends: friendObjectId } } as any
  );
  await db.collection("users").updateOne(
    { _id: friendObjectId },
    { $pull: { friends: userObjectId } } as any
  );

  return NextResponse.json({ ok: true });
}
