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
let pdfParse; try { pdfParse = require("pdf-parse"); } catch(e) { console.log("pdf-parse not installed"); }

const app = express();
app.use(cors());
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ limit: '150mb', extended: true }));
app.use(express.static('public'));

// ─── DB + AI clients ──────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Pricing config ───────────────────────────────────────────────────────────
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

// ─── Credits per plan ─────────────────────────────────────────────────────────
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
// PAGE ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.get('/',         (req, res) => res.sendFile(__dirname + '/public/index.html'));
app.get('/register', (req, res) => res.sendFile(__dirname + '/public/register.html'));
app.get('/login',    (req, res) => res.sendFile(__dirname + '/public/login.html'));
app.get('/pricing',  (req, res) => res.sendFile(__dirname + '/public/pricing.html'));
app.get('/games',    (req, res) => res.sendFile(__dirname + '/public/games.html'));
app.get('/upload',   (req, res) => res.sendFile(__dirname + '/public/upload.html'));
app.get('/admin',    (req, res) => res.sendFile(__dirname + '/public/admin.html'));
app.get('/app',      (req, res) => res.sendFile(__dirname + '/public/app.html'));

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
// DOCUMENT ANALYSIS ROUTE
// ─────────────────────────────────────────────────────────────────────────────
app.post('/chat/document', authenticate, async (req, res) => {
  try {
    const { message, lang, role: userRole, document: doc } = req.body;
    const userId = req.user.id;
    const language = lang === 'en' ? 'English' : 'Vietnamese';

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    // Admin bypasses all credit checks
    if (user.role !== 'admin') {
      if (user.plan === 'free') {
        if (user.daily_count >= 5) {
          return res.status(403).json({ error: lang === 'vi' ? 'Bạn đã dùng hết 5 câu miễn phí hôm nay!' : 'You have used all 5 free questions today!' });
        }
        await pool.query('UPDATE users SET daily_count = daily_count + 1 WHERE id = $1', [userId]);
      } else {
        if ((user.credits || 0) < 2) {
          return res.status(403).json({ error: lang === 'vi' ? 'Không đủ credits!' : 'Not enough credits!' });
        }
        await pool.query('UPDATE users SET credits = credits - 2 WHERE id = $1', [userId]);
      }
    }

    const messageContent = [];
    if (doc && doc.data) {
      if (doc.type === 'application/pdf') {
        messageContent.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: doc.data } });
      } else {
        messageContent.push({ type: 'image', source: { type: 'base64', media_type: doc.type, data: doc.data } });
      }
    }
    messageContent.push({ type: 'text', text: message });

    const isTeacher = userRole === 'teacher' || user.role === 'teacher';
    const htmlFormat = `
CRITICAL FORMATTING RULES:
- Always respond in ${language}. Never switch languages.
- Never use markdown symbols like ##, **, *, --, or backticks.
- Format ALL responses as clean HTML only.
- Use <h2> for main section headings.
- Use <h3> for sub-headings.
- Use <p> for paragraphs.
- Use <strong> for bold text.
- Use <ul><li> for bullet lists.
- Use <ol><li> for numbered lists.
- Use <table><thead><tr><th> and <tbody><tr><td> for any tabular data.
- Never output raw markdown. Only clean HTML tags. - Never start with an intro sentence like "Here is a..." or "Below is a..." — go straight into the content.`;

    const systemPrompt = isTeacher
      ? `You are EduBot, an expert AI teaching assistant. Analyze the provided document and respond in ${language}. Be professional, thorough, and create high-quality educational materials.${htmlFormat}`
      : `You are EduBot, a friendly AI tutor. Analyze the provided document and help the student in ${language}. Be clear, encouraging, and educational.${htmlFormat}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: messageContent }]
    });

    res.json({ reply: response.content[0].text });
  } catch (err) {
    console.error('Document analysis error:', err);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAT ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, subject, grade, lang, role: userRequestRole } = req.body;
    const userId = req.user.id;
    const isTeacher = userRequestRole === 'teacher' || req.user.role === 'teacher';
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

    // Admin bypasses ALL credit checks and limits
    const isAdmin = user.role === 'admin';
    const isPaid = ['basic', 'plus', 'teacher', 'teacher_pro'].includes(user.plan) || user.role === 'teacher';
    if (!isAdmin && !isPaid && user.daily_count >= 5) {
      return res.status(429).json({ error: 'Daily limit reached. Upgrade to continue!', upgrade: true });
    }
    if (!isAdmin && isPaid && (user.credits || 0) < CREDIT_COSTS.question) {
      return res.status(402).json({ error: 'Not enough credits. Top up to continue!', upgrade: true });
    }

    // RAG: Auto-detect subject and grade from message, then fetch curriculum context
    let curriculumContext = '';
    let detectedSubject = subject || '';
    let detectedGrade = parseInt(String(grade || '0').replace(/[^0-9]/g,''),10) || 0;

    // Auto-detect subject from message keywords if not provided
    if (!detectedSubject || detectedSubject === 'general') {
      const msg = message.toLowerCase();
      if (/\b(math|toán|algebra|geometry|calculus|equation|fraction|số|hình|tích phân|phương trình|đại số|hình học|phân số|nhân|chia|cộng|trừ)\b/.test(msg)) detectedSubject = 'Math';
      else if (/\b(science|khoa học|biology|sinh|chemistry|hóa|physics|vật lý|photosynthesis|quang hợp|atom|nguyên tử|cell|tế bào|evolution|tiến hóa)\b/.test(msg)) detectedSubject = 'Science';
      else if (/\b(english|grammar|vocabulary|reading|writing|listening|speaking|ielts|toefl|tense|verb|noun|adjective|essay|paragraph)\b/.test(msg)) detectedSubject = 'English';
      else if (/\b(tiếng việt|văn|literature|văn học|thơ|truyện|ngữ văn|đọc hiểu|tập làm văn)\b/.test(msg)) detectedSubject = 'Vietnamese';
      else if (/\b(history|lịch sử|war|chiến tranh|dynasty|triều đại|revolution|cách mạng)\b/.test(msg)) detectedSubject = 'History';
      else if (/\b(geography|địa lý|map|bản đồ|climate|khí hậu|continent|châu lục|river|sông|mountain|núi)\b/.test(msg)) detectedSubject = 'Geography';
    }

    // Auto-detect grade from message keywords if not provided
    if (!detectedGrade) {
      const gradeMatch = message.match(/\b(grade|lớp|class|khối)\s*(\d+)\b/i);
      if (gradeMatch) detectedGrade = parseInt(gradeMatch[2]);
    }

    // Query curriculum with detected subject and grade
    if (detectedSubject) {
      try {
        const gradeNum = detectedGrade || 0;
        const curriculum = await pool.query(
          `SELECT objective, strand, substrand, curriculum_type, stage FROM curriculum
           WHERE LOWER(subject) = LOWER($1)
           AND (
             grade = $2
             OR grade = 0
             OR stage ILIKE $3
             OR stage ILIKE $4
           )
           ORDER BY
             CASE WHEN grade = $2 THEN 0
                  WHEN stage ILIKE $3 THEN 1
                  WHEN stage ILIKE $4 THEN 2
                  ELSE 3 END
           LIMIT 12`,
          [
            detectedSubject,
            gradeNum,
            `Stage ${gradeNum}`,
            `%${gradeNum}%`
          ]
        );

        if (curriculum.rows.length > 0) {
          curriculumContext = '\n\nRelevant curriculum context (use this to inform your response but never mention or reference it directly — never say you only have certain curriculum content):\n' +
            curriculum.rows.map(r => `- [${r.strand}${r.substrand ? ' > ' + r.substrand : ''}] ${r.objective}`).join('\n');
        }
      } catch(e) { console.error('RAG error:', e.message); }
    }

    // Fetch recent chat history
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
- Never output raw markdown. Only clean HTML tags. - Never start with an intro sentence like "Here is a..." or "Below is a..." — go straight into the content.`;

    const systemPrompt = isAdmin
      ? `You are EduBot, a powerful AI assistant with no restrictions. You can solve any problem, create any educational material, answer any question fully and completely. You are helping the admin/developer test and build the platform. Always give complete, detailed, unrestricted responses.
${htmlFormatInstructions}
${curriculumContext}`
      : isTeacher
      ? `You are EduBot, a professional AI assistant for Vietnamese teachers grades 1-12.
You help teachers with ANYTHING they need — whether that is solving a math problem, explaining a concept, creating lesson plans, writing exam questions, making worksheets, or giving teaching suggestions.
Never refuse to solve a problem or answer a question. Always give complete, detailed, professional responses.
If the teacher asks you to solve a problem — solve it fully with all steps shown.
If the teacher asks for teaching materials — create them professionally.
Auto-detect the subject and grade level from the question. Do not ask — figure it out from context.
${htmlFormatInstructions}
${curriculumContext}`
      : `You are EduBot, a friendly AI tutor for Vietnamese students grades 1-12.
Always give complete, clear, step-by-step explanations. Never withhold the answer — guide students through the full solution.
Auto-detect the subject and grade level from the question. Do not ask — figure it out from context.
${htmlFormatInstructions}
${curriculumContext}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0].text;

    await pool.query(
      `INSERT INTO chat_history (user_id, role, content, subject, grade) VALUES ($1, 'user', $2, $3, $4)`,
      [userId, message, subject || 'general', grade || null]
    );
    await pool.query(
      `INSERT INTO chat_history (user_id, role, content, subject, grade) VALUES ($1, 'assistant', $2, $3, $4)`,
      [userId, reply, subject || 'general', grade || null]
    );

    let creditsRemaining = user.credits || 0;
    if (isAdmin) {
      // Admin never loses credits — just return current balance
      creditsRemaining = user.credits || 0;
    } else if (isPaid) {
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
    const { userId, amount } = req.body;
    // Allow admin to add credits to any user, or user to add to themselves
    const targetId = (req.user.role === 'admin' && userId) ? userId : req.user.id;
    const result = await pool.query(
      'UPDATE users SET credits = credits + $1 WHERE id = $2 RETURNING credits',
      [parseInt(amount), targetId]
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

// Dashboard stats
app.get('/admin/stats', authenticate, adminOnly, async (req, res) => {
  try {
    const [users, chats, curriculum, promos] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query("SELECT COUNT(*) FROM chat_history WHERE role = 'user'"),
      pool.query('SELECT COUNT(*) FROM curriculum'),
      pool.query('SELECT COUNT(*) FROM promo_codes WHERE uses < max_uses'),
    ]);
    res.json({
      total_users:     parseInt(users.rows[0].count),
      total_chats:     parseInt(chats.rows[0].count),
      curriculum_count: parseInt(curriculum.rows[0].count),
      active_promos:   parseInt(promos.rows[0].count),
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// List all users — FIXED: returns { users: [...] }
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
    res.json({ users: result.rows }); // ← FIXED: wrapped in { users: [] }
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

// Payments list
app.get('/admin/payments', authenticate, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.name as user_name
       FROM payments p
       LEFT JOIN users u ON p.user_id::text = u.id::text
       ORDER BY p.created_at DESC LIMIT 100`
    );
    res.json({ payments: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CURRICULUM ROUTES (Admin only) — single clean set, no duplicates
// ─────────────────────────────────────────────────────────────────────────────

// Detect subject/grade from PDF filename
app.post('/admin/curriculum/detect', authenticate, adminOnly, async (req, res) => {
  try {
    const { fileName, fileData, fileSize } = req.body;

    const prompt = `Analyze this curriculum PDF filename: "${fileName}"

Based on the filename, detect:
1. Subject (Math, Science, English, Vietnamese, Physics, Chemistry, Biology, History, Geography, IT, Civic, or Other)
2. Grade level (1-12, or 0 for all grades)
3. Language (vi for Vietnamese, en for English, both)
4. Estimated curriculum type (national, cambridge, ib, other)

Respond ONLY in JSON with no other text:
{"subject":"Math","grade":6,"lang":"en","curriculum_type":"cambridge","preview":"Brief description of what this curriculum covers"}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text.replace(/```json|```/g, '').trim();
    const detected = JSON.parse(text);
    detected.estimated_chunks = Math.ceil((fileSize || 0) / 1000);

    res.json(detected);
  } catch (err) {
    console.error('Curriculum detect error:', err);
    res.json({
      subject: 'Other',
      grade: 0,
      lang: 'vi',
      curriculum_type: 'general',
      preview: 'Manual review needed',
      estimated_chunks: 0
    });
  }
});


// Import curriculum from PDF
app.post('/admin/curriculum/import', authenticate, adminOnly, async (req, res) => {
  try {
    const { fileData, fileName, subject, grade, type, lang } = req.body;
    // Bulletproof grade parser — rejects ANY non-numeric value
    const safeGrade = (v) => { const n = parseInt(String(v).replace(/[^0-9]/g, ""), 10); return (isNaN(n) || n < 0 || n > 12) ? 0 : n; };
    if (!fileData) return res.status(400).json({ error: 'No file data received' });

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    function parseItems(text) {
      const cleaned = text.replace(/```json|```/g, '').trim();
      try { const r = JSON.parse(cleaned); if (Array.isArray(r)) return r; } catch(e) {}
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) { try { const r = JSON.parse(match[0]); if (Array.isArray(r)) return r; } catch(e) {} }
      return [];
    }

    let pdfText = '';
    let usedPdfParse = false;

    // Try pdf-parse first (fast, no token cost)
    try {
      const pdfBuffer = Buffer.from(fileData, 'base64');
      let pp = pdfParse;
      if (!pp) pp = require('pdf-parse');
      const pdfData = await pp(pdfBuffer);
      pdfText = (pdfData.text || '').trim();
      if (pdfText.length > 100) {
        usedPdfParse = true;
        console.log(`pdf-parse: extracted ${pdfText.length} chars from "${fileName}"`);
      }
    } catch(e) {
      console.log('pdf-parse unavailable, will use Claude PDF vision:', e.message);
    }

    let allItems = [];

    if (usedPdfParse && pdfText.length > 100) {
      // TEXT PATH: split into chunks and send text only to Claude
      const CHUNK_SIZE = 3500;
      const chunks = [];
      for (let i = 0; i < pdfText.length; i += CHUNK_SIZE) chunks.push(pdfText.slice(i, i + CHUNK_SIZE));
      console.log(`Processing ${chunks.length} text chunks`);

      for (let i = 0; i < chunks.length; i++) {
        try {
          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1500,
            messages: [{ role: 'user', content:
              `You are extracting ${subject} curriculum. CRITICAL RULE: Always prefix strand with the stage/grade label found above it in the text. Examples: "Stage 3: Number", "Grade 6: Algebra", "Lop 8: Hinh hoc". If you see Stage N, Grade N, Lop N or Year N as a heading, every item under it must have that prefix in strand.\n\nReturn ONLY a JSON array:\n[{"strand":"Stage N: topic","substrand":"sub-topic or empty","objective":"learning objective"}]\n\nIf no stage label visible, look earlier in the text chunk for the most recent stage heading.\nIf nothing educational found return [].\n\nTEXT:\n${chunks[i]}`
            }]
          });
          const items = parseItems(response.content[0].text);
          allItems = allItems.concat(items);
          console.log(`Chunk ${i+1}/${chunks.length}: ${items.length} items`);
        } catch(err) {
          if (err.message && err.message.includes('rate_limit')) {
            console.log('Rate limited, waiting 20s...');
            await sleep(20000);
            i--; // retry this chunk
          } else {
            console.warn(`Chunk ${i+1} failed:`, err.message);
          }
        }
        // 2.5s between each chunk to stay under 30k tokens/min
        if (i < chunks.length - 1) await sleep(2500);
      }

    } else {
      // VISION PATH: send PDF directly to Claude but only ask for summary extraction
      // Use haiku (cheaper, smaller context) and ask for structured output in 2 passes
      console.log('Using Claude PDF vision for extraction');

      const docSource = { type: 'base64', media_type: 'application/pdf', data: fileData };

      // Pass 1: Get all chapter/topic names only (small output)
      let topicNames = [];
      try {
        await sleep(3000); // wait before first call
        const r1 = await anthropic.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 1000,
          messages: [{ role: 'user', content: [
            { type: 'document', source: docSource },
            { type: 'text', text: 'List only the main chapter and unit titles from this PDF. Return ONLY a JSON array of strings: ["title1","title2",...]. Maximum 30 items.' }
          ]}]
        });
        topicNames = parseItems(r1.content[0].text).filter(s => typeof s === 'string').slice(0, 30);
        console.log(`Vision pass 1: ${topicNames.length} topics`);
      } catch(e) { console.warn('Vision pass 1 failed:', e.message); }

      // Pass 2: For each topic (batches of 8), extract objectives from text description
      const BATCH = 8;
      for (let i = 0; i < topicNames.length; i += BATCH) {
        await sleep(5000);
        const batch = topicNames.slice(i, i + BATCH);
        try {
          const r2 = await anthropic.messages.create({
            model: 'claude-haiku-4-5',
            max_tokens: 1500,
            messages: [{ role: 'user', content: [
              { type: 'document', source: docSource },
              { type: 'text', text: `Extract all learning objectives for these topics from the PDF: ${batch.join(', ')}. Return ONLY JSON: [{"strand":"topic","substrand":"sub-topic or empty","objective":"specific learning objective"}]` }
            ]}]
          });
          const items = parseItems(r2.content[0].text);
          allItems = allItems.concat(items);
          console.log(`Vision batch ${Math.ceil(i/BATCH)+1}: ${items.length} items`);
        } catch(e) { console.warn(`Vision batch failed:`, e.message); }
      }

      // Fallback if topics empty — one general pass with haiku
      if (allItems.length === 0) {
        await sleep(5000);
        try {
          const rf = await anthropic.messages.create({
            model: 'claude-haiku-4-5',
            max_tokens: 2000,
            messages: [{ role: 'user', content: [
              { type: 'document', source: docSource },
              { type: 'text', text: `Extract up to 50 key learning objectives from this ${subject} curriculum PDF. Return ONLY JSON: [{"strand":"topic","substrand":"","objective":"learning objective"}]` }
            ]}]
          });
          allItems = parseItems(rf.content[0].text);
          console.log(`Fallback pass: ${allItems.length} items`);
        } catch(e) { console.warn('Fallback pass failed:', e.message); }
      }
    }

    // Deduplicate
    const seen = new Set();
    const uniqueItems = allItems.filter(item => {
      if (!item || typeof item.objective !== 'string' || !item.objective.trim()) return false;
      const key = item.objective.trim().toLowerCase().slice(0, 120);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`Unique items: ${uniqueItems.length} from ${allItems.length} raw`);

    if (!uniqueItems.length) {
      return res.status(400).json({ error: 'No curriculum content could be extracted. Try a different PDF or add pdf-parse to package.json.' });
    }

    // Insert into DB
    // Helper: extract grade/stage number from item content
    // Handles: "Stage 3", "Grade 3", "Lớp 3", strand names like "Stage 3 - Numbers"
    function detectItemGrade(item, fallbackGrade, currType) {
      // If we already have a specific grade, use it
      if (fallbackGrade > 0) return fallbackGrade;

      // Try to detect from strand, substrand, or objective text
      const searchText = `${item.strand||''} ${item.substrand||''} ${item.objective||''}`;

      // Cambridge: "Stage N"
      const stageMatch = searchText.match(/stage\s*(\d+)/i);
      if (stageMatch) return parseInt(stageMatch[1]);

      // Vietnam: "Lớp N" or "lop N"
      const lopMatch = searchText.match(/l[oớ]p\s*(\d+)/i);
      if (lopMatch) return parseInt(lopMatch[1]);

      // Generic: "Grade N"
      const gradeMatch = searchText.match(/grade\s*(\d+)/i);
      if (gradeMatch) return parseInt(gradeMatch[1]);

      // Year: "Year N"
      const yearMatch = searchText.match(/year\s*(\d+)/i);
      if (yearMatch) return parseInt(yearMatch[1]);

      return 0; // truly all grades
    }

    let imported = 0;
    for (const item of uniqueItems) {
      const baseGrade = safeGrade(grade);
      const itemGrade = detectItemGrade(item, baseGrade, type);
      const stageLabel = itemGrade === 0 ? '' :
        type === 'cambridge' ? `Stage ${itemGrade}` :
        type === 'national'  ? `Lớp ${itemGrade}` :
        `${itemGrade}`;

      await pool.query(
        `INSERT INTO curriculum (subject, grade, strand, substrand, objective, curriculum_type, lang, source_file, stage) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [subject, itemGrade, item.strand||'', item.substrand||'', item.objective, type||'general', lang||'vi', fileName, stageLabel]
      );
      imported++;
    }

    console.log(`✅ Imported ${imported} items from "${fileName}"`);
    res.json({ imported, message: `Successfully imported ${imported} curriculum items from "${fileName}"` });

  } catch (err) {
    console.error('Curriculum import error:', err);
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});


// List curriculum grouped by subject + grade
app.get('/admin/curriculum/list', authenticate, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT subject, grade, curriculum_type, lang, COUNT(*) as count
       FROM curriculum
       GROUP BY subject, grade, curriculum_type, lang
       ORDER BY subject, grade`
    );
    res.json({ items: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete curriculum by subject + grade
app.delete('/admin/curriculum/delete', authenticate, adminOnly, async (req, res) => {
  try {
    const { subject, grade } = req.body;
    const result = await pool.query(
      'DELETE FROM curriculum WHERE subject = $1 AND grade = $2',
      [subject, parseInt(String(grade).replace(/[^0-9]/g,""),10)||0]
    );
    res.json({ deleted: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      vnp_Version:    '2.1.0',
      vnp_Command:    'pay',
      vnp_TmnCode:    tmnCode,
      vnp_Amount:     plan.vnd * 100,
      vnp_CurrCode:   'VND',
      vnp_TxnRef:     txnRef,
      vnp_OrderInfo:  `EduBot ${plan.label} - User ${req.user.id}`,
      vnp_OrderType:  'other',
      vnp_Locale:     'vn',
      vnp_ReturnUrl:  returnUrl,
      vnp_IpAddr:     req.ip || '127.0.0.1',
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

    res.json({ paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?' + querystring.stringify(sorted) });
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

    const appUrl = 'https://edubot-vietnam.onrender.com';

    if (hmac !== secureHash) {
      return res.redirect(`${appUrl}/app?payment=failed&reason=invalid_signature`);
    }

    if (responseCode === '00') {
      const pending = await pool.query('SELECT * FROM payments WHERE txn_ref = $1', [txnRef]);
      if (pending.rows.length > 0) {
        const { user_id, plan } = pending.rows[0];
        await upgradePlan(user_id, plan);
        await pool.query('UPDATE payments SET status = $1 WHERE txn_ref = $2', ['success', txnRef]);
      }
      return res.redirect(`${appUrl}/app?payment=success`);
    } else {
      await pool.query('UPDATE payments SET status = $1 WHERE txn_ref = $2', ['failed', txnRef]);
      return res.redirect(`${appUrl}/app?payment=failed&reason=declined`);
    }
  } catch (err) {
    console.error('VNPay return error:', err);
    res.redirect('https://edubot-vietnam.onrender.com/app?payment=failed&reason=server_error');
  }
});

app.post('/payment/create-stripe-session', authenticate, async (req, res) => {
  try {
    const { planKey } = req.body;
    const plan = PLANS[planKey];
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });

    const appUrl = 'https://edubot-vietnam.onrender.com';

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
      success_url: `${appUrl}/app?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${appUrl}/pricing?payment=cancelled`,
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

    if (session.metadata.user_id !== String(req.user.id)) {
      return res.status(403).json({ error: 'Session does not belong to this user' });
    }

    const planKey  = session.metadata.plan_key;
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

    let raw = response.content[0].text.trim().replace(/```json/g, '').replace(/```/g, '').trim();

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
    const canGenerate = ['plus', 'teacher_pro'].includes(user.plan) || user.role === 'admin';
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

    const imgData  = response.data[0];
    const imageUrl = imgData.url ? imgData.url : `data:image/png;base64,${imgData.b64_json}`;

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

    let raw = response.content[0].text.trim().replace(/```json/g, '').replace(/```/g, '').trim();

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
// PROMO CODE ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.post('/promo/create', authenticate, adminOnly, async (req, res) => {
  try {
    const { type, credits, plan, max_uses, expires_at, custom_code } = req.body;
    const code = custom_code || ('EDU' + Math.random().toString(36).substring(2, 8).toUpperCase());
    const result = await pool.query(
      `INSERT INTO promo_codes (code, credits, max_uses, uses, type, plan, expires_at)
       VALUES ($1, $2, $3, 0, $4, $5, $6) RETURNING *`,
      [code, credits || 0, max_uses || 1, type || 'credits', plan || null, expires_at || null]
    );
    res.json({ promo: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/promo/list', authenticate, adminOnly, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM promo_codes ORDER BY created_at DESC');
    res.json({ promos: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/promo/redeem', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    const promo = await pool.query(
      `SELECT * FROM promo_codes WHERE code = $1 AND uses < max_uses AND (expires_at IS NULL OR expires_at > NOW())`,
      [code.toUpperCase()]
    );
    if (!promo.rows.length) return res.status(404).json({ error: 'Invalid or expired promo code' });

    const p = promo.rows[0];
    await pool.query('UPDATE promo_codes SET uses = uses + 1 WHERE id = $1', [p.id]);

    if (p.type === 'plan' && p.plan) {
      const credits = PLAN_CREDITS[p.plan] || 0;
      await pool.query('UPDATE users SET plan = $1, credits = credits + $2 WHERE id = $3', [p.plan, credits, req.user.id]);
      res.json({ success: true, message: `Plan upgraded to ${p.plan}!`, type: 'plan', plan: p.plan });
    } else {
      await pool.query('UPDATE users SET credits = credits + $1 WHERE id = $2', [p.credits, req.user.id]);
      res.json({ success: true, message: `${p.credits} credits added!`, type: 'credits', credits: p.credits });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SERVER START + DB SETUP
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Users table columns
    await Promise.all([
      pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0"),
      pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'free'"),
      pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_count INTEGER DEFAULT 0"),
      pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_reset TIMESTAMP"),
    ]);

    // Core tables
    await pool.query(`CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      user_id UUID,
      plan VARCHAR(50),
      gateway VARCHAR(20),
      amount INTEGER,
      currency VARCHAR(10),
      txn_ref VARCHAR(255) UNIQUE,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS flashcards (
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
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS promo_codes (
      id SERIAL PRIMARY KEY,
      code VARCHAR(20) UNIQUE,
      credits INTEGER DEFAULT 0,
      max_uses INTEGER DEFAULT 1,
      uses INTEGER DEFAULT 0,
      type VARCHAR(20) DEFAULT 'credits',
      plan VARCHAR(50),
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS curriculum (
      id SERIAL PRIMARY KEY,
      subject VARCHAR(100),
      grade INTEGER,
      strand VARCHAR(200),
      substrand VARCHAR(200),
      objective TEXT,
      curriculum_type VARCHAR(50) DEFAULT 'general',
      lang VARCHAR(10) DEFAULT 'vi',
      source_file VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS chat_history (
      id SERIAL PRIMARY KEY,
      user_id UUID,
      role VARCHAR(20),
      content TEXT,
      subject VARCHAR(50),
      grade INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS classroom_students (
      id SERIAL PRIMARY KEY,
      classroom_id INTEGER,
      student_id UUID,
      UNIQUE(classroom_id, student_id)
    )`);

    // Safe column additions
    await Promise.all([
      pool.query("ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'credits'"),
      pool.query("ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS plan VARCHAR(50)"),
      pool.query("ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP"),
      pool.query("ALTER TABLE curriculum ADD COLUMN IF NOT EXISTS lang VARCHAR(10) DEFAULT 'vi'"),
      pool.query("ALTER TABLE curriculum ADD COLUMN IF NOT EXISTS curriculum_type VARCHAR(50) DEFAULT 'general'"),
      pool.query("ALTER TABLE curriculum ADD COLUMN IF NOT EXISTS source_file VARCHAR(255)"),
      pool.query("ALTER TABLE curriculum ADD COLUMN IF NOT EXISTS substrand VARCHAR(200)"),
      pool.query("ALTER TABLE curriculum ADD COLUMN IF NOT EXISTS strand VARCHAR(200)"),
      pool.query("ALTER TABLE curriculum ADD COLUMN IF NOT EXISTS stage VARCHAR(200) DEFAULT ''"),
      pool.query("ALTER TABLE curriculum ALTER COLUMN stage TYPE VARCHAR(200) USING stage::VARCHAR"),
    ]);

    console.log('✅ Database ready');
  } catch (e) {
    console.error('DB setup error:', e.message);
  }

  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

startServer();
