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
  const userId = new ObjectId(sessionUser.id);

  const items = await db
    .collection("items")
    .aggregate([
      { $match: { userId } },
      {
        $lookup: {
          from: "sections",
          localField: "sectionId",
          foreignField: "_id",
          as: "section",
        },
      },
      { $unwind: "$section" },
      {
        $project: {
          label: 1,
          createdAt: 1,
          sectionId: 1,
          sectionName: "$section.name",
          sectionSlug: "$section.slug",
        },
      },
      { $sort: { createdAt: -1 } },
    ])
    .toArray();

  return NextResponse.json(
    items.map((item) => ({
      id: item._id.toString(),
      label: item.label,
      createdAt: item.createdAt,
      sectionId: item.sectionId.toString(),
      sectionName: item.sectionName,
      sectionSlug: item.sectionSlug,
    }))
  );
}
