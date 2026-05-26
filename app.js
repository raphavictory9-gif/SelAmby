// ═══════════════════════════════════
//  DB  (sessionStorage backed)
// ═══════════════════════════════════
const DB = {
  load() {
    try { const r = sessionStorage.getItem('mrDB'); if(r) return JSON.parse(r); } catch(_){}
    return { users:{}, products:[], messages:{} };
  },
  save(db){ try{ sessionStorage.setItem('mrDB', JSON.stringify(db)); }catch(_){} },
  get(){ if(!window._db) window._db = this.load(); return window._db; },
  commit(){ this.save(this.get()); }
};

// ═══════════════════════════════════
//  AUTH
// ═══════════════════════════════════
const Auth = {
  me(){ try{ return sessionStorage.getItem('mrUser')||null; }catch(_){ return null; } },
  signup(name, username, password){
    username = username.trim();
    name = name.trim();
    if(!name||!username||!password) return {ok:false,msg:'All fields required.'};
    if(username.length<3) return {ok:false,msg:'Username must be 3+ characters.'};
    if(password.length<4) return {ok:false,msg:'Password must be 4+ characters.'};
    const db=DB.get();
    if(db.users[username]) return {ok:false,msg:'Username already taken.'};
    db.users[username]={ name, password, joinedAt:Date.now() };
    DB.commit();
    return {ok:true};
  },
  login(username, password){
    username=username.trim();
    const db=DB.get(), u=db.users[username];
    if(!u) return {ok:false,msg:'Account not found.'};
    if(u.password!==password) return {ok:false,msg:'Wrong password.'};
    try{ sessionStorage.setItem('mrUser', username); }catch(_){}
    return {ok:true};
  },
  logout(){
    try{ sessionStorage.removeItem('mrUser'); }catch(_){}
    location.reload();
  }
};

// ═══════════════════════════════════
//  MARKET
// ═══════════════════════════════════
const Market = {
  all(){ return DB.get().products||[]; },
  add({name,description,price,image,seller}){
    const db=DB.get();
    db.products.unshift({id:Date.now(),name:name.trim(),description:description.trim(),
      price:Number(price),image,seller,postedAt:Date.now(),bought:false,buyer:null});
    DB.commit();
  },
  buy(id, buyer){
    const db=DB.get(), p=db.products.find(x=>x.id===id);
    if(!p||p.bought) return false;
    p.bought=true; p.buyer=buyer; DB.commit(); return true;
  },
  del(id, who){
    const db=DB.get(), i=db.products.findIndex(x=>x.id===id&&x.seller===who);
    if(i===-1) return false;
    db.products.splice(i,1); DB.commit(); return true;
  },
  stats(u){
    const all=this.all();
    return {
      total: all.length,
      posted: all.filter(p=>p.seller===u).length,
      sold:   all.filter(p=>p.seller===u&&p.bought).length,
      bought: all.filter(p=>p.buyer===u).length
    };
  }
};

// ═══════════════════════════════════
//  CHAT
// ═══════════════════════════════════
const Chat = {
  key(a,b){ return [a,b].sort().join('::'); },
  getMessages(a,b){
    const db=DB.get();
    return (db.messages[this.key(a,b)])||[];
  },
  send(from, to, text){
    const db=DB.get(), k=this.key(from,to);
    if(!db.messages[k]) db.messages[k]=[];
    db.messages[k].push({from,text:text.trim(),ts:Date.now()});
    DB.commit();
  }
};

