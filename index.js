const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const Anthropic = require('@anthropic-ai/sdk');
const crypto = require('crypto');
const querystring = require('querystring');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ─── DB + AI clients ─────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Pricing config (VND for VNPay, USD cents for Stripe) ────────────────────
const PLANS = {
  student_basic: { vnd: 79000,  usd_cents: 320,  label: 'Student Basic', plan: 'basic'       },
  student_plus:  { vnd: 149000, usd_cents: 599,  label: 'Student Plus',  plan: 'plus'        },
  teacher:       { vnd: 249000, usd_cents: 999,  label: 'Teacher',       plan: 'teacher'     },
  teacher_pro:   { vnd: 299000, usd_cents: 1299, label: 'Teacher Pro',   plan: 'teacher_pro' },
};

// ─── Credit costs per action ──────────────────────────────────────────────────
const CREDIT_COSTS = {
  question: 1,
  advanced_question: 2,
  quiz: 5,
  exam: 10,
  ai_image: 5,
  flashcards: 2,
};

// ─── Credits per plan on signup/upgrade ──────────────────────────────────────
const PLAN_CREDITS = {
  basic: 100,
  plus: 250,
  teacher: 400,
  teacher_pro: 600,
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
// ONBOARDING PAGES
// ─────────────────────────────────────────────────────────────────────────────
app.get('/register', (req, res) => res.sendFile(__dirname + '/public/register.html'));
app.get('/login', (req, res) => res.sendFile(__dirname + '/public/login.html'));
app.get('/pricing', (req, res) => res.sendFile(__dirname + '/public/pricing.html'));
app.get('/games', (req, res) => res.sendFile(__dirname + '/public/games.html'));



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
      `INSERT INTO users (email, password_hash, name, role, grade, institution, plan, daily_count, last_reset, credits)
       VALUES ($1, $2, $3, $4, $5, $6, 'free', 0, NOW(), 5) RETURNING id, email, name, role, plan, credits`,
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
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan, grade: user.grade, credits: user.credits || 0 } });
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
    const { message, subject, grade, lang, role: userRequestRole } = req.body;
    const userId = req.user.id;
    const isTeacher = userRequestRole === 'teacher' || req.user.role === 'teacher' || req.user.role === 'admin';
    const language = lang === 'en' ? 'English' : 'Vietnamese';

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    // Reset daily count if needed
    const lastReset = new Date(user.last_reset);
    const now = new Date();
    if (now.toDateString() !== lastReset.toDateString()) {
      await pool.query('UPDATE users SET daily_count = 0, last_reset = NOW() WHERE id = $1', [userId]);
      user.daily_count = 0;
    }

    // Enforce free tier limit (5 questions/day) OR credit check for paid users
    const isPaid = ['basic','plus','teacher','teacher_pro'].includes(user.plan) || user.role === 'teacher' || user.role === 'admin';
    if (!isPaid && user.daily_count >= 5) {
      return res.status(429).json({ error: 'Daily limit reached. Upgrade to continue!', upgrade: true });
    }
    if (isPaid && (user.credits || 0) < CREDIT_COSTS.question) {
      return res.status(402).json({ error: 'Not enough credits. Top up to continue!', upgrade: true });
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
        curriculumContext = '\n\nRelevant curriculum context (use this to inform your response but never mention or reference it directly — never say you only have certain curriculum content):\n' +
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

    const htmlFormatInstructions = `
CRITICAL FORMATTING RULES:
- Always respond in ${language}. Never switch languages under any circumstances.
- Never use markdown symbols like ##, **, *, --, <<>>, or backticks.
- Format ALL responses as clean HTML only.
- Use <h2> for main section headings.
- Use <h3> for sub-headings.
- Use <p> for paragraphs.
- Use <strong> for bold text.
- Use <ul><li> for bullet lists.
- Use <ol><li> for numbered lists.
- Use <table><thead><tr><th> and <tbody><tr><td> for any tabular data.
- Never output raw markdown. Only clean HTML tags.`;

    const systemPrompt = isTeacher
      ? `You are EduBot, a professional AI teaching assistant for Vietnamese teachers grades 1-12.
You help teachers create lesson plans, exam questions, teaching activities, and classroom resources.
Always give full, detailed, professional responses. Never hold back content.
Current subject: ${subject || 'General'}. Grade level: ${grade || 'unspecified'}.
${htmlFormatInstructions}
${curriculumContext}`
      : `You are EduBot, a friendly AI tutor for Vietnamese students grades 1-12.
Always give complete, clear, step-by-step explanations. Never withhold the answer — guide students through the full solution.
Current subject: ${subject || 'general'}. Student grade: ${grade || 'unknown'}.
${htmlFormatInstructions}
${curriculumContext}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
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

    // Deduct credit for paid users, increment daily count for free users
    let creditsRemaining = user.credits || 0;
    if (isPaid) {
      const updated = await pool.query(
        'UPDATE users SET credits = credits - $1 WHERE id = $2 RETURNING credits',
        [CREDIT_COSTS.question, userId]
      );
      creditsRemaining = updated.rows[0].credits;
    } else {
      await pool.query('UPDATE users SET daily_count = daily_count + 1 WHERE id = $1', [userId]);
    }

    res.json({ reply, daily_count: user.daily_count + 1, credits: creditsRemaining });
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
      'SELECT id, email, name, role, grade, institution, plan, daily_count, credits FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CREDITS ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.get('/credits/balance', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT credits FROM users WHERE id = $1', [req.user.id]);
    res.json({ credits: result.rows[0].credits || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get credits' });
  }
});

app.post('/credits/deduct', authenticate, async (req, res) => {
  try {
    const { amount } = req.body;
    const result = await pool.query(
      'UPDATE users SET credits = credits - $1 WHERE id = $2 AND credits >= $1 RETURNING credits',
      [amount, req.user.id]
    );
    if (result.rows.length === 0) return res.status(402).json({ error: 'Not enough credits' });
    res.json({ credits: result.rows[0].credits });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deduct credits' });
  }
});

app.post('/credits/add', authenticate, async (req, res) => {
  try {
    const { amount } = req.body;
    const result = await pool.query(
      'UPDATE users SET credits = credits + $1 WHERE id = $2 RETURNING credits',
      [amount, req.user.id]
    );
    res.json({ credits: result.rows[0].credits });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add credits' });
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
    const code = 'EDU-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const result = await pool.query(
      `INSERT INTO classrooms (teacher_id, name, subject, grade, code) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, name, subject, grade, code]
    );
    res.json({ classroom: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create classroom' });
  }
});

