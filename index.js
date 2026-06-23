require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

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
      role TEXT DEFAULT 'student',
      grade INT CHECK (grade BETWEEN 1 AND 12),
      institution TEXT,
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
    CREATE TABLE IF NOT EXISTS classrooms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      subject TEXT,
      grade INT,
      code TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS classroom_students (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
      student_id UUID REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(classroom_id, student_id)
    );
    CREATE TABLE IF NOT EXISTS weak_points (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      topic TEXT NOT NULL,
      count INT DEFAULT 1,
      last_flagged TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_history(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_classroom_teacher ON classrooms(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_classroom_students ON classroom_students(classroom_id);
  `);

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS institution TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_count INT DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_reset DATE DEFAULT CURRENT_DATE;
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

function requireTeacher(req, res, next) {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Teacher access required' });
  }
  next();
}

function generateClassCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'EDU-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getSystemPrompt(grade, subject, role) {
  if (role === 'teacher') {
    return `You are EduBot, a professional AI teaching assistant for Vietnamese educators.
Subject: ${subject} | Grade: ${grade}
You help teachers with:
1. Creating detailed lesson plans aligned with MOET and Cambridge curricula
2. Generating exam questions at appropriate difficulty levels
3. Suggesting teaching strategies for different learning styles
4. Creating assessment rubrics and marking schemes
5. Providing subject-specific pedagogical advice
Format all responses professionally with clear sections, numbered lists, and practical examples.
Be concise, actionable, and educator-focused.
Respond in the same language the teacher uses.`;
  }

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
    style = 'Use formal academic language. Structure all responses with clear sections and numbered steps. Reference MOET exam formats and marking schemes when relevant.';
  }

  return `${tone}
Subject: ${subject} | Grade: ${gradeNum}
CRITICAL RULE - Socratic Method: Never give the direct answer. Instead:
1. Acknowledge what the student is asking
2. Identify the first step needed
3. Ask a guiding question to lead them to discover the answer themselves
4. Only confirm or reveal after the student has attempted it
${style}
Respond in the same language the student uses. Vietnamese gets Vietnamese. English gets English.
Format every response professionally:
- Use clear sections with spacing
- Number all steps in processes
- Use bullet points for lists
- Use *bold* for key terms
- Keep responses focused, not too long`;
}

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name, role, grade, institution } = req.body;
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (role === 'student' && !grade) {
      return res.status(400).json({ error: 'Grade is required for students' });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, grade, institution)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, name, role, grade, institution, plan`,
      [email, hash, name, role, grade || null, institution || null]
    );
    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id, role: user.role, grade: user.grade, plan: user.plan },
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
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: 'Sai email hoặc mật khẩu' });
    }
    const token = jwt.sign(
      { userId: user.id, role: user.role, grade: user.grade, plan: user.plan },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: user.id, name: user.name, role: user.role, grade: user.grade, plan: user.plan }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// FIX 1: Send 'response' instead of 'reply', and handle teacher role properly
app.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message, subject, grade } = req.body;
    const { userId, plan, role } = req.user;

    if (!message || !subject) {
      return res.status(400).json({ error: 'Message and subject are required' });
    }

    // Only limit students on free plan
    if (plan === 'free' && role === 'student') {
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
        return res.status(429).json({
          error: 'Daily limit reached',
          message: 'Bạn đã dùng hết 5 câu hỏi miễn phí hôm nay. Nâng cấp lên Premium để học không giới hạn!',
          upgrade: true
        });
      }
    }

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

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: getSystemPrompt(grade || 10, subject, role),
        messages
      })
    });

    const data = await aiRes.json();

    if (!data.content || !data.content[0]) {
      console.error('Anthropic error:', data);
      return res.status(500).json({ error: 'AI service error. Please try again.' });
    }

    const reply = data.content[0].text;

    await pool.query(
      'INSERT INTO chat_history (user_id, role, content, subject, grade) VALUES ($1, $2, $3, $4, $5)',
      [userId, 'user', message, subject, grade || 10]
    );
    await pool.query(
      'INSERT INTO chat_history (user_id, role, content, subject, grade) VALUES ($1, $2, $3, $4, $5)',
      [userId, 'assistant', reply, subject, grade || 10]
    );

    if (plan === 'free' && role === 'student') {
      const countResult = await pool.query(
        'UPDATE users SET daily_count = daily_count + 1 WHERE id = $1 RETURNING daily_count',
        [userId]
      );
      const newCount = countResult.rows[0].daily_count;
      // FIX 1: return 'response' not 'reply', and include remaining count
      return res.json({ response: reply, remaining: 5 - newCount });
    }

    // FIX 1: return 'response' not 'reply'
    res.json({ response: reply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat failed. Please try again.' });
  }
});

