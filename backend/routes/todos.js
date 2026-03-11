const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// ── Auth middleware ───────────────────────────────────────────────────────────
// Attaches req.user = { userId, email } when a valid Bearer token is present.
// Returns 401 if the token is missing or invalid.
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { userId: decoded.userId, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// ── GET /api/todos ────────────────────────────────────────────────────────────
// Public route — returns all todos ordered by creation date descending.
// image_base64 can be large, so we include it; the frontend decides when to render it.
router.get('/', async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      `SELECT
         t.id,
         t.user_id,
         u.email AS user_email,
         t.text,
         t.image_base64,
         t.due_date,
         t.color_status,
         t.created_at
       FROM todos t
       JOIN users u ON u.id = t.user_id
       ORDER BY t.created_at DESC`
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('GET /todos error:', err);
    return res.status(500).json({ error: 'Failed to retrieve todos.' });
  }
});

// ── POST /api/todos ───────────────────────────────────────────────────────────
// Protected — creates a new todo for the authenticated user.
// Body: { text, image_base64?, due_date?, color_status? }
router.post('/', requireAuth, async (req, res) => {
  const { text, image_base64, due_date, color_status } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Todo text is required.' });
  }

  const validColors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
  const resolvedColor =
    color_status && validColors.includes(color_status) ? color_status : 'green';

  // Validate due_date format if provided
  let resolvedDueDate = null;
  if (due_date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(due_date)) {
      return res.status(400).json({ error: 'due_date must be in YYYY-MM-DD format.' });
    }
    resolvedDueDate = due_date;
  }

  // Validate base64 image if provided (light check — just ensure it's a string)
  const resolvedImage =
    image_base64 && typeof image_base64 === 'string' ? image_base64 : null;

  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      `INSERT INTO todos (user_id, text, image_base64, due_date, color_status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, text, image_base64, due_date, color_status, created_at`,
      [req.user.userId, text.trim(), resolvedImage, resolvedDueDate, resolvedColor]
    );

    const newTodo = result.rows[0];
    newTodo.user_email = req.user.email;

    return res.status(201).json(newTodo);
  } catch (err) {
    console.error('POST /todos error:', err);
    return res.status(500).json({ error: 'Failed to create todo.' });
  }
});

// ── DELETE /api/todos/:id ─────────────────────────────────────────────────────
// Protected — deletes a todo. Users can only delete their own todos.
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  // Basic UUID format check
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid todo ID format.' });
  }

  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      `DELETE FROM todos WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: 'Todo not found or you do not have permission to delete it.' });
    }

    return res.json({ message: 'Todo deleted successfully.', id });
  } catch (err) {
    console.error('DELETE /todos/:id error:', err);
    return res.status(500).json({ error: 'Failed to delete todo.' });
  }
});

module.exports = router;