// ═══════════════════════════════════
//  HELPERS
// ═══════════════════════════════════
function esc(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function fmt(n){ return '₦'+Number(n).toLocaleString(); }
function timeAgo(ts){
  const s=Math.floor((Date.now()-ts)/1000);
  if(s<60) return 'just now';
  if(s<3600) return Math.floor(s/60)+'m ago';
  if(s<86400) return Math.floor(s/3600)+'h ago';
  return Math.floor(s/86400)+'d ago';
}
function flash(id, msg, type){
  const el=document.getElementById(id);
  el.textContent=msg; el.className='flash '+type;
  setTimeout(()=>el.className='flash',3000);
}

// ═══════════════════════════════════
//  AUTH UI
// ═══════════════════════════════════
function switchAuthTab(tab){
  document.querySelectorAll('.auth-tab').forEach((t,i)=>{
    t.classList.toggle('active',(tab==='login'&&i===0)||(tab==='signup'&&i===1));
  });
  document.getElementById('loginPanel').classList.toggle('active',tab==='login');
  document.getElementById('signupPanel').classList.toggle('active',tab==='signup');
}

function doLogin(){
  const u=document.getElementById('loginUser').value;
  const p=document.getElementById('loginPass').value;
  const r=Auth.login(u,p);
  if(r.ok){ flash('loginMsg','Welcome back! Loading...','ok'); setTimeout(bootApp,600); }
  else flash('loginMsg',r.msg,'err');
}

function  doSignup(){
  const n=document.getElementById('signupName').value;
  const u=document.getElementById('signupUser').value;
  const p=document.getElementById('signupPass').value;
  const r=Auth.signup(n,u,p);
  if(r.ok){ Auth.login(u,p); flash('signupMsg','Account created! Taking you in...','ok'); setTimeout(bootApp,600); }
  else flash('signupMsg',r.msg,'err');
}

document.addEventListener('keydown',e=>{
  if(e.key!=='Enter') return;
  const loginActive=document.getElementById('loginPanel').classList.contains('active');
  if(loginActive) doLogin(); else doSignup();
});

// ═══════════════════════════════════
//  APP BOOT
// ═══════════════════════════════════
function bootApp(){
  const ME = Auth.me();
  if(!ME){ document.getElementById('authScreen').style.display='flex'; return; }

  // Hide auth, show app
  document.getElementById('authScreen').style.display='none';
  document.getElementById('appNav').style.display='flex';
  document.getElementById('appScreens').style.display='block';
  document.getElementById('appTabs').style.display='flex';

  const db=DB.get();
  const myName = db.users[ME]?.name || ME;
  const initials = myName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

  document.getElementById('navAvatar').textContent=initials;
  document.getElementById('greetName').textContent=myName.split(' ')[0];

  refreshHome();
  populateChatUsers();
}

function doLogout(){ Auth.logout(); }

// ═══════════════════════════════════
//  SCREEN NAVIGATION
// ═══════════════════════════════════
function showScreen(name, btn){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));     
  document.getElementById(name+'Screen').classList.add('active');
  btn.classList.add('active');
  if(name==='home') refreshHome();
  if(name==='you') refreshYou();
  if(name==='explore') populateChatUsers();
}

