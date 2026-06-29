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

const { Pinecone } = require('@pinecone-database/pinecone');

// Pinecone setup
let pineconeIndex = null;
async function getPineconeIndex() {
  if (!pineconeIndex && process.env.PINECONE_API_KEY) {
    try {
      const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
      pineconeIndex = pc.index('stellastride-curriculum');
    } catch(e) { console.error('Pinecone init error:', e.message); }
  }
  return pineconeIndex;
}

async function getEmbedding(text, inputType) {
  try {
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const result = await pc.inference.embed(
      'llama-text-embed-v2',
      [text.substring(0, 2000)],
      { inputType: inputType || 'query' }
    );
    return result.data[0].values;
  } catch(e) {
    console.error('Embedding error:', e.message);
    return null;
  }
}

async function searchPinecone(query, subject, grade, topK) {
  try {
    const idx = await getPineconeIndex();
    if (!idx) return [];
    const embedding = await getEmbedding(query, 'query');
    if (!embedding) return [];
    const filter = {};
    if (subject && subject !== 'general') filter.subject = { '$eq': subject };
    if (grade && grade > 0) filter.grade = { '$eq': grade };
    const results = await idx.query({
      vector: embedding,
      topK: topK || 5,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      includeMetadata: true
    });
    return results.matches
      .filter(m => m.score > 0.25)
      .map(m => m.metadata.text || '');
  } catch(e) {
    console.error('Pinecone search error:', e.message);
    return [];
  }
}

async function upsertToPinecone(id, text, metadata) {
  try {
    const idx = await getPineconeIndex();
    if (!idx) return false;
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const embedding = await pc.inference.embed(
      'llama-text-embed-v2',
      [text.substring(0, 2000)],
      { inputType: 'passage' }
    );
    await idx.upsert([{
      id: String(id),
      values: embedding.data[0].values,
      metadata: { ...metadata, text: text.substring(0, 500) }
    }]);
    return true;
  } catch(e) {
    console.error('Pinecone upsert error:', e.message);
    return false;
  }
}

const app = express();
app.set('trust proxy', 1); // Render runs behind a proxy; needed for correct client IPs (rate limiting)

// ─── Security headers (helmet) ────────────────────────────────────────────────
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: false, // app uses inline scripts/CDNs; disable CSP to avoid breaking the SPA
  crossOriginEmbedderPolicy: false
}));

// ─── CORS (locked to known origins; set ALLOWED_ORIGINS env to override) ───────
const allowedOrigins = (process.env.ALLOWED_ORIGINS ||
  'https://edubot-vietnam.onrender.com').split(',').map(s => s.trim());
app.use(cors({
  origin: function(origin, cb){
    // allow same-origin / server-to-server (no origin) and any listed origin
    if (!origin || allowedOrigins.indexOf(origin) !== -1) return cb(null, true);
    return cb(null, false);
  },
  credentials: true
}));

// Body limits: 25mb is generous for base64 PDF/image uploads but blocks memory-abuse.
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));
app.use(express.static('public'));

// ─── Rate limiting (in-memory now; Redis-swap ready for scale) ─────────────────
const rateLimit = require('express-rate-limit');
// General limiter: protects all /api-style routes from flooding & runaway API cost.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 60,                    // 60 requests/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again shortly.' }
});
// Strict limiter for auth: stops brute-force password guessing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 8,                     // 8 attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only failed logins count toward the limit
  message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' }
});
// Limiter for expensive AI endpoints: protects your Claude/OpenAI API spend.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,                    // 20 AI calls/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'You are sending requests too quickly. Please wait a moment.' }
});
// NOTE: to scale to multiple servers later, add a Redis store here (rate-limit-redis)
// and pass `store: new RedisStore({...})` to each limiter — no other code changes needed.
app.use(generalLimiter); // global cap on every route
app.get('/exam', (req, res) => res.sendFile(__dirname + '/public/exam.html'));

// ─── DB + AI clients ──────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: parseInt(process.env.DB_POOL_MAX || '10'),  // cap connections per instance (raise via env when scaling)
  idleTimeoutMillis: 30000,                          // release idle clients
  connectionTimeoutMillis: 10000                     // fail fast instead of hanging
});
pool.on('error', (e) => console.error('PG pool error:', e.message)); // don't crash on idle client errors
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
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  const token = header.slice(7).trim();
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

