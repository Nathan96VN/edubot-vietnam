require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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
  console.log('Database tables ready');
}

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

function getSystemPrompt(grade, subject) {
  const gradeNum = parseInt(grade);
  let tone = '';
  let style = '';

  if (gradeNum <= 5) {
    tone = 'You are a warm, encouraging, and patient tutor for young Vietnamese students in grades 1-5. Use very simple words, short sentences, and fun real-life examples from everyday Vietnamese life. Always celebrate effort with phrases like "Rất giỏi!" or "Tuyệt vời!".';
    style = 'Keep explanations very short and simple. Ask only one question at a time. Use occasional emojis to make learning enjoyable.';
  } else if (gradeNum <= 9) {
    tone = 'You are a supportive and clear tutor for Vietnamese middle school students in grades 6-9. Be friendly but academic. Use relatable examples from Vietnamese daily life and culture.';
    style = 'Break problems into clear numbered steps. Encourage the student to attempt each step before you continue. Mix Vietnamese and English naturally when helpful.';
  } else {
    tone = 'You are a professional and precise tutor for Vietnamese high school students in grades 10-12 preparing for MOET graduation exams and Cambridge assessments. Be structured, exam-focused, and academically rigorous.';
    style = 'Use formal academic language. Structure all responses with clear sections and numbered steps. Reference MOET exam formats and marking schemes when relevant. Focus on conceptual depth and exam technique.';
  }

  return `${tone}

Subject: ${subject} | Grade: ${gradeNum}

CRITICAL RULE - Socratic Method: Never give the direct answer. Instead:
1. Acknowledge what the student is asking
2. Identify the first step needed
3. Ask a guiding question to lead them to discover the answer themselves
4. Only confirm or reveal after the student has attempted it

${style}

Respond in the same language the student uses. Vietnamese gets Vietnamese. English gets English. Mixed gets mixed.

Format every response professionally:
- Use clear sections with spacing
- Number all steps in processes
- Use bullet points for lists
- Use *bold* for key terms and important concepts
- Keep responses focused, not too long, not too short`;
}

app.get('/', (req, res) => {
  res.json({
    status: 'EduBot Vietnam is live',
    version: '2.0',
    timestamp: new Date().toISOString()
  });
});

app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name, grade } = req.body;
    if (!email || !password || !name || !grade) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, grade) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email, name, grade, plan`,
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
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
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
      user: { id: user.id, name: user.name, grade: user.grade, plan: user.plan }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message, subject, grade } = req.body;
    const { userId, plan } = req.user;

    if (!message || !subject || !grade) {
      return res.status(400).json({ error: 'Message, subject and grade are required' });
    }

    // Check free plan daily limit
    if (plan === 'free') {
      const userResult = await pool.query(
        'SELECT daily_count, last_reset FROM users WHERE id = $1', [userId]
      );
      const userData = userResult.rows[0];
      const today = new Date().toISOString().split('T')[0];

      if (userData.last_reset !== today) {
        await pool.query(
          'UPDATE users SET daily_count = 0, last_reset = $1 WHERE id = $2',
          [today, userId]
        );
        userData.daily_count = 0;
      }

      if (userData.daily_count >= 5) {
        return res.status(403).json({
          error: 'Daily limit reached',
          message: 'Bạn đã dùng hết 5 câu hỏi miễn phí hôm nay. Nâng cấp lên Premium để học không giới hạn!',
          upgrade: true
        });
      }
    }

    // Load last 20 messages for context
    const historyResult = await pool.query(
      `SELECT role, content FROM chat_history 
       WHERE user_id = $1 AND subject = $2
       ORDER BY created_at DESC LIMIT 20`,
      [userId, subject]
    );
    const history = historyResult.rows.reverse();

    const messages = [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ];

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: getSystemPrompt(grade, subject),
        messages
      })
    });

    const data = await response.json();
    const reply = data.content[0].text;

    // Save both messages to database
    await pool.query(
      'INSERT INTO chat_history (user_id, role, content, subject, grade) VALUES ($1, $2, $3, $4, $5)',
      [userId, 'user', message, subject, grade]
    );
    await pool.query(
      'INSERT INTO chat_history (user_id, role, content, subject, grade) VALUES ($1, $2, $3, $4, $5)',
      [userId, 'assistant', reply, subject, grade]
    );

    // Increment daily count for free users
    if (plan === 'free') {
      await pool.query(
        'UPDATE users SET daily_count = daily_count + 1 WHERE id = $1', [userId]
      );
    }

    res.json({ reply });

  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat failed. Please try again.' });
  }
});

app.get('/chat/history', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { subject } = req.query;
    const result = await pool.query(
      `SELECT role, content, subject, grade, created_at 
       FROM chat_history 
       WHERE user_id = $1 AND subject = $2
       ORDER BY created_at ASC LIMIT 50`,
      [userId, subject]
    );
    res.json({ history: result.rows });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ error: 'Could not load history' });
  }
});

app.get('/user/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, grade, plan, daily_count, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Could not load profile' });
  }
});

initDB().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`EduBot Vietnam running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
