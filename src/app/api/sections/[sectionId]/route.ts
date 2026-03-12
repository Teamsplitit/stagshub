import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { sectionId } = await params;
  if (!ObjectId.isValid(sectionId)) {
    return NextResponse.json({ error: "Invalid section id." }, { status: 400 });
  }

  const db = await getDb();
  const sectionObjectId = new ObjectId(sectionId);

  const section = await db.collection("sections").findOne({ _id: sectionObjectId });
  if (!section) {
    return NextResponse.json({ error: "Section not found." }, { status: 404 });
  }

  if (section.groupId) {
    const group = await db.collection("groups").findOne({ _id: section.groupId });
    if (!group || group.adminId.toString() !== sessionUser.id) {
      if (!sessionUser.isAdmin) {
        return NextResponse.json({ error: "Group Admin only." }, { status: 403 });
      }
    }
  } else if (!sessionUser.isAdmin) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }
  if (section.slug === "friends") {
    return NextResponse.json({ error: "Cannot delete Friends section." }, { status: 403 });
  }

  await db.collection("items").deleteMany({ sectionId: sectionObjectId });
  await db.collection("sections").deleteOne({ _id: sectionObjectId });

  if ((global as any).io && section.groupId) {
    (global as any).io.to(`group:${section.groupId.toString()}`).emit("section_deleted", { sectionId });
  }

  return NextResponse.json({ ok: true });
}
