import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = await getDb();
  await ensureFriendsSection(db, sessionUser.id);
  const sections = await db.collection("sections").find({ groupId: { $exists: false } }).toArray();

  return NextResponse.json(
    sections.map((section) => ({
      id: section._id.toString(),
      name: section.name,
      slug: section.slug,
      isPrivate: Boolean(section.isPrivate),
    }))
  );
}

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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
  const existing = await db.collection("sections").findOne({ slug });
  if (existing) {
    return NextResponse.json({ error: "Section already exists." }, { status: 409 });
  }

  const section = {
    name,
    slug,
    createdBy: sessionUser.id,
    isPrivate: false,
    createdAt: new Date(),
  };
  const result = await db.collection("sections").insertOne(section);

  return NextResponse.json({
    id: result.insertedId.toString(),
    name: section.name,
    slug: section.slug,
    isPrivate: section.isPrivate,
  });
}

async function ensureFriendsSection(db: Awaited<ReturnType<typeof getDb>>, userId: string) {
  const existing = await db.collection("sections").findOne({ slug: "friends" });
  if (existing) return;
  await db.collection("sections").insertOne({
    name: "Friends",
    slug: "friends",
    createdBy: userId,
    isPrivate: true,
    createdAt: new Date(),
  });
}
