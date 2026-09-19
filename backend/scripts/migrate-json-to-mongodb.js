import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../src/data');

const connectionString = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || 'mysticpenhd';

if (!connectionString) {
  throw new Error('MONGODB_URI is required.');
}

function readJson(fileName, fallback) {
  return fs.readFile(path.join(dataDir, fileName), 'utf8')
    .then((raw) => JSON.parse(raw))
    .catch((error) => {
      if (error.code === 'ENOENT') return fallback;
      throw error;
    });
}

const client = new MongoClient(connectionString, { serverSelectionTimeoutMS: 10000 });

try {
  await client.connect();
  const db = client.db(databaseName);

  const content = await readJson('content.json', null);
  if (content) {
    await db.collection('content').updateOne(
      { key: 'site-content' },
      {
        $set: { value: content, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    console.log('Imported site content.');
  }

  const characters = await readJson('characters.json', []);
  if (characters.length) {
    for (const character of characters) {
      const slug = character.slug;
      if (!slug) continue;

      const { id: legacyId, _id: ignoredId, ...fields } = character;
      const existing = await db.collection('characters').findOne({ slug });
      const characterId = existing?._id || new ObjectId();

      await db.collection('characters').updateOne(
        { _id: characterId },
        {
          $set: { ...fields, slug, updatedAt: new Date() },
          $setOnInsert: { createdAt: character.createdAt ? new Date(character.createdAt) : new Date() },
        },
        { upsert: true },
      );
    }
    console.log(`Imported/updated ${characters.length} character records.`);
  }

  const collections = [
    'chapter_likes',
    'chapter_comments',
    'comment_likes',
    'comment_reports',
    'character_likes',
  ];

  for (const collectionName of collections) {
    const records = await readJson(`${collectionName}.json`, []);
    if (!records.length) {
      console.log(`Skipped ${collectionName}: no local records.`);
      continue;
    }

    console.log(
      `Skipped ${collectionName}: local records require identifier reconciliation before they can be imported safely.`,
    );
  }

  console.log(`MongoDB import completed for database: ${databaseName}`);
} finally {
  await client.close();
}