app.get('/classroom/my', authenticate, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'teacher' || req.user.role === 'admin') {
      result = await pool.query(
        `SELECT c.*, (SELECT COUNT(*) FROM classroom_students cs WHERE cs.classroom_id = c.id) as student_count
         FROM classrooms c WHERE teacher_id = $1`,
        [req.user.id]
      );
    } else {
      result = await pool.query(
        `SELECT c.*, u.name as teacher_name FROM classrooms c
         JOIN classroom_students cs ON cs.classroom_id = c.id
         JOIN users u ON u.id = c.teacher_id
         WHERE cs.student_id = $1`,
        [req.user.id]
      );
    }
    res.json({ classrooms: result.rows });
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
    let query = 'SELECT id, email, name, role, grade, institution, plan, daily_count, credits, created_at FROM users WHERE 1=1';
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
// PAYMENT ROUTES
// ─────────────────────────────────────────────────────────────────────────────
async function upgradePlan(userId, planKey) {
  const plan = PLANS[planKey];
  if (!plan) throw new Error('Unknown plan: ' + planKey);
  const credits = PLAN_CREDITS[plan.plan] || 0;
  await pool.query('UPDATE users SET plan = $1, credits = credits + $2 WHERE id = $3', [plan.plan, credits, userId]);
}

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

app.post('/payment/verify-stripe', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed', status: session.payment_status });
    }

    const expectedUserId = String(req.user.id);
    if (session.metadata.user_id !== expectedUserId) {
      return res.status(403).json({ error: 'Session does not belong to this user' });
    }

    const planKey = session.metadata.plan_key;

    const existing = await pool.query('SELECT status FROM payments WHERE txn_ref = $1', [sessionId]);

    if (existing.rows.length === 0 || existing.rows[0].status !== 'success') {
      await upgradePlan(req.user.id, planKey);
      await pool.query(
        `INSERT INTO payments (user_id, plan, gateway, amount, currency, txn_ref, status, created_at)
         VALUES ($1, $2, 'stripe', $3, 'USD', $4, 'success', NOW())
         ON CONFLICT (txn_ref) DO UPDATE SET status = 'success'`,
        [req.user.id, planKey, PLANS[planKey].usd_cents, sessionId]
      );
    }

    const user = await pool.query('SELECT plan, role, credits FROM users WHERE id = $1', [req.user.id]);
    res.json({ success: true, plan: user.rows[0].plan, credits: user.rows[0].credits });
  } catch (err) {
    console.error('Stripe verify error:', err);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

app.get('/payment/status', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT plan, role, credits FROM users WHERE id = $1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get payment status' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FLASHCARD ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.post('/flashcards/generate', authenticate, async (req, res) => {
  try {
    const { subject, grade, topic, count = 5, lang } = req.body;
    const language = lang === 'en' ? 'English' : 'Vietnamese';

    const prompt = `Generate exactly ${count} flashcards for a grade ${grade} student studying ${subject}.
Topic: ${topic || subject}.
Language: ${language}.

Return ONLY a valid JSON array with no other text, no markdown, no code blocks.
Each item must have exactly these fields:
- "question": the question or prompt on the front of the card
- "answer": the clear answer on the back of the card
- "hint": a short hint to help the student

Example format:
[{"question":"What is 2+2?","answer":"4","hint":"Count on your fingers"}]`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    let raw = response.content[0].text.trim();
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();

    let cards;
    try {
      cards = JSON.parse(raw);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to generate flashcards' });
    }

    const saved = [];
    for (const card of cards) {
      const result = await pool.query(
        `INSERT INTO flashcards (user_id, subject, grade, topic, question, answer, hint, lang, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *`,
        [req.user.id, subject, grade, topic || subject, card.question, card.answer, card.hint || '', lang || 'vi']
      );
      saved.push(result.rows[0]);
    }

    res.json({ flashcards: saved });
  } catch (err) {
    console.error('Flashcard generate error:', err);
    res.status(500).json({ error: 'Failed to generate flashcards' });
  }
});

