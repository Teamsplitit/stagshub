import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// GET /api/notifications — fetch my notifications (recent 30)
export async function GET(request: NextRequest) {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const db = await getDb();
    const notifications = await db
        .collection("notifications")
        .find({ userId: sessionUser.id })
        .sort({ createdAt: -1 })
        .limit(30)
        .toArray();

    return NextResponse.json(
        notifications.map((n) => ({
            id: n._id.toString(),
            type: n.type,
            message: n.message,
            read: n.read ?? false,
            groupId: n.groupId ?? null,
            createdAt: n.createdAt,
        }))
    );
}

// POST /api/notifications/read — mark all as read
export async function POST(request: NextRequest) {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const db = await getDb();
    await db.collection("notifications").updateMany(
        { userId: sessionUser.id, read: false },
        { $set: { read: true } }
    );
    return NextResponse.json({ ok: true });
}

// Helper to create a notification — exported for use in other routes
export async function createNotification(
    db: Awaited<ReturnType<typeof import("@/lib/db")["getDb"]>>,
    userId: string,
    type: string,
    message: string,
    extras?: { groupId?: string; itemId?: string }
) {
    await db.collection("notifications").insertOne({
        userId,
        type,
        message,
        read: false,
        groupId: extras?.groupId ?? null,
        itemId: extras?.itemId ?? null,
        createdAt: new Date(),
    });
}
