import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { itemId } = await params;
  if (!ObjectId.isValid(itemId)) {
    return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
  }

  const db = await getDb();
  const itemObjectId = new ObjectId(itemId);

  const item = await db.collection("items").findOne({ _id: itemObjectId });
  if (!item) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  // Item owner can always delete their own item
  const isOwner = item.userId?.toString() === sessionUser.id;
  if (isOwner) {
    await db.collection("items").deleteOne({ _id: itemObjectId });
    return NextResponse.json({ ok: true });
  }

  // Global app admin can delete anything
  if (sessionUser.isAdmin) {
    await db.collection("items").deleteOne({ _id: itemObjectId });
    return NextResponse.json({ ok: true });
  }

  // Group admin (single or multi-admin) can delete items in their group's sections
  const section = await db.collection("sections").findOne({ _id: item.sectionId });
  if (section?.groupId) {
    const group = await db.collection("groups").findOne({ _id: section.groupId });
    if (group) {
      const adminIds: ObjectId[] = group.adminIds ?? [];
      const isGroupAdmin =
        group.adminId?.toString() === sessionUser.id ||
        adminIds.some((id: ObjectId) => id.equals(new ObjectId(sessionUser.id)));
      if (isGroupAdmin) {
        await db.collection("items").deleteOne({ _id: itemObjectId });
        return NextResponse.json({ ok: true });
      }
    }
  }

  return NextResponse.json({ error: "You can only delete your own items." }, { status: 403 });
}
