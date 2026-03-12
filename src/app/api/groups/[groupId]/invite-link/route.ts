import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { randomUUID } from "crypto";

// POST /api/groups/[groupId]/invite-link — regenerate invite token
export async function POST(
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

    // Only admins can manage invite links
    const allAdminIds = [group.adminId?.toString(), ...(group.adminIds ?? []).map((id: ObjectId) => id.toString())];
    if (!allAdminIds.includes(sessionUser.id)) {
        return NextResponse.json({ error: "Only admins can manage invite links." }, { status: 403 });
    }

    const token = randomUUID();
    await db.collection("groups").updateOne({ _id: new ObjectId(groupId) }, { $set: { inviteToken: token } });
    return NextResponse.json({ token });
}

// GET /api/groups/[groupId]/invite-link — get current token (admins only)
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

    const allAdminIds = [group.adminId?.toString(), ...(group.adminIds ?? []).map((id: ObjectId) => id.toString())];
    if (!allAdminIds.includes(sessionUser.id)) {
        return NextResponse.json({ error: "Only admins can see invite links." }, { status: 403 });
    }

    // Generate token if doesn't exist yet
    if (!group.inviteToken) {
        const token = randomUUID();
        await db.collection("groups").updateOne({ _id: new ObjectId(groupId) }, { $set: { inviteToken: token } });
        return NextResponse.json({ token });
    }

    return NextResponse.json({ token: group.inviteToken });
}
