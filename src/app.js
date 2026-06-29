import jsQR from 'jsqr';

/* ============================================================
   CONFIG - tài khoản đăng nhập và mật khẩu xác nhận nội bộ
   ============================================================ */
const LOGIN_USER = "admin";
const DEFAULT_ADMIN_PW = "admin123";
const ADMIN_PW_SK = "oh_ci_admin_pw";
const ADMIN_ACCOUNTS_SK = "oh_ci_admin_accounts";
const ADMIN_SESSION_SK = "oh_ci_admin_session";
const ADMIN_SESSION_MS = 90*24*60*60*1000;
const SK = "oh_ci_v5";
const ROLE_DEFS={
  super_admin:{label:'Super Admin',badge:'Toàn quyền'},
  manager:{label:'Quản lý',badge:'Vận hành'},
  staff:{label:'Nhân viên',badge:'Thực thi'}
};

function getAdminPw(){
  return localStorage.getItem(ADMIN_PW_SK)||DEFAULT_ADMIN_PW;
}
function setAdminPw(pw){
  localStorage.setItem(ADMIN_PW_SK,pw);
}
function normalizeUsername(v){
  return (v||'').trim().toLowerCase();
}
function roleLabel(role){
  return ROLE_DEFS[role]?.label||ROLE_DEFS.staff.label;
}
function defaultAdminAccount(){
  return{id:'admin',username:LOGIN_USER,name:'Administrator',role:'super_admin',password:getAdminPw(),createdAt:Date.now(),updatedAt:Date.now()};
}
function saveAccounts(accounts){
  let superSeen=false;
  const clean=accounts.map(acc=>{
    let role=ROLE_DEFS[acc.role]?acc.role:'staff';
    if(role==='super_admin'){
      if(superSeen)role='manager';
      else superSeen=true;
    }
    return{
      ...acc,
      username:normalizeUsername(acc.username),
      role,
      updatedAt:acc.updatedAt||Date.now()
    };
  });
  if(!clean.some(acc=>acc.role==='super_admin')){
    const adminIdx=clean.findIndex(acc=>acc.username===LOGIN_USER);
    if(adminIdx>=0)clean[adminIdx]={...clean[adminIdx],role:'super_admin'};
    else clean.unshift(defaultAdminAccount());
  }
  localStorage.setItem(ADMIN_ACCOUNTS_SK,JSON.stringify(clean));
  const admin=clean.find(acc=>acc.username===LOGIN_USER);
  if(admin?.password)setAdminPw(admin.password);
}
function loadAccounts(){
  try{
    const raw=localStorage.getItem(ADMIN_ACCOUNTS_SK);
    let accounts=raw?JSON.parse(raw):[];
    if(!Array.isArray(accounts))accounts=[];
    let superSeen=false;
    accounts=accounts
      .filter(acc=>acc&&acc.username)
      .map(acc=>{
        let role=ROLE_DEFS[acc.role]?acc.role:'staff';
        if(role==='super_admin'){
          if(superSeen)role='manager';
          else superSeen=true;
        }
        return{
          id:acc.id||uid(),
          username:normalizeUsername(acc.username),
          name:acc.name||acc.fullName||acc.username,
          role,
          password:acc.password||'',
          createdAt:acc.createdAt||Date.now(),
          updatedAt:acc.updatedAt||Date.now()
        };
      });
    if(!accounts.some(acc=>acc.username===LOGIN_USER)){
      accounts.unshift(defaultAdminAccount());
      saveAccounts(accounts);
    }else if(!accounts.some(acc=>acc.role==='super_admin')){
      const adminIdx=accounts.findIndex(acc=>acc.username===LOGIN_USER);
      accounts[adminIdx]={...accounts[adminIdx],role:'super_admin'};
      saveAccounts(accounts);
    }else if(accounts.filter(acc=>acc.role==='super_admin').length>1){
      saveAccounts(accounts);
    }
    return accounts;
  }catch(e){
    const accounts=[defaultAdminAccount()];
    saveAccounts(accounts);
    return accounts;
  }
}
function findAccount(username){
  const u=normalizeUsername(username);
  return loadAccounts().find(acc=>acc.username===u)||null;
}
function currentAccount(){
  return findAccount(S.currentUser)||findAccount(LOGIN_USER);
}
function isSuperAdmin(){
  return currentAccount()?.role==='super_admin';
}
function isManager(){
  return currentAccount()?.role==='manager';
}
function canManageAccounts(){
  const role=currentAccount()?.role;
  return role==='super_admin'||role==='manager';
}
function canManageAccountTarget(acc){
  if(!acc)return false;
  if(isSuperAdmin())return true;
  if(isManager())return acc.role==='manager'||acc.role==='staff';
  return false;
}
function canAssignAccountRole(role,target=null){
  if(!ROLE_DEFS[role])return false;
  if(role==='super_admin')return !!target&&target.role==='super_admin'&&isSuperAdmin();
  return canManageAccounts();
}
function keepAdminSession(username=LOGIN_USER){
  try{localStorage.setItem(ADMIN_SESSION_SK,JSON.stringify({until:Date.now()+ADMIN_SESSION_MS,user:normalizeUsername(username)||LOGIN_USER}))}catch(e){}
}
function clearAdminSession(){
  try{localStorage.removeItem(ADMIN_SESSION_SK)}catch(e){}
}
function getAdminSessionUser(){
  try{
    const raw=localStorage.getItem(ADMIN_SESSION_SK);
    if(!raw)return null;
    const session=JSON.parse(raw);
    if(!session?.until||Number(session.until)<Date.now()){clearAdminSession();return null}
    const username=normalizeUsername(session.user||LOGIN_USER);
    if(!findAccount(username)){clearAdminSession();return null}
    keepAdminSession(username);
    return username;
  }catch(e){
    clearAdminSession();
    return null;
  }
}
function hasAdminSession(){
  return !!getAdminSessionUser();
}
function esc(v){
  return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function jsStr(v){
  return String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,' ');
}
function cssEscape(v){
  return window.CSS?.escape?CSS.escape(String(v)):String(v??'').replace(/\\/g,'\\\\').replace(/"/g,'\\"');
}
function normSearchText(v){
  return String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
function filterDDOptions(menu,query){
  if(!menu)return;
  const q=normSearchText(query).trim();
  let shown=0;
  menu.querySelectorAll('.dd-option').forEach(opt=>{
    const ok=!q||normSearchText(opt.dataset.label||opt.textContent).includes(q);
    opt.hidden=!ok;
    if(ok)shown++;
  });
  const empty=menu.querySelector('.dd-empty');
  if(empty)empty.hidden=shown>0;
}
function updateSearchClear(input){
  const wrap=input?.closest('.search-control,.dd-search');
  if(wrap)wrap.classList.toggle('has-value',!!input.value);
}
function resetDDSearch(dd){
  const input=dd?.querySelector('.dd-search-input');
  if(!input)return;
  input.value='';
  filterDDOptions(dd.querySelector('.dd-menu'),'');
  updateSearchClear(input);
}
function focusDDSearch(dd){
  const input=dd?.querySelector('.dd-search-input');
  if(input)setTimeout(()=>{input.focus();input.select();},30);
}
function closeDropdowns(){
  document.querySelectorAll('.dd.open').forEach(dd=>dd.classList.remove('open'));
}
function closeDropdownsOnOutsidePointer(event){
  if(event.target?.closest?.('.dd'))return;
  closeDropdowns();
}
function toggleDD(id,event){
  if(event)event.stopPropagation();
  const dd=document.querySelector(`[data-dd="${cssEscape(id)}"]`);
  if(!dd)return;
  const isOpen=dd.classList.contains('open');
  closeDropdowns();
  if(!isOpen){resetDDSearch(dd);dd.classList.add('open');focusDDSearch(dd);}
}
function filterDD(id,query,event){
  if(event)event.stopPropagation();
  const dd=document.querySelector(`[data-dd="${cssEscape(id)}"]`);
  filterDDOptions(dd?.querySelector('.dd-menu'),query);
  updateSearchClear(event?.target);
}
function clearDDSearch(id,event){
  if(event)event.stopPropagation();
  const dd=document.querySelector(`[data-dd="${cssEscape(id)}"]`);
  const input=dd?.querySelector('.dd-search-input');
  if(!input)return;
  input.value='';
  filterDDOptions(dd.querySelector('.dd-menu'),'');
  updateSearchClear(input);
  input.focus();
}
function setDD(id,value,event,onChange){
  if(event)event.stopPropagation();
  const input=document.getElementById(id);
  const dd=document.querySelector(`[data-dd="${cssEscape(id)}"]`);
  if(input)input.value=value;
  if(dd){
    const option=dd.querySelector(`[data-dd-value="${cssEscape(value)}"]`);
    const label=option?.dataset.label||'';
    const labelEl=dd.querySelector('.dd-label');
    if(labelEl)labelEl.textContent=label;
    dd.querySelectorAll('.dd-option').forEach(btn=>btn.classList.toggle('selected',btn.dataset.ddValue===value));
    dd.classList.remove('open');
  }
  if(onChange&&typeof window[onChange]==='function')window[onChange](value);
}
function dropdownHTML(id,value,options,opts={}){
  const selected=options.find(opt=>String(opt.value)===String(value));
  const label=selected?.label||opts.placeholder||'Chọn';
  const className=opts.className||'';
  const onChange=opts.onChange||'';
  const style=opts.style?` style="${esc(opts.style)}"`:'';
  return`<div class="dd ${className}" data-dd="${esc(id)}"${style}>
    <input type="hidden" id="${esc(id)}" value="${esc(value||'')}"/>
    <button type="button" class="dd-btn" onclick="toggleDD('${jsStr(id)}',event)">
      <span class="dd-label">${esc(label)}</span>
      <span class="material-symbols-rounded mi dd-caret" aria-hidden="true">keyboard_arrow_down</span>
    </button>
    <div class="dd-menu">
      ${options.length>12?`<div class="dd-search" onclick="event.stopPropagation()"><span class="material-symbols-rounded mi" aria-hidden="true">search</span><input class="dd-search-input" placeholder="Tìm kiếm..." oninput="filterDD('${jsStr(id)}',this.value,event)" onclick="event.stopPropagation()"/><button type="button" class="dd-search-clear" onclick="clearDDSearch('${jsStr(id)}',event)" title="Xóa tìm kiếm"><span class="material-symbols-rounded mi" aria-hidden="true">close</span></button></div>`:''}
      ${options.map(opt=>`<button type="button" class="dd-option ${String(opt.value)===String(value)?'selected':''}" data-dd-value="${esc(opt.value)}" data-label="${esc(opt.label)}" onclick="setDD('${jsStr(id)}','${jsStr(opt.value)}',event,'${jsStr(onChange)}')">${esc(opt.label)}</button>`).join('')}
      ${options.length>12?`<div class="dd-empty" hidden>Không tìm thấy kết quả</div>`:''}
    </div>
  </div>`;
}
function enhanceDropdowns(root=document.getElementById('root')){
  if(!root)return;
  root.querySelectorAll('select').forEach(select=>{
    if(select.dataset.ddEnhanced)return;
    select.dataset.ddEnhanced='1';
    const dd=document.createElement('div');
    dd.className='dd';
    if(select.style.width)dd.style.width=select.style.width;
    if(select.style.minWidth)dd.style.minWidth=select.style.minWidth;
    if(select.classList.contains('selx'))dd.classList.add('dd-inline');

    const button=document.createElement('button');
    button.type='button';
    button.className='dd-btn';
    button.setAttribute('aria-haspopup','listbox');
    button.innerHTML='<span class="dd-label"></span><span class="material-symbols-rounded mi dd-caret" aria-hidden="true">keyboard_arrow_down</span>';

    const menu=document.createElement('div');
    menu.className='dd-menu';
    menu.setAttribute('role','listbox');

    const sync=()=>{
      const selected=select.options[select.selectedIndex];
      const selectedBtn=menu.querySelector(`[data-value="${cssEscape(select.value)}"]`);
      const label=selectedBtn?.dataset.label||selected?.textContent||'Chọn';
      const labelEl=button.querySelector('.dd-label');
      if(labelEl)labelEl.textContent=label;
      menu.querySelectorAll('.dd-option').forEach(opt=>{
        opt.classList.toggle('selected',opt.dataset.value===select.value);
      });
    };

    if(select.options.length>12){
      const searchWrap=document.createElement('div');
      searchWrap.className='dd-search';
      searchWrap.innerHTML='<span class="material-symbols-rounded mi" aria-hidden="true">search</span><input class="dd-search-input" placeholder="Tìm kiếm..."/><button type="button" class="dd-search-clear" title="Xóa tìm kiếm"><span class="material-symbols-rounded mi" aria-hidden="true">close</span></button>';
      searchWrap.addEventListener('click',event=>event.stopPropagation());
      const searchInput=searchWrap.querySelector('.dd-search-input');
      const searchClear=searchWrap.querySelector('.dd-search-clear');
      searchInput.addEventListener('click',event=>event.stopPropagation());
      searchInput.addEventListener('input',()=>{filterDDOptions(menu,searchInput.value);updateSearchClear(searchInput)});
      searchClear.addEventListener('click',event=>{
        event.stopPropagation();
        searchInput.value='';
        filterDDOptions(menu,'');
        updateSearchClear(searchInput);
        searchInput.focus();
      });
      menu.appendChild(searchWrap);
    }

    Array.from(select.options).forEach(option=>{
      const optBtn=document.createElement('button');
      optBtn.type='button';
      optBtn.className='dd-option';
      optBtn.dataset.value=option.value;
      optBtn.dataset.label=option.textContent;
      optBtn.textContent=option.textContent;
      optBtn.disabled=option.disabled;
      optBtn.setAttribute('role','option');
      optBtn.addEventListener('click',event=>{
        event.stopPropagation();
        select.value=option.value;
        sync();
        dd.classList.remove('open');
        select.dispatchEvent(new Event('change',{bubbles:true}));
      });
      menu.appendChild(optBtn);
    });

    if(select.options.length>12){
      const empty=document.createElement('div');
      empty.className='dd-empty';
      empty.hidden=true;
      empty.textContent='Không tìm thấy kết quả';
      menu.appendChild(empty);
    }

    button.addEventListener('click',event=>{
      event.stopPropagation();
      const wasOpen=dd.classList.contains('open');
      closeDropdowns();
      dd.classList.toggle('open',!wasOpen);
      if(!wasOpen){resetDDSearch(dd);focusDDSearch(dd);}
    });
    select.addEventListener('change',sync);
    dd.appendChild(button);
    dd.appendChild(menu);
    select.classList.add('native-select-hidden');
    select.setAttribute('aria-hidden','true');
    select.insertAdjacentElement('afterend',dd);
    sync();
  });
}
document.addEventListener('pointerdown',closeDropdownsOnOutsidePointer,true);
document.addEventListener('click',closeDropdowns);

const MI_BY_EMOJI={
  '⚠️':'warning','⚠':'warning','📡':'settings_input_antenna','✅':'check_circle','🔄':'refresh','⏳':'hourglass_empty',
  '📊':'bar_chart','📅':'calendar_month','👥':'groups','👤':'person','📷':'photo_camera','📭':'inventory_2',
  '🔐':'lock','🔒':'lock','🔓':'lock_open','📌':'push_pin','🏢':'apartment','🏦':'account_balance',
  '📍':'location_on','🔑':'key','📋':'assignment','✏️':'edit','✏':'edit','🗑️':'delete','🗑':'delete',
  '👆':'touch_app','☝️':'touch_app','☝':'touch_app','🔍':'search','🚫':'block','🚶':'directions_walk',
  '📥':'file_download','📄':'description','🗂️':'folder_zip','🗂':'folder_zip','🎫':'confirmation_number',
  '🎉':'celebration','❌':'cancel','💾':'save','🖨️':'print','🖨':'print','🔢':'pin','🤝':'handshake',
  '⬇️':'download','⬇':'download','✕':'close','↩':'undo','←':'arrow_back','→':'arrow_forward','▲':'keyboard_arrow_up','▼':'keyboard_arrow_down','🎪':'festival'
};
const MI_EMOJI_RE=new RegExp(Object.keys(MI_BY_EMOJI).sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'gu');
let miObserver=null;
let miBusy=false;

function stripMaterialEmojiText(text){
  if(!text)return text;
  MI_EMOJI_RE.lastIndex=0;
  return text.replace(MI_EMOJI_RE,'').replace(/[ \t]{2,}/g,' ').trim();
}
function makeMaterialIcon(emoji){
  const span=document.createElement('span');
  span.className='material-symbols-rounded mi';
  span.setAttribute('aria-hidden','true');
  span.textContent=MI_BY_EMOJI[emoji]||'emoji_symbols';
  return span;
}
function materializeEmojiTextNode(node){
  const text=node.nodeValue;
  MI_EMOJI_RE.lastIndex=0;
  if(!MI_EMOJI_RE.test(text))return;
  MI_EMOJI_RE.lastIndex=0;
  const frag=document.createDocumentFragment();
  let last=0;
  text.replace(MI_EMOJI_RE,(emoji,offset)=>{
    if(offset>last)frag.appendChild(document.createTextNode(text.slice(last,offset)));
    frag.appendChild(makeMaterialIcon(emoji));
    last=offset+emoji.length;
    return emoji;
  });
  if(last<text.length)frag.appendChild(document.createTextNode(text.slice(last)));
  node.parentNode.replaceChild(frag,node);
}
function materializeIcons(root=document.getElementById('root')){
  if(!root||miBusy)return;
  miBusy=true;
  try{
    root.querySelectorAll('option').forEach(opt=>{opt.textContent=stripMaterialEmojiText(opt.textContent)});
    root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el=>{
      ['placeholder','title','aria-label'].forEach(attr=>{
        if(el.hasAttribute(attr))el.setAttribute(attr,stripMaterialEmojiText(el.getAttribute(attr)));
      });
    });
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
      acceptNode(node){
        const parent=node.parentElement;
        if(!parent)return NodeFilter.FILTER_REJECT;
        if(parent.closest('script,style,textarea,option,.material-symbols-rounded'))return NodeFilter.FILTER_REJECT;
        MI_EMOJI_RE.lastIndex=0;
        return MI_EMOJI_RE.test(node.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
      }
    });
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(materializeEmojiTextNode);
  }finally{
    miBusy=false;
  }
}
function ensureMaterialIconObserver(root=document.getElementById('root')){
  if(!root||miObserver)return;
  miObserver=new MutationObserver(()=>{
    if(miBusy)return;
    requestAnimationFrame(()=>materializeIcons(root));
  });
  miObserver.observe(root,{childList:true,subtree:true,characterData:true});
}

/* ============================================================
   SUPABASE CONFIG — điền thông tin của bạn vào đây
   ============================================================ */
const API_ON = true;
const API_BASE = '';
const REALTIME_POLL_MS = 2500;


/* ============================================================
   BASE URL — URL GitHub Pages sau khi deploy
   ============================================================ */
const BASE_URL = window.location.origin;

/* ============================================================
   DATA LAYER
   ============================================================ */
function dbToEv(r){return{id:r.id,name:r.name,date:r.date_str,team:r.team,venue:r.venue,eventPw:r.event_pw,btcMembers:r.btc_members||[],createdAt:r.created_at}}
function dbToG(r){return{id:r.id,eventId:r.event_id,guestCode:r.guest_code,systemCode:r.system_code,name:r.name,phone:r.phone,prmName:r.prm_name,tcbRegion:r.tcb_region,unit:r.unit,sihName:r.sih_name,note:r.note,companions:r.companions||[],checkedIn:!!r.checked_in,checkinTime:r.checkin_time,checkinBy:r.checkin_by,cancelled:!!r.cancelled,cancelNote:r.cancel_note,walkin:!!r.walkin,createdAt:r.created_at}}
function evToDb(e){return{id:e.id,name:e.name,date_str:e.date||null,team:e.team||null,venue:e.venue||null,event_pw:e.eventPw||'',btc_members:e.btcMembers||[],created_at:e.createdAt||Date.now()}}
function gToDb(g){return{id:g.id,event_id:g.eventId,guest_code:g.guestCode,system_code:g.systemCode||null,name:g.name,phone:g.phone||null,prm_name:g.prmName||null,tcb_region:g.tcbRegion||null,unit:g.unit||null,sih_name:g.sihName||null,note:g.note||null,companions:g.companions||[],checked_in:!!g.checkedIn,checkin_time:g.checkinTime||null,checkin_by:g.checkinBy||null,cancelled:!!g.cancelled,cancel_note:g.cancelNote||null,walkin:!!g.walkin,created_at:g.createdAt||Date.now()}}

function loadLocal(){try{const r=localStorage.getItem(SK);return r?JSON.parse(r):{events:[],guests:[]}}catch(e){return{events:[],guests:[]}}}

async function sbLoad(){
  try{
    const res=await fetch(`${API_BASE}/api/sync`,{headers:{'Accept':'application/json'}});
    if(!res.ok)throw new Error(`API sync HTTP ${res.status}`);
    const payload=await res.json();
    const evs=payload.events;const gs=payload.guests;
    if(Array.isArray(evs)&&Array.isArray(gs)){
      db.events=evs.map(dbToEv);db.guests=gs.map(dbToG);
      localStorage.setItem(SK,JSON.stringify(db));
      return true;
    }
  }catch(e){console.warn('API load lỗi, dùng localStorage:',e)}
  return false;
}

