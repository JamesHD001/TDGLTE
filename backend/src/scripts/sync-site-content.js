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
const TDGLTE_SLUG = 'the-day-good-lost-to-evil';

function validateLocalContent(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    throw new Error('The local content file must contain a JSON object.');
  }
  if (typeof content.siteName !== 'string' || !content.siteName.trim()) {
    throw new Error('The local content file is missing a valid siteName.');
  }
  if (!content.author || typeof content.author !== 'object' ||
      typeof content.author.name !== 'string' || !content.author.name.trim() ||
      typeof content.author.bio !== 'string' || !content.author.bio.trim()) {
    throw new Error('The local content file is missing required author fields (name and bio).');
  }
  if (!Array.isArray(content.books)) {
    throw new Error('The local content file must include a books array.');
  }

  const tdglteBooks = content.books.filter((book) => book?.slug === TDGLTE_SLUG);
  if (tdglteBooks.length !== 1) {
    throw new Error('The local content must contain exactly one TDGLTE book entry.');
  }

  const book = tdglteBooks[0];
  for (const field of ['title', 'shortTitle', 'subtitle', 'tagline', 'summary', 'coverAsset']) {
    if (typeof book[field] !== 'string' || !book[field].trim()) {
      throw new Error(`The TDGLTE book entry is missing a valid "${field}" string.`);
    }
  }
  if (!book.metadata || typeof book.metadata !== 'object' || Array.isArray(book.metadata)) {
    throw new Error('The TDGLTE book entry must include a metadata object.');
  }
  for (const field of ['series', 'volume', 'genre', 'mood', 'status']) {
    if (typeof book.metadata[field] !== 'string' || !book.metadata[field].trim()) {
      throw new Error(`The TDGLTE metadata is missing a valid "${field}" string.`);
    }
  }
  if (!Array.isArray(book.metadata.themes) || !Array.isArray(book.futureTitles) ||
      !Array.isArray(book.lore) || !Array.isArray(book.chapters)) {
    throw new Error('The TDGLTE entry must include themes, futureTitles, lore, and chapters arrays.');
  }
  if (book.chapters.some((chapter) =>
    !chapter || typeof chapter !== 'object' ||
    (!(typeof chapter.number === 'number' && Number.isFinite(chapter.number)) &&
      !(typeof chapter.slug === 'string' && chapter.slug.trim())) ||
    typeof chapter.title !== 'string' ||
    !Array.isArray(chapter.paragraphs)
  )) {
    throw new Error('Every local TDGLTE chapter must have a title, paragraphs array, and stable number or slug.');
  }
  if (book.futureTitles.some((item) =>
    !item || typeof item.slug !== 'string' || typeof item.title !== 'string'
  )) {
    throw new Error('Every future title must include a slug and title.');
  }
  if (book.lore.some((item) =>
    !item || typeof item.title !== 'string' || typeof item.body !== 'string'
  )) {
    throw new Error('Every lore entry must include a title and body.');
  }
}

function chapterKeys(chapter) {
  const keys = [];
  if (typeof chapter?.slug === 'string' && chapter.slug.trim()) {
    keys.push(`slug:${chapter.slug}`);
  }
  if (typeof chapter?.number === 'number' && Number.isFinite(chapter.number)) {
    keys.push(`number:${chapter.number}`);
  }
  if (typeof chapter?.id === 'string' && chapter.id.trim()) {
    keys.push(`id:${chapter.id}`);
  }
  return keys;
}

function preserveExistingChapters(localChapters, currentChapters, bookTitle, report) {
  // Metadata-only sync: preserve the entire existing database chapter array, including
  // admin edits, ordering, and chapters that do not exist in the local source.
  if (currentChapters.length > 0) {
    report.preservedChapterCounts.push({
      book: bookTitle,
      databaseCount: currentChapters.length,
      localCount: localChapters.length,
    });
    return currentChapters;
  }

  // If the database has no chapters for this book, allow local chapters to seed it.
  return localChapters;
}

