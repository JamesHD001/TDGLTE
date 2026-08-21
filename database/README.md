# Database

The application uses PostgreSQL when `DATABASE_URL` is configured.

- `schema.sql` creates the application tables.
- `seed-content.json` is the original site content retained as a readable database seed/reference.

The backend's database initializer creates the same schema automatically and migrates the bundled content when the database is empty, so running `schema.sql` manually is optional if the backend database user has schema-creation permission.
