import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDirectory, '../..');
const sourcePath = path.join(backendRoot, 'src', 'data', 'content.json');

dotenv.config({ path: path.join(backendRoot, '.env') });

const connectionString = process.env.MONGODB_URI || process.env.DATABASE_URL;
const databaseName = process.env.MONGODB_DB;
const applyChanges = process.argv.includes('--apply');

function mergeContentPreservingChapters(localContent, currentContent) {
  const currentBooks = Array.isArray(currentContent?.books) ? currentContent.books : [];
  const localBooks = Array.isArray(localContent?.books) ? localContent.books : [];
  const currentBooksBySlug = new Map(currentBooks.map((book) => [book.slug, book]));
  const localSlugs = new Set(localBooks.map((book) => book.slug));
  const preservedChapterCounts = [];

  const mergedBooks = localBooks.map((localBook) => {
    const currentBook = currentBooksBySlug.get(localBook.slug);
    if (!currentBook || !Array.isArray(currentBook.chapters)) return localBook;

    const localChapters = Array.isArray(localBook.chapters) ? localBook.chapters : [];
    if (currentBook.chapters.length > localChapters.length) {
      preservedChapterCounts.push({
        book: localBook.title || localBook.slug,
        count: currentBook.chapters.length,
      });
      return { ...localBook, chapters: currentBook.chapters };
    }

    return localBook;
  });

  const databaseOnlyBooks = currentBooks.filter((book) => !localSlugs.has(book.slug));

  return {
    ...currentContent,
    ...localContent,
    books: [...mergedBooks, ...databaseOnlyBooks],
    _syncReport: {
      preservedChapterCounts,
      preservedDatabaseOnlyBooks: databaseOnlyBooks.map((book) => book.slug || book.title),
    },
  };
}

async function main() {
  if (!connectionString) {
    throw new Error('Set MONGODB_URI or DATABASE_URL in backend/.env before running this script.');
  }

  if (!connectionString.startsWith('mongodb://') && !connectionString.startsWith('mongodb+srv://')) {
    throw new Error('The database URL must start with mongodb:// or mongodb+srv://.');
  }

  const localContent = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
  if (!localContent || !Array.isArray(localContent.books) ||
      !localContent.books.some((book) => book.slug === 'the-day-good-lost-to-evil')) {
    throw new Error('The local content file is missing the expected TDGLTE book entry.');
  }

  const client = new MongoClient(connectionString, { serverSelectionTimeoutMS: 8000 });

  try {
    await client.connect();
    const database = client.db(databaseName || undefined);
    const contentCollection = database.collection('content');
    const existingDocument = await contentCollection.findOne({ key: 'site-content' });

    if (!existingDocument) {
      throw new Error("No existing 'site-content' record was found. This script will not create one.");
    }

    const currentContent = existingDocument.value || {};
    const mergedContent = mergeContentPreservingChapters(localContent, currentContent);
    const report = mergedContent._syncReport;
    delete mergedContent._syncReport;

    console.log(applyChanges ? 'CONTENT SYNC: APPLY MODE' : 'CONTENT SYNC: DRY RUN');
    console.log(`Source file: ${path.relative(backendRoot, sourcePath)}`);
    console.log(`Database: ${databaseName || '(MongoDB default database)'}`);
    console.log(`Existing site-content record: found (${existingDocument._id})`);
    console.log(`Local books: ${localContent.books.length}`);
    console.log(`Books retained from database but absent locally: ${report.preservedDatabaseOnlyBooks.length}`);
    console.log(`Books whose longer chapter lists will be preserved from the database: ${report.preservedChapterCounts.length}`);

    for (const item of report.preservedChapterCounts) {
      console.log(`  - ${item.book}: preserving ${item.count} existing chapters`);
    }
    for (const book of report.preservedDatabaseOnlyBooks) {
      console.log(`  - Retaining database-only book: ${book}`);
    }

    const unchanged = JSON.stringify(currentContent) === JSON.stringify(mergedContent);
    console.log(`Content differs from proposed merged version: ${!unchanged}`);
    console.log('Other collections (comments, likes, reports, messages, characters) will not be modified.');

    if (!applyChanges) {
      console.log('No database changes made. Review this report, then rerun with --apply to proceed.');
      return;
    }

    const backupCollection = database.collection('content_backups');
    const backup = await backupCollection.insertOne({
      key: 'site-content',
      originalDocument: existingDocument,
      backedUpAt: new Date(),
      sourceFile: path.relative(backendRoot, sourcePath),
      note: 'Automatic backup before an explicit local content sync.',
    });

    const updateResult = await contentCollection.updateOne(
      { _id: existingDocument._id, key: 'site-content' },
      { $set: { value: mergedContent, updatedAt: new Date() } },
    );

    if (updateResult.matchedCount !== 1 || updateResult.modifiedCount !== 1) {
      throw new Error('The content update did not modify exactly one site-content record. The backup was retained.');
    }

    console.log('Content sync completed.');
    console.log(`Backup saved in content_backups with ID: ${backup.insertedId}`);
    console.log('Only the site-content document was updated; user engagement collections were left untouched.');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(`Content sync failed: ${error.message}`);
  process.exitCode = 1;
});