function mergeContentPreservingChapters(localContent, currentContent) {
  const currentBooks = Array.isArray(currentContent?.books) ? currentContent.books : [];
  const localBooks = Array.isArray(localContent?.books) ? localContent.books : [];
  const currentBooksBySlug = new Map(currentBooks.map((book) => [book.slug, book]));
  const localSlugs = new Set(localBooks.map((book) => book.slug));
  const report = { preservedChapterCounts: [], preservedDatabaseOnlyBooks: [] };

  const mergedBooks = localBooks.map((localBook) => {
    const currentBook = currentBooksBySlug.get(localBook.slug);
    if (!currentBook) return localBook;

    const localChapters = Array.isArray(localBook.chapters) ? localBook.chapters : [];
    const currentChapters = Array.isArray(currentBook.chapters) ? currentBook.chapters : [];

    return {
      ...currentBook,
      ...localBook,
      chapters: preserveExistingChapters(localChapters, currentChapters, localBook.title || localBook.slug, report),
    };
  });

  const databaseOnlyBooks = currentBooks.filter((book) => !localSlugs.has(book.slug));
  report.preservedDatabaseOnlyBooks = databaseOnlyBooks.map((book) => book.slug || book.title);

  return {
    content: {
      ...currentContent,
      ...localContent,
      books: [...mergedBooks, ...databaseOnlyBooks],
    },
    report,
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
  validateLocalContent(localContent);

  const client = new MongoClient(connectionString, { serverSelectionTimeoutMS: 8000 });

  try {
    await client.connect();
    const database = client.db(databaseName || undefined);
    const contentCollection = database.collection('content');
    const existingDocument = await contentCollection.findOne({ key: 'site-content' });

    if (!existingDocument) {
      throw new Error("No existing 'site-content' record was found. This script will not create one.");
    }
    if (!existingDocument.value || typeof existingDocument.value !== 'object') {
      throw new Error("The existing 'site-content' record has no valid value object. No changes were made.");
    }

    const { content: mergedContent, report } = mergeContentPreservingChapters(
      localContent,
      existingDocument.value,
    );

    console.log(applyChanges ? 'CONTENT SYNC: APPLY MODE' : 'CONTENT SYNC: DRY RUN');
    console.log(`Source file: ${path.relative(backendRoot, sourcePath)}`);
    console.log(`Database: ${databaseName || '(MongoDB default database)'}`);
    console.log(`Existing site-content record: found (${existingDocument._id})`);
    console.log(`Local books: ${localContent.books.length}`);
    console.log(`Books retained from database but absent locally: ${report.preservedDatabaseOnlyBooks.length}`);
    console.log(`Books whose existing chapter arrays will be preserved: ${report.preservedChapterCounts.length}`);

    for (const item of report.preservedChapterCounts) {
      console.log(`  - ${item.book}: preserving all ${item.databaseCount} database chapters; local chapters available but not applied: ${item.localCount}`);
    }
    for (const book of report.preservedDatabaseOnlyBooks) {
      console.log(`  - Retaining database-only book: ${book}`);
    }

    const unchanged = JSON.stringify(existingDocument.value) === JSON.stringify(mergedContent);
    console.log(`Content differs from proposed merged version: ${!unchanged}`);
    console.log('Existing chapter arrays for books with database chapters will not be modified. Other collections (comments, likes, reports, messages, characters) will not be modified.');

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

    const updateFilter = { _id: existingDocument._id, key: 'site-content' };
    if (Object.prototype.hasOwnProperty.call(existingDocument, 'updatedAt')) {
      updateFilter.updatedAt = existingDocument.updatedAt;
    } else {
      updateFilter.updatedAt = { $exists: false };
    }

    const updateResult = await contentCollection.updateOne(
      updateFilter,
      { $set: { value: mergedContent, updatedAt: new Date() } },
    );

    if (updateResult.matchedCount !== 1) {
      throw new Error(
        'The site-content record changed during this sync. No update was applied; the safety backup was retained. Rerun the dry-run to inspect the latest content.',
      );
    }

    console.log('Content sync completed.');
    console.log(`Backup saved in content_backups with ID: ${backup.insertedId}`);
    console.log('Only the site-content document was updated. Existing chapter arrays and user engagement collections were left untouched.');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(`Content sync failed: ${error.message}`);
  process.exitCode = 1;
});
