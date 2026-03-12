import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// PATCH /api/items/[itemId] — update status or pinned
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { itemId } = await params;
  if (!ObjectId.isValid(itemId)) return NextResponse.json({ error: "Invalid item id." }, { status: 400 });

  const db = await getDb();
  const item = await db.collection("items").findOne({ _id: new ObjectId(itemId) });
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  // Check permissions: owner or group admin
  const section = await db.collection("sections").findOne({ _id: item.sectionId });
  let isGroupAdmin = false;
  if (section?.groupId) {
    const group = await db.collection("groups").findOne({ _id: section.groupId });
    if (group) {
      const allAdminIds = [group.adminId?.toString(), ...(group.adminIds ?? []).map((id: ObjectId) => id.toString())];
      isGroupAdmin = allAdminIds.includes(sessionUser.id);
    }
  }
  const isOwner = item.userId?.toString() === sessionUser.id;
  if (!isOwner && !isGroupAdmin && !sessionUser.isAdmin) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, any> = {};

  const VALID_STATUSES = ["open", "in-progress", "done"];
  if (body.status && VALID_STATUSES.includes(body.status)) updates.status = body.status;
  if (typeof body.pinned === "boolean") {
    // Only group admins/global admins can pin
    if (!isGroupAdmin && !sessionUser.isAdmin) return NextResponse.json({ error: "Only admins can pin items." }, { status: 403 });
    updates.pinned = body.pinned;
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  await db.collection("items").updateOne({ _id: new ObjectId(itemId) }, { $set: updates });

  if ((global as any).io) {
    (global as any).io.to(`section:${item.sectionId}`).emit("item_updated", { itemId, updates });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { itemId } = await params;
  if (!ObjectId.isValid(itemId)) return NextResponse.json({ error: "Invalid item id." }, { status: 400 });

  const db = await getDb();
  const itemObjectId = new ObjectId(itemId);
  const item = await db.collection("items").findOne({ _id: itemObjectId });
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  const sectionId = item.sectionId.toString();

  const performDelete = async () => {
    await db.collection("items").deleteOne({ _id: itemObjectId });
    if ((global as any).io) {
      (global as any).io.to(`section:${sectionId}`).emit("item_deleted", { itemId });
    }
    return NextResponse.json({ ok: true });
  };

  const isOwner = item.userId?.toString() === sessionUser.id;
  if (isOwner) return performDelete();
  if (sessionUser.isAdmin) return performDelete();

  const section = await db.collection("sections").findOne({ _id: item.sectionId });
  if (section?.groupId) {
    const group = await db.collection("groups").findOne({ _id: section.groupId });
    if (group) {
      const adminIds: ObjectId[] = group.adminIds ?? [];
      const isGroupAdmin = group.adminId?.toString() === sessionUser.id || adminIds.some((id: ObjectId) => id.equals(new ObjectId(sessionUser.id)));
      if (isGroupAdmin) return performDelete();
    }
  }
  return NextResponse.json({ error: "You can only delete your own items." }, { status: 403 });
}
