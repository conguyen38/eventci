/* ============================================================
   CONFIG - thay đổi mật khẩu tại đây
   ============================================================ */
const ADMIN_PW = "OH2026";
const SK = "oh_ci_v5";

/* ============================================================
   SUPABASE CONFIG — điền thông tin của bạn vào đây
   ============================================================ */
const SB_URL = "https://kpzwmancieemefcvgtkm.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwendtYW5jaWVlbWVmY3ZndGttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzODQyMTksImV4cCI6MjA5NTk2MDIxOX0.WviBlyBg9Ji9kARXUyP_87muq8oGLVX6_0T0FNtKqTI";
const SB_HDR = {
  "Content-Type": "application/json",
  "apikey": SB_KEY,
  "Authorization": `Bearer ${SB_KEY}`,
  "Prefer": "return=minimal"
};
const SB_ON = true;

/* ============================================================
   BASE URL — URL GitHub Pages sau khi deploy
   ============================================================ */
const BASE_URL = "https://lemaitranmedia.github.io/eventoh-checkin";

/* ============================================================
   DATA LAYER
   ============================================================ */
function dbToEv(r){return{id:r.id,name:r.name,date:r.date_str,team:r.team,venue:r.venue,eventPw:r.event_pw,btcMembers:r.btc_members||[],createdAt:r.created_at}}
function dbToG(r){return{id:r.id,eventId:r.event_id,guestCode:r.guest_code,name:r.name,phone:r.phone,prmName:r.prm_name,tcbRegion:r.tcb_region,unit:r.unit,sihName:r.sih_name,note:r.note,companions:r.companions||[],checkedIn:!!r.checked_in,checkinTime:r.checkin_time,checkinBy:r.checkin_by,cancelled:!!r.cancelled,cancelNote:r.cancel_note,createdAt:r.created_at}}
function evToDb(e){return{id:e.id,name:e.name,date_str:e.date||null,team:e.team||null,venue:e.venue||null,event_pw:e.eventPw||null,btc_members:e.btcMembers||[],created_at:e.createdAt||Date.now()}}
function gToDb(g){return{id:g.id,event_id:g.eventId,guest_code:g.guestCode,name:g.name,phone:g.phone||null,prm_name:g.prmName||null,tcb_region:g.tcbRegion||null,unit:g.unit||null,sih_name:g.sihName||null,note:g.note||null,companions:g.companions||[],checked_in:!!g.checkedIn,checkin_time:g.checkinTime||null,checkin_by:g.checkinBy||null,cancelled:!!g.cancelled,cancel_note:g.cancelNote||null,created_at:g.createdAt||Date.now()}}

function loadLocal(){try{const r=localStorage.getItem(SK);return r?JSON.parse(r):{events:[],guests:[]}}catch(e){return{events:[],guests:[]}}}

async function sbLoad(){
  try{
    const[er,gr]=await Promise.all([
      fetch(`${SB_URL}/rest/v1/oh_events?select=*&order=created_at.desc`,{headers:SB_HDR}),
      fetch(`${SB_URL}/rest/v1/oh_guests?select=*`,{headers:SB_HDR})
    ]);
    const evs=await er.json();const gs=await gr.json();
    if(Array.isArray(evs)&&Array.isArray(gs)){
      db.events=evs.map(dbToEv);db.guests=gs.map(dbToG);
      localStorage.setItem(SK,JSON.stringify(db));
      return true;
    }
  }catch(e){console.warn('Supabase load lỗi, dùng localStorage:',e)}
  return false;
}

let _syncT=null;
function save(){
  try{localStorage.setItem(SK,JSON.stringify(db))}catch(e){}
  if(!SB_ON)return;
  if(_syncT)clearTimeout(_syncT);
  _syncT=setTimeout(sbSync,600);
}

async function sbSync(){
  _syncT=null;
  try{
    if(db.events.length){
      await fetch(`${SB_URL}/rest/v1/oh_events`,{
        method:'POST',
        headers:{...SB_HDR,'Prefer':'resolution=merge-duplicates'},
        body:JSON.stringify(db.events.map(evToDb))
      });
    }
    if(db.guests.length){
      await fetch(`${SB_URL}/rest/v1/oh_guests`,{
        method:'POST',
        headers:{...SB_HDR,'Prefer':'resolution=merge-duplicates'},
        body:JSON.stringify(db.guests.map(gToDb))
      });
    }
  }catch(e){console.warn('Supabase sync lỗi:',e)}
}

