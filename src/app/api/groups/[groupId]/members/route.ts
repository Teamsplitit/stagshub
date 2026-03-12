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

    const body = await request.json().catch(() => ({}));
    const targetUserId = body.userId;
    if (!targetUserId || !ObjectId.isValid(targetUserId)) {
        return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
    }

    const db = await getDb();
    const groupObjectId = new ObjectId(groupId);
    const targetUserObjectId = new ObjectId(targetUserId);

    const group = await db.collection("groups").findOne({ _id: groupObjectId });
    if (!group) {
        return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    const isSelfRemoval = sessionUser.id === targetUserId;
    const isAdminRemoving = sessionUser.id === group.adminId.toString();

    if (!isSelfRemoval && !isAdminRemoving) {
        return NextResponse.json({ error: "Forbidden: You don't have permission to remove this member." }, { status: 403 });
    }

    if (targetUserId === group.adminId.toString()) {
        return NextResponse.json({ error: "The group admin cannot be removed. To leave, delete the group." }, { status: 400 });
    }

    // Check if they are actually in the group
    if (!group.memberIds.some((id: ObjectId) => id.equals(targetUserObjectId))) {
        return NextResponse.json({ error: "User is not a member of this group." }, { status: 404 });
    }

    await db.collection("groups").updateOne(
        { _id: groupObjectId },
        { $pull: { memberIds: targetUserObjectId } as any }
    );

    return NextResponse.json({ ok: true });
}
