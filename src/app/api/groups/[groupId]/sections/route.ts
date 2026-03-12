import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const slugify = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

export async function GET(
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

    // Check if session user is a member of the group
    if (!group.memberIds.some((id: ObjectId) => id.equals(new ObjectId(sessionUser.id)))) {
        return NextResponse.json({ error: "Not a group member." }, { status: 403 });
    }

    const sections = await db
        .collection("sections")
        .find({ groupId: groupObjectId })
        .toArray();

    return NextResponse.json(
        sections.map((section) => ({
            id: section._id.toString(),
            name: section.name,
            slug: section.slug,
            isPrivate: Boolean(section.isPrivate),
            groupId: section.groupId?.toString(),
        }))
    );
}

export async function POST(
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
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2) {
        return NextResponse.json({ error: "Section name is too short." }, { status: 400 });
    }

    const slug = slugify(name);
    if (!slug) {
        return NextResponse.json({ error: "Section name is invalid." }, { status: 400 });
    }

    const db = await getDb();
    const groupObjectId = new ObjectId(groupId);
    const group = await db.collection("groups").findOne({ _id: groupObjectId });

    if (!group) {
        return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    // Check if session user is a member of the group
    if (!group.memberIds.some((id: ObjectId) => id.equals(new ObjectId(sessionUser.id)))) {
        return NextResponse.json({ error: "Not a group member." }, { status: 403 });
    }

    // Allow any group member to create a section for now, or just the admin. 
    // Let's allow any member, similar to global sections.

    // To avoid duplicate slugs across the platform, we append the group ID to the slug uniqueness check
    // or we could just namespace slugs within the group. Let's do a simple check.
    const existing = await db.collection("sections").findOne({ slug, groupId: groupObjectId });
    if (existing) {
        return NextResponse.json({ error: "Section already exists in this group." }, { status: 409 });
    }

    const section = {
        name,
        slug,
        groupId: groupObjectId,
        createdBy: sessionUser.id,
        isPrivate: false,
        createdAt: new Date(),
    };
    const result = await db.collection("sections").insertOne(section);

    // Log activity
    await db.collection("activity").insertOne({
        groupId: groupId,
        userId: sessionUser.id,
        userName: sessionUser.displayName,
        type: "section_created",
        detail: `Created section "${name}"`,
        createdAt: new Date(),
    });

    const responseData = {
        id: result.insertedId.toString(),
        name: section.name,
        slug: section.slug,
        isPrivate: section.isPrivate,
        groupId: section.groupId.toString(),
    };

    if ((global as any).io) {
        (global as any).io.to(`group:${groupId}`).emit("section_added", responseData);
    }

    return NextResponse.json(responseData);
}
