import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ groupId: string }> }
) {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { userId } = body;
    if (!userId || !ObjectId.isValid(userId)) {
        return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
    }

    const { groupId } = await params;
    if (!ObjectId.isValid(groupId)) {
        return NextResponse.json({ error: "Invalid group id." }, { status: 400 });
    }

    const db = await getDb();
    const group = await db.collection("groups").findOne({ _id: new ObjectId(groupId) });

    if (!group) {
        return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    if (group.adminId.toString() !== sessionUser.id) {
        return NextResponse.json({ error: "Only the group admin can invite members." }, { status: 403 });
    }

    const memberId = new ObjectId(userId);

    // Check if member already exists
    if (group.memberIds.some((id: ObjectId) => id.equals(memberId))) {
        return NextResponse.json({ error: "User is already a member." }, { status: 400 });
    }

    // Check if the user is a friend of the admin
    const adminUser = await db.collection("users").findOne({ _id: new ObjectId(sessionUser.id) }, { projection: { friends: 1 } });
    const isFriend = (adminUser?.friends || []).some((friendId: ObjectId) => friendId.equals(memberId));

    if (!isFriend) {
        return NextResponse.json({ error: "You can only invite your friends to this group." }, { status: 403 });
    }

    await db.collection("groups").updateOne(
        { _id: new ObjectId(groupId) },
        { $push: { memberIds: memberId } as any }
    );

    return NextResponse.json({ ok: true });
}
