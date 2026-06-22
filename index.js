require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());
app.use(cors());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Initialize database tables
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      grade INT CHECK (grade BETWEEN 1 AND 12),
      plan TEXT DEFAULT 'free',
      daily_count INT DEFAULT 0,
      last_reset DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS chat_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      role TEXT CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      subject TEXT,
      grade INT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_chat_user 
      ON chat_history(user_id, created_at DESC);
  `);
  console.log('Database ready');
}

// Middleware: verify JWT token
function authenticateToken(req, res, next) {
  const auth = req.headers['authorization'];
  const token = auth && auth.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Grade-aware Socratic system prompt
function getSystemPrompt(grade, subject) {
  const gradeNum = parseInt(grade);
  let tone = '';
  let style = '';

  if (gradeNum <= 5) {
    tone = 'You are a warm, encouraging, and patient tutor for young Vietnamese students. Use simple words, short sentences, and fun real-life examples. Always celebrate small wins with phrases like "Rất giỏi!" or "Tuyệt vời!".';
    style = 'Keep explanations very short and simple. Use emojis occasionally to make learning fun. Ask one simple question at a time.';
  } else if (gradeNum <= 9) {
    tone = 'You are a supportive and clear tutor for Vietnamese middle school students. Strike a balance between friendly and academic. Use relatable examples from everyday Vietnamese life.';
    style = 'Break problems into clear numbered steps. Encourage the student to think through each step before moving on. Use some Vietnamese phrases mixed with English when helpful.';
  } else {
    tone = 'You are a professional and knowledgeable tutor for Vietnamese high school students preparing for important exams (MOET and Cambridge). Be precise, structured, and exam-focused.';
    style = 'Use formal academic language. Structure responses with clear headings and numbered steps. Focus on exam technique and deep conceptual understanding. Reference MOET exam formats when relevant.';
  }

  return `${tone}

Subject: ${subject} | Grade: ${gradeNum}

CRITICAL RULE — Socratic Method: Never give the direct answer to a problem. Instead:
1. Acknowledge what the student is trying to solve
2. Break it down into the first manageable step
3. Ask the student a guiding question to lead them to the answer themselves
4. Only reveal the answer after the student has attempted it

${style}

Always respond in the same language the student uses. If they write in Vietnamese, respond in Vietnamese. If they write in English, respond in English. If they mix both, match their style.

Format your responses professionally:
- Use clear sections with line breaks
- Number steps when explaining processes  
- Use bullet points for lists
- Bold key terms using *asterisks*
- Keep responses focused and not too long`;
}

// ─── ROUTES ───────────────────────────────────────────

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'EduBot Vietnam is running',
    version: '2.0',
    timestamp: new Date().toISOString()
  });
});

// Register
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name, grade } = req.body;
    if (!email || !password || !name || !grade) {
      return res.status(400).json({ error: 'All fields required' });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name, grade) VALUES ($1, $2, $3, $4) RETURNING id, email, name, grade, plan',
      [email, hash, name, grade]
    );
    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id, grade: user.grade, plan: user.plan },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1', [email]
    );
    const user = result.rows[0];
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: 'Sai email hoặc mật khẩu' });
    }
    const token = jwt.sign(
      { userId: user.id, grade: user.grade, plan: user.plan },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ 
      token, 
      user: { id: user.id, name: user.name, grade: user.
