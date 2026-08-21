import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, ObjectId } from 'mongodb';
import { mysticPenHDContent } from '../src/data/novelData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataFilePath = path.join(__dirname, 'data', 'content.json');
const charactersFilePath = path.join(__dirname, 'data', 'characters.json');
const characterLikesFilePath = path.join(__dirname, 'data', 'character_likes.json');
const chapterLikesFilePath = path.join(__dirname, 'data', 'chapter_likes.json');
const chapterCommentsFilePath = path.join(__dirname, 'data', 'chapter_comments.json');
const commentLikesFilePath = path.join(__dirname, 'data', 'comment_likes.json');
const commentReportsFilePath = path.join(__dirname, 'data', 'comment_reports.json');

let client = null;
let database = null;

function getConnectionString() {
  return process.env.MONGODB_URI || process.env.DATABASE_URL || '';
}

function getObjectId(id) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

export function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

async function readLegacyContent() {
  try {
    return JSON.parse(await fs.readFile(dataFilePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return mysticPenHDContent;
    throw error;
  }
}

async function ensureIndexes() {
  await Promise.all([
    database.collection('content').createIndex({ key: 1 }, { unique: true }),
    database.collection('messages').createIndex({ createdAt: -1 }),
    database.collection('chapter_likes').createIndex({ chapterKey: 1, visitorId: 1 }, { unique: true }),
    database.collection('chapter_likes').createIndex({ chapterKey: 1 }),
    database.collection('chapter_comments').createIndex({ chapterKey: 1, parentId: 1, status: 1, createdAt: -1 }),
    database.collection('chapter_comments').createIndex({ parentId: 1 }),
    database.collection('comment_likes').createIndex({ commentId: 1, visitorId: 1 }, { unique: true }),
    database.collection('comment_likes').createIndex({ commentId: 1 }),
    database.collection('comment_reports').createIndex({ commentId: 1, visitorId: 1 }),
    database.collection('comment_reports').createIndex({ status: 1, createdAt: -1 }),
    database.collection('characters').createIndex({ slug: 1 }, { unique: true }),
    database.collection('characters').createIndex({ publicationState: 1, featured: -1, updatedAt: -1 }),
    database.collection('character_likes').createIndex({ characterId: 1, visitorId: 1 }, { unique: true }),
    database.collection('character_likes').createIndex({ characterId: 1 }),
  ]);
}

async function migrateLegacyContent() {
  const content = await database.collection('content').findOne({ key: 'site-content' });
  if (content) return;

  await database.collection('content').insertOne({
    key: 'site-content',
    value: await readLegacyContent(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log('Legacy JSON content migrated to MongoDB.');
}

export async function initDb() {
  const connectionString = getConnectionString();
  if (!connectionString) return null;

  if (!connectionString.startsWith('mongodb://') && !connectionString.startsWith('mongodb+srv://')) {
    throw new Error('MongoDB requires a mongodb:// or mongodb+srv:// connection string.');
  }

  const clientOptions = {
    serverSelectionTimeoutMS: 5000,
  };

  if (process.env.DB_SSL === 'false' || process.env.MONGODB_TLS_ALLOW_INVALID === 'true') {
    clientOptions.tlsAllowInvalidCertificates = true;
  }

  client = new MongoClient(connectionString, clientOptions);
  await client.connect();
  database = client.db(process.env.MONGODB_DB || undefined);
  await ensureIndexes();
  await migrateLegacyContent();
  return database;
}

export async function getSiteContent() {
  if (!database) return readLegacyContent();
  const content = await database.collection('content').findOne({ key: 'site-content' });
  return content?.value || readLegacyContent();
}

export async function saveContentToDb(content) {
  if (!database) throw new Error('MongoDB is not initialized');

  await database.collection('content').updateOne(
    { key: 'site-content' },
    { $set: { value: content, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );
  return content;
}

export async function loadContentFromDb() {
  return getSiteContent();
}

export async function saveMessageToDb(messagePayload) {
  if (!database) throw new Error('MongoDB is not initialized');
  const createdAt = new Date();
  const result = await database.collection('messages').insertOne({ payload: messagePayload, createdAt });
  return { id: result.insertedId.toString(), createdAt };
}

function normalizeMessage(document) {
  if (!document) return null;
  return { id: document._id.toString(), payload: document.payload || {}, created_at: document.createdAt };
}

export async function loadMessagesFromDb(limit = 50) {
  if (!database) throw new Error('MongoDB is not initialized');
  const messages = await database.collection('messages').find({}).sort({ createdAt: -1 }).limit(limit).toArray();
  return messages.map(normalizeMessage);
}

export async function getMessageFromDb(id) {
  if (!database) throw new Error('MongoDB is not initialized');
  const objectId = getObjectId(id);
  return objectId ? normalizeMessage(await database.collection('messages').findOne({ _id: objectId })) : null;
}

export async function updateMessageInDb(id, flags) {
  if (!database) throw new Error('MongoDB is not initialized');
  const objectId = getObjectId(id);
  if (!objectId) return null;

  const updates = Object.fromEntries(Object.entries(flags).map(([key, value]) => [`payload.${key}`, value]));
  const result = await database.collection('messages').findOneAndUpdate(
    { _id: objectId },
    { $set: updates },
    { returnDocument: 'after' },
  );
  return normalizeMessage(result);
}

export async function deleteMessageFromDb(id) {
  if (!database) throw new Error('MongoDB is not initialized');
  const objectId = getObjectId(id);
  if (!objectId) return null;
  const result = await database.collection('messages').deleteOne({ _id: objectId });
  return result.deletedCount ? { id } : null;
}

export async function closeDb() {
  if (!client) return;
  await client.close();
  client = null;
  database = null;
}

export function getDbPool() {
  return database;
}

async function readChapterLikesFile() {
  try {
    const raw = await fs.readFile(chapterLikesFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    return [];
  }
}

async function writeChapterLikesFile(data) {
  await fs.mkdir(path.dirname(chapterLikesFilePath), { recursive: true });
  await fs.writeFile(chapterLikesFilePath, JSON.stringify(data, null, 2), 'utf8');
}

async function readChapterCommentsFile() {
  try {
    const raw = await fs.readFile(chapterCommentsFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    return [];
  }
}

async function writeChapterCommentsFile(data) {
  await fs.mkdir(path.dirname(chapterCommentsFilePath), { recursive: true });
  await fs.writeFile(chapterCommentsFilePath, JSON.stringify(data, null, 2), 'utf8');
}

async function readCommentLikesFile() {
  try {
    const raw = await fs.readFile(commentLikesFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    return [];
  }
}

async function writeCommentLikesFile(data) {
  await fs.mkdir(path.dirname(commentLikesFilePath), { recursive: true });
  await fs.writeFile(commentLikesFilePath, JSON.stringify(data, null, 2), 'utf8');
}

async function readCommentReportsFile() {
  try {
    const raw = await fs.readFile(commentReportsFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    return [];
  }
}

async function writeCommentReportsFile(data) {
  await fs.mkdir(path.dirname(commentReportsFilePath), { recursive: true });
  await fs.writeFile(commentReportsFilePath, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeReport(document, extra = {}) {
  if (!document) return null;
  return {
    id: document._id ? document._id.toString() : (document.id || String(document.createdAt)),
    commentId: String(document.commentId),
    chapterKey: document.chapterKey || '',
    visitorId: document.visitorId || null,
    reason: document.reason || 'Other',
    details: document.details || '',
    status: document.status || 'pending',
    createdAt: document.createdAt,
    resolvedAt: document.resolvedAt || null,
    resolvedBy: document.resolvedBy || null,
    ...extra,
  };
}

export async function createCommentReportInDb({ commentId, chapterKey, visitorId, reason, details }) {
  const strCommentId = String(commentId);

  if (database) {
    const existing = await database.collection('comment_reports').findOne({ commentId: strCommentId, visitorId });
    if (existing) {
      return { alreadyReported: true, report: normalizeReport(existing) };
    }

    const now = new Date();
    const doc = {
      commentId: strCommentId,
      chapterKey: chapterKey || '',
      visitorId,
      reason: reason || 'Other',
      details: String(details || '').slice(0, 500),
      status: 'pending',
      createdAt: now,
    };

    const result = await database.collection('comment_reports').insertOne(doc);
    return { alreadyReported: false, report: normalizeReport({ _id: result.insertedId, ...doc }) };
  }

  const allReports = await readCommentReportsFile();
  const existing = allReports.find((r) => r.commentId === strCommentId && r.visitorId === visitorId);
  if (existing) {
    return { alreadyReported: true, report: normalizeReport(existing) };
  }

  const now = new Date().toISOString();
  const newReport = {
    id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    commentId: strCommentId,
    chapterKey: chapterKey || '',
    visitorId,
    reason: reason || 'Other',
    details: String(details || '').slice(0, 500),
    status: 'pending',
    createdAt: now,
  };

  allReports.unshift(newReport);
  await writeCommentReportsFile(allReports);
  return { alreadyReported: false, report: normalizeReport(newReport) };
}

export async function loadAdminCommentReportsFromDb({ status = 'all', limit = 100 } = {}) {
  if (database) {
    const query = status && status !== 'all' ? { status } : {};
    const reportsDocs = await database.collection('comment_reports').find(query).sort({ createdAt: -1 }).limit(limit).toArray();

    const commentIds = Array.from(new Set(reportsDocs.map((r) => String(r.commentId))));
    const commentsList = commentIds.length > 0
      ? await Promise.all(commentIds.map((cid) => getChapterCommentByIdFromDb(cid)))
      : [];
    const commentsMap = new Map(commentsList.filter(Boolean).map((c) => [c.id, c]));

    // Aggregate report counts per commentId
    const counts = commentIds.length > 0
      ? await database.collection('comment_reports').aggregate([
          { $match: { commentId: { $in: commentIds } } },
          { $group: { _id: '$commentId', count: { $sum: 1 } } },
        ]).toArray()
      : [];
    const countsMap = new Map(counts.map((item) => [item._id, item.count]));

    return reportsDocs.map((doc) => {
      const cid = String(doc.commentId);
      return normalizeReport(doc, {
        reportCount: countsMap.get(cid) || 1,
        comment: commentsMap.get(cid) || null,
      });
    });
  }

  let allReports = await readCommentReportsFile();
  if (status && status !== 'all') {
    allReports = allReports.filter((r) => r.status === status);
  }
  const sliced = allReports.slice(0, limit);

  const allComments = await readChapterCommentsFile();
  const commentsMap = new Map(allComments.map((c) => [c.id || String(c.createdAt), normalizeComment(c)]));

  const totalReportsAll = await readCommentReportsFile();
  const countsMap = new Map();
  for (const rep of totalReportsAll) {
    countsMap.set(rep.commentId, (countsMap.get(rep.commentId) || 0) + 1);
  }

  return sliced.map((rep) => {
    const cid = String(rep.commentId);
    return normalizeReport(rep, {
      reportCount: countsMap.get(cid) || 1,
      comment: commentsMap.get(cid) || null,
    });
  });
}

export async function updateCommentReportStatusInDb(reportId, status, { resolvedBy = 'admin' } = {}) {
  if (database) {
    const objectId = getObjectId(reportId);
    const query = objectId ? { _id: objectId } : { id: reportId };
    const now = new Date();
    const updated = await database.collection('comment_reports').findOneAndUpdate(
      query,
      { $set: { status, resolvedAt: now, resolvedBy, updatedAt: now } },
      { returnDocument: 'after' },
    );
    return updated ? normalizeReport(updated) : null;
  }

  const allReports = await readCommentReportsFile();
  const index = allReports.findIndex((r) => r.id === reportId);
  if (index === -1) return null;

  const now = new Date().toISOString();
  allReports[index] = {
    ...allReports[index],
    status,
    resolvedAt: now,
    resolvedBy,
  };
  await writeCommentReportsFile(allReports);
  return normalizeReport(allReports[index]);
}

export async function getCommentLikeFromDb(commentId, visitorId) {
  if (database) {
    const [likeCount, visitorLike] = await Promise.all([
      database.collection('comment_likes').countDocuments({ commentId: String(commentId) }),
      visitorId ? database.collection('comment_likes').findOne({ commentId: String(commentId), visitorId }, { projection: { _id: 1 } }) : null,
    ]);
    return { likeCount, liked: Boolean(visitorLike) };
  }

  const allLikes = await readCommentLikesFile();
  const commentLikes = allLikes.filter((l) => l.commentId === String(commentId));
  const liked = visitorId ? commentLikes.some((l) => l.visitorId === visitorId) : false;
  return { likeCount: commentLikes.length, liked };
}

export async function addCommentLikeToDb(commentId, visitorId) {
  if (database) {
    await database.collection('comment_likes').updateOne(
      { commentId: String(commentId), visitorId },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
    return getCommentLikeFromDb(commentId, visitorId);
  }

  const allLikes = await readCommentLikesFile();
  const exists = allLikes.some((l) => l.commentId === String(commentId) && l.visitorId === visitorId);
  if (!exists) {
    allLikes.push({ commentId: String(commentId), visitorId, createdAt: new Date().toISOString() });
    await writeCommentLikesFile(allLikes);
  }
  return getCommentLikeFromDb(commentId, visitorId);
}

export async function removeCommentLikeFromDb(commentId, visitorId) {
  if (database) {
    await database.collection('comment_likes').deleteOne({ commentId: String(commentId), visitorId });
    return getCommentLikeFromDb(commentId, visitorId);
  }

  let allLikes = await readCommentLikesFile();
  allLikes = allLikes.filter((l) => !(l.commentId === String(commentId) && l.visitorId === visitorId));
  await writeCommentLikesFile(allLikes);
  return getCommentLikeFromDb(commentId, visitorId);
}

export async function getChapterEngagementFromDb(chapterKey, visitorId) {
  if (database) {
    const [likeCount, commentCount, replyCount, visitorLike] = await Promise.all([
      database.collection('chapter_likes').countDocuments({ chapterKey }),
      database.collection('chapter_comments').countDocuments({ chapterKey, status: { $ne: 'deleted' } }),
      database.collection('chapter_comments').countDocuments({ chapterKey, status: { $ne: 'deleted' }, parentId: { $ne: null } }),
      database.collection('chapter_likes').findOne({ chapterKey, visitorId }, { projection: { _id: 1 } }),
    ]);
    return { likeCount, commentCount, replyCount, liked: Boolean(visitorLike) };
  }

  const [allLikes, allComments] = await Promise.all([
    readChapterLikesFile(),
    readChapterCommentsFile(),
  ]);
  const likeCount = allLikes.filter((l) => l.chapterKey === chapterKey).length;
  const activeComments = allComments.filter((c) => c.chapterKey === chapterKey && c.status !== 'deleted');
  const commentCount = activeComments.length;
  const replyCount = activeComments.filter((c) => Boolean(c.parentId)).length;
  const liked = visitorId ? allLikes.some((l) => l.chapterKey === chapterKey && l.visitorId === visitorId) : false;
  return { likeCount, commentCount, replyCount, liked };
}

export async function addChapterLikeToDb(chapterKey, visitorId) {
  if (database) {
    await database.collection('chapter_likes').updateOne(
      { chapterKey, visitorId },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
    return getChapterEngagementFromDb(chapterKey, visitorId);
  }

  const allLikes = await readChapterLikesFile();
  const exists = allLikes.some((l) => l.chapterKey === chapterKey && l.visitorId === visitorId);
  if (!exists) {
    allLikes.push({ chapterKey, visitorId, createdAt: new Date().toISOString() });
    await writeChapterLikesFile(allLikes);
  }
  return getChapterEngagementFromDb(chapterKey, visitorId);
}

export async function removeChapterLikeFromDb(chapterKey, visitorId) {
  if (database) {
    await database.collection('chapter_likes').deleteOne({ chapterKey, visitorId });
    return getChapterEngagementFromDb(chapterKey, visitorId);
  }

  let allLikes = await readChapterLikesFile();
  allLikes = allLikes.filter((l) => !(l.chapterKey === chapterKey && l.visitorId === visitorId));
  await writeChapterLikesFile(allLikes);
  return getChapterEngagementFromDb(chapterKey, visitorId);
}

function normalizeComment(document, { likeCount = 0, liked = false, replies = [] } = {}) {
  if (!document) return null;
  return {
    id: document._id ? document._id.toString() : (document.id || String(document.createdAt)),
    chapterKey: document.chapterKey,
    displayName: document.displayName,
    content: document.content,
    status: document.status,
    parentId: document.parentId ? String(document.parentId) : null,
    replyToName: document.replyToName || null,
    likeCount,
    liked,
    replies,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export async function getChapterCommentByIdFromDb(id) {
  if (database) {
    const objectId = getObjectId(id);
    const query = objectId ? { _id: objectId } : { id };
    const doc = await database.collection('chapter_comments').findOne(query);
    return doc ? normalizeComment(doc) : null;
  }

  const allComments = await readChapterCommentsFile();
  const doc = allComments.find((c) => c.id === id);
  return doc ? normalizeComment(doc) : null;
}

export async function createChapterCommentInDb(comment) {
  let parentId = comment.parentId ? String(comment.parentId) : null;
  let replyToName = comment.replyToName || null;

  if (parentId) {
    const parentComment = await getChapterCommentByIdFromDb(parentId);
    if (parentComment) {
      replyToName = parentComment.displayName || null;
    }
  }

  if (database) {
    const now = new Date();
    const doc = {
      ...comment,
      parentId,
      replyToName,
      status: 'published',
      createdAt: now,
      updatedAt: now,
    };
    const result = await database.collection('chapter_comments').insertOne(doc);
    return normalizeComment({ _id: result.insertedId, ...doc });
  }

  const allComments = await readChapterCommentsFile();
  const now = new Date().toISOString();
  const newComment = {
    id: `comm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    ...comment,
    parentId,
    replyToName,
    status: 'published',
    createdAt: now,
    updatedAt: now,
  };
  allComments.unshift(newComment);
  await writeChapterCommentsFile(allComments);
  return normalizeComment(newComment);
}

export async function loadChapterCommentsFromDb(chapterKey, { limit = 10, offset = 0, visitorId = null } = {}) {
  if (database) {
    // Top-level comments query (published immediately)
    const topLevelQuery = {
      chapterKey,
      status: { $ne: 'deleted' },
      $or: [{ parentId: null }, { parentId: { $exists: false } }, { parentId: '' }],
    };

    const topCommentsDocs = await database.collection('chapter_comments')
      .find(topLevelQuery)
      .sort({ createdAt: -1, _id: -1 })
      .skip(offset)
      .limit(limit + 1)
      .toArray();

    const hasMore = topCommentsDocs.length > limit;
    const topComments = topCommentsDocs.slice(0, limit);
    const topIds = topComments.map((c) => c._id.toString());

    // Fetch replies for these top-level comments
    const repliesDocs = topIds.length > 0
      ? await database.collection('chapter_comments').find({
          chapterKey,
          status: { $ne: 'deleted' },
          parentId: { $in: topIds },
        }).sort({ createdAt: 1, _id: 1 }).toArray()
      : [];

    // Collect all IDs for comment likes aggregation
    const allCommentIds = [...topIds, ...repliesDocs.map((r) => r._id.toString())];

    const [likeCounts, visitorLikes] = await Promise.all([
      allCommentIds.length > 0
        ? database.collection('comment_likes').aggregate([
            { $match: { commentId: { $in: allCommentIds } } },
            { $group: { _id: '$commentId', count: { $sum: 1 } } },
          ]).toArray()
        : [],
      visitorId && allCommentIds.length > 0
        ? database.collection('comment_likes').find({ commentId: { $in: allCommentIds }, visitorId }, { projection: { commentId: 1 } }).toArray()
        : [],
    ]);

    const likesMap = new Map(likeCounts.map((item) => [item._id, item.count]));
    const visitorLikedSet = new Set(visitorLikes.map((item) => item.commentId));

    // Group replies by parentId
    const repliesByParent = new Map();
    for (const replyDoc of repliesDocs) {
      const pid = String(replyDoc.parentId);
      if (!repliesByParent.has(pid)) repliesByParent.set(pid, []);
      const rId = replyDoc._id.toString();
      repliesByParent.get(pid).push(
        normalizeComment(replyDoc, {
          likeCount: likesMap.get(rId) || 0,
          liked: visitorLikedSet.has(rId),
        }),
      );
    }

    const formattedComments = topComments.map((topDoc) => {
      const cId = topDoc._id.toString();
      return normalizeComment(topDoc, {
        likeCount: likesMap.get(cId) || 0,
        liked: visitorLikedSet.has(cId),
        replies: repliesByParent.get(cId) || [],
      });
    });

    return { comments: formattedComments, hasMore, nextOffset: offset + limit };
  }

  // File fallback
  const [allComments, allCommentLikes] = await Promise.all([
    readChapterCommentsFile(),
    readCommentLikesFile(),
  ]);

  const likesMap = new Map();
  for (const like of allCommentLikes) {
    likesMap.set(like.commentId, (likesMap.get(like.commentId) || 0) + 1);
  }
  const visitorLikedSet = new Set(
    visitorId ? allCommentLikes.filter((l) => l.visitorId === visitorId).map((l) => l.commentId) : [],
  );

  const activeComments = allComments.filter((c) => c.chapterKey === chapterKey && c.status !== 'deleted');
  const topLevel = activeComments.filter((c) => !c.parentId);
  const paged = topLevel.slice(offset, offset + limit);
  const hasMore = topLevel.length > offset + limit;

  const formattedComments = paged.map((topDoc) => {
    const cId = topDoc.id || String(topDoc.createdAt);
    const replies = activeComments
      .filter((r) => String(r.parentId) === cId)
      .map((r) => {
        const rId = r.id || String(r.createdAt);
        return normalizeComment(r, {
          likeCount: likesMap.get(rId) || 0,
          liked: visitorLikedSet.has(rId),
        });
      });

    return normalizeComment(topDoc, {
      likeCount: likesMap.get(cId) || 0,
      liked: visitorLikedSet.has(cId),
      replies,
    });
  });

  return { comments: formattedComments, hasMore, nextOffset: offset + limit };
}

export async function loadAdminCommentsFromDb({ status, limit = 50 } = {}) {
  if (database) {
    const query = status && status !== 'all' ? { status } : { status: { $ne: 'deleted' } };
    return (await database.collection('chapter_comments').find(query).sort({ createdAt: -1, _id: -1 }).limit(limit).toArray()).map((doc) => normalizeComment(doc));
  }

  let allComments = await readChapterCommentsFile();
  if (status && status !== 'all') {
    allComments = allComments.filter((c) => c.status === status);
  } else {
    allComments = allComments.filter((c) => c.status !== 'deleted');
  }
  return allComments.slice(0, limit).map((doc) => normalizeComment(doc));
}

export async function updateChapterCommentStatusInDb(id, status) {
  if (database) {
    const objectId = getObjectId(id);
    const query = objectId ? { _id: objectId } : { id };
    return normalizeComment(await database.collection('chapter_comments').findOneAndUpdate(
      query,
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: 'after' },
    ));
  }

  const allComments = await readChapterCommentsFile();
  const index = allComments.findIndex((c) => c.id === id);
  if (index === -1) return null;
  allComments[index].status = status;
  allComments[index].updatedAt = new Date().toISOString();
  await writeChapterCommentsFile(allComments);
  return normalizeComment(allComments[index]);
}

export async function deleteChapterCommentFromDb(id) {
  if (database) {
    const objectId = getObjectId(id);
    const query = objectId ? { _id: objectId } : { id };
    const doc = await database.collection('chapter_comments').findOne(query);
    if (!doc) return false;
    const docId = doc._id.toString();

    // Delete child replies, comment likes, and mark reports as resolved
    await Promise.all([
      database.collection('chapter_comments').deleteMany({ parentId: docId }),
      database.collection('comment_likes').deleteMany({ commentId: docId }),
      database.collection('comment_reports').updateMany(
        { commentId: docId },
        { $set: { status: 'resolved', resolvedAt: new Date(), resolvedBy: 'admin' } },
      ),
      database.collection('chapter_comments').deleteOne({ _id: doc._id }),
    ]);
    return true;
  }

  let allComments = await readChapterCommentsFile();
  const initialLength = allComments.length;
  allComments = allComments.filter((c) => c.id !== id && c.parentId !== id);
  await writeChapterCommentsFile(allComments);

  let allLikes = await readCommentLikesFile();
  allLikes = allLikes.filter((l) => l.commentId !== id);
  await writeCommentLikesFile(allLikes);

  let allReports = await readCommentReportsFile();
  let reportsChanged = false;
  const now = new Date().toISOString();
  allReports = allReports.map((r) => {
    if (r.commentId === id) {
      reportsChanged = true;
      return { ...r, status: 'resolved', resolvedAt: now, resolvedBy: 'admin' };
    }
    return r;
  });
  if (reportsChanged) {
    await writeCommentReportsFile(allReports);
  }

  return allComments.length < initialLength;
}

async function readCharactersFile() {
  try {
    const raw = await fs.readFile(charactersFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    return [];
  }
}

async function writeCharactersFile(data) {
  await fs.mkdir(path.dirname(charactersFilePath), { recursive: true });
  await fs.writeFile(charactersFilePath, JSON.stringify(data, null, 2), 'utf8');
}

async function readCharacterLikesFile() {
  try {
    const raw = await fs.readFile(characterLikesFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    return [];
  }
}

async function writeCharacterLikesFile(data) {
  await fs.mkdir(path.dirname(characterLikesFilePath), { recursive: true });
  await fs.writeFile(characterLikesFilePath, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeCharacter(document, { includePrivate = false, likeCount = 0, liked = false } = {}) {
  if (!document) return null;
  const character = {
    ...document,
    id: document._id ? document._id.toString() : (document.id || document.slug),
    likeCount,
    liked,
  };
  delete character._id;
  if (!includePrivate) {
    delete character.createdAt;
    delete character.updatedAt;
    delete character.publicationState;
  }
  return character;
}

async function addCharacterLikeCounts(characters, options) {
  if (!characters.length) return [];
  if (database) {
    const counts = await database.collection('character_likes').aggregate([
      { $match: { characterId: { $in: characters.map((character) => (character._id ? character._id.toString() : (character.id || ''))) } } },
      { $group: { _id: '$characterId', count: { $sum: 1 } } },
    ]).toArray();
    const byId = new Map(counts.map((item) => [item._id, item.count]));
    return characters.map((character) => {
      const charId = character._id ? character._id.toString() : (character.id || '');
      return normalizeCharacter(character, { ...options, likeCount: byId.get(charId) || 0 });
    });
  }

  const allLikes = await readCharacterLikesFile();
  const countsById = new Map();
  for (const like of allLikes) {
    countsById.set(like.characterId, (countsById.get(like.characterId) || 0) + 1);
  }
  return characters.map((character) => {
    const charId = character.id || character.slug;
    return normalizeCharacter(character, { ...options, likeCount: countsById.get(charId) || 0 });
  });
}

export async function listCharactersFromDb({ publicOnly = false, search, characterType, status, featured } = {}) {
  if (database) {
    const query = publicOnly ? { publicationState: 'published' } : {};
    if (characterType && characterType !== 'all') {
      query.characterType = characterType;
    }
    if (status && status !== 'all') {
      query.status = status;
    }
    if (featured !== undefined) {
      query.featured = Boolean(featured);
    }
    if (search) {
      const safeSearch = String(search).trim();
      const escaped = safeSearch.replace(/[.*+?^${}()|[\]\\]/g, (m) => '\\' + m);
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { name: { $regex: regex } },
        { displayName: { $regex: regex } },
        { title: { $regex: regex } },
        { aliases: { $regex: regex } },
      ];
    }
    const characters = await database.collection('characters').find(query).sort({ featured: -1, name: 1 }).toArray();
    return addCharacterLikeCounts(characters, { includePrivate: !publicOnly });
  }

  let characters = await readCharactersFile();
  if (publicOnly) {
    characters = characters.filter((c) => c.publicationState === 'published');
  }
  if (characterType && characterType !== 'all') {
    characters = characters.filter((c) => String(c.characterType || '').toLowerCase() === String(characterType).toLowerCase());
  }
  if (status && status !== 'all') {
    characters = characters.filter((c) => String(c.status || '').toLowerCase() === String(status).toLowerCase());
  }
  if (featured !== undefined) {
    characters = characters.filter((c) => Boolean(c.featured) === Boolean(featured));
  }
  if (search) {
    const term = String(search).trim().toLowerCase();
    characters = characters.filter((c) => {
      const matchName = String(c.name || '').toLowerCase().includes(term);
      const matchDisplay = String(c.displayName || '').toLowerCase().includes(term);
      const matchTitle = String(c.title || '').toLowerCase().includes(term);
      const matchAliases = Array.isArray(c.aliases) && c.aliases.some((a) => String(a).toLowerCase().includes(term));
      return matchName || matchDisplay || matchTitle || matchAliases;
    });
  }
  characters.sort((a, b) => {
    if (Boolean(b.featured) !== Boolean(a.featured)) {
      return b.featured ? 1 : -1;
    }
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  return addCharacterLikeCounts(characters, { includePrivate: !publicOnly });
}

export async function getCharacterFromDb(slug, { publicOnly = false, visitorId = null } = {}) {
  if (database) {
    const document = await database.collection('characters').findOne(publicOnly ? { slug, publicationState: 'published' } : { slug });
    if (!document) return null;
    const charId = document._id.toString();
    const [likeCount, visitorLike] = await Promise.all([
      database.collection('character_likes').countDocuments({ characterId: charId }),
      visitorId ? database.collection('character_likes').findOne({ characterId: charId, visitorId }, { projection: { _id: 1 } }) : null,
    ]);
    return normalizeCharacter(document, { includePrivate: !publicOnly, likeCount, liked: Boolean(visitorLike) });
  }

  const characters = await readCharactersFile();
  const document = characters.find((c) => c.slug === slug && (!publicOnly || c.publicationState === 'published'));
  if (!document) return null;
  const charId = document.id || document.slug;
  const allLikes = await readCharacterLikesFile();
  const likeCount = allLikes.filter((l) => l.characterId === charId).length;
  const liked = visitorId ? allLikes.some((l) => l.characterId === charId && l.visitorId === visitorId) : false;
  return normalizeCharacter(document, { includePrivate: !publicOnly, likeCount, liked });
}

export async function createCharacterInDb(character) {
  let baseSlug = slugify(character.slug || character.name);
  let slug = baseSlug;
  let counter = 1;

  if (database) {
    while (await database.collection('characters').findOne({ slug })) {
      slug = `${baseSlug}-${++counter}`;
    }
    const now = new Date();
    const result = await database.collection('characters').insertOne({
      ...character,
      slug,
      createdAt: now,
      updatedAt: now,
    });
    return getCharacterByIdFromDb(result.insertedId.toString());
  }

  const characters = await readCharactersFile();
  while (characters.some((c) => c.slug === slug)) {
    slug = `${baseSlug}-${++counter}`;
  }
  const id = `char-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();
  const newCharacter = {
    ...character,
    id,
    slug,
    createdAt: now,
    updatedAt: now,
  };
  characters.push(newCharacter);
  await writeCharactersFile(characters);
  return getCharacterByIdFromDb(id);
}

export async function getCharacterByIdFromDb(id, { includePrivate = true, visitorId = null } = {}) {
  if (database) {
    const objectId = getObjectId(id);
    const document = objectId
      ? await database.collection('characters').findOne({ _id: objectId })
      : await database.collection('characters').findOne({ slug: id });
    if (!document) return null;
    const charId = document._id.toString();
    const [likeCount, visitorLike] = await Promise.all([
      database.collection('character_likes').countDocuments({ characterId: charId }),
      visitorId ? database.collection('character_likes').findOne({ characterId: charId, visitorId }, { projection: { _id: 1 } }) : null,
    ]);
    return normalizeCharacter(document, { includePrivate, likeCount, liked: Boolean(visitorLike) });
  }

  const characters = await readCharactersFile();
  const document = characters.find((c) => c.id === id || c.slug === id);
  if (!document) return null;
  const charId = document.id || document.slug;
  const allLikes = await readCharacterLikesFile();
  const likeCount = allLikes.filter((l) => l.characterId === charId).length;
  const liked = visitorId ? allLikes.some((l) => l.characterId === charId && l.visitorId === visitorId) : false;
  return normalizeCharacter(document, { includePrivate, likeCount, liked });
}

export async function updateCharacterInDb(id, character) {
  if (database) {
    const objectId = getObjectId(id);
    const query = objectId ? { _id: objectId } : { slug: id };
    const existing = await database.collection('characters').findOne(query);
    if (!existing) return null;

    let nextSlug = character.slug ? slugify(character.slug) : existing.slug;
    if (nextSlug !== existing.slug) {
      let candidate = nextSlug;
      let counter = 1;
      while (await database.collection('characters').findOne({ slug: candidate, _id: { $ne: existing._id } })) {
        candidate = `${nextSlug}-${++counter}`;
      }
      nextSlug = candidate;
    }

    await database.collection('characters').updateOne(query, {
      $set: {
        ...character,
        slug: nextSlug,
        updatedAt: new Date(),
      },
    });
    return getCharacterByIdFromDb(existing._id.toString());
  }

  const characters = await readCharactersFile();
  const index = characters.findIndex((c) => c.id === id || c.slug === id);
  if (index === -1) return null;

  const existing = characters[index];
  let nextSlug = character.slug ? slugify(character.slug) : existing.slug;
  if (nextSlug !== existing.slug) {
    let candidate = nextSlug;
    let counter = 1;
    while (characters.some((c, i) => i !== index && c.slug === candidate)) {
      candidate = `${nextSlug}-${++counter}`;
    }
    nextSlug = candidate;
  }

  const updated = {
    ...existing,
    ...character,
    id: existing.id,
    slug: nextSlug,
    updatedAt: new Date().toISOString(),
  };
  characters[index] = updated;
  await writeCharactersFile(characters);
  return getCharacterByIdFromDb(existing.id);
}

export async function deleteCharacterFromDb(id) {
  if (database) {
    const objectId = getObjectId(id);
    const query = objectId ? { _id: objectId } : { slug: id };
    const existing = await database.collection('characters').findOne(query);
    if (!existing) return false;
    const charId = existing._id.toString();
    await database.collection('character_likes').deleteMany({ characterId: charId });
    return (await database.collection('characters').deleteOne({ _id: existing._id })).deletedCount > 0;
  }

  const characters = await readCharactersFile();
  const index = characters.findIndex((c) => c.id === id || c.slug === id);
  if (index === -1) return false;
  const charId = characters[index].id || characters[index].slug;
  characters.splice(index, 1);
  await writeCharactersFile(characters);

  const allLikes = await readCharacterLikesFile();
  const filteredLikes = allLikes.filter((l) => l.characterId !== charId);
  await writeCharacterLikesFile(filteredLikes);
  return true;
}

export async function getCharacterLikeFromDb(characterId, visitorId) {
  if (database) {
    const [likeCount, visitorLike] = await Promise.all([
      database.collection('character_likes').countDocuments({ characterId: String(characterId) }),
      visitorId ? database.collection('character_likes').findOne({ characterId: String(characterId), visitorId }, { projection: { _id: 1 } }) : null,
    ]);
    return { likeCount, liked: Boolean(visitorLike) };
  }

  const allLikes = await readCharacterLikesFile();
  const charLikes = allLikes.filter((l) => l.characterId === String(characterId));
  const liked = visitorId ? charLikes.some((l) => l.visitorId === visitorId) : false;
  return { likeCount: charLikes.length, liked };
}

export async function addCharacterLikeToDb(characterId, visitorId) {
  if (database) {
    await database.collection('character_likes').updateOne(
      { characterId: String(characterId), visitorId },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
    return getCharacterLikeFromDb(characterId, visitorId);
  }

  const allLikes = await readCharacterLikesFile();
  const exists = allLikes.some((l) => l.characterId === String(characterId) && l.visitorId === visitorId);
  if (!exists) {
    allLikes.push({
      characterId: String(characterId),
      visitorId,
      createdAt: new Date().toISOString(),
    });
    await writeCharacterLikesFile(allLikes);
  }
  return getCharacterLikeFromDb(characterId, visitorId);
}

export async function removeCharacterLikeFromDb(characterId, visitorId) {
  if (database) {
    await database.collection('character_likes').deleteOne({ characterId: String(characterId), visitorId });
    return getCharacterLikeFromDb(characterId, visitorId);
  }

  let allLikes = await readCharacterLikesFile();
  allLikes = allLikes.filter((l) => !(l.characterId === String(characterId) && l.visitorId === visitorId));
  await writeCharacterLikesFile(allLikes);
  return getCharacterLikeFromDb(characterId, visitorId);
}
