import assert from 'node:assert/strict';
import { setServers } from 'node:dns';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config({ path: '.env.local', override: true });

const dnsServers = process.env.COMMUNITY_MONGO_DNS_SERVERS?.split(',').map((server) => server.trim()).filter(Boolean);
if (dnsServers?.length) {
  setServers(dnsServers);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith('mongodb')) {
  throw new Error('DATABASE_URL must be a MongoDB connection string');
}

const client = new MongoClient(databaseUrl);

async function main() {
  await client.connect();
  const ledger = client.db().collection('credit_ledger');
  const missingSourceKey = await ledger.countDocuments({
    $or: [
      { sourceKey: { $exists: false } },
      { sourceKey: null },
      { sourceKey: '' },
    ],
  });

  assert.equal(
    missingSourceKey,
    0,
    'Legacy credit ledger rows are missing sourceKey. Backfill them before creating the unique reward index.'
  );

  await ledger.createIndex(
    { sourceKey: 1 },
    { name: 'credit_ledger_sourceKey_key', unique: true }
  );
  await ledger.createIndex(
    { campaignId: 1 },
    { name: 'credit_ledger_campaignId_idx' }
  );

  const indexes = await ledger.listIndexes().toArray();
  const sourceKeyIndex = indexes.find((index) => index.name === 'credit_ledger_sourceKey_key');
  assert.equal(sourceKeyIndex?.unique, true, 'sourceKey index must be unique');
  assert.equal(sourceKeyIndex?.key.sourceKey, 1, 'sourceKey index must cover sourceKey');

  console.log(JSON.stringify({
    ok: true,
    missingSourceKey,
    sourceKeyIndex: sourceKeyIndex?.name,
    sourceKeyUnique: sourceKeyIndex?.unique,
  }));
}

main()
  .finally(() => client.close())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
