CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS books (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      short_title TEXT,
      subtitle TEXT,
      tagline TEXT,
      cover_asset TEXT,
      summary TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      future_titles JSONB NOT NULL DEFAULT '[]'::jsonb
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id SERIAL PRIMARY KEY,
      book_slug TEXT NOT NULL REFERENCES books(slug) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      number INTEGER NOT NULL,
      label TEXT,
      title TEXT NOT NULL,
      summary TEXT,
      paragraphs JSONB NOT NULL DEFAULT '[]'::jsonb,
      UNIQUE (book_slug, slug)
    );

    CREATE TABLE IF NOT EXISTS lore_items (
      id SERIAL PRIMARY KEY,
      book_slug TEXT NOT NULL REFERENCES books(slug) ON DELETE CASCADE,
      slug TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE (book_slug, slug)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      payload JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS chapter_comments (
      id SERIAL PRIMARY KEY,
      chapter_key TEXT NOT NULL,
      display_name TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      parent_id TEXT,
      reply_to_name TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comment_likes (
      id SERIAL PRIMARY KEY,
      comment_id TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      UNIQUE (comment_id, visitor_id)
    );

    CREATE INDEX IF NOT EXISTS idx_chapter_comments_chapter_key ON chapter_comments(chapter_key, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_chapter_comments_parent_id ON chapter_comments(parent_id);
    CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
    CREATE INDEX IF NOT EXISTS idx_comment_likes_unique ON comment_likes(comment_id, visitor_id);

    CREATE TABLE IF NOT EXISTS characters (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      display_name TEXT,
      aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
      title TEXT,
      character_type TEXT NOT NULL DEFAULT 'Other',
      status TEXT NOT NULL DEFAULT 'Unknown',
      affiliation TEXT,
      short_description TEXT,
      biography TEXT,
      personality TEXT,
      quote TEXT,
      portrait TEXT,
      image_alt TEXT,
      abilities JSONB NOT NULL DEFAULT '[]'::jsonb,
      relationships JSONB NOT NULL DEFAULT '[]'::jsonb,
      appearances JSONB NOT NULL DEFAULT '[]'::jsonb,
      spoiler_level TEXT NOT NULL DEFAULT 'public',
      reveal_after_chapter TEXT,
      publication_state TEXT NOT NULL DEFAULT 'draft',
      featured BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS character_likes (
      id SERIAL PRIMARY KEY,
      character_id TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      UNIQUE (character_id, visitor_id)
    );

    CREATE INDEX IF NOT EXISTS idx_characters_slug ON characters(slug);
    CREATE INDEX IF NOT EXISTS idx_characters_publication_state ON characters(publication_state, featured DESC, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_character_likes_character_id ON character_likes(character_id);
    CREATE INDEX IF NOT EXISTS idx_character_likes_unique ON character_likes(character_id, visitor_id);

