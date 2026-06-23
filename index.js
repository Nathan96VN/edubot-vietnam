const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const Anthropic = require('@anthropic-ai/sdk');
const crypto = require('crypto');
const querystring = require('querystring');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ─── DB + AI clients ─────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Pricing config (VND for VNPay, USD cents for Stripe) ────────────────────
const PLANS = {
  student_premium: { vnd: 79000,  usd_cents: 399,  label: 'Student Premium', plan: 'premium' },
  family:          { vnd: 149000, usd_cents: 699,  label: 'Family Plan',     plan: 'family'  },
  teacher_pro:     { vnd: 249000, usd_cents: 1199, label: 'Teacher Pro',     plan: 'pro'     },
};

// ─── Auth middleware ──────────────────────────────────────────────────────────
const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));

// ─────────────────────────────────────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name, role = 'student', grade, institution } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });

    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) return res.status(400).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const assignedRole = email === 'nathansteyn96@gmail.com' ? 'admin' : role;

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, grade, institution, plan, daily_count, last_reset)
       VALUES ($1, $2, $3, $4, $5, $6, 'free', 0, NOW()) RETURNING id, email, name, role, plan`,
      [email, hash, name, assignedRole, grade || null, institution || null]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan, grade: user.grade } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAT ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, subject, grade } = req.body;
    const userId = req.user.id;

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    // Reset daily count if needed
    const lastReset = new Date(user.last_reset);
    const now = new Date();
    if (now.toDateString() !== lastReset.toDateString()) {
      await pool.query('UPDATE users SET daily_count = 0, last_reset = NOW() WHERE id = $1', [userId]);
      user.daily_count = 0;
    }

    // Enforce free tier limit
    const isPaid = user.plan !== 'free' || user.role === 'teacher' || user.role === 'admin';
    if (!isPaid && user.daily_count >= 5) {
      return res.status(429).json({ error: 'Daily limit reached. Upgrade to continue!', upgrade: true });
    }

    // Fetch curriculum context (RAG)
    let curriculumContext = '';
    if (subject && grade) {
      const curriculum = await pool.query(
        `SELECT objective, strand, substrand FROM curriculum
         WHERE LOWER(subject) = LOWER($1) AND grade = $2
         LIMIT 10`,
        [subject, parseInt(grade)]
      );
      if (curriculum.rows.length > 0) {
        curriculumContext = '\n\nRelevant curriculum objectives:\n' +
          curriculum.rows.map(r => `- [${r.strand}${r.substrand ? ' > ' + r.substrand : ''}] ${r.objective}`).join('\n');
      }
    }

    // Fetch recent history
    const history = await pool.query(
      `SELECT role, content FROM chat_history
       WHERE user_id = $1 AND subject = $2
       ORDER BY created_at DESC LIMIT 10`,
      [userId, subject || 'general']
    );
    const messages = history.rows.reverse().map(r => ({ role: r.role, content: r.content }));
    messages.push({ role: 'user', content: message });

    const systemPrompt = `You are EduBot, a friendly Socratic AI tutor for Vietnamese students grades 1-12.
Teaching style: Ask guiding questions rather than giving direct answers. Encourage thinking step by step.
Current subject: ${subject || 'general'}. Student grade: ${grade || 'unknown'}.
Language: Respond in the same language the student uses (Vietnamese or English).
${curriculumContext}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0].text;

    // Save both messages
    await pool.query(
      `INSERT INTO chat_history (user_id, role, content, subject, grade) VALUES ($1, 'user', $2, $3, $4)`,
      [userId, message, subject || 'general', grade || null]
    );
    await pool.query(
      `INSERT INTO chat_history (user_id, role, content, subject, grade) VALUES ($1, 'assistant', $2, $3, $4)`,
      [userId, reply, subject || 'general', grade || null]
    );

    // Increment daily count
    await pool.query('UPDATE users SET daily_count = daily_count + 1 WHERE id = $1', [userId]);

    res.json({ reply, daily_count: user.daily_count + 1 });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat failed' });
  }
});

