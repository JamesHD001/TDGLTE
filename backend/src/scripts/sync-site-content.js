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

function mergeContentMetadata(localContent, currentContent) {
  const localBook = localContent.books.find((book) => book?.slug === TDGLTE_SLUG);
  const currentBooks = Array.isArray(currentContent?.books) ? currentContent.books : [];
  const currentBookIndex = currentBooks.findIndex((book) => book?.slug === TDGLTE_SLUG);

  if (!localBook) {
    throw new Error('The local source does not contain the TDGLTE metadata entry.');
  }
  if (currentBookIndex < 0) {
    throw new Error('The database does not contain an existing TDGLTE book entry. No new book or chapter data will be created by this metadata-only sync.');
  }

  const currentBook = currentBooks[currentBookIndex];
  const metadataFields = ['title', 'shortTitle', 'subtitle', 'tagline', 'summary', 'coverAsset', 'metadata'];
  const updatedBook = { ...currentBook };
  for (const field of metadataFields) {
    if (Object.prototype.hasOwnProperty.call(localBook, field)) {
      updatedBook[field] = localBook[field];
    }
  }

  const books = [...currentBooks];
  books[currentBookIndex] = updatedBook;
  return {
    content: {
      ...currentContent,
      siteName: localContent.siteName,
      author: localContent.author,
      books,
    },
    report: {
      updatedBook: updatedBook.title || TDGLTE_SLUG,
      preservedBookCount: currentBooks.length - 1,
      preservedChapterCount: Array.isArray(currentBook.chapters) ? currentBook.chapters.length : 0,
      preservedLoreCount: Array.isArray(currentBook.lore) ? currentBook.lore.length : 0,
      preservedFutureTitleCount: Array.isArray(currentBook.futureTitles) ? currentBook.futureTitles.length : 0,
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

    const { content: mergedContent, report } = mergeContentMetadata(
      localContent,
      existingDocument.value,
    );

    console.log(applyChanges ? 'CONTENT SYNC: APPLY MODE' : 'CONTENT SYNC: DRY RUN');
    console.log(`Source file: ${path.relative(backendRoot, sourcePath)}`);
    console.log(`Database: ${databaseName || '(MongoDB default database)'}`);
    console.log(`Existing site-content record: found (${existingDocument._id})`);
    console.log(`Local books: ${localContent.books.length}`);
    console.log(`Metadata target: ${report.updatedBook}`);
    console.log(`Other existing books preserved: ${report.preservedBookCount}`);
    console.log(`Existing TDGLTE chapters preserved exactly: ${report.preservedChapterCount}`);
    console.log(`Existing TDGLTE lore entries preserved: ${report.preservedLoreCount}`);
    console.log(`Existing TDGLTE future-title entries preserved: ${report.preservedFutureTitleCount}`);

    const unchanged = JSON.stringify(existingDocument.value) === JSON.stringify(mergedContent);
    console.log(`Content differs from proposed merged version: ${!unchanged}`);
    console.log('Only siteName, author, and selected TDGLTE book metadata fields are candidates for change. Chapters, lore, future titles, all other books, and other collections will not be modified.');

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
    console.log('Only siteName, author, and selected TDGLTE book metadata fields were updated in the site-content document. Chapters, lore, future titles, other books, and user engagement collections were left untouched.');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(`Content sync failed: ${error.message}`);
  process.exitCode = 1;
});
