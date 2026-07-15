import assert from 'node:assert/strict';
import { setServers } from 'node:dns';
import dotenv from 'dotenv';
import { MongoClient, type Collection, type Document } from 'mongodb';
import { COMMUNITY_INDEX_SPECS, type CommunityIndexSpec } from '../src/lib/community/indexes';

dotenv.config({ path: '.env.local', override: true });

const dnsServers = process.env.COMMUNITY_MONGO_DNS_SERVERS
  ?.split(',')
  .map((server) => server.trim())
  .filter(Boolean);
if (dnsServers?.length) setServers(dnsServers);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith('mongodb')) {
  throw new Error('DATABASE_URL must be a MongoDB connection string');
}

const client = new MongoClient(databaseUrl);

function missingKeyQuery(fields: string[]) {
  return {
    $or: fields.flatMap((field) => [
      { [field]: { $exists: false } },
      { [field]: null },
      { [field]: '' },
    ]),
  };
}

async function assertUniqueDataIsReady(collection: Collection<Document>, spec: CommunityIndexSpec) {
  const fields = Object.keys(spec.key);
  const scope = spec.partialFilterExpression ?? {};
  const missingCount = await collection.countDocuments({
    $and: [scope, missingKeyQuery(fields)],
  });
  assert.equal(
    missingCount,
    0,
    `${spec.collection}.${fields.join('+')} has missing values; repair them before creating ${spec.name}.`,
  );

  const groupId = Object.fromEntries(fields.map((field) => [field, `$${field}`]));
  const duplicates = await collection.aggregate([
    ...(spec.partialFilterExpression ? [{ $match: spec.partialFilterExpression }] : []),
    { $group: { _id: groupId, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 5 },
  ]).toArray();
  assert.deepEqual(
    duplicates,
    [],
    `${spec.collection}.${fields.join('+')} contains duplicate values; deduplicate before creating ${spec.name}.`,
  );
}

function sameIndexKey(actual: Document, expected: Record<string, 1 | -1>) {
  return JSON.stringify(Object.entries(actual)) === JSON.stringify(Object.entries(expected));
}

async function main() {
  await client.connect();
  const database = client.db();

  for (const spec of COMMUNITY_INDEX_SPECS) {
    const collection = database.collection(spec.collection);
    if (spec.unique) await assertUniqueDataIsReady(collection, spec);
    const options: Parameters<typeof collection.createIndex>[1] = {
      name: spec.name,
      unique: spec.unique ?? false,
    };
    if (spec.partialFilterExpression) options.partialFilterExpression = spec.partialFilterExpression;
    if (spec.expireAfterSeconds !== undefined) options.expireAfterSeconds = spec.expireAfterSeconds;
    await collection.createIndex(spec.key, options);
  }

  for (const spec of COMMUNITY_INDEX_SPECS) {
    const indexes = await database.collection(spec.collection).listIndexes().toArray();
    const index = indexes.find((candidate) => candidate.name === spec.name);
    assert.ok(index, `${spec.name} must exist`);
    assert.equal(sameIndexKey(index.key, spec.key), true, `${spec.name} key order must match the Prisma schema`);
    assert.equal(Boolean(index.unique), Boolean(spec.unique), `${spec.name} uniqueness must match the Prisma schema`);
    assert.deepEqual(
      index.partialFilterExpression,
      spec.partialFilterExpression,
      `${spec.name} partial filter must match`,
    );
    assert.equal(index.expireAfterSeconds, spec.expireAfterSeconds, `${spec.name} TTL must match`);
  }

  console.log(JSON.stringify({
    ok: true,
    verifiedIndexes: COMMUNITY_INDEX_SPECS.map((spec) => spec.name),
  }));
}

main()
  .finally(() => client.close())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