/* LEGACY — save()/sbSync() POST NGUYÊN MẢNG db.events + db.guests lên API mỗi lần gọi.
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
  if(!API_ON)return;
  if(_syncT)clearTimeout(_syncT);
  _syncT=setTimeout(sbSync,600);
}

async function sbSync(){
  _syncT=null;
  try{
    if(db.events.length){
      await fetch(`${API_BASE}/api/events`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(db.events.map(evToDb))
      });
    }
    if(db.guests.length){
      await fetch(`${API_BASE}/api/guests`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(db.guests.map(gToDb))
      });
    }
  }catch(e){console.warn('API sync lỗi:',e)}
}

// HÀM MỚI: chỉ ghi local (localStorage), KHÔNG kích hoạt sync nguyên mảng — dùng cho mọi thao tác
// sửa/xoá/check-in để tránh đè dữ liệu chéo. Phần đồng bộ thật lên API đi qua sbPatchGuest/
// sbPatchEvent/sbUpsertOne/sbUpsertMany ngay sau lệnh gọi hàm này tại từng nơi gọi.
function saveLocalOnly() {
  try{localStorage.setItem(SK,JSON.stringify(db))}catch(e){}
}

function apiPathForTable(table){
  if(table==='oh_events')return'/api/events';
  if(table==='oh_guests')return'/api/guests';
  throw new Error(`Unknown table: ${table}`);
}

async function apiJson(path, options={}){
  const res=await fetch(`${API_BASE}${path}`,{
    ...options,
    headers:{'Content-Type':'application/json','Accept':'application/json',...(options.headers||{})}
  });
  if(!res.ok)throw new Error(`API HTTP ${res.status}`);
  return res;
}

async function sbDel(table,id){
  if(!API_ON)return;
  try{await apiJson(`${apiPathForTable(table)}?id=${encodeURIComponent(id)}`,{method:'DELETE'})}
  catch(e){console.warn('API delete lỗi:',e)}
}

/* PATCH 1 record duy nhất lên API theo id — dùng cho check-in tại sự kiện.
   Tránh việc POST nguyên mảng db.guests (sbSync) có thể bị nhiều máy ghi đè
   chéo lên nhau khi check-in đồng thời (race condition).
   Có retry với backoff; trả về true/false để UI biết đã ghi nhận thành công hay chưa. */
async function sbPatchGuest(guestId, fields, retries=3){
  if(!API_ON)return true;
  for(let attempt=1;attempt<=retries;attempt++){
    try{
      await apiJson(`/api/guests?id=${encodeURIComponent(guestId)}`,{
        method:'PATCH',
        body:JSON.stringify(fields)
      });
      return true;
    }catch(e){console.warn('sbPatchGuest lỗi:',e)}
    if(attempt<retries)await new Promise(r=>setTimeout(r,attempt*500));
  }
  return false;
}

/* PATCH 1 record duy nhất lên bảng oh_events theo id — anh em sinh đôi của sbPatchGuest.
   Dùng cho saveEv() (chỉnh sửa sự kiện) thay vì save() cũ vốn POST nguyên cả 2 mảng
   db.events + db.guests mỗi lần đổi 1 sự kiện (kéo theo rủi ro đè check-in không liên quan). */
async function sbPatchEvent(eventId, fields, retries=3){
  if(!API_ON)return true;
  for(let attempt=1;attempt<=retries;attempt++){
    try{
      await apiJson(`/api/events?id=${encodeURIComponent(eventId)}`,{
        method:'PATCH',
        body:JSON.stringify(fields)
      });
      return true;
    }catch(e){console.warn('sbPatchEvent lỗi:',e)}
    if(attempt<retries)await new Promise(r=>setTimeout(r,attempt*500));
  }
  return false;
}

/* UPSERT đúng 1 record mới (sự kiện hoặc khách mới tạo) — KHÔNG đụng tới các row khác.
   Thay thế việc gọi sbSync() (POST nguyên mảng) mỗi khi tạo mới 1 sự kiện/1 khách. */
async function sbUpsertOne(table, row, retries=3){
  if(!API_ON)return true;
  for(let attempt=1;attempt<=retries;attempt++){
    try{
      await apiJson(apiPathForTable(table),{
        method:'POST',
        body:JSON.stringify([row])
      });
      return true;
    }catch(e){console.warn('sbUpsertOne lỗi:',e)}
    if(attempt<retries)await new Promise(r=>setTimeout(r,attempt*500));
  }
  return false;
}

/* UPSERT nhiều record cùng lúc, nhưng CHỈ gồm các row được truyền vào (vd: danh sách khách vừa
   import từ Excel) — không kéo theo toàn bộ db.guests như sbSync() cũ. */
async function sbUpsertMany(table, rows, retries=3){
  if(!API_ON || !rows.length)return true;
  for(let attempt=1;attempt<=retries;attempt++){
    try{
      await apiJson(apiPathForTable(table),{
        method:'POST',
        body:JSON.stringify(rows)
      });
      return true;
    }catch(e){console.warn('sbUpsertMany lỗi:',e)}
    if(attempt<retries)await new Promise(r=>setTimeout(r,attempt*500));
  }
  return false;
}

let db={events:[],guests:[]};

function qrUrl(code){return BASE_URL+'/?code='+encodeURIComponent(code)}

async function loadData(){
  if(API_ON){const ok=await sbLoad();if(!ok){const loc=loadLocal();db.events=loc.events;db.guests=loc.guests;}}
  else{const loc=loadLocal();db.events=loc.events;db.guests=loc.guests;}
}

/* isEvLocked — ngày > ngày event → khoá check-in / cancel / thêm-xoá khách / import.
   Sửa thông tin tĩnh (tên, SĐT, PRM, vùng, đơn vị, SIH, note) vẫn cho phép. */
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
function assetUrl(path){return `${import.meta.env.BASE_URL}${path.replace(/^\/+/,'')}`}
function appRoutePath(path='/'){
  return path.startsWith('/')?path:`/${path}`;
}
function normalizeLegacyRoute(){
  const path=(window.location.pathname||'/').replace(/\/+$/,'')||'/';
  if(path==='/eventoh-checkin/check')history.replaceState({},'',`/check${window.location.search}`);
  else if(path==='/eventoh-checkin')history.replaceState({},'',`/${window.location.search}`);
}
function isCheckRoute(){
  const path=(window.location.pathname||'/').replace(/\/+$/,'')||'/';
  return path==='/check';
}
function pushAppRoute(path,replace=false){
  const next=appRoutePath(path);
  if(window.location.pathname===next)return;
  history[replace?'replaceState':'pushState']({},'',next);
}
function enterCheckPage(){
  const events=visibleEvents();
  const initial=S.ciEv&&canAccessEvent(S.ciEv)?S.ciEv:(S.selEv&&canAccessEvent(S.selEv)?S.selEv:(events.length===1?events[0].id:null));
  S.view='checkin';
  S.ciEv=initial;
  S.ciOp=currentCheckinOperator();
  S.ciOk=!!initial;
  S.ciState=null;
}
function enterDashboardPage(){
  S.view='admin';
  S.ciOk=false;
  S.ciState=null;
  S.ciSyncWarn=false;
}
function syncPageFromRoute(){
  normalizeLegacyRoute();
  const urlCode=new URLSearchParams(window.location.search).get('code');
  if(urlCode&&!isCheckRoute()){
    S.urlCode=decodeURIComponent(urlCode);
    S.view='url_ci';
    R();
    return;
  }
  S.urlCode=null;
  if(isCheckRoute()){
    S.view='checkin';
    if(S.adminOk)enterCheckPage();
  }else{
    enterDashboardPage();
  }
  R();
}

/* Đồng bộ nền gần realtime qua Vercel API + Neon.
   Giữ lại định nghĩa hàm để dự phòng (vd: nếu cần bật lại polling làm lưới an toàn thì gọi startAutoRefresh()
   thủ công), nhưng KHÔNG còn được gọi tự động trong init() nữa. */
let _autoRefresh=null;
function startAutoRefresh(interval=REALTIME_POLL_MS){
  if(_autoRefresh)clearInterval(_autoRefresh);
  _autoRefresh=setInterval(async()=>{
    if(shouldSkipAutoRefresh())return; // người dùng đang nhập liệu / có form mở -> bỏ qua lượt này
    const before=JSON.stringify(db);
    await loadData();
    if(JSON.stringify(db)!==before)R();
  },interval);
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
   trên bảng oh_guests và oh_events để mọi máy tự cập nhật trong lúc vận hành check-in.
   Có cơ chế tự kết nối lại khi rớt kênh (wifi venue chập chờn),
   vì polling dự phòng đã tắt nên nếu không tự hồi phục thì máy sẽ "đứng hình" mà không có cảnh báo gì. */
let _realtimeChannel = null;
let _realtimeRetryCount = 0;
let _realtimeReconnectT = null;
let _qrStream = null;
let _qrDetector = null;
let _qrCanvas = null;
let _qrTimer = null;
let _qrBusy = false;
let _qrStartPromise = null;
let _qrActiveFacing = null;
let _qrLastCode = '';
let _qrLastAt = 0;
let _cameraStatusResetT = null;
let _ciHeightObserver = null;

function initRealtimeSync() {
  if(_realtimeChannel)return;
  _realtimeChannel={mode:'api-polling'};
  startAutoRefresh(REALTIME_POLL_MS);
  console.log('Bật đồng bộ nền qua Vercel API + Neon.');
}

function scheduleRealtimeReconnect(){
  initRealtimeSync();
}

function extractTicketCode(raw){
  const text=String(raw||'').trim();
  if(!text)return'';
  try{
    const url=new URL(text,window.location.href);
    const code=url.searchParams.get('code');
    if(code)return decodeURIComponent(code).trim().toUpperCase();
  }catch(e){}
  const match=text.match(/[?&]code=([^&]+)/i);
  if(match)return decodeURIComponent(match[1]).trim().toUpperCase();
  return text.trim().toUpperCase();
}
function setCameraStatus(message,type='',autoResetMs=0){
  const el=document.getElementById('ci_camera_status');
  if(!el)return;
  if(_cameraStatusResetT){clearTimeout(_cameraStatusResetT);_cameraStatusResetT=null}
  el.textContent=message;
  el.dataset.type=type;
  if(autoResetMs>0){
    const expected=message;
    _cameraStatusResetT=setTimeout(()=>{
      const current=document.getElementById('ci_camera_status');
      if(current&&current.textContent===expected)setCameraStatus('Đưa mã QR vào khung quét','ready');
    },autoResetMs);
  }
}
function clearCheckinColumnHeight(){
  if(_ciHeightObserver){_ciHeightObserver.disconnect();_ciHeightObserver=null}
  const right=document.querySelector('.ci-recent-card');
  if(right)right.style.height='';
}
function isMobileCheckinLayout(){
  return !!window.matchMedia?.('(max-width: 980px)').matches;
}
function shouldRunCheckinScanner(){
  return S.view==='checkin'&&S.ciOk&&!S.ciState&&(!isMobileCheckinLayout()||(S.ciMobileMode||'camera')==='camera');
}
function firstVisibleElement(ids){
  for(const id of ids){
    const el=document.getElementById(id);
    if(!el)continue;
    const box=el.getBoundingClientRect();
    if(box.width>0&&box.height>0)return el;
  }
  return null;
}
function syncCheckinColumnHeight(){
  clearCheckinColumnHeight();
  const left=document.querySelector('.ci-camera-card');
  const right=document.querySelector('.ci-recent-card');
  if(!left||!right)return;
  const apply=()=>{
    if(window.matchMedia('(max-width: 980px)').matches){
      right.style.height='';
      return;
    }
    const h=Math.ceil(left.getBoundingClientRect().height);
    if(h>0)right.style.height=`${h}px`;
  };
  requestAnimationFrame(apply);
  if('ResizeObserver' in window){
    _ciHeightObserver=new ResizeObserver(()=>requestAnimationFrame(apply));
    _ciHeightObserver.observe(left);
  }
}
function stopQrScanner(){
  if(_qrTimer){clearInterval(_qrTimer);_qrTimer=null}
  if(_qrStream){_qrStream.getTracks().forEach(track=>track.stop());_qrStream=null}
  _qrStartPromise=null;
  _qrActiveFacing=null;
  _qrBusy=false;
}
function currentCameraFacing(){
  return S.ciCameraFacing==='user'?'user':'environment';
}
async function startQrScanner(opts={}){
  const video=document.getElementById('ci_video');
  if(!video||S.view!=='checkin'||!S.ciOk||S.ciState)return;
  if(!navigator.mediaDevices?.getUserMedia){
    setCameraStatus('Trình duyệt không hỗ trợ camera. Vui lòng nhập mã thủ công.','error');
    return;
  }
  const facing=opts.facing||currentCameraFacing();
  const force=!!opts.force;
  if(_qrStartPromise&&!force)return _qrStartPromise;
  if(_qrStream&&!force&&_qrActiveFacing===facing){
    if(video.srcObject!==_qrStream)video.srcObject=_qrStream;
    if(video.paused)await video.play().catch(()=>{});
    if(!_qrTimer)_qrTimer=setInterval(scanQrFrame,450);
    if(!document.getElementById('ci_camera_status')?.dataset.type)setCameraStatus('Đưa mã QR vào khung quét','ready');
    return;
  }
  if(_qrStream&&(force||_qrActiveFacing!==facing)){
    stopQrScanner();
  }
  try{
    if(('BarcodeDetector' in window)&&!_qrDetector){
      try{_qrDetector=new BarcodeDetector({formats:['qr_code']})}catch(e){_qrDetector=null}
    }
    _qrStartPromise=(async()=>{
      _qrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing}},audio:false});
      _qrActiveFacing=facing;
      if(video.srcObject!==_qrStream)video.srcObject=_qrStream;
      await video.play();
      setCameraStatus('Đưa mã QR vào khung quét','ready');
      if(!_qrTimer)_qrTimer=setInterval(scanQrFrame,450);
    })();
    await _qrStartPromise;
  }catch(e){
    setCameraStatus('Không mở được camera. Kiểm tra quyền camera hoặc dùng nhập mã thủ công.','error');
  }finally{
    _qrStartPromise=null;
  }
}
async function scanQrFrame(){
  if(_qrBusy)return;
  const video=document.getElementById('ci_video');
  if(!video||video.readyState<2)return;
  _qrBusy=true;
  try{
    let code='';
    if(_qrDetector){
      const codes=await _qrDetector.detect(video);
      if(codes.length)code=extractTicketCode(codes[0].rawValue);
    }
    if(!code){
      const w=video.videoWidth;
      const h=video.videoHeight;
      if(!w||!h)return;
      _qrCanvas=_qrCanvas||document.createElement('canvas');
      const scale=Math.min(1,960/w);
      _qrCanvas.width=Math.max(1,Math.floor(w*scale));
      _qrCanvas.height=Math.max(1,Math.floor(h*scale));
      const ctx=_qrCanvas.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(video,0,0,_qrCanvas.width,_qrCanvas.height);
      const img=ctx.getImageData(0,0,_qrCanvas.width,_qrCanvas.height);
      const qr=jsQR(img.data,_qrCanvas.width,_qrCanvas.height,{inversionAttempts:'attemptBoth'});
      if(qr?.data)code=extractTicketCode(qr.data);
    }
    if(!code)return;
    const now=Date.now();
    if(code===_qrLastCode&&now-_qrLastAt<2500)return;
    _qrLastCode=code;_qrLastAt=now;
    setCameraStatus(`Đã đọc mã ${code}. Đang check-in...`,'ready');
    const result=await startCI(code,{skipVerify:true,stayIdle:true,fromScan:true});
    if(result?.ok){
      playCheckinBeep();
      showCheckinToast(result.person?.name||'Khách mời',result.syncOk);
      const input=document.getElementById('ci_in');
      if(input)input.value='';
    }
  }catch(e){
    setCameraStatus('Không đọc được QR. Giữ mã trong khung và thử lại.','error',2200);
  }finally{
    _qrBusy=false;
  }
}
function playCheckinBeep(){
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)return;
    const ctx=new AudioCtx();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.type='sine';
    osc.frequency.value=880;
    gain.gain.value=.08;
    osc.connect(gain);gain.connect(ctx.destination);
    if(ctx.state==='suspended')ctx.resume();
    osc.start();
    osc.stop(ctx.currentTime+.13);
    setTimeout(()=>ctx.close?.(),260);
  }catch(e){}
}
function showCheckinToast(name,syncOk=true,opts={}){
  const old=document.querySelector('.ci-toast');
  if(old)old.remove();
  const title=opts.title||(syncOk?'Đã check-in thành công':'Đã check-in, chờ đồng bộ');
  const text=opts.text||name;
  const icon=opts.icon||(syncOk?'check_circle':'warning');
  const toast=document.createElement('div');
  toast.className=`ci-toast ${syncOk?'':'warn'}`;
  toast.innerHTML=`<div class="ci-toast-icon"><span class="material-symbols-rounded mi" aria-hidden="true">${esc(icon)}</span></div>
    <div><div class="ci-toast-title">${esc(title)}</div>
    <div class="ci-toast-text">${esc(text)}</div></div>`;
  document.body.appendChild(toast);
  setTimeout(()=>toast.classList.add('show'),20);
  setTimeout(()=>{toast.classList.remove('show');setTimeout(()=>toast.remove(),220)},3600);
}

async function init(){
  normalizeLegacyRoute();
  const urlCode=new URLSearchParams(window.location.search).get('code');
  const checkRoute=isCheckRoute();
  const root=document.getElementById('root');
  root.innerHTML=`<div class="app-loading" role="status" aria-live="polite">
    <div class="app-loading-panel">
      <img class="app-loading-logo" src="${assetUrl('images/logo-oh-header.png')}" alt="OneHousing" />
      <div class="app-loading-mark">
        <span class="material-symbols-rounded mi" aria-hidden="true">qr_code_scanner</span>
      </div>
      <div class="app-loading-title">Đang khởi động hệ thống</div>
      <div class="app-loading-subtitle">Đồng bộ dữ liệu check-in...</div>
      <div class="app-loading-bar" aria-hidden="true"><span></span></div>
    </div>
  </div>`;
  await loadData();
  if(API_ON) initRealtimeSync();
  const sessionUser=getAdminSessionUser();
  S.adminOk=!!sessionUser;
  S.currentUser=sessionUser;
  if(urlCode&&!checkRoute){S.urlCode=decodeURIComponent(urlCode);S.view='url_ci';R();return;}
  if(checkRoute){
    S.view='checkin';
    if(S.adminOk)enterCheckPage();
    R();
    return;
  }
  R();
}

init();
window.addEventListener('popstate',syncPageFromRoute);

/* ============================================================
   STATE
   ============================================================ */
