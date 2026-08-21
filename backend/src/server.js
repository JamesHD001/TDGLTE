import crypto from 'crypto';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mysticPenHDContent } from '../src/data/novelData.js';
import {
  initDb,
  loadContentFromDb,
  saveContentToDb,
  saveMessageToDb,
  loadMessagesFromDb,
  getMessageFromDb,
  updateMessageInDb,
  deleteMessageFromDb,
  getChapterEngagementFromDb,
  addChapterLikeToDb,
  removeChapterLikeFromDb,
  createChapterCommentInDb,
  loadChapterCommentsFromDb,
  loadAdminCommentsFromDb,
  updateChapterCommentStatusInDb,
  deleteChapterCommentFromDb,
  getChapterCommentByIdFromDb,
  getCommentLikeFromDb,
  addCommentLikeToDb,
  removeCommentLikeFromDb,
  createCommentReportInDb,
  loadAdminCommentReportsFromDb,
  updateCommentReportStatusInDb,
  listCharactersFromDb,
  getCharacterFromDb,
  getCharacterByIdFromDb,
  createCharacterInDb,
  updateCharacterInDb,
  deleteCharacterFromDb,
  getCharacterLikeFromDb,
  addCharacterLikeToDb,
  removeCharacterLikeFromDb,
  slugify,
} from './db.js';
import { censorContent } from './censor.js';
import admin from 'firebase-admin';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataFilePath = path.join(__dirname, 'data', 'content.json');
let adminUsername = process.env.ADMIN_USERNAME;
let adminPassword = process.env.ADMIN_PASSWORD;
const clientOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const sessionSecret = process.env.SESSION_SECRET || 'mysticpenhd-development-secret-change-me';
const awsRegion = process.env.AWS_REGION;
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const s3BucketName = process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET;
const hasS3Config = Boolean(awsRegion && awsAccessKeyId && awsSecretAccessKey && s3BucketName);

let hasAdminCredentials = Boolean(adminUsername && adminPassword);

if (!hasAdminCredentials) {
  console.warn('Admin authentication is not configured. You can set ADMIN_USERNAME and ADMIN_PASSWORD environment variables, or use the development setup endpoint to initialize credentials (not allowed in production).');
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || clientOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
);