async function sbDel(table,id){
  if(!SB_ON)return;
  try{await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`,{method:'DELETE',headers:SB_HDR})}
  catch(e){console.warn('Supabase delete lỗi:',e)}
}

let db={events:[],guests:[]};

function qrUrl(code){return BASE_URL+'/?code='+encodeURIComponent(code)}

async function loadData(){
  if(SB_ON){const ok=await sbLoad();if(!ok){const loc=loadLocal();db.events=loc.events;db.guests=loc.guests;}}
  else{const loc=loadLocal();db.events=loc.events;db.guests=loc.guests;}
}

function isEvLocked(ev){
  if(!ev?.date)return false;
  const today=new Date().toISOString().slice(0,10);
  return today>ev.date;
}
function getEvById(id){return db.events.find(e=>e.id===id)}

let _autoRefresh=null;
function startAutoRefresh(){
  if(_autoRefresh)clearInterval(_autoRefresh);
  _autoRefresh=setInterval(async()=>{
    await loadData();R();
  },15000);
}
async function doRefresh(){
  const btn=document.getElementById('refresh_btn');
  if(btn){btn.textContent='⏳ Đang làm mới...';btn.disabled=true;}
  await loadData();R();
}

async function init(){
  const urlCode=new URLSearchParams(window.location.search).get('code');
  const root=document.getElementById('root');
  root.innerHTML=`<div style="max-width:360px;margin:80px auto;text-align:center;font-family:'Be Vietnam Pro',sans-serif"><div style="font-size:40px;margin-bottom:12px">⏳</div><div style="font-size:14px;color:#aaa;margin-top:8px">Đang tải...</div></div>`;
  await loadData();
  if(urlCode){S.urlCode=decodeURIComponent(urlCode);S.view='url_ci';R();return;}
  R();
  if(!urlCode)startAutoRefresh();
}

init();

/* ============================================================
   STATE
   ============================================================ */
let S={
  adminOk:false,
  view:'admin', 
  urlCode:null,     
  urlCIStep:null,   
  tab:'events', 
  selEv:null,
  modal:null,   // add_ev | add_g | edit_g | del_g | tickets | btc_members | import_preview
  editGid:null,
  delGid:null,
  ticketGid:null,
  editEvId:null,   
  cpTicket:null,  
  cpEdit:null,    
  cpDel:null,     
  cpAdd:null,     
  adminCI:null,   
  cancelTarget:null, 
  unlockedEvs:{},    
  evUnlockTarget:null, 
  rptEv:null,          
  rptExp:{},           
  search:'',
  filter:'all',
  ciOk:false,
  ciEv:null,
  ciOp:null,   
  ciState:null,
  pwVal:'',
  pwErr:'',
  newEvBtcRows:1,
  newGCompRows:1,
  importData:null // Lưu danh sách khách tạm thời khi đọc file Excel trước khi lưu
};

/* ============================================================
   UTILS
   ============================================================ */
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function fmtD(d){return d?new Date(d).toLocaleDateString('vi-VN'):'—'}
function fmtDT(d){return d?new Date(d).toLocaleString('vi-VN'):'—'}
function fmtTm(d){return d?new Date(d).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}):''}
function egs(eid){return db.guests.filter(g=>g.eventId===eid)}
function allPeople(eid){
  let t=0,c=0,x=0;
  egs(eid).forEach(g=>{
    t++;if(g.checkedIn)c++;if(g.cancelled)x++;
    (g.companions||[]).forEach(p=>{t++;if(p.checkedIn)c++;if(p.cancelled)x++;});
  });
  return{t,c,x,p:t-c-x};
}
function genCode(eid){
  const ev=db.events.find(e=>e.id===eid);
  const pfx=ev?ev.name.replace(/[^A-Z0-9]/gi,'').toUpperCase().slice(0,3):'OH';
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const used=new Set();
  db.guests.forEach(g=>{used.add(g.guestCode);(g.companions||[]).forEach(c=>used.add(c.code))});
  let code,t=0;
  do{code=pfx+'-';for(let i=0;i<4;i++)code+=chars[Math.floor(Math.random()*chars.length)];t++}
  while(used.has(code)&&t<200);
  return code;
}
function findCode(eid,code){
  for(const g of db.guests.filter(x=>x.eventId===eid)){
    if(g.guestCode===code)return{type:'guest',guest:g,person:g};
    for(const c of(g.companions||[])){
      if(c.code===code)return{type:'comp',guest:g,person:c};
    }
  }
  return null;
}

/* ============================================================
   RENDER ENTRY
   ============================================================ */
function R(){
  const root=document.getElementById('root');
  if(S.view==='url_ci'){root.innerHTML=rUrlCI();postUrlCI();return} 
  if(!S.adminOk){root.innerHTML=rLogin();return}
  if(S.view==='checkin'){root.innerHTML=rCIView();postCI();return}
  root.innerHTML=rAdmin();
  postAdmin();
}

/* ============================================================
   ADMIN LOGIN
   ============================================================ */
function rLogin(){
  return`<div class="login-box">
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:36px;margin-bottom:10px">🏢</div>
      <div style="font-size:20px;font-weight:800">Hệ thống Check-in Sự kiện</div>
      <div style="font-size:13px;color:#999;margin-top:4px">OneHousing — Nhập mật khẩu để tiếp tục</div>
    </div>
    <div class="fg"><label>Mật khẩu Admin</label>
      <input type="password" id="login_pw" placeholder="Nhập mật khẩu..." autofocus
        onkeydown="if(event.key==='Enter')doLogin()" style="font-size:16px;padding:12px 14px"/></div>
    <div id="login_err" style="color:#a32d2d;font-size:12px;margin-bottom:8px"></div>
    <button class="btn blue full" onclick="doLogin()">Đăng nhập →</button>
  </div>`;
}
function doLogin(){
  const pw=document.getElementById('login_pw')?.value||'';
  if(pw===ADMIN_PW){S.adminOk=true;R()}
  else{document.getElementById('login_err').textContent='⚠️ Mật khẩu không đúng.'}
}

/* ============================================================
   ADMIN SHELL
   ============================================================ */
function rAdmin(){
  return`
    <div class="topbar no-print" style="margin-bottom:16px">
      <div>
        <div style="font-size:17px;font-weight:800">🎪 Hệ thống Check-in Sự kiện</div>
        <div style="font-size:12px;color:#aaa">OneHousing · ${db.events.length} sự kiện · ${db.guests.length} nhóm khách</div>
      </div>
      <button class="btn" onclick="goCI()">📷 Màn hình Check-in BTC</button>
    </div>
    <div class="tabs no-print">
      <button class="tab ${S.tab==='events'?'on':''}" onclick="setTab('events')">📅 Sự kiện</button>
      <button class="tab ${S.tab==='guests'?'on':''}" onclick="setTab('guests')">👥 Khách mời</button>
      <button class="tab ${S.tab==='report'?'on':''}" onclick="setTab('report')">📊 Báo cáo</button>
    </div>
    ${S.tab==='events'?rEvTab():''}
    ${S.tab==='guests'?rGTab():''}
    ${S.tab==='report'?rRTab():''}
    ${S.modal?rModal():''}`;
}

function postAdmin(){
  if(S.modal==='tickets'&&S.ticketGid){
    setTimeout(mkQRs,120);
    setTimeout(mkQRs,400);
  }
  if(S.modal==='cp_ticket'&&S.cpTicket){
    setTimeout(mkCpQR,120);
    setTimeout(mkCpQR,400);
  }
}

/* ============================================================
   EVENTS TAB
   ============================================================ */
function rEvTab(){
  const sorted=[...db.events].sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  return`<div class="topbar"><div style="font-weight:700">Danh sách sự kiện</div>
    <button class="btn blue sm" onclick="openM('add_ev')">+ Tạo sự kiện</button></div>
    ${sorted.length===0?`<div class="empty">📭 Chưa có sự kiện nào.<br>Nhấn "Tạo sự kiện" để bắt đầu.</div>`:''}
    ${sorted.map(ev=>{const p=allPeople(ev.id);const btcN=(ev.btcMembers||[]).length;const locked=isEvLocked(ev);
      return`<div class="ev-item" onclick="openGM('${ev.id}')">
        <div style="font-size:28px;flex-shrink:0">${locked?'🔐':'📌'}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:15px">${ev.name} ${ev.eventPw?(S.unlockedEvs[ev.id]?'🔓':'🔒'):''} ${locked?'<span style="font-size:10px;font-weight:600;background:#FEF2F2;color:#B91C1C;padding:2px 7px;border-radius:10px;vertical-align:middle">Đã kết thúc</span>':''}</div>
          <div class="ev-meta">
            <span>📅 ${fmtD(ev.date)}</span>
            <span>🏢 ${ev.team||'—'}</span>
            ${ev.venue?`<span>📍 ${ev.venue}</span>`:''}
            <span>👥 ${p.t} người</span>
            <span>✅ ${p.c}/${p.t}</span>
            <span>🔑 ${btcN} BTC</span>
          </div>
          <div class="pb"><div class="pb-fill" style="width:${p.t>0?Math.round(p.c/p.t*100):0}%;background:${locked?'#aaa':'#3B6D11'}"></div></div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap" onclick="event.stopPropagation()">
          <span class="badge ${locked?'b-gray':p.c===p.t&&p.t>0?'b-green':p.c>0?'b-blue':'b-gray'}">${locked?'Đã đóng':p.c===p.t&&p.t>0?'Hoàn tất':p.c>0?p.c+' đã vào':'Chờ'}</span>
          ${ev.eventPw&&S.unlockedEvs[ev.id]?`<button class="btn sm" onclick="alert('Mật khẩu: '+db.events.find(e=>e.id==='${ev.id}')?.eventPw)" title="Xem mật khẩu" style="font-size:11px">🔓 MK</button>`:''}
          <button class="btn sm" onclick="openGM('${ev.id}')">📋 Khách</button>
          ${locked?'<span class="btn sm" style="opacity:.35;cursor:not-allowed">✏️ Sửa</span>':`<button class="btn sm" onclick="openEditEv('${ev.id}')">✏️ Sửa</button>`}
          <button class="btn sm red" onclick="delEv('${ev.id}')">🗑️</button>
        </div>
      </div>`;}).join('')}`;
}

/* ============================================================
   GUESTS TAB
   ============================================================ */
function rGTab(){
  const evSel=`<select class="selx" onchange="pickEv(this.value)">
    <option value="">-- Chọn sự kiện --</option>
    ${db.events.map(e=>`<option value="${e.id}" ${S.selEv===e.id?'selected':''}>${e.name}</option>`).join('')}
  </select>`;
  if(!S.selEv)return`<div class="topbar">${evSel}</div><div class="empty">👆 Chọn sự kiện để quản lý khách mời</div>`;

  const ev = db.events.find(e=>e.id===S.selEv);
  let gs = egs(S.selEv);
  const p = allPeople(S.selEv);

  if(S.search){const q=S.search.toLowerCase();gs=gs.filter(g=>g.name?.toLowerCase().includes(q)||g.phone?.includes(q)||g.prmName?.toLowerCase().includes(q)||g.sihName?.toLowerCase().includes(q)||g.unit?.toLowerCase().includes(q)||g.guestCode?.toLowerCase().includes(q)||(g.companions||[]).some(x=>x.name?.toLowerCase().includes(q)||x.code?.toLowerCase().includes(q)))}
  if(S.filter==='checked')gs=gs.filter(g=>g.checkedIn);
  if(S.filter==='pending')gs=gs.filter(g=>!g.checkedIn&&!g.cancelled);
  if(S.filter==='cancelled')gs=gs.filter(g=>g.cancelled);

  const btcTags=(ev.btcMembers||[]).map(m=>`<span class="badge b-purple" style="margin:2px">🔑 ${m.name} (${m.code})</span>`).join('');
  const evLocked = isEvLocked(ev);

  return`
    <div class="topbar">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${evSel}${btcTags?`<div style="display:flex;flex-wrap:wrap;gap:2px">${btcTags}</div>`:''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button id="refresh_btn" class="btn sm" onclick="doRefresh()" title="Làm mới dữ liệu">🔄 Làm mới</button>
        <input class="sinput" placeholder="🔍 Tìm tên, mã, SĐT..." oninput="setSrch(this.value)" value="${S.search}">
        <select class="selx" onchange="setFil(this.value)">
          <option value="all" ${S.filter==='all'?'selected':''}>Tất cả (${p.t})</option>
          <option value="checked" ${S.filter==='checked'?'selected':''}>✅ Đã vào (${p.c})</option>
          <option value="pending" ${S.filter==='pending'?'selected':''}>⏳ Chưa xác nhận (${p.p})</option>
          <option value="cancelled" ${S.filter==='cancelled'?'selected':''}>🚫 Cancel (${p.x})</option>
        </select>
        
        ${evLocked?'':`
          <button class="btn green sm" onclick="triggerExcelImport()">📥 Import Excel</button>
          <button class="btn sm" onclick="downloadExcelTemplate()">📄 Mẫu Excel</button>
        `}
        ${p.t > 0 ? `<button class="btn blue sm" onclick="downloadAllQRsZip()" id="zip_btn">🗂️ Tải QR hàng loạt (.ZIP)</button>` : ''}
        ${evLocked?'':`<button class="btn blue sm" onclick="openM('add_g')">+ Thêm khách</button>`}
      </div>
    </div>
    
    ${evLocked?`<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">🔐</span>
      <div><div style="font-weight:600;font-size:13px;color:#B91C1C">Sự kiện đã kết thúc — Chỉ xem, không thể thao tác</div>
        <div style="font-size:11px;color:#aaa">Tất cả chức năng check-in, thêm/sửa/xoá khách đã bị khoá kể từ ngày ${fmtD(ev.date)}</div>
      </div>
    </div>`:''}
    <div class="stats" style="grid-template-columns:repeat(5,1fr)">
      <div class="stat"><div class="n">${p.t}</div><div class="l">Tổng</div></div>
      <div class="stat"><div class="n" style="color:#3B6D11">${p.c}</div><div class="l">✅ Đã vào</div></div>
      <div class="stat"><div class="n" style="color:#aaa">${p.p}</div><div class="l">⏳ Chưa</div></div>
      <div class="stat"><div class="n" style="color:#B91C1C">${p.x}</div><div class="l">🚫 Cancel</div></div>
      <div class="stat"><div class="n">${p.t>0?Math.round(p.c/p.t*100):0}%</div><div class="l">Tỷ lệ vào</div></div>
    </div>
    <div class="card-tight">
      <div style="overflow-x:auto">
        <table class="tbl">
          <thead><tr>
            <th style="width:26px">#</th><th>Khách / Đi kèm</th><th style="width:76px">Mã</th>
            <th style="width:95px">SĐT</th><th style="width:120px">PRM / Vùng</th>
            <th style="width:95px">Đơn vị</th><th style="width:85px">SIH</th>
            <th style="width:72px">Check-in</th><th style="width:90px">TT</th>
          </tr></thead>
          <tbody>
          ${gs.length===0?`<tr><td colspan="9" style="text-align:center;padding:24px;color:#bbb">Không có dữ liệu</td></tr>`:''}
          ${gs.map((g,i)=>{
            const comps=g.companions||[];
            const isCancelled=!!g.cancelled;
            let rows=`<tr ${isCancelled?'class="cancelled"':''} style="${isCancelled?'background:#FFF8F8':''}">
              <td style="color:#ccc">${i+1}</td>
              <td>
                <div style="font-weight:600${isCancelled?';text-decoration:line-through;color:#bbb':''}">${g.name}</div>
                ${isCancelled?`<span class="cancelled-badge">🚫 Cancel</span>${g.cancelNote?`<div class="cancel-note">${g.cancelNote}</div>`:''}`:
                  `${comps.length?`<div class="sub">+${comps.length} đi kèm</div>`:''}
                   ${g.note?`<div class="sub" style="font-style:italic">${g.note}</div>`:''}
                   ${evLocked?'':`<button class="btn xs" onclick="openAddComp('${g.id}')" style="margin-top:5px;font-size:10px;color:#185FA5;border-color:#b3d4f5">+ thêm đi kèm</button>`}`}
              </td>
              <td><span class="mono">${g.guestCode}</span></td>
              <td style="color:#888;font-size:12px">${g.phone||'—'}</td>
              <td><div style="font-size:12px">${g.prmName||'—'}</div><div class="sub">${g.tcbRegion||''}</div></td>
              <td style="font-size:12px;color:#888">${g.unit||'—'}</td>
              <td style="font-size:12px;color:#888">${g.sihName||'—'}</td>
              <td>${isCancelled||evLocked?'<span style="font-size:11px;color:#ccc">—</span>':
                `<button class="ci ${g.checkedIn?'on':'off'}" onclick="togCI('${g.id}','g')">${g.checkedIn?'✅ Vào':'⏳'}</button>
                 ${g.checkedIn?`<div style="font-size:10px;color:#bbb;margin-top:2px">${fmtTm(g.checkinTime)}</div>`:''}`}
              </td>
              <td>
                <div style="display:flex;gap:2px;flex-wrap:wrap">
                  ${evLocked?`<button class="btn xs" onclick="openTickets('${g.id}')" title="Vé">🎫</button>`
                  :isCancelled?
                    `<button class="btn xs" onclick="undoCancel('${g.id}','g')" style="color:#185FA5;border-color:#185FA5" title="Recall — KH quay lại tham dự">↩</button>`
                    :`<button class="btn xs" onclick="openTickets('${g.id}')" title="Vé">🎫</button>
                     <button class="btn xs" onclick="openCancel('${g.id}','g')" title="Cancel KH" style="color:#B91C1C;border-color:#FECACA">🚫</button>`}
                  ${evLocked?'':`<button class="btn xs" onclick="openEdit('${g.id}')" title="Sửa">✏️</button>
                  <button class="btn xs red" onclick="openDel('${g.id}')" title="Xoá">🗑️</button>`}
                </div>
              </td>
            </tr>`;
            comps.forEach(cp=>{
              const cpCancelled=!!cp.cancelled;
              rows+=`<tr ${cpCancelled?'class="cancelled"':''} style="background:${cpCancelled?'#FFF8F8':'#fafbfc'}">
                <td></td>
                <td style="padding-left:22px">
                  <span style="font-size:12px;color:${cpCancelled?'#ccc':'#555'};font-weight:500${cpCancelled?';text-decoration:line-through':''}">↳ ${cp.name}</span>
                  ${cpCancelled?`<span class="cancelled-badge" style="margin-left:4px">🚫</span>${cp.cancelNote?`<div class="cancel-note" style="padding-left:14px">${cp.cancelNote}</div>`:''}`
                    :`<span class="badge b-purple" style="font-size:9px;margin-left:4px">đi kèm</span>`}
                </td>
                <td><span class="mono">${cp.code}</span></td>
                <td style="font-size:12px;color:#aaa">${cp.phone||'—'}</td>
                <td colspan="2"></td><td></td>
                <td>${cpCancelled||evLocked?'<span style="font-size:11px;color:#ccc">—</span>':
                  `<button class="ci ${cp.checkedIn?'on':'off'}" onclick="togCI('${g.id}','c','${cp.id}')">${cp.checkedIn?'✅ Vào':'⏳'}</button>
                   ${cp.checkedIn?`<div style="font-size:10px;color:#bbb;margin-top:2px">${fmtTm(cp.checkinTime)}</div>`:''}`}
                </td>
                <td>
                  <div style="display:flex;gap:2px;flex-wrap:wrap">
                    ${evLocked?`<button class="btn xs" onclick="openCpTicket('${g.id}','${cp.id}')" title="Vé">🎫</button>`
                    :cpCancelled?
                      `<button class="btn xs" onclick="undoCancel('${g.id}','c','${cp.id}')" style="color:#185FA5;border-color:#185FA5" title="Recall — người đi kèm quay lại">↩</button>`
                      :`<button class="btn xs" onclick="openCpTicket('${g.id}','${cp.id}')" title="Vé">🎫</button>
                       <button class="btn xs" onclick="openCancel('${g.id}','c','${cp.id}')" style="color:#B91C1C;border-color:#FECACA" title="Cancel">🚫</button>`}
                    ${evLocked?'':`<button class="btn xs" onclick="openCpEdit('${g.id}','${cp.id}')" title="Sửa">✏️</button>
                    <button class="btn xs red" onclick="openCpDel('${g.id}','${cp.id}')" title="Xoá">🗑️</button>`}
                  </div>
                </td>
              </tr>`;
            });
            return rows;
          }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ${p.t>0?`<div style="text-align:right;margin-top:6px"><button class="btn sm" onclick="expCSV()">⬇️ Xuất CSV</button></div>`:''}`;
}

/* ============================================================
   REPORT TAB
   ============================================================ */
function rRTab(){
  if(!db.events.length)return'<div class="empty">Chưa có dữ liệu.</div>';
  const evSel=`<select class="selx" style="min-width:220px" onchange="setRptEv(this.value)">
    <option value="">-- Tất cả sự kiện --</option>
    ${db.events.map(e=>`<option value="${e.id}" ${S.rptEv===e.id?'selected':''}>${e.name}${e.eventPw&&!S.unlockedEvs[e.id]?' 🔒':''}${isEvLocked(e)?' 🔐':''}</option>`).join('')}
  </select>`;
  const refreshBtn=`<button id="refresh_btn" class="btn sm" onclick="doRefresh()">🔄 Làm mới</button>`;

  const overviewHtml=`
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div style="font-weight:700">📊 Tổng quan sự kiện</div>${refreshBtn}</div>${evSel}
      </div>
      ${db.events.map(ev=>{const p=allPeople(ev.id);const r=p.t?Math.round(p.c/p.t*100):0;
        const locked=ev.eventPw&&!S.unlockedEvs[ev.id];
        return`<div style="padding:10px 0;border-bottom:1px solid #f0f0f0">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
            <div><div style="font-weight:600;font-size:13px">${ev.name}${locked?' 🔒':''}</div>
              <div style="font-size:11px;color:#aaa">${fmtD(ev.date)}${ev.team?' · '+ev.team:''}</div></div>
            <div style="display:flex;gap:10px;align-items:center">
              <div style="text-align:center"><div style="font-size:15px;font-weight:700">${p.t}</div><div style="font-size:10px;color:#aaa">Tổng</div></div>
              <div style="text-align:center"><div style="font-size:15px;font-weight:700;color:#3B6D11">${p.c}</div><div style="font-size:10px;color:#aaa">✅ Đã vào</div></div>
              <div style="text-align:center"><div style="font-size:15px;font-weight:700;color:#aaa">${p.p}</div><div style="font-size:10px;color:#aaa">⏳ Chưa</div></div>
              <div style="text-align:center"><div style="font-size:15px;font-weight:700;color:#B91C1C">${p.x}</div><div style="font-size:10px;color:#aaa">🚫 Cancel</div></div>
              <div style="width:60px">
                <div class="pb"><div class="pb-fill" style="width:${r}%;background:#3B6D11"></div></div>
                <div style="font-size:10px;text-align:center;color:#aaa;margin-top:2px">${r}%</div>
              </div>
            </div>
          </div>
        </div>`}).join('')}
    </div>`;

  if(!S.rptEv){return overviewHtml+`<div class="empty" style="padding:24px">☝️ Chọn sự kiện ở trên để xem báo cáo chi tiết</div>`;}

  const selEv=db.events.find(e=>e.id===S.rptEv);
  if(selEv?.eventPw&&!S.unlockedEvs[S.rptEv]){
    return overviewHtml+`<div class="card" style="text-align:center;padding:24px">
      <div style="font-size:24px;margin-bottom:8px">🔒</div>
      <div style="font-weight:700;margin-bottom:4px">Sự kiện được bảo vệ</div>
      <div style="font-size:13px;color:#aaa;margin-bottom:14px">Nhập mật khẩu để xem báo cáo chi tiết</div>
      <button class="btn blue" onclick="S.evUnlockTarget='${S.rptEv}';S.modal='ev_unlock';R()">🔓 Nhập mật khẩu</button>
    </div>`;}

  const allPpl=[];
  egs(S.rptEv).forEach(g=>{
    allPpl.push({name:g.name,code:g.guestCode,phone:g.phone,prmName:g.prmName,tcbRegion:g.tcbRegion,unit:g.unit,sihName:g.sihName,note:g.note,checkedIn:g.checkedIn,cancelled:g.cancelled,checkinTime:g.checkinTime,type:'KH'});
    (g.companions||[]).forEach(c=>allPpl.push({name:c.name,code:c.code,phone:c.phone,prmName:g.prmName,tcbRegion:g.tcbRegion,unit:g.unit,sihName:g.sihName,note:c.cancelNote||g.note,checkedIn:c.checkedIn,cancelled:c.cancelled,checkinTime:c.checkinTime,type:'ĐK',parentName:g.name}));
  });
  const totalP=allPpl.length;
  const ciP=allPpl.filter(p=>p.checkedIn).length;
  const cnP=allPpl.filter(p=>p.cancelled).length;
  const pdP=totalP-ciP-cnP;
  const pctP=totalP>0?Math.round(ciP/totalP*100):0;

  const statsHtml=`<div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
    ${statCard('Tổng','#185FA5',totalP,'')}
    ${statCard('✅ Đã vào','#3B6D11',ciP,pctP+'%')}
    ${statCard('⏳ Chưa','#888',pdP,'')}
    ${statCard('🚫 Cancel','#B91C1C',cnP,'')}
  </div>
  <div style="background:#fff;border-radius:12px;padding:14px 18px;margin-bottom:14px;border:1px solid #eaecf0">
    <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px">
      <span style="font-weight:700">${selEv.name}</span>
      <span style="color:#3B6D11;font-weight:700">${pctP}%</span>
    </div>
    <div style="background:#f0f0f0;border-radius:99px;height:12px;overflow:hidden">
      <div style="width:${pctP}%;background:linear-gradient(90deg,#185FA5,#3B6D11);height:100%;border-radius:99px;transition:width .4s"></div>
    </div>
  </div>`;

  function mkBreakdown(label,icon,groupFn,keyFn){
    const groups={};
    allPpl.forEach(p=>{const k=keyFn(p)||'Không xác định';if(!groups[k])groups[k]=[];groups[k].push(p)});
    const entries=Object.entries(groups).sort((a,b)=>b[1].length-a[1].length);
    if(!entries.length)return'';
    return`<div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1px;margin:16px 0 8px;text-transform:uppercase">${icon} Theo ${label}</div>
      ${entries.map(([grp,ppl])=>{
        const ci=ppl.filter(p=>p.checkedIn).length;
        const cn=ppl.filter(p=>p.cancelled).length;
        const pend=ppl.length-ci-cn;
        const pct=ppl.length>0?Math.round(ci/ppl.length*100):0;
        const kPre=`${groupFn}_${grp}`;
        const expReg=!!S.rptExp[kPre+'_reg'];
        const expCi=!!S.rptExp[kPre+'_ci'];
        const expAb=!!S.rptExp[kPre+'_ab'];
        const expCn=!!S.rptExp[kPre+'_cn'];
        return`<div style="background:#fff;border-radius:12px;border:1px solid #eaecf0;padding:14px 16px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">
            <div style="font-weight:700;font-size:13px">${grp}</div>
            <div style="display:flex;gap:6px;font-size:12px;flex-wrap:wrap">
              <span onclick="togRpt('${kPre}_reg')" style="background:#e8f0fb;color:#185FA5;border-radius:20px;padding:2px 10px;font-weight:600;cursor:pointer;user-select:none">
                Đăng ký: ${ppl.length}${expReg?' ▲':' ▼'}
              </span>
              <span onclick="togRpt('${kPre}_ci')" style="background:${ci>0?'#eaf3de':'#f5f5f5'};color:${ci>0?'#3B6D11':'#aaa'};border-radius:20px;padding:2px 10px;font-weight:600;cursor:${ci>0?'pointer':'default'};user-select:none">
                Đã vào: ${ci}${ci>0?(expCi?' ▲':' ▼'):''}
              </span>
              <span onclick="togRpt('${kPre}_ab')" style="background:${pend>0?'#fdecea':'#f5f5f5'};color:${pend>0?'#e24b4a':'#aaa'};border-radius:20px;padding:2px 10px;font-weight:600;cursor:${pend>0?'pointer':'default'};user-select:none">
                Chưa: ${pend}${pend>0?(expAb?' ▲':' ▼'):''}
              </span>
              ${cn>0?`<span onclick="togRpt('${kPre}_cn')" style="background:#FEF2F2;color:#B91C1C;border-radius:20px;padding:2px 10px;font-weight:600;cursor:pointer;user-select:none">
                Cancel: ${cn}${expCn?' ▲':' ▼'}
              </span>`:''}
            </div>
          </div>
          <div style="background:#f0f0f0;border-radius:99px;height:8px;overflow:hidden">
            <div style="width:${pct}%;background:${pct===100?'#3B6D11':'linear-gradient(90deg,#185FA5,#3B6D11)'};height:100%;border-radius:99px"></div>
          </div>
          <div style="font-size:10px;color:#aaa;margin-top:4px;text-align:right">${pct}% đã check-in</div>
          ${expReg?`<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:10px 12px;margin-top:8px">
            <div style="font-size:11px;font-weight:700;color:#185FA5;margin-bottom:6px">Danh sách đăng ký (${ppl.length} người)</div>
            ${ppl.map(p=>`<div style="padding:5px 0;border-bottom:.5px solid #BFDBFE;display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-weight:600;font-size:13px">${p.name}${p.type==='ĐK'?` <span style="font-size:10px;color:#6D28D9">(đi kèm: ${p.parentName})</span>`:''}</div>
                <div style="font-size:11px;color:#888">${p.code}${p.phone?' · '+p.phone:''}</div>
              </div>
              <span style="font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;${p.cancelled?'background:#FEF2F2;color:#B91C1C':p.checkedIn?'background:#EAF3DE;color:#3B6D11':'background:#f5f5f5;color:#aaa'}">${p.cancelled?'Cancel':p.checkedIn?'✅ Đã vào':'⏳ Chưa'}</span>
            </div>`).join('')}
          </div>`:''}
          ${expCi&&ci>0?`<div style="background:#f0faf0;border:1px solid #97C459;border-radius:8px;padding:10px 12px;margin-top:8px">
            <div style="font-size:11px;font-weight:700;color:#3B6D11;margin-bottom:6px">Đã check-in (${ci} người)</div>
            ${ppl.filter(p=>p.checkedIn).map(p=>`<div style="padding:5px 0;border-bottom:.5px solid #c8e6c9">
              <div style="font-weight:600;font-size:13px">${p.name}${p.type==='ĐK'?` <span style="font-size:10px;color:#6D28D9">(đi kèm: ${p.parentName})</span>`:''}</div>
              <div style="font-size:11px;color:#888">${p.code}${p.phone?' · '+p.phone:''}</div>
              <div style="font-size:10px;color:#3B6D11">✅ ${fmtTm(p.checkinTime)}</div>
            </div>`).join('')}
          </div>`:''}
          ${expAb&&pend>0?`<div style="background:#fff8f8;border:1px solid #fdd;border-radius:8px;padding:10px 12px;margin-top:8px">
            <div style="font-size:11px;font-weight:700;color:#e24b4a;margin-bottom:6px">Chưa check-in (${pend} người)</div>
            ${ppl.filter(p=>!p.checkedIn&&!p.cancelled).map(p=>`<div style="padding:5px 0;border-bottom:.5px solid #fdd">
              <div style="font-weight:600;font-size:13px">${p.name}${p.type==='ĐK'?` <span style="font-size:10px;color:#6D28D9">(đi kèm: ${p.parentName})</span>`:''}</div>
              <div style="font-size:11px;color:#888">${p.code}${p.phone?' · '+p.phone:''}</div>
            </div>`).join('')}
          </div>`:''}
          ${expCn&&cn>0?`<div style="background:#FFF8F8;border:1px solid #FECACA;border-radius:8px;padding:10px 12px;margin-top:8px">
            <div style="font-size:11px;font-weight:700;color:#B91C1C;margin-bottom:6px">Đã cancel (${cn} người)</div>
            ${ppl.filter(p=>p.cancelled).map(p=>`<div style="padding:5px 0;border-bottom:.5px solid #FECACA">
              <div style="font-weight:600;font-size:13px;text-decoration:line-through;color:#bbb">${p.name}${p.type==='ĐK'?` <span style="font-size:10px;color:#d8b4fe">(đi kèm: ${p.parentName})</span>`:''}</div>
              <div style="font-size:11px;color:#aaa">${p.code}${p.phone?' · '+p.phone:''}</div>
              ${p.note?`<div style="font-size:10px;color:#B91C1C;font-style:italic">${p.note}</div>`:''}
            </div>`).join('')}
          </div>`:''}
        </div>`;
      }).join('')}`;
  }

  const byVung=mkBreakdown('Vùng TCB','🏦','vung',p=>p.tcbRegion);
  const bySih=mkBreakdown('SIH','👤','sih',p=>p.sihName);
  const byPrm=mkBreakdown('PRM','🤝','prm',p=>p.prmName);

  return overviewHtml+statsHtml+byVung+bySih+byPrm;
}

function statCard(lbl,color,val,sub){
  return`<div style="flex:1;min-width:120px;background:#fff;border-radius:12px;padding:14px 16px;border-left:4px solid ${color};border:1px solid #eaecf0;border-left-width:4px">
    <div style="font-size:11px;color:#888;margin-bottom:4px">${lbl}</div>
    <div style="font-size:28px;font-weight:800;color:${color};line-height:1">${val}</div>
    ${sub?`<div style="font-size:11px;color:#aaa;margin-top:4px">${sub}</div>`:''}
  </div>`;
}
function togRpt(key){S.rptExp[key]=!S.rptExp[key];R()}
function setRptEv(v){
  if(v){const ev=db.events.find(e=>e.id===v);if(ev?.eventPw&&!S.unlockedEvs[v]){S.evUnlockTarget=v;S.rptEv=v;S.modal='ev_unlock';R();return}}
  S.rptEv=v||null;S.rptExp={};R()
}

/* ============================================================
   MODALS
   ============================================================ */
function rModal(){
  const wrapModal=(inner,cls)=>`<div class="ov" onclick="closeM()"><div class="modal ${cls||''}" onclick="event.stopPropagation()">${inner}</div></div>`;
  if(S.modal==='add_ev'||S.modal==='edit_ev')return wrapModal(rAddEvM(),'lg');
  if(S.modal==='add_g'||S.modal==='edit_g')return wrapModal(rAddGM(),'lg');
  if(S.modal==='tickets')return wrapModal(rTicketsM(),'lg');
  if(S.modal==='edit_pw')return wrapModal(rEditPwM(),'sm');
  if(S.modal==='edit_form')return wrapModal(rEditFormM(),'lg');
  if(S.modal==='del_pw')return wrapModal(rDelM(),'sm');
  if(S.modal==='cp_ticket')return wrapModal(rCpTicketM(),'sm');
  if(S.modal==='cp_edit')return wrapModal(rCpEditM(),'sm');
  if(S.modal==='cp_del')return wrapModal(rCpDelM(),'sm');
  if(S.modal==='cp_add')return wrapModal(rCpAddM());
  if(S.modal==='admin_ci')return wrapModal(rAdminCIM(),'sm');
  if(S.modal==='cancel')return wrapModal(rCancelM(),'sm');
  if(S.modal==='ev_unlock')return wrapModal(rEvUnlockM(),'sm');
  if(S.modal==='import_preview')return wrapModal(rImportPreviewM(),'lg'); // Modal preview dữ liệu Excel
  return'';
}

function rAddEvM(){
  const isEdit=S.modal==='edit_ev';
  const ev=isEdit?db.events.find(e=>e.id===S.editEvId):{};
  const btcList=ev?.btcMembers||[{code:'',name:''}];
  return`<div class="mh">${isEdit?'✏️ Chỉnh sửa sự kiện':'📅 Tạo sự kiện mới'}</div>
    <div class="g2">
      <div class="fg sp"><label>Tên sự kiện *</label><input id="ev_n" placeholder="VD: OneHousing Elite Night — The Global City" value="${ev?.name||''}"/></div>
      <div class="fg"><label>Thời gian tổ chức</label><input id="ev_d" type="date" value="${ev?.date||''}"/></div>
      <div class="fg"><label>Team tổ chức</label><input id="ev_t" placeholder="VD: Marketing Miền Nam" value="${ev?.team||''}"/></div>
      <div class="fg sp"><label>Địa điểm</label><input id="ev_v" placeholder="VD: The Global City Ballroom" value="${ev?.venue||''}"/></div>
    </div>
    <div class="sec">🔐 Mật khẩu bảo vệ danh sách khách</div>
    ${isEdit?`
      <div style="font-size:12px;color:#aaa;margin-bottom:8px">Đổi mật khẩu mới — để trống nếu muốn giữ nguyên mật khẩu cũ.</div>
      <div style="background:#f4f7fb;border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:13px;color:#555">
        Mật khẩu hiện tại: <span style="font-family:'JetBrains Mono',monospace;font-weight:600;color:#185FA5">${ev?.eventPw||'(chưa có)'}</span>
      </div>
      <div class="g2">
        <div class="fg"><label>Mật khẩu mới (tuỳ chọn)</label><input id="ev_pw" type="text" placeholder="Để trống = giữ nguyên" style="font-family:'JetBrains Mono',monospace" autocomplete="off"/></div>
        <div class="fg"><label>Nhập lại mật khẩu mới</label><input id="ev_pw2" type="text" placeholder="Nhập lại để xác nhận" style="font-family:'JetBrains Mono',monospace" autocomplete="off"/></div>
      </div>`
    :`
      <div style="font-size:12px;color:#aaa;margin-bottom:8px">Ai muốn xem/quản lý khách phải nhập đúng mật khẩu này.</div>
      <div class="g2">
        <div class="fg"><label>Mật khẩu sự kiện *</label><input id="ev_pw" type="text" placeholder="VD: OH_Elite_0626" style="font-family:'JetBrains Mono',monospace;letter-spacing:1px" autocomplete="off"/></div>
        <div class="fg"><label>Nhập lại để xác nhận *</label><input id="ev_pw2" type="text" placeholder="Nhập lại mật khẩu" style="font-family:'JetBrains Mono',monospace;letter-spacing:1px" autocomplete="off"/></div>
      </div>`}
    <div id="ev_pw_err" style="color:#B91C1C;font-size:12px;margin-bottom:8px"></div>
    <div class="sec">🔑 Danh sách BTC — Mã nhân viên có quyền check-in</div>
    <div style="font-size:12px;color:#aaa;margin-bottom:8px">Thêm, sửa hoặc xoá thành viên BTC. Cùng mã có thể dùng ở nhiều sự kiện.</div>
    <div id="btc_w">
      ${btcList.map((m,i)=>`<div class="btc-r" id="br_${i}">
        <input placeholder="Mã NV" id="bc_${i}" value="${m.code||''}" style="max-width:110px;font-family:'JetBrains Mono',monospace;text-transform:uppercase"/>
        <input placeholder="Họ tên BTC" id="bn_${i}" value="${m.name||''}"/>
        ${i>0?`<button class="btn xs red" onclick="rmBR(${i})">✕</button>`:`<span style="width:22px"></span>`}
      </div>`).join('')}
    </div>
    <button class="btn sm" onclick="addBR()" style="margin-bottom:4px">+ Thêm BTC</button>
    <div class="mf">
      <button class="btn" onclick="closeM()">Huỷ</button>
      <button class="btn ${isEdit?'green':'blue'}" onclick="saveEv()">✅ ${isEdit?'Lưu thay đổi':'Tạo sự kiện'}</button>
    </div>`;
}

function rAddGM(){
  const g=S.modal==='edit_g'&&S.editGid?db.guests.find(x=>x.id===S.editGid):{};
  const comps=g?.companions?.length?g.companions:[{name:'',phone:''}];
  return`<div class="mh">${S.modal==='edit_g'?'✏️ Chỉnh sửa khách mời':'👤 Thêm khách mời mới'}</div>
    <div class="fg"><label>Sự kiện *</label><select id="g_ev">${db.events.map(e=>`<option value="${e.id}" ${(S.selEv===e.id||g?.eventId===e.id)?'selected':''}>${e.name}</option>`).join('')}</select></div>
    ${S.modal==='edit_g'?`<div style="margin-bottom:10px"><span style="font-size:12px;color:#aaa">Mã KH:</span> <span class="mono">${g?.guestCode||''}</span> <span style="font-size:11px;color:#ccc">(cố định, không thay đổi)</span></div>`:''}
    <div class="sec">Thông tin khách hàng chính</div>
    <div class="g2">
      <div class="fg"><label>Họ và tên KH *</label><input id="g_n" placeholder="Nguyễn Văn A" value="${g?.name||''}"/></div>
      <div class="fg"><label>Số điện thoại *</label><input id="g_ph" type="tel" placeholder="09xxxxxxxx" value="${g?.phone||''}"/></div>
    </div>
    <div class="sec">👥 Người đi kèm <span style="text-transform:none;letter-spacing:0;font-weight:400">(mỗi người có QR & check-in riêng)</span></div>
    <div id="cp_w">
      ${comps.map((c,i)=>cpRowHTML(c,i,g?.companions?.[i]?.code)).join('')}
    </div>
    <button class="btn sm" onclick="addCR()" style="margin-bottom:4px">+ Thêm đi kèm</button>
    <div class="sec">Thông tin chăm sóc</div>
    <div class="g3">
      <div class="fg"><label>Tên PRM (Sales TCB)</label><input id="g_prm" placeholder="Tên PRM" value="${g?.prmName||''}"/></div>
      <div class="fg"><label>Vùng TCB</label><input id="g_reg" placeholder="Vùng 1 HCM" value="${g?.tcbRegion||''}"/></div>
      <div class="fg"><label>Đơn vị (CN/PGD)</label><input id="g_unit" placeholder="CN Thủ Đức" value="${g?.unit||''}"/></div>
    </div>
    <div class="g2">
      <div class="fg"><label>Tên SIH (Sales OneHousing)</label><input id="g_sih" placeholder="Tên SIH" value="${g?.sihName||''}"/></div>
      <div class="fg"><label>Note / Lưu ý</label><input id="g_note" placeholder="VVIP, ưu tiên bàn đầu..." value="${g?.note||''}"/></div>
    </div>
    <div class="mf">
      <button class="btn" onclick="closeM()">Huỷ</button>
      <button class="btn ${S.modal==='edit_g'?'green':'blue'}" onclick="saveG()">✅ ${S.modal==='edit_g'?'Lưu thay đổi':'Thêm khách & Tạo vé'}</button>
    </div>`;
}

function cpRowHTML(c,i,existingCode){
  return`<div class="cp-r" id="cr_${i}">
    <div class="g2" style="margin-bottom:0">
      <div class="fg" style="margin-bottom:0"><label>Họ tên người đi kèm ${i+1}</label>
        <input placeholder="Họ và tên" id="cn_${i}" value="${c.name||''}"/></div>
      <div class="fg" style="margin-bottom:0"><label>Số điện thoại</label>
        <input placeholder="09xxxxxxxx" type="tel" id="cp_${i}" value="${c.phone||''}"/></div>
    </div>
    ${existingCode?`<div style="margin-top:6px;font-size:11px;color:#aaa">Mã: <span class="mono">${existingCode}</span> (cố định)</div>`:''}
    ${i>0?`<button class="btn xs red" onclick="rmCR(${i})" style="margin-top:6px">Xoá đi kèm này</button>`:''}
  </div>`;
}

function rTicketsM(){
  const g=db.guests.find(x=>x.id===S.ticketGid);
  if(!g)return'';
  const ev=db.events.find(e=>e.id===g.eventId);
  const all=[{type:'main',name:g.name,code:g.guestCode,phone:g.phone},
    ...(g.companions||[]).map(c=>({type:'comp',name:c.name,code:c.code,phone:c.phone,parentName:g.name}))];
  return`<div class="mh">🎫 Vé tham dự sự kiện</div>
    <div style="font-size:13px;color:#aaa;margin-bottom:4px">${ev?.name||''} · ${fmtD(ev?.date)}</div>
    <div style="font-size:12px;color:#bbb;margin-bottom:16px">${all.length} vé · 1 KH chính${g.companions?.length?' + '+g.companions.length+' đi kèm':''}</div>
    <div class="tgrid">
      ${all.map((tk,idx)=>`
        <div class="ticket">
          <div class="tk-header">VÉ THAM DỰ SỰ KIỆN</div>
          <div style="font-size:11px;color:#bbb;margin-bottom:6px">${ev?.name||''}</div>
          <div style="font-size:11px;color:#bbb;margin-bottom:12px">${fmtD(ev?.date)}${ev?.venue?' · '+ev.venue:''}</div>
          <div class="tk-name">${tk.name}</div>
          <span class="tk-role ${tk.type==='main'?'b-blue':'b-purple'}">${tk.type==='main'?'Khách mời chính':'Đi kèm: '+tk.parentName}</span>
          <div class="tk-qr" id="tqr_${idx}"></div>
          <div class="tk-code">${tk.code}</div>
          <div class="tk-foot">
            Vui lòng xuất trình vé tại cổng check-in<br>
            Vé chỉ có giá trị cho 01 người
          </div>
          <button class="btn sm" onclick="dlTicket(${idx},'${tk.name.replace(/'/g,"\\'")}','${tk.code}','${tk.type==='main'?'Khách mời chính':'Đi kèm: '+(tk.parentName||'').replace(/'/g,"\\'")}')" style="margin-top:10px;font-size:12px">⬇️ Tải vé này</button>
        </div>
      `).join('')}
    </div>
    <div class="mf" style="justify-content:center">
      <button class="btn" onclick="printAll()">🖨️ In tất cả vé</button>
      <button class="btn" onclick="closeM()">Đóng</button>
    </div>`;
}

function rEditPwM(){
  return`<div class="mh">✏️ Xác nhận chỉnh sửa</div>
    <div style="font-size:13px;color:#888;margin-bottom:12px">Nhập mật khẩu Admin để chỉnh sửa thông tin khách.</div>
    <div class="fg"><label>Mật khẩu Admin</label>
      <input type="password" id="epw" placeholder="Nhập mật khẩu..." autofocus onkeydown="if(event.key==='Enter')chkEditPw()"/></div>
    <div id="epw_err" class="err"></div>
    <div class="mf">
      <button class="btn" onclick="closeM()">Huỷ</button>
      <button class="btn blue" onclick="chkEditPw()">Tiếp tục →</button>
    </div>`;
}

function rEditFormM(){
  const g=db.guests.find(x=>x.id===S.editGid);
  if(!g)return'';
  const comps=g.companions?.length?g.companions:[{name:'',phone:'',code:''}];
  return`<div class="mh">✏️ Chỉnh sửa — ${g.name}</div>
    <div style="margin-bottom:12px"><span class="mono">${g.guestCode}</span> <span style="font-size:11px;color:#ccc">(mã cố định)</span></div>
    <div class="sec">Thông tin khách hàng chính</div>
    <div class="g2">
      <div class="fg"><label>Họ và tên KH</label><input id="eg_n" value="${g.name||''}"/></div>
      <div class="fg"><label>Số điện thoại</label><input id="eg_ph" type="tel" value="${g.phone||''}"/></div>
    </div>
    <div class="sec">Người đi kèm</div>
    <div id="ecp_w">
      ${comps.map((c,i)=>`<div class="cp-r" id="ecr_${i}">
        <div class="g2" style="margin-bottom:0">
          <div class="fg" style="margin-bottom:0"><label>Tên đi kèm ${i+1}</label><input id="ecn_${i}" value="${c.name||''}"/></div>
          <div class="fg" style="margin-bottom:0"><label>SĐT</label><input id="ecp_${i}" type="tel" value="${c.phone||''}"/></div>
        </div>
        <div style="margin-top:5px;font-size:11px;color:#aaa">Mã: <span class="mono">${c.code||'—'}</span> (cố định)</div>
      </div>`).join('')}
    </div>
    <div class="sec">Thông tin chăm sóc</div>
    <div class="g3">
      <div class="fg"><label>PRM</label><input id="eg_prm" value="${g.prmName||''}"/></div>
      <div class="fg"><label>Vùng TCB</label><input id="eg_reg" value="${g.tcbRegion||''}"/></div>
      <div class="fg"><label>Đơn vị</label><input id="eg_unit" value="${g.unit||''}"/></div>
    </div>
    <div class="g2">
      <div class="fg"><label>SIH</label><input id="eg_sih" value="${g.sihName||''}"/></div>
      <div class="fg"><label>Note</label><input id="eg_note" value="${g.note||''}"/></div>
    </div>
    <div class="mf">
      <button class="btn" onclick="closeM()">Huỷ</button>
      <button class="btn green" onclick="doEdit()">💾 Lưu</button>
    </div>`;
}

function rDelM(){
  const g=db.guests.find(x=>x.id===S.delGid);
  return`<div class="mh">🗑️ Xoá khách hàng</div>
    <div style="text-align:center;padding:8px 0">
      <div style="font-size:13px;color:#555;margin-bottom:4px">Xoá <b>${g?.name||''}</b> — <span class="mono">${g?.guestCode||''}</span></div>
      <div style="font-size:12px;color:#bbb;margin-bottom:16px">Hành động này không thể hoàn tác. Người đi kèm cũng bị xoá.</div>
    </div>
    <div class="fg"><label>Mật khẩu Admin để xác nhận</label>
      <input type="password" id="dpw" placeholder="Nhập mật khẩu..." autofocus onkeydown="if(event.key==='Enter')doDel()"/></div>
    <div id="dpw_err" class="err"></div>
    <div class="mf">
      <button class="btn" onclick="closeM()">Huỷ</button>
      <button class="btn red" onclick="doDel()">🗑️ Xoá</button>
    </div>`;
}

function rCpTicketM(){
  const {gid,cpId}=S.cpTicket||{};
  const g=db.guests.find(x=>x.id===gid);
  const cp=(g?.companions||[]).find(x=>x.id===cpId);
  if(!g||!cp)return'';
  const ev=db.events.find(e=>e.id===g.eventId);
  return`<div class="mh">🎫 Vé người đi kèm</div>
    <div class="ticket" style="margin:8px 0">
      <div class="tk-header">VÉ THAM DỰ SỰ KIỆN</div>
      <div style="font-size:11px;color:#bbb;margin-bottom:6px">${ev?.name||''}</div>
      <div style="font-size:11px;color:#bbb;margin-bottom:12px">${fmtD(ev?.date)}${ev?.venue?' · '+ev.venue:''}</div>
      <div class="tk-name">${cp.name}</div>
      <span class="tk-role b-purple">Đi kèm: ${g.name}</span>
      <div class="tk-qr" id="cp_tqr"></div>
      <div class="tk-code">${cp.code}</div>
      <div class="foot">Vui lòng xuất trình vé tại cổng check-in<br>Vé chỉ có giá trị cho 01 người</div>
    </div>
    <div class="mf" style="justify-content:center">
      <button class="btn sm" onclick="dlCpTicket()">⬇️ Tải vé này</button>
      <button class="btn" onclick="closeM()">Đóng</button>
    </div>`;
}

function rCpEditM(){
  const {gid,cpId}=S.cpEdit||{};
  const g=db.guests.find(x=>x.id===gid);
  const cp=(g?.companions||[]).find(x=>x.id===cpId);
  if(!g||!cp)return'';
  return`<div class="mh">✏️ Sửa người đi kèm</div>
    <div style="font-size:12px;color:#aaa;margin-bottom:12px">Mã: <span class="mono">${cp.code}</span> (cố định)</div>
    <div class="fg"><label>Họ và tên</label>
      <input id="cpe_n" value="${cp.name}" autofocus/></div>
    <div class="fg"><label>Số điện thoại</label>
      <input id="cpe_ph" type="tel" value="${cp.phone||''}"/></div>
    <div class="mf">
      <button class="btn" onclick="closeM()">Huỷ</button>
      <button class="btn green" onclick="doCpEdit()">💾 Lưu</button>
    </div>`;
}

function rCpDelM(){
  const {gid,cpId}=S.cpDel||{};
  const g=db.guests.find(x=>x.id===gid);
  const cp=(g?.companions||[]).find(x=>x.id===cpId);
  if(!g||!cp)return'';
  return`<div class="mh">🗑️ Xoá người đi kèm</div>
    <div style="text-align:center;padding:8px 0">
      <div style="font-size:13px;color:#555;margin-bottom:4px">Xoá <b>${cp.name}</b> <span class="mono">${cp.code}</span></div>
      <div style="font-size:12px;color:#aaa;margin-bottom:4px">Đi kèm: ${g.name}</div>
      <div style="font-size:12px;color:#bbb;margin-bottom:14px">Hành động này không thể hoàn tác.</div>
    </div>
    <div class="fg"><label>Mật khẩu Admin để xác nhận</label>
      <input type="password" id="cpdpw" placeholder="Nhập mật khẩu..." autofocus onkeydown="if(event.key==='Enter')doCpDel()"/></div>
    <div id="cpdpw_err" class="err"></div>
    <div class="mf">
      <button class="btn" onclick="closeM()">Huỷ</button>
      <button class="btn red" onclick="doCpDel()">🗑️ Xoá</button>
    </div>`;
}

function rCpAddM(){
  const g=db.guests.find(x=>x.id===S.cpAdd);
  if(!g)return'';
  return`<div class="mh">👤 Thêm người đi kèm</div>
    <div style="font-size:13px;color:#888;margin-bottom:14px">Thêm cho: <b>${g.name}</b> <span class="mono">${g.guestCode}</span></div>
    <div class="fg"><label>Họ và tên *</label>
      <input id="cpa_n" placeholder="Họ và tên người đi kèm" autofocus/></div>
    <div class="fg"><label>Số điện thoại</label>
      <input id="cpa_ph" type="tel" placeholder="09xxxxxxxx"/></div>
    <div class="mf">
      <button class="btn" onclick="closeM()">Huỷ</button>
      <button class="btn blue" onclick="doCpAdd()">✅ Thêm & Tạo vé</button>
    </div>`;
}

function rAdminCIM(){
  const {gid,type,cpId}=S.adminCI||{};
  const g=db.guests.find(x=>x.id===gid);if(!g)return'';
  const person=type==='c'?(g.companions||[]).find(x=>x.id===cpId):g;
  if(!person)return'';
  const ev=db.events.find(e=>e.id===g.eventId);
  const hasPhone=!!(person.phone);
  return`<div class="mh">✅ Xác nhận Check-in</div>
    <div style="background:#f4f7fb;border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#aaa;margin-bottom:6px">THÔNG TIN KHÁCH</div>
      <div style="font-size:18px;font-weight:800;margin-bottom:4px">${person.name}</div>
      <div style="font-size:13px;color:#185FA5;margin-bottom:4px">Mã: <span style="font-family:'JetBrains Mono',monospace">${type==='c'?(g.companions||[]).find(x=>x.id===cpId)?.code||'—':g.guestCode}</span></div>
      ${type==='c'?`<div style="margin-top:4px"><span class="badge b-purple">Đi kèm: ${g.name}</span></div>`:''}
      ${g.note&&type==='g'?`<div style="margin-top:6px"><span class="badge b-amber">${g.note}</span></div>`:''}
    </div>
    ${hasPhone?`
      <div style="font-size:13px;color:#555;text-align:center;margin-bottom:12px">🔢 Nhập 4 số cuối số điện thoại để xác nhận</div>
      <input id="aci_ph" type="tel" maxlength="4" placeholder="— — — —"
        style="width:100%;padding:14px;text-align:center;letter-spacing:10px;font-size:26px;font-family:'JetBrains Mono',monospace;border:2px solid #dde4f0;border-radius:12px"
        onkeydown="if(event.key==='Enter')doAdminCI()"/>
      <div id="aci_err" class="err" style="text-align:center;margin-top:8px"></div>
      <div class="mf">
        <button class="btn" onclick="closeM()">Huỷ</button>
        <button class="btn green" onclick="doAdminCI()" style="padding:10px 28px">✅ Xác nhận Check-in</button>
      </div>`
    :`<div style="font-size:13px;color:#888;text-align:center;margin-bottom:16px">Khách không có SĐT — check-in trực tiếp không cần xác minh.</div>
      <div class="mf" style="justify-content:center">
        <button class="btn" onclick="closeM()">Huỷ</button>
        <button class="btn green" onclick="doAdminCI()" style="padding:10px 28px">✅ Check-in</button>
      </div>`}`;
}

function rCancelM(){
  const {gid,type,cpId}=S.cancelTarget||{};
  const g=db.guests.find(x=>x.id===gid);if(!g)return'';
  const person=type==='c'?(g.companions||[]).find(x=>x.id===cpId):g;
  if(!person)return'';
  return`<div class="mh">🚫 Đánh dấu Cancel</div>
    <div style="background:#FFF8F8;border-radius:10px;padding:14px;margin-bottom:14px;border:1px solid #FECACA">
      <div style="font-size:15px;font-weight:700">${person.name}</div>
      <div style="font-size:12px;color:#aaa;margin-top:3px">Mã: <span class="mono">${type==='c'?person.code:g.guestCode}</span>${type==='c'?` · Đi kèm: ${g.name}`:''}</div>
    </div>
    <div class="fg">
      <label>Lý do cancel / Ghi chú (tuỳ chọn)</label>
      <textarea id="cancel_note" placeholder="VD: KH có việc đột xuất, chưa xác nhận lại..." style="resize:vertical;min-height:70px;padding:9px 12px;border:1.5px solid #dde4f0;border-radius:8px;font-size:13px;width:100%"></textarea>
    </div>
    <div style="font-size:12px;color:#aaa;margin-bottom:12px">Khách sẽ được giữ trong hệ thống và hiện trong báo cáo với trạng thái Cancel. Có thể khôi phục bất kỳ lúc nào.</div>
    <div class="mf">
      <button class="btn" onclick="closeM()">Huỷ</button>
      <button class="btn red" onclick="doCancel()">🚫 Xác nhận Cancel</button>
    </div>`;
}

function rEvUnlockM(){
  const ev=db.events.find(e=>e.id===S.evUnlockTarget);if(!ev)return'';
  return`<div class="mh">🔒 Nhập mật khẩu sự kiện</div>
    <div style="background:#f4f7fb;border-radius:10px;padding:14px;margin-bottom:16px">
      <div style="font-size:15px;font-weight:700">${ev.name}</div>
      <div style="font-size:12px;color:#aaa;margin-top:3px">${fmtD(ev.date)}${ev.team?' · '+ev.team:''}</div>
    </div>
    <div style="font-size:13px;color:#666;margin-bottom:12px">Danh sách khách của sự kiện này được bảo vệ. Nhập mật khẩu để tiếp tục.</div>
    <div class="fg"><label>Mật khẩu sự kiện</label>
      <input type="password" id="ev_unlock_pw" placeholder="Nhập mật khẩu..."
        style="font-size:15px;padding:11px 14px;text-align:center;letter-spacing:2px"
        autofocus onkeydown="if(event.key==='Enter')doEvUnlock()"/></div>
    <div id="ev_unlock_err" style="color:#B91C1C;font-size:12px;margin-bottom:8px"></div>
    <div class="mf">
      <button class="btn" onclick="closeM()">Huỷ</button>
      <button class="btn blue" onclick="doEvUnlock()">Mở khoá →</button>
    </div>`;
}
function doEvUnlock(){
  const ev=db.events.find(e=>e.id===S.evUnlockTarget);if(!ev)return;
  const pw=document.getElementById('ev_unlock_pw')?.value||'';
  if(pw!==ev.eventPw){
    const el=document.getElementById('ev_unlock_err');
    if(el)el.textContent='⚠️ Mật khẩu không đúng.';
    const inp=document.getElementById('ev_unlock_pw');if(inp){inp.value='';inp.focus();}
    return;
  }
  S.unlockedEvs[S.evUnlockTarget]=true;
  const eid=S.evUnlockTarget;
  S.evUnlockTarget=null;S.modal=null;
  if(S.rptEv===eid){R();return} 
  S.selEv=eid;S.tab='guests';S.search='';S.filter='all';R();
}

/* Modal xem trước dữ liệu khi Import Excel */
function rImportPreviewM(){
  const data = S.importData || [];
  return `
    <div class="mh">📊 Xác nhận Import danh sách từ Excel</div>
    <div style="font-size:12px;color:#aaa;margin-bottom:12px">Hệ thống tìm thấy <b>${data.length} dòng dữ liệu</b>. Vui lòng kiểm tra kỹ trước khi lưu.</div>
    <div style="max-height:300px;overflow-y:auto;border:1.5px solid #dde4f0;border-radius:10px;margin-bottom:12px">
      <table class="tbl">
        <thead>
          <tr>
            <th>Loại</th><th>Họ và tên</th><th>Số điện thoại</th><th>Tên PRM</th><th>Vùng TCB</th><th>Đơn vị</th><th>Tên SIH</th><th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(r=>`
            <tr>
              <td><span class="badge ${r.type==='Main'?'b-blue':'b-purple'}">${r.type==='Main'?'KH Chính':'Đi kèm'}</span></td>
              <td style="font-weight:600">${r.name||'—'}</td>
              <td>${r.phone||'—'}</td>
              <td>${r.prmName||'—'}</td>
              <td>${r.tcbRegion||'—'}</td>
              <td>${r.unit||'—'}</td>
              <td>${r.sihName||'—'}</td>
              <td style="color:#aaa;font-style:italic">${r.note||'—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="mf">
      <button class="btn" onclick="closeM()">Huỷ bỏ</button>
      <button class="btn green" onclick="commitExcelImport()">💾 Xác nhận Lưu vào hệ thống</button>
    </div>
  `;
}

/* ============================================================
   URL CHECK-IN VIEW (Scan QR)
   ============================================================ */
function rUrlCI(){
  const code=S.urlCode;
  let found=null;
  for(const g of db.guests){
    if(g.guestCode===code){found={type:'guest',guest:g,person:g};break}
    for(const c of(g.companions||[])){
      if(c.code===code){found={type:'comp',guest:g,person:c};break}
    }
    if(found)break;
  }
  const ev=found?db.events.find(e=>e.id===found?.guest?.eventId):null;

  if(!found){
    return`<div style="max-width:400px;margin:60px auto;padding:24px;text-align:center;font-family:'Be Vietnam Pro',sans-serif">
      <div style="font-size:52px;margin-bottom:12px">❌</div>
      <div style="font-size:18px;font-weight:700;color:#a32d2d;margin-bottom:8px">Không tìm thấy vé</div>
      <div style="font-size:13px;color:#aaa;margin-bottom:20px">Mã <b>${code}</b> không tồn tại trong hệ thống.</div>
    </div>`;
  }

  const p=found.person;const g=found.guest;

  if(S.urlCIStep==='done'){
    return`<div style="max-width:400px;margin:40px auto;padding:24px;text-align:center;font-family:'Be Vietnam Pro',sans-serif">
      <div style="font-size:64px;margin-bottom:12px">🎉</div>
      <div style="font-size:22px;font-weight:800;color:#0C447C;margin-bottom:10px">Check-in thành công!</div>
      <div style="font-size:17px;font-weight:600;color:#185FA5;margin-bottom:4px">${p.name}</div>
      ${found.type==='comp'?`<div style="font-size:13px;color:#6D28D9;margin-bottom:4px">Đi kèm: ${g.name}</div>`:''}
      <div style="font-size:13px;color:#aaa">${ev?.name||''}</div>
      ${g.note?`<div style="display:inline-block;margin-top:8px;background:#FFFBEB;color:#92400E;font-size:12px;padding:4px 12px;border-radius:20px">${g.note}</div>`:''}
      <div style="font-size:12px;color:#bbb;margin-top:12px">Ghi nhận lúc: ${fmtDT(p.checkinTime)}</div>
      <div style="margin-top:24px"><button onclick="window.close()" style="padding:10px 24px;background:#185FA5;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-family:'Be Vietnam Pro',sans-serif">Đóng</button></div>
    </div>`;
  }

  if(p.checkedIn){
    return`<div style="max-width:400px;margin:60px auto;padding:24px;text-align:center;font-family:'Be Vietnam Pro',sans-serif">
      <div style="font-size:52px;margin-bottom:12px">⚠️</div>
      <div style="font-size:18px;font-weight:700;color:#BA7517;margin-bottom:8px">Vé đã được sử dụng</div>
      <div style="font-size:15px;font-weight:600">${p.name}</div>
      <div style="font-size:12px;color:#aaa;margin-top:6px">Check-in lúc: ${fmtDT(p.checkinTime)}</div>
      <div style="font-size:12px;color:#aaa">Xác nhận bởi: ${p.checkinBy||'—'}</div>
    </div>`;
  }

  if(p.cancelled){
    return`<div style="max-width:400px;margin:60px auto;padding:24px;text-align:center;font-family:'Be Vietnam Pro',sans-serif">
      <div style="font-size:52px;margin-bottom:12px">🚫</div>
      <div style="font-size:18px;font-weight:700;color:#B91C1C;margin-bottom:8px">Vé đã bị huỷ</div>
      <div style="font-size:15px;font-weight:600">${p.name}</div>
      <div style="font-size:12px;color:#aaa;margin-top:6px">${p.cancelNote||''}</div>
    </div>`;
  }

  const hasPhone=!!p.phone;
  return`<div style="max-width:420px;margin:0 auto;padding:20px 16px;font-family:'Be Vietnam Pro',sans-serif">
    <div style="text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #eaecf0">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#bbb;margin-bottom:8px">VÉ THAM DỰ SỰ KIỆN</div>
      <div style="font-size:13px;color:#aaa;margin-bottom:4px">${ev?.name||'—'}</div>
      <div style="font-size:13px;color:#aaa">${fmtD(ev?.date)}${ev?.venue?' · '+ev.venue:''}</div>
    </div>
    <div style="background:#f4f7fb;border-radius:12px;padding:16px;margin-bottom:20px;text-align:center">
      <div style="font-size:20px;font-weight:800;color:#1a1a2e">${p.name}</div>
      ${found.type==='comp'?`<div style="font-size:12px;color:#6D28D9;margin-top:4px;font-weight:500">Đi kèm: ${g.name}</div>`:''}
      <div style="font-family:'JetBrains Mono',monospace;font-size:14px;color:#aaa;margin-top:6px;letter-spacing:1px">${code}</div>
      ${g.note?`<div style="margin-top:6px;display:inline-block;background:#FFFBEB;color:#92400E;font-size:11px;padding:2px 10px;border-radius:20px;font-weight:600">${g.note}</div>`:''}
    </div>
    ${hasPhone?`
    <div style="margin-bottom:16px">
      <div style="font-size:13px;color:#555;text-align:center;margin-bottom:10px">🔢 Nhập 4 số cuối số điện thoại</div>
      <input id="uci_phone" type="tel" maxlength="4" placeholder="— — — —"
        style="width:100%;padding:14px;text-align:center;letter-spacing:10px;font-size:26px;font-family:'JetBrains Mono',monospace;border:2px solid #dde4f0;border-radius:12px;font-family:'JetBrains Mono',monospace"
        onkeydown="if(event.key==='Enter')doUrlCI()"/>
    </div>`:'<div style="font-size:13px;color:#aaa;text-align:center;margin-bottom:16px">Khách không có SĐT — xác nhận trực tiếp.</div>'}
    <div style="margin-bottom:12px">
      <div style="font-size:13px;color:#555;text-align:center;margin-bottom:10px">🔑 Nhập mã nhân viên BTC để xác nhận</div>
      <input id="uci_btc" type="text" placeholder="Mã BTC (VD: NV001)"
        style="width:100%;padding:11px 14px;text-align:center;font-family:'JetBrains Mono',monospace;letter-spacing:2px;font-size:16px;text-transform:uppercase;border:2px solid #dde4f0;border-radius:10px"
        oninput="this.value=this.value.toUpperCase()" onkeydown="if(event.key==='Enter')doUrlCI()"/>
    </div>
    <div id="uci_err" style="color:#a32d2d;font-size:12px;text-align:center;margin-bottom:10px"></div>
    <button onclick="doUrlCI()" style="width:100%;padding:14px;background:#3B6D11;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;font-family:'Be Vietnam Pro',sans-serif">✅ Xác nhận Check-in</button>
  </div>`;
}

function postUrlCI(){
  setTimeout(()=>{
    const el=document.getElementById('uci_phone')||document.getElementById('uci_btc');
    if(el)el.focus();
  },80);
}

async function doUrlCI(){
  const code=S.urlCode;
  let found=null;
  for(const g of db.guests){
    if(g.guestCode===code){found={type:'guest',guest:g,person:g};break}
    for(const c of(g.companions||[])){if(c.code===code){found={type:'comp',guest:g,person:c};break}}
    if(found)break;
  }
  if(!found){return}
  const p=found.person;const g=found.guest;
  const ev=db.events.find(e=>e.id===g.eventId);
  if(isEvLocked(ev)){
    const el=document.getElementById('uci_err');
    if(el)el.textContent='⚠️ Sự kiện đã kết thúc. Không thể check-in.';return;
  }

  const btcInput=(document.getElementById('uci_btc')?.value||'').toUpperCase().trim();
  const btcOk=(ev?.btcMembers||[]).find(m=>m.code===btcInput);
  if(!btcOk){
    const el=document.getElementById('uci_err');
    if(el)el.textContent='⚠️ Mã BTC không đúng hoặc không thuộc sự kiện này.';
    return;
  }

  const last4=p.phone?p.phone.replace(/\D/g,'').slice(-4):'';
  if(last4){
    const phoneInput=(document.getElementById('uci_phone')?.value||'').trim();
    if(phoneInput!==last4){
      const el=document.getElementById('uci_err');
      if(el)el.textContent='⚠️ 4 số cuối SĐT không khớp.';
      const inp=document.getElementById('uci_phone');if(inp){inp.value='';inp.focus();}
      return;
    }
  }

  const now=new Date().toISOString();
  if(found.type==='guest'){g.checkedIn=true;g.checkinTime=now;g.checkinBy=btcInput}
  else{p.checkedIn=true;p.checkinTime=now;p.checkinBy=btcInput}
  save();
  S.urlCIStep='done';R();
}

/* ============================================================
   CHECK-IN VIEW FOR BTC
   ============================================================ */
function rCIView(){
  if(!S.ciOk)return rLock();
  if(!S.ciState)return rCIIdle();
  const st=S.ciState;
  if(st.step==='verify')return rCIVerify();
  if(st.step==='done')return rCIDone();
  if(st.step==='err')return rCIErr();
  return rCIIdle();
}
function postCI(){setTimeout(()=>{const el=document.getElementById('ci_in')||document.getElementById('ci_ph')||document.getElementById('lock_c');if(el)el.focus()},80)}

function rLock(){
  return`<div class="lock">
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:40px">🔐</div>
      <div style="font-size:17px;font-weight:800;margin-top:8px">Đăng nhập Check-in</div>
      <div style="font-size:13px;color:#aaa;margin-top:4px">Chọn sự kiện và nhập mã nhân viên BTC</div>
    </div>
    <div class="fg"><label>Sự kiện</label><select id="lock_ev" style="width:100%" onchange="S.ciEv=this.value">
      <option value="">-- Chọn sự kiện --</option>
      ${db.events.map(e=>`<option value="${e.id}" ${S.ciEv===e.id?'selected':''}>${e.name} (${fmtD(e.date)})</option>`).join('')}
    </select></div>
    <div class="fg"><label>Mã nhân viên BTC</label>
      <input id="lock_c" placeholder="VD: NV001" style="text-transform:uppercase;font-family:'JetBrains Mono',monospace;letter-spacing:2px;font-size:16px;text-align:center;padding:12px"
        onkeydown="if(event.key==='Enter')tryUnlock()"/></div>
    <button class="btn blue full" onclick="tryUnlock()">Vào hệ thống →</button>
    <div id="lock_err" class="err" style="text-align:center;margin-top:8px"></div>
    <div style="text-align:center;margin-top:166px"><button class="btn ghost" onclick="backAdmin()">← Về trang quản trị</button></div>
  </div>`;
}

function rCIIdle(){
  const ev=db.events.find(e=>e.id===S.ciEv);
  const p=allPeople(S.ciEv);
  const gs=egs(S.ciEv);
  const recent=[];
  gs.forEach(g=>{
    if(g.checkedIn)recent.push({name:g.name,code:g.guestCode,time:g.checkinTime,tag:'KH'});
    (g.companions||[]).forEach(c=>{if(c.checkedIn)recent.push({name:c.name,code:c.code,time:c.checkinTime,tag:'ĐK'})});
  });
  recent.sort((a,b)=>new Date(b.time)-new Date(a.time));
  return`<div class="ci-screen">
    <div class="ci-head">
      <button class="btn ghost sm" onclick="backAdmin()">←</button>
      <div style="flex:1"><div style="font-weight:700;font-size:14px">${ev?.name||'Sự kiện'}</div>
        <div style="font-size:12px;color:#aaa">${p.c}/${p.t} đã check-in · BTC: ${S.ciOp?.name||'—'}</div></div>
      <button class="btn sm red" onclick="lockOut()">🔒 Khoá</button>
    </div>
    <div style="text-align:center;padding:24px 16px">
      <div style="font-size:48px;margin-bottom:12px">📷</div>
      <div style="font-size:15px;font-weight:700;margin-bottom:4px">Sẵn sàng nhận khách</div>
      <div style="font-size:13px;color:#aaa;margin-bottom:20px">Nhập mã từ vé (KH chính hoặc người đi kèm)</div>
      <div style="display:flex;gap:8px;max-width:320px;margin:0 auto">
        <input id="ci_in" placeholder="Nhập mã KH..." style="flex:1;padding:12px;border:2px solid #dde4f0;border-radius:10px;font-size:14px;font-family:'JetBrains Mono',monospace;letter-spacing:2px;text-transform:uppercase" oninput="this.value=this.value.toUpperCase()" onkeydown="if(event.key==='Enter')startCI()"/>
        <button class="btn blue" onclick="startCI()" style="padding:12px 16px">→</button>
      </div>
      <div id="ci_err" class="err" style="text-align:center;margin-top:8px"></div>
    </div>
    ${recent.length?`<div style="max-width:360px;margin:0 auto">
      <div style="font-size:12px;font-weight:600;color:#aaa;margin-bottom:8px">Vừa check-in</div>
      ${recent.slice(0,8).map(r=>`<div class="recent-item">
        <div><div style="font-weight:600;font-size:13px">${r.name} <span class="badge ${r.tag==='KH'?'b-blue':'b-purple'}" style="font-size:9px">${r.tag}</span></div>
          <div style="font-size:11px;color:#aaa">${r.code}</div></div>
        <div style="font-size:11px;color:#3B6D11;font-weight:600">${fmtTm(r.time)}</div>
      </div>`).join('')}
    </div>`:''}
  </div>`;
}

function rCIVerify(){
  const st=S.ciState;const p=st.person;const g=st.guest;
  return`<div class="ci-screen">
    <div class="ci-head"><button class="btn ghost sm" onclick="cancelCI()">←</button>
      <div style="font-size:14px;font-weight:600">Xác minh danh tính</div></div>
    <div style="text-align:center;padding:20px 16px">
      <div style="background:#f4f7fb;border-radius:12px;padding:16px;display:inline-block;min-width:250px;margin-bottom:20px;text-align:left">
        <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#aaa;margin-bottom:6px">XÁC NHẬN CHECK-IN</div>
        <div style="font-size:18px;font-weight:800">${p.name}</div>
        <div style="font-size:13px;color:#185FA5;margin-top:4px">Mã: <span style="font-family:'JetBrains Mono',monospace">${st.code}</span></div>
        ${st.type==='comp'?`<div style="margin-top:6px"><span class="badge b-purple">Đi kèm: ${g.name}</span></div>`:''}
        ${g.note?`<div style="margin-top:6px"><span class="badge b-amber">${g.note}</span></div>`:''}
      </div>
      <div style="font-size:13px;color:#888;margin-bottom:14px">🔢 Nhập 4 số cuối số điện thoại để xác nhận</div>
      <input id="ci_ph" type="tel" maxlength="4" placeholder="— — — —"
        style="width:180px;padding:16px;text-align:center;letter-spacing:10px;font-size:26px;font-family:'JetBrains Mono',monospace;border:2px solid #dde4f0;border-radius:12px;display:block;margin:0 auto"
        onkeydown="if(event.key==='Enter')confirmPhone()"/>
      <div id="ph_err" class="err" style="text-align:center;margin-top:8px"></div>
      <div style="margin-top:16px;display:flex;gap:8px;justify-content:center">
        <button class="btn" onclick="cancelCI()">← Quay lại</button>
        <button class="btn green" onclick="confirmPhone()" style="padding:10px 28px">✅ Xác nhận</button>
      </div>
    </div>
  </div>`;
}

function rCIDone(){
  const st=S.ciState;const p=st.person;const g=st.guest;
  const ev=db.events.find(e=>e.id===g.eventId);
  return`<div class="ci-screen"><div class="big-result">
    <div class="icon">🎉</div>
    <div style="font-size:22px;font-weight:800;color:#0C447C;margin-bottom:10px">Check-in thành công!</div>
    <div style="font-size:17px;font-weight:600;color:#185FA5;margin-bottom:4px">${p.name}</div>
    ${st.type==='comp'?`<div style="margin-bottom:4px"><span class="badge b-purple">Đi kèm: ${g.name}</span></div>`:''}
    <div style="font-size:13px;color:#aaa;margin-bottom:4px">${ev?.name||''}</div>
    ${st.type==='guest'&&(g.companions||[]).length?`<div style="font-size:12px;color:#BA7517;margin-top:10px;padding:8px 16px;background:#FFFBEB;border-radius:8px;display:inline-block">⚠️ ${g.companions.length} người đi kèm cần check-in riêng</div>`:''}
    ${g.note?`<div style="margin-top:10px;display:inline-block"><span class="badge b-amber">${g.note}</span></div>`:''}
    <div style="font-size:12px;color:#bbb;margin-top:12px">Ghi nhận lúc: ${fmtDT(p.checkinTime)} · BTC: ${p.checkinBy||'—'}</div>
    <div style="margin-top:24px">
      <button class="btn blue" onclick="nextCI()" style="padding:12px 32px;font-size:15px">📷 Scan vé tiếp theo</button>
    </div>
  </div></div>`;
}

function rCIErr(){
  return`<div class="ci-screen"><div class="big-result">
    <div class="icon">❌</div>
    <div style="font-size:18px;font-weight:700;color:#a32d2d;margin-bottom:8px">Xác minh thất bại</div>
    <div style="font-size:13px;color:#888;max-width:280px;margin:0 auto">${S.ciState.msg||'Thông tin không khớp'}</div>
    <div style="margin-top:20px"><button class="btn" onclick="cancelCI()" style="padding:10px 24px">← Thử lại</button></div>
  </div></div>`;
}

/* ============================================================
   ACTIONS
   ============================================================ */
function setTab(t){S.tab=t;R()}
function openGM(eid){
  const ev=db.events.find(e=>e.id===eid);if(!ev)return;
  if(ev.eventPw&&!S.unlockedEvs[eid]){S.evUnlockTarget=eid;S.modal='ev_unlock';R();return}
  S.selEv=eid;S.tab='guests';S.search='';S.filter='all';R()}
function pickEv(v){
  if(!v){S.selEv=null;S.search='';S.filter='all';R();return}
  const ev=db.events.find(e=>e.id===v);if(!ev)return;
  if(ev.eventPw&&!S.unlockedEvs[v]){S.evUnlockTarget=v;S.modal='ev_unlock';R();return}
  S.selEv=v;S.search='';S.filter='all';R()}
function setSrch(v){S.search=v;R()}
function setFil(v){S.filter=v;R()}
function openM(m){S.modal=m;R()}
function openEdit(id){S.editGid=id;S.modal='edit_pw';R()}
function openDel(id){S.delGid=id;S.modal='del_pw';R()}
function openTickets(id){S.ticketGid=id;S.modal='tickets';R()}
function closeM(){S.modal=null;S.editGid=null;S.delGid=null;S.cpTicket=null;S.cpEdit=null;S.cpDel=null;S.cpAdd=null;S.adminCI=null;S.cancelTarget=null;S.evUnlockTarget=null;S.editEvId=null;S.importData=null;R()}

function openEditEv(id){
  const ev=db.events.find(e=>e.id===id);if(!ev)return;
  if(isEvLocked(ev)){alert('Sự kiện đã kết thúc. Không thể chỉnh sửa thông tin sự kiện.');return;}
  if(ev.eventPw&&!S.unlockedEvs[id]){S.evUnlockTarget=id;S.modal='ev_unlock';R();return;}
  S.editEvId=id;S.modal='edit_ev';R();
}

function openCpTicket(gid,cpId){S.cpTicket={gid,cpId};S.modal='cp_ticket';R();setTimeout(()=>mkCpQR(),120)}
function openCpEdit(gid,cpId){S.cpEdit={gid,cpId};S.modal='cp_edit';R()}
function openCpDel(gid,cpId){S.cpDel={gid,cpId};S.modal='cp_del';R()}
function openAddComp(gid){S.cpAdd=gid;S.modal='cp_add';R()}

function openCancel(gid,type,cpId){S.cancelTarget={gid,type,cpId:cpId||null};S.modal='cancel';R()}
function doCancel(){
  const {gid,type,cpId}=S.cancelTarget||{};
  const g=db.guests.find(x=>x.id===gid);if(!g)return;
  if(isEvLocked(getEvById(g.eventId))){alert('Sự kiện đã kết thúc. Không thể thay đổi.');closeM();return;}
  const note=(document.getElementById('cancel_note')?.value||'').trim();
  if(type==='c'){
    const c=(g.companions||[]).find(x=>x.id===cpId);
    if(c){c.cancelled=true;c.cancelNote=note;c.checkedIn=false;c.checkinTime=null}
  } else {
    g.cancelled=true;g.cancelNote=note;g.checkedIn=false;g.checkinTime=null;
    (g.companions||[]).forEach(c=>{c.cancelled=true;c.cancelNote=note?`[Theo KH chính] ${note}`:'Theo KH chính';c.checkedIn=false;c.checkinTime=null});
  }
  save();S.modal=null;S.cancelTarget=null;R();}
function undoCancel(gid,type,cpId){
  const g=db.guests.find(x=>x.id===gid);if(!g)return;
  if(type==='c'){
    const c=(g.companions||[]).find(x=>x.id===cpId);
    if(c){c.cancelled=false;c.cancelNote=''}
  } else {
    g.cancelled=false;g.cancelNote='';
    (g.companions||[]).forEach(c=>{c.cancelled=false;c.cancelNote=''});
  }
  save();R();}
function goCI(){S.view='checkin';S.ciOk=false;S.ciEv=null;S.ciOp=null;S.ciState=null;R()}
function backAdmin(){S.view='admin';S.ciOk=false;S.ciState=null;R()}
function lockOut(){S.ciOk=false;S.ciOp=null;S.ciState=null;R()}
function cancelCI(){S.ciState=null;R()}
function nextCI(){S.ciState=null;R()}

function addBR(){const w=document.getElementById('btc_w');if(!w)return;const i=w.querySelectorAll('.btc-r').length;
  const d=document.createElement('div');d.className='btc-r';d.id='br_'+i;
  d.innerHTML=`<input placeholder="Mã NV" id="bc_${i}" style="max-width:110px;font-family:'JetBrains Mono',monospace;text-transform:uppercase"/>
    <input placeholder="Họ tên BTC" id="bn_${i}"/>
    <button class="btn xs red" onclick="rmBR(${i})" style="flex-shrink:0">✕</button>`;
  w.appendChild(d)}
function rmBR(i){const r=document.getElementById('br_'+i);if(r)r.remove()}
function getBMs(){const w=document.getElementById('btc_w');if(!w)return[];const ms=[];
  w.querySelectorAll('.btc-r').forEach(r=>{const c=(r.querySelector('input:first-child')?.value||'').toUpperCase().trim();const n=(r.querySelector('input:nth-child(2)')?.value||'').trim();if(c&&n)ms.push({code:c,name:n})});return ms}

function addCR(){const w=document.getElementById('cp_w');if(!w)return;const i=w.querySelectorAll('.cp-r').length;
  const d=document.createElement('div');d.id='cr_'+i;d.className='cp-r';
  d.innerHTML=`<div class="g2" style="margin-bottom:0">
    <div class="fg" style="margin-bottom:0"><label>Tên đi kèm ${i+1}</label><input id="cn_${i}" placeholder="Họ và tên"/></div>
    <div class="fg" style="margin-bottom:0"><label>SĐT</label><input id="cp_${i}" type="tel" placeholder="09xxxxxxxx"/></div>
  </div><button class="btn xs red" onclick="rmCR(${i})" style="margin-top:6px">Xoá đi kèm này</button>`;
  document.getElementById('cp_w').appendChild(d)}
function rmCR(i){const r=document.getElementById('cr_'+i);if(r)r.remove()}
function getComps(mode){
  const isEdit=(mode==='edit');
  const w=document.getElementById(isEdit?'ecp_w':'cp_w');
  if(!w)return[];
  const cs=[];
  w.querySelectorAll('.cp-r').forEach(r=>{
    const idx=r.id.replace(/[^0-9]/g,'');
    const pfx=isEdit?'ec':'c';
    const n=(document.getElementById(pfx+'n_'+idx)?.value||'').trim();
    const p=(document.getElementById(pfx+'p_'+idx)?.value||'').trim();
    if(n)cs.push({name:n,phone:p});
  });
  return cs;
}

function saveEv(){
  const isEdit=S.modal==='edit_ev';
  const name=document.getElementById('ev_n')?.value?.trim();
  const date=document.getElementById('ev_d')?.value;
  const team=document.getElementById('ev_t')?.value?.trim();
  const venue=document.getElementById('ev_v')?.value?.trim();
  const pwNew=(document.getElementById('ev_pw')?.value||'').trim();
  const pwNew2=(document.getElementById('ev_pw2')?.value||'').trim();
  const bms=getBMs();
  if(!name){alert('Vui lòng nhập tên sự kiện');return}
  if(!bms.length){alert('Cần ít nhất 1 thành viên BTC');return}
  const errEl=document.getElementById('ev_pw_err');

  if(isEdit){
    if(pwNew&&pwNew!==pwNew2){if(errEl)errEl.textContent='⚠️ Mật khẩu nhập lại không khớp';return}
    const idx=db.events.findIndex(e=>e.id===S.editEvId);
    if(idx<0)return;
    const existing=db.events[idx];
    const eventPw=pwNew||existing.eventPw;
    db.events[idx]={...existing,name,date,team,venue,eventPw,btcMembers:bms};
    if(pwNew)S.unlockedEvs[S.editEvId]=true;
    save();S.modal=null;S.editEvId=null;R();
  } else {
    if(!pwNew){if(errEl)errEl.textContent='⚠️ Vui lòng đặt mật khẩu cho sự kiện';return}
    if(pwNew!==pwNew2){if(errEl)errEl.textContent='⚠️ Mật khẩu nhập lại không khớp';return}
    const newEv={id:uid(),name,date,team,venue,eventPw:pwNew,btcMembers:bms,createdAt:Date.now()};
    db.events.push(newEv);
    S.unlockedEvs[newEv.id]=true;
    S.selEv=newEv.id;save();S.modal=null;S.tab='guests';R();
  }
}

function delEv(id){if(!confirm('Xoá sự kiện này? Toàn bộ khách cũng bị xoá.'))return;
  db.events=db.events.filter(e=>e.id!==id);db.guests=db.guests.filter(g=>g.eventId!==id);
  if(S.selEv===id)S.selEv=null;save();sbDel('oh_events',id);R()}

function saveG(){
  const eventId=document.getElementById('g_ev')?.value;
  const name=document.getElementById('g_n')?.value?.trim();
  const phone=document.getElementById('g_ph')?.value?.trim();
  const prmName=document.getElementById('g_prm')?.value?.trim();
  const tcbRegion=document.getElementById('g_reg')?.value?.trim();
  const unit=document.getElementById('g_unit')?.value?.trim();
  const sihName=document.getElementById('g_sih')?.value?.trim();
  const note=document.getElementById('g_note')?.value?.trim();
  if(!name){alert('Vui lòng nhập họ tên KH');return}
  if(!eventId){alert('Vui lòng chọn sự kiện');return}
  if(isEvLocked(getEvById(eventId))){alert('Sự kiện đã kết thúc. Không thể thêm/sửa khách.');closeM();return;}
  const rawComps=getComps('add');

  if(S.modal==='edit_g'&&S.editGid){
    const idx=db.guests.findIndex(g=>g.id===S.editGid);
    if(idx>-1){
      const ex=db.guests[idx];
      const oldComps=ex.companions||[];
      const newComps=rawComps.map(rc=>{const match=oldComps.find(oc=>oc.name===rc.name&&oc.code);
        if(match)return{...match,phone:rc.phone};
        return{id:uid(),name:rc.name,phone:rc.phone,code:genCode(eventId),checkedIn:false,checkinTime:null,checkinBy:null}});
      db.guests[idx]={...ex,eventId,name,phone,prmName,tcbRegion,unit,sihName,note,companions:newComps};
      S.ticketGid=S.editGid;
    }
  } else {
    const guestCode=genCode(eventId);
    const companions=rawComps.map(rc=>({id:uid(),name:rc.name,phone:rc.phone,code:genCode(eventId),checkedIn:false,checkinTime:null,checkinBy:null}));
    const ng={id:uid(),eventId,guestCode,name,phone,prmName,tcbRegion,unit,sihName,note,companions,checkedIn:false,checkinTime:null,checkinBy:null,createdAt:Date.now()};
    db.guests.push(ng);
    S.ticketGid=ng.id;
  }
  S.selEv=eventId;save();S.editGid=null;S.modal='tickets';R();
}

function chkEditPw(){
  const pw=document.getElementById('epw')?.value||'';
  if(pw===ADMIN_PW){S.modal='edit_form';R()}
  else{const el=document.getElementById('epw_err');if(el)el.textContent='⚠️ Mật khẩu không đúng.'}}

function doEdit(){
  const g=db.guests.find(x=>x.id===S.editGid);if(!g)return;
  const idx=db.guests.indexOf(g);
  const name=document.getElementById('eg_n')?.value?.trim()||g.name;
  const phone=document.getElementById('eg_ph')?.value?.trim()||g.phone;
  const prmName=document.getElementById('eg_prm')?.value?.trim();
  const tcbRegion=document.getElementById('eg_reg')?.value?.trim();
  const unit=document.getElementById('eg_unit')?.value?.trim();
  const sihName=document.getElementById('eg_sih')?.value?.trim();
  const note=document.getElementById('eg_note')?.value?.trim();
  const updComps=(g.companions||[]).map((c,i)=>({
    ...c,
    name:document.getElementById('ecn_'+i)?.value?.trim()||c.name,
    phone:document.getElementById('ecp_'+i)?.value?.trim()||c.phone
  }));
  db.guests[idx]={...g,name,phone,prmName,tcbRegion,unit,sihName,note,companions:updComps};
  save();S.modal=null;S.editGid=null;R()}

function doDel(){
  const pw=document.getElementById('dpw')?.value||'';
  if(pw!==ADMIN_PW){const el=document.getElementById('dpw_err');if(el)el.textContent='⚠️ Mật khẩu không đúng.';return}
  const gid=S.delGid;
  db.guests=db.guests.filter(g=>g.id!==gid);save();sbDel('oh_guests',gid);S.modal=null;S.delGid=null;R()}

function doCpEdit(){
  const {gid,cpId}=S.cpEdit||{};
  const g=db.guests.find(x=>x.id===gid);if(!g)return;
  const idx=db.guests.indexOf(g);
  const cpIdx=(g.companions||[]).findIndex(x=>x.id===cpId);if(cpIdx<0)return;
  const name=document.getElementById('cpe_n')?.value?.trim();
  const phone=document.getElementById('cpe_ph')?.value?.trim();
  if(!name){alert('Vui lòng nhập họ tên');return}
  db.guests[idx].companions[cpIdx]={...db.guests[idx].companions[cpIdx],name,phone};
  save();S.modal=null;S.cpEdit=null;R()}

function doCpDel(){
  const pw=document.getElementById('cpdpw')?.value||'';
  if(pw!==ADMIN_PW){const el=document.getElementById('cpdpw_err');if(el)el.textContent='⚠️ Mật khẩu không đúng.';return}
  const {gid,cpId}=S.cpDel||{};
  const gIdx=db.guests.findIndex(x=>x.id===gid);if(gIdx<0)return;
  db.guests[gIdx].companions=(db.guests[gIdx].companions||[]).filter(x=>x.id!==cpId);
  save();S.modal=null;S.cpDel=null;R()}

function doCpAdd(){
  const gid=S.cpAdd;
  const gIdx=db.guests.findIndex(x=>x.id===gid);if(gIdx<0)return;
  const name=document.getElementById('cpa_n')?.value?.trim();
  const phone=document.getElementById('cpa_ph')?.value?.trim();
  if(!name){alert('Vui lòng nhập họ tên');return}
  const newCp={id:uid(),name,phone,code:genCode(db.guests[gIdx].eventId),checkedIn:false,checkinTime:null,checkinBy:null};
  if(!db.guests[gIdx].companions)db.guests[gIdx].companions=[];
  db.guests[gIdx].companions.push(newCp);
  save();
  S.cpTicket={gid,cpId:newCp.id};S.cpAdd=null;S.modal='cp_ticket';R();
  setTimeout(()=>mkCpQR(),120)}

function mkCpQR(){
  const {gid,cpId}=S.cpTicket||{};
  const g=db.guests.find(x=>x.id===gid);
  const cp=(g?.companions||[]).find(x=>x.id===cpId);
  if(!cp)return;
  const el=document.getElementById('cp_tqr');if(!el)return;
  el.innerHTML='';
  try{new QRCode(el,{text:qrUrl(cp.code),width:160,height:160,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M})}
  catch(e){el.innerHTML='<div style="font-size:11px;color:#aaa">QR error</div>'}}

function dlCpTicket(){
  const {gid,cpId}=S.cpTicket||{};
  const g=db.guests.find(x=>x.id===gid);
  const cp=(g?.companions||[]).find(x=>x.id===cpId);
  if(!g||!cp)return;
  const ev=db.events.find(e=>e.id===g.eventId);
  const w=window.open('','_blank','width=440,height=560');
  w.document.write(`<!DOCTYPE html><html><head>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;background:#f5f7fb;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px}
    .tk{background:#fff;border:2px solid #e8eaf0;border-radius:16px;padding:28px 24px 20px;width:320px;text-align:center}
    .hd{font-size:10px;font-weight:700;letter-spacing:2px;color:#bbb;margin-bottom:10px}
    .ev{font-size:11px;color:#bbb;margin-bottom:3px}.name{font-size:20px;font-weight:800;margin-bottom:4px}
    .role{font-size:11px;font-weight:600;background:#F5F3FF;color:#6D28D9;padding:3px 10px;border-radius:10px;display:inline-block;margin-bottom:14px}
    .code{font-family:monospace;font-size:18px;font-weight:700;letter-spacing:3px;margin:4px 0 12px}
    .foot{font-size:10px;color:#ccc;border-top:1px dashed #eee;padding-top:8px;line-height:1.7}
    canvas,img{display:block;margin:0 auto;padding:10px;border:1px solid #eee;border-radius:8px}
    .btn{margin-top:16px;padding:9px 24px;border:1.5px solid #dde4f0;border-radius:8px;background:#fff;font-size:13px;cursor:pointer}
    @media print{.btn{display:none}body{background:#fff}}</style></head><body>
    <div class="tk"><div class="hd">VÉ THAM DỰ SỰ KIỆN</div>
      <div class="ev">${ev?.name||''}</div>
      <div class="ev" style="margin-bottom:12px">${fmtD(ev?.date)}${ev?.venue?' · '+ev.venue:''}</div>
      <div class="name">${cp.name}</div>
      <div class="role">Đi kèm: ${g.name}</div>
      <div id="qr"></div>
      <div class="code">${cp.code}</div>
      <div class="foot">Vui lòng xuất trình vé tại cổng check-in<br>Vé chỉ có giá trị cho 01 người</div>
    </div>
    <button class="btn" onclick="window.print()">🖨️ Lưu / In vé này</button>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
    <script>setTimeout(()=>new QRCode(document.getElementById('qr'),{text:'${BASE_URL}/?code='+encodeURIComponent('${cp.code}'),width:160,height:160,correctLevel:QRCode.CorrectLevel.M}),100)<\/script>
  </body></html>`);}

function togCI(gid,type,cid){
  const g=db.guests.find(x=>x.id===gid);if(!g)return;
  const ev=getEvById(g.eventId);
  if(isEvLocked(ev)){alert('Sự kiện đã kết thúc. Không thể thay đổi trạng thái check-in.');return;}
  const person=type==='c'?(g.companions||[]).find(x=>x.id===cid):g;
  if(!person)return;
  if(person.cancelled){alert('Khách đã cancel. Vui lòng nhấn " Huỷ Cancel" trước khi check-in.');return;}
  if(person.checkedIn){
    if(!confirm(`Huỷ check-in của ${person.name}?`))return;
    person.checkedIn=false;person.checkinTime=null;person.checkinBy=null;
    save();R();return;
  }
  S.adminCI={gid,type,cpId:cid||null};S.modal='admin_ci';R();
  setTimeout(()=>{const el=document.getElementById('aci_ph');if(el)el.focus()},80);
}

function doAdminCI(){
  const {gid,type,cpId}=S.adminCI||{};
  const g=db.guests.find(x=>x.id===gid);if(!g)return;
  if(isEvLocked(getEvById(g.eventId))){alert('Sự kiện đã kết thúc. Không thể check-in.');closeM();return;}
  const person=type==='c'?(g.companions||[]).find(x=>x.id===cpId):g;
  if(!person)return;
  const last4=person.phone?person.phone.replace(/\D/g,'').slice(-4):'';
  if(last4){
    const val=(document.getElementById('aci_ph')?.value||'').trim();
    if(val!==last4){
      const el=document.getElementById('aci_err');
      if(el)el.textContent='⚠️ 4 số cuối không khớp. Vui lòng thử lại.';
      const inp=document.getElementById('aci_ph');if(inp){inp.value='';inp.focus();}
      return;
    }
  }
  person.checkedIn=true;person.checkinTime=new Date().toISOString();person.checkinBy='admin';
  save();S.modal=null;S.adminCI=null;R();
}

function mkQRs(){
  const g=db.guests.find(x=>x.id===S.ticketGid);if(!g)return;
  const all=[g.guestCode,...(g.companions||[]).map(c=>c.code)];
  all.forEach((code,idx)=>{
    const el=document.getElementById('tqr_'+idx);
    if(!el)return;el.innerHTML='';
    try{new QRCode(el,{text:qrUrl(code),width:160,height:160,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M})}
    catch(e){el.innerHTML='<div style="font-size:11px;color:#aaa">QR error</div>'}
  });
}

function dlTicket(idx,name,code,role){
  const g=db.guests.find(x=>x.id===S.ticketGid);if(!g)return;
  const ev=db.events.find(e=>e.id===g.eventId);
  const w=window.open('','_blank','width=440,height=580');
  w.document.write(`<!DOCTYPE html><html><head><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Be Vietnam Pro',sans-serif;background:#f5f7fb;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px}
    @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&family=JetBrains+Mono:wght@600&display=swap');
    .ticket{background:#fff;border:2px solid #e8eaf0;border-radius:16px;padding:28px 24px 20px;width:320px;text-align:center}
    .hd{font-size:10px;font-weight:700;letter-spacing:2px;color:#bbb;margin-bottom:10px}
    .ev{font-size:11px;color:#bbb;margin-bottom:3px}
    .name{font-size:20px;font-weight:800;color:#1a1a2e;margin-bottom:4px}
    .role{font-size:11px;font-weight:600;margin-bottom:14px;display:inline-block;padding:3px 10px;border-radius:10px;background:#EFF6FF;color:#185FA5}
    .qr-box{display:inline-block;padding:10px;border:1px solid #eee;border-radius:10px;margin-bottom:8px}
    .code{font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:600;letter-spacing:3px;margin:4px 0 12px}
    .foot{font-size:10px;color:#ccc;border-top:1px dashed #eee;padding-top:8px;line-height:1.7}
    .dl-btn{margin-top:16px;padding:9px 24px;border:1.5px solid #dde4f0;border-radius:8px;background:#fff;font-size:13px;cursor:pointer;font-family:sans-serif;font-weight:500}
    .dl-btn:hover{background:#f4f7fb}
    @media print{.dl-btn{display:none}body{background:#fff}}
  </style></head><body>
    <div class="ticket" id="tk">
      <div class="hd">VÉ THAM DỰ SỰ KIỆN</div>
      <div class="ev">${ev?.name||''}</div>
      <div class="ev" style="margin-bottom:12px">${fmtD(ev?.date)}${ev?.venue?' · '+ev.venue:''}</div>
      <div class="name">${name}</div>
      <div class="role">${role}</div>
      <div class="qr-box" id="qr_s"></div>
      <div class="code">${code}</div>
      <div class="foot">Vui lòng xuất trình vé tại cổng check-in<br>Vé chỉ có giá trị cho 01 người</div>
    </div>
    <button class="dl-btn" onclick="window.print()">🖨️ Lưu / In vé này</button>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
    <script>setTimeout(()=>{new QRCode(document.getElementById('qr_s'),{text:'${BASE_URL}/?code='+encodeURIComponent('${code}'),width:160,height:160,correctLevel:QRCode.CorrectLevel.M})},100)<\/script>
  </body></html>`)}

function printAll(){
  const g=db.guests.find(x=>x.id===S.ticketGid);if(!g)return;
  const ev=db.events.find(e=>e.id===g.eventId);
  const all=[{name:g.name,code:g.guestCode,role:'Khách mời chính'},
    ...(g.companions||[]).map(c=>({name:c.name,code:c.code,role:'Đi kèm: '+g.name}))];
  const w=window.open('','_blank','width=560,height:700');
  w.document.write(`<!DOCTYPE html><html><head><style>
    @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&family=JetBrains+Mono:wght@600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}body{font-family:'Be Vietnam Pro',sans-serif;padding:20px;background:#f5f7fb}
    .ticket{background:#fff;border:2px solid #e8eaf0;border-radius:14px;padding:24px 20px 16px;text-align:center;margin-bottom:16px;page-break-inside:avoid}
    .hd{font-size:10px;font-weight:700;letter-spacing:2px;color:#bbb;margin-bottom:8px}
    .ev{font-size:11px;color:#bbb;margin-bottom:3px}
    .name{font-size:20px;font-weight:800;color:#1a1a2e;margin-bottom:4px}
    .role{font-size:11px;font-weight:600;margin-bottom:14px;display:inline-block;padding:3px 10px;border-radius:10px;background:#EFF6FF;color:#185FA5}
    .code{font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:600;letter-spacing:3px;margin:4px 0 12px}
    .foot{font-size:10px;color:#ccc;border-top:1px dashed #eee;padding-top:8px;line-height:1.7}
    canvas,img{display:block;margin:8px auto;width:160px;height:160px}
    @media print{body{background:#fff}}
  </style></head><body>
    ${all.map(tk=>`<div class="ticket">
      <div class="hd">VÉ THAM DỰ SỰ KIỆN</div>
      <div class="ev">${ev?.name||''}</div>
      <div class="ev" style="margin-bottom:12px">${fmtD(ev?.date)}${ev?.venue?' · '+ev.venue:''}</div>
      <div class="name">${tk.name}</div>
      <div class="role">${tk.role}</div>
      <div id="pqr_${tk.code}" style="display:inline-block;padding:8px;border:1px solid #eee;border-radius:8px"></div>
      <div class="code">${tk.code}</div>
      <div class="foot">Vui lòng xuất trình vé tại cổng check-in<br>Vé chỉ có giá trị cho 01 người</div>
    </div>`).join('')}
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
    <script>
      const _base='${BASE_URL}';
      ${JSON.stringify(all.map(t=>t.code))}.forEach(code=>{
        const el=document.getElementById('pqr_'+code);
        if(el)new QRCode(el,{text:_base+'?code='+encodeURIComponent(code),width:160,height:160,correctLevel:QRCode.CorrectLevel.M});
      });
      setTimeout(()=>window.print(),700);
    <\/script>
  </body></html>`)}

function tryUnlock(){
  const evSel=document.getElementById('lock_ev');S.ciEv=evSel?.value||S.ciEv;
  if(!S.ciEv){document.getElementById('lock_err').textContent='⚠️ Vui lòng chọn sự kiện';return}
  const ev=db.events.find(e=>e.id===S.ciEv);if(!ev){document.getElementById('lock_err').textContent='Sự kiện không tồn tại';return}
  const code=(document.getElementById('lock_c')?.value||'').toUpperCase().trim();
  if(!code){document.getElementById('lock_err').textContent='⚠️ Vui lòng nhập mã nhân viên';return}
  const member=(ev.btcMembers||[]).find(m=>m.code===code);
  if(!member){document.getElementById('lock_err').textContent='⚠️ Mã không nằm trong danh sách BTC của sự kiện này';return}
  S.ciOk=true;S.ciOp=member;S.ciState=null;R()}

function startCI(){
  const code=(document.getElementById('ci_in')?.value||'').toUpperCase().trim();
  if(!code){document.getElementById('ci_err').textContent='⚠️ Vui lòng nhập mã';return}
  const found=findCode(S.ciEv,code);
  if(!found){document.getElementById('ci_err').textContent='⚠️ Không tìm thấy mã trong sự kiện này';return}
  const person=found.person;
  if(person.checkedIn){document.getElementById('ci_err').textContent='⚠️ Đã check-in lúc '+fmtDT(person.checkinTime);return}
  if(!person.phone){
    person.checkedIn=true;person.checkinTime=new Date().toISOString();person.checkinBy=S.ciOp?.code||'btc';save();
    S.ciState={step:'done',type:found.type,guest:found.guest,person,code};R();return}
  S.ciState={step:'verify',type:found.type,guest:found.guest,person,code};R()}

function confirmPhone(){
  const val=(document.getElementById('ci_ph')?.value||'').trim();
  const st=S.ciState;const p=st.person;
  const last4=p.phone?p.phone.replace(/\D/g,'').slice(-4):'';
  if(!last4){finishCI();return}
  if(val===last4){finishCI()}
  else{const el=document.getElementById('ph_err');if(el)el.textContent='⚠️ 4 số cuối không khớp. Vui lòng thử lại.';
    const inp=document.getElementById('ci_ph');if(inp){inp.value='';inp.focus()}}}

function finishCI(){
  const st=S.ciState;
  const g=db.guests.find(x=>x.id===st.guest.id);if(!g){S.ciState={step:'err',msg:'Lỗi hệ thống'};R();return}
  if(st.type==='guest'){g.checkedIn=true;g.checkinTime=new Date().toISOString();g.checkinBy=S.ciOp?.code||'btc'}
  else{const c=(g.companions||[]).find(x=>x.id===st.person.id);if(c){c.checkedIn=true;c.checkinTime=new Date().toISOString();c.checkinBy=S.ciOp?.code||'btc'}}
  save();S.ciState={step:'done',type:st.type,guest:g,person:st.type==='guest'?g:(g.companions||[]).find(x=>x.id===st.person.id),code:st.code};R()}

function expCSV(){
  const ev=db.events.find(e=>e.id===S.selEv);
  const rows=[['STT','Loại','Mã','Họ tên','SĐT','KH gốc (nếu đi kèm)','PRM','Vùng TCB','Đơn vị','SIH','Note','Trạng thái','Giờ check-in','BTC','Lý do cancel']];
  let n=0;
  egs(S.selEv).forEach(g=>{n++;
    const gStatus=g.cancelled?'Cancel':g.checkedIn?'Đã vào':'Chưa';
    rows.push([n,'KH chính',g.guestCode,g.name,g.phone||'','',g.prmName||'',g.tcbRegion||'',g.unit||'',g.sihName||'',g.note||'',gStatus,g.checkinTime?fmtDT(g.checkinTime):'',g.checkinBy||'',g.cancelNote||'']);
    (g.companions||[]).forEach(c=>{n++;
      const cStatus=c.cancelled?'Cancel':c.checkedIn?'Đã vào':'Chưa';
      rows.push([n,'Đi kèm',c.code,c.name,c.phone||'',g.name,g.prmName||'',g.tcbRegion||'','','','',cStatus,c.checkinTime?fmtDT(c.checkinTime):'',c.checkinBy||'',c.cancelNote||''])})});
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
  a.download=`checkin_${(ev?.name||'').replace(/[^a-zA-Z0-9]/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`;a.click()}


/* ============================================================
   NEW FEATURES LOGIC: EXCEL EXPORT/IMPORT & ALL QR ZIP DOWNLOAD
   ============================================================ */

/* 1. Tải file Mẫu Excel đúng cấu trúc quy định */
function downloadExcelTemplate() {
  const headers = [
    ["Loại Khách (Gõ 'Main' hoặc 'Companion')", "Họ và Tên (*)", "Số Điện Thoại", "Tên PRM (Sales TCB)", "Vùng TCB", "Đơn vị (CN/PGD)", "Tên SIH (Sales OH)", "Note / Lưu ý"]
  ];
  const sampleData = [
    ["Main", "Nguyễn Văn A", "0901234567", "Lê PRM", "Vùng 1", "CN Sài Gòn", "Trần SIH", "Khách VIP bàn đầu"],
    ["Companion", "Nguyễn Văn B (Đi kèm A)", "0907654321", "", "", "", "", "Đi cùng xe ông A"],
    ["Main", "Phạm Thị C", "0911223344", "Nguyễn PRM", "Vùng 2", "CN Hà Nội", "Vũ SIH", ""]
  ];
  const ws = XLSX.utils.aoa_to_sheet(headers.concat(sampleData));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, "OneHousing_Template_ImportKhach.xlsx");
}

/* 2. Kích hoạt nút chọn File */
function triggerExcelImport() {
  document.getElementById('excel_file_input').click();
}

/* 3. Đọc dữ liệu từ File Excel đã tải lên và hiển thị màn hình Preview */
function handleExcelImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, {header: 1});

      if (rawRows.length <= 1) {
        alert("File Excel trống hoặc thiếu dữ liệu!");
        return;
      }

      const parsedGuests = [];
      // Bỏ qua dòng tiêu đề thứ 0
      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row[1] || String(row[1]).trim() === "") continue; // Bỏ qua nếu ko có tên

        parsedGuests.push({
          type: (String(row[0]).trim().toLowerCase() === 'companion') ? 'Companion' : 'Main',
          name: String(row[1]).trim(),
          phone: row[2] ? String(row[2]).trim() : '',
          prmName: row[3] ? String(row[3]).trim() : '',
          tcbRegion: row[4] ? String(row[4]).trim() : '',
          unit: row[5] ? String(row[5]).trim() : '',
          sihName: row[6] ? String(row[6]).trim() : '',
          note: row[7] ? String(row[7]).trim() : ''
        });
      }

      if (parsedGuests.length === 0) {
        alert("Không tìm thấy dữ liệu khách hàng hợp lệ trong file Excel!");
        return;
      }

      S.importData = parsedGuests;
      S.modal = 'import_preview';
      R();
    } catch(err) {
      alert("Đã xảy ra lỗi khi đọc file Excel! Chi tiết: " + err.message);
    }
    event.target.value = ''; // Reset input file
  };
  reader.readAsArrayBuffer(file);
}

