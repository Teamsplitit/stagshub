import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// GET /api/groups/[groupId]/activity — last 30 activity events
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ groupId: string }> }
) {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { groupId } = await params;
    if (!ObjectId.isValid(groupId)) return NextResponse.json({ error: "Invalid group id." }, { status: 400 });

    const db = await getDb();
    const group = await db.collection("groups").findOne({ _id: new ObjectId(groupId) });
    if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

    const isMember = group.memberIds?.some((id: ObjectId) => id.equals(new ObjectId(sessionUser.id)));
    if (!isMember) return NextResponse.json({ error: "Not a member." }, { status: 403 });

    const activity = await db
        .collection("activity")
        .find({ groupId })
        .sort({ createdAt: -1 })
        .limit(30)
        .toArray();

    return NextResponse.json(
        activity.map((a) => ({
            id: a._id.toString(),
            type: a.type,
            userName: a.userName,
            detail: a.detail,
            createdAt: a.createdAt,
        }))
    );
}
