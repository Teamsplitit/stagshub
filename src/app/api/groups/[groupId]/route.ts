import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ groupId: string }> }
) {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { groupId } = await params;
    if (!ObjectId.isValid(groupId)) {
        return NextResponse.json({ error: "Invalid group id." }, { status: 400 });
    }

    const db = await getDb();
    const groupObjectId = new ObjectId(groupId);

    const group = await db.collection("groups").findOne({ _id: groupObjectId });
    if (!group) {
        return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    if (group.adminId.toString() !== sessionUser.id) {
        return NextResponse.json({ error: "Only the group admin can delete the group." }, { status: 403 });
    }

    // Cascade delete logic
    // 1. Find all sections belonging to this group
    const sections = await db.collection("sections").find({ groupId: groupObjectId }).toArray();
    const sectionIds = sections.map(s => s._id);

    // 2. Delete all items belonging to those sections
    if (sectionIds.length > 0) {
        await db.collection("items").deleteMany({ sectionId: { $in: sectionIds } });
    }

    // 3. Delete the group's sections
    await db.collection("sections").deleteMany({ groupId: groupObjectId });

    // 4. Finally, delete the group itself
    await db.collection("groups").deleteOne({ _id: groupObjectId });

    return NextResponse.json({ ok: true });
}