app.get('/chat/history', authenticate, async (req, res) => {
  try {
    const { subject } = req.query;
    const result = await pool.query(
      `SELECT role, content, created_at FROM chat_history
       WHERE user_id = $1 AND subject = $2
       ORDER BY created_at ASC LIMIT 50`,
      [req.user.id, subject || 'general']
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// USER ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.get('/user/profile', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, grade, institution, plan, daily_count FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CLASSROOM ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.post('/classroom/create', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teachers only' });
    }
    const { name, subject, grade } = req.body;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const result = await pool.query(
      `INSERT INTO classrooms (teacher_id, name, subject, grade, code) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, name, subject, grade, code]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create classroom' });
  }
});

app.get('/classroom/my', authenticate, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'teacher' || req.user.role === 'admin') {
      result = await pool.query('SELECT * FROM classrooms WHERE teacher_id = $1', [req.user.id]);
    } else {
      result = await pool.query(
        `SELECT c.* FROM classrooms c
         JOIN classroom_students cs ON cs.classroom_id = c.id
         WHERE cs.student_id = $1`,
        [req.user.id]
      );
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load classrooms' });
  }
});

app.post('/classroom/join', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    const classroom = await pool.query('SELECT * FROM classrooms WHERE code = $1', [code]);
    if (classroom.rows.length === 0) return res.status(404).json({ error: 'Classroom not found' });

    const classroomId = classroom.rows[0].id;
    await pool.query(
      `INSERT INTO classroom_students (classroom_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [classroomId, req.user.id]
    );
    res.json({ message: 'Joined classroom', classroom: classroom.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to join classroom' });
  }
});

app.get('/classroom/:id/students', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.grade FROM users u
       JOIN classroom_students cs ON cs.student_id = u.id
       WHERE cs.classroom_id = $1`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load students' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.get('/admin/stats', authenticate, adminOnly, async (req, res) => {
  try {
    const [users, chats, classrooms] = await Promise.all([
      pool.query('SELECT COUNT(*) as total, role, plan FROM users GROUP BY role, plan'),
      pool.query('SELECT COUNT(*) as total FROM chat_history WHERE role = $1', ['user']),
      pool.query('SELECT COUNT(*) as total FROM classrooms'),
    ]);
    res.json({ users: users.rows, total_chats: chats.rows[0].total, total_classrooms: classrooms.rows[0].total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

app.get('/admin/users', authenticate, adminOnly, async (req, res) => {
  try {
    const { search, role, plan } = req.query;
    let query = 'SELECT id, email, name, role, grade, institution, plan, daily_count, created_at FROM users WHERE 1=1';
    const params = [];
    if (search) { params.push(`%${search}%`); query += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length})`; }
    if (role)   { params.push(role);           query += ` AND role = $${params.length}`; }
    if (plan)   { params.push(plan);           query += ` AND plan = $${params.length}`; }
    query += ' ORDER BY created_at DESC LIMIT 100';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load users' });
  }
});