let S={
  adminOk:false,
  currentUser:null,
  view:'admin', 
  urlCode:null,     
  urlCIStep:null,   
  urlCIBusy:false,
  urlCISyncWarn:false,
  tab:'events', 
  selEv:null,
  modal:null,   // add_ev | add_g | edit_g | del_g | tickets | btc_members | import_preview | ci_unlock
  editGid:null,
  detailGid:null,
  delGid:null,
  ticketGid:null,
  editEvId:null,   
  editAccountId:null,
  delAccountId:null,
  cpTicket:null,  
  cpDetail:null,
  cpEdit:null,    
  cpDel:null,     
  cpAdd:null,     
  adminCI:null,   
  cancelTarget:null, 
  unlockedEvs:{},
  unlockedCIEvs:{},   // Sự kiện được Admin mở check-in bù sau ngày tổ chức
  evUnlockTarget:null, 
  ciUnlockTarget:null,
  rptEv:null,          
  rptExp:{},           
  evSearch:'',
  search:'',
  filter:'all',
  ciOk:false,
  ciEv:null,
  ciOp:null,   
  ciState:null,
  ciSyncWarn:false,
  ciRecentSearch:'',
  ciMobileMode:'camera',
  ciCameraFacing:'environment',
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
function companionNameLabel(name){
  return String(name||'').replace(/\s*\((người đi kèm|nguoi di kem)\)\s*/i,' ').replace(/\s{2,}/g,' ').trim();
}
function ticketDigits(v){
  return String(v||'').replace(/\D/g,'').slice(0,8);
}
function formatTicketCode(v){
  const digits=ticketDigits(v);
  return digits.length>4?`${digits.slice(0,4)}-${digits.slice(4)}`:digits;
}
function canonicalTicketCode(v){
  const raw=String(v||'').trim().toUpperCase();
  const digits=raw.replace(/\D/g,'');
  if(digits.length===8&&/^[\d\s-]+$/.test(raw))return `${digits.slice(0,4)}-${digits.slice(4)}`;
  return raw.replace(/\s+/g,'');
}
function formatCIInput(el){
  if(!el)return;
  el.value=formatTicketCode(el.value);
}
function currentCheckinOperator(){
  const acc=currentAccount()||defaultAdminAccount();
  const username=normalizeUsername(acc.username||LOGIN_USER)||LOGIN_USER;
  return{code:username,name:acc.name||username,account:username};
}
function checkinByLabel(){
  const op=S.ciOp||currentCheckinOperator();
  return op.name||op.code||LOGIN_USER;
}
function refocusInput(id,pos){
  requestAnimationFrame(()=>{
    const el=document.getElementById(id);
    if(!el)return;
    el.focus();
    const caret=Number.isFinite(pos)?pos:el.value.length;
    try{el.setSelectionRange(caret,caret)}catch(e){}
  });
}
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
  const used=new Set();
  db.guests.forEach(g=>{used.add(canonicalTicketCode(g.guestCode));(g.companions||[]).forEach(c=>used.add(canonicalTicketCode(c.code)))});
  let code,t=0;
  do{code=formatTicketCode(String(Math.floor(Math.random()*100000000)).padStart(8,'0'));t++}
  while(used.has(code)&&t<200);
  return code;
}
function genSystemCode(){
  const used=new Set(db.guests.map(g=>String(g.systemCode||'').trim().toUpperCase()).filter(Boolean));
  let n=db.guests.length+1;
  let code;
  do{
    code=`CUS-${String(n).padStart(6,'0')}`;
    n++;
  }while(used.has(code));
  return code;
}
function findCode(eid,code){
  const needle=canonicalTicketCode(code);
  for(const g of db.guests.filter(x=>x.eventId===eid)){
    if(canonicalTicketCode(g.guestCode)===needle)return{type:'guest',guest:g,person:g};
    for(const c of(g.companions||[])){
      if(canonicalTicketCode(c.code)===needle)return{type:'comp',guest:g,person:c};
    }
  }
  return null;
}
function findAnyCode(code){
  const needle=canonicalTicketCode(code);
  for(const g of db.guests){
    if(canonicalTicketCode(g.guestCode)===needle)return{type:'guest',guest:g,person:g};
    for(const c of(g.companions||[])){
      if(canonicalTicketCode(c.code)===needle)return{type:'comp',guest:g,person:c};
    }
  }
  return null;
}
function canSeeAllEvents(){
  const role=currentAccount()?.role;
  return role==='super_admin'||role==='manager';
}
function canManageEvents(){
  return canSeeAllEvents();
}
function eventAssignedUsers(ev){
  return new Set((ev?.btcMembers||[]).map(m=>normalizeUsername(m.account||m.username||m.user||'')).filter(Boolean));
}
function canAccessEvent(eid){
  const ev=getEvById(eid);
  if(!ev)return false;
  if(canSeeAllEvents())return true;
  return eventAssignedUsers(ev).has(normalizeUsername(S.currentUser));
}
function visibleEvents(){
  if(canSeeAllEvents())return db.events;
  const user=normalizeUsername(S.currentUser);
  return db.events.filter(ev=>eventAssignedUsers(ev).has(user));
}
function accountOptionsHTML(selected=''){
  const accounts=loadAccounts().filter(acc=>acc.role==='staff'||acc.role==='manager').sort((a,b)=>a.name.localeCompare(b.name));
  return`<option value="">- Chọn tài khoản -</option>${accounts.map(acc=>`<option value="${esc(acc.username)}" ${normalizeUsername(selected)===acc.username?'selected':''}>${esc(acc.name)} (${esc(acc.username)})</option>`).join('')}`;
}
function btcRowHTML(m={},i=0){
  const selected=m.account||m.username||m.user||m.code||'';
  return`<div class="btc-r" id="br_${i}">
    <select id="ba_${i}" class="btc-account-select" style="min-width:320px">${accountOptionsHTML(selected)}</select>
    ${i>0?`<button class="btn xs red" onclick="rmBR(${i})">✕</button>`:`<span style="width:22px"></span>`}
  </div>`;
}

/* ============================================================
   RENDER ENTRY
   ============================================================ */
function R(){
  const root=document.getElementById('root');
  root.className=S.view==='url_ci'?'wrap':!S.adminOk?'login-root':S.view==='checkin'?'checkin-root':'admin-root';
  ensureMaterialIconObserver(root);
  const wantsScanner=S.adminOk&&shouldRunCheckinScanner();
  if(!wantsScanner){stopQrScanner();clearCheckinColumnHeight();}
  if(S.view==='url_ci'){root.innerHTML=rUrlCI();enhanceDropdowns(root);materializeIcons(root);postUrlCI();return} 
  if(!S.adminOk){root.innerHTML=rLogin();enhanceDropdowns(root);materializeIcons(root);postLogin();return}
  if(S.view==='checkin'){root.innerHTML=rCIView();enhanceDropdowns(root);materializeIcons(root);postCI();return}
  root.innerHTML=rAdmin();
  enhanceDropdowns(root);
  materializeIcons(root);
  postAdmin();
}

/* ============================================================
   ADMIN LOGIN
   ============================================================ */
