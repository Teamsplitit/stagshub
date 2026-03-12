import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { sectionId } = await params;
  const db = await getDb();
  if (!ObjectId.isValid(sectionId)) return NextResponse.json({ error: "Invalid section id." }, { status: 400 });

  const sectionObjectId = new ObjectId(sectionId);
  const section = await db.collection("sections").findOne({ _id: sectionObjectId });
  if (!section) return NextResponse.json({ error: "Section not found." }, { status: 404 });

  if (section.groupId) {
    const group = await db.collection("groups").findOne({ _id: section.groupId });
    if (!group || !group.memberIds.some((id: ObjectId) => id.equals(new ObjectId(sessionUser.id)))) {
      return NextResponse.json({ error: "Not a group member." }, { status: 403 });
    }
  }

  let userFilter: ObjectId[] | null = null;
  if (section.slug === "friends") {
    const user = await db.collection("users").findOne({ _id: new ObjectId(sessionUser.id) }, { projection: { friends: 1 } });
    const friends = (user?.friends ?? []) as ObjectId[];
    userFilter = [...friends, new ObjectId(sessionUser.id)];
  }

  const matchStage = userFilter?.length
    ? { sectionId: sectionObjectId, userId: { $in: userFilter } }
    : { sectionId: sectionObjectId };

  const items = await db.collection("items").aggregate([
    { $match: matchStage },
    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    {
      $project: {
        label: 1, createdAt: 1, status: 1, pinned: 1, reactions: 1,
        userId: 1,
        userName: "$user.displayName",
      },
    },
    // Pinned items first, then newest first
    { $sort: { pinned: -1, createdAt: -1 } },
  ]).toArray();

  return NextResponse.json(
    items.map((item) => ({
      id: item._id.toString(),
      label: item.label,
      userName: item.userName,
      userId: item.userId?.toString(),
      createdAt: item.createdAt,
      status: item.status ?? "open",
      pinned: item.pinned ?? false,
      reactions: item.reactions ?? [],
    }))
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (label.length < 2) return NextResponse.json({ error: "Card name is too short." }, { status: 400 });

  const { sectionId } = await params;
  if (!ObjectId.isValid(sectionId)) return NextResponse.json({ error: "Invalid section id." }, { status: 400 });

  const db = await getDb();
  const section = await db.collection("sections").findOne({ _id: new ObjectId(sectionId) });
  if (!section) return NextResponse.json({ error: "Section not found." }, { status: 404 });

  if (section.groupId) {
    const group = await db.collection("groups").findOne({ _id: section.groupId });
    if (!group || !group.memberIds.some((id: ObjectId) => id.equals(new ObjectId(sessionUser.id)))) {
      return NextResponse.json({ error: "Not a group member." }, { status: 403 });
    }

    const groupId = group._id.toString();
    const otherMemberIds: string[] = (group.memberIds as ObjectId[])
      .map((id) => id.toString())
      .filter((id) => id !== sessionUser.id);

    if (otherMemberIds.length > 0) {
      await db.collection("notifications").insertMany(
        otherMemberIds.map((userId) => ({
          userId,
          type: "new_item",
          message: `${sessionUser.displayName} added "${label}" in ${group.name}`,
          read: false,
          groupId,
          itemId: null,
          createdAt: new Date(),
        }))
      );
    }

    await db.collection("activity").insertOne({
      groupId,
      userId: sessionUser.id,
      userName: sessionUser.displayName,
      type: "item_added",
      detail: `Added "${label}" to ${section.name}`,
      createdAt: new Date(),
    });
  }

  const item = {
    sectionId: new ObjectId(sectionId),
    userId: new ObjectId(sessionUser.id),
    label,
    status: "open",
    pinned: false,
    reactions: [],
    createdAt: new Date(),
  };
  const result = await db.collection("items").insertOne(item);

  return NextResponse.json({
    id: result.insertedId.toString(),
    label,
    userName: sessionUser.displayName,
    userId: sessionUser.id,
    createdAt: item.createdAt,
    status: "open",
    pinned: false,
    reactions: [],
  });
}
