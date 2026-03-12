import { ObjectId } from "mongodb";
import { NextRequest } from "next/server";
import { getDb } from "./db";

export type SessionUser = {
  id: string;
  name: string;
  displayName: string;
  isAdmin: boolean;
};

export function hasGate(request: NextRequest): boolean {
  return request.cookies.get("stagshub_gate")?.value === "1";
}

export async function getSessionUser(
  request: NextRequest
): Promise<SessionUser | null> {
  const token = request.cookies.get("stagshub_session")?.value;
  if (!token) return null;
  const db = await getDb();
  const session = await db.collection("sessions").findOne({ token });
  if (!session) return null;
  const userId =
    typeof session.userId === "string" ? new ObjectId(session.userId) : session.userId;
  const user = await db.collection("users").findOne({ _id: userId });
  if (!user) return null;
  return {
    id: user._id.toString(),
    name: user.name,
    displayName: user.displayName,
    isAdmin: Boolean(user.isAdmin),
  };
}