function timingSafeEquals(candidate, expected) {
  if (typeof candidate !== 'string' || typeof expected !== 'string') {
    return false;
  }

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  if (candidateBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
}

function requireAuthentication(request, response, next) {
  if (!request.session.user) {
    response.status(401).json({ error: 'Authentication required.' });
    return;
  }

  next();
}

function requireAdmin(request, response, next) {
  if (!request.session.user || request.session.user.role !== 'admin') {
    response.status(403).json({ error: 'Administrator access required.' });
    return;
  }

  next();
}

const engagementRateLimits = new Map();

function getCookie(request, name) {
  const cookie = request.headers.cookie || '';
  const match = cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function getVisitorId(request, response) {
  let visitorId = getCookie(request, 'mysticpenhd_visitor');
  if (!visitorId || !/^[a-f0-9-]{36}$/i.test(visitorId)) {
    visitorId = crypto.randomUUID();
    response.cookie('mysticpenhd_visitor', visitorId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 365,
    });
  }
  return visitorId;
}

function enforceEngagementRateLimit(request, response, action, maxRequests, windowMs) {
  const key = `${action}:${request.ip}:${getCookie(request, 'mysticpenhd_visitor') || 'new'}`;
  const now = Date.now();
  const recent = (engagementRateLimits.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= maxRequests) {
    response.status(429).json({ error: 'Please wait before trying again.' });
    return false;
  }
  recent.push(now);
  engagementRateLimits.set(key, recent);
  return true;
}

// Legacy file-based persistence (used when DATABASE_URL is not provided)
async function ensureDataFile() {
  await fs.mkdir(path.dirname(dataFilePath), { recursive: true });

  try {
    await fs.access(dataFilePath);
  } catch {
    await fs.writeFile(dataFilePath, JSON.stringify(mysticPenHDContent, null, 2), 'utf8');
  }
}

async function loadContentFile() {
  await ensureDataFile();
  const raw = await fs.readFile(dataFilePath, 'utf8');
  const content = JSON.parse(raw);

  // Ensure lore items have stable slugs for file-based persistence
  if (Array.isArray(content.books)) {
    for (const book of content.books) {
      const seen = new Set();
      book.lore = (book.lore || []).map((l, idx) => {
        const title = l.title || `Document ${idx + 1}`;
        let base = slugify(`${book.slug || 'book'}-${title}`);
        let slug = base;
        let counter = 1;
        while (seen.has(slug)) {
          slug = `${base}-${counter++}`;
        }
        seen.add(slug);
        return { ...l, slug };
      });
    }
  }

  return content;
}

async function saveContentFile(content) {
  await fs.writeFile(dataFilePath, JSON.stringify(content, null, 2), 'utf8');
  return content;
}

// Abstraction: choose DB-backed functions when DATABASE_URL is present
let usingDb = false;

async function loadContent() {
  if (usingDb) {
    const content = await loadContentFromDb();
    if (content) return content;
    // Fall back to file if DB unexpectedly empty
  }
  return loadContentFile();
}

async function saveContent(content) {
  if (usingDb) {
    return saveContentToDb(content);
  }
  return saveContentFile(content);
}

async function resolveChapterKey(chapterKey) {
  const [bookSlug, chapterSlug] = String(chapterKey || '').split(':');
  if (!bookSlug || !chapterSlug || !/^[a-z0-9-]+$/i.test(bookSlug) || !/^[a-z0-9-]+$/i.test(chapterSlug)) return null;
  const content = await loadContent();
  const book = (content.books || []).find((item) => item.slug === bookSlug);
  const chapter = book?.chapters?.find((item) => item.slug === chapterSlug);
  return chapter ? `${bookSlug}:${chapterSlug}` : null;
}

function requireEngagementDatabase(_response) {
  return true;
}

app.get('/api/chapters/:chapterKey/engagement', async (request, response) => {
  try {
    if (!requireEngagementDatabase(response)) return;
    const chapterKey = await resolveChapterKey(request.params.chapterKey);
    if (!chapterKey) return response.status(404).json({ error: 'Chapter not found.' });
    response.json(await getChapterEngagementFromDb(chapterKey, getVisitorId(request, response)));
  } catch {
    response.status(500).json({ error: 'Unable to load chapter engagement.' });
  }
});

app.post('/api/chapters/:chapterKey/likes', async (request, response) => {
  try {
    if (!requireEngagementDatabase(response) || !enforceEngagementRateLimit(request, response, 'like', 30, 60_000)) return;
    const chapterKey = await resolveChapterKey(request.params.chapterKey);
    if (!chapterKey) return response.status(404).json({ error: 'Chapter not found.' });
    response.json(await addChapterLikeToDb(chapterKey, getVisitorId(request, response)));
  } catch {
    response.status(500).json({ error: 'Unable to like this chapter.' });
  }
});

app.delete('/api/chapters/:chapterKey/likes', async (request, response) => {
  try {
    if (!requireEngagementDatabase(response) || !enforceEngagementRateLimit(request, response, 'unlike', 30, 60_000)) return;
    const chapterKey = await resolveChapterKey(request.params.chapterKey);
    if (!chapterKey) return response.status(404).json({ error: 'Chapter not found.' });
    response.json(await removeChapterLikeFromDb(chapterKey, getVisitorId(request, response)));
  } catch {
    response.status(500).json({ error: 'Unable to update this like.' });
  }
});

app.get('/api/chapters/:chapterKey/comments', async (request, response) => {
  try {
    if (!requireEngagementDatabase(response)) return;
    const chapterKey = await resolveChapterKey(request.params.chapterKey);
    if (!chapterKey) return response.status(404).json({ error: 'Chapter not found.' });
    const limit = Math.min(20, Math.max(1, Number(request.query.limit) || 10));
    const offset = Math.max(0, Number(request.query.offset) || 0);
    const visitorId = getVisitorId(request, response);
    response.json(await loadChapterCommentsFromDb(chapterKey, { limit, offset, visitorId }));
  } catch {
    response.status(500).json({ error: 'Unable to load comments.' });
  }
});

app.post('/api/chapters/:chapterKey/comments', async (request, response) => {
  try {
    if (!requireEngagementDatabase(response) || !enforceEngagementRateLimit(request, response, 'comment', 5, 10 * 60_000)) return;
    const chapterKey = await resolveChapterKey(request.params.chapterKey);
    if (!chapterKey) return response.status(404).json({ error: 'Chapter not found.' });
    const rawDisplayName = String(request.body?.displayName || '').trim();
    const rawContent = String(request.body?.content || '').trim();
    const parentId = request.body?.parentId ? String(request.body.parentId).trim() : null;

    if (rawDisplayName.length < 2 || rawDisplayName.length > 60 || rawContent.length < 3 || rawContent.length > 2000) {
      return response.status(400).json({ error: 'Enter a name (2–60 characters) and a comment (3–2000 characters).' });
    }

    const { censoredText: displayName } = censorContent(rawDisplayName);
    const { censoredText: content } = censorContent(rawContent);

    if (parentId) {
      const parent = await getChapterCommentByIdFromDb(parentId);
      if (!parent || parent.chapterKey !== chapterKey) {
        return response.status(400).json({ error: 'Parent comment not found for this chapter.' });
      }
    }

    const comment = await createChapterCommentInDb({
      chapterKey,
      displayName,
      content,
      parentId,
      visitorId: getVisitorId(request, response),
    });
    response.status(201).json({ comment });
  } catch {
    response.status(500).json({ error: 'Unable to post your comment.' });
  }
});

// Reply to a specific comment
app.post('/api/comments/:id/replies', async (request, response) => {
  try {
    if (!requireEngagementDatabase(response) || !enforceEngagementRateLimit(request, response, 'comment_reply', 5, 10 * 60_000)) return;
    const parent = await getChapterCommentByIdFromDb(request.params.id);
    if (!parent) return response.status(404).json({ error: 'Parent comment not found.' });

    const rawDisplayName = String(request.body?.displayName || '').trim();
    const rawContent = String(request.body?.content || '').trim();

    if (rawDisplayName.length < 2 || rawDisplayName.length > 60 || rawContent.length < 3 || rawContent.length > 2000) {
      return response.status(400).json({ error: 'Enter a name (2–60 characters) and a reply (3–2000 characters).' });
    }

    const { censoredText: displayName } = censorContent(rawDisplayName);
    const { censoredText: content } = censorContent(rawContent);

    const reply = await createChapterCommentInDb({
      chapterKey: parent.chapterKey,
      displayName,
      content,
      parentId: parent.id,
      replyToName: parent.displayName,
      visitorId: getVisitorId(request, response),
    });
    response.status(201).json({ comment: reply });
  } catch {
    response.status(500).json({ error: 'Unable to post your reply.' });
  }
});

// Individual Comment Likes
app.get('/api/comments/:id/likes', async (request, response) => {
  try {
    const comment = await getChapterCommentByIdFromDb(request.params.id);
    if (!comment) return response.status(404).json({ error: 'Comment not found.' });
    const visitorId = getVisitorId(request, response);
    response.json(await getCommentLikeFromDb(comment.id, visitorId));
  } catch {
    response.status(500).json({ error: 'Unable to load comment likes.' });
  }
});
app.get('/api/comments/:id/like', (req, res) => res.redirect(307, `/api/comments/${req.params.id}/likes`));

app.post('/api/comments/:id/likes', async (request, response) => {
  try {
    if (!enforceEngagementRateLimit(request, response, 'comment_like', 30, 60_000)) return;
    const comment = await getChapterCommentByIdFromDb(request.params.id);
    if (!comment) return response.status(404).json({ error: 'Comment not found.' });
    const visitorId = getVisitorId(request, response);
    response.json(await addCommentLikeToDb(comment.id, visitorId));
  } catch {
    response.status(500).json({ error: 'Unable to like this comment.' });
  }
});
app.post('/api/comments/:id/like', async (request, response) => {
  try {
    if (!enforceEngagementRateLimit(request, response, 'comment_like', 30, 60_000)) return;
    const comment = await getChapterCommentByIdFromDb(request.params.id);
    if (!comment) return response.status(404).json({ error: 'Comment not found.' });
    const visitorId = getVisitorId(request, response);
    response.json(await addCommentLikeToDb(comment.id, visitorId));
  } catch {
    response.status(500).json({ error: 'Unable to like this comment.' });
  }
});

app.delete('/api/comments/:id/likes', async (request, response) => {
  try {
    if (!enforceEngagementRateLimit(request, response, 'comment_unlike', 30, 60_000)) return;
    const comment = await getChapterCommentByIdFromDb(request.params.id);
    if (!comment) return response.status(404).json({ error: 'Comment not found.' });
    const visitorId = getVisitorId(request, response);
    response.json(await removeCommentLikeFromDb(comment.id, visitorId));
  } catch {
    response.status(500).json({ error: 'Unable to update comment like.' });
  }
});
app.delete('/api/comments/:id/like', async (request, response) => {
  try {
    if (!enforceEngagementRateLimit(request, response, 'comment_unlike', 30, 60_000)) return;
    const comment = await getChapterCommentByIdFromDb(request.params.id);
    if (!comment) return response.status(404).json({ error: 'Comment not found.' });
    const visitorId = getVisitorId(request, response);
    response.json(await removeCommentLikeFromDb(comment.id, visitorId));
  } catch {
    response.status(500).json({ error: 'Unable to update comment like.' });
  }
});

// Visitor Comment & Reply Reporting
const ALLOWED_REPORT_REASONS = [
  'Spam',
  'Harassment or bullying',
  'Hate or abusive content',
  'Sexual or inappropriate content',
  'Threatening or violent content',
  'Other',
];

app.post('/api/comments/:id/reports', async (request, response) => {
  try {
    if (!enforceEngagementRateLimit(request, response, 'comment_report', 10, 60_000)) return;

    const comment = await getChapterCommentByIdFromDb(request.params.id);
    if (!comment || comment.status === 'deleted') {
      return response.status(404).json({ error: 'Comment not found or no longer available.' });
    }

    const rawReason = String(request.body?.reason || 'Other').trim();
    const reason = ALLOWED_REPORT_REASONS.includes(rawReason) ? rawReason : 'Other';
    const details = String(request.body?.details || '').trim().slice(0, 500);

    const visitorId = getVisitorId(request, response);
    const result = await createCommentReportInDb({
      commentId: comment.id,
      chapterKey: comment.chapterKey,
      visitorId,
      reason,
      details,
    });

    if (result.alreadyReported) {
      return response.status(200).json({ success: true, message: 'You have already reported this comment.' });
    }

    response.status(201).json({ success: true, message: 'Thanks. Your report has been submitted.' });
  } catch (error) {
    console.error('Failed to submit comment report:', error);
    response.status(500).json({ error: 'Unable to submit report.' });
  }
});
app.post('/api/comments/:id/report', async (request, response) => {
  try {
    if (!enforceEngagementRateLimit(request, response, 'comment_report', 10, 60_000)) return;

    const comment = await getChapterCommentByIdFromDb(request.params.id);
    if (!comment || comment.status === 'deleted') {
      return response.status(404).json({ error: 'Comment not found or no longer available.' });
    }

    const rawReason = String(request.body?.reason || 'Other').trim();
    const reason = ALLOWED_REPORT_REASONS.includes(rawReason) ? rawReason : 'Other';
    const details = String(request.body?.details || '').trim().slice(0, 500);

    const visitorId = getVisitorId(request, response);
    const result = await createCommentReportInDb({
      commentId: comment.id,
      chapterKey: comment.chapterKey,
      visitorId,
      reason,
      details,
    });

    if (result.alreadyReported) {
      return response.status(200).json({ success: true, message: 'You have already reported this comment.' });
    }

    response.status(201).json({ success: true, message: 'Thanks. Your report has been submitted.' });
  } catch (error) {
    console.error('Failed to submit comment report:', error);
    response.status(500).json({ error: 'Unable to submit report.' });
  }
});

// Admin Comment Reports Management
app.get('/api/admin/reports', requireAuthentication, requireAdmin, async (request, response) => {
  try {
    const status = request.query.status ? String(request.query.status).trim() : 'all';
    const reports = await loadAdminCommentReportsFromDb({ status });
    response.json({ reports });
  } catch (error) {
    console.error('Failed to load admin comment reports:', error);
    response.status(500).json({ error: 'Unable to load reports.' });
  }
});

app.patch('/api/admin/reports/:id', requireAuthentication, requireAdmin, async (request, response) => {
  try {
    const status = String(request.body?.status || '').trim();
    if (!['pending', 'dismissed', 'resolved'].includes(status)) {
      return response.status(400).json({ error: 'Invalid report status.' });
    }

    const updated = await updateCommentReportStatusInDb(request.params.id, status, {
      resolvedBy: request.session?.user?.username || 'admin',
    });

    if (!updated) {
      return response.status(404).json({ error: 'Report not found.' });
    }

    response.json({ report: updated });
  } catch (error) {
    console.error('Failed to update report status:', error);
    response.status(500).json({ error: 'Unable to update report status.' });
  }
});

app.post('/api/admin/reports/:id/delete-comment', requireAuthentication, requireAdmin, async (request, response) => {
  try {
    const reports = await loadAdminCommentReportsFromDb({ status: 'all' });
    const targetReport = reports.find((r) => r.id === request.params.id);

    if (!targetReport) {
      return response.status(404).json({ error: 'Report not found.' });
    }

    if (targetReport.commentId) {
      await deleteChapterCommentFromDb(targetReport.commentId);
    }

    await updateCommentReportStatusInDb(request.params.id, 'resolved', {
      resolvedBy: request.session?.user?.username || 'admin',
    });

    response.json({ success: true, message: 'Comment deleted and associated reports resolved.' });
  } catch (error) {
    console.error('Failed to delete reported comment:', error);
    response.status(500).json({ error: 'Unable to delete reported comment.' });
  }
});

app.get('/api/admin/comments', requireAuthentication, requireAdmin, async (request, response) => {
  try {
    if (!requireEngagementDatabase(response)) return;
    response.json({ comments: await loadAdminCommentsFromDb({ status: request.query.status, limit: 100 }) });
  } catch {
    response.status(500).json({ error: 'Unable to load comments.' });
  }
});

app.patch('/api/admin/comments/:id', requireAuthentication, requireAdmin, async (request, response) => {
  const status = request.body?.status;
  if (!['pending', 'approved', 'rejected'].includes(status)) return response.status(400).json({ error: 'Invalid comment status.' });
  try {
    if (!requireEngagementDatabase(response)) return;
    const comment = await updateChapterCommentStatusInDb(request.params.id, status);
    if (!comment) return response.status(404).json({ error: 'Comment not found.' });
    response.json({ comment });
  } catch {
    response.status(500).json({ error: 'Unable to update comment.' });
  }
});

app.delete('/api/admin/comments/:id', requireAuthentication, requireAdmin, async (request, response) => {
  try {
    if (!requireEngagementDatabase(response)) return;
    if (!await deleteChapterCommentFromDb(request.params.id)) return response.status(404).json({ error: 'Comment not found.' });
    response.status(204).end();
  } catch {
    response.status(500).json({ error: 'Unable to delete comment.' });
  }
});

// --- Characters Public & Admin API ---

// Public: List characters with search & filters
app.get('/api/characters', async (request, response) => {
  try {
    const { search, type, status, featured } = request.query;
    const characters = await listCharactersFromDb({
      publicOnly: true,
      search: search ? String(search).trim() : undefined,
      characterType: type ? String(type).trim() : undefined,
      status: status ? String(status).trim() : undefined,
      featured: featured !== undefined ? featured === 'true' || featured === '1' : undefined,
    });
    response.json({ characters });
  } catch (error) {
    console.error('Failed to list characters:', error);
    response.status(500).json({ error: 'Unable to load characters.' });
  }
});

// Public: Get single character by slug
app.get('/api/characters/:slug', async (request, response) => {
  try {
    const slug = String(request.params.slug).trim();
    const visitorId = getVisitorId(request, response);
    const character = await getCharacterFromDb(slug, { publicOnly: true, visitorId });
    if (!character) {
      return response.status(404).json({ error: 'Character not found.' });
    }
    response.json({ character });
  } catch (error) {
    console.error('Failed to load character:', error);
    response.status(500).json({ error: 'Unable to load character.' });
  }
});

// Public: Get character like status
app.get('/api/characters/:slug/likes', async (request, response) => {
  try {
    const slug = String(request.params.slug).trim();
    const character = await getCharacterFromDb(slug, { publicOnly: true });
    if (!character) {
      return response.status(404).json({ error: 'Character not found.' });
    }
    const visitorId = getVisitorId(request, response);
    const engagement = await getCharacterLikeFromDb(character.id, visitorId);
    response.json(engagement);
  } catch (error) {
    console.error('Failed to load character like:', error);
    response.status(500).json({ error: 'Unable to load character likes.' });
  }
});
app.get('/api/characters/:slug/like', async (request, response) => {
  try {
    const slug = String(request.params.slug).trim();
    const character = await getCharacterFromDb(slug, { publicOnly: true });
    if (!character) {
      return response.status(404).json({ error: 'Character not found.' });
    }
    const visitorId = getVisitorId(request, response);
    const engagement = await getCharacterLikeFromDb(character.id, visitorId);
    response.json(engagement);
  } catch (error) {
    console.error('Failed to load character like:', error);
    response.status(500).json({ error: 'Unable to load character likes.' });
  }
});

// Public: Add character like (anonymous)
app.post('/api/characters/:slug/likes', async (request, response) => {
  try {
    if (!enforceEngagementRateLimit(request, response, 'character_like', 30, 60_000)) return;
    const slug = String(request.params.slug).trim();
    const character = await getCharacterFromDb(slug, { publicOnly: true });
    if (!character) {
      return response.status(404).json({ error: 'Character not found.' });
    }
    const visitorId = getVisitorId(request, response);
    const result = await addCharacterLikeToDb(character.id, visitorId);
    response.json(result);
  } catch (error) {
    console.error('Failed to like character:', error);
    response.status(500).json({ error: 'Unable to like this character.' });
  }
});
app.post('/api/characters/:slug/like', async (request, response) => {
  try {
    if (!enforceEngagementRateLimit(request, response, 'character_like', 30, 60_000)) return;
    const slug = String(request.params.slug).trim();
    const character = await getCharacterFromDb(slug, { publicOnly: true });
    if (!character) {
      return response.status(404).json({ error: 'Character not found.' });
    }
    const visitorId = getVisitorId(request, response);
    const result = await addCharacterLikeToDb(character.id, visitorId);
    response.json(result);
  } catch (error) {
    console.error('Failed to like character:', error);
    response.status(500).json({ error: 'Unable to like this character.' });
  }
});

// Public: Remove character like
app.delete('/api/characters/:slug/likes', async (request, response) => {
  try {
    if (!enforceEngagementRateLimit(request, response, 'character_unlike', 30, 60_000)) return;
    const slug = String(request.params.slug).trim();
    const character = await getCharacterFromDb(slug, { publicOnly: true });
    if (!character) {
      return response.status(404).json({ error: 'Character not found.' });
    }
    const visitorId = getVisitorId(request, response);
    const result = await removeCharacterLikeFromDb(character.id, visitorId);
    response.json(result);
  } catch (error) {
    console.error('Failed to remove character like:', error);
    response.status(500).json({ error: 'Unable to update character like.' });
  }
});
app.delete('/api/characters/:slug/like', async (request, response) => {
  try {
    if (!enforceEngagementRateLimit(request, response, 'character_unlike', 30, 60_000)) return;
    const slug = String(request.params.slug).trim();
    const character = await getCharacterFromDb(slug, { publicOnly: true });
    if (!character) {
      return response.status(404).json({ error: 'Character not found.' });
    }
    const visitorId = getVisitorId(request, response);
    const result = await removeCharacterLikeFromDb(character.id, visitorId);
    response.json(result);
  } catch (error) {
    console.error('Failed to remove character like:', error);
    response.status(500).json({ error: 'Unable to update character like.' });
  }
});

// Admin: List all characters
app.get('/api/admin/characters', requireAuthentication, requireAdmin, async (_request, response) => {
  try {
    const characters = await listCharactersFromDb({ publicOnly: false });
    response.json({ characters });
  } catch (error) {
    console.error('Failed to list admin characters:', error);
    response.status(500).json({ error: 'Unable to load characters.' });
  }
});

// Admin: Get character by ID
app.get('/api/admin/characters/:id', requireAuthentication, requireAdmin, async (request, response) => {
  try {
    const character = await getCharacterByIdFromDb(request.params.id);
    if (!character) {
      return response.status(404).json({ error: 'Character not found.' });
    }
    response.json({ character });
  } catch (error) {
    console.error('Failed to load admin character:', error);
    response.status(500).json({ error: 'Unable to load character.' });
  }
});

// Admin: Create character
app.post('/api/admin/characters', requireAuthentication, requireAdmin, async (request, response) => {
  try {
    const name = String(request.body?.name || '').trim();
    if (!name) {
      return response.status(400).json({ error: 'Character name is required.' });
    }
    const characterPayload = {
      name,
      displayName: String(request.body?.displayName || name).trim(),
      slug: slugify(request.body?.slug || name),
      aliases: Array.isArray(request.body?.aliases)
        ? request.body.aliases.map((a) => String(a).trim()).filter(Boolean)
        : String(request.body?.aliases || '').split(',').map((a) => a.trim()).filter(Boolean),
      title: String(request.body?.title || '').trim(),
      characterType: String(request.body?.characterType || 'Other').trim(),
      status: String(request.body?.status || 'Unknown').trim(),
      affiliation: String(request.body?.affiliation || '').trim(),
      shortDescription: String(request.body?.shortDescription || '').trim(),
      biography: String(request.body?.biography || '').trim(),
      personality: String(request.body?.personality || '').trim(),
      quote: String(request.body?.quote || '').trim(),
      portrait: String(request.body?.portrait || '').trim(),
      imageAlt: String(request.body?.imageAlt || '').trim(),
      abilities: Array.isArray(request.body?.abilities) ? request.body.abilities : [],
      relationships: Array.isArray(request.body?.relationships) ? request.body.relationships : [],
      appearances: Array.isArray(request.body?.appearances) ? request.body.appearances : [],
      spoilerLevel: ['public', 'story_revealed', 'major_spoiler'].includes(request.body?.spoilerLevel)
        ? request.body.spoilerLevel
        : 'public',
      revealAfterChapter: String(request.body?.revealAfterChapter || '').trim(),
      publicationState: ['draft', 'published', 'hidden'].includes(request.body?.publicationState)
        ? request.body.publicationState
        : 'draft',
      featured: Boolean(request.body?.featured),
    };

    const created = await createCharacterInDb(characterPayload);
    response.status(201).json({ character: created });
  } catch (error) {
    console.error('Failed to create character:', error);
    response.status(500).json({ error: 'Unable to create character.' });
  }
});

// Admin: Update character
app.patch('/api/admin/characters/:id', requireAuthentication, requireAdmin, async (request, response) => {
  try {
    const id = request.params.id;
    const existing = await getCharacterByIdFromDb(id);
    if (!existing) {
      return response.status(404).json({ error: 'Character not found.' });
    }

    const updates = { ...request.body };
    if (updates.name !== undefined) updates.name = String(updates.name).trim();
    if (updates.slug !== undefined) updates.slug = slugify(updates.slug || updates.name || existing.name);
    if (updates.aliases !== undefined && !Array.isArray(updates.aliases)) {
      updates.aliases = String(updates.aliases).split(',').map((a) => a.trim()).filter(Boolean);
    }
    delete updates.likeCount;
    delete updates.id;
    delete updates._id;

    const updated = await updateCharacterInDb(id, updates);
    response.json({ character: updated });
  } catch (error) {
    console.error('Failed to update character:', error);
    response.status(500).json({ error: 'Unable to update character.' });
  }
});
app.put('/api/admin/characters/:id', requireAuthentication, requireAdmin, async (request, response) => {
  try {
    const id = request.params.id;
    const existing = await getCharacterByIdFromDb(id);
    if (!existing) {
      return response.status(404).json({ error: 'Character not found.' });
    }

    const updates = { ...request.body };
    if (updates.name !== undefined) updates.name = String(updates.name).trim();
    if (updates.slug !== undefined) updates.slug = slugify(updates.slug || updates.name || existing.name);
    if (updates.aliases !== undefined && !Array.isArray(updates.aliases)) {
      updates.aliases = String(updates.aliases).split(',').map((a) => a.trim()).filter(Boolean);
    }
    delete updates.likeCount;
    delete updates.id;
    delete updates._id;

    const updated = await updateCharacterInDb(id, updates);
    response.json({ character: updated });
  } catch (error) {
    console.error('Failed to update character:', error);
    response.status(500).json({ error: 'Unable to update character.' });
  }
});

// Admin: Delete character
app.delete('/api/admin/characters/:id', requireAuthentication, requireAdmin, async (request, response) => {
  try {
    const deleted = await deleteCharacterFromDb(request.params.id);
    if (!deleted) {
      return response.status(404).json({ error: 'Character not found.' });
    }
    response.status(204).end();
  } catch (error) {
    console.error('Failed to delete character:', error);
    response.status(500).json({ error: 'Unable to delete character.' });
  }
});

app.get('/api/health', async (_request, response) => {
  response.json({ status: 'ok', timestamp: new Date().toISOString(), usingDb: usingDb });
});

app.get('/api/session', (request, response) => {
  response.json({
    authenticated: Boolean(request.session.user),
    isAdmin: request.session.user?.role === 'admin',
    user: request.session.user ? { username: request.session.user.username } : null,
  });
});

app.post('/api/login', (request, response) => {
  const { username, password } = request.body ?? {};

  if (!hasAdminCredentials) {
    response.status(503).json({ error: 'Admin authentication is not configured in this environment.' });
    return;
  }

  if (!username || !password) {
    response.status(400).json({ error: 'Username and password are required.' });
    return;
  }

  const usernameMatches = timingSafeEquals(String(username), String(adminUsername));
  const passwordMatches = timingSafeEquals(String(password), String(adminPassword));

  if (!usernameMatches || !passwordMatches) {
    response.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  request.session.user = {
    username: String(username),
    role: 'admin',
  };

  response.json({
    authenticated: true,
    isAdmin: true,
    user: { username: String(username) },
  });
});

// Development helper: initialize admin credentials on environments without admin configured
app.post('/api/setup-admin', async (request, response) => {
  if (process.env.NODE_ENV === 'production') {
    response.status(403).json({ error: 'Not allowed in production.' });
    return;
  }

  if (hasAdminCredentials) {
    response.status(400).json({ error: 'Admin credentials already configured.' });
    return;
  }

  const { username, password } = request.body ?? {};
  if (!username || !password) {
    response.status(400).json({ error: 'username and password are required.' });
    return;
  }

  try {
    const adminPath = path.join(__dirname, 'data');
    await fs.mkdir(adminPath, { recursive: true });
    const adminFile = path.join(adminPath, 'admin.json');
    const payload = { username: String(username), password: String(password) };
    await fs.writeFile(adminFile, JSON.stringify(payload, null, 2), 'utf8');

    // Apply in-memory so server starts honoring the new credentials immediately
    adminUsername = String(username);
    adminPassword = String(password);
    hasAdminCredentials = true;

    response.json({ success: true });
  } catch (err) {
    console.error('Unable to write admin credentials:', err && err.message);
    response.status(500).json({ error: 'Unable to persist admin credentials.' });
  }
});

app.post('/api/logout', (request, response) => {
  if (request.session) {
    request.session.destroy((error) => {
      if (error) {
        response.status(500).json({ error: 'Unable to log out securely.' });
        return;
      }

      response.json({ success: true });
    });
    return;
  }

  response.json({ success: true });
});

// Initialize Firebase Admin if service account provided
let firebaseApp = null;
let firebaseFirestore = null;
const firebaseServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
let firebaseEnabled = false;

if (firebaseServiceAccount) {
  try {
    let serviceAccountObj = null;
    // If provided as base64, decode
    if (firebaseServiceAccount.trim().startsWith('{')) {
      serviceAccountObj = JSON.parse(firebaseServiceAccount);
    } else {
      try {
        const decoded = Buffer.from(firebaseServiceAccount, 'base64').toString('utf8');
        serviceAccountObj = JSON.parse(decoded);
      } catch (e) {
        console.warn('FIREBASE_SERVICE_ACCOUNT provided but could not parse as JSON or base64.');
      }
    }

    if (serviceAccountObj) {
      firebaseApp = admin.initializeApp({ credential: admin.credential.cert(serviceAccountObj) });
      firebaseFirestore = admin.firestore(firebaseApp);
      firebaseEnabled = true;
      console.log('Firebase Admin initialized (Firestore enabled)');
    }
  } catch (err) {
    console.warn('Unable to initialize Firebase Admin:', err && err.message);
  }
}

app.post('/api/contact', async (request, response) => {
  try {
    const { name, email, subject, message } = request.body ?? {};

    // Basic server-side validation and sanitization
    const errors = {};
    const trim = (v, max = 1000) => (String(v || '').trim().slice(0, max));
    const safeName = trim(name, 200);
    const safeEmail = trim(email, 320);
    const safeSubject = trim(subject, 200);
    const safeMessage = trim(message, 5000);

    if (!safeName) errors.name = 'Name is required.';
    if (!safeEmail) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) errors.email = 'Invalid email address.';
    if (!safeSubject) errors.subject = 'Subject is required.';
    if (!safeMessage || safeMessage.length < 12) errors.message = 'Message must be at least 12 characters.';

    if (Object.keys(errors).length > 0) {
      response.status(400).json({ errors });
      return;
    }

    const payload = {
      name: safeName,
      email: safeEmail,
      subject: safeSubject,
      message: safeMessage,
      ip: request.ip,
      userAgent: request.get('User-Agent') || null,
      createdAt: new Date().toISOString(),
    };

    // Store in Firebase Firestore if configured
    if (firebaseEnabled && firebaseFirestore) {
      try {
        await firebaseFirestore.collection('contacts').add(payload);
      } catch (err) {
        console.warn('Firestore write failed:', err && err.message);
      }
    }

    // Store in Postgres if available
    if (usingDb) {
      try {
        await saveMessageToDb(payload);
      } catch (err) {
        console.warn('DB message save failed:', err && err.message);
      }
    } else {
      // Fallback: append to server/data/messages.json
      try {
        const messagesPath = path.join(__dirname, 'data', 'messages.json');
        await fs.mkdir(path.dirname(messagesPath), { recursive: true });
        let existing = [];
        try {
          const raw = await fs.readFile(messagesPath, 'utf8');
          existing = JSON.parse(raw);
        } catch (e) {
          // ignore
        }
        existing.unshift(payload);
        await fs.writeFile(messagesPath, JSON.stringify(existing.slice(0, 200), null, 2), 'utf8');
      } catch (err) {
        console.warn('Fallback message write failed:', err && err.message);
      }
    }

    response.json({ success: true });
  } catch (err) {
    console.error('Contact submission error:', err && err.message);
    response.status(500).json({ error: 'Unable to process contact submission.' });
  }
});

app.get('/api/uploads/config', requireAuthentication, requireAdmin, (_request, response) => {
  response.json({
    enabled: hasS3Config,
    bucket: s3BucketName,
    region: awsRegion,
    keyPrefix: 'mysticpenhd/',
  });
});

app.post('/api/uploads/presign', requireAuthentication, requireAdmin, async (request, response) => {
  if (!hasS3Config) {
    response.status(503).json({ error: 'S3 upload is not configured for this environment.' });
    return;
  }

  const { fileName, contentType } = request.body ?? {};
  if (!fileName) {
    response.status(400).json({ error: 'fileName is required.' });
    return;
  }

  const safeFileName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '-');
  const key = `mysticpenhd/${Date.now()}-${safeFileName}`;
  const client = new S3Client({
    region: awsRegion,
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
    },
  });

  const command = new PutObjectCommand({
    Bucket: s3BucketName,
    Key: key,
    ContentType: contentType || 'application/octet-stream',
    ACL: 'public-read',
  });

  try {
    const signedUrl = await getSignedUrl(client, command, { expiresIn: 60 });
    const publicUrl = `https://${s3BucketName}.s3.${awsRegion}.amazonaws.com/${key}`;
    response.json({ enabled: true, url: signedUrl, publicUrl, key });
  } catch (error) {
    console.error('S3 presign failed:', error);
    response.status(500).json({ error: 'Unable to generate a secure upload URL.' });
  }
});