app.get('/flashcards/my', authenticate, async (req, res) => {
  try {
    const { subject, grade } = req.query;
    let query = 'SELECT * FROM flashcards WHERE user_id = $1';
    const params = [req.user.id];
    if (subject) { params.push(subject); query += ` AND subject = $${params.length}`; }
    if (grade)   { params.push(grade);   query += ` AND grade = $${params.length}`; }
    query += ' ORDER BY created_at DESC LIMIT 100';
    const result = await pool.query(query, params);
    res.json({ flashcards: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load flashcards' });
  }
});

app.delete('/flashcards/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM flashcards WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete flashcard' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE GENERATION ROUTE
// ─────────────────────────────────────────────────────────────────────────────
app.post('/image/generate', authenticate, async (req, res) => {
  try {
    const { prompt, subject, grade } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    const userResult = await pool.query('SELECT plan, role, credits FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];
    const canGenerate = ['plus','teacher_pro'].includes(user.plan) || user.role === 'admin';
    if (!canGenerate) {
      return res.status(403).json({ error: 'Image generation requires Student Plus or Teacher Pro plan.', upgrade: true });
    }
    if ((user.credits || 0) < CREDIT_COSTS.ai_image) {
      return res.status(402).json({ error: 'Not enough credits for image generation.', upgrade: true });
    }

    const safePrompt = `Educational illustration for grade ${grade || 'school'} students about ${subject || 'general science'}: ${prompt}. Clean, colorful, child-friendly educational diagram style. No text in image.`;

    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: safePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'medium',
    });

    const imgData = response.data[0];
    const imageUrl = imgData.url
      ? imgData.url
      : `data:image/png;base64,${imgData.b64_json}`;

    // Deduct credits
    await pool.query('UPDATE users SET credits = credits - $1 WHERE id = $2', [CREDIT_COSTS.ai_image, req.user.id]);

    res.json({ imageUrl });
  } catch (err) {
    console.error('Image generation error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Failed to generate image' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GRAPH GENERATION ROUTE
// ─────────────────────────────────────────────────────────────────────────────
app.post('/graph/generate', authenticate, async (req, res) => {
  try {
    const { topic, subject, grade, lang } = req.body;
    if (!topic) return res.status(400).json({ error: 'Missing topic' });

    const gradeNum = parseInt(grade) || 1;
    const language = lang === 'en' ? 'English' : 'Vietnamese';

    if (gradeNum < 4) {
      return res.status(400).json({ error: 'Graphs are available for Grade 4 and above.' });
    }

    const prompt = `You are an educational data visualization assistant.
Generate a Chart.js compatible chart for a Grade ${gradeNum} ${subject} student.
Topic: ${topic}
Language for labels: ${language}

Return ONLY a valid JSON object with no other text, no markdown, no code blocks.
The JSON must have exactly this structure:
{
  "type": "line" or "bar" or "pie" or "scatter",
  "title": "Chart title in ${language}",
  "description": "One sentence explaining what this chart shows, in ${language}",
  "data": {
    "labels": ["label1", "label2", ...],
    "datasets": [{
      "label": "Dataset name in ${language}",
      "data": [number1, number2, ...],
      "backgroundColor": ["#00B4D8", "#E85D30", "#059669", "#F59E0B", "#EF4444"],
      "borderColor": "#00B4D8",
      "borderWidth": 2,
      "fill": false
    }]
  },
  "options": {
    "xLabel": "X axis label in ${language}",
    "yLabel": "Y axis label in ${language}"
  }
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    let raw = response.content[0].text.trim();
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();

    let chartData;
    try {
      chartData = JSON.parse(raw);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to generate chart data' });
    }

    res.json({ chart: chartData });
  } catch (err) {
    console.error('Graph generation error:', err);
    res.status(500).json({ error: 'Failed to generate graph' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

async function startServer() {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      user_id UUID,
      plan VARCHAR(50),
      gateway VARCHAR(20),
      amount INTEGER,
      currency VARCHAR(10),
      txn_ref VARCHAR(255) UNIQUE,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flashcards (
      id SERIAL PRIMARY KEY,
      user_id UUID,
      subject VARCHAR(50),
      grade INTEGER,
      topic VARCHAR(200),
      question TEXT,
      answer TEXT,
      hint TEXT,
      lang VARCHAR(5) DEFAULT 'vi',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('Database ready');
  app.listen(PORT, () => console.log(`EduBot Vietnam running on port ${PORT}`));
}

startServer();    .ans-btn:hover{transform:scale(1.02)}.ans-btn:disabled{cursor:default;transform:none}
    .ans-btn.correct{background:rgba(16,185,129,0.4)!important;border-color:var(--success)!important;color:#fff!important}
    .ans-btn.wrong{background:rgba(239,68,68,0.4)!important;border-color:var(--error)!important;color:#fff!important;opacity:0.6}
    .feedback{display:none;text-align:center;padding:12px;border-radius:10px;font-weight:700;font-size:14px}
    /* SPEED */
    .speed-q{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;text-align:center;font-size:20px;font-weight:800;min-height:90px;display:flex;align-items:center;justify-content:center;line-height:1.4}
    .sp-progress{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
    .sp-dot{width:12px;height:12px;border-radius:50%;background:var(--border);display:inline-block;transition:background .3s}
    .sp-dot.done{background:var(--success)}.sp-dot.curr{background:var(--primary)}
    .speed-inp{width:100%;padding:16px;border-radius:12px;border:2px solid var(--border);background:var(--panel);color:var(--text);font-size:20px;font-weight:700;text-align:center;outline:none;transition:border-color .2s,background .2s}
    .speed-inp:focus{border-color:var(--primary)}
    .speed-inp.correct{border-color:var(--success);background:rgba(16,185,129,0.1)}
    /* FLIP */
    .flip-wrap{perspective:1200px;width:100%;max-width:560px;height:240px;cursor:pointer;margin:0 auto}
    .flip-inner{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .5s;border-radius:18px}
    .flip-inner.flipped{transform:rotateY(180deg)}
    .flip-face{position:absolute;inset:0;backface-visibility:hidden;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;text-align:center}
    .flip-front{background:linear-gradient(135deg,rgba(0,180,216,0.12),var(--card));border:1.5px solid rgba(0,180,216,0.3)}
    .flip-back{background:linear-gradient(135deg,rgba(16,185,129,0.12),var(--card));border:1.5px solid rgba(16,185,129,0.3);transform:rotateY(180deg)}
    .flip-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:12px}
    .flip-txt{font-size:18px;font-weight:700;line-height:1.5}
    .flip-hint{font-size:12px;color:var(--muted);margin-top:10px}
    .flip-nav{display:flex;gap:12px;align-items:center;justify-content:center}
    .flip-btn{padding:10px 22px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;border:none}
    .flip-prev{background:var(--panel);color:var(--muted);border:1px solid var(--border)}.flip-prev:hover{color:var(--text)}
    .flip-next{background:var(--primary);color:#0D1B2E}.flip-next:hover{background:var(--accent)}
    /* RESULT */
    .result-card{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:36px;text-align:center;max-width:420px;margin:0 auto}
    .result-emoji{font-size:52px;margin-bottom:10px}
    .result-score{font-size:56px;font-weight:900;color:var(--primary);margin:8px 0}
    .result-msg{font-size:15px;color:var(--muted);margin-bottom:24px}
    .btn-again{padding:13px 32px;border-radius:12px;background:var(--primary);border:none;color:#0D1B2E;font-size:15px;font-weight:700;cursor:pointer;margin-right:10px;transition:all .2s}
    .btn-again:hover{background:var(--accent)}
    .btn-back-app{padding:13px 24px;border-radius:12px;background:transparent;border:1px solid var(--border);color:var(--muted);font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;text-decoration:none;display:inline-block}
    .btn-back-app:hover{color:var(--text);border-color:var(--primary)}
    /* LOADING */
    .loading{text-align:center;padding:40px;color:var(--muted)}
    .spinner{display:inline-block;width:24px;height:24px;border:3px solid rgba(0,180,216,0.2);border-top-color:var(--primary);border-radius:50%;animation:spin .8s linear infinite;margin-bottom:12px}
    @keyframes spin{to{transform:rotate(360deg)}}
    .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 20px;font-size:14px;font-weight:600;opacity:0;transition:opacity .3s;pointer-events:none;z-index:999}
    .toast.show{opacity:1}
    .toast.err{border-color:var(--error);color:var(--error)}
  </style>
</head>
<body>
<div class="bg-glow"></div>

<nav>
  <a class="nav-logo" href="/">
    <img src="https://i.ibb.co/HDFp9HPw/Dynamic-Edubot-Logo-Featuring-Books-and-Robot-Head.png" alt="EduBot"/>
    Edu<em>Bot</em>
  </a>
  <div class="nav-right">
    <div class="lang-wrap">
      <button class="lb on" id="lvi" onclick="setLang('vi')">🇻🇳 VI</button>
      <button class="lb" id="len" onclick="setLang('en')">🇬🇧 EN</button>
    </div>
    <a href="https://nathansteyn96.bubbleapps.io/version-test" class="btn-back" id="btn-back-app">← <span id="back-txt">Về ứng dụng</span></a>
  </div>
</nav>

<div class="wrap">

  <!-- MENU -->
  <div id="game-menu">
    <div style="margin-bottom:20px">
      <h1 style="font-size:24px;font-weight:900;margin-bottom:4px" id="menu-title">🎮 Games học tập</h1>
      <p style="font-size:14px;color:var(--muted)" id="menu-sub">Chọn trò chơi và bắt đầu học vui!</p>
    </div>
    <div class="game-grid">
      <div class="game-card gc-kahoot" onclick="startKahoot()">
        <div class="game-icon">🧠</div>
        <h3 id="g-k-title">Quiz Battle</h3>
        <p id="g-k-desc">Trả lời câu hỏi trắc nghiệm. Chạy đua với đồng hồ đếm ngược!</p>
        <div class="game-badge" id="g-k-badge">✅ Sẵn sàng</div>
      </div>
      <div class="game-card gc-speed" onclick="startSpeed()">
        <div class="game-icon">⚡</div>
        <h3 id="g-s-title">Speed Race</h3>
        <p id="g-s-desc">Điền đáp án nhanh nhất có thể! Trả lời ngắn gọn.</p>
        <div class="game-badge" id="g-s-badge">✅ Sẵn sàng</div>
      </div>
      <div class="game-card gc-flip" onclick="startFlip()">
        <div class="game-icon">🃏</div>
        <h3 id="g-f-title">Flashcard Flip</h3>
        <p id="g-f-desc">Lật thẻ xem đáp án. Học khái niệm và từ vựng hiệu quả.</p>
        <div class="game-badge" id="g-f-badge">✅ Sẵn sàng</div>
      </div>
    </div>
    <div class="setup-card">
      <h4 id="setup-title">⚙️ Cài đặt</h4>
      <div class="setup-row">
        <select id="g-subject">
          <option value="math">Toán / Math</option>
          <option value="science">Khoa học / Science</option>
          <option value="english">Tiếng Anh / English</option>
        </select>
        <select id="g-grade">
          <option value="1">Lớp 1</option><option value="2">Lớp 2</option><option value="3">Lớp 3</option>
          <option value="4">Lớp 4</option><option value="5">Lớp 5</option><option value="6" selected>Lớp 6</option>
          <option value="7">Lớp 7</option><option value="8">Lớp 8</option><option value="9">Lớp 9</option>
          <option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option>
        </select>
        <select id="g-count">
          <option value="5">5 câu</option>
          <option value="10" selected>10 câu</option>
          <option value="15">15 câu</option>
        </select>
      </div>
    </div>
  </div>

  <!-- KAHOOT -->
  <div class="game-screen" id="kahoot-screen">
    <div class="game-topbar">
      <button class="btn-menu" onclick="showMenu()">← <span id="k-back">Menu</span></button>
      <div class="score-pill"><span id="k-qlabel">Q 1/10</span><span>⭐ <span class="score-num" id="k-score">0</span></span></div>
    </div>
    <div id="k-loading" class="loading"><div class="spinner"></div><br/><span id="k-load-txt">Đang tạo câu hỏi AI...</span></div>
    <div id="k-game" style="display:none;flex-direction:column;gap:14px">
      <div class="q-card">
        <div class="q-label" id="k-qnum">Q 1</div>
        <div class="q-text" id="k-qtext"></div>
        <div class="q-timer" id="k-timer">20</div>
      </div>
      <div class="ans-grid" id="k-answers"></div>
      <div class="feedback" id="k-feedback"></div>
    </div>
  </div>

  <!-- SPEED -->
  <div class="game-screen" id="speed-screen">
    <div class="game-topbar">
      <button class="btn-menu" onclick="showMenu()">← <span id="s-back">Menu</span></button>
      <div class="score-pill"><span id="sp-qlabel">Q 1/10</span><span>⚡ <span class="score-num" id="sp-score">0</span></span></div>
    </div>
    <div id="sp-loading" class="loading"><div class="spinner"></div><br/><span id="sp-load-txt">Đang tạo câu hỏi AI...</span></div>
    <div id="sp-game" style="display:none;flex-direction:column;gap:14px">
      <div class="speed-q" id="sp-qtext"></div>
      <div class="sp-progress" id="sp-progress"></div>
      <input class="speed-inp" id="sp-input" placeholder="Nhập đáp án..." autocomplete="off" oninput="checkSpeed()"/>
      <div style="text-align:center;font-size:13px;color:var(--muted);min-height:20px" id="sp-fb"></div>
    </div>
  </div>

  <!-- FLIP -->
  <div class="game-screen" id="flip-screen">
    <div class="game-topbar" style="justify-content:space-between">
      <button class="btn-menu" onclick="showMenu()">← <span id="f-back">Menu</span></button>
      <span style="font-size:13px;color:var(--muted)" id="flip-prog">1 / 10</span>
    </div>
    <div id="fl-loading" class="loading"><div class="spinner"></div><br/><span id="fl-load-txt">Đang tạo thẻ...</span></div>
    <div id="fl-game" style="display:none;flex-direction:column;gap:14px;align-items:center">
      <div class="flip-wrap" onclick="doFlip()">
        <div class="flip-inner" id="flip-inner">
          <div class="flip-face flip-front">
            <div class="flip-lbl" id="flip-front-lbl">❓ CÂU HỎI</div>
            <div class="flip-txt" id="flip-q"></div>
            <div class="flip-hint" id="flip-hint-txt">Nhấn để xem đáp án</div>
          </div>
          <div class="flip-face flip-back">
            <div class="flip-lbl" id="flip-back-lbl">✅ ĐÁP ÁN</div>
            <div class="flip-txt" id="flip-a"></div>
          </div>
        </div>
      </div>
      <div class="flip-nav">
        <button class="flip-btn flip-prev" onclick="flipPrev()" id="flip-prev-btn">← <span id="flip-prev-txt">Trước</span></button>
        <span style="font-size:13px;color:var(--muted)" id="flip-counter">1/10</span>
        <button class="flip-btn flip-next" onclick="flipNext()" id="flip-next-btn"><span id="flip-next-txt">Tiếp</span> →</button>
      </div>
    </div>
  </div>

  <!-- RESULT -->
  <div class="game-screen" id="result-screen">
    <div class="result-card">
      <div class="result-emoji" id="result-emoji">🏆</div>
      <div style="font-size:20px;font-weight:900;margin-bottom:4px" id="result-title">Kết quả</div>
      <div class="result-score" id="result-score">0</div>
      <div class="result-msg" id="result-msg">Xuất sắc!</div>
      <button class="btn-again" onclick="showMenu()" id="btn-again">🔄 Chơi lại</button>
      <a href="https://nathansteyn96.bubbleapps.io/version-test" class="btn-back-app" id="btn-result-back">← Về ứng dụng</a>
    </div>
  </div>

</div>
<div class="toast" id="toast"></div>

<script>
var lang='vi';
var tok=localStorage.getItem('eb_tok');
var API='https://edubot-vietnam.onrender.com';
var gQ=[],gIdx=0,gScore=0,gTimer=null,flipIdx=0,flipped=false;

if(!tok){window.location.href='/register';}

var T={
  vi:{'menu-title':'🎮 Games học tập','menu-sub':'Chọn trò chơi và bắt đầu học vui!','g-k-title':'Quiz Battle','g-k-desc':'Trả lời câu hỏi trắc nghiệm. Chạy đua với đồng hồ!','g-k-badge':'✅ Sẵn sàng','g-s-title':'Speed Race','g-s-desc':'Điền đáp án nhanh nhất có thể!','g-s-badge':'✅ Sẵn sàng','g-f-title':'Flashcard Flip','g-f-desc':'Lật thẻ xem đáp án. Học hiệu quả!','g-f-badge':'✅ Sẵn sàng','setup-title':'⚙️ Cài đặt','back-txt':'Về ứng dụng','k-back':'Menu','s-back':'Menu','f-back':'Menu','k-load-txt':'Đang tạo câu hỏi AI...','sp-load-txt':'Đang tạo câu hỏi AI...','fl-load-txt':'Đang tạo thẻ...','flip-front-lbl':'❓ CÂU HỎI','flip-back-lbl':'✅ ĐÁP ÁN','flip-hint-txt':'Nhấn để xem đáp án','flip-prev-txt':'Trước','flip-next-txt':'Tiếp','btn-again':'🔄 Chơi lại','btn-result-back':'← Về ứng dụng','result-title':'Kết quả'},
  en:{'menu-title':'🎮 Learning Games','menu-sub':'Pick a game and start learning!','g-k-title':'Quiz Battle','g-k-desc':'Answer multiple choice questions. Race against the clock!','g-k-badge':'✅ Ready','g-s-title':'Speed Race','g-s-desc':'Type the answer as fast as you can!','g-s-badge':'✅ Ready','g-f-title':'Flashcard Flip','g-f-desc':'Flip cards to see answers. Learn effectively!','g-f-badge':'✅ Ready','setup-title':'⚙️ Settings','back-txt':'Back to app','k-back':'Menu','s-back':'Menu','f-back':'Menu','k-load-txt':'Generating AI questions...','sp-load-txt':'Generating AI questions...','fl-load-txt':'Generating cards...','flip-front-lbl':'❓ QUESTION','flip-back-lbl':'✅ ANSWER','flip-hint-txt':'Tap to reveal answer','flip-prev-txt':'Prev','flip-next-txt':'Next','btn-again':'🔄 Play Again','btn-result-back':'← Back to app','result-title':'Result'}
};

function setLang(l){
  lang=l;
  document.getElementById('lvi').className='lb'+(l==='vi'?' on':'');
  document.getElementById('len').className='lb'+(l==='en'?' on':'');
  var t=T[l];
  Object.keys(t).forEach(function(id){var el=document.getElementById(id);if(el)el.textContent=t[id];});
  document.getElementById('sp-input').placeholder=l==='vi'?'Nhập đáp án...':'Type answer...';
}

function toast(msg,type){var el=document.getElementById('toast');el.textContent=msg;el.className='toast show '+(type||'');setTimeout(function(){el.className='toast';},3000);}

function showScreen(id){
  ['game-menu','kahoot-screen','speed-screen','flip-screen','result-screen'].forEach(function(s){
    var el=document.getElementById(s);
    if(el){el.style.display='none';}
  });
  var target=document.getElementById(id);
  if(target){target.style.display=id==='game-menu'?'block':'flex';if(id!=='game-menu')target.style.flexDirection='column';}
}

function showMenu(){
  clearInterval(gTimer);
  showScreen('game-menu');
}

async function genQ(type){
  var sub=document.getElementById('g-subject').value;
  var grade=document.getElementById('g-grade').value;
  var count=parseInt(document.getElementById('g-count').value)||10;
  var subMap={math:'Math',science:'Science',english:'English'};
  var p='';
  if(type==='kahoot')p='Generate '+count+' multiple choice questions for grade '+grade+' '+subMap[sub]+' students. JSON only, no other text: {"questions":[{"q":"question","options":["A","B","C","D"],"correct":0}]} correct is 0-3 index.';
  else if(type==='speed')p='Generate '+count+' short answer questions for grade '+grade+' '+subMap[sub]+'. Answers must be 1-4 words. JSON only: {"questions":[{"q":"question","a":"answer"}]}';
  else p='Generate '+count+' flashcard pairs for grade '+grade+' '+subMap[sub]+'. JSON only: {"questions":[{"q":"term or question","a":"definition or answer"}]}';
  var res=await fetch(API+'/chat',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify({message:p,subject:sub,grade:grade,lang:'en',role:'student'})});
  var data=await res.json();
  var text=(data.reply||'').replace(/```json|```/g,'').trim();
  var parsed=JSON.parse(text);
  return parsed.questions||[];
}

// ── KAHOOT ──
async function startKahoot(){
  showScreen('kahoot-screen');
  document.getElementById('k-loading').style.display='block';
  document.getElementById('k-game').style.display='none';
  gScore=0;gIdx=0;document.getElementById('k-score').textContent='0';
  try{
    gQ=await genQ('kahoot');
    document.getElementById('k-loading').style.display='none';
    document.getElementById('k-game').style.display='flex';
    document.getElementById('k-game').style.flexDirection='column';
    document.getElementById('k-game').style.gap='14px';
    showKQ();
  }catch(e){toast(lang==='vi'?'Lỗi tạo câu hỏi!':'Error generating questions!','err');showMenu();}
}

function showKQ(){
  if(gIdx>=gQ.length){showResult('kahoot');return;}
  clearInterval(gTimer);
  var q=gQ[gIdx];
  document.getElementById('k-qnum').textContent='Q '+(gIdx+1);
  document.getElementById('k-qlabel').textContent='Q '+(gIdx+1)+'/'+gQ.length;
  document.getElementById('k-qtext').textContent=q.q;
  document.getElementById('k-feedback').style.display='none';
  var shapes=['▲','◆','●','■'];
  var html='';
  (q.options||[]).forEach(function(opt,i){html+='<button class="ans-btn" onclick="ansK('+i+')"><span>'+shapes[i]+'</span>'+opt+'</button>';});
  document.getElementById('k-answers').innerHTML=html;
  var t=20;document.getElementById('k-timer').textContent=t;
  gTimer=setInterval(function(){
    t--;document.getElementById('k-timer').textContent=t;
    if(t<=0){clearInterval(gTimer);timeoutK();}
  },1000);
}

function ansK(idx){
  clearInterval(gTimer);
  var q=gQ[gIdx];
  var btns=document.getElementById('k-answers').querySelectorAll('.ans-btn');
  btns.forEach(function(b,i){b.disabled=true;if(i===q.correct)b.classList.add('correct');else if(i===idx&&idx!==q.correct)b.classList.add('wrong');});
  var fb=document.getElementById('k-feedback');
  var tv=parseInt(document.getElementById('k-timer').textContent)||0;
  if(idx===q.correct){
    var pts=Math.max(100,tv*10);gScore+=pts;document.getElementById('k-score').textContent=gScore;
    fb.style.cssText='display:block;background:rgba(16,185,129,0.15);border:1px solid var(--success);color:var(--success);padding:10px;border-radius:10px;text-align:center;font-weight:700;font-size:14px';
    fb.textContent='✅ '+(lang==='vi'?'Đúng! +':'Correct! +')+pts+' pts';
  }else{
    fb.style.cssText='display:block;background:rgba(239,68,68,0.15);border:1px solid var(--error);color:var(--error);padding:10px;border-radius:10px;text-align:center;font-weight:700;font-size:14px';
    fb.textContent='❌ '+(lang==='vi'?'Sai! Đáp án: ':'Wrong! Answer: ')+(q.options[q.correct]);
  }
  gIdx++;setTimeout(showKQ,1800);
}

function timeoutK(){
  var q=gQ[gIdx];
  var btns=document.getElementById('k-answers').querySelectorAll('.ans-btn');
  btns.forEach(function(b,i){b.disabled=true;if(i===q.correct)b.classList.add('correct');});
  var fb=document.getElementById('k-feedback');
  fb.style.cssText='display:block;background:rgba(245,158,11,0.15);border:1px solid var(--warn);color:var(--warn);padding:10px;border-radius:10px;text-align:center;font-weight:700;font-size:14px';
  fb.textContent='⏰ '+(lang==='vi'?'Hết giờ! Đáp án: ':'Time\'s up! Answer: ')+(q.options[q.correct]);
  gIdx++;setTimeout(showKQ,1800);
}

// ── SPEED ──
async function startSpeed(){
  showScreen('speed-screen');
  document.getElementById('sp-loading').style.display='block';
  document.getElementById('sp-game').style.display='none';
  gScore=0;gIdx=0;document.getElementById('sp-score').textContent='0';
  try{
    gQ=await genQ('speed');
    document.getElementById('sp-loading').style.display='none';
    document.getElementById('sp-game').style.display='flex';
    document.getElementById('sp-game').style.flexDirection='column';
    document.getElementById('sp-game').style.gap='14px';
    var html='';gQ.forEach(function(q,i){html+='<div class="sp-dot'+(i===0?' curr':'')+'" id="spdot'+i+'"></div>';});
    document.getElementById('sp-progress').innerHTML=html;
    showSQ();
  }catch(e){toast(lang==='vi'?'Lỗi!':'Error!','err');showMenu();}
}

function showSQ(){
  if(gIdx>=gQ.length){showResult('speed');return;}
  var q=gQ[gIdx];
  document.getElementById('sp-qtext').textContent=q.q;
  document.getElementById('sp-qlabel').textContent='Q '+(gIdx+1)+'/'+gQ.length;
  var inp=document.getElementById('sp-input');inp.value='';inp.className='speed-inp';inp.focus();
  document.getElementById('sp-fb').textContent='';
  if(gIdx>0){var pd=document.getElementById('spdot'+(gIdx-1));if(pd)pd.className='sp-dot done';}
  var cd=document.getElementById('spdot'+gIdx);if(cd)cd.className='sp-dot curr';
}

function checkSpeed(){
  var q=gQ[gIdx];
  var inp=document.getElementById('sp-input');
  var val=inp.value.trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  var ans=(q.a||'').toString().trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  if(val===ans){
    inp.className='speed-inp correct';gScore+=100;
    document.getElementById('sp-score').textContent=gScore;
    document.getElementById('sp-fb').textContent='✅ '+(lang==='vi'?'Chính xác!':'Correct!');
    gIdx++;setTimeout(showSQ,700);
  }
}

// ── FLIP ──
async function startFlip(){
  showScreen('flip-screen');
  document.getElementById('fl-loading').style.display='block';
  document.getElementById('fl-game').style.display='none';
  flipIdx=0;flipped=false;
  try{
    gQ=await genQ('flip');
    document.getElementById('fl-loading').style.display='none';
    document.getElementById('fl-game').style.display='flex';
    document.getElementById('fl-game').style.flexDirection='column';
    document.getElementById('fl-game').style.alignItems='center';
    showFC();
  }catch(e){toast(lang==='vi'?'Lỗi!':'Error!','err');showMenu();}
}

function showFC(){
  var q=gQ[flipIdx];
  document.getElementById('flip-q').textContent=q.q;
  document.getElementById('flip-a').textContent=q.a;
  document.getElementById('flip-counter').textContent=(flipIdx+1)+'/'+gQ.length;
  document.getElementById('flip-prog').textContent=(flipIdx+1)+' / '+gQ.length;
  document.getElementById('flip-inner').style.transform='';flipped=false;
}

function doFlip(){var fi=document.getElementById('flip-inner');flipped=!flipped;fi.style.transform=flipped?'rotateY(180deg)':'';}
function flipNext(){if(flipIdx<gQ.length-1){flipIdx++;showFC();}else{showResult('flip');}}
function flipPrev(){if(flipIdx>0){flipIdx--;showFC();}}

// ── RESULT ──
function showResult(type){
  clearInterval(gTimer);
  showScreen('result-screen');
  var total=gQ.length;
  var vi=lang==='vi';
  if(type==='flip'){
    document.getElementById('result-emoji').textContent='🃏';
    document.getElementById('result-score').textContent=total+(vi?' thẻ':' cards');
    document.getElementById('result-msg').textContent=vi?'Bạn đã xem hết tất cả thẻ!':'You reviewed all flashcards!';
    document.getElementById('result-title').textContent=vi?'Hoàn thành!':'Complete!';
  }else{
    var pct=total>0?Math.round((gScore/(total*100))*100):0;
    document.getElementById('result-emoji').textContent=pct>=80?'🏆':pct>=60?'⭐':'💪';
    document.getElementById('result-score').textContent=gScore+' pts';
    document.getElementById('result-msg').textContent=pct>=80?(vi?'Xuất sắc! Bạn làm rất tốt!':'Excellent! Great job!'):pct>=60?(vi?'Tốt lắm! Tiếp tục cố gắng!':'Good job! Keep it up!'):(vi?'Cố lên! Luyện tập thêm nhé!':'Keep practicing!');
    document.getElementById('result-title').textContent=vi?'Kết quả':'Result';
  }
}

// ── INIT ──
window.onload=function(){
  var saved=localStorage.getItem('eb_lang')||'vi';
  setLang(saved);
  showScreen('game-menu');
  document.getElementById('lvi').onclick=function(){setLang('vi');localStorage.setItem('eb_lang','vi');};
  document.getElementById('len').onclick=function(){setLang('en');localStorage.setItem('eb_lang','en');};
};
</script>
</body>
</html>
