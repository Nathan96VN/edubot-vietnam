<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"/>
<title>International English Practice — StellaStride</title>
<style>
  :root{
    --bg:#EEF2FF; --navy:#1E1B4B; --teal:#00B4A6; --peri:#7B8CDE;
    --card:#ffffff; --border:#d8dcef; --muted:#888; --text:#1E1B4B;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Poppins',system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;}
  .wrap{max-width:980px;margin:0 auto;padding:28px 20px 80px;}
  .topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;}
  .brand{font-weight:900;font-size:22px;color:var(--navy);}
  .brand span{color:var(--teal);}
  .back{font-size:13px;color:var(--peri);cursor:pointer;background:none;border:none;font-family:inherit;}
  .back:hover{color:var(--teal);}
  .eyebrow{font-size:11px;color:var(--peri);font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px;}
  h1{font-size:24px;font-weight:900;color:var(--navy);margin-bottom:4px;}
  .sub{font-size:13px;color:var(--muted);margin-bottom:22px;}
  .panel{background:var(--card);border:.5px solid var(--border);border-radius:12px;padding:18px;margin-bottom:14px;}
  .panel .lbl{font-size:12px;color:var(--navy);font-weight:700;margin-bottom:10px;}
  .panel .lbl .opt{color:var(--muted);font-weight:400;}
  .chips{display:flex;gap:8px;flex-wrap:wrap;}
  .chip{border:.5px solid var(--border);border-radius:8px;padding:7px 14px;font-size:13px;color:#666;cursor:pointer;background:#fff;user-select:none;}
  .chip.on{border:2px solid var(--teal);background:#E1F5EE;color:var(--navy);font-weight:600;padding:6px 13px;}
  .lvl{min-width:54px;text-align:center;font-weight:700;}
  input.topic{width:100%;border:.5px solid var(--border);border-radius:8px;padding:9px 12px;font-size:13px;color:var(--text);background:#fafbff;font-family:inherit;}
  .row2{display:flex;gap:14px;}
  @media(max-width:560px){.row2{flex-direction:column;}}
  .row2 .panel{flex:1;margin-bottom:0;}
  .actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px;}
  .btn{border-radius:8px;padding:10px 22px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;border:none;}
  .btn.sec{background:#fff;border:.5px solid var(--border);color:#666;}
  .btn.pri{background:var(--teal);color:#fff;}
  .btn.pri:disabled{opacity:.5;cursor:not-allowed;}
  .result{background:var(--card);border:.5px solid var(--border);border-radius:12px;padding:20px;margin-top:16px;}
  .result h2{font-size:18px;color:var(--navy);margin-bottom:12px;}
  .qitem{border-bottom:1px solid #eef;padding:12px 0;}
  .qitem .qt{font-size:14px;color:var(--text);margin-bottom:6px;}
  .qitem .qn{color:var(--teal);font-weight:700;}
  .qitem .ans{font-size:12px;color:#1d7a4d;margin-top:4px;}
  .spinner{display:inline-block;width:16px;height:16px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite;vertical-align:-3px;margin-right:6px;}
  @keyframes spin{to{transform:rotate(360deg);}}
</style>
</head>
<body>
<div class="wrap">
  <div class="topbar">
    <div class="brand">Stella<span>Stride</span></div>
    <button class="back" onclick="location.href='/app'">← Back to app</button>
  </div>

  <div class="eyebrow">International English Practice</div>
  <h1>Set up your paper</h1>
  <div class="sub">Generate CEFR-aligned English practice (A2–C2): reading, writing, grammar, listening &amp; speaking.</div>

  <div class="chips" style="margin-bottom:18px">
    <div class="chip on" id="mode-paper" onclick="setMode('paper')">📝 Reading / Writing / Grammar</div>
    <div class="chip" id="mode-listening" onclick="setMode('listening')">🎧 Listening</div>
    <div class="chip" id="mode-speaking" onclick="setMode('speaking')">🎤 Speaking</div>
  </div>

  <div id="paper-mode">

  <div class="panel">
    <div class="lbl">LEVEL (CEFR)</div>
    <div class="chips" id="level-chips">
      <div class="chip lvl" data-level="A2" onclick="pickLevel(this,'A2')">A2</div>
      <div class="chip lvl on" data-level="B1" onclick="pickLevel(this,'B1')">B1</div>
      <div class="chip lvl" data-level="B2" onclick="pickLevel(this,'B2')">B2</div>
      <div class="chip lvl" data-level="C1" onclick="pickLevel(this,'C1')">C1</div>
      <div class="chip lvl" data-level="C2" onclick="pickLevel(this,'C2')">C2</div>
    </div>
  </div>

  <div class="panel">
    <div class="lbl">SKILLS <span class="opt">(pick one or more)</span></div>
    <div class="chips" id="skill-chips"></div>
  </div>

  <div class="panel">
    <div class="lbl">TOPIC <span class="opt">(optional — leave blank for a mix)</span></div>
    <input class="topic" id="topic" placeholder="e.g. Travel, Technology, Environment…"/>
  </div>

  <div class="row2">
    <div class="panel">
      <div class="lbl">NUMBER OF QUESTIONS</div>
      <div class="chips" id="count-chips">
        <div class="chip" data-count="10" onclick="pickCount(this,10)">10</div>
        <div class="chip on" data-count="15" onclick="pickCount(this,15)">15</div>
        <div class="chip" data-count="25" onclick="pickCount(this,25)">25</div>
      </div>
    </div>
  </div>

  <div class="actions">
    <button class="btn sec" onclick="location.href='/app'">Back</button>
    <button class="btn pri" id="gen-btn" onclick="generate()">Generate Paper</button>
  </div>

  <div id="result-area"></div>
  </div><!-- /paper-mode -->

  <!-- LISTENING MODE -->
  <div id="listening-mode" style="display:none">
    <div class="panel">
      <div class="lbl">LEVEL (CEFR)</div>
      <div class="chips" id="l-level-chips">
        <div class="chip lvl" onclick="pickLLevel(this,'A2')">A2</div>
        <div class="chip lvl on" onclick="pickLLevel(this,'B1')">B1</div>
        <div class="chip lvl" onclick="pickLLevel(this,'B2')">B2</div>
        <div class="chip lvl" onclick="pickLLevel(this,'C1')">C1</div>
        <div class="chip lvl" onclick="pickLLevel(this,'C2')">C2</div>
      </div>
    </div>
    <div class="actions" style="justify-content:flex-start">
      <button class="btn pri" id="lgen-btn" onclick="genListening()">Generate Listening</button>
    </div>
    <div id="listening-area"></div>
  </div>

  <!-- SPEAKING MODE -->
  <div id="speaking-mode" style="display:none">
    <div class="panel">
      <div class="lbl">LEVEL (CEFR)</div>
      <div class="chips" id="s-level-chips">
        <div class="chip lvl" onclick="pickSLevel(this,'A2')">A2</div>
        <div class="chip lvl on" onclick="pickSLevel(this,'B1')">B1</div>
        <div class="chip lvl" onclick="pickSLevel(this,'B2')">B2</div>
        <div class="chip lvl" onclick="pickSLevel(this,'C1')">C1</div>
        <div class="chip lvl" onclick="pickSLevel(this,'C2')">C2</div>
      </div>
    </div>
    <div class="actions" style="justify-content:flex-start">
      <button class="btn pri" id="sgen-btn" onclick="genSpeaking()">Generate Speaking</button>
    </div>
    <div id="speaking-area"></div>
  </div>
</div>

<script>
var API = 'https://edubot-vietnam.onrender.com';
var tok = localStorage.getItem('eb_tok') || '';

var SKILLS = ['Reading','Grammar & Vocabulary','Writing'];
var state = { level:'B1', skills:[], topic:'', questionCount:15 };

(function initSkills(){
  var box = document.getElementById('skill-chips');
  SKILLS.forEach(function(sk){
    var d = document.createElement('div');
    d.className = 'chip'; d.textContent = sk;
    d.onclick = function(){ toggleSkill(d, sk); };
    box.appendChild(d);
  });
  // default-select Reading + Grammar
  var chips = box.querySelectorAll('.chip');
  toggleSkill(chips[0], SKILLS[0]);
  toggleSkill(chips[1], SKILLS[1]);
})();

function pickLevel(el,v){ state.level=v; el.parentNode.querySelectorAll('.chip').forEach(function(c){c.classList.remove('on');}); el.classList.add('on'); }
function pickCount(el,v){ state.questionCount=v; el.parentNode.querySelectorAll('.chip').forEach(function(c){c.classList.remove('on');}); el.classList.add('on'); }
function toggleSkill(el, sk){
  var i = state.skills.indexOf(sk);
  if(i===-1){ state.skills.push(sk); el.classList.add('on'); }
  else { state.skills.splice(i,1); el.classList.remove('on'); }
}

async function generate(){
  state.topic = document.getElementById('topic').value.trim();
  if(state.skills.length===0){ state.skills=['Reading','Grammar & Vocabulary']; }
  var btn = document.getElementById('gen-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Generating…';
  var area = document.getElementById('result-area'); area.innerHTML = '';
  try{
    var res = await fetch(API + '/international-english/generate', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+tok },
      body: JSON.stringify(state)
    });
    var data = await res.json();
    if(!res.ok){ throw new Error(data.error || 'Generation failed'); }
    renderResult(data.examData, data.exam);
  }catch(e){
    area.innerHTML = '<div class="result" style="color:#b00020">Could not generate: '+esc(e.message)+'</div>';
  }finally{
    btn.disabled = false; btn.textContent = 'Generate Paper';
  }
}

function renderResult(examData, exam){
  var area = document.getElementById('result-area');
  var realTotal = 0;
  (examData.sections||[]).forEach(function(sec){ (sec.questions||[]).forEach(function(q){ realTotal += (q.points||1); }); });
  var html = '<div class="result"><h2>'+esc(examData.title||'International English Practice')+'</h2>';
  html += '<div style="display:inline-block;background:#E1F5EE;color:#0F6E56;font-weight:700;font-size:13px;padding:5px 12px;border-radius:6px;margin-bottom:8px">Total: '+realTotal+' marks</div>';
  if(examData.instructions){ html += '<div class="sub">'+esc(examData.instructions)+'</div>'; }
  (examData.sections||[]).forEach(function(sec){
    html += '<div style="margin-top:10px;font-weight:700;color:var(--peri)">'+esc(sec.label||sec.type)+'</div>';
    (sec.questions||[]).forEach(function(q){
      html += '<div class="qitem"><div class="qt"><span class="qn">'+(q.id)+'.</span> '+esc(q.question)+' <span style="color:#aaa;font-size:12px">('+(q.points||1)+' marks)</span></div>';
      if(q.passage){ html += '<div style="font-size:13px;color:#444;background:#f7f8ff;padding:8px;border-radius:6px;margin:4px 0">'+esc(q.passage)+'</div>'; }
      if(q.options){ q.options.forEach(function(o){ html += '<div style="font-size:13px;color:#444;padding:2px 0">'+esc(o)+'</div>'; }); }
      if(q.answer){ html += '<div class="ans">✓ '+esc(q.answer)+'</div>'; }
      if(q.explanation){ html += '<div style="font-size:11px;color:#b4690e;font-style:italic;margin-top:2px">'+esc(q.explanation)+'</div>'; }
      html += '</div>';
    });
  });
  html += '<div style="margin-top:14px;font-size:12px;color:var(--muted)">Saved to your exam Memory'+(exam&&exam.code?' · code '+esc(exam.code):'')+'. Open it in the Exam Generator to edit, assign, or export to Word.</div>';
  html += '</div>';
  area.innerHTML = html;
  area.scrollIntoView({behavior:'smooth'});
}

function esc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

/* ===================== MODE SWITCHING ===================== */
function setMode(m){
  ['paper','listening','speaking'].forEach(function(x){
    document.getElementById(x+'-mode').style.display = (x===m)?'':'none';
    var t=document.getElementById('mode-'+x); if(t) t.classList.toggle('on', x===m);
  });
}

/* ===================== LISTENING ===================== */
var lState = { level:'B1' };
var lAudioQueue = [], lAudioIdx = 0, lPlaying = false, lCurrentAudio = null, lAnswers = {};
function pickLLevel(el,v){ lState.level=v; el.parentNode.querySelectorAll('.chip').forEach(function(c){c.classList.remove('on');}); el.classList.add('on'); }

async function genListening(){
  var btn=document.getElementById('lgen-btn'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span>Generating…';
  var area=document.getElementById('listening-area'); area.innerHTML='';
  lAudioQueue=[]; lAudioIdx=0; lPlaying=false; lAnswers={};
  try{
    var res=await fetch(API+'/international-english/listening',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify({level:lState.level})});
    var data=await res.json();
    if(!res.ok||data.error){ throw new Error(data.error||'Failed'); }
    renderListening(data);
    // fetch audio (TTS) — same backend as IELTS
    prepListeningAudio(data);
  }catch(e){ area.innerHTML='<div class="result" style="color:#b00020">Could not generate: '+esc(e.message)+'</div>'; }
  finally{ btn.disabled=false; btn.textContent='Generate Listening'; }
}

function prepListeningAudio(data){
  var statusEl=document.getElementById('l-audio-status');
  fetch(API+'/ielts/tts',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify({script:data.script,speakers:data.speakers})})
  .then(function(r){return r.json();})
  .then(function(result){
    if(result.error||!result.chunks){ if(statusEl) statusEl.textContent='Audio unavailable — read the transcript below.'; showTranscript(data); return; }
    lAudioQueue=result.chunks.map(function(chunk){
      var binary=atob(chunk.audio),bytes=new Uint8Array(binary.length);
      for(var i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes],{type:'audio/mp3'}));
    });
    if(statusEl) statusEl.textContent='Ready — click Play';
    var pb=document.getElementById('l-play-btn'); if(pb) pb.disabled=false;
  }).catch(function(){ if(statusEl) statusEl.textContent='Audio unavailable — read the transcript below.'; showTranscript(data); });
}
function showTranscript(data){
  var box=document.getElementById('l-transcript'); if(!box) return;
  box.style.display='block';
  box.innerHTML='<div style="font-weight:700;margin-bottom:6px;color:var(--navy)">Transcript</div>'+(data.script||[]).map(function(l){return '<div style="font-size:13px;margin:3px 0"><b>'+esc(l.speaker)+':</b> '+esc(l.text)+'</div>';}).join('');
}
function lTogglePlay(){
  if(!lAudioQueue.length) return;
  if(lPlaying){ if(lCurrentAudio) lCurrentAudio.pause(); lPlaying=false; document.getElementById('l-play-btn').textContent='▶ Play'; return; }
  lPlaying=true; document.getElementById('l-play-btn').textContent='⏸ Pause';
  function playNext(){
    if(lAudioIdx>=lAudioQueue.length){ lPlaying=false; lAudioIdx=0; document.getElementById('l-play-btn').textContent='▶ Play again'; document.getElementById('l-audio-status').textContent='Finished'; return; }
    lCurrentAudio=new Audio(lAudioQueue[lAudioIdx]);
    lCurrentAudio.onended=function(){ lAudioIdx++; if(lPlaying) playNext(); };
    lCurrentAudio.onerror=function(){ lAudioIdx++; if(lPlaying) playNext(); };
    document.getElementById('l-audio-status').textContent='Playing… ('+(lAudioIdx+1)+'/'+lAudioQueue.length+')';
    lCurrentAudio.play();
  }
  playNext();
}
function renderListening(data){
  var area=document.getElementById('listening-area');
  var html='<div class="result"><h2>'+esc(data.title||'Listening')+'</h2>';
  html+='<div style="text-align:center;padding:14px;border:.5px solid var(--border);border-radius:8px;margin-bottom:14px">'
      +'<div id="l-audio-status" style="font-size:13px;color:var(--muted);margin-bottom:8px">Preparing audio…</div>'
      +'<button class="btn pri" id="l-play-btn" onclick="lTogglePlay()" disabled>▶ Play</button></div>';
  html+='<div id="l-transcript" style="display:none;background:#f7f8ff;padding:10px;border-radius:6px;margin-bottom:12px"></div>';
  (data.questions||[]).forEach(function(q){
    html+='<div class="qitem"><div class="qt"><span class="qn">'+q.id+'.</span> '+esc(q.question)+'</div>';
    (q.options||[]).forEach(function(o){
      html+='<label style="display:block;font-size:13px;padding:3px 0;cursor:pointer"><input type="radio" name="lq'+q.id+'" value="'+esc(o)+'" onchange="lAnswers['+q.id+']=this.value"> '+esc(o)+'</label>';
    });
    html+='<div class="ans" id="lans-'+q.id+'" style="display:none">✓ '+esc(q.answer)+(q.explanation?' — '+esc(q.explanation):'')+'</div></div>';
  });
  html+='<div class="actions" style="justify-content:flex-start"><button class="btn pri" onclick="lCheck('+JSON.stringify((data.questions||[]).map(function(q){return q.id;})).replace(/"/g,"&quot;")+')">Check Answers</button></div>';
  html+='</div>';
  area.innerHTML=html;
}
function lCheck(ids){
  (ids||[]).forEach(function(id){ var el=document.getElementById('lans-'+id); if(el) el.style.display='block'; });
}

/* ===================== SPEAKING (with REAL transcription) ===================== */
var sState = { level:'B1' };
var sQuestions = [], sRecorder=null, sChunks=[], sRecordingIdx=-1, sTranscripts={};
function pickSLevel(el,v){ sState.level=v; el.parentNode.querySelectorAll('.chip').forEach(function(c){c.classList.remove('on');}); el.classList.add('on'); }

async function genSpeaking(){
  var btn=document.getElementById('sgen-btn'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span>Generating…';
  var area=document.getElementById('speaking-area'); area.innerHTML=''; sTranscripts={};
  try{
    var res=await fetch(API+'/international-english/speaking',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify({level:sState.level})});
    var data=await res.json();
    if(!res.ok||data.error){ throw new Error(data.error||'Failed'); }
    sQuestions=data.questions||[];
    renderSpeaking(data);
  }catch(e){ area.innerHTML='<div class="result" style="color:#b00020">Could not generate: '+esc(e.message)+'</div>'; }
  finally{ btn.disabled=false; btn.textContent='Generate Speaking'; }
}

function renderSpeaking(data){
  var area=document.getElementById('speaking-area');
  var html='<div class="result"><h2>'+esc(data.title||'Speaking')+'</h2>';
  html+='<div class="sub">Click 🎤 to record your spoken answer. Your speech is transcribed automatically. You can also type instead.</div>';
  sQuestions.forEach(function(q,i){
    html+='<div class="qitem"><div class="qt"><span class="qn">'+(i+1)+'.</span> '+esc(q)+'</div>'
       +'<button class="btn sec" id="srec-'+i+'" onclick="sToggleRecord('+i+')" style="margin:6px 0">🎤 Record</button> '
       +'<span id="sstat-'+i+'" style="font-size:12px;color:var(--muted)"></span>'
       +'<textarea id="stext-'+i+'" placeholder="Your answer appears here after recording, or type it…" oninput="sTranscripts['+i+']=this.value" style="width:100%;min-height:60px;margin-top:6px;border:.5px solid var(--border);border-radius:8px;padding:8px;font-family:inherit;font-size:13px"></textarea>'
       +'</div>';
  });
  html+='<div class="actions" style="justify-content:flex-start"><button class="btn pri" id="sgrade-btn" onclick="sGrade()">Get Feedback</button></div>';
  html+='<div id="speaking-result"></div></div>';
  area.innerHTML=html;
}

async function sToggleRecord(i){
  var btn=document.getElementById('srec-'+i), stat=document.getElementById('sstat-'+i);
  // stop if currently recording this one
  if(sRecordingIdx===i && sRecorder && sRecorder.state!=='inactive'){
    sRecorder.stop(); return;
  }
  try{
    var stream=await navigator.mediaDevices.getUserMedia({audio:true});
    sRecorder=new MediaRecorder(stream); sChunks=[]; sRecordingIdx=i;
    sRecorder.ondataavailable=function(e){ if(e.data.size>0) sChunks.push(e.data); };
    sRecorder.onstop=async function(){
      stream.getTracks().forEach(function(t){t.stop();});
      btn.textContent='🎤 Record'; btn.style.color='';
      stat.textContent='Transcribing…';
      var blob=new Blob(sChunks,{type:'audio/webm'});
      // convert blob to base64
      var b64=await blobToBase64(blob);
      try{
        var res=await fetch(API+'/transcribe',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify({audio:b64,mimeType:'audio/webm'})});
        var data=await res.json();
        var ta=document.getElementById('stext-'+i);
        if(data.text){ ta.value=data.text; sTranscripts[i]=data.text; stat.textContent='✓ Transcribed'; ta.style.borderColor='var(--teal)'; }
        else { stat.textContent='Could not hear clearly — please type your answer.'; }
      }catch(err){ stat.textContent='Transcription failed — please type your answer.'; }
    };
    sRecorder.start(); btn.textContent='⏹ Stop'; btn.style.color='#e23'; stat.textContent='Recording… speak now';
  }catch(e){ stat.textContent='Microphone blocked — please type your answer instead.'; }
}

function blobToBase64(blob){
  return new Promise(function(resolve,reject){
    var reader=new FileReader();
    reader.onloadend=function(){ resolve(reader.result.split(',')[1]); };
    reader.onerror=reject;
    reader.readAsDataURL(blob);
  });
}

async function sGrade(){
  var parts=[];
  sQuestions.forEach(function(q,i){ var t=(sTranscripts[i]||(document.getElementById('stext-'+i)?document.getElementById('stext-'+i).value:'')||'').trim(); if(t) parts.push('Q: '+q+'\nA: '+t); });
  var full=parts.join('\n\n');
  if(!full){ alert('Please record or type at least one answer first.'); return; }
  var rbox=document.getElementById('speaking-result'); rbox.innerHTML='<div style="padding:14px;color:var(--muted)"><span class="spinner"></span> Evaluating your speaking…</div>';
  try{
    var res=await fetch(API+'/international-english/speaking/grade',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify({level:sState.level,transcript:full})});
    var r=await res.json();
    if(r.error){ throw new Error(r.error); }
    var html='<div style="border-top:1px solid #eef;margin-top:12px;padding-top:12px">';
    html+='<div style="font-size:22px;font-weight:800;color:var(--teal)">Score: '+esc(r.score)+'/10</div>';
    ['fluency','vocabulary','grammar'].forEach(function(k){ if(r[k]){ html+='<div style="margin-top:8px"><b style="color:var(--navy);text-transform:capitalize">'+k+': '+esc(r[k].score)+'/10</b><div style="font-size:13px;color:#444">'+esc(r[k].feedback)+'</div></div>'; } });
    if(r.overallFeedback) html+='<div style="margin-top:10px;font-size:13px"><b>Overall:</b> '+esc(r.overallFeedback)+'</div>';
    if(r.improvements&&r.improvements.length){ html+='<div style="margin-top:8px;font-size:13px"><b>To improve:</b><ul style="margin-left:18px">'+r.improvements.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></div>'; }
    html+='</div>';
    rbox.innerHTML=html;
  }catch(e){ rbox.innerHTML='<div style="padding:12px;color:#b00020">Grading failed: '+esc(e.message)+'</div>'; }
}
</script>
</body>
</html>
