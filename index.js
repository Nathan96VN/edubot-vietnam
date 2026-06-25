<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>EduBot — Games</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    :root{--bg:#0D1B2E;--card:#112240;--panel:#0A1628;--primary:#00B4D8;--accent:#00D4FF;--teacher:#059669;--text:#E2E8F0;--muted:#94A3B8;--border:#1A3A5C;--success:#10B981;--error:#EF4444;--warn:#F59E0B}
    body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;padding:0}
    .bg-glow{position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at 70% 20%,rgba(0,180,216,0.12),transparent 55%),radial-gradient(ellipse at 20% 80%,rgba(124,58,237,0.1),transparent 50%)}
    /* NAV */
    nav{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:var(--panel);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10}
    .nav-logo{display:flex;align-items:center;gap:8px;text-decoration:none;font-size:18px;font-weight:800}
    .nav-logo img{height:28px}
    .nav-logo em{color:var(--primary);font-style:normal}
    .nav-right{display:flex;align-items:center;gap:10px}
    .btn-back{padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:13px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
    .btn-back:hover{color:var(--text);border-color:var(--primary)}
    .lang-wrap{display:flex;background:var(--card);border:1px solid var(--border);border-radius:20px;overflow:hidden}
    .lb{padding:5px 11px;font-size:12px;font-weight:700;border:none;background:transparent;color:var(--muted);cursor:pointer}.lb.on{background:var(--primary);color:#fff}
    /* MAIN */
    .wrap{max-width:800px;margin:0 auto;padding:20px;position:relative;z-index:1}
    /* GAME MENU */
    .game-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:20px}
    .game-card{background:var(--card);border:1.5px solid var(--border);border-radius:16px;padding:24px;text-align:center;cursor:pointer;transition:all .25s;position:relative;overflow:hidden}
    .game-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;opacity:0;transition:opacity .3s}
    .game-card:hover{transform:translateY(-4px);box-shadow:0 12px 30px rgba(0,180,216,0.1)}
    .game-card:hover::before{opacity:1}
    .gc-kahoot::before{background:linear-gradient(90deg,#f59e0b,#ef4444)}.gc-kahoot:hover{border-color:rgba(245,158,11,0.4)}
    .gc-speed::before{background:linear-gradient(90deg,#00B4D8,#00D4FF)}.gc-speed:hover{border-color:rgba(0,180,216,0.4)}
    .gc-flip::before{background:linear-gradient(90deg,#7c3aed,#a855f7)}.gc-flip:hover{border-color:rgba(124,58,237,0.4)}
    .game-icon{font-size:48px;margin-bottom:12px}
    .game-card h3{font-size:17px;font-weight:800;margin-bottom:6px}
    .game-card p{font-size:13px;color:var(--muted);line-height:1.5}
    .game-badge{display:inline-block;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;margin-top:10px;background:rgba(16,185,129,0.15);color:var(--success);border:1px solid rgba(16,185,129,0.3)}
    /* SETUP */
    .setup-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:20px}
    .setup-card h4{font-size:14px;font-weight:700;margin-bottom:14px;color:var(--text)}
    .setup-row{display:flex;gap:10px;flex-wrap:wrap}
    .setup-row select{flex:1;min-width:120px;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:var(--panel);color:var(--text);font-size:13px;outline:none}
    /* GAME SCREENS */
    .game-screen{display:none;flex-direction:column;gap:14px}
    .game-screen.on{display:flex}
    .game-topbar{display:flex;align-items:center;gap:10px}
    .btn-menu{padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:13px;cursor:pointer}
    .btn-menu:hover{color:var(--text)}
    .score-pill{flex:1;display:flex;justify-content:space-between;align-items:center;background:var(--panel);border-radius:10px;padding:8px 16px;font-size:13px}
    .score-num{font-size:22px;font-weight:900;color:var(--primary)}
    /* KAHOOT */
    .q-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;text-align:center}
    .q-label{font-size:12px;color:var(--muted);margin-bottom:6px}
    .q-text{font-size:17px;font-weight:700;line-height:1.5;margin-bottom:8px}
    .q-timer{font-size:32px;font-weight:900;color:var(--warn)}
    .ans-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .ans-btn{padding:16px 12px;border-radius:12px;border:none;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;text-align:left;display:flex;align-items:center;gap:10px}
    .ans-btn:nth-child(1){background:rgba(239,68,68,0.2);border:1.5px solid rgba(239,68,68,0.4);color:#fca5a5}
    .ans-btn:nth-child(2){background:rgba(59,130,246,0.2);border:1.5px solid rgba(59,130,246,0.4);color:#93c5fd}
    .ans-btn:nth-child(3){background:rgba(245,158,11,0.2);border:1.5px solid rgba(245,158,11,0.4);color:#fcd34d}
    .ans-btn:nth-child(4){background:rgba(16,185,129,0.2);border:1.5px solid rgba(16,185,129,0.4);color:#6ee7b7}
    .ans-btn:hover{transform:scale(1.02)}.ans-btn:disabled{cursor:default;transform:none}
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
