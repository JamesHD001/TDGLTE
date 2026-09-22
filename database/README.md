# Database

The application uses MongoDB for persistence.

- The backend MongoDB persistence layer is in `backend/src/db.js`.
- The `content`, `messages`, `chapter_likes`, `chapter_comments`, `comment_likes`, `comment_reports`, `characters`, and `character_likes` collections are created/used by the backend.
- Required connection settings are `MONGODB_URI` and, optionally, `MONGODB_DB`.
- `seed-content.json` and `schema.sql` are retained as legacy PostgreSQL/reference material while the expired Render database remains in its recovery window.

The backend automatically creates the required MongoDB indexes and migrates the bundled local content into the `content` collection when that collection does not yet contain the `site-content` document.

For a free cloud deployment, MongoDB Atlas currently provides a Free cluster with 512 MB of storage. Free clusters do not include managed backups, so keep separate exports of important production data.
