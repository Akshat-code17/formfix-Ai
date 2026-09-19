import { MongoClient } from "mongodb";
const client = new MongoClient(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 2000,
});
try {
  await client.connect();
  const h = await client
    .db()
    .collection("workerHealth")
    .findOne({ _id: "single-worker" });
  process.exitCode = h && Date.now() - h.at.getTime() < 180000 ? 0 : 1;
} catch {
  process.exitCode = 1;
} finally {
  await client.close();
}