/* 4. Lưu dữ liệu đã duyệt từ Excel vào cơ sở dữ liệu (Có logic gom nhóm Companion dưới Main liền trước) */
function commitExcelImport() {
  if (!S.selEv) return;
  const eventId = S.selEv;
  const rawList = S.importData || [];
  
  let currentMainGuest = null;

  rawList.forEach(item => {
    if (item.type === 'Main') {
      const guestCode = genCode(eventId);
      currentMainGuest = {
        id: uid(),
        eventId: eventId,
        guestCode: guestCode,
        name: item.name,
        phone: item.phone,
        prmName: item.prmName,
        tcbRegion: item.tcbRegion,
        unit: item.unit,
        sihName: item.sihName,
        note: item.note,
        companions: [],
        checkedIn: false,
        checkinTime: null,
        checkinBy: null,
        createdAt: Date.now()
      };
      db.guests.push(currentMainGuest);
    } else {
      // Nếu dòng là Companion, tự động gom vào nhóm của KH Main xuất hiện liền trước nó
      const companionObj = {
        id: uid(),
        name: item.name,
        phone: item.phone,
        code: genCode(eventId),
        checkedIn: false,
        checkinTime: null,
        checkinBy: null
      };

      if (currentMainGuest) {
        currentMainGuest.companions.push(companionObj);
      } else {
        // Trường hợp file Excel xếp dòng Companion lên đầu tiên khi chưa có Main nào
        const guestCode = genCode(eventId);
        currentMainGuest = {
          id: uid(),
          eventId: eventId,
          guestCode: guestCode,
          name: item.name + " (Chính)",
          phone: item.phone,
          prmName: item.prmName,
          tcbRegion: item.tcbRegion,
          unit: item.unit,
          sihName: item.sihName,
          note: "[Hệ thống tự dịch chuyển từ Companion độc lập] " + item.note,
          companions: [],
          checkedIn: false,
          checkinTime: null,
          checkinBy: null,
          createdAt: Date.now()
        };
        db.guests.push(currentMainGuest);
      }
    }
  });

  save();
  alert(`🎉 Đã import thành công danh sách khách mời từ Excel vào hệ thống!`);
  closeM();
}

