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

// Khởi tạo Supabase Client cho tính năng Realtime — lắng nghe thay đổi từ thiết bị khác qua WebSocket
// LƯU Ý: cần thêm thẻ <script src="https://unpkg.com/@supabase/supabase-js@2"></script> vào file HTML
// (TRƯỚC thẻ <script src="app.js">), nếu chưa có thì biến này sẽ là null và Realtime tự động bỏ qua.
const supabaseClient = (typeof supabase !== 'undefined' && supabase.createClient)
  ? supabase.createClient(SB_URL, SB_KEY)
  : null;

/* ============================================================
   BASE URL — URL GitHub Pages sau khi deploy
   ============================================================ */
const BASE_URL = "https://lemaitranmedia.github.io/eventoh-checkin";

/* ============================================================
   DATA LAYER
   ============================================================ */
function dbToEv(r){return{id:r.id,name:r.name,date:r.date_str,team:r.team,venue:r.venue,eventPw:r.event_pw,btcMembers:r.btc_members||[],createdAt:r.created_at}}
function dbToG(r){return{id:r.id,eventId:r.event_id,guestCode:r.guest_code,systemCode:r.system_code,name:r.name,phone:r.phone,prmName:r.prm_name,tcbRegion:r.tcb_region,unit:r.unit,sihName:r.sih_name,note:r.note,companions:r.companions||[],checkedIn:!!r.checked_in,checkinTime:r.checkin_time,checkinBy:r.checkin_by,cancelled:!!r.cancelled,cancelNote:r.cancel_note,walkin:!!r.walkin,createdAt:r.created_at}}
function evToDb(e){return{id:e.id,name:e.name,date_str:e.date||null,team:e.team||null,venue:e.venue||null,event_pw:e.eventPw||null,btc_members:e.btcMembers||[],created_at:e.createdAt||Date.now()}}
function gToDb(g){return{id:g.id,event_id:g.eventId,guest_code:g.guestCode,system_code:g.systemCode||null,name:g.name,phone:g.phone||null,prm_name:g.prmName||null,tcb_region:g.tcbRegion||null,unit:g.unit||null,sih_name:g.sihName||null,note:g.note||null,companions:g.companions||[],checked_in:!!g.checkedIn,checkin_time:g.checkinTime||null,checkin_by:g.checkinBy||null,cancelled:!!g.cancelled,cancel_note:g.cancelNote||null,walkin:!!g.walkin,created_at:g.createdAt||Date.now()}}

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

/* ⚠️ LEGACY — save()/sbSync() POST NGUYÊN MẢNG db.events + db.guests lên Supabase mỗi lần gọi.
   Đây chính là nguồn gốc gây mất/đè check-in khi nhiều thiết bị thao tác đồng thời (last-write-wins
   trên toàn bộ tập dữ liệu — thiết bị A check-in xong, thiết bị B sync đè bằng bản local cũ của B,
   xoá mất check-in của A). Sau bản cập nhật Mục tiêu 1 (tách saveLocalOnly/sync theo phạm vi hẹp),
   toàn bộ thao tác sửa/xoá/thêm khách & sự kiện đã chuyển sang dùng saveLocalOnly() kết hợp
   sbPatchGuest() / sbPatchEvent() / sbUpsertOne() / sbUpsertMany() — chỉ ghi đúng (các) dòng bị đổi.
   Hai hàm dưới đây KHÔNG còn được gọi ở bất kỳ đâu trong code nữa — giữ lại để dự phòng/tham khảo,
   KHÔNG dùng lại cho thao tác mới trừ khi đã hiểu rõ rủi ro full-array overwrite nêu trên. */
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

// HÀM MỚI: chỉ ghi local (localStorage), KHÔNG kích hoạt sync nguyên mảng — dùng cho mọi thao tác
// sửa/xoá/check-in để tránh đè dữ liệu chéo. Phần đồng bộ thật lên Supabase đi qua sbPatchGuest/
// sbPatchEvent/sbUpsertOne/sbUpsertMany ngay sau lệnh gọi hàm này tại từng nơi gọi.
function saveLocalOnly() {
  try{localStorage.setItem(SK,JSON.stringify(db))}catch(e){}
}