app.put('/api/site', requireAuthentication, requireAdmin, async (request, response) => {
  try {
    const content = await loadContent();
    const incomingAuthor = request.body ?? {};

    content.author = {
      ...(content.author || mysticPenHDContent.author || {}),
      ...incomingAuthor,
      achievements: Array.isArray(incomingAuthor.achievements)
        ? incomingAuthor.achievements
        : (content.author?.achievements || mysticPenHDContent.author?.achievements || []),
    };

    if (incomingAuthor.siteName) {
      content.siteName = incomingAuthor.siteName;
    }

    await saveContent(content);
    response.json(content.author);
  } catch {
    response.status(500).json({ error: 'Unable to save author details.' });
  }
});

app.get('/api/books', async (_request, response) => {
  try {
    const content = await loadContent();
    response.json(content);
  } catch {
    response.status(500).json({ error: 'Unable to load content.' });
  }
});

app.get('/api/books/:slug', async (request, response) => {
  try {
    const content = await loadContent();
    const selectedBook = content.books.find((book) => book.slug === request.params.slug);

    if (!selectedBook) {
      response.status(404).json({ error: 'Book not found.' });
      return;
    }

    response.json(selectedBook);
  } catch {
    response.status(500).json({ error: 'Unable to load the selected book.' });
  }
});