// ═══════════════════════════════════
//  HOME
// ═══════════════════════════════════
let homeFilter='all';
function setHomeFilter(f,btn){
  homeFilter=f;
  document.querySelectorAll('.ff-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderFeed();
}

function refreshHome(){
  const ME=Auth.me();
  const s=Market.stats(ME);
  document.getElementById('hsTotal').textContent=s.total;
  document.getElementById('hsSold').textContent=s.sold;
  document.getElementById('hsBought').textContent=s.bought;
  renderFeed();
}

function renderFeed(){
  const ME=Auth.me();
  const feed=document.getElementById('homeFeed');
  feed.innerHTML='';                                      
  let list=Market.all();
  if(homeFilter==='available') list=list.filter(p=>!p.bought);
  if(homeFilter==='mine') list=list.filter(p=>p.seller===ME);

  if(list.length===0){
    feed.innerHTML=`<div class="empty-feed"><h3>Nothing here yet</h3><p>Post something in Explore!</p></div>`;
    return;
  }

  list.forEach(p=>{
    const isMine=p.seller===ME;
    const card=document.createElement('div');
    card.className='post-card';
    card.innerHTML=`
      <img src="${esc(p.image)}" alt="${esc(p.name)}">
      <div class="post-body">
        <div class="post-top">
          <div class="post-name">${esc(p.name)}</div>
          <div class="post-price">${fmt(p.price)}</div>
        </div>
        <div class="post-desc">${esc(p.description)}</div>
        <div class="post-meta">
          <div class="post-seller">By <strong>${esc(p.seller)}</strong> · ${timeAgo(p.postedAt)}</div>
          ${p.bought?`<span class="sold-tag">Sold</span>`:''}
        </div>
        <div class="post-actions">
          ${!p.bought&&!isMine?`<button class="btn-buy" onclick="doBuy(${p.id})">Buy Now</button>`:''}
          ${!isMine?`<button class="btn-chat" onclick="openChat('${esc(p.seller)}')">Chat</button>`:''}
          ${isMine&&!p.bought?`<button class="btn-del" onclick="doDel(${p.id})">Delete</button>`:''}
        </div>
      < /div>`;
    feed.appendChild(card);
  });
}

function doBuy(id){
  const ME=Auth.me();                                                                                           
  const p=Market.all().find(x=>x.id===id);
  if(!p) return;
  if(!confirm(`Buy "${p.name}" for ${fmt(p.price)}?`)) return;
  Market.buy(id,ME);
  refreshHome();
}

function doDel(id){
  if(!confirm('Delete this product?')) return;
  Market.del(id,Auth.me());
  refreshHome();
}

// ═══════════════════════════════════
//  EXPLORE — POST GOODS
// ═══════════════════════════════════
let expTab='post';
function setExpTab(tab, btn){
  expTab=tab;
  document.querySelectorAll('.exp-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('expPost').style.display=tab==='post'?'block':'none';
  document.getElementById('expChat').style.display=tab==='chat'?'block':'none';
  if(tab==='chat') populateChatUsers();
}

function previewImg(input){
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{ const img=document.getElementById('imgPreview'); img.src=e.target.result; img.style.display='block'; };
  reader.readAsDataURL(file);
}

function explorePost(){
  const ME=Auth.me();
  const name=document.getElementById('eName').value.trim();
  const desc=document.getElementById('eDesc').value.trim();
  const price=document.getElementById('ePrice').value.trim();
  const file=document.getElementById('fileInput').files[0];

  if(!name) return flash('exploreMsg','Enter a product name.','err');
  if(!desc) return flash('exploreMsg','Add a description.','err');
  if(!price||Number(price)<0) return flash('exploreMsg','Enter a valid price.','err');
  if(!file) return flash('exploreMsg','Choose an image.','err');

  const reader=new FileReader();
  reader.onload=function(){
    Market.add({name,description:desc,price,image:reader.result,seller:ME});
    flash('exploreMsg','Product posted! 🎉','ok');
    document.getElementById('eName').value='';
    document.getElementById('eDesc').value='';
    document.getElementById('ePrice').value='';
    document.getElementById('fileInput').value='';
    document.getElementById('imgPreview').style.display='none';
    refreshHome();
  };
  reader.readAsDataURL(file);
}                      

// ═══════════════════════════════════
//  EXPLORE — CHAT
// ═══════════════════════════════════
let chatPollInterval=null;

function populateChatUsers(){
  const ME=Auth.me();
  const db=DB.get();
  const sel=document.getElementById('chatUserSelect');
  const prev=sel.value;
  sel.innerHTML='<option value="">— Select a user —</option>';
  Object.keys(db.users).forEach(u=>{
    if(u===ME) return;
    const opt=document.createElement('option');
    opt.value=u; opt.textContent=db.users[u].name||u;
    sel.appendChild(opt);
  });
  if(prev) sel.value=prev;
}

function openChat(username){
  // Switch to explore > chat tab
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('exploreScreen').classList.add('active');
  document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
  setExpTab('chat', document.querySelector('.exp-tab:nth-child(2)'));
  populateChatUsers();
  document.getElementById('chatUserSelect').value=username;
  loadChat();
}

function loadChat(){
  const ME=Auth.me();
  const other=document.getElementById('chatUserSelect').value;
  clearInterval(chatPollInterval);

  if(!other){
    document.getElementById('chatArea').innerHTML='<div class="no-chat">Select a user above to start chatting</div>';
    return;
  }

  renderChat(ME,other);
  chatPollInterval=setInterval(()=>renderChat(ME,other),1500);
}

function renderChat(ME,other){
  const msgs=Chat.getMessages(ME,other);
  const db=DB.get();
  const otherName=db.users[other]?.name||other;

  document.getElementById('chatArea').innerHTML=`
    <div class="chat-messages" id="chatMessages">
      ${msgs.length===0
        ? `<div style="text-align:center;color:var(--muted);padding:30px;font-size:0.85rem">Start the conversation with ${esc(otherName)}</div>`
        : msgs.map(m=>`
          <div style="display:flex;flex-direction:column;align-items:${m.from===ME?'flex-end':'flex-start'}">
            <div class="msg-bubble ${m.from===ME?'mine':'theirs'}">${esc(m.text)}</div>
            <div class="msg-meta" style="text-align:${m.from===ME?'right':'left'}">${timeAgo(m.ts)}</div>
          </div>`).join('')}
    </div>
    <div class="chat-input-row">
      <input type="text" id="chatInput" placeholder="Message ${esc(otherName)}..." onkeydown="if(event.key==='Enter')sendMsg('${esc(ME)}','${esc(other)}')">
      <button class="btn-send" onclick="sendMsg('${esc(ME)}','${esc(other)}')">Send</button>
    </div>`;

  // Scroll to bottom
  const cm=document.getElementById('chatMessages');
  if(cm) cm.scrollTop=cm.scrollHeight;
}

function sendMsg(from, to){
  const input=document.getElementById('chatInput');
  const text=input.value.trim();
  if(!text) return;
  Chat.send(from,to,text);
  input.value='';
  renderChat(from,to);
}

// ═══════════════════════════════════
//  YOU
// ═══════════════════════════════════
function refreshYou(){
  const ME=Auth.me();
  const db=DB.get();
  const user=db.users[ME]||{};
  const myName=user.name||ME;
  const initials=myName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const s=Market.stats(ME);

  document.getElementById('profileAvatar').textContent=initials;
  document.getElementById('profileName').textContent=myName;
  document.getElementById('profileUsername').textContent='@'+ME;
  document.getElementById('profileJoined').textContent=
    user.joinedAt?'Joined '+new Date(user.joinedAt).toLocaleDateString('en-GB',{month:'long',year:'numeric'}):'';

  document.getElementById('psPosted').textContent=s.posted;
  document.getElementById('psSold').textContent=s.sold;
  document.getElementById('psBought').textContent=s.bought;

  // Activity feed
  const all=Market.all();
  const myActivity=[];

  all.filter(p=>p.seller===ME).forEach(p=>{
    myActivity.push({type:p.bought?'sold':'posted',name:p.name,price:p.price,ts:p.bought?p.postedAt:p.postedAt});
  });
  all.filter(p=>p.buyer===ME).forEach(p=>{
    myActivity.push({type:'bought',name:p.name,price:p.price,ts:p.postedAt});
  });
  myActivity.sort((a,b)=>b.ts-a.ts);

  const list=document.getElementById('activityList');
  if(myActivity.length===0){
    list.innerHTML='<div style="color:var(--muted);font-size:0.85rem;padding:10px 0">No activity yet. Post or buy something!</div>';
    return;
  }

  list.innerHTML=myActivity.slice(0,10).map(a=>{
    const icons={sold:'✅',bought:'🛍️',posted:'📦'};
    const labels={sold:'Sold',bought:'Bought',posted:'Posted'};
    return `
      <div class="activity-item">
        <div class="activity-icon ${a.type}">${icons[a.type]}</div>
        <div class="activity-info">
          <strong>${esc(a.name)}</strong>
          <span>${labels[a.type]} · ${timeAgo(a.ts)}</span>
        </div>
        <div class="activity-price">${fmt(a.price)}</div>
      </div>`;
  }).join('');
}
if(Auth.me()) bootApp();
else document.getElementById('authScreen').style.display='flex';