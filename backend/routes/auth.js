const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Cookie is cross-domain (Vercel → Render) so it must be Secure + SameSite=None.
// We detect prod by checking if FRONTEND_URL is an https URL (not localhost).
function cookieOptions() {
  const frontendUrl = process.env.FRONTEND_URL || '';
  const isProduction = frontendUrl.startsWith('https://');
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

// ── POST /api/auth/request-login ──────────────────────────────────────────────
// Accepts an email address, creates (or finds) the user, generates a magic-link
// token valid for 15 minutes, and sends it by email via Resend.
router.post('/request-login', async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Invalid email address format.' });
  }

  const pool = req.app.locals.pool;

  try {
    // Upsert user — create if not exists, return existing if already there
    const userResult = await pool.query(
      `INSERT INTO users (email)
       VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id, email`,
      [normalizedEmail]
    );
    const user = userResult.rows[0];

    // Invalidate any previously unused tokens for this user to avoid confusion
    await pool.query(
      `UPDATE magic_tokens SET used = TRUE
       WHERE user_id = $1 AND used = FALSE`,
      [user.id]
    );

    // Create a new magic token — expires in 15 minutes
    const rawToken = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await pool.query(
      `INSERT INTO magic_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, rawToken, expiresAt]
    );

    // Build the magic link URL
    const backendUrl =
      process.env.BACKEND_URL ||
      `http://localhost:${process.env.PORT || 3001}`;
    const magicLink = `${backendUrl}/api/auth/verify?token=${rawToken}`;

    // Send email via Resend
    const { error: sendError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com',
      to: normalizedEmail,
      subject: 'Your login link — Todo App',
      html: `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Login Link</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                     background: #f9fafb; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: #ffffff;
                      border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <h1 style="margin: 0 0 8px; font-size: 24px; color: #111827;">
              Connexion à Todo App
            </h1>
            <p style="margin: 0 0 24px; color: #6b7280; font-size: 15px;">
              Cliquez sur le bouton ci-dessous pour vous connecter. Ce lien est
              valable <strong>15 minutes</strong>.
            </p>
            <a href="${magicLink}"
               style="display: inline-block; padding: 14px 28px; background: #4f46e5;
                      color: #ffffff; text-decoration: none; border-radius: 8px;
                      font-size: 15px; font-weight: 600;">
              Se connecter
            </a>
            <p style="margin: 24px 0 0; color: #9ca3af; font-size: 13px;">
              Si vous n'avez pas demandé ce lien, ignorez cet email.<br/>
              Lien direct : <a href="${magicLink}" style="color: #6b7280;">${magicLink}</a>
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (sendError) {
      console.error('Resend error:', sendError);
      return res.status(500).json({ error: 'Failed to send login email. Please try again.' });
    }

    return res.json({
      message: 'Magic link sent! Check your email to complete login.',
    });
  } catch (err) {
    console.error('request-login error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/auth/verify?token=xxx ────────────────────────────────────────────
// Validates the magic token, marks it as used, issues a 7-day JWT, and
// redirects the browser to the frontend with the token in the URL hash.
router.get('/verify', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('Missing token parameter.');
  }

  const pool = req.app.locals.pool;

  try {
    // Fetch the token record
    const tokenResult = await pool.query(
      `SELECT mt.id, mt.user_id, mt.expires_at, mt.used, u.email
       FROM magic_tokens mt
       JOIN users u ON u.id = mt.user_id
       WHERE mt.token = $1`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).send('Invalid or expired login link.');
    }

    const record = tokenResult.rows[0];

    if (record.used) {
      return res.status(400).send('This login link has already been used.');
    }

    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).send('This login link has expired. Please request a new one.');
    }

    // Mark token as used
    await pool.query(`UPDATE magic_tokens SET used = TRUE WHERE id = $1`, [
      record.id,
    ]);

    // Create a short-lived session token (60s) the frontend will exchange for a cookie.
    // Cookies set during cross-domain redirects are blocked by most browsers (Safari ITP).
    // Instead we pass a one-time token in the URL; the frontend exchanges it via fetch
    // with credentials:include so the browser properly stores the httpOnly cookie.
    const sessionToken = uuidv4();
    const sessionExpiry = new Date(Date.now() + 60 * 1000); // 60 seconds

    await pool.query(
      `INSERT INTO session_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [record.user_id, sessionToken, sessionExpiry]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}?session_token=${sessionToken}`);
  } catch (err) {
    console.error('verify error:', err);
    return res.status(500).send('Internal server error.');
  }
});

// ── POST /api/auth/session ────────────────────────────────────────────────────
// Frontend exchanges the one-time session_token (from URL) for an httpOnly cookie.
router.post('/session', async (req, res) => {
  const { session_token } = req.body;
  if (!session_token) {
    return res.status(400).json({ error: 'Missing session_token.' });
  }

  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      `SELECT st.id, st.user_id, st.expires_at, st.used, u.email
       FROM session_tokens st
       JOIN users u ON u.id = st.user_id
       WHERE st.token = $1`,
      [session_token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid session token.' });
    }

    const record = result.rows[0];

    if (record.used || new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Session token expired or already used.' });
    }

    await pool.query(`UPDATE session_tokens SET used = TRUE WHERE id = $1`, [record.id]);

    const jwtToken = jwt.sign(
      { userId: record.user_id, email: record.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('auth_token', jwtToken, cookieOptions());

    return res.json({ userId: record.user_id, email: record.email });
  } catch (err) {
    console.error('session error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  const token = req.cookies?.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return res.json({ userId: decoded.userId, email: decoded.email });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

// ── GET /api/auth/logout ──────────────────────────────────────────────────────
router.get('/logout', (req, res) => {
  res.clearCookie('auth_token', cookieOptions());
  return res.json({ message: 'Logged out.' });
});

module.exports = router;