app.put('/api/books/:slug', requireAuthentication, requireAdmin, async (request, response) => {
  try {
    const content = await loadContent();
    const index = content.books.findIndex((book) => book.slug === request.params.slug);

    if (index === -1) {
      response.status(404).json({ error: 'Book not found.' });
      return;
    }

    const incomingBook = request.body;

    // Normalize lore items and ensure server-side slugs for file-based persistence
    const incomingLore = incomingBook.lore ?? content.books[index].lore ?? [];
    const seenLoreSlugs = new Set();
    const normalizedLore = incomingLore.map((item, idx) => {
      const title = item.title || `Document ${idx + 1}`;
      let base = slugify(`${content.books[index].slug || request.params.slug}-${title}`);
      let slug = base;
      let counter = 1;
      while (seenLoreSlugs.has(slug)) {
        slug = `${base}-${counter++}`;
      }
      seenLoreSlugs.add(slug);
      return { ...item, slug };
    });

    const updatedBook = {
      ...content.books[index],
      ...incomingBook,
      title: (incomingBook.title && String(incomingBook.title).trim()) || content.books[index].title || mysticPenHDContent.books[0].title,
      tagline: (incomingBook.tagline && String(incomingBook.tagline).trim()) || content.books[index].tagline || mysticPenHDContent.books[0].tagline,
      metadata: {
        ...content.books[index].metadata,
        ...(incomingBook.metadata ?? {}),
      },
      lore: normalizedLore,
      chapters: incomingBook.chapters ?? content.books[index].chapters,
      futureTitles: incomingBook.futureTitles ?? content.books[index].futureTitles,
    };

    content.books[index] = updatedBook;
    await saveContent(content);
    response.json(updatedBook);
  } catch {
    response.status(500).json({ error: 'Unable to save book updates.' });
  }
});

