import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// POST /api/items/[itemId]/reactions — toggle a reaction emoji
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ itemId: string }> }
) {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { itemId } = await params;
    if (!ObjectId.isValid(itemId)) return NextResponse.json({ error: "Invalid item id." }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const emoji = typeof body.emoji === "string" ? body.emoji.trim() : "";
    const ALLOWED_EMOJIS = ["👍", "❤️", "🔥", "😂", "😮"];
    if (!ALLOWED_EMOJIS.includes(emoji)) return NextResponse.json({ error: "Invalid emoji." }, { status: 400 });

    const db = await getDb();
    const item = await db.collection("items").findOne({ _id: new ObjectId(itemId) });
    if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

    const reactions: { emoji: string; userIds: string[] }[] = item.reactions ?? [];
    const existing = reactions.find((r) => r.emoji === emoji);
    const userId = sessionUser.id;

    if (existing) {
        if (existing.userIds.includes(userId)) {
            // Remove reaction
            const newUserIds = existing.userIds.filter((id) => id !== userId);
            if (newUserIds.length === 0) {
                await db.collection("items").updateOne(
                    { _id: new ObjectId(itemId) },
                    { $pull: { reactions: { emoji } } } as any
                );
            } else {
                await db.collection("items").updateOne(
                    { _id: new ObjectId(itemId), "reactions.emoji": emoji },
                    { $set: { "reactions.$.userIds": newUserIds } }
                );
            }
        } else {
            // Add user to existing reaction
            await db.collection("items").updateOne(
                { _id: new ObjectId(itemId), "reactions.emoji": emoji },
                { $addToSet: { "reactions.$.userIds": userId } } as any
            );
        }
    } else {
        // New reaction
        await db.collection("items").updateOne(
            { _id: new ObjectId(itemId) },
            { $push: { reactions: { emoji, userIds: [userId] } } } as any
        );
    }

    const updated = await db.collection("items").findOne({ _id: new ObjectId(itemId) });
    return NextResponse.json({ reactions: updated?.reactions ?? [] });
}