app.patch('/admin/users/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { plan, role } = req.body;
    const result = await pool.query(
      'UPDATE users SET plan = COALESCE($1, plan), role = COALESCE($2, role) WHERE id = $3 RETURNING *',
      [plan, role, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/admin/users/:id', authenticate, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 — PAYMENT ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// ── Helper: upgrade user plan in DB ──────────────────────────────────────────
async function upgradePlan(userId, planKey) {
  const plan = PLANS[planKey];
  if (!plan) throw new Error('Unknown plan: ' + planKey);
  await pool.query('UPDATE users SET plan = $1 WHERE id = $2', [plan.plan, userId]);
}

// ─────────────────────────────────────────────────────────────────────────────
// VNPAY — Create payment URL
// POST /payment/create-vnpay
// Body: { planKey: 'student_premium' | 'family' | 'teacher_pro' }
// ─────────────────────────────────────────────────────────────────────────────
app.post('/payment/create-vnpay', authenticate, async (req, res) => {
  try {
    const { planKey } = req.body;
    const plan = PLANS[planKey];
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });

    const tmnCode    = process.env.VNPAY_TMN_CODE;
    const hashSecret = process.env.VNPAY_HASH_SECRET;
    const returnUrl  = `${process.env.APP_URL || 'https://edubot-vietnam.onrender.com'}/payment/vnpay-return`;

    const date = new Date();
    const pad  = n => String(n).padStart(2, '0');
    const createDate = `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    const txnRef = `${req.user.id}-${Date.now()}`;

    const params = {
      vnp_Version:   '2.1.0',
      vnp_Command:   'pay',
      vnp_TmnCode:   tmnCode,
      vnp_Amount:    plan.vnd * 100,
      vnp_CurrCode:  'VND',
      vnp_TxnRef:    txnRef,
      vnp_OrderInfo: `EduBot ${plan.label} - User ${req.user.id}`,
      vnp_OrderType: 'other',
      vnp_Locale:    'vn',
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr:    req.ip || '127.0.0.1',
      vnp_CreateDate: createDate,
    };

    const sorted   = Object.keys(params).sort().reduce((acc, k) => { acc[k] = params[k]; return acc; }, {});
    const signData = querystring.stringify(sorted);
    const hmac     = crypto.createHmac('sha512', hashSecret).update(signData, 'utf8').digest('hex');
    sorted.vnp_SecureHash = hmac;

    await pool.query(
      `INSERT INTO payments (user_id, plan, gateway, amount, currency, txn_ref, status, created_at)
       VALUES ($1, $2, 'vnpay', $3, 'VND', $4, 'pending', NOW())`,
      [req.user.id, planKey, plan.vnd, txnRef]
    );

    const paymentUrl = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?' + querystring.stringify(sorted);
    res.json({ paymentUrl });
  } catch (err) {
    console.error('VNPay create error:', err);
    res.status(500).json({ error: 'Failed to create VNPay payment' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// VNPAY — Return URL (VNPay redirects user here after payment)
// GET /payment/vnpay-return
// ─────────────────────────────────────────────────────────────────────────────
app.get('/payment/vnpay-return', async (req, res) => {
  try {
    const hashSecret   = process.env.VNPAY_HASH_SECRET;
    const params       = { ...req.query };
    const secureHash   = params.vnp_SecureHash;
    const responseCode = params.vnp_ResponseCode;
    const txnRef       = params.vnp_TxnRef;

    delete params.vnp_SecureHash;
    delete params.vnp_SecureHashType;

    const sorted   = Object.keys(params).sort().reduce((acc, k) => { acc[k] = params[k]; return acc; }, {});
    const signData = querystring.stringify(sorted);
    const hmac     = crypto.createHmac('sha512', hashSecret).update(signData, 'utf8').digest('hex');

    const bubbleUrl = process.env.BUBBLE_URL || 'https://nathansteyn96.bubbleapps.io';

    if (hmac !== secureHash) {
      console.error('VNPay: invalid signature for txnRef', txnRef);
      return res.redirect(`${bubbleUrl}/version-test?payment=failed&reason=invalid_signature`);
    }

    if (responseCode === '00') {
      const pending = await pool.query('SELECT * FROM payments WHERE txn_ref = $1', [txnRef]);
      if (pending.rows.length > 0) {
        const { user_id, plan } = pending.rows[0];
        await upgradePlan(user_id, plan);
        await pool.query('UPDATE payments SET status = $1 WHERE txn_ref = $2', ['success', txnRef]);
      }
      return res.redirect(`${bubbleUrl}/version-test?payment=success`);
    } else {
      await pool.query('UPDATE payments SET status = $1 WHERE txn_ref = $2', ['failed', txnRef]);
      return res.redirect(`${bubbleUrl}/version-test?payment=failed&reason=declined`);
    }
  } catch (err) {
    console.error('VNPay return error:', err);
    const bubbleUrl = process.env.BUBBLE_URL || 'https://nathansteyn96.bubbleapps.io';
    res.redirect(`${bubbleUrl}/version-test?payment=failed&reason=server_error`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STRIPE — Create Checkout Session
// POST /payment/create-stripe-session
// Body: { planKey: 'student_premium' | 'family' | 'teacher_pro' }
// ─────────────────────────────────────────────────────────────────────────────
app.post('/payment/create-stripe-session', authenticate, async (req, res) => {
  try {
    const { planKey } = req.body;
    const plan = PLANS[planKey];
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });

    const bubbleUrl = process.env.BUBBLE_URL || 'https://nathansteyn96.bubbleapps.io';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `EduBot ${plan.label}` },
          unit_amount: plan.usd_cents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${bubbleUrl}/version-test?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${bubbleUrl}/version-test?payment=cancelled`,
      metadata: {
        user_id:  String(req.user.id),
        plan_key: planKey,
      },
    });

    // Log pending payment — store session.id as txn_ref so verify route can look it up
    await pool.query(
      `INSERT INTO payments (user_id, plan, gateway, amount, currency, txn_ref, status, created_at)
       VALUES ($1, $2, 'stripe', $3, 'USD', $4, 'pending', NOW())`,
      [req.user.id, planKey, plan.usd_cents, session.id]
    );

    res.json({ sessionUrl: session.url });
  } catch (err) {
    console.error('Stripe session error:', err);
    res.status(500).json({ error: 'Failed to create Stripe session' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STRIPE — Verify payment after redirect (no webhook needed)
// POST /payment/verify-stripe
// Body: { sessionId: 'cs_...' }
// Bubble calls this after the user lands back with ?payment=success&session_id=cs_...
// ─────────────────────────────────────────────────────────────────────────────
app.post('/payment/verify-stripe', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

    // Ask Stripe directly whether this session was paid
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed', status: session.payment_status });
    }

    // Make sure this session belongs to the logged-in user
    const expectedUserId = String(req.user.id);
    if (session.metadata.user_id !== expectedUserId) {
      return res.status(403).json({ error: 'Session does not belong to this user' });
    }

    const planKey = session.metadata.plan_key;

    // Only upgrade if not already done (idempotent)
    const existing = await pool.query(
      'SELECT status FROM payments WHERE txn_ref = $1',
      [sessionId]
    );

    if (existing.rows.length === 0 || existing.rows[0].status !== 'success') {
      await upgradePlan(req.user.id, planKey);
      await pool.query(
        `INSERT INTO payments (user_id, plan, gateway, amount, currency, txn_ref, status, created_at)
         VALUES ($1, $2, 'stripe', $3, 'USD', $4, 'success', NOW())
         ON CONFLICT (txn_ref) DO UPDATE SET status = 'success'`,
        [req.user.id, planKey, PLANS[planKey].usd_cents, sessionId]
      );
    }

    // Return updated plan to Bubble
    const user = await pool.query('SELECT plan, role FROM users WHERE id = $1', [req.user.id]);
    res.json({ success: true, plan: user.rows[0].plan });
  } catch (err) {
    console.error('Stripe verify error:', err);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT — Get current plan status
// GET /payment/status
// ─────────────────────────────────────────────────────────────────────────────
app.get('/payment/status', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT plan, role FROM users WHERE id = $1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get payment status' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// START SERVER — creates payments table automatically on first boot
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

async function startServer() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      plan VARCHAR(50),
      gateway VARCHAR(20),
      amount INTEGER,
      currency VARCHAR(10),
      txn_ref VARCHAR(255) UNIQUE,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('Payments table ready');
  app.listen(PORT, () => console.log(`EduBot Vietnam running on port ${PORT}`));
}

startServer();