// Admin: list recent messages
app.get('/api/messages', requireAuthentication, requireAdmin, async (request, response) => {
  try {
    const limit = Math.min(100, Number(request.query.limit) || 50);

    if (firebaseEnabled && firebaseFirestore) {
      const snapshot = await firebaseFirestore.collection('contacts').orderBy('createdAt', 'desc').limit(limit).get();
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      response.json({ messages: docs });
      return;
    }

    if (usingDb) {
      const rows = await loadMessagesFromDb(limit);
      // map to consistent shape
      const messages = rows.map((r) => ({ id: r.id, ...r.payload, createdAt: r.created_at }));
      response.json({ messages });
      return;
    }

    // Fallback: read server/data/messages.json
    const messagesPath = path.join(__dirname, 'data', 'messages.json');
    let existing = [];
    try {
      const raw = await fs.readFile(messagesPath, 'utf8');
      existing = JSON.parse(raw);
    } catch (e) {
      // ignore
    }

    response.json({ messages: existing.slice(0, limit) });
  } catch (err) {
    console.error('Unable to load messages list:', err && err.message);
    response.status(500).json({ error: 'Unable to load messages.' });
  }
});

// Get single message
app.get('/api/messages/:id', requireAuthentication, requireAdmin, async (request, response) => {
  try {
    const id = request.params.id;

    if (firebaseEnabled && firebaseFirestore) {
      const doc = await firebaseFirestore.collection('contacts').doc(id).get();
      if (!doc.exists) {
        response.status(404).json({ error: 'Message not found.' });
        return;
      }
      response.json({ message: { id: doc.id, ...doc.data() } });
      return;
    }

    if (usingDb) {
      const row = await getMessageFromDb(id);
      if (!row) {
        response.status(404).json({ error: 'Message not found.' });
        return;
      }
      response.json({ message: { id: row.id, ...row.payload, createdAt: row.created_at } });
      return;
    }

    const messagesPath = path.join(__dirname, 'data', 'messages.json');
    const raw = await fs.readFile(messagesPath, 'utf8');
    const existing = JSON.parse(raw);
    const found = existing.find((m) => (m.createdAt || '') === id);
    if (!found) {
      response.status(404).json({ error: 'Message not found.' });
      return;
    }
    response.json({ message: found });
  } catch (err) {
    console.error('Unable to load message:', err && err.message);
    response.status(500).json({ error: 'Unable to load message.' });
  }
});

