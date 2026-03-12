import { Db, MongoClient } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var _stagshubMongoPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _stagshubIndexesReady: boolean | undefined;
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("Missing MONGODB_URI in environment variables.");
}

const client = new MongoClient(uri);
const clientPromise = global._stagshubMongoPromise ?? client.connect();

if (!global._stagshubMongoPromise) {
  global._stagshubMongoPromise = clientPromise;
}

const dbName = process.env.STAGSHUB_DB || "stagshub";

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  const db = client.db(dbName);
  if (!global._stagshubIndexesReady) {
    await ensureIndexes(db);
    global._stagshubIndexesReady = true;
  }
  return db;
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("users").createIndex({ name: 1 }, { unique: true }),
    db.collection("sections").createIndex({ slug: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ token: 1 }, { unique: true }),
    db.collection("items").createIndex({ sectionId: 1 }),
    db.collection("items").createIndex({ userId: 1 }),
  ]);
}
