const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

const BCRYPT_ROUNDS = 12;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

function issueJwt(userId, email) {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
// Creates account, sends confirmation email.
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères.' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim().toLowerCase())) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const pool = req.app.locals.pool;

  try {
    // Check if email already exists
    const existing = await pool.query('SELECT id, email_verified FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      if (existing.rows[0].email_verified) {
        return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
      } else {
        // Account exists but not verified — resend confirmation
        await pool.query('DELETE FROM users WHERE email = $1', [normalizedEmail]);
      }
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const verificationToken = uuidv4();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await pool.query(
      `INSERT INTO users (email, password_hash, email_verified, verification_token, verification_expires_at)
       VALUES ($1, $2, FALSE, $3, $4)`,
      [normalizedEmail, passwordHash, verificationToken, verificationExpires]
    );

    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
    const verifyLink = `${backendUrl}/api/auth/verify-email?token=${verificationToken}`;

    console.log(`[register] Sending verification email to ${normalizedEmail}`);
    console.log(`[register] Verify link: ${verifyLink}`);

    await transporter.sendMail({
      from: `"Todo App" <${process.env.GMAIL_USER}>`,
      to: normalizedEmail,
      subject: 'Confirmez votre inscription — Todo App',
      html: `
        <!DOCTYPE html>
        <html lang="fr">
        <head><meta charset="UTF-8" /><title>Confirmation</title></head>
        <body style="font-family:-apple-system,sans-serif;background:#f9fafb;margin:0;padding:40px 20px;">
          <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
            <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">Bienvenue sur Todo App</h1>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">
              Cliquez sur le bouton ci-dessous pour confirmer votre email et vous connecter.
              Ce lien est valable <strong>24 heures</strong>.
            </p>
            <a href="${verifyLink}"
               style="display:inline-block;padding:14px 28px;background:#4f46e5;color:#fff;
                      text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
              Confirmer mon email
            </a>
            <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;">
              Si vous n'avez pas créé ce compte, ignorez cet email.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`[register] Email sent successfully to ${normalizedEmail}`);
    return res.json({ message: 'Inscription réussie ! Vérifiez votre email pour confirmer votre compte.' });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// ── GET /api/auth/verify-email?token=xxx ─────────────────────────────────────
// Validates email, marks account as verified, issues JWT, redirects to frontend.
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Token manquant.');

  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      `SELECT id, email, email_verified, verification_expires_at FROM users WHERE verification_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).send('Lien de confirmation invalide.');
    }

    const user = result.rows[0];

    if (user.email_verified) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}#auth_token=${issueJwt(user.id, user.email)}`);
    }

    if (new Date(user.verification_expires_at) < new Date()) {
      return res.status(400).send('Ce lien a expiré. Veuillez vous réinscrire.');
    }

    await pool.query(
      `UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_expires_at = NULL WHERE id = $1`,
      [user.id]
    );

    const jwtToken = issueJwt(user.id, user.email);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}#auth_token=${jwtToken}`);
  } catch (err) {
    console.error('verify-email error:', err);
    return res.status(500).send('Erreur interne du serveur.');
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
// Login with email + password, returns JWT.
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, email_verified FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    if (!user.email_verified) {
      return res.status(403).json({ error: 'Veuillez confirmer votre email avant de vous connecter.' });
    }

    const jwtToken = issueJwt(user.id, user.email);
    return res.json({ token: jwtToken, email: user.email });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return res.json({ userId: decoded.userId, email: decoded.email });
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
});

module.exports = router;
