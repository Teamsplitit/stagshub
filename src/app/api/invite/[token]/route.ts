import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// GET /api/invite/[token] — join a group via invite token
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
        // Redirect to app with token in query string so they can join after login
        const url = new URL(request.url);
        return NextResponse.redirect(new URL(`/?invite=${(await params).token}`, url.origin));
    }

    const { token } = await params;
    const db = await getDb();
    const group = await db.collection("groups").findOne({ inviteToken: token });
    if (!group) return NextResponse.json({ error: "Invalid or expired invite link." }, { status: 404 });

    const userId = new ObjectId(sessionUser.id);
    const isMember = group.memberIds?.some((id: ObjectId) => id.equals(userId));
    if (!isMember) {
        await db.collection("groups").updateOne(
            { _id: group._id },
            { $push: { memberIds: userId } } as any
        );
        // Log activity
        await db.collection("activity").insertOne({
            groupId: group._id.toString(),
            userId: sessionUser.id,
            userName: sessionUser.displayName,
            type: "member_joined",
            detail: `${sessionUser.displayName} joined via invite link`,
            createdAt: new Date(),
        });
    }

    const url = new URL(request.url);
    return NextResponse.redirect(new URL(`/?joinedGroup=${group._id.toString()}`, url.origin));
}
