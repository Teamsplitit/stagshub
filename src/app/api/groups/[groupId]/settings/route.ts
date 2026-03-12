import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// GET /api/groups/[groupId]/settings — fetch group details including members
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

    // Fetch display names for all members
    const memberIds = (group.memberIds ?? []).map((id: ObjectId) => new ObjectId(id));
    const memberDocs = await db.collection("users")
        .find({ _id: { $in: memberIds } }, { projection: { displayName: 1, name: 1 } })
        .toArray();

    const allAdminIds: string[] = [
        group.adminId?.toString(),
        ...(group.adminIds ?? []).map((id: ObjectId) => id.toString()),
    ].filter(Boolean);

    return NextResponse.json({
        id: group._id.toString(),
        name: group.name,
        description: group.description ?? "",
        originalAdminId: group.adminId?.toString(),
        adminIds: allAdminIds,
        members: memberDocs.map(m => ({
            id: m._id.toString(),
            displayName: m.displayName,
            name: m.name,
            isAdmin: allAdminIds.includes(m._id.toString()),
        })),
    });
}

// PATCH /api/groups/[groupId]/settings — update description, promote, kick
export async function PATCH(
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

    const originalAdminId = group.adminId?.toString();
    const groupAdminIds: string[] = [
        originalAdminId,
        ...(group.adminIds ?? []).map((id: ObjectId) => id.toString()),
    ].filter(Boolean);

    const isRequesterAdmin = groupAdminIds.includes(sessionUser.id);
    if (!isRequesterAdmin) return NextResponse.json({ error: "Admin only." }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, any> = {};

    // Update description
    if (typeof body.description === "string") {
        updates.description = body.description.trim();
    }

    // Promote a member to admin
    if (body.action === "promote" && body.userId && ObjectId.isValid(body.userId)) {
        const targetId = new ObjectId(body.userId);
        await db.collection("groups").updateOne(
            { _id: new ObjectId(groupId) },
            { $addToSet: { adminIds: targetId } } as any
        );
        return NextResponse.json({ ok: true, action: "promoted" });
    }

    // Kick a member (non-original-admin can't kick original admin)
    if (body.action === "kick" && body.userId && ObjectId.isValid(body.userId)) {
        const targetId = body.userId;
        if (targetId === originalAdminId) {
            return NextResponse.json({ error: "The original group admin cannot be kicked." }, { status: 403 });
        }
        // Non-original admins can't kick other admins
        if (sessionUser.id !== originalAdminId && groupAdminIds.includes(targetId)) {
            return NextResponse.json({ error: "Only the original admin can kick other admins." }, { status: 403 });
        }
        await db.collection("groups").updateOne(
            { _id: new ObjectId(groupId) },
            { $pull: { memberIds: new ObjectId(targetId), adminIds: new ObjectId(targetId) } } as any
        );
        return NextResponse.json({ ok: true, action: "kicked" });
    }

    // Apply generic updates (like description)
    if (Object.keys(updates).length > 0) {
        await db.collection("groups").updateOne({ _id: new ObjectId(groupId) }, { $set: updates });
    }

    return NextResponse.json({ ok: true });
}