async function sbDel(table,id){
  if(!SB_ON)return;
  try{await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`,{method:'DELETE',headers:SB_HDR})}
  catch(e){console.warn('Supabase delete lỗi:',e)}
}

/* PATCH 1 record duy nhất lên Supabase theo id — dùng cho check-in tại sự kiện.
   Tránh việc POST nguyên mảng db.guests (sbSync) có thể bị nhiều máy ghi đè
   chéo lên nhau khi check-in đồng thời (race condition).
   Có retry với backoff; trả về true/false để UI biết đã ghi nhận thành công hay chưa. */
async function sbPatchGuest(guestId, fields, retries=3){
  if(!SB_ON)return true; // không dùng Supabase (chạy local) -> coi như OK
  for(let attempt=1;attempt<=retries;attempt++){
    try{
      const res=await fetch(`${SB_URL}/rest/v1/oh_guests?id=eq.${guestId}`,{
        method:'PATCH',
        headers:{...SB_HDR,'Prefer':'return=minimal'},
        body:JSON.stringify(fields)
      });
      if(res.ok)return true;
      console.warn('sbPatchGuest lỗi HTTP',res.status);
    }catch(e){console.warn('sbPatchGuest lỗi mạng:',e)}
    if(attempt<retries)await new Promise(r=>setTimeout(r,attempt*500));
  }
  return false;
}

/* PATCH 1 record duy nhất lên bảng oh_events theo id — anh em sinh đôi của sbPatchGuest.
   Dùng cho saveEv() (chỉnh sửa sự kiện) thay vì save() cũ vốn POST nguyên cả 2 mảng
   db.events + db.guests mỗi lần đổi 1 sự kiện (kéo theo rủi ro đè check-in không liên quan). */
async function sbPatchEvent(eventId, fields, retries=3){
  if(!SB_ON)return true;
  for(let attempt=1;attempt<=retries;attempt++){
    try{
      const res=await fetch(`${SB_URL}/rest/v1/oh_events?id=eq.${eventId}`,{
        method:'PATCH',
        headers:{...SB_HDR,'Prefer':'return=minimal'},
        body:JSON.stringify(fields)
      });
      if(res.ok)return true;
      console.warn('sbPatchEvent lỗi HTTP',res.status);
    }catch(e){console.warn('sbPatchEvent lỗi mạng:',e)}
    if(attempt<retries)await new Promise(r=>setTimeout(r,attempt*500));
  }
  return false;
}

/* UPSERT đúng 1 record mới (sự kiện hoặc khách mới tạo) — KHÔNG đụng tới các row khác.
   Thay thế việc gọi sbSync() (POST nguyên mảng) mỗi khi tạo mới 1 sự kiện/1 khách. */
async function sbUpsertOne(table, row, retries=3){
  if(!SB_ON)return true;
  for(let attempt=1;attempt<=retries;attempt++){
    try{
      const res=await fetch(`${SB_URL}/rest/v1/${table}`,{
        method:'POST',
        headers:{...SB_HDR,'Prefer':'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify([row])
      });
      if(res.ok)return true;
      console.warn('sbUpsertOne lỗi HTTP',res.status);
    }catch(e){console.warn('sbUpsertOne lỗi mạng:',e)}
    if(attempt<retries)await new Promise(r=>setTimeout(r,attempt*500));
  }
  return false;
}

/* UPSERT nhiều record cùng lúc, nhưng CHỈ gồm các row được truyền vào (vd: danh sách khách vừa
   import từ Excel) — không kéo theo toàn bộ db.guests như sbSync() cũ. */
async function sbUpsertMany(table, rows, retries=3){
  if(!SB_ON || !rows.length)return true;
  for(let attempt=1;attempt<=retries;attempt++){
    try{
      const res=await fetch(`${SB_URL}/rest/v1/${table}`,{
        method:'POST',
        headers:{...SB_HDR,'Prefer':'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify(rows)
      });
      if(res.ok)return true;
      console.warn('sbUpsertMany lỗi HTTP',res.status);
    }catch(e){console.warn('sbUpsertMany lỗi mạng:',e)}
    if(attempt<retries)await new Promise(r=>setTimeout(r,attempt*500));
  }
  return false;
}

let db={events:[],guests:[]};

function qrUrl(code){return BASE_URL+'/?code='+encodeURIComponent(code)}

async function loadData(){
  if(SB_ON){const ok=await sbLoad();if(!ok){const loc=loadLocal();db.events=loc.events;db.guests=loc.guests;}}
  else{const loc=loadLocal();db.events=loc.events;db.guests=loc.guests;}
}

/* isEvLocked — ngày > ngày event → khoá check-in / cancel / thêm-xoá khách / import.
   Sửa thông tin tĩnh (tên, SĐT, PRM, vùng, đơn vị, SIH, note, systemCode) vẫn cho phép. */
function isEvLocked(ev){
  if(!ev?.date)return false;
  const today=new Date().toISOString().slice(0,10);
  return today>ev.date;
}

/* isWalkinAllowed — true khi hôm nay >= ngày tổ chức sự kiện (trong ngày + sau ngày).
   Không cho phép tạo Walk-in trước ngày event.
   Walk-in vẫn khả dụng sau ngày event để hậu kiểm / bổ sung KH đến muộn. */
function isWalkinAllowed(ev){
  if(!ev?.date)return false;
  const today=new Date().toISOString().slice(0,10);
  return today>=ev.date;
}
// Alias cũ giữ lại để không cần sửa nhiều chỗ
function isWalkinDay(ev){ return isWalkinAllowed(ev); }

function getEvById(id){return db.events.find(e=>e.id===id)}

/* ⚠️ LEGACY — polling 15s. Mục tiêu 2 thay cơ chế này bằng Realtime (initSupabaseRealtime bên dưới).
   Giữ lại định nghĩa hàm để dự phòng (vd: nếu cần bật lại polling làm lưới an toàn thì gọi startAutoRefresh()
   thủ công), nhưng KHÔNG còn được gọi tự động trong init() nữa. */
let _autoRefresh=null;
function startAutoRefresh(){
  if(_autoRefresh)clearInterval(_autoRefresh);
  _autoRefresh=setInterval(async()=>{
    if(shouldSkipAutoRefresh())return; // người dùng đang nhập liệu / có form mở -> bỏ qua lượt này
    await loadData();R();
  },15000);
}

/* Tránh việc auto-refresh (hoặc Realtime reconnect bên dưới) ghi đè dữ liệu đang nhập hoặc làm mất
   focus/con trỏ:
   - Có modal (form thêm/sửa/import...) đang mở -> chắc chắn có dữ liệu chưa lưu, bỏ qua.
   - Đang gõ vào 1 input/textarea/select bất kỳ (kể cả ngoài modal, ví dụ ô search) -> bỏ qua. */
function shouldSkipAutoRefresh(){
  if(S.modal)return true;
  if(S.ciState?.step==='verify')return true; // BTC đang chờ nhập 4 số cuối SĐT, không re-render giữa chừng
  if(S.urlCIBusy)return true; // đang chờ xác nhận check-in từ server
  const el=document.activeElement;
  if(!el)return false;
  const tag=el.tagName;
  return tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT';
}
async function doRefresh(){
  const btn=document.getElementById('refresh_btn');
  if(btn){btn.textContent='⏳ Đang làm mới...';btn.disabled=true;}
  await loadData();R();
}

/* MỤC TIÊU 2 — Đồng bộ Realtime qua WebSocket thay cho polling 15s. Lắng nghe cả UPDATE, INSERT, DELETE
   trên bảng oh_guests (bản trước chỉ có UPDATE — khách mới thêm/khách bị xoá ở thiết bị khác không tự
   thấy, phải đợi bấm "Làm mới" tay). Có cơ chế tự kết nối lại khi rớt kênh (wifi venue chập chờn),
   vì polling dự phòng đã tắt nên nếu không tự hồi phục thì máy sẽ "đứng hình" mà không có cảnh báo gì. */
let _realtimeChannel = null;
let _realtimeRetryCount = 0;
let _realtimeReconnectT = null;

function initSupabaseRealtime() {
  if (!supabaseClient || !SB_ON) {
    console.warn("⚠️ Không khởi tạo được Realtime — thiếu supabaseClient (kiểm tra lại thẻ <script> supabase-js trong HTML).");
    return;
  }
  console.log("Bắt đầu kết nối Realtime từ Supabase...");

  _realtimeChannel = supabaseClient
    .channel('public:oh_guests')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'oh_guests' }, payload => {
      const updatedGuest = dbToG(payload.new);
      const index = db.guests.findIndex(g => g.id === updatedGuest.id);
      if (index !== -1) {
        db.guests[index] = updatedGuest;
        saveLocalOnly();
        if (typeof R === 'function') R();
        console.log(`📡 Realtime cập nhật trạng thái khách: ${updatedGuest.name}`);
      }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'oh_guests' }, payload => {
      const newGuest = dbToG(payload.new);
      if (!db.guests.some(g => g.id === newGuest.id)) {
        db.guests.push(newGuest);
        saveLocalOnly();
        if (typeof R === 'function') R();
        console.log(`📡 Realtime: khách mới từ thiết bị khác — ${newGuest.name}`);
      }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'oh_guests' }, payload => {
      const deletedId = payload.old?.id;
      if (deletedId) {
        db.guests = db.guests.filter(g => g.id !== deletedId);
        saveLocalOnly();
        if (typeof R === 'function') R();
        console.log(`📡 Realtime: khách đã bị xoá từ thiết bị khác — ${deletedId}`);
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log("✅ Kết nối Realtime thành công! Đang lắng nghe thay đổi...");
        _realtimeRetryCount = 0;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn(`⚠️ Realtime mất kết nối (${status}). Sẽ thử kết nối lại...`);
        scheduleRealtimeReconnect();
      }
    });
}

function scheduleRealtimeReconnect(){
  if (_realtimeReconnectT) return; // đã có lịch reconnect đang chờ, không chồng thêm lịch khác
  _realtimeRetryCount++;
  const delay = Math.min(30000, 2000 * _realtimeRetryCount); // tăng dần theo số lần thử, tối đa 30s
  _realtimeReconnectT = setTimeout(async () => {
    _realtimeReconnectT = null;
    console.log(`🔄 Đang thử kết nối lại Realtime (lần ${_realtimeRetryCount})...`);
    if (_realtimeChannel) {
      try { await supabaseClient.removeChannel(_realtimeChannel); } catch(e) {}
      _realtimeChannel = null;
    }
    // Làm mới toàn bộ dữ liệu 1 lần để bắt kịp các thay đổi đã xảy ra trong lúc mất kết nối
    if (!shouldSkipAutoRefresh()) { await loadData(); R(); }
    initSupabaseRealtime();
  }, delay);
}

async function init(){
  const urlCode=new URLSearchParams(window.location.search).get('code');
  const root=document.getElementById('root');
  root.innerHTML=`<div style="max-width:360px;margin:80px auto;text-align:center;font-family:'Be Vietnam Pro',sans-serif"><div style="font-size:40px;margin-bottom:12px">⏳</div><div style="font-size:14px;color:#aaa;margin-top:8px">Đang tải...</div></div>`;
  await loadData();
  if(SB_ON) initSupabaseRealtime(); // thay cho startAutoRefresh() cũ
  if(urlCode){S.urlCode=decodeURIComponent(urlCode);S.view='url_ci';R();return;}
  R();
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
  urlCIBusy:false,
  urlCISyncWarn:false,
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
  ciSyncWarn:false,
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
          <button class="btn sm" onclick="openEditEv('${ev.id}')">✏️ Sửa</button>
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

  if(S.search){const q=S.search.toLowerCase();gs=gs.filter(g=>g.name?.toLowerCase().includes(q)||g.phone?.includes(q)||g.prmName?.toLowerCase().includes(q)||g.sihName?.toLowerCase().includes(q)||g.unit?.toLowerCase().includes(q)||g.guestCode?.toLowerCase().includes(q)||g.systemCode?.toLowerCase().includes(q)||(g.companions||[]).some(x=>x.name?.toLowerCase().includes(q)||x.code?.toLowerCase().includes(q)))}
  if(S.filter==='checked')gs=gs.filter(g=>g.checkedIn);
  if(S.filter==='pending')gs=gs.filter(g=>!g.checkedIn&&!g.cancelled);
  if(S.filter==='cancelled')gs=gs.filter(g=>g.cancelled);
  if(S.filter==='walkin')gs=gs.filter(g=>!!g.walkin);

  const btcTags=(ev.btcMembers||[]).map(m=>`<span class="badge b-purple" style="margin:2px">🔑 ${m.name} (${m.code})</span>`).join('');
  const evLocked = isEvLocked(ev);       // true khi ngày > ngày event → khoá check-in/cancel/add-del
  const evWalkinDay = isWalkinDay(ev);   // true khi ngày = ngày event → cho phép tạo Walk-in

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
          <option value="walkin" ${S.filter==='walkin'?'selected':''}>🚶 Walk-in (${egs(S.selEv).filter(g=>g.walkin).length})</option>
        </select>
        
        ${evLocked?'':`
          <button class="btn green sm" onclick="triggerExcelImport()">📥 Import Excel</button>
          <button class="btn sm" onclick="downloadExcelTemplate()">📄 Mẫu Excel</button>
        `}
        ${p.t > 0 ? `<button class="btn blue sm" onclick="downloadAllQRsZip()" id="zip_btn">🗂️ Tải QR hàng loạt (.ZIP)</button>` : ''}
        ${evLocked?'':`<button class="btn blue sm" onclick="openM('add_g')">+ Thêm KH đăng ký</button>`}
        ${evWalkinDay?`<button class="btn sm" style="background:#7C3AED;color:#fff;border-color:#7C3AED" onclick="openWalkin()">🚶 + Walk-in</button>`:''}
      </div>
    </div>
    
    ${evLocked?`<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">📋</span>
      <div>
        <div style="font-weight:600;font-size:13px;color:#92400E">Sự kiện đã kết thúc — Chế độ chỉnh sửa hậu sự kiện</div>
        <div style="font-size:11px;color:#aaa">Check-in, Cancel, Thêm/Xoá khách đã bị khoá từ ngày ${fmtD(ev.date)}. Vẫn có thể <b>sửa thông tin</b> (PRM, vùng, đơn vị, SIH, ghi chú, systemCode, tên, SĐT).</div>
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
            const isWalkin=!!g.walkin;
            // evLocked = ký sự kiện đã qua: khoá check-in/cancel/add-del
            // Sửa thông tin tĩnh (edit) LUÔN cho phép dù evLocked
            let rows=`<tr ${isCancelled?'class="cancelled"':''} style="${isCancelled?'background:#FFF8F8':''}">
              <td style="color:#ccc">${i+1}</td>
              <td>
                <div style="font-weight:600${isCancelled?';text-decoration:line-through;color:#bbb':''}">
                  ${g.name}
                  ${isWalkin?`<span style="font-size:9px;font-weight:700;background:#EDE9FE;color:#7C3AED;padding:1px 6px;border-radius:8px;margin-left:4px;vertical-align:middle">Walk-in</span>`:''}
                </div>
                ${isCancelled?`<span class="cancelled-badge">🚫 Cancel</span>${g.cancelNote?`<div class="cancel-note">${g.cancelNote}</div>`:''}`:
                  `${comps.length?`<div class="sub">+${comps.length} đi kèm</div>`:''}
                   ${g.note?`<div class="sub" style="font-style:italic">${g.note}</div>`:''}
                   ${evLocked?'':`<button class="btn xs" onclick="openAddComp('${g.id}')" style="margin-top:5px;font-size:10px;color:#185FA5;border-color:#b3d4f5">+ thêm đi kèm</button>`}`}
              </td>
              <td><span class="mono">${g.guestCode}</span>${g.systemCode?`<div style="font-size:10px;color:#aaa;margin-top:2px">Mã HT: ${g.systemCode}</div>`:''}</td>
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
                  <button class="btn xs" onclick="openTickets('${g.id}')" title="Vé">🎫</button>
                  ${evLocked?'':isCancelled?
                    `<button class="btn xs" onclick="undoCancel('${g.id}','g')" style="color:#185FA5;border-color:#185FA5" title="Recall — KH quay lại tham dự">↩</button>`
                    :`<button class="btn xs" onclick="openCancel('${g.id}','g')" title="Cancel KH" style="color:#B91C1C;border-color:#FECACA">🚫</button>`}
                  <button class="btn xs" onclick="openEdit('${g.id}')" title="Sửa thông tin">✏️</button>
                  ${evLocked?'':`<button class="btn xs red" onclick="openDel('${g.id}')" title="Xoá">🗑️</button>`}
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
                    <button class="btn xs" onclick="openCpTicket('${g.id}','${cp.id}')" title="Vé">🎫</button>
                    ${evLocked?'':cpCancelled?
                      `<button class="btn xs" onclick="undoCancel('${g.id}','c','${cp.id}')" style="color:#185FA5;border-color:#185FA5" title="Recall — người đi kèm quay lại">↩</button>`
                      :`<button class="btn xs" onclick="openCancel('${g.id}','c','${cp.id}')" style="color:#B91C1C;border-color:#FECACA" title="Cancel">🚫</button>`}
                    <button class="btn xs" onclick="openCpEdit('${g.id}','${cp.id}')" title="Sửa thông tin">✏️</button>
                    ${evLocked?'':`<button class="btn xs red" onclick="openCpDel('${g.id}','${cp.id}')" title="Xoá">🗑️</button>`}
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

  // Danh sách Khách hàng (Main) — đối tượng dùng cho mọi breakdown & đánh giá tỷ lệ
  const mainGuests=egs(S.rptEv).map(g=>({
    name:g.name,code:g.guestCode,phone:g.phone,prmName:g.prmName,tcbRegion:g.tcbRegion,unit:g.unit,sihName:g.sihName,note:g.note,
    checkedIn:g.checkedIn,cancelled:g.cancelled,checkinTime:g.checkinTime,companions:g.companions||[]
  }));

  // Danh sách đầy đủ Main + Companion — chỉ dùng cho thống kê "tổng lượt tham dự thực tế"
  const allPpl=[];
  mainGuests.forEach(g=>{
    allPpl.push({checkedIn:g.checkedIn,cancelled:g.cancelled,isMain:true});
    g.companions.forEach(c=>allPpl.push({checkedIn:c.checkedIn,cancelled:c.cancelled,isMain:false}));
  });

  // --- Khối 1: Tổng quan Khách hàng (Main only) ---
  const totalM=mainGuests.length;
  const ciM=mainGuests.filter(g=>g.checkedIn).length;
  const cnM=mainGuests.filter(g=>g.cancelled).length;
  const pdM=totalM-ciM-cnM;
  const pctM=totalM>0?Math.round(ciM/totalM*100):0;

  // --- Khối 2: Tổng lượt tham dự thực tế (Main + Companion) ---
  const totalAll=allPpl.length;
  const totalAllMain=mainGuests.length;
  const totalAllComp=totalAll-totalAllMain;
  const ciAll=allPpl.filter(p=>p.checkedIn).length;
  const ciAllMain=ciM;
  const ciAllComp=ciAll-ciAllMain;
  const avgCompPerMain=ciAllMain>0?Math.round((ciAllComp/ciAllMain)*100)/100:0;

  // --- Walk-in vs Pre-registered ---
  const preregG = mainGuests.filter(g=>!g.walkin);
  const walkinG  = mainGuests.filter(g=>!!g.walkin);
  const prTotal=preregG.length, prCi=preregG.filter(g=>g.checkedIn).length, prCn=preregG.filter(g=>g.cancelled).length, prPd=prTotal-prCi-prCn, prPct=prTotal>0?Math.round(prCi/prTotal*100):0;
  const wiTotal=walkinG.length, wiCi=walkinG.filter(g=>g.checkedIn).length, wiCn=walkinG.filter(g=>g.cancelled).length, wiPd=wiTotal-wiCi-wiCn, wiPct=wiTotal>0?Math.round(wiCi/wiTotal*100):0;

  function wiCell(val, color, sub){
    if(wiTotal===0)return '<td style="padding:8px 12px;text-align:center;color:#ccc;font-size:12px">—</td>';
    return '<td style="padding:8px 12px;text-align:center;background:#FAFAFF">'
      +'<div style="font-size:18px;font-weight:800;color:'+color+'">'+val+'</div>'
      +(sub?'<div style="font-size:10px;color:#aaa;margin-top:1px">'+sub+'</div>':'')
      +'</td>';
  }
  function prCell(val, color, sub){
    return '<td style="padding:8px 12px;text-align:center">'
      +'<div style="font-size:18px;font-weight:800;color:'+color+'">'+val+'</div>'
      +(sub?'<div style="font-size:10px;color:#aaa;margin-top:1px">'+sub+'</div>':'')
      +'</td>';
  }

  const walkinTableHtml=`
  <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1px;margin:0 0 8px;text-transform:uppercase">📊 Pre-registered vs Walk-in (Main)</div>
  <div style="background:#fff;border-radius:12px;border:1px solid #eaecf0;margin-bottom:14px;overflow:hidden">
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#f8fafc">
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#aaa;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #eaecf0"></th>
        <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:700;color:#185FA5;border-bottom:1px solid #eaecf0">📋 Pre-registered</th>
        <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:700;color:#7C3AED;border-bottom:1px solid #eaecf0;background:${wiTotal>0?'#F5F3FF':'#f8fafc'}">🚶 Walk-in</th>
      </tr></thead>
      <tbody>
        <tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:8px 12px;font-size:12px;color:#555;font-weight:600">Tổng KH</td>
          ${prCell(prTotal,'#185FA5','')}
          ${wiCell(wiTotal,'#7C3AED','')}
        </tr>
        <tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:8px 12px;font-size:12px;color:#3B6D11;font-weight:600">✅ Đã vào</td>
          ${prCell(prCi,'#3B6D11',prPct+'% turnout')}
          ${wiCell(wiCi,'#3B6D11',wiPct+'% turnout')}
        </tr>
        <tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:8px 12px;font-size:12px;color:#888;font-weight:600">⏳ Chưa tới</td>
          ${prCell(prPd,'#aaa','')}
          ${wiCell(wiPd,'#aaa','')}
        </tr>
        <tr>
          <td style="padding:8px 12px;font-size:12px;color:#B91C1C;font-weight:600">🚫 Cancel</td>
          ${prCell(prCn>0?prCn:'—',prCn>0?'#B91C1C':'#ccc','')}
          ${wiCell(wiCn>0?wiCn:'—',wiCn>0?'#B91C1C':'#ccc','')}
        </tr>
      </tbody>
    </table>
    ${wiTotal===0?'<div style="padding:8px 14px;font-size:11px;color:#bbb;text-align:center;border-top:1px solid #f0f0f0">Sự kiện này chưa có khách Walk-in</div>':''}
  </div>`;

  const statsHtml=`<div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1px;margin-bottom:8px;text-transform:uppercase">Tổng quan (Khách hàng - Main)</div>
  <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
    ${statCard('Tổng KH mời (Main)','#185FA5',totalM,'')}
    ${statCard('✅ KH đã tới','#3B6D11',ciM,pctM+'% turnout')}
    ${statCard('⏳ KH chưa tới','#888',pdM,'')}
    ${statCard('🚫 KH cancel','#B91C1C',cnM,'')}
  </div>
  <div style="background:#fff;border-radius:12px;padding:14px 18px;margin-bottom:14px;border:1px solid #eaecf0">
    <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px">
      <span style="font-weight:700">${selEv.name}</span>
      <span style="color:#3B6D11;font-weight:700">${pctM}%</span>
    </div>
    <div style="background:#f0f0f0;border-radius:99px;height:12px;overflow:hidden">
      <div style="width:${pctM}%;background:linear-gradient(90deg,#185FA5,#3B6D11);height:100%;border-radius:99px;transition:width .4s"></div>
    </div>
  </div>
  ${walkinTableHtml}
  <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1px;margin-bottom:8px;text-transform:uppercase">Tổng lượt tham dự thực tế (Main + Companion)</div>
  <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
    ${statCard('Tổng lượt đăng ký','#185FA5',totalAll,totalAllMain+' Main + '+totalAllComp+' Companion')}
    ${statCard('✅ Tổng đã vào sảnh','#3B6D11',ciAll,ciAllMain+' Main + '+ciAllComp+' Companion')}
    ${statCard('Avg companion / Main đã vào','#888',avgCompPerMain,'')}
  </div>`;

  // Badge +1/-1 thể hiện chênh lệch companion theo trạng thái check-in,
  // áp dụng đồng nhất cho mọi danh sách expand (Đăng ký / Đã vào / Chưa / Cancel)
  function companionBadge(g){
    const comps=g.companions||[];
    if(!comps.length)return'';
    const parts=comps.map(c=>c.checkedIn?'-1':'+1');
    const color=parts.every(x=>x==='-1')?'#e24b4a':parts.every(x=>x==='+1')?'#3B6D11':'#aaa';
    return `<span style="font-size:12px;font-weight:600;color:${color};white-space:nowrap;margin-left:8px">${parts.join(' ')}</span>`;
  }

  function mkBreakdown(label,icon,groupFn,keyFn){
    const groups={};
    mainGuests.forEach(g=>{const k=keyFn(g)||'Không xác định';if(!groups[k])groups[k]=[];groups[k].push(g)});
    const entries=Object.entries(groups).sort((a,b)=>b[1].length-a[1].length);
    if(!entries.length)return'';
    return`<div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1px;margin:16px 0 8px;text-transform:uppercase">${icon} Theo ${label} (Main)</div>
      ${entries.map(([grp,gs])=>{
        const ci=gs.filter(g=>g.checkedIn).length;
        const cn=gs.filter(g=>g.cancelled).length;
        const pend=gs.length-ci-cn;
        const pct=gs.length>0?Math.round(ci/gs.length*100):0;
        const kPre=`${groupFn}_${grp}`;
        const expCi=!!S.rptExp[kPre+'_ci'];
        const expAb=!!S.rptExp[kPre+'_ab'];
        const expCn=!!S.rptExp[kPre+'_cn'];
        return`<div style="background:#fff;border-radius:12px;border:1px solid #eaecf0;padding:14px 16px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">
            <div style="font-weight:700;font-size:13px">${grp} <span style="font-weight:400;color:#aaa;font-size:11px">(${gs.length} Main)</span></div>
            <div style="display:flex;gap:6px;font-size:12px;flex-wrap:wrap">
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
          <div style="font-size:10px;color:#aaa;margin-top:4px;text-align:right">${pct}% Main đã check-in</div>
          ${expCi&&ci>0?`<div style="background:#f0faf0;border:1px solid #97C459;border-radius:8px;padding:10px 12px;margin-top:8px">
            <div style="font-size:11px;font-weight:700;color:#3B6D11;margin-bottom:6px">Đã check-in (${ci} Main)</div>
            ${gs.filter(g=>g.checkedIn).map(g=>`<div style="padding:5px 0;border-bottom:.5px solid #c8e6c9;display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-weight:600;font-size:13px">${g.name}${g.walkin?'<span style="font-size:9px;background:#EDE9FE;color:#7C3AED;padding:1px 5px;border-radius:6px;margin-left:4px">Walk-in</span>':''}</div>
                <div style="font-size:11px;color:#888">${g.code}${g.phone?' · '+g.phone:''}</div>
                <div style="font-size:10px;color:#3B6D11">✅ ${fmtTm(g.checkinTime)}</div>
              </div>
              ${companionBadge(g)}
            </div>`).join('')}
          </div>`:''}
          ${expAb&&pend>0?`<div style="background:#fff8f8;border:1px solid #fdd;border-radius:8px;padding:10px 12px;margin-top:8px">
            <div style="font-size:11px;font-weight:700;color:#e24b4a;margin-bottom:6px">Chưa check-in (${pend} Main)</div>
            ${gs.filter(g=>!g.checkedIn&&!g.cancelled).map(g=>`<div style="padding:5px 0;border-bottom:.5px solid #fdd;display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-weight:600;font-size:13px">${g.name}</div>
                <div style="font-size:11px;color:#888">${g.code}${g.phone?' · '+g.phone:''}</div>
              </div>
              ${companionBadge(g)}
            </div>`).join('')}
          </div>`:''}
          ${expCn&&cn>0?`<div style="background:#FFF8F8;border:1px solid #FECACA;border-radius:8px;padding:10px 12px;margin-top:8px">
            <div style="font-size:11px;font-weight:700;color:#B91C1C;margin-bottom:6px">Đã cancel (${cn} Main)</div>
            ${gs.filter(g=>g.cancelled).map(g=>`<div style="padding:5px 0;border-bottom:.5px solid #FECACA;display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-weight:600;font-size:13px;text-decoration:line-through;color:#bbb">${g.name}</div>
                <div style="font-size:11px;color:#aaa">${g.code}${g.phone?' · '+g.phone:''}</div>
                ${g.note?`<div style="font-size:10px;color:#B91C1C;font-style:italic">${g.note}</div>`:''}
              </div>
              ${companionBadge(g)}
            </div>`).join('')}
          </div>`:''}
        </div>`;
      }).join('')}`;
  }

  const byVung=mkBreakdown('Vùng TCB','🏦','vung',g=>g.tcbRegion);
  const byUnit=mkBreakdown('Chi nhánh','🏢','unit',g=>g.unit);
  const bySih=mkBreakdown('SIH','👤','sih',g=>g.sihName);
  const byPrm=mkBreakdown('PRM','🤝','prm',g=>g.prmName);

  return overviewHtml+statsHtml+byVung+byUnit+bySih+byPrm;
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
  if(S.modal==='walkin')return wrapModal(rWalkinM(),'lg');
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
    <div class="g3">
      <div class="fg"><label>Họ và tên KH *</label><input id="g_n" placeholder="Nguyễn Văn A" value="${g?.name||''}"/></div>
      <div class="fg"><label>Số điện thoại *</label><input id="g_ph" type="tel" placeholder="09xxxxxxxx" value="${g?.phone||''}"/></div>
      <div class="fg"><label>Mã Hệ thống <span style="font-weight:400;color:#aaa">(OneHousing)</span></label><input id="g_syscode" placeholder="VD: OH-00123" value="${g?.systemCode||''}"/></div>
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
    <div class="g3">
      <div class="fg"><label>Họ và tên KH</label><input id="eg_n" value="${g.name||''}"/></div>
      <div class="fg"><label>Số điện thoại</label><input id="eg_ph" type="tel" value="${g.phone||''}"/></div>
      <div class="fg"><label>Mã Hệ thống <span style="font-weight:400;color:#aaa">(OneHousing)</span></label><input id="eg_syscode" value="${g.systemCode||''}"/></div>
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
            <th>Loại</th><th>Họ và tên</th><th>Số điện thoại</th><th>Tên PRM</th><th>Vùng TCB</th><th>Đơn vị</th><th>Tên SIH</th><th>Ghi chú</th><th>Mã Hệ thống</th>
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
              <td style="font-family:'JetBrains Mono',monospace;font-size:11px">${r.type==='Main'?(r.systemCode||'—'):'—'}</td>
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
      ${S.urlCISyncWarn?`<div style="margin-top:14px;background:#FEF2F2;color:#B91C1C;font-size:12px;padding:10px 14px;border-radius:10px;text-align:left">
        ⚠️ Đã ghi nhận check-in trên thiết bị này, nhưng <b>chưa đồng bộ được lên hệ thống trung tâm</b> (có thể do mất mạng).
        Vui lòng báo BTC kỹ thuật kiểm tra lại để đảm bảo dữ liệu được cập nhật đầy đủ.
      </div>`:''}
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
    <button onclick="doUrlCI()" ${S.urlCIBusy?'disabled':''} style="width:100%;padding:14px;background:${S.urlCIBusy?'#aaa':'#3B6D11'};color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:${S.urlCIBusy?'default':'pointer'};font-family:'Be Vietnam Pro',sans-serif">${S.urlCIBusy?'⏳ Đang xác nhận...':'✅ Xác nhận Check-in'}</button>
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

  if(S.urlCIBusy)return; // tránh double-submit khi đang chờ xác nhận từ server
  S.urlCIBusy=true;R();

  const now=new Date().toISOString();
  if(found.type==='guest'){g.checkedIn=true;g.checkinTime=now;g.checkinBy=btcInput}
  else{p.checkedIn=true;p.checkinTime=now;p.checkinBy=btcInput}
  saveLocalOnly(); // ghi local ngay (localStorage) — không mất dữ liệu nếu mất mạng/đóng tab

  // Ghi atomic 1 record lên Supabase, có retry — đây là nguồn xác nhận "thật"
  const patchFields = found.type==='guest'
    ? {checked_in:true,checkin_time:now,checkin_by:btcInput}
    : {companions:(g.companions||[])}; // companion nằm trong cột JSON companions của Main guest
  const ok = await sbPatchGuest(g.id, patchFields);

  S.urlCIBusy=false;
  S.urlCISyncWarn = !ok;
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
    ${S.ciSyncWarn?`<div style="margin-top:14px;background:#FEF2F2;color:#B91C1C;font-size:12px;padding:10px 14px;border-radius:10px;text-align:left;max-width:360px;margin-left:auto;margin-right:auto">
      ⚠️ Đã ghi nhận check-in trên thiết bị này, nhưng <b>chưa đồng bộ được lên hệ thống trung tâm</b> (có thể do mất mạng).
      Vui lòng kiểm tra lại kết nối và báo kỹ thuật nếu tình trạng tiếp diễn.
    </div>`:''}
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

/* ============================================================
   WALK-IN FUNCTIONS — tạo KH ngay tại sự kiện trong ngày tổ chức
   ============================================================ */
function openWalkin(){
  const ev=getEvById(S.selEv);
  if(!isWalkinAllowed(ev)){alert('Walk-in chỉ khả dụng từ ngày tổ chức sự kiện ('+fmtD(ev?.date)+') trở đi.');return;}
  S.modal='walkin';R();
}

function openEditEv(id){
  const ev=db.events.find(e=>e.id===id);if(!ev)return;
  // Sự kiện đã qua ngày vẫn cho phép sửa thông tin tĩnh — chỉ check-in/cancel/add-del mới bị khoá
  if(ev.eventPw&&!S.unlockedEvs[id]){S.evUnlockTarget=id;S.modal='ev_unlock';R();return;}
  S.editEvId=id;S.modal='edit_ev';R();
}

function openCpTicket(gid,cpId){S.cpTicket={gid,cpId};S.modal='cp_ticket';R();setTimeout(()=>mkCpQR(),120)}
function openCpEdit(gid,cpId){S.cpEdit={gid,cpId};S.modal='cp_edit';R()}
function openCpDel(gid,cpId){S.cpDel={gid,cpId};S.modal='cp_del';R()}
function openAddComp(gid){S.cpAdd=gid;S.modal='cp_add';R()}

function openCancel(gid,type,cpId){S.cancelTarget={gid,type,cpId:cpId||null};S.modal='cancel';R()}
async function doCancel(){
  const {gid,type,cpId}=S.cancelTarget||{};
  const g=db.guests.find(x=>x.id===gid);if(!g)return;
  if(isEvLocked(getEvById(g.eventId))){alert('Sự kiện đã kết thúc. Không thể thay đổi.');closeM();return;}
  const note=(document.getElementById('cancel_note')?.value||'').trim();
  let patchFields;
  if(type==='c'){
    const c=(g.companions||[]).find(x=>x.id===cpId);
    if(c){c.cancelled=true;c.cancelNote=note;c.checkedIn=false;c.checkinTime=null}
    patchFields={companions:g.companions};
  } else {
    g.cancelled=true;g.cancelNote=note;g.checkedIn=false;g.checkinTime=null;
    (g.companions||[]).forEach(c=>{c.cancelled=true;c.cancelNote=note?`[Theo KH chính] ${note}`:'Theo KH chính';c.checkedIn=false;c.checkinTime=null});
    patchFields={cancelled:true,cancel_note:note,checked_in:false,checkin_time:null,companions:g.companions};
  }
  saveLocalOnly();S.modal=null;S.cancelTarget=null;R();
  const ok=await sbPatchGuest(g.id,patchFields);
  if(!ok)alert('⚠️ Đã ghi nhận Cancel trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng bấm "Làm mới" để kiểm tra lại.');
}
async function undoCancel(gid,type,cpId){
  const g=db.guests.find(x=>x.id===gid);if(!g)return;
  let patchFields;
  if(type==='c'){
    const c=(g.companions||[]).find(x=>x.id===cpId);
    if(c){c.cancelled=false;c.cancelNote=''}
    patchFields={companions:g.companions};
  } else {
    g.cancelled=false;g.cancelNote='';
    (g.companions||[]).forEach(c=>{c.cancelled=false;c.cancelNote=''});
    patchFields={cancelled:false,cancel_note:'',companions:g.companions};
  }
  saveLocalOnly();R();
  const ok=await sbPatchGuest(g.id,patchFields);
  if(!ok)alert('⚠️ Đã khôi phục (Huỷ Cancel) trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng bấm "Làm mới" để kiểm tra lại.');
}
function goCI(){S.view='checkin';S.ciOk=false;S.ciEv=null;S.ciOp=null;S.ciState=null;R()}
function backAdmin(){S.view='admin';S.ciOk=false;S.ciState=null;R()}
function lockOut(){S.ciOk=false;S.ciOp=null;S.ciState=null;R()}
function cancelCI(){S.ciState=null;S.ciSyncWarn=false;R()}
function nextCI(){S.ciState=null;S.ciSyncWarn=false;R()}

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

async function saveEv(){
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
    const editedId=S.editEvId;
    saveLocalOnly();S.modal=null;S.editEvId=null;R();
    // Trước đây: save() POST nguyên cả mảng db.events LẪN db.guests mỗi khi sửa 1 sự kiện — nghĩa là
    // sửa tên/venue 1 sự kiện cũng có thể kéo theo nguy cơ đè check-in đang có ở sự kiện khác. Giờ chỉ
    // PATCH đúng 1 dòng oh_events.
    const ok=await sbPatchEvent(editedId,{name,date_str:date||null,team:team||null,venue:venue||null,event_pw:eventPw,btc_members:bms});
    if(!ok)alert('⚠️ Đã lưu sự kiện trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng bấm "Làm mới" để kiểm tra lại.');
  } else {
    if(!pwNew){if(errEl)errEl.textContent='⚠️ Vui lòng đặt mật khẩu cho sự kiện';return}
    if(pwNew!==pwNew2){if(errEl)errEl.textContent='⚠️ Mật khẩu nhập lại không khớp';return}
    const newEv={id:uid(),name,date,team,venue,eventPw:pwNew,btcMembers:bms,createdAt:Date.now()};
    db.events.push(newEv);
    S.unlockedEvs[newEv.id]=true;
    S.selEv=newEv.id;saveLocalOnly();S.modal=null;S.tab='guests';R();
    const ok=await sbUpsertOne('oh_events',evToDb(newEv));
    if(!ok)alert('⚠️ Đã tạo sự kiện trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng bấm "Làm mới" để kiểm tra lại trước khi gửi link cho người khác.');
  }
}

function delEv(id){if(!confirm('Xoá sự kiện này? Toàn bộ khách cũng bị xoá.'))return;
  db.events=db.events.filter(e=>e.id!==id);db.guests=db.guests.filter(g=>g.eventId!==id);
  if(S.selEv===id)S.selEv=null;saveLocalOnly();sbDel('oh_events',id);R()}

async function saveG(){
  const eventId=document.getElementById('g_ev')?.value;
  const name=document.getElementById('g_n')?.value?.trim();
  const phone=document.getElementById('g_ph')?.value?.trim();
  const systemCode=document.getElementById('g_syscode')?.value?.trim();
  const prmName=document.getElementById('g_prm')?.value?.trim();
  const tcbRegion=document.getElementById('g_reg')?.value?.trim();
  const unit=document.getElementById('g_unit')?.value?.trim();
  const sihName=document.getElementById('g_sih')?.value?.trim();
  const note=document.getElementById('g_note')?.value?.trim();
  if(!name){alert('Vui lòng nhập họ tên KH');return}
  if(!eventId){alert('Vui lòng chọn sự kiện');return}
  // Sau ngày event: không cho thêm KH mới; nhưng sửa thông tin tĩnh KH hiện có vẫn OK
  if(isEvLocked(getEvById(eventId))&&S.modal!=='edit_g'){alert('Sự kiện đã kết thúc. Không thể thêm khách mới.');closeM();return;}
  const rawComps=getComps('add');

  let isEditMode=false,editedFields=null,newGuestRow=null;

  if(S.modal==='edit_g'&&S.editGid){
    const idx=db.guests.findIndex(g=>g.id===S.editGid);
    if(idx>-1){
      const ex=db.guests[idx];
      const oldComps=ex.companions||[];
      const newComps=rawComps.map(rc=>{const match=oldComps.find(oc=>oc.name===rc.name&&oc.code);
        if(match)return{...match,phone:rc.phone};
        return{id:uid(),name:rc.name,phone:rc.phone,code:genCode(eventId),checkedIn:false,checkinTime:null,checkinBy:null}});
      db.guests[idx]={...ex,eventId,name,phone,systemCode,prmName,tcbRegion,unit,sihName,note,companions:newComps};
      S.ticketGid=S.editGid;
      isEditMode=true;
      editedFields={name,phone,system_code:systemCode,prm_name:prmName,tcb_region:tcbRegion,unit,sih_name:sihName,note,companions:newComps};
    }
  } else {
    const guestCode=genCode(eventId);
    const companions=rawComps.map(rc=>({id:uid(),name:rc.name,phone:rc.phone,code:genCode(eventId),checkedIn:false,checkinTime:null,checkinBy:null}));
    const ng={id:uid(),eventId,guestCode,systemCode,name,phone,prmName,tcbRegion,unit,sihName,note,companions,checkedIn:false,checkinTime:null,checkinBy:null,createdAt:Date.now()};
    db.guests.push(ng);
    S.ticketGid=ng.id;
    newGuestRow=ng;
  }
  S.selEv=eventId;saveLocalOnly();S.editGid=null;S.modal='tickets';R();

  // Trước đây: save() POST nguyên cả mảng db.guests mỗi lần thêm/sửa 1 khách — kéo theo rủi ro đè
  // check-in của các khách khác nếu local state của thiết bị này đang cũ hơn server. Giờ chỉ ghi
  // đúng 1 dòng vừa tạo/sửa.
  const ticketGid=S.ticketGid;
  const ok=isEditMode
    ? await sbPatchGuest(ticketGid,editedFields)
    : await sbUpsertOne('oh_guests',gToDb(newGuestRow));
  if(!ok)alert('⚠️ Đã lưu khách trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng bấm "Làm mới" để kiểm tra lại trước khi phát vé.');
}

function chkEditPw(){
  const pw=document.getElementById('epw')?.value||'';
  if(pw===ADMIN_PW){S.modal='edit_form';R()}
  else{const el=document.getElementById('epw_err');if(el)el.textContent='⚠️ Mật khẩu không đúng.'}}

async function doEdit(){
  const g=db.guests.find(x=>x.id===S.editGid);if(!g)return;
  const idx=db.guests.indexOf(g);
  const name=document.getElementById('eg_n')?.value?.trim()||g.name;
  const phone=document.getElementById('eg_ph')?.value?.trim()||g.phone;
  const systemCode=document.getElementById('eg_syscode')?.value?.trim();
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
  db.guests[idx]={...g,name,phone,systemCode,prmName,tcbRegion,unit,sihName,note,companions:updComps};
  saveLocalOnly();S.modal=null;S.editGid=null;R();
  const ok=await sbPatchGuest(g.id,{name,phone,system_code:systemCode,prm_name:prmName,tcb_region:tcbRegion,unit,sih_name:sihName,note,companions:updComps});
  if(!ok)alert('⚠️ Đã lưu thay đổi trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng bấm "Làm mới" để kiểm tra lại.');
}

function doDel(){
  const pw=document.getElementById('dpw')?.value||'';
  if(pw!==ADMIN_PW){const el=document.getElementById('dpw_err');if(el)el.textContent='⚠️ Mật khẩu không đúng.';return}
  const gid=S.delGid;
  db.guests=db.guests.filter(g=>g.id!==gid);saveLocalOnly();sbDel('oh_guests',gid);S.modal=null;S.delGid=null;R()}

async function doCpEdit(){
  const {gid,cpId}=S.cpEdit||{};
  const g=db.guests.find(x=>x.id===gid);if(!g)return;
  const idx=db.guests.indexOf(g);
  const cpIdx=(g.companions||[]).findIndex(x=>x.id===cpId);if(cpIdx<0)return;
  const name=document.getElementById('cpe_n')?.value?.trim();
  const phone=document.getElementById('cpe_ph')?.value?.trim();
  if(!name){alert('Vui lòng nhập họ tên');return}
  db.guests[idx].companions[cpIdx]={...db.guests[idx].companions[cpIdx],name,phone};
  saveLocalOnly();S.modal=null;S.cpEdit=null;R();
  const ok=await sbPatchGuest(g.id,{companions:db.guests[idx].companions});
  if(!ok)alert('⚠️ Đã sửa người đi kèm trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng bấm "Làm mới" để kiểm tra lại.');
}

async function doCpDel(){
  const pw=document.getElementById('cpdpw')?.value||'';
  if(pw!==ADMIN_PW){const el=document.getElementById('cpdpw_err');if(el)el.textContent='⚠️ Mật khẩu không đúng.';return}
  const {gid,cpId}=S.cpDel||{};
  const gIdx=db.guests.findIndex(x=>x.id===gid);if(gIdx<0)return;
  db.guests[gIdx].companions=(db.guests[gIdx].companions||[]).filter(x=>x.id!==cpId);
  saveLocalOnly();S.modal=null;S.cpDel=null;R();
  const ok=await sbPatchGuest(db.guests[gIdx].id,{companions:db.guests[gIdx].companions});
  if(!ok)alert('⚠️ Đã xoá người đi kèm trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng bấm "Làm mới" để kiểm tra lại.');
}

async function doCpAdd(){
  const gid=S.cpAdd;
  const gIdx=db.guests.findIndex(x=>x.id===gid);if(gIdx<0)return;
  const name=document.getElementById('cpa_n')?.value?.trim();
  const phone=document.getElementById('cpa_ph')?.value?.trim();
  if(!name){alert('Vui lòng nhập họ tên');return}
  const newCp={id:uid(),name,phone,code:genCode(db.guests[gIdx].eventId),checkedIn:false,checkinTime:null,checkinBy:null};
  if(!db.guests[gIdx].companions)db.guests[gIdx].companions=[];
  db.guests[gIdx].companions.push(newCp);
  saveLocalOnly();
  S.cpTicket={gid,cpId:newCp.id};S.cpAdd=null;S.modal='cp_ticket';R();
  setTimeout(()=>mkCpQR(),120);
  const ok=await sbPatchGuest(db.guests[gIdx].id,{companions:db.guests[gIdx].companions});
  if(!ok)alert('⚠️ Đã thêm người đi kèm trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng bấm "Làm mới" để kiểm tra lại.');
}

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

async function togCI(gid,type,cid){
  const g=db.guests.find(x=>x.id===gid);if(!g)return;
  const ev=getEvById(g.eventId);
  if(isEvLocked(ev)){alert('Sự kiện đã kết thúc. Không thể thay đổi trạng thái check-in.');return;}
  const person=type==='c'?(g.companions||[]).find(x=>x.id===cid):g;
  if(!person)return;
  if(person.cancelled){alert('Khách đã cancel. Vui lòng nhấn " Huỷ Cancel" trước khi check-in.');return;}
  if(person.checkedIn){
    if(!confirm(`Huỷ check-in của ${person.name}?`))return;
    const personName=person.name;
    person.checkedIn=false;person.checkinTime=null;person.checkinBy=null;
    saveLocalOnly();R();
    // Trước đây bước này KHÔNG đồng bộ lên Supabase — chỉ ghi local rồi gọi save() (full-array sync
    // debounce 600ms), dễ bị đè bởi thiết bị khác trước khi kịp chạy. Giờ ghi atomic + có cảnh báo.
    const patchFields = type==='g'
      ? {checked_in:false,checkin_time:null,checkin_by:null}
      : {companions:(g.companions||[])};
    const ok = await sbPatchGuest(g.id, patchFields);
    if(!ok)alert(`⚠️ Đã huỷ check-in của "${personName}" trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng bấm "Làm mới" để kiểm tra lại.`);
    return;
  }
  S.adminCI={gid,type,cpId:cid||null};S.modal='admin_ci';R();
  setTimeout(()=>{const el=document.getElementById('aci_ph');if(el)el.focus()},80);
}

async function doAdminCI(){
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
  const now=new Date().toISOString();
  const personName=person.name;
  person.checkedIn=true;person.checkinTime=now;person.checkinBy='admin';
  saveLocalOnly();S.modal=null;S.adminCI=null;R();
  // Trước đây bước này chỉ gọi save() (full-array sync debounce), KHÔNG có patch atomic và KHÔNG
  // cảnh báo khi thất bại — đây là nguyên nhân chính của hiện tượng "tick check-in xong rồi biến mất"
  // khi có người bấm "Làm mới" sau đó. Giờ ghi atomic ngay + cảnh báo rõ nếu không thành công.
  const patchFields = type==='g'
    ? {checked_in:true,checkin_time:now,checkin_by:'admin'}
    : {companions:(g.companions||[])};
  const ok = await sbPatchGuest(g.id, patchFields);
  if(!ok)alert(`⚠️ Đã ghi nhận check-in cho "${personName}" trên thiết bị này, nhưng CHƯA đồng bộ được lên hệ thống trung tâm (có thể do mất mạng hoặc lỗi Supabase).\n\nVui lòng bấm "Làm mới" ngay để kiểm tra lại — nếu không, trạng thái check-in này có thể bị mất khi làm mới dữ liệu.`);
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

async function startCI(){
  const code=(document.getElementById('ci_in')?.value||'').toUpperCase().trim();
  if(!code){document.getElementById('ci_err').textContent='⚠️ Vui lòng nhập mã';return}
  const found=findCode(S.ciEv,code);
  if(!found){document.getElementById('ci_err').textContent='⚠️ Không tìm thấy mã trong sự kiện này';return}
  const person=found.person;
  if(person.checkedIn){document.getElementById('ci_err').textContent='⚠️ Đã check-in lúc '+fmtDT(person.checkinTime);return}
  if(!person.phone){
    const now=new Date().toISOString();
    person.checkedIn=true;person.checkinTime=now;person.checkinBy=S.ciOp?.code||'btc';saveLocalOnly();
    const patchFields = found.type==='guest'
      ? {checked_in:true,checkin_time:now,checkin_by:person.checkinBy}
      : {companions:(found.guest.companions||[])};
    const ok=await sbPatchGuest(found.guest.id, patchFields);
    S.ciSyncWarn=!ok;
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

async function finishCI(){
  const st=S.ciState;
  const g=db.guests.find(x=>x.id===st.guest.id);if(!g){S.ciState={step:'err',msg:'Lỗi hệ thống'};R();return}
  const now=new Date().toISOString();
  const checkinBy=S.ciOp?.code||'btc';
  if(st.type==='guest'){g.checkedIn=true;g.checkinTime=now;g.checkinBy=checkinBy}
  else{const c=(g.companions||[]).find(x=>x.id===st.person.id);if(c){c.checkedIn=true;c.checkinTime=now;c.checkinBy=checkinBy}}
  saveLocalOnly();
  const patchFields = st.type==='guest'
    ? {checked_in:true,checkin_time:now,checkin_by:checkinBy}
    : {companions:(g.companions||[])};
  const ok=await sbPatchGuest(g.id, patchFields);
  S.ciSyncWarn=!ok;
  S.ciState={step:'done',type:st.type,guest:g,person:st.type==='guest'?g:(g.companions||[]).find(x=>x.id===st.person.id),code:st.code};R()}

function expCSV(){
  const ev=db.events.find(e=>e.id===S.selEv);
  const rows=[['STT','Loại','Mã','Mã Hệ thống','Họ tên','SĐT','KH gốc (nếu đi kèm)','PRM','Vùng TCB','Đơn vị','SIH','Note','Walk-in','Trạng thái','Giờ check-in','BTC','Lý do cancel']];
  let n=0;
  egs(S.selEv).forEach(g=>{n++;
    const gStatus=g.cancelled?'Cancel':g.checkedIn?'Đã vào':'Chưa';
    rows.push([n,'KH chính',g.guestCode,g.systemCode||'',g.name,g.phone||'','',g.prmName||'',g.tcbRegion||'',g.unit||'',g.sihName||'',g.note||'',g.walkin?'Walk-in':'',gStatus,g.checkinTime?fmtDT(g.checkinTime):'',g.checkinBy||'',g.cancelNote||'']);
    (g.companions||[]).forEach(c=>{n++;
      const cStatus=c.cancelled?'Cancel':c.checkedIn?'Đã vào':'Chưa';
      rows.push([n,'Đi kèm',c.code,'',c.name,c.phone||'',g.name,g.prmName||'',g.tcbRegion||'','','','',g.walkin?'(Walk-in Main)':'',cStatus,c.checkinTime?fmtDT(c.checkinTime):'',c.checkinBy||'',c.cancelNote||''])})});
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
  a.download=`checkin_${(ev?.name||'').replace(/[^a-zA-Z0-9]/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`;a.click()}


/* ============================================================
   WALK-IN MODAL
   ============================================================ */
function rWalkinM(){
  const ev=getEvById(S.selEv);
  return`<div class="mh">🚶 Tạo khách Walk-in</div>
    <div style="background:#EDE9FE;border:1px solid #DDD6FE;border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
      <span style="font-size:18px">🚶</span>
      <div>
        <div style="font-weight:700;font-size:13px;color:#5B21B6">Khách Walk-in — đăng ký tại chỗ ngày ${fmtD(ev?.date)}</div>
        <div style="font-size:11px;color:#7C3AED">Hệ thống sẽ gắn nhãn Walk-in và tạo mã vào ngay. Không thể thêm Walk-in sau khi sự kiện kết thúc.</div>
      </div>
    </div>
    <div class="fg"><label>Sự kiện</label>
      <div style="padding:9px 12px;background:#f4f7fb;border-radius:8px;font-size:13px;color:#555">${ev?.name||'—'} · ${fmtD(ev?.date)}</div>
    </div>
    <div class="sec">Thông tin khách Walk-in</div>
    <div class="g3">
      <div class="fg"><label>Họ và tên *</label><input id="wi_n" placeholder="Nguyễn Văn A" autofocus/></div>
      <div class="fg"><label>Số điện thoại</label><input id="wi_ph" type="tel" placeholder="09xxxxxxxx"/></div>
      <div class="fg"><label>Mã Hệ thống <span style="font-weight:400;color:#aaa">(nếu có)</span></label><input id="wi_syscode" placeholder="OH-xxxxx"/></div>
    </div>
    <div class="sec">Người đi kèm <span style="text-transform:none;letter-spacing:0;font-weight:400">(tuỳ chọn)</span></div>
    <div id="wi_cp_w"></div>
    <button class="btn sm" onclick="addWiCR()" style="margin-bottom:4px">+ Thêm đi kèm</button>
    <div class="sec">Thông tin chăm sóc</div>
    <div class="g3">
      <div class="fg"><label>Tên PRM</label><input id="wi_prm" placeholder="Tên PRM"/></div>
      <div class="fg"><label>Vùng TCB</label><input id="wi_reg" placeholder="Vùng 1 HCM"/></div>
      <div class="fg"><label>Đơn vị</label><input id="wi_unit" placeholder="CN Thủ Đức"/></div>
    </div>
    <div class="g2">
      <div class="fg"><label>Tên SIH</label><input id="wi_sih" placeholder="Tên SIH"/></div>
      <div class="fg"><label>Note / Lưu ý</label><input id="wi_note" placeholder="Ghi chú..."/></div>
    </div>
    <div class="mf">
      <button class="btn" onclick="closeM()">Huỷ</button>
      <button class="btn" style="background:#7C3AED;color:#fff;border-color:#7C3AED" onclick="saveWalkin()">🚶 Tạo Walk-in & Tạo vé</button>
    </div>`;
}

function addWiCR(){
  const w=document.getElementById('wi_cp_w');if(!w)return;
  const i=w.querySelectorAll('.wi-cp-r').length;
  const d=document.createElement('div');d.className='wi-cp-r cp-r';d.id='wicr_'+i;
  d.innerHTML=`<div class="g2" style="margin-bottom:0">
    <div class="fg" style="margin-bottom:0"><label>Tên đi kèm ${i+1}</label><input id="wicn_${i}" placeholder="Họ và tên"/></div>
    <div class="fg" style="margin-bottom:0"><label>SĐT</label><input id="wicp_${i}" type="tel" placeholder="09xxxxxxxx"/></div>
  </div>
  ${i>0?`<button class="btn xs red" onclick="rmWiCR(${i})" style="margin-top:6px">Xoá đi kèm này</button>`:''}`;
  w.appendChild(d);
}
function rmWiCR(i){const r=document.getElementById('wicr_'+i);if(r)r.remove();}
function getWiComps(){
  const w=document.getElementById('wi_cp_w');if(!w)return[];
  const cs=[];
  w.querySelectorAll('.wi-cp-r').forEach(r=>{
    const idx=r.id.replace(/[^0-9]/g,'');
    const n=(document.getElementById('wicn_'+idx)?.value||'').trim();
    const p=(document.getElementById('wicp_'+idx)?.value||'').trim();
    if(n)cs.push({name:n,phone:p});
  });
  return cs;
}

async function saveWalkin(){
  const eventId=S.selEv;
  const ev=getEvById(eventId);
  if(!isWalkinAllowed(ev)){alert('Walk-in chỉ khả dụng từ ngày tổ chức sự kiện trở đi.');closeM();return;}
  const name=(document.getElementById('wi_n')?.value||'').trim();
  if(!name){alert('Vui lòng nhập họ tên khách Walk-in');return;}
  const phone=(document.getElementById('wi_ph')?.value||'').trim();
  const systemCode=(document.getElementById('wi_syscode')?.value||'').trim();
  const prmName=(document.getElementById('wi_prm')?.value||'').trim();
  const tcbRegion=(document.getElementById('wi_reg')?.value||'').trim();
  const unit=(document.getElementById('wi_unit')?.value||'').trim();
  const sihName=(document.getElementById('wi_sih')?.value||'').trim();
  const note=(document.getElementById('wi_note')?.value||'').trim();
  const rawComps=getWiComps();
  const guestCode=genCode(eventId);
  const companions=rawComps.map(rc=>({id:uid(),name:rc.name,phone:rc.phone,code:genCode(eventId),checkedIn:false,checkinTime:null,checkinBy:null}));
  const ng={
    id:uid(),eventId,guestCode,systemCode,name,phone,prmName,tcbRegion,unit,sihName,
    note:note?note:'[Walk-in]',
    walkin:true,  // ← flag Walk-in
    companions,checkedIn:false,checkinTime:null,checkinBy:null,createdAt:Date.now()
  };
  db.guests.push(ng);
  S.ticketGid=ng.id;
  saveLocalOnly();S.modal='tickets';R();
  const ok=await sbUpsertOne('oh_guests',gToDb(ng));
  if(!ok)alert('⚠️ Đã tạo Walk-in trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng bấm "Làm mới" để kiểm tra lại trước khi phát vé.');
}

/* ============================================================
   NEW FEATURES LOGIC: EXCEL EXPORT/IMPORT & ALL QR ZIP DOWNLOAD
   ============================================================ */

/* 1. Tải file Mẫu Excel đúng cấu trúc quy định */
function downloadExcelTemplate() {
  const headers = [
    ["Loại Khách (Gõ 'Main' hoặc 'Companion')", "Họ và Tên (*)", "Số Điện Thoại", "Tên PRM (Sales TCB)", "Vùng TCB", "Đơn vị (CN/PGD)", "Tên SIH (Sales OH)", "Note / Lưu ý", "Mã Hệ thống (OneHousing - chỉ áp dụng cho Main)"]
  ];
  const sampleData = [
    ["Main", "Nguyễn Văn A", "0901234567", "Lê PRM", "Vùng 1", "CN Sài Gòn", "Trần SIH", "Khách VIP bàn đầu", "OH-00123"],
    ["Companion", "Nguyễn Văn B (Đi kèm A)", "0907654321", "", "", "", "", "Đi cùng xe ông A", ""],
    ["Main", "Phạm Thị C", "0911223344", "Nguyễn PRM", "Vùng 2", "CN Hà Nội", "Vũ SIH", "", "OH-00456"]
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
          note: row[7] ? String(row[7]).trim() : '',
          systemCode: row[8] ? String(row[8]).trim() : ''
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
async function commitExcelImport() {
  if (!S.selEv) return;
  const eventId = S.selEv;
  const rawList = S.importData || [];
  
  let currentMainGuest = null;
  const createdGuests = []; // chỉ các khách MỚI tạo trong lượt import này — để đồng bộ đúng phạm vi

  rawList.forEach(item => {
    if (item.type === 'Main') {
      const guestCode = genCode(eventId);
      currentMainGuest = {
        id: uid(),
        eventId: eventId,
        guestCode: guestCode,
        systemCode: item.systemCode,
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
      createdGuests.push(currentMainGuest);
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
          systemCode: item.systemCode,
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
        createdGuests.push(currentMainGuest);
      }
    }
  });

  saveLocalOnly();
  closeM();
  // Trước đây: save() POST nguyên cả mảng db.guests (gồm cả những khách đã có sẵn từ trước) — với
  // sự kiện đã có sẵn vài trăm khách thì 1 lượt import vài chục dòng vẫn kéo theo re-upload toàn bộ,
  // tăng rủi ro đè check-in nếu local đang cũ hơn server. Giờ chỉ upsert đúng các dòng vừa tạo.
  const ok = await sbUpsertMany('oh_guests', createdGuests.map(gToDb));
  if (ok) {
    alert(`🎉 Đã import thành công ${createdGuests.length} khách mời từ Excel vào hệ thống!`);
  } else {
    alert(`⚠️ Đã lưu ${createdGuests.length} khách trên thiết bị này nhưng CHƯA đồng bộ đầy đủ lên hệ thống trung tâm Supabase (có thể do lỗi mạng). Vui lòng bấm "Làm mới" để kiểm tra và đồng bộ lại trước khi rời sự kiện.`);
  }
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
// Expose all functions to window scope (required for Vite module bundling)
window.R=R; window.doLogin=doLogin; window.doRefresh=doRefresh; window.doUrlCI=doUrlCI;
window.setTab=setTab; window.openGM=openGM; window.pickEv=pickEv; window.setSrch=setSrch;
window.setFil=setFil; window.openM=openM; window.openEdit=openEdit; window.openDel=openDel;
window.openTickets=openTickets; window.closeM=closeM; window.openEditEv=openEditEv;
window.openCpTicket=openCpTicket; window.openCpEdit=openCpEdit; window.openCpDel=openCpDel;
window.openAddComp=openAddComp; window.openCancel=openCancel; window.doCancel=doCancel;
window.undoCancel=undoCancel; window.goCI=goCI; window.backAdmin=backAdmin;
window.lockOut=lockOut; window.cancelCI=cancelCI; window.nextCI=nextCI;
window.addBR=addBR; window.rmBR=rmBR; window.addCR=addCR; window.rmCR=rmCR;
window.saveEv=saveEv; window.delEv=delEv; window.saveG=saveG;
window.chkEditPw=chkEditPw; window.doEdit=doEdit; window.doDel=doDel;
window.doCpEdit=doCpEdit; window.doCpDel=doCpDel; window.doCpAdd=doCpAdd;
window.mkQRs=mkQRs; window.mkCpQR=mkCpQR; window.dlTicket=dlTicket;
window.dlCpTicket=dlCpTicket; window.printAll=printAll;
window.tryUnlock=tryUnlock; window.startCI=startCI; window.confirmPhone=confirmPhone;
window.doAdminCI=doAdminCI; window.doEvUnlock=doEvUnlock;
window.expCSV=expCSV; window.togCI=togCI; window.togRpt=togRpt; window.setRptEv=setRptEv;
window.triggerExcelImport=triggerExcelImport; window.handleExcelImport=handleExcelImport;
window.downloadExcelTemplate=downloadExcelTemplate; window.commitExcelImport=commitExcelImport;
window.downloadAllQRsZip=downloadAllQRsZip;
window.openWalkin=openWalkin; window.saveWalkin=saveWalkin;
window.addWiCR=addWiCR; window.rmWiCR=rmWiCR;