function rLogin(){
  const box=`<div class="login-box">
    <div class="login-brand">
      <img class="login-logo-img" src="${assetUrl('images/logo-oh-header.png')}" alt="OneHousing" />
    </div>
    <div class="login-title">Đăng nhập</div>
    <div class="login-subtitle">Nhập thông tin tài khoản để tiếp tục</div>

    <div class="fg"><label>Tên đăng nhập</label>
      <input type="text" id="login_user" placeholder="admin" autocomplete="username" autofocus
        onkeydown="if(event.key==='Enter')doLogin()" style="font-size:16px;padding:12px 14px"/></div>
    <div class="fg"><label>Mật khẩu</label>
      <input type="password" id="login_pw" placeholder="Nhập mật khẩu" autocomplete="current-password"
        onkeydown="if(event.key==='Enter')doLogin()" style="font-size:16px;padding:12px 14px"/></div>
    <div id="login_err" class="login-error"></div>
    <button class="btn blue full login-submit" onclick="doLogin()">Đăng nhập</button>
  </div>`;
  if(!isCheckRoute())return box;
  return`<div class="check-login-layout">
    ${box}
    <div class="check-login-qr-card">
      <div class="check-login-qr-head">
        <span class="material-symbols-rounded mi" aria-hidden="true">qr_code_2</span>
        <div>
          <div class="check-login-qr-title">Mobile Check-in</div>
          <div class="check-login-qr-sub">Quét mã để mở trang check trên điện thoại</div>
        </div>
      </div>
      <div id="check_login_qr" class="check-login-qr">${checkPageQRHTML()}</div>
      <div id="check_login_qr_url" class="check-login-qr-url">${esc(checkPageUrl())}</div>
    </div>
  </div>`;
}
function checkPageUrl(){
  return new URL(appRoutePath('/check'), window.location.origin).href;
}
let _checkPageQRCache={url:'',src:''};
function checkPageQRSrc(){
  const url=checkPageUrl();
  if(_checkPageQRCache.url===url&&_checkPageQRCache.src)return _checkPageQRCache.src;
  if(typeof QRCode==='undefined')return'';
  const holder=document.createElement('div');
  try{
    new QRCode(holder,{text:url,width:184,height:184,colorDark:'#071025',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
    const canvas=holder.querySelector('canvas');
    const img=holder.querySelector('img');
    const src=canvas?.toDataURL('image/png')||img?.src||'';
    if(src)_checkPageQRCache={url,src};
    return src;
  }catch(e){
    console.warn('Không tạo được QR mobile check-in:',e);
    return'';
  }
}
function checkPageQRHTML(){
  const src=checkPageQRSrc();
  return src
    ? `<img class="check-login-qr-img" src="${esc(src)}" alt="QR Mobile Check-in" />`
    : `<div class="check-login-qr-fallback">QR</div>`;
}
function renderCheckPageQR(id){
  const el=document.getElementById(id);
  if(!el||typeof QRCode==='undefined')return;
  if(el.dataset.qrUrl===checkPageUrl())return;
  el.innerHTML='';
  new QRCode(el,{text:checkPageUrl(),width:184,height:184,colorDark:'#071025',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
  el.dataset.qrUrl=checkPageUrl();
}
function postLogin(){
  if(!isCheckRoute())return;
  materializeIcons(document.getElementById('root'));
}
function doLogin(){
  const user=(document.getElementById('login_user')?.value||'').trim();
  const pw=document.getElementById('login_pw')?.value||'';
  const account=findAccount(user);
  if(account&&pw===account.password){
    S.adminOk=true;S.currentUser=account.username;keepAdminSession(account.username);
    if(isCheckRoute())enterCheckPage();
    else enterDashboardPage();
    R()
  }
  else{document.getElementById('login_err').textContent='⚠️ Tài khoản hoặc mật khẩu không đúng.'}
}
function doLogout(){
  clearAdminSession();
  S.adminOk=false;
  S.currentUser=null;
  S.view=isCheckRoute()?'checkin':'admin';
  S.modal=null;
  S.ciOk=false;
  S.ciOp=null;
  S.ciState=null;
  R();
}

/* ============================================================
   ADMIN SHELL
   ============================================================ */
function rAdmin(){
  const pageTitle=S.tab==='events'?'Sự kiện':S.tab==='report'?'Báo cáo':S.tab==='permissions'?'Phân quyền':S.tab==='guests'?'Khách mời':'Sự kiện';
  const me=currentAccount();
  const initial=(me?.name||me?.username||'A').trim().slice(0,1).toUpperCase();
  const showPermissions=canManageAccounts();
  return`
    <div class="admin-layout">
      <aside class="side-nav no-print" aria-label="Điều hướng quản trị">
        <div class="side-brand">
          <img class="side-logo-img" src="${assetUrl('images/logo-oh-footer.png')}" alt="OneHousing" />
        </div>

        <div class="side-section">
          <div class="side-section-title">Quản lý</div>
          <button class="side-tab ${S.tab==='events'?'on':''}" onclick="setTab('events')">📅 <span>Sự kiện</span></button>
          <button class="side-tab ${S.tab==='report'?'on':''}" onclick="setTab('report')">📊 <span>Báo cáo</span></button>
          ${showPermissions?`<button class="side-tab ${S.tab==='permissions'?'on':''}" onclick="setTab('permissions')">🔐 <span>Phân quyền</span></button>`:''}
        </div>

        <div class="side-user">
          <div class="side-avatar">${esc(initial)}</div>
          <div>
            <div class="side-user-name">${esc(me?.name||'Administrator')}</div>
            <div class="side-user-role">${esc(roleLabel(me?.role))}</div>
          </div>
        </div>
        <button class="side-link" onclick="openAccount()">🔑 <span>Đổi mật khẩu</span></button>
        <button class="side-link" onclick="doLogout()">↪ <span>Đăng xuất</span></button>
      </aside>
      <section class="admin-panel">
        <header class="admin-header no-print">
          <div>
            <div class="admin-title">${pageTitle}</div>
          </div>
          <button class="btn" onclick="goCI()">
            <span class="material-symbols-rounded mi" aria-hidden="true">qr_code_scanner</span>
            Mở App Check-in
          </button>
        </header>
        <main class="admin-content">
          ${S.tab==='events'?rEvTab():''}
          ${S.tab==='guests'?rGTab():''}
          ${S.tab==='report'?rRTab():''}
          ${S.tab==='permissions'?rPermissionTab():''}
        </main>
      </section>
    </div>
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
  const q=(S.evSearch||'').trim().toLowerCase();
  const allEvents=visibleEvents();
  const canManage=canManageEvents();
  const sorted=[...allEvents]
    .filter(ev=>!q||[ev.name,ev.team,ev.venue,ev.date,fmtD(ev.date)].some(v=>(v||'').toLowerCase().includes(q)))
    .sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  return`<div class="topbar">
    <div>
      <div style="font-weight:700">Danh sách sự kiện</div>
      <div style="font-size:14px;color:#98a4b6;margin-top:3px">Tổng số sự kiện hiện có: ${allEvents.length}</div>
    </div>
    <div class="event-toolbar">
      <div class="search-control event-search ${S.evSearch?'has-value':''}">
        <span class="material-symbols-rounded mi search-leading" aria-hidden="true">search</span>
        <input id="ev_search" class="search-input" placeholder="Tìm sự kiện..." oninput="setEvSrch(this.value,this.selectionStart)" value="${esc(S.evSearch)}">
        <button type="button" class="search-clear" onclick="clearEvSrch()" title="Xóa tìm kiếm"><span class="material-symbols-rounded mi" aria-hidden="true">close</span></button>
      </div>
      ${canManage?`<button class="btn blue sm" onclick="openM('add_ev')">+ Tạo sự kiện</button>`:''}
    </div>
  </div>
    ${allEvents.length===0?`<div class="empty">📭 Chưa có sự kiện nào được phân công.</div>`:''}
    ${allEvents.length>0&&sorted.length===0?`<div class="empty">Không tìm thấy sự kiện phù hợp.</div>`:''}
    ${sorted.map(ev=>{const p=allPeople(ev.id);const btcN=(ev.btcMembers||[]).length;const locked=isEvLocked(ev);
      return`<div class="ev-item" onclick="openGM('${ev.id}')">
        <div style="flex:1">
          <div style="font-weight:700;font-size:16px">${ev.name} ${locked?'<span style="font-size:14px;font-weight:600;background:#FEF2F2;color:#B91C1C;padding:2px 7px;border-radius:10px;vertical-align:middle">Đã kết thúc</span>':''}</div>
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
          <button class="btn sm" onclick="openGM('${ev.id}')">📋 Khách</button>
          ${canManage?`<button class="btn sm" onclick="openEditEv('${ev.id}')">✏️ Sửa</button>
          <button class="btn sm red" onclick="delEv('${ev.id}')">🗑️</button>`:''}
        </div>
      </div>`;}).join('')}`;
}

/* ============================================================
   PERMISSIONS TAB
   ============================================================ */
function rPermissionTab(){
  if(!canManageAccounts()){
    return`<div class="card" style="text-align:center;padding:32px">
      <div style="font-weight:700;margin-bottom:4px">Không có quyền truy cập</div>
      <div style="font-size:15px;color:#888">Chỉ tài khoản Super Admin hoặc Quản lý mới được quản lý phân quyền.</div>
    </div>`;
  }
  const roles=[
    {
      icon:'admin_panel_settings',
      name:'Super Admin',
      badge:'Toàn quyền',
      desc:'Quản trị toàn bộ hệ thống, dữ liệu, bảo mật và phân quyền.',
      perms:['Tạo, sửa, xoá sự kiện','Quản lý khách mời và báo cáo','Đổi mật khẩu Admin','Thiết lập vai trò người dùng']
    },
    {
      icon:'manage_accounts',
      name:'Quản lý',
      badge:'Vận hành',
      desc:'Điều phối sự kiện, theo dõi dữ liệu và xử lý danh sách khách.',
      perms:['Tạo và chỉnh sửa sự kiện','Quản lý danh sách khách','Tạo tài khoản Quản lý/Nhân viên','Xoá Quản lý/Nhân viên khác']
    },
    {
      icon:'badge',
      name:'Nhân viên',
      badge:'Thực thi',
      desc:'Thực hiện các tác vụ check-in và hỗ trợ vận hành tại sự kiện.',
      perms:['Mở màn hình Check-in BTC','Quét vé và xác nhận khách','Xem thông tin vé cần xử lý','Không truy cập cấu hình hệ thống']
    }
  ];
  const roleRank={super_admin:1,manager:2,staff:3};
  const accounts=loadAccounts().sort((a,b)=>(roleRank[a.role]||9)-(roleRank[b.role]||9)||a.username.localeCompare(b.username));
  const current=normalizeUsername(S.currentUser);
  const roleSection=`<div class="perm-section-title">Nhóm quyền</div>
  <div class="role-grid">
    ${roles.map(role=>`<div class="role-card">
      <div class="role-head">
        <div class="role-icon"><span class="material-symbols-rounded mi" aria-hidden="true">${role.icon}</span></div>
        <div>
          <div class="role-title">${role.name}</div>
          <div class="role-desc">${role.desc}</div>
        </div>
      </div>
      <span class="role-badge">${role.badge}</span>
      <div class="role-perms">
        ${role.perms.map(p=>`<div class="role-perm"><span class="material-symbols-rounded mi" aria-hidden="true">check_circle</span><span>${p}</span></div>`).join('')}
      </div>
    </div>`).join('')}
  </div>`;
  return`${roleSection}
  <div class="topbar" style="margin-top:24px">
    <div style="font-weight:700">Danh sách tài khoản</div>
    <button class="btn blue sm" onclick="openAccountForm()">+ Tạo tài khoản</button>
  </div>
  <div class="card-tight" style="margin-bottom:18px">
    <table class="tbl">
      <thead><tr>
        <th>Tài khoản</th>
        <th>Họ tên</th>
        <th>Vai trò</th>
        <th>Ngày tạo</th>
        <th style="text-align:right">Thao tác</th>
      </tr></thead>
      <tbody>
        ${accounts.map(acc=>{
          const isCurrent=acc.username===current;
          const isSuper=acc.role==='super_admin';
          const canManageTarget=canManageAccountTarget(acc);
          const lockEdit=!canManageTarget;
          const lockDelete=isCurrent||isSuper||!canManageTarget;
          return`<tr>
            <td><span class="mono">${esc(acc.username)}</span>${isCurrent?` <span class="badge b-blue" style="margin-left:6px">Đang dùng</span>`:''}</td>
            <td>${esc(acc.name)}</td>
            <td><span class="badge ${acc.role==='super_admin'?'b-purple':acc.role==='manager'?'b-blue':'b-gray'}">${esc(roleLabel(acc.role))}</span></td>
            <td style="color:#888">${fmtD(acc.createdAt)}</td>
            <td>
              <div class="account-actions">
                <button class="btn sm" onclick="openAccountForm('${acc.id}')" ${lockEdit?'disabled':''} title="${lockEdit?'Không có quyền sửa tài khoản này':'Sửa tài khoản'}">✏️ Sửa</button>
                <button class="btn sm red" onclick="openAccountDel('${acc.id}')" ${lockDelete?'disabled':''} title="${isCurrent?'Không thể xoá tài khoản đang đăng nhập':isSuper?'Super Admin là tài khoản duy nhất của hệ thống':!canManageTarget?'Không có quyền xoá tài khoản này':'Xoá tài khoản'}">🗑️ Xoá</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

/* ============================================================
   GUESTS TAB
   ============================================================ */
function rGTab(){
  const events=visibleEvents();
  const evSel=`<select class="selx" style="min-width:260px" onchange="pickEv(this.value)">
    <option value="">- Chọn sự kiện -</option>
    ${events.map(e=>`<option value="${e.id}" ${S.selEv===e.id?'selected':''}>${e.name}</option>`).join('')}
  </select>`;
  if(!S.selEv)return`<div class="topbar">${evSel}</div><div class="empty">👆 Chọn sự kiện để quản lý khách mời</div>`;
  if(!canAccessEvent(S.selEv))return`<div class="topbar">${evSel}</div><div class="empty">Bạn không có quyền xem sự kiện này.</div>`;

  const ev = db.events.find(e=>e.id===S.selEv);
  let gs = egs(S.selEv);
  const p = allPeople(S.selEv);

  if(S.search){const q=S.search.toLowerCase();gs=gs.filter(g=>g.name?.toLowerCase().includes(q)||g.phone?.includes(q)||g.prmName?.toLowerCase().includes(q)||g.sihName?.toLowerCase().includes(q)||g.unit?.toLowerCase().includes(q)||g.guestCode?.toLowerCase().includes(q)||g.systemCode?.toLowerCase().includes(q)||(g.companions||[]).some(x=>x.name?.toLowerCase().includes(q)||x.code?.toLowerCase().includes(q)))}
  if(S.filter==='checked')gs=gs.filter(g=>g.checkedIn);
  if(S.filter==='pending')gs=gs.filter(g=>!g.checkedIn&&!g.cancelled);
  if(S.filter==='cancelled')gs=gs.filter(g=>g.cancelled);
  if(S.filter==='walkin')gs=gs.filter(g=>!!g.walkin);

  const walkinCount = egs(S.selEv).filter(g=>g.walkin).length;
  const evLocked = isEvLocked(ev);       // true khi ngày > ngày event → khoá check-in/cancel/add-del
  const evWalkinDay = isWalkinDay(ev);   // true khi ngày = ngày event → cho phép tạo Walk-in
  const ciUnlocked = !!S.unlockedCIEvs[ev.id]; // true khi Admin đã mở check-in bù

  return`
    <div class="guest-backbar">
      <button class="btn sm" onclick="setTab('events')">
        <span class="material-symbols-rounded mi" aria-hidden="true">arrow_back</span>
        Về danh sách sự kiện
      </button>
    </div>
    <div class="stats guest-stats">
      <div class="stat"><div class="n">${p.t}</div><div class="l">Tổng</div></div>
      <div class="stat"><div class="n" style="color:#3B6D11">${p.c}</div><div class="l">✅ Đã vào</div></div>
      <div class="stat"><div class="n" style="color:#aaa">${p.p}</div><div class="l">⏳ Chưa</div></div>
      <div class="stat"><div class="n" style="color:#B91C1C">${p.x}</div><div class="l">🚫 Cancel</div></div>
      <div class="stat"><div class="n">${p.t>0?Math.round(p.c/p.t*100):0}%</div><div class="l">Tỷ lệ vào</div></div>
    </div>
    <div class="guest-toolbar">
      <div class="guest-toolbar-body">
        <div class="guest-filter-group">
          <div class="search-control guest-search-input ${S.search?'has-value':''}">
            <span class="material-symbols-rounded mi search-leading" aria-hidden="true">search</span>
            <input id="guest_search" class="search-input" placeholder="Tìm tên, mã, SĐT..." oninput="setSrch(this.value,this.selectionStart)" value="${esc(S.search)}">
            <button type="button" class="search-clear" onclick="clearSrch()" title="Xóa tìm kiếm"><span class="material-symbols-rounded mi" aria-hidden="true">close</span></button>
          </div>
          <select class="selx" style="min-width:210px" onchange="setFil(this.value)">
            <option value="all" ${S.filter==='all'?'selected':''}>Tất cả (${p.t})</option>
            <option value="checked" ${S.filter==='checked'?'selected':''}>Đã vào (${p.c})</option>
            <option value="pending" ${S.filter==='pending'?'selected':''}>Chưa xác nhận (${p.p})</option>
            <option value="cancelled" ${S.filter==='cancelled'?'selected':''}>Cancel (${p.x})</option>
            <option value="walkin" ${S.filter==='walkin'?'selected':''}>Walk-in (${walkinCount})</option>
          </select>
        </div>
        <div class="guest-actions">
          ${evLocked?'':
            `<button class="btn green sm" onclick="openImportExcel()"><span class="material-symbols-rounded mi" aria-hidden="true">file_download</span>Import Excel</button>`
          }
          ${p.t > 0 ? `<button class="btn sm" onclick="expCSV()"><span class="material-symbols-rounded mi" aria-hidden="true">download</span>Xuất CSV</button>` : ''}
          ${p.t > 0 ? `<button class="btn blue sm" onclick="downloadAllQRsZip()" id="zip_btn"><span class="material-symbols-rounded mi" aria-hidden="true">folder_zip</span>Tải QR hàng loạt</button>` : ''}
          ${evLocked?'':`<button class="btn blue sm" onclick="openM('add_g')"><span class="material-symbols-rounded mi" aria-hidden="true">person_add</span>Thêm KH đăng ký</button>`}
          ${evWalkinDay?`<button class="btn sm guest-walkin-btn" onclick="openWalkin()"><span class="material-symbols-rounded mi" aria-hidden="true">directions_walk</span>Walk-in</button>`:''}
        </div>
      </div>
    </div>
    
    ${evLocked?`<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-size:20px">📋</span>
      <div style="flex:1">
        <div style="font-weight:600;font-size:15px;color:#92400E">Sự kiện đã kết thúc — Chế độ chỉnh sửa hậu sự kiện</div>
        <div style="font-size:14px;color:#aaa">Check-in, Cancel, Thêm/Xoá khách đã bị khoá từ ngày ${fmtD(ev.date)}. Vẫn có thể <b>sửa thông tin</b> (PRM, vùng, đơn vị, SIH, ghi chú, tên, SĐT).</div>
      </div>
      ${ciUnlocked
        ?`<div style="display:flex;align-items:center;gap:6px;background:#FEF3C7;border:1px solid #FCD34D;border-radius:8px;padding:6px 12px">
            <span style="font-size:14px">✅</span>
            <div style="font-size:14px;font-weight:700;color:#92400E">Đang mở check-in bù</div>
            <button class="btn xs" onclick="closeCIUnlock('${ev.id}')" style="background:#fff;color:#B45309;border-color:#FCD34D">Khoá lại</button>
          </div>`
        :`<button class="btn sm" onclick="openCIUnlock('${ev.id}')" style="background:#D97706;color:#fff;border-color:#D97706;white-space:nowrap">🔓 Mở check-in bù</button>`
      }
    </div>`:''}
    <div class="card-tight guest-table-card">
      <div class="guest-table-scroll">
        <table class="tbl guest-table">
          <colgroup>
            <col class="guest-col-index">
            <col class="guest-col-name">
            <col class="guest-col-code">
            <col class="guest-col-phone">
            <col class="guest-col-prm">
            <col class="guest-col-unit">
            <col class="guest-col-sih">
            <col class="guest-col-checkin">
            <col class="guest-col-actions">
          </colgroup>
          <thead><tr>
            <th>#</th><th>Khách / Đi kèm</th><th>Mã</th>
            <th>SĐT</th><th>PRM / Vùng</th>
            <th>Đơn vị</th><th>SIH</th>
            <th>Check-in</th><th>Thao tác</th>
          </tr></thead>
          <tbody>
          ${gs.length===0?`<tr><td colspan="9" style="text-align:center;padding:24px;color:#bbb">Không có dữ liệu</td></tr>`:''}
          ${gs.map((g,i)=>{
            const comps=g.companions||[];
            const isCancelled=!!g.cancelled;
            const isWalkin=!!g.walkin;
            // evLocked = ký sự kiện đã qua: khoá check-in/cancel/add-del
            // ciUnlocked = Admin đã mở check-in bù: cho phép check-in dù evLocked
            // Sửa thông tin tĩnh (edit) LUÔN cho phép dù evLocked
            let rows=`<tr ${isCancelled?'class="cancelled"':''} style="${isCancelled?'background:#FFF8F8':''}">
              <td style="color:#ccc">${i+1}</td>
              <td>
                <div class="guest-name-row" style="font-weight:600${isCancelled?';text-decoration:line-through;color:#bbb':''}">
                  <button type="button" class="name-link ${isCancelled?'is-cancelled':''}" onclick="openGuestDetail('${g.id}')" title="Xem chi tiết">${esc(g.name)}</button>
                  ${isWalkin?`<span style="font-size:14px;font-weight:700;background:#EDE9FE;color:#7C3AED;padding:1px 6px;border-radius:8px;margin-left:4px;vertical-align:middle">Walk-in</span>`:''}
                </div>
                ${isCancelled?`<span class="cancelled-badge">🚫 Cancel</span>${g.cancelNote?`<div class="cancel-note">${g.cancelNote}</div>`:''}`:
                  `${comps.length?`<div class="sub">+${comps.length} đi kèm</div>`:''}
                   ${g.note?`<div class="sub" style="font-style:italic">${g.note}</div>`:''}
                   ${evLocked?'':`<button class="btn xs" onclick="openAddComp('${g.id}')" style="margin-top:5px;color:#185FA5;border-color:#b3d4f5">+ thêm đi kèm</button>`}`}
              </td>
              <td><span class="mono">${g.guestCode}</span></td>
              <td style="color:#888;font-size:14px">${g.phone||'—'}</td>
              <td><div style="font-size:14px">${g.prmName||'—'}</div><div class="sub">${g.tcbRegion||''}</div></td>
              <td style="font-size:14px;color:#888">${g.unit||'—'}</td>
              <td style="font-size:14px;color:#888">${g.sihName||'—'}</td>
              <td>${isCancelled||(evLocked&&!ciUnlocked)?'<span style="font-size:14px;color:#ccc">—</span>':
                `<button class="ci ${g.checkedIn?'on':'off'}" onclick="togCI('${g.id}','g')">${g.checkedIn?'✅ Vào':'⏳'}</button>
                 ${g.checkedIn?`<div style="font-size:14px;color:#bbb;margin-top:2px">${fmtTm(g.checkinTime)}</div>`:''}`}
              </td>
              <td class="actions-cell">
                <div class="row-actions">
                  <button class="btn xs" onclick="openTickets('${g.id}')" title="Vé">🎫</button>
                  ${evLocked?'':isCancelled?
                    `<button class="btn xs" onclick="undoCancel('${g.id}','g')" style="color:#256fe6;border-color:#256fe6" title="Recall — KH quay lại tham dự">↩</button>`
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
                  <button type="button" class="name-link companion ${cpCancelled?'is-cancelled':''}" onclick="openCpDetail('${g.id}','${cp.id}')" title="Xem chi tiết">↳ ${esc(companionNameLabel(cp.name))}</button>
                  ${cpCancelled?`<span class="cancelled-badge" style="margin-left:4px">🚫</span>${cp.cancelNote?`<div class="cancel-note" style="padding-left:14px">${cp.cancelNote}</div>`:''}`
                    :`<span class="badge b-purple" style="font-size:14px;margin-left:4px">Đi kèm</span>`}
                </td>
                <td><span class="mono">${cp.code}</span></td>
                <td style="font-size:14px;color:#aaa">${cp.phone||'—'}</td>
                <td colspan="2"></td><td></td>
                <td>${cpCancelled||(evLocked&&!ciUnlocked)?'<span style="font-size:14px;color:#ccc">—</span>':
                  `<button class="ci ${cp.checkedIn?'on':'off'}" onclick="togCI('${g.id}','c','${cp.id}')">${cp.checkedIn?'✅ Vào':'⏳'}</button>
                   ${cp.checkedIn?`<div style="font-size:14px;color:#bbb;margin-top:2px">${fmtTm(cp.checkinTime)}</div>`:''}`}
                </td>
                <td class="actions-cell">
                  <div class="row-actions">
                    <button class="btn xs" onclick="openCpTicket('${g.id}','${cp.id}')" title="Vé">🎫</button>
                    ${evLocked?'':cpCancelled?
                      `<button class="btn xs" onclick="undoCancel('${g.id}','c','${cp.id}')" style="color:#256fe6;border-color:#256fe6" title="Recall — người đi kèm quay lại">↩</button>`
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
    `;
}

/* ============================================================
   REPORT TAB
   ============================================================ */
function rRTab(){
  const events=visibleEvents();
  if(!events.length)return'<div class="empty">Chưa có dữ liệu.</div>';
  const evSel=`<select class="selx" style="min-width:220px" onchange="setRptEv(this.value)">
    <option value="">- Tất cả sự kiện -</option>
    ${events.map(e=>`<option value="${e.id}" ${S.rptEv===e.id?'selected':''}>${e.name}${isEvLocked(e)?' 🔐':''}</option>`).join('')}
  </select>`;
  const overviewHtml=`
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div style="font-weight:700">📊 Tổng quan sự kiện</div></div>${evSel}
      </div>
      ${events.map(ev=>{const p=allPeople(ev.id);const r=p.t?Math.round(p.c/p.t*100):0;
        const locked=false;
        return`<div class="report-overview-row">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
            <div><div style="font-weight:600;font-size:15px">${ev.name}${locked?' 🔒':''}</div>
              <div style="font-size:14px;color:#aaa">${fmtD(ev.date)}${ev.team?' · '+ev.team:''}</div></div>
            <div style="display:flex;gap:10px;align-items:center">
              <div style="text-align:center"><div style="font-size:16px;font-weight:700">${p.t}</div><div style="font-size:14px;color:#aaa">Tổng</div></div>
              <div style="text-align:center"><div style="font-size:16px;font-weight:700;color:#3B6D11">${p.c}</div><div style="font-size:14px;color:#aaa">✅ Đã vào</div></div>
              <div style="text-align:center"><div style="font-size:16px;font-weight:700;color:#aaa">${p.p}</div><div style="font-size:14px;color:#aaa">⏳ Chưa</div></div>
              <div style="text-align:center"><div style="font-size:16px;font-weight:700;color:#B91C1C">${p.x}</div><div style="font-size:14px;color:#aaa">🚫 Cancel</div></div>
              <div style="width:60px">
                <div class="pb"><div class="pb-fill" style="width:${r}%;background:#3B6D11"></div></div>
                <div style="font-size:14px;text-align:center;color:#aaa;margin-top:2px">${r}%</div>
              </div>
            </div>
          </div>
        </div>`}).join('')}
    </div>`;

  if(!S.rptEv){return overviewHtml+`<div class="empty" style="padding:24px">☝️ Chọn sự kiện ở trên để xem báo cáo chi tiết</div>`;}

  const selEv=db.events.find(e=>e.id===S.rptEv);
  if(!selEv||!canAccessEvent(S.rptEv))return overviewHtml+`<div class="empty" style="padding:24px">Bạn không có quyền xem báo cáo sự kiện này.</div>`;

  // Danh sách Khách hàng (Main) — đối tượng dùng cho mọi breakdown & đánh giá tỷ lệ
  const mainGuests=egs(S.rptEv).map(g=>({
    name:g.name,code:g.guestCode,phone:g.phone,prmName:g.prmName,tcbRegion:g.tcbRegion,unit:g.unit,sihName:g.sihName,note:g.note,
    checkedIn:g.checkedIn,cancelled:g.cancelled,checkinTime:g.checkinTime,companions:g.companions||[],
    walkin:!!g.walkin
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
    if(wiTotal===0)return '<td style="padding:8px 12px;text-align:center;color:#ccc;font-size:14px">—</td>';
    return '<td style="padding:8px 12px;text-align:center;background:#FAFAFF">'
      +'<div style="font-size:18px;font-weight:800;color:'+color+'">'+val+'</div>'
      +(sub?'<div style="font-size:14px;color:#aaa;margin-top:1px">'+sub+'</div>':'')
      +'</td>';
  }
  function prCell(val, color, sub){
    return '<td style="padding:8px 12px;text-align:center">'
      +'<div style="font-size:18px;font-weight:800;color:'+color+'">'+val+'</div>'
      +(sub?'<div style="font-size:14px;color:#aaa;margin-top:1px">'+sub+'</div>':'')
      +'</td>';
  }

  const walkinTableHtml=`
  <div style="font-size:14px;font-weight:700;color:#888;letter-spacing:1px;margin:0 0 8px;text-transform:uppercase">📊 Pre-registered vs Walk-in (Main)</div>
  <div style="background:#fff;border-radius:12px;border:1px solid #eaecf0;margin-bottom:14px;overflow:hidden">
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#f8fafc">
        <th style="padding:10px 12px;text-align:left;font-size:14px;color:#aaa;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #eaecf0"></th>
        <th style="padding:10px 12px;text-align:center;font-size:14px;font-weight:700;color:#185FA5;border-bottom:1px solid #eaecf0">📋 Pre-registered</th>
        <th style="padding:10px 12px;text-align:center;font-size:14px;font-weight:700;color:#7C3AED;border-bottom:1px solid #eaecf0;background:${wiTotal>0?'#F5F3FF':'#f8fafc'}">🚶 Walk-in</th>
      </tr></thead>
      <tbody>
        <tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:8px 12px;font-size:14px;color:#555;font-weight:600">Tổng KH</td>
          ${prCell(prTotal,'#185FA5','')}
          ${wiCell(wiTotal,'#7C3AED','')}
        </tr>
        <tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:8px 12px;font-size:14px;color:#3B6D11;font-weight:600">✅ Đã vào</td>
          ${prCell(prCi,'#3B6D11',prPct+'% turnout')}
          ${wiCell(wiCi,'#3B6D11',wiPct+'% turnout')}
        </tr>
        <tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:8px 12px;font-size:14px;color:#888;font-weight:600">⏳ Chưa tới</td>
          ${prCell(prPd,'#aaa','')}
          ${wiCell(wiPd,'#aaa','')}
        </tr>
        <tr>
          <td style="padding:8px 12px;font-size:14px;color:#B91C1C;font-weight:600">🚫 Cancel</td>
          ${prCell(prCn>0?prCn:'—',prCn>0?'#B91C1C':'#ccc','')}
          ${wiCell(wiCn>0?wiCn:'—',wiCn>0?'#B91C1C':'#ccc','')}
        </tr>
      </tbody>
    </table>
    ${wiTotal===0?'<div style="padding:8px 14px;font-size:14px;color:#bbb;text-align:center;border-top:1px solid #f0f0f0">Sự kiện này chưa có khách Walk-in</div>':''}
  </div>`;

  const statsHtml=`<div style="font-size:14px;font-weight:700;color:#888;letter-spacing:1px;margin-bottom:8px;text-transform:uppercase">Tổng quan (Khách hàng - Main)</div>
  <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
    ${statCard('Tổng KH mời (Main)','#185FA5',totalM,'')}
    ${statCard('✅ KH đã tới','#3B6D11',ciM,pctM+'% turnout')}
    ${statCard('⏳ KH chưa tới','#888',pdM,'')}
    ${statCard('🚫 KH cancel','#B91C1C',cnM,'')}
  </div>
  <div style="background:#fff;border-radius:12px;padding:14px 18px;margin-bottom:14px;border:1px solid #eaecf0">
    <div style="display:flex;justify-content:space-between;font-size:15px;margin-bottom:8px">
      <span style="font-weight:700">${selEv.name}</span>
      <span style="color:#3B6D11;font-weight:700">${pctM}%</span>
    </div>
    <div style="background:#f0f0f0;border-radius:99px;height:12px;overflow:hidden">
      <div style="width:${pctM}%;background:linear-gradient(90deg,#185FA5,#3B6D11);height:100%;border-radius:99px;transition:width .4s"></div>
    </div>
  </div>
  ${walkinTableHtml}
  <div style="font-size:14px;font-weight:700;color:#888;letter-spacing:1px;margin-bottom:8px;text-transform:uppercase">Tổng lượt tham dự thực tế (Main + Companion)</div>
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
    return `<span style="font-size:14px;font-weight:600;color:${color};white-space:nowrap;margin-left:8px">${parts.join(' ')}</span>`;
  }

  function mkBreakdown(label,icon,groupFn,keyFn){
    const groups={};
    mainGuests.forEach(g=>{const k=keyFn(g)||'Không xác định';if(!groups[k])groups[k]=[];groups[k].push(g)});
    const entries=Object.entries(groups).sort((a,b)=>b[1].length-a[1].length);
    if(!entries.length)return'';
    return`<div style="font-size:14px;font-weight:700;color:#888;letter-spacing:1px;margin:16px 0 8px;text-transform:uppercase">${icon} Theo ${label} (Main)</div>
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
            <div style="font-weight:700;font-size:15px">${grp} <span style="font-weight:400;color:#aaa;font-size:14px">(${gs.length} Main)</span></div>
            <div style="display:flex;gap:6px;font-size:14px;flex-wrap:wrap">
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
          <div style="font-size:14px;color:#aaa;margin-top:4px;text-align:right">${pct}% Main đã check-in</div>
          ${expCi&&ci>0?`<div style="background:#f0faf0;border:1px solid #97C459;border-radius:8px;padding:10px 12px;margin-top:8px">
            <div style="font-size:14px;font-weight:700;color:#3B6D11;margin-bottom:6px">Đã check-in (${ci} Main)</div>
            ${gs.filter(g=>g.checkedIn).map(g=>`<div style="padding:5px 0;border-bottom:.5px solid #c8e6c9;display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-weight:600;font-size:15px">${g.name}${g.walkin?'<span style="font-size:14px;background:#EDE9FE;color:#7C3AED;padding:1px 5px;border-radius:6px;margin-left:4px">Walk-in</span>':''}</div>
                <div style="font-size:14px;color:#888">${g.code}${g.phone?' · '+g.phone:''}</div>
                <div style="font-size:14px;color:#3B6D11">✅ ${fmtTm(g.checkinTime)}</div>
              </div>
              ${companionBadge(g)}
            </div>`).join('')}
          </div>`:''}
          ${expAb&&pend>0?`<div style="background:#fff8f8;border:1px solid #fdd;border-radius:8px;padding:10px 12px;margin-top:8px">
            <div style="font-size:14px;font-weight:700;color:#e24b4a;margin-bottom:6px">Chưa check-in (${pend} Main)</div>
            ${gs.filter(g=>!g.checkedIn&&!g.cancelled).map(g=>`<div style="padding:5px 0;border-bottom:.5px solid #fdd;display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-weight:600;font-size:15px">${g.name}</div>
                <div style="font-size:14px;color:#888">${g.code}${g.phone?' · '+g.phone:''}</div>
              </div>
              ${companionBadge(g)}
            </div>`).join('')}
          </div>`:''}
          ${expCn&&cn>0?`<div style="background:#FFF8F8;border:1px solid #FECACA;border-radius:8px;padding:10px 12px;margin-top:8px">
            <div style="font-size:14px;font-weight:700;color:#B91C1C;margin-bottom:6px">Đã cancel (${cn} Main)</div>
            ${gs.filter(g=>g.cancelled).map(g=>`<div style="padding:5px 0;border-bottom:.5px solid #FECACA;display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-weight:600;font-size:15px;text-decoration:line-through;color:#bbb">${g.name}</div>
                <div style="font-size:14px;color:#aaa">${g.code}${g.phone?' · '+g.phone:''}</div>
                ${g.note?`<div style="font-size:14px;color:#B91C1C;font-style:italic">${g.note}</div>`:''}
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
    <div style="font-size:14px;color:#888;margin-bottom:4px">${lbl}</div>
    <div style="font-size:28px;font-weight:800;color:${color};line-height:1">${val}</div>
    ${sub?`<div style="font-size:14px;color:#aaa;margin-top:4px">${sub}</div>`:''}
  </div>`;
}
function togRpt(key){S.rptExp[key]=!S.rptExp[key];R()}
function setRptEv(v){
  if(v&&!canAccessEvent(v)){S.rptEv=null;R();return}
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
  if(S.modal==='guest_detail')return wrapModal(rGuestDetailM(),'lg');
  if(S.modal==='edit_pw')return wrapModal(rEditPwM(),'sm');
  if(S.modal==='edit_form')return wrapModal(rEditFormM(),'lg');
  if(S.modal==='del_pw')return wrapModal(rDelM(),'sm');
  if(S.modal==='cp_ticket')return wrapModal(rCpTicketM(),'sm');
  if(S.modal==='cp_detail')return wrapModal(rCpDetailM(),'sm');
  if(S.modal==='cp_edit')return wrapModal(rCpEditM(),'sm');
  if(S.modal==='cp_del')return wrapModal(rCpDelM(),'sm');
  if(S.modal==='cp_add')return wrapModal(rCpAddM());
  if(S.modal==='admin_ci')return wrapModal(rAdminCIM(),'sm');
  if(S.modal==='cancel')return wrapModal(rCancelM(),'sm');
  if(S.modal==='import_source')return wrapModal(rImportSourceM(),'lg');
  if(S.modal==='import_preview')return wrapModal(rImportPreviewM(),'lg');
  if(S.modal==='walkin')return wrapModal(rWalkinM(),'lg');
  if(S.modal==='ci_unlock')return wrapModal(rCIUnlockM(),'sm');
  if(S.modal==='admin_account')return wrapModal(rAdminAccountM(),'sm');
  if(S.modal==='account_form')return wrapModal(rAccountFormM(),'sm');
  if(S.modal==='account_del')return wrapModal(rAccountDelM(),'sm');
  return'';
}

function rAdminAccountM(){
  return`<div class="mh">🔑 Đổi mật khẩu</div>
    <div style="font-size:15px;color:#888;margin-bottom:14px">Đổi mật khẩu tài khoản đang đăng nhập. Chỉ cần nhập mật khẩu mới và xác nhận lại.</div>
    <div class="fg"><label>Mật khẩu mới</label>
      <input type="password" id="admin_pw_new" placeholder="Nhập mật khẩu mới" autocomplete="new-password" autofocus
        onkeydown="if(event.key==='Enter')saveAdminPw()"/></div>
    <div class="fg"><label>Xác nhận mật khẩu mới</label>
      <input type="password" id="admin_pw_confirm" placeholder="Nhập lại mật khẩu mới" autocomplete="new-password"
        onkeydown="if(event.key==='Enter')saveAdminPw()"/></div>
    <div id="admin_pw_err" class="err"></div>
    <div class="mf">
      <button class="btn" onclick="closeM()">Huỷ</button>
      <button class="btn blue" onclick="saveAdminPw()">💾 Lưu mật khẩu</button>
    </div>`;
}

function roleOptions(selected,target=null){
  return Object.entries(ROLE_DEFS)
    .filter(([value])=>canAssignAccountRole(value,target))
    .map(([value,info])=>`<option value="${value}" ${selected===value?'selected':''}>${info.label}</option>`).join('');
}

function rAccountFormM(){
  if(!canManageAccounts())return'<div class="mh">Không có quyền</div>';
  const isEdit=!!S.editAccountId;
  const acc=isEdit?loadAccounts().find(x=>x.id===S.editAccountId):null;
  if(isEdit&&!acc)return'<div class="mh">Không tìm thấy tài khoản</div>';
  if(isEdit&&!canManageAccountTarget(acc))return'<div class="mh">Không có quyền sửa tài khoản này</div>';
  const selectedRole=acc?.role||'staff';
  return`<div class="mh">${isEdit?'✏️ Chỉnh sửa tài khoản':'👤 Tạo tài khoản mới'}</div>
    <div class="fg"><label>Họ tên *</label>
      <input id="acc_name" value="${esc(acc?.name||'')}" placeholder="VD: Nguyễn Văn A" autofocus /></div>
    <div class="fg"><label>Tên đăng nhập *</label>
      <input id="acc_user" value="${esc(acc?.username||'')}" placeholder="vd: nguyenvana" ${isEdit?'disabled':''} autocomplete="off" /></div>
    <div class="fg"><label>Vai trò *</label>
      <select id="acc_role" ${selectedRole==='super_admin'?'disabled':''}>${roleOptions(selectedRole,acc)}</select></div>
    <div class="fg"><label>${isEdit?'Mật khẩu mới':'Mật khẩu'} ${isEdit?'<span style="font-weight:400;color:#aaa">(để trống nếu giữ nguyên)</span>':'*'}</label>
      <input id="acc_pw" type="password" placeholder="${isEdit?'Nhập nếu muốn đổi mật khẩu':'Nhập mật khẩu'}" autocomplete="new-password" onkeydown="if(event.key==='Enter'&&!${isEdit})saveAccount()" /></div>
    ${isEdit?`<div class="fg"><label>Xác nhận mật khẩu <span style="font-weight:400;color:#aaa">(nếu đổi)</span></label>
      <input id="acc_pw2" type="password" placeholder="Nhập lại mật khẩu mới" autocomplete="new-password" onkeydown="if(event.key==='Enter')saveAccount()"/></div>`:''}
    <div id="acc_err" class="err"></div>
    <div class="mf">
      <button class="btn" onclick="closeM()">Huỷ</button>
      <button class="btn blue" onclick="saveAccount()">💾 ${isEdit?'Lưu thay đổi':'Tạo tài khoản'}</button>
    </div>`;
}

function rAccountDelM(){
  const acc=loadAccounts().find(x=>x.id===S.delAccountId);
  if(!acc)return'<div class="mh">Không tìm thấy tài khoản</div>';
  if(!canManageAccountTarget(acc)||acc.role==='super_admin')return'<div class="mh">Không có quyền xoá tài khoản này</div>';
  return`<div class="mh">🗑️ Xoá tài khoản</div>
    <div style="font-size:15px;color:#555;margin-bottom:12px">Bạn chắc chắn muốn xoá tài khoản <b>${esc(acc.name)}</b> — <span class="mono">${esc(acc.username)}</span>?</div>
    <div id="acc_del_err" class="err"></div>
    <div class="mf">
      <button class="btn" onclick="closeM()">Huỷ</button>
      <button class="btn red" onclick="deleteAccount()">Xoá tài khoản</button>
    </div>`;
}

function rAddEvM(){
  const isEdit=S.modal==='edit_ev';
  const ev=isEdit?db.events.find(e=>e.id===S.editEvId):{};
  const btcList=ev?.btcMembers?.length?ev.btcMembers:[{account:''}];
  return`<div class="mh">${isEdit?'✏️ Chỉnh sửa sự kiện':'📅 Tạo sự kiện mới'}</div>
    <div class="g2">
      <div class="fg sp"><label>Tên sự kiện *</label><input id="ev_n" placeholder="VD: OneHousing Elite Night — The Global City" value="${ev?.name||''}"/></div>
      <div class="fg"><label>Thời gian tổ chức *</label><input id="ev_d" type="date" value="${ev?.date||''}"/></div>
      <div class="fg"><label>Team tổ chức *</label><input id="ev_t" placeholder="VD: Marketing Miền Nam" value="${ev?.team||''}"/></div>
      <div class="fg sp"><label>Địa điểm *</label><input id="ev_v" placeholder="VD: The Global City Ballroom" value="${ev?.venue||''}"/></div>
    </div>
    <div class="sec">🔑 Phân công nhân viên / BTC</div>
    <div style="font-size:14px;color:#aaa;margin-bottom:8px">Có thể phân công nhân viên/BTC phụ trách sự kiện. Nếu để trống, người tạo vẫn có thể quản lý và vận hành sự kiện.</div>
    <div id="btc_w">
      ${btcList.map((m,i)=>btcRowHTML(m,i)).join('')}
    </div>
    <button class="btn sm" onclick="addBR()" style="margin-bottom:4px">+ Thêm nhân viên</button>
    <div class="mf">
      <button class="btn" onclick="closeM()">Huỷ</button>
      <button class="btn ${isEdit?'green':'blue'}" onclick="saveEv()">✅ ${isEdit?'Lưu thay đổi':'Tạo sự kiện'}</button>
    </div>`;
}

function rAddGM(){
  const isEdit=S.modal==='edit_g';
  const g=isEdit&&S.editGid?db.guests.find(x=>x.id===S.editGid):{};
  const comps=isEdit?(g?.companions||[]):[]; 
  return`<div class="mh">${S.modal==='edit_g'?'✏️ Chỉnh sửa khách mời':'👤 Thêm khách mời mới'}</div>
    ${S.modal==='edit_g'?`<div style="margin-bottom:10px"><span style="font-size:14px;color:#aaa">Mã KH:</span> <span class="mono">${g?.guestCode||''}</span> <span style="font-size:14px;color:#ccc">(cố định, không thay đổi)</span></div>`:''}
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
    ${S.modal==='edit_g'?`
    <div style="margin:10px 0 4px">
      <label id="g_walkin_lbl" style="display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;padding:10px 14px;background:${g?.walkin?'#EDE9FE':'#f8fafc'};border:1.5px solid ${g?.walkin?'#7C3AED':'#e0e4ef'};border-radius:10px">
        <input type="checkbox" id="g_walkin" ${g?.walkin?'checked':''} style="width:16px;height:16px;accent-color:#7C3AED;cursor:pointer"
          onchange="document.getElementById('g_walkin_lbl').style.background=this.checked?'#EDE9FE':'#f8fafc';document.getElementById('g_walkin_lbl').style.borderColor=this.checked?'#7C3AED':'#e0e4ef'"/>
        <div>
          <span style="font-size:15px;font-weight:600;color:#5B21B6">🚶 Khách Walk-in</span>
          <div style="font-size:14px;color:#aaa;margin-top:2px">Tích nếu KH đến trực tiếp tại sự kiện, không đăng ký trước</div>
        </div>
      </label>
    </div>`:''}
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
    ${existingCode?`<div style="margin-top:6px;font-size:14px;color:#aaa">Mã: <span class="mono">${existingCode}</span> (cố định)</div>`:''}
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
    <div style="font-size:15px;color:#aaa;margin-bottom:4px">${ev?.name||''} · ${fmtD(ev?.date)}</div>
    <div style="font-size:14px;color:#bbb;margin-bottom:16px">${all.length} vé · 1 KH chính${g.companions?.length?' + '+g.companions.length+' đi kèm':''}</div>
    <div class="tgrid">
      ${all.map((tk,idx)=>`
        <div class="ticket">
          <div class="tk-header">VÉ THAM DỰ SỰ KIỆN</div>
          <div style="font-size:14px;color:#bbb;margin-bottom:6px">${ev?.name||''}</div>
          <div style="font-size:14px;color:#bbb;margin-bottom:12px">${fmtD(ev?.date)}${ev?.venue?' · '+ev.venue:''}</div>
          <div class="tk-name">${tk.name}</div>
          <span class="tk-role ${tk.type==='main'?'b-blue':'b-purple'}">${tk.type==='main'?'Khách mời chính':'Đi kèm: '+tk.parentName}</span>
          <div class="tk-qr" id="tqr_${idx}"></div>
          <div class="tk-code">${tk.code}</div>
          <div class="tk-foot">
            Vui lòng xuất trình vé tại cổng check-in<br>
            Vé chỉ có giá trị cho 01 người
          </div>
          <button class="btn sm" onclick="dlTicket(${idx},'${tk.name.replace(/'/g,"\\'")}','${tk.code}','${tk.type==='main'?'Khách mời chính':'Đi kèm: '+(tk.parentName||'').replace(/'/g,"\\'")}')" style="margin-top:10px">⬇️ Tải vé này</button>
        </div>
      `).join('')}
    </div>
    <div class="mf" style="justify-content:center">
      <button class="btn" onclick="printAll()">🖨️ In tất cả vé</button>
      <button class="btn" onclick="closeM()">Đóng</button>
    </div>`;
}

function detailField(label,value,extraClass=''){
  const v=value==null||value===''?'—':value;
  return`<div class="fg ${extraClass}"><label>${label}</label><input disabled value="${esc(v)}"/></div>`;
}
function detailArea(label,value){
  const v=value==null||value===''?'—':value;
  return`<div class="fg sp"><label>${label}</label><textarea disabled rows="3">${esc(v)}</textarea></div>`;
}
function detailStatus(person){
  if(person?.cancelled)return{label:'Cancel',badge:'b-amber'};
  if(person?.checkedIn)return{label:'Đã vào',badge:'b-green'};
  return{label:'Chưa check-in',badge:'b-gray'};
}
function rGuestDetailM(){
  const g=db.guests.find(x=>x.id===S.detailGid);
  if(!g)return'';
  const ev=db.events.find(e=>e.id===g.eventId);
  const status=detailStatus(g);
  const comps=g.companions||[];
  return`<div class="detail-modal">
    <div class="mh">👤 Chi tiết khách mời</div>
    <div class="detail-summary">
      <span class="mono">${esc(g.guestCode)}</span>
      <span class="badge ${status.badge}">${status.label}</span>
      ${g.walkin?`<span class="badge b-purple">Walk-in</span>`:''}
      ${g.cancelled&&g.cancelNote?`<span class="badge b-amber">${esc(g.cancelNote)}</span>`:''}
    </div>
    <div class="sec">Sự kiện</div>
    <div class="g3">
      ${detailField('Tên sự kiện',ev?.name)}
      ${detailField('Ngày tổ chức',fmtD(ev?.date))}
      ${detailField('Địa điểm',ev?.venue)}
    </div>
    <div class="sec">Thông tin khách hàng chính</div>
    <div class="g2">
      ${detailField('Họ và tên KH',g.name)}
      ${detailField('Số điện thoại',g.phone)}
    </div>
    <div class="sec">Thông tin chăm sóc</div>
    <div class="g3">
      ${detailField('PRM',g.prmName)}
      ${detailField('Vùng TCB',g.tcbRegion)}
      ${detailField('Đơn vị',g.unit)}
    </div>
    <div class="g2">
      ${detailField('SIH',g.sihName)}
      ${detailField('Loại khách',g.walkin?'Walk-in':'Đăng ký')}
    </div>
    ${detailArea('Note',g.note)}
    <div class="sec">Người đi kèm</div>
    <div id="detail_cp_w">
      ${comps.length?comps.map((c,i)=>{
        const cpStatus=detailStatus(c);
        return`<div class="cp-r detail-cp-r">
          <div class="g3" style="margin-bottom:0">
            ${detailField(`Tên đi kèm ${i+1}`,companionNameLabel(c.name))}
            ${detailField('SĐT',c.phone)}
            ${detailField('Mã vé',c.code)}
          </div>
          <div class="detail-inline-meta">
            <span class="badge ${cpStatus.badge}">${cpStatus.label}</span>
            ${c.checkedIn?`<span>Check-in: ${fmtDT(c.checkinTime)}</span>`:''}
            ${c.cancelled&&c.cancelNote?`<span>Cancel: ${esc(c.cancelNote)}</span>`:''}
          </div>
        </div>`;
      }).join(''):`<div class="empty detail-empty">Không có người đi kèm</div>`}
    </div>
    <div class="sec">Trạng thái</div>
    <div class="g3">
      ${detailField('Check-in lúc',g.checkedIn?fmtDT(g.checkinTime):'—')}
      ${detailField('Check-in bởi',g.checkinBy)}
      ${detailField('Ngày tạo',fmtDT(g.createdAt))}
    </div>
    ${g.cancelled?detailArea('Lý do cancel',g.cancelNote):''}
    <div class="mf">
      <button class="btn" onclick="closeM()">Đóng</button>
    </div>
  </div>`;
}

function rCpDetailM(){
  const {gid,cpId}=S.cpDetail||{};
  const g=db.guests.find(x=>x.id===gid);
  const cp=(g?.companions||[]).find(x=>x.id===cpId);
  if(!g||!cp)return'';
  const ev=db.events.find(e=>e.id===g.eventId);
  const status=detailStatus(cp);
  return`<div class="detail-modal">
    <div class="mh">👤 Chi tiết người đi kèm</div>
    <div class="detail-summary">
      <span class="mono">${esc(cp.code)}</span>
      <span class="badge ${status.badge}">${status.label}</span>
      ${cp.cancelled&&cp.cancelNote?`<span class="badge b-amber">${esc(cp.cancelNote)}</span>`:''}
    </div>
    <div class="sec">Thông tin người đi kèm</div>
    <div class="g2">
      ${detailField('Họ và tên',companionNameLabel(cp.name))}
      ${detailField('Số điện thoại',cp.phone)}
    </div>
    <div class="g2">
      ${detailField('Mã vé',cp.code)}
      ${detailField('Đi kèm khách chính',g.name)}
    </div>
    <div class="sec">Sự kiện</div>
    <div class="g2">
      ${detailField('Tên sự kiện',ev?.name)}
      ${detailField('Ngày tổ chức',fmtD(ev?.date))}
    </div>
    ${detailField('Địa điểm',ev?.venue,'sp')}
    <div class="sec">Trạng thái</div>
    <div class="g2">
      ${detailField('Check-in lúc',cp.checkedIn?fmtDT(cp.checkinTime):'—')}
      ${detailField('Check-in bởi',cp.checkinBy)}
    </div>
    ${cp.cancelled?detailArea('Lý do cancel',cp.cancelNote):''}
    <div class="mf">
      <button class="btn" onclick="closeM()">Đóng</button>
    </div>
  </div>`;
}

function rEditPwM(){
  return`<div class="mh">✏️ Xác nhận chỉnh sửa</div>
    <div style="font-size:15px;color:#888;margin-bottom:12px">Nhập mật khẩu Admin để chỉnh sửa thông tin khách.</div>
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
    <div style="margin-bottom:12px"><span class="mono">${g.guestCode}</span> <span style="font-size:14px;color:#ccc">(mã cố định)</span></div>
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
        <div style="margin-top:5px;font-size:14px;color:#aaa">Mã: <span class="mono">${c.code||'—'}</span> (cố định)</div>
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
    <div style="margin:10px 0 4px">
      <label id="eg_walkin_lbl" style="display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;padding:10px 14px;background:${g.walkin?'#EDE9FE':'#f8fafc'};border:1.5px solid ${g.walkin?'#7C3AED':'#e0e4ef'};border-radius:10px">
        <input type="checkbox" id="eg_walkin" ${g.walkin?'checked':''} style="width:16px;height:16px;accent-color:#7C3AED;cursor:pointer"
          onchange="document.getElementById('eg_walkin_lbl').style.background=this.checked?'#EDE9FE':'#f8fafc';document.getElementById('eg_walkin_lbl').style.borderColor=this.checked?'#7C3AED':'#e0e4ef'"/>
        <div>
          <span style="font-size:15px;font-weight:600;color:#5B21B6">🚶 Khách Walk-in</span>
          <div style="font-size:14px;color:#aaa;margin-top:2px">Tích nếu KH đến trực tiếp tại sự kiện, không đăng ký trước</div>
        </div>
      </label>
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
      <div style="font-size:15px;color:#555;margin-bottom:4px">Xoá <b>${g?.name||''}</b> — <span class="mono">${g?.guestCode||''}</span></div>
      <div style="font-size:14px;color:#bbb;margin-bottom:16px">Hành động này không thể hoàn tác. Người đi kèm cũng bị xoá.</div>
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
      <div style="font-size:14px;color:#bbb;margin-bottom:6px">${ev?.name||''}</div>
      <div style="font-size:14px;color:#bbb;margin-bottom:12px">${fmtD(ev?.date)}${ev?.venue?' · '+ev.venue:''}</div>
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
    <div style="font-size:14px;color:#aaa;margin-bottom:12px">Mã: <span class="mono">${cp.code}</span> (cố định)</div>
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
      <div style="font-size:15px;color:#555;margin-bottom:4px">Xoá <b>${cp.name}</b> <span class="mono">${cp.code}</span></div>
      <div style="font-size:14px;color:#aaa;margin-bottom:4px">Đi kèm: ${g.name}</div>
      <div style="font-size:14px;color:#bbb;margin-bottom:14px">Hành động này không thể hoàn tác.</div>
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
    <div style="font-size:15px;color:#888;margin-bottom:14px">Thêm cho: <b>${g.name}</b> <span class="mono">${g.guestCode}</span></div>
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
      <div style="font-size:14px;font-weight:700;letter-spacing:1px;color:#aaa;margin-bottom:6px">THÔNG TIN KHÁCH</div>
      <div style="font-size:18px;font-weight:800;margin-bottom:4px">${person.name}</div>
      <div style="font-size:15px;color:#185FA5;margin-bottom:4px">Mã: <span style="font-family:'Be Vietnam Pro',sans-serif">${type==='c'?(g.companions||[]).find(x=>x.id===cpId)?.code||'—':g.guestCode}</span></div>
      ${type==='c'?`<div style="margin-top:4px"><span class="badge b-purple">Đi kèm: ${g.name}</span></div>`:''}
      ${g.note&&type==='g'?`<div style="margin-top:6px"><span class="badge b-amber">${g.note}</span></div>`:''}
    </div>
    ${hasPhone?`
      <div style="font-size:15px;color:#555;text-align:center;margin-bottom:12px">🔢 Nhập 4 số cuối số điện thoại để xác nhận</div>
      <input id="aci_ph" type="tel" maxlength="4" placeholder="— — — —"
        style="width:100%;padding:14px;text-align:center;letter-spacing:10px;font-size:26px;font-family:'Be Vietnam Pro',sans-serif;border:2px solid #dde4f0;border-radius:12px"
        onkeydown="if(event.key==='Enter')doAdminCI()"/>
      <div id="aci_err" class="err" style="text-align:center;margin-top:8px"></div>
      <div class="mf">
        <button class="btn" onclick="closeM()">Huỷ</button>
        <button class="btn green" onclick="doAdminCI()" style="padding:10px 28px">✅ Xác nhận Check-in</button>
      </div>`
    :`<div style="font-size:15px;color:#888;text-align:center;margin-bottom:16px">Khách không có SĐT — check-in trực tiếp không cần xác minh.</div>
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
      <div style="font-size:16px;font-weight:700">${person.name}</div>
      <div style="font-size:14px;color:#aaa;margin-top:3px">Mã: <span class="mono">${type==='c'?person.code:g.guestCode}</span>${type==='c'?` · Đi kèm: ${g.name}`:''}</div>
    </div>
    <div class="fg">
      <label>Lý do cancel / Ghi chú (tuỳ chọn)</label>
      <textarea id="cancel_note" placeholder="VD: KH có việc đột xuất, chưa xác nhận lại..." style="resize:vertical;min-height:70px;padding:9px 12px;border:1.5px solid #dde4f0;border-radius:8px;font-size:15px;width:100%"></textarea>
    </div>
    <div style="font-size:14px;color:#aaa;margin-bottom:12px">Khách sẽ được giữ trong hệ thống và hiện trong báo cáo với trạng thái Cancel. Có thể khôi phục bất kỳ lúc nào.</div>
    <div class="mf">
      <button class="btn" onclick="closeM()">Huỷ</button>
      <button class="btn red" onclick="doCancel()">🚫 Xác nhận Cancel</button>
    </div>`;
}

function rImportSourceM(){
  return`<div class="mh">📥 Import danh sách khách</div>
    <div style="font-size:14px;color:#7f8a9c;margin-bottom:14px">Tải file Excel/CSV lên hoặc nhập link Google Sheet/public sheet đã mở quyền xem công khai.</div>
    <button type="button" class="import-dropzone" onclick="triggerExcelImport()" ondragover="handleImportDrag(event,true)" ondragleave="handleImportDrag(event,false)" ondrop="handleImportDrop(event)">
      <span class="material-symbols-rounded mi" aria-hidden="true">upload_file</span>
      <span class="import-drop-title">Kéo thả file Excel vào đây</span>
      <span class="import-drop-sub">hoặc bấm để chọn file từ máy (.xlsx, .xls, .csv)</span>
    </button>
    <div class="import-modal-actions">
      <button class="btn" onclick="downloadExcelTemplate()"><span class="material-symbols-rounded mi" aria-hidden="true">description</span>Tải mẫu Excel</button>
    </div>
    <div class="sec">Import từ public sheet</div>
    <div class="fg">
      <label>Link Google Sheet / CSV public</label>
      <input id="public_sheet_url" placeholder="Dán link Google Sheet public hoặc file CSV..." onkeydown="if(event.key==='Enter')importPublicSheet()"/>
    </div>
    <div style="font-size:14px;color:#98a4b6;margin-top:-4px">Sheet cần các cột: Loại Khách, Họ và Tên, Số Điện Thoại, Tên PRM, Vùng TCB, Đơn vị, Tên SIH, Note.</div>
    <div id="import_source_err" class="err"></div>
    <div class="mf">
      <button class="btn" onclick="closeM()">Huỷ</button>
      <button class="btn green" onclick="importPublicSheet()"><span class="material-symbols-rounded mi" aria-hidden="true">cloud_download</span>Import từ link</button>
    </div>`;
}

/* Modal xem trước dữ liệu khi Import Excel */
function rImportPreviewM(){
  const data = S.importData || [];
  return `
    <div class="mh">📊 Xác nhận Import danh sách từ Excel</div>
    <div style="font-size:14px;color:#aaa;margin-bottom:12px">Hệ thống tìm thấy <b>${data.length} dòng dữ liệu</b>. Vui lòng kiểm tra kỹ trước khi lưu.</div>
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

/* Modal mở check-in bù sau sự kiện — yêu cầu Admin PW */
function rCIUnlockM(){
  const ev=db.events.find(e=>e.id===S.ciUnlockTarget);if(!ev)return'';
  return`<div class="mh">🔓 Mở check-in bù</div>
    <div style="background:#FEF3C7;border:1px solid #FCD34D;border-radius:10px;padding:14px;margin-bottom:16px">
      <div style="font-size:15px;font-weight:700;color:#92400E;margin-bottom:4px">⚠️ Mở check-in sau sự kiện</div>
      <div style="font-size:14px;color:#B45309">Sự kiện <b>${ev.name}</b> đã kết thúc (${fmtD(ev.date)}). Chức năng này chỉ dùng để check-in bù cho KH đã tới nhưng chưa được ghi nhận. Nhập mật khẩu Admin để xác nhận.</div>
    </div>
    <div class="fg"><label>Mật khẩu Admin</label>
      <input type="password" id="ci_unlock_pw" placeholder="Nhập mật khẩu Admin..."
        style="font-size:16px;padding:11px 14px"
        autofocus onkeydown="if(event.key==='Enter')doCIUnlock()"/></div>
    <div id="ci_unlock_err" style="color:#B91C1C;font-size:14px;margin-bottom:8px"></div>
    <div class="mf">
      <button class="btn" onclick="closeM()">Huỷ</button>
      <button class="btn" style="background:#D97706;color:#fff;border-color:#D97706" onclick="doCIUnlock()">🔓 Xác nhận mở</button>
    </div>`;
}

function doCIUnlock(){
  const pw=document.getElementById('ci_unlock_pw')?.value||'';
  if(pw!==getAdminPw()){
    const el=document.getElementById('ci_unlock_err');
    if(el)el.textContent='⚠️ Mật khẩu Admin không đúng.';
    const inp=document.getElementById('ci_unlock_pw');if(inp){inp.value='';inp.focus();}
    return;
  }
  S.unlockedCIEvs[S.ciUnlockTarget]=true;
  S.ciUnlockTarget=null;S.modal=null;R();
}

/* ============================================================
   URL CHECK-IN VIEW (Scan QR)
   ============================================================ */
function rUrlCI(){
  const code=canonicalTicketCode(S.urlCode);
  const found=findAnyCode(code);
  const ev=found?db.events.find(e=>e.id===found?.guest?.eventId):null;

  if(!found){
    return`<div style="max-width:400px;margin:60px auto;padding:24px;text-align:center;font-family:'Be Vietnam Pro',sans-serif">
      <div style="font-size:52px;margin-bottom:12px">❌</div>
      <div style="font-size:18px;font-weight:700;color:#a32d2d;margin-bottom:8px">Không tìm thấy vé</div>
      <div style="font-size:15px;color:#aaa;margin-bottom:20px">Mã <b>${code}</b> không tồn tại trong hệ thống.</div>
    </div>`;
  }

  const p=found.person;const g=found.guest;

  if(S.urlCIStep==='done'){
    return`<div style="max-width:400px;margin:40px auto;padding:24px;text-align:center;font-family:'Be Vietnam Pro',sans-serif">
      <div style="font-size:64px;margin-bottom:12px">🎉</div>
      <div style="font-size:22px;font-weight:800;color:#0C447C;margin-bottom:10px">Check-in thành công!</div>
      <div style="font-size:17px;font-weight:600;color:#185FA5;margin-bottom:4px">${p.name}</div>
      ${found.type==='comp'?`<div style="font-size:15px;color:#6D28D9;margin-bottom:4px">Đi kèm: ${g.name}</div>`:''}
      <div style="font-size:15px;color:#aaa">${ev?.name||''}</div>
      ${g.note?`<div style="display:inline-block;margin-top:8px;background:#FFFBEB;color:#92400E;font-size:14px;padding:4px 12px;border-radius:20px">${g.note}</div>`:''}
      <div style="font-size:14px;color:#bbb;margin-top:12px">Ghi nhận lúc: ${fmtDT(p.checkinTime)}</div>
      ${S.urlCISyncWarn?`<div style="margin-top:14px;background:#FEF2F2;color:#B91C1C;font-size:14px;padding:10px 14px;border-radius:10px;text-align:left">
        ⚠️ Đã ghi nhận check-in trên thiết bị này, nhưng <b>chưa đồng bộ được lên hệ thống trung tâm</b> (có thể do mất mạng).
        Vui lòng báo BTC kỹ thuật kiểm tra lại để đảm bảo dữ liệu được cập nhật đầy đủ.
      </div>`:''}
      <div style="margin-top:24px"><button onclick="window.close()" style="padding:10px 24px;background:#256fe6;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-family:'Be Vietnam Pro',sans-serif">Đóng</button></div>
    </div>`;
  }

  if(p.checkedIn){
    return`<div style="max-width:400px;margin:60px auto;padding:24px;text-align:center;font-family:'Be Vietnam Pro',sans-serif">
      <div style="font-size:52px;margin-bottom:12px">⚠️</div>
      <div style="font-size:18px;font-weight:700;color:#BA7517;margin-bottom:8px">Vé đã được sử dụng</div>
      <div style="font-size:16px;font-weight:600">${p.name}</div>
      <div style="font-size:14px;color:#aaa;margin-top:6px">Check-in lúc: ${fmtDT(p.checkinTime)}</div>
      <div style="font-size:14px;color:#aaa">Xác nhận bởi: ${p.checkinBy||'—'}</div>
    </div>`;
  }

  if(p.cancelled){
    return`<div style="max-width:400px;margin:60px auto;padding:24px;text-align:center;font-family:'Be Vietnam Pro',sans-serif">
      <div style="font-size:52px;margin-bottom:12px">🚫</div>
      <div style="font-size:18px;font-weight:700;color:#B91C1C;margin-bottom:8px">Vé đã bị huỷ</div>
      <div style="font-size:16px;font-weight:600">${p.name}</div>
      <div style="font-size:14px;color:#aaa;margin-top:6px">${p.cancelNote||''}</div>
    </div>`;
  }

  const hasPhone=!!p.phone;
  const useSessionCheckin=!!(S.adminOk&&canAccessEvent(g.eventId));
  const op=currentCheckinOperator();
  return`<div style="max-width:420px;margin:0 auto;padding:20px 16px;font-family:'Be Vietnam Pro',sans-serif">
    <div style="text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #eaecf0">
      <div style="font-size:14px;font-weight:700;letter-spacing:2px;color:#bbb;margin-bottom:8px">VÉ THAM DỰ SỰ KIỆN</div>
      <div style="font-size:15px;color:#aaa;margin-bottom:4px">${ev?.name||'—'}</div>
      <div style="font-size:15px;color:#aaa">${fmtD(ev?.date)}${ev?.venue?' · '+ev.venue:''}</div>
    </div>
    <div style="background:#f4f7fb;border-radius:12px;padding:16px;margin-bottom:20px;text-align:center">
      <div style="font-size:20px;font-weight:800;color:#1a1a2e">${p.name}</div>
      ${found.type==='comp'?`<div style="font-size:14px;color:#6D28D9;margin-top:4px;font-weight:500">Đi kèm: ${g.name}</div>`:''}
      <div style="font-family:'Be Vietnam Pro',sans-serif;font-size:14px;color:#aaa;margin-top:6px;letter-spacing:1px">${code}</div>
      ${g.note?`<div style="margin-top:6px;display:inline-block;background:#FFFBEB;color:#92400E;font-size:14px;padding:2px 10px;border-radius:20px;font-weight:600">${g.note}</div>`:''}
    </div>
    ${hasPhone?`
    <div style="margin-bottom:16px">
      <div style="font-size:15px;color:#555;text-align:center;margin-bottom:10px">🔢 Nhập 4 số cuối số điện thoại</div>
      <input id="uci_phone" type="tel" maxlength="4" placeholder="— — — —"
        style="width:100%;padding:14px;text-align:center;letter-spacing:10px;font-size:26px;font-family:'Be Vietnam Pro',sans-serif;border:2px solid #dde4f0;border-radius:12px;font-family:'Be Vietnam Pro',sans-serif"
        onkeydown="if(event.key==='Enter')doUrlCI()"/>
    </div>`:'<div style="font-size:15px;color:#aaa;text-align:center;margin-bottom:16px">Khách không có SĐT — xác nhận trực tiếp.</div>'}
    ${useSessionCheckin?`
    <div style="margin-bottom:12px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:12px;text-align:center">
      <div style="font-size:14px;color:#64748b;margin-bottom:2px">Xác nhận bằng tài khoản đang đăng nhập</div>
      <div style="font-size:15px;font-weight:700;color:#185FA5">${esc(op.name)}</div>
    </div>`:`
    <div style="margin-bottom:12px">
      <div style="font-size:15px;color:#555;text-align:center;margin-bottom:10px">🔑 Nhập mã nhân viên BTC để xác nhận</div>
      <input id="uci_btc" type="text" placeholder="Mã BTC (VD: NV001)"
        style="width:100%;padding:11px 14px;text-align:center;font-family:'Be Vietnam Pro',sans-serif;letter-spacing:2px;font-size:16px;text-transform:uppercase;border:2px solid #dde4f0;border-radius:10px"
        oninput="this.value=this.value.toUpperCase()" onkeydown="if(event.key==='Enter')doUrlCI()"/>
    </div>`}
    <div id="uci_err" style="color:#a32d2d;font-size:14px;text-align:center;margin-bottom:10px"></div>
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
  const code=canonicalTicketCode(S.urlCode);
  const found=findAnyCode(code);
  if(!found){return}
  const p=found.person;const g=found.guest;
  const ev=db.events.find(e=>e.id===g.eventId);
  if(isEvLocked(ev)){
    const el=document.getElementById('uci_err');
    if(el)el.textContent='⚠️ Sự kiện đã kết thúc. Không thể check-in.';return;
  }

  const useSessionCheckin=!!(S.adminOk&&canAccessEvent(g.eventId));
  let checkinBy=currentCheckinOperator().name;
  if(!useSessionCheckin){
    const btcInput=(document.getElementById('uci_btc')?.value||'').toUpperCase().trim();
    const btcOk=(ev?.btcMembers||[]).find(m=>m.code===btcInput);
    if(!btcOk){
      const el=document.getElementById('uci_err');
      if(el)el.textContent='⚠️ Mã BTC không đúng hoặc không thuộc sự kiện này.';
      return;
    }
    checkinBy=btcInput;
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
  if(found.type==='guest'){g.checkedIn=true;g.checkinTime=now;g.checkinBy=checkinBy}
  else{p.checkedIn=true;p.checkinTime=now;p.checkinBy=checkinBy}
  saveLocalOnly(); // ghi local ngay (localStorage) — không mất dữ liệu nếu mất mạng/đóng tab

  // Ghi atomic 1 record lên API, có retry — đây là nguồn xác nhận "thật"
  const patchFields = found.type==='guest'
    ? {checked_in:true,checkin_time:now,checkin_by:checkinBy}
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
  if(!S.ciState)return rCIIdleDesktop();
  const st=S.ciState;
  if(st.step==='verify')return rCIVerify();
  if(st.step==='done')return rCIDone();
  if(st.step==='err')return rCIErr();
  return rCIIdleDesktop();
}
function postCI(){setTimeout(()=>{
  if(S.view==='checkin'&&!S.ciOk){
  }
  if(S.view==='checkin'&&S.ciOk&&!S.ciState){
    if(shouldRunCheckinScanner())startQrScanner();
    else stopQrScanner();
    syncCheckinColumnHeight();
  }
  const el=firstVisibleElement(['ci_in','ci_ph','lock_ev']);
  if(el)el.focus()
},80)}

function rLock(){
  const events=visibleEvents();
  const op=S.ciOp||currentCheckinOperator();
  return`<div class="lock-layout">
    <div class="lock">
      <div class="lock-head">
        <div class="lock-icon"><span class="material-symbols-rounded mi" aria-hidden="true">qr_code_scanner</span></div>
        <div class="lock-title">App Check-in</div>
        <div class="lock-subtitle">Chọn sự kiện để bắt đầu phiên check-in.</div>
        <div class="lock-account"><span class="material-symbols-rounded mi" aria-hidden="true">person</span> ${esc(op.name)}</div>
      </div>
      <div class="fg lock-field"><label>Sự kiện</label><select id="lock_ev" style="width:100%" onchange="S.ciEv=this.value">
        <option value="">- Chọn sự kiện -</option>
        ${events.map(e=>`<option value="${e.id}" ${S.ciEv===e.id?'selected':''}>${e.name} (${fmtD(e.date)})</option>`).join('')}
      </select></div>
      <button class="btn blue full lock-start-btn" onclick="tryUnlock()">
        <span>Bắt đầu check-in</span>
        <span class="material-symbols-rounded mi" aria-hidden="true">arrow_forward</span>
      </button>
      <div id="lock_err" class="err" style="text-align:center;margin-top:8px"></div>
      <button class="btn ghost lock-back-btn" onclick="doLogout()">
        <span class="material-symbols-rounded mi" aria-hidden="true">logout</span>
        Đăng xuất
      </button>
    </div>
    <div class="lock-qr-card">
      <div class="check-login-qr-head">
        <span class="material-symbols-rounded mi" aria-hidden="true">qr_code_2</span>
        <div>
          <div class="check-login-qr-title">Mobile Check-in</div>
          <div class="check-login-qr-sub">Quét mã để mở công cụ check-in trên điện thoại</div>
        </div>
      </div>
      <div id="lock_check_qr" class="check-login-qr">${checkPageQRHTML()}</div>
      <div class="check-login-qr-url">${esc(checkPageUrl())}</div>
    </div>
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
      <button class="btn ghost sm" onclick="doLogout()" title="Đăng xuất"><span class="material-symbols-rounded mi" aria-hidden="true">logout</span></button>
      <div style="flex:1"><div style="font-weight:700;font-size:14px">${ev?.name||'Sự kiện'}</div>
        <div style="font-size:14px;color:#aaa">${p.c}/${p.t} đã check-in · Phụ trách: ${S.ciOp?.name||checkinByLabel()}</div></div>
      <button class="btn sm ci-switch-event-btn" onclick="lockOut()">
        <span class="material-symbols-rounded mi" aria-hidden="true">switch_access_shortcut</span>
        Đổi sự kiện
      </button>
    </div>
    <div style="text-align:center;padding:24px 16px">
      <div style="font-size:48px;margin-bottom:12px">📷</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:4px">Sẵn sàng nhận khách</div>
      <div style="font-size:15px;color:#aaa;margin-bottom:20px">Nhập mã từ vé (KH chính hoặc người đi kèm)</div>
      <div style="display:flex;gap:8px;max-width:320px;margin:0 auto">
        <input id="ci_in" placeholder="0000-0000" inputmode="numeric" maxlength="9" style="flex:1;padding:12px;border:2px solid #dde4f0;border-radius:10px;font-size:14px;font-family:'Be Vietnam Pro',sans-serif;letter-spacing:2px;text-transform:uppercase" oninput="formatCIInput(this)" onkeydown="if(event.key==='Enter')startCI()"/>
        <button class="btn blue" onclick="startCI()" style="padding:12px 16px">→</button>
      </div>
      <div id="ci_err" class="err" style="text-align:center;margin-top:8px"></div>
    </div>
    ${recent.length?`<div style="max-width:360px;margin:0 auto">
      <div style="font-size:14px;font-weight:600;color:#aaa;margin-bottom:8px">Vừa check-in</div>
      ${recent.slice(0,8).map(r=>`<div class="recent-item">
        <div><div style="font-weight:600;font-size:15px">${r.name} <span class="badge ${r.tag==='KH'?'b-blue':'b-purple'}" style="font-size:14px">${r.tag}</span></div>
          <div style="font-size:14px;color:#aaa">${r.code}</div></div>
        <div style="font-size:14px;color:#3B6D11;font-weight:600">${fmtTm(r.time)}</div>
      </div>`).join('')}
    </div>`:''}
  </div>`;
}

function rCIIdleDesktop(){
  const ev=db.events.find(e=>e.id===S.ciEv);
  const p=allPeople(S.ciEv);
  const gs=egs(S.ciEv);
  const recent=[];
  gs.forEach(g=>{
    if(g.checkedIn)recent.push({name:g.name,code:g.guestCode,time:g.checkinTime,tag:'Khách',tagClass:'b-blue',by:g.checkinBy});
    (g.companions||[]).forEach(c=>{
      if(c.checkedIn)recent.push({name:companionNameLabel(c.name),code:c.code,time:c.checkinTime,tag:'Đi kèm',tagClass:'b-purple',by:c.checkinBy});
    });
  });
  recent.sort((a,b)=>new Date(b.time||0)-new Date(a.time||0));
  const recentQuery=S.ciRecentSearch||'';
  const recentNeedle=normSearchText(recentQuery).trim();
  const visibleRecent=recentNeedle
    ? recent.filter(r=>normSearchText(`${r.name} ${r.code} ${r.by} ${r.tag}`).includes(recentNeedle))
    : recent;
  const mobileMode=S.ciMobileMode||'camera';
  return`<div class="ci-screen ci-desktop">
    <div class="ci-head ci-topbar">
      <button class="btn ghost sm ci-back-btn" onclick="doLogout()" title="Đăng xuất">
        <span class="material-symbols-rounded mi" aria-hidden="true">logout</span>
      </button>
      <div class="ci-event-meta">
        <div class="ci-event-name">${esc(ev?.name||'Sự kiện')}</div>
        <div class="ci-event-sub">${p.c}/${p.t} đã check-in · Phụ trách: ${esc(S.ciOp?.name||checkinByLabel())}</div>
      </div>
      <button class="btn sm ci-switch-event-btn" onclick="lockOut()">
        <span class="material-symbols-rounded mi" aria-hidden="true">switch_access_shortcut</span>
        Đổi sự kiện
      </button>
    </div>

    <div class="ci-grid">
      <section class="ci-camera-card ci-mobile-mode-${esc(mobileMode)}">
        <div class="ci-mobile-tabs">
          <button type="button" class="ci-mobile-tab ${mobileMode==='camera'?'on':''}" onclick="setCIMobileMode('camera')">
            <span class="material-symbols-rounded mi" aria-hidden="true">photo_camera</span>
            Camera
          </button>
          <button type="button" class="ci-mobile-tab ${mobileMode==='manual'?'on':''}" onclick="setCIMobileMode('manual')">
            <span class="material-symbols-rounded mi" aria-hidden="true">keyboard</span>
            Nhập mã
          </button>
        </div>
        <div class="ci-mobile-pane ci-pane-camera">
          <div class="ci-section-head">
            <div>
              <div class="ci-panel-title">Camera quét QR</div>
              <div class="ci-panel-sub">Đưa mã QR vào khung chữ nhật ở giữa.</div>
            </div>
            <div class="ci-camera-actions">
              <button type="button" class="ci-camera-switch" onclick="switchCICamera()" title="Đổi camera trước/sau" aria-label="Đổi camera trước/sau">
                <span class="material-symbols-rounded mi" aria-hidden="true">flip_camera_ios</span>
              </button>
              <span class="ci-live-dot"><span></span> Live</span>
            </div>
          </div>
          <div class="ci-camera-shell">
            <video id="ci_video" class="ci-video" autoplay muted playsinline></video>
            <div class="ci-camera-placeholder">
              <span class="material-symbols-rounded mi" aria-hidden="true">photo_camera</span>
            </div>
            <div class="ci-scan-frame" aria-hidden="true">
              <span class="ci-corner tl"></span><span class="ci-corner tr"></span>
              <span class="ci-corner bl"></span><span class="ci-corner br"></span>
            </div>
          </div>
          <div id="ci_camera_status" class="ci-camera-status">Đang mở camera...</div>
        </div>
        <div class="ci-manual-card ci-manual-inline ci-mobile-pane ci-pane-manual">
          <div class="ci-panel-title">Nhập mã khách hàng</div>
          <div class="ci-panel-sub">Dùng khi QR khó đọc hoặc khách cung cấp mã vé.</div>
          <div class="ci-manual-row">
            <input id="ci_in" class="ci-code-input" placeholder="0000-0000" autocomplete="off" inputmode="numeric" maxlength="9"
              oninput="formatCIInput(this)" onkeydown="if(event.key==='Enter')startCI()"/>
            <button class="btn blue ci-submit-btn" onclick="startCI()" title="Check-in mã này">
              <span class="material-symbols-rounded mi" aria-hidden="true">arrow_forward</span>
            </button>
          </div>
          <div id="ci_err" class="err ci-manual-error"></div>
        </div>
      </section>

      <section class="ci-ops-card">
        <div class="ci-recent-card">
          <div class="ci-section-head">
            <div>
              <div class="ci-panel-title">Check-in mới nhất</div>
              <div class="ci-panel-sub">Tự cập nhật realtime, mới nhất ở trên cùng.</div>
            </div>
            <span class="badge b-green">${visibleRecent.length}</span>
          </div>
          <div class="search-control ci-recent-search ${recentQuery?'has-value':''}">
            <span class="material-symbols-rounded mi search-leading" aria-hidden="true">search</span>
            <input id="ci_recent_search" class="search-input" placeholder="Tìm tên, mã, phụ trách..." value="${esc(recentQuery)}"
              oninput="setCIRecentSearch(this.value,this.selectionStart)">
            <button type="button" class="search-clear" onclick="clearCIRecentSearch()" title="Xóa tìm kiếm">
              <span class="material-symbols-rounded mi" aria-hidden="true">close</span>
            </button>
          </div>
          ${visibleRecent.length?`<div class="ci-recent-list">
            ${visibleRecent.map(r=>`<div class="ci-recent-item">
              <div class="ci-recent-main">
                <div class="ci-recent-name">${esc(r.name)} <span class="badge ${r.tagClass}">${esc(r.tag)}</span></div>
                <div class="ci-recent-code">${esc(r.code||'—')} ${r.by?`· ${esc(r.by)}`:''}</div>
              </div>
              <div class="ci-recent-time">${fmtTm(r.time)}</div>
            </div>`).join('')}
          </div>`:`<div class="ci-empty">
            <span class="material-symbols-rounded mi" aria-hidden="true">history</span>
            <div>${recent.length?'Không tìm thấy check-in phù hợp':'Chưa có khách check-in'}</div>
          </div>`}
        </div>
      </section>
    </div>
  </div>`;
}

function rCIVerify(){
  const st=S.ciState;const p=st.person;const g=st.guest;
  return`<div class="ci-screen">
    <div class="ci-head"><button class="btn ghost sm" onclick="cancelCI()">←</button>
      <div style="font-size:14px;font-weight:600">Xác minh danh tính</div></div>
    <div style="text-align:center;padding:20px 16px">
      <div style="background:#f4f7fb;border-radius:12px;padding:16px;display:inline-block;min-width:250px;margin-bottom:20px;text-align:left">
        <div style="font-size:14px;font-weight:700;letter-spacing:1px;color:#aaa;margin-bottom:6px">XÁC NHẬN CHECK-IN</div>
        <div style="font-size:18px;font-weight:800">${p.name}</div>
        <div style="font-size:15px;color:#185FA5;margin-top:4px">Mã: <span style="font-family:'Be Vietnam Pro',sans-serif">${st.code}</span></div>
        ${st.type==='comp'?`<div style="margin-top:6px"><span class="badge b-purple">Đi kèm: ${g.name}</span></div>`:''}
        ${g.note?`<div style="margin-top:6px"><span class="badge b-amber">${g.note}</span></div>`:''}
      </div>
      <div style="font-size:15px;color:#888;margin-bottom:14px">🔢 Nhập 4 số cuối số điện thoại để xác nhận</div>
      <input id="ci_ph" type="tel" maxlength="4" placeholder="— — — —"
        style="width:180px;padding:16px;text-align:center;letter-spacing:10px;font-size:26px;font-family:'Be Vietnam Pro',sans-serif;border:2px solid #dde4f0;border-radius:12px;display:block;margin:0 auto"
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
    <div style="font-size:15px;color:#aaa;margin-bottom:4px">${ev?.name||''}</div>
    ${st.type==='guest'&&(g.companions||[]).length?`<div style="font-size:14px;color:#BA7517;margin-top:10px;padding:8px 16px;background:#FFFBEB;border-radius:8px;display:inline-block">⚠️ ${g.companions.length} người đi kèm cần check-in riêng</div>`:''}
    ${g.note?`<div style="margin-top:10px;display:inline-block"><span class="badge b-amber">${g.note}</span></div>`:''}
    <div style="font-size:14px;color:#bbb;margin-top:12px">Ghi nhận lúc: ${fmtDT(p.checkinTime)} · BTC: ${p.checkinBy||'—'}</div>
    ${S.ciSyncWarn?`<div style="margin-top:14px;background:#FEF2F2;color:#B91C1C;font-size:14px;padding:10px 14px;border-radius:10px;text-align:left;max-width:360px;margin-left:auto;margin-right:auto">
      ⚠️ Đã ghi nhận check-in trên thiết bị này, nhưng <b>chưa đồng bộ được lên hệ thống trung tâm</b> (có thể do mất mạng hoặc lỗi API).
      Vui lòng kiểm tra lại kết nối và báo kỹ thuật nếu tình trạng tiếp diễn.
    </div>`:''}
    <div style="margin-top:24px">
      <button class="btn blue" onclick="nextCI()" style="padding:12px 32px;font-size:16px">📷 Scan vé tiếp theo</button>
    </div>
  </div></div>`;
}

function rCIErr(){
  return`<div class="ci-screen"><div class="big-result">
    <div class="icon">❌</div>
    <div style="font-size:18px;font-weight:700;color:#a32d2d;margin-bottom:8px">Xác minh thất bại</div>
    <div style="font-size:15px;color:#888;max-width:280px;margin:0 auto">${S.ciState.msg||'Thông tin không khớp'}</div>
    <div style="margin-top:20px"><button class="btn" onclick="cancelCI()" style="padding:10px 24px">← Thử lại</button></div>
  </div></div>`;
}

/* ============================================================
   ACTIONS
   ============================================================ */
function setTab(t){S.tab=t;R()}
function openGM(eid){
  const ev=db.events.find(e=>e.id===eid);if(!ev)return;
  if(!canAccessEvent(eid)){alert('Bạn không có quyền xem sự kiện này.');return}
  S.selEv=eid;S.tab='guests';S.search='';S.filter='all';R()}
function pickEv(v){
  if(!v){S.selEv=null;S.search='';S.filter='all';R();return}
  const ev=db.events.find(e=>e.id===v);if(!ev)return;
  if(!canAccessEvent(v)){S.selEv=null;S.search='';S.filter='all';R();return}
  S.selEv=v;S.search='';S.filter='all';R()}
function setSrch(v,pos){S.search=v;R();refocusInput('guest_search',pos)}
function setEvSrch(v,pos){S.evSearch=v;R();refocusInput('ev_search',pos)}
function setCIRecentSearch(v,pos){S.ciRecentSearch=v;R();refocusInput('ci_recent_search',pos)}
function clearSrch(){S.search='';R();refocusInput('guest_search',0)}
function clearEvSrch(){S.evSearch='';R();refocusInput('ev_search',0)}
function clearCIRecentSearch(){S.ciRecentSearch='';R();refocusInput('ci_recent_search',0)}
function setCIMobileMode(mode){S.ciMobileMode=mode==='manual'?'manual':'camera';R()}
async function switchCICamera(){
  S.ciCameraFacing=currentCameraFacing()==='environment'?'user':'environment';
  setCameraStatus('Đang đổi camera...','ready');
  await startQrScanner({facing:S.ciCameraFacing,force:true});
}
function setFil(v){S.filter=v;R()}
function openM(m){S.modal=m;R()}
function openAccount(){S.modal='admin_account';R()}
function openAccountForm(id=null){S.editAccountId=id;S.modal='account_form';R()}
function openAccountDel(id){S.delAccountId=id;S.modal='account_del';R()}
function openGuestDetail(id){S.detailGid=id;S.modal='guest_detail';R()}
function openCpDetail(gid,cpId){S.cpDetail={gid,cpId};S.modal='cp_detail';R()}
function openEdit(id){S.editGid=id;S.modal='edit_form';R()}
function openDel(id){S.delGid=id;S.modal='del_pw';R()}
function openTickets(id){S.ticketGid=id;S.modal='tickets';R()}
function closeM(){S.modal=null;S.editGid=null;S.detailGid=null;S.delGid=null;S.editAccountId=null;S.delAccountId=null;S.cpTicket=null;S.cpDetail=null;S.cpEdit=null;S.cpDel=null;S.cpAdd=null;S.adminCI=null;S.cancelTarget=null;S.evUnlockTarget=null;S.editEvId=null;S.importData=null;S.ciUnlockTarget=null;R()}

function saveAdminPw(){
  const pw=(document.getElementById('admin_pw_new')?.value||'').trim();
  const confirm=(document.getElementById('admin_pw_confirm')?.value||'').trim();
  const err=document.getElementById('admin_pw_err');
  if(!pw){if(err)err.textContent='⚠️ Vui lòng nhập mật khẩu mới.';return}
  if(pw!==confirm){if(err)err.textContent='⚠️ Mật khẩu xác nhận không khớp.';return}
  const accounts=loadAccounts();
  const idx=accounts.findIndex(acc=>acc.username===normalizeUsername(S.currentUser||LOGIN_USER));
  if(idx>=0){
    accounts[idx]={...accounts[idx],password:pw,updatedAt:Date.now()};
    saveAccounts(accounts);
  }else{
    setAdminPw(pw);
  }
  keepAdminSession(S.currentUser||LOGIN_USER);
  S.modal=null;
  R();
  alert('Đã đổi mật khẩu tài khoản.');
}

function saveAccount(){
  if(!canManageAccounts())return;
  const isEdit=!!S.editAccountId;
  const accounts=loadAccounts();
  const err=document.getElementById('acc_err');
  const name=(document.getElementById('acc_name')?.value||'').trim();
  const username=normalizeUsername(document.getElementById('acc_user')?.value||'');
  const role=document.getElementById('acc_role')?.value||'staff';
  const pw=(document.getElementById('acc_pw')?.value||'').trim();
  const pw2=(document.getElementById('acc_pw2')?.value||'').trim();
  if(!name){if(err)err.textContent='⚠️ Vui lòng nhập họ tên.';return}
  if(!username){if(err)err.textContent='⚠️ Vui lòng nhập tên đăng nhập.';return}
  if(!ROLE_DEFS[role]){if(err)err.textContent='⚠️ Vai trò không hợp lệ.';return}

  if(isEdit){
    const idx=accounts.findIndex(acc=>acc.id===S.editAccountId);
    if(idx<0){if(err)err.textContent='⚠️ Không tìm thấy tài khoản.';return}
    const old=accounts[idx];
    if(!canManageAccountTarget(old)){if(err)err.textContent='⚠️ Không có quyền sửa tài khoản này.';return}
    if(!canAssignAccountRole(role,old)){if(err)err.textContent='⚠️ Không thể gán vai trò này.';return}
    if(old.role==='super_admin'&&role!=='super_admin'){
      if(err)err.textContent='⚠️ Super Admin là tài khoản duy nhất của hệ thống.';return
    }
    if(old.role!=='super_admin'&&role==='super_admin'){
      if(err)err.textContent='⚠️ Không thể tạo thêm Super Admin.';return
    }
    if(pw||pw2){
      if(!pw){if(err)err.textContent='⚠️ Vui lòng nhập mật khẩu mới.';return}
      if(pw!==pw2){if(err)err.textContent='⚠️ Mật khẩu xác nhận không khớp.';return}
    }
    accounts[idx]={...old,name,role,password:pw||old.password,updatedAt:Date.now()};
  }else{
    if(role==='super_admin'){if(err)err.textContent='⚠️ Super Admin chỉ có 1 tài khoản duy nhất trên hệ thống.';return}
    if(!canAssignAccountRole(role)){if(err)err.textContent='⚠️ Không thể gán vai trò này.';return}
    if(accounts.some(acc=>acc.username===username)){if(err)err.textContent='⚠️ Tên đăng nhập đã tồn tại.';return}
    if(!pw){if(err)err.textContent='⚠️ Vui lòng nhập mật khẩu.';return}
    accounts.push({id:uid(),username,name,role,password:pw,createdAt:Date.now(),updatedAt:Date.now()});
  }
  saveAccounts(accounts);
  S.modal=null;S.editAccountId=null;R();
}

function deleteAccount(){
  if(!canManageAccounts())return;
  const accounts=loadAccounts();
  const acc=accounts.find(x=>x.id===S.delAccountId);
  const err=document.getElementById('acc_del_err');
  if(!acc)return;
  if(acc.username===normalizeUsername(S.currentUser)){if(err)err.textContent='⚠️ Không thể xoá tài khoản đang đăng nhập.';return}
  if(acc.role==='super_admin'){
    if(err)err.textContent='⚠️ Super Admin là tài khoản duy nhất của hệ thống.';return
  }
  if(!canManageAccountTarget(acc)){
    if(err)err.textContent='⚠️ Không có quyền xoá tài khoản này.';return
  }
  saveAccounts(accounts.filter(x=>x.id!==S.delAccountId));
  S.modal=null;S.delAccountId=null;R();
}

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
  if(!canManageEvents()){alert('Bạn không có quyền chỉnh sửa sự kiện.');return}
  // Sự kiện đã qua ngày vẫn cho phép sửa thông tin tĩnh — chỉ check-in/cancel/add-del mới bị khoá
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
  if(!ok)alert('⚠️ Đã ghi nhận Cancel trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng kiểm tra kết nối; hệ thống sẽ tự cập nhật realtime khi đồng bộ thành công.');
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
  if(!ok)alert('⚠️ Đã khôi phục (Huỷ Cancel) trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng kiểm tra kết nối; hệ thống sẽ tự cập nhật realtime khi đồng bộ thành công.');
}
function goCI(){
  window.open(new URL(appRoutePath('/check'), window.location.origin).href,'_blank','noopener');
}
function backAdmin(){pushAppRoute('/');enterDashboardPage();R()}
function lockOut(){S.ciOk=false;S.ciState=null;R()}
function cancelCI(){S.ciState=null;S.ciSyncWarn=false;R()}
function nextCI(){S.ciState=null;S.ciSyncWarn=false;R()}

function addBR(){const w=document.getElementById('btc_w');if(!w)return;const i=w.querySelectorAll('.btc-r').length;
  const d=document.createElement('div');d.className='btc-r';d.id='br_'+i;
  d.innerHTML=btcRowHTML({},i).replace(/^<div class="btc-r" id="br_\d+">|<\/div>$/g,'');
  w.appendChild(d);enhanceDropdowns(d);materializeIcons(d)}
function rmBR(i){const r=document.getElementById('br_'+i);if(r)r.remove()}
function getBMs(){const w=document.getElementById('btc_w');if(!w)return[];const ms=[];
  const accounts=loadAccounts();
  const used=new Set();
  w.querySelectorAll('.btc-r').forEach(r=>{
    const account=normalizeUsername(r.querySelector('select')?.value||'');
    if(!account||used.has(account))return;
    const acc=accounts.find(x=>x.username===account);
    if(acc){ms.push({code:acc.username.toUpperCase(),name:acc.name,account:acc.username});used.add(account)}
  });return ms}

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
  const bms=getBMs();
  if(!name){alert('Vui lòng nhập tên sự kiện');return}
  if(!date){alert('Vui lòng chọn thời gian tổ chức');return}
  if(!team){alert('Vui lòng nhập team tổ chức');return}
  if(!venue){alert('Vui lòng nhập địa điểm');return}

  if(isEdit){
    const idx=db.events.findIndex(e=>e.id===S.editEvId);
    if(idx<0)return;
    const existing=db.events[idx];
    db.events[idx]={...existing,name,date,team,venue,eventPw:'',btcMembers:bms};
    const editedId=S.editEvId;
    saveLocalOnly();S.modal=null;S.editEvId=null;R();
    const ok=await sbPatchEvent(editedId,{name,date_str:date||null,team:team||null,venue:venue||null,event_pw:'',btc_members:bms});
    if(!ok)alert('⚠️ Đã lưu sự kiện trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng kiểm tra kết nối; hệ thống sẽ tự cập nhật realtime khi đồng bộ thành công.');
  } else {
    const newEv={id:uid(),name,date,team,venue,eventPw:'',btcMembers:bms,createdAt:Date.now()};
    db.events.push(newEv);
    S.selEv=newEv.id;saveLocalOnly();S.modal=null;S.tab='guests';R();
    const ok=await sbUpsertOne('oh_events',evToDb(newEv));
    if(!ok)alert('⚠️ Đã tạo sự kiện trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng kiểm tra kết nối trước khi gửi link cho người khác.');
  }
}

function delEv(id){if(!canManageEvents()){alert('Bạn không có quyền xoá sự kiện.');return}
  if(!confirm('Xoá sự kiện này? Toàn bộ khách cũng bị xoá.'))return;
  db.events=db.events.filter(e=>e.id!==id);db.guests=db.guests.filter(g=>g.eventId!==id);
  if(S.selEv===id)S.selEv=null;saveLocalOnly();sbDel('oh_events',id);R()}

async function saveG(){
  const editingGuest=S.modal==='edit_g'&&S.editGid?db.guests.find(g=>g.id===S.editGid):null;
  const eventId=editingGuest?.eventId||S.selEv;
  const name=document.getElementById('g_n')?.value?.trim();
  const phone=document.getElementById('g_ph')?.value?.trim();
  const prmName=document.getElementById('g_prm')?.value?.trim();
  const tcbRegion=document.getElementById('g_reg')?.value?.trim();
  const unit=document.getElementById('g_unit')?.value?.trim();
  const sihName=document.getElementById('g_sih')?.value?.trim();
  const note=document.getElementById('g_note')?.value?.trim();
  if(!name){alert('Vui lòng nhập họ tên KH');return}
  if(!eventId){alert('Chưa có sự kiện đang mở để thêm khách.');return}
  if(!canAccessEvent(eventId)){alert('Bạn không có quyền thao tác với sự kiện này.');return}
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
      const walkinEdit=!!(document.getElementById('g_walkin')?.checked??ex?.walkin);
      const systemCode=ex.systemCode||genSystemCode();
      db.guests[idx]={...ex,eventId,name,phone,systemCode,prmName,tcbRegion,unit,sihName,note,walkin:walkinEdit,companions:newComps};
      S.ticketGid=S.editGid;
      isEditMode=true;
      editedFields={name,phone,system_code:systemCode,prm_name:prmName,tcb_region:tcbRegion,unit,sih_name:sihName,note,walkin:walkinEdit,companions:newComps};
    }
  } else {
    const guestCode=genCode(eventId);
    const companions=rawComps.map(rc=>({id:uid(),name:rc.name,phone:rc.phone,code:genCode(eventId),checkedIn:false,checkinTime:null,checkinBy:null}));
    const ng={id:uid(),eventId,guestCode,systemCode:genSystemCode(),name,phone,prmName,tcbRegion,unit,sihName,note,companions,checkedIn:false,checkinTime:null,checkinBy:null,createdAt:Date.now()};
    db.guests.push(ng);
    S.ticketGid=ng.id;
    newGuestRow=ng;
  }
  S.selEv=eventId;saveLocalOnly();S.editGid=null;S.modal='tickets';R();

  const ticketGid=S.ticketGid;
  const ok=isEditMode
    ? await sbPatchGuest(ticketGid,editedFields)
    : await sbUpsertOne('oh_guests',gToDb(newGuestRow));
  if(!ok)alert('⚠️ Đã lưu khách trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng kiểm tra kết nối trước khi phát vé.');
}

function chkEditPw(){
  const pw=document.getElementById('epw')?.value||'';
  if(pw===getAdminPw()){S.modal='edit_form';R()}
  else{const el=document.getElementById('epw_err');if(el)el.textContent='⚠️ Mật khẩu không đúng.'}}

async function doEdit(){
  const g=db.guests.find(x=>x.id===S.editGid);if(!g)return;
  const idx=db.guests.indexOf(g);
  const name=document.getElementById('eg_n')?.value?.trim()||g.name;
  const phone=document.getElementById('eg_ph')?.value?.trim()||g.phone;
  const systemCode=g.systemCode||genSystemCode();
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
  const walkin=!!(document.getElementById('eg_walkin')?.checked);
  db.guests[idx]={...g,name,phone,systemCode,prmName,tcbRegion,unit,sihName,note,walkin,companions:updComps};
  saveLocalOnly();S.modal=null;S.editGid=null;R();
  const ok=await sbPatchGuest(g.id,{name,phone,system_code:systemCode,prm_name:prmName,tcb_region:tcbRegion,unit,sih_name:sihName,note,walkin,companions:updComps});
  if(!ok)alert('⚠️ Đã lưu thay đổi trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng kiểm tra kết nối; hệ thống sẽ tự cập nhật realtime khi đồng bộ thành công.');
}

function doDel(){
  const pw=document.getElementById('dpw')?.value||'';
  if(pw!==getAdminPw()){const el=document.getElementById('dpw_err');if(el)el.textContent='⚠️ Mật khẩu không đúng.';return}
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
  if(!ok)alert('⚠️ Đã sửa người đi kèm trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng kiểm tra kết nối; hệ thống sẽ tự cập nhật realtime khi đồng bộ thành công.');
}

async function doCpDel(){
  const pw=document.getElementById('cpdpw')?.value||'';
  if(pw!==getAdminPw()){const el=document.getElementById('cpdpw_err');if(el)el.textContent='⚠️ Mật khẩu không đúng.';return}
  const {gid,cpId}=S.cpDel||{};
  const gIdx=db.guests.findIndex(x=>x.id===gid);if(gIdx<0)return;
  db.guests[gIdx].companions=(db.guests[gIdx].companions||[]).filter(x=>x.id!==cpId);
  saveLocalOnly();S.modal=null;S.cpDel=null;R();
  const ok=await sbPatchGuest(db.guests[gIdx].id,{companions:db.guests[gIdx].companions});
  if(!ok)alert('⚠️ Đã xoá người đi kèm trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng kiểm tra kết nối; hệ thống sẽ tự cập nhật realtime khi đồng bộ thành công.');
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
  if(!ok)alert('⚠️ Đã thêm người đi kèm trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng kiểm tra kết nối; hệ thống sẽ tự cập nhật realtime khi đồng bộ thành công.');
}

function mkCpQR(){
  const {gid,cpId}=S.cpTicket||{};
  const g=db.guests.find(x=>x.id===gid);
  const cp=(g?.companions||[]).find(x=>x.id===cpId);
  if(!cp)return;
  const el=document.getElementById('cp_tqr');if(!el)return;
  el.innerHTML='';
  try{new QRCode(el,{text:qrUrl(cp.code),width:160,height:160,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M})}
  catch(e){el.innerHTML='<div style="font-size:14px;color:#aaa">QR error</div>'}}

function dlCpTicket(){
  const {gid,cpId}=S.cpTicket||{};
  const g=db.guests.find(x=>x.id===gid);
  const cp=(g?.companions||[]).find(x=>x.id===cpId);
  if(!g||!cp)return;
  const ev=db.events.find(e=>e.id===g.eventId);
  const w=window.open('','_blank','width=440,height=560');
  w.document.write(`<!DOCTYPE html><html><head>
    <style>*{box-sizing:border-box;margin:0;padding:0;font-family:'Be Vietnam Pro',sans-serif}body{font-family:'Be Vietnam Pro',sans-serif;background:#f5f7fb;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px}
    .tk{background:#fff;border:2px solid #e8eaf0;border-radius:16px;padding:28px 24px 20px;width:320px;text-align:center}
    .hd{font-size:14px;font-weight:700;letter-spacing:2px;color:#bbb;margin-bottom:10px}
    .ev{font-size:14px;color:#bbb;margin-bottom:3px}.name{font-size:20px;font-weight:800;margin-bottom:4px}
    .role{font-size:14px;font-weight:600;background:#F5F3FF;color:#6D28D9;padding:3px 10px;border-radius:10px;display:inline-block;margin-bottom:14px}
    .code{font-family:'Be Vietnam Pro',sans-serif;font-size:18px;font-weight:700;letter-spacing:3px;margin:4px 0 12px}
    .foot{font-size:14px;color:#ccc;border-top:1px dashed #eee;padding-top:8px;line-height:1.7}
    canvas,img{display:block;margin:0 auto;padding:10px;border:1px solid #eee;border-radius:8px}
    .btn{margin-top:16px;padding:9px 24px;border:1.5px solid #dde4f0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer}
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
  if(isEvLocked(ev)&&!S.unlockedCIEvs[g.eventId]){alert('Sự kiện đã kết thúc. Dùng nút "🔓 Mở check-in bù" trong tab Khách mời để check-in bổ sung.');return;}
  const person=type==='c'?(g.companions||[]).find(x=>x.id===cid):g;
  if(!person)return;
  if(person.cancelled){alert('Khách đã cancel. Vui lòng nhấn " Huỷ Cancel" trước khi check-in.');return;}
  if(person.checkedIn){
    if(!confirm(`Huỷ check-in của ${person.name}?`))return;
    const personName=person.name;
    person.checkedIn=false;person.checkinTime=null;person.checkinBy=null;
    saveLocalOnly();R();
    const patchFields = type==='g'
      ? {checked_in:false,checkin_time:null,checkin_by:null}
      : {companions:(g.companions||[])};
    const ok = await sbPatchGuest(g.id, patchFields);
    if(!ok)alert(`⚠️ Đã huỷ check-in của "${personName}" trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng kiểm tra kết nối; hệ thống sẽ tự cập nhật realtime khi đồng bộ thành công.`);
    return;
  }
  S.adminCI={gid,type,cpId:cid||null};S.modal='admin_ci';R();
  setTimeout(()=>{const el=document.getElementById('aci_ph');if(el)el.focus()},80);
}

async function doAdminCI(){
  const {gid,type,cpId}=S.adminCI||{};
  const g=db.guests.find(x=>x.id===gid);if(!g)return;
  if(isEvLocked(getEvById(g.eventId))&&!S.unlockedCIEvs[g.eventId]){alert('Sự kiện đã kết thúc. Không thể check-in.');closeM();return;}
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
  const patchFields = type==='g'
    ? {checked_in:true,checkin_time:now,checkin_by:'admin'}
    : {companions:(g.companions||[])};
  const ok = await sbPatchGuest(g.id, patchFields);
  if(!ok)alert(`⚠️ Đã ghi nhận check-in cho "${personName}" trên thiết bị này, nhưng CHƯA đồng bộ được lên hệ thống trung tâm (có thể do mất mạng hoặc lỗi API).\n\nVui lòng kiểm tra kết nối trước khi tiếp tục để tránh lệch dữ liệu giữa các thiết bị.`);
}

function mkQRs(){
  const g=db.guests.find(x=>x.id===S.ticketGid);if(!g)return;
  const all=[g.guestCode,...(g.companions||[]).map(c=>c.code)];
  all.forEach((code,idx)=>{
    const el=document.getElementById('tqr_'+idx);
    if(!el)return;el.innerHTML='';
    try{new QRCode(el,{text:qrUrl(code),width:160,height:160,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M})}
    catch(e){el.innerHTML='<div style="font-size:14px;color:#aaa">QR error</div>'}
  });
}

function dlTicket(idx,name,code,role){
  const g=db.guests.find(x=>x.id===S.ticketGid);if(!g)return;
  const ev=db.events.find(e=>e.id===g.eventId);
  const w=window.open('','_blank','width=440,height=580');
  w.document.write(`<!DOCTYPE html><html><head><style>
    *{box-sizing:border-box;margin:0;padding:0;font-family:'Be Vietnam Pro',sans-serif}
    body{font-family:'Be Vietnam Pro',sans-serif;background:#f5f7fb;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px}
    @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&display=swap');
    .ticket{background:#fff;border:2px solid #e8eaf0;border-radius:16px;padding:28px 24px 20px;width:320px;text-align:center}
    .hd{font-size:14px;font-weight:700;letter-spacing:2px;color:#bbb;margin-bottom:10px}
    .ev{font-size:14px;color:#bbb;margin-bottom:3px}
    .name{font-size:20px;font-weight:800;color:#1a1a2e;margin-bottom:4px}
    .role{font-size:14px;font-weight:600;margin-bottom:14px;display:inline-block;padding:3px 10px;border-radius:10px;background:#EFF6FF;color:#185FA5}
    .qr-box{display:inline-block;padding:10px;border:1px solid #eee;border-radius:10px;margin-bottom:8px}
    .code{font-family:'Be Vietnam Pro',sans-serif;font-size:18px;font-weight:600;letter-spacing:3px;margin:4px 0 12px}
    .foot{font-size:14px;color:#ccc;border-top:1px dashed #eee;padding-top:8px;line-height:1.7}
    .dl-btn{margin-top:16px;padding:9px 24px;border:1.5px solid #dde4f0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;font-family:'Be Vietnam Pro',sans-serif;font-weight:500}
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
    @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;font-family:'Be Vietnam Pro',sans-serif}body{font-family:'Be Vietnam Pro',sans-serif;padding:20px;background:#f5f7fb}
    .ticket{background:#fff;border:2px solid #e8eaf0;border-radius:14px;padding:24px 20px 16px;text-align:center;margin-bottom:16px;page-break-inside:avoid}
    .hd{font-size:14px;font-weight:700;letter-spacing:2px;color:#bbb;margin-bottom:8px}
    .ev{font-size:14px;color:#bbb;margin-bottom:3px}
    .name{font-size:20px;font-weight:800;color:#1a1a2e;margin-bottom:4px}
    .role{font-size:14px;font-weight:600;margin-bottom:14px;display:inline-block;padding:3px 10px;border-radius:10px;background:#EFF6FF;color:#185FA5}
    .code{font-family:'Be Vietnam Pro',sans-serif;font-size:18px;font-weight:600;letter-spacing:3px;margin:4px 0 12px}
    .foot{font-size:14px;color:#ccc;border-top:1px dashed #eee;padding-top:8px;line-height:1.7}
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
  if(!canAccessEvent(S.ciEv)){document.getElementById('lock_err').textContent='⚠️ Bạn không được phân công vào sự kiện này';return}
  S.ciOk=true;S.ciOp=currentCheckinOperator();S.ciState=null;R()}

async function startCI(codeOverride=null,opts={}){
  const code=canonicalTicketCode(codeOverride||document.getElementById('ci_in')?.value||'');
  const err=document.getElementById('ci_err');
  if(!code){
    if(err)err.textContent='Vui lòng nhập mã';
    return{ok:false,msg:'empty'};
  }
  const found=findCode(S.ciEv,code);
  if(!found){
    if(err)err.textContent='Không tìm thấy mã trong sự kiện này';
    if(opts.fromScan)setCameraStatus(`Không tìm thấy mã ${code}`,'error',2200);
    return{ok:false,msg:'not_found'};
  }
  const person=found.person;
  if(person.checkedIn){
    const msg='Đã check-in lúc '+fmtDT(person.checkinTime);
    if(err)err.textContent=msg;
    if(opts.fromScan)setCameraStatus(`${person.name} đã check-in trước đó`,'error',2200);
    showCheckinToast(person.name||'Khách mời',false,{
      title:'Khách đã check-in trước đó',
      text:person.checkinTime?`Lúc ${fmtDT(person.checkinTime)}`:'Vui lòng kiểm tra lại thông tin khách',
      icon:'info'
    });
    return{ok:false,msg:'already_checked_in',person,guest:found.guest,type:found.type};
  }
  if(opts.skipVerify||!person.phone){
    const now=new Date().toISOString();
    const checkinBy=checkinByLabel();
    person.checkedIn=true;person.checkinTime=now;person.checkinBy=checkinBy;saveLocalOnly();
    const patchFields = found.type==='guest'
      ? {checked_in:true,checkin_time:now,checkin_by:checkinBy}
      : {companions:(found.guest.companions||[])};
    const ok=await sbPatchGuest(found.guest.id, patchFields);
    S.ciSyncWarn=!ok;
    if(opts.stayIdle){
      S.ciState=null;
      if(opts.fromScan)setCameraStatus('Check-in thành công. Sẵn sàng quét mã tiếp theo.','ready',1800);
      R();
    }else{
      S.ciState={step:'done',type:found.type,guest:found.guest,person,code};R();
    }
    return{ok:true,syncOk:ok,type:found.type,guest:found.guest,person,code};
  }
  S.ciState={step:'verify',type:found.type,guest:found.guest,person,code};R();
  return{pending:true,type:found.type,guest:found.guest,person,code};
}

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
  const checkinBy=checkinByLabel();
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
  const rows=[['STT','Loại','Mã','Customer ID','Họ tên','SĐT','KH gốc (nếu đi kèm)','PRM','Vùng TCB','Đơn vị','SIH','Note','Walk-in','Trạng thái','Giờ check-in','BTC','Lý do cancel']];
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
        <div style="font-weight:700;font-size:15px;color:#5B21B6">Khách Walk-in — đăng ký tại chỗ ngày ${fmtD(ev?.date)}</div>
        <div style="font-size:14px;color:#7C3AED">Hệ thống sẽ gắn nhãn Walk-in và tạo mã vào ngay. Không thể thêm Walk-in sau khi sự kiện kết thúc.</div>
      </div>
    </div>
    <div class="fg"><label>Sự kiện</label>
      <div style="padding:9px 12px;background:#f4f7fb;border-radius:8px;font-size:15px;color:#555">${ev?.name||'—'} · ${fmtD(ev?.date)}</div>
    </div>
    <div class="sec">Thông tin khách Walk-in</div>
    <div class="g2">
      <div class="fg"><label>Họ và tên *</label><input id="wi_n" placeholder="Nguyễn Văn A" autofocus/></div>
      <div class="fg"><label>Số điện thoại</label><input id="wi_ph" type="tel" placeholder="09xxxxxxxx"/></div>
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
  const prmName=(document.getElementById('wi_prm')?.value||'').trim();
  const tcbRegion=(document.getElementById('wi_reg')?.value||'').trim();
  const unit=(document.getElementById('wi_unit')?.value||'').trim();
  const sihName=(document.getElementById('wi_sih')?.value||'').trim();
  const note=(document.getElementById('wi_note')?.value||'').trim();
  const rawComps=getWiComps();
  const guestCode=genCode(eventId);
  const companions=rawComps.map(rc=>({id:uid(),name:rc.name,phone:rc.phone,code:genCode(eventId),checkedIn:false,checkinTime:null,checkinBy:null}));
  const ng={
    id:uid(),eventId,guestCode,systemCode:genSystemCode(),name,phone,prmName,tcbRegion,unit,sihName,
    note:note?note:'[Walk-in]',
    walkin:true,  // ← flag Walk-in
    companions,checkedIn:false,checkinTime:null,checkinBy:null,createdAt:Date.now()
  };
  db.guests.push(ng);
  S.ticketGid=ng.id;
  saveLocalOnly();S.modal='tickets';R();
  const ok=await sbUpsertOne('oh_guests',gToDb(ng));
  if(!ok)alert('⚠️ Đã tạo Walk-in trên thiết bị này nhưng CHƯA đồng bộ lên hệ thống trung tâm. Vui lòng kiểm tra kết nối trước khi phát vé.');
}

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

function openImportExcel(){
  S.modal='import_source';
  R();
}

/* 2. Kích hoạt nút chọn File */
function triggerExcelImport() {
  document.getElementById('excel_file_input').click();
}

function parseImportRows(rawRows){
  if(!rawRows||rawRows.length<=1)throw new Error('File/Sheet trống hoặc thiếu dữ liệu.');
  const parsedGuests=[];
  for(let i=1;i<rawRows.length;i++){
    const row=rawRows[i];
    if(!row?.[1]||String(row[1]).trim()==='')continue;
    parsedGuests.push({
      type:(String(row[0]||'').trim().toLowerCase()==='companion')?'Companion':'Main',
      name:String(row[1]).trim(),
      phone:row[2]?String(row[2]).trim():'',
      prmName:row[3]?String(row[3]).trim():'',
      tcbRegion:row[4]?String(row[4]).trim():'',
      unit:row[5]?String(row[5]).trim():'',
      sihName:row[6]?String(row[6]).trim():'',
      note:row[7]?String(row[7]).trim():''
    });
  }
  if(parsedGuests.length===0)throw new Error('Không tìm thấy dữ liệu khách hàng hợp lệ.');
  return parsedGuests;
}

function showImportPreview(parsedGuests){
  S.importData=parsedGuests;
  S.modal='import_preview';
  R();
}

function importWorkbookToPreview(workbook){
  const firstSheetName=workbook.SheetNames[0];
  const worksheet=workbook.Sheets[firstSheetName];
  const rawRows=XLSX.utils.sheet_to_json(worksheet,{header:1});
  showImportPreview(parseImportRows(rawRows));
}

function handleImportFile(file){
  if(!file)return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const data=new Uint8Array(e.target.result);
      const workbook=XLSX.read(data,{type:'array'});
      importWorkbookToPreview(workbook);
    }catch(err){
      alert('Đã xảy ra lỗi khi đọc file Excel/CSV! Chi tiết: '+err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

/* 3. Đọc dữ liệu từ File Excel đã tải lên và hiển thị màn hình Preview */
function handleExcelImport(event) {
  handleImportFile(event.target.files?.[0]);
  event.target.value='';
}

function handleImportDrag(event,isDragging){
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.toggle('dragging',!!isDragging);
}

function handleImportDrop(event){
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('dragging');
  const file=event.dataTransfer?.files?.[0];
  handleImportFile(file);
}

function publicSheetCsvUrl(rawUrl){
  const url=new URL(rawUrl);
  const sheetId=url.pathname.match(/\/spreadsheets\/d\/([^/]+)/)?.[1];
  if(!sheetId)return rawUrl;
  const gid=url.hash.match(/gid=([^&]+)/)?.[1]||url.searchParams.get('gid')||'0';
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${encodeURIComponent(gid)}`;
}

async function importPublicSheet(){
  const err=document.getElementById('import_source_err');
  if(err)err.textContent='';
  const raw=(document.getElementById('public_sheet_url')?.value||'').trim();
  if(!raw){if(err)err.textContent='⚠️ Vui lòng nhập link public sheet.';return}
  try{
    const url=publicSheetCsvUrl(raw);
    const res=await fetch(url);
    if(!res.ok)throw new Error(`Không tải được sheet (${res.status})`);
    const text=await res.text();
    const workbook=XLSX.read(text,{type:'string'});
    importWorkbookToPreview(workbook);
  }catch(e){
    if(err)err.textContent='⚠️ Không import được public sheet. Hãy kiểm tra quyền public/link CSV. '+e.message;
  }
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
        systemCode: genSystemCode(),
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
          systemCode: genSystemCode(),
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
  const ok = await sbUpsertMany('oh_guests', createdGuests.map(gToDb));
  if (ok) {
    alert(`🎉 Đã import thành công ${createdGuests.length} khách mời từ Excel vào hệ thống!`);
  } else {
    alert(`⚠️ Đã lưu ${createdGuests.length} khách trên thiết bị này nhưng CHƯA đồng bộ đầy đủ lên hệ thống trung tâm (có thể do lỗi mạng hoặc lỗi API). Vui lòng kiểm tra kết nối trước khi rời sự kiện.`);
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

function openCIUnlock(id){S.ciUnlockTarget=id;S.modal='ci_unlock';R()}
function closeCIUnlock(id){S.unlockedCIEvs[id]=false;R()}

// Expose all functions to window scope (required for Vite module bundling)
window.R=R; window.doLogin=doLogin; window.doLogout=doLogout; window.doRefresh=doRefresh; window.doUrlCI=doUrlCI; window.formatCIInput=formatCIInput;
window.setTab=setTab; window.openGM=openGM; window.pickEv=pickEv; window.setSrch=setSrch; window.setEvSrch=setEvSrch; window.setCIRecentSearch=setCIRecentSearch; window.setCIMobileMode=setCIMobileMode; window.switchCICamera=switchCICamera;
window.clearSrch=clearSrch; window.clearEvSrch=clearEvSrch; window.clearCIRecentSearch=clearCIRecentSearch; window.setFil=setFil; window.openM=openM; window.openAccount=openAccount; window.saveAdminPw=saveAdminPw; window.filterDD=filterDD; window.clearDDSearch=clearDDSearch;
window.openAccountForm=openAccountForm; window.openAccountDel=openAccountDel; window.saveAccount=saveAccount; window.deleteAccount=deleteAccount;
window.openGuestDetail=openGuestDetail; window.openCpDetail=openCpDetail; window.openEdit=openEdit; window.openDel=openDel;
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
window.tryUnlock=tryUnlock; window.startCI=startCI; window.startQrScanner=startQrScanner; window.confirmPhone=confirmPhone;
window.doAdminCI=doAdminCI;
window.expCSV=expCSV; window.togCI=togCI; window.togRpt=togRpt; window.setRptEv=setRptEv;
window.openImportExcel=openImportExcel; window.triggerExcelImport=triggerExcelImport; window.handleExcelImport=handleExcelImport;
window.handleImportDrag=handleImportDrag; window.handleImportDrop=handleImportDrop; window.importPublicSheet=importPublicSheet;
window.downloadExcelTemplate=downloadExcelTemplate; window.commitExcelImport=commitExcelImport;
window.downloadAllQRsZip=downloadAllQRsZip;
window.doCIUnlock=doCIUnlock; window.openCIUnlock=openCIUnlock; window.closeCIUnlock=closeCIUnlock;
window.openWalkin=openWalkin; window.saveWalkin=saveWalkin;
window.addWiCR=addWiCR; window.rmWiCR=rmWiCR;