// Mark read
app.post('/api/messages/:id/read', requireAuthentication, requireAdmin, async (request, response) => {
  try {
    const id = request.params.id;

    if (firebaseEnabled && firebaseFirestore) {
      await firebaseFirestore.collection('contacts').doc(id).update({ read: true });
      response.json({ success: true });
      return;
    }

    if (usingDb) {
      const updated = await updateMessageInDb(id, { read: true });
      if (!updated) {
        response.status(404).json({ error: 'Message not found.' });
        return;
      }
      response.json({ message: { id: updated.id, ...updated.payload, createdAt: updated.created_at } });
      return;
    }

    const messagesPath = path.join(__dirname, 'data', 'messages.json');
    const raw = await fs.readFile(messagesPath, 'utf8');
    const existing = JSON.parse(raw);
    const idx = existing.findIndex((m) => (m.createdAt || '') === id);
    if (idx === -1) {
      response.status(404).json({ error: 'Message not found.' });
      return;
    }
    existing[idx].read = true;
    await fs.writeFile(messagesPath, JSON.stringify(existing, null, 2), 'utf8');
    response.json({ success: true });
  } catch (err) {
    console.error('Unable to mark message read:', err && err.message);
    response.status(500).json({ error: 'Unable to mark message read.' });
  }
});

// Archive
app.post('/api/messages/:id/archive', requireAuthentication, requireAdmin, async (request, response) => {
  try {
    const id = request.params.id;

    if (firebaseEnabled && firebaseFirestore) {
      await firebaseFirestore.collection('contacts').doc(id).update({ archived: true });
      response.json({ success: true });
      return;
    }

    if (usingDb) {
      const updated = await updateMessageInDb(id, { archived: true });
      if (!updated) {
        response.status(404).json({ error: 'Message not found.' });
        return;
      }
      response.json({ message: { id: updated.id, ...updated.payload, createdAt: updated.created_at } });
      return;
    }

    const messagesPath = path.join(__dirname, 'data', 'messages.json');
    const raw = await fs.readFile(messagesPath, 'utf8');
    const existing = JSON.parse(raw);
    const idx = existing.findIndex((m) => (m.createdAt || '') === id);
    if (idx === -1) {
      response.status(404).json({ error: 'Message not found.' });
      return;
    }
    existing[idx].archived = true;
    await fs.writeFile(messagesPath, JSON.stringify(existing, null, 2), 'utf8');
    response.json({ success: true });
  } catch (err) {
    console.error('Unable to archive message:', err && err.message);
    response.status(500).json({ error: 'Unable to archive message.' });
  }
});

