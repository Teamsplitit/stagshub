import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const db = await getDb();
    const user = await db
        .collection("users")
        .findOne({ _id: new ObjectId(sessionUser.id) }, { projection: { incomingRequests: 1, outgoingRequests: 1 } });

    const incoming = user?.incomingRequests ?? [];
    const outgoing = user?.outgoingRequests ?? [];

    const allIds = [...incoming, ...outgoing];
    if (!allIds.length) {
        return NextResponse.json({ incoming: [], outgoing: [] });
    }

    const docs = await db
        .collection("users")
        .find({ _id: { $in: allIds } }, { projection: { name: 1, displayName: 1 } })
        .toArray();

    const mapDoc = (doc: any) => ({
        id: doc._id.toString(),
        name: doc.name,
        displayName: doc.displayName,
    });

    return NextResponse.json({
        incoming: docs.filter(d => incoming.some((id: ObjectId) => id.equals(d._id))).map(mapDoc),
        outgoing: docs.filter(d => outgoing.some((id: ObjectId) => id.equals(d._id))).map(mapDoc),
    });
}

export async function POST(request: NextRequest) {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const targetId = typeof body.userId === "string" ? body.userId : "";
    if (!ObjectId.isValid(targetId)) return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
    if (targetId === sessionUser.id) return NextResponse.json({ error: "Cannot add yourself." }, { status: 400 });

    const db = await getDb();
    const senderId = new ObjectId(sessionUser.id);
    const receiverId = new ObjectId(targetId);

    // Check if they are already friends
    const user = await db.collection("users").findOne({ _id: senderId });
    if (user?.friends?.some((id: ObjectId) => id.equals(receiverId))) {
        return NextResponse.json({ error: "Already friends." }, { status: 400 });
    }

    // Push to outgoing and incoming
    await db.collection("users").updateOne({ _id: senderId }, { $addToSet: { outgoingRequests: receiverId } } as any);
    await db.collection("users").updateOne({ _id: receiverId }, { $addToSet: { incomingRequests: senderId } } as any);

    // Notify the recipient
    await db.collection("notifications").insertOne({
        userId: targetId,
        type: "friend_request",
        message: `${sessionUser.displayName} sent you a friend request`,
        read: false,
        groupId: null,
        itemId: null,
        createdAt: new Date(),
    });

    return NextResponse.json({ ok: true });
}

export async function PUT(request: NextRequest) {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const friendId = typeof body.userId === "string" ? body.userId : "";
    if (!ObjectId.isValid(friendId)) return NextResponse.json({ error: "Invalid user id." }, { status: 400 });

    const db = await getDb();
    const receiverId = new ObjectId(sessionUser.id);
    const senderId = new ObjectId(friendId);

    // Accept request
    await db.collection("users").updateOne(
        { _id: receiverId },
        {
            $pull: { incomingRequests: senderId },
            $addToSet: { friends: senderId }
        } as any
    );
    await db.collection("users").updateOne(
        { _id: senderId },
        {
            $pull: { outgoingRequests: receiverId },
            $addToSet: { friends: receiverId }
        } as any
    );

    return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const targetId = typeof body.userId === "string" ? body.userId : "";
    if (!ObjectId.isValid(targetId)) return NextResponse.json({ error: "Invalid user id." }, { status: 400 });

    const db = await getDb();
    const userId = new ObjectId(sessionUser.id);
    const targetObjId = new ObjectId(targetId);

    // decline or cancel
    await db.collection("users").updateOne(
        { _id: userId },
        { $pull: { incomingRequests: targetObjId, outgoingRequests: targetObjId } } as any
    );
    await db.collection("users").updateOne(
        { _id: targetObjId },
        { $pull: { incomingRequests: userId, outgoingRequests: userId } } as any
    );

    return NextResponse.json({ ok: true });
}