// FIX 2: chat history returns 'messages' not 'history'
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
    res.json({ messages: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Could not load history' });
  }
});

app.get('/user/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, grade, institution, plan, daily_count, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Could not load profile' });
  }
});

app.post('/classroom/create', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { name, subject, grade } = req.body;
    if (!name) return res.status(400).json({ error: 'Classroom name required' });
    let code = generateClassCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await pool.query('SELECT id FROM classrooms WHERE code = $1', [code]);
      if (existing.rows.length === 0) break;
      code = generateClassCode();
      attempts++;
    }
    const result = await pool.query(
      `INSERT INTO classrooms (teacher_id, name, subject, grade, code)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.userId, name, subject, grade, code]
    );
    res.json({ classroom: result.rows[0] });
  } catch (err) {
    console.error('Create classroom error:', err);
    res.status(500).json({ error: 'Could not create classroom' });
  }
});

// FIX 3: /classroom/my works for BOTH teachers and students
app.get('/classroom/my', authenticateToken, async (req, res) => {
  try {
    const { userId, role } = req.user;

    if (role === 'teacher') {
      const result = await pool.query(
        `SELECT c.*, COUNT(cs.student_id) as student_count
         FROM classrooms c
         LEFT JOIN classroom_students cs ON c.id = cs.classroom_id
         WHERE c.teacher_id = $1
         GROUP BY c.id
         ORDER BY c.created_at DESC`,
        [userId]
      );
      return res.json({ classrooms: result.rows });
    } else {
      // Student: get classrooms they joined + teacher name
      const result = await pool.query(
        `SELECT c.*, u.name as teacher_name
         FROM classroom_students cs
         JOIN classrooms c ON cs.classroom_id = c.id
         JOIN users u ON c.teacher_id = u.id
         WHERE cs.student_id = $1
         ORDER BY cs.joined_at DESC`,
        [userId]
      );
      return res.json({ classrooms: result.rows });
    }
  } catch (err) {
    console.error('Load classrooms error:', err);
    res.status(500).json({ error: 'Could not load classrooms' });
  }
});

app.post('/classroom/join', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Classroom code required' });
    const classResult = await pool.query(
      'SELECT * FROM classrooms WHERE code = $1', [code.toUpperCase()]
    );
    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found. Check your code.' });
    }
    const classroom = classResult.rows[0];
    await pool.query(
      `INSERT INTO classroom_students (classroom_id, student_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [classroom.id, req.user.userId]
    );
    res.json({ classroom, message: 'Successfully joined classroom!' });
  } catch (err) {
    console.error('Join classroom error:', err);
    res.status(500).json({ error: 'Could not join classroom' });
  }
});

app.get('/classroom/:id/students', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.grade, u.daily_count, u.last_reset,
              cs.joined_at,
              COUNT(ch.id) as total_messages,
              MAX(ch.created_at) as last_active
       FROM classroom_students cs
       JOIN users u ON cs.student_id = u.id
       LEFT JOIN chat_history ch ON u.id = ch.user_id
       WHERE cs.classroom_id = $1
       GROUP BY u.id, cs.joined_at
       ORDER BY last_active DESC NULLS LAST`,
      [req.params.id]
    );
    res.json({ students: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Could not load students' });
  }
});

app.get('/student/:id/weakpoints', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT subject, topic, count, last_flagged
       FROM weak_points WHERE user_id = $1
       ORDER BY count DESC`,
      [req.params.id]
    );
    res.json({ weakPoints: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Could not load weak points' });
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