// ─── Input validation helpers ─────────────────────────────────────────────────
function isValidEmail(e){ return typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function strOK(v, max){ return typeof v === 'string' && v.length > 0 && v.length <= max; }
// cap free-text sent to AI / stored in DB to block abuse (very large payloads)
function capText(v, max){ return (typeof v === 'string') ? v.slice(0, max) : v; }

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
app.post('/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, password, name, role = 'student', grade, institution } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
    if (!strOK(password, 200) || password.length < 6) return res.status(400).json({ error: 'Password must be 6–200 characters' });
    if (!strOK(name, 100)) return res.status(400).json({ error: 'Invalid name' });
    if (role && ['student','teacher','teacher_pro'].indexOf(role) === -1 && email !== 'nathansteyn96@gmail.com') return res.status(400).json({ error: 'Invalid role' });

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

app.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!isValidEmail(email) || !strOK(password, 200)) return res.status(401).json({ error: 'Invalid credentials' });
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
app.post('/chat/document', authenticate, aiLimiter, async (req, res) => {
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
- Never output raw markdown. Only clean HTML tags.
- NEVER start your response with intro phrases like "Here is...", "Below is...", "Here's a...", "I have prepared...", or any similar sentence. Go straight into the content immediately.`;

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
app.post('/chat', authenticate, aiLimiter, async (req, res) => {
  try {
    let { message, subject, grade, lang, role: userRequestRole } = req.body;
    if (!strOK(message, 8000)) return res.status(400).json({ error: 'Message is empty or too long (max 8000 characters).' });
    message = capText(message, 8000);
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

        // RAG: Try Pinecone semantic search first, fallback to DB
        // Wrapped in a timeout so a slow/hanging Pinecone can never stall the chat response.
        let pineconeResults = [];
        try {
          const pineconePromise = searchPinecone(message, detectedSubject, gradeNum, 6);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Pinecone timeout')), 4000));
          pineconeResults = await Promise.race([pineconePromise, timeoutPromise]);
        } catch(e) { console.error('Pinecone search skipped:', e.message); pineconeResults = []; }

        if (pineconeResults.length === 0) {
          // Fallback: DB keyword search
          const curriculum = await pool.query(
            `SELECT objective, strand, substrand FROM curriculum
             WHERE LOWER(subject) = LOWER($1)
             AND (grade = $2 OR grade = 0)
             ORDER BY CASE WHEN grade = $2 THEN 0 ELSE 1 END
             LIMIT 12`,
            [detectedSubject, gradeNum]
          );
          if (curriculum.rows.length > 0) {
            pineconeResults = curriculum.rows.map(r =>
              [r.strand, r.substrand, r.objective].filter(Boolean).join(' - ')
            );
          }
        }

        if (pineconeResults.length > 0) {
          curriculumContext = '\n\nRelevant curriculum context (use this to inform your response but never mention or reference it directly):\n' +
            pineconeResults.slice(0, 8).map(r => '- ' + r).join('\n');
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
- Never output raw markdown. Only clean HTML tags.
- NEVER start your response with intro phrases like "Here is...", "Below is...", "Here's a...", "I have prepared...", or any similar sentence. Go straight into the content immediately.`;

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
    console.error('Chat error:', err && err.stack ? err.stack : err);
    const msg = (err && err.message) ? err.message : 'Chat failed';
    // Surface a clearer hint for common cases without leaking internals
    let userMsg = 'The AI is temporarily unavailable. Please try again.';
    if (/overloaded|rate|429/i.test(msg)) userMsg = 'The AI is busy right now. Please wait a moment and try again.';
    else if (/timeout|ETIMEDOUT|ECONNRESET|fetch failed/i.test(msg)) userMsg = 'The request timed out. Please try again.';
    res.status(500).json({ error: userMsg });
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
              { type: 'text', text: `Extract the TOP 3 most important learning objectives for each of these topics from the PDF: ${batch.join(', ')}. Maximum 3 objectives per topic. Return ONLY JSON array: [{"strand":"topic","substrand":"sub-topic or empty","objective":"specific learning objective"}]. Keep objectives concise, max 20 words each.` }
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
    const cappedItems = allItems.slice(0, 100);
    const uniqueItems = cappedItems.filter(item => {
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

    const pineconeQueue = [];
    let imported = 0;
    const limitedItems = uniqueItems.slice(0, 500);
    for (const item of limitedItems) {
      const baseGrade = safeGrade(grade);
      const itemGrade = detectItemGrade(item, baseGrade, type);
      const stageLabel = itemGrade === 0 ? '' :
        type === 'cambridge' ? `Stage ${itemGrade}` :
        type === 'national'  ? `Lớp ${itemGrade}` :
        `${itemGrade}`;

      const dbRes = await pool.query(
        `INSERT INTO curriculum (subject, grade, strand, substrand, objective, curriculum_type, lang, source_file, stage) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [subject, itemGrade, item.strand||'', item.substrand||'', item.objective, type||'general', lang||'vi', fileName, stageLabel]
      );
      // Queue for Pinecone (non-blocking)
      const newId = dbRes.rows[0]?.id;
      if (newId) pineconeQueue.push({
        id: `curr_${newId}`,
        text: [item.strand, item.substrand, item.objective].filter(Boolean).join(' | '),
        meta: { subject, grade: itemGrade, strand: item.strand||'', type: type||'general', lang: lang||'vi' }
      });
      imported++;
    }

    console.log(`✅ Imported ${imported} items from "${fileName}"`);
    res.json({ imported, message: `Successfully imported ${imported} curriculum items from "${fileName}"` });

    // Process Pinecone in background after response sent - batch of 10, max 200
    if (pineconeQueue.length > 0) {
      const toProcess = pineconeQueue.slice(0, 200);
      (async () => {
        for (let i = 0; i < toProcess.length; i += 10) {
          const batch = toProcess.slice(i, i + 10);
          await Promise.all(batch.map(item =>
            upsertToPinecone(item.id, item.text, item.meta).catch(e => console.error('Pinecone batch error:', e.message))
          ));
          await new Promise(r => setTimeout(r, 500)); // throttle
        }
        console.log(`✅ Pinecone: indexed ${toProcess.length} items`);
      })();
    }

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
app.post('/flashcards/generate', authenticate, aiLimiter, async (req, res) => {
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
app.post('/image/generate', authenticate, aiLimiter, async (req, res) => {
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
app.post('/graph/generate', authenticate, aiLimiter, async (req, res) => {
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

    // Exam tables
    await pool.query(`CREATE TABLE IF NOT EXISTS exams (
      id SERIAL PRIMARY KEY,
      teacher_id UUID REFERENCES users(id),
      title VARCHAR(255) NOT NULL,
      subject VARCHAR(100),
      grade INTEGER,
      context VARCHAR(20) DEFAULT 'local',
      purpose VARCHAR(20) DEFAULT 'test',
      difficulty VARCHAR(20) DEFAULT 'medium',
      adapted_for_weak BOOLEAN DEFAULT false,
      time_limit INTEGER DEFAULT 30,
      show_answers BOOLEAN DEFAULT false,
      questions JSONB NOT NULL,
      total_points INTEGER DEFAULT 0,
      code VARCHAR(20) UNIQUE,
      status VARCHAR(20) DEFAULT 'draft',       
      classroom_id TEXT,
      max_attempts INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS exam_submissions (
      id SERIAL PRIMARY KEY,
      exam_id INTEGER REFERENCES exams(id),
      student_id UUID REFERENCES users(id),
      guest_name VARCHAR(100),
      answers JSONB DEFAULT '[]',
      ai_scores JSONB DEFAULT '[]',
      final_scores JSONB DEFAULT '[]',
      total_score INTEGER DEFAULT 0,
      max_score INTEGER DEFAULT 0,
      status VARCHAR(20) DEFAULT 'in_progress',
      started_at TIMESTAMP DEFAULT NOW(),
      submitted_at TIMESTAMP,
      time_extended INTEGER DEFAULT 0
    )`);
    
    console.log('✅ Database ready');
  } catch (e) {
    console.error('DB setup error:', e.message);
  }

  
// ─── IELTS ──────────────────────────────────────────────────────────────────

app.get('/ielts', (req, res) => res.sendFile(__dirname + '/public/ielts.html'));

app.post('/ielts/reading/generate', authenticate, aiLimiter, async (req, res) => {
  try {
    const { topic, difficulty } = req.body;
    const prompt = `Generate a complete IELTS ${difficulty||'Academic'} Reading passage about "${topic||'Science and Technology'}".

Return ONLY valid JSON, no markdown:
{
  "title": "passage title",
  "passage": "Full passage 650-750 words, academic style, 5 paragraphs labeled [A][B][C][D][E]",
  "sections": [
    {
      "type": "multiple_choice",
      "instructions": "Choose the correct letter A, B, C or D.",
      "questions": [
        {"id":1,"text":"question text","options":{"A":"opt","B":"opt","C":"opt","D":"opt"},"answer":"B"}
      ]
    },
    {
      "type": "true_false_ng",
      "instructions": "Write TRUE, FALSE or NOT GIVEN.",
      "questions": [
        {"id":5,"text":"statement","answer":"TRUE"}
      ]
    },
    {
      "type": "fill_blank",
      "instructions": "Complete using NO MORE THAN TWO WORDS from the passage.",
      "questions": [
        {"id":9,"text":"The process involves ________ at high temperatures.","answer":"heating"}
      ]
    }
  ]
}
Generate exactly 13 questions total. All answers must come from the passage.`;

    const r = await anthropic.messages.create({ model:'claude-haiku-4-5', max_tokens:4000, messages:[{role:'user',content:prompt}] });
    const data = JSON.parse(r.content[0].text.replace(/```json|```/g,'').trim());
    res.json(data);
  } catch(e) { console.error('IELTS reading error:',e.message); res.status(500).json({error:e.message}); }
});

app.post('/ielts/listening/generate', authenticate, aiLimiter, async (req, res) => {
  try {
    const { section } = req.body;
    const sNum = parseInt(section)||1;
    const descs = {
      1:'a conversation between two people in an everyday social context like booking accommodation or enquiring about a course',
      2:'a monologue in an everyday social context like a speech about local facilities',
      3:'a conversation between up to four people in an educational context',
      4:'a university lecture on an academic subject'
    };
    const prompt = `Generate an IELTS Listening Section ${sNum}: ${descs[sNum]||descs[1]}.

Return ONLY valid JSON, no markdown:
{
  "section": ${sNum},
  "title": "Section ${sNum} title",
  "speakers": [
    {"name":"Sarah","gender":"female","accent":"British"},
    {"name":"James","gender":"male","accent":"Australian"}
  ],
  "script": [
    {"speaker":"Sarah","text":"dialogue line"},
    {"speaker":"James","text":"response"}
  ],
  "sections": [
    {
      "type": "form_completion",
      "instructions": "Complete the form. Write NO MORE THAN TWO WORDS AND/OR A NUMBER.",
      "questions": [
        {"id":1,"text":"Name: ________","answer":"Sarah Johnson"},
        {"id":2,"text":"Phone: ________","answer":"07834 521906"}
      ]
    },
    {
      "type": "multiple_choice",
      "instructions": "Choose the correct letter A, B or C.",
      "questions": [
        {"id":6,"text":"question","options":{"A":"opt","B":"opt","C":"opt"},"answer":"A"}
      ]
    }
  ]
}
Script must be 300-400 words natural English. Generate exactly 10 questions total.`;

    const r = await anthropic.messages.create({ model:'claude-haiku-4-5', max_tokens:3000, messages:[{role:'user',content:prompt}] });
    const data = JSON.parse(r.content[0].text.replace(/```json|```/g,'').trim());
    res.json(data);
  } catch(e) { console.error('IELTS listening error:',e.message); res.status(500).json({error:e.message}); }
});

app.post('/ielts/writing/generate', authenticate, aiLimiter, async (req, res) => {
  try {
    const { task } = req.body;
    const taskNum = parseInt(task)||1;
    
    if(taskNum === 1) {
      const prompt = `Generate an IELTS Academic Writing Task 1 prompt with chart data.
Return ONLY valid JSON, no markdown:
{
  "task": 1,
  "type": "bar_chart",
  "title": "chart title",
  "description": "The chart below shows... Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.",
  "data": {
    "labels": ["2000","2005","2010","2015","2020"],
    "datasets": [
      {"label":"Category A","values":[23,34,45,52,61]},
      {"label":"Category B","values":[45,42,38,35,30]}
    ],
    "yAxisLabel": "Percentage (%)"
  },
  "wordLimit": 150,
  "timeLimit": 20
}`;
      const r = await anthropic.messages.create({ model:'claude-haiku-4-5', max_tokens:1000, messages:[{role:'user',content:prompt}] });
      return res.json(JSON.parse(r.content[0].text.replace(/```json|```/g,'').trim()));
    }
    
    const prompt = `Generate an IELTS Academic Writing Task 2 essay question.
Return ONLY valid JSON, no markdown:
{
  "task": 2,
  "topic": "topic area",
  "question": "Full essay question 2-3 sentences. Write at least 250 words.",
  "type": "opinion",
  "wordLimit": 250,
  "timeLimit": 40
}`;
    const r = await anthropic.messages.create({ model:'claude-haiku-4-5', max_tokens:600, messages:[{role:'user',content:prompt}] });
    res.json(JSON.parse(r.content[0].text.replace(/```json|```/g,'').trim()));
  } catch(e) { console.error('IELTS writing error:',e.message); res.status(500).json({error:e.message}); }
});

app.post('/ielts/speaking/generate', authenticate, async (req, res) => {
  try {
    const { part } = req.body;
    const partNum = parseInt(part)||1;
    
    let prompt = '';
    if(partNum === 1) {
      prompt = `Generate IELTS Speaking Part 1 questions.
Return ONLY valid JSON, no markdown:
{"part":1,"topic":"general topics","questions":["Do you work or are you a student?","What do you enjoy most about your work or studies?","Tell me about your hometown.","What do you like to do in your free time?","Do you prefer spending time indoors or outdoors?"]}`;
    } else if(partNum === 2) {
      prompt = `Generate IELTS Speaking Part 2 cue card.
Return ONLY valid JSON, no markdown:
{"part":2,"cueCard":{"topic":"Describe a memorable journey you have taken","points":["Where you went","Who you went with","What you did there","Why it was memorable"],"prepTime":60,"speakTime":120},"followUp":["Did you enjoy the experience?","Would you like to go back?"]}`;
    } else {
      prompt = `Generate IELTS Speaking Part 3 discussion questions.
Return ONLY valid JSON, no markdown:
{"part":3,"topic":"Travel and Tourism","questions":["How has tourism changed in your country over the past few decades?","What are the advantages and disadvantages of international tourism?","Do you think people will travel more or less in the future?","How does tourism affect local cultures and traditions?"]}`;
    }
    
    const r = await anthropic.messages.create({ model:'claude-haiku-4-5', max_tokens:800, messages:[{role:'user',content:prompt}] });
    res.json(JSON.parse(r.content[0].text.replace(/```json|```/g,'').trim()));
  } catch(e) { console.error('IELTS speaking error:',e.message); res.status(500).json({error:e.message}); }
});

app.post('/ielts/writing/grade', authenticate, async (req, res) => {
  try {
    const { task, question, answer, wordCount } = req.body;
    const prompt = `You are an expert IELTS examiner. Grade this Writing Task ${task} response.
Question: ${question}
Student answer (${wordCount} words): ${answer}

Return ONLY valid JSON, no markdown:
{"band":6.5,"taskAchievement":{"band":7,"feedback":"specific feedback"},"coherenceCohesion":{"band":6,"feedback":"specific feedback"},"lexicalResource":{"band":7,"feedback":"specific feedback"},"grammaticalRange":{"band":6,"feedback":"specific feedback"},"overallFeedback":"2-3 sentence summary","strengths":["strength 1","strength 2"],"improvements":["improvement 1","improvement 2","improvement 3"]}`;

    const r = await anthropic.messages.create({ model:'claude-sonnet-4-6', max_tokens:1000, messages:[{role:'user',content:prompt}] });
    res.json(JSON.parse(r.content[0].text.replace(/```json|```/g,'').trim()));
  } catch(e) { console.error('IELTS writing grade error:',e.message); res.status(500).json({error:e.message}); }
});

app.post('/ielts/speaking/grade', authenticate, async (req, res) => {
  try {
    const { part, question, transcript } = req.body;
    const prompt = `You are an expert IELTS examiner. Grade this Speaking Part ${part} response.
Question: ${question}
Transcript: ${transcript}

Return ONLY valid JSON, no markdown:
{"band":6.5,"fluencyCoherence":{"band":7,"feedback":"feedback"},"lexicalResource":{"band":6,"feedback":"feedback"},"grammaticalRange":{"band":7,"feedback":"feedback"},"pronunciation":{"band":6,"feedback":"feedback"},"overallFeedback":"2-3 sentence summary","strengths":["strength 1"],"improvements":["improvement 1","improvement 2"]}`;

    const r = await anthropic.messages.create({ model:'claude-sonnet-4-6', max_tokens:800, messages:[{role:'user',content:prompt}] });
    res.json(JSON.parse(r.content[0].text.replace(/```json|```/g,'').trim()));
  } catch(e) { console.error('IELTS speaking grade error:',e.message); res.status(500).json({error:e.message}); }
});

app.post('/ielts/autograde', authenticate, async (req, res) => {
  try {
    const { answers, correctAnswers } = req.body;
    let correct = 0;
    const results = correctAnswers.map(function(ca, i) {
      const studentAns = (answers[i]||'').toString().trim().toLowerCase();
      const correctAns = ca.answer.toString().trim().toLowerCase();
      const isCorrect = studentAns === correctAns || studentAns.includes(correctAns) || correctAns.includes(studentAns);
      if(isCorrect) correct++;
      return {id:ca.id, correct:isCorrect, studentAnswer:answers[i], correctAnswer:ca.answer};
    });
    const raw = correct;
    const band = raw>=39?9:raw>=37?8.5:raw>=35?8:raw>=32?7.5:raw>=30?7:raw>=26?6.5:raw>=23?6:raw>=18?5.5:raw>=16?5:raw>=13?4.5:raw>=10?4:3.5;
    res.json({correct, total:correctAnswers.length, band, results});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/ielts/tts', authenticate, async (req, res) => {
  try {
    const { script, speakers } = req.body;
    if(!script||!script.length) return res.status(400).json({error:'No script'});
    
    const femaleVoices = ['nova','shimmer','coral','sage'];
    const maleVoices = ['onyx','echo','fable','ash'];
    const voiceMap = {};
    let fIdx=0, mIdx=0;
    
    if(speakers) {
      speakers.forEach(function(sp) {
        voiceMap[sp.name] = sp.gender==='female' ? femaleVoices[fIdx++%femaleVoices.length] : maleVoices[mIdx++%maleVoices.length];
      });
    }
    
    const chunks = [];
    for(const line of script) {
      const voice = voiceMap[line.speaker]||'alloy';
      const sp = speakers ? speakers.find(s=>s.name===line.speaker) : null;
      const accent = sp ? sp.accent||'British' : 'British';
      const r = await openai.audio.speech.create({
        model:'gpt-4o-mini-tts',
        voice,
        input:line.text,
        instructions:`Speak with a clear ${accent} English accent at a measured IELTS exam pace. Sound natural and conversational.`,
        response_format:'mp3'
      });
      const buffer = Buffer.from(await r.arrayBuffer());
      chunks.push({speaker:line.speaker, voice, audio:buffer.toString('base64')});
    }
    res.json({chunks});
  } catch(e) { console.error('TTS error:',e.message); res.status(500).json({error:e.message}); }
});


app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

startServer();

// ─── EXAM FILE SCAN ──────────────────────────────────────────────────────────
app.post('/exam/scan-file', authenticate, async (req, res) => {
  try {
    const { fileData, fileType, fileName } = req.body;
    if (!fileData) return res.status(400).json({ error: 'No file data' });

    const isImage = fileType && fileType.startsWith('image/');
    const isPdf = fileType === 'application/pdf';

    let messageContent;
    if (isPdf) {
      messageContent = [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileData } },
        { type: 'text', text: 'Extract the key topics, concepts and learning objectives from this educational document. List them clearly and concisely so they can be used to generate exam questions. Format as a clear bullet list of topics.' }
      ];
    } else if (isImage) {
      messageContent = [
        { type: 'image', source: { type: 'base64', media_type: fileType, data: fileData } },
        { type: 'text', text: 'Extract the key topics, concepts and learning objectives from this educational document image. List them clearly and concisely. Format as a clear bullet list of topics.' }
      ];
    } else {
      return res.status(400).json({ error: 'Only PDF and image files can be scanned' });
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: messageContent }]
    });

    const topics = response.content[0].text;
    res.json({ topics });
  } catch (e) {
    console.error('Scan file error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── EXAM ROUTES ──────────────────────────────────────────────────────────────

// Generate exam with AI
app.post('/exam/generate', authenticate, aiLimiter, async (req, res) => {
  try {
    const { subject, topics, context, purpose, difficulty, questionTypes, questionCount, adaptForWeak, timeLimit, showAnswers, grade } = req.body;
    const userId = req.user.id;
    const user = await pool.query('SELECT * FROM users WHERE id=$1', [userId]);
    if (!user.rows[0] || (user.rows[0].role !== 'teacher' && user.rows[0].role !== 'admin')) {
      return res.status(403).json({ error: 'Teachers only' });
    }

    const contextLabel = context === 'international' ? 'International curriculum (Cambridge, IELTS style)' : 'Vietnamese national curriculum (MOET style)';
    const purposeLabel = purpose === 'exam' ? 'formal end-of-term exam' : 'class test';
    const adaptNote = adaptForWeak ? 'IMPORTANT: Adapt questions for underperforming students — simpler language, more scaffolding, clearer instructions.' : '';
    const typesLabel = (questionTypes || ['mcq', 'truefalse', 'fillinblank']).join(', '); const fileData = req.body.fileData || null; const fileType = req.body.fileType || null;

    const prompt = `You are an expert ${contextLabel} exam creator for Grade ${grade} ${subject}.

Create a ${purposeLabel} ${fileData ? 'based entirely on the uploaded document.' : 'covering these topics: '+topics+'.'} ${fileData ? ' Use the uploaded document as the primary source for questions. Do not use any other topic — only create questions based on the content in the uploaded file.' : ''}
Difficulty: ${difficulty}
Question types to include: ${typesLabel}
Total questions: ${questionCount || 10}
${adaptNote}

Question type codes:
- mcq: Multiple choice with 4 options (A,B,C,D), one correct answer
- truefalse: True or False statement
- fillinblank: Sentence with a blank to fill in
- matching: Two columns to match (provide 4-5 pairs)
- shortanswer: Question requiring 2-3 sentence answer
- errorcorrection: Sentence with an error to find and correct
- ordering: Steps/items to put in correct order (provide 4-5 items)
- comprehension: Short passage followed by 2-3 questions about it
- numeric: A question with an exact numeric or short equation answer (auto-checkable). Provide the answer as the exact value (e.g. "4" or "x = 4" or "3.5"). Use for math/science calculations.
- labeldiagram: A diagram with numbered pointers (1, 2, 3...) where the student names each labelled part. Provide a "visual" field for the diagram and a "labels" array giving the correct name for each numbered pointer. Use for science (label cell parts, circuit components, etc.).
- dragorder: Items the student drags into the correct sequence. Provide an "items" array IN THE CORRECT ORDER (the system shuffles them for the student). Use for sequencing steps, timelines, or sentence ordering.
- highlight: A sentence or short passage where the student clicks the correct word(s). Provide "tokens" (the sentence split into an array of words/punctuation) and "correct" (an array of the zero-based indices of the correct token(s)). Use for "click the verb", "select the error", etc.
- dropdown: A sentence with one or more inline dropdown blanks (cloze). Provide "segments" — an array where each element is either {"text":"plain words"} or {"blank":{"options":["opt1","opt2","opt3"],"answer":"opt1"}}. Use for grammar/cloze tests.

VISUALS — add a "visual" field to a question when a diagram helps answer it. Make the question text refer to the visual (e.g. "The graph shows...", "Use the diagram..."). Add visuals ONLY where they genuinely help; never on plain arithmetic/word questions. Pick numbers so the answer is readable from the visual, and ranges so everything fits. Supported "visual" kinds:
GRAPHS (coordinate plane):
- quadratic: { "kind":"quadratic","a":1,"b":-4,"c":3,"xRange":[-2,6],"yRange":[-2,6],"marks":[{"type":"vertex"},{"type":"roots"}],"label":"y = x² − 4x + 3" }
- linear: { "kind":"linear","m":2,"c":1,"xRange":[-6,6],"yRange":[-6,6],"label":"y = 2x + 1" }
- cubic: { "kind":"cubic","a":1,"b":0,"c":-3,"d":0,"xRange":[-3,3],"yRange":[-4,4],"label":"y = x³ − 3x" }
- reciprocal: { "kind":"reciprocal","a":1,"xRange":[-5,5],"yRange":[-5,5],"label":"y = 1/x" }
- exponential: { "kind":"exponential","base":2,"a":1,"xRange":[-3,3],"yRange":[0,8],"label":"y = 2ˣ" }
- absolute: { "kind":"absolute","a":1,"h":0,"k":0,"xRange":[-5,5],"yRange":[0,6],"label":"y = |x|" }
- simultaneous (two lines + intersection dot): { "kind":"simultaneous","m1":1,"c1":-1,"m2":-1,"c2":3,"xRange":[-2,6],"yRange":[-2,6] }
- inequality (shaded region): { "kind":"inequality","m":1,"c":1,"region":"above","xRange":[-4,4],"yRange":[-2,6],"label":"y ≥ x + 1" }
TRIG & NUMBER LINE:
- trig: { "kind":"trig","fn":"sin","maxDeg":360,"amp":1 }   (fn: "sin"|"cos"|"tan")
- numberline: { "kind":"numberline","min":-3,"max":3,"intervals":[{"from":-2,"to":3,"fromClosed":true,"toClosed":false}],"points":[{"at":1,"closed":true}] }  (closed=filled dot/included, open=hollow/not included)
DATA & STATISTICS:
- bar: { "kind":"bar","bars":[{"label":"Red","value":8},{"label":"Blue","value":14}],"yLabel":"Frequency" }
- pie: { "kind":"pie","slices":[{"label":"Walk","value":40},{"label":"Bus","value":25},{"label":"Car","value":35}] }  (values are percentages or counts)
- scatter: { "kind":"scatter","points":[{"x":1,"y":2},{"x":2,"y":3}],"bestFit":true,"xLabel":"Hours","yLabel":"Score" }
- boxplot: { "kind":"boxplot","min":2,"q1":8,"median":15,"q3":22,"max":30 }
GEOMETRY:
- triangle: { "kind":"triangle","angleA":"40°","sideAB":"12 cm","sideAC":"8 cm","sideBC":"x","labelA":"A","labelB":"B","labelC":"C" }
- sector (circle): { "kind":"sector","angle":60,"radiusLabel":"r = 5 cm" }
- angleline (angles on a straight line): { "kind":"angleline","rayAngle":52,"rightLabel":"x","leftLabel":"130°" }
- coordshape (polygon on a grid): { "kind":"coordshape","vertices":[[-1,2],[2,2],[2,-1],[-1,-1]],"xRange":[-4,4],"yRange":[-4,4] }
SCIENCE DIAGRAMS (black-and-white, for Science questions):
- circuit (electric circuit): { "kind":"circuit","components":[{"type":"cell","label":"cell"},{"type":"switch","label":"switch"},{"type":"bulb","label":"lamp"}] }  (component types: cell, bulb, switch, resistor, ammeter, voltmeter; up to 4 components placed around a loop)
- foodchain (energy flow): { "kind":"foodchain","organisms":["grass","grasshopper","frog","snake"] }  (arrows show energy flow; wraps to next row automatically)
- forces (arrows on an object): { "kind":"forces","objectLabel":"box","forces":[{"dir":"up","label":"lift"},{"dir":"down","label":"weight"},{"dir":"left","label":"drag"},{"dir":"right","label":"thrust"}] }
- cell (biology cell): { "kind":"cell","cellType":"plant","labels":["cell wall","cell membrane","nucleus","cytoplasm","vacuole","chloroplast"] }  (cellType: "plant" or "animal")
- apparatus (lab setup): { "kind":"apparatus","setup":"beaker_tripod" }  (setup: "beaker_tripod" or "filtration")
Choose the kind that matches the topic: graphs for functions/algebra, bar/pie/scatter/boxplot for statistics & data, numberline for inequalities, trig for trigonometry, triangle/sector/angleline/coordshape for geometry. For a Math exam on these topics, include at least one relevant visual.

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "title": "exam title",
  "instructions": "brief instructions for students",
  "sections": [
    {
      "type": "mcq",
      "label": "Section A: Multiple Choice",
      "questions": [
        {
          "id": 1,
          "question": "question text",
          "options": ["A. option1", "B. option2", "C. option3", "D. option4"],
          "answer": "A",
          "points": 2,
          "explanation": "brief explanation of correct answer"
        }
      ]
    },
    {
      "type": "truefalse",
      "label": "Section B: True or False",
      "questions": [
        {
          "id": 5,
          "question": "statement text",
          "answer": "True",
          "points": 1,
          "explanation": "why this is true/false"
        }
      ]
    },
    {
      "type": "numeric",
      "label": "Section C: Calculation",
      "questions": [
        {
          "id": 8,
          "question": "Solve for x: 2x + 5 = 13",
          "answer": "4",
          "points": 2,
          "explanation": "2x = 8, so x = 4"
        }
      ]
    },
    {
      "type": "labeldiagram",
      "label": "Section D: Label the Diagram",
      "questions": [
        {
          "id": 9,
          "question": "Label the marked parts of the diagram.",
          "visual": { "kind": "coordshape", "vertices": [[-1,2],[2,2],[2,-1],[-1,-1]], "xRange": [-4,4], "yRange": [-4,4] },
          "labels": ["Vertex A", "Vertex B", "Vertex C", "Vertex D"],
          "points": 4,
          "explanation": "Each numbered pointer corresponds to a labelled part"
        }
      ]
    },
    {
      "type": "dragorder",
      "label": "Section E: Put in Order",
      "questions": [
        {
          "id": 10,
          "question": "Put the steps of making tea in the correct order.",
          "items": ["Boil the water", "Add the tea leaves", "Let it steep", "Pour into a cup"],
          "points": 4,
          "explanation": "The items above are listed in the correct order"
        }
      ]
    },
    {
      "type": "highlight",
      "label": "Section F: Click the Word",
      "questions": [
        {
          "id": 11,
          "question": "Click the verb in the sentence.",
          "tokens": ["The", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog"],
          "correct": [4],
          "points": 1,
          "explanation": "\"jumps\" is the verb"
        }
      ]
    },
    {
      "type": "dropdown",
      "label": "Section G: Choose the Correct Word",
      "questions": [
        {
          "id": 12,
          "question": "Choose the correct verb forms.",
          "segments": [
            { "text": "She " },
            { "blank": { "options": ["has lived", "live", "living"], "answer": "has lived" } },
            { "text": " in Hanoi since 2010." }
          ],
          "points": 2,
          "explanation": "Present perfect for an action continuing from the past"
        }
      ]
    }
  ]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: fileData ? [{ type: fileType && fileType.startsWith('image/') ? 'image' : 'document', source: { type: 'base64', media_type: fileType || 'application/pdf', data: fileData } }, { type: 'text', text: prompt }] : prompt }]
    });

    let text = response.content[0].text.replace(/```json|```/g, '').trim();
    const examData = JSON.parse(text);

    // Calculate total points
    let totalPoints = 0;
    examData.sections.forEach(s => s.questions.forEach(q => { totalPoints += q.points || 1; }));

    // Generate unique exam code
    const code = 'SS-' + crypto.randomBytes(3).toString('hex').toUpperCase();

    // Save to DB
    const result = await pool.query(
      `INSERT INTO exams (teacher_id, title, subject, grade, context, purpose, difficulty, adapted_for_weak, time_limit, show_answers, questions, total_points, code, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft') RETURNING *`,
      [userId, examData.title, subject, grade, context, purpose, difficulty, adaptForWeak || false, timeLimit || 30, showAnswers || false, JSON.stringify(examData), totalPoints, code]
    );

    res.json({ exam: result.rows[0], examData });
  } catch (e) {
    console.error('Exam generate error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CAMBRIDGE CHECKPOINT MODULE
// ─────────────────────────────────────────────────────────────────────────────
app.get('/checkpoint', (req, res) => res.sendFile(__dirname + '/public/checkpoint.html'));

app.post('/checkpoint/generate', authenticate, aiLimiter, async (req, res) => {
  try {
    const { subject, stage, strands, topic, marks, includeDiagrams } = req.body;
    const userId = req.user.id;
    const user = await pool.query('SELECT * FROM users WHERE id=$1', [userId]);
    if (!user.rows[0] || (user.rows[0].role !== 'teacher' && user.rows[0].role !== 'admin')) {
      return res.status(403).json({ error: 'Teachers only' });
    }

    const subj = (subject || 'Science');
    const stageLabel = stage ? ('Stage ' + stage) : 'Stage 8';
    const strandLabel = (strands && strands.length) ? strands.join(', ') : 'mixed strands';
    const totalMarks = marks || 40;

    // Subject-specific command words & guidance (Cambridge Checkpoint style)
    let subjectGuide = '';
    if (/sci/i.test(subj)) {
      subjectGuide = `Use Cambridge Checkpoint Science command words: State, Describe, Explain, Suggest, Identify, Calculate. Test knowledge AND application. Include some questions on scientific enquiry / fair tests (variables, predictions). Strands: ${strandLabel} (Biology, Chemistry, Physics, Earth & Space).`;
    } else if (/math/i.test(subj)) {
      subjectGuide = `Use Cambridge Checkpoint Mathematics command words: Work out, Calculate, Find, Solve, Show that. Award method marks for working. Strands: ${strandLabel} (Number, Algebra, Geometry & Measure, Statistics & Probability). Prefer numeric/auto-checkable answers where possible.`;
    } else {
      subjectGuide = `Use Cambridge Checkpoint English skills: reading comprehension of a provided passage, writing, and grammar/usage. Strands: ${strandLabel}.`;
    }

    const diagramNote = includeDiagrams
      ? `DIAGRAMS ARE REQUIRED. You MUST include at least 3 questions that have a "visual" field. A question about circuits MUST include a circuit visual; a question about cells MUST include a cell visual; a question about food chains MUST include a foodchain visual. Add the "visual" field to the question object. Use these EXACT formats:
- Circuit: "visual": { "kind":"circuit","components":[{"type":"cell","label":"cell"},{"type":"switch","label":"switch"},{"type":"bulb","label":"lamp"}] } (types: cell, bulb, switch, resistor, ammeter, voltmeter)
- Food chain: "visual": { "kind":"foodchain","organisms":["grass","grasshopper","frog","snake"] }
- Forces: "visual": { "kind":"forces","objectLabel":"box","forces":[{"dir":"up","label":"lift"},{"dir":"down","label":"weight"}] }
- Cell: "visual": { "kind":"cell","cellType":"plant","labels":["cell wall","nucleus","cytoplasm","vacuole"] } (cellType: plant or animal)
- Apparatus: "visual": { "kind":"apparatus","setup":"beaker_tripod" } (setup: beaker_tripod or filtration)
- Math graphs/charts: quadratic, linear, bar, pie, triangle (same formats as a normal exam).
Make the question text refer to the diagram (e.g. "The circuit diagram shows...", "Use the diagram to..."). A "labeldiagram" type question should always carry a "visual" plus a "labels" array.`
      : 'Do not include any "visual" fields.';

    const prompt = `You are an expert Cambridge Lower Secondary Checkpoint examiner creating a ${stageLabel} ${subj} practice paper worth ${totalMarks} marks.
${topic ? 'Focus on this topic: ' + topic + '.' : 'Cover a representative mix of the chosen strands.'}
${subjectGuide}
${diagramNote}

Make it authentic to Cambridge Checkpoint: clear command words, appropriate difficulty for ${stageLabel}, and a complete mark scheme (answers + brief marking notes) for every question.

CRITICAL — TOTAL MARKS: The marks of all questions MUST add up to EXACTLY ${totalMarks}. Count as you go. Use a mix of mark values (1-mark recall questions and 2-4 mark "explain"/multi-part questions) so the paper reaches exactly ${totalMarks} marks. Do not stop early and do not exceed ${totalMarks}. For a ${totalMarks}-mark paper, expect roughly ${Math.round(totalMarks*0.7)}-${totalMarks} questions depending on mark values.

Use these question "type" codes: mcq, truefalse, fillinblank, shortanswer, numeric, labeldiagram, matching, comprehension.

Respond ONLY with valid JSON, no markdown:
{
  "title": "Cambridge Checkpoint ${subj} — ${stageLabel}",
  "instructions": "brief instructions for students",
  "sections": [
    { "type": "shortanswer", "label": "Section A", "questions": [ { "id": 1, "question": "...", "answer": "...", "points": 2, "explanation": "marking notes" } ] }
  ]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    });

    let text = response.content[0].text.replace(/```json|```/g, '').trim();
    let examData;
    try {
      examData = JSON.parse(text);
    } catch (parseErr) {
      // The model output may have been cut off mid-JSON. Try to salvage by trimming
      // back to the last complete "}" and closing open arrays/objects.
      let salvage = text;
      const lastBrace = salvage.lastIndexOf('}');
      if (lastBrace > 0) {
        salvage = salvage.slice(0, lastBrace + 1);
        // close any unbalanced arrays/objects roughly
        const opens = (salvage.match(/{/g) || []).length, closes = (salvage.match(/}/g) || []).length;
        const aOpens = (salvage.match(/\[/g) || []).length, aCloses = (salvage.match(/\]/g) || []).length;
        salvage += ']'.repeat(Math.max(0, aOpens - aCloses)) + '}'.repeat(Math.max(0, opens - closes));
      }
      try {
        examData = JSON.parse(salvage);
      } catch (e2) {
        return res.status(502).json({ error: 'The paper was too long to generate in one go. Please try fewer marks (e.g. 20) or a single strand, then try again.' });
      }
    }
    if (!examData || !Array.isArray(examData.sections)) {
      return res.status(502).json({ error: 'Generation produced no questions. Please try again with fewer marks or a single strand.' });
    }

    let totalPoints = 0;
    examData.sections.forEach(s => (s.questions || []).forEach(q => { totalPoints += q.points || 1; }));
    const code = 'CP-' + crypto.randomBytes(3).toString('hex').toUpperCase();

    const result = await pool.query(
      `INSERT INTO exams (teacher_id, title, subject, grade, context, purpose, difficulty, adapted_for_weak, time_limit, show_answers, questions, total_points, code, status)
       VALUES ($1,$2,$3,$4,'international','exam','standard',false,60,true,$5,$6,$7,'draft') RETURNING *`,
      [userId, examData.title, subj, stage || null, JSON.stringify(examData), totalPoints, code]
    );

    res.json({ exam: result.rows[0], examData });
  } catch (e) {
    console.error('Checkpoint generate error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Get teacher's exams (Memory)
app.get('/exam/my', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM exams WHERE teacher_id=$1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ exams: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get single exam by ID (teacher)
app.get('/exam/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM exams WHERE id=$1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Exam not found' });
    res.json({ exam: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update exam (teacher edits questions/points)
app.put('/exam/:id', authenticate, async (req, res) => {
  try {
    const { questions, title, timeLimit, showAnswers } = req.body;
    let totalPoints = 0;
    if (questions && questions.sections) {
      questions.sections.forEach(s => s.questions.forEach(q => { totalPoints += q.points || 1; }));
    }
    const result = await pool.query(
      `UPDATE exams SET questions=$1, title=$2, time_limit=$3, show_answers=$4, total_points=$5 WHERE id=$6 AND teacher_id=$7 RETURNING *`,
      [JSON.stringify(questions), title, timeLimit, showAnswers, totalPoints, req.params.id, req.user.id]
    );
    res.json({ exam: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Assign exam (change status to active)
app.post('/exam/:id/assign', authenticate, async (req, res) => {
  try {
    const { classId, maxAttempts } = req.body;
    const result = await pool.query(
      `UPDATE exams SET status='active', classroom_id=$3, max_attempts=$4 WHERE id=$1 AND teacher_id=$2 RETURNING *`,
      [req.params.id, req.user.id, classId || null, maxAttempts || 1]
    );
    res.json({ exam: result.rows[0] });
  } catch (e) {
    // Try without new columns if they don't exist yet
    try {
      await pool.query(`ALTER TABLE exams ADD COLUMN IF NOT EXISTS classroom_id TEXT`);
      await pool.query(`ALTER TABLE exams ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 1`);
      const result = await pool.query(
        `UPDATE exams SET status='active', classroom_id=$3, max_attempts=$4 WHERE id=$1 AND teacher_id=$2 RETURNING *`,
        [req.params.id, req.user.id, req.body.classId || null, req.body.maxAttempts || 1]
      );
      res.json({ exam: result.rows[0] });
    } catch(e2) {
      res.status(500).json({ error: e2.message });
    }
  }
});

// Get active exams for a classroom (student view)
app.get('/exam/classroom/:classId', authenticate, async (req, res) => {
  try {
    const examsResult = await pool.query(
      `SELECT id, title, subject, grade, time_limit, total_points, code, status, max_attempts
       FROM exams WHERE classroom_id::text=$1::text AND (status='active' OR status='closed') ORDER BY created_at DESC`,
      [req.params.classId]
    );

    // For each exam, check if this student has a submission
    const exams = await Promise.all(examsResult.rows.map(async (exam) => {
      const subResult = await pool.query(
        `SELECT id, status, total_score, max_score FROM exam_submissions
         WHERE exam_id=$1 AND student_id=$2 ORDER BY started_at DESC LIMIT 1`,
        [exam.id, req.user.id]
      );
      return {
        ...exam,
        my_submission: subResult.rows.length ? subResult.rows[0] : null
      };
    }));

    res.json({ exams });
  } catch (e) {
    res.status(500).json({ exams: [] });
  }
});

app.get('/exam/submission/:id/my-result', authenticate, async (req, res) => {
  try {
    const subId = req.params.id;
    const userId = req.user.id;

    const subResult = await pool.query(
      `SELECT s.*, e.questions, e.title, e.show_answers, e.subject, e.grade
       FROM exam_submissions s
       JOIN exams e ON e.id = s.exam_id
       WHERE s.id = $1 AND s.student_id = $2`,
      [subId, userId]
    );

    if (!subResult.rows.length) {
      return res.status(404).json({ error: 'Result not found' });
    }

    const row = subResult.rows[0];
    const scores = (row.status === 'graded' && row.final_scores && row.final_scores.length)
      ? row.final_scores : row.ai_scores;

    res.json({
      submission: {
        id: row.id,
        status: row.status,
        total_score: row.total_score,
        max_score: row.max_score,
        answers: row.answers,
        ai_scores: scores,
        submitted_at: row.submitted_at
      },
      exam: {
        title: row.title,
        subject: row.subject,
        grade: row.grade,
        questions: row.questions,
        show_answers: row.show_answers
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Get teacher classrooms
app.get('/classroom/teacher', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM classrooms WHERE teacher_id=$1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ classrooms: result.rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Close exam
app.post('/exam/:id/close', authenticate, async (req, res) => {
  try {
    await pool.query(`UPDATE exams SET status='closed' WHERE id=$1 AND teacher_id=$2`, [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}); 

// Add extra time
app.post('/exam/:id/extend', authenticate, async (req, res) => {
  try {
    const { minutes } = req.body;
    await pool.query(
      `UPDATE exam_submissions SET time_extended=time_extended+$1 WHERE exam_id=$2 AND status='in_progress'`,
      [minutes || 5, req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete exam
app.delete('/exam/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM exam_submissions WHERE exam_id=$1', [req.params.id]);
    await pool.query('DELETE FROM exams WHERE id=$1 AND teacher_id=$2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── STUDENT EXAM ROUTES ──

// Get exam by code (public — no auth needed)
app.get('/exam/join/:code', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, subject, grade, time_limit, questions, total_points, status
       FROM exams WHERE code=$1`,
      [req.params.code.toUpperCase()]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Exam not found' });
    if (result.rows[0].status !== 'active') return res.status(403).json({ error: 'This exam is not active yet' });

    // Return exam without answers
    const exam = result.rows[0];
    const questions = exam.questions;
    // Strip answers from questions
    if (questions.sections) {
      questions.sections.forEach(s => {
        s.questions.forEach(q => {
          delete q.answer;
          delete q.explanation;
        });
      });
    }
    res.json({ exam: { ...exam, questions } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Start exam submission
app.post('/exam/join/:code/start', async (req, res) => {
  try {
    const { guestName, studentId } = req.body;
    const examResult = await pool.query('SELECT * FROM exams WHERE code=$1 AND status=$2', [req.params.code.toUpperCase(), 'active']);
    if (!examResult.rows[0]) return res.status(404).json({ error: 'Exam not found or not active' });
    const exam = examResult.rows[0];

    // Resolve student ID from body OR from JWT token in header
    let resolvedStudentId = studentId || null;
    const authHeader = req.headers.authorization;
    if (!resolvedStudentId && authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = require('jsonwebtoken').verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        resolvedStudentId = decoded.id || decoded.userId || null;
      } catch(e) {}
    }

    const result = await pool.query(
      `INSERT INTO exam_submissions (exam_id, student_id, guest_name, max_score, status)
       VALUES ($1,$2,$3,$4,'in_progress') RETURNING *`,
      [exam.id, resolvedStudentId, guestName || null, exam.total_points]
    );
    res.json({ submission: result.rows[0], timeLimit: exam.time_limit });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Submit exam answers
app.post('/exam/submission/:id/submit', async (req, res) => {
  try {
    const { answers } = req.body;
    const subResult = await pool.query('SELECT * FROM exam_submissions WHERE id=$1', [req.params.id]);
    if (!subResult.rows[0]) return res.status(404).json({ error: 'Submission not found' });
    const sub = subResult.rows[0];

    const examResult = await pool.query('SELECT * FROM exams WHERE id=$1', [sub.exam_id]);
    const exam = examResult.rows[0];
    const examQuestions = exam.questions;

    // AI grades automatically where possible
    let aiScores = [];
    let autoTotal = 0;

    examQuestions.sections.forEach(section => {
      section.questions.forEach(q => {
        const studentAnswer = answers.find(a => a.id === q.id);
        const ans = studentAnswer ? studentAnswer.answer : '';
        let score = 0;
        let autoGraded = false;

        if (['mcq', 'truefalse', 'matching'].includes(section.type)) {
          // Auto-grade exact match
          autoGraded = true;
          if (ans.toString().trim().toLowerCase() === q.answer.toString().trim().toLowerCase()) {
            score = q.points || 1;
          }
        } else if (section.type === 'numeric') {
          // Auto-grade numeric: compare numeric values, tolerant of "x = 4", "4.0", spaces
          autoGraded = true;
          const norm = (s) => {
            const m = (s == null ? '' : s.toString()).replace(/\s+/g, '').replace(/^[a-zA-Z]+=/, '');
            const num = parseFloat(m);
            return isNaN(num) ? m.toLowerCase() : num;
          };
          const a = norm(ans), b = norm(q.answer);
          if (typeof a === 'number' && typeof b === 'number') {
            if (Math.abs(a - b) < 1e-6) score = q.points || 1;
          } else if (a === b && a !== '') {
            score = q.points || 1;
          }
        } else if (section.type === 'dragorder') {
          // ans is the student's ordered array of items (or comma string); compare to q.items
          autoGraded = true;
          const correct = (q.items || []).map(x => x.toString().trim());
          let studentArr = Array.isArray(ans) ? ans : (ans ? ans.toString().split('|||') : []);
          studentArr = studentArr.map(x => x.toString().trim());
          if (correct.length && studentArr.length === correct.length &&
              correct.every((v, i) => v === studentArr[i])) {
            score = q.points || 1;
          }
        } else if (section.type === 'highlight') {
          // ans is an array of selected indices; compare to q.correct
          autoGraded = true;
          const correct = (q.correct || []).map(Number).sort((x, y) => x - y);
          let sel = Array.isArray(ans) ? ans.map(Number) : (ans !== '' && ans != null ? ans.toString().split(',').map(Number) : []);
          sel = sel.sort((x, y) => x - y);
          if (correct.length && sel.length === correct.length &&
              correct.every((v, i) => v === sel[i])) {
            score = q.points || 1;
          }
        } else if (section.type === 'dropdown') {
          // ans is an object/array of chosen options per blank; compare each to its answer
          autoGraded = true;
          const blanks = (q.segments || []).filter(s => s.blank).map(s => s.blank.answer);
          let chosen = [];
          if (Array.isArray(ans)) chosen = ans;
          else if (ans && typeof ans === 'object') chosen = Object.keys(ans).sort((x,y)=>Number(x)-Number(y)).map(k => ans[k]);
          if (blanks.length && chosen.length === blanks.length &&
              blanks.every((v, i) => (v || '').toString().trim().toLowerCase() === (chosen[i] || '').toString().trim().toLowerCase())) {
            score = q.points || 1;
          }
        } else {
          // AI will suggest grade — set to null for teacher review
          autoGraded = false;
          score = null;
        }

        aiScores.push({ id: q.id, score, maxScore: q.points || 1, autoGraded, studentAnswer: ans, correctAnswer: q.answer });
        if (autoGraded && score !== null) autoTotal += score;
      });
    });

    await pool.query(
      `UPDATE exam_submissions SET answers=$1, ai_scores=$2, final_scores=$2, status='submitted', submitted_at=NOW()
       WHERE id=$3`,
      [JSON.stringify(answers), JSON.stringify(aiScores), req.params.id]
    );

    res.json({ success: true, message: 'Exam submitted successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Teacher updates grades
app.put('/exam/submission/:id/grade', authenticate, async (req, res) => {
  try {
    const { finalScores } = req.body;
    const total = finalScores.reduce((sum, s) => sum + (s.score || 0), 0);
    await pool.query(
      `UPDATE exam_submissions SET final_scores=$1, total_score=$2, status='graded' WHERE id=$3`,
      [JSON.stringify(finalScores), total, req.params.id]
    );
    res.json({ success: true, totalScore: total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get live results for teacher

// Student: view own submission result

app.get('/exam/:id/results', authenticate, async (req, res) => {
  try {
    const exam = await pool.query('SELECT * FROM exams WHERE id=$1 AND teacher_id=$2', [req.params.id, req.user.id]);
    if (!exam.rows[0]) return res.status(404).json({ error: 'Not found' });

    const submissions = await pool.query(
      `SELECT s.*, u.name as student_name FROM exam_submissions s
       LEFT JOIN users u ON s.student_id=u.id
       WHERE s.exam_id=$1 ORDER BY s.started_at ASC`,
      [req.params.id]
    );

    const rows = submissions.rows;
    const submitted = rows.filter(r => r.status !== 'in_progress');
    const avgScore = submitted.length > 0
      ? Math.round(submitted.reduce((sum, r) => sum + (r.total_score || 0), 0) / submitted.length)
      : 0;

    res.json({
      exam: exam.rows[0],
      submissions: rows,
      stats: {
        total: rows.length,
        inProgress: rows.filter(r => r.status === 'in_progress').length,
        submitted: submitted.length,
        graded: rows.filter(r => r.status === 'graded').length,
        avgScore,
        maxScore: exam.rows[0].total_points
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
