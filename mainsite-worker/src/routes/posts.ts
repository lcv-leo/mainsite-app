/**
 * Rotas de Posts (CRUD público + admin).
 * Domínio: /api/posts/*
 */
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { requireAuth } from '../lib/auth.ts';

const posts = new Hono<{ Bindings: Env }>();

// GET /api/posts (público)
posts.get('/api/posts', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM mainsite_posts ORDER BY is_pinned DESC, display_order ASC, created_at DESC'
    ).all();
    return c.json(results || []);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// GET /api/posts/:id (público)
posts.get('/api/posts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const post = await c.env.DB.prepare('SELECT * FROM mainsite_posts WHERE id = ?').bind(id).first();
    if (!post) return c.json({ error: 'Post não encontrado' }, 404);
    return c.json(post);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// POST /api/posts (admin)
posts.post('/api/posts', requireAuth, async (c) => {
  try {
    const { title, content } = (await c.req.json()) as { title?: string; content?: string };
    await c.env.DB.prepare(
      'INSERT INTO mainsite_posts (title, content, is_pinned, display_order) VALUES (?, ?, 0, 0)'
    )
      .bind(title, content)
      .run();
    return c.json({ success: true }, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// PUT /api/posts/:id (admin)
posts.put('/api/posts/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  try {
    const { title, content } = (await c.req.json()) as { title?: string; content?: string };
    await c.env.DB.prepare(
      'UPDATE mainsite_posts SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(title, content, id)
      .run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// DELETE /api/posts/:id (admin)
posts.delete('/api/posts/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('DELETE FROM mainsite_posts WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// PUT /api/posts/:id/pin (admin)
posts.put('/api/posts/:id/pin', requireAuth, async (c) => {
  const id = c.req.param('id');
  try {
    const post = await c.env.DB.prepare('SELECT is_pinned FROM mainsite_posts WHERE id = ?')
      .bind(id)
      .first<{ is_pinned: number }>();
    const newStatus = post && post.is_pinned ? 0 : 1;
    if (newStatus === 1) await c.env.DB.prepare('UPDATE mainsite_posts SET is_pinned = 0').run();
    await c.env.DB.prepare('UPDATE mainsite_posts SET is_pinned = ? WHERE id = ?').bind(newStatus, id).run();
    return c.json({ success: true, is_pinned: newStatus });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// PUT /api/posts/reorder (admin)
posts.put('/api/posts/reorder', requireAuth, async (c) => {
  try {
    const items = (await c.req.json()) as Array<{ id: string | number; display_order: number }>;
    const statements = items.map((item) =>
      c.env.DB.prepare('UPDATE mainsite_posts SET display_order = ? WHERE id = ?').bind(item.display_order, item.id)
    );
    await c.env.DB.batch(statements);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

export default posts;