/* 5. Tạo và Tải xuống Toàn bộ QR Code dưới dạng file nén .ZIP hàng loạt bằng JSZip */
async function downloadAllQRsZip() {
  const ev = db.events.find(e => e.id === S.selEv);
  const guests = egs(S.selEv);
  if (!guests.length) {
    alert("Sự kiện này chưa có khách mời nào để xuất QR!");
    return;
  }

  const zipBtn = document.getElementById('zip_btn');
  const oldText = zipBtn.textContent;
  zipBtn.textContent = "⏳ Đang khởi tạo bộ QR...";
  zipBtn.disabled = true;

  // Tạo một thẻ div ẩn tạm thời để render mã QR tĩnh bằng qrcode.js
  const hiddenRenderDiv = document.createElement('div');
  hiddenRenderDiv.style.display = 'none';
  document.body.appendChild(hiddenRenderDiv);

  const zip = new JSZip();

  // Helper chuyển đổi QR code từ DOM element sang dạng chuỗi Blob/DataURL
  const generateQrBase64 = (url) => {
    return new Promise((resolve) => {
      hiddenRenderDiv.innerHTML = '';
      const qrcode = new QRCode(hiddenRenderDiv, {
        text: url,
        width: 250,
        height: 250,
        correctLevel: QRCode.CorrectLevel.M
      });
      // Đợi qrcode.js xuất thẻ img bên trong canvas ra hoàn chỉnh
      setTimeout(() => {
        const img = hiddenRenderDiv.querySelector('img');
        if (img && img.src) {
          resolve(img.src.split(',')[1]); // Lấy phần chuỗi Base64 sạch bỏ header data:image/png
        } else {
          const canvas = hiddenRenderDiv.querySelector('canvas');
          if (canvas) {
            resolve(canvas.toDataURL().split(',')[1]);
          } else {
            resolve(null);
          }
        }
      }, 50);
    });
  };

  // Quản lý trùng tên file bằng Map đếm số lần trùng
  const filenameCounter = new Map();
  const getSafeFilename = (code, name, role) => {
    // Loại bỏ ký tự đặc biệt nguy hiểm cho hệ điều hành khi đặt tên file
    let cleanName = name.replace(/[/\\?%*:|"<>]/g, '-').trim();
    let baseName = `${code}_${cleanName}_(${role})`;
    
    if (filenameCounter.has(baseName)) {
      let count = filenameCounter.get(baseName) + 1;
      filenameCounter.set(baseName, count);
      return `${baseName}_${count}.png`;
    } else {
      filenameCounter.set(baseName, 1);
      return `${baseName}.png`;
    }
  };

  // Vòng lặp duyệt danh sách tạo ảnh đẩy vào file nén
  for (let g of guests) {
    // 1. Tạo QR cho Khách hàng chính
    const mainUrl = qrUrl(g.guestCode);
    const mainB64 = await generateQrBase64(mainUrl);
    if (mainB64) {
      const fn = getSafeFilename(g.guestCode, g.name, "Chinh");
      zip.file(fn, mainB64, {base64: true});
    }

    // 2. Duyệt tạo QR cho những Người đi kèm thuộc nhóm khách này
    if (g.companions && g.companions.length) {
      for (let cp of g.companions) {
        const cpUrl = qrUrl(cp.code);
        const cpB64 = await generateQrBase64(cpUrl);
        if (cpB64) {
          const fn = getSafeFilename(cp.code, cp.name, `DiKem_cua_${g.name}`);
          zip.file(fn, cpB64, {base64: true});
        }
      }
    }
  }

  // Dọn dẹp DOM ảo
  document.body.removeChild(hiddenRenderDiv);

  // Xuất file và kích hoạt download
  try {
    const content = await zip.generateAsync({type: "blob"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = `QR_SựKiện_${(ev?.name||'Event').replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
    a.click();
  } catch (err) {
    alert("Có lỗi xảy ra trong quá trình nén file ZIP: " + err.message);
  }

  zipBtn.textContent = oldText;
  zipBtn.disabled = false;
}