// Delete
app.delete('/api/messages/:id', requireAuthentication, requireAdmin, async (request, response) => {
  try {
    const id = request.params.id;

    if (firebaseEnabled && firebaseFirestore) {
      await firebaseFirestore.collection('contacts').doc(id).delete();
      response.json({ success: true });
      return;
    }

    if (usingDb) {
      const deleted = await deleteMessageFromDb(id);
      if (!deleted) {
        response.status(404).json({ error: 'Message not found.' });
        return;
      }
      response.json({ success: true });
      return;
    }

    const messagesPath = path.join(__dirname, 'data', 'messages.json');
    const raw = await fs.readFile(messagesPath, 'utf8');
    const existing = JSON.parse(raw);
    const filtered = existing.filter((m) => (m.createdAt || '') !== id);
    await fs.writeFile(messagesPath, JSON.stringify(filtered, null, 2), 'utf8');
    response.json({ success: true });
  } catch (err) {
    console.error('Unable to delete message:', err && err.message);
    response.status(500).json({ error: 'Unable to delete message.' });
  }
});

// Server-sent events stream for real-time messages (admin only)
app.get('/api/messages/stream', requireAuthentication, requireAdmin, async (request, response) => {
  // SSE headers
  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Connection', 'keep-alive');
  response.flushHeaders && response.flushHeaders();

  let closed = false;

  function sendEvent(event, data) {
    try {
      response.write(`event: ${event}\n`);
      response.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      // ignore
    }
  }

  // Send initial bulk
  (async () => {
    try {
      const res = await fetch(`${request.protocol}://${request.get('host')}/api/messages?limit=50`, { headers: { cookie: request.headers.cookie } });
      const json = await res.json();
      sendEvent('init', json.messages || []);
    } catch (e) {
      // ignore
    }
  })();

  let unsubscribe = null;
  let pollInterval = null;
  let lastSentIds = new Set();

  if (firebaseEnabled && firebaseFirestore) {
    const query = firebaseFirestore.collection('contacts').orderBy('createdAt', 'desc').limit(50);
    unsubscribe = query.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const doc = change.doc;
        if (change.type === 'added') {
          if (!lastSentIds.has(doc.id)) {
            lastSentIds.add(doc.id);
            sendEvent('message', { id: doc.id, ...doc.data() });
          }
        } else if (change.type === 'modified') {
          sendEvent('update', { id: doc.id, ...doc.data() });
        } else if (change.type === 'removed') {
          sendEvent('remove', { id: doc.id });
        }
      });
    }, (err) => {
      console.warn('Firestore snapshot error for SSE:', err && err.message);
    });
  } else if (usingDb) {
    // Polling fallback: poll every 5s for new messages
    pollInterval = setInterval(async () => {
      try {
        const rows = await loadMessagesFromDb(20);
        for (const r of rows) {
          if (!lastSentIds.has(r.id)) {
            lastSentIds.add(r.id);
            sendEvent('message', { id: r.id, ...r.payload, createdAt: r.created_at });
          }
        }
      } catch (e) {
        // ignore
      }
    }, 5000);
  } else {
    // File fallback poll
    pollInterval = setInterval(async () => {
      try {
        const messagesPath = path.join(__dirname, 'data', 'messages.json');
        const raw = await fs.readFile(messagesPath, 'utf8');
        const existing = JSON.parse(raw);
        for (const m of existing) {
          const id = m.createdAt || JSON.stringify(m).slice(0, 12);
          if (!lastSentIds.has(id)) {
            lastSentIds.add(id);
            sendEvent('message', { id, ...m });
          }
        }
      } catch (e) {
        // ignore
      }
    }, 5000);
  }

  request.on('close', () => {
    closed = true;
    if (unsubscribe) unsubscribe();
    if (pollInterval) clearInterval(pollInterval);
  });

});

// Initialize persistence once. This is used by both the local server and Vercel handler.
let initializationPromise = null;

export function initializeApplication() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      // Try to load admin credentials from disk if environment variables are not provided
      try {
        const adminFile = path.join(__dirname, 'data', 'admin.json');
        const raw = await fs.readFile(adminFile, 'utf8').catch(() => null);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            // Prefer admin.json when present to allow local dev overrides
            if (parsed.username) adminUsername = String(parsed.username);
            if (parsed.password) adminPassword = String(parsed.password);
            hasAdminCredentials = Boolean(adminUsername && adminPassword);
            if (hasAdminCredentials) console.log('Admin credentials loaded from server/data/admin.json');
          } catch (e) {
            // ignore parse errors
          }
        }
      } catch (err) {
        // ignore
      }

      if (process.env.MONGODB_URI || process.env.DATABASE_URL) {
        try {
          await initDb();
          usingDb = true;
          console.log('MongoDB connected successfully: using MongoDB for persistence');
        } catch (dbError) {
          usingDb = false;
          console.warn('MongoDB connection failed — falling back to local file-based persistence.');
          console.warn(`[MongoDB Notice] ${dbError.message}`);
        }
      } else {
        usingDb = false;
        console.log('No DATABASE_URL found — using file-based persistence');
      }
    })();
  }
  return initializationPromise;
}

export default app;
