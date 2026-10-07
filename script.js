/* ============================================================
   ⚡ شات سونيك — script.js (الجزء 1: البداية + النواة الأساسية)
   ============================================================ */

/* ===== شاشة البداية ===== */
setTimeout(function(){var s=document.getElementById('splash-screen');if(s){s.style.opacity='0';s.style.transform='scale(1.1)';setTimeout(function(){s.remove();},600);}},1200);

/* ===== فودافون كاش ===== */
function vodafoneDonate(){openModal('vodaModal');}
function copyVoda(){
var t='01013255816';
try{navigator.clipboard.writeText(t).then(function(){toast('📋 تم نسخ الرقم ✅');},function(){toast('الرقم: 01013255816');});}
catch(e){toast('الرقم: 01013255816');}
}

/* ================================================================
// ⚡ SUPABASE
// ================================================================ */
var SUPABASE_URL="https://mwdyfhusaqkeuxmimdlo.supabase.co";
var SUPABASE_KEY="sb_publishable_owUUXMVbIwaKz9tx-ch9Yw_RUKKQ--w";
var sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

var OWNER_NAME='(medoyoutuber) 😂♥',ONLINE_TIMEOUT=60000;
function isOwnerName(n){if(!n)return false;return String(n).indexOf('medoyoutuber')>-1;}
function getDisplayName(u){if(!u)return 'مستخدم';return u.displayName||u.name;}
function getMsgName(n){return (usersCache[n]&&usersCache[n].displayName)||n;}

var LS={getItem:function(k){try{return localStorage.getItem(k);}catch(e){return null;}},setItem:function(k,v){try{localStorage.setItem(k,v);}catch(e){}},removeItem:function(k){try{localStorage.removeItem(k);}catch(e){}}};
var el=function(id){return document.getElementById(id);};
var me=null,chat=null,filterG='الكل',filterC='الكل',myIP='127.0.0.1',pendingImg=null,pendingSticker=null,hbTimer=null,replyTo=null,editingMsgId=null,typingTimer=null;
var usersCache={},convsCache=[],msgsCache=[],scItems=[],unread={},lastConvT={};
var mediaRec=null,recChunks=[],recording=false,recStartTime=null,recInterval=null,recCancelled=false,msgMenuTarget=null,msgMenuId=null;
var siteSettings={blockLinks:false,roomAudio:true,msgLimit:300},badWordsList=['كلب','حمار','قحبة','شرموطة','متناك'];
var customEmojis=[],allRooms=[],wallCache=[],selMode=false,selSet={},pendingRoomImg=null;
var typersSet={},roomUnread={};
var userScrolledUp=false;
el('chatBox').addEventListener('scroll',function(){var b=el('chatBox');userScrolledUp=(b.scrollHeight-b.scrollTop-b.clientHeight)>100;});

// ================================================================
// ⚡ SDB - طبقة البيانات
// ================================================================
function msgToRow(m){return{id:m._id,conv_id:m._conv,sender:m.from,body:m.data,mtype:m.type,mtime:m.time,reply_to:m.replyTo||null,edited:!!m.edited,deleted:!!m.deleted,read:!!m.read,reactions:m.reactions||{},meta:m.meta||null};}
function rowToMsg(r){return{_id:r.id,_conv:r.conv_id,from:r.sender,data:r.body,type:r.mtype,time:r.mtime,replyTo:r.reply_to,edited:r.edited,deleted:r.deleted,read:r.read,reactions:r.reactions||{},meta:r.meta||null};}

var SDB={
  async getUser(name){var d=await sb.from('users').select('*').eq('name',name).limit(1).maybeSingle();return(d&&d.data)?d.data.data:null;},
  async saveUser(name,u){u.lastSeen=u.lastSeen||0;var r=await sb.from('users').upsert({name:name,data:u,last_seen:u.lastSeen});if(r.error)console.error(r.error);},
  async patchUser(name,patch){var d=await sb.from('users').select('data').eq('name',name).limit(1).maybeSingle();var u=(d&&d.data&&d.data.data)||{};for(var k in patch)u[k]=patch[k];await sb.from('users').update({data:u}).eq('name',name);return u;},
  async delUserRow(name){await sb.from('users').delete().eq('name',name);},
  async getPassword(name){var d=await sb.from('passwords').select('pass').eq('name',name).limit(1).maybeSingle();return(d&&d.data)?d.data.pass:null;},
  async setPassword(name,pass){await sb.from('passwords').upsert({name:name,pass:pass});},
  async loadUsers(){var d=await sb.from('users').select('*');var m={};(d.data||[]).forEach(function(r){var u=r.data||{};u.name=r.name;u.lastSeen=r.last_seen||u.lastSeen||0;m[r.name]=u;});return m;},
  async loadMsgs(convId,limit){var d=await sb.from('messages').select('*').eq('conv_id',convId).order('mtime',{ascending:false}).limit(limit||500);return(d.data||[]).map(rowToMsg).reverse();},
  async addMsg(m){var r=await sb.from('messages').insert(msgToRow(m));if(r.error)console.error(r.error);},
  async updMsg(id,patch){await sb.from('messages').update(patch).eq('id',id);},
  async delConvMsgs(convId){await sb.from('messages').delete().eq('conv_id',convId);},
  async loadConvs(){var d=await sb.from('convs').select('*');return d.data||[];},
  async upsertConv(id,c){await sb.from('convs').upsert({id:id,user_a:c.a,user_b:c.b,t:c.t,last_from:c.lastFrom,last_msg:c.lastMsg});},
  async delConv(id){await sb.from('convs').delete().eq('id',id);},
  async loadRooms(){var d=await sb.from('rooms').select('*').order('created',{ascending:true});return d.data||[];},
  async addRoom(r){await sb.from('rooms').insert(r);},
  async updRoom(id,p){await sb.from('rooms').update(p).eq('id',id);},
  async delRoom(id){await sb.from('rooms').delete().eq('id',id);},
  async loadWall(){var d=await sb.from('wall_posts').select('*').order('timestamp',{ascending:false}).limit(50);return d.data||[];},
  async addWall(p){await sb.from('wall_posts').insert(p);},
  async updWall(id,p){await sb.from('wall_posts').update(p).eq('id',id);},
  async delWall(id){await sb.from('wall_posts').delete().eq('id',id);},
  async addLog(l){await sb.from('logs').insert(l);},
  async loadLogs(){var d=await sb.from('logs').select('*').order('id',{ascending:false}).limit(50);return d.data||[];},
  async addReport(r){await sb.from('reports').insert(r);},
  async loadReports(){var d=await sb.from('reports').select('*').order('id',{ascending:false});return d.data||[];},
  async loadShortcuts(){var d=await sb.from('shortcuts').select('*').order('id');if(d.error)toast('خطأ تحميل: '+d.error.message);return d.data||[];},
  async addShortcut(k,v){var r=await sb.from('shortcuts').insert({key:k,value:v});if(r.error)toast('خطأ حفظ: '+r.error.message);return r;},
  async delShortcut(id){await sb.from('shortcuts').delete().eq('id',id);},
  async loadBans(){var d=await sb.from('bans').select('*').order('id',{ascending:false});return d.data||[];},
  async addBan(b){await sb.from('bans').insert(b);},
  async delBan(id){await sb.from('bans').delete().eq('id',id);},
  async loadEmojis(){var d=await sb.from('emojis').select('*').order('id');return d.data||[];},
  async addEmoji(url){await sb.from('emojis').insert({url:url});},
  async delEmoji(id){await sb.from('emojis').delete().eq('id',id);},
  async loadSettings(){var d=await sb.from('settings').select('*');var m={};(d.data||[]).forEach(function(r){m[r.key]=r.value;});return m;},
  async saveSetting(key,value){await sb.from('settings').upsert({key:key,value:value});}
};

// ================================================================
// أدوات عامة
// ================================================================
function compressImg(file,cb,maxW){maxW=maxW||1080;if(file.type==='image/gif'){var reader=new FileReader();reader.onload=function(e){cb(e.target.result);};reader.readAsDataURL(file);return;}var reader=new FileReader();reader.onload=function(e){var img=new Image();img.onload=function(){var canvas=document.createElement('canvas');var w=img.width,h=img.height;if(w>maxW){h=Math.max(1,(maxW/w)*h);w=maxW;}canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);cb(canvas.toDataURL('image/jpeg',0.82));};img.src=e.target.result;};reader.readAsDataURL(file);}
function flag(a,b){return String.fromCodePoint(127397+a.charCodeAt(0),127397+b.charCodeAt(0));}
var FLAGS={"مصر":flag('E','G'),"السعودية":flag('S','A'),"الإمارات":flag('A','E'),"الكويت":flag('K','W'),"العراق":flag('I','Q'),"المغرب":flag('M','A'),"الجزائر":flag('D','Z'),"فلسطين":flag('P','S'),"الأردن":flag('J','O'),"لبنان":flag('L','B'),"سورية":flag('S','Y'),"اليمن":flag('Y','E'),"السودان":flag('S','D'),"تونس":flag('T','N'),"ليبيا":flag('L','Y'),"عمان":flag('O','M'),"قطر":flag('Q','A'),"البحرين":flag('B','H'),"الصومال":flag('S','O'),"موريتانيا":flag('M','R')};
function toast(m){var t=document.createElement('div');t.innerText=m;t.style.cssText='position:fixed;top:15px;left:50%;transform:translateX(-50%);background:#e64553;color:#fff;padding:10px 18px;border-radius:20px;z-index:3000;font-size:13px;box-shadow:0 4px 10px rgba(0,0,0,.4);text-align:center;max-width:85%';document.body.appendChild(t);setTimeout(function(){t.remove();},2500);}
function deviceId(){var d=LS.getItem('device_id');if(!d){d='DEV-'+Math.random().toString(36).slice(2,10);LS.setItem('device_id',d);}return d;}
function deviceType(){var ua=navigator.userAgent||'';return /Mobi|Android|iPhone|iPad|iPod/i.test(ua)?'📱 هاتف':'💻 PC';}
function browserName(){var ua=navigator.userAgent||'';if(ua.indexOf('Edg')>-1)return'Edge';if(ua.indexOf('OPR')>-1)return'Opera';if(ua.indexOf('Chrome')>-1)return'Chrome';if(ua.indexOf('Safari')>-1)return'Safari';if(ua.indexOf('Firefox')>-1)return'Firefox';return'متصفح';}
function isOnline(u){if(!u||!u.lastSeen)return false;if(u.lastSeen===0)return false;return(Date.now()-u.lastSeen)<ONLINE_TIMEOUT;}
function role(u){if(!u)return'عضو';if(isOwnerName(u.name))return'👑 صاحب الموقع';return u.role||'عضو';}
function isAdmin(){return me&&(role(me).indexOf('صاحب')>-1||role(me).indexOf('إدارة')>-1||role(me).indexOf('سوبر')>-1);}
function isOwner(){return me&&(role(me).indexOf('صاحب')>-1);}
function isSuper(){return me&&(role(me).indexOf('صاحب')>-1||role(me).indexOf('سوبر')>-1);}
function getAvatar(u){if(u&&u.avatar)return'<img src="'+u.avatar+'">';return(u&&u.gender==='أنثى')?'👩':'👨';}
function getAvatarHTML(u,size){size=size||46;var ava=getAvatar(u);var frame=u&&u.frame?u.frame:null;if(frame&&(isOwnerName(u.name)||(u.role&&(u.role.indexOf('إدارة')>-1||u.role.indexOf('سوبر')>-1)))){return '<div class="ava-frame-wrap" style="width:'+(size+8)+'px;height:'+(size+8)+'px"><div class="u-ava" style="width:'+size+'px;height:'+size+'px">'+ava+'</div><img class="frame-img" src="'+frame+'"></div>';}return '<div class="u-ava" style="width:'+size+'px;height:'+size+'px">'+ava+'</div>';}
function styleName(u){var name=escapeHtml(getDisplayName(u));if(u&&u.nameGradient){return '<span style="background:'+u.nameGradient+';-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:bold">'+name+'</span>';}if(u&&u.nameColor){return '<span style="color:'+u.nameColor+';font-weight:bold">'+name+'</span>';}return name;}
function defPrefs(u){var d={allowMedia:false,readReceipts:true,lastSeen:true,msgRequests:true,dark:true,smooth:true,sndOwn:true,sndOther:true,sndNotif:true,friends:[],blocked:[],mediaBlock:{},pinned:[]};for(var k in u){d[k]=u[k];}return d;}
function beep(f){try{var c=new(window.AudioContext||window.webkitAudioContext)();var o=c.createOscillator();var g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=f;g.gain.setValueAtTime(.15,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.4);o.start();o.stop(c.currentTime+.4);}catch(e){}}
async function updateMe(patch){if(!me)return;for(var k in patch)me[k]=patch[k];await SDB.patchUser(me.name,patch);}
function timeAgo(ts){var d=new Date(ts),now=new Date(),diff=Math.floor((now-d)/1000);if(diff<60)return'الآن';if(diff<3600)return Math.floor(diff/60)+' د';if(diff<86400)return Math.floor(diff/3600)+' س';return d.toLocaleDateString('ar-EG');}
function escapeHtml(t){var d=document.createElement('div');d.innerText=t;return d.innerHTML;}
function isBlockedByMe(n){return me&&me.blocked&&me.blocked.indexOf(n)>-1;}
function isBlockedByOther(n){var u=usersCache[n];return u&&u.blocked&&u.blocked.indexOf(me.name)>-1;}
function isPinned(n){return me&&me.pinned&&me.pinned.indexOf(n)>-1;}
function getConvId(other){return [me.name,other].sort().join('_');}
function curConvId(){return chat.type==='user'?[LS.getItem('session')||me.name,chat.id].sort().join('_'):chat.id;}
function fillCountries(){var opts='';for(var c in FLAGS){opts+='<option value="'+c+'">'+FLAGS[c]+' '+c+'</option>';}el('gCountry').innerHTML=opts;el('rCountry').innerHTML=opts;el('advCountry').innerHTML='<option value="الكل">الكل</option>'+opts;}
function authTab(t,e){var tabs=document.querySelectorAll('.auth-tab'),panes=document.querySelectorAll('.pane');for(var i=0;i<tabs.length;i++)tabs[i].classList.remove('active');for(var i=0;i<panes.length;i++)panes[i].classList.remove('active');e.classList.add('active');el('pane-'+t).classList.add('active');}

// ================================================================
// ⚡ المصادقة
// ================================================================
async function loginGuest(){
  var n=el('gName').value.trim();
  if(!n)return toast('الرجاء كتابة الاسم المستعار');
  if(!el('gAge').value)return toast('الرجاء كتابة السن');
var _gav=parseInt(el('gAge').value);
if(isNaN(_gav)||_gav<16||_gav>100)return toast('⚠️ العمر لازم يكون من 16 لـ 100');
  toast('جاري الدخول...');
  var u=await SDB.getUser(n);
  if(u&&u.role!=='زائر')return toast('هذا الاسم مسجل عضوية، ادخل من تبويب الأعضاء');
  if(!u)u=defPrefs({name:n,age:el('gAge').value||'--',gender:el('gGender').value,country:el('gCountry').value,role:'زائر',is_active:true});
  u.lastSeen=Date.now();
  await SDB.saveUser(n,u);
  enter(u);
}
async function loginMember(){
  var n=el('mName').value.trim(),p=el('mPass').value;
  if(!n||!p)return toast('الرجاء إدخال الاسم وكلمة المرور');
  toast('جاري الدخول...');
  var u=await SDB.getUser(n);
  if(!u)return toast('هذا الاسم غير مسجل');
  var savedPass=await SDB.getPassword(n);
  if(savedPass&&savedPass!==p)return toast('كلمة المرور غير صحيحة');
  if(!savedPass)await SDB.setPassword(n,p);if(!u.age||u.age==='--'){var ag=prompt('اكتب سنك (من 16 لـ 100):');if(ag){var _mv=parseInt(ag);if(isNaN(_mv)||_mv<16||_mv>100)return toast('⚠️ العمر لازم يكون من 16 لـ 100');u.age=String(_mv);await SDB.saveUser(n,u);}}
  enter(u);
}
async function register(){
  var n=el('rName').value.trim(),p=el('rPass').value;
  if(!n)return toast('اكتب اسم العضوية');
if(!p)return toast('اكتب كلمة السر (حرف أو رقم واحد على الأقل)');
if(!el('rAge').value)return toast('اكتب السن');
var _rav=parseInt(el('rAge').value);
if(isNaN(_rav)||_rav<16||_rav>100)return toast('⚠️ العمر لازم يكون من 16 لـ 100');
  toast('جاري التسجيل...');
  var existing=await SDB.getUser(n);
  if(existing)return toast('تم استخدام هذا الاسم من قبل');
  var chk=await SDB.getUser(n);
if(!chk){try{await sb.from('passwords').delete().eq('name',n);}catch(e){}}
var pw=null;
  if(pw)return toast('تم استخدام هذا الاسم من قبل');
  var u=defPrefs({name:n,age:el('rAge').value,gender:el('rGender').value,country:el('rCountry').value,role:'عضو',is_active:true});
  await SDB.setPassword(n,p);
  await SDB.saveUser(n,u);
  enter(u);
}

function startHeartbeat(){
  if(hbTimer)clearInterval(hbTimer);
  hbTimer=setInterval(async function(){
    if(!me||document.hidden)return;
    try{
      await sb.from('users').update({last_seen:Date.now()}).eq('name',me.name);
      if(usersCache[me.name])usersCache[me.name].lastSeen=Date.now();
    }catch(e){}
    renderOnline();
  },10000);
}

async function enter(u){
  me=u;usersCache[u.name]=u;
  LS.setItem('session',u.name);LS.setItem('last_logged_member',u.name);
  el('loginModal').classList.add('hide');
  applyPrefsUI();updateProfile();
  u.dev=deviceId();u.dtype=deviceType();u.browser=browserName();u.ip=myIP;u.lastSeen=Date.now();
  await SDB.saveUser(u.name,u);
  logLogin(u);
  startHeartbeat();
  await startAll();
}
function logout(){
  if(hbTimer){clearInterval(hbTimer);hbTimer=null;}
  // Mark offline immediately so others see her leave
  if(me){
    var oldTime = Date.now() - ONLINE_TIMEOUT - 5000;
    try{
      sb.from('users').update({last_seen:oldTime}).eq('name',me.name);
      if(usersCache[me.name])usersCache[me.name].lastSeen = oldTime;
    }catch(e){}
    try{
      fetch(SUPABASE_URL+'/rest/v1/users?name=eq.'+encodeURIComponent(me.name),{
        method:'PATCH',
        headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
        body:JSON.stringify({last_seen:oldTime}),
        keepalive:true
      });
    }catch(e){}
  }
  unsubscribeAll();
  me=null;usersCache={};convsCache=[];msgsCache=[];allRooms=[];wallCache=[];chat=null;navStack=[];
  LS.removeItem('session');
  el('loginModal').classList.remove('hide');
  authTab('member',document.querySelectorAll('.auth-tab')[1]);
  var last=LS.getItem('last_logged_member');if(last)el('mName').value=last;
}

// ================================================================
// ⚡ Realtime
// ================================================================
function unsubscribeAll(){for(var k in SDB.subs){try{SDB.subs[k].unsubscribe();}catch(e){}delete SDB.subs[k];}}
SDB.subs={};

function subUsersRT(){
  if(SDB.subs.users)return;
  SDB.subs.users=sb.channel('rt-users')
  .on('postgres_changes',{event:'*',schema:'public',table:'users'},function(payload){
    if(payload.eventType==='DELETE'){if(payload.old&&payload.old.name){delete usersCache[payload.old.name];renderOnline();}return;}
    var row=payload.new;if(!row||!row.name)return;
    var u=row.data||{};u.name=row.name;u.lastSeen=row.last_seen||u.lastSeen||0;
    if(u.banned===true||u.is_active===false){delete usersCache[u.name];}
    else{
if(usersCache[u.name]){
var old=usersCache[u.name];
for(var k in old){if(u[k]===undefined||u[k]===null)u[k]=old[k];}
}
usersCache[u.name]=u;
}
if(me&&u.name===me.name){
var oldMeFrame=me.frame,oldMeAge=me.age,oldMeAvatar=me.avatar,oldMeRole=me.role;
me=Object.assign({},me,u);
if(oldMeFrame&&!me.frame)me.frame=oldMeFrame;
if(oldMeAge&&!me.age)me.age=oldMeAge;
if(oldMeAvatar&&!me.avatar)me.avatar=oldMeAvatar;
if(oldMeRole&&!me.role)me.role=oldMeRole;
}
    renderOnline();
    if(chat&&chat.type==='user'&&usersCache[chat.id])refreshChatHeader(usersCache[chat.id]);
  }).subscribe();
}
function subConvsRT(){
  if(SDB.subs.convs)return;
  SDB.subs.convs=sb.channel('rt-convs')
  .on('postgres_changes',{event:'*',schema:'public',table:'convs'},function(payload){
    if(!me)return;
    if(payload.eventType==='DELETE'){
      var oid=payload.old&&payload.old.id;
      convsCache=convsCache.filter(function(c){return c.id!==oid;});
    }else{
      var row=payload.new;if(!row)return;
      if(row.user_a!==me.name&&row.user_b!==me.name)return;
      var other=row.user_a===me.name?row.user_b:row.user_a;
      var c={id:row.id,a:row.user_a,b:row.user_b,t:row.t||0,lastFrom:row.last_from,lastMsg:row.last_msg,other:other};
      var idx=convsCache.findIndex(function(x){return x.id===row.id;});
      if(idx>-1)convsCache[idx]=c;else convsCache.push(c);
      if(c.lastFrom&&c.lastFrom!==me.name&&c.t>(lastConvT[other]||0)){
        var openNow=chat&&chat.type==='user'&&chat.id===other&&el('s-chat').classList.contains('active');
        if(!openNow){unread[other]=(unread[other]||0)+1;if(me.sndNotif!==false)beep(900);showNotif(getMsgName(other),c.lastMsg||'رسالة جديدة',other);}
        lastConvT[other]=c.t;
      }
    }
    convsCache.sort(function(x,y){return(y.t||0)-(x.t||0);});
    updateBadges();
    if(el('s-msgs').classList.contains('active'))renderMsgs();
  }).subscribe();
}
function subRoomsRT(){
  if(SDB.subs.rooms)return;
  SDB.subs.rooms=sb.channel('rt-rooms')
  .on('postgres_changes',{event:'*',schema:'public',table:'rooms'},async function(payload){
    allRooms=await SDB.loadRooms();renderRooms();
    if(el('s-admin').classList.contains('active'))renderRoomsAdmin();
  })
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},function(payload){
    var row=payload.new;if(!row||!me)return;
    var isRoom=allRooms.some(function(r){return r.id===row.conv_id;});
    if(!isRoom)return;
    if(chat&&curConvId()===row.conv_id&&el('s-chat').classList.contains('active'))return;
    if(row.sender===me.name)return;
    roomUnread[row.conv_id]=(roomUnread[row.conv_id]||0)+1;
    renderRooms();
    if(me.sndNotif!==false)beep(700);
  }).subscribe();
}
function subMsgsRT(convId){
  if(SDB.subs.msgs){try{SDB.subs.msgs.unsubscribe();}catch(e){}SDB.subs.msgs=null;}
  SDB.subs.msgs=sb.channel('rt-msgs-'+Math.random().toString(36).slice(2))
  .on('postgres_changes',{event:'*',schema:'public',table:'messages',filter:'conv_id=eq.'+convId},function(payload){
    if(!chat||curConvId()!==convId)return;
    if(payload.eventType==='INSERT'){
      var m=rowToMsg(payload.new);
      if(!msgsCache.find(function(x){return x._id===m._id;})){
        var shouldScroll=!userScrolledUp;
        msgsCache.push(m);appendMsg(m);
        if(shouldScroll)scrollChat();
        if(m.from!==me.name){
          if(!m.read)SDB.updMsg(m._id,{read:true});
          if(me.sndOther!==false&&!document.hidden)beep(900);
          if(document.hidden&&me.sndNotif!==false)showNotif(getMsgName(m.from),m.type==='text'?m.data:'[وسائط]');
        }
      }
    }else if(payload.eventType==='UPDATE'){
      var m2=rowToMsg(payload.new);
      var idx=msgsCache.findIndex(function(x){return x._id===m2._id;});
      if(idx>-1){msgsCache[idx]=m2;updateMsg(m2);}
    }else if(payload.eventType==='DELETE'){
      var id=payload.old&&payload.old.id;
      var idx2=msgsCache.findIndex(function(x){return x._id===id;});
      if(idx2>-1)msgsCache.splice(idx2,1);
      var el2=document.querySelector('[data-id="'+id+'"]');
      if(el2)el2.remove();
    }
  }).subscribe();
}
function subTypingRT(convId){
  if(SDB.subs.typing){try{SDB.subs.typing.unsubscribe();}catch(e){}SDB.subs.typing=null;}
  typersSet={};updateTypingUI();
  SDB.subs.typing=sb.channel('rt-typing-'+Math.random().toString(36).slice(2))
  .on('postgres_changes',{event:'*',schema:'public',table:'typing',filter:'conv_id=eq.'+convId},function(payload){
    if(payload.eventType==='DELETE'){if(payload.old&&payload.old.name){delete typersSet[payload.old.name];}}
    else{var row=payload.new;if(row&&row.name!==me.name&&row.name)typersSet[row.name]=row.t;}
    updateTypingUI();
  }).subscribe();
}
function updateTypingUI(){
  var any=false,now=Date.now();
  for(var k in typersSet){if(now-typersSet[k]<8000){any=true;break;}else delete typersSet[k];}
  el('typingIndicator').classList.toggle('open',any);
}
function subSettingsRT(){
  if(SDB.subs.settings)return;
  SDB.subs.settings=sb.channel('rt-settings')
  .on('postgres_changes',{event:'*',schema:'public',table:'settings',filter:'key=eq.announce'},async function(){
    setTimeout(function(){try{checkAnnounce();}catch(e){}},2400);
  }).subscribe();
}

// ================================================================
// التحميل والبدء
// ================================================================
var _ssDone=false;
setInterval(function(){if(!me)return;if(!_ssDone){_ssDone=true;sb.channel('rt-stories').on('postgres_changes',{event:'*',schema:'public',table:'stories'},function(){renderStories();}).subscribe();}if(el('s-online')&&el('s-online').classList.contains('active'))renderStories();},30000);
async function startAll(){
  try{history.pushState({g:'s'},'');}catch(e){}
  subUsersRT();subConvsRT();subRoomsRT();subSettingsRT();
  await refreshUsers();
  await refreshConvs();
  setTimeout(function(){try{loadSiteSettings();}catch(e){}},1600);
  setTimeout(function(){try{refreshRooms();}catch(e){}},2000);
  setTimeout(function(){try{refreshRooms();}catch(e){}},2000);
  loadStickers();
  setTimeout(function(){try{refreshShortcuts();}catch(e){}},2200);
  setTimeout(function(){try{checkAnnounce();}catch(e){}},2400);
  setTimeout(function(){try{refreshWall();}catch(e){}},2600);
}
async function refreshUsers(){
  var m=await SDB.loadUsers();
  usersCache={};
  for(var k in m){var u=m[k];if(u.banned===true||u.is_active===false)continue;usersCache[k]=u;}
  renderOnline();
}
async function refreshConvs(){
  var rows=await SDB.loadConvs();
  convsCache=[];
  for(var i=0;i<rows.length;i++){
    var r=rows[i];
    if(r.user_a!==me.name&&r.user_b!==me.name)continue;
    var other=r.user_a===me.name?r.user_b:r.user_a;
    convsCache.push({id:r.id,a:r.user_a,b:r.user_b,t:r.t||0,lastFrom:r.last_from,lastMsg:r.last_msg,other:other});
    lastConvT[other]=r.t||0;
  }
  convsCache.sort(function(x,y){return(y.t||0)-(x.t||0);});
  updateBadges();
}
async function refreshRooms(){allRooms=await SDB.loadRooms();await loadRoomUnread();renderRooms();}
async function loadRoomUnread(){
if(!allRooms.length)return;
var ids=allRooms.map(function(r){return r.id;});
var d=await sb.from('messages').select('conv_id,mtime').in('conv_id',ids);
if(d.error)return;
roomUnread={};
(d.data||[]).forEach(function(m){
var seen=parseInt(LS.getItem('room_seen_'+m.conv_id)||'0');
if(m.mtime>seen&&(!chat||curConvId()!==m.conv_id))roomUnread[m.conv_id]=(roomUnread[m.conv_id]||0)+1;
});
}
async function refreshWall(){wallCache=await SDB.loadWall();renderWall();}
async function refreshEmojis(){customEmojis=await SDB.loadEmojis();renderEmojis();}
async function refreshShortcuts(){
scItems=await SDB.loadShortcuts();
if(false){
var defs=[['س1','السلام عليكم ورحمة الله 🌹'],['س2','وعليكم السلام ورحمة الله وبركاته 🌹'],['و1','أهلاً ومرحباً بيك 🌹'],['ه1','هلا والله 🌹'],['ص1','صباح الخير 🌹'],['ص2','صباح النور 🌹'],['م1','مساء الخير 🌹'],['م2','مساء النور 🌹'],['ك1','كيف حالك؟ 🌹'],['ك2','الحمد لله بخير 🌹'],['ش1','شكراً لك 🌹'],['ل1','لا شكراً'],['ن1','نعم'],['ر1','ربنا يبارك فيك 🌹'],['ع1','أهلاً بك معانا 🌹'],['ت1','تمام الحمد لله 🌹'],['د1','دائماً خير 🌹'],['خ1','خلاص انتهينا 😅'],['ب1','برب 🚶'],['رد1','ربنا يعوضك خير 🌹']];
for(var i=0;i<defs.length;i++){await SDB.addShortcut(defs[i][0],defs[i][1]);}
scItems=await SDB.loadShortcuts();
}
renderShortcutsTable();
}
async function loadSiteSettings(){
  var s=await SDB.loadSettings();
  var g=s.global||{};
  if(g.blockLinks!==undefined)siteSettings.blockLinks=g.blockLinks;
  if(g.bannedWords)badWordsList=g.bannedWords;
  if(g.msgLimit)siteSettings.msgLimit=g.msgLimit;
}
async function checkAnnounce(){
  var s=await SDB.loadSettings();
  var a=s.announce;
  if(a&&a.text){
    el('currentAnnounce').innerText=a.text;
    el('announceText').value=a.text;
    if(LS.getItem('closed_announce')!==a.text){el('announceBannerText').innerText=a.text;el('announceBanner').style.display='block';}
    else el('announceBanner').style.display='none';
  }else{el('currentAnnounce').innerText='لا يوجد';el('announceBanner').style.display='none';}
}

function markConvRead(n){if(!n)return;unread[n]=0;updateBadges();}
function updateBadges(){var tot=0;for(var k in unread)tot+=unread[k];var b=el('navBadge');if(tot>0){b.innerText=tot>99?'99+':tot;b.classList.remove('hide');}else b.classList.add('hide');var bd=el('backDot');if(tot>0)bd.classList.remove('hide');else bd.classList.add('hide');}

var navStack=[];var MAIN_SCREENS=['online','msgs','rooms','wall','settings'];
function getNavEl(s){var m={online:0,msgs:1,rooms:2,wall:3,settings:4};return m[s]!==undefined?document.querySelectorAll('.nav-item')[m[s]]:null;}
function go(s,navEl,fromBack){
  var prevScreen=null;if(!fromBack){var act=document.querySelector('.screen.active');if(act)prevScreen=act.id.replace('s-','');}
  var scr=document.querySelectorAll('.screen');for(var i=0;i<scr.length;i++)scr[i].classList.remove('active');
  el('s-'+s).classList.add('active');
  el('mainHeader').style.display=(s==='online')?'block':'none';
  if(el('bottomNav'))el('bottomNav').style.display=(s==='chat')?'none':'flex';
  if(el('stickerPanel'))el('stickerPanel').classList.remove('open');
  if(el('chatMenu'))el('chatMenu').classList.remove('open');
  if(el('msgMenu'))hideMsgMenu();
  if(navEl){var nv=document.querySelectorAll('.nav-item');for(var i=0;i<nv.length;i++)nv[i].classList.remove('active');navEl.classList.add('active');}
  if(s==='msgs')renderMsgs();
  if(s==='friends')renderFriends();
  if(s==='textcolor'){initTextColors();applyTextColors();}
  if(s==='settings')el('frameMenuItem').style.display=(isAdmin()||isOwner())?'flex':'none';
if(s==='frames')initFrames();
  if(s==='rooms')refreshRooms();
  if(s==='wall')renderWall();
  if(s==='admin'){renderMembers();renderRoles();renderRoomsAdmin();renderEmojis();renderReports();renderLogs();renderBans();refreshShortcuts();}
  if(!fromBack){if(MAIN_SCREENS.indexOf(s)>-1)navStack=[];else if(prevScreen)navStack.push(prevScreen);}
}
window.addEventListener('popstate',function(e){
  if(chat){var wasRoom=chat.type==='room';chat=null;var prev=navStack.length?navStack.pop():(wasRoom?'rooms':'msgs');go(prev,getNavEl(prev),true);}
  else if(navStack.length>0){var prev=navStack.pop();go(prev,getNavEl(prev),true);}
  else go('online',document.querySelectorAll('.nav-item')[0],true);
  try{history.pushState({g:'s'},'');}catch(e2){}
});
function goBack(){
if(chat){var wasRoom=chat.type==='room';chat=null;
if(SDB.subs.msgs){try{SDB.subs.msgs.unsubscribe();}catch(e){}SDB.subs.msgs=null;}
if(SDB.subs.typing){try{SDB.subs.typing.unsubscribe();}catch(e){}SDB.subs.typing=null;}
var prev=navStack.length?navStack.pop():(wasRoom?'rooms':'msgs');
go(prev,getNavEl(prev),true);return;}
if(navStack.length>0){var prev=navStack.pop();go(prev,getNavEl(prev),true);}
else{go('online',document.querySelectorAll('.nav-item')[0],true);}
}
function toggleAdv(){el('advPanel').classList.toggle('open');}
function setG(g){filterG=g;var o=document.querySelectorAll('.radio-opt');for(var i=0;i<o.length;i++)o[i].classList.remove('sel');el(g==='الكل'?'gAll':g==='أنثى'?'gF':'gM').classList.add('sel');}
function applyAdv(){filterC=el('advCountry').value;renderOnline();toggleAdv();}
function clearAdv(){setG('الكل');filterC='الكل';el('advCountry').value='الكل';renderOnline();}

var lastOnlineHTML='';
function renderOnline(){
  var q=el('searchInput').value.trim().toLowerCase();
  var chips='';if(filterG!=='الكل')chips+='<span class="chip" onclick="setG(\'الكل\');renderOnline()">النوع: '+filterG+' ✕</span> ';if(filterC!=='الكل')chips+='<span class="chip" onclick="filterC=\'الكل\';renderOnline()">الدولة: '+filterC+' ✕</span>';
  el('chips').innerHTML=chips;
  var all=[];var seen={};
  for(var k in usersCache){var u=usersCache[k];if(seen[u.name])continue;seen[u.name]=true;all.push(u);}
  var list=all.filter(function(u){
    if(u.banned===true||u.is_active===false)return false;
    if(u.hidden===true&&!(me&&u.name===me.name&&false)&&!isOwner())return false;
    if(!isOnline(u)&&!isOwnerName(u.name))return false;
    if(isBlockedByMe(u.name))return false;
    return u.name.toLowerCase().indexOf(q)>-1&&(filterG==='الكل'||u.gender===filterG)&&(filterC==='الكل'||u.country===filterC);
  });
  list.sort(function(a,b){if(isOwnerName(a.name))return-1;if(isOwnerName(b.name))return 1;return 0;});
  if(!list.length){el('usersList').innerHTML='<div class="empty"><div class="big">🪐</div>لا يوجد مستخدمين متصلين حالياً</div>';return;}
  var html='';
  for(var i=0;i<list.length;i++){
    var u=list[i];var on=isOnline(u);
    var dots=isAdmin()?'<span class="u-dots" onclick="event.stopPropagation();openUserModal(\''+u.name+'\')">⋮</span>':'';
    var ownerBadge=isOwnerName(u.name)?'👑 ':'';
    html+='<div class="u-card" onclick="openUser(\''+u.name+'\')">'+getAvatarHTML(u,46)+'<span class="flag">'+(FLAGS[u.country]||flag('E','G'))+'</span><div style="flex:1"><div class="u-name">'+ownerBadge+styleName(u)+' ('+(u.age||'--')+') <span class="'+(u.gender==='أنثى'?'g-f':'g-m')+'">'+(u.gender==='أنثى'?'♀':'♂')+'</span></div><div style="font-size:11px;color:var(--mut)">'+role(u)+' • '+(on?'<span style="color:var(--grn)">متصل الآن</span>':'غير متصل')+'</div></div>'+dots+'</div>';
  }
  if(html!==lastOnlineHTML){el('usersList').innerHTML=html;lastOnlineHTML=html;}
}

var umTarget='';
function openUserModal(n){umTarget=n;el('umName').innerText=getDisplayName(usersCache[n]);if(el('umNicksBtn'))el('umNicksBtn').style.display=isOwner()?'block':'none';var r=role(usersCache[n]);el('umPromote').style.display=r.indexOf('إدارة')>-1?'none':'block';var act=!(usersCache[n]&&usersCache[n].is_active===false);el('umToggleActive').innerHTML=act?'🚫 إخفاء من القائمة':'✅ إظهار في القائمة';el('userModal').classList.add('open');}
function umChat(){closeModal('userModal');openUser(umTarget);}
async function umPromote(){if(!isAdmin())return toast('ممنوع');if(isOwnerName(umTarget))return toast('⛔ لا يمكن تعديل صاحب الموقع');await SDB.patchUser(umTarget,{role:'🛡️ إدارة'});toast('تم الترقية');logActivity('promote',me.name+' رقّى '+umTarget);refreshUsers();}
async function umDemote(){if(!isAdmin())return toast('ممنوع');if(isOwnerName(umTarget))return toast('⛔ لا يمكن تعديل صاحب الموقع');await SDB.patchUser(umTarget,{role:'عضو'});toast('تم التنزيل');logActivity('demote',me.name+' نزّل '+umTarget);refreshUsers();}
async function umToggleActive(){if(!isAdmin())return toast('ممنوع');if(isOwnerName(umTarget))return toast('⛔ لا يمكن تعديل صاحب الموقع');var act=!(usersCache[umTarget]&&usersCache[umTarget].is_active===false);await SDB.patchUser(umTarget,{is_active:!act});toast(act?'تم الإخفاء':'تم الإظهار');refreshUsers();}
async function forceOffline(){
  if(!isAdmin())return toast('ممنوع');
  if(isOwnerName(umTarget))return toast('⛔ لا يمكن تعديل صاحب الموقع');
  var oldTime = Date.now() - 60000;
  try{
    await sb.from('users').update({last_seen:oldTime}).eq('name',umTarget);
    if(usersCache[umTarget])usersCache[umTarget].lastSeen = oldTime;
    toast('⚫ تم إجبار '+umTarget+' على الأوفلاين');
    renderOnline();
    closeModal('userModal');
  }catch(e){toast('خطأ في التحديث');}
}
async function umBan(){if(!isAdmin())return toast('ممنوع');if(isOwnerName(umTarget))return toast('⛔ لا يمكن حظر صاحب الموقع');await SDB.patchUser(umTarget,{banned:true});toast('تم الحظر');logActivity('ban',me.name+' حظر '+umTarget);refreshUsers();}
async function umDelete(){
  if(!isAdmin())return toast('ممنوع');if(isOwnerName(umTarget))return toast('⛔ لا يمكن حذف صاحب الموقع');
  if(!confirm('حذف عضوية '+umTarget+' نهائياً؟'))return;
  var cs=await sb.from('convs').select('id').or('user_a.eq.'+umTarget+',user_b.eq.'+umTarget);
  for(var i=0;i<(cs.data||[]).length;i++){await SDB.delConvMsgs(cs.data[i].id);await SDB.delConv(cs.data[i].id);}
  await SDB.delUserRow(umTarget);try{await sb.from('passwords').delete().eq('name',umTarget);}catch(e){}
  toast('تم حذف العضوية نهائياً');logActivity('delete_account',me.name+' حذف عضوية '+umTarget);
  closeModal('userModal');refreshUsers();renderMembers();
}
function openUser(n){
  if(!me){toast('انتهت الجلسة');return;}
  if(usersCache[n]&&usersCache[n].banned===true)return toast('⛔ هذا المستخدم محظور');
  if(isBlockedByMe(n))return toast('⛔ لقد حظرت هذا المستخدم من قبل');
  if(isBlockedByOther(n))return toast('⛔ تم حظرك من هذا المستخدم');
  chat={type:'user',id:n};unread[n]=0;updateBadges();
  go('chat',null);el('chatBox').classList.add('priv-chat');
  refreshChatHeader(usersCache[n]);subMsgs();updateChatBlockBtn();
}
function updateChatBlockBtn(){if(!chat||chat.type!=='user')return;var btn=el('chatBlockBtn');if(!btn)return;if(isBlockedByMe(chat.id)){btn.innerHTML='⭕ فك الحظر';btn.onclick=unblockTarget;}else{btn.innerHTML='⛔ حظر المستخدم';btn.onclick=blockTarget;}}
function unblockTarget(){if(!chat||chat.type!=='user')return;var target=chat.id;if(!me.blocked)return;me.blocked=me.blocked.filter(function(x){return x!==target;});updateMe({blocked:me.blocked});toast('⭕ تم فك الحظر');updateChatBlockBtn();}
var upTarget=null;
function openUserProfile(name){var u=usersCache[name];if(!u)return toast('المستخدم غير موجود');upTarget=name;el('upName').innerHTML=getDisplayName(u)+' <span style="font-size:14px;color:var(--mut)">• '+(u.age||'--')+' سنة</span>';el('upStatus').innerHTML=(u.status?escapeHtml(u.status)+'<br>':'')+(isOnline(u)?'<span style="color:var(--grn)">● نشط الآن</span>':'<span style="color:var(--mut)">● غير متصل</span>');if(u.avatar){el('upAva').src=u.avatar;el('upAva').style.display='block';}else{el('upAva').style.display='none';}upShowTab('media');openModal('userProfileModal');loadUserMedia(name);}
function upShowTab(tab){if(tab==='media'){el('upMediaBox').style.display='grid';el('upAudioBox').style.display='none';el('upTabMedia').style.background='var(--acc)';el('upTabMedia').style.color='#fff';el('upTabAudio').style.background='var(--card2)';el('upTabAudio').style.color='var(--txt)';}else{el('upMediaBox').style.display='none';el('upAudioBox').style.display='block';el('upTabAudio').style.background='var(--acc)';el('upTabAudio').style.color='#fff';el('upTabMedia').style.background='var(--card2)';el('upTabMedia').style.color='var(--txt)';}}
async function loadUserMedia(name){el('upMediaBox').innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--mut);padding:20px">جاري التحميل...</div>';el('upAudioBox').innerHTML='<div style="text-align:center;color:var(--mut);padding:20px">جاري التحميل...</div>';var convId=[me.name,name].sort().join('_');var msgs=await SDB.loadMsgs(convId,300);var imgs=[],audios=[];msgs.forEach(function(m){if(m.deleted)return;if(m.type==='image')imgs.push(m.data);if(m.type==='audio')audios.push(m.data);});if(!imgs.length){el('upMediaBox').innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--mut);padding:30px"><div style="font-size:40px;margin-bottom:10px">🖼️</div>لا توجد صور في هذه المحادثة</div>';}else{var h='';imgs.forEach(function(src){h+='<img src="'+src+'" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:pointer" onclick="viewFullImage(this.src)">';});el('upMediaBox').innerHTML=h;}if(!audios.length){el('upAudioBox').innerHTML='<div style="text-align:center;color:var(--mut);padding:30px"><div style="font-size:40px;margin-bottom:10px">🎤</div>لا توجد تسجيلات</div>';}else{var h2='';audios.forEach(function(src){h2+='<div style="padding:8px 0;border-bottom:1px solid var(--line)"><audio controls src="'+src+'" style="width:100%"></audio></div>';});el('upAudioBox').innerHTML=h2;}}
function refreshChatHeader(u){if(!u)return;el('chatName').innerHTML=styleName(u);el('chatName').style.cursor='pointer';el('chatName').onclick=function(){openUserProfile(u.name);};el('chatAva').innerHTML=getAvatarHTML(u,46);el('chatAva').style.cursor='pointer';el('chatAva').onclick=function(){openUserProfile(u.name);};var on=isOnline(u);el('chatDot').className='dot '+(on?'on':'off');if(on){el('chatStatus').innerText='نشط';el('chatStatus').className='st-txt on';}else{el('chatStatus').innerText=(u.lastSeen)?'كان نشط منذ '+timeAgo(u.lastSeen):'غير متصل';el('chatStatus').className='st-txt off';}}

async function subMsgs(){
  var convId=curConvId();
  msgsCache=[];el('chatBox').innerHTML='';replyTo=null;editingMsgId=null;el('replyBar').classList.remove('open');userScrolledUp=false;
  var rows=await SDB.loadMsgs(convId,chat.type==='room'?(siteSettings.msgLimit||300):500);
  msgsCache=rows;
  rows.forEach(function(m){appendMsg(m);});
  setTimeout(function(){userScrolledUp=false;scrollChat();},100);
  if(chat.type==='user'){
    rows.forEach(function(m){if(m.from!==me.name&&!m.read)SDB.updMsg(m._id,{read:true});});
  }
  subMsgsRT(convId);
  subTypingRT(convId);
}

async function sendMsg(){
  if(!chat)return toast('افتح محادثة أولاً');
  if(!me)return;
  if(chat.type==='user'){
    if(isBlockedByMe(chat.id))return toast('⛔ لقد حظرت هذا المستخدم');
    if(isBlockedByOther(chat.id))return toast('⛔ تم حظرك من هذا المستخدم');
  }
  var inp=el('msgInput');var text=(inp?inp.value:'').trim();
  if(!text&&!pendingSticker&&!inlineStickersArr.length)return toast('اكتب رسالة');
  var convId=curConvId();
  stopTyping();
  if(text){
    for(var i=0;i<scItems.length;i++){
      var key=scItems[i].key,val=scItems[i].value;
      var re=new RegExp('(^|\\s)'+key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(\\s|$)','g');
      text=text.replace(re,function(m,p1,p2){return p1+val+p2;});
    }
    text=filterWords(text);
    if(siteSettings.blockLinks&&/https?:\/\//.test(text)&&!isAdmin())return toast('ممنوع إرسال روابط');
    if(editingMsgId){
      await SDB.updMsg(editingMsgId,{body:text,edited:true});
      var ei=msgsCache.findIndex(function(x){return x._id===editingMsgId;});
      if(ei>-1){msgsCache[ei].data=text;msgsCache[ei].edited=true;updateMsg(msgsCache[ei]);}
      editingMsgId=null;inp.value='';return;
    }
    var m={_id:'m'+Date.now()+Math.random().toString(36).slice(2),_conv:convId,from:me.name,data:text,type:'text',time:Date.now(),replyTo:replyTo||null,edited:false,deleted:false,read:false,reactions:{}};
    msgsCache.push(m);appendMsg(m);scrollChat();
    await SDB.addMsg(m);
    inp.value='';
    replyTo=null;el('replyBar').classList.remove('open');
    if(chat.type==='user')await SDB.upsertConv(convId,{a:me.name,b:chat.id,t:Date.now(),lastFrom:me.name,lastMsg:text});
    if(me.sndOwn)beep(600);
  }
  if(pendingSticker){
    var su=pendingSticker;pendingSticker=null;el('stickerBar').classList.remove('open');
    var sm={_id:'m'+Date.now()+'s'+Math.random().toString(36).slice(2),_conv:convId,from:me.name,data:su,type:'sticker',time:Date.now(),replyTo:null,edited:false,deleted:false,read:false,reactions:{}};
    msgsCache.push(sm);appendMsg(sm);scrollChat();
    await SDB.addMsg(sm);
    if(chat.type==='user')await SDB.upsertConv(convId,{a:me.name,b:chat.id,t:Date.now(),lastFrom:me.name,lastMsg:'[ستيكر]'});
    if(me.sndOwn)beep(600);
  }
  if(inlineStickersArr.length){
    var arr=inlineStickersArr.slice();inlineStickersArr=[];renderInlineStickers();
    for(var j=0;j<arr.length;j++){
      var s2={_id:'m'+Date.now()+'i'+j+Math.random().toString(36).slice(2),_conv:convId,from:me.name,data:arr[j],type:'sticker',time:Date.now(),replyTo:null,edited:false,deleted:false,read:false,reactions:{}};
      msgsCache.push(s2);appendMsg(s2);scrollChat();
      await SDB.addMsg(s2);
    }
    if(chat.type==='user')await SDB.upsertConv(convId,{a:me.name,b:chat.id,t:Date.now(),lastFrom:me.name,lastMsg:'[ستيكر]'});
  }
}

function filterWords(text){if(!text||!Array.isArray(badWordsList))return text;for(var i=0;i<badWordsList.length;i++){var w=badWordsList[i];if(!w)continue;try{var re=new RegExp('(^|[\\s.,!?؟،؛])'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=[\\s.,!?؟،؛]|$)','gi');text=text.replace(re,function(m,p1){return(p1||'')+'****';});}catch(e){}}return text;}

function appendMsg(m){var box=el('chatBox');if(!box)return;var wasNearBottom=(box.scrollHeight-box.scrollTop-box.clientHeight)<150;var div=document.createElement('div');div.className='bub '+(m.from===me.name?'':'in ');if(m.type==='system')div.className='bub sys';div.setAttribute('data-id',m._id);div.innerHTML=renderMsgContent(m);box.appendChild(div);if(wasNearBottom||m.from===me.name){userScrolledUp=false;setTimeout(function(){box.scrollTop=box.scrollHeight;},50);}}
function updateMsg(m){var div=document.querySelector('[data-id="'+m._id+'"]');if(div)div.innerHTML=renderMsgContent(m);}
function renderMsgContent(m){
  var html='';
  if(m.replyTo){var rp=msgsCache.find(function(x){return x._id===m.replyTo;});if(rp){html+='<div class="reply-bar open" style="cursor:pointer" onclick="event.stopPropagation();jumpToMsg(\''+String(m.replyTo).replace(/'/g,"")+'\')"><b>'+escapeHtml(getMsgName(rp.from))+'</b><div>'+replyPreviewHTML(rp,false)+'</div></div>';}}
  if(m.deleted){if(me&&isOwner()){html+='<div style="border:1px dashed var(--red);border-radius:10px;padding:6px 9px;background:rgba(230,69,83,.08)"><span style="color:var(--red);font-size:11px;font-weight:bold">🚫 رسالة محذوفة — المحتوى غير متاح (اتحذفت قبل التحديث)</span></div>';}else{html+='<i style="opacity:.6">تم حذف هذه الرسالة</i>';}return html;}
  if(chat&&chat.type==='room'&&m.from!=='نظام'){var sender=usersCache[m.from];var nm=sender?getDisplayName(sender):m.from;html+='<div style="font-size:12px;font-weight:bold;color:#fff;margin-bottom:4px;text-shadow:0 1px 2px rgba(0,0,0,.6)">'+escapeHtml(nm)+'</div>';}
  if(m.type==='image'){html+='<img src="'+escapeHtml(m.data)+'" style="max-width:200px;border-radius:8px;cursor:pointer" onclick="viewFullImage(this.src)">';}
  else if(m.type==='sticker'){html+='<img src="'+escapeHtml(m.data)+'" class="stick">';}
  else if(m.type==='audio'){html+='<audio controls src="'+escapeHtml(m.data)+'"></audio>';}
  else{var txt=escapeHtml(m.data);txt=txt.replace(/@([\w\u0600-\u06FF]+)/g,'<span class="mention">@$1</span>');txt=txt.replace(/(https?:\/\/[^\s]+)/g,'<a href="$1" target="_blank" style="color:#7fd4ff;text-decoration:underline">$1</a>');html+=txt+(m.edited?' <span style="font-size:10px;opacity:.5">(تم التعديل)</span>':'');}
  if(m.reactions&&Object.keys(m.reactions).length>0){html+='<div class="reactions">';for(var k in m.reactions){var mine=(m.reactions[k]&&m.reactions[k].indexOf&&m.reactions[k].indexOf(me.name)>-1);html+='<span class="reaction-btn '+(mine?'mine':'')+'" onclick="toggleReaction(\''+m._id+'\',\''+k+'\')">'+k+' '+(typeof m.reactions[k]==='number'?m.reactions[k]:m.reactions[k].length)+'</span>';}html+='</div>';}
  if(m.from===me.name){html+=' <span class="ticks '+(m.read?'read':'')+'">'+(m.read?'✓✓':'✓')+'</span>';}
  if(!m.deleted&&(m.type==='text'||m.type==='image')){html+='<div class="msg-actions"><button class="msg-act-btn" onclick="event.stopPropagation();openMsgMenu(event,\''+m._id+'\',\''+m.from+'\')">⋮</button></div>';}
  return html;
}
function scrollChat(){var box=el('chatBox');if(!box||userScrolledUp)return;setTimeout(function(){if(!userScrolledUp)box.scrollTop=box.scrollHeight;},50);}
function openMsgMenu(e,id,from){e.stopPropagation();msgMenuId=id;msgMenuTarget=from;var menu=el('msgMenu');var isMine=(from===me.name);var isOwn=isOwner();menu.innerHTML='<button onclick="doReply()">↩️ رد</button><button onclick="doReact()">❤️ رياكشن</button>'+(isMine||isOwn?'<button onclick="doEdit()">✏️ تعديل</button><button onclick="doDelete()">🗑️ حذف</button>':'');menu.classList.add('open');menu.style.top=(e.clientY+window.scrollY)+'px';menu.style.left=(window.innerWidth-e.clientX<160?e.clientX-150:e.clientX)+'px';}
function hideMsgMenu(){var menu=el('msgMenu');if(menu){menu.classList.remove('open');menu.style.display='';}}
function doReply(){hideMsgMenu();var m=msgsCache.find(function(x){return x._id===msgMenuId;});if(!m)return;replyTo=msgMenuId;el('replyBar').classList.add('open');el('replyName').innerText=getMsgName(m.from);el('replyText').innerHTML=replyPreviewHTML(m,true);el('msgInput').focus();}
function cancelReply(){replyTo=null;el('replyBar').classList.remove('open');}
function doEdit(){hideMsgMenu();var m=msgsCache.find(function(x){return x._id===msgMenuId;});if(!m||m.from!==me.name||m.type!=='text')return toast('لا يمكنك تعديل هذه الرسالة');editingMsgId=msgMenuId;el('msgInput').value=m.data;el('msgInput').focus();}
function doReact(){hideMsgMenu();var em=prompt('اكتب الإيموجي:');if(!em)return;toggleReaction(msgMenuId,em);}
async function doDelete(){
  hideMsgMenu();
  var m=msgsCache.find(function(x){return x._id===msgMenuId;});
  if(!m)return;
  if(m.from!==me.name&&!isAdmin())return toast('لا يمكنك حذف رسالة غيرك');
  await SDB.updMsg(msgMenuId,{deleted:true,body:''});
  var idx=msgsCache.findIndex(function(x){return x._id===msgMenuId;});
  if(idx>-1){msgsCache[idx].deleted=true;msgsCache[idx].data='';updateMsg(msgsCache[idx]);}
  toast('تم حذف الرسالة');
}
async function toggleReaction(mid,emoji){
  if(!chat)return;
  var msg=msgsCache.find(function(x){return x._id===mid;});
  if(!msg)return;
  var reacts=msg.reactions||{};var key=emoji.trim();
  var hadSame=false;
  for(var k in reacts){
    if(typeof reacts[k]==='object'&&reacts[k].indexOf){
      var idx=reacts[k].indexOf(me.name);
      if(idx>-1){
        if(k===key){hadSame=true;}
        reacts[k].splice(idx,1);
        if(reacts[k].length===0)delete reacts[k];
      }
    }
  }
  if(!hadSame){
    if(!reacts[key])reacts[key]=[me.name];
    else reacts[key].push(me.name);
  }
  msg.reactions=reacts;updateMsg(msg);
  await SDB.updMsg(mid,{reactions:reacts});
}
function handleTyping(){if(!chat)return;startTyping();}
function startTyping(){
  if(!chat)return;
  var convId=curConvId();
  sb.from('typing').upsert({conv_id:convId,name:me.name,t:Date.now()}).then(function(){});
  clearTimeout(typingTimer);
  typingTimer=setTimeout(stopTyping,3000);
}
function stopTyping(){if(!chat||!me)return;sb.from('typing').delete().eq('conv_id',curConvId()).eq('name',me.name).then(function(){});}
function handleInputKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();}}
function toggleChatMenu(e){
  e.stopPropagation();var menu=el('chatMenu');
  if(chat&&chat.type==='room'){menu.innerHTML='<button onclick="toggleChatSearch()">🔍 بحث في المحادثة</button>';}
  else{var _mm=me.allowMedia===false?'<button onclick="toggleMediaPerm()" id="mediaPermBtn">🖼️ '+(me.mediaBlock&&me.mediaBlock[chat.id]?'السماح بالوسائط':'منع الوسائط')+'</button>':'';menu.innerHTML=_mm+'<button onclick="openReport()">🚨 إبلاغ الإدارة</button><button onclick="toggleChatSearch()">🔍 بحث في المحادثة</button><button onclick="delChat()">🗑️ حذف المحادثة</button><button onclick="blockTarget()" id="chatBlockBtn">⛔ حظر المستخدم</button><button onclick="addFriend()">⭐ إضافة صديق</button>';}
  menu.classList.toggle('open');
}
function toggleChatSearch(){el('chatSearch').classList.toggle('open');if(!el('chatSearch').classList.contains('open'))el('chatSearchInput').value='';}
function searchChat(){var q=el('chatSearchInput').value.trim().toLowerCase();if(!q)return;var found=msgsCache.filter(function(m){return!m.deleted&&m.data&&m.data.toLowerCase().indexOf(q)>-1;});if(!found.length)return toast('لا توجد نتائج');var first=found[0];var el2=document.querySelector('[data-id="'+first._id+'"]');if(el2){el2.scrollIntoView({behavior:'smooth',block:'center'});el2.style.background='rgba(230,92,0,.3)';setTimeout(function(){el2.style.background='';},2000);}}
function openReport(){if(!chat)return toast('افتح محادثة أولاً');el('repTarget').innerText=chat.type==='user'?getMsgName(chat.id):(chat.name||'غرفة');el('reportModal').classList.add('open');}
async function submitReport(){
  var reason=el('repReason').value.trim();
  if(!reason)return toast('اكتب سبب الإبلاغ');
  var target=chat.type==='user'?chat.id:(chat.name||chat.id);
  await SDB.addReport({from_user:me.name,target:target,reason:reason,time:Date.now()});
  toast('تم الإبلاغ');closeModal('reportModal');el('repReason').value='';
}
function delChat(){if(!chat)return;el('delChatConfirmModal').classList.add('open');}
async function confirmDelChat(){
  closeModal('delChatConfirmModal');if(!chat)return;
  if(chat.type==='user'){
    var cid=getConvId(chat.id);
    await SDB.delConvMsgs(cid);await SDB.delConv(cid);
    convsCache=convsCache.filter(function(c){return c.id!==cid;});
    toast('🗑️ تم حذف المحادثة للأبد');
    chat=null;go('msgs',document.querySelectorAll('.nav-item')[1]);
  }else{
    await SDB.delConvMsgs(chat.id);
    msgsCache=[];el('chatBox').innerHTML='';
    toast('🗑️ تم مسح رسائل الغرفة');
  }
}
function blockTarget(){if(!chat||chat.type!=='user')return;var target=chat.id;if(isOwnerName(target))return toast('⛔ لا يمكن حظر صاحب الموقع');el('blockTargetName').innerText=getMsgName(target);el('blockConfirmModal').classList.add('open');}
async function confirmBlock(){
  closeModal('blockConfirmModal');if(!chat||chat.type!=='user')return;
  var target=chat.id;if(isOwnerName(target))return toast('⛔ لا يمكن حظر صاحب الموقع');
  if(!me.blocked)me.blocked=[];
  if(me.blocked.indexOf(target)>-1){me.blocked=me.blocked.filter(function(x){return x!==target;});toast('تم فك الحظر');updateMe({blocked:me.blocked});}
  else{
    me.blocked.push(target);updateMe({blocked:me.blocked});
    var cid=getConvId(target);
    await SDB.delConvMsgs(cid);await SDB.delConv(cid);
    convsCache=convsCache.filter(function(c){return c.id!==cid;});
    toast('⛔ تم حظر المستخدم وحذف المحادثة');
    chat=null;go('msgs',document.querySelectorAll('.nav-item')[1]);
  }
}
async function addFriend(){if(!chat||chat.type!=='user')return;if(!me.friends)me.friends=[];if(me.friends.indexOf(chat.id)>-1)return toast('هذا المستخدم صديقك بالفعل');me.friends.push(chat.id);await updateMe({friends:me.friends});toast('تمت الإضافة للأصدقاء');}
async function toggleMediaPerm(){if(!chat||chat.type!=='user')return;if(!me.mediaBlock)me.mediaBlock={};me.mediaBlock[chat.id]=!me.mediaBlock[chat.id];await updateMe({mediaBlock:me.mediaBlock});toast(me.mediaBlock[chat.id]?'تم منع الوسائط':'تم السماح بالوسائط');el('mediaPermBtn').innerText=me.mediaBlock[chat.id]?'🖼️ السماح بالوسائط':'🖼️ منع الوسائط';}

var _msgLongPressTimer=null,_msgLongPressName=null,_msgTouchMoved=false,_msgJustLongPressed=false;
function msgCardTouchStart(e,name){
  _msgTouchMoved=false;
  _msgLongPressName=name;
  clearTimeout(_msgLongPressTimer);
  _msgLongPressTimer=setTimeout(function(){
    if(!_msgTouchMoved){
      _msgJustLongPressed=true;
      selMode=true;
      selSet[name]=true;
      renderMsgs();
      if(navigator.vibrate)navigator.vibrate(40);
    }
  },480);
}
function msgCardTouchEnd(e){
  clearTimeout(_msgLongPressTimer);
  _msgLongPressTimer=null;
}
function msgCardTouchMove(e){
  _msgTouchMoved=true;
  clearTimeout(_msgLongPressTimer);
}
function toggleSel(name){
  if(_msgJustLongPressed){
    _msgJustLongPressed=false;
    return;
  }
  if(selSet[name])delete selSet[name];
  else selSet[name]=true;
  if(Object.keys(selSet).length===0)selMode=false;
  updateSelBar();
  renderMsgs();
}
function updateSelBar(){
  var n=Object.keys(selSet).length;
  var bar=el('selBar');
  var head=el('msgHeadNormal');
  if(bar){
    bar.style.display=selMode?'flex':'none';
    if(el('selCount'))el('selCount').innerText=n;
    var pinBtn=bar.querySelector('button[onclick="selPin()"]');
    if(pinBtn){
      var names=Object.keys(selSet);
      var allPinned=names.length>0&&names.every(function(nm){return isPinned(nm);});
      if(allPinned){
        pinBtn.innerHTML='إلغاء التثبيت 📌';
        pinBtn.style.background='#7a8694';
      }else{
        pinBtn.innerHTML='تثبيت 📌';
        pinBtn.style.background='#8b5cf6';
      }
    }
  }
  if(head)head.style.display=selMode?'none':'flex';
}
function selCancel(){selMode=false;selSet={};updateSelBar();renderMsgs();}
function selAll(){var list=currentMsgList();for(var i=0;i<list.length;i++)selSet[list[i].other]=true;updateSelBar();renderMsgs();}
function currentMsgList(){var list=convsCache.filter(function(c){return c.other;});var curTab=el('tabR').classList.contains('hide')?'f':'r';var out=[];for(var i=0;i<list.length;i++){var c=list[i];var isFriend=me.friends&&me.friends.indexOf(c.other)>-1;if(curTab==='f'?(isFriend||!me.msgRequests):(!isFriend&&me.msgRequests))out.push(c);}return out;}
async function selPin(){
  var names=Object.keys(selSet);
  if(!names.length)return;
  var pin=me.pinned||[];
  var allPinned=names.every(function(nm){return pin.indexOf(nm)>-1;});
  if(allPinned){
    pin=pin.filter(function(p){return names.indexOf(p)===-1;});
    await updateMe({pinned:pin});
    toast('📌 تم إلغاء التثبيت');
  }else{
    for(var i=0;i<names.length;i++){
      if(pin.indexOf(names[i])<0)pin.push(names[i]);
    }
    await updateMe({pinned:pin});
    toast('📌 تم التثبيت');
  }
  selCancel();
}
async function selBlock(){
  var names=Object.keys(selSet);if(!names.length)return;
  for(var i=0;i<names.length;i++){var n=names[i];if(isOwnerName(n))continue;if(!me.blocked)me.blocked=[];if(me.blocked.indexOf(n)<0)me.blocked.push(n);var cid=getConvId(n);await SDB.delConvMsgs(cid);await SDB.delConv(cid);}
  await updateMe({blocked:me.blocked});
  convsCache=convsCache.filter(function(c){return names.indexOf(c.other)===-1;});
  toast('⛔ تم الحظر');selCancel();
}
async function selDelete(){
  var names=Object.keys(selSet);if(!names.length)return;
  if(!confirm('حذف '+names.length+' محادثة للأبد؟'))return;
  for(var i=0;i<names.length;i++){var cid=getConvId(names[i]);await SDB.delConvMsgs(cid);await SDB.delConv(cid);}
  convsCache=convsCache.filter(function(c){return names.indexOf(c.other)===-1;});
  toast('🗑️ تم الحذف');selCancel();
}
function sendImage(e){var f=e.target.files[0];if(!f)return;compressImg(f,function(ev){pendingImg=ev;el('imgPreview').src=pendingImg;el('imgModal').classList.add('open');});e.target.value='';}
async function confirmImage(){
  if(!pendingImg||!chat)return;
  var caption=(el('imgCaption')?el('imgCaption').value.trim():'');
  var convId=curConvId();
  if(caption){
    var cm={_id:'m'+Date.now()+'c'+Math.random().toString(36).slice(2),_conv:convId,from:me.name,data:caption,type:'text',time:Date.now(),replyTo:null,edited:false,deleted:false,read:false,reactions:{}};
    msgsCache.push(cm);appendMsg(cm);
    await SDB.addMsg(cm);
  }
  var m={_id:'m'+Date.now()+'i'+Math.random().toString(36).slice(2),_conv:convId,from:me.name,data:pendingImg,type:'image',time:Date.now(),replyTo:null,edited:false,deleted:false,read:false,reactions:{}};
  msgsCache.push(m);appendMsg(m);scrollChat();
  await SDB.addMsg(m);
  pendingImg=null;if(el('imgCaption'))el('imgCaption').value='';closeModal('imgModal');
  if(chat.type==='user')await SDB.upsertConv(convId,{a:me.name,b:chat.id,t:Date.now(),lastFrom:me.name,lastMsg:caption||'[صورة]'});
}
function cancelImage(){pendingImg=null;if(el('imgCaption'))el('imgCaption').value='';closeModal('imgModal');}
function viewFullImage(src){var img=el('fullImageView');if(img){img.src=src;openModal('imageViewerModal');}}
function cancelRec(){if(mediaRec&&recording){recCancelled=true;mediaRec.stop();recording=false;el('micBtn').classList.remove('rec');el('recBar').style.display='none';el('stopRecBtn').style.display='none';if(recInterval){clearInterval(recInterval);recInterval=null;}try{mediaRec.stream.getTracks().forEach(function(t){t.stop();});}catch(e){}recChunks=[];toast('تم إلغاء التسجيل ✅');}}
function toggleRec(){if(recording){stopRec();}else{startRec();}}
function startRec(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)return toast('المتصفح لا يدعم التسجيل');
  if(recording)return toast('التسجيل شغال بالفعل');
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
    recCancelled=false;mediaRec=new MediaRecorder(stream);recChunks=[];
    mediaRec.ondataavailable=function(e){if(e.data.size>0)recChunks.push(e.data);};
    mediaRec.onstop=async function(){
      if(recCancelled){recCancelled=false;recChunks=[];return;}
      if(recChunks.length===0||!chat)return;
      var blob=new Blob(recChunks,{type:'audio/webm'});
      var reader=new FileReader();
      reader.onloadend=async function(){
        var convId=curConvId();
        var m={_id:'m'+Date.now()+'a'+Math.random().toString(36).slice(2),_conv:convId,from:me.name,data:reader.result,type:'audio',time:Date.now(),replyTo:null,edited:false,deleted:false,read:false,reactions:{}};
        msgsCache.push(m);appendMsg(m);scrollChat();
        await SDB.addMsg(m);
        if(chat.type==='user')await SDB.upsertConv(convId,{a:me.name,b:chat.id,t:Date.now(),lastFrom:me.name,lastMsg:'[تسجيل صوتي]'});
      };
      reader.readAsDataURL(blob);recChunks=[];
    };
    mediaRec.start();recording=true;recStartTime=Date.now();
    el('micBtn').classList.add('rec');el('recBar').style.display='flex';el('stopRecBtn').style.display='inline-block';
    recInterval=setInterval(function(){var diff=Math.floor((Date.now()-recStartTime)/1000);var m=Math.floor(diff/60),s=diff%60;el('recTimer').innerText='جاري التسجيل... '+m+':'+(s<10?'0'+s:s);},1000);
  }).catch(function(err){
    if(err.name==='NotAllowedError'||err.name==='PermissionDeniedError')toast('⚠️ يرجى السماح بالوصول للميكروفون');
    else if(err.name==='NotFoundError')toast('⚠️ لم يتم العثور على ميكروفون');
    else toast('لا يمكن الوصول للمايك');
  });
}
function stopRec(){if(mediaRec&&recording){mediaRec.stop();recording=false;el('micBtn').classList.remove('rec');el('recBar').style.display='none';el('stopRecBtn').style.display='none';if(recInterval){clearInterval(recInterval);recInterval=null;}try{mediaRec.stream.getTracks().forEach(function(t){t.stop();});}catch(e){}}}

var defaultEmojis=['😀','😂','🤣','😍','🥰','😘','😎','🤩','🥳','😇','🤔','🤫','🤐','😴','🥱','😷','🤒','🤕','🤮','🥵','🥶','😱','😨','😰','😥','😢','😭','😤','😡','🤬','👍','👎','👊','✊','🤛','🤜','🤞','✌️','🤟','🤘','👌','🤌','🤏','👈','👉','👆','👇','☝️','✋','🤚','🖐','🖖','👋','🤙','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💝','💘','💟','🔥','⭐','🌟','✨','💫','🎉','🎊','🏆','🥇','💯','💢','💥','💦','💨','💣','💬','🙏','🤲','🤝','💪','👁️','👅','👄'];
function loadStickers(){var panel=el('stickerPanel');var html='';for(var i=0;i<defaultEmojis.length;i++){html+='<div style="text-align:center;font-size:20px;cursor:pointer;padding:2px" onclick="insertEmoji(\''+defaultEmojis[i]+'\')">'+defaultEmojis[i]+'</div>';}for(var j=0;j<customEmojis.length;j++){html+='<img src="'+customEmojis[j].url+'" onerror="this.style.display=\'none\'" style="width:100%;height:40px;object-fit:contain;cursor:pointer" onclick="insertStickerInline(this.src)">';}panel.innerHTML=html;}
function insertEmoji(em){el('msgInput').value+=em;el('msgInput').focus();}
function toggleStickers(e){e.stopPropagation();el('stickerPanel').classList.toggle('open');}
var inlineStickersArr=[];function insertStickerInline(src){inlineStickersArr.push(src);renderInlineStickers();el('stickerPanel').classList.remove('open');}function removeInlineSticker(i){inlineStickersArr.splice(i,1);renderInlineStickers();}function renderInlineStickers(){var h='';for(var i=0;i<inlineStickersArr.length;i++){h+='<img src="'+inlineStickersArr[i]+'" onclick="removeInlineSticker('+i+')" title="اضغط للحذف">';}el('inlineStickers').innerHTML=h;}function cancelSticker(){pendingSticker=null;el('stickerBar').classList.remove('open');}
function showNotif(title,body,from){
var u=from?usersCache[from]:null;
var ava=getAvatar(u);
var n=document.createElement('div');
n.style.cssText='position:fixed;top:-100px;left:10px;right:10px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:10px;z-index:5000;box-shadow:0 6px 20px rgba(0,0,0,.6);transition:top .4s ease;cursor:pointer';
n.innerHTML='<div class="u-ava" style="width:42px;height:42px">'+ava+'</div><div style="flex:1;overflow:hidden"><div style="font-weight:bold;font-size:14px;color:var(--acc)">'+escapeHtml(title)+'</div><div style="font-size:13px;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(String(body||'').substring(0,70))+'</div></div><div style="font-size:11px;color:var(--mut)">الآن</div>';
document.body.appendChild(n);
setTimeout(function(){n.style.top='10px';},50);
var hideTimer=setTimeout(function(){n.style.top='-100px';setTimeout(function(){n.remove();},500);},4500);
n.onclick=function(){clearTimeout(hideTimer);n.style.top='-100px';setTimeout(function(){n.remove();},400);if(from&&usersCache[from]){openUser(from);}};
}
if('Notification' in window&&Notification.permission==='default'){Notification.requestPermission();}
function closeModal(id){el(id).classList.remove('open');if(id==='roomModal'){pendingRoomImg=null;el('roomImgLabel').innerHTML='📷<input type="file" id="roomImg" accept="image/*" style="display:none" onchange="previewRoomImg(event)">';}}
function openModal(id){el(id).classList.add('open');}
document.addEventListener('click',function(e){if(!e.target.closest('.chat-menu')&&!e.target.closest('.dots-btn'))el('chatMenu').classList.remove('open');if(!e.target.closest('.sticker-panel')&&!e.target.closest('.ic-btn'))el('stickerPanel').classList.remove('open');if(!e.target.closest('.msg-menu')&&!e.target.closest('.msg-act-btn'))hideMsgMenu();});
function applyPrefsUI(){if(!me)return;var p=me;if(el('pHide'))el('pHide').checked=(p.hidden===true);if(p.dark!==false){document.body.classList.remove('light');el('darkSw').checked=true;}else{document.body.classList.add('light');el('darkSw').checked=false;}el('smoothSw').checked=p.smooth!==false;el('pMedia').checked=p.allowMedia!==false;el('pRead').checked=p.readReceipts!==false;el('pLast').checked=p.lastSeen!==false;el('pReq').checked=p.msgRequests!==false;el('sOwn').checked=p.sndOwn===true;el('sOther').checked=p.sndOther!==false;el('sNotif').checked=p.sndNotif!==false;if(p.smooth!==false)document.body.classList.add('smooth');}
function editStatus(){el('statusInputWrap').classList.remove('hide');el('statusInput').value=(me&&me.status)?me.status:'';el('statusInput').focus();}
function cancelStatus(){el('statusInputWrap').classList.add('hide');}
async function saveStatus(){var val=el('statusInput').value.trim();await updateMe({status:val||null});el('setStatusText').innerText=val||'لا توجد حالة';el('statusInputWrap').classList.add('hide');toast(val?'تم تحديث الحالة':'تم مسح الحالة');}
function updateProfile(){if(!me)return;el('setName').innerHTML=styleName(me);if(el('setStatusText'))el('setStatusText').innerText=(me.status)?me.status:'لا توجد حالة';el('setDetails').innerText=(me.age||'--')+' • '+(me.gender||'')+' • '+(me.country||'');var avaBox=el('setAva').parentElement;if(me.frame&&(isOwner()||isAdmin())){avaBox.className='p-ava-frame';avaBox.innerHTML='<div class="p-ava" onclick="document.getElementById(\'avaInput\').click()"><span id="setAva">'+getAvatar(me)+'</span><span class="cam">📷</span></div><img class="frame-img" src="'+me.frame+'">';}else{avaBox.className='p-ava';avaBox.innerHTML='<span id="setAva">'+getAvatar(me)+'</span><span class="cam">📷</span>';avaBox.onclick=function(){document.getElementById('avaInput').click();};}}
function setDark(v){document.body.classList.toggle('light',!v);updateMe({dark:v});}
function setSmooth(v){document.body.classList.toggle('smooth',v);updateMe({smooth:v});}
function setPref(k,v){var o={};o[k]=v;updateMe(o);}
function editName(){el('nameInputWrap').classList.remove('hide');el('saveNameBtn').classList.remove('hide');el('nameInput').value=me.displayName||me.name;el('nameInput').focus();}
async function saveName(){
  var newName=el('nameInput').value.trim();
  if(!newName||newName.length<3)return toast('الاسم لازم يكون 3 حروف على الأقل');
  if(newName===(me.displayName||me.name)){el('nameInputWrap').classList.add('hide');el('saveNameBtn').classList.add('hide');return;}
  var existing=await SDB.getUser(newName);
  if(existing)return toast('هذا الاسم مستخدم بالفعل');
  await updateMe({displayName:newName});
  updateProfile();el('nameInputWrap').classList.add('hide');el('saveNameBtn').classList.add('hide');
  toast('تم تعديل الاسم بنجاح');
}
function changeAvatar(e){var f=e.target.files[0];if(!f)return;compressImg(f,function(ev){updateMe({avatar:ev});el('setAva').innerHTML='<img src="'+ev+'">';});}
function setChatBg(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(ev){LS.setItem('chat_bg',ev.target.result);var dim=LS.getItem('chat_dim')||50;setDim(dim);forceRepaint();};r.readAsDataURL(f);}
function setDim(v){var opacity=v/100;var bg=LS.getItem('chat_bg');if(bg){el('chatBox').style.backgroundImage='linear-gradient(rgba(0,0,0,'+opacity+'),rgba(0,0,0,'+opacity+')),url('+bg+')';}else{el('chatBox').style.backgroundImage='';}LS.setItem('chat_dim',v);}
function renderFriends(){if(!me||!me.friends||!me.friends.length){el('friendsList').innerHTML='<div class="empty">لا يوجد أصدقاء</div>';return;}var html='';for(var i=0;i<me.friends.length;i++){var n=me.friends[i];var u=usersCache[n];if(!u)continue;html+='<div class="u-card" onclick="openUser(\''+n+'\')"><div class="u-ava">'+getAvatar(u)+'</div><div style="flex:1"><div class="u-name">'+escapeHtml(getMsgName(n))+'</div><div style="font-size:11px;color:var(--mut)">'+(isOnline(u)?'متصل':'غير متصل')+'</div></div><button class="xbtn" onclick="event.stopPropagation();removeFriend(\''+n+'\')">حذف</button></div>';}el('friendsList').innerHTML=html||'<div class="empty">لا يوجد أصدقاء</div>';}
function removeFriend(n){if(!me.friends)return;me.friends=me.friends.filter(function(x){return x!==n;});updateMe({friends:me.friends});renderFriends();}
function renderMsgs(){
  var _mr=me.msgRequests!==false;
  var _tabs=el('msgTabs');if(_tabs)_tabs.style.display=_mr?'flex':'none';
  var list=convsCache.filter(function(c){return c.other;});
  var htmlF='',htmlR='';
  for(var i=0;i<list.length;i++){
    var c=list[i];if(isBlockedByMe(c.other))continue;
    var u=usersCache[c.other];
    var isFriend=me.friends&&me.friends.indexOf(c.other)>-1;
    var last=c.lastMsg||'...';
    var badge=unread[c.other]?'<span class="m-badge">'+(unread[c.other]>99?'99+':unread[c.other])+'</span>':'';
    var on=isOnline(u);
    var statusDot=on?'<span style="color:var(--grn);font-size:10px">●</span>':'<span style="color:var(--mut);font-size:10px">●</span>';
    var pinned=isPinned(c.other)?'<span class="pin-icon">📌</span>':'';
    var selected=!!selSet[c.other];
    var nameEsc=c.other.replace(/'/g,"\\'");
    var tap=selMode?'toggleSel(\''+nameEsc+'\')':'openUser(\''+nameEsc+'\')';
    var card='<div class="m-card'+(selected?' selected':'')+'" data-name="'+nameEsc+'" onclick="'+tap+'" ontouchstart="msgCardTouchStart(event,\''+nameEsc+'\')" ontouchend="msgCardTouchEnd(event)" ontouchmove="msgCardTouchMove(event)"><div class="m-check">✓</div><div style="display:flex;align-items:center;gap:10px">'+getAvatarHTML(u,40)+'<div style="flex:1"><div style="display:flex;justify-content:space-between;align-items:center"><div class="m-name">'+pinned+statusDot+' '+styleName(u||{name:c.other})+' '+(isFriend?'⭐':'')+'</div>'+badge+'</div><div class="m-last">'+escapeHtml(last.substring(0,35))+'</div></div></div></div>';
    if(_mr){if(isFriend)htmlF+=card;else htmlR+=card;}
    else htmlF+=card;
  }
  el('listF').innerHTML=htmlF||'<div class="empty"><div class="big">💬</div>لا توجد رسائل</div>';
  el('listR').innerHTML=htmlR||'<div class="empty"><div class="big">📨</div>لا توجد طلبات مراسلة</div>';
  updateSelBar();
}
function msgTab(t){el('tabF').classList.toggle('sel',t==='f');el('tabR').classList.toggle('sel',t==='r');el('listF').classList.toggle('hide',t!=='f');el('listR').classList.toggle('hide',t!=='r');renderMsgs();}
function renderRooms(){
  var canCreate=isAdmin()||isSuper()||isOwner();
  if(el('createRoomBtn'))el('createRoomBtn').classList.toggle('hide',!canCreate);
  if(!allRooms.length){el('roomsList').innerHTML='<div class="empty"><div class="big">👥</div>لا توجد غرف</div>';return;}
  var html='';
  for(var i=0;i<allRooms.length;i++){
    var r=allRooms[i];
    var iconHtml=r.img?'<img src="'+r.img+'">':'💬';
    html+='<div class="r-card" onclick="joinRoom(\''+r.id+'\')"><div class="r-icon">'+iconHtml+'</div><div style="flex:1"><div style="font-weight:bold">'+escapeHtml(r.name)+(roomUnread[r.id]?' <span class="m-badge">'+(roomUnread[r.id]>99?'99+':roomUnread[r.id])+'</span>':'')+'</div><div style="font-size:11px;color:var(--mut)">'+(r.descr?escapeHtml(r.descr.substring(0,30)):'غرفة دردشة')+' • '+(r.created_by?escapeHtml(r.created_by):'')+'</div></div></div>';
  }
  el('roomsList').innerHTML=html;
}
async function joinRoom(rid){
  var room=allRooms.find(function(r){return r.id===rid;});
  if(!room)return;
  if(room.pass&&room.pass!==prompt('كلمة سر الغرفة:'))return toast('كلمة السر غير صحيحة');
  chat={type:'room',id:rid,name:room.name};LS.setItem('room_seen_'+rid,Date.now());roomUnread[rid]=0;
  go('chat',null);el('chatBox').classList.remove('priv-chat');
  el('chatName').innerText=room.name;
  el('chatAva').innerHTML=room.img?'<img src="'+room.img+'">':'💬';
  el('chatDot').className='dot on';el('chatStatus').innerText=room.descr||'غرفة عامة';el('chatStatus').className='st-txt on';
  await subMsgs();if(room.welcome&&!msgsCache.find(function(x){return x.type==='system';})){var wm={_id:'m'+Date.now()+'sys',_conv:curConvId(),from:'نظام',data:room.welcome,type:'system',time:Date.now(),replyTo:null,edited:false,deleted:false,read:true,reactions:{}};msgsCache.push(wm);appendMsg(wm);await SDB.addMsg(wm);}
}
function previewRoomImg(e){var f=e.target.files[0];if(!f)return;compressImg(f,function(dataUrl){pendingRoomImg=dataUrl;el('roomImgLabel').innerHTML='<img src="'+dataUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:10px">';});}
async function createRoom(){
  if(!isAdmin()&&!isSuper()&&!isOwner())return toast('ممنوع إنشاء غرف');
  var name=el('roomName').value.trim();if(!name)return toast('اكتب اسم الغرفة');
  var roomData={id:'r'+Date.now(),name:name,descr:el('roomDesc').value.trim(),welcome:el('roomWelcome').value.trim(),pass:el('roomPass').value.trim()||null,created_by:me.name,created:Date.now(),img:pendingRoomImg||null};
  await SDB.addRoom(roomData);
  toast('تم إنشاء الغرفة');closeModal('roomModal');
  el('roomName').value='';el('roomDesc').value='';el('roomWelcome').value='';el('roomPass').value='';
  logActivity('room',me.name+' أنشأ غرفة '+name);
}
function toggleWallForm(){var f=el('wallForm');f.style.display=f.style.display==='none'?'block':'none';}
function onWallTypeChange(){var t=el('wallType').value;el('wallMediaWrap').style.display=(t==='image'||t==='youtube')?'block':'none';}
function handleWallImage(e){var f=e.target.files[0];if(!f)return;compressImg(f,function(dataUrl){el('wallMedia').value=dataUrl;toast('تم اختيار الصورة ✅');});e.target.value='';}
async function publishWallPost(){
  if(!me)return toast('سجل دخولك أولاً');
  var type=el('wallType').value,content=el('wallContent').value.trim(),media=el('wallMedia').value.trim();
  if(!content)return toast('اكتب محتوى المنشور');
  if((type==='image'||type==='youtube')&&!media)return toast('ضع الرابط');
  await SDB.addWall({id:'w'+Date.now(),author:me.name,content:content,type:type,media_url:media||'',likes:[],comments:[],timestamp:Date.now()});
  setTimeout(function(){try{refreshWall();}catch(e){}},2600);
  toast('تم النشر ✅');el('wallContent').value='';el('wallMedia').value='';toggleWallForm();
}
function renderWall(){
  if(!wallCache.length){el('wallFeed').innerHTML='<div class="empty"><div class="big">🎨</div>لا توجد منشورات بعد<br>كن أول من يبدع!</div>';return;}
  var html='';
  for(var i=0;i<wallCache.length;i++){
    var p=wallCache[i];
    var u=usersCache[p.author];
    var ava=(u&&u.avatar)?'<img src="'+u.avatar+'">':((u&&u.gender==='أنثى')?'👩':'👨');
    var canDel=(p.author===me.name)||isAdmin();
    var delBtn=canDel?'<button class="xbtn" onclick="deleteWallPost(\''+p.id+'\')" style="padding:2px 8px;font-size:11px">🗑️</button>':'';
    var mediaHtml='';
    if(p.type==='image'&&p.media_url)mediaHtml='<img src="'+p.media_url+'" class="w-media" onclick="viewFullImage(this.src)">';
    else if(p.type==='youtube'&&p.media_url){var yid='';var m=p.media_url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);if(m)yid=m[1];mediaHtml=yid?'<div class="w-yt"><iframe src="https://www.youtube.com/embed/'+yid+'" allowfullscreen></iframe></div>':'';}
    var likeCount=(p.likes&&p.likes.length)||0;
    var liked=(p.likes&&p.likes.indexOf(me.name)>-1);
    var cc=(p.comments&&p.comments.length)||0;
    var commentsHtml='';
    if(p.comments&&p.comments.length){for(var j=0;j<p.comments.length;j++){var cm=p.comments[j];commentsHtml+='<div class="w-comment"><b>'+escapeHtml(cm.from)+'</b> <span style="color:var(--txt)">'+escapeHtml(cm.text)+'</span></div>';}}
    else commentsHtml='<div style="font-size:12px;color:var(--mut)">لا توجد تعليقات</div>';
    html+='<div class="w-post"><div class="w-head"><div class="w-ava">'+ava+'</div><div class="w-meta"><div class="w-name">'+styleName(u||{name:p.author})+'</div><div class="w-time">'+timeAgo(p.timestamp)+' • '+role(u||{name:p.author})+'</div></div>'+delBtn+'</div><div class="w-body">'+escapeHtml(p.content)+'</div>'+mediaHtml+'<div class="w-actions"><button class="w-btn '+(liked?'liked':'')+'" onclick="likeWallPost(\''+p.id+'\')">❤️ '+likeCount+'</button><button class="w-btn" onclick="toggleWallComments(\''+p.id+'\')">💬 '+cc+'</button></div><div class="w-comments" id="wc-'+p.id+'"><div style="margin-bottom:8px">'+commentsHtml+'</div><div class="w-comment-input"><input id="wci-'+p.id+'" placeholder="اكتب تعليق..." onkeydown="if(event.key===\'Enter\')sendWallComment(\''+p.id+'\')"><button class="adm-btn" onclick="sendWallComment(\''+p.id+'\')">إرسال</button></div></div></div>';
  }
  el('wallFeed').innerHTML=html;
}
async function likeWallPost(id){
  if(!me)return toast('سجل دخولك أولاً');
  var p=wallCache.find(function(x){return x.id===id;});if(!p)return;
  var likes=p.likes||[];var idx=likes.indexOf(me.name);
  if(idx>-1)likes.splice(idx,1);else likes.push(me.name);
  p.likes=likes;renderWall();
  await SDB.updWall(id,{likes:likes});
}
function toggleWallComments(id){var box=el('wc-'+id);if(box)box.classList.toggle('open');}
async function sendWallComment(id){
  if(!me)return;var inp=el('wci-'+id);var text=(inp.value||'').trim();if(!text)return;
  var p=wallCache.find(function(x){return x.id===id;});if(!p)return;
  if(!p.comments)p.comments=[];
  p.comments.push({from:me.name,text:text,timestamp:Date.now()});
  await SDB.updWall(id,{comments:p.comments});
  setTimeout(function(){try{refreshWall();}catch(e){}},2600);
}
async function deleteWallPost(id){if(!me)return;if(!confirm('حذف المنشور؟'))return;await SDB.delWall(id);setTimeout(function(){try{refreshWall();}catch(e){}},2600);toast('تم الحذف');}

function openAdmin(){if(!isAdmin())return toast('ممنوع');go('admin',null);document.querySelectorAll('.owner-only').forEach(function(e){e.classList.add('hide');});if(isOwner())document.querySelectorAll('.owner-only').forEach(function(e){e.classList.remove('hide');});}
function adminTab(tab,e){
  document.querySelectorAll('.admin-tab').forEach(function(b){b.classList.remove('sel');});e.classList.add('sel');
  document.querySelectorAll('.admin-panel').forEach(function(p){p.classList.remove('open');});
  el('ap-'+tab).classList.add('open');
  if(tab==='monitor'){if(!isOwner())return toast('لصاحب الموقع فقط');renderMonitor();}if(tab==='nicks'){if(!isOwner())return toast('لصاحب الموقع فقط');renderNicks();}if(tab==='bans')renderQuickBans();
}
function renderShortcutsTable(){var html='';for(var i=0;i<scItems.length;i++){var s=scItems[i];html+='<tr><td>'+escapeHtml(s.key)+'</td><td>'+escapeHtml(s.value)+'</td><td><button class="ebtn" onclick="editShortcut('+s.id+')">تعديل</button> <button class="xbtn" onclick="delShortcut('+s.id+')">حذف</button></td></tr>';}el('scTable').innerHTML=html||'<tr><td colspan="3" style="text-align:center;color:var(--mut)">لا توجد اختصارات</td></tr>';}
async function addShortcut(){var k=el('scKey').value.trim(),v=el('scVal').value.trim();if(!k||!v)return toast('اكتب الرمز والنص');await SDB.addShortcut(k,v);el('scKey').value='';el('scVal').value='';setTimeout(function(){try{refreshShortcuts();}catch(e){}},2200);toast('تم الحفظ');}
var editingShortcutId=null;
function editShortcut(id){
var item=scItems.find(function(s){return s.id===id;});
if(!item)return toast('الاختصار غير موجود');
editingShortcutId=id;
el('scKey').value=item.key||'';
el('scVal').value=item.value||'';
var btn=document.querySelector('#ap-shortcuts .adm-btn');
if(btn)btn.innerText='تحديث الاختصار';
el('scKey').focus();
}
async function addShortcut(){
var k=el('scKey').value.trim(),v=el('scVal').value.trim();
if(!k||!v)return toast('اكتب الرمز والنص');
if(editingShortcutId){
await sb.from('shortcuts').update({key:k,value:v}).eq('id',editingShortcutId);
editingShortcutId=null;
el('scKey').value='';el('scVal').value='';
var btn=document.querySelector('#ap-shortcuts .adm-btn');
if(btn)btn.innerText='حفظ الاختصار';
setTimeout(function(){try{refreshShortcuts();}catch(e){}},2200);
toast('تم التعديل ✅');
return;
}
await SDB.addShortcut(k,v);
el('scKey').value='';el('scVal').value='';
setTimeout(function(){try{refreshShortcuts();}catch(e){}},2200);
toast('تم الحفظ ✅');
}
async function delShortcut(id){await SDB.delShortcut(id);setTimeout(function(){try{refreshShortcuts();}catch(e){}},2200);}
function renderMembers(){
  var q=el('memSearch').value.trim().toLowerCase();
  var html='';
  for(var k in usersCache){
    var u=usersCache[k];
    if(q&&u.name.toLowerCase().indexOf(q)===-1)continue;
    var prot=isOwnerName(u.name);
    var banBtn=prot?'<button class="xbtn protected-btn" disabled>🛡️</button>':(u.banned?'<button class="ubtn" onclick="banUser(\''+u.name+'\')">فك</button>':'<button class="xbtn" onclick="banUser(\''+u.name+'\')">حظر</button>');
    var delBtn=prot?'':'<button class="xbtn" onclick="deleteUser(\''+u.name+'\')" style="background:#dc2626">🗑️</button>';
    html+='<tr><td>'+escapeHtml(u.name)+'</td><td>'+role(u)+'</td><td>'+(u.country||'')+'</td><td style="font-size:10px;direction:ltr">'+(u.ip||'?')+'</td><td>'+(u.dtype||'?')+'</td><td>'+(u.browser||'?')+'</td><td>'+banBtn+' '+delBtn+'</td></tr>';
  }
  el('memTable').innerHTML=html||'<tr><td colspan="7" style="text-align:center;color:var(--mut)">لا يوجد أعضاء متصلين</td></tr>';
}
async function banUser(n){
  if(!isAdmin())return;if(isOwnerName(n))return toast('⛔ لا يمكن حظر صاحب الموقع');
  var u=usersCache[n];var banned=!(u&&u.banned);
  await SDB.patchUser(n,{banned:banned});
  toast(banned?'تم الحظر':'تم فك الحظر');
  logActivity('ban',me.name+(banned?' حظر ':' فك حظر ')+n);
  refreshUsers();renderBans();
}
async function deleteUser(n){
  if(!isAdmin())return;if(isOwnerName(n))return toast('⛔ لا يمكن حذف صاحب الموقع');
  if(!confirm('حذف عضوية '+n+' نهائياً؟'))return;
  var cs=await sb.from('convs').select('id').or('user_a.eq.'+n+',user_b.eq.'+n);
  for(var i=0;i<(cs.data||[]).length;i++){await SDB.delConvMsgs(cs.data[i].id);await SDB.delConv(cs.data[i].id);}
  await SDB.delUserRow(n);
  toast('تم حذف العضوية نهائياً');logActivity('delete_account',me.name+' حذف عضوية '+n);
  refreshUsers();renderMembers();
}
function renderRoles(){
  var html='';
  for(var k in usersCache){
    var u=usersCache[k];
    if(u.role&&u.role!=='عضو'&&u.role!=='زائر'){
      html+='<tr><td>'+escapeHtml(u.name)+'</td><td>'+u.role+'</td><td><button class="xbtn" onclick="removeRole(\''+u.name+'\')">إزالة</button></td></tr>';
    }
  }
  el('roleTable').innerHTML=html||'<tr><td colspan="3" style="text-align:center;color:var(--mut)">لا يوجد رتب مخصصة</td></tr>';
}
async function assignRole(){
  if(!isAdmin())return;
  var n=el('roleUser').value.trim(),r=el('roleSelect').value;
  if(!n)return toast('اكتب اسم العضو');
  if(isOwnerName(n))return toast('⛔ لا يمكن تعديل صاحب الموقع');
  var u=await SDB.getUser(n);
  if(!u)return toast('العضو غير موجود');
  await SDB.patchUser(n,{role:r});
  toast('تم الترقية');logActivity('promote',me.name+' رقّى '+n+' لـ '+r);
  el('roleUser').value='';refreshUsers();renderRoles();
}
async function removeRole(n){if(isOwnerName(n))return toast('⛔ لا يمكن تعديل صاحب الموقع');await SDB.patchUser(n,{role:'عضو'});toast('تمت إزالة الرتبة');refreshUsers();renderRoles();}
function renderRoomsAdmin(){
  var html='';
  for(var i=0;i<allRooms.length;i++){
    var r=allRooms[i];
    var imgPrev=r.img?'<img src="'+r.img+'" style="width:40px;height:40px;border-radius:8px;object-fit:cover">':'💬';
    html+='<div class="room-card">'+imgPrev+'<div style="flex:1"><div style="font-weight:bold">'+escapeHtml(r.name)+'</div><div style="font-size:11px;color:var(--mut)">'+(r.descr||'')+'</div><div style="display:flex;gap:6px;margin-top:8px"><button onclick="pickRoomImg(\''+r.id+'\')" style="flex:1;padding:8px 4px;border:none;border-radius:8px;background:#22c55e;color:#fff;font-size:12px;font-weight:bold">📷 صورة</button><button onclick="editRoom(\''+r.id+'\')" style="flex:1;padding:8px 4px;border:none;border-radius:8px;background:#8b5cf6;color:#fff;font-size:12px;font-weight:bold">✏ تعديل</button><button onclick="deleteRoom(\''+r.id+'\')" style="flex:1;padding:8px 4px;border:none;border-radius:8px;background:#e64553;color:#fff;font-size:12px;font-weight:bold">حذف</button></div><input type="file" accept="image/*" style="display:none" id="rImg_'+r.id+'" onchange="updateRoomImg(\''+r.id+'\',event)"></div></div>';
  }
  el('adminRoomsList').innerHTML=html||'<div style="text-align:center;color:var(--mut);padding:20px">لا توجد غرف</div>';
}
async function deleteRoom(id){if(!isAdmin())return;if(!confirm('حذف الغرفة؟'))return;await SDB.delRoom(id);setTimeout(function(){try{refreshRooms();}catch(e){}},2000);toast('تم الحذف');}
function editRoom(id){
  var room=allRooms.find(function(r){return r.id===id;});
  if(!room)return toast('الغرفة غير موجودة');
  el('editRoomId').value=id;el('editRoomName').value=room.name||'';el('editRoomDesc').value=room.descr||'';el('editRoomWelcome').value=room.welcome||'';el('editRoomPass').value=room.pass||'';
  openModal('editRoomModal');
}
async function saveEditRoom(){
  var id=el('editRoomId').value;var name=el('editRoomName').value.trim();
  if(!name)return toast('اكتب اسم الغرفة');
  await SDB.updRoom(id,{name:name,descr:el('editRoomDesc').value.trim(),welcome:el('editRoomWelcome').value.trim(),pass:el('editRoomPass').value.trim()||null});
  toast('تم حفظ التعديلات');closeModal('editRoomModal');refreshRooms();
  logActivity('edit_room',me.name+' عدّل غرفة '+name);
}
function renderEmojis(){var html='';for(var i=0;i<customEmojis.length;i++){var e=customEmojis[i];html+='<div class="emoji-item"><img src="'+e.url+'"><button class="del-emoji" onclick="delEmoji('+e.id+')">✕</button></div>';}el('emojiGrid').innerHTML=html;}
async function addEmoji(){var url=el('emojiUrl').value.trim();if(!url)return toast('اكتب رابط');await SDB.addEmoji(url);el('emojiUrl').value='';setTimeout(function(){try{refreshRooms();}catch(e){}},2000);loadStickers();toast('تم الإضافة');}
async function addEmojiFile(){
  var fileInput=document.getElementById('emojiFile');var file=fileInput.files[0];
  if(!file)return toast('اختر ملف');
  if(file.type==='image/gif'){var reader=new FileReader();reader.onload=async function(e){await SDB.addEmoji(e.target.result);fileInput.value='';setTimeout(function(){try{refreshRooms();}catch(e){}},2000);loadStickers();toast('تم إضافة الـ GIF');};reader.readAsDataURL(file);}
  else compressImg(file,async function(dataUrl){await SDB.addEmoji(dataUrl);fileInput.value='';setTimeout(function(){try{refreshRooms();}catch(e){}},2000);loadStickers();toast('تم الإضافة');});
}
async function delEmoji(id){await SDB.delEmoji(id);setTimeout(function(){try{refreshRooms();}catch(e){}},2000);loadStickers();}
async function renderReports(){
  var reports=await SDB.loadReports();
  var html='';
  for(var i=0;i<reports.length;i++){
    var r=reports[i];
    html+='<div class="log-row"><b>'+escapeHtml(r.from_user)+'</b> بلغ عن <b>'+escapeHtml(r.target)+'</b><br>السبب: '+escapeHtml(r.reason)+'<br><span style="color:var(--mut);font-size:11px">'+timeAgo(r.time)+'</span></div>';
  }
  el('reportsList').innerHTML=html||'<div style="text-align:center;color:var(--mut);padding:20px">لا توجد إبلاغات</div>';
}
async function renderLogs(){
  var logs=await SDB.loadLogs();
  var html='';
  for(var i=0;i<logs.length;i++){var l=logs[i];html+='<div class="log-row">['+timeAgo(l.time)+'] <b>'+escapeHtml(l.action)+'</b>: '+escapeHtml(l.details)+'</div>';}
  el('activityLog').innerHTML=html||'<div style="text-align:center;color:var(--mut)">لا توجد سجلات</div>';
}
function renderQuickBans(){
var h='';var any=false;
for(var k in usersCache){
var u=usersCache[k];
if(isOwnerName(u.name))continue;
any=true;
var banBtn=u.banned?'<button class="ubtn" onclick="banUser(\''+u.name.replace(/'/g,"\\'")+'\')">فك الحظر</button>':'<button class="xbtn" onclick="banUser(\''+u.name.replace(/'/g,"\\'")+'\')">⛔ حظر</button>';
h+='<div class="log-row" style="display:flex;justify-content:space-between;align-items:center"><b>'+escapeHtml(u.name)+'</b>'+banBtn+'</div>';
}
el('quickBanList').innerHTML=h||'<div style="text-align:center;color:var(--mut);padding:15px">لا يوجد أعضاء متصلين</div>';
}
function pickRoomImg(id){var inp=el('rImg_'+id);if(inp)inp.click();else toast('افتح الغرف الأول');}
function updateRoomImg(id,e){var f=e.target.files[0];if(!f)return;compressImg(f,function(dataUrl){sb.from('rooms').update({img:dataUrl}).eq('id',id).then(function(r){if(r.error)return toast('خطأ: '+r.error.message);toast('تم تحديث الصورة ✅');refreshRooms();renderRoomsAdmin();});});e.target.value='';}
async function renderBans(){
  var bans=await SDB.loadBans();
  var html='';
  for(var i=0;i<bans.length;i++){var b=bans[i];html+='<div class="log-row"><b>'+escapeHtml(b.target)+'</b><br>بواسطة: '+escapeHtml(b.by_user||'')+' • '+timeAgo(b.time)+' <button class="xbtn" onclick="unban('+b.id+')">فك</button></div>';}
  el('banList').innerHTML=html||'<div style="text-align:center;color:var(--mut)">لا يوجد محظورين</div>';
}
async function banManual(){
  var t=el('banInput').value.trim();if(!t)return;
  if(isOwnerName(t))return toast('⛔ لا يمكن حظر صاحب الموقع');
  var u=await SDB.getUser(t);
  if(u)await SDB.patchUser(t,{banned:true});
  await SDB.addBan({target:t,by_user:me.name,time:Date.now()});
  toast('تم الحظر');refreshUsers();renderBans();
}
async function unban(id){
  var bans=await SDB.loadBans();
  var b=bans.find(function(x){return x.id===id;});
  if(b){var u=await SDB.getUser(b.target);if(u&&u.banned)await SDB.patchUser(b.target,{banned:false});}
  await SDB.delBan(id);
  toast('تم فك الحظر');refreshUsers();renderBans();
}
async function publishAnnounce(){
  if(!isAdmin())return toast('ممنوع');
  var text=el('announceText').value.trim();
  if(!text)return toast('اكتب الإعلان أولاً');
  await SDB.saveSetting('announce',{text:text,time:Date.now(),by:me.name});
  toast('تم نشر الإعلان');
  logActivity('announce',me.name+' نشر إعلان');
}
async function clearAnnounce(){
  if(!isAdmin())return;
  await SDB.saveSetting('announce',null);
  toast('تم مسح الإعلان');el('currentAnnounce').innerText='لا يوجد';el('announceText').value='';
}
function closeAnnounceBanner(){el('announceBanner').style.display='none';LS.setItem('closed_announce',el('announceBannerText').innerText);}
async function saveAllSiteSettings(){
  var words=el('badWords').value.split('\n').map(function(w){return w.trim();}).filter(function(w){return w;});
  await SDB.saveSetting('global',{blockLinks:el('siteBlockLinks').checked,bannedWords:words,msgLimit:300,roomAudio:true});
  badWordsList=words;siteSettings.blockLinks=el('siteBlockLinks').checked;
  toast('تم حفظ الإعدادات');
  logActivity('settings',me.name+' عدّل الإعدادات');
}
function nvDate(ts){var d=new Date(ts);var day=('0'+d.getDate()).slice(-2);var mo=('0'+(d.getMonth()+1)).slice(-2);var yr=d.getFullYear();var h=d.getHours();var m=('0'+d.getMinutes()).slice(-2);var ap=(h<12)?'ص':'م';h=h%12;if(h===0)h=12;return day+'-'+mo+'-'+yr+' <span style="color:#e65100">'+ap+' '+h+':'+m+'</span>';}
async function openNicksView(){
if(!isOwner())return toast('لصاحب الموقع فقط');
closeModal('userModal');
el('nvTarget').innerText=getMsgName(umTarget);
el('nvBody').innerHTML='<div style="text-align:center;color:var(--mut);padding:30px">جاري التحميل...</div>';
openModal('nicksViewModal');
var d1=await sb.from('device_logins').select('*').eq('name',umTarget).order('utime',{ascending:false}).limit(100);
if(d1.error){el('nvBody').innerHTML='<div style="color:var(--red);text-align:center;padding:20px">خطأ: '+d1.error.message+'</div>';return;}
var recs=d1.data||[];
var devIds=[];
recs.forEach(function(r){if(r.device_id&&devIds.indexOf(r.device_id)===-1)devIds.push(r.device_id);});
var all=[];
if(devIds.length){
var d2=await sb.from('device_logins').select('*').in('device_id',devIds).order('utime',{ascending:false}).limit(500);
all=d2.data||[];
}
var names=[];all.forEach(function(r){if(names.indexOf(r.name)===-1)names.push(r.name);});
el('nvCount').innerText=names.length;
if(!all.length){el('nvBody').innerHTML='<div style="text-align:center;color:var(--mut);padding:30px">لا توجد بيانات تسجيل لهذا العضو بعد</div>';return;}
var h='<table style="width:100%;border-collapse:collapse;font-size:11px">';
h+='<tr><th style="background:#42a5f5;color:#fff;padding:6px;border:1px solid #1e88e5">العضو</th><th style="background:#42a5f5;color:#fff;padding:6px;border:1px solid #1e88e5">الزخرفه</th><th style="background:#42a5f5;color:#fff;padding:6px;border:1px solid #1e88e5">IP</th><th style="background:#42a5f5;color:#fff;padding:6px;border:1px solid #1e88e5">آخر دخول</th><th style="background:#42a5f5;color:#fff;padding:6px;border:1px solid #1e88e5">#</th></tr>';
all.forEach(function(r,i){
var u=usersCache[r.name];
var zk=u?(u.displayName||'-'):'-';
var warn=names.length>1;
h+='<tr style="background:#fff;color:#1a1a1a">';
h+='<td style="padding:5px;border:1px solid #90caf9;text-align:center;font-weight:bold;color:'+(warn?'#e64553':'#1565c0')+'">'+escapeHtml(r.name)+'</td>';
h+='<td style="padding:5px;border:1px solid #90caf9;text-align:center">'+escapeHtml(zk)+'</td>';
h+='<td style="padding:5px;border:1px solid #90caf9;text-align:center;color:#1565c0">'+escapeHtml(r.ip||'?')+'</td>';
h+='<td style="padding:5px;border:1px solid #90caf9;text-align:center;white-space:nowrap">'+nvDate(r.utime)+'</td>';
h+='<td style="padding:5px;border:1px solid #90caf9;text-align:center;font-weight:bold">'+(i+1)+'</td></tr>';
h+='<tr><td colspan="5" style="background:#eceff1;border:1px solid #90caf9;padding:4px;font-size:10px;color:#37474f;word-break:break-all;text-align:center">📱 '+escapeHtml(r.device_id||'')+'</td></tr>';
});
h+='</table>';
if(names.length>1){
h+='<div style="background:rgba(230,69,83,.15);border:1px solid var(--red);border-radius:8px;padding:10px;margin-top:10px;text-align:center;color:var(--red);font-size:13px;font-weight:bold">⚠️ ده الجهاز دخل بـ '+names.length+' أسماء مختلفة - مشكوك نكات!</div>';
}else{
h+='<div style="background:rgba(34,197,94,.15);border:1px solid var(--grn);border-radius:8px;padding:10px;margin-top:10px;text-align:center;color:var(--grn);font-size:13px;font-weight:bold">✅ ده الجهاز دخل باسم واحد بس - طبيعي</div>';
}
el('nvBody').innerHTML=h;
}
function timeLeft(ts){var diff=86400000-(Date.now()-ts);if(diff<0)return'انتهى';var h=Math.floor(diff/3600000);var m=Math.floor((diff%3600000)/60000);if(h>0)return h+' ساعة';return m+' دقيقة';}
async function renderStories(){
try{
var myOld=Date.now()-86400000;
await sb.from('stories').delete().lt('stime',myOld);
var d=await sb.from('stories').select('*').gt('stime',myOld).order('stime',{ascending:false});
if(d.error)return;
var items=d.data||[];
var bar=el('storiesBar');if(!bar)return;
var h='<div onclick="storyInputEl.click()" style="min-width:70px;display:flex;flex-direction:column;align-items:center;cursor:pointer"><div style="width:60px;height:60px;border-radius:50%;border:2px dashed var(--acc);display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--acc)">+</div><span style="font-size:10px;color:var(--mut);margin-top:4px">حالتي</span></div>';
items.forEach(function(s){
var u=usersCache[s.author];
var ava=(u&&u.avatar)?'<img src="'+u.avatar+'" style="width:100%;height:100%;object-fit:cover">':(u&&u.gender==='أنثى'?'👩':'👨');
h+='<div onclick="viewStory(\''+s.id+'\')" style="min-width:70px;display:flex;flex-direction:column;align-items:center;cursor:pointer"><div style="width:60px;height:60px;border-radius:50%;border:3px solid var(--grn);padding:2px;overflow:hidden;background:var(--card2)">'+ava+'</div><span style="font-size:10px;color:var(--txt);margin-top:4px;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escapeHtml(getMsgName(s.author))+'</span><span style="font-size:9px;color:var(--mut)">'+timeLeft(s.stime)+'</span></div>';
});
bar.innerHTML=h;
}catch(e){}
}
async function viewStory(id){
var d=await sb.from('stories').select('*').eq('id',id).limit(1);
if(!d.data||!d.data[0])return;
var s=d.data[0];
var u=usersCache[s.author];
var box=el('storyViewBox');
var prog='<div style="height:3px;background:rgba(255,255,255,.3);border-radius:2px;overflow:hidden;margin:10px"><div id="storyProgBar" style="height:100%;background:#fff;animation:storyProg 6s linear forwards"></div></div>';
var head='<div style="display:flex;align-items:center;gap:10px;padding:0 12px 8px"><div style="width:40px;height:40px;border-radius:50%;background:var(--card2);overflow:hidden">'+((u&&u.avatar)?'<img src="'+u.avatar+'" style="width:100%;height:100%;object-fit:cover">':(u&&u.gender==='أنثى'?'👩':'👨'))+'</div><div style="flex:1"><div style="color:#fff;font-weight:bold;font-size:14px">'+escapeHtml(getMsgName(s.author))+'</div><div style="color:rgba(255,255,255,.7);font-size:11px">'+timeAgo(s.stime)+' • باقي '+timeLeft(s.stime)+'</div></div>'+((s.author===me.name)?'<button onclick="deleteMyStory(\''+s.id+'\')" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:15px">🗑️</button>':'')+'<button onclick="closeModal(\'storyViewModal\')" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:15px">✕</button></div>';
var mediaHtml=(s.stype==='video')?'<video id="storyVideo" src="'+s.img+'" style="max-width:100%;max-height:100%" controls autoplay playsinline></video>':'<img src="'+s.img+'" style="max-width:100%;max-height:100%;object-fit:contain">';
box.innerHTML=prog+head+'<div style="flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden">'+mediaHtml+'</div>';
openModal('storyViewModal');
setTimeout(function(){var m=el('storyViewModal');if(m.classList.contains('open'))closeModal('storyViewModal');},6200);
}
async function sendStoryReply(author){
var inp=el('storyReplyInput');var text=inp?(inp.value||'').trim():'';
if(!text)return toast('اكتب ردك الأول');
if(author===me.name)return;
if(isBlockedByOther(author))return toast('⛔ تم حظرك من هذا المستخدم');
var convId=[me.name,author].sort().join('_');
var m={_id:'m'+Date.now()+Math.random().toString(36).slice(2),_conv:convId,from:me.name,data:'📸 رد على حالتك: '+text,type:'text',time:Date.now(),replyTo:null,edited:false,deleted:false,read:false,reactions:{}};
await SDB.addMsg(m);
await SDB.upsertConv(convId,{a:me.name,b:author,t:Date.now(),lastFrom:me.name,lastMsg:m.data});
toast('تم إرسال ردك كرسالة خاصة ✅');
closeModal('storyViewModal');
}
function showUpBar(show){var bar=el('uploadBar'),w=el('uploadPctWrap');if(!bar)return;if(show){bar.style.display='block';if(w)w.style.display='block';setUpBar(0);}else{bar.style.display='none';if(w)w.style.display='none';}}
function setUpBar(pct){var f=el('uploadFill'),t=el('uploadTxt');if(f)f.style.width=pct+'%';if(t)t.innerText=pct+'%';}
function dataURLtoBlob(dataURL){var arr=dataURL.split(','),mime=arr[0].match(/:(.*?);/)[1],bstr=atob(arr[1]),n=bstr.length,u8=new Uint8Array(n);while(n--){u8[n]=bstr.charCodeAt(n);}return new Blob([u8],{type:mime});}
async function uploadStoryFile(f){showUpBar(true);return new Promise(function(resolve){var ext='';try{ext=f.name&&f.name.lastIndexOf('.')>-1?f.name.slice(f.name.lastIndexOf('.')):'';}catch(e){}var fname='st_'+Date.now()+'_'+Math.floor(Math.random()*999)+ext;var fake=0;var timer=setInterval(function(){fake=Math.min(fake+Math.random()*7,92);setUpBar(Math.floor(fake));},250);sb.storage.from('stories').upload(fname,f,{cacheControl:'86400',upsert:false}).then(function(r){clearInterval(timer);if(r.error){console.error(r.error);showUpBar(false);resolve(null);return;}setUpBar(100);setTimeout(function(){showUpBar(false);},400);var pub=sb.storage.from('stories').getPublicUrl(fname);resolve(pub.data.publicUrl);});});}
async function deleteStoryFile(url){try{var path=url.split('/stories/')[1];if(path)sb.storage.from('stories').remove([path]);}catch(e){}}
async function deleteMyStory(id){if(!confirm('حذف حالتك؟'))return;var d=await sb.from('stories').select('*').eq('id',id).limit(1);if(d.data&&d.data[0])deleteStoryFile(d.data[0].img);await sb.from('stories').delete().eq('id',id);closeModal('storyViewModal');renderStories();toast('تم الحذف');}
var storyInputEl=document.createElement('input');
storyInputEl.type='file';storyInputEl.accept='image/*,video/*';storyInputEl.style.display='none';
storyInputEl.onchange=function(e){
var f=e.target.files[0];if(!f)return;
compressImg(f,function(dataUrl){
var sid='st'+Date.now()+Math.floor(Math.random()*999);
sb.from('stories').insert({id:sid,author:me.name,img:dataUrl,stime:Date.now()}).then(function(r){
if(r.error)return toast('خطأ: '+r.error.message);
toast('تم نشر حالتك ✅ ستختفي بعد 24 ساعة');
renderStories();
});
});
e.target.value='';
};
document.body.appendChild(storyInputEl);
function showPassEdit(){var w=el('passEditWrap');if(!w)return;if(w.style.display==='none'){w.style.display='block';el('oldPass').value='';el('newPass').value='';}else w.style.display='none';}
function cancelChangePass(){el('passEditWrap').style.display='none';}
async function doChangePass(){
var op=el('oldPass').value,np=el('newPass').value;
if(!op||!np)return toast('املأ الحقلين');
var saved=await SDB.getPassword(me.name);
if(saved&&saved!==op)return toast('كلمة السر الحالية غلط ❌');
await SDB.setPassword(me.name,np);
toast('تم تغيير كلمة السر بنجاح ✅');
el('passEditWrap').style.display='none';
}
function showAgeEdit(){var w=el('ageEditWrap');if(!w)return;if(w.style.display==='none'){w.style.display='block';el('newAge').value=me.age||'';}else w.style.display='none';}
function cancelChangeAge(){el('ageEditWrap').style.display='none';}
async function doChangeAge(){
var av=parseInt(el('newAge').value);
if(!av||av<16||av>100)return toast('⚠️ العمر لازم يكون من 16 لـ 100');
await updateMe({age:String(av)});
await SDB.saveUser(me.name,me);
el('setDetails').innerText=(me.age||'--')+' • '+(me.gender||'')+' • '+(me.country||'');
el('ageEditWrap').style.display='none';
toast('تم تحديث عمرك ✅');
}
async function logActivity(action,details){try{await SDB.addLog({action:action,details:details,time:Date.now(),by_user:me?me.name:''});}catch(e){}}
async function logLogin(u){try{await SDB.addLog({action:'login',details:u.name+' دخل من '+deviceType()+' / '+browserName(),time:Date.now(),by_user:u.name});await sb.from('device_logins').insert({device_id:deviceId(),name:u.name,ip:myIP,utime:Date.now()});}catch(e){}}

function initTextColors(){
  var solids=[{c:'#f5f0e8',n:'أبيض دافئ'},{c:'#ffffff',n:'أبيض'},{c:'#e65c00',n:'برتقالي'},{c:'#ff9f43',n:'برتقالي فاتح'},{c:'#f1c40f',n:'ذهبي'},{c:'#2ecc71',n:'أخضر'},{c:'#3498db',n:'أزرق'},{c:'#9b59b6',n:'بنفسجي'},{c:'#e74c3c',n:'أحمر'},{c:'#1abc9c',n:'تركواز'},{c:'#ecf0f1',n:'رمادي فاتح'},{c:'#bdc3c7',n:'رمادي'},{c:'#95a5a6',n:'رمادي'},{c:'#7f8c8d',n:'رمادي متوسط'},{c:'#636e72',n:'رمادي داكن'},{c:'#2d3436',n:'رمادي غامق'},{c:'#000000',n:'أسود'},{c:'#ff6b6b',n:'أحمر فاتح'},{c:'#ee5a24',n:'أحمر برتقالي'},{c:'#c0392b',n:'أحمر داكن'},{c:'#b71540',n:'أحمر عنابي'},{c:'#e84393',n:'وردي فاتح'},{c:'#fd79a8',n:'وردي'},{c:'#e91e63',n:'وردي غامق'},{c:'#c2185b',n:'وردي داكن'},{c:'#f39c12',n:'برتقالي ذهبي'},{c:'#e67e22',n:'برتقالي داكن'},{c:'#ff6348',n:'برتقالي أحمر'},{c:'#ffa502',n:'برتقالي صفراوي'},{c:'#f9ca24',n:'أصفر فاتح'},{c:'#ffd32a',n:'أصفر'},{c:'#ffb142',n:'أصفر برتقالي'},{c:'#27ae60',n:'أخضر'},{c:'#00b894',n:'أخضر زمردي'},{c:'#00cec9',n:'سماوي'},{c:'#6ab04c',n:'أخضر زرعي'},{c:'#badc58',n:'أخضر باهت'},{c:'#10ac84',n:'أخضر غامق'},{c:'#2980b9',n:'أزرق داكن'},{c:'#0984e3',n:'أزرق سماوي'},{c:'#74b9ff',n:'أزرق فاتح'},{c:'#a29bfe',n:'أزرق بنفسجي'},{c:'#6c5ce7',n:'نيلي'},{c:'#4834d4',n:'نيلي داكن'},{c:'#8e44ad',n:'بنفسجي داكن'},{c:'#a55eea',n:'بنفسجي فاتح'},{c:'#8854d0',n:'بنفسجي متوسط'},{c:'#6F1E51',n:'بنفسجي غامق'},{c:'#be2edd',n:'بنفسجي وردي'},{c:'#d35400',n:'بني برتقالي'},{c:'#e17055',n:'سلمون'},{c:'#fab1a0',n:'بيج'},{c:'#81ecec',n:'أزرق سماوي فاتح'},{c:'#dfe6e9',n:'رمادي أزرق'}];
  var grads=[{g:'linear-gradient(90deg,#e65c00,#ff9f43)',n:'برتقالي'},{g:'linear-gradient(90deg,#f1c40f,#e65c00)',n:'ذهبي-برتقالي'},{g:'linear-gradient(90deg,#e74c3c,#e65c00)',n:'أحمر-برتقالي'},{g:'linear-gradient(90deg,#9b59b6,#e65c00)',n:'بنفسجي-برتقالي'},{g:'linear-gradient(90deg,#3498db,#2ecc71)',n:'أزرق-أخضر'},{g:'linear-gradient(90deg,#e65c00,#9b59b6)',n:'برتقالي-بنفسجي'},{g:'linear-gradient(90deg,#ffffff,#e65c00)',n:'أبيض-برتقالي'},{g:'linear-gradient(90deg,#f1c40f,#e74c3c)',n:'ذهبي-أحمر'},{g:'linear-gradient(90deg,#e74c3c,#e91e63)',n:'أحمر-وردي'},{g:'linear-gradient(90deg,#0984e3,#6c5ce7)',n:'أزرق-نيلي'},{g:'linear-gradient(90deg,#00b894,#00cec9)',n:'أخضر-سماوي'},{g:'linear-gradient(90deg,#ff6b6b,#ffd32a)',n:'أحمر-أصفر'},{g:'linear-gradient(90deg,#a55eea,#fd79a8)',n:'بنفسجي-وردي'},{g:'linear-gradient(90deg,#2ecc71,#3498db)',n:'أخضر-أزرق'},{g:'linear-gradient(90deg,#e84393,#ff9f43)',n:'وردي-برتقالي'},{g:'linear-gradient(90deg,#6c5ce7,#a29bfe)',n:'نيلي-بنفسجي'},{g:'linear-gradient(90deg,#ff6348,#ffa502)',n:'ناري'},{g:'linear-gradient(90deg,#00cec9,#74b9ff)',n:'سماوي-أزرق'},{g:'linear-gradient(90deg,#be2edd,#e84393)',n:'بنفسجي-وردي غامق'},{g:'linear-gradient(90deg,#f9ca24,#6ab04c)',n:'أصفر-أخضر'},{g:'linear-gradient(90deg,#c0392b,#8e44ad)',n:'أحمر-بنفسجي'},{g:'linear-gradient(90deg,#1abc9c,#3498db)',n:'تركواز-أزرق'},{g:'linear-gradient(90deg,#e65c00,#f1c40f,#2ecc71)',n:'قوس قزح'},{g:'linear-gradient(90deg,#e74c3c,#e65c00,#f1c40f)',n:'غروب'},{g:'linear-gradient(90deg,#3498db,#6c5ce7,#e84393)',n:'أزرق-بنفسجي-وردي'},{g:'linear-gradient(90deg,#ff6b6b,#ffd32a,#6ab04c)',n:'ناري-ذهبي-أخضر'},{g:'linear-gradient(90deg,#0984e3,#00cec9,#00b894)',n:'محيط'},{g:'linear-gradient(90deg,#e84393,#be2edd,#6c5ce7)',n:'وردي-بنفسجي-نيلي'},{g:'linear-gradient(90deg,#ffd32a,#ff6348,#e74c3c)',n:'ذهبي-ناري'}];
  var solidBox=el('solidColors');if(solidBox){solidBox.innerHTML='';solids.forEach(function(s){var btn=document.createElement('div');btn.style.cssText='width:42px;height:42px;border-radius:50%;background:'+s.c+';border:2px solid var(--line);cursor:pointer';btn.title=s.n;btn.onclick=function(){setTextColor(s.c);};solidBox.appendChild(btn);});}
  var gradBox=el('gradColors');if(gradBox){gradBox.innerHTML='';grads.forEach(function(g){var btn=document.createElement('div');btn.style.cssText='width:70px;height:36px;border-radius:8px;background:'+g.g+';border:2px solid var(--line);cursor:pointer';btn.title=g.n;btn.onclick=function(){setNameGradient(g.g);};gradBox.appendChild(btn);});}
  var nameSolidBox=el('nameSolidColors');if(nameSolidBox){nameSolidBox.innerHTML='';solids.forEach(function(s){var btn=document.createElement('div');btn.style.cssText='width:42px;height:42px;border-radius:50%;background:'+s.c+';border:2px solid var(--line);cursor:pointer';btn.title=s.n;btn.onclick=function(){setNameColor(s.c);};nameSolidBox.appendChild(btn);});}
}
function setTextColor(color){document.documentElement.style.setProperty('--txt',color);updateMe({textColor:color});toast('تم تغيير لون النص');}
function setNameColor(color){var preview=el('namePreview');if(preview){preview.style.background='';preview.style.webkitBackgroundClip='';preview.style.backgroundClip='';preview.style.color=color;}updateMe({nameGradient:null,nameColor:color});toast('تم تغيير لون الاسم');}
function setNameGradient(grad){var preview=el('namePreview');if(preview){preview.style.background=grad;preview.style.webkitBackgroundClip='text';preview.style.backgroundClip='text';preview.style.color='transparent';}updateMe({nameGradient:grad});toast('تم تغيير تدرج الاسم');}
function applyTextColors(){if(!me)return;if(me.textColor)document.documentElement.style.setProperty('--txt',me.textColor);}
var allFrames=[];
function compressFrame(file,cb){
var reader=new FileReader();
  /* ============================================================
   ⚡ شات سونيك — script.js (الجزء 2: الإطارات + المراقبة + الألعاب + الستوريز + باتشات سونيك)
   ============================================================ */
reader.onload=function(e){var img=new Image();img.onload=function(){var canvas=document.createElement('canvas');var maxW=300;var w=img.width,h=img.height;if(w>maxW){h=Math.max(1,(maxW/w)*h);w=maxW;}canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);cb(canvas.toDataURL('image/png'));};img.src=e.target.result;};
reader.readAsDataURL(file);
}
async function initFrames(){
var grid=el('framesGrid');if(!grid)return;
grid.innerHTML='<div style="text-align:center;color:var(--mut);grid-column:1/-1">جاري التحميل...</div>';
var d=await sb.from('frames').select('*').order('id',{ascending:true});
if(d.error){grid.innerHTML='<div style="text-align:center;color:var(--red);grid-column:1/-1">خطأ: '+d.error.message+'</div>';return;}
allFrames=d.data||[];
if(allFrames.length===0){
grid.innerHTML='<div style="text-align:center;color:var(--mut);grid-column:1/-1;padding:20px;margin-bottom:10px">لا توجد إطارات حالياً</div><div style="background:var(--card2);border:2px dashed var(--line);border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:32px;min-height:110px;color:var(--acc)" onclick="document.getElementById(\'frameInput\').click()">➕</div>';
return;
}
var h='';
allFrames.forEach(function(fr){
var sel=(me&&me.frame===fr.url);
h+='<div style="position:relative;background:var(--card2);border:2px solid '+(sel?'var(--grn)':'var(--line)')+';border-radius:12px;padding:12px 8px;text-align:center;cursor:pointer" onclick="setFrame(\''+fr.url.replace(/'/g,"\\'")+'\')"><div style="width:70px;height:70px;margin:0 auto 6px;position:relative"><div class="u-ava" style="width:42px;height:42px;position:absolute;top:14px;left:14px;z-index:1">👨</div><img src="'+fr.url+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:2" onerror="this.style.display=\'none\'"></div>'+(sel?'<div style="font-size:10px;color:var(--grn);font-weight:bold">✅ مُعيّن</div>':'')+'<button class="xbtn" style="position:absolute;top:4px;left:4px;padding:2px 6px;font-size:10px" onclick="event.stopPropagation();delFrame('+fr.id+')">✕</button></div>';
});
h+='<div style="background:var(--card2);border:2px dashed var(--line);border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:32px;min-height:110px;color:var(--acc)" onclick="document.getElementById(\'frameInput\').click()">➕</div>';
grid.innerHTML=h;
}
async function delFrame(id){if(!confirm('حذف الإطار من القائمة؟'))return;var r=await sb.from('frames').delete().eq('id',id);if(r.error)return toast('خطأ: '+r.error.message);initFrames();toast('تم الحذف');}
async function setFrame(url){
if(!isAdmin()&&!isOwner())return toast('للإدارة فقط');
await updateMe({frame:url||null});
try{
var fresh=await SDB.getUser(me.name);
if(fresh){me=Object.assign({},me,fresh);usersCache[me.name]=me;}
}catch(e){}
toast(url?'تم تعيين الإطار ✅':'تم إزالة الإطار');
updateProfile();renderOnline();initFrames();
}
function handleFrameUpload(e){
var f=e.target.files[0];if(!f)return;
if(f.size>500000)return toast('⚠️ حجم الإطار كبير جداً (نصف ميجا)');
compressFrame(f,function(dataUrl){
sb.from('frames').insert({url:dataUrl}).then(function(r){
if(r.error)return toast('خطأ: '+r.error.message);
toast('تمت إضافة الإطار ✅');initFrames();
});
});
e.target.value='';
}

// ================================================================
// ⚡ المراقبة
// ================================================================
async function renderMonitor(){
  if(!isOwner()){el('monitorList').innerHTML='<div style="text-align:center;color:var(--mut);padding:20px">لصاحب الموقع فقط</div>';return;}
  var q=(el('monSearch')?el('monSearch').value.trim().toLowerCase():'');
  el('monitorList').innerHTML='<div style="text-align:center;color:var(--mut);padding:20px">جاري التحميل...</div>';
  var rows=await SDB.loadConvs();
  rows.sort(function(a,b){return(b.t||0)-(a.t||0);});
  var h='';
  for(var i=0;i<Math.min(rows.length,80);i++){
    var c=rows[i];
    if(q&&String(c.user_a).toLowerCase().indexOf(q)===-1&&String(c.user_b).toLowerCase().indexOf(q)===-1)continue;
    h+='<div class="m-card" style="cursor:pointer" onclick="spyConv(\''+c.id.replace(/'/g,"\\'")+'\',\''+String(c.user_a).replace(/'/g,"\\'")+'\',\''+String(c.user_b).replace(/'/g,"\\'")+'\')"><div class="m-name">'+escapeHtml(c.user_a)+' ↔️ '+escapeHtml(c.user_b)+'</div><div class="m-last">'+escapeHtml(String(c.last_msg||'...').substring(0,40))+' • '+timeAgo(c.t||Date.now())+'</div></div>';
  }
  el('monitorList').innerHTML=h||'<div style="text-align:center;color:var(--mut);padding:15px">لا توجد محادثات</div>';
}
async function spyConv(convId,a,b){
  if(!isOwner())return toast('لصاحب الموقع فقط');
  el('monChatHead').innerText='محادثة: '+a+' ↔️ '+b;
  el('monChatBox').innerHTML='<div style="text-align:center;color:var(--mut);padding:20px">جاري التحميل...</div>';
  var msgs=await SDB.loadMsgs(convId,100);
  if(!msgs.length){el('monChatBox').innerHTML='<div style="text-align:center;color:var(--mut);padding:20px">لا توجد رسائل</div>';return;}
  var h='';
  msgs.forEach(function(m){
    if(m.deleted){h+='<div style="padding:6px 0;border-bottom:1px solid var(--line);color:var(--mut);font-size:12px">[رسالة محذوفة]</div>';return;}
    var content='';
    if(m.type==='image')content='<img src="'+m.data+'" style="max-width:170px;border-radius:8px;margin-top:4px">';
    else if(m.type==='audio')content='<audio controls src="'+m.data+'" style="width:190px;margin-top:4px"></audio>';
    else if(m.type==='sticker')content='<img src="'+m.data+'" style="width:65px;height:65px;object-fit:contain;margin-top:4px">';
    else content=escapeHtml(String(m.data||''));
    h+='<div style="padding:8px 0;border-bottom:1px solid var(--line)"><b style="color:var(--acc)">'+escapeHtml(m.from||'?')+'</b> <span style="font-size:11px;color:var(--mut)">'+timeAgo(m.time)+'</span><div style="margin-top:3px;word-break:break-word">'+content+'</div></div>';
  });
  el('monChatBox').innerHTML=h;
  el('monChatBox').scrollTop=el('monChatBox').scrollHeight;
}
async function renderNicks(){
if(!isOwner()){el('nicksList').innerHTML='<div style="text-align:center;color:var(--mut);padding:20px">لصاحب الموقع فقط</div>';return;}
el('nicksList').innerHTML='<div style="text-align:center;color:var(--mut);padding:20px">جاري التحميل...</div>';
var d=await sb.from('device_logins').select('*').order('utime',{ascending:false}).limit(500);
if(d.error){el('nicksList').innerHTML='<div style="text-align:center;color:var(--red);padding:20px">خطأ: '+d.error.message+'</div>';return;}
var rows=d.data||[];
var groups={};
rows.forEach(function(r){
if(!groups[r.device_id])groups[r.device_id]={dev:r.device_id,ip:r.ip,names:[],last:0};
if(groups[r.device_id].names.indexOf(r.name)===-1)groups[r.device_id].names.push(r.name);
if(r.utime>groups[r.device_id].last)groups[r.device_id].last=r.utime;
});
var q=el('nicksSearch')?el('nicksSearch').value.trim().toLowerCase():'';
var h='';
for(var dev in groups){
var g=groups[dev];
if(q&&dev.toLowerCase().indexOf(q)===-1&&!g.names.some(function(n){return n.toLowerCase().indexOf(q)>-1;}))continue;
var suspicious=g.names.length>1?'<span style="color:var(--red);font-size:10px">⚠️ '+g.names.length+' أسماء</span>':'<span style="color:var(--grn);font-size:10px">✅ اسم واحد</span>';
h+='<div class="adm-sec"><h4>📱 '+escapeHtml(dev)+' '+suspicious+'</h4><p style="font-size:11px;color:var(--mut);margin-bottom:8px">IP: '+escapeHtml(g.ip||'?')+' • آخر دخول: '+timeAgo(g.last)+'</p>';
g.names.forEach(function(n){
h+='<div class="log-row" style="display:flex;justify-content:space-between;align-items:center"><b>'+escapeHtml(n)+'</b><button class="ebtn" onclick="openUser(\''+n.replace(/'/g,"\\'")+'\')">💬</button></div>';
});
h+='</div>';
}
el('nicksList').innerHTML=h||'<div style="text-align:center;color:var(--mut);padding:20px">لا توجد بيانات</div>';
}

// ================================================================
// الحظر والبدء
// ================================================================
function openOX(){openModal('oxModal');showOXHome();}
function showOXHome(){el('oxHome').style.display='block';el('oxUsers').style.display='none';}
function showOXInviteList(){
var box=el('oxUsersList');var h='';var list=[];
for(var k in usersCache){var u=usersCache[k];if(u.name===me.name)continue;if(isBlockedByMe(u.name))continue;if(!isOnline(u)&&!isOwnerName(u.name))continue;list.push(u);}
if(!list.length){box.innerHTML='<div style="text-align:center;color:var(--mut);padding:15px;font-size:12px">لا يوجد مستخدمين متصلين</div>';}
else{list.forEach(function(u){h+='<div class="u-card" style="margin-bottom:6px" onclick="sendGameInvite(\''+u.name.replace(/'/g,"\\'")+'\')">'+getAvatarHTML(u,36)+'<div style="flex:1"><div class="u-name" style="font-size:13px">'+styleName(u)+'</div></div><span style="font-size:16px">📨</span></div>';});box.innerHTML=h;}
el('oxHome').style.display='none';el('oxUsers').style.display='block';
}
async function sendGameInvite(n){
closeModal('oxModal');
toast('⏳ تم إرسال الدعوة لـ '+getMsgName(n));
var r=await sb.from('game_invites').insert({game:'ox',from_user:me.name,to_user:n,status:'pending',ctime:Date.now()});
if(r.error)toast('خطأ: '+r.error.message);
}
var pendingInviteId=null;
function showGameInviteModal(row){
pendingInviteId=row.id;
el('giFrom').innerText=getMsgName(row.from_user);
openModal('gameInviteModal');
if(me.sndNotif!==false)beep(1000);
}
async function respondInvite(status){
closeModal('gameInviteModal');
if(!pendingInviteId)return;
if(status==='accepted')toast('✅ تم قبول التحدي 🎮');
else toast('❌ تم رفض التحدي');
await sb.from('game_invites').update({status:status}).eq('id',pendingInviteId);
pendingInviteId=null;
}
function subGameInvites(){
if(SDB.subs.games)return;
SDB.subs.games=sb.channel('rt-games')
.on('postgres_changes',{event:'*',schema:'public',table:'game_invites'},function(payload){
if(!me)return;
var row=payload.new;if(!row)return;
if(payload.eventType==='INSERT'&&row.to_user===me.name&&row.status==='pending'){showGameInviteModal(row);}
if(payload.eventType==='UPDATE'&&row.from_user===me.name){
if(row.status==='accepted')toast('🎮 تم قبول التحدي! '+row.to_user+' قبل يلعب معاك');
else if(row.status==='refused')toast('😔 '+row.to_user+' رفض اللعب معك');
}
}).subscribe();
}

/* ===== الحضور الفوري (visibility) ===== */
function _markGone(){
  if(!me)return;
  var oldTime = Date.now();
  try{
    fetch(SUPABASE_URL+'/rest/v1/users?name=eq.'+encodeURIComponent(me.name),{
      method:'PATCH',
      headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({last_seen:oldTime}),
      keepalive:true
    });
  }catch(e){}
  if(usersCache[me.name])usersCache[me.name].lastSeen = oldTime;
}
function _markBack(){
  if(!me)return;
  try{sb.from('users').update({last_seen:Date.now()}).eq('name',me.name);}catch(e){}
  if(usersCache[me.name])usersCache[me.name].lastSeen=Date.now();
  renderOnline();
}
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='hidden')_markGone();else _markBack();
});
window.addEventListener('pagehide',_markGone);
window.addEventListener('beforeunload',_markGone);

async function toggleHide(v){
await updateMe({hidden:v});
toast(v?'🕶️ أنت مخفي الآن من قائمة المتصلين':'✅ أنت ظاهر للمستخدمين');
renderOnline();
}
async function checkDeviceOrIPBan(){
  try{
    var bans=await SDB.loadBans();
    var dev=deviceId();
    var hit=bans.find(function(b){return b.target===myIP||b.target===dev;});
    if(hit)forceBanScreen();
  }catch(e){}
}
function forceBanScreen(){
  if(hbTimer){clearInterval(hbTimer);hbTimer=null;}
  unsubscribeAll();
  me=null;usersCache={};convsCache=[];msgsCache=[];chat=null;navStack=[];
  LS.removeItem('session');
  el('loginModal').classList.add('hide');
  el('blockOverlay').classList.remove('hide');
}

function setThemeColor(bg,acc){document.documentElement.style.setProperty('--bg',bg);document.documentElement.style.setProperty('--acc',acc);document.documentElement.style.setProperty('--card',shadeColor(bg,12));document.documentElement.style.setProperty('--card2',shadeColor(bg,6));LS.setItem('theme_bg',bg);LS.setItem('theme_acc',acc);toast('تم تغيير لون المظهر');}
function shadeColor(hex,percent){try{var num=parseInt(hex.replace('#',''),16);var r=Math.min(255,Math.max(0,(num>>16)+percent));var g=Math.min(255,Math.max(0,((num>>8)&0x00FF)+percent));var b=Math.min(255,Math.max(0,(num&0x0000FF)+percent));return '#'+(0x1000000+(r<<16)+(g<<8)+b).toString(16).slice(1);}catch(e){return hex;}}
function forceRepaint(){document.body.style.webkitTransform='translateZ(0)';void document.body.offsetHeight;setTimeout(function(){document.body.style.webkitTransform='';},80);}
function setPageBg(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(ev){LS.setItem('page_bg',ev.target.result);applyPageBg();forceRepaint();toast('تم تعيين خلفية الصفحة');};r.readAsDataURL(f);e.target.value='';}
function clearPageBg(){LS.removeItem('page_bg');applyPageBg();toast('تم إزالة خلفية الصفحة');}
function setPageDim(v){LS.setItem('page_dim',v);applyPageBg();}
function applyPageBg(){var bg=LS.getItem('page_bg');var dim=(LS.getItem('page_dim')||40)/100;if(!bg)bg='https://cdn.phototourl.com/free/2026-09-18-fb7fe613-5e96-4c2a-ab72-b4f4cc12f7fb.jpg';document.body.style.backgroundImage='linear-gradient(rgba(0,0,0,'+dim+'),rgba(0,0,0,'+dim+')),url('+bg+')';document.body.style.backgroundSize='cover';document.body.style.backgroundPosition='center';document.body.style.backgroundAttachment='scroll';}
(function(){var bg=LS.getItem('theme_bg');var acc=LS.getItem('theme_acc');if(bg&&acc)setThemeColor(bg,acc);applyPageBg();})();

fillCountries();
fetch('https://api.ipify.org?format=json').then(function(r){return r.json();}).then(function(data){if(data&&data.ip){myIP=data.ip;checkDeviceOrIPBan();}}).catch(function(){});

var savedDim=LS.getItem('chat_dim');if(savedDim){el('dimRange').value=savedDim;setDim(savedDim);}

var saved=LS.getItem('session');
if(saved){
  SDB.getUser(saved).then(function(u){
    if(u&&!u.banned){
      me=u;usersCache[u.name]=u;
      el('loginModal').classList.add('hide');
      applyPrefsUI();updateProfile();
      me.dev=deviceId();me.dtype=deviceType();me.browser=browserName();me.ip=myIP;me.lastSeen=Date.now();
      SDB.saveUser(me.name,me);
      logLogin(me);
      startHeartbeat();
      startAll();
      checkDeviceOrIPBan();
    }else{
      LS.removeItem('session');
    }
  });
}

(async function(){
  try{
    var s=await SDB.loadSettings();
    var g=s.global||{};
    if(g.bannedWords)el('badWords').value=g.bannedWords.join('\n');
    if(g.blockLinks)el('siteBlockLinks').checked=true;
  }catch(e){}
})();

/* ===== سحب للرد + دبل تاب للرياكشن (زي واتساب) ===== */
(function(){
var rBar=document.createElement('div');
rBar.style.cssText='position:fixed;bottom:90px;left:50%;transform:translateX(-50%);display:none;gap:12px;z-index:4000;box-shadow:0 6px 20px rgba(0,0,0,.55);transition:transform .25s ease;align-items:center';
var rId=null;
function hideRB(){rBar.style.display='none';}
function showRB(id){if(!el('s-chat')||!el('s-chat').classList.contains('active'))return;rId=id;rBar.style.display='flex';clearTimeout(rBar._t);rBar._t=setTimeout(hideRB,5000);}
['👍','❤️','😂','😮','😢','🙏'].forEach(function(em){
var b=document.createElement('button');
b.style.cssText='background:none;border:none;font-size:26px;cursor:pointer;padding:2px';
b.onclick=function(){hideRB();if(rId)toggleReaction(rId,em);};
rBar.appendChild(b);
});
var xb=document.createElement('button');
xb.style.cssText='background:none;border:none;color:var(--mut);font-size:15px;cursor:pointer';
rBar.innerHTML='';['\uD83D\uDC4D','\u2764\uFE0F','\uD83D\uDE02','\uD83D\uDE2E','\uD83D\uDE22','\uD83D\uDE4F'].forEach(function(em2){var eb=document.createElement('button');eb.style.cssText='background:none;border:none;font-size:26px;cursor:pointer;padding:2px';eb.textContent=em2;eb.onclick=function(){hideRB();if(rId)toggleReaction(rId,em2);};rBar.appendChild(eb);});var xb2=document.createElement('button');xb2.style.cssText='background:none;border:none;color:var(--mut);font-size:15px;cursor:pointer';xb2.textContent='\u2715';xb2.onclick=hideRB;
rBar.appendChild(xb);
document.body.appendChild(rBar);
function replyById(id){var m=msgsCache.find(function(x){return x._id===id;});if(!m)return;replyTo=id;el('replyBar').classList.add('open');el('replyName').innerText=getMsgName(m.from);el('replyText').innerHTML=replyPreviewHTML(m,true);el('msgInput').focus();}
var tsx=0,tsy=0,tst=0,cur=null,lastTap=0,lastTapId=null;
var box=el('chatBox');
if(!box)return;
box.addEventListener('touchstart',function(e){
if(e.target.closest&&e.target.closest('.msg-actions')){cur=null;return;}
var t=e.touches[0];tsx=t.clientX;tsy=t.clientY;tst=Date.now();
cur=e.target.closest?e.target.closest('.bub'):null;
},{passive:true});
box.addEventListener('touchend',function(e){
if(!cur)return;
var t=e.changedTouches[0];
var dx=t.clientX-tsx,dy=t.clientY-tsy,dt=Date.now()-tst;
var id=cur.getAttribute('data-id');
if(dt<400&&Math.abs(dx)>70&&Math.abs(dy)<50){replyById(id);cur=null;return;}
if(dt<300&&Math.abs(dx)<12&&Math.abs(dy)<12){
var now=Date.now();
if(lastTapId===id&&now-lastTap<400){showRB(id);lastTap=0;lastTapId=null;}
else{lastTap=now;lastTapId=id;}
}
cur=null;
},{passive:true});
})();

/* ===== إيقاف فيديو/صوت الحالة فورًا عند الخروج ===== */
var _origCloseModal=closeModal;
closeModal=function(id){
  if(id==='storyViewModal'){
    try{
      var v=el('storyVideo');
      if(v){try{v.pause();}catch(_e1){}try{v.currentTime=0;}catch(_e2){}try{v.removeAttribute('src');v.load();}catch(_e3){}}
      var box=el('storyViewBox');if(box)box.innerHTML='';
    }catch(e){}
  }
  _origCloseModal(id);
};
var _vsPrev=viewStory;
viewStory=async function(id){
  try{var _old=el('storyVideo');if(_old){try{_old.pause();}catch(_e1){}try{_old.removeAttribute('src');_old.load();}catch(_e2){}}}catch(e){}
  return _vsPrev(id);
};

/* ===== نزول الشات ===== */
var _subPrev=subMsgs;
subMsgs=async function(){
  userScrolledUp=false;
  await _subPrev();
  var b=el('chatBox');if(!b)return;
  b.scrollTop=b.scrollHeight;
  setTimeout(function(){if(!userScrolledUp)b.scrollTop=b.scrollHeight;},150);
  setTimeout(function(){if(!userScrolledUp)b.scrollTop=b.scrollHeight;},500);
  setTimeout(function(){if(!userScrolledUp)b.scrollTop=b.scrollHeight;},1200);
  setTimeout(function(){if(!userScrolledUp)b.scrollTop=b.scrollHeight;},2500);
setTimeout(function(){if(!userScrolledUp)b.scrollTop=b.scrollHeight;},4000);
};
el('chatBox').addEventListener('load',function(e){if(e.target&&e.target.tagName==='IMG'&&!userScrolledUp){var b=el('chatBox');b.scrollTop=b.scrollHeight;}},true);

/* ===== سونيك: الصور الافتراضية + الخلفية + العمر + الرفع + المعاينة + عين المالك ===== */
(function(){
var SONIC='https://cdn.phototourl.com/free/2026-09-18-fb7fe613-5e96-4c2a-ab72-b4f4cc12f7fb.jpg';
function _ageOK(v){var n=parseInt(v);return !isNaN(n)&&n>=16&&n<=100;}
function _sArr(v){return Array.isArray(v)?v:[];}
function _ava60(u){return getAvatar(u||{});}

window._defAva=function(u){return (u&&u.gender==='أنثى')?'https://cdn.phototourl.com/free/2026-09-23-9e2a1f47-8318-4b74-8e74-2a643e156af6.jpg':'https://cdn.phototourl.com/free/2026-09-23-e466167c-d14c-4d49-bf5e-dac6c612bc8e.jpg';};
window.getAvatar=function(u){var _d=_defAva(u);if(u&&u.avatar&&String(u.avatar).length>50)return'<img src="'+u.avatar+'" data-df="'+_d+'" onerror="this.onerror=null;this.src=this.getAttribute(\'data-df\')" style="width:100%;height:100%;object-fit:cover">';return'<img src="'+_d+'" style="width:100%;height:100%;object-fit:cover">';};
var _oupO=window.openUserProfile;
window.openUserProfile=function(name){try{_oupO(name);}catch(e){}var u=usersCache[name];if(u&&!u.avatar){var a=el('upAva');if(a){a.style.display='block';a.src=_defAva(u);}}};

window.applyPageBg=function(){var bg=LS.getItem('page_bg');var dim=(LS.getItem('page_dim')||40)/100;if(!bg)bg=SONIC;document.body.style.backgroundImage='linear-gradient(rgba(0,0,0,'+dim+'),rgba(0,0,0,'+dim+')),url('+bg+')';document.body.style.backgroundSize='cover';document.body.style.backgroundPosition='center';document.body.style.backgroundAttachment='scroll';};

window.loginGuest=async function(){var n=el('gName').value.trim();if(!n)return toast('الرجاء كتابة الاسم المستعار');if(!el('gAge').value)return toast('الرجاء كتابة السن');if(!_ageOK(el('gAge').value))return toast('⚠️ العمر لازم يكون من 16 لـ 100');toast('جاري الدخول...');var u=await SDB.getUser(n);if(u&&u.role!=='زائر')return toast('هذا الاسم مسجل عضوية، ادخل من تبويب الأعضاء');if(!u)u=defPrefs({name:n,age:el('gAge').value,gender:el('gGender').value,country:el('gCountry').value,role:'زائر',is_active:true});u.lastSeen=Date.now();await SDB.saveUser(n,u);enter(u);};
window.loginMember=async function(){var n=el('mName').value.trim(),p=el('mPass').value;if(!n||!p)return toast('الرجاء إدخال الاسم وكلمة المرور');toast('جاري الدخول...');var u=await SDB.getUser(n);if(!u)return toast('هذا الاسم غير مسجل');var savedPass=await SDB.getPassword(n);if(savedPass&&savedPass!==p)return toast('كلمة المرور غير صحيحة');if(!savedPass)await SDB.setPassword(n,p);if(!u.age||u.age==='--'){var ag=prompt('اكتب سنك (من 16 لـ 100):');if(ag){if(!_ageOK(ag))return toast('⚠️ العمر لازم يكون من 16 لـ 100');u.age=String(parseInt(ag));await SDB.saveUser(n,u);}}enter(u);};
window.register=async function(){var n=el('rName').value.trim(),p=el('rPass').value;if(!n)return toast('اكتب اسم العضوية');if(!p)return toast('اكتب كلمة السر (حرف أو رقم واحد على الأقل)');if(!el('rAge').value)return toast('اكتب السن');if(!_ageOK(el('rAge').value))return toast('⚠️ العمر لازم يكون من 16 لـ 100');toast('جاري التسجيل...');var existing=await SDB.getUser(n);if(existing)return toast('تم استخدام هذا الاسم من قبل');var u=defPrefs({name:n,age:String(parseInt(el('rAge').value)),gender:el('rGender').value,country:el('rCountry').value,role:'عضو',is_active:true});await SDB.setPassword(n,p);await SDB.saveUser(n,u);enter(u);};

window.uploadMedia=function(data,ext){
  return new Promise(function(resolve){
    try{
      var blob=(typeof data==='string')?dataURLtoBlob(data):data;
      var fname='chat_'+Date.now()+'_'+Math.floor(Math.random()*9999)+(ext||'.jpg');
      sb.storage.from('stories').upload(fname,blob,{cacheControl:'31536000',upsert:false}).then(function(r){
        if(r.error){console.error('upload err',r.error);resolve(null);return;}
        resolve(sb.storage.from('stories').getPublicUrl(fname).data.publicUrl);
      });
    }catch(e){resolve(null);}
  });
};
window.confirmImage=async function(){
  if(!pendingImg||!chat)return;
  var caption=(el('imgCaption')?el('imgCaption').value.trim():'');
  var convId=curConvId();
  if(caption){
    var cm={_id:'m'+Date.now()+'c'+Math.random().toString(36).slice(2),_conv:convId,from:me.name,data:caption,type:'text',time:Date.now(),replyTo:null,edited:false,deleted:false,read:false,reactions:{}};
    msgsCache.push(cm);appendMsg(cm);
    await SDB.addMsg(cm);
  }
  toast('⏳ جاري إرسال الصورة...');
  var url=await uploadMedia(pendingImg,'.jpg');
  var m={_id:'m'+Date.now()+'i'+Math.random().toString(36).slice(2),_conv:convId,from:me.name,data:url||pendingImg,type:'image',time:Date.now(),replyTo:null,edited:false,deleted:false,read:false,reactions:{}};
  msgsCache.push(m);appendMsg(m);scrollChat();
  await SDB.addMsg(m);
  pendingImg=null;if(el('imgCaption'))el('imgCaption').value='';
  closeModal('imgModal');
  if(chat.type==='user')await SDB.upsertConv(convId,{a:me.name,b:chat.id,t:Date.now(),lastFrom:me.name,lastMsg:caption||'[صورة]'});
};
window.startRec=function(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)return toast('المتصفح لا يدعم التسجيل');
  if(recording)return toast('التسجيل شغال بالفعل');
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
    recCancelled=false;mediaRec=new MediaRecorder(stream);recChunks=[];
    mediaRec.ondataavailable=function(e){if(e.data.size>0)recChunks.push(e.data);};
    mediaRec.onstop=async function(){
      try{stream.getTracks().forEach(function(t){t.stop();});}catch(e){}
      if(recCancelled){recCancelled=false;recChunks=[];return;}
      if(recChunks.length===0||!chat)return;
      var blob=new Blob(recChunks,{type:'audio/webm'});recChunks=[];
      toast('⏳ جاري إرسال التسجيل...');
      var convId=curConvId();
      var url=await uploadMedia(blob,'.webm');
      var data=url;
      if(!data)data=await new Promise(function(res){var r=new FileReader();r.onloadend=function(){res(r.result);};r.readAsDataURL(blob);});
      var m={_id:'m'+Date.now()+'a'+Math.random().toString(36).slice(2),_conv:convId,from:me.name,data:data,type:'audio',time:Date.now(),replyTo:null,edited:false,deleted:false,read:false,reactions:{}};
      msgsCache.push(m);appendMsg(m);scrollChat();
      await SDB.addMsg(m);
      if(chat.type==='user')await SDB.upsertConv(convId,{a:me.name,b:chat.id,t:Date.now(),lastFrom:me.name,lastMsg:'[تسجيل صوتي]'});
    };
    mediaRec.start();recording=true;recStartTime=Date.now();
    el('micBtn').classList.add('rec');el('recBar').style.display='flex';el('stopRecBtn').style.display='inline-block';
    recInterval=setInterval(function(){var diff=Math.floor((Date.now()-recStartTime)/1000);var mm=Math.floor(diff/60),ss=diff%60;el('recTimer').innerText='جاري التسجيل... '+mm+':'+(ss<10?'0'+ss:ss);},1000);
  }).catch(function(err){
    if(err.name==='NotAllowedError'||err.name==='PermissionDeniedError')toast('⚠️ اسمح بالوصول للميكروفون');
    else if(err.name==='NotFoundError')toast('⚠️ لم يتم العثور على ميكروفون');
    else toast('لا يمكن الوصول للمايك');
  });
};

window.replyPreviewHTML=function(m,small){if(!m)return'';if(m.deleted)return'🚫 رسالة محذوفة';if(m.type==='image')return'<img src="'+escapeHtml(m.data)+'" style="max-height:'+(small?'36px':'56px')+';max-width:110px;border-radius:5px;vertical-align:middle;margin-left:4px;display:inline-block"><span style="font-size:11px;opacity:.85">🖼️ صورة</span>';if(m.type==='sticker')return'<img src="'+escapeHtml(m.data)+'" style="height:'+(small?'32px':'45px')+';width:'+(small?'32px':'45px')+';object-fit:contain;vertical-align:middle;margin-left:4px"><span style="font-size:11px;opacity:.85">ستيكر</span>';if(m.type==='audio')return'<span style="font-size:12px">🎤 تسجيل صوتي</span>';return escapeHtml(String(m.data).substring(0,60));};
window.jumpToMsg=function(id){if(!id)return;var t=document.querySelector('[data-id="'+id+'"]');if(!t)return toast('الرسالة الأصلية مش ظاهرة حالياً');t.scrollIntoView({behavior:'smooth',block:'center'});t.style.boxShadow='0 0 0 3px rgba(59,130,246,.95)';setTimeout(function(){t.style.boxShadow='';},1600);};
window.doReply=function(){hideMsgMenu();var m=msgsCache.find(function(x){return x._id===msgMenuId;});if(!m)return;replyTo=msgMenuId;el('replyBar').classList.add('open');el('replyName').innerText=getMsgName(m.from);el('replyText').innerHTML=replyPreviewHTML(m,true);el('msgInput').focus();};

window._ownDelIds=window._ownDelIds||{};
function _ocAll(){try{return JSON.parse(LS.getItem('own_convs')||'{}');}catch(e){return{}}}
function _ocSaveAll(a){try{LS.setItem('own_convs',JSON.stringify(a));}catch(e){}}
function _ocSave(c){if(!c||!c.id||!me)return;var a=_ocAll();a[c.id]={id:c.id,a:c.a||me.name,b:c.b||'',other:c.other||((c.a===me.name)?c.b:(c.b===me.name?c.a:(c.b||''))),delCount:c.delCount||0,lastMsg:c.lastMsg||'',t:c.t||Date.now()};_ocSaveAll(a);}
function _ocRemove(id){var a=_ocAll();if(a[id]){delete a[id];_ocSaveAll(a);}}
function _ocBump(id){var a=_ocAll();var b=a[id];if(!b)return null;b.delCount=(b.delCount||0)+1;b.lastMsg='🚫 الطرف الآخر حذف المحادثة';b.t=Date.now();a[id]=b;_ocSaveAll(a);return b;}
function _ocReinject(){if(!me||!isOwner())return;var a=_ocAll(),add=false;for(var id in a){(function(b){if(b&&!convsCache.find(function(x){return x.id===b.id;})){convsCache.push({id:b.id,a:b.a,b:b.b,t:b.t||0,lastFrom:'',lastMsg:'🚫 الطرف الآخر حذف المحادثة'+(b.delCount>1?' ('+b.delCount+' مرات)':''),other:b.other,delCount:b.delCount||0});add=true;}})(a[id]);}if(add){convsCache.sort(function(x,y){return(y.t||0)-(x.t||0);});updateBadges();}}
var _mBK={},_mBT={};
function _omBk(convId,msg,delId){try{if(!me||!isOwner()||!convId)return;if(!_mBK[convId])_mBK[convId]=JSON.parse(LS.getItem('own_msgs_'+convId)||'[]');var arr=_mBK[convId];if(delId){for(var i=0;i<arr.length;i++)if(arr[i]._id===delId){arr[i].deleted=true;break;}}else if(msg&&msg._id){var cp={_id:msg._id,_conv:convId,from:msg.from,data:String(msg.data==null?'':msg.data).substring(0,20000),type:msg.type||'text',time:msg.time||Date.now(),replyTo:msg.replyTo||null,meta:msg.meta||null,edited:!!msg.edited,deleted:!!msg.deleted,read:!!msg.read};var ex=null;for(var j=0;j<arr.length;j++)if(arr[j]._id===cp._id){ex=arr[j];break;}if(ex){for(var k in cp)ex[k]=cp[k];}else arr.push(cp);if(arr.length>120)arr.splice(0,arr.length-120);}else return;clearTimeout(_mBT[convId]);_mBT[convId]=setTimeout(function(){try{LS.setItem('own_msgs_'+convId,JSON.stringify(_mBK[convId]));}catch(e){}},700);}catch(e){}}
var _amO=window.appendMsg;
window.appendMsg=function(m){try{if(me&&isOwner()&&chat&&chat.type==='user'&&m&&m._id){var cid=curConvId();_omBk(cid,m,null);_ocSave({id:cid,a:me.name,b:chat.id,other:chat.id,t:Date.now()});}}catch(e){}return _amO(m);};
var _umO=window.updateMsg;
window.updateMsg=function(m){try{if(me&&isOwner()&&m&&m._id&&m.deleted)_omBk(m._conv||curConvId(),null,m._id);}catch(e){}return _umO(m);};
var _lmO=SDB.loadMsgs.bind(SDB);
SDB.loadMsgs=async function(convId,limit){var rows=await _lmO(convId,limit);try{if(me&&isOwner()&&convId){if(!_mBK[convId])_mBK[convId]=JSON.parse(LS.getItem('own_msgs_'+convId)||'[]');var bk=_mBK[convId],have={};rows.forEach(function(r){have[r._id]=1;});bk.forEach(function(b){if(!have[b._id])rows.push(b);});}}catch(e){}return rows;};
var _rmO=window.renderMsgs;
window.renderMsgs=function(){try{if(me&&isOwner()){_ocReinject();for(var i=0;i<convsCache.length;i++)if(convsCache[i].other)_ocSave(convsCache[i]);}}catch(e){}return _rmO();};
var _rcO=window.refreshConvs;
window.refreshConvs=async function(){var r=await _rcO();try{if(me&&isOwner())for(var i=0;i<convsCache.length;i++)if(convsCache[i].other)_ocSave(convsCache[i]);}catch(e){}return r;};
var _dcO=SDB.delConv.bind(SDB);
SDB.delConv=function(id){try{window._ownDelIds[id]=1;_ocRemove(id);setTimeout(function(){delete window._ownDelIds[id];},8000);}catch(e){}return _dcO(id);};
function _subOwnWatch(){if(!me||!isOwner())return;if(SDB.subs.ownConvs)return;SDB.subs.ownConvs=sb.channel('rt-own-convs').on('postgres_changes',{event:'DELETE',schema:'public',table:'convs'},function(payload){if(!me||!isOwner())return;var id=payload.old&&payload.old.id;if(!id||window._ownDelIds[id])return;var b=_ocBump(id);if(b){if(!convsCache.find(function(x){return x.id===id;}))convsCache.push({id:b.id,a:b.a,b:b.b,t:b.t||0,lastFrom:'',lastMsg:'🚫 الطرف الآخر حذف المحادثة'+(b.delCount>1?' ('+b.delCount+' مرات)':''),other:b.other,delCount:b.delCount||0});if(el('s-msgs').classList.contains('active'))renderMsgs();}}).subscribe();}
var _saO=window.startAll;
window.startAll=async function(){var r=await _saO();try{_subOwnWatch();}catch(e){}return r;};
window.doDelete=async function(){hideMsgMenu();var m=msgsCache.find(function(x){return x._id===msgMenuId;});if(!m)return;if(m.from!==me.name&&!isAdmin())return toast('لا يمكنك حذف رسالة غيرك');await SDB.updMsg(msgMenuId,{deleted:true});var idx=msgsCache.findIndex(function(x){return x._id===msgMenuId;});if(idx>-1){msgsCache[idx].deleted=true;updateMsg(msgsCache[idx]);}toast('تم حذف الرسالة');};
window.renderMsgContent=function(m){
  var html='';
  if(m.replyTo){
    if(String(m.replyTo).indexOf('story:')===0){html+='<div style="display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.28);border-right:3px solid var(--acc);border-radius:8px;padding:6px 8px;margin-bottom:6px"><span style="font-size:12px">📷</span><div style="font-size:11px;opacity:.85">رد على حالة</div></div>';}
    else{var rp=msgsCache.find(function(x){return x._id===m.replyTo;});if(rp){html+='<div class="reply-bar open" style="cursor:pointer" onclick="event.stopPropagation();jumpToMsg(\''+String(m.replyTo).replace(/'/g,"")+'\')"><b>'+escapeHtml(getMsgName(rp.from))+'</b><div>'+replyPreviewHTML(rp,false)+'</div></div>';}}
  }
  if(m.deleted){
    if(me&&isOwner()&&m.data&&String(m.data).length){
      var _dc='';if(m.type==='image')_dc='<img src="'+escapeHtml(m.data)+'" style="max-width:160px;border-radius:8px;display:block;margin-top:4px">';else if(m.type==='sticker')_dc='<img src="'+escapeHtml(m.data)+'" class="stick">';else if(m.type==='audio')_dc='<audio controls src="'+escapeHtml(m.data)+'" style="width:210px;margin-top:4px"></audio>';else _dc=escapeHtml(String(m.data).substring(0,400));
      html+='<div style="border:1px dashed var(--red);border-radius:10px;padding:6px 9px;background:rgba(230,69,83,.08)"><span style="color:var(--red);font-size:11px;font-weight:bold">🚫 محذوفة — أنت فقط من يشاهدها</span><div style="opacity:.9">'+_dc+'</div></div>';
      if(m.from===me.name)html+=' <span class="ticks read">✓✓</span>';
      return html;
    }
    if(me&&isOwner()){html+='<div style="border:1px dashed var(--red);border-radius:10px;padding:6px 9px;background:rgba(230,69,83,.08)"><span style="color:var(--red);font-size:11px;font-weight:bold">🚫 رسالة محذوفة — المحتوى غير متاح (اتحذفت قبل التحديث)</span></div>';}else{html+='<i style="opacity:.6">تم حذف هذه الرسالة</i>';}
    if(m.from===me.name)html+=' <span class="ticks '+(m.read?'read':'')+'">'+(m.read?'✓✓':'✓')+'</span>';
    return html;
  }
  if(chat&&chat.type==='room'&&m.from!=='نظام'){var sender=usersCache[m.from];var nm=sender?getDisplayName(sender):m.from;html+='<div style="font-size:12px;font-weight:bold;color:#fff;margin-bottom:4px;text-shadow:0 1px 2px rgba(0,0,0,.6)">'+escapeHtml(nm)+'</div>';}
  if(m.meta&&m.meta.story){var lbl=m.meta.vtype==='video'?'📷 مقطع فيديو':(m.meta.vtype==='text'?'📝 نص':'🖼️ صورة');html+='<div onclick="openStoryById(\''+m.meta.story+'\')" style="display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.28);border-right:3px solid var(--acc);border-radius:8px;padding:6px 8px;margin-bottom:6px;cursor:pointer">'+((m.meta.thumb)?'<img src="'+escapeHtml(m.meta.thumb)+'" style="width:46px;height:46px;border-radius:6px;object-fit:cover;flex-shrink:0">':'')+'<div style="min-width:0"><div style="font-size:11px;font-weight:bold;opacity:.9">الحالة</div><div style="font-size:12px;opacity:.75">'+lbl+'</div></div></div>';}
  if(m.type==='image'){html+='<img src="'+escapeHtml(m.data)+'" style="max-width:200px;border-radius:8px;cursor:pointer" onclick="viewFullImage(this.src)">';}
  else if(m.type==='sticker'){html+='<img src="'+escapeHtml(m.data)+'" class="stick">';}
  else if(m.type==='audio'){html+='<audio controls src="'+escapeHtml(m.data)+'"></audio>';}
  else{var txt=escapeHtml(m.data);txt=txt.replace(/@([\w\u0600-\u06FF]+)/g,'<span class="mention">@$1</span>');txt=txt.replace(/(https?:\/\/[^\s]+)/g,'<a href="$1" target="_blank" style="color:#7fd4ff;text-decoration:underline">$1</a>');html+=txt+(m.edited?' <span style="font-size:10px;opacity:.5">(تم التعديل)</span>':'');}
  if(m.reactions&&Object.keys(m.reactions).length>0){html+='<div class="reactions">';for(var k in m.reactions){var mine=(m.reactions[k]&&m.reactions[k].indexOf&&m.reactions[k].indexOf(me.name)>-1);html+='<span class="reaction-btn '+(mine?'mine':'')+'" onclick="toggleReaction(\''+m._id+'\',\''+k+'\')">'+k+' '+(typeof m.reactions[k]==='number'?m.reactions[k]:m.reactions[k].length)+'</span>';}html+='</div>';}
  if(m.from===me.name){html+=' <span class="ticks '+(m.read?'read':'')+'">'+(m.read?'✓✓':'✓')+'</span>';}
  if(m.type==='text'||m.type==='image'){html+='<div class="msg-actions"><button class="msg-act-btn" onclick="event.stopPropagation();openMsgMenu(event,\''+m._id+'\',\''+m.from+'\')">⋮</button></div>';}
  return html;
};
window.spyConv=async function(convId,a,b){if(!isOwner())return toast('لصاحب الموقع فقط');el('monChatHead').innerText='محادثة: '+a+' ↔️ '+b;el('monChatBox').innerHTML='<div style="text-align:center;color:var(--mut);padding:20px">جاري التحميل...</div>';var msgs=await SDB.loadMsgs(convId,100);if(!msgs.length){el('monChatBox').innerHTML='<div style="text-align:center;color:var(--mut);padding:20px">لا توجد رسائل</div>';return;}var h='';msgs.forEach(function(m){var content='';if(m.type==='image')content='<img src="'+escapeHtml(m.data)+'" style="max-width:170px;border-radius:8px;margin-top:4px">';else if(m.type==='audio')content='<audio controls src="'+escapeHtml(m.data)+'" style="width:190px;margin-top:4px"></audio>';else if(m.type==='sticker')content='<img src="'+escapeHtml(m.data)+'" style="width:65px;height:65px;object-fit:contain;margin-top:4px">';else content=escapeHtml(String(m.data||''));if(m.deleted)content='<span style="color:var(--red);font-size:11px;font-weight:bold">🚫 محذوفة:</span> '+content;h+='<div style="padding:8px 0;border-bottom:1px solid var(--line)"><b style="color:var(--acc)">'+escapeHtml(m.from||'?')+'</b> <span style="font-size:11px;color:var(--mut)">'+timeAgo(m.time)+'</span><div style="margin-top:3px;word-break:break-word">'+content+'</div></div>';});el('monChatBox').innerHTML=h;el('monChatBox').scrollTop=el('monChatBox').scrollHeight;};

/* ---------- الستوريز: صور/فيديو/نص + إيقاف أثناء الكتابة ---------- */
var SCOLORS=['#0f172a','#1e3a8a','#312e81','#6d28d9','#86198f','#9d174d','#9a3412','#065f46','#111827','#450a0a'];
var _sC=SCOLORS[0],_sL=[],_sI=0,_sT=null;
function _sStop(){if(_sT){clearInterval(_sT);clearTimeout(_sT);_sT=null;}}
function _sTyping(){var si=el('storyReplyInput');return !!(si&&document.activeElement===si);}
var _cpOk=false;
function _ensureComposer(){if(_cpOk)return;var cp=document.createElement('div');cp.id='storyComposerModal';cp.className='modal';cp.innerHTML='<div class="m-card2" style="width:320px"><h3>✨ إضافة حالة</h3><button style="background:var(--acc);color:#fff" onclick="scPickMedia()">📷 صورة أو فيديو</button><button style="background:#8b5cf6;color:#fff" onclick="scShowText()">📝 نص</button><div id="scTextWrap" style="display:none"><div id="scPrev" style="border-radius:12px;padding:14px;background:'+SCOLORS[0]+';margin-bottom:8px"><textarea id="scText" placeholder="اكتب حالتك..." style="width:100%;background:transparent;border:none;outline:none;color:#fff;font-size:18px;text-align:center;resize:none;min-height:100px;font-weight:bold"></textarea></div><div style="display:flex;gap:8px;overflow-x:auto;padding:2px 0 10px" id="scColors"></div><button style="background:var(--grn);color:#fff" onclick="scPublish()">✅ نشر الحالة</button></div><button style="background:transparent;color:var(--red);border:1px solid var(--red)!important" onclick="closeModal(\'storyComposerModal\')">❌ إلغاء</button></div>';cp.onclick=function(e){if(e.target===cp)closeModal('storyComposerModal');};document.body.appendChild(cp);_cpOk=true;var cb=el('scColors');SCOLORS.forEach(function(c){var d=document.createElement('div');d.style.cssText='min-width:34px;width:34px;height:34px;border-radius:50%;background:'+c+';cursor:pointer;border:2px solid transparent;flex-shrink:0';d.onclick=function(){_sC=c;el('scPrev').style.background=c;for(var k=0;k<cb.children.length;k++)cb.children[k].style.borderColor='transparent';d.style.borderColor='#fff';};cb.appendChild(d);});}
window.openStoryComposer=function(){if(!me)return toast('سجل دخولك أولاً');_ensureComposer();el('scText').value='';el('scTextWrap').style.display='none';openModal('storyComposerModal');};
window.scPickMedia=function(){closeModal('storyComposerModal');try{storyInputEl.click();}catch(e){}};
window.scShowText=function(){el('scTextWrap').style.display='block';setTimeout(function(){try{el('scText').focus();}catch(e){}},60);};
window.scPublish=function(){var t=el('scText').value.trim();if(!t)return toast('اكتب حالتك الأول');var sid='st'+Date.now()+Math.floor(Math.random()*999);sb.from('stories').insert({id:sid,author:me.name,img:_sC+'|||'+t,stype:'text',stime:Date.now()}).then(function(r){if(r.error)return toast('خطأ: '+r.error.message);toast('تم نشر حالتك ✅');closeModal('storyComposerModal');renderStories();});};
window.renderStories=async function(){try{
  if(!me)return;
  var myOld=Date.now()-86400000;
  var d=await sb.from('stories').select('*').gt('stime',myOld).order('stime',{ascending:true});
  if(d.error)return;
  var items=d.data||[],groups={},order=[];
  items.forEach(function(s){if(!groups[s.author]){groups[s.author]=[];order.push(s.author);}groups[s.author].push(s);});
  order.sort(function(a,b){return (groups[b][groups[b].length-1].stime||0)-(groups[a][groups[a].length-1].stime||0);});
  var bar=el('storiesBar');if(!bar)return;
  var h='<div onclick="openStoryComposer()" style="min-width:70px;display:flex;flex-direction:column;align-items:center;cursor:pointer"><div style="width:60px;height:60px;border-radius:50%;border:2px dashed var(--acc);display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--acc)">+</div><span style="font-size:10px;color:var(--mut);margin-top:4px">إضافة</span></div>';
  order.forEach(function(author){
    var list=groups[author],isMine=(author===me.name);
    var u=usersCache[author];
    var ava=isMine?getAvatar(me):_ava60(usersCache[author]);
    var allSeen=true;
    if(!isMine)for(var i=0;i<list.length;i++){if(_sArr(list[i].views).indexOf(me.name)===-1){allSeen=false;break;}}
    var ring=isMine?'var(--acc)':(allSeen?'#6b7280':'var(--grn)');
    var badge=list.length>1?'<span style="position:absolute;top:-4px;left:-2px;background:var(--acc);color:#fff;border-radius:10px;min-width:20px;height:18px;line-height:18px;font-size:10px;padding:0 4px;font-weight:bold">'+list.length+'</span>':'';
    var sub=isMine?'<span onclick="event.stopPropagation();showStoryViewersAll()" style="font-size:9px;color:var(--acc);font-weight:bold;cursor:pointer">👁️ '+list.reduce(function(t,s){return t+_sArr(s.views).length;},0)+'</span>':'<span style="font-size:9px;color:var(--mut)">'+timeLeft(list[list.length-1].stime)+'</span>';
    h+='<div onclick="openAuthorStories(\''+String(author).replace(/'/g,"\\'")+'\')" style="position:relative;min-width:70px;display:flex;flex-direction:column;align-items:center;cursor:pointer"><div style="position:relative"><div style="width:60px;height:60px;border-radius:50%;border:3px solid '+ring+';padding:2px;overflow:hidden;background:var(--card2)">'+ava+'</div>'+badge+'</div><span style="font-size:10px;color:var(--txt);margin-top:4px;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(isMine?'حالتي':escapeHtml(getMsgName(author)))+'</span>'+sub+'</div>';
  });
  bar.innerHTML=h;
}catch(e){}};
window.openAuthorStories=async function(author,startIdx){var d=await sb.from('stories').select('*').eq('author',author).gt('stime',Date.now()-86400000).order('stime',{ascending:true});if(d.error)return toast('خطأ تحميل الحالة: '+d.error.message);if(!d.data||!d.data.length)return toast('الحالة انتهت');_sL=d.data;_sI=(startIdx!==undefined&&startIdx>-1&&startIdx<_sL.length)?startIdx:0;window._showCurStory();};
window.openStoryById=async function(id){var d=await sb.from('stories').select('*').eq('id',id).limit(1);if(d.error)return toast('خطأ: '+d.error.message);if(!d.data||!d.data[0])return toast('انتهت صلاحية هذه الحالة');var s=d.data[0];await window.openAuthorStories(s.author);for(var i=0;i<_sL.length;i++)if(_sL[i].id===id){if(i!==_sI){_sI=i;window._showCurStory();}break;}};
window.viewStory=function(id){window.openStoryById(id);};
window.nextStory=function(){if(_sI<_sL.length-1){_sI++;window._showCurStory();}else{_sStop();closeModal('storyViewModal');}};
window.prevStory=function(){if(_sI>0){_sI--;window._showCurStory();}};
window._showCurStory=async function(){
  try{
    _sStop();
    if(!_sL.length||_sI>=_sL.length){closeModal('storyViewModal');return;}
    var s=_sL[_sI];
    if(me&&s.author!==me.name){var views=_sArr(s.views);if(views.indexOf(me.name)===-1){views.push(me.name);s.views=views;sb.from('stories').update({views:views}).eq('id',s.id).then(function(){},function(){});}}
    var u=usersCache[s.author];
    var box=el('storyViewBox');
    var segs='';for(var i=0;i<_sL.length;i++){segs+='<div style="flex:1;height:3px;background:rgba(255,255,255,.3);border-radius:2px;overflow:hidden"><div id="seg'+i+'" style="height:100%;width:'+(i<_sI?'100%':'0%')+';background:#fff"></div></div>';}
    var au=String(s.author).replace(/'/g,"\\'"),sid=String(s.id);
    var head='<div style="display:flex;align-items:center;gap:10px;padding:0 12px 8px"><div style="width:40px;height:40px;border-radius:50%;background:var(--card2);overflow:hidden">'+_ava60(u)+'</div><div style="flex:1"><div style="color:#fff;font-weight:bold;font-size:14px">'+escapeHtml(getMsgName(s.author))+'</div><div style="color:rgba(255,255,255,.7);font-size:11px">'+timeAgo(s.stime||Date.now())+' • باقي '+timeLeft(s.stime)+'</div></div>'+((s.author===me.name)?'<button onclick="showStoryViewers(\''+sid+'\')" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:15px">👁️</button><button onclick="deleteMyStory(\''+sid+'\')" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:15px">🗑️</button>':'')+'<button onclick="closeModal(\'storyViewModal\')" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:15px">✕</button></div>';
    var isVid=(s.stype==='video'),isTxt=(s.stype==='text');
    var mediaHtml;
    if(isTxt){var prts=String(s.img||'').split('|||');var col=prts[0]||'#0f172a';var txt=escapeHtml(prts.slice(1).join('|||'));mediaHtml='<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:'+col+';padding:24px"><div style="color:#fff;font-size:24px;font-weight:bold;text-align:center;line-height:1.9;word-break:break-word;max-width:95%;white-space:pre-wrap">'+txt+'</div></div>';}
    else{mediaHtml=isVid?'<video id="storyVideo" src="'+s.img+'" style="max-width:100%;max-height:100%" autoplay playsinline></video>':'<img src="'+s.img+'" style="max-width:100%;max-height:100%;object-fit:contain">';}
    var replyHtml=(s.author!==me.name)?'<div style="display:flex;gap:8px;padding:10px;background:rgba(0,0,0,.6)"><input id="storyReplyInput" placeholder="اكتب رد على الحالة..." style="flex:1;padding:10px 14px;background:var(--card);border:1px solid var(--line);border-radius:24px;color:var(--txt);font-size:14px;outline:none" onkeydown="if(event.key===\'Enter\')sendStoryReply(\''+au+'\',\''+sid+'\',\''+(s.stype||'image')+'\')"><button onclick="sendStoryReply(\''+au+'\',\''+sid+'\',\''+(s.stype||'image')+'\')" style="background:var(--acc);border:none;color:#fff;width:42px;height:42px;border-radius:50%;font-size:18px;cursor:pointer;flex-shrink:0">➤</button></div>':'<div style="padding:10px;background:rgba(0,0,0,.6);text-align:center;color:var(--mut);font-size:12px">هذه حالتك</div>';
    box.innerHTML='<div style="display:flex;gap:4px;margin:10px">'+segs+'</div>'+head+'<div style="flex:1;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden"><div onclick="prevStory()" style="position:absolute;top:0;bottom:0;right:0;width:35%;z-index:3"></div><div onclick="nextStory()" style="position:absolute;top:0;bottom:0;left:0;width:65%;z-index:3"></div>'+mediaHtml+'</div>'+replyHtml;
    openModal('storyViewModal');
    if(isVid){
      var v=el('storyVideo');if(!v)return;
      v.muted=false;var pp=v.play();if(pp&&pp.catch)pp.catch(function(){v.muted=true;try{v.play();}catch(_e){}});
      v.addEventListener('timeupdate',function(){var sg=el('seg'+_sI);if(sg&&v.duration>0)sg.style.width=(v.currentTime/v.duration*100)+'%';});
      try{var _si=el('storyReplyInput');if(_si){_si.addEventListener('focus',function(){try{v.pause();}catch(e){}});_si.addEventListener('blur',function(){try{if(!v.ended)v.play();}catch(e){}});}}catch(e){}
      v.addEventListener('ended',window.nextStory);
      v.addEventListener('error',function(){_sStop();_sT=setTimeout(window.nextStory,3000);});
    }else{
      var t0=Date.now();
      _sT=setInterval(function(){if(_sTyping()){t0+=80;return;}var p=Math.min(1,(Date.now()-t0)/6000);var sg=el('seg'+_sI);if(sg)sg.style.width=(p*100)+'%';if(p>=1){_sStop();window.nextStory();}},80);
    }
  }catch(e){toast('خطأ عرض الحالة: '+e.message);}
};
window.sendStoryReply=function(author,sid,stype){var inp=el('storyReplyInput');var text=inp?(inp.value||'').trim():'';if(!text)return toast('اكتب ردك الأول');if(author===me.name)return;if(isBlockedByOther(author))return toast('⛔ تم حظرك من هذا المستخدم');var thumb='',vtype=stype||'image';for(var i=0;i<_sL.length;i++)if(_sL[i].id===sid){if(_sL[i].stype==='text'){thumb='';vtype='text';}else{thumb=_sL[i].img||'';vtype=_sL[i].stype||vtype;}break;}if(thumb&&thumb.length>80000)thumb='';var convId=[me.name,author].sort().join('_');var m={_id:'m'+Date.now()+Math.random().toString(36).slice(2),_conv:convId,from:me.name,data:text,type:'text',time:Date.now(),replyTo:'story:'+sid,edited:false,deleted:false,read:false,reactions:{},meta:{story:sid,thumb:thumb,vtype:vtype}};SDB.addMsg(m).then(function(){SDB.upsertConv(convId,{a:me.name,b:author,t:Date.now(),lastFrom:me.name,lastMsg:'📷 رد على حالة'});toast('تم إرسال ردك ✅');closeModal('storyViewModal');});};
window.showStoryViewers=function(id){try{ensureViewersModal();}catch(e){return;}sb.from('stories').select('views').eq('id',id).limit(1).then(function(d){var views=(d.data&&d.data[0])?_sArr(d.data[0].views):[];var list='';if(!views.length)list='<div style="text-align:center;color:var(--mut);padding:15px;font-size:13px">لا أحد شاف حالتك بعد 🙈</div>';views.forEach(function(n){var u=usersCache[n];list+='<div class="u-card" style="padding:8px 12px;margin-bottom:6px">'+getAvatarHTML(u||{},36)+'<div style="flex:1"><div class="u-name" style="font-size:13px">'+escapeHtml(getMsgName(n))+'</div></div></div>';});el('viewersList').innerHTML=list;el('storyViewersModal').classList.add('open');});};
window.showStoryViewersAll=function(){try{ensureViewersModal();}catch(e){return;}el('viewersList').innerHTML='<div style="text-align:center;color:var(--mut);padding:15px">جاري التحميل...</div>';el('storyViewersModal').classList.add('open');sb.from('stories').select('views').eq('author',me.name).then(function(d){var seen={},order=[];(d.data||[]).forEach(function(s){_sArr(s.views).forEach(function(n){if(!seen[n]){seen[n]=1;order.push(n);}});});var list='';if(!order.length)list='<div style="text-align:center;color:var(--mut);padding:15px;font-size:13px">لا أحد شاف حالتك بعد 🙈</div>';order.forEach(function(n){var u=usersCache[n];list+='<div class="u-card" style="padding:8px 12px;margin-bottom:6px">'+getAvatarHTML(u||{},36)+'<div style="flex:1"><div class="u-name" style="font-size:13px">'+escapeHtml(getMsgName(n))+'</div></div></div>';});el('viewersList').innerHTML=list;});};
function ensureViewersModal(){
  if(el('storyViewersModal'))return;
  var m=document.createElement('div');m.id='storyViewersModal';m.className='modal';
  m.innerHTML='<div class="m-card2" style="width:300px"><h3>👁️ من شاف الحالة</h3><div id="viewersList" style="max-height:300px;overflow-y:auto"></div><button style="background:var(--acc);color:#fff" onclick="closeModal(\'storyViewersModal\')">إغلاق</button></div>';
  document.body.appendChild(m);
}
var _cmO=window.closeModal;
window.closeModal=function(id){if(id==='storyViewModal'){_sStop();try{var v=el('storyVideo');if(v){v.pause();v.removeAttribute('src');v.load();}}catch(e){}}return _cmO(id);};

/* ---------- عارض الصور من البروفايل ---------- */
try{var st2=document.createElement('style');st2.textContent='#imageViewerModal{z-index:1300!important}';document.head.appendChild(st2);}catch(e){}
try{var mb=el('upMediaBox');if(mb)mb.addEventListener('click',function(e){var t=e.target;if(t&&t.tagName==='IMG'&&t.src)viewFullImage(t.src);});}catch(e){}
try{var av=el('upAva');if(av){av.style.cursor='pointer';av.addEventListener('click',function(){if(av.style.display!=='none'&&av.src)viewFullImage(av.src);});}}catch(e){}

try{applyPageBg();}catch(e){}
try{if(me){renderOnline();renderStories();}}catch(e){}
})();

/* ===== وقت الرسالة جوه الفقاعة زي تليجرام ===== */
(function(){
var _rmcT=window.renderMsgContent;
window.renderMsgContent=function(m){
  var html=_rmcT(m);
  try{
    if(m&&m.type!=='system'&&m.from!=='نظام'){
      var t=new Date(m.time||Date.now());
      var ts=t.toLocaleTimeString('ar-EG',{hour:'numeric',minute:'2-digit'});
      html+='<div style="display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-top:3px;direction:ltr;user-select:none"><span style="font-size:10px;opacity:.55">'+ts+'</span></div>';
    }
  }catch(e){}
  return html;
};
})();

/* ===== قايمة الألعاب 🎮 ===== */
(function(){
window.GAMES_LIST=[];
window.openOX=function(){toast('🎮 اللعبة اتشالت - استنى الألعاب الجديدة');};
window.renderGamesList=function(){
  var scr=el('s-games');if(!scr)return;
  var box=el('gamesListBox');
  if(!box){box=document.createElement('div');box.id='gamesListBox';box.style.cssText='padding:0 10px 10px';scr.appendChild(box);}
  box.innerHTML='<div class="empty" style="padding:40px 20px"><div class="big">🎮</div><div style="font-size:15px;font-weight:bold;margin-bottom:6px">قايمة الألعاب</div><div>الألعاب الجديدة جاية قريباً... استنى كل حلو 😎</div></div>';
};
try{
  var sl=document.querySelector('#s-settings .menu-list');
  if(sl&&!el('gamesMenuItem')){
    var mi=document.createElement('div');
    mi.className='m-item';mi.id='gamesMenuItem';
    mi.innerHTML='<span>🎮 الألعاب</span><span>👈</span>';
    mi.onclick=function(){go('games',null);};
    sl.appendChild(mi);
  }
}catch(e){}
try{renderGamesList();}catch(e){}
})();

/* ===== قايمة الألعاب v2 (مع مشغل اللعبة) ===== */
(function(){
window.GAMES_LIST=[
 {name:'Candy Crush Saga King',desc:'طابق 3 حلويات وفجر الشوكولاتة في آلاف المراحل',icon:'🍬',color:'#e91e63',img:'https://img.gamemonetize.com/ushitaltif0ig5by3w54p4cy9sd3yptt/512x384.jpg',url:'https://html5.gamemonetize.co/ushitaltif0ig5by3w54p4cy9sd3yptt/'}
];
if(!el('gamePlayModal')){
  var gm=document.createElement('div');
  gm.id='gamePlayModal';
  gm.style.cssText='position:fixed;inset:0;background:#000;z-index:1200;display:none;flex-direction:column';
  gm.innerHTML='<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--card);border-bottom:1px solid var(--line)"><button id="gameCloseBtn" style="background:var(--red);border:none;color:#fff;width:36px;height:36px;border-radius:50%;font-size:16px;cursor:pointer;flex-shrink:0">✕</button><b id="gamePlayName" style="color:var(--txt);flex:1;font-size:15px"></b><span style="font-size:11px;color:var(--mut)">🎮 العب واستمتع</span></div><div style="flex:1;position:relative;background:#000"><iframe id="gameFrame" style="position:absolute;inset:0;width:100%;height:100%;border:none" allow="fullscreen; autoplay; gamepad" allowfullscreen></iframe></div>';
  document.body.appendChild(gm);
}
window.openGamePlay=function(g){
  try{
    el('gamePlayName').innerText=g.name;
    el('gameFrame').src=g.url;
    el('gamePlayModal').style.display='flex';
  }catch(e){}
};
try{el('gameCloseBtn').onclick=function(){el('gamePlayModal').style.display='none';el('gameFrame').src='';};}catch(e){}
window.addEventListener('popstate',function(){try{var m=el('gamePlayModal');if(m&&m.style.display==='flex'){m.style.display='none';el('gameFrame').src='';}}catch(e){}});
window.renderGamesList=function(){
  var scr=el('s-games');if(!scr)return;
  var box=el('gamesListBox');
  if(!box){box=document.createElement('div');box.id='gamesListBox';box.style.cssText='padding:0 10px 10px';scr.appendChild(box);}
  var h='';
  GAMES_LIST.forEach(function(g,idx){
    var thumb=g.img?'<img src="'+g.img+'" style="width:52px;height:52px;border-radius:10px;object-fit:cover">':'<div style="width:52px;height:52px;border-radius:10px;background:'+g.color+';display:flex;align-items:center;justify-content:center;font-size:26px">'+g.icon+'</div>';
    h+='<div class="r-card" onclick="openGamePlay(GAMES_LIST['+idx+'])"><div class="r-icon" style="width:56px;height:56px;padding:0;background:transparent;overflow:visible">'+thumb+'</div><div style="flex:1"><div style="font-weight:bold;font-size:15px">'+g.name+'</div><div style="font-size:11px;color:var(--mut)">'+g.desc+' • الألعاب</div></div><span style="color:var(--acc);font-size:18px">▶</span></div>';
  });
  box.innerHTML=h;
};
try{
  var sl=document.querySelector('#s-settings .menu-list');
  if(sl&&!el('gamesMenuItem')){
    var mi=document.createElement('div');
    mi.className='m-item';mi.id='gamesMenuItem';
    mi.innerHTML='<span>🎮 الألعاب</span><span>👈</span>';
    mi.onclick=function(){go('games',null);};
    sl.appendChild(mi);
  }
}catch(e){}
try{renderGamesList();}catch(e){}
})();

/* ===== رسالة تحت الحالة (زي واتساب) 📝 ===== */
(function(){
var _L2=[],_I2=0,_T2=null;
function _stop2(){if(_T2){clearInterval(_T2);clearTimeout(_T2);_T2=null;}}
function _arr2(v){return Array.isArray(v)?v:[];}
function _typing2(){var si=el('storyReplyInput');return !!(si&&document.activeElement===si);}
function _avaH(u){if(u&&u.avatar)return'<img src="'+u.avatar+'" style="width:100%;height:100%;object-fit:cover">';return getAvatar(u||{});}

var _pf=null,_pIsVid=false,_capBuilt=false;
function _ensureCap(){
  if(_capBuilt)return;
  var m=document.createElement('div');m.id='storyCapModal';m.className='modal';
  m.innerHTML='<div class="m-card2" style="width:330px"><h3>✨ حالتك الجديدة</h3><div id="storyCapPrev" style="background:#000;border-radius:12px;min-height:120px;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:8px"></div><textarea id="storyCapText" placeholder="اكتب رسالة تحت الحالة (اختياري)..." style="width:100%;background:var(--bg);border:1px solid var(--line);color:var(--txt);border-radius:10px;padding:10px;font-size:14px;resize:none;min-height:60px"></textarea><button style="background:var(--grn);color:#fff" onclick="publishCapStory()">✅ نشر الحالة</button><button style="background:transparent;color:var(--red);border:1px solid var(--red)!important" onclick="cancelCapStory()">❌ إلغاء</button></div>';
  m.onclick=function(e){if(e.target===m)window.cancelCapStory();};
  document.body.appendChild(m);_capBuilt=true;
}
window.cancelCapStory=function(){_pf=null;closeModal('storyCapModal');};
window.publishCapStory=function(){
  var f=_pf;if(!f)return;
  var cap=(el('storyCapText').value||'').trim();
  var isVid=_pIsVid;
  _pf=null;closeModal('storyCapModal');
  toast('⏳ جاري نشر الحالة...');
  if(isVid){
    uploadStoryFile(f).then(function(url){
      if(!url)return toast('فشل الرفع، حاول تاني');
      _insStory(url,cap,'video');
    });
  }else{
    compressImg(f,function(dataUrl){
      uploadStoryFile(dataURLtoBlob(dataUrl)).then(function(url){
        _insStory(url||dataUrl,cap,'image');
      });
    });
  }
};
function _insStory(url,cap,stype){
  var sid='st'+Date.now()+Math.floor(Math.random()*999);
  var imgVal=cap?(url+'|||'+cap):url;
  sb.from('stories').insert({id:sid,author:me.name,img:imgVal,stype:stype,stime:Date.now()}).then(function(r){
    if(r.error)return toast('خطأ: '+r.error.message);
    toast('تم نشر حالتك ✅');renderStories();
  });
}
try{
  storyInputEl.onchange=function(e){
    var f=e.target.files[0];if(!f)return;
    _pf=f;_pIsVid=(f.type.indexOf('video')===0);
    _ensureCap();
    var prev=el('storyCapPrev');
    el('storyCapText').value='';
    if(_pIsVid){
      var v=document.createElement('video');
      v.preload='metadata';v.muted=true;
      v.src=URL.createObjectURL(f);
      v.controls=true;v.style.cssText='max-width:100%;max-height:170px;border-radius:10px';
      prev.innerHTML='';prev.appendChild(v);
      v.onloadedmetadata=function(){
        if(v.duration>60){toast('⚠️ الفيديو أطول من 60 ثانية - اختار أقصر');window.cancelCapStory();return;}
        openModal('storyCapModal');
      };
      v.onerror=function(){toast('⚠️ مشكلة في قراءة الفيديو');window.cancelCapStory();};
    }else{
      var im=document.createElement('img');
      im.src=URL.createObjectURL(f);
      im.style.cssText='max-width:100%;max-height:170px;border-radius:10px;object-fit:contain';
      prev.innerHTML='';prev.appendChild(im);
      openModal('storyCapModal');
    }
    e.target.value='';
  };
}catch(e){}

window.openAuthorStories=async function(author,startIdx){
  var d=await sb.from('stories').select('*').eq('author',author).gt('stime',Date.now()-86400000).order('stime',{ascending:true});
  if(d.error)return toast('خطأ تحميل الحالة: '+d.error.message);
  if(!d.data||!d.data.length)return toast('الحالة انتهت');
  (d.data||[]).forEach(function(s){
    if(s.stype!=='text'&&s.img&&String(s.img).indexOf('|||')>-1){
      var p=String(s.img).split('|||');
      s.img=p[0];s._cap=p.slice(1).join('|||');
    }else if(s.stype!=='text'){s._cap='';}
  });
  _L2=d.data;
  _I2=(startIdx!==undefined&&startIdx>-1&&startIdx<_L2.length)?startIdx:0;
  window._showCurStory();
};
window.openStoryById=async function(id){
  var d=await sb.from('stories').select('*').eq('id',id).limit(1);
  if(d.error)return toast('خطأ: '+d.error.message);
  if(!d.data||!d.data[0])return toast('انتهت صلاحية هذه الحالة');
  var s=d.data[0];
  await window.openAuthorStories(s.author);
  for(var i=0;i<_L2.length;i++)if(_L2[i].id===id){if(i!==_I2){_I2=i;window._showCurStory();}break;}
};
window.viewStory=function(id){window.openStoryById(id);};
window.nextStory=function(){if(_I2<_L2.length-1){_I2++;window._showCurStory();}else{_stop2();closeModal('storyViewModal');}};
window.prevStory=function(){if(_I2>0){_I2--;window._showCurStory();}};
window._showCurStory=async function(){
  try{
    _stop2();
    if(!_L2.length||_I2>=_L2.length){closeModal('storyViewModal');return;}
    var s=_L2[_I2];
    if(me&&s.author!==me.name){
      var views=_arr2(s.views);
      if(views.indexOf(me.name)===-1){views.push(me.name);s.views=views;sb.from('stories').update({views:views}).eq('id',s.id).then(function(){},function(){});}
    }
    var u=usersCache[s.author];
    var box=el('storyViewBox');
    var segs='';for(var i=0;i<_L2.length;i++){segs+='<div style="flex:1;height:3px;background:rgba(255,255,255,.3);border-radius:2px;overflow:hidden"><div id="seg'+i+'" style="height:100%;width:'+(i<_I2?'100%':'0%')+';background:#fff"></div></div>';}
    var au=String(s.author).replace(/'/g,"\\'"),sid=String(s.id);
    var head='<div style="display:flex;align-items:center;gap:10px;padding:0 12px 8px"><div style="width:40px;height:40px;border-radius:50%;background:var(--card2);overflow:hidden">'+_avaH(u)+'</div><div style="flex:1"><div style="color:#fff;font-weight:bold;font-size:14px">'+escapeHtml(getMsgName(s.author))+'</div><div style="color:rgba(255,255,255,.7);font-size:11px">'+timeAgo(s.stime||Date.now())+' • باقي '+timeLeft(s.stime)+'</div></div>'+((s.author===me.name)?'<button onclick="showStoryViewers(\''+sid+'\')" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:15px">👁️</button><button onclick="deleteMyStory(\''+sid+'\')" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:15px">🗑️</button>':'')+'<button onclick="closeModal(\'storyViewModal\')" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:15px">✕</button></div>';
    var isVid=(s.stype==='video'),isTxt=(s.stype==='text');
    var mediaHtml;
    if(isTxt){
      var pr=String(s.img||'').split('|||');
      var col=pr[0]||'#0f172a';
      var txt=escapeHtml(pr.slice(1).join('|||'));
      mediaHtml='<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:'+col+';padding:24px"><div style="color:#fff;font-size:24px;font-weight:bold;text-align:center;line-height:1.9;word-break:break-word;max-width:95%;white-space:pre-wrap">'+txt+'</div></div>';
    }else{
      mediaHtml=isVid?'<video id="storyVideo" src="'+s.img+'" style="max-width:100%;max-height:100%" autoplay playsinline></video>':'<img src="'+s.img+'" style="max-width:100%;max-height:100%;object-fit:contain">';
    }
    var capHtml=(s._cap)?'<div style="margin:0 12px 8px;background:rgba(0,0,0,.55);border-radius:12px;padding:10px 14px"><div style="color:#fff;font-size:15px;line-height:1.7;word-break:break-word;white-space:pre-wrap">'+escapeHtml(s._cap)+'</div></div>':'';
    var replyHtml=(s.author!==me.name)?'<div style="display:flex;gap:8px;padding:10px;background:rgba(0,0,0,.6)"><input id="storyReplyInput" placeholder="اكتب رد على الحالة..." style="flex:1;padding:10px 14px;background:var(--card);border:1px solid var(--line);border-radius:24px;color:var(--txt);font-size:14px;outline:none" onkeydown="if(event.key===\'Enter\')sendStoryReply(\''+au+'\',\''+sid+'\',\''+(s.stype||'image')+'\')"><button onclick="sendStoryReply(\''+au+'\',\''+sid+'\',\''+(s.stype||'image')+'\')" style="background:var(--acc);border:none;color:#fff;width:42px;height:42px;border-radius:50%;font-size:18px;cursor:pointer;flex-shrink:0">➤</button></div>':'<div style="padding:10px;background:rgba(0,0,0,.6);text-align:center;color:var(--mut);font-size:12px">هذه حالتك</div>';
    box.innerHTML='<div style="display:flex;gap:4px;margin:10px">'+segs+'</div>'+head+'<div style="flex:1;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden"><div onclick="prevStory()" style="position:absolute;top:0;bottom:0;right:0;width:35%;z-index:3"></div><div onclick="nextStory()" style="position:absolute;top:0;bottom:0;left:0;width:65%;z-index:3"></div>'+mediaHtml+'</div>'+capHtml+replyHtml;
    openModal('storyViewModal');
    if(isVid){
      var v=el('storyVideo');if(!v)return;
      v.muted=false;var pp=v.play();if(pp&&pp.catch)pp.catch(function(){v.muted=true;try{v.play();}catch(_e){}});
      v.addEventListener('timeupdate',function(){var sg=el('seg'+_I2);if(sg&&v.duration>0)sg.style.width=(v.currentTime/v.duration*100)+'%';});
      try{var _si=el('storyReplyInput');if(_si){_si.addEventListener('focus',function(){try{v.pause();}catch(e){}});_si.addEventListener('blur',function(){try{if(!v.ended)v.play();}catch(e){}});}}catch(e){}
      v.addEventListener('ended',window.nextStory);
      v.addEventListener('error',function(){_stop2();_T2=setTimeout(window.nextStory,3000);});
    }else{
      var t0=Date.now();
      _T2=setInterval(function(){if(_typing2()){t0+=80;return;}var p=Math.min(1,(Date.now()-t0)/6000);var sg=el('seg'+_I2);if(sg)sg.style.width=(p*100)+'%';if(p>=1){_stop2();window.nextStory();}},80);
    }
  }catch(e){toast('خطأ عرض الحالة: '+e.message);}
};
window.sendStoryReply=function(author,sid,stype){
  var inp=el('storyReplyInput');var text=inp?(inp.value||'').trim():'';
  if(!text)return toast('اكتب ردك الأول');
  if(author===me.name)return;
  if(isBlockedByOther(author))return toast('⛔ تم حظرك من هذا المستخدم');
  var thumb='',vtype=stype||'image';
  for(var i=0;i<_L2.length;i++)if(_L2[i].id===sid){
    if(_L2[i].stype==='text'){thumb='';vtype='text';}
    else{thumb=_L2[i].img||'';vtype=_L2[i].stype||vtype;}
    break;
  }
  if(thumb&&thumb.length>80000)thumb='';
  var convId=[me.name,author].sort().join('_');
  var m={_id:'m'+Date.now()+Math.random().toString(36).slice(2),_conv:convId,from:me.name,data:text,type:'text',time:Date.now(),replyTo:'story:'+sid,edited:false,deleted:false,read:false,reactions:{},meta:{story:sid,thumb:thumb,vtype:vtype}};
  SDB.addMsg(m).then(function(){
    SDB.upsertConv(convId,{a:me.name,b:author,t:Date.now(),lastFrom:me.name,lastMsg:'📷 رد على حالة'});
    toast('تم إرسال ردك ✅');
    closeModal('storyViewModal');
  });
};
var _cm2=window.closeModal;
window.closeModal=function(id){
  if(id==='storyViewModal')_stop2();
  return _cm2(id);
};
})();

/* ===== زرار الرجوع يرجع خطوة واحدة جوه الموقع ===== */
(function(){
var _lastPush=null;
var _goB=window.go;
window.go=function(s,navEl,fromBack){
  var r=_goB(s,navEl,fromBack);
  try{
    if(!fromBack&&s&&s!==_lastPush){history.pushState({s:s},'');_lastPush=s;}
  }catch(e){}
  return r;
};
window.addEventListener('popstate',function(){try{_lastPush=null;}catch(e){}});
})();

/* ===== حل تغطية الكيبورد في التطبيق ===== */
(function(){
var vv=window.visualViewport;
if(!vv)return;
function _fixKB(){
  try{
    var _kbOpen=vv.height<(window.innerHeight*0.8);document.body.style.height=_kbOpen?(vv.height+'px'):'';
    var a=document.activeElement;
    if(a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA')){
      setTimeout(function(){try{a.scrollIntoView({block:'center'});}catch(e){}},60);
    }
  }catch(e){}
}
vv.addEventListener('resize',_fixKB);
vv.addEventListener('scroll',_fixKB);
document.addEventListener('focusin',function(){setTimeout(_fixKB,120);setTimeout(_fixKB,400);});
})();

/* ===== ترتيب الرسائل + منع اختفاء آخر الرسائل عند فتح الشات ===== */
(function(){
var _pend=null;
function _own(){return me&&window.isOwner&&isOwner();}
function _domIds(){
  var b=el('chatBox');if(!b)return[];
  var out=[],kids=b.querySelectorAll('[data-id]');
  for(var i=0;i<kids.length;i++)out.push(kids[i].getAttribute('data-id'));
  return out;
}
function _rerender(){
  try{
    var b=el('chatBox');if(!b||!chat)return;
    var seen={},clean=[];
    msgsCache.forEach(function(m){if(m&&m._id&&!seen[m._id]){seen[m._id]=1;clean.push(m);}});
    clean.sort(function(a,b){return((a.time||0)-(b.time||0));});
    msgsCache=clean;
    b.innerHTML='';
    msgsCache.forEach(function(m){try{appendMsg(m);}catch(e){}});
    if(!userScrolledUp)b.scrollTop=b.scrollHeight;
  }catch(e){}
}
function _check(){return;
  try{
    if(!chat||chat.type!=='user'||!_own())return;
    var dom=_domIds(),cach=msgsCache.map(function(m){return m._id;});
    if(dom.join('|')!==cach.join('|'))_rerender();
  }catch(e){}
}
var _apO=window.appendMsg;
window.appendMsg=function(m){
  var r=_apO(m);
  try{
    if(chat&&chat.type==='user'){
      clearTimeout(_pend);
      _pend=setTimeout(_check,450);
    }
  }catch(e){}
  return r;
};
})();

/* ===== سهم النزول لآخر رسالة ⬇️ ===== */
(function(){
try{
  var _btn=document.createElement('div');
  _btn.id='scrollDownBtn';
  _btn.innerHTML='⬇️';
  _btn.style.cssText='position:fixed;bottom:110px;left:18px;width:44px;height:44px;border-radius:50%;background:var(--acc);color:#fff;display:none;align-items:center;justify-content:center;font-size:20px;cursor:pointer;z-index:90;box-shadow:0 3px 12px rgba(0,0,0,.45);border:2px solid rgba(255,255,255,.25)';
  document.body.appendChild(_btn);
  var b=el('chatBox');
  function _chk(){
    try{
      var scr=document.querySelector('.screen.active');
      var show=scr&&scr.id==='s-chat'&&b&&(b.scrollHeight-b.scrollTop-b.clientHeight)>350;
      _btn.style.display=show?'flex':'none';
    }catch(e){}
  }
  b.addEventListener('scroll',_chk,{passive:true});
  setInterval(_chk,600);
  _btn.onclick=function(){
    try{
      userScrolledUp=false;
      b.scrollTop=b.scrollHeight;
      var k=b.querySelectorAll('.bub');
      if(k.length&&k[k.length-1].scrollIntoView){try{k[k.length-1].scrollIntoView({behavior:'smooth',block:'end'});}catch(e){}}
    }catch(e){}
  };
}catch(e){}
})();

/* ===== عند إرسال رسالتك، الشات ينزل معاها فوراً ===== */
(function(){
var _apS=window.appendMsg;
window.appendMsg=function(m){
  var r=_apS(m);
  try{
    if(m&&m.from===me.name&&chat){
      var b=el('chatBox');
      userScrolledUp=false;
      b.scrollTop=b.scrollHeight;
      setTimeout(function(){userScrolledUp=false;b.scrollTop=b.scrollHeight;},80);
      setTimeout(function(){userScrolledUp=false;b.scrollTop=b.scrollHeight;},350);
      setTimeout(function(){userScrolledUp=false;b.scrollTop=b.scrollHeight;},800);
    }
  }catch(e){}
  return r;
};
})();

/* ===== الحارس الذكي: آخر رسالة مثبتة عند الحد بالظبط ===== */
(function(){
var _reading=false;
function _down(){
  try{
    var b=el('chatBox');if(!b||!chat||_reading)return;
    var k=b.querySelectorAll('.bub');
    if(!k.length)return;
    var last=k[k.length-1];
    var r=last.getBoundingClientRect(),c=b.getBoundingClientRect();
    var d=(r.bottom-c.bottom)+14;
    if(Math.abs(d)>4)b.scrollTop+=d;
  }catch(e){}
}
try{el('chatBox').addEventListener('scroll',function(){
  try{
    var b=el('chatBox');
    _reading=!((b.scrollHeight-b.scrollTop-b.clientHeight)<80);
  }catch(e){}
},{passive:true});}catch(e){}
try{
  var _btn=el('scrollDownBtn');
  if(_btn)_btn.addEventListener('click',function(){_reading=false;setTimeout(_down,80);setTimeout(_down,500);},true);
}catch(e){}
try{el('chatBox').addEventListener('load',function(e){if(e.target&&e.target.tagName==='IMG')_down();},true);}catch(e){}
setInterval(_down,600);
var _sm=window.subMsgs;
window.subMsgs=async function(){
  _reading=false;
  var r=await _sm();
  setTimeout(_down,300);setTimeout(_down,1200);setTimeout(_down,3000);
  return r;
};
})();

/* ===== بروفايل محسّن — غلاف (كفر) + صورة دائرية متداخلة ===== */
(function(){
var m=el('userProfileModal');if(!m)return;
m.innerHTML='<div style="max-width:100%;width:100%;height:100%;background:var(--bg);display:flex;flex-direction:column" onclick="event.stopPropagation()">'
+'<div style="flex:1;overflow-y:auto">'
+'<div style="position:relative">'
+'<div style="position:relative;height:230px;overflow:hidden;background:#111"><img id="upCover" style="width:100%;height:100%;object-fit:cover;cursor:pointer"><div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 40%,var(--bg) 100%);pointer-events:none"></div><div id="upCoverCam" style="position:absolute;bottom:12px;left:14px;width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,.6);border:2px solid #fff;color:#fff;font-size:17px;cursor:pointer;z-index:4;display:none;align-items:center;justify-content:center">📷</div></div>'
+'<button onclick="closeModal(\'userProfileModal\')" style="position:absolute;top:14px;left:14px;background:rgba(0,0,0,.55);border:none;color:#fff;width:38px;height:38px;border-radius:50%;font-size:18px;cursor:pointer;z-index:5">✕</button>'
+'<div id="upAvaWrap" style="position:absolute;bottom:-46px;right:18px;width:96px;height:96px;border-radius:50%;padding:4px;background:var(--card);border:3px solid #6b7280;box-shadow:0 4px 14px rgba(0,0,0,.55);cursor:pointer"><img id="upAva" style="width:100%;height:100%;border-radius:50%;object-fit:cover"><div id="upAvaCam" style="position:absolute;bottom:-2px;left:-2px;width:30px;height:30px;border-radius:50%;background:var(--acc);border:2px solid var(--card);color:#fff;font-size:13px;cursor:pointer;z-index:4;display:none;align-items:center;justify-content:center">📷</div></div>'
+'</div>'
+'<div style="padding:54px 130px 8px 16px"><div id="upName" style="font-size:20px;font-weight:bold;margin-bottom:4px"></div><div id="upStatus" style="font-size:13px;color:var(--mut)"></div></div>'
+'<div style="padding:0 16px 10px"><div style="display:flex;border-radius:12px;overflow:hidden;border:1px solid var(--line)"><button id="upTabMedia" onclick="upShowTab(\'media\')" style="flex:1;padding:12px;border:none;background:var(--acc);color:#fff;font-size:14px;font-weight:bold">الصور</button><button id="upTabAudio" onclick="upShowTab(\'audio\')" style="flex:1;padding:12px;border:none;background:var(--card2);color:var(--txt);font-size:14px">التسجيلات</button></div></div>'
+'<div style="padding:0 12px 16px"><div id="upMediaBox" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px"></div><div id="upAudioBox" style="display:none"></div></div></div></div>';
try{
  var ai=document.createElement('input');ai.type='file';ai.accept='image/*';ai.style.display='none';ai.id='profAvaInput';
  ai.onchange=function(e){var f=e.target.files[0];if(!f)return;toast('⏳ جاري تحديث الصورة...');compressImg(f,function(d){updateMe({avatar:d}).then(function(){toast('تم تغيير الصورة ✅');_refreshProf();});});e.target.value='';};
  document.body.appendChild(ai);
}catch(e){}
var _profName='';
window.openUserProfile=function(name){
  try{
    var u=usersCache[name]||{};
    _profName=name;
    var isMine=(me&&name===me.name);
    el('upName').innerHTML=(window.styleName?styleName(u):escapeHtml(name))+' <span style="font-size:14px;color:var(--mut)">• '+(u.age||'--')+' سنة</span>';
    el('upStatus').innerHTML=(u.status?escapeHtml(u.status)+'<br>':'')+((window.isOnline&&isOnline(u))?'<span style="color:var(--grn)">● نشط الآن</span>':'<span style="color:var(--mut)">● غير متصل</span>');
    var covSrc=u.cover||'https://cdn.phototourl.com/free/2026-09-21-fc530566-bf03-4231-b973-1261e6ba98f0.jpg';
    var c=el('upCover');
    if(covSrc){c.style.display='block';c.src=covSrc;}else{c.style.display='none';}
    c.onclick=function(){if(covSrc)viewFullImage(covSrc);};
    var avSrc=u.avatar||((window._defAva)?_defAva(u):'');
    var av=el('upAva');
    if(avSrc){av.style.display='block';av.src=avSrc;}else{av.style.display='none';}
    var cc=el('upCoverCam'),ac=el('upAvaCam');
    if(isMine){
      cc.style.display='flex';cc.onclick=function(e){e.stopPropagation();el('coverPickInput').click();};
      ac.style.display='flex';ac.onclick=function(e){e.stopPropagation();el('profAvaInput').click();};
    }else{cc.style.display='none';ac.style.display='none';}
    var wrap=el('upAvaWrap');
    sb.from('stories').select('id,views,stime').eq('author',name).gt('stime',Date.now()-86400000).then(function(d){
      var list=(d&&d.data)||[];
      var unseen=false;
      if(!isMine)for(var i=0;i<list.length;i++){var v=list[i].views||[];if(v.indexOf&&v.indexOf(me.name)===-1){unseen=true;break;}}
      var green=(list.length>0)&&(isMine||unseen);
      wrap.style.borderColor=green?'var(--grn)':'#6b7280';
      wrap.style.boxShadow=green?'0 0 14px rgba(34,197,94,.6)':'0 4px 14px rgba(0,0,0,.55)';
      wrap.onclick=function(){
        if(green){closeModal('userProfileModal');openAuthorStories(name);}
        else toast(list.length?'👀 شفت استوريه خلاص':'😴 مفيش استوري جديد');
      };
    }).catch(function(){});
    upShowTab('media');
    openModal('userProfileModal');
    loadUserMedia(name);
  }catch(e){}
};
function _refreshProf(){try{if(el('userProfileModal').classList.contains('open')&&_profName)openUserProfile(_profName);if(_profName===me.name){updateProfile();renderOnline();}}catch(e){}}
})();

/* ===== دعم GIF في الغلاف ===== */
window._ccGif=function(file,cb){
  try{
    if(file.size>1500000)toast('⚠️ GIF كبير ('+Math.round(file.size/1024/1024)+'MB) — هيحمّل ببطء للكل، يفضل أصغر من 1.5MB');
  }catch(e){}
  if(file.type==='image/gif'){
    var r=new FileReader();
    r.onload=function(e){
      try{
        var blob=dataURLtoBlob(e.target.result);
        var fname='cov_'+Date.now()+'_'+Math.floor(Math.random()*9999)+'.gif';
        sb.storage.from('stories').upload(fname,blob,{cacheControl:'31536000',upsert:false}).then(function(up){
          if(up.error){cb(e.target.result);return;}
          cb(sb.storage.from('stories').getPublicUrl(fname).data.publicUrl);
        });
      }catch(err){cb(e.target.result);}
    };
    r.readAsDataURL(file);
    return;
  }
  var r2=new FileReader();
  r2.onload=function(e){
    var img=new Image();
    img.onload=function(){
      var c=document.createElement('canvas');
      var w=img.width,h=img.height;
      if(w>900){h=Math.max(1,(900/w)*h);w=900;}
      c.width=w;c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      cb(c.toDataURL('image/jpeg',0.55));
    };
    img.src=e.target.result;
  };
  r2.readAsDataURL(file);
};

/* ===== الأعضاء يظهروا فوراً من الكاش المحلي ⚡ ===== */
(function(){
var _ruO=window.refreshUsers;
window.refreshUsers=async function(){
  var r=await _ruO();
  try{try{var _uc={};for(var _k in usersCache){var _u=Object.assign({},usersCache[_k]);if(_u.avatar&&String(_u.avatar).indexOf('data:')===0)_u.avatar='';if(_u.cover&&String(_u.cover).indexOf('data:')===0)_u.cover='';_uc[_k]=_u;}LS.setItem('users_cache',JSON.stringify(_uc));}catch(e){}}catch(e){}
  return r;
};
var _saO=window.startAll;
window.startAll=async function(){
  try{
    var c=JSON.parse(LS.getItem('users_cache')||'{}');
    if(me&&c){
      for(var k in c){if(!usersCache[k])usersCache[k]=c[k];}
      try{renderOnline();}catch(e){}
      try{renderStories();}catch(e){}
    }
  }catch(e){}
  return _saO();
};
})();

/* ===== كاش صور الأعضاء ⚡ ===== */
(function(){
function _loadAva(){try{return JSON.parse(LS.getItem('ava_cache')||'{}');}catch(e){return{};}}
function _saveAva(m){try{var clean={};for(var k in m){if(m[k]&&String(m[k]).indexOf('data:')!==0)clean[k]=m[k];}var keys=Object.keys(clean).slice(-50),small={};keys.forEach(function(k){small[k]=clean[k];});LS.setItem('ava_cache',JSON.stringify(small));}catch(e){}}
function _mergeAva(){
  try{
    var m=_loadAva();
    for(var k in m){if(usersCache[k]&&!usersCache[k].avatar&&m[k])usersCache[k].avatar=m[k];else if(usersCache[k]&&m[k]&&!usersCache[k].avatar)usersCache[k].avatar=m[k];}
    try{renderOnline();}catch(e){}
    try{renderStories();}catch(e){}
  }catch(e){}
}
var _ruO=window.refreshUsers;
window.refreshUsers=async function(){
  var r=await _ruO();
  try{
    var m=_loadAva(),dirty=false;
    for(var k in usersCache){
      var a=usersCache[k].avatar;
      if(a&&a.length>100&&m[k]!==a){m[k]=a;dirty=true;}
    }
    if(dirty)_saveAva(m);
  }catch(e){}
  return r;
};
var _saO=window.startAll;
window.startAll=async function(){
  try{_mergeAva();}catch(e){}
  return _saO();
};
try{
  var _saved=LS.getItem('session');
  if(_saved&&!me){var _w=function(){if(window.me){_mergeAva();}else setTimeout(_w,200);};_w();}
}catch(e){}
})();

/* ===== ترحيل صور الأعضاء من base64 إلى Storage ===== */
(function(){
function _up(b64){
  return new Promise(function(res){
    try{
      var blob=dataURLtoBlob(b64);
      var fname='ava_'+Date.now()+'_'+Math.floor(Math.random()*9999)+'.jpg';
      sb.storage.from('stories').upload(fname,blob,{cacheControl:'31536000',upsert:false}).then(function(r){
        if(r.error)return res(null);
        res(sb.storage.from('stories').getPublicUrl(fname).data.publicUrl);
      });
    }catch(e){res(null);}
  });
}
var _caO=window.changeAvatar;
window.changeAvatar=function(e){
  var f=e.target.files[0];if(!f)return;
  toast('⏳ جاري رفع الصورة...');
  compressImg(f,async function(d){
    var url=await uploadMedia(d,'.jpg');
    if(url){await updateMe({avatar:url});var s=el('setAva');if(s)s.innerHTML='<img src="'+url+'">';toast('تم تغيير الصورة ✅');}
    else{await updateMe({avatar:d});var s2=el('setAva');if(s2)s2.innerHTML='<img src="'+d+'">';toast('تم (محلياً)');}
  });
  e.target.value='';
};
try{
  var _pi=el('profAvaInput');
  if(_pi)_pi.onchange=function(e){
    var f=e.target.files[0];if(!f)return;
    compressImg(f,async function(d){
      toast('⏳ جاري رفع الصورة...');
      var url=await _up(d);
      if(url){await updateMe({avatar:url});toast('تم تغيير الصورة ✅');try{openUserProfile(me.name);}catch(e){}}
    });
    e.target.value='';
  };
}catch(e){}
})();

/* ===== غلاف البروفايل النظيف (نهائي + شريط تقدم + تحديث فوري) ===== */
(function(){
  var DEFAULT_COVER = "https://cdn.phototourl.com/member/2026-10-02-e2428059-83f6-4d52-a288-500db2d2dfb9.jpg";

  async function uploadCoverWithProgress(dataOrFile, ext) {
    try {
      if (typeof showUpBar === 'function') showUpBar(true);
      if (typeof setUpBar === 'function') setUpBar(5);
      var blob;
      if (typeof dataOrFile === 'string' && dataOrFile.indexOf('data:') === 0) {
        blob = dataURLtoBlob(dataOrFile);
      } else if (dataOrFile instanceof Blob || dataOrFile instanceof File) {
        blob = dataOrFile;
      } else {
        blob = dataOrFile;
      }
      var fname = 'cov_' + Date.now() + '_' + Math.floor(Math.random()*9999) + (ext || '.jpg');
      var fake = 8;
      var timer = setInterval(function(){
        fake = Math.min(fake + Math.random()*11, 88);
        if (typeof setUpBar === 'function') setUpBar(Math.floor(fake));
      }, 180);
      var r = await sb.storage.from('stories').upload(fname, blob, { cacheControl: '31536000', upsert: false });
      clearInterval(timer);
      if (r.error) {
        console.error(r.error);
        if (typeof showUpBar === 'function') showUpBar(false);
        return null;
      }
      if (typeof setUpBar === 'function') setUpBar(100);
      setTimeout(function(){ if (typeof showUpBar === 'function') showUpBar(false); }, 350);
      var pub = sb.storage.from('stories').getPublicUrl(fname);
      return pub.data.publicUrl;
    } catch(e) {
      console.error(e);
      if (typeof showUpBar === 'function') showUpBar(false);
      return null;
    }
  }

  function applyCoverNow(url) {
    try {
      var c = el('upCover');
      if (c) {
        c.src = url || DEFAULT_COVER;
        c.onclick = function(){ viewFullImage(c.src); };
      }
      if (me && usersCache[me.name]) {
        usersCache[me.name].cover = url || null;
        me.cover = url || null;
      }
    } catch(e) {}
  }

  var oldInp = el('coverPickInput');
  if (oldInp) oldInp.remove();

  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*,.gif';
  inp.style.display = 'none';
  inp.id = 'coverPickInput';
  inp.onchange = function(e) {
    var f = e.target.files[0];
    if (!f) return;
    toast('⏳ جاري رفع الغلاف...');
    var isGif = f.type === 'image/gif';
    if (isGif) {
      uploadCoverWithProgress(f, '.gif').then(async function(url) {
        if (!url) {
          var reader = new FileReader();
          reader.onload = async function(ev) {
            await updateMe({ cover: ev.target.result });
            applyCoverNow(ev.target.result);
            toast('تم تغيير الغلاف ✅');
            closeModal('coverMenuModal');
          };
          reader.readAsDataURL(f);
          return;
        }
        await updateMe({ cover: url });
        applyCoverNow(url);
        toast('تم تغيير الغلاف ✅');
        closeModal('coverMenuModal');
      });
    } else {
      compressImg(f, function(dataUrl) {
        uploadCoverWithProgress(dataUrl, '.jpg').then(async function(url) {
          var finalUrl = url || dataUrl;
          await updateMe({ cover: finalUrl });
          applyCoverNow(finalUrl);
          toast('تم تغيير الغلاف ✅');
          closeModal('coverMenuModal');
        });
      }, 900);
    }
    e.target.value = '';
  };
  document.body.appendChild(inp);

  if (!el('profAvaInput')) {
    var ai = document.createElement('input');
    ai.type = 'file';
    ai.accept = 'image/*';
    ai.style.display = 'none';
    ai.id = 'profAvaInput';
    ai.onchange = function(e) {
      var f = e.target.files[0];
      if (!f) return;
      toast('⏳ جاري تحديث الصورة...');
      compressImg(f, async function(d) {
        var url = await (window.uploadMedia ? uploadMedia(d, '.jpg') : null);
        await updateMe({ avatar: url || d });
        toast('تم تغيير الصورة ✅');
        try { openUserProfile(me.name); } catch(e) {}
        try { updateProfile(); } catch(e) {}
      });
      e.target.value = '';
    };
    document.body.appendChild(ai);
  }

  try {
    var existing = el('coverMenuItem');
    if (existing) existing.remove();
    var existingModal = el('coverMenuModal');
    if (existingModal) existingModal.remove();
    var lists = document.querySelectorAll('#s-settings .menu-list');
    var tgt = lists[lists.length - 1];
    if (tgt) {
      var mi = document.createElement('div');
      mi.className = 'm-item';
      mi.id = 'coverMenuItem';
      mi.innerHTML = '<span>🖼️ غلاف البروفايل</span><span>👈</span>';
      mi.onclick = function(){ openModal('coverMenuModal'); };
      tgt.insertBefore(mi, tgt.firstChild);
      var md = document.createElement('div');
      md.className = 'modal';
      md.id = 'coverMenuModal';
      md.innerHTML = '<div class="m-card2" style="width:300px">'
        + '<h3>🖼️ غلاف البروفايل</h3>'
        + '<button style="background:var(--acc);color:#fff" onclick="closeModal(\'coverMenuModal\');el(\'coverPickInput\').click()">📷 اختيار / تغيير الغلاف</button>'
        + '<button style="background:#7a8694;color:#fff" onclick="rmCover()">🗑️ إزالة الغلاف (رجوع للافتراضي)</button>'
        + '<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'coverMenuModal\')">إغلاق</button>'
        + '</div>';
      document.body.appendChild(md);
    }
  } catch(e) {}

  window.rmCover = async function() {
    try {
      await updateMe({ cover: null });
      if (me) me.cover = null;
      if (usersCache[me.name]) usersCache[me.name].cover = null;
      applyCoverNow(DEFAULT_COVER);
      toast('تم إزالة الغلاف — رجع للصورة الافتراضية');
      closeModal('coverMenuModal');
    } catch(e) {
      toast('خطأ في إزالة الغلاف');
    }
  };

  var m = el('userProfileModal');
  if (!m) return;
  m.innerHTML = '<div style="max-width:100%;width:100%;height:100%;background:var(--bg);display:flex;flex-direction:column" onclick="event.stopPropagation()">'
    + '<div style="flex:1;overflow-y:auto">'
    + '<div style="position:relative">'
    +   '<div style="position:relative;height:220px;overflow:hidden;background:#111">'
    +     '<img id="upCover" style="width:100%;height:100%;object-fit:cover;cursor:pointer">'
    +     '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.08) 40%,var(--bg) 100%);pointer-events:none"></div>'
    +     '<div id="upCoverCam" style="position:absolute;bottom:14px;left:14px;width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,.65);border:2px solid #fff;color:#fff;font-size:17px;cursor:pointer;z-index:4;display:none;align-items:center;justify-content:center">📷</div>'
    +   '</div>'
    +   '<button onclick="closeModal(\'userProfileModal\')" style="position:absolute;top:14px;left:14px;background:rgba(0,0,0,.55);border:none;color:#fff;width:38px;height:38px;border-radius:50%;font-size:18px;cursor:pointer;z-index:5">✕</button>'
    +   '<div id="upAvaWrap" style="position:absolute;bottom:-44px;right:18px;width:92px;height:92px;border-radius:50%;padding:4px;background:var(--card);border:3px solid #6b7280;box-shadow:0 4px 14px rgba(0,0,0,.55);cursor:pointer">'
    +     '<img id="upAva" style="width:100%;height:100%;border-radius:50%;object-fit:cover">'
    +     '<div id="upAvaCam" style="position:absolute;bottom:-2px;left:-2px;width:30px;height:30px;border-radius:50%;background:var(--acc);border:2px solid var(--card);color:#fff;font-size:13px;cursor:pointer;z-index:4;display:none;align-items:center;justify-content:center">📷</div>'
    +   '</div>'
    + '</div>'
    + '<div style="padding:52px 16px 8px">'
    +   '<div id="upName" style="font-size:20px;font-weight:bold;margin-bottom:4px"></div>'
    +   '<div id="upStatus" style="font-size:13px;color:var(--mut)"></div>'
    + '</div>'
    + '<div style="padding:0 16px 10px"><div style="display:flex;border-radius:12px;overflow:hidden;border:1px solid var(--line)">'
    +   '<button id="upTabMedia" onclick="upShowTab(\'media\')" style="flex:1;padding:12px;border:none;background:var(--acc);color:#fff;font-size:14px;font-weight:bold">الصور</button>'
    +   '<button id="upTabAudio" onclick="upShowTab(\'audio\')" style="flex:1;padding:12px;border:none;background:var(--card2);color:var(--txt);font-size:14px">التسجيلات</button>'
    + '</div></div>'
    + '<div style="padding:0 12px 16px">'
    +   '<div id="upMediaBox" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px"></div>'
    +   '<div id="upAudioBox" style="display:none"></div>'
    + '</div>'
    + '</div></div>';

  window._profName = '';

  window.openUserProfile = function(name) {
    try {
      var u = usersCache[name] || {};
      window._profName = name;
      var isMine = (me && name === me.name);
      el('upName').innerHTML = (window.styleName ? styleName(u) : escapeHtml(getDisplayName(u) || name))
        + ' <span style="font-size:14px;color:var(--mut)">• ' + (u.age || '--') + ' سنة</span>';
      el('upStatus').innerHTML = (u.status ? escapeHtml(u.status) + '<br>' : '')
        + ((window.isOnline && isOnline(u))
          ? '<span style="color:var(--grn)">● نشط الآن</span>'
          : '<span style="color:var(--mut)">● غير متصل</span>');
      var covSrc = (u.cover && u.cover.length > 5) ? u.cover : DEFAULT_COVER;
      var c = el('upCover');
      if (c) {
        c.src = covSrc;
        c.onclick = function(){ viewFullImage(covSrc); };
      }
      var avSrc = u.avatar || (window._defAva ? _defAva(u) : '');
      var av = el('upAva');
      if (av) {
        if (avSrc) { av.style.display = 'block'; av.src = avSrc; }
        else { av.style.display = 'none'; }
      }
      var cc = el('upCoverCam'), ac = el('upAvaCam');
      if (isMine) {
        if (cc) {
          cc.style.display = 'flex';
          cc.onclick = function(e) {
            e.stopPropagation();
            el('coverPickInput').click();
          };
        }
        if (ac) {
          ac.style.display = 'flex';
          ac.onclick = function(e) {
            e.stopPropagation();
            el('profAvaInput').click();
          };
        }
      } else {
        if (cc) cc.style.display = 'none';
        if (ac) ac.style.display = 'none';
      }
      var wrap = el('upAvaWrap');
      if (wrap) {
        sb.from('stories').select('id,views,stime').eq('author', name).gt('stime', Date.now() - 86400000).then(function(d) {
          var list = (d && d.data) || [];
          var unseen = false;
          if (!isMine) {
            for (var i = 0; i < list.length; i++) {
              var v = list[i].views || [];
              if (v.indexOf && v.indexOf(me.name) === -1) { unseen = true; break; }
            }
          }
          var green = (list.length > 0) && (isMine || unseen);
          wrap.style.borderColor = green ? 'var(--grn)' : '#6b7280';
          wrap.style.boxShadow = green ? '0 0 14px rgba(34,197,94,.6)' : '0 4px 14px rgba(0,0,0,.55)';
          wrap.onclick = function() {
            if (green) {
              closeModal('userProfileModal');
              openAuthorStories(name);
            } else {
              toast(list.length ? '👀 شفت استوريه خلاص' : '😴 مفيش استوري جديد');
            }
          };
        }).catch(function(){});
      }
      upShowTab('media');
      openModal('userProfileModal');
      loadUserMedia(name);
    } catch(e) {
      console.error(e);
    }
  };
})();

/* ===== تكبير صورة البروفايل + صورة الحالة تفتح خاص 💬 ===== */
(function(){
var _ouP=window.openUserProfile;
window.openUserProfile=function(name){
  var r=_ouP(name);
  try{
    var av=el('upAva');
    if(av){av.style.cursor='pointer';av.title='اضغط لتكبير الصورة';av.onclick=function(e){e.stopPropagation();if(av.src)viewFullImage(av.src);};}
  }catch(e){}
  return r;
};
var _csa='';
var _oAS=window.openAuthorStories;
window.openAuthorStories=async function(author,startIdx){_csa=author;return _oAS(author,startIdx);};
var _sShow=window._showCurStory;
window._showCurStory=async function(){
  var r=await _sShow();
  try{
    var box=el('storyViewBox');if(!box)return r;
    var av=box.querySelector('img');
    if(av&&_csa){
      av.style.cursor='pointer';
      av.title='اضغط للدخول في خاص';
      av.onclick=function(e){
        e.stopPropagation();
        if(_csa!==me.name){closeModal('storyViewModal');openUser(_csa);}
        else{closeModal('storyViewModal');openUserProfile(me.name);}
      };
    }
  }catch(e){}
  return r;
};
})();

/* ===== زوم بإصبعين على الصور المكبرة 🔍 ===== */
(function(){
var img=el('fullImageView');
if(!img)return;
img.style.touchAction='none';
var st={scale:1,x:0,y:0,dist:0,sx:0,sy:0};
function apply(){
  img.style.transformOrigin='0 0';
  img.style.transform='translate('+st.x+'px,'+st.y+'px) scale('+st.scale+')';
}
function reset(){st.scale=1;st.x=0;st.y=0;apply();}
img.addEventListener('touchstart',function(e){
  if(e.touches.length===2){
    var dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;
    st.dist=Math.sqrt(dx*dx+dy*dy);
  }else if(e.touches.length===1&&st.scale>1){
    st.sx=e.touches[0].clientX-st.x;st.sy=e.touches[0].clientY-st.y;
  }
},{passive:true});
img.addEventListener('touchmove',function(e){
  e.preventDefault();
  if(e.touches.length===2){
    var dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;
    var d=Math.sqrt(dx*dx+dy*dy);
    if(st.dist>0){st.scale=Math.min(5,Math.max(1,st.scale*(d/st.dist)));apply();}
    st.dist=d;
  }else if(e.touches.length===1&&st.scale>1){
    st.x=e.touches[0].clientX-st.sx;st.y=e.touches[0].clientY-st.sy;apply();
  }
},{passive:false});
img.addEventListener('touchend',function(e){
  if(e.touches.length===0){
    st.dist=0;
    if(st.scale<=1.05){st.scale=1;st.x=0;st.y=0;apply();}
  }
});
var _lt=0;
img.addEventListener('touchend',function(e){
  var now=Date.now();
  if(now-_lt<350){
    if(st.scale>1){reset();}
    else{
      st.scale=2.5;
      var r=img.getBoundingClientRect();
      st.x=(r.width/2-(e.changedTouches[0].clientX-r.left))*1.5;
      st.y=(r.height/2-(e.changedTouches[0].clientY-r.top))*1.5;
      apply();
    }
  }
  _lt=now;
});
var _vfO=window.viewFullImage;
window.viewFullImage=function(src){reset();return _vfO(src);};
})();

/* ===== حبة "رسائل جديدة" ⬇️ زي واتساب ===== */
(function(){
var _cnt=0;
var pill=document.createElement('div');
pill.id='newMsgPill';
pill.style.cssText='position:fixed;bottom:118px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;padding:9px 20px;border-radius:26px;font-size:13px;font-weight:bold;cursor:pointer;z-index:95;display:none;box-shadow:0 4px 14px rgba(0,0,0,.5);white-space:nowrap;border:1px solid rgba(255,255,255,.2)';
pill.onclick=function(){
  _cnt=0;pill.style.display='none';
  try{
    var b=el('chatBox');
    userScrolledUp=false;
    b.scrollTop=b.scrollHeight;
    var k=b.querySelectorAll('.bub');
    if(k.length&&k[k.length-1].scrollIntoView){try{k[k.length-1].scrollIntoView({behavior:'smooth',block:'end'});}catch(e){}}
  }catch(e){}
};
document.body.appendChild(pill);
var _apN=window.appendMsg;
window.appendMsg=function(m){
  var r=_apN(m);
  try{
    if(m&&m.from&&me&&m.from!==me.name&&m.type!=='system'&&chat){
      var b=el('chatBox');
      var away=(b.scrollHeight-b.scrollTop-b.clientHeight)>350;
      if(away||userScrolledUp){
        _cnt++;
        pill.innerText='↓ '+(_cnt===1?'رسالة جديدة':_cnt+' رسائل جديدة');
        pill.style.display='block';
        if(me.sndOther!==false&&!document.hidden){try{beep(900);}catch(e){}}
      }
    }
  }catch(e){}
  return r;
};
try{
  var b=el('chatBox');
  b.addEventListener('scroll',function(){
    try{
      if((b.scrollHeight-b.scrollTop-b.clientHeight)<150){_cnt=0;pill.style.display='none';}
    }catch(e){}
  },{passive:true});
}catch(e){}
var _sm=window.subMsgs;
window.subMsgs=async function(){
  _cnt=0;pill.style.display='none';
  return _sm();
};
})();

/* ===== تحسين خلفية شاشة الدخول ===== */
(function(){
try{
  var st=document.createElement('style');
  st.textContent='#loginModal .login-card{background:rgba(10,15,30,.88)!important;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.18)!important;box-shadow:0 8px 40px rgba(0,0,0,.6)}#loginModal .auth-body{background:transparent}#loginModal .auth-tabs{background:rgba(0,0,0,.35)!important}';
  document.head.appendChild(st);
}catch(e){}
})();

/* ===== صفحة الافتتاح الكاملة (للزائر قبل الدخول) 🎨 ===== */
(function(){
var LOGO='https://cdn.phototourl.com/member/2026-10-02-8e80c6a6-76f8-4d1d-9ddf-3f63c207a845.jpg';
var BG='https://cdn.phototourl.com/free/2026-09-18-fb7fe613-5e96-4c2a-ab72-b4f4cc12f7fb.jpg';
var YT='https://youtube.com/@medosonic20?si=3VrimbKDb-fAXLvh';
function _build(){
  if(me||el('landingPage'))return;
  var d=document.createElement('div');
  d.id='landingPage';
  d.style.cssText='position:fixed;inset:0;z-index:9998;overflow-y:auto;background:linear-gradient(rgba(5,2,15,.78),rgba(5,2,15,.88)),url('+BG+') center/cover fixed';
  d.innerHTML='<div style="min-height:100%;display:flex;flex-direction:column;align-items:center;padding:34px 16px 50px;text-align:center">'
  +'<img src="'+LOGO+'" style="width:130px;height:130px;object-fit:contain;border-radius:26px;box-shadow:0 0 46px rgba(255,0,120,.55),0 0 90px rgba(140,0,255,.35);animation:lpPulse 1.6s ease-in-out infinite alternate">'
  +'<h1 style="color:#ff4fd8;font-size:44px;font-weight:900;margin:14px 0 4px;text-shadow:0 0 22px rgba(255,79,216,.75),0 2px 6px #000;font-family:system-ui">شات سونيك ⚡</h1>'
  +'<p style="color:#ffd6f5;font-size:16px;font-weight:bold;text-shadow:0 1px 5px #000;margin-bottom:8px">💜 أقوى دردشة عربية — سونيك ورفاقه 💜</p>'
  +'<p style="color:rgba(255,255,255,.85);font-size:13px;margin-bottom:22px;text-shadow:0 1px 4px #000">شات بنات | شات شباب | دردشة عامة | حالات | ألعاب 🎮</p>'
  +'<div style="width:100%;max-width:560px;background:rgba(8,4,18,.72);border:1px solid rgba(255,255,255,.14);border-radius:20px;padding:18px;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)">'
  +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'
  +'<button onclick="lpOpen(\'member\')" style="padding:13px 6px;border:none;border-radius:12px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;font-size:14px;font-weight:bold;cursor:pointer">🚪 دخول</button>'
  +'<button onclick="lpOpen(\'register\')" style="padding:13px 6px;border:none;border-radius:12px;background:linear-gradient(135deg,#ff2f92,#c0137a);color:#fff;font-size:14px;font-weight:bold;cursor:pointer">👤+ تسجيل حساب</button>'
  +'<button onclick="lpOpen(\'guest\')" style="padding:13px 6px;border:none;border-radius:12px;background:#15151f;border:1px solid rgba(255,255,255,.2);color:#fff;font-size:14px;font-weight:bold;cursor:pointer">👥 دخول الزوار</button>'
  +'<button onclick="window.open(\''+YT+'\',\'_blank\')" style="grid-column:span 2;padding:13px 6px;border:none;border-radius:12px;background:linear-gradient(135deg,#ff0000,#b91c1c);color:#fff;font-size:14px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" fill="#fff" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>اشترك في قناتي</button>'
  +'</div></div>'
  +'<div style="width:100%;max-width:560px;background:rgba(8,4,18,.72);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:16px;margin-top:16px;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)">'
  +'<p style="color:rgba(255,255,255,.92);font-size:12.5px;line-height:2;margin:0;text-align:justify">شات سونيك هي دردشة عربية مجانية تجمع الشباب والبنات في بيئة آمنة وممتعة. تواصل مع أصدقاء جدد من كل الدول العربية، أرسل حالات وصور وتسجيلات صوتية، العب ألعاب مع أصحابك، وشارك إبداعاتك على الحائط. دردشة مصرية وعربية بنظام مراقبة لحماية أعضائها، مع غرف دردشة عامة ومحادثات خاصة مشفرة.</p>'
  +'<p style="color:rgba(255,255,255,.55);font-size:11px;margin:10px 0 0;text-align:center">شات بنات | دردشة بنات | دردشة عربية | شات مصري | دردشة بدون تسجيل | شات سونيك ⚡</p>'
  +'</div>'
  +'<p style="color:rgba(255,255,255,.4);font-size:11px;margin-top:18px">⚡ جميع الحقوق محفوظة © 2026 شات سونيك — حقوق وتراخيص Medo Sonic</p>'
  +'</div>';
  document.body.appendChild(d);
  var st=document.createElement('style');
  st.textContent='@keyframes lpPulse{0%{transform:scale(1)}100%{transform:scale(1.06)}}';
  document.head.appendChild(st);
}
window.lpOpen=function(tab){
  try{var d=el('landingPage');if(d)d.remove();}catch(e){}
  try{el('loginModal').classList.remove('hide');}catch(e){}
  try{
    var tabs=document.querySelectorAll('#loginModal .auth-tab');
    var map={guest:0,member:1,register:2};
    if(tabs[map[tab]])tabs[map[tab]].click();
  }catch(e){}
};
var _lm=el('loginModal');
_lm.classList.add('hide');
var _prv=window.loginGuest,_prm=window.loginMember,_prg=window.register;
window.loginGuest=async function(){var r=await _prv();try{if(me){var d=el('landingPage');if(d)d.remove();}}catch(e){}return r;};
window.loginMember=async function(){var r=await _prm();try{if(me){var d=el('landingPage');if(d)d.remove();}}catch(e){}return r;};
window.register=async function(){var r=await _prg();try{if(me){var d=el('landingPage');if(d)d.remove();}}catch(e){}return r;};
var _chk=function(){if(!me)_build();};
_chk();
})();

/* ===== تعبئة قوائم العمر (16 - 100) 🎂 ===== */
(function(){
function _fill(id){
  var s=el(id);if(!s)return;
  var h='<option value="" disabled selected>اختار سنك</option>';
  for(var i=16;i<=100;i++)h+='<option value="'+i+'">'+i+' سنة</option>';
  s.innerHTML=h;
}
try{_fill('rAge');_fill('gAge');}catch(e){}
})();

/* ===== قسم المميزات والأسئلة الشائعة في صفحة الافتتاح ===== */
(function(){
try{
if(!el('lpFeatCSS')){
var st=document.createElement('style');st.id='lpFeatCSS';
st.textContent='.lpH{color:#ff9fe0;text-align:center;font-size:19px;font-weight:900;text-shadow:0 0 14px rgba(255,79,216,.5);margin:8px 0 2px}.lpGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.lpCard{background:rgba(18,6,28,.72);border:1px solid rgba(255,79,216,.28);border-radius:14px;padding:14px 12px;text-align:center;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}.lpW{text-align:right}.lpW>div{display:flex;gap:12px;align-items:flex-start}.lpW .lpIc{margin-bottom:0}.lpIc{font-size:30px;margin-bottom:6px;filter:drop-shadow(0 0 8px rgba(255,79,216,.7))}.lpT{color:#ffb8ec;font-weight:bold;font-size:14.5px;margin-bottom:4px}.lpB{color:rgba(255,255,255,.88);font-size:12px;line-height:1.95}.lpBtn{margin-top:10px;background:rgba(255,79,216,.12);border:1px solid rgba(255,79,216,.45);color:#ffb8ec;border-radius:10px;padding:8px 16px;font-size:12px;font-weight:bold;cursor:pointer}.lpFAQ{background:rgba(18,6,28,.72);border:1px solid rgba(255,79,216,.28);border-radius:14px;padding:16px 14px;text-align:right}';
document.head.appendChild(st);
}
}catch(e){}
window.lpDoc=function(k){
var D={
terms:{t:'📜 شروط الاستخدام — شات سونيك',b:'1) دخولك واستخدامك للموقع يعني موافقتك الكاملة على هذه الشروط.\n2) يمنع منعاً باتاً: الكلام المسيء، السباب، الطائفية، التحريض على الكره، أو أي محتوى مخالف.\n3) يمنع نشر الروابط والإعلانات داخل الشات إلا بإذن الإدارة.\n4) يمنع استخدام أسماء نابية أو مخلة بالآداب.\n5) يمنع نشر صور أو فيديوهات غير لائقة.\n6) احترم جميع الأعضاء والمشرفين، والقرارات الإدارية نهائية.\n7) المخالفة تعرض صاحبها للكتم أو الطرد أو الحظر النهائي حسب جسامتها.'},
safety:{t:'🛡️ سياسة الأمان — شات سونيك',b:'1) لا تشارك بياناتك الشخصية (رقم الهاتف، العنوان، بيانات البنك أو المحافظ) مع أي شخص مهما كانت الثقة.\n2) لا تشارك كلمة مرورك مع أي أحد، والإدارة لن تطلبها منك أبداً.\n3) أبلغ الإدارة فوراً عن أي سلوك مزعج عبر زر الإبلاغ 🚨.\n4) المحادثات الخاصة سرية، وتخضع لرقابة إدارية لضمان سلامة الجميع.\n5) أي جهاز مخالف يتم حظره نهائياً للحفاظ على بيئة آمنة.\n6) تذكر دائماً: ما تنشره على الإنترنت قد يبقى للأبد.'},
rules:{t:'🔨 قواعد الشات',b:'1) ممنوع نشر روابط خارجية أو إعلانات.\n2) ممنوع استخدام ألقاب نابية أو مسيئة.\n3) احترم الجميع ولا تلاحق أي عضو بالإزعاج.\n4) ممنوع الطائفية والتحريض والسباب بأي شكل.\n5) ممنوع نشر صور غير لائقة أو تضليل الآخرين.\n6) ممنوع انتحال شخصية الإدارة أو أسماء الأعضاء.\n7) المخالفة الأولى تنبيه، وتكرارها يعرضك للكتم أو الطرد أو الحظر.'}
};
var c=D[k];if(!c)return;
var m=el('lpDocModal');
if(!m){
m=document.createElement('div');m.id='lpDocModal';m.className='modal';
m.innerHTML='<div class="m-card2" style="width:330px;max-height:82vh"><h3 id="lpDocT"></h3><div id="lpDocB" style="font-size:12.5px;line-height:2.1;color:var(--txt);white-space:pre-line;text-align:right;overflow-y:auto;max-height:52vh"></div><button style="background:var(--acc);color:#fff" onclick="closeModal(\'lpDocModal\')">فهمت ✅</button></div>';
document.body.appendChild(m);
}
el('lpDocT').innerText=c.t;
el('lpDocB').innerText=c.b;
m.classList.add('open');
};
var _done=false;
function _build(){
if(_done)return;
var d=el('landingPage');if(!d)return;
var inner=d.children[0];if(!inner)return;
if(el('lpFeatures')){_done=true;return;}
var s=document.createElement('div');
s.id='lpFeatures';
s.style.cssText='width:100%;max-width:560px;margin-top:18px;display:flex;flex-direction:column;gap:14px';
var h='';
h+='<h2 class="lpH">🎁 اللي ستحصل عليه فعلاً عند استخدام شات سونيك؟</h2>';
h+='<div class="lpGrid">';
h+='<div class="lpCard"><div class="lpIc">👥</div><div class="lpT">مجتمع متنوع</div><div class="lpB">أعضاء من مختلف الدول العربية يجتمعون في مكان واحد.</div></div>';
h+='<div class="lpCard"><div class="lpIc">🛡️</div><div class="lpT">واجهة سهلة الاستخدام</div><div class="lpB">صفحة خفيفة ومتجاولة تعمل على الهاتف والكمبيوتر.</div></div>';
h+='<div class="lpCard"><div class="lpIc">⭐</div><div class="lpT">تحديثات مستمرة</div><div class="lpB">تطوير دائم للواجهة والمميزات بشكل دوري.</div></div>';
h+='<div class="lpCard"><div class="lpIc">🔒</div><div class="lpT">دردشة آمنة</div><div class="lpB">خصوصية وآمان وتنبيه دائم بعدم مشاركة البيانات الحساسة.</div></div>';
h+='</div>';
h+='<div class="lpCard lpW"><div><div class="lpIc">📋</div><div style="flex:1"><div class="lpT">شروط الاستخدام</div><div class="lpB">يمنع الكلام المسيء أو الطائفي أو المخالف، ويمنع إرسال روابط أو إعلانات مزعجة. يجب احترام جميع الأعضاء والمشرفين داخل الدردشة.</div><button class="lpBtn" onclick="lpDoc(\'terms\')">قراءة جميع الشروط</button></div></div></div>';
h+='<div class="lpCard lpW"><div><div class="lpIc">🛡️</div><div style="flex:1"><div class="lpT">سياسة الأمان</div><div class="lpB">خصوصيتك وبياناتك لا يتم مشاركتها مع أي جهة خارجية، مع مراقبة إدارية لضمان بيئة آمنة للجميع وإمكانية الإبلاغ الفوري.</div><button class="lpBtn" onclick="lpDoc(\'safety\')">قراءة سياسة الأمان</button></div></div></div>';
h+='<div class="lpCard lpW"><div><div class="lpIc">🔨</div><div style="flex:1"><div class="lpT">قواعد الشات</div><div class="lpB">عدم نشر روابط خارجية، عدم استخدام ألقاب نابية، احترام الأعضاء والمشرفين، وعدم تكرار الرسائل.</div><button class="lpBtn" onclick="lpDoc(\'rules\')">عرض القواعد</button></div></div></div>';
h+='<div class="lpCard lpW"><div><div class="lpIc">👤</div><div style="flex:1"><div class="lpT">الملف الشخصي</div><div class="lpB">يمكنك تعديل ملفك الشخصي بسهولة: اسمك، صورتك، حالتك، عمرك، جنسك ودولتك، بالإضافة إلى لون اسمك الخاص.</div></div></div></div>';
h+='<div class="lpCard lpW"><div><div class="lpIc">💬</div><div style="flex:1"><div class="lpT">الرسائل الخاصة</div><div class="lpB">محادثات خاصة مع الأصدقاء، ردود ورياكشنز على الرسائل، إشعارات الرسائل الجديدة، ورد على الحالات مباشرة.</div></div></div></div>';
h+='<div class="lpCard lpW"><div><div class="lpIc">🔔</div><div style="flex:1"><div class="lpT">إشعارات الدردشة</div><div class="lpB">تنبيهات فورية للرسائل الجديدة والإشعارات المهمة، حتى لو كنت تتصفح شاشة أخرى في الموقع.</div></div></div></div>';
h+='<div class="lpCard lpW"><div><div class="lpIc">⏱️</div><div style="flex:1"><div class="lpT">حالات 24 ساعة</div><div class="lpB">انشر صورك وفيديوهاتك وحالاتك النصية، تختفي تلقائياً بعد 24 ساعة، وتعرف مين شاف حالتك 👁️.</div></div></div></div>';
h+='<div class="lpCard lpW"><div><div class="lpIc">🖼️</div><div style="flex:1"><div class="lpT">مشاركة الصور</div><div class="lpB">مشاركة الصور مباشرة من الإنترنت أو من جهازك الشخصي مع أصدقائك والجميع.</div></div></div></div>';
h+='<div class="lpCard lpW"><div><div class="lpIc">🎵</div><div style="flex:1"><div class="lpT">الصوتيات</div><div class="lpB">سجل صوتك وأرسله في المحادثات الخاصة بضغطة واحدة، واستمع لتسجيلات أصدقائك مباشرة.</div></div></div></div>';
h+='<div class="lpCard lpW"><div><div class="lpIc">🎬</div><div style="flex:1"><div class="lpT">مشاركة الفيديوهات</div><div class="lpB">شارك فيديوهات يوتيوب المفضلة لديك على حائط الإبداع لتشاهدها الجميع مباشرة.</div></div></div></div>';
h+='<div class="lpCard lpW"><div><div class="lpIc">🎮</div><div style="flex:1"><div class="lpT">ألعاب تفاعلية</div><div class="lpB">قسم ألعاب كامل داخل الموقع — العب وقت ما تحب.</div></div></div></div>';
h+='<div class="lpCard lpW"><div><div class="lpIc">🔐</div><div style="flex:1"><div class="lpT">الأمان والخصوصية</div><div class="lpB">شات سونيك يضمن لك حماية أمان بياناتك الشخصية، حيث يتم تشفير جميع البيانات والمعلومات ولا يتم مشاركتها مع أي جهة خارجية. لكن احرص دائماً على عدم مشاركة معلومات حساسة على ملفك الشخصي.</div></div></div></div>';
h+='<h2 class="lpH" style="margin-top:10px">❓ أسئلة شائعة</h2>';
h+='<div class="lpFAQ"><div class="lpT">🎁 ما الذي ستحصل عليه فعلاً عند استخدام شات سونيك؟</div><div class="lpB">تخصيص لون اسمك في الدردشة، إرسال رسائل غير محدودة سواء كانت خاصة أو عامة، مشاركة الصور من المعرض أو بالكاميرا مباشرة، إرسال تسجيلات صوتية، رموز سمايلي وستيكرات، الرد على رسالة معينة والرياكشنز عليها، تجاهل وحظر أي شخص مزعج، تغيير صورتك الشخصية وحالتك وعمرك، البحث عن أي مستخدم في قائمة المتواجدين، حالات تظهر لمدة 24 ساعة وتعرف مين شافها، وألعاب تلعبها مع أصحابك داخل الموقع.</div></div>';
h+='<div class="lpFAQ"><div class="lpT">🚫 كيفية تجاهل الأشخاص المزعجين؟</div><div class="lpB">يمكنك تفعيل خيار "🔒 الأصدقاء فقط" من الإعدادات → الخصوصية، وبكده لن يستطيع غير أصدقائك إرسال رسائل إليك نهائياً — أي رسالة من شخص غير صديق لن تصلك إطلاقاً، حتى ردود الحالات.</div></div>';
h+='<div class="lpFAQ"><div class="lpT">⚠️ كيف أتجنب الخطر؟</div><div class="lpB">استخدم أسماء لائقة ومناسبة. احترم قوانين شات سونيك والمشاركين الآخرين في الدردشة. تجنب الإساءة لأي شخص أو التعدي على أي مذهب ديني. لا تشارك بياناتك الشخصية (رقم هاتفك، عنوانك، حساباتك البنكية) مع أحد.</div></div>';
s.innerHTML=h;
var cp=null;
var ps=inner.querySelectorAll('p');
for(var i=0;i<ps.length;i++){if((ps[i].innerText||'').indexOf('جميع الحقوق')>-1){cp=ps[i];break;}}
if(cp)inner.insertBefore(s,cp);else inner.appendChild(s);
_done=true;
}
var _n=0;
var _iv=setInterval(function(){_build();_n++;if(_done||_n>200)clearInterval(_iv);},600);
})();

/* ===== 🔒 الأصدقاء فقط ===== */
(function(){
try{
  var sp=el('s-privacy');
  if(sp&&!el('pFriendsOnly')){
    var anchor=sp.querySelector('.m-item');
    var row=document.createElement('div');
    row.className='set-row';
    row.innerHTML='<div><h4>🔒 الأصدقاء فقط</h4><p>لن يستطيع غير أصدقائك إرسال رسائل إليك نهائياً</p></div><label class="sw"><input type="checkbox" id="pFriendsOnly" onchange="setPref(\'friendsOnly\',this.checked)"><span class="sl"></span></label>';
    if(anchor)sp.insertBefore(row,anchor);else sp.appendChild(row);
  }
}catch(e){}
function _sync(){
  try{if(me&&el('pFriendsOnly'))el('pFriendsOnly').checked=(me.friendsOnly===true);}catch(e){}
}
setInterval(_sync,1500);
function _canSend(target){
  try{
    if(!me)return true;
    if(isOwnerName(target)||isAdmin())return true;
    var tu=usersCache[target];
    if(!tu||tu.friendsOnly!==true)return true;
    return (tu.friends&&tu.friends.indexOf(me.name)>-1);
  }catch(e){return true;}
}
window._canSendTo=_canSend;
var _sm=window.sendMsg;
window.sendMsg=async function(){
  try{
    if(chat&&chat.type==='user'&&!_canSend(chat.id)){
      return toast('🔒 هذا المستخدم يستقبل رسائل الأصدقاء فقط');
    }
  }catch(e){}
  return _sm();
};
var _ssr=window.sendStoryReply;
window.sendStoryReply=function(author,sid,stype){
  try{
    if(author!==me.name&&!_canSend(author))return toast('🔒 هذا المستخدم يستقبل رسائل الأصدقاء فقط');
  }catch(e){}
  return _ssr(author,sid,stype);
};
})();

/* ===== ألعاب إضافية ===== */
(function(){
window.GAMES_LIST.push(
{name:'Zombie Catchers',desc:'اصطد الزومبي وأنقذ كوكب الأرض واجمع العملات',icon:'🧟',color:'#16a085',img:'https://img.gamemonetize.com/u1nspb6d6k05iahz4oc3qtbl0my3cwfi/512x384.jpg',url:'https://html5.gamemonetize.co/u1nspb6d6k05iahz4oc3qtbl0my3cwfi/'}
);
try{renderGamesList();}catch(e){}
})();
(function(){
window.GAMES_LIST.push(
{name:'Slash FRVR',desc:'قطّع الكرات بضغطة واحدة واصنع أطول قطع متتالي',icon:'⚽',color:'#c0392b',img:'https://img.gamemonetize.com/zq0kl2wz1k7i0j1u83lyokfzun3ualss/512x384.jpg',url:'https://html5.gamemonetize.co/zq0kl2wz1k7i0j1u83lyokfzun3ualss/'}
);
try{renderGamesList();}catch(e){}
})();
(function(){
window.GAMES_LIST.push(
{name:'Cut the Rope 2',desc:'قص الحبال ووصّل الحلوى لـ Om Nom في 160 مرحلة',icon:'🍬',color:'#8bc34a',img:'https://img.cdn.famobi.com/portal/html5games/images/tmp/CutTheRope2Teaser.jpg?v=0.2-9fd556a0',url:'https://play.famobi.com/cut-the-rope-2'}
);
try{renderGamesList();}catch(e){}
})();
(function(){
window.GAMES_LIST.push(
{name:'Jelly Collapse',desc:'اجمع الهلاميات المتشابهة وانهارها في تحدي ممتع',icon:'🫧',color:'#22c55e',img:'https://assets.abcya.com/webp_b2eaf41f-0561-4727-863d-9c683ce19baf.jpg',url:'https://play.famobi.com/jelly-collapse'}
);
try{renderGamesList();}catch(e){}
})();
(function(){
window.GAMES_LIST.push(
{name:'Emergency Surgery',desc:'دورك طبيب الطوارئ — أجرِ العمليات بنفسك في وقت ضاغط',icon:'🏥',color:'#ef4444',img:'https://img.cdn.famobi.com/portal/html5games/images/tmp/EmergencySurgeryTeaser.jpg?v=0.2-9fd556a0',url:'https://play.famobi.com/emergency-surgery'}
);
try{renderGamesList();}catch(e){}
})();
/* ============================================================
   ⚡ شات سونيك — script.js (الجزء 3: لوحة الأبطال + القصص المتقدمة + التحديثات + الحضور)
   ============================================================ */

/* ===== تعديل نصوص صفحة الافتتاح ===== */
(function(){
var _n=0;
var _iv=setInterval(function(){
  try{
    var cards=document.querySelectorAll('.lpCard, .lpFAQ');
    for(var i=0;i<cards.length;i++){
      var t=cards[i].innerText||'';
      if(t.indexOf('ألعاب تفاعلية')>-1){
        var b=cards[i].querySelector('.lpB');
        if(b&&b.innerText.indexOf('تحدى')>-1){
          b.innerText='قسم ألعاب كامل داخل الموقع — العب وقت ما تحب.';
        }
      }
      if(t.indexOf('تجاهل الأشخاص المزعجين')>-1){
        var b2=cards[i].querySelector('.lpB');
        if(b2){
          b2.innerText='يمكنك تفعيل خيار "🔒 الأصدقاء فقط" من الإعدادات → الخصوصية، وبكده لن يستطيع غير أصدقائك إرسال رسائل إليك نهائياً — أي رسالة من شخص غير صديق لن تصلك إطلاقاً، حتى ردود الحالات.';
        }
      }
    }
    _n++;
    if(_n>150)clearInterval(_iv);
  }catch(e){}
},700);
})();

/* ===== صفحات الشروط/الخصوصية/القواعد — ستايل بنفسجي متوهج ===== */
(function(){
var PAGES={
terms:{t:'📜 شروط الاستخدام — شات سونيك',b:'1) دخولك واستخدامك للموقع يعني موافقتك الكاملة على هذه الشروط.\n2) يمنع منعاً باتاً الكلام المسيء أو السباب أو الطائفية أو التحريض على الكره أو أي محتوى مخالف.\n3) يمنع نشر الروابط والإعلانات داخل الشات إلا بإذن الإدارة.\n4) يمنع استخدام أسماء نابية أو مخلة بالآداب.\n5) يمنع نشر صور أو فيديوهات غير لائقة.\n6) احترم جميع الأعضاء والمشرفين، وقرارات الإدارة نهائية.\n7) المخالفة تعرض صاحبها للكتم أو الطرد أو الحظر النهائي حسب جسامتها.'},
safety:{t:'🛡️ سياسة الأمان — شات سونيك',b:'1) لا تشارك بياناتك الشخصية (رقم الهاتف، العنوان، بيانات البنك أو المحافظ) مع أي شخص مهما كانت الثقة.\n2) لا تشارك كلمة مرورك مع أي أحد، والإدارة لن تطلبها منك أبداً.\n3) أبلغ الإدارة فوراً عن أي سلوك مزعج عبر زر الإبلاغ 🚨.\n4) المحادثات الخاصة سرية وتخضع لرقابة إدارية لضمان سلامة الجميع.\n5) أي جهاز مخالف يتم حظره نهائياً للحفاظ على بيئة آمنة.\n6) تذكر دائماً: ما تنشره على الإنترنت قد يبقى للأبد.'},
rules:{t:'🔨 قواعد الشات — شات سونيك',b:'1) ممنوع نشر روابط خارجية أو إعلانات.\n2) ممنوع استخدام ألقاب نابية أو مسيئة.\n3) احترم الجميع ولا تلاحق أي عضو بالإزعاج.\n4) ممنوع الطائفية والتحريض والسباب بأي شكل.\n5) ممنوع نشر صور غير لائقة أو تضليل الآخرين.\n6) ممنوع انتحال شخصية الإدارة أو أسماء الأعضاء.\n7) المخالفة الأولى تنبيه، وتكرارها يعرضك للكتم أو الطرد أو الحظر.'}
};
var ov=null;
function _build(){
  if(ov)return;
  ov=document.createElement('div');
  ov.id='lpPageOverlay';
  ov.style.cssText='position:fixed;inset:0;z-index:9999;background:#08030f;display:none;overflow-y:auto';
  ov.innerHTML='<div style="position:sticky;top:0;background:#0d0518;border-bottom:1px solid rgba(255,79,216,.35);display:flex;justify-content:center;align-items:center;gap:16px;padding:13px 8px;z-index:2">'
  +'<button onclick="lpPage(\'home\')" style="background:none;border:none;color:#ffb8ec;font-size:12px;font-weight:bold;cursor:pointer">الرئيسية</button>'
  +'<button onclick="lpPage(\'terms\')" id="lnkTerms" style="background:none;border:none;color:#ffb8ec;font-size:12px;cursor:pointer">شروط الاستخدام</button>'
  +'<button onclick="lpPage(\'safety\')" id="lnkSafety" style="background:none;border:none;color:#ffb8ec;font-size:12px;cursor:pointer">سياسة الأمان</button>'
  +'<button onclick="lpPage(\'rules\')" id="lnkRules" style="background:none;border:none;color:#ffb8ec;font-size:12px;cursor:pointer">قواعد الشات</button>'
  +'<a href="https://t.me/medosonic" target="_blank" style="color:#ffb8ec;font-size:12px;font-weight:bold;text-decoration:none">اتصل بنا</a>'
  +'</div>'
  +'<div style="max-width:640px;margin:26px auto;padding:0 14px">'
  +'<div style="position:relative;border:1px solid rgba(255,79,216,.65);border-radius:10px;box-shadow:0 0 26px rgba(255,79,216,.22),inset 0 0 26px rgba(255,79,216,.07);padding:22px 18px;background:rgba(20,6,30,.5)">'
  +'<button onclick="lpPage(\'home\')" style="position:absolute;top:12px;left:12px;background:none;border:none;color:#ffb8ec;font-size:17px;cursor:pointer;font-weight:bold">✕</button>'
  +'<h2 id="lpPageT" style="color:#ff9fe0;font-size:21px;font-weight:900;text-shadow:0 0 16px rgba(255,79,216,.55);margin:0 0 14px;text-align:right"></h2>'
  +'<p id="lpPageB" style="color:rgba(255,255,255,.94);font-size:13px;line-height:2.1;white-space:pre-line;text-align:right;margin:0"></p>'
  +'</div></div>';
  document.body.appendChild(ov);
}
window.lpPage=function(k){
  _build();
  if(k==='home'){ov.style.display='none';return;}
  var p=PAGES[k];if(!p)return;
  el('lpPageT').innerText=p.t;
  el('lpPageB').innerText=p.b;
  ['Terms','Safety','Rules'].forEach(function(x){var l=el('lnk'+x);if(l)l.style.fontWeight=(k==='terms'&&x==='Terms')||(k==='safety'&&x==='Safety')||(k==='rules'&&x==='Rules')?'bold':'normal';});
  ov.style.display='block';
  ov.scrollTop=0;
};
window.lpDoc=function(k){window.lpPage(k);};
})();

/* ===== 🔔 إشعار التحديث التلقائي ===== */
(function(){
var VK='app_ver_current';
function _check(){
  try{
    fetch('version.txt?t='+Date.now(),{cache:'no-store'})
    .then(function(r){return r.ok?r.text():null;})
    .then(function(v){
      if(!v)return;
      v=v.trim();
      if(!v)return;
      var cur=LS.getItem(VK);
      if(!cur){LS.setItem(VK,v);return;}
      if(v!==cur){
        if(el('updBar'))return;
        LS.setItem('app_ver_new',v);
        var bar=document.createElement('div');
        bar.id='updBar';
        bar.style.cssText='position:fixed;top:0;left:0;right:0;background:linear-gradient(90deg,#8b5cf6,#6d28d9);color:#fff;padding:13px 16px;text-align:center;font-size:13px;font-weight:bold;z-index:99999;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.5)';
        bar.innerHTML='🔄 تحديث جديد متاح — اضغط هنا لتحديث شات سونيك';
        bar.onclick=function(){
          try{LS.setItem(VK,LS.getItem('app_ver_new')||v);}catch(e){}
          location.reload(true);
        };
        document.body.appendChild(bar);
      }
    }).catch(function(){});
  }catch(e){}
}
_check();
setInterval(_check,300000);
})();

/* ===== حماية الصور الافتراضية: لو الجديدة فشلت نرجع لسونيك ===== */
(function(){
var FALLBACK='https://cdn.phototourl.com/free/2026-09-18-fb7fe613-5e96-4c2a-ab72-b4f4cc12f7fb.jpg';
var _defO=window._defAva;
if(_defO){
  var _c={};
  window._defAva=function(u){
    var g=(u&&u.gender==='أنثى')?'F':'M';
    var url=_defO(u);
    if(_c[g]==='bad')return FALLBACK;
    return url;
  };
}
['M','F'].forEach(function(g){
  var url=(g==='M')
    ?'https://cdn.phototourl.com/free/2026-09-23-e466167c-d14c-4d49-bf5e-dac6c612bc8e.jpg'
    :'https://cdn.phototourl.com/free/2026-09-23-9e2a1f47-8318-4b74-8e74-2a643e156af6.jpg';
  var img=new Image();
  img.onload=function(){_c[g]='ok';};
  img.onerror=function(){
    _c[g]='bad';
    try{
      document.querySelectorAll('img').forEach(function(im){
        if(im.src===url){im.src=FALLBACK;im.onerror=null;}
      });
      renderOnline&&renderOnline();
    }catch(e){}
  };
  img.src=url;
});
document.addEventListener('error',function(e){
  var t=e.target;
  if(!t||t.tagName!=='IMG')return;
  if(t.dataset.fb)return;
  if(t.src&&t.src.indexOf('cdn.phototourl.com')>-1){
    var isDef=(t.src.indexOf('2026-09-23')>-1||t.src.indexOf('2026-09-20-98')>-1||t.src.indexOf('2026-09-20-11')>-1);
    if(isDef){t.dataset.fb='1';t.src=FALLBACK;}
  }
},true);
})();

/* ===== شريط تقدم حقيقي لرفع الصور الشخصية ===== */
(function(){
function _uploadReal(blob){
  return new Promise(function(resolve){
    try{
      var fname='ava_'+Date.now()+'_'+Math.floor(Math.random()*9999)+'.jpg';
      var fake=0;
      var timer=setInterval(function(){
        fake=Math.min(fake+Math.random()*8,90);
        setUpBar(Math.floor(fake));
      },200);
      sb.storage.from('stories').upload(fname,blob,{cacheControl:'31536000',upsert:false}).then(function(r){
        clearInterval(timer);
        if(r.error){console.error('up err',r.error);resolve(null);return;}
        setUpBar(100);
        setTimeout(function(){showUpBar(false);},500);
        resolve(sb.storage.from('stories').getPublicUrl(fname).data.publicUrl);
      });
    }catch(e){clearInterval(timer);resolve(null);}
  });
}
function _wire(input){
  if(!input||input._upReal)return;
  input._upReal=true;
  input.addEventListener('change',function(e){
    var f=e.target.files[0];if(!f)return;
    compressImg(f,async function(d){
      try{
        showUpBar(true);setUpBar(0);
        toast('⏳ جاري رفع الصورة...');
        var url=await _uploadReal(dataURLtoBlob(d));
        var fin=url||d;
        await updateMe({avatar:fin});
        toast('تم تغيير الصورة ✅');
        try{openUserProfile(me.name);}catch(e){}
        try{updateProfile();}catch(e){}
      }catch(err){
        showUpBar(false);
        toast('❌ خطأ في الرفع: '+err.message);
      }
    });
  },true);
}
var _n=0;
var _iv=setInterval(function(){
  try{
    _wire(el('profAvaInput'));
    var ava=document.getElementById('avaInput');
    if(ava)_wire(ava);
    _n++;if(_n>400)clearInterval(_iv);
  }catch(e){}
},250);
})();

/* ===== إصلاح: صاحب الجلسة المحفوظة يدخل مباشرة بدون صفحة الافتتاح ===== */
(function(){
var _saved=LS.getItem('session');
if(!_saved)return;
var _n=0;
var _iv=setInterval(function(){
  try{
    var d=el('landingPage');
    if(d)d.remove();
    if(me){
      try{el('loginModal').classList.add('hide');}catch(e){}
      clearInterval(_iv);
    }
  }catch(e){}
  _n++;
  if(_n>150)clearInterval(_iv);
},200);
})();

/* ===== جلسة أوفلاين: دخول فوري بدون نت + مزامنة لما يرجع ===== */
(function(){
var SK='offline_session';
function _saveOff(u){
  try{LS.setItem(SK,JSON.stringify({name:u.name,data:u,t:Date.now()}));}catch(e){}
}
function _getOff(){try{return JSON.parse(LS.getItem(SK)||'null');}catch(e){return null;}}
var _enO=window.enter;
window.enter=function(u){
  try{_saveOff(u);}catch(e){}
  return _enO(u);
};
var _stO=window.startAll;
window.startAll=async function(){
  try{if(me)_saveOff(me);}catch(e){}
  return _stO();
};
window.addEventListener('online',function(){
  try{
    if(me){
      me.lastSeen=Date.now();
      sb.from('users').update({last_seen:Date.now()}).eq('name',me.name);
      startHeartbeat();
      toast('📡 النت رجع — تم تفعيل حضورك');
      renderOnline();
    }
  }catch(e){}
});
})();

/* ===== شاشة الفراغ الذكية: لما مفيش أحد متصل 🪐 ===== */
(function(){
var MYURL='https://medosonic20-lgtm.github.io/chat-sonic/';
var _t=el('usersList');
if(!_t)return;
var _mo=new MutationObserver(function(){
  try{
    var t=_t.innerText||'';
    var isEmpty=(t.indexOf('لا يوجد مستخدمين متصلين')>-1);
    var ex=el('emptyPromo');
    if(isEmpty&&!ex){
      var d=document.createElement('div');
      d.id='emptyPromo';
      d.style.cssText='text-align:center;padding:50px 20px;color:var(--txt)';
      d.innerHTML='<div style="font-size:15px;line-height:2.4">'
      +'قائمة الأشخاص النشطين فارغة الآن ! 🔔<br>'
      +'ماذا عن مشاركة الموقع مع الآخرين ؟<br>'
      +'لتجعل القائمة ممتلئة معاً 🚀</div>'
      +'<div onclick="try{navigator.clipboard.writeText(\''+MYURL+'\').then(function(){toast(\'📋 تم نسخ الرابط ✅\');},function(){toast(\''+MYURL+'\');});}catch(e){toast(\''+MYURL+'\');}" '
      +'style="display:inline-flex;align-items:center;gap:8px;margin-top:16px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.5);border-radius:26px;padding:12px 20px;cursor:pointer">'
      +'<span style="color:#34d399;font-size:13px;font-weight:bold;direction:ltr">'+MYURL+'</span>'
      +'<span style="background:#34d399;color:#0f172a;border-radius:6px;padding:4px 7px;font-size:13px">📋</span></div>';
      _t.appendChild(d);
    }else if(!isEmpty&&ex){
      ex.remove();
    }
  }catch(e){}
});
_mo.observe(_t,{childList:true,subtree:true,characterData:true});
})();

/* ===== 🎉 احتفالية كونفيتي عند نسخ رابط المشاركة ===== */
(function(){
var MYURL='https://medosonic20-lgtm.github.io/chat-sonic/';
var COLORS=['#ff4fd8','#22c55e','#0ea5e9','#eab308','#ef4444','#8b5cf6','#14b8a6','#f97316'];
var _confRunning=false;
window._confettiBurst=function(){
  if(_confRunning)return;
  _confRunning=true;
  var cv=document.createElement('canvas');
  cv.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:99998';
  document.body.appendChild(cv);
  var ctx=cv.getContext('2d');
  function _rs(){cv.width=innerWidth;cv.height=innerHeight;}
  _rs();
  var parts=[];
  for(var i=0;i<140;i++){
    parts.push({
      x:Math.random()*cv.width,
      y:-20-Math.random()*cv.height*0.5,
      w:5+Math.random()*7,
      h:8+Math.random()*10,
      c:COLORS[Math.floor(Math.random()*COLORS.length)],
      vy:2+Math.random()*3.5,
      vx:-1.5+Math.random()*3,
      rot:Math.random()*Math.PI,
      vr:-0.12+Math.random()*0.24,
      ribbon:Math.random()<0.12,
      rl:30+Math.random()*50
    });
  }
  var t0=Date.now();
  function _draw(){
    ctx.clearRect(0,0,cv.width,cv.height);
    var alive=false;
    parts.forEach(function(p){
      p.y+=p.vy;p.x+=p.vx+Math.sin(p.y/28)*0.7;p.rot+=p.vr;
      if(p.y<cv.height+30)alive=true;
      ctx.save();
      ctx.translate(p.x,p.y);ctx.rotate(p.rot);
      if(p.ribbon){
        ctx.strokeStyle=p.c;ctx.lineWidth=5;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(0,0);
        ctx.quadraticCurveTo(Math.sin(p.y/15)*12,p.rl/2,Math.cos(p.y/22)*8,p.rl);
        ctx.stroke();
      }else{
        ctx.fillStyle=p.c;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
      }
      ctx.restore();
    });
    if(alive&&Date.now()-t0<5000){requestAnimationFrame(_draw);}
    else{cv.remove();_confRunning=false;}
  }
  _draw();
};
var _n=0;
var _iv=setInterval(function(){
  try{
    var p=el('emptyPromo');
    if(p&&!p.dataset.conf){
      p.dataset.conf='1';
      p.addEventListener('click',function(){
        toast('📋 تم نسخ الرابط — شكراً لمشاركتك 🎉');
        window._confettiBurst();
      },true);
    }
    _n++;if(_n>200)clearInterval(_iv);
  }catch(e){}
},600);
})();

/* ===== لوحة أبطال الألعاب 🏆 ===== */
(function(){
var sm=null;
function _ensure(){
  if(!sm){
    sm=el('gameScoreModal');
    if(!sm){
      sm=document.createElement('div');sm.id='gameScoreModal';sm.className='modal';
      sm.innerHTML='<div class="m-card2" style="width:320px"><h3 id="gsTitle">🏆</h3><div id="gsInputRow" style="display:flex;gap:8px;align-items:center"><input id="gsInput" type="number" placeholder="اكتب نتيجتك" style="flex:1;padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--txt);border-radius:8px;font-size:16px;font-weight:bold;text-align:center"><button class="adm-btn grn" onclick="saveGameScore()" style="flex-shrink:0">💾 حفظ</button></div><div id="gsMyBest" style="font-size:11px;color:var(--mut);text-align:center;margin:6px 0"></div><div id="gsList" style="max-height:240px;overflow-y:auto"></div><button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'gameScoreModal\')">إغلاق</button></div>';
      document.body.appendChild(sm);
    }
  }
  sm.style.zIndex='1300';
}
var _cur='';
window.showScoreModal=function(g){
  if(!me)return toast('سجل دخولك أولاً');
  _cur=g||'';_ensure();
  el('gsTitle').innerText='🏆 '+_cur;
  el('gsInputRow').style.display='flex';
  el('gsInput').value='';
  window._loadGameScores();
  openModal('gameScoreModal');
};
window._loadGameScores=async function(){
  var list=el('gsList');
  list.innerHTML='<div style="text-align:center;color:var(--mut);padding:10px">جاري التحميل...</div>';
  var d=await sb.from('game_scores').select('*').eq('game',_cur).order('score',{ascending:false}).limit(10);
  var rows=d.data||[];
  var mine=rows.find(function(r){return r.player===me.name;});
  el('gsMyBest').innerText=mine?('أفضل نتيجتك: '+mine.score):'لم تسجل نتيجة بعد';
  if(!rows.length){list.innerHTML='<div style="text-align:center;color:var(--mut);padding:10px">لا توجد نتائج — كن أول بطل! 🏆</div>';return;}
  var medals=['🥇','🥈','🥉'];
  var h='';
  rows.forEach(function(r,i){
    var del=(window.isOwner&&isOwner())?' <button class="xbtn" style="padding:1px 6px;font-size:10px" onclick="delGameScore('+r.id+')">🗑️</button>':'';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 6px;border-bottom:1px solid var(--line)"><span style="font-size:13px;font-weight:bold">'+(medals[i]||('#'+(i+1)))+' '+escapeHtml(getMsgName(r.player))+'</span><span style="font-size:14px;font-weight:900;color:var(--acc)">'+r.score+del+'</span></div>';
  });
  list.innerHTML=h;
};
window.delGameScore=async function(id){
  if(!isOwner())return;
  await sb.from('game_scores').delete().eq('id',id);
  window._loadGameScores();
};
window.showChamps=async function(){
  _ensure();
  el('gsTitle').innerText='🏆 أبطال شات سونيك';
  el('gsInputRow').style.display='none';
  el('gsMyBest').innerText='';
  var list=el('gsList');
  list.innerHTML='<div style="text-align:center;color:var(--mut);padding:10px">جاري التحميل...</div>';
  var d=await sb.from('game_scores').select('*').order('score',{ascending:false}).limit(2000);
  var byP={};
  (d.data||[]).forEach(function(r){
    if(!byP[r.player])byP[r.player]={};
    if(!byP[r.player][r.game]||r.score>byP[r.player][r.game].score)byP[r.player][r.game]=r.score;
  });
  var arr=[];
  for(var p in byP){
    var tot=0,games=0;
    for(var g in byP[p]){tot+=byP[p][g];games++;}
    arr.push({p:p,tot:tot,games:games,det:byP[p]});
  }
  arr.sort(function(a,b){return b.tot-a.tot;});
  if(!arr.length){list.innerHTML='<div style="text-align:center;color:var(--mut);padding:12px">لا توجد نتائج بعد 🏆</div>';return;}
  var medals=['🥇','🥈','🥉'];
  var h='';
  arr.forEach(function(r,i){
    var det='';
    for(var g in r.det)det+='<div style="font-size:10px;color:var(--mut);margin:2px 0">🎮 '+escapeHtml(g)+' : <b style="color:var(--acc)">'+r.det[g]+'</b></div>';
    h+='<div style="padding:8px 6px;border-bottom:1px solid var(--line)"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">'+(medals[i]||('#'+(i+1)))+'</span><div style="flex:1;font-size:13px;font-weight:bold">'+escapeHtml(getMsgName(r.p))+'</div><div style="font-size:15px;font-weight:900;color:var(--acc)">'+r.tot+'</div></div><div style="margin-top:4px;padding-right:26px">'+det+'</div></div>';
  });
  list.innerHTML=h;
};
function _gameName(){
  var t=el('gsTitle');
  return t?String(t.innerText).replace('🏆','').trim():'';
}
window.saveGameScore=async function(){
  try{
    if(!me)return toast('سجل دخولك أولاً');
    var inp=el('gsInput');
    if(!inp)return toast('⚠️ اقفل اللوحة وافتحها تاني');
    var v=parseInt(inp.value);
    if(isNaN(v)||v<0)return toast('اكتب رقم صحيح');
    var game=_gameName();
    var key='gs_cd_'+me.name+'||'+game;
    var last=parseInt(LS.getItem(key)||'0');
    var left=300000-(Date.now()-last);
    if(last&&left>0){var m=Math.ceil(left/60000);return toast('⏳ استنى '+m+' دقيقة قبل تسجيل نتيجة جديدة');}
    var pb=await sb.from('game_scores').select('score').eq('player',me.name).eq('game',game).order('score',{ascending:false}).limit(1);
    var best=(pb.data&&pb.data[0])?pb.data[0].score:0;
    if(best>0&&v>best*3)return toast('🚫 زيادة مشبوهة! أقصى مسموح تقريباً: '+Math.floor(best*3));
    if(best===0&&v>100000)return toast('🚫 أول نتيجة مش ممكن تكون أكتر من 100 ألف');
    var r=await sb.from('game_scores').insert({player:me.name,game:game,score:v,created_at:Date.now()});
    if(r&&r.error){console.error('save err',r.error);return toast('❌ خطأ: '+r.error.message);}
    try{LS.setItem(key,String(Date.now()));}catch(e){}
    toast('🏆 تم حفظ نتيجتك!');
    try{window._loadGameScores();}catch(e){}
  }catch(e){
    console.error('save exc',e);
    toast('❌ خطأ: '+e.message);
  }
};
function _addScoreBtn(){
  try{
    if(el('gameScoreBtn'))return;
    var nm=el('gamePlayName');if(!nm)return;
    var b=document.createElement('button');
    b.id='gameScoreBtn';
    b.style.cssText='background:var(--grn);border:none;color:#fff;border-radius:20px;padding:6px 12px;font-size:12px;font-weight:bold;cursor:pointer;flex-shrink:0';
    b.innerText='🏆 نتيجتك';
    b.onclick=function(e){e.stopPropagation();window.showScoreModal(el('gamePlayName').innerText);};
    nm.parentElement.insertBefore(b,nm.parentElement.lastChild);
  }catch(e){}
}
var _ogp=window.openGamePlay;
window.openGamePlay=function(g){var r=_ogp(g);setTimeout(_addScoreBtn,60);setTimeout(_addScoreBtn,400);return r;};
})();

/* ===== باتش القصص الاحترافي: تسلسل تلقائي + إعدادات + إعلانات ===== */
(function(){
var AD={
  enabled:true,
  title:'🚀 شات سونيك ⚡',
  desc:'شارك الموقع مع أصحابك وادعم استمرارنا — ادعمنا بقهوة ☕',
  url:'https://buymeacoffee.com/medosonic'
};
function _arr(v){return Array.isArray(v)?v:[];}
function _st(){try{return JSON.parse(LS.getItem('stories_settings')||'{}');}catch(e){return{};}}
function _stSet(k,v){try{var s=_st();s[k]=v;LS.setItem('stories_settings',JSON.stringify(s));}catch(e){}}

var _barDone=false;
function _ensureBars(){
  try{
    if(el('storiesBar')&&!_barDone){
      var m=document.createElement('div');
      m.id='storiesBarMsgs';
      m.style.cssText='display:none;gap:10px;overflow-x:auto;padding:8px 4px;margin-bottom:8px';
      var msgs=el('s-msgs');
      if(msgs)msgs.insertBefore(m,msgs.firstChild);
      _barDone=true;
    }
  }catch(e){}
}

var _queue=[];
window._buildQueue=async function(currentAuthor){
  try{
    var d=await sb.from('stories').select('author,stime').gt('stime',Date.now()-86400000);
    var set={},arr=[];
    (d.data||[]).forEach(function(x){if(!set[x.author]){set[x.author]=1;arr.push(x.author);}});
    var s=_st();
    if(s.friendsOnly===true)arr=arr.filter(function(a){return a===me.name||(me.friends&&me.friends.indexOf(a)>-1);});
    var idx=arr.indexOf(currentAuthor);
    if(idx>-1){_queue=arr.slice(idx+1).concat(arr.slice(0,idx));}
    else _queue=arr;
  }catch(e){_queue=[];}
};
var _adCounter=0;
var _nsO=window.nextStory;
window.nextStory=function(){
  if(_sI<_sL.length-1){_sI++;window._showCurStory();return;}
  var doneAuthor=_sL.length?String(_sL[0].author):'';
  var next=_queue.shift();
  if(next){
    _adCounter++;
    if(AD.enabled&&_adCounter%2===0){window._showAdSlot(next);}
    else{window.openAuthorStories(next);}
  }else{
    _sStop&&_sStop();
    closeModal('storyViewModal');
    toast('✅ خلصت كل القصص');
  }
};
window._showAdSlot=function(nextAuthor){
  var box=el('storyViewBox');
  box.innerHTML='<div style="position:absolute;inset:0;background:#0d0518;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;z-index:10">'
  +'<span style="position:absolute;top:10px;right:12px;background:rgba(255,255,255,.15);color:#fff;font-size:10px;padding:3px 10px;border-radius:10px">إعلان</span>'
  +'<div style="font-size:26px">'+AD.title+'</div>'
  +'<div style="color:rgba(255,255,255,.85);font-size:14px;text-align:center;padding:0 26px;line-height:1.9">'+AD.desc+'</div>'
  +'<button onclick="event.stopPropagation();window.open(\''+AD.url+'\',\'_blank\')" style="background:linear-gradient(135deg,#ff4fd8,#c026d3);border:none;color:#fff;padding:11px 30px;border-radius:24px;font-size:14px;font-weight:bold;cursor:pointer">افتح الآن</button>'
  +'<div style="color:rgba(255,255,255,.5);font-size:11px">جاري تحميل القصة التالية...</div></div>';
  setTimeout(function(){window.openAuthorStories(nextAuthor);},4000);
};

var _oasO=window.openAuthorStories;
window.openAuthorStories=async function(author,startIdx){
  window._buildQueue(author);
  return _oasO(author,startIdx);
};
try{
  var _saS=window.startAll;
  window.startAll=async function(){var r=await _saS();try{renderStories();}catch(e){}return r;};
}catch(e){}
})();

/* ===== قائمة القصة + رجوع لورا + عارض صور المراقبة + تنزيل ===== */
(function(){
window.bigViewImg=function(src){
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:#000;z-index:1400;display:flex;flex-direction:column;align-items:center;justify-content:center';
  ov.innerHTML='<img src="'+src+'" style="max-width:100%;max-height:78vh;object-fit:contain"><div style="display:flex;gap:12px;margin-top:16px"><a href="'+src+'" download target="_blank" style="background:var(--acc);color:#fff;padding:11px 26px;border-radius:24px;text-decoration:none;font-weight:bold;font-size:14px">⬇️ تحميل الصورة</a><button onclick="this.closest(\'div\').remove()" style="background:var(--red);color:#fff;border:none;padding:11px 26px;border-radius:24px;font-size:14px;font-weight:bold;cursor:pointer">إغلاق</button></div>';
  ov.onclick=function(e){if(e.target===ov)ov.remove();};
  document.body.appendChild(ov);
};
document.addEventListener('click',function(e){
  try{
    var t=e.target;
    if(t&&t.tagName==='IMG'&&t.closest&&t.closest('#monChatBox')&&t.src){
      e.stopPropagation();e.preventDefault();
      window.bigViewImg(t.src);
    }
  }catch(err){}
},true);

var _sh=[];
var _oas=window.openAuthorStories;
window.openAuthorStories=async function(a,s){
  try{if(typeof _sL!=='undefined'&&_sL&&_sL.length&&String(_sL[0].author)!==String(a))_sh.push({a:String(_sL[0].author),i:_sL.length-1});}catch(e){}
  return _oas(a,s);
};
window.prevStory=function(){
  try{
    if(typeof _sI!=='undefined'&&_sI>0){_sI--;window._showCurStory();return;}
    var h=_sh.pop();
    if(h){window.openAuthorStories(h.a,h.i);}
    else toast('دي أول قصة');
  }catch(e){}
};

window.stRep=function(au){
  var o=document.getElementById('stMenuOv');if(o)o.remove();
  SDB.addReport({from_user:me.name,target:'قصة/'+au,reason:'إبلاغ عن قصة غير لائقة',time:Date.now()});
  toast('🚨 تم إبلاغ الإدارة عن القصة');
};
window.stBlock=async function(au){
  var o=document.getElementById('stMenuOv');if(o)o.remove();
  if(isOwnerName(au))return toast('⛔ لا يمكن حظر صاحب الموقع');
  if(!confirm('حظر '+getMsgName(au)+' وحذف المحادثة؟'))return;
  if(!me.blocked)me.blocked=[];
  if(me.blocked.indexOf(au)<0)me.blocked.push(au);
  await updateMe({blocked:me.blocked});
  var cid=[me.name,au].sort().join('_');
  try{await SDB.delConvMsgs(cid);await SDB.delConv(cid);}catch(e){}
  closeModal('storyViewModal');
  toast('⛔ تم حظر المستخدم');
};
window.stMsg=function(au){
  var o=document.getElementById('stMenuOv');if(o)o.remove();
  closeModal('storyViewModal');
  try{openUser(au);}catch(e){}
};
})();

/* ===== باتش: قائمة القصة ⋯ + ترتيب الرسايل نهائي + وقت الدخول ===== */
(function(){
  document.addEventListener('click',function(e){
    try{
      var b=e.target&&e.target.closest?e.target.closest('#stDotsBtn'):null;
      if(b){
        e.preventDefault();e.stopPropagation();
        var sid=b.getAttribute('data-sid');
        if(window.mgStoryMenu&&sid)window.mgStoryMenu(sid);
      }
    }catch(_e){}
  },true);

  function tOf(m){try{if(m&&m._seq)return Number(m._seq);}catch(e){}return Number(m&&(m.time||m.mtime)||0);}
  function cmp(a,b){var d=tOf(a)-tOf(b);return d!==0?d:String(a._id).localeCompare(String(b._id));}

  var _r2mPrev=window.rowToMsg;
  window.rowToMsg=function(r){var m=_r2mPrev(r);try{if(r&&r.seq!=null)m._seq=Number(r.seq);}catch(e){}return m;};

  var _lmPrev=SDB.loadMsgs;
  SDB.loadMsgs=async function(convId,limit){
    var rows=await _lmPrev(convId,limit);
    try{rows.sort(cmp);}catch(e){}
    return rows;
  };

  var _rendering=false,_rrT=null;
  function rerenderSorted(){
    clearTimeout(_rrT);
    _rrT=setTimeout(function(){
      try{
        if(!chat)return;
        var b=el('chatBox');if(!b)return;
        var nearBottom=(b.scrollHeight-b.scrollTop-b.clientHeight)<160;
        var seen={},clean=[];
        msgsCache.forEach(function(m){if(m&&m._id&&!seen[m._id]){seen[m._id]=1;clean.push(m);}});
        clean.sort(cmp);
        msgsCache=clean;
        _rendering=true;
        b.innerHTML='';
        for(var i=0;i<msgsCache.length;i++){try{window.appendMsg(msgsCache[i]);}catch(e){}}
        _rendering=false;
        if(nearBottom||!userScrolledUp){userScrolledUp=false;b.scrollTop=b.scrollHeight;}
      }catch(e){_rendering=false;}
    },150);
  }

  var _apPrev=window.appendMsg;
  window.appendMsg=function(m){
    if(_rendering)return _apPrev(m);
    try{
      if(chat&&msgsCache&&msgsCache.length>1){
        var idx=-1;
        for(var i=msgsCache.length-1;i>=0;i--){if(msgsCache[i]._id===m._id){idx=i;break;}}
        if(idx>0&&tOf(m)<tOf(msgsCache[idx-1])){rerenderSorted();return;}
      }
    }catch(e){}
    return _apPrev(m);
  };

  var _enPrev=window.enter;
  window.enter=async function(u){try{if(u)u.loginTime=Date.now();}catch(e){}return _enPrev(u);};

  try{
    var hdr=document.querySelector('#ap-members thead tr');
    if(hdr&&!hdr.querySelector('th[data-lt]')){
      var th=document.createElement('th');th.setAttribute('data-lt','1');th.textContent='وقت الدخول';
      hdr.insertBefore(th,hdr.lastElementChild);
    }
  }catch(e){}
})();

/* ===== إصلاح نهائي: زرار ⋯ في القصة (إبلاغ/حظر/مراسلة/حذف) ===== */
(function(){
  document.addEventListener('click',function(e){
    try{
      var b=e.target&&e.target.closest?e.target.closest('#stDotsBtn'):null;
      if(b){
        e.preventDefault();e.stopPropagation();
        var sid=b.getAttribute('data-sid');
        if(sid)window.mgStoryMenu(sid);
      }
    }catch(_e){}
  },true);

  window.mgStoryMenu=function(sid){
    try{
      var old=el('stMenuOv');if(old)old.remove();
      if(!sid||!me)return;
      sb.from('stories').select('id,author').eq('id',sid).limit(1).then(function(d){
        var s=d&&d.data&&d.data[0];
        if(!s)return toast('الحالة انتهت');
        var au=String(s.author);
        var isMine=(au===me.name);
        var ov=document.createElement('div');
        ov.id='stMenuOv';
        ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1350';
        var btns='';
        if(isMine){
          btns+='<button onclick="stDelStory(\''+sid+'\')" style="width:100%;padding:13px;background:none;border:none;color:var(--red);font-size:13px;text-align:right;cursor:pointer;border-bottom:1px solid var(--line)">🗑️ حذف القصة</button>';
        }else{
          btns+='<button onclick="stRep(\''+au.replace(/'/g,"\\'")+'\')" style="width:100%;padding:13px;background:none;border:none;color:var(--txt);font-size:13px;text-align:right;cursor:pointer;border-bottom:1px solid var(--line)">🚨 إبلاغ عن القصة</button>'
          +'<button onclick="stBlock(\''+au.replace(/'/g,"\\'")+'\')" style="width:100%;padding:13px;background:none;border:none;color:var(--red);font-size:13px;text-align:right;cursor:pointer;border-bottom:1px solid var(--line)">⛔ حظر المستخدم</button>'
          +'<button onclick="stMsg(\''+au.replace(/'/g,"\\'")+'\')" style="width:100%;padding:13px;background:none;border:none;color:var(--txt);font-size:13px;text-align:right;cursor:pointer;border-bottom:1px solid var(--line)">💬 مراسلة</button>';
        }
        btns+='<button onclick="document.getElementById(\'stMenuOv\').remove()" style="width:100%;padding:13px;background:none;border:none;color:var(--mut);font-size:13px;text-align:right;cursor:pointer">✕ إلغاء</button>';
        ov.innerHTML='<div style="position:absolute;top:70px;left:14px;background:var(--card);border:1px solid var(--line);border-radius:14px;width:210px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.5)">'+btns+'</div>';
        ov.onclick=function(ev){if(ev.target===ov)ov.remove();};
        document.body.appendChild(ov);
      });
    }catch(e){}
  };

  window.stDelStory=function(sid){var o=el('stMenuOv');if(o)o.remove();if(confirm('حذف هذه القصة؟'))deleteMyStory(sid);};
  window.stRep=window.stRep||function(au){var o=el('stMenuOv');if(o)o.remove();SDB.addReport({from_user:me.name,target:'قصة/'+au,reason:'إبلاغ عن قصة غير لائقة',time:Date.now()});toast('🚨 تم إبلاغ الإدارة عن القصة');};
  window.stMsg=window.stMsg||function(au){var o=el('stMenuOv');if(o)o.remove();closeModal('storyViewModal');try{openUser(au);}catch(e){}};
  window.stBlock=window.stBlock||async function(au){var o=el('stMenuOv');if(o)o.remove();if(isOwnerName(au))return toast('⛔ لا يمكن حظر صاحب الموقع');if(!confirm('حظر '+getMsgName(au)+' وحذف المحادثة؟'))return;if(!me.blocked)me.blocked=[];if(me.blocked.indexOf(au)<0)me.blocked.push(au);await updateMe({blocked:me.blocked});var cid=[me.name,au].sort().join('_');try{await SDB.delConvMsgs(cid);await SDB.delConv(cid);}catch(e){}closeModal('storyViewModal');toast('⛔ تم حظر المستخدم');};
})();

/* ===== إصلاح الإطارات المكسورة + الصور التالفة ===== */
(function(){
  var FB_M='https://cdn.phototourl.com/free/2026-09-23-e466167c-d14c-4d49-bf5e-dac6c612bc8e.jpg';
  var FB_F='https://cdn.phototourl.com/free/2026-09-23-9e2a1f47-8318-4b74-8e74-2a643e156af6.jpg';

  function guessGender(img){
    try{
      var card=img.closest('.u-card,[onclick*="openUser"],[onclick*="openUserProfile"]');
      if(card){
        var oc=card.getAttribute('onclick')||'';
        var m=oc.match(/openUser(?:Profile)?\('([^']+)'\)/);
        if(m){
          var u=usersCache[m[1]];
          if(u&&u.gender==='أنثى')return 'F';
        }
      }
    }catch(e){}
    return 'M';
  }

  document.addEventListener('error',function(e){
    var t=e.target;
    if(!t||t.tagName!=='IMG')return;
    if(t.dataset.fbFixed)return;
    t.dataset.fbFixed='1';

    if(t.classList&&t.classList.contains('frame-img')){
      t.style.display='none';
      return;
    }

    if(t.closest&&(t.closest('.u-ava')||t.closest('.p-ava')||t.closest('.w-ava')||t.closest('.ava')||t.closest('#upAvaWrap'))){
      t.onerror=function(){t.onerror=null;this.style.display='none';};
      t.src=(guessGender(t)==='F')?FB_F:FB_M;
      t.style.display='';
      return;
    }
  },true);

  setInterval(function(){
    try{
      document.querySelectorAll('.frame-img').forEach(function(f){
        if(f.complete&&f.naturalWidth===0&&f.style.display!=='none'){
          f.style.display='none';
        }
      });
    }catch(e){}
  },1500);
})();

/* ===== وقت الدخول: التاريخ + الساعة معاً ===== */
(function(){
  function fmtBoth(t){
    try{
      if(!t)return '—';
      var d=new Date(Number(t));
      var day=('0'+d.getDate()).slice(-2);
      var mo=('0'+(d.getMonth()+1)).slice(-2);
      var yr=d.getFullYear();
      var h=d.getHours();
      var m=('0'+d.getMinutes()).slice(-2);
      var ap=(h<12)?'ص':'م';
      var h12=h%12;if(h12===0)h12=12;
      return '<div style="font-size:10px">'+day+'/'+mo+'/'+yr+'</div><div style="font-size:10px;color:var(--acc);font-weight:bold">'+h12+':'+m+' '+ap+'</div>';
    }catch(e){return '—';}
  }

  window._loginDates={};
  window.loadLoginDates=async function(){
    try{
      var d=await sb.from('device_logins').select('name,utime').order('utime',{ascending:false}).limit(1000);
      (d.data||[]).forEach(function(r){
        if(!window._loginDates[r.name]||Number(r.utime)>Number(window._loginDates[r.name])){
          window._loginDates[r.name]=r.utime;
        }
      });
      if(el('s-admin')&&el('s-admin').classList.contains('active'))renderMembers();
    }catch(e){}
  };

  function ensureHeader(){
    try{
      var hdr=document.querySelector('#ap-members thead tr');
      if(hdr&&!hdr.querySelector('th[data-lt]')){
        var th=document.createElement('th');
        th.setAttribute('data-lt','1');
        th.textContent='وقت الدخول';
        hdr.insertBefore(th,hdr.lastElementChild);
      }
    }catch(e){}
  }

  var _rmPrev=window.renderMembers;
  window.renderMembers=function(){
    var r=_rmPrev();
    try{
      ensureHeader();
      var tbl=el('memTable');if(!tbl)return r;
      var theadRow=document.querySelector('#ap-members thead tr');
      if(!theadRow)return r;
      var colIdx=-1;
      var ths=theadRow.querySelectorAll('th');
      for(var i=0;i<ths.length;i++){
        if(ths[i].getAttribute('data-lt')||ths[i].innerText.indexOf('وقت الدخول')>-1){colIdx=i;break;}
      }
      if(colIdx<0)return r;
      var trs=tbl.querySelectorAll('tr');
      for(var j=0;j<trs.length;j++){
        var tr=trs[j];
        var tds=tr.querySelectorAll('td');
        if(tds.length<=colIdx)continue;
        var td=tds[colIdx];
        if(!td)continue;
        var name=(tds[0].innerText||'').trim();
        var u=usersCache[name];
        var t=window._loginDates[name]||(u&&u.loginTime)||null;
        td.style.cssText='white-space:nowrap;text-align:center';
        td.innerHTML=fmtBoth(t);
      }
    }catch(e){}
    return r;
  };

  var _atPrev=window.adminTab;
  window.adminTab=function(tab,e){
    var r=_atPrev(tab,e);
    try{if(tab==='members')loadLoginDates();}catch(e2){}
    return r;
  };
  var _saPrev=window.startAll;
  window.startAll=async function(){
    var r=await _saPrev();
    try{if(me&&isOwner())loadLoginDates();}catch(e){}
    return r;
  };
})();

/* ===== إصلاح نهائي للصور الافتراضية والمكسورة (النسخة الأخيرة) ===== */
window.FB_F='https://cdn.phototourl.com/member/2026-10-02-330f538a-e915-45b9-8239-f68ff6c1ea2f.jpg';
window.FB_M='https://cdn.phototourl.com/member/2026-10-02-9c355082-4f44-4bd8-88aa-e43864431e90.jpg';
window._defAva=function(u){return (u&&u.gender==='أنثى')?FB_F:FB_M;};
window.getAvatar=function(u){var _d=_defAva(u);if(u&&u.avatar&&String(u.avatar).length>50)return'<img src="'+u.avatar+'" data-df="'+_d+'" onerror="this.onerror=null;this.src=this.getAttribute(\'data-df\')" style="width:100%;height:100%;object-fit:cover">';return'<img src="'+_d+'" style="width:100%;height:100%;object-fit:cover">';};
document.addEventListener('error',function(e){
  var t=e.target;if(!t||t.tagName!=='IMG')return;
  if(t.dataset.fbFixed)return;t.dataset.fbFixed='1';
  var c=t.closest&&(t.closest('.u-ava')||t.closest('.ava')||t.closest('.p-ava')||t.closest('.w-ava')||t.closest('#upAvaWrap')||t.closest('#chatAva'));
  if(c){t.onerror=null;t.src=t.getAttribute('data-df')||FB_M;}
},true);
setInterval(function(){
  try{
    document.querySelectorAll('.u-ava img,.ava img,.p-ava img,.w-ava img').forEach(function(im){
      if(im.complete&&im.naturalWidth===0&&!im.dataset.fbFixed){im.dataset.fbFixed='1';im.onerror=null;im.src=im.getAttribute('data-df')||FB_M;}
    });
    document.querySelectorAll('.frame-img').forEach(function(f){if(f.complete&&f.naturalWidth===0)f.style.display='none';});
  }catch(e){}
},1500);

/* ===== صفحة القصص الكاملة بدل المربع الصغير ===== */
(function(){
  function _st(){try{return JSON.parse(LS.getItem('stories_settings')||'{}');}catch(e){return{};}}
  function _stSet(k,v){try{var s=_st();s[k]=v;LS.setItem('stories_settings',JSON.stringify(s));}catch(e){}}

  try{var om=el('storiesSettingsModal');if(om)om.remove();}catch(e){}

  if(!el('s-stories')){
    var scr=document.createElement('div');
    scr.id='s-stories';
    scr.className='screen';
    scr.innerHTML='<div class="sub-title" onclick="go(\'settings\')">➔ إعدادات القصص</div>'
    +'<div style="padding:4px">'
    +'<div class="set-row" style="display:block"><h4>أظهر شريط القصص في:</h4>'
    +'<label style="display:flex;align-items:center;gap:12px;font-size:14px;margin:12px 0;cursor:pointer"><input type="checkbox" id="spOn" style="width:20px;height:20px;accent-color:var(--acc)"> صفحة المتصلين</label>'
    +'<label style="display:flex;align-items:center;gap:12px;font-size:14px;margin:12px 0;cursor:pointer"><input type="checkbox" id="spMsg" style="width:20px;height:20px;accent-color:var(--acc)"> صفحة الرسائل</label>'
    +'</div>'
    +'<div class="set-row"><div><h4>👥 قصص الأصدقاء فقط</h4><p>عرض القصص من أصدقائك فقط بدلاً من الجميع</p></div><label class="sw"><input type="checkbox" id="spFr"><span class="sl"></span></label></div>'
    +'<div class="set-row" style="display:block"><h4>قصصي</h4><div id="spCount" style="font-size:12px;color:var(--mut);margin:8px 0 12px"></div><button class="lbtn" onclick="openStoryComposer()">✏️ نشر قصة جديدة</button></div>'
    +'</div>';

    var ref=document.getElementById('s-settings');
    if(ref&&ref.parentElement)ref.parentElement.insertBefore(scr,ref.nextSibling);
    else document.querySelector('.content').appendChild(scr);
  }

  window.openStoriesSettings=function(){
    var s=_st();
    var on=el('spOn'),msg=el('spMsg'),fr=el('spFr');
    if(on)on.checked=(s.showOnline!==false);
    if(msg)msg.checked=(s.showMsgs===true);
    if(fr)fr.checked=(s.friendsOnly===true);
    var c=el('spCount');
    if(c&&me&&window.sb){
      sb.from('stories').select('id').eq('author',me.name).gt('stime',Date.now()-86400000).then(function(d){
        c.innerText='لديك '+((d.data||[]).length)+' قصة نشطة الآن — تنتهي تلقائياً بعد 24 ساعة.';
      });
                    }
    go('stories',null);
  };

  document.addEventListener('change',function(e){
    try{
      var t=e.target;
      if(t.id==='spOn'){_stSet('showOnline',t.checked);renderStories();}
      else if(t.id==='spMsg'){_stSet('showMsgs',t.checked);renderStories();}
      else if(t.id==='spFr'){_stSet('friendsOnly',t.checked);renderStories();}
    }catch(e2){}
  });

  try{
    var lists2=document.querySelectorAll('#s-settings .menu-list');
    var tgt2=lists2[lists2.length-1];
    if(tgt2&&!el('storiesSettingsItem')){
      var mi2=document.createElement('div');
      mi2.className='m-item';mi2.id='storiesSettingsItem';
      mi2.innerHTML='<span>⏱️ القصص</span><span>👈</span>';
      mi2.onclick=function(){window.openStoriesSettings();};
      tgt2.insertBefore(mi2,tgt2.firstChild);
    }
  }catch(e){}
})();

/* ===== مراقبة كاملة: آخر 1000 رسالة بالترتيب + زوم على الصور ===== */
(function(){
window.spyConv=async function(convId,a,b){
  try{
    if(!isOwner())return toast('لصاحب الموقع فقط');
    el('monChatHead').innerText='محادثة: '+a+' ↔️ '+b;
    el('monChatBox').innerHTML='<div style="text-align:center;color:var(--mut);padding:20px">جاري التحميل...</div>';

    var d=await sb.from('messages').select('*').eq('conv_id',convId).order('seq',{ascending:false}).limit(1000);
    if(d.error){
      d=await sb.from('messages').select('*').eq('conv_id',convId).order('mtime',{ascending:false}).limit(1000);
    }
    if(d.error){el('monChatBox').innerHTML='<div style="color:var(--red);text-align:center;padding:15px">خطأ: '+d.error.message+'</div>';return;}

    var msgs=(d.data||[]).reverse();
    if(!msgs.length){el('monChatBox').innerHTML='<div style="text-align:center;color:var(--mut);padding:20px">لا توجد رسائل</div>';return;}

    function mapMsg(r){
      var m;
      try{m=window.rowToMsg?rowToMsg(r):{_id:r.id,from:r.sender,data:r.body,type:r.mtype,time:r.mtime,deleted:r.deleted,meta:r.meta||null};}
      catch(e){m={_id:r.id,from:r.sender,data:r.body,type:r.mtype,time:r.mtime,deleted:r.deleted,meta:r.meta||null};}
      m._seq=(r.seq!=null)?Number(r.seq):null;
      return m;
    }
    var mapped=msgs.map(mapMsg);
    var hasSeq=mapped.length>0&&mapped.every(function(m){return m._seq!=null;});
    if(hasSeq)mapped.sort(function(x,y){return x._seq-y._seq;});

    function fdt(t){try{return new Date(Number(t)).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});}catch(e){return'';}}
    function fdd(t){try{return new Date(Number(t)).toLocaleDateString('ar-EG',{day:'2-digit',month:'2-digit',year:'numeric'});}catch(e){return'';}}

    var h='<div style="text-align:center;margin-bottom:8px"><span style="background:var(--card2);color:var(--mut);font-size:10px;padding:3px 14px;border-radius:12px">📊 عرض '+mapped.length+' رسالة — من البداية للنهاية</span></div>';
    var lastDay='';
    mapped.forEach(function(m){
      try{
        var day=fdd(m.time);
        if(day&&day!==lastDay){
          h+='<div style="text-align:center;margin:10px 0 4px"><span style="background:var(--card2);color:var(--mut);font-size:10px;padding:3px 14px;border-radius:12px">'+day+'</span></div>';
          lastDay=day;
        }
        var content=m.deleted?'<span style="color:var(--red);font-size:11px;font-weight:bold">🚫 محذوفة:</span> ':'';
        if(m.type==='image')content+='<img src="'+escapeHtml(m.data||'')+'" style="max-width:170px;border-radius:8px;margin-top:4px;cursor:pointer" onclick="event.stopPropagation();viewFullImage(this.src)">';
        else if(m.type==='audio')content+='<audio controls src="'+escapeHtml(m.data||'')+'" style="width:190px;margin-top:4px"></audio>';
        else if(m.type==='sticker')content+='<img src="'+escapeHtml(m.data||'')+'" style="width:65px;height:65px;object-fit:contain;margin-top:4px;cursor:pointer" onclick="event.stopPropagation();viewFullImage(this.src)">';
        else content+=escapeHtml(String(m.data||''));
        h+='<div style="padding:8px 0;border-bottom:1px solid var(--line)"><b style="color:var(--acc)">'+escapeHtml(m.from||'?')+'</b> <span style="font-size:10px;color:var(--mut)">'+fdt(m.time)+'</span><div style="margin-top:3px;word-break:break-word">'+content+'</div></div>';
      }catch(e){}
    });
    h+='<div style="text-align:center;color:var(--mut);font-size:11px;padding:10px">⬅️ نهاية المحادثة</div>';
    el('monChatBox').innerHTML=h;
    el('monChatBox').scrollTop=el('monChatBox').scrollHeight;
  }catch(e){
    try{el('monChatBox').innerHTML='<div style="color:var(--red);text-align:center;padding:15px">خطأ: '+e.message+'</div>';}catch(e2){}
  }
};
})();

/* ===== الحل الجذري: زرار + القصص + نافذة إضافة الحالة ===== */
(function(){
  function _arr(v){return Array.isArray(v)?v:[];}
  function _st(){try{return JSON.parse(LS.getItem('stories_settings')||'{}');}catch(e){return{};}}

  var SCOLORS=['#0f172a','#1e3a8a','#312e81','#6d28d9','#86198f','#9d174d','#9a3412','#065f46','#111827','#450a0a'];
  var _cur=SCOLORS[0];
  function buildComposer(){
    var old=el('storyComposerModal');if(old)old.remove();
    var cp=document.createElement('div');cp.id='storyComposerModal';cp.className='modal';
    var chips='';SCOLORS.forEach(function(c,i){chips+='<div class="scChip" data-c="'+c+'" style="min-width:34px;width:34px;height:34px;border-radius:50%;background:'+c+';cursor:pointer;border:2px solid '+(i===0?'#fff':'transparent')+';flex-shrink:0"></div>';});
    cp.innerHTML='<div class="m-card2" style="width:330px;max-height:85vh;overflow-y:auto">'
    +'<h3 style="color:#a78bfa">✨ إضافة حالة</h3>'
    +'<button style="background:#8b5cf6;color:#fff" onclick="scPickMedia()">📷 صورة أو فيديو</button>'
    +'<button style="background:#8b5cf6;color:#fff" onclick="scShowText()">📝 نص</button>'
    +'<div id="scTextWrap" style="display:none">'
    +'<div id="scPrev" style="border-radius:12px;padding:14px;background:'+SCOLORS[0]+';margin-bottom:8px">'
    +'<textarea id="scText" placeholder="اكتب حالتك..." style="width:100%;background:transparent;border:none;outline:none;color:#fff;font-size:18px;text-align:center;resize:none;min-height:100px;font-weight:bold"></textarea></div>'
    +'<div style="display:flex;gap:8px;overflow-x:auto;padding:2px 0 10px" id="scColors">'+chips+'</div>'
    +'<button style="background:var(--grn);color:#fff" onclick="scPublish()">✅ نشر الحالة</button>'
    +'</div>'
    +'<button style="background:transparent;color:var(--red);border:1px solid var(--red)!important" onclick="closeModal(\'storyComposerModal\')">❌ إلغاء</button>'
    +'</div>';
    cp.onclick=function(e){if(e.target===cp)closeModal('storyComposerModal');};
    document.body.appendChild(cp);
    var cb=el('scColors');
    Array.prototype.forEach.call(cb.children,function(d){
      d.onclick=function(){
        _cur=d.getAttribute('data-c');el('scPrev').style.background=_cur;
        Array.prototype.forEach.call(cb.children,function(k){k.style.borderColor='transparent';});
        d.style.borderColor='#fff';
      };
    });
  }
  window.openStoryComposer=function(){
    try{
      if(!me)return toast('سجل دخولك أولاً');
      buildComposer();
      el('scText').value='';el('scTextWrap').style.display='none';
      el('storyComposerModal').classList.add('open');
    }catch(e){toast('خطأ: '+e.message);}
  };
  window.scPickMedia=function(){closeModal('storyComposerModal');try{storyInputEl.click();}catch(e){toast('جرب تاني');}};
  window.scShowText=function(){el('scTextWrap').style.display='block';setTimeout(function(){try{el('scText').focus();}catch(e){}},60);};
  window.scPublish=function(){
    var t=el('scText');var txt=t?(t.value||'').trim():'';
    if(!txt)return toast('اكتب حالتك الأول');
    var sid='st'+Date.now()+Math.floor(Math.random()*999);
    sb.from('stories').insert({id:sid,author:me.name,img:_cur+'|||'+txt,stype:'text',stime:Date.now()}).then(function(r){
      if(r.error)return toast('خطأ: '+r.error.message);
      toast('تم نشر حالتك ✅');closeModal('storyComposerModal');try{renderStories();}catch(e){}
    });
  };

  function _ensureBars(){
    try{
      if(!el('storiesBarMsgs')){
        var m=document.createElement('div');m.id='storiesBarMsgs';
        m.style.cssText='display:none;gap:10px;overflow-x:auto;padding:8px 4px;margin-bottom:8px';
        var msgs=el('s-msgs');if(msgs)msgs.insertBefore(m,msgs.firstChild);
      }
    }catch(e){}
  }
  window.renderStories=async function(){
    try{
      if(!me)return;
      _ensureBars();
      var d=await sb.from('stories').select('*').gt('stime',Date.now()-86400000).order('stime',{ascending:true});
      if(d.error)return;
      var items=(d.data||[]);var s=_st();
      if(s.friendsOnly===true)items=items.filter(function(x){return x.author===me.name||(me.friends&&me.friends.indexOf(x.author)>-1);});
      var groups={},order=[];
      items.forEach(function(x){if(!groups[x.author]){groups[x.author]=[];order.push(x.author);}groups[x.author].push(x);});
      order.sort(function(a,b){return (groups[b][groups[b].length-1].stime||0)-(groups[a][groups[a].length-1].stime||0);});
      var mine=order.filter(function(a){return a===me.name;});
      var frs=order.filter(function(a){return a!==me.name&&me.friends&&me.friends.indexOf(a)>-1;});
      var oth=order.filter(function(a){return a!==me.name&&(!me.friends||me.friends.indexOf(a)===-1);});
      var ADD='<div onclick="openStoryComposer()" style="min-width:64px;display:flex;flex-direction:column;align-items:center;cursor:pointer;flex-shrink:0"><div style="width:56px;height:56px;border-radius:50%;border:2px dashed var(--acc);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--acc)">+</div><span style="font-size:9px;color:var(--mut);margin-top:3px">إضافة</span></div>';
      function chip(author,list,isMine){
        var u=usersCache[author];
        var ava=isMine?getAvatar(me):((u&&u.avatar)?'<img src="'+u.avatar+'" style="width:100%;height:100%;object-fit:cover">':getAvatar(u||{}));
        var allSeen=true;
        if(!isMine)for(var i=0;i<list.length;i++){if(_arr(list[i].views).indexOf(me.name)===-1){allSeen=false;break;}}
        var ring=isMine?'var(--acc)':(allSeen?'#6b7280':'var(--grn)');
        var badge=list.length>1?'<span style="position:absolute;top:-4px;left:-2px;background:var(--acc);color:#fff;border-radius:10px;min-width:20px;height:18px;line-height:18px;font-size:10px;padding:0 4px;font-weight:bold">'+list.length+'</span>':'';
        var sub=isMine?'<span onclick="event.stopPropagation();showStoryViewersAll()" style="font-size:9px;color:var(--acc);font-weight:bold;cursor:pointer">👁️ '+list.reduce(function(t,x){return t+_arr(x.views).length;},0)+'</span>':'<span style="font-size:9px;color:var(--mut)">'+timeLeft(list[list.length-1].stime)+'</span>';
        return '<div onclick="openAuthorStories(\''+String(author).replace(/'/g,"\\'")+'\')" style="position:relative;min-width:64px;display:flex;flex-direction:column;align-items:center;cursor:pointer;flex-shrink:0"><div style="position:relative"><div style="width:56px;height:56px;border-radius:50%;border:3px solid '+ring+';padding:2px;overflow:hidden;background:var(--card2)">'+ava+'</div>'+badge+'</div><span style="font-size:10px;color:var(--txt);margin-top:3px;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(isMine?'حالتي':escapeHtml(getMsgName(author)))+'</span>'+sub+'</div>';
      }
      function sec(title,list,isMine){
        if(!list.length)return'';
        var h='<div style="min-width:100%"><div style="font-size:10px;color:var(--mut);font-weight:bold;padding:0 4px 4px">'+title+'</div><div style="display:flex;gap:10px">';
        list.forEach(function(a){h+=chip(a,groups[a],isMine);});
        return h+'</div></div>';
      }
      var html='<div style="display:flex;gap:10px;align-items:flex-start;overflow-x:auto;width:100%">'+ADD+sec('⭐ حالتي',mine,true)+sec('👥 أصدقائي',frs,false)+sec('🌍 الجميع',oth,false)+'</div>';
      var bar=el('storiesBar'),bar2=el('storiesBarMsgs');
      if(bar){bar.innerHTML=html;bar.style.display=(s.showOnline===false)?'none':'flex';}
      if(bar2){bar2.innerHTML=html;bar2.style.display=(s.showMsgs===true)?'flex':'none';}
    }catch(e){}
  };

  document.addEventListener('click',function(e){
    try{
      var t=e.target;
      if(!t||!t.closest)return;
      var bar=t.closest('#storiesBar, #storiesBarMsgs');
      if(!bar)return;
      var m=el('storyComposerModal');
      if(m&&m.classList.contains('open'))return;
      var chipEl=t.closest('[onclick*="openAuthorStories"],[onclick*="showStoryViewers"]');
      if(chipEl)return;
      var row=bar.firstElementChild;
      if(!row)return;
      var add=row.firstElementChild;
      if(add&&(add===t||add.contains(t))){
        e.preventDefault();e.stopPropagation();
        window.openStoryComposer();
      }
    }catch(err){}
  },true);

  var _saF=window.startAll;
  window.startAll=async function(){var r=await _saF();try{renderStories();}catch(e){}return r;};
  setTimeout(function(){try{if(me)renderStories();}catch(e){}},2000);
})();

/* ===== تبويبات القصص (الكل / الأصدقاء) + حلقات متدرجة ===== */
(function(){
  function _arr(v){return Array.isArray(v)?v:[];}
  function _st(){try{return JSON.parse(LS.getItem('stories_settings')||'{}');}catch(e){return{};}}
  function _gf(){try{return LS.getItem('stories_filter')||'all';}catch(e){return'all';}}
  function _sf(f){try{LS.setItem('stories_filter',f);}catch(e){}}

  var RINGS=[
    'conic-gradient(from 210deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5,#feda75)',
    'conic-gradient(from 210deg,#12c2e9,#c471ed,#f64f59,#12c2e9)',
    'conic-gradient(from 210deg,#11998e,#38ef7d,#11998e)',
    'conic-gradient(from 210deg,#fc466b,#3f5efb,#fc466b)',
    'conic-gradient(from 210deg,#f7971e,#ffd200,#f7971e)',
    'conic-gradient(from 210deg,#8e2de2,#4a00e0,#8e2de2)'
  ];

  function _ensureBars(){
    try{
      if(!el('storiesBarMsgs')){
        var m=document.createElement('div');m.id='storiesBarMsgs';
        m.style.cssText='display:none;gap:10px;overflow-x:auto;padding:8px 4px;margin-bottom:8px';
        var msgs=el('s-msgs');if(msgs)msgs.insertBefore(m,msgs.firstChild);
      }
    }catch(e){}
  }

  function _filterHTML(){
    var cur=_gf();
    function pill(f,label){
      var sel=(cur===f);
      return '<span class="stFilterPill" data-f="'+f+'" style="padding:5px 22px;border-radius:18px;font-size:12.5px;font-weight:bold;cursor:pointer;user-select:none;'+(sel?'background:var(--acc);color:#fff;box-shadow:0 2px 8px rgba(59,130,246,.35)':'background:var(--card2);color:var(--mut);border:1px solid var(--line)')+'">'+label+'</span>';
    }
    return '<span style="flex:1;font-size:14px;font-weight:bold;color:var(--txt)">القصص</span>'+pill('all','الكل')+pill('friends','الأصدقاء');
  }

  function _ensureFilterBar(bar,id){
    try{
      if(!bar)return;
      var fbar=el(id);
      if(!fbar){
        fbar=document.createElement('div');fbar.id=id;
        fbar.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 4px 0';
        if(bar.parentElement)bar.parentElement.insertBefore(fbar,bar);
        fbar.addEventListener('click',function(e){
          try{
            var b=e.target&&e.target.closest?e.target.closest('.stFilterPill'):null;
            if(!b)return;
            _sf(b.getAttribute('data-f'));
            renderStories();
          }catch(err){}
        });
      }
      fbar.innerHTML=_filterHTML();
      fbar.style.display=(bar.style.display==='none')?'none':'flex';
    }catch(e){}
  }

  window.renderStories=async function(){
    try{
      if(!me)return;
      _ensureBars();
      var d=await sb.from('stories').select('*').gt('stime',Date.now()-86400000).order('stime',{ascending:true});
      if(d.error)return;
      var items=(d.data||[]);var s=_st();var fr=_gf();
      if(fr==='friends'||s.friendsOnly===true){
        items=items.filter(function(x){return x.author===me.name||(me.friends&&me.friends.indexOf(x.author)>-1);});
      }
      var groups={},order=[];
      items.forEach(function(x){if(!groups[x.author]){groups[x.author]=[];order.push(x.author);}groups[x.author].push(x);});
      order.sort(function(a,b){return (groups[b][groups[b].length-1].stime||0)-(groups[a][groups[a].length-1].stime||0);});
      var mine=order.filter(function(a){return a===me.name;});
      var frs=order.filter(function(a){return a!==me.name&&me.friends&&me.friends.indexOf(a)>-1;});
      var oth=order.filter(function(a){return a!==me.name&&(!me.friends||me.friends.indexOf(a)===-1);});
      var ADD='<div onclick="openStoryComposer()" style="min-width:64px;display:flex;flex-direction:column;align-items:center;cursor:pointer;flex-shrink:0"><div style="width:58px;height:58px;border-radius:50%;border:2px dashed var(--acc);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--acc)">+</div><span style="font-size:9px;color:var(--mut);margin-top:3px">إضافة</span></div>';
      function chip(author,list,isMine,ri){
        var u=usersCache[author];
        var ava=isMine?getAvatar(me):((u&&u.avatar)?'<img src="'+u.avatar+'" style="width:100%;height:100%;object-fit:cover">':getAvatar(u||{}));
        var allSeen=true;
        if(!isMine)for(var i=0;i<list.length;i++){if(_arr(list[i].views).indexOf(me.name)===-1){allSeen=false;break;}}
        var badge=list.length>1?'<span style="position:absolute;top:-2px;left:-4px;background:var(--acc);color:#fff;border-radius:10px;min-width:20px;height:18px;line-height:18px;font-size:10px;padding:0 4px;font-weight:bold;box-shadow:0 1px 4px rgba(0,0,0,.4);z-index:2">'+list.length+'</span>':'';
        var sub=isMine?'<span onclick="event.stopPropagation();showStoryViewersAll()" style="font-size:9px;color:var(--acc);font-weight:bold;cursor:pointer">👁️ '+list.reduce(function(t,x){return t+_arr(x.views).length;},0)+'</span>':'<span style="font-size:9px;color:var(--mut)">'+timeLeft(list[list.length-1].stime)+'</span>';
        var ring=allSeen?'#3a4653':RINGS[ri%RINGS.length];
        var ringStyle=(allSeen)?('border:3px solid '+ring+';padding:2px'):('background:'+ring+';padding:3px');
        return '<div onclick="openAuthorStories(\''+String(author).replace(/'/g,"\\'")+'\')" style="position:relative;min-width:64px;display:flex;flex-direction:column;align-items:center;cursor:pointer;flex-shrink:0"><div style="position:relative"><div style="width:60px;height:60px;border-radius:50%;'+ringStyle+'"><div style="width:100%;height:100%;border-radius:50%;overflow:hidden;background:var(--card2);border:2px solid var(--card)">'+ava+'</div></div>'+badge+'</div><span style="font-size:10px;color:var(--txt);margin-top:4px;max-width:66px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(isMine?'حالتي':escapeHtml(getMsgName(author)))+'</span>'+sub+'</div>';
      }
      function sec(title,list,isMine,si){
        if(!list.length)return'';
        var h='<div style="min-width:100%"><div style="font-size:10px;color:var(--mut);font-weight:bold;padding:0 4px 4px">'+title+'</div><div style="display:flex;gap:10px">';
        list.forEach(function(a,i){h+=chip(a,groups[a],isMine,si+i);});
        return h+'</div></div>';
      }
      var html='<div style="display:flex;gap:10px;align-items:flex-start;overflow-x:auto;width:100%">'+ADD+sec('⭐ حالتي',mine,true,0)+sec('👥 أصدقائي',frs,false,1)+sec('🌍 الجميع',oth,false,3)+'</div>';
      var bar=el('storiesBar'),bar2=el('storiesBarMsgs');
      if(bar){bar.innerHTML=html;bar.style.display=(s.showOnline===false)?'none':'flex';_ensureFilterBar(bar,'storiesFilterBar');}
      if(bar2){bar2.innerHTML=html;bar2.style.display=(s.showMsgs===true)?'flex':'none';_ensureFilterBar(bar2,'storiesFilterBarMsgs');}
    }catch(e){}
  };

  var _saT=window.startAll;
  window.startAll=async function(){var r=await _saT();try{renderStories();}catch(e){}return r;};
  setTimeout(function(){try{if(me)renderStories();}catch(e){}},2000);
})();

/* ===== تبويب الحالة في الشريط السفلي + نقطة حمراء للاستوري الجديد ===== */
(function(){
  function _arr(v){return Array.isArray(v)?v:[];}

  var nav=document.querySelector('.bottom-nav');
  if(nav&&!el('navStatus')){
    var item=document.createElement('div');
    item.className='nav-item';
    item.id='navStatus';
    item.onclick=function(){go('status',this);};
    item.innerHTML='<span style="position:relative"><span class="icon">⭕</span><span id="statusBadge" style="position:absolute;top:-1px;right:6px;width:11px;height:11px;background:#ea580c;border-radius:50%;display:none;border:2px solid var(--card);box-shadow:0 0 7px rgba(234,88,12,.85)"></span></span><span>الحالة</span>';
    var navItems=nav.querySelectorAll('.nav-item');
    if(navItems.length>1)nav.insertBefore(item,navItems[1]);
    else nav.appendChild(item);
  }

  if(!el('s-status')){
    var scr=document.createElement('div');
    scr.className='screen';
    scr.id='s-status';
    scr.innerHTML='<div class="msg-head"><b>⭕ الحالة</b><span style="font-size:12px;color:var(--mut)">تختفي بعد 24 ساعة</span></div><div id="statusList" style="padding:8px"></div>';
    var content=document.querySelector('.content');
    var ref=el('s-rooms');
    if(ref&&ref.parentElement)content.insertBefore(scr,ref);
    else content.appendChild(scr);
  }

  try{if(typeof MAIN_SCREENS!=='undefined'&&MAIN_SCREENS.indexOf('status')===-1)MAIN_SCREENS.push('status');}catch(e){}
  var _gnePrev=window.getNavEl;
  window.getNavEl=function(s){
    var m={online:0,status:1,msgs:2,rooms:3,wall:4,settings:5};
    if(m[s]!==undefined)return document.querySelectorAll('.nav-item')[m[s]];
    return _gnePrev?_gnePrev(s):null;
  };

  window.updateStatusBadge=async function(){
    try{
      if(!me){var b0=el('statusBadge');if(b0)b0.style.display='none';return;}
      var d=await sb.from('stories').select('author,views').gt('stime',Date.now()-86400000);
      var hasNew=false;
      (d.data||[]).forEach(function(s){
        if(s.author!==me.name&&_arr(s.views).indexOf(me.name)===-1)hasNew=true;
      });
      var b=el('statusBadge');
      if(b)b.style.display=hasNew?'block':'none';
    }catch(e){}
  };

  window.renderStatusPage=async function(){
    try{
      if(!me)return;
      var box=el('statusList');
      if(!box)return;
      box.innerHTML='<div style="text-align:center;color:var(--mut);padding:20px">جاري التحميل...</div>';
      var d=await sb.from('stories').select('*').gt('stime',Date.now()-86400000).order('stime',{ascending:true});
      var items=(d.data||[]);
      var groups={},order=[];
      items.forEach(function(x){if(!groups[x.author]){groups[x.author]=[];order.push(x.author);}groups[x.author].push(x);});
      order.sort(function(a,b){return (groups[b][groups[b].length-1].stime||0)-(groups[a][groups[a].length-1].stime||0);});
      var myCount=(groups[me.name]||[]).length;
      var recent=[],viewed=[];
      order.forEach(function(a){
        if(a===me.name)return;
        var g=groups[a];
        var seen=true;
        for(var i=0;i<g.length;i++){if(_arr(g[i].views).indexOf(me.name)===-1){seen=false;break;}}
        if(seen)viewed.push(a);else recent.push(a);
      });
      function row(author,list,seen){
        var u=usersCache[author];
        var ava=(u&&u.avatar)?'<img src="'+u.avatar+'" style="width:100%;height:100%;object-fit:cover">':getAvatar(u||{});
        var ring=seen?'#3a4653':'var(--grn)';
        return '<div class="u-card" onclick="openAuthorStories(\''+String(author).replace(/'/g,"\\'")+'\')">'
        +'<div style="width:54px;height:54px;border-radius:50%;border:3px solid '+ring+';padding:2px;overflow:hidden;flex-shrink:0"><div style="width:100%;height:100%;border-radius:50%;overflow:hidden;background:var(--card2)">'+ava+'</div></div>'
        +'<div style="flex:1;min-width:0"><div class="u-name">'+escapeHtml(getMsgName(author))+'</div>'
        +'<div style="font-size:11px;color:var(--mut)">'+timeAgo(list[list.length-1].stime)+' • '+list.length+' '+(list.length===1?'حالة':'حالات')+'</div></div>'
        +(list.length>1?'<span style="background:var(--acc);color:#fff;border-radius:10px;font-size:10px;padding:2px 8px;flex-shrink:0">'+list.length+'</span>':'')
        +'</div>';
      }
      var h='<div class="u-card" onclick="openStoryComposer()">'
      +'<div style="position:relative;width:54px;height:54px;flex-shrink:0"><div style="width:100%;height:100%;border-radius:50%;overflow:hidden;border:2px dashed var(--acc)">'+getAvatar(me)+'</div>'
      +'<span style="position:absolute;bottom:-3px;left:-3px;width:22px;height:22px;background:var(--grn);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:bold;border:2px solid var(--card)">+</span></div>'
      +'<div style="flex:1"><div class="u-name">حالتي</div><div style="font-size:11px;color:var(--mut)">'+(myCount?('لديك '+myCount+' قصة نشطة — تختفي بعد 24 ساعة'):'اضغط لإضافة حالة — تختفي بعد 24 ساعة')+'</div></div>'
      +(myCount?'<span onclick="event.stopPropagation();showStoryViewersAll()" style="font-size:14px;color:var(--acc);cursor:pointer;flex-shrink:0">👁️</span>':'')
      +'</div>';
      if(recent.length){
        h+='<div style="font-size:12px;color:var(--mut);padding:10px 4px 2px;font-weight:bold">الحالات الحديثة</div>';
        recent.forEach(function(a){h+=row(a,groups[a],false);});
      }
      if(viewed.length){
        h+='<div style="font-size:12px;color:var(--mut);padding:14px 4px 2px;font-weight:bold">الحالات التي تم عرضها</div>';
        viewed.forEach(function(a){h+=row(a,groups[a],true);});
      }
      if(!recent.length&&!viewed.length){
        h+='<div class="empty"><div class="big">⭕</div>لا توجد حالات حالياً<br>كن أول من ينشر استوري! ✨</div>';
      }
      box.innerHTML=h;
      updateStatusBadge();
    }catch(e){}
  };

  var _goPrev=window.go;
  window.go=function(s,navEl,fromBack){
    var r=_goPrev(s,navEl,fromBack);
    try{if(s==='status')renderStatusPage();}catch(e){}
    return r;
  };

  var _rsPrev=window.renderStories;
  window.renderStories=async function(){
    var r=await _rsPrev();
    try{updateStatusBadge();}catch(e){}
    return r;
  };
  var _oasPrev=window.openAuthorStories;
  window.openAuthorStories=async function(a,s){
    var r=await _oasPrev(a,s);
    try{setTimeout(updateStatusBadge,2500);}catch(e){}
    return r;
  };

  var _saSt=window.startAll;
  window.startAll=async function(){
    var r=await _saSt();
    try{updateStatusBadge();}catch(e){}
    return r;
  };
  setTimeout(function(){try{updateStatusBadge();}catch(e){}},3000);
})();

/* ===== خيار: إظهار القصص في صفحة الحالة ===== */
(function(){
  function _st(){try{return JSON.parse(LS.getItem('stories_settings')||'{}');}catch(e){return{};}}
  function _stSet(k,v){try{var s=_st();s[k]=v;LS.setItem('stories_settings',JSON.stringify(s));}catch(e){}}

  function ensureCheckbox(){
    try{
      var scr=el('s-stories');
      if(!scr||el('spStatus'))return;
      var label=document.createElement('label');
      label.style.cssText='display:flex;align-items:center;gap:12px;font-size:14px;margin:12px 0;cursor:pointer';
      label.innerHTML='<input type="checkbox" id="spStatus" style="width:20px;height:20px;accent-color:var(--acc)"> صفحة الحالة';
      var ref=el('spMsg');
      if(ref&&ref.parentElement)ref.parentElement.insertBefore(label,ref.nextSibling);
      else{
        var first=scr.querySelector('.set-row');
        if(first)first.appendChild(label);else scr.appendChild(label);
      }
    }catch(e){}
  }

  function ensureStatusBar(){
    try{
      var scr=el('s-status');if(!scr)return null;
      var bar=el('storiesBarStatus');
      if(!bar){
        bar=document.createElement('div');bar.id='storiesBarStatus';
        bar.style.cssText='display:none;gap:10px;overflow-x:auto;padding:8px 4px;margin-bottom:8px';
        var fbar=document.createElement('div');fbar.id='storiesFilterBarStatus';
        fbar.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 4px 0';
        var list=el('statusList');
        if(list){scr.insertBefore(fbar,list);scr.insertBefore(bar,list);}
      }
      return bar;
    }catch(e){return null;}
  }

  function syncStatusBar(){
    try{
      var bar=ensureStatusBar();if(!bar)return;
      var on=(_st().showStatus===true);
      var src=el('storiesBar'),fsrc=el('storiesFilterBar'),fdst=el('storiesFilterBarStatus');
      if(on&&src&&src.innerHTML){
        bar.innerHTML=src.innerHTML;
        bar.style.display='flex';
        if(fdst&&fsrc){fdst.innerHTML=fsrc.innerHTML;fdst.style.display='flex';}
      }else{
        bar.style.display='none';
        if(fdst)fdst.style.display='none';
      }
    }catch(e){}
  }

  document.addEventListener('click',function(e){
    try{
      var b=e.target&&e.target.closest?e.target.closest('#storiesFilterBarStatus .stFilterPill'):null;
      if(!b)return;
      LS.setItem('stories_filter',b.getAttribute('data-f'));
      renderStories();
    }catch(err){}
  });

  document.addEventListener('change',function(e){
    try{
      if(e.target&&e.target.id==='spStatus'){
        _stSet('showStatus',e.target.checked);
        syncStatusBar();
        toast(e.target.checked?'✅ القصص ستظهر في صفحة الحالة':'القصص مخفية من صفحة الحالة');
      }
    }catch(err){}
  });

  var _rsPrev=window.renderStories;
  window.renderStories=async function(){
    var r=await _rsPrev();
    try{syncStatusBar();}catch(e){}
    return r;
  };
  var _goPrev=window.go;
  window.go=function(s,nv,fb){
    var r=_goPrev(s,nv,fb);
    try{if(s==='status'){ensureCheckbox();setTimeout(syncStatusBar,300);}}catch(e){}
    return r;
  };
  var _saSb=window.startAll;
  window.startAll=async function(){
    var r=await _saSb();
    try{ensureCheckbox();syncStatusBar();}catch(e){}
    return r;
  };
})();

/* ===== إصلاح تراكب خانات إعدادات القصص ===== */
(function(){
  function _st(){try{return JSON.parse(LS.getItem('stories_settings')||'{}');}catch(e){return{};}}
  function _stSet(k,v){try{var s=_st();s[k]=v;LS.setItem('stories_settings',JSON.stringify(s));}catch(e){}}

  function rebuildSection(){
    try{
      var scr=el('s-stories');
      if(!scr)return;
      var first=scr.querySelector('.set-row');
      if(!first)return;
      var rowStyle='display:flex;align-items:center;justify-content:space-between;font-size:14px;margin:12px 0;cursor:pointer;padding:12px 14px;background:var(--card2);border-radius:12px;border:1px solid var(--line)';
      first.innerHTML='<h4>أظهر شريط القصص في:</h4>'
      +'<label style="'+rowStyle+'"><span>📱 صفحة المتصلين</span><input type="checkbox" id="spOn" style="width:20px;height:20px;accent-color:var(--acc)"></label>'
      +'<label style="'+rowStyle+'"><span>⭕ صفحة الحالة</span><input type="checkbox" id="spStatus" style="width:20px;height:20px;accent-color:var(--acc)"></label>'
      +'<label style="'+rowStyle+'"><span>💬 صفحة الرسائل</span><input type="checkbox" id="spMsg" style="width:20px;height:20px;accent-color:var(--acc)"></label>';
      var s=_st();
      var on=el('spOn'),st=el('spStatus'),msg=el('spMsg');
      if(on)on.checked=(s.showOnline!==false);
      if(st)st.checked=(s.showStatus===true);
      if(msg)msg.checked=(s.showMsgs===true);
    }catch(e){}
  }

  document.addEventListener('change',function(e){
    try{
      var t=e.target;
      if(!t)return;
      if(t.id==='spOn'){_stSet('showOnline',t.checked);try{renderStories();}catch(e2){}}
      else if(t.id==='spStatus'){_stSet('showStatus',t.checked);try{syncStatusBar();}catch(e2){}}
      else if(t.id==='spMsg'){_stSet('showMsgs',t.checked);try{renderStories();}catch(e2){}}
    }catch(err){}
  });

  var _gFixPrev=window.go;
  window.go=function(s,nv,fb){
    var r=_gFixPrev(s,nv,fb);
    try{if(s==='stories')setTimeout(rebuildSection,80);}catch(e){}
    return r;
  };
  setTimeout(rebuildSection,1500);
})();

/* ===== نظام آخر التحديثات (للجميع / خاص بصاحب الموقع) ===== */
(function(){
  function _arr(v){return Array.isArray(v)?v:[];}
  async function _load(){try{var s=await SDB.loadSettings();return _arr(s.updates);}catch(e){return[];}}
  async function _save(a){await SDB.saveSetting('updates',a);}

  if(!el('s-updates')){
    var scr=document.createElement('div');
    scr.className='screen';
    scr.id='s-updates';
    scr.innerHTML='<div class="sub-title" onclick="go(\'settings\')">➔ آخر التحديثات</div>'
    +'<div id="updatesBody" style="padding:4px"></div>';
    var content=document.querySelector('.content');
    var ref=el('s-settings');
    if(ref&&ref.parentElement)content.insertBefore(scr,ref.nextSibling);
    else content.appendChild(scr);
  }
  try{if(typeof MAIN_SCREENS!=='undefined'&&MAIN_SCREENS.indexOf('updates')===-1)MAIN_SCREENS.push('updates');}catch(e){}

  window.renderUpdatesPage=async function(){
    try{
      if(!me)return;
      var own=isOwner();
      var box=el('updatesBody');
      if(!box)return;
      box.innerHTML='<div style="text-align:center;color:var(--mut);padding:20px">جاري التحميل...</div>';
      var all=await _load();
      all.sort(function(a,b){return (b.date||0)-(a.date||0);});
      var list=all.filter(function(u){return own||u.pub!==false;});
      try{LS.setItem('updates_seen',String(Date.now()));}catch(e){}
      _badgeU(0);
      var h='';
      if(own)h+='<button class="lbtn" onclick="updAddOpen()" style="margin-bottom:12px">➕ إضافة تحديث جديد</button>';
      if(!list.length)h+='<div class="empty"><div class="big">🔔</div>لا توجد تحديثات بعد</div>';
      list.forEach(function(u){
        var ownOnly=(u.pub===false);
        var ds=new Date(Number(u.date||Date.now())).toLocaleDateString('ar-EG',{day:'2-digit',month:'2-digit',year:'numeric'});
        h+='<div style="background:var(--card);border:1px solid '+(ownOnly?'var(--yel)':'var(--line)')+';border-right:4px solid '+(ownOnly?'var(--yel)':'var(--grn)')+';border-radius:12px;padding:14px;margin-bottom:10px">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="color:var(--acc);font-size:16px">'+escapeHtml(u.title||'')+'</b><span style="font-size:11px;color:var(--mut);white-space:nowrap">'+ds+'</span></div>'
        +(ownOnly?'<div style="font-size:11px;color:var(--yel);font-weight:bold;margin-top:4px">🔒 خاص بالإدارة فقط</div>':'')
        +'<div style="font-size:14px;line-height:2;color:var(--txt);margin-top:8px;white-space:pre-line">'+escapeHtml(u.body||'')+'</div>'
        +(own?'<div style="display:flex;gap:8px;margin-top:10px"><button class="ebtn" onclick="updToggle(\''+u.id+'\')">'+(ownOnly?'🌍 إظهار للجميع':'🔒 إخفاء (للإدارة)')+'</button><button class="xbtn" onclick="updDel(\''+u.id+'\')">🗑️ حذف</button></div>':'')
        +'</div>';
      });
      box.innerHTML=h;
    }catch(e){}
  };

  window.openUpdates=function(){
    try{var m=el('updatesModal');if(m)m.remove();}catch(e){}
    go('updates',null);
  };

  window.updAddOpen=function(){
    if(!isOwner())return toast('لصاحب الموقع فقط');
    var f=el('updFormModal');
    if(f)f.remove();
    f=document.createElement('div');f.id='updFormModal';f.className='modal';
    f.innerHTML='<div class="m-card2" style="width:330px"><h3>➕ تحديث جديد</h3>'
    +'<input id="updTitle" placeholder="عنوان التحديث (مثال: ميزة جديدة ✨)" style="width:100%;padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--txt);border-radius:8px;font-size:13px">'
    +'<textarea id="updBody" placeholder="اكتب تفاصيل التحديث..." style="width:100%;min-height:90px;background:var(--bg);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:10px;font-size:13px;resize:none;margin-top:8px"></textarea>'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:10px 0;cursor:pointer"><input type="checkbox" id="updPriv"> 🔒 خاص بصاحب الموقع فقط</label>'
    +'<button style="background:var(--grn);color:#fff" onclick="updSave()">💾 حفظ التحديث</button>'
    +'<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'updFormModal\')">إلغاء</button></div>';
    f.onclick=function(e){if(e.target===f)closeModal('updFormModal');};
    document.body.appendChild(f);
    f.classList.add('open');
  };

  window.updSave=async function(){
    try{
      if(!isOwner())return toast('لصاحب الموقع فقط');
      var t=el('updTitle').value.trim(),b=el('updBody').value.trim();
      if(!t)return toast('اكتب عنوان التحديث');
      if(!b)return toast('اكتب تفاصيل التحديث');
      var priv=el('updPriv').checked;
      var all=await _load();
      all.push({id:'u'+Date.now()+Math.floor(Math.random()*999),title:t,body:b,date:Date.now(),pub:!priv});
      await _save(all);
      closeModal('updFormModal');
      toast('تم حفظ التحديث ✅');
      renderUpdatesPage();
      updateUpdatesBadge();
    }catch(e){toast('خطأ: '+e.message);}
  };

  window.updDel=async function(id){
    if(!isOwner())return;
    if(!confirm('حذف هذا التحديث؟'))return;
    var all=await _load();
    all=all.filter(function(u){return u.id!==id;});
    await _save(all);
    toast('تم الحذف');
    renderUpdatesPage();
  };

  window.updToggle=async function(id){
    if(!isOwner())return;
    var all=await _load();
    all.forEach(function(u){if(u.id===id)u.pub=(u.pub===false);});
    await _save(all);
    toast('تم التحديث');
    renderUpdatesPage();
  };

  function _badgeU(n){
    try{
      var d=el('updBadgeDot');
      if(d){if(n>0){d.style.display='inline-flex';d.innerText=n;}else d.style.display='none';}
    }catch(e){}
  }
  window.updateUpdatesBadge=async function(){
    try{
      if(!me)return;
      var all=await _load();
      var seen=parseInt(LS.getItem('updates_seen')||'0');
      var n=0;
      all.forEach(function(u){if(u.pub!==false&&(u.date||0)>seen)n++;});
      _badgeU(n);
    }catch(e){}
  };

  function ensureItem(){
    try{
      var scr=el('s-settings');if(!scr)return;
      if(!el('updatesMenuItem')){
        var card=document.createElement('div');
        card.className='menu-list';card.id='updatesMenuItem';
        card.style.marginBottom='12px';
        card.innerHTML='<div class="m-item" onclick="openUpdates()" style="cursor:pointer"><span>🔔 آخر التحديثات <span id="updBadgeDot" style="display:none;min-width:18px;height:18px;background:var(--red);color:#fff;border-radius:10px;font-size:10px;font-weight:bold;align-items:center;justify-content:center;padding:0 5px;margin-right:6px;vertical-align:middle"></span></span><span>👈</span></div>';
        var p=scr.querySelector('.p-card');
        if(p&&p.parentElement)p.parentElement.insertBefore(card,p.nextSibling);
        else scr.insertBefore(card,scr.firstChild);
      }
    }catch(e){}
  }

  var _goU=window.go;
  window.go=function(s,navEl,fromBack){
    var r=_goU(s,navEl,fromBack);
    try{if(s==='updates')renderUpdatesPage();}catch(e){}
    return r;
  };
  window.addEventListener('popstate',function(){
    try{var scr=el('s-updates');if(scr&&scr.classList.contains('active')&&!chat){go('settings',null,true);}}catch(e){}
  });

  var _saU2=window.startAll;
  window.startAll=async function(){
    var r=await _saU2();
    try{
      ensureItem();
      var all=await _load();
      if(!all.length){
        await _save([{id:'u1',title:'🎉 مرحباً بكم في شات سونيك',body:'تابع هذه الصفحة لتعرف كل جديد ومميزات الموقع أول بأول ⚡',date:Date.now(),pub:true}]);
      }
      updateUpdatesBadge();
    }catch(e){}
    return r;
  };
  setInterval(function(){try{updateUpdatesBadge();}catch(e){}},60000);
})();

/* ===== زرار الصداقة في قائمة الشات: إضافة ↔ إلغاء تلقائي ===== */
(function(){
  function _isF(){return chat&&chat.type==='user'&&me&&me.friends&&me.friends.indexOf(chat.id)>-1;}

  function _updBtn(){
    try{
      if(!chat||chat.type!=='user')return;
      var btn=el('chatFriendBtn');
      if(!btn)return;
      if(_isF()){btn.innerHTML='❌ إلغاء الصداقة';btn.onclick=window.removeFriendTarget;}
      else{btn.innerHTML='⭐ إضافة صديق';btn.onclick=window.addFriend;}
    }catch(e){}
  }
  window.updateFriendBtn=_updBtn;

  window.removeFriendTarget=async function(){
    try{
      if(!chat||chat.type!=='user')return;
      var target=chat.id;
      if(isOwnerName(target))return toast('👑 مش ممكن تشيل صاحب الموقع 😄');
      if(!confirm('إلغاء الصداقة مع '+getMsgName(target)+'؟'))return;
      me.friends=(me.friends||[]).filter(function(x){return x!==target;});
      await updateMe({friends:me.friends});
      toast('تم إلغاء الصداقة');
      _updBtn();
      try{renderFriends();}catch(e){}
      try{renderMsgs();}catch(e){}
    }catch(e){toast('خطأ: '+e.message);}
  };

  var _afPrev=window.addFriend;
  window.addFriend=async function(){
    var r=await _afPrev();
    try{_updBtn();}catch(e){}
    return r;
  };

  var _tcPrev=window.toggleChatMenu;
  window.toggleChatMenu=function(e){
    try{
      if(e)e.stopPropagation();
      var menu=el('chatMenu');
      if(!menu)return _tcPrev?_tcPrev(e):undefined;
      if(chat&&chat.type==='room'){
        menu.innerHTML='<button onclick="toggleChatSearch()">🔍 بحث في المحادثة</button>';
      }else{
        var _mm=(me&&me.allowMedia===false)?'<button onclick="toggleMediaPerm()" id="mediaPermBtn">🖼️ '+(me.mediaBlock&&me.mediaBlock[chat.id]?'السماح بالوسائط':'منع الوسائط')+'</button>':'';
        var fTxt=_isF()?'❌ إلغاء الصداقة':'⭐ إضافة صديق';
        menu.innerHTML=_mm
        +'<button onclick="openReport()">🚨 إبلاغ الإدارة</button>'
        +'<button onclick="toggleChatSearch()">🔍 بحث في المحادثة</button>'
        +'<button onclick="delChat()">🗑️ حذف المحادثة</button>'
        +'<button onclick="blockTarget()" id="chatBlockBtn">⛔ حظر المستخدم</button>'
        +'<button id="chatFriendBtn">'+fTxt+'</button>';
        setTimeout(_updBtn,0);
      }
      menu.classList.toggle('open');
    }catch(err){
      if(_tcPrev)_tcPrev(e);
    }
  };

  var _ouPrev=window.openUser;
  window.openUser=function(n){
    var r=_ouPrev(n);
    try{setTimeout(_updBtn,100);setTimeout(_updBtn,500);}catch(e){}
    return r;
  };
})();
/* ============================================================
   ⚡ شات سونيك — script.js (الجزء 4: محرر النص + الخطوط + الحضور + اللمسات الأخيرة)
   ============================================================ */

/* ===== محرر النص الكامل + أنماط الخط (عادي/نسخ/كوفي) + عارض يدعم الخطوط ===== */
(function(){
  if(!document.getElementById('sonicFonts')){
    var fl=document.createElement('link');fl.id='sonicFonts';fl.rel='stylesheet';
    fl.href='https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Amiri:wght@400;700&family=Reem+Kufi:wght@400;700&display=swap';
    document.head.appendChild(fl);
  }
  var FONTS={
    n:{name:'عادي',css:"'Cairo',system-ui,sans-serif",size:'26px'},
    s:{name:'نسخ',css:"'Amiri',serif",size:'32px'},
    k:{name:'كوفي',css:"'Reem Kufi',sans-serif",size:'28px'}
  };
  var COLORS=['#0f172a','#1e3a8a','#312e81','#6d28d9','#86198f','#9d174d','#9a3412','#065f46','#111827','#450a0a'];
  var _col=COLORS[0],_fnt='n';

  function parseTxt(img){
    var p=String(img||'').split('|||');
    var col=p[0]||'#0f172a';
    var f=(p[1]&&p[1].length===1&&'nsk'.indexOf(p[1])>-1)?p[1]:'n';
    var txt=(f==='n')?p.slice(1).join('|||'):p.slice(2).join('|||');
    return {col:col,f:f,txt:txt};
  }

  function buildEd(){
    if(el('stTextFull'))return;
    var d=document.createElement('div');
    d.id='stTextFull';
    d.style.cssText='position:fixed;inset:0;z-index:9600;display:none;flex-direction:column;background:'+COLORS[0];
    d.innerHTML='<div style="display:flex;align-items:center;gap:10px;padding:14px 16px">'
    +'<button id="stTxClose" style="background:rgba(255,255,255,.18);border:none;color:#fff;width:38px;height:38px;border-radius:50%;font-size:17px;cursor:pointer">✕</button>'
    +'<b style="color:#fff;font-size:16px;flex:1">قصة جديدة</b>'
    +'<span id="stTxTime" style="background:rgba(255,255,255,.18);color:#fff;font-size:11px;padding:5px 12px;border-radius:14px"></span></div>'
    +'<textarea id="stTxArea" placeholder="اكتب قصتك..." maxlength="250" style="flex:1;background:transparent;border:none;outline:none;color:#fff;font-size:26px;font-weight:700;text-align:center;resize:none;padding:20px 24px;line-height:2"></textarea>'
    +'<div style="padding:0 16px 6px"><span id="stTxCnt" style="color:rgba(255,255,255,.7);font-size:12px;direction:ltr">0/250</span></div>'
    +'<div style="background:rgba(0,0,0,.25);padding:12px 14px 18px">'
    +'<div id="stTxColors" style="display:flex;gap:10px;overflow-x:auto;justify-content:center;padding:4px 2px 12px"></div>'
    +'<div style="display:flex;align-items:center;gap:10px">'
    +'<button id="stTxPub" style="background:rgba(255,255,255,.22);border:none;color:#fff;padding:11px 24px;border-radius:22px;font-size:14px;font-weight:bold;cursor:pointer">نشر</button>'
    +'<div style="flex:1"></div><div id="stTxFonts" style="display:flex;gap:6px;background:rgba(0,0,0,.3);border-radius:24px;padding:5px"></div>'
    +'</div></div>';
    document.body.appendChild(d);
    var cb=el('stTxColors');
    COLORS.forEach(function(c,i){
      var s=document.createElement('span');
      s.setAttribute('data-c',c);
      s.style.cssText='min-width:34px;width:34px;height:34px;border-radius:50%;background:'+c+';cursor:pointer;border:2px solid '+(i===0?'#fff':'transparent')+';flex-shrink:0';
      s.onclick=function(){_col=c;_applyEd();_mark(cb.children,s);};
      cb.appendChild(s);
    });
    var fb=el('stTxFonts');
    Object.keys(FONTS).forEach(function(k){
      var b=document.createElement('span');
      b.setAttribute('data-f',k);b.textContent=FONTS[k].name;
      b.style.cssText='padding:8px 16px;border-radius:20px;font-size:13px;font-weight:bold;cursor:pointer;color:#fff;background:transparent';
      b.style.fontFamily=FONTS[k].css;
      b.onclick=function(){_fnt=k;_applyEd();_mark(fb.children,b);};
      fb.appendChild(b);
    });
    el('stTxClose').onclick=function(){closeEd();};
    el('stTxPub').onclick=function(){pubTxt();};
    el('stTxArea').addEventListener('input',function(){el('stTxCnt').innerText=this.value.length+'/250';});
  }
  function _mark(kids,sel){Array.prototype.forEach.call(kids,function(k){k.style.borderColor=(k===sel)?'#fff':'transparent';if(k.style.background&&k.style.background!=='transparent')k.style.background=(k===sel)?'#fff':'transparent',k.style.color=(k===sel)?'#111':'#fff';});}
  function _applyEd(){
    var d=el('stTextFull');if(!d)return;
    d.style.background=_col;
    var a=el('stTxArea');
    a.style.fontFamily=FONTS[_fnt].css;a.style.fontSize=FONTS[_fnt].size;
  }
  window.openTextEditor=function(){
    if(!me)return toast('سجل دخولك أولاً');
    buildEd();
    _col=COLORS[0];_fnt='n';
    el('stTxArea').value='';el('stTxCnt').innerText='0/250';
    _applyEd();
    var cb=el('stTxColors'),fb=el('stTxFonts');
    _mark(cb.children,cb.children[0]);
    Array.prototype.forEach.call(fb.children,function(k){var sel=(k.getAttribute('data-f')==='n');k.style.background=sel?'#fff':'transparent';k.style.color=sel?'#111':'#fff';});
    el('stTxTime').innerText=new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
    el('stTextFull').style.display='flex';
    setTimeout(function(){try{el('stTxArea').focus();}catch(e){}},100);
  };
  function closeEd(){var d=el('stTextFull');if(d)d.style.display='none';}
  function pubTxt(){
    var t=el('stTxArea').value.trim();
    if(!t)return toast('اكتب قصتك الأول');
    var sid='st'+Date.now()+Math.floor(Math.random()*999);
    sb.from('stories').insert({id:sid,author:me.name,img:_col+'|||'+_fnt+'|||'+t,stype:'text',stime:Date.now()}).then(function(r){
      if(r.error)return toast('خطأ: '+r.error.message);
      toast('تم نشر حالتك ✅');closeEd();try{renderStories();}catch(e){}
    });
  }
  window.scShowText=function(){window.openTextEditor();};

  /* ---------- العارض الكامل مع دعم الخطوط (النسخة النهائية) ---------- */
  var EMO=['👋','🔥','😢','😮','😂','❤️'];
  var AD={enabled:true,title:'🚀 شات سونيك ⚡',desc:'شارك الموقع مع أصحابك وادعم استمرارنا ☕',url:'https://buymeacoffee.com/medosonic'};
  var L3=[],I3=0,Q3=[],ADN3=0,T3=null,EL3=0,PA3=false,RET3=null,HIST3=[];
  function arr3(v){return Array.isArray(v)?v:[];}
  function stop3(){if(T3){clearInterval(T3);clearTimeout(T3);T3=null;}}
  function _typ3(){var si=el('storyReplyInput');return !!(si&&document.activeElement===si);}
  function retScr3(){try{var a=document.querySelector('.screen.active');return a?a.id.replace('s-',''):null;}catch(e){return null;}}
  window._buildQueue=async function(cur){
    try{
      var d=await sb.from('stories').select('author,stime').gt('stime',Date.now()-86400000);
      var set={},a=[];(d.data||[]).forEach(function(x){if(!set[x.author]){set[x.author]=1;a.push(x.author);}});
      var idx=a.indexOf(cur);
      Q3=(idx>-1)?a.slice(idx+1).concat(a.slice(0,idx)):a.filter(function(x){return x!==cur;});
    }catch(e){Q3=[];}
  };
  window.openAuthorStories=async function(author,startIdx){
    try{if(!el('storyViewModal').classList.contains('open')){if(!RET3)RET3=retScr3();}}catch(e){}
    try{if(L3.length&&String(L3[0].author)!==String(author))HIST3.push({a:String(L3[0].author),i:L3.length-1});}catch(e){}
    var d=await sb.from('stories').select('*').eq('author',author).gt('stime',Date.now()-86400000).order('stime',{ascending:true});
    if(d.error)return toast('خطأ: '+d.error.message);
    if(!d.data||!d.data.length)return toast('الحالة انتهت');
    (d.data||[]).forEach(function(s){
      if(s.stype!=='text'&&s.img&&String(s.img).indexOf('|||')>-1){var p=String(s.img).split('|||');s.img=p[0];s._cap=p.slice(1).join('|||');}
      else if(s.stype!=='text')s._cap='';
    });
    L3=d.data;
    I3=(startIdx!==undefined&&startIdx>-1&&startIdx<L3.length)?startIdx:0;
    try{window._buildQueue(author);}catch(e){}
    _show();
  };
  window.openStoryById=async function(id){
    var d=await sb.from('stories').select('*').eq('id',id).limit(1);
    if(!d.data||!d.data[0])return toast('انتهت صلاحية هذه الحالة');
    var s=d.data[0];
    try{if(!el('storyViewModal').classList.contains('open')){if(!RET3)RET3=retScr3();}}catch(e){}
    try{window._buildQueue(s.author);}catch(e){}
    await window.openAuthorStories(s.author);
    for(var i=0;i<L3.length;i++)if(L3[i].id===id){if(i!==I3){I3=i;_show();}break;}
  };
  window.viewStory=function(id){window.openStoryById(id);};
  window.nextStory=function(){
    if(I3<L3.length-1){I3++;_show();return;}
    var nxt=Q3.shift();
    if(!nxt){closeModal('storyViewModal');toast('✅ انتهت جميع القصص');return;}
    ADN3++;
    if(AD.enabled&&ADN3%2===0){_adSlot(nxt);}
    else{window.openAuthorStories(nxt);}
  };
  window.prevStory=function(){
    if(I3>0){I3--;_show();return;}
    var h=HIST3.pop();
    if(h){window.openAuthorStories(h.a,h.i);}
    else toast('دي أول قصة');
  };
  window.closeStoryView=function(){closeModal('storyViewModal');};
  window.toggleStoryPause=function(){
    PA3=!PA3;
    var b=el('stPauseBtn');if(b)b.innerText=PA3?'▶':'⏸';
    try{var v=el('storyVideo');if(v){if(PA3)v.pause();else v.play().catch(function(){});}}catch(e){}
  };
  window.reactStory=async function(author,sid,em){
    try{
      if(author===me.name)return toast('دي حالتك 😄');
      if(isBlockedByOther(author))return toast('⛔ محظور من هذا المستخدم');
      var convId=[me.name,author].sort().join('_');
      var m={_id:'m'+Date.now()+Math.random().toString(36).slice(2),_conv:convId,from:me.name,data:em,type:'text',time:Date.now(),replyTo:'story:'+sid,edited:false,deleted:false,read:false,reactions:{},meta:{story:sid,thumb:'',vtype:'reaction'}};
      await SDB.addMsg(m);
      await SDB.upsertConv(convId,{a:me.name,b:author,t:Date.now(),lastFrom:me.name,lastMsg:'تفاعل مع حالتك '+em});
      toast('تم إرسال تفاعلك '+em+' ✅');
    }catch(e){toast('خطأ: '+e.message);}
  };
  window.sendStoryReply=function(author,sid,stype){
    var inp=el('storyReplyInput');var text=inp?(inp.value||'').trim():'';
    if(!text)return toast('اكتب ردك الأول');
    if(author===me.name)return;
    if(isBlockedByOther(author))return toast('⛔ محظور من هذا المستخدم');
    var thumb='',vtype=stype||'image';
    for(var i=0;i<L3.length;i++)if(L3[i].id===sid){if(L3[i].stype==='text'){thumb='';vtype='text';}else{thumb=L3[i].img||'';vtype=L3[i].stype||vtype;}break;}
    if(thumb&&thumb.length>80000)thumb='';
    var convId=[me.name,author].sort().join('_');
    var m={_id:'m'+Date.now()+Math.random().toString(36).slice(2),_conv:convId,from:me.name,data:text,type:'text',time:Date.now(),replyTo:'story:'+sid,edited:false,deleted:false,read:false,reactions:{},meta:{story:sid,thumb:thumb,vtype:vtype}};
    SDB.addMsg(m).then(function(){
      SDB.upsertConv(convId,{a:me.name,b:author,t:Date.now(),lastFrom:me.name,lastMsg:'📷 رد على حالة'});
      toast('تم إرسال ردك ✅');
      closeModal('storyViewModal');
    });
  };
  function _adSlot(nxt){
    var box=el('storyViewBox');
    box.innerHTML='<div style="position:absolute;inset:0;background:#0d0518;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;z-index:10"><span style="position:absolute;top:10px;right:12px;background:rgba(255,255,255,.15);color:#fff;font-size:10px;padding:3px 10px;border-radius:10px">إعلان</span><div style="font-size:24px">'+AD.title+'</div><div style="color:rgba(255,255,255,.85);font-size:14px;text-align:center;padding:0 26px;line-height:1.9">'+AD.desc+'</div><button onclick="event.stopPropagation();window.open(\''+AD.url+'\',\'_blank\')" style="background:linear-gradient(135deg,#ff4fd8,#c026d3);border:none;color:#fff;padding:11px 30px;border-radius:24px;font-size:14px;font-weight:bold;cursor:pointer">افتح الآن</button><div style="color:rgba(255,255,255,.5);font-size:11px">القصة التالية بعد لحظات...</div></div>';
    setTimeout(function(){window.openAuthorStories(nxt);},4000);
  }
  function _show(){
    stop3();EL3=0;PA3=false;
    if(!L3.length||I3>=L3.length){closeModal('storyViewModal');return;}
    var s=L3[I3];
    if(me&&s.author!==me.name){var views=arr3(s.views);if(views.indexOf(me.name)===-1){views.push(me.name);s.views=views;sb.from('stories').update({views:views}).eq('id',s.id).then(function(){},function(){});}}
    var u=usersCache[s.author];
    var box=el('storyViewBox');
    var segs='';for(var i=0;i<L3.length;i++)segs+='<div style="flex:1;height:3px;background:rgba(255,255,255,.25);border-radius:2px;overflow:hidden"><div id="seg'+i+'" style="height:100%;width:'+(i<I3?'100%':'0%')+';background:#fff"></div></div>';
    var au=String(s.author).replace(/'/g,"\\'"),sid=String(s.id);
    var head='<div style="display:flex;align-items:center;gap:9px;padding:12px 14px 8px">'
    +'<button onclick="closeStoryView()" style="background:rgba(0,0,0,.35);border:none;color:#fff;width:36px;height:36px;border-radius:50%;font-size:15px;cursor:pointer;flex-shrink:0">✕</button>'
    +'<button id="stDotsBtn" data-sid="'+sid+'" style="background:rgba(0,0,0,.35);border:none;color:#fff;width:36px;height:36px;border-radius:50%;font-size:15px;cursor:pointer;flex-shrink:0;pointer-events:auto;z-index:15;position:relative">⋯</button>'
    +'<button id="stPauseBtn" onclick="toggleStoryPause()" style="background:rgba(0,0,0,.35);border:none;color:#fff;width:36px;height:36px;border-radius:50%;font-size:14px;cursor:pointer;flex-shrink:0">⏸</button>'
    +'<div style="flex:1"></div>'
    +'<div style="text-align:left"><div style="display:flex;align-items:center;gap:8px;justify-content:flex-end"><span style="color:#fff;font-weight:bold;font-size:13px;text-shadow:0 1px 4px #000">'+escapeHtml(getMsgName(s.author))+'</span><div style="width:36px;height:36px;border-radius:50%;overflow:hidden;background:var(--card2);border:2px solid rgba(255,255,255,.5)">'+getAvatar(u||{})+'</div></div><div style="color:rgba(255,255,255,.75);font-size:10px">'+timeAgo(s.stime||Date.now())+'</div></div></div>';
    var isVid=(s.stype==='video'),isTxt=(s.stype==='text');
    var media;
    if(isTxt){
      var t=parseTxt(s.img);
      var F=FONTS[t.f]||FONTS.n;
      media='<div style="position:absolute;inset:0;background:'+t.col+';display:flex;align-items:center;justify-content:center;padding:30px"><div style="color:#fff;font-family:'+F.css+';font-size:'+F.size+';font-weight:700;text-align:center;line-height:2;white-space:pre-wrap;max-width:92%;word-break:break-word">'+escapeHtml(t.txt)+'</div></div>';
    }else if(isVid){
      media='<video id="storyVideo" src="'+s.img+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain" autoplay playsinline></video>';
    }else{
      media='<img src="'+s.img+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain">';
    }
    var capHtml=s._cap?'<div style="margin:0 16px 10px;color:#fff;font-size:15px;text-align:center;line-height:1.9;word-break:break-word;text-shadow:0 1px 5px #000">'+escapeHtml(s._cap)+'</div>':'';
    var emo='<div style="display:flex;justify-content:center;gap:13px;padding:6px 0 8px">'+EMO.map(function(e){return '<button onclick="event.stopPropagation();reactStory(\''+au+'\',\''+sid+'\',\''+e+'\')" style="width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.15);font-size:23px;cursor:pointer">'+e+'</button>';}).join('')+'</div>';
    var reply=(s.author!==me.name)?'<div style="display:flex;gap:10px;padding:0 14px 16px;align-items:center"><input id="storyReplyInput" placeholder="رد على '+escapeHtml(getMsgName(s.author))+'..." style="flex:1;padding:12px 16px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:26px;color:#fff;font-size:13px;outline:none" onkeydown="if(event.key===\'Enter\')sendStoryReply(\''+au+'\',\''+sid+'\',\''+(s.stype||'image')+'\')"><button onclick="sendStoryReply(\''+au+'\',\''+sid+'\',\''+(s.stype||'image')+'\')" style="background:none;border:none;color:rgba(255,255,255,.8);font-size:22px;cursor:pointer">➤</button></div>':'<div style="padding:8px 0 12px;text-align:center;color:rgba(255,255,255,.55);font-size:12px">هذه حالتك</div>';
    box.innerHTML='<div style="position:absolute;inset:0;background:linear-gradient(160deg,#2a2a5e,#141038)"></div>'+media
    +'<div style="position:absolute;top:0;left:0;right:0;z-index:5"><div style="display:flex;gap:4px;padding:10px 12px 0">'+segs+'</div>'+head+'</div>'
    +'<div onclick="prevStory()" style="position:absolute;top:0;bottom:0;right:0;width:30%;z-index:3"></div><div onclick="nextStory()" style="position:absolute;top:0;bottom:0;left:0;width:70%;z-index:3"></div>'
    +'<div style="position:absolute;bottom:0;left:0;right:0;z-index:5">'+capHtml+emo+reply+'</div>';
    openModal('storyViewModal');
    try{var _si=el('storyReplyInput');if(_si){_si.addEventListener('focus',function(){if(!PA3)window.toggleStoryPause();});_si.addEventListener('blur',function(){if(PA3)window.toggleStoryPause();});}}catch(e){}
    if(isVid){
      var v=el('storyVideo');if(!v)return;
      v.muted=false;var pp=v.play();if(pp&&pp.catch)pp.catch(function(){v.muted=true;try{v.play();}catch(_e){}});
      v.addEventListener('timeupdate',function(){var sg=el('seg'+I3);if(sg&&v.duration>0)sg.style.width=(v.currentTime/v.duration*100)+'%';});
      v.addEventListener('ended',window.nextStory);
      v.addEventListener('error',function(){stop3();T3=setTimeout(window.nextStory,3000);});
    }else{
      T3=setInterval(function(){
        try{
          if(PA3||_typ3())return;
          EL3+=100;
          var sg=el('seg'+I3);if(sg)sg.style.width=Math.min(100,EL3/6000*100)+'%';
          if(EL3>=6000){stop3();window.nextStory();}
        }catch(e){}
      },100);
    }
  }
  window._showCurStory=function(){_show();};
  var _cm3=window.closeModal;
  window.closeModal=function(id){
    if(id==='storyViewModal'){
      stop3();PA3=false;HIST3=[];
      try{var v=el('storyVideo');if(v){v.pause();v.removeAttribute('src');v.load();}}catch(e){}
      try{if(RET3){var r=RET3;RET3=null;if(el('s-'+r))go(r,getNavEl(r),true);}}catch(e){}
    }
    return _cm3(id);
  };
})();

/* ===== شاشة الشات الكاملة: تعليم صف الإدخال ===== */
(function(){
  function tag(){
    try{
      var mi=el('msgInput');
      if(!mi)return;
      var p=mi.closest('div[style*="align-items:center"]');
      while(p&&p.parentElement&&!p.parentElement.classList.contains('chat-win'))p=p.parentElement;
      if(p&&!p.classList.contains('sonic-input-row'))p.classList.add('sonic-input-row');
      var send=document.querySelector('#s-chat .ic-btn[onclick="sendMsg()"]');
      if(send)send.setAttribute('data-send','1');
    }catch(e){}
  }
  tag();
  var n=0;
  var iv=setInterval(function(){tag();n++;if(n>20)clearInterval(iv);},500);
})();

/* ===== إخفاء زرار تثبيت التطبيق مؤقتاً ===== */
(function(){
  setInterval(function(){
    try{
      document.querySelectorAll('button').forEach(function(b){
        if((b.innerText||'').indexOf('تثبيت التطبيق')>-1)b.style.display='none';
      });
    }catch(e){}
  },1200);
})();

/* ===== الأوفلاين: 60 ثانية للجميع — بدون اختفاء غلط عند التنقل ===== */
(function(){
  window.ONLINE_TIMEOUT=60000;
  window._markGone=function(){};
  window._markBack=function(){
    if(!me)return;
    try{sb.from('users').update({last_seen:Date.now()}).eq('name',me.name);}catch(e){}
    if(usersCache[me.name])usersCache[me.name].lastSeen=Date.now();
    if(me)me.lastSeen=Date.now();
    try{renderOnline();}catch(e){}
  };
  window.renderOnline=function(){
    var q=el('searchInput').value.trim().toLowerCase();
    var chips='';if(filterG!=='الكل')chips+='<span class="chip" onclick="setG(\'الكل\');renderOnline()">النوع: '+filterG+' ✕</span> ';if(filterC!=='الكل')chips+='<span class="chip" onclick="filterC=\'الكل\';renderOnline()">الدولة: '+filterC+' ✕</span>';
    el('chips').innerHTML=chips;
    var all=[];var seen={};
    for(var k in usersCache){var u=usersCache[k];if(seen[u.name])continue;seen[u.name]=true;all.push(u);}
    var list=all.filter(function(u){
      if(u.banned===true||u.is_active===false)return false;
      if(u.hidden===true&&!isOwner())return false;
      if(!isOnline(u))return false;
      if(isBlockedByMe(u.name))return false;
      return u.name.toLowerCase().indexOf(q)>-1&&(filterG==='الكل'||u.gender===filterG)&&(filterC==='الكل'||u.country===filterC);
    });
    list.sort(function(a,b){if(isOwnerName(a.name))return-1;if(isOwnerName(b.name))return 1;return 0;});
    if(!list.length){el('usersList').innerHTML='<div class="empty"><div class="big">🪐</div>لا يوجد مستخدمين متصلين حالياً</div>';return;}
    var html='';
    for(var i=0;i<list.length;i++){
      var u=list[i];var on=isOnline(u);
      var dots=isAdmin()?'<span class="u-dots" onclick="event.stopPropagation();openUserModal(\''+u.name+'\')">⋮</span>':'';
      var ownerBadge=isOwnerName(u.name)?'👑 ':'';
      html+='<div class="u-card" onclick="openUser(\''+u.name+'\')">'+getAvatarHTML(u,46)+'<span class="flag">'+(FLAGS[u.country]||flag('E','G'))+'</span><div style="flex:1"><div class="u-name">'+ownerBadge+styleName(u)+' ('+(u.age||'--')+') <span class="'+(u.gender==='أنثى'?'g-f':'g-m')+'">'+(u.gender==='أنثى'?'♀':'♂')+'</span></div><div style="font-size:11px;color:var(--mut)">'+role(u)+' • '+(on?'<span style="color:var(--grn)">متصل الآن</span>':'غير متصل')+'</div></div>'+dots+'</div>';
    }
    if(html!==lastOnlineHTML){el('usersList').innerHTML=html;lastOnlineHTML=html;}
  };
})();

/* ===== نظام الحضور الذكي: النشاط = أونلاين فوري للجميع ===== */
(function(){
  var _lastTouch=0;
  window.touchPresence=function(force){
    if(!me)return;
    var now=Date.now();
    if(!force&&now-_lastTouch<15000)return;
    _lastTouch=now;
    try{sb.from('users').update({last_seen:now}).eq('name',me.name);}catch(e){}
    if(me)me.lastSeen=now;
    if(usersCache[me.name])usersCache[me.name].lastSeen=now;
  };
  ['click','touchstart','keydown'].forEach(function(ev){
    document.addEventListener(ev,function(){try{touchPresence();}catch(e){}},{passive:true});
  });
  window.addEventListener('focus',function(){try{touchPresence(true);renderOnline();}catch(e){}});
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='visible'){try{touchPresence(true);renderOnline();}catch(e){}}
  });

  var _smP=window.sendMsg;
  window.sendMsg=async function(){try{touchPresence(true);}catch(e){}return _smP();};
  var _htP=window.handleTyping;
  window.handleTyping=function(){try{touchPresence();}catch(e){}return _htP?_htP():undefined;};

  window.startHeartbeat=function(){
    if(hbTimer)clearInterval(hbTimer);
    hbTimer=setInterval(async function(){
      if(!me)return;
      try{
        var now=Date.now();
        await sb.from('users').update({last_seen:now}).eq('name',me.name);
        if(usersCache[me.name])usersCache[me.name].lastSeen=now;
        if(me)me.lastSeen=now;
      }catch(e){}
    },20000);
  };

  window.renderOnline=function(){
    try{
      if(me&&me.banned!==true&&(!usersCache[me.name]))usersCache[me.name]=me;
      var q=el('searchInput')?el('searchInput').value.trim().toLowerCase():'';
      var chips='';if(filterG!=='الكل')chips+='<span class="chip" onclick="setG(\'الكل\');renderOnline()">النوع: '+filterG+' ✕</span> ';if(filterC!=='الكل')chips+='<span class="chip" onclick="filterC=\'الكل\';renderOnline()">الدولة: '+filterC+' ✕</span>';
      el('chips').innerHTML=chips;
      var all=[];var seen={};
      for(var k in usersCache){var u=usersCache[k];if(seen[u.name])continue;seen[u.name]=true;all.push(u);}
      var list=all.filter(function(u){
        if(u.banned===true||u.is_active===false)return false;
        if(u.hidden===true&&!isOwner()&&u.name!==(me&&me.name))return false;
        if(u.name===(me&&me.name))return true;
        if(!isOnline(u))return false;
        if(isBlockedByMe(u.name))return false;
        return u.name.toLowerCase().indexOf(q)>-1&&(filterG==='الكل'||u.gender===filterG)&&(filterC==='الكل'||u.country===filterC);
      });
      list.sort(function(a,b){if(isOwnerName(a.name))return-1;if(isOwnerName(b.name))return 1;return 0;});
      if(!list.length){el('usersList').innerHTML='<div class="empty"><div class="big">🪐</div>لا يوجد مستخدمين متصلين حالياً</div>';return;}
      var html='';
      for(var i=0;i<list.length;i++){
        var u=list[i];var on=isOnline(u)||u.name===(me&&me.name);
        var dots=isAdmin()?'<span class="u-dots" onclick="event.stopPropagation();openUserModal(\''+u.name+'\')">⋮</span>':'';
        var ownerBadge=isOwnerName(u.name)?'👑 ':'';
        var hid=(u.hidden===true)?' 🕶️':'';
        html+='<div class="u-card" onclick="openUser(\''+u.name+'\')">'+getAvatarHTML(u,46)+'<span class="flag">'+(FLAGS[u.country]||flag('E','G'))+'</span><div style="flex:1"><div class="u-name">'+ownerBadge+styleName(u)+' ('+(u.age||'--')+') <span class="'+(u.gender==='أنثى'?'g-f':'g-m')+'">'+(u.gender==='أنثى'?'♀':'♂')+'</span></div><div style="font-size:11px;color:var(--mut)">'+role(u)+' • '+(on?'<span style="color:var(--grn)">متصل الآن</span>'+hid:'غير متصل')+'</div></div>'+dots+'</div>';
      }
      if(html!==lastOnlineHTML){el('usersList').innerHTML=html;lastOnlineHTML=html;}
    }catch(e){}
  };

  var _pill=document.createElement('div');
  _pill.id='hiddenPill';
  _pill.style.cssText='display:none;position:fixed;top:8px;left:50%;transform:translateX(-50%);background:#7c3aed;color:#fff;padding:7px 16px;border-radius:20px;font-size:11px;font-weight:bold;z-index:800;box-shadow:0 3px 10px rgba(0,0,0,.45);cursor:pointer';
  _pill.innerText='🕶️ أنت في الوضع المخفي — اضغط للظهور';
  _pill.onclick=function(){try{el('pHide').checked=false;setPref('hidden',false);toast('✅ رجعت ظاهر للمستخدمين');}catch(e){}};
  document.body.appendChild(_pill);
  setInterval(function(){
    try{_pill.style.display=(me&&me.hidden===true)?'block':'none';}catch(e){}
  },1500);
})();

/* ===== آخر ظهور بصيغة واتساب ===== */
(function(){
  function arNum(n){try{return String(n).replace(/[0-9]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'[d];});}catch(e){return String(n);}}
  function lastSeenText(ts){
    try{
      if(!ts)return 'غير متصل';
      var d=new Date(Number(ts));
      var h=d.getHours();
      var m=('0'+d.getMinutes()).slice(-2);
      var ap=(h<12)?'ص':'م';
      var h12=h%12;if(h12===0)h12=12;
      var time=arNum(h12)+':'+arNum(m)+' '+ap;
      var now=new Date();
      var sameDay=d.toDateString()===now.toDateString();
      if(sameDay)return 'آخر ظهور اليوم الساعة '+time;
      var y=new Date(now);y.setDate(now.getDate()-1);
      if(d.toDateString()===y.toDateString())return 'آخر ظهور أمس الساعة '+time;
      var day=arNum(('0'+d.getDate()).slice(-2));
      var mo=arNum(('0'+(d.getMonth()+1)).slice(-2));
      return 'آخر ظهور '+day+'/'+mo+' الساعة '+time;
    }catch(e){return 'غير متصل';}
  }

  var _rchPrev=window.refreshChatHeader;
  window.refreshChatHeader=function(u){
    try{
      if(!u)return _rchPrev?_rchPrev(u):undefined;
      var on=isOnline(u);
      el('chatName').innerHTML=styleName(u);
      el('chatName').style.cursor='pointer';
      el('chatName').onclick=function(){openUserProfile(u.name);};
      el('chatAva').innerHTML=getAvatarHTML(u,46);
      el('chatAva').style.cursor='pointer';
      el('chatAva').onclick=function(){openUserProfile(u.name);};
      el('chatDot').className='dot '+(on?'on':'off');
      if(on){
        el('chatStatus').innerText='نشط';
        el('chatStatus').className='st-txt on';
      }else{
        el('chatStatus').innerText=lastSeenText(u.lastSeen);
        el('chatStatus').className='st-txt off';
      }
    }catch(e){
      try{if(_rchPrev)_rchPrev(u);}catch(e2){}
    }
  };
})();

/* ===== هيدر الشات الحي: الحالة بتتحدث لوحدها ===== */
(function(){
  try{window.ONLINE_TIMEOUT=60000;}catch(e){}

  setInterval(function(){
    try{
      if(!chat||chat.type!=='user'||!me)return;
      var u=usersCache[chat.id];
      if(u)refreshChatHeader(u);
    }catch(e){}
  },5000);

  setInterval(async function(){
    try{
      if(!chat||chat.type!=='user'||!me)return;
      var u=await SDB.getUser(chat.id);
      if(u){
        u.name=chat.id;
        if(usersCache[chat.id]){
          var old=usersCache[chat.id];
          for(var k in old){if(u[k]===undefined||u[k]===null)u[k]=old[k];}
        }
        usersCache[chat.id]=u;
        refreshChatHeader(u);
      }
    }catch(e){}
  },20000);

  window.addEventListener('focus',function(){
    try{
      if(chat&&chat.type==='user'&&usersCache[chat.id])refreshChatHeader(usersCache[chat.id]);
    }catch(e){}
  });
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='visible'){
      try{
        if(chat&&chat.type==='user'&&usersCache[chat.id])refreshChatHeader(usersCache[chat.id]);
      }catch(e){}
    }
  });
})();

/* ===== إصلاح قايمة الرسالة: رد/رياكشن/تعديل/حذف + ضغط مطول ===== */
(function(){
  var st=document.createElement('style');
  st.textContent=
  '.chat-menu{z-index:520!important}'
  +'.msg-menu{position:fixed!important;z-index:530!important}'
  +'.sticker-panel{z-index:520!important}'
  +'.chat-search{z-index:520!important}'
  +'#scrollDownBtn{z-index:450!important}'
  +'#newMsgPill{z-index:450!important}';
  document.head.appendChild(st);

  window.openMsgMenu=function(e,id,from){
    try{e.preventDefault();e.stopPropagation();}catch(_e){}
    msgMenuId=id;msgMenuTarget=from;
    var menu=el('msgMenu');
    var isMine=(from===me.name);
    menu.innerHTML='<button onclick="doReply()">↩️ رد</button>'
    +'<button onclick="doReact()">❤️ رياكشن</button>'
    +(isMine||isOwner()?'<button onclick="doEdit()">✏️ تعديل</button><button onclick="doDelete()">🗑️ حذف</button>':'');
    menu.classList.add('open');
    menu.style.display='flex';
    var mw=165,mh=menu.offsetHeight||150;
    var x=(e.clientX||window.innerWidth-180),y=(e.clientY||200);
    if(x+mw>window.innerWidth-8)x=window.innerWidth-mw-8;
    if(x<8)x=8;
    if(y+mh>window.innerHeight-8)y=window.innerHeight-mh-8;
    if(y<8)y=8;
    menu.style.top=y+'px';menu.style.left=x+'px';
  };

  var lpT=null,lpMoved=false,lpEl=null;
  var box=el('chatBox');
  if(box){
    box.addEventListener('touchstart',function(e){
      try{
        if(e.target.closest&&e.target.closest('.msg-actions'))return;
        var b=e.target.closest?e.target.closest('.bub'):null;
        if(!b)return;
        var id=b.getAttribute('data-id');
        if(!id)return;
        lpMoved=false;lpEl=b;
        clearTimeout(lpT);
        lpT=setTimeout(function(){
          if(lpMoved||!lpEl)return;
          var m=msgsCache.find(function(x){return x._id===id;});
          if(!m||m.deleted)return;
          var t=e.touches[0];
          window.openMsgMenu({clientX:t.clientX,clientY:t.clientY,preventDefault:function(){},stopPropagation:function(){}},id,m.from);
          if(navigator.vibrate)navigator.vibrate(30);
        },550);
      }catch(err){}
    },{passive:true});
    box.addEventListener('touchmove',function(){lpMoved=true;clearTimeout(lpT);},{passive:true});
    box.addEventListener('touchend',function(){clearTimeout(lpT);},{passive:true});
  }
})();

/* ===== الضغط على الرياكشن = عرض مين عمل الرياكشن ===== */
(function(){
  window.showReactors=function(mid,em){
    try{
      var m=msgsCache.find(function(x){return x._id===mid;});
      if(!m)return;
      var users=(m.reactions&&m.reactions[em])?m.reactions[em]:[];
      if(typeof users==='number')users=[];
      var mine=users.indexOf(me.name)>-1;
      var old=el('reactorsModal');if(old)old.remove();
      var md=document.createElement('div');md.id='reactorsModal';md.className='modal';
      var list='';
      if(!users.length)list='<div style="text-align:center;color:var(--mut);padding:15px;font-size:13px">مفيش تفاعلات</div>';
      users.forEach(function(n){
        var u=usersCache[n];
        list+='<div class="u-card" style="padding:8px 12px;margin-bottom:6px">'+getAvatarHTML(u||{},36)+'<div style="flex:1"><div class="u-name" style="font-size:13px">'+escapeHtml(getMsgName(n))+'</div></div></div>';
      });
      md.innerHTML='<div class="m-card2" style="width:300px;max-height:75vh;overflow-y:auto">'
      +'<h3>'+em+' تفاعلوا بالرياكشن</h3>'
      +'<div style="font-size:11px;color:var(--mut);text-align:center;margin-bottom:6px">'+users.length+' '+(users.length===1?'شخص':'أشخاص')+'</div>'
      +list
      +'<button style="background:var(--acc);color:#fff" onclick="closeModal(\'reactorsModal\');toggleReaction(\''+mid+'\',\''+em+'\')">'+(mine?'➖ إزالة رياكشنك':'➕ ضيف رياكشنك '+em)+'</button>'
      +'<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'reactorsModal\')">إغلاق</button>'
      +'</div>';
      md.onclick=function(e){if(e.target===md)closeModal('reactorsModal');};
      document.body.appendChild(md);
      md.classList.add('open');
    }catch(e){}
  };

  document.addEventListener('click',function(e){
    try{
      var r=e.target&&e.target.closest?e.target.closest('.reaction-btn'):null;
      if(!r)return;
      e.preventDefault();e.stopPropagation();
      var oc=r.getAttribute('onclick')||'';
      var mm=oc.match(/toggleReaction\('([^']+)'\s*,\s*'((?:[^'\\]|\\.)+)'\)/);
      if(!mm)return;
      var mid=mm[1];
      var em=mm[2].replace(/\\'/g,"'");
      showReactors(mid,em);
    }catch(err){}
  },true);
})();

/* ===== إشعار البلاغات: اللي بلغ يوصل قرار الإدارة ===== */
(function(){
  async function _loadN(){try{var s=await SDB.loadSettings();var a=s.ban_notices;return Array.isArray(a)?a:[];}catch(e){return[];}}
  async function _saveN(a){try{await SDB.saveSetting('ban_notices',a);}catch(e){}}

  window.notifyReportersOfBan=async function(target){
    try{
      if(!target)return;
      var reps=await SDB.loadReports();
      var tos=[];
      reps.forEach(function(r){
        var t=String(r.target||'');
        if(t===target||t.indexOf('/'+target)>-1){
          if(r.from_user&&r.from_user!==target&&tos.indexOf(r.from_user)===-1)tos.push(r.from_user);
        }
      });
      if(!tos.length)return;
      var arr=await _loadN();
      tos.forEach(function(to){
        arr.push({id:'bn'+Date.now()+Math.floor(Math.random()*999),to:to,target:target,time:Date.now()});
      });
      if(arr.length>300)arr=arr.slice(-300);
      await _saveN(arr);
    }catch(e){}
  };

  var _umPrev=window.umBan;
  window.umBan=async function(){
    var t=umTarget;
    var wasBanned=(usersCache[t]&&usersCache[t].banned===true);
    var r=await _umPrev();
    try{if(t&&!wasBanned)notifyReportersOfBan(t);}catch(e){}
    return r;
  };
  var _buPrev=window.banUser;
  window.banUser=async function(n){
    var willBan=!(usersCache[n]&&usersCache[n].banned);
    var r=await _buPrev(n);
    try{if(willBan&&n)notifyReportersOfBan(n);}catch(e){}
    return r;
  };

  window.checkBanNotices=async function(){
    try{
      if(!me)return;
      var arr=await _loadN();
      var mine=arr.filter(function(x){return x&&x.to===me.name;});
      if(!mine.length)return;
      var rest=arr.filter(function(x){return !(x&&x.to===me.name);});
      await _saveN(rest);
      var old=el('banNoticeModal');if(old)old.remove();
      var m=document.createElement('div');m.id='banNoticeModal';m.className='modal';
      var list='';
      mine.forEach(function(x){
        list+='<div style="background:var(--bg);border:1px solid var(--grn);border-radius:10px;padding:10px 12px;margin-bottom:8px;text-align:right">'
        +'<b style="color:var(--grn);font-size:13.5px">🛡️ تم اتخاذ إجراء على البلاغ</b>'
        +'<div style="font-size:12.5px;color:var(--txt);margin-top:4px;line-height:1.9">تم حظر كامل للمستخدم <b style="color:var(--red)">'+escapeHtml(getMsgName(x.target))+'</b> من الموقع.</div>'
        +'<div style="font-size:10px;color:var(--mut);margin-top:2px">'+timeAgo(x.time)+'</div></div>';
      });
      m.innerHTML='<div class="m-card2" style="width:330px;max-height:80vh;overflow-y:auto">'
      +'<h3>🛡️ إشعارات البلاغات</h3>'+list
      +'<div style="font-size:11px;color:var(--mut);text-align:center;margin-bottom:8px">شكراً لمساهمتك في الحفاظ على مجتمع آمن 🌟</div>'
      +'<button style="background:var(--acc);color:#fff" onclick="closeModal(\'banNoticeModal\')">حسناً</button></div>';
      m.onclick=function(e){if(e.target===m)closeModal('banNoticeModal');};
      document.body.appendChild(m);
      m.classList.add('open');
      if(me.sndNotif!==false)try{beep(900);}catch(e){}
    }catch(e){}
  };

  var _saBN=window.startAll;
  window.startAll=async function(){var r=await _saBN();try{checkBanNotices();}catch(e){}return r;};
  setInterval(function(){try{checkBanNotices();}catch(e){}},30000);
})();

/* ===== تشغيل نهائي: تحديث القصص والحالة عند البداية ===== */
(function(){
  var _saF2=window.startAll;
  window.startAll=async function(){var r=await _saF2();try{renderStories();}catch(e){}return r;};
  setTimeout(function(){try{if(me)renderStories();}catch(e){}},2500);
})();

/* ===== خلفية المحادثات الافتراضية ===== */
(function(){
  var CHAT_BG='https://cdn.phototourl.com/member/2026-10-03-c3ae5e01-ee19-4450-b716-c024fefb57c0.jpg';
  try{LS.setItem('chat_bg',CHAT_BG);}catch(e){}
  function applyChatBg(){
    try{
      var b=el('chatBox');
      if(!b)return;
      var dim=(parseInt(LS.getItem('chat_dim')||'50'))/100;
      b.style.backgroundImage='linear-gradient(rgba(0,0,0,'+dim+'),rgba(0,0,0,'+dim+')),url('+CHAT_BG+')';
      b.style.backgroundSize='cover';
      b.style.backgroundPosition='center';
    }catch(e){}
  }
  applyChatBg();
  setInterval(applyChatBg,2000);
})();
/* ===== ميزة: حذف تعليقي في حائط الإبداع ===== */
(function(){
window.delWallComment=async function(pid,idx){
  if(!me)return toast('سجل دخولك أولاً');
  var p=wallCache.find(function(x){return x.id===pid;});
  if(!p||!p.comments||!p.comments[idx])return;
  var c=p.comments[idx];
  if(c.from!==me.name&&!isAdmin())return toast('⛔ ممكن تحذف تعليقك بس');
  if(!confirm('حذف التعليق؟'))return;
  p.comments.splice(idx,1);
  renderWall();
  await SDB.updWall(pid,{comments:p.comments});
  toast('تم حذف التعليق 🗑️');
  setTimeout(function(){try{refreshWall();}catch(e){}},2600);
};
var _rwO=window.renderWall;
window.renderWall=function(){
  if(!wallCache.length){el('wallFeed').innerHTML='<div class="empty"><div class="big">🎨</div>لا توجد منشورات بعد<br>كن أول من يبدع!</div>';return;}
  var html='';
  for(var i=0;i<wallCache.length;i++){
    var p=wallCache[i];
    var u=usersCache[p.author];
    var ava=(u&&u.avatar)?'<img src="'+u.avatar+'">':((u&&u.gender==='أنثى')?'👩':'👨');
    var canDel=(p.author===me.name)||isAdmin();
    var delBtn=canDel?'<button class="xbtn" onclick="deleteWallPost(\''+p.id+'\')" style="padding:2px 8px;font-size:11px">🗑️</button>':'';
    var mediaHtml='';
    if(p.type==='image'&&p.media_url)mediaHtml='<img src="'+p.media_url+'" class="w-media" onclick="viewFullImage(this.src)">';
    else if(p.type==='youtube'&&p.media_url){var yid='';var m=p.media_url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);if(m)yid=m[1];mediaHtml=yid?'<div class="w-yt"><iframe src="https://www.youtube.com/embed/'+yid+'" allowfullscreen></iframe></div>':'';}
    var likeCount=(p.likes&&p.likes.length)||0;
    var liked=(p.likes&&p.likes.indexOf(me.name)>-1);
    var cc=(p.comments&&p.comments.length)||0;
    var commentsHtml='';
    if(p.comments&&p.comments.length){
      for(var j=0;j<p.comments.length;j++){
        var cm=p.comments[j];
        var canDelC=(cm.from===me.name)||isAdmin();
        var delC=canDelC?'<button onclick="delWallComment(\''+p.id+'\','+j+')" style="background:none;border:none;color:var(--red);font-size:14px;cursor:pointer;padding:0 4px;flex-shrink:0">🗑️</button>':'';
        commentsHtml+='<div class="w-comment" style="align-items:center"><b>'+escapeHtml(cm.from)+'</b> <span style="color:var(--txt);flex:1;word-break:break-word">'+escapeHtml(cm.text)+'</span>'+delC+'</div>';
      }
    }
    else commentsHtml='<div style="font-size:12px;color:var(--mut)">لا توجد تعليقات</div>';
    html+='<div class="w-post"><div class="w-head"><div class="w-ava">'+ava+'</div><div class="w-meta"><div class="w-name">'+styleName(u||{name:p.author})+'</div><div class="w-time">'+timeAgo(p.timestamp)+' • '+role(u||{name:p.author})+'</div></div>'+delBtn+'</div><div class="w-body">'+escapeHtml(p.content)+'</div>'+mediaHtml+'<div class="w-actions"><button class="w-btn '+(liked?'liked':'')+'" onclick="likeWallPost(\''+p.id+'\')">❤️ '+likeCount+'</button><button class="w-btn" onclick="toggleWallComments(\''+p.id+'\')">💬 '+cc+'</button></div><div class="w-comments" id="wc-'+p.id+'"><div style="margin-bottom:8px">'+commentsHtml+'</div><div class="w-comment-input"><input id="wci-'+p.id+'" placeholder="اكتب تعليق..." onkeydown="if(event.key===\'Enter\')sendWallComment(\''+p.id+'\')"><button class="adm-btn" onclick="sendWallComment(\''+p.id+'\')">إرسال</button></div></div></div>';
  }
  el('wallFeed').innerHTML=html;
};
})();
/* ===== ميزة: تميّز باسمك (مجاناً) ===== */
(function(){
if(window._nameStyleDone)return;window._nameStyleDone=true;
var STYLES=[
 {name:'أسطوري',desc:'نصب منذهب يليق بالبطل',pre:'✨',post:'✧',grad:'linear-gradient(90deg,#ffd700,#ff9f43,#ffd700)',glow:'rgba(255,215,0,.6)'},
 {name:'ذهبي ملكي',desc:'نصب لائق بمر عالية',pre:'',post:'👑',grad:'linear-gradient(90deg,#ffb700,#ff8c00,#ffd700)',glow:'rgba(255,183,0,.5)'},
 {name:'هو لوغرام',desc:'ألوان قزحية تتبدل مع الضوء',pre:'( ',post:' )',grad:'linear-gradient(90deg,#ff9ae0,#a0c4ff,#b9fbc0)',glow:'rgba(255,154,224,.4)'},
 {name:'بلاتيني',desc:'كروم سائل يخط ضوء حاد',pre:'',post:'✦',grad:'linear-gradient(90deg,#e8e8e8,#ffffff,#c0c0c0)',glow:'rgba(232,232,232,.5)'},
 {name:'الشفق',desc:'ألوان تنساب ببطء',pre:'',post:'✧',grad:'linear-gradient(90deg,#00d4ff,#22c55e,#00d4ff)',glow:'rgba(0,212,255,.4)'},
 {name:'نيون',desc:'توهج ليلي يرمش أجيالاً',pre:'',post:'⚡',grad:'linear-gradient(90deg,#ff2ec4,#ff71ce)',glow:'rgba(255,46,196,.7)'},
 {name:'زمردي',desc:'خضرة جوهرة عميقة',pre:'',post:'🟢',grad:'linear-gradient(90deg,#00e676,#00c853)',glow:'rgba(0,230,118,.5)'},
 {name:'ماسي',desc:'بريق جليدي ونجموم تلمع',pre:'✦',post:'💎',grad:'linear-gradient(90deg,#a8d8ff,#e3f2ff,#7ec8ff)',glow:'rgba(168,216,255,.6)'},
 {name:'وردي',desc:'رقص الأنفس بلسمة وردية',pre:'',post:'🌸',grad:'linear-gradient(90deg,#ff9a9e,#fecfef)',glow:'rgba(255,154,158,.5)'},
 {name:'باوقتي',desc:'أحمر الياقوت يقطع النجوم',pre:'',post:'❤️',grad:'linear-gradient(90deg,#ff4444,#ff1744)',glow:'rgba(255,68,68,.6)'},
 {name:'ناري',desc:'لهب يتشاظر بلا توقف',pre:'',post:'🔥',grad:'linear-gradient(90deg,#ff6a00,#ff9100)',glow:'rgba(255,106,0,.6)'},
 {name:'مجرة',desc:'سديم ونجموم تسبح في حروق',pre:'',post:'🌙',grad:'linear-gradient(90deg,#b388ff,#7c4dff,#80d8ff)',glow:'rgba(179,136,255,.6)'}
];
window._NAME_STYLES=STYLES;

/* 1) ترقية styleName: زخارف + توهج */
window.styleName=function(u){
  var name=escapeHtml(getDisplayName(u));
  if(u&&u.nameGradient){
    var g=u.nameGlow?'filter:drop-shadow(0 0 7px '+u.nameGlow+');':'';
    return '<span style="'+g+'">'+(u.nameDecorPre||'')+'<span style="background:'+u.nameGradient+';-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:bold">'+name+'</span>'+(u.nameDecorPost||'')+'</span>';
  }
  if(u&&u.nameColor)return '<span style="color:'+u.nameColor+';font-weight:bold">'+name+'</span>';
  return name;
};

/* 2) عنصر القايمة بشارة "مجاناً" */
try{
  var lists=document.querySelectorAll('#s-settings .menu-list');
  var tgt=lists[0];
  if(tgt&&!el('nameStyleMenuItem')){
    var mi=document.createElement('div');
    mi.className='m-item';mi.id='nameStyleMenuItem';
    mi.innerHTML='<span>👑 تميّز باسمك <span style="background:linear-gradient(135deg,#ff9800,#ff5722);color:#fff;font-size:10px;font-weight:bold;padding:3px 10px;border-radius:12px;margin-right:6px">مجاناً</span></span><span>👈</span>';
    mi.onclick=function(){go('namestyle',null);};
    tgt.insertBefore(mi,tgt.firstChild);
  }
}catch(e){}

/* 3) الشاشة */
if(!el('s-namestyle')){
  var scr=document.createElement('div');
  scr.className='screen';scr.id='s-namestyle';
  scr.innerHTML='<div class="sub-title" onclick="go(\'settings\')">➔ تميّز باسمك</div><div id="nameStyleBody" style="padding:4px"></div>';
  var content=document.querySelector('.content');
  var ref=el('s-settings');
  if(ref&&ref.parentElement)content.insertBefore(scr,ref);
  else content.appendChild(scr);
}

/* 4) رسم الشاشة */
window.renderNameStyle=function(){
  try{
    var box=el('nameStyleBody');if(!box||!me)return;
    var h='';
    h+='<div style="background:linear-gradient(135deg,#1a1033,#3d1b5e);border-radius:18px;padding:24px 14px;text-align:center;margin-bottom:12px;border:1px solid rgba(255,255,255,.08)">';
    h+='<div style="font-size:11px;color:rgba(255,255,255,.6);margin-bottom:10px">هكذا يليق اسمك</div>';
    h+='<div style="font-size:22px;font-weight:bold">'+styleName(me)+'</div>';
    h+='<div style="font-size:11px;color:rgba(255,255,255,.55);margin-top:10px">اختار النمط ويتطبق على اسمك في كل الموقع ✨</div></div>';
    h+='<div style="font-size:12px;color:var(--mut);margin-bottom:8px">في قايمة المتصلين يراك الآخرون هكذا:</div>';
    h+='<div class="u-card" style="pointer-events:none">'+getAvatarHTML(me,46)+'<span class="flag">'+(FLAGS[me.country]||flag('E','G'))+'</span><div style="flex:1"><div class="u-name">'+styleName(me)+'</div><div style="font-size:11px;color:var(--mut)">'+role(me)+' • متصل الآن</div></div></div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">';
    STYLES.forEach(function(s,i){
      var sel=(me.nameGradient===s.grad&&me.nameDecorPost===s.post);
      var nh='<span style="'+(s.glow?'filter:drop-shadow(0 0 6px '+s.glow+');':'')+'">'+s.pre+'<span style="background:'+s.grad+';-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:bold">'+escapeHtml(me.displayName||me.name)+'</span>'+s.post+'</span>';
      h+='<div onclick="applyNameStyle('+i+')" style="background:var(--card);border:2px solid '+(sel?'var(--acc)':'var(--line)')+';border-radius:14px;padding:14px 8px;text-align:center;cursor:pointer">'
      +'<div style="font-size:16px;min-height:26px;word-break:break-word">'+nh+'</div>'
      +'<div style="font-size:13px;font-weight:bold;color:var(--txt);margin-top:8px">'+s.name+'</div>'
      +'<div style="font-size:10px;color:var(--mut);margin-top:3px">'+s.desc+'</div>'
      +(sel?'<div style="font-size:10px;color:var(--grn);font-weight:bold;margin-top:4px">✅ مُفعّل</div>':'')
      +'</div>';
    });
    h+='</div>';
    h+='<button class="lbtn" onclick="removeNameStyle()" style="margin-top:14px;background:var(--red)">🗑️ إزالة النمط (رجوع للاسم العادي)</button>';
    box.innerHTML=h;
  }catch(e){}
};

window.applyNameStyle=function(i){
  var s=STYLES[i];if(!s||!me)return;
  updateMe({nameGradient:s.grad,nameDecorPre:s.pre,nameDecorPost:s.post,nameGlow:s.glow});
  toast('✨ تم تطبيق نمط: '+s.name);
  updateProfile();renderOnline();renderMsgs();renderNameStyle();
};
window.removeNameStyle=function(){
  updateMe({nameGradient:null,nameColor:null,nameDecorPre:null,nameDecorPost:null,nameGlow:null});
  toast('تم إزالة النمط');
  updateProfile();renderOnline();renderMsgs();renderNameStyle();
};

/* 5) الربط بالتنقل */
var _goN=window.go;
window.go=function(s,nv,fb){
  var r=_goN(s,nv,fb);
  try{if(s==='namestyle')renderNameStyle();}catch(e){}
  return r;
};
})();
/* ===== تحسين: ألوان تميّز الاسم ساطعة + توهج 4K ===== */
(function(){
var STYLES=[
 {name:'أسطوري',desc:'نصب منذهب يليق بالبطل',pre:'✨',post:'✧',grad:'linear-gradient(90deg,#FFE55C,#FFB700,#FFE55C)',glow:'rgba(255,215,0,.9)'},
 {name:'ذهبي ملكي',desc:'نصب لائق بمر عالية',pre:'',post:'👑',grad:'linear-gradient(90deg,#FFD700,#FFA500,#FFD700)',glow:'rgba(255,183,0,.85)'},
 {name:'هو لوغرام',desc:'ألوان قزحية تتبدل مع الضوء',pre:'( ',post:' )',grad:'linear-gradient(90deg,#FF9AE0,#9AD0FF,#AFFFc3)',glow:'rgba(255,154,224,.75)'},
 {name:'بلاتيني',desc:'كروم أبيض يخط ضوء حاد',pre:'',post:'✦',grad:'linear-gradient(90deg,#FFFFFF,#F5F5F5,#FFFFFF)',glow:'rgba(255,255,255,.9)'},
 {name:'الشفق',desc:'ألوان تنساب ببطء',pre:'',post:'✧',grad:'linear-gradient(90deg,#00E5FF,#39FF9E,#00E5FF)',glow:'rgba(0,229,255,.85)'},
 {name:'نيون',desc:'توهج ليلي يرمش أجيالاً',pre:'',post:'⚡',grad:'linear-gradient(90deg,#FF3EF5,#FF71CE,#FF3EF5)',glow:'rgba(255,62,245,.95)'},
 {name:'زمردي',desc:'خضرة جوهرة عميقة',pre:'',post:'🟢',grad:'linear-gradient(90deg,#00FF85,#00E676,#00FF85)',glow:'rgba(0,255,133,.85)'},
 {name:'ماسي',desc:'بريق جليدي ونجموم تلمع',pre:'✦',post:'💎',grad:'linear-gradient(90deg,#CFF0FF,#FFFFFF,#A8D8FF)',glow:'rgba(200,235,255,.9)'},
 {name:'وردي',desc:'رقص الأنفس بلسمة وردية',pre:'',post:'🌸',grad:'linear-gradient(90deg,#FFB6D9,#FF8FB3,#FFB6D9)',glow:'rgba(255,150,190,.8)'},
 {name:'باوقتي',desc:'أحمر الياقوت يقطع النجوم',pre:'',post:'❤️',grad:'linear-gradient(90deg,#FF6B6B,#FF2E4E,#FF6B6B)',glow:'rgba(255,80,100,.9)'},
 {name:'ناري',desc:'لهب يتشاظر بلا توقف',pre:'',post:'🔥',grad:'linear-gradient(90deg,#FFB300,#FF6A00,#FFB300)',glow:'rgba(255,140,0,.9)'},
 {name:'مجرة',desc:'سديم ونجموم تسبح في حروق',pre:'',post:'🌙',grad:'linear-gradient(90deg,#C792FF,#9D6BFF,#7EE8FF)',glow:'rgba(190,130,255,.9)'}
];
window._NAME_STYLES=STYLES;

/* توهج مزدوج: طبقتين = إحساس 4K */
function _glowCss(g){return 'filter:drop-shadow(0 0 3px '+g+') drop-shadow(0 0 11px '+g+');';}

window.styleName=function(u){
  var name=escapeHtml(getDisplayName(u));
  if(u&&u.nameGradient){
    var g=u.nameGlow?_glowCss(u.nameGlow):'';
    return '<span style="'+g+'">'+(u.nameDecorPre||'')+'<span style="background:'+u.nameGradient+';-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:bold">'+name+'</span>'+(u.nameDecorPost||'')+'</span>';
  }
  if(u&&u.nameColor)return '<span style="color:'+u.nameColor+';font-weight:bold">'+name+'</span>';
  return name;
};

window.renderNameStyle=function(){
  try{
    var box=el('nameStyleBody');if(!box||!me)return;
    var h='';
    h+='<div style="background:linear-gradient(135deg,#1a1033,#3d1b5e);border-radius:18px;padding:24px 14px;text-align:center;margin-bottom:12px;border:1px solid rgba(255,255,255,.08)">';
    h+='<div style="font-size:11px;color:rgba(255,255,255,.6);margin-bottom:10px">هكذا يليق اسمك</div>';
    h+='<div style="font-size:22px;font-weight:bold">'+styleName(me)+'</div>';
    h+='<div style="font-size:11px;color:rgba(255,255,255,.55);margin-top:10px">اختار النمط ويتطبق على اسمك في كل الموقع ✨</div></div>';
    h+='<div style="font-size:12px;color:var(--mut);margin-bottom:8px">في قايمة المتصلين يراك الآخرون هكذا:</div>';
    h+='<div class="u-card" style="pointer-events:none">'+getAvatarHTML(me,46)+'<span class="flag">'+(FLAGS[me.country]||flag('E','G'))+'</span><div style="flex:1"><div class="u-name">'+styleName(me)+'</div><div style="font-size:11px;color:var(--mut)">'+role(me)+' • متصل الآن</div></div></div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">';
    STYLES.forEach(function(s,i){
      var sel=(me.nameGradient===s.grad&&me.nameDecorPost===s.post);
      var nh='<span style="'+_glowCss(s.glow)+'">'+s.pre+'<span style="background:'+s.grad+';-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:bold">'+escapeHtml(me.displayName||me.name)+'</span>'+s.post+'</span>';
      h+='<div onclick="applyNameStyle('+i+')" style="background:var(--card);border:2px solid '+(sel?'var(--acc)':'var(--line)')+';border-radius:14px;padding:14px 8px;text-align:center;cursor:pointer">'
      +'<div style="font-size:16px;min-height:26px;word-break:break-word">'+nh+'</div>'
      +'<div style="font-size:13px;font-weight:bold;color:var(--txt);margin-top:8px">'+s.name+'</div>'
      +'<div style="font-size:10px;color:var(--mut);margin-top:3px">'+s.desc+'</div>'
      +(sel?'<div style="font-size:10px;color:var(--grn);font-weight:bold;margin-top:4px">✅ مُفعّل</div>':'')
      +'</div>';
    });
    h+='</div>';
    h+='<button class="lbtn" onclick="removeNameStyle()" style="margin-top:14px;background:var(--red)">🗑️ إزالة النمط (رجوع للاسم العادي)</button>';
    box.innerHTML=h;
  }catch(e){}
};

window.applyNameStyle=function(i){
  var s=STYLES[i];if(!s||!me)return;
  updateMe({nameGradient:s.grad,nameDecorPre:s.pre,nameDecorPost:s.post,nameGlow:s.glow});
  toast('✨ تم تطبيق نمط: '+s.name);
  updateProfile();renderOnline();renderMsgs();renderNameStyle();
};
window.removeNameStyle=function(){
  updateMe({nameGradient:null,nameColor:null,nameDecorPre:null,nameDecorPost:null,nameGlow:null});
  toast('تم إزالة النمط');
  updateProfile();renderOnline();renderMsgs();renderNameStyle();
};
})();
/* ===== إضافة: 16 نمط جديد لتميّز الاسم ===== */
(function(){
var NEW=[
 {name:'تيك توك',desc:'سماوي ووردي جنب بعض',pre:'',post:'🎵',grad:'linear-gradient(90deg,#25F4EE,#FE2C55)',glow:'rgba(64,220,240,.85)'},
 {name:'انستجرام',desc:'تدرج الابتسامة الشهير',pre:'',post:'📸',grad:'linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)',glow:'rgba(221,42,123,.85)'},
 {name:'تيويتش',desc:'بنفسجي البثوث المشهور',pre:'',post:'🎮',grad:'linear-gradient(90deg,#9146FF,#C9A7FF)',glow:'rgba(145,70,255,.85)'},
 {name:'دروب شيب',desc:'أخضر البيع الفاخر',pre:'',post:'🛍️',grad:'linear-gradient(90deg,#5AE67D,#00C965)',glow:'rgba(90,230,125,.85)'},
 {name:'سماوي ثلجي',desc:'برودة القطب بلمعة',pre:'',post:'❄️',grad:'linear-gradient(90deg,#7FE7FF,#00B8D9)',glow:'rgba(127,231,255,.9)'},
 {name:'لونها وردي',desc:'بمبي النايم الحلو',pre:'',post:'🎀',grad:'linear-gradient(90deg,#FF9FF3,#F368E0)',glow:'rgba(255,159,243,.85)'},
 {name:'بورسلي',desc:'نيلي الكهربا المتوهج',pre:'',post:'⚡',grad:'linear-gradient(90deg,#00D2FF,#3A7BD5)',glow:'rgba(0,210,255,.9)'},
 {name:'عدس العيد',desc:'برتقالي العسل الحلو',pre:'',post:'🍯',grad:'linear-gradient(90deg,#FFB75E,#ED8F03)',glow:'rgba(255,183,94,.9)'},
 {name:'ياقة الكاجوال',desc:'تركواز البحر الهادي',pre:'',post:'🌊',grad:'linear-gradient(90deg,#43E97B,#38F9D7)',glow:'rgba(67,233,123,.85)'},
 {name:'بنفسجي عميق',desc:'المساء عندي في الجيبة',pre:'',post:'🔮',grad:'linear-gradient(90deg,#C471ED,#F64F59)',glow:'rgba(196,113,237,.9)'},
 {name:'روبي',desc:'أحمر الأحجار الكريمة',pre:'',post:'♦️',grad:'linear-gradient(90deg,#FF416C,#FF4B2B)',glow:'rgba(255,65,108,.9)'},
 {name:'زعفران',desc:'دهبي كركم الفريش',pre:'',post:'🌞',grad:'linear-gradient(90deg,#FDC830,#F37335)',glow:'rgba(253,200,48,.9)'},
 {name:'أزرق ملكي',desc:'أزرق السماء الغامق',pre:'',post:'🔵',grad:'linear-gradient(90deg,#4A90FF,#2B5CFF)',glow:'rgba(74,144,255,.9)'},
 {name:'ليموناضة',desc:'أصفر النوش الخفيف',pre:'',post:'🍋',grad:'linear-gradient(90deg,#FFF95B,#FFD200)',glow:'rgba(255,240,100,.9)'},
 {name:'سماء الغروب',desc:'مزاج الأجواء وقتها',pre:'',post:'🌇',grad:'linear-gradient(90deg,#FF9966,#FF5E62)',glow:'rgba(255,120,90,.9)'},
 {name:'تشيلي هوت',desc:'نار البيبر اللي تحرقة',pre:'',post:'🌶️',grad:'linear-gradient(90deg,#FF512F,#DD2476)',glow:'rgba(255,81,47,.9)'}
];
var _glowCss=function(g){return 'filter:drop-shadow(0 0 3px '+g+') drop-shadow(0 0 11px '+g+');';};
window._NAME_STYLES=(window._NAME_STYLES||[]).concat(NEW);
window._glowCssName=_glowCss;

/* نعيد رسم الشاشة بالقايمة الجديدة كلها */
window.renderNameStyle=function(){
  try{
    var STYLES=window._NAME_STYLES;
    var box=el('nameStyleBody');if(!box||!me)return;
    var h='';
    h+='<div style="background:linear-gradient(135deg,#1a1033,#3d1b5e);border-radius:18px;padding:24px 14px;text-align:center;margin-bottom:12px;border:1px solid rgba(255,255,255,.08)">';
    h+='<div style="font-size:11px;color:rgba(255,255,255,.6);margin-bottom:10px">هكذا يليق اسمك</div>';
    h+='<div style="font-size:22px;font-weight:bold">'+styleName(me)+'</div>';
    h+='<div style="font-size:11px;color:rgba(255,255,255,.55);margin-top:10px">29 نمط تختار منه — يطبق على اسمك في كل الموقع ✨</div></div>';
    h+='<div style="font-size:12px;color:var(--mut);margin-bottom:8px">في قايمة المتصلين يراك الآخرون هكذا:</div>';
    h+='<div class="u-card" style="pointer-events:none">'+getAvatarHTML(me,46)+'<span class="flag">'+(FLAGS[me.country]||flag('E','G'))+'</span><div style="flex:1"><div class="u-name">'+styleName(me)+'</div><div style="font-size:11px;color:var(--mut)">'+role(me)+' • متصل الآن</div></div></div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">';
    STYLES.forEach(function(s,i){
      var sel=(me.nameGradient===s.grad&&me.nameDecorPost===s.post);
      var nh='<span style="'+_glowCss(s.glow)+'">'+(s.pre||'')+'<span style="background:'+s.grad+';-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:bold">'+escapeHtml(me.displayName||me.name)+'</span>'+(s.post||'')+'</span>';
      h+='<div onclick="applyNameStyle('+i+')" style="background:var(--card);border:2px solid '+(sel?'var(--acc)':'var(--line)')+';border-radius:14px;padding:14px 8px;text-align:center;cursor:pointer">'
      +'<div style="font-size:16px;min-height:26px;word-break:break-word">'+nh+'</div>'
      +'<div style="font-size:13px;font-weight:bold;color:var(--txt);margin-top:8px">'+s.name+'</div>'
      +'<div style="font-size:10px;color:var(--mut);margin-top:3px">'+s.desc+'</div>'
      +(sel?'<div style="font-size:10px;color:var(--grn);font-weight:bold;margin-top:4px">✅ مُفعّل</div>':'')
      +'</div>';
    });
    h+='</div>';
    h+='<button class="lbtn" onclick="removeNameStyle()" style="margin-top:14px;background:var(--red)">🗑️ إزالة النمط (رجوع للاسم العادي)</button>';
    box.innerHTML=h;
  }catch(e){}
};
})();
/* ===== ميزة: عملاتي 💰 (محفظة + شراء بفودافون كاش) ===== */
(function(){
if(window._walletDone)return;window._walletDone=true;
var FRAME_COST=100;

/* 1) عنصر عملاتي في قايمة الإعدادات */
try{
  var lists=document.querySelectorAll('#s-settings .menu-list');
  var tgt=lists[0];
  if(tgt&&!el('walletMenuItem')){
    var mi=document.createElement('div');
    mi.className='m-item';mi.id='walletMenuItem';
    mi.innerHTML='<span>💰 عملاتي <span id="walletBadge" style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-size:10px;font-weight:bold;padding:3px 10px;border-radius:12px;margin-right:6px">جديدة</span></span><span>👈</span>';
    mi.onclick=function(){go('wallet',null);};
    tgt.insertBefore(mi,tgt.firstChild);
  }
}catch(e){}

/* 2) الشاشة */
if(!el('s-wallet')){
  var scr=document.createElement('div');
  scr.className='screen';scr.id='s-wallet';
  scr.innerHTML='<div class="sub-title" onclick="go(\'settings\')">➔ عملاتي</div><div id="walletBody" style="padding:4px"></div>';
  var content=document.querySelector('.content');
  var ref=el('s-settings');
  if(ref&&ref.parentElement)content.insertBefore(scr,ref);
  else content.appendChild(scr);
}

/* 3) رسم الشاشة */
window.renderWallet=function(){
  try{
    var box=el('walletBody');if(!box||!me)return;
    var coins=(me.coins)||0;
    var b=el('walletBadge');
    if(b){b.innerText=c>0?'🪙 '+coins:'جديدة';}
    var h='';
    h+='<div style="background:radial-gradient(ellipse at top,#2a1a4e,#141038);border-radius:18px;padding:28px 14px;text-align:center;margin-bottom:12px;border:1px solid rgba(255,255,255,.08)">';
    h+='<div style="width:84px;height:84px;margin:0 auto 12px;background:linear-gradient(135deg,#FFE55C,#FF9800);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:40px;box-shadow:0 0 35px rgba(255,183,0,.7),inset 0 -5px 12px rgba(0,0,0,.25)">⭐</div>';
    h+='<div style="color:#FFD700;font-size:16px;font-weight:bold">رصيد العملات</div>';
    h+='<div style="color:#fff;font-size:34px;font-weight:900;margin-top:4px">🪙 '+coins+'</div>';
    h+='<div style="color:rgba(255,255,255,.55);font-size:12px;margin-top:8px">انشر أكثر، وتميّز أكثر — عملاتك لا تنتهي أبداً</div></div>';
    h+='<div style="background:var(--card);border:2px solid #FFD700;border-radius:18px;padding:16px;margin-bottom:12px">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">';
    h+='<div><div style="color:#fff;font-size:26px;font-weight:900">200 جنيه</div><div style="font-size:11px;color:var(--mut)">دفعة واحدة</div></div>';
    h+='<div style="text-align:left"><div style="font-size:11px;color:#FFD700">رصيد العملات</div><div style="font-size:22px;font-weight:900;color:#fff">500 ⭐</div></div></div>';
    h+='<button onclick="buyCoinsVoda()" style="width:100%;margin-top:14px;padding:14px;background:linear-gradient(90deg,#FFE55C,#FF9800);border:none;border-radius:14px;font-size:16px;font-weight:900;color:#111;cursor:pointer;box-shadow:0 3px 14px rgba(255,153,0,.4)">💳 ادفع بفودافون كاش</button>';
    h+='<div style="font-size:11px;color:var(--mut);text-align:center;margin-top:8px">دفع آمن — بعد التحويل تستلم عملاتك فوراً بعد تأكيد الإدارة</div></div>';
    h+='<div style="background:linear-gradient(135deg,#1a1033,#3d1b5e);border-radius:14px;padding:14px;display:flex;align-items:center;gap:10px;margin-bottom:12px">';
    h+='<div style="flex:1"><div style="font-size:11px;color:rgba(255,255,255,.55)">اسمك مميز في قايمة المتصلين</div><div style="font-size:17px;font-weight:bold;margin-top:2px">'+styleName(me)+'</div><div style="font-size:11px;color:#FFD700;margin-top:4px">🎁 مجاناً الآن — جرّبه من "تميّز باسمك"</div></div></div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">';
    h+='<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;text-align:center"><div style="font-size:26px">🖼️</div><div style="font-weight:bold;font-size:13px;margin-top:6px">إطار حول صورتك</div><div style="font-size:11px;color:var(--mut);margin-top:4px">تميّز بإطار فريد — 100 عملة</div>';
    h+=(me.framesUnlocked?'<div style="font-size:11px;color:var(--grn);font-weight:bold;margin-top:6px">✅ مُفتوحة</div>':(coins>=FRAME_COST?'<button class="adm-btn grn" style="margin-top:8px" onclick="buyFrameWithCoins()">🛒 اشترِ الآن</button>':'<div style="font-size:11px;color:var(--red);margin-top:6px">تحتاج '+(FRAME_COST-coins)+' عملة إضافية</div>'));
    h+='</div>';
    h+='<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;text-align:center"><div style="font-size:26px">✅</div><div style="font-weight:bold;font-size:13px;margin-top:6px">مضمونة</div><div style="font-size:11px;color:var(--mut);margin-top:4px">تستلم عملاتك فور تأكيد الإدارة</div></div>';
    h+='<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;text-align:center"><div style="font-size:26px">♾️</div><div style="font-weight:bold;font-size:13px;margin-top:6px">لا تنتهي</div><div style="font-size:11px;color:var(--mut);margin-top:4px">عملاتك تبقى في حسابك بلا تاريخ انتهاء</div></div>';
    h+='<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;text-align:center"><div style="font-size:26px">🔒</div><div style="font-weight:bold;font-size:13px;margin-top:6px">آمنة</div><div style="font-size:11px;color:var(--mut);margin-top:4px">العملات الصرفت لا تُسترد عند مخالفة القوانين</div></div>';
    h+='</div>';
    h+='<div style="background:var(--card2);border-radius:12px;padding:12px;font-size:11px;color:var(--mut);line-height:2;text-align:center">📌 كيف تعمل العملات: حوّل 200 جنيه عبر فودافون كاش ← ابعت اسم عضويتك للإدارة على تليجرام ← تُضاف 500 عملة لحسابك بعد التأكيد ⚡</div>';
    box.innerHTML=h;
  }catch(e){}
};

/* 4) نافذة الدفع بفودافون كاش */
window.buyCoinsVoda=function(){
  var old=el('buyCoinsModal');if(old)old.remove();
  var m=document.createElement('div');m.id='buyCoinsModal';m.className='modal';
  m.innerHTML='<div class="m-card2" style="width:330px">'
  +'<h3 style="color:#FFD700">🪙 شراء 500 عملة</h3>'
  +'<p style="font-size:13px;text-align:center;color:var(--txt);line-height:1.8">حوّل <b style="color:#FFD700">200 جنيه</b> على رقم فودافون كاش:</p>'
  +'<div onclick="copyVoda()" style="background:var(--bg);border:2px dashed #FFD700;border-radius:12px;padding:12px;text-align:center;cursor:pointer">'
  +'<div style="font-size:22px;font-weight:900;color:#FFD700;direction:ltr">01013255816</div>'
  +'<div style="font-size:11px;color:var(--mut);margin-top:4px">📊 اضغط للنسخ 📋</div></div>'
  +'<p style="font-size:12px;color:var(--txt);text-align:center;line-height:1.8">بعد التحويل، ابعت اسم عضويتك: <b style="color:var(--acc)">'+escapeHtml(me.displayName||me.name)+'</b> للإدارة على تليجرام</p>'
  +'<a href="https://t.me/medosonic" target="_blank" style="display:block;text-align:center;padding:12px;background:#0088cc;color:#fff;border-radius:10px;text-decoration:none;font-weight:bold;font-size:13px">📱 ابعت للإدارة على تليجرام</a>'
  +'<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'buyCoinsModal\')">إغلاق</button></div>';
  m.onclick=function(e){if(e.target===m)closeModal('buyCoinsModal');};
  document.body.appendChild(m);
  m.classList.add('open');
};

/* 5) شراء الإطار بالعملات */
window.buyFrameWithCoins=function(){
  if(!me)return;
  var coins=(me.coins)||0;
  if(coins<FRAME_COST)return toast('🪙 عملاتك مش كفاية');
  if(!confirm('شراء ميزة الإطار بـ '+FRAME_COST+' عملة؟'))return;
  updateMe({coins:coins-FRAME_COST,framesUnlocked:true}).then(function(){
    toast('🎉 تم فتح ميزة الإطار! تلاقيها في الإعدادات');
    try{el('frameMenuItem').style.display='flex';}catch(e){}
    renderWallet();
  });
};

/* 6) الإدارة تضيف عملات لعضو من قايمته */
try{
  var um=document.getElementById('userModal');
  if(um&&!el('addCoinsBtn')){
    var btn=document.createElement('button');
    btn.id='addCoinsBtn';
    btn.style.cssText='background:#FFD700;color:#111';
    btn.innerHTML='🪙 إضافة عملات';
    btn.onclick=async function(){
      if(!isAdmin())return toast('ممنوع');
      var n=umTarget;
      var u=await SDB.getUser(n);
      if(!u)return toast('العضو غير موجود');
      var cur=(u.coins)||0;
      var amt=prompt('عملات '+n+' الحالية: '+cur+'\nاكتب عدد العملات المضافة:','500');
      if(!amt)return;
      amt=parseInt(amt);
      if(isNaN(amt)||amt<=0)return toast('اكتب رقم صحيح');
      await SDB.patchUser(n,{coins:cur+amt});
      toast('🪙 تم إضافة '+amt+' عملة لـ '+n);
      logActivity('coins','تمت إضافة '+amt+' عملة لـ '+n);
      closeModal('userModal');refreshUsers();
    };
    var closeBtn=um.querySelector('button[onclick="closeModal(\'userModal\')"]');
    um.insertBefore(btn,closeBtn);
  }
}catch(e){}

/* 7) الربط بالتنقل + إظهار الإطار للمشتري */
var _goW=window.go;
window.go=function(s,nv,fb){
  var r=_goW(s,nv,fb);
  try{
    if(s==='wallet')renderWallet();
    if(s==='settings'&&me&&me.framesUnlocked)el('frameMenuItem').style.display='flex';
  }catch(e){}
  return r;
};
setInterval(function(){
  try{
    var b=el('walletBadge');
    if(b&&me){var c=(me.coins)||0;b.innerText=c>0?'🪙 '+c:'جديدة';}
  }catch(e){}
},3000);
})();
/* ===== إصلاح: شاشة عملاتي فاضية ===== */
(function(){
var FRAME_COST=100;
window.renderWallet=function(){
  try{
    var box=el('walletBody');if(!box||!me)return;
    var coins=(me.coins)||0;
    var b=el('walletBadge');
    if(b){b.innerText=coins>0?'🪙 '+coins:'جديدة';}
    var h='';
    h+='<div style="background:radial-gradient(ellipse at top,#2a1a4e,#141038);border-radius:18px;padding:28px 14px;text-align:center;margin-bottom:12px;border:1px solid rgba(255,255,255,.08)">';
    h+='<div style="width:84px;height:84px;margin:0 auto 12px;background:linear-gradient(135deg,#FFE55C,#FF9800);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:40px;box-shadow:0 0 35px rgba(255,183,0,.7),inset 0 -5px 12px rgba(0,0,0,.25)">⭐</div>';
    h+='<div style="color:#FFD700;font-size:16px;font-weight:bold">رصيد العملات</div>';
    h+='<div style="color:#fff;font-size:34px;font-weight:900;margin-top:4px">🪙 '+coins+'</div>';
    h+='<div style="color:rgba(255,255,255,.55);font-size:12px;margin-top:8px">انشر أكثر، وتميّز أكثر — عملاتك لا تنتهي أبداً</div></div>';
    h+='<div style="background:var(--card);border:2px solid #FFD700;border-radius:18px;padding:16px;margin-bottom:12px">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">';
    h+='<div><div style="color:#fff;font-size:26px;font-weight:900">200 جنيه</div><div style="font-size:11px;color:var(--mut)">دفعة واحدة</div></div>';
    h+='<div style="text-align:left"><div style="font-size:11px;color:#FFD700">رصيد العملات</div><div style="font-size:22px;font-weight:900;color:#fff">500 ⭐</div></div></div>';
    h+='<button onclick="buyCoinsVoda()" style="width:100%;margin-top:14px;padding:14px;background:linear-gradient(90deg,#FFE55C,#FF9800);border:none;border-radius:14px;font-size:16px;font-weight:900;color:#111;cursor:pointer;box-shadow:0 3px 14px rgba(255,153,0,.4)">💳 ادفع بفودافون كاش</button>';
    h+='<div style="font-size:11px;color:var(--mut);text-align:center;margin-top:8px">دفع آمن — بعد التحويل تستلم عملاتك فوراً بعد تأكيد الإدارة</div></div>';
    h+='<div style="background:linear-gradient(135deg,#1a1033,#3d1b5e);border-radius:14px;padding:14px;display:flex;align-items:center;gap:10px;margin-bottom:12px">';
    h+='<div style="flex:1"><div style="font-size:11px;color:rgba(255,255,255,.55)">اسمك مميز في قايمة المتصلين</div><div style="font-size:17px;font-weight:bold;margin-top:2px">'+styleName(me)+'</div><div style="font-size:11px;color:#FFD700;margin-top:4px">🎁 مجاناً الآن — جرّبه من "تميّز باسمك"</div></div></div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">';
    h+='<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;text-align:center"><div style="font-size:26px">🖼️</div><div style="font-weight:bold;font-size:13px;margin-top:6px">إطار حول صورتك</div><div style="font-size:11px;color:var(--mut);margin-top:4px">تميّز بإطار فريد — 100 عملة</div>';
    h+=(me.framesUnlocked?'<div style="font-size:11px;color:var(--grn);font-weight:bold;margin-top:6px">✅ مُفتوحة</div>':(coins>=FRAME_COST?'<button class="adm-btn grn" style="margin-top:8px" onclick="buyFrameWithCoins()">🛒 اشترِ الآن</button>':'<div style="font-size:11px;color:var(--red);margin-top:6px">تحتاج '+(FRAME_COST-coins)+' عملة إضافية</div>'));
    h+='</div>';
    h+='<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;text-align:center"><div style="font-size:26px">✅</div><div style="font-weight:bold;font-size:13px;margin-top:6px">مضمونة</div><div style="font-size:11px;color:var(--mut);margin-top:4px">تستلم عملاتك فور تأكيد الإدارة</div></div>';
    h+='<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;text-align:center"><div style="font-size:26px">♾️</div><div style="font-weight:bold;font-size:13px;margin-top:6px">لا تنتهي</div><div style="font-size:11px;color:var(--mut);margin-top:4px">عملاتك تبقى في حسابك بلا تاريخ انتهاء</div></div>';
    h+='<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;text-align:center"><div style="font-size:26px">🔒</div><div style="font-weight:bold;font-size:13px;margin-top:6px">آمنة</div><div style="font-size:11px;color:var(--mut);margin-top:4px">العملات الصرفت لا تُسترد عند مخالفة القوانين</div></div>';
    h+='</div>';
    h+='<div style="background:var(--card2);border-radius:12px;padding:12px;font-size:11px;color:var(--mut);line-height:2;text-align:center">📌 كيف تعمل العملات: حوّل 200 جنيه عبر فودافون كاش ← ابعت اسم عضويتك للإدارة على تليجرام ← تُضاف 500 عملة لحسابك بعد التأكيد ⚡</div>';
    box.innerHTML=h;
  }catch(e){}
};
})();
/* ===== نظام طلبات شحن العملات (داخلي بالكامل) ===== */
(function(){
if(window._topupDone)return;window._topupDone=true;

/* 1) زرار طلب شحن في شاشة عملاتي */
var _rwW=window.renderWallet;
window.renderWallet=function(){
  var r=_rwW?_rwW():undefined;
  try{
    var box=el('walletBody');if(!box||!me)return r;
    var h='<div style="background:linear-gradient(135deg,#1a1033,#3d1b5e);border-radius:14px;padding:14px;margin-top:12px;text-align:center">';
    h+='<div style="font-size:14px;font-weight:bold;color:#FFD700;margin-bottom:4px">🧾 طلب شحن عملات</div>';
    h+='<div style="font-size:11px;color:rgba(255,255,255,.6);margin-bottom:10px">حوّل 200 جنيه على فودافون كاش ← ارفع صورة التحويل ← الإدارة تشحن لك</div>';
    h+='<button onclick="openTopupRequest()" style="width:100%;padding:12px;background:linear-gradient(90deg,#FFE55C,#FF9800);border:none;border-radius:12px;font-size:15px;font-weight:900;color:#111;cursor:pointer">📤 إرسال طلب شحن مع صورة التحويل</button>';
    h+='<div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:6px">طلباتك المرسلة: <span id="myTopupCount">0</span></div></div>';
    box.insertAdjacentHTML('beforeend',h);
    sb.from('topup_requests').select('id',{count:'exact',head:true}).eq('user',me.name).then(function(d){
      var c=el('myTopupCount');
      if(c)c.innerText=((d&&d.count)||0)+' طلب';
    });
  }catch(e){}
  return r;
};

/* 2) نافذة إرسال الطلب */
window.openTopupRequest=function(){
  if(!me)return toast('سجل دخولك أولاً');
  var old=el('topupModal');if(old)old.remove();
  var m=document.createElement('div');m.id='topupModal';m.className='modal';
  m.innerHTML='<div class="m-card2" style="width:330px;max-height:88vh;overflow-y:auto">'
  +'<h3 style="color:#FFD700">🧾 طلب شحن 500 عملة</h3>'
  +'<div style="background:var(--bg);border:2px dashed #FFD700;border-radius:12px;padding:12px;text-align:center;cursor:pointer" onclick="copyVoda()">'
  +'<div style="font-size:21px;font-weight:900;color:#FFD700;direction:ltr">01013255816</div>'
  +'<div style="font-size:11px;color:var(--mut);margin-top:3px">فودافون كاش — اضغط للنسخ 📋</div></div>'
  +'<div style="font-size:12px;color:var(--txt);text-align:center;line-height:1.7;margin:8px 0">حوّل <b style="color:#FFD700">200 جنيه</b> ← ثم ارفع صورة إيصال التحويل هنا:</div>'
  +'<input type="file" id="topupImg" accept="image/*" style="display:none" onchange="previewTopup(event)">'
  +'<label for="topupImg" id="topupImgLabel" style="width:100%;min-height:70px;background:var(--bg);border:2px dashed var(--line);border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:24px;margin-bottom:6px">📷</label>'
  +'<textarea id="topupNote" placeholder="ملاحظة (اختياري): رقم عملية التحويل..." style="width:100%;background:var(--bg);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px;font-size:12px;min-height:40px;resize:none"></textarea>'
  +'<button style="background:var(--grn);color:#fff" onclick="submitTopup()">✅ إرسال الطلب للإدارة</button>'
  +'<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'topupModal\')">إلغاء</button></div>';
  m.onclick=function(e){if(e.target===m)closeModal('topupModal');};
  document.body.appendChild(m);
  m.classList.add('open');
};

/* 3) معاينة وضغط الصورة */
window.previewTopup=function(e){
  var f=e.target.files[0];if(!f)return;
  compressImg(f,function(d){
    window._topupImg=d;
    var lbl=el('topupImgLabel');
    if(lbl)lbl.innerHTML='<img src="'+d+'" style="max-height:110px;border-radius:8px">';
  });
  e.target.value='';
};

/* 4) حفظ الطلب في قاعدة البيانات */
window.submitTopup=async function(){
  if(!window._topupImg)return toast('📷 ارفع صورة التحويل الأول');
  var note=(el('topupNote')?el('topupNote').value.trim():'');
  toast('⏳ جاري إرسال الطلب...');
  var url=await uploadMedia(window._topupImg,'.jpg');
  if(!url)return toast('فشل رفع الصورة، حاول تاني');
  var r=await sb.from('topup_requests').insert({
    user:me.name,
    amount:500,
    price:200,
    img:url,
    note:note||null,
    status:'pending',
    time:Date.now()
  });
  if(r&&r.error)return toast('❌ خطأ: '+r.error.message);
  window._topupImg=null;
  closeModal('topupModal');
  toast('✅ وصل طلبك للإدارة — هتستلم عملاتك بعد التأكيد');
  try{renderWallet();}catch(e){}
};

/* 5) إشعار للإدارة: نقطة حمراء + تبويب جديد */
try{
  var sidebar=el('adminSidebar');
  if(sidebar&&!el('ap-topupsTab')){
    var t=document.createElement('div');
    t.className='admin-tab';t.id='ap-topupsTab';
    t.innerHTML='🪙 طلبات الشحن <span id="topupDot" style="display:none;min-width:16px;height:16px;background:var(--red);color:#fff;border-radius:50%;font-size:9px;font-weight:bold;line-height:16px;text-align:center;vertical-align:middle">0</span>';
    t.onclick=function(){adminTab('topups',t);};
    sidebar.insertBefore(t,sidebar.firstChild);
  }
}catch(e){}

/* 6) لوحة طلبات الشحن للإدارة */
if(!el('ap-topups')){
  var p=document.createElement('div');
  p.className='admin-panel';p.id='ap-topups';
  p.innerHTML='<div class="adm-sec"><h4>🪙 طلبات شحن العملات</h4><div id="topupList"></div></div>';
  var site=el('ap-site');
  if(site)site.parentElement.insertBefore(p,site);
  else document.querySelector('#s-admin').appendChild(p);
}

window.renderTopups=async function(){
  try{
    var box=el('topupList');if(!box)return;
    box.innerHTML='<div style="text-align:center;color:var(--mut);padding:15px">جاري التحميل...</div>';
    var d=await sb.from('topup_requests').select('*').order('time',{ascending:false}).limit(50);
    if(d.error){box.innerHTML='<div style="color:var(--red);font-size:12px">خطأ: '+d.error.message+'</div>';return;}
    var rows=d.data||[];
    _updateTopupDot(rows.filter(function(x){return x.status==='pending';}).length);
    if(!rows.length){box.innerHTML='<div style="text-align:center;color:var(--mut);padding:15px">لا توجد طلبات شحن بعد</div>';return;}
    var h='';
    rows.forEach(function(r){
      var st=r.status==='pending'?'<span style="color:var(--yel);font-weight:bold;font-size:11px">⏳ معلق</span>':(r.status==='done'?'<span style="color:var(--grn);font-weight:bold;font-size:11px">✅ تم الشحن</span>':'<span style="color:var(--red);font-weight:bold;font-size:11px">❌ مرفوض</span>');
      h+='<div style="background:var(--bg);border:1px solid '+(r.status==='pending'?'var(--yel)':'var(--line)')+';border-radius:12px;padding:12px;margin-bottom:10px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">'
      +'<b style="color:var(--acc);font-size:14px">'+escapeHtml(getMsgName(r.user))+'</b>'
      +'<span style="font-size:12px;color:#FFD700;font-weight:bold">🪙 '+r.amount+' عملة — '+r.price+' جنيه</span>'
      +'<span style="font-size:10px;color:var(--mut)">'+timeAgo(r.time)+'</span></div>'
      +(r.note?'<div style="font-size:11px;color:var(--mut);margin-top:4px">📝 '+escapeHtml(r.note)+'</div>':'')
      +'<div style="margin-top:8px"><img src="'+r.img+'" style="max-width:100%;max-height:180px;border-radius:10px;cursor:pointer;border:1px solid var(--line)" onclick="viewFullImage(this.src)"></div>'
      +'<div style="margin-top:4px;font-size:10px;color:var(--mut)">الحالة: '+st+'</div>';
      if(r.status==='pending'){
        h+='<div style="display:flex;gap:8px;margin-top:10px">'
        +'<button class="adm-btn grn" style="flex:1" onclick="approveTopup(\''+r.id+'\','+r.amount+',\''+String(r.user).replace(/'/g,"\\'")+'\')">✅ شحن العملات</button>'
        +'<button class="adm-btn red" style="flex:1" onclick="rejectTopup(\''+r.id+'\')">❌ رفض</button></div>';
      }
      h+='</div>';
    });
    box.innerHTML=h;
  }catch(e){}
};

function _updateTopupDot(n){
  try{
    var d=el('topupDot');
    if(d){d.style.display=n>0?'inline-block':'none';d.innerText=n;}
  }catch(e){}
}

/* 7) الشحن الفعلي: إضافة العملات + إشعار للعضو */
window.approveTopup=async function(id,amount,user){
  if(!isAdmin())return;
  if(!confirm('شحن '+amount+' عملة لـ '+user+'؟'))return;
  var u=await SDB.getUser(user);
  if(!u)return toast('العضو غير موجود');
  var cur=(u.coins)||0;
  await SDB.patchUser(user,{coins:cur+amount});
  await sb.from('topup_requests').update({status:'done'}).eq('id',id);
  var arr=await (async function(){try{var s=await SDB.loadSettings();return Array.isArray(s.coin_notices)?s.coin_notices:[];}catch(e){return[];}})();
  arr.push({id:'cn'+Date.now(),to:user,msg:'🎉 تم شحن '+amount+' عملة لحسابك بنجاح!',time:Date.now()});
  if(arr.length>200)arr=arr.slice(-200);
  await SDB.saveSetting('coin_notices',arr);
  toast('🪙 تم شحن '+amount+' عملة لـ '+user);
  logActivity('topup','شحن '+amount+' عملة لـ '+user);
  renderTopups();
};

window.rejectTopup=async function(id){
  if(!isAdmin())return;
  if(!confirm('رفض هذا الطلب؟'))return;
  await sb.from('topup_requests').update({status:'rejected'}).eq('id',id);
  toast('تم رفض الطلب');
  renderTopups();
};

/* 8) ربط التبويب بنظام اللوحة */
var _atT=window.adminTab;
window.adminTab=function(tab,e){
  document.querySelectorAll('.admin-tab').forEach(function(b){b.classList.remove('sel');});
  if(e)e.classList.add('sel');
  document.querySelectorAll('.admin-panel').forEach(function(p){p.classList.remove('open');});
  var panel=el('ap-'+tab);
  if(panel)panel.classList.add('open');
  if(tab==='topups')renderTopups();
};

/* 9) فحص دوري للطلبات المعلقة (إشعار النقطة الحمراء) */
setInterval(async function(){
  try{
    if(!me||!isAdmin())return;
    var d=await sb.from('topup_requests').select('id').eq('status','pending');
    _updateTopupDot((d.data||[]).length);
  }catch(e){}
},20000);

/* 10) إشعار استلام العملات للعضو */
var _saCN=window.startAll;
window.startAll=async function(){
  var r=await _saCN();
  try{
    if(!me)return r;
    var s=await SDB.loadSettings();
    var arr=Array.isArray(s.coin_notices)?s.coin_notices:[];
    var mine=arr.filter(function(x){return x&&x.to===me.name;});
    if(mine.length){
      var rest=arr.filter(function(x){return !(x&&x.to===me.name);});
      await SDB.saveSetting('coin_notices',rest);
      var m=document.createElement('div');m.id='coinNoticeModal';m.className='modal';
      var list='';
      mine.forEach(function(x){
        list+='<div style="background:var(--bg);border:1px solid #FFD700;border-radius:10px;padding:12px;margin-bottom:8px;text-align:center;color:#FFD700;font-weight:bold;font-size:14px">'+escapeHtml(x.msg)+'</div>';
      });
      m.innerHTML='<div class="m-card2" style="width:320px"><h3 style="color:#FFD700">🪙 إشعار العملات</h3>'+list
      +'<button style="background:#FFD700;color:#111" onclick="closeModal(\'coinNoticeModal\')">حسناً</button></div>';
      m.onclick=function(e){if(e.target===m)closeModal('coinNoticeModal');};
      document.body.appendChild(m);
      m.classList.add('open');
      if(me.sndNotif!==false)try{beep(1000);}catch(e){}
    }
  }catch(e){}
  return r;
};
})();
/* ===== إصلاح: الشراء جوه نافذة الدفع نفسها + حذف القسم المكرر ===== */
(function(){
/* 1) نافذة الدفع الجديدة: رقم + رفع سكرين + إرسال كلها في واحدة */
window.buyCoinsVoda=function(){
  if(!me)return toast('سجل دخولك أولاً');
  var old=el('buyCoinsModal');if(old)old.remove();
  var m=document.createElement('div');m.id='buyCoinsModal';m.className='modal';
  m.innerHTML='<div class="m-card2" style="width:330px;max-height:88vh;overflow-y:auto">'
  +'<h3 style="color:#FFD700">🪙 شراء 500 عملة</h3>'
  +'<p style="font-size:13px;text-align:center;color:var(--txt);line-height:1.8">حوّل <b style="color:#FFD700">200 جنيه</b> على رقم فودافون كاش:</p>'
  +'<div onclick="copyVoda()" style="background:var(--bg);border:2px dashed #FFD700;border-radius:12px;padding:12px;text-align:center;cursor:pointer">'
  +'<div style="font-size:22px;font-weight:900;color:#FFD700;direction:ltr">01013255816</div>'
  +'<div style="font-size:11px;color:var(--mut);margin-top:4px">📊 اضغط للنسخ 📋</div></div>'
  +'<div style="font-size:12px;color:var(--txt);text-align:center;margin:10px 0 6px">بعد التحويل، ارفع صورة إيصال التحويل هنا:</div>'
  +'<input type="file" id="topupImg" accept="image/*" style="display:none" onchange="previewTopup(event)">'
  +'<label for="topupImg" id="topupImgLabel" style="width:100%;min-height:70px;background:var(--bg);border:2px dashed var(--line);border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:24px;margin-bottom:6px">📷 ارفع صورة التحويل</label>'
  +'<textarea id="topupNote" placeholder="ملاحظة (اختياري): رقم عملية التحويل..." style="width:100%;background:var(--bg);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px;font-size:12px;min-height:40px;resize:none;margin-bottom:6px"></textarea>'
  +'<button style="background:var(--grn);color:#fff" onclick="submitTopup()">✅ إرسال الطلب للإدارة</button>'
  +'<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'buyCoinsModal\')">إغلاق</button></div>';
  m.onclick=function(e){if(e.target===m)closeModal('buyCoinsModal');};
  document.body.appendChild(m);
  m.classList.add('open');
};

/* 2) شيل القسم المكرر اللي كان تحت شاشة عملاتي */
window.renderWallet=(function(){
  var FRAME_COST=100;
  return function(){
    try{
      var box=el('walletBody');if(!box||!me)return;
      var coins=(me.coins)||0;
      var b=el('walletBadge');
      if(b){b.innerText=coins>0?'🪙 '+coins:'جديدة';}
      var h='';
      h+='<div style="background:radial-gradient(ellipse at top,#2a1a4e,#141038);border-radius:18px;padding:28px 14px;text-align:center;margin-bottom:12px;border:1px solid rgba(255,255,255,.08)">';
      h+='<div style="width:84px;height:84px;margin:0 auto 12px;background:linear-gradient(135deg,#FFE55C,#FF9800);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:40px;box-shadow:0 0 35px rgba(255,183,0,.7),inset 0 -5px 12px rgba(0,0,0,.25)">⭐</div>';
      h+='<div style="color:#FFD700;font-size:16px;font-weight:bold">رصيد العملات</div>';
      h+='<div style="color:#fff;font-size:34px;font-weight:900;margin-top:4px">🪙 '+coins+'</div>';
      h+='<div style="color:rgba(255,255,255,.55);font-size:12px;margin-top:8px">انشر أكثر، وتميّز أكثر — عملاتك لا تنتهي أبداً</div></div>';
      h+='<div style="background:var(--card);border:2px solid #FFD700;border-radius:18px;padding:16px;margin-bottom:12px">';
      h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">';
      h+='<div><div style="color:#fff;font-size:26px;font-weight:900">200 جنيه</div><div style="font-size:11px;color:var(--mut)">دفعة واحدة</div></div>';
      h+='<div style="text-align:left"><div style="font-size:11px;color:#FFD700">رصيد العملات</div><div style="font-size:22px;font-weight:900;color:#fff">500 ⭐</div></div></div>';
      h+='<button onclick="buyCoinsVoda()" style="width:100%;margin-top:14px;padding:14px;background:linear-gradient(90deg,#FFE55C,#FF9800);border:none;border-radius:14px;font-size:16px;font-weight:900;color:#111;cursor:pointer;box-shadow:0 3px 14px rgba(255,153,0,.4)">💳 ادفع بفودافون كاش</button>';
      h+='<div style="font-size:11px;color:var(--mut);text-align:center;margin-top:8px">ارفع صورة التحويل في النافذة — وتستلم عملاتك بعد تأكيد الإدارة</div></div>';
      h+='<div style="background:linear-gradient(135deg,#1a1033,#3d1b5e);border-radius:14px;padding:14px;display:flex;align-items:center;gap:10px;margin-bottom:12px">';
      h+='<div style="flex:1"><div style="font-size:11px;color:rgba(255,255,255,.55)">اسمك مميز في قايمة المتصلين</div><div style="font-size:17px;font-weight:bold;margin-top:2px">'+styleName(me)+'</div><div style="font-size:11px;color:#FFD700;margin-top:4px">🎁 مجاناً الآن — جرّبه من "تميّز باسمك"</div></div></div>';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">';
      h+='<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;text-align:center"><div style="font-size:26px">🖼️</div><div style="font-weight:bold;font-size:13px;margin-top:6px">إطار حول صورتك</div><div style="font-size:11px;color:var(--mut);margin-top:4px">تميّز بإطار فريد — 100 عملة</div>';
      h+=(me.framesUnlocked?'<div style="font-size:11px;color:var(--grn);font-weight:bold;margin-top:6px">✅ مُفتوحة</div>':(coins>=FRAME_COST?'<button class="adm-btn grn" style="margin-top:8px" onclick="buyFrameWithCoins()">🛒 اشترِ الآن</button>':'<div style="font-size:11px;color:var(--red);margin-top:6px">تحتاج '+(FRAME_COST-coins)+' عملة إضافية</div>'));
      h+='</div>';
      h+='<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;text-align:center"><div style="font-size:26px">✅</div><div style="font-weight:bold;font-size:13px;margin-top:6px">مضمونة</div><div style="font-size:11px;color:var(--mut);margin-top:4px">تستلم عملاتك فور تأكيد الإدارة</div></div>';
      h+='<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;text-align:center"><div style="font-size:26px">♾️</div><div style="font-weight:bold;font-size:13px;margin-top:6px">لا تنتهي</div><div style="font-size:11px;color:var(--mut);margin-top:4px">عملاتك تبقى في حسابك بلا تاريخ انتهاء</div></div>';
      h+='<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;text-align:center"><div style="font-size:26px">🔒</div><div style="font-weight:bold;font-size:13px;margin-top:6px">آمنة</div><div style="font-size:11px;color:var(--mut);margin-top:4px">العملات الصرفت لا تُسترد عند مخالفة القوانين</div></div>';
      h+='</div></div>';
      box.innerHTML=h;
    }catch(e){}
  };
})();

/* 3) بعد نجاح الإرسال: اقفل نافذة الدفع نفسها */
var _stT=window.submitTopup;
window.submitTopup=async function(){
  if(!window._topupImg)return toast('📷 ارفع صورة التحويل الأول');
  var note=(el('topupNote')?el('topupNote').value.trim():'');
  toast('⏳ جاري إرسال الطلب...');
  var url=await uploadMedia(window._topupImg,'.jpg');
  if(!url)return toast('فشل رفع الصورة، حاول تاني');
  var r=await sb.from('topup_requests').insert({
    user:me.name,amount:500,price:200,img:url,note:note||null,status:'pending',time:Date.now()
  });
  if(r&&r.error)return toast('❌ خطأ: '+r.error.message);
  window._topupImg=null;
  closeModal('buyCoinsModal');
  toast('✅ وصل طلبك للإدارة — هتستلم عملاتك بعد التأكيد');
  try{renderWallet();}catch(e){}
};
})();
/* ===== تميّز الاسم: بالعملات — 130 عملة لمدة 30 يوم ===== */
(function(){
if(window._nameStylePaid)return;window._nameStylePaid=true;
var NAME_COST=130,NAME_DAYS=30;

window.applyNameStyle=function(i){
  var s=window._NAME_STYLES[i];if(!s||!me)return;
  var coins=(me.coins)||0;
  var isOwner=isOwnerName(me.name)||isAdmin();
  if(!isOwner&&coins<NAME_COST)return toast('🪙 محتاج '+NAME_COST+' عملة — عندك '+coins+' | اشحن من "عملاتي"');
  if(!isOwner&&!confirm('تفعيل نمط «'+s.name+'» بـ '+NAME_COST+' عملة لمدة '+NAME_DAYS+' يوم؟\nالرصيد الحالي: '+coins+' عملة'))return;
  var exp=isOwner?null:(Date.now()+NAME_DAYS*86400000);
  var patch={nameGradient:s.grad,nameDecorPre:s.pre,nameDecorPost:s.post,nameGlow:s.glow,nameStyleExp:exp,nameStyleName:s.name};
  if(!isOwner)patch.coins=coins-NAME_COST;
  updateMe(patch).then(function(){
    toast(isOwner?'✨ تم التفعيل (إدارة — بدون خصم)':'✨ تم تفعيل «'+s.name+'» حتى '+new Date(exp).toLocaleDateString('ar-EG'));
    updateProfile();renderOnline();renderMsgs();renderNameStyle();
  });
};

window.removeNameStyle=function(){
  updateMe({nameGradient:null,nameColor:null,nameDecorPre:null,nameDecorPost:null,nameGlow:null,nameStyleExp:null,nameStyleName:null});
  toast('تم إزالة النمط');
  updateProfile();renderOnline();renderMsgs();renderNameStyle();
};

/* إعادة رسم شاشة التميّز: تعرض تاريخ انتهاء النمط الحالي */
window.renderNameStyle=(function(){
  var _rn=window.renderNameStyle;
  return function(){
    var r=_rn?_rn():undefined;
    try{
      var box=el('nameStyleBody');if(!box||!me)return r;
      var exp=me.nameStyleExp;
      var info='';
      if(exp){
        var days=Math.max(0,Math.ceil((exp-Date.now())/86400000));
        info='<div style="background:rgba(255,215,0,.12);border:1px solid #FFD700;border-radius:12px;padding:10px 14px;margin:0 4px 10px;text-align:center;font-size:13px;color:#FFD700;font-weight:bold">👑 نمط «'+escapeHtml(me.nameStyleName||'')+'» مُفعّل — متبقي '+days+' يوم</div>';
      }else{
        info='<div style="background:var(--card2);border-radius:12px;padding:10px 14px;margin:0 4px 10px;text-align:center;font-size:12px;color:var(--mut)">💡 التفعيل بـ <b style="color:#FFD700">'+NAME_COST+' عملة</b> لمدة '+NAME_DAYS+' يوم — اشحن من "عملاتي"</div>';
      }
      var first=box.children[0];
      if(first)first.insertAdjacentHTML('afterend',info);
    }catch(e){}
    return r;
  };
})();

/* الحصر التلقائي: انتهت المدة = الاسم يرجع عادي */
setInterval(async function(){
  try{
    if(!me||!me.nameStyleExp)return;
    if(Date.now()>me.nameStyleExp){
      await updateMe({nameGradient:null,nameDecorPre:null,nameDecorPost:null,nameGlow:null,nameStyleExp:null,nameStyleName:null});
      toast('⏰ انتهت مدة تميّز اسمك — رجع للاسم العادي');
      updateProfile();renderOnline();
    }
  }catch(e){}
},60000);

/* الإدارة: زرار هدية/تجديد في قايمة العضو */
try{
  var um=document.getElementById('userModal');
  if(um&&!el('giftNameStyleBtn')){
    var btn=document.createElement('button');
    btn.id='giftNameStyleBtn';
    btn.style.cssText='background:#8b5cf6;color:#fff';
    btn.innerHTML='👑 تفعيل تميّز الاسم (30 يوم مجاناً)';
    btn.onclick=async function(){
      if(!isAdmin())return toast('ممنوع');
      var n=umTarget;
      if(isOwnerName(n))return toast('👑 صاحب الموقع مفعّل دايماً');
      var u=await SDB.getUser(n);
      if(!u)return toast('العضو غير موجود');
      var styleName2=u.nameStyleName||'أسطوري';
      var st=(window._NAME_STYLES||[]).find(function(x){return x.name===styleName2;})||window._NAME_STYLES[0];
      await SDB.patchUser(n,{nameGradient:st.grad,nameDecorPre:st.pre,nameDecorPost:st.post,nameGlow:st.glow,nameStyleExp:Date.now()+30*86400000,nameStyleName:st.name});
      toast('👑 تم تفعيل التميّز لـ '+n+' لمدة 30 يوم');
      logActivity('name_style','تفعيل تميّز اسم مجاني لـ '+n);
      closeModal('userModal');refreshUsers();
    };
    var closeBtn=um.querySelector('button[onclick="closeModal(\'userModal\')"]');
    um.insertBefore(btn,closeBtn);
  }
}catch(e){}

/* إخفاء شارة "مجاناً" من القايمة — بقت بالعملات */
try{
  var mi=el('nameStyleMenuItem');
  if(mi){
    var badge=mi.querySelector('span span');
    if(badge&&badge.innerText==='مجاناً'){
      badge.innerText='130 عملة';
      badge.style.background='linear-gradient(135deg,#FFD700,#FF9800)';
      badge.style.color='#111';
    }
  }
}catch(e){}
})();
/* ===== التجربة المجانية 48 ساعة عبر جوجل — فرصة واحدة لكل حساب ===== */
(function(){
if(window._gTrialDone)return;window._gTrialDone=true;
var TRIAL_HOURS=48,NAME_COST=130;
var GOOGLE_CLIENT_ID='460379934757-ar74mvdbmv6427k7e90fd3mkjg0o2blt.apps.googleusercontent.com'; // 👈 استبدله بمعرفك

try{
  if(GOOGLE_CLIENT_ID.indexOf('ضع_الـ')===-1&&!document.getElementById('gsiScript')){
    var s=document.createElement('script');s.id='gsiScript';
    s.src='https://accounts.google.com/gsi/client';s.async=true;
    document.head.appendChild(s);
  }
}catch(e){}

window._gJwt=function(t){
  try{var p=t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
  return JSON.parse(decodeURIComponent(atob(p).split('').map(function(c){return '%'+('00'+c.charCodeAt(0).toString(16)).slice(-2);}).join('')));}catch(e){return null;}
};

window._onGoogleSigned=async function(res){
  var p=window._gJwt(res.credential);
  if(!p||!p.sub)return toast('فشل التحقق من جوجل');
  await updateMe({google_id:p.sub,google_email:p.email||''});
  closeModal('googleLinkModal');
  toast('✅ تم ربط حساب جوجل: '+(p.email||''));
  try{renderNameStyle();}catch(e){}
};

window.linkGoogle=function(){
  if(!me)return toast('سجل دخولك أولاً');
  if(typeof google==='undefined'||!google.accounts||!google.accounts.id)
    return toast('⚠️ خدمة جوجل مش جاهزة — اتأكد من Client ID وحدّث الصفحة');
  var old=el('googleLinkModal');if(old)old.remove();
  var m=document.createElement('div');m.id='googleLinkModal';m.className='modal';
  m.innerHTML='<div class="m-card2" style="width:320px"><h3>🔗 ربط حساب جوجل</h3>'
  +'<p style="font-size:12px;color:var(--mut);text-align:center;line-height:1.9">اربط جوجل عشان تاخد <b style="color:var(--grn)">فرصة التجربة المجانية 48 ساعة</b><br>كل حساب جوجل = فرصة واحدة بس</p>'
  +'<div id="gsiBtnBox" style="display:flex;justify-content:center;min-height:52px"></div>'
  +'<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'googleLinkModal\')">إغلاق</button></div>';
  m.onclick=function(e){if(e.target===m)closeModal('googleLinkModal');};
  document.body.appendChild(m);m.classList.add('open');
  google.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID,callback:window._onGoogleSigned});
  google.accounts.id.renderButton(el('gsiBtnBox'),{theme:'filled_blue',size:'large',text:'continue_with',shape:'pill',locale:'ar'});
};

window._activateStyle=function(s,exp,free){
  updateMe({nameGradient:s.grad,nameDecorPre:s.pre||'',nameDecorPost:s.post||'',nameGlow:s.glow,nameStyleExp:exp,nameStyleName:s.name}).then(async function(){
    if(free){
      try{await sb.from('google_trials').insert({google_id:me.google_id,site_user:me.name,time:Date.now()});await updateMe({free_trial_used:true});}catch(e){}
    }
    var msg=free?('🎁 تجربة مجانية لمدة '+TRIAL_HOURS+' ساعة!'):'✨ تم التفعيل حتى '+new Date(exp).toLocaleDateString('ar-EG');
    toast(msg);
    closeModal('styleChoiceModal');
    updateProfile();renderOnline();renderMsgs();renderNameStyle();
  });
};

window._payForStyle=function(i){
  var s=window._NAME_STYLES[i];if(!s)return;
  var coins=(me.coins)||0;
  if(coins<NAME_COST)return toast('🪙 محتاج '+NAME_COST+' عملة — عندك '+coins+' | اشحن من "عملاتي"');
  if(!confirm('تفعيل نمط «'+s.name+'» بـ '+NAME_COST+' عملة لمدة 30 يوم؟'))return;
  _activateStyle(s,Date.now()+30*86400000,false);
  updateMe({coins:coins-NAME_COST});
};

window._useFreeTrial=function(i){
  var s=window._NAME_STYLES[i];if(!s)return;
  if(!confirm('تفعيل «'+s.name+'» مجاناً لمدة '+TRIAL_HOURS+' ساعة؟\n⚠️ دي فرصتك المجانية الوحيدة على حساب جوجل ده!'))return;
  _activateStyle(s,Date.now()+TRIAL_HOURS*3600000,true);
};

window.applyNameStyle=function(i){
  var s=window._NAME_STYLES[i];if(!s||!me)return;
  if(isOwnerName(me.name)||isAdmin()){
    _activateStyle(s,Date.now()+30*86400000,false);
    return;
  }
  var old=el('styleChoiceModal');if(old)old.remove();
  var m=document.createElement('div');m.id='styleChoiceModal';m.className='modal';
  var nh='<span style="filter:drop-shadow(0 0 6px '+s.glow+')">'+(s.pre||'')+'<span style="background:'+s.grad+';-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:bold">'+escapeHtml(me.displayName||me.name)+'</span>'+(s.post||'')+'</span>';
  var h='<div class="m-card2" style="width:330px"><h3>👑 تميّز باسمك</h3>'
  +'<div style="text-align:center;font-size:17px;min-height:30px">'+nh+'</div>'
  +'<div style="font-size:12px;color:var(--mut);text-align:center;margin-bottom:6px">نمط «'+s.name+'»</div>';
  h+='<div id="styleChoiceBtns" style="display:flex;flex-direction:column;gap:8px"><div style="text-align:center;color:var(--mut);font-size:12px">جاري الفحص...</div></div>';
  h+='<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'styleChoiceModal\')">إغلاق</button></div>';
  m.onclick=function(e){if(e.target===m)closeModal('styleChoiceModal');};
  document.body.appendChild(m);m.classList.add('open');
  var finish=function(googleOk){
    var b=el('styleChoiceBtns');if(!b)return;
    var h2='';
    if(googleOk){
      h2+='<button style="background:var(--grn);color:#fff" onclick="_useFreeTrial('+i+')">🎁 جرّبه مجاناً '+TRIAL_HOURS+' ساعة — فرصتك الوحيدة!</button>';
    }else if(!me.google_id){
      h2+='<button style="background:#4285F4;color:#fff" onclick="closeModal(\'styleChoiceModal\');linkGoogle()">🔗 اربط حساب جوجل وجرّبه مجاناً 48 ساعة</button>';
    }else{
      h2+='<div style="font-size:11px;color:var(--mut);text-align:center;background:var(--card2);border-radius:8px;padding:6px">❌ استهلكت فرصتك المجانية على حساب جوجل ده</div>';
    }
    if((me.coins||0)>=NAME_COST){
      h2+='<button style="background:linear-gradient(90deg,#FFE55C,#FF9800);color:#111" onclick="_payForStyle('+i+')">🪙 فعّل بـ '+NAME_COST+' عملة — 30 يوم</button>';
    }else{
      h2+='<button style="background:var(--card2);color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'styleChoiceModal\');go(\'wallet\',null)">🪙 رصيدك '+((me.coins)||0)+' — اشحن '+NAME_COST+' عملة</button>';
    }
    b.innerHTML=h2;
  };
  if(me.google_id&&!me.free_trial_used){
    sb.from('google_trials').select('id').eq('google_id',me.google_id).limit(1).then(function(d){
      finish(!(d.data&&d.data.length));
    });
  }else{
    finish(false);
  }
};

/* شاشة التميّز المحدثة: شريط حالة التجربة + الربط */
window.renderNameStyle=function(){
  try{
    var STYLES=window._NAME_STYLES||[];
    var box=el('nameStyleBody');if(!box||!me)return;
    var h='';
    h+='<div style="background:linear-gradient(135deg,#1a1033,#3d1b5e);border-radius:18px;padding:24px 14px;text-align:center;margin-bottom:12px;border:1px solid rgba(255,255,255,.08)">';
    h+='<div style="font-size:11px;color:rgba(255,255,255,.6);margin-bottom:10px">هكذا يليق اسمك</div>';
    h+='<div style="font-size:22px;font-weight:bold">'+styleName(me)+'</div>';
    var st='';
    if(isOwnerName(me.name)||isAdmin())st='<div style="background:rgba(255,255,255,.12);color:#fff;border-radius:12px;padding:6px 14px;display:inline-block;margin-top:10px;font-size:12px">👑 إدارة — تفعيل مجاني دائم</div>';
    else if(!me.google_id)st='<div style="background:rgba(66,133,244,.15);border:1px solid #4285F4;color:#9ec3ff;border-radius:12px;padding:6px 14px;display:inline-block;margin-top:10px;font-size:12px">🎁 اربط جوجل وخد فرصة مجانية 48 ساعة <button onclick="linkGoogle()" style="background:#4285F4;color:#fff;border:none;border-radius:8px;padding:3px 12px;font-size:11px;font-weight:bold;cursor:pointer;margin-right:8px">ربط</button></div>';
    else if(!me.free_trial_used)st='<div style="background:rgba(34,197,94,.15);border:1px solid var(--grn);color:#86efac;border-radius:12px;padding:6px 14px;display:inline-block;margin-top:10px;font-size:12px">🎁 فرصتك المجانية متاحة — جوجل: '+escapeHtml(me.google_email||'')+'</div>';
    else st='<div style="background:rgba(230,69,83,.12);border:1px solid var(--red);color:#fca5a5;border-radius:12px;padding:6px 14px;display:inline-block;margin-top:10px;font-size:12px">❌ استهلكت الفرصة المجانية — التفعيل بـ '+NAME_COST+' عملة</div>';
    h+=st+'</div>';
    if(me.nameStyleExp){
      var days=Math.max(0,Math.ceil((me.nameStyleExp-Date.now())/86400000));
      h+='<div style="background:rgba(255,215,0,.12);border:1px solid #FFD700;border-radius:12px;padding:10px 14px;margin:0 4px 10px;text-align:center;font-size:13px;color:#FFD700;font-weight:bold">👑 نمط «'+escapeHtml(me.nameStyleName||'')+'» مُفعّل — متبقي '+days+' '+(me.nameStyleExp-Date.now()<86400000*2&&me.nameStyleExp-Date.now()>86400000?'يوم':'يوم')+'</div>';
    }
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">';
    STYLES.forEach(function(s2,i){
      var sel=(me.nameGradient===s2.grad&&me.nameDecorPost===s2.post);
      var nh='<span style="filter:drop-shadow(0 0 6px '+s2.glow+')">'+(s2.pre||'')+'<span style="background:'+s2.grad+';-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:bold">'+escapeHtml(me.displayName||me.name)+'</span>'+(s2.post||'')+'</span>';
      h+='<div onclick="applyNameStyle('+i+')" style="background:var(--card);border:2px solid '+(sel?'var(--acc)':'var(--line)')+';border-radius:14px;padding:14px 8px;text-align:center;cursor:pointer">'
      +'<div style="font-size:16px;min-height:26px;word-break:break-word">'+nh+'</div>'
      +'<div style="font-size:13px;font-weight:bold;color:var(--txt);margin-top:8px">'+s2.name+'</div>'
      +'<div style="font-size:10px;color:var(--mut);margin-top:3px">'+s2.desc+'</div>'
      +(sel?'<div style="font-size:10px;color:var(--grn);font-weight:bold;margin-top:4px">✅ مُفعّل</div>':'')
      +'</div>';
    });
    h+='</div>';
    h+='<button class="lbtn" onclick="removeNameStyle()" style="margin-top:14px;background:var(--red)">🗑️ إزالة النمط</button>';
    box.innerHTML=h;
  }catch(e){}
};
})();
/* ===== إصلاح وتطوير: نقطة حمراء لآخر التحديثات (القايمة + الشريط السفلي) ===== */
(function(){
if(window._updBadgeFix)return;window._updBadgeFix=true;

var BADGE_CSS='display:none;min-width:18px;height:18px;background:#e64553;color:#fff;border-radius:10px;font-size:10px;font-weight:bold;align-items:center;justify-content:center;padding:0 5px;margin-right:6px;vertical-align:middle';

/* 1) عنصر "آخر التحديثات" في الإعدادات: إنشاء أو إصلاح البادج */
function ensureItem(){
  try{
    var scr=el('s-settings');if(!scr)return;
    var item=el('updatesMenuItem');
    if(!item){
      var card=document.createElement('div');
      card.className='menu-list';card.id='updatesMenuItem';
      card.style.marginBottom='12px';
      card.innerHTML='<div class="m-item" onclick="openUpdates()" style="cursor:pointer"><span>🔔 آخر التحديثات <b id="updBadgeDot" style="'+BADGE_CSS+'"></b></span><span>👈</span></div>';
      var lists=scr.querySelectorAll('.menu-list');
      if(lists.length)lists[0].parentElement.insertBefore(card,lists[0].nextSibling);
      else scr.insertBefore(card,scr.firstChild);
    }else{
      var bd=el('updBadgeDot');
      if(bd)bd.style.cssText=BADGE_CSS;
    }
  }catch(e){}
}

/* 2) نقطة حمراء على أيقونة الإعدادات في الشريط السفلي */
function ensureNavDot(){
  try{
    var nav=el('bottomNav');if(!nav)return;
    var items=nav.querySelectorAll('.nav-item');
    var setItem=items[items.length-1];
    if(!setItem)return;
    var ic=setItem.querySelector('.icon');
    if(!ic)return;
    if(!el('navUpdDot')){
      ic.style.position='relative';
      var d=document.createElement('span');
      d.id='navUpdDot';
      d.style.cssText='position:absolute;top:-2px;right:-6px;min-width:15px;height:15px;background:#e64553;color:#fff;border-radius:9px;font-size:9px;font-weight:bold;line-height:15px;text-align:center;padding:0 3px;display:none;border:2px solid var(--card);z-index:5';
      ic.appendChild(d);
    }
  }catch(e){}
}

/* 3) تحديث العداد في المكانين (القايمة + الشريط) */
window.updateUpdatesBadge=async function(){
  try{
    if(!me)return;
    var all=(await SDB.loadSettings()).updates;
    all=Array.isArray(all)?all:[];
    var seen=parseInt(LS.getItem('updates_seen')||'0');
    var n=0;
    all.forEach(function(u){if(u.pub!==false&&(u.date||0)>seen)n++;});
    var d=el('updBadgeDot');
    if(d){if(n>0){d.style.display='inline-flex';d.innerText=n;}else d.style.display='none';}
    var nd=el('navUpdDot');
    if(nd){if(n>0){nd.style.display='block';nd.innerText=n;}else nd.style.display='none';}
  }catch(e){}
};

/* 4) فتح التحديثات = تصفير العداد فوراً */
var _openUpd=window.openUpdates;
window.openUpdates=function(){
  try{LS.setItem('updates_seen',String(Date.now()));}catch(e){}
  setTimeout(function(){try{updateUpdatesBadge();}catch(e){}},200);
  return _openUpd?_openUpd():undefined;
};

/* 5) تشغيل مستمر */
var _saU4=window.startAll;
window.startAll=async function(){
  var r=await _saU4();
  try{ensureItem();ensureNavDot();updateUpdatesBadge();}catch(e){}
  return r;
};
setInterval(function(){try{ensureItem();ensureNavDot();updateUpdatesBadge();}catch(e){}},8000);
})();
/* ===== 🛒 متجر سونيك ===== */
(function(){
if(window._sonicShop)return;window._sonicShop=true;

/* إعدادات المتجر: عدّل الأسعار من هنا بس */
var PRODUCTS={
  frame:{icon:'🖼️',name:'إطار حول صورتك',desc:'تفتح لك ميزة الإطارات في الإعدادات',cost:100,perm:true},
  name:{icon:'👑',name:'تميّز الاسم',desc:'اسمك ملون ومتوهج في كل الموقع — 30 يوم',cost:130,perm:false},
  hide:{icon:'🕶️',name:'الوضع المخفي',desc:'تختفي من قايمة المتصلين — 30 يوم',cost:80,perm:false},
  namecolor:{icon:'🎨',name:'ألوان الاسم والنص',desc:'تفتح شاشة ألوان الاسم المتقدمة',cost:60,perm:true},
  framesFree:{icon:'⭐',name:'قسم الجيمنج VIP',desc:'دخول أول للألعاب الجديدة قبل الكل — 30 يوم',cost:150,perm:false}
};

/* 1) عنصر المتجر في قايمة الإعدادات */
try{
  var lists=document.querySelectorAll('#s-settings .menu-list');
  var tgt=lists[0];
  if(tgt&&!el('shopMenuItem')){
    var mi=document.createElement('div');
    mi.className='m-item';mi.id='shopMenuItem';
    mi.innerHTML='<span>🛒 متجر سونيك <span style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-size:10px;font-weight:bold;padding:3px 10px;border-radius:12px;margin-right:6px">🪙 عملات</span></span><span>👈</span>';
    mi.onclick=function(){go('shop',null);};
    tgt.insertBefore(mi,tgt.firstChild);
  }
}catch(e){}

/* 2) الشاشة */
if(!el('s-shop')){
  var scr=document.createElement('div');
  scr.className='screen';scr.id='s-shop';
  scr.innerHTML='<div class="sub-title" onclick="go(\'settings\')">➔ متجر سونيك</div><div id="shopBody" style="padding:4px"></div>';
  var content=document.querySelector('.content');
  var ref=el('s-settings');
  if(ref&&ref.parentElement)content.insertBefore(scr,ref);
  else content.appendChild(scr);
}

/* 3) رسم المتجر */
window.renderShop=function(){
  try{
    var box=el('shopBody');if(!box||!me)return;
    var coins=(me.coins)||0;
    var h='';
    h+='<div style="background:radial-gradient(ellipse at top,#2a1a4e,#141038);border-radius:18px;padding:22px 14px;text-align:center;margin-bottom:12px;border:1px solid rgba(255,255,255,.08)">';
    h+='<div style="font-size:15px;font-weight:900;color:#fff">🛒 متجر سونيك</div>';
    h+='<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:4px">كل مميزات الشات في مكان واحد</div>';
    h+='<div style="margin-top:12px;background:rgba(255,215,0,.1);border:1px solid #FFD700;border-radius:14px;padding:10px 18px;display:inline-block;cursor:pointer" onclick="go(\'wallet\',null)">';
    h+='<span style="font-size:22px;font-weight:900;color:#FFD700">🪙 '+coins+'</span>';
    h+='<span style="font-size:11px;color:rgba(255,255,255,.7);margin-right:8px">رصيدك — اضغط للشحن</span></div></div>';
    h+='<div style="display:flex;flex-direction:column;gap:10px">';
    Object.keys(PRODUCTS).forEach(function(k){
      var p=PRODUCTS[k];
      var owned=isOwned(k);
      h+='<div style="background:var(--card);border:1px solid '+(owned?'var(--grn)':'var(--line)')+';border-radius:14px;padding:14px;display:flex;align-items:center;gap:12px">';
      h+='<div style="width:52px;height:52px;border-radius:12px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0">'+p.icon+'</div>';
      h+='<div style="flex:1;min-width:0"><div style="font-weight:bold;font-size:14px;color:var(--txt)">'+p.name+'</div>';
      h+='<div style="font-size:11px;color:var(--mut);margin-top:3px;line-height:1.6">'+p.desc+'</div></div>';
      h+='<div style="flex-shrink:0">';
      if(owned)h+='<div style="font-size:11px;color:var(--grn);font-weight:bold;text-align:center">✅<div style="font-size:9px">مُفعّل</div></div>';
      else if(coins>=p.cost)h+='<button class="adm-btn" style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-weight:900;border-radius:12px;padding:8px 14px" onclick="buyProduct(\''+k+'\')">🪙 '+p.cost+'</button>';
      else h+='<div style="font-size:11px;color:var(--red);text-align:center;font-weight:bold">'+p.cost+'<div style="font-size:9px">ناقص '+(p.cost-coins)+'</div></div>';
      h+='</div></div>';
    });
    h+='</div>';
    h+='<div style="background:var(--card2);border-radius:12px;padding:12px;font-size:11px;color:var(--mut);line-height:2;margin-top:12px;text-align:center">📌 الشراء بالعملات فقط — اشحن من "عملاتي" (200 جنيه = 500 عملة)<br>المميزات الدائمة 🔒 تفضل معاك للأبد — والمؤقتة 📅 لمدة محددة تظهر مدتها جنبها</div>';
    box.innerHTML=h;
  }catch(e){}
};

function isOwned(k){
  try{
    if(k==='frame')return me.framesUnlocked===true;
    if(k==='namecolor')return me.nameColorsUnlocked===true;
    if(k==='name')return me.nameStyleExp&&me.nameStyleExp>Date.now();
    if(k==='hide')return me.hideExp&&me.hideExp>Date.now();
    if(k==='framesFree')return me.vipExp&&me.vipExp>Date.now();
  }catch(e){}
  return false;
}
window._shopOwned=isOwned;

/* 4) الشراء */
window.buyProduct=async function(k){
  var p=PRODUCTS[k];if(!p||!me)return;
  if(isOwned(k)&&p.perm)return toast('✅ الميزة دي مُفعّلة عندك بالفعل');
  if(!confirm('شراء «'+p.name+'» بـ '+p.cost+' عملة؟\nرصيدك الحالي: '+((me.coins)||0)+' عملة'))return;
  var coins=(me.coins)||0;
  if(coins<p.cost)return toast('🪙 عملاتك مش كفاية — اشحن من "عملاتي"');
  var patch={coins:coins-p.cost};
  if(k==='frame')patch.framesUnlocked=true;
  if(k==='namecolor')patch.nameColorsUnlocked=true;
  if(k==='name')patch.nameStyleExp=Date.now()+30*86400000;
  if(k==='hide')patch.hideExp=Date.now()+30*86400000;
  if(k==='framesFree')patch.vipExp=Date.now()+30*86400000;
  await updateMe(patch);
  try{logActivity('shop','شراء '+p.name+' بـ '+p.cost+' عملة');}catch(e){}
  toast('🎉 تم الشراء: '+p.name);
  renderShop();
  try{updateProfile();renderOnline();}catch(e){}
  if(k==='frame')try{el('frameMenuItem').style.display='flex';}catch(e){}
};

/* 5) الربط بالتنقل + تفعيل الوضع المخفي والـ VIP من العملات */
var _goS=window.go;
window.go=function(s,nv,fb){
  var r=_goS(s,nv,fb);
  try{
    if(s==='shop')renderShop();
    if(s==='privacy'&&me&&me.hideExp&&me.hideExp>Date.now()){
      var ph=el('pHide');
      if(ph&&!me.hidden){ph.checked=true;setPref('hidden',true);toast('🕶️ الوضع المخفي مُفعّل من المتجر — باقي '+Math.ceil((me.hideExp-Date.now())/86400000)+' يوم');}
    }
    
  }catch(e){}
  return r;
};
})();
/* ===== 🛒 متجر سونيك v2: الإطار (30 يوم) + تميّز الاسم فقط ===== */
(function(){
if(window._sonicShop2)return;window._sonicShop2=true;

var FRAME_COST=100,FRAME_DAYS=30;
var NAME_COST=130,NAME_DAYS=30;

/* 1) عنصر المتجر */
try{
  var lists=document.querySelectorAll('#s-settings .menu-list');
  var tgt=lists[0];
  if(tgt&&!el('shopMenuItem')){
    var mi=document.createElement('div');
    mi.className='m-item';mi.id='shopMenuItem';
    mi.innerHTML='<span>🛒 متجر سونيك <span style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-size:10px;font-weight:bold;padding:3px 10px;border-radius:12px;margin-right:6px">🪙 عملات</span></span><span>👈</span>';
    mi.onclick=function(){go('shop',null);};
    tgt.insertBefore(mi,tgt.firstChild);
  }
}catch(e){}

/* 2) الشاشة */
if(!el('s-shop')){
  var scr=document.createElement('div');
  scr.className='screen';scr.id='s-shop';
  scr.innerHTML='<div class="sub-title" onclick="go(\'settings\')">➔ متجر سونيك</div><div id="shopBody" style="padding:4px"></div>';
  var content=document.querySelector('.content');
  var ref=el('s-settings');
  if(ref&&ref.parentElement)content.insertBefore(scr,ref);
  else content.appendChild(scr);
}

/* 3) رسم المتجر */
window.renderShop=function(){
  try{
    var box=el('shopBody');if(!box||!me)return;
    var coins=(me.coins)||0;
    var h='';
    h+='<div style="background:radial-gradient(ellipse at top,#2a1a4e,#141038);border-radius:18px;padding:22px 14px;text-align:center;margin-bottom:12px;border:1px solid rgba(255,255,255,.08)">';
    h+='<div style="font-size:15px;font-weight:900;color:#fff">🛒 متجر سونيك</div>';
    h+='<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:4px">كل مميزات الشات في مكان واحد</div>';
    h+='<div style="margin-top:12px;background:rgba(255,215,0,.1);border:1px solid #FFD700;border-radius:14px;padding:10px 18px;display:inline-block;cursor:pointer" onclick="go(\'wallet\',null)">';
    h+='<span style="font-size:22px;font-weight:900;color:#FFD700">🪙 '+coins+'</span>';
    h+='<span style="font-size:11px;color:rgba(255,255,255,.7);margin-right:8px">رصيدك — اضغط للشحن</span></div></div>';

    /* --- منتج 1: الإطار (30 يوم) --- */
    var frameActive=me.frameExp&&me.frameExp>Date.now();
    h+='<div style="background:var(--card);border:1px solid '+(frameActive?'var(--grn)':'var(--line)')+';border-radius:14px;padding:14px;display:flex;align-items:center;gap:12px;margin-bottom:10px">';
    h+='<div style="width:52px;height:52px;border-radius:12px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0">🖼️</div>';
    h+='<div style="flex:1;min-width:0"><div style="font-weight:bold;font-size:14px;color:var(--txt)">🖼️ إطار حول صورتك</div>';
    h+='<div style="font-size:11px;color:var(--mut);margin-top:3px">تفتح لك ميزة الإطارات في الإعدادات — لمدة '+FRAME_DAYS+' يوم</div>';
    if(frameActive)h+='<div style="font-size:11px;color:var(--grn);font-weight:bold;margin-top:4px">✅ مُفعّل — متبقي '+Math.ceil((me.frameExp-Date.now())/86400000)+' يوم</div>';
    h+='</div>';
    h+='<div style="flex-shrink:0">';
    if(frameActive)h+='<div style="font-size:11px;color:var(--grn);font-weight:bold;text-align:center">✅</div>';
    else if(coins>=FRAME_COST)h+='<button class="adm-btn" style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-weight:900;border-radius:12px;padding:8px 14px" onclick="buyShopFrame()">🪙 '+FRAME_COST+'</button>';
    else h+='<div style="font-size:11px;color:var(--red);text-align:center;font-weight:bold">'+FRAME_COST+'<div style="font-size:9px">ناقص '+(FRAME_COST-coins)+'</div></div>';
    h+='</div></div>';

    /* --- منتج 2: تميّز الاسم --- */
    var nameActive=me.nameStyleExp&&me.nameStyleExp>Date.now();
    h+='<div style="background:var(--card);border:1px solid '+(nameActive?'var(--grn)':'var(--line)')+';border-radius:14px;padding:14px;display:flex;align-items:center;gap:12px">';
    h+='<div style="width:52px;height:52px;border-radius:12px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0">👑</div>';
    h+='<div style="flex:1;min-width:0"><div style="font-weight:bold;font-size:14px;color:var(--txt)">👑 تميّز الاسم</div>';
    h+='<div style="font-size:11px;color:var(--mut);margin-top:3px">اسمك ملون ومتوهج في كل الموقع — 30 يوم</div>';
    if(nameActive)h+='<div style="font-size:11px;color:var(--grn);font-weight:bold;margin-top:4px">✅ مُفعّل — متبقي '+Math.ceil((me.nameStyleExp-Date.now())/86400000)+' يوم</div>';
    h+='</div>';
    h+='<div style="flex-shrink:0">';
    if(nameActive)h+='<div style="font-size:11px;color:var(--grn);font-weight:bold;text-align:center">✅</div>';
    else h+='<button class="adm-btn" style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-weight:900;border-radius:12px;padding:8px 14px" onclick="go(\'namestyle\',null)">اختر نمط</button>';
    h+='</div></div>';

    h+='<div style="background:var(--card2);border-radius:12px;padding:12px;font-size:11px;color:var(--mut);line-height:2;margin-top:12px;text-align:center">📌 الشراء بالعملات فقط — اشحن من "عملاتي" (200 جنيه = 500 عملة)<br>🔄 المميزات مؤقتة لمدة 30 يوم — يمكنك التجديد في أي وقت</div>';
    box.innerHTML=h;
  }catch(e){}
};

/* 4) شراء الإطار (30 يوم — بديل النظام القديم الدائم) */
window.buyShopFrame=function(){
  if(!me)return;
  var coins=(me.coins)||0;
  if(coins<FRAME_COST)return toast('🪙 عملاتك مش كفاية — اشحن من "عملاتي"');
  if(!confirm('شراء ميزة الإطار بـ '+FRAME_COST+' عملة لمدة '+FRAME_DAYS+' يوم؟'))return;
  updateMe({coins:coins-FRAME_COST,frameExp:Date.now()+FRAME_DAYS*86400000,framesUnlocked:true}).then(function(){
    toast('🎉 تم فتح ميزة الإطار لمدة '+FRAME_DAYS+' يوم! تلاقيها في الإعدادات');
    try{el('frameMenuItem').style.display='flex';}catch(e){}
    renderShop();
  });
};

/* 5) حصر الإطار تلقائياً عند انتهاء مدته */
setInterval(async function(){
  try{
    if(!me||!me.frameExp)return;
    if(Date.now()>me.frameExp){
      await updateMe({frameExp:null,framesUnlocked:false,frame:null});
      toast('⏰ انتهت مدة الإطار — يمكنك تجديدها من متجر سونيك');
      try{el('frameMenuItem').style.display='none';}catch(e){}
      try{updateProfile();renderOnline();}catch(e){}
    }
  }catch(e){}
},60000);

/* 6) الربط بالتنقل + إظهار عنصر الإطار للمشتركين فقط */
var _goS2=window.go;
window.go=function(s,nv,fb){
  var r=_goS2(s,nv,fb);
  try{
    if(s==='shop')renderShop();
    if(s==='settings'&&me){
      var fm=el('frameMenuItem');
      if(fm)fm.style.display=(me.frameExp&&me.frameExp>Date.now())||isAdmin()||isOwner()?'flex':'none';
    }
  }catch(e){}
  return r;
};
})();
/* ===== 💰 شاشة الشحن v2: 9 حزم بمكافآت متدرجة ===== */
(function(){
if(window._walletPacks)return;window._walletPacks=true;

var PACKS=[
 {coins:100,price:40,bonus:0},
 {coins:150,price:60,bonus:5},
 {coins:200,price:80,bonus:10},
 {coins:250,price:100,bonus:20},
 {coins:300,price:120,bonus:30},
 {coins:350,price:140,bonus:45},
 {coins:400,price:160,bonus:60},
 {coins:450,price:180,bonus:80},
 {coins:500,price:200,bonus:100}
];

/* إعادة رسم شاشة عملاتي: قايمة الحزم بدل الكارت الواحد */
window.renderWallet=(function(){
  var _rw=window.renderWallet;
  return function(){
    var r=_rw?_rw():undefined;
    try{
      var box=el('walletBody');if(!box||!me)return r;
      /* نحذف القسم القديم بتاع الباقات لو موجود */
      var oldSecs=box.querySelectorAll('[data-packs]');
      for(var i=0;i<oldSecs.length;i++)oldSecs[i].remove();
      var h='<div data-packs="1">';
      h+='<div style="font-size:14px;font-weight:bold;color:var(--txt);margin:6px 0 10px;padding:0 4px">💎 باقات الشحن — كل ما تشحن أكتر، المكافأة تكبر!</div>';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
      PACKS.forEach(function(p,idx){
        var total=p.coins+p.bonus;
        var best=(idx===PACKS.length-1);
        h+='<div onclick="openPackPay('+idx+')" style="background:var(--card);border:2px solid '+(best?'#FFD700':'var(--line)')+';border-radius:14px;padding:12px;text-align:center;cursor:pointer;position:relative'+(best?';box-shadow:0 0 16px rgba(255,215,0,.35)':'')+'">';
        if(p.bonus>0)h+='<span style="position:absolute;top:-8px;right:10px;background:var(--grn);color:#fff;font-size:9px;font-weight:bold;padding:2px 8px;border-radius:8px">🎁 +'+p.bonus+' مجاناً</span>';
        if(best)h+='<span style="position:absolute;top:-8px;left:10px;background:#FFD700;color:#111;font-size:9px;font-weight:bold;padding:2px 8px;border-radius:8px">🔥 الأكبر</span>';
        h+='<div style="font-size:20px;font-weight:900;color:#FFD700;margin-top:'+(p.bonus>0?'6px':'2px')+'">🪙 '+total+'</div>';
        if(p.bonus>0)h+='<div style="font-size:10px;color:var(--mut)">'+p.coins+' + '+p.bonus+' هدية</div>';
        else h+='<div style="font-size:10px;color:var(--mut)">'+p.coins+' عملة</div>';
        h+='<div style="font-size:15px;font-weight:900;color:var(--txt);margin-top:6px">'+p.price+' جنيه</div></div>';
      });
      h+='</div>';
      h+='<div style="background:var(--card2);border-radius:12px;padding:12px;font-size:11px;color:var(--mut);line-height:2;margin-top:12px;text-align:center">📌 اضغط على الباقة ← حوّل السعر على فودافون كاش ← ارفع صورة التحويل ← تستلم عملاتك بعد تأكيد الإدارة ⚡</div></div>';
      box.insertAdjacentHTML('beforeend',h);
    }catch(e){}
    return r;
  };
})();

/* نافذة الدفع لكل باقة */
window.openPackPay=function(idx){
  if(!me)return toast('سجل دخولك أولاً');
  var p=PACKS[idx];if(!p)return;
  var total=p.coins+p.bonus;
  var old=el('buyCoinsModal');if(old)old.remove();
  var m=document.createElement('div');m.id='buyCoinsModal';m.className='modal';
  m.innerHTML='<div class="m-card2" style="width:330px;max-height:88vh;overflow-y:auto">'
  +'<h3 style="color:#FFD700">🪙 شراء '+total+' عملة</h3>'
  +'<div style="background:var(--bg);border-radius:12px;padding:10px;text-align:center;margin-bottom:8px">'
  +'<div style="font-size:13px;color:var(--mut)">'+p.coins+' عملة'+(p.bonus>0?' <b style="color:var(--grn)">+ '+p.bonus+' هدية 🎁</b>':'')+'</div>'
  +'<div style="font-size:26px;font-weight:900;color:var(--txt);margin-top:4px">'+p.price+' جنيه</div></div>'
  +'<p style="font-size:13px;text-align:center;color:var(--txt)">حوّل <b style="color:#FFD700">'+p.price+' جنيه</b> على فودافون كاش:</p>'
  +'<div onclick="copyVoda()" style="background:var(--bg);border:2px dashed #FFD700;border-radius:12px;padding:12px;text-align:center;cursor:pointer">'
  +'<div style="font-size:22px;font-weight:900;color:#FFD700;direction:ltr">01013255816</div>'
  +'<div style="font-size:11px;color:var(--mut);margin-top:4px">📊 اضغط للنسخ 📋</div></div>'
  +'<div style="font-size:12px;color:var(--txt);text-align:center;margin:10px 0 6px">بعد التحويل، ارفع صورة الإيصال:</div>'
  +'<input type="file" id="topupImg" accept="image/*" style="display:none" onchange="previewTopup(event)">'
  +'<label for="topupImg" id="topupImgLabel" style="width:100%;min-height:70px;background:var(--bg);border:2px dashed var(--line);border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:24px;margin-bottom:6px">📷 ارفع صورة التحويل</label>'
  +'<textarea id="topupNote" placeholder="ملاحظة (اختياري): رقم عملية التحويل..." style="width:100%;background:var(--bg);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px;font-size:12px;min-height:40px;resize:none;margin-bottom:6px"></textarea>'
  +'<button style="background:var(--grn);color:#fff" onclick="submitTopupPack('+idx+')">✅ إرسال الطلب للإدارة</button>'
  +'<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'buyCoinsModal\')">إغلاق</button></div>';
  m.onclick=function(e){if(e.target===m)closeModal('buyCoinsModal');};
  document.body.appendChild(m);
  m.classList.add('open');
};

/* إرسال الطلب مع بيانات الباقة */
window.submitTopupPack=async function(idx){
  var p=PACKS[idx];if(!p||!me)return;
  if(!window._topupImg)return toast('📷 ارفع صورة التحويل الأول');
  var note=(el('topupNote')?el('topupNote').value.trim():'');
  toast('⏳ جاري إرسال الطلب...');
  var url=await uploadMedia(window._topupImg,'.jpg');
  if(!url)return toast('فشل رفع الصورة، حاول تاني');
  var total=p.coins+p.bonus;
  var r=await sb.from('topup_requests').insert({
    user:me.name,amount:total,price:p.price,img:url,
    note:(note?note+' | باقة '+p.coins+'+'+p.bonus:'باقة '+p.coins+'+'+p.bonus),
    status:'pending',time:Date.now()
  });
  if(r&&r.error)return toast('❌ خطأ: '+r.error.message);
  window._topupImg=null;
  closeModal('buyCoinsModal');
  toast('✅ وصل طلبك للإدارة — تستلم '+total+' عملة بعد التأكيد');
  try{renderWallet();}catch(e){}
};
})();
/* ===== قايمة الأثرياء v2: شاشة في الإعدادات بدل شاشة أونلاين ===== */
(function(){
if(window._richScreen)return;window._richScreen=true;

/* 1) نشيل كارت الأثرياء من شاشة أونلاين (نسخة القديمة) */
var _roO3=window.renderOnline;
window.renderOnline=function(){
  var r=_roO3();
  try{
    var old=el('richListBox');
    if(old)old.remove();
  }catch(e){}
  return r;
};

/* 2) عنصر "أثرياء الموقع" في قايمة الإعدادات */
try{
  var lists=document.querySelectorAll('#s-settings .menu-list');
  var tgt=lists[0];
  if(tgt&&!el('richMenuItem')){
    var mi=document.createElement('div');
    mi.className='m-item';mi.id='richMenuItem';
    mi.innerHTML='<span>👑 أثرياء الموقع</span><span>👈</span>';
    mi.onclick=function(){go('richlist',null);};
    tgt.insertBefore(mi,tgt.firstChild);
  }
}catch(e){}

/* 3) الشاشة */
if(!el('s-richlist')){
  var scr=document.createElement('div');
  scr.className='screen';scr.id='s-richlist';
  scr.innerHTML='<div class="sub-title" onclick="go(\'settings\')">➔ أثرياء الموقع</div><div id="richBody" style="padding:4px"></div>';
  var content=document.querySelector('.content');
  var ref=el('s-settings');
  if(ref&&ref.parentElement)content.insertBefore(scr,ref);
  else content.appendChild(scr);
}

/* 4) حساب الترتيب حسب العملات المشحونة (total_spent × 2.5) */
window.getRichCoins=async function(){
  try{
    var arr=[];
    for(var k in usersCache){
      var u=usersCache[k];
      if(u.banned===true||u.is_active===false)continue;
      var coins=Math.floor(((u.total_spent||0)+(u.last_pack_price||0))*2.5);
      if(coins>0)arr.push({name:k,coins:coins,user:u});
    }
    arr.sort(function(a,b){return b.coins-a.coins;});
    return arr.slice(0,3);
  }catch(e){return[];}
};

/* 5) رسم الشاشة */
window.renderRichList=async function(){
  try{
    var box=el('richBody');if(!box)return;
    box.innerHTML='<div style="text-align:center;color:var(--mut);padding:20px">جاري التحميل...</div>';
    var rich=await getRichCoins();
    var h='';
    h+='<div style="background:radial-gradient(ellipse at top,#2a1a4e,#141038);border-radius:18px;padding:22px 14px;text-align:center;margin-bottom:12px;border:1px solid rgba(255,215,0,.25)">';
    h+='<div style="font-size:17px;font-weight:900;color:#FFD700">👑 أثرياء الموقع</div>';
    h+='<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:5px">أكثر 3 أعضاء شحناً للعملات — الترتيب يتحدث تلقائياً</div></div>';
    if(!rich.length){
      h+='<div class="empty"><div class="big">👑</div>لا يوجد أثرياء بعد<br>أول من يشحن عملات يصبح الأغنى! 🪙</div>';
    }else{
      rich.forEach(function(x,i){
        var medals=['🥇','🥈','🥉'];
        var titles=['الأول — ملك العملات','الثاني','الثالث'];
        var colors=['#FFD700','#C0C0C0','#CD7F32'];
        var ava=getAvatarHTML(x.user,56);
        h+='<div onclick="openUser(\''+String(x.name).replace(/'/g,"\\'")+'\')" style="background:var(--card);border:2px solid '+colors[i]+';border-radius:16px;padding:16px;margin-bottom:12px;display:flex;align-items:center;gap:12px;cursor:pointer'+(i===0?';box-shadow:0 0 18px rgba(255,215,0,.3)':'')+'">';
        h+='<span style="font-size:30px">'+medals[i]+'</span>';
        h+=ava;
        h+='<div style="flex:1;min-width:0">';
        h+='<div style="font-size:15px;font-weight:bold">'+styleName(x.user)+'</div>';
        h+='<div style="font-size:11px;font-weight:bold;color:'+colors[i]+';margin-top:3px">المركز '+titles[i]+'</div>';
        h+='<div style="font-size:10px;color:var(--mut);margin-top:2px">'+role(x.user)+'</div>';
        h+='</div>';
        h+='<div style="text-align:center;flex-shrink:0"><div style="font-size:20px;font-weight:900;color:#FFD700">🪙 '+x.coins+'</div><div style="font-size:9px;color:var(--mut)">شحنها</div></div>';
        h+='</div>';
      });
    }
    h+='<div style="background:var(--card2);border-radius:12px;padding:12px;font-size:11px;color:var(--mut);line-height:2;margin-top:6px;text-align:center">📌 الترتيب حسب إجمالي العملات المشحونة — مش الرصيد الحالي<br>اشحن أكتر واصعد في القايمة قدام الكل! 🚀</div>';
    box.innerHTML=h;
  }catch(e){}
};

/* 6) الربط بالتنقل + تحديث دوري */
var _goR=window.go;
window.go=function(s,nv,fb){
  var r=_goR(s,nv,fb);
  try{if(s==='richlist')renderRichList();}catch(e){}
  return r;
};
setInterval(function(){
  try{
    if(me&&el('s-richlist')&&el('s-richlist').classList.contains('active'))renderRichList();
  }catch(e){}
},15000);
})();
/* ===== إصلاح: إشعار شحن لحظي + أثرياء تحسب إضافة العملات اليدوية ===== */
(function(){
if(window._fixNotifRich)return;window._fixNotifRich=true;

/* 1) إشعار لحظي: Realtime على الجدول + فحص كل 5 ثواني احتياطي */
window._richLastCoins=0;
setInterval(async function(){
  try{
    if(!me)return;
    var u=await SDB.getUser(me.name);
    if(!u)return;
    var cur=(u.coins)||0;
    if(cur>window._richLastCoins+40&&window._richLastCoins>0){
      var diff=cur-window._richLastCoins;
      var old=el('coinNoticeModal');if(old)old.remove();
      var m=document.createElement('div');m.id='coinNoticeModal';m.className='modal';
      m.innerHTML='<div class="m-card2" style="width:320px"><h3 style="color:#FFD700">🪙 إشعار العملات</h3>'
      +'<div style="background:var(--bg);border:1px solid #FFD700;border-radius:10px;padding:14px;margin-bottom:8px;text-align:center;color:#FFD700;font-weight:bold;font-size:15px">🎉 تم شحن '+diff+' عملة لحسابك بنجاح!</div>'
      +'<div style="font-size:12px;color:var(--mut);text-align:center;margin-bottom:8px">رصيدك الحالي: 🪙 '+cur+'</div>'
      +'<button style="background:#FFD700;color:#111" onclick="closeModal(\'coinNoticeModal\')">حسناً</button></div>';
      m.onclick=function(e){if(e.target===m)closeModal('coinNoticeModal');};
      document.body.appendChild(m);
      m.classList.add('open');
      if(me.sndNotif!==false)try{beep(1000);}catch(e){}
    }
    window._richLastCoins=cur;
    if(me&&usersCache[me.name])usersCache[me.name].coins=cur;
  }catch(e){}
},5000);
/* تهيئة أول قراءة بعد الدخول بدون إشعار */
try{
  var _entR=window.enter;
  window.enter=async function(u){
    var r=await _entR(u);
    try{window._richLastCoins=(u&&u.coins)||0;}catch(e){}
    return r;
  };
}catch(e){}

/* 2) عداد الإنفاق: يشمل إضافة العملات اليدوية كمان (كل 50 عملة = 20 ج) */
var _wiredAdd=false;
setInterval(function(){
  try{
    if(_wiredAdd)return;
    var addBtn=el('addCoinsBtn');
    if(!addBtn)return;
    _wiredAdd=true;
    var _oldOc=addBtn.onclick;
    addBtn.onclick=async function(){
      var target=umTarget;
      var u0=target?await SDB.getUser(target):null;
      var beforeCoins=(u0&&u0.coins)||0;
      var beforeSpent=(u0&&u0.total_spent)||0;
      var res=_oldOc?_oldOc():undefined;
      setTimeout(async function(){
        try{
          var u1=await SDB.getUser(target);
          var added=((u1&&u1.coins)||0)-beforeCoins;
          if(added>0){
            var spent=beforeSpent+Math.ceil(added/2.5);
            await SDB.patchUser(target,{total_spent:spent});
            if(me&&target===me.name)me.total_spent=spent;
            try{renderRichList();}catch(e){}
          }
        }catch(e){}
      },2500);
      return res;
    };
  }catch(e){}
},2000);

/* 3) الزرار يشتغل حتى لو العضو غير ظاهر في القايمة: بحث بالاسم */
try{
  var memPanel=el('ap-members');
  if(memPanel&&!el('addCoinsBySearch')){
    var row=document.createElement('div');
    row.className='adm-row';row.id='addCoinsBySearch';
    row.style.marginTop='8px';
    row.innerHTML='<input id="addCoinsName" placeholder="اسم العضو لإضافة عملات (حتى لو أوفلاين)" style="flex:1"><button class="adm-btn" style="background:#FFD700;color:#111" onclick="addCoinsToName()">🪙 إضافة</button>';
    var searchRow=memPanel.querySelector('.adm-row');
    if(searchRow)searchRow.parentElement.insertBefore(row,searchRow.nextSibling);
  }
}catch(e){}
window.addCoinsToName=async function(){
  if(!isAdmin())return toast('ممنوع');
  var n=el('addCoinsName').value.trim();
  if(!n)return toast('اكتب اسم العضو');
  var u=await SDB.getUser(n);
  if(!u)return toast('العضو غير موجود: '+n);
  var amt=prompt('عملات '+n+' الحالية: '+((u.coins)||0)+'\nاكتب العدد المضاف:','500');
  if(!amt)return;
  amt=parseInt(amt);
  if(isNaN(amt)||amt<=0)return toast('اكتب رقم صحيح');
  var spent=((u.total_spent)||0)+Math.ceil(amt/2.5);
  await SDB.patchUser(n,{coins:((u.coins)||0)+amt,total_spent:spent});
  toast('🪙 أضفت '+amt+' عملة لـ '+n+' (حُسب '+spent+' ج في الأثرياء)');
  try{logActivity('coins','إضافة '+amt+' عملة لـ '+n);}catch(e){}
};

/* 4) الأثرياء: تحديث أسرع + إصلاح الحساب */
var _gRc=window.getRichCoins;
window.getRichCoins=async function(){
  try{
    var arr=[];
    for(var k in usersCache){
      var u=usersCache[k];
      if(u.banned===true||u.is_active===false)continue;
      var coins=Math.floor(((u.total_spent||0))*2.5);
      if(coins>0)arr.push({name:k,coins:coins,user:u});
    }
    arr.sort(function(a,b){return b.coins-a.coins;});
    return arr.slice(0,3);
  }catch(e){return[];}
};

/* 5) تحديث بيانات الأثرياء من السيرفر قبل الرسم (عشان متعتمدش على الكاش القديم) */
var _rRl=window.renderRichList;
window.renderRichList=async function(){
  try{
    if(me){
      var u=await SDB.getUser(me.name);
      if(u){u.name=me.name;if(usersCache[me.name]){var old=usersCache[me.name];for(var k in old){if(u[k]===undefined)u[k]=old[k];}}usersCache[me.name]=u;me=Object.assign(me,u);}
    }
  }catch(e){}
  return _rRl?_rRl():undefined;
};
})();
/* ===== الحل النهائي: بادج طلبات الشحن + أثرياء من السيرفر مباشرة ===== */
(function(){
if(window._finalRich)return;window._finalRich=true;

/* 1) بادج أحمر بعداد الطلبات المعلقة على "لوحة تحكم الموقع" */
function ensureAdminBadge(){
  try{
    var scr=el('s-settings');if(!scr)return;
    var items=scr.querySelectorAll('.m-item');
    var target=null;
    for(var i=0;i<items.length;i++){
      if((items[i].getAttribute('onclick')||'').indexOf('openAdmin')>-1){target=items[i];break;}
    }
    if(!target)return;
    var b=el('adminReqBadge');
    if(!b){
      b=document.createElement('b');
      b.id='adminReqBadge';
      b.style.cssText='display:none;min-width:18px;height:18px;background:#e64553;color:#fff;border-radius:10px;font-size:10px;font-weight:bold;align-items:center;justify-content:center;padding:0 5px;margin-right:6px;vertical-align:middle';
      var sp=target.querySelector('span');
      if(sp)sp.appendChild(b);
    }
  }catch(e){}
}

window.updateTopupBadge=async function(){
  try{
    if(!me||!isAdmin())return;
    var d=await sb.from('topup_requests').select('id').eq('status','pending');
    var n=(d.data||[]).length;
    var b=el('adminReqBadge');
    if(b){if(n>0){b.style.display='inline-flex';b.innerText=n;}else b.style.display='none';}
    var t=el('topupDot');
    if(t){if(n>0){t.style.display='inline-block';t.innerText=n;}else t.style.display='none';}
  }catch(e){}
};

/* 2) الأثرياء: قراءة مباشرة من جدول users في السيرفر (مش الكاش) */
window.getRichCoins=async function(){
  try{
    var d=await sb.from('users').select('name,data');
    var arr=[];
    (d.data||[]).forEach(function(r){
      var u=r.data||{};u.name=r.name;
      if(u.banned===true||u.is_active===false)return;
      var coins=Math.floor(((u.total_spent)||0)*2.5);
      if(coins>0)arr.push({name:r.name,coins:coins,user:u});
    });
    arr.sort(function(a,b){return b.coins-a.coins;});
    return arr.slice(0,3);
  }catch(e){return[];}
};

/* 3) الشحن الموافق عليه يسجل الإنفاق دايماً */
var _apF=window.approveTopup;
window.approveTopup=async function(id,amount,user){
  try{
    var d=await sb.from('topup_requests').select('price').eq('id',id).limit(1);
    var price=(d.data&&d.data[0]&&d.data[0].price)||0;
    var u=await SDB.getUser(user);
    if(u)await SDB.patchUser(user,{total_spent:((u.total_spent)||0)+price});
  }catch(e){}
  return _apF?_apF(id,amount,user):undefined;
};

/* 4) زرار إعادة حساب: يجمع كل الشحنات المكتملة من التاريخ ويصلح العدادات */
window.rebuildSpent=async function(){
  if(!isOwner())return toast('لصاحب الموقع فقط');
  toast('⏳ جاري إعادة الحساب...');
  var d=await sb.from('topup_requests').select('user,price').eq('status','done');
  var totals={};
  (d.data||[]).forEach(function(r){if(r.user)totals[r.user]=(totals[r.user]||0)+((r.price)||0);});
  var count=0;
  for(var n in totals){
    try{await SDB.patchUser(n,{total_spent:totals[n]});count++;}catch(e){}
  }
  toast('✅ تم إعادة حساب '+count+' عضو من سجل الشحنات');
  renderRichList();
};

/* 5) شاشة الأثرياء المضمونة + زرار الإعادة للمالك */
window.renderRichList=async function(){
  try{
    var box=el('richBody');if(!box)return;
    box.innerHTML='<div style="text-align:center;color:var(--mut);padding:20px">جاري التحميل...</div>';
    var rich=await getRichCoins();
    var h='';
    h+='<div style="background:radial-gradient(ellipse at top,#2a1a4e,#141038);border-radius:18px;padding:22px 14px;text-align:center;margin-bottom:12px;border:1px solid rgba(255,215,0,.25)">';
    h+='<div style="font-size:17px;font-weight:900;color:#FFD700">👑 أثرياء الموقع</div>';
    h+='<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:5px">أكثر 3 أعضاء شحناً للعملات — الترتيب يتحدث تلقائياً</div>';
    if(isOwner())h+='<button class="adm-btn" style="margin-top:10px;background:#8b5cf6" onclick="rebuildSpent()">🔄 إعادة حساب من سجل الشحنات</button>';
    h+='</div>';
    if(!rich.length){
      h+='<div class="empty"><div class="big">👑</div>لا يوجد أثرياء بعد<br>أول من يشحن عملات يصبح الأغنى! 🪙</div>';
      if(isOwner())h+='<div style="text-align:center;font-size:11px;color:var(--mut);padding:0 20px">💡 لو حصلت شحنات قبل تركيب النظام، اضغط "إعادة حساب" فوق</div>';
    }else{
      rich.forEach(function(x,i){
        var medals=['🥇','🥈','🥉'];
        var titles=['الأول — ملك العملات','الثاني','الثالث'];
        var colors=['#FFD700','#C0C0C0','#CD7F32'];
        h+='<div onclick="openUser(\''+String(x.name).replace(/'/g,"\\'")+'\')" style="background:var(--card);border:2px solid '+colors[i]+';border-radius:16px;padding:16px;margin-bottom:12px;display:flex;align-items:center;gap:12px;cursor:pointer'+(i===0?';box-shadow:0 0 18px rgba(255,215,0,.3)':'')+'">';
        h+='<span style="font-size:30px">'+medals[i]+'</span>';
        h+=getAvatarHTML(x.user,56);
        h+='<div style="flex:1;min-width:0">';
        h+='<div style="font-size:15px;font-weight:bold">'+styleName(x.user)+'</div>';
        h+='<div style="font-size:11px;font-weight:bold;color:'+colors[i]+';margin-top:3px">'+titles[i]+'</div>';
        h+='</div>';
        h+='<div style="text-align:center;flex-shrink:0"><div style="font-size:20px;font-weight:900;color:#FFD700">🪙 '+x.coins+'</div><div style="font-size:9px;color:var(--mut)">شحنها</div></div>';
        h+='</div>';
      });
    }
    h+='<div style="background:var(--card2);border-radius:12px;padding:12px;font-size:11px;color:var(--mut);line-height:2;margin-top:6px;text-align:center">📌 الترتيب حسب إجمالي العملات المشحونة — مش الرصيد الحالي<br>اشحن أكتر واصعد في القايمة قدام الكل! 🚀</div>';
    box.innerHTML=h;
  }catch(e){}
};

/* 6) تشغيل دوري للبادج */
setInterval(function(){try{ensureAdminBadge();updateTopupBadge();}catch(e){}},8000);
var _saF9=window.startAll;
window.startAll=async function(){
  var r=await _saF9();
  try{ensureAdminBadge();updateTopupBadge();}catch(e){}
  return r;
};
})();
/* ===== إزالة قايمة الأثرياء نهائياً ===== */
(function(){
try{var mi=el('richMenuItem');if(mi)mi.remove();}catch(e){}
try{var scr=el('s-richlist');if(scr)scr.remove();}catch(e){}
try{var box=el('richBody');if(box)box.remove();}catch(e){}
try{var lb=el('richListBox');if(lb)lb.remove();}catch(e){}
try{if(window.renderRichList)window.renderRichList=function(){};}catch(e){}
try{if(window.getRichCoins)window.getRichCoins=async function(){return[];};}catch(e){}
})();
/* ===== تفعيل تميّز الاسم بالعملات: 130 عملة = 30 يوم ===== */
(function(){
if(window._nameCoinsFinal)return;window._nameCoinsFinal=true;
var NAME_COST=130,NAME_DAYS=30;

window.applyNameStyle=function(i){
  var s=window._NAME_STYLES[i];if(!s||!me)return;
  var coins=(me.coins)||0;
  var admin=isOwnerName(me.name)||isAdmin();

  /* الإدارة: تفعيل بدون خصم */
  if(admin){
    if(!confirm('تفعيل «'+s.name+'» (إدارة — بدون خصم)؟'))return;
    updateMe({nameGradient:s.grad,nameDecorPre:s.pre||'',nameDecorPost:s.post||'',nameGlow:s.glow,nameStyleExp:Date.now()+NAME_DAYS*86400000,nameStyleName:s.name}).then(function(){
      toast('✨ تم التفعيل (إدارة — بدون خصم)');
      updateProfile();renderOnline();renderMsgs();renderNameStyle();
    });
    return;
  }

  /* العضو العادي: لازم يختار طريق واحد من الاختيارات */
  var old=el('styleChoiceModal');if(old)old.remove();
  var m=document.createElement('div');m.id='styleChoiceModal';m.className='modal';
  var nh='<span style="filter:drop-shadow(0 0 6px '+s.glow+')">'+(s.pre||'')+'<span style="background:'+s.grad+';-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:bold">'+escapeHtml(me.displayName||me.name)+'</span>'+(s.post||'')+'</span>';
  m.innerHTML='<div class="m-card2" style="width:330px"><h3>👑 تميّز باسمك</h3>'
  +'<div style="text-align:center;font-size:17px;min-height:30px">'+nh+'</div>'
  +'<div style="font-size:12px;color:var(--mut);text-align:center;margin-bottom:8px">نمط «'+s.name+'» — رصيدك: 🪙 '+coins+'</div>'
  +'<div id="scBtns" style="display:flex;flex-direction:column;gap:8px"></div>'
  +'<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'styleChoiceModal\')">إغلاق</button></div>';
  m.onclick=function(e){if(e.target===m)closeModal('styleChoiceModal');};
  document.body.appendChild(m);
  m.classList.add('open');

  /* زرار الدفع بالعملات — الشكل الوحيد المضمون */
  var act=function(){
    if((me.coins||0)<NAME_COST){
      toast('🪙 محتاج '+NAME_COST+' عملة — عندك '+((me.coins)||0)+' | اشحن من "عملاتي"');
      return;
    }
    if(!confirm('تفعيل «'+s.name+'» لمدة '+NAME_DAYS+' يوم بـ '+NAME_COST+' عملة؟\nسيتم خصم '+NAME_COST+' عملة من رصيدك'))return;
    updateMe({coins:(me.coins||0)-NAME_COST,nameGradient:s.grad,nameDecorPre:s.pre||'',nameDecorPost:s.post||'',nameGlow:s.glow,nameStyleExp:Date.now()+NAME_DAYS*86400000,nameStyleName:s.name}).then(function(){
      closeModal('styleChoiceModal');
      toast('✨ تم التفعيل حتى '+new Date(Date.now()+NAME_DAYS*86400000).toLocaleDateString('ar-EG'));
      updateProfile();renderOnline();renderMsgs();renderNameStyle();
    });
  };

  /* التجربة المجانية: بس لو مربوط جوجل ولسه مش استهلك فرصته */
  var canFree=false;
  try{canFree=(me.google_id&&!me.free_trial_used);}catch(e){}

  var btns=el('scBtns');if(!btns)return;
  var h='';
  h+='<button style="background:linear-gradient(90deg,#FFE55C,#FF9800);color:#111;font-weight:900" onclick="window._actNameStyle()">🪙 فعّل بـ '+NAME_COST+' عملة — '+NAME_DAYS+' يوم</button>';
  if(canFree)h+='<button style="background:var(--grn);color:#fff" onclick="window._useGoogleTrial('+i+')">🎁 جرّبه مجاناً 48 ساعة (فرصتك الوحيدة)</button>';
  else if(!me.google_id)h+='<div style="font-size:11px;color:var(--mut);text-align:center;background:var(--card2);border-radius:8px;padding:6px">🎁 للتجربة المجانية 48 ساعة: اربط حساب جوجل الأول من زرار "ربط" فوق</div>';
  else h+='<div style="font-size:11px;color:var(--mut);text-align:center;background:var(--card2);border-radius:8px;padding:6px">❌ استهلكت فرصتك المجانية على حساب جوجل ده</div>';
  btns.innerHTML=h;

  window._actNameStyle=act;
  window._useGoogleTrial=function(idx2){
    var st=window._NAME_STYLES[idx2];if(!st)return;
    if(!confirm('تفعيل «'+st.name+'» مجاناً لمدة 48 ساعة؟\n⚠️ دي فرصتك الوحيدة على حساب جوجل ده!'))return;
    var exp=Date.now()+48*3600000;
    updateMe({nameGradient:st.grad,nameDecorPre:st.pre||'',nameDecorPost:st.post||'',nameGlow:st.glow,nameStyleExp:exp,nameStyleName:st.name,free_trial_used:true}).then(function(){
      try{sb.from('google_trials').insert({google_id:me.google_id,site_user:me.name,time:Date.now()});}catch(e){}
      closeModal('styleChoiceModal');
      toast('🎁 تجربة مجانية 48 ساعة!');
      updateProfile();renderOnline();renderMsgs();renderNameStyle();
    });
  };
};
})();
/* ===== تحسين تميّز الاسم: تأكيد مرتب + إعلان السعر للكل ===== */
(function(){
if(window._nameUiFix)return;window._nameUiFix=true;
var NAME_COST=130,NAME_DAYS=30;

/* نافذة تأكيد خاصة: تفعيل وإلغاء جنب بعض */
window._nameConfirm=function(onOk){
  var old=el('nameConfirmModal');if(old)old.remove();
  var m=document.createElement('div');m.id='nameConfirmModal';m.className='modal';
  m.innerHTML='<div class="m-card2" style="width:320px">'
  +'<h3>👑 تفعيل تميّز الاسم</h3>'
  +'<p style="font-size:13px;text-align:center;color:var(--txt);line-height:1.9">التفعيل بـ <b style="color:#FFD700">'+NAME_COST+' عملة</b> — لكل الأنماط<br>ولمدة '+NAME_DAYS+' يوم كاملة<br><span style="font-size:11px;color:var(--mut)">رصيدك الحالي: 🪙 '+((me&&me.coins)||0)+'</span></p>'
  +'<div style="display:flex;gap:8px">'
  +'<button id="ncOk" style="flex:1;background:var(--grn);color:#fff;margin:0">✅ تفعيل</button>'
  +'<button id="ncNo" style="flex:1;background:var(--card2);color:var(--mut);border:1px solid var(--line)!important;margin:0">إلغاء</button>'
  +'</div></div>';
  m.onclick=function(e){if(e.target===m)closeModal('nameConfirmModal');};
  document.body.appendChild(m);
  m.classList.add('open');
  el('ncOk').onclick=function(){closeModal('nameConfirmModal');onOk();};
  el('ncNo').onclick=function(){closeModal('nameConfirmModal');};
};

/* منطق التفعيل الكامل */
window.applyNameStyle=function(i){
  var s=window._NAME_STYLES[i];if(!s||!me)return;
  var admin=isOwnerName(me.name)||isAdmin();

  var doActivate=function(deduct){
    var patch={nameGradient:s.grad,nameDecorPre:s.pre||'',nameDecorPost:s.post||'',nameGlow:s.glow,nameStyleExp:Date.now()+NAME_DAYS*86400000,nameStyleName:s.name};
    if(deduct)patch.coins=(me.coins||0)-NAME_COST;
    updateMe(patch).then(function(){
      closeModal('styleChoiceModal');
      toast(deduct?('✨ تم التفعيل حتى '+new Date(Date.now()+NAME_DAYS*86400000).toLocaleDateString('ar-EG')):'✨ تم التفعيل (إدارة — بدون خصم)');
      updateProfile();renderOnline();renderMsgs();renderNameStyle();
    });
  };

  /* الإدارة: تأكيد ثم تفعيل بدون خصم */
  if(admin){
    _nameConfirm(function(){doActivate(false);});
    return;
  }

  /* العضو العادي: شاشة الاختيار */
  var old=el('styleChoiceModal');if(old)old.remove();
  var m=document.createElement('div');m.id='styleChoiceModal';m.className='modal';
  var nh='<span style="filter:drop-shadow(0 0 6px '+s.glow+')">'+(s.pre||'')+'<span style="background:'+s.grad+';-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:bold">'+escapeHtml(me.displayName||me.name)+'</span>'+(s.post||'')+'</span>';
  m.innerHTML='<div class="m-card2" style="width:330px"><h3>👑 تميّز باسمك</h3>'
  +'<div style="text-align:center;font-size:17px;min-height:30px">'+nh+'</div>'
  +'<div style="font-size:12px;color:var(--mut);text-align:center;margin-bottom:8px">نمط «'+s.name+'» — رصيدك: 🪙 '+((me.coins)||0)+'</div>'
  +'<div id="scBtns" style="display:flex;flex-direction:column;gap:8px"></div>'
  +'<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'styleChoiceModal\')">إغلاق</button></div>';
  m.onclick=function(e){if(e.target===m)closeModal('styleChoiceModal');};
  document.body.appendChild(m);
  m.classList.add('open');

  var canFree=false;
  try{canFree=(me.google_id&&!me.free_trial_used);}catch(e){}

  var btns=el('scBtns');if(!btns)return;
  var h='';
  if((me.coins||0)>=NAME_COST){
    h+='<button style="background:linear-gradient(90deg,#FFE55C,#FF9800);color:#111;font-weight:900" onclick="closeModal(\'styleChoiceModal\');_nameConfirm(function(){_doPayName('+i+')})">🪙 فعّل بـ '+NAME_COST+' عملة — '+NAME_DAYS+' يوم</button>';
  }else{
    h+='<button style="background:var(--card2);color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'styleChoiceModal\');go(\'wallet\',null)">🪙 رصيدك '+((me.coins)||0)+' — اشحن '+NAME_COST+' عملة</button>';
  }
  if(canFree)h+='<button style="background:var(--grn);color:#fff" onclick="window._useGoogleTrial('+i+')">🎁 جرّبه مجاناً 48 ساعة (فرصتك الوحيدة)</button>';
  else if(!me.google_id)h+='<div style="font-size:11px;color:var(--mut);text-align:center;background:var(--card2);border-radius:8px;padding:6px">🎁 للتجربة المجانية 48 ساعة: اربط حساب جوجل من زرار "ربط" فوق</div>';
  else h+='<div style="font-size:11px;color:var(--mut);text-align:center;background:var(--card2);border-radius:8px;padding:6px">❌ استهلكت فرصتك المجانية على حساب جوجل ده</div>';
  btns.innerHTML=h;

  window._doPayName=function(idx2){
    var st=window._NAME_STYLES[idx2];if(!st)return;
    doActivate(true);
  };
  window._useGoogleTrial=function(idx2){
    var st=window._NAME_STYLES[idx2];if(!st)return;
    if(!confirm('تفعيل «'+st.name+'» مجاناً لمدة 48 ساعة؟\n⚠️ دي فرصتك الوحيدة على حساب جوجل ده!'))return;
    updateMe({nameGradient:st.grad,nameDecorPre:st.pre||'',nameDecorPost:st.post||'',nameGlow:st.glow,nameStyleExp:Date.now()+48*3600000,nameStyleName:st.name,free_trial_used:true}).then(function(){
      try{sb.from('google_trials').insert({google_id:me.google_id,site_user:me.name,time:Date.now()});}catch(e){}
      closeModal('styleChoiceModal');
      toast('🎁 تجربة مجانية 48 ساعة!');
      updateProfile();renderOnline();renderMsgs();renderNameStyle();
    });
  };
};

/* شريط السعر الذهبي فوق زرار "إزالة النمط" */
var _rns=window.renderNameStyle;
window.renderNameStyle=function(){
  var r=_rns?_rns():undefined;
  try{
    var box=el('nameStyleBody');if(!box)return r;
    var old=el('namePriceInfo');if(old)old.remove();
    var btns=box.querySelectorAll('button.lbtn');
    for(var i=0;i<btns.length;i++){
      if((btns[i].innerText||'').indexOf('إزالة النمط')>-1){
        var info=document.createElement('div');
        info.id='namePriceInfo';
        info.style.cssText='background:rgba(255,215,0,.12);border:1px solid #FFD700;border-radius:12px;padding:10px 14px;margin:12px 0 4px;text-align:center;font-size:12.5px;color:#FFD700;font-weight:bold';
        info.innerHTML='💰 التفعيل بـ '+NAME_COST+' عملة — لكل الأنماط • لمدة '+NAME_DAYS+' يوم';
        btns[i].parentElement.insertBefore(info,btns[i]);
        break;
      }
    }
  }catch(e){}
  return r;
};
})();
/* ===== تنبيه: العملات غير كافية عند الضغط على نمط بدون رصيد ===== */
(function(){
if(window._noCoinsMsg)return;window._noCoinsMsg=true;
var NAME_COST=130;

var _ans=window.applyNameStyle;
window.applyNameStyle=function(i){
  try{
    if(me&&!isOwnerName(me.name)&&!isAdmin()&&((me.coins)||0)<NAME_COST){
      var need=NAME_COST-((me.coins)||0);
      toast('🪙 العملات غير كافية — يرجي الشحن (ناقصك '+need+' عملة من "عملاتي")');
      return;
    }
  }catch(e){}
  return _ans?_ans(i):undefined;
};
})();
/* ===== اشتراك شهر كامل: بعد الدفع، تغيير النمط مجاني طول الشهر ===== */
(function(){
if(window._nameSubFix)return;window._nameSubFix=true;
var NAME_COST=130,NAME_DAYS=30;

window._nameActive=function(){
  try{return me&&me.nameStyleExp&&me.nameStyleExp>Date.now();}catch(e){return false;}
};

window.applyNameStyle=function(i){
  var s=window._NAME_STYLES[i];if(!s||!me)return;
  var admin=isOwnerName(me.name)||isAdmin();

  /* ====== مشترك فعلاً (أو إدارة) = تغيير مجاني فوري ====== */
  if(admin||window._nameActive()){
    updateMe({nameGradient:s.grad,nameDecorPre:s.pre||'',nameDecorPost:s.post||'',nameGlow:s.glow,nameStyleName:s.name}).then(function(){
      var left=Math.ceil(((me.nameStyleExp||0)-Date.now())/86400000);
      toast(admin?'✨ تم التطبيق (إدارة)':('✨ تم تغيير النمط — اشتراكك باقي عليه '+left+' يوم'));
      updateProfile();renderOnline();renderMsgs();renderNameStyle();
    });
    return;
  }

  /* ====== غير مشترك = واجهة الاشتراك ====== */
  var old=el('styleChoiceModal');if(old)old.remove();
  var m=document.createElement('div');m.id='styleChoiceModal';m.className='modal';
  var nh='<span style="filter:drop-shadow(0 0 6px '+s.glow+')">'+(s.pre||'')+'<span style="background:'+s.grad+';-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:bold">'+escapeHtml(me.displayName||me.name)+'</span>'+(s.post||'')+'</span>';
  m.innerHTML='<div class="m-card2" style="width:330px"><h3>👑 تميّز باسمك</h3>'
  +'<div style="text-align:center;font-size:17px;min-height:30px">'+nh+'</div>'
  +'<div style="font-size:12px;color:var(--mut);text-align:center;margin-bottom:8px">نمط «'+s.name+'» — رصيدك: 🪙 '+((me.coins)||0)+'</div>'
  +'<div id="scBtns" style="display:flex;flex-direction:column;gap:8px"></div>'
  +'<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'styleChoiceModal\')">إغلاق</button></div>';
  m.onclick=function(e){if(e.target===m)closeModal('styleChoiceModal');};
  document.body.appendChild(m);
  m.classList.add('open');

  var btns=el('scBtns');if(!btns)return;
  var h='';
  if((me.coins||0)>=NAME_COST){
    h+='<button style="background:linear-gradient(90deg,#FFE55C,#FF9800);color:#111;font-weight:900" onclick="closeModal(\'styleChoiceModal\');window._nameConfirm(function(){window._payNameSub('+i+')})">🪙 اشترك بـ '+NAME_COST+' عملة — شهر كامل تغيير بلا حدود</button>';
  }else{
    h+='<button style="background:var(--card2);color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'styleChoiceModal\');go(\'wallet\',null)">🪙 رصيدك '+((me.coins)||0)+' — اشحن '+NAME_COST+' عملة</button>';
  }
  var canFree=false;
  try{canFree=(me.google_id&&!me.free_trial_used);}catch(e){}
  if(canFree)h+='<button style="background:var(--grn);color:#fff" onclick="window._useGoogleTrial('+i+')">🎁 جرّبه مجاناً 48 ساعة (فرصتك الوحيدة)</button>';
  else if(!me.google_id)h+='<div style="font-size:11px;color:var(--mut);text-align:center;background:var(--card2);border-radius:8px;padding:6px">🎁 للتجربة المجانية 48 ساعة: اربط حساب جوجل من زرار "ربط" فوق</div>';
  else h+='<div style="font-size:11px;color:var(--mut);text-align:center;background:var(--card2);border-radius:8px;padding:6px">❌ استهلكت فرصتك المجانية على حساب جوجل ده</div>';
  btns.innerHTML=h;

  window._payNameSub=function(idx2){
    var st=window._NAME_STYLES[idx2];if(!st)return;
    updateMe({coins:(me.coins||0)-NAME_COST,nameGradient:st.grad,nameDecorPre:st.pre||'',nameDecorPost:st.post||'',nameGlow:st.glow,nameStyleExp:Date.now()+NAME_DAYS*86400000,nameStyleName:st.name}).then(function(){
      toast('🎉 اشتراكك مفعل! شهر كامل تغيّر فيه النمط زي ما تحب');
      updateProfile();renderOnline();renderMsgs();renderNameStyle();
    });
  };
  window._useGoogleTrial=function(idx2){
    var st=window._NAME_STYLES[idx2];if(!st)return;
    if(!confirm('تفعيل «'+st.name+'» مجاناً لمدة 48 ساعة؟\n⚠️ دي فرصتك الوحيدة على حساب جوجل ده!'))return;
    updateMe({nameGradient:st.grad,nameDecorPre:st.pre||'',nameDecorPost:st.post||'',nameGlow:st.glow,nameStyleExp:Date.now()+48*3600000,nameStyleName:st.name,free_trial_used:true}).then(function(){
      try{sb.from('google_trials').insert({google_id:me.google_id,site_user:me.name,time:Date.now()});}catch(e){}
      closeModal('styleChoiceModal');
      toast('🎁 تجربة مجانية 48 ساعة!');
      updateProfile();renderOnline();renderMsgs();renderNameStyle();
    });
  };
};

/* نافذة التأكيد دي بقت للاشتراك الأول بس */
var _ncOld=window._nameConfirm;
window._nameConfirm=function(onOk){
  var old=el('nameConfirmModal');if(old)old.remove();
  var m=document.createElement('div');m.id='nameConfirmModal';m.className='modal';
  m.innerHTML='<div class="m-card2" style="width:320px">'
  +'<h3>👑 اشتراك تميّز الاسم</h3>'
  +'<p style="font-size:13px;text-align:center;color:var(--txt);line-height:1.9">الاشتراك بـ <b style="color:#FFD700">'+NAME_COST+' عملة</b> — شهر كامل<br>وخلال الشهر غيّر النمط <b>بلا حدود</b> زي ما تحب ✨<br><span style="font-size:11px;color:var(--mut)">رصيدك الحالي: 🪙 '+((me&&me.coins)||0)+'</span></p>'
  +'<div style="display:flex;gap:8px">'
  +'<button id="ncOk" style="flex:1;background:var(--grn);color:#fff;margin:0">✅ اشترك</button>'
  +'<button id="ncNo" style="flex:1;background:var(--card2);color:var(--mut);border:1px solid var(--line)!important;margin:0">إلغاء</button>'
  +'</div></div>';
  m.onclick=function(e){if(e.target===m)closeModal('nameConfirmModal');};
  document.body.appendChild(m);
  m.classList.add('open');
  el('ncOk').onclick=function(){closeModal('nameConfirmModal');onOk();};
  el('ncNo').onclick=function(){closeModal('nameConfirmModal');};
};

/* شريط السعر الذهبي: نصه بيتغير حسب حالة الاشتراك */
var _rns2=window.renderNameStyle;
window.renderNameStyle=function(){
  var r=_rns2?_rns2():undefined;
  try{
    var box=el('nameStyleBody');if(!box)return r;
    var old=el('namePriceInfo');if(old)old.remove();
    var btns=box.querySelectorAll('button.lbtn');
    for(var i=0;i<btns.length;i++){
      if((btns[i].innerText||'').indexOf('إزالة النمط')>-1){
        var info=document.createElement('div');
        info.id='namePriceInfo';
        if(window._nameActive()){
          var days=Math.ceil(((me.nameStyleExp||0)-Date.now())/86400000);
          info.style.cssText='background:rgba(34,197,94,.12);border:1px solid var(--grn);border-radius:12px;padding:10px 14px;margin:12px 0 4px;text-align:center;font-size:12.5px;color:var(--grn);font-weight:bold';
          info.innerHTML='✅ اشتراكك نشط — باقي '+days+' يوم • غيّر النمط بلا حدود زي ما تحب';
        }else{
          info.style.cssText='background:rgba(255,215,0,.12);border:1px solid #FFD700;border-radius:12px;padding:10px 14px;margin:12px 0 4px;text-align:center;font-size:12.5px;color:#FFD700;font-weight:bold';
          info.innerHTML='💰 الاشتراك بـ '+NAME_COST+' عملة — شهر كامل تغيير بلا حدود لكل الأنماط';
        }
        btns[i].parentElement.insertBefore(info,btns[i]);
        break;
      }
    }
  }catch(e){}
  return r;
};
})();
/* ===== إصلاح الألوان: شارة النمط وشريط الاشتراك سماوي واضح ===== */
(function(){
if(window._colorFix)return;window._colorFix=true;
var CY='#22d3ee',CY_BG='rgba(34,211,238,.14)';

var _rns3=window.renderNameStyle;
window.renderNameStyle=function(){
  var r=_rns3?_rns3():undefined;
  try{
    var box=el('nameStyleBody');if(!box)return r;

    /* 1) شارة "مُفعّل" جوه الكارت: خضراء → سماوية */
    setTimeout(function(){
      try{
        var b2=box.querySelectorAll('div');
        for(var i=0;i<b2.length;i++){
          var t=(b2[i].innerText||'');
          if(t.trim()==='✅ مُفعّل'&&b2[i].style&&b2[i].style.color==='var(--grn)'){
            b2[i].style.color=CY;
            b2[i].style.background=CY_BG;
            b2[i].style.borderRadius='8px';
            b2[i].style.padding='3px 8px';
            b2[i].style.display='inline-block';
          }
        }
      }catch(e){}
    },50);

    /* 2) شريط الاشتراك النشط تحت: أخضر → سماوي */
    var info=el('namePriceInfo');
    if(info&&(info.innerText||'').indexOf('اشتراكك نشط')>-1){
      info.style.cssText='background:'+CY_BG+';border:1px solid '+CY+';border-radius:12px;padding:10px 14px;margin:12px 0 4px;text-align:center;font-size:12.5px;color:'+CY+';font-weight:bold';
    }
  }catch(e){}
  return r;
};
})();
/* ===== الأيقونات للعرض فقط: الاسم الفعلي ياخد اللون والتوهج بس ===== */
(function(){
if(window._colorOnlyFix)return;window._colorOnlyFix=true;

window.styleName=function(u){
  var name=escapeHtml(getDisplayName(u));
  if(u&&u.nameGradient){
    var g=(u.nameGlow)?('filter:drop-shadow(0 0 3px '+u.nameGlow+') drop-shadow(0 0 11px '+u.nameGlow+');'):'';
    return '<span style="'+g+'"><span style="background:'+u.nameGradient+';-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:bold">'+name+'</span></span>';
  }
  if(u&&u.nameColor)return '<span style="color:'+u.nameColor+';font-weight:bold">'+name+'</span>';
  return name;
};

/* معاينة الكارت الأعلى (هكذا يليق اسمك) برضه بدون أيقونات — لأنه بيعرض شكلك الحقيقي */
})();
/* ===== تحديثات تلقائية: كل ميزة جديدة تسجل نفسها + تحكم الإدارة ===== */
(function(){
if(window._autoUpdates)return;window._autoUpdates=true;

/* دالة التسجيل التلقائي: أي باتش يناديها ويظهر في آخر التحديثات */
window.autoUpdate=async function(title,body){
  try{
    if(!me||!isOwner())return;
    var all=(await SDB.loadSettings()).updates;
    all=Array.isArray(all)?all:[];
    var key='au:'+title;
    var exists=all.some(function(u){return (u.title||'')===title;});
    if(exists)return;
    all.push({id:'u'+Date.now()+Math.floor(Math.random()*999),title:title,body:body,date:Date.now(),pub:true,auto:true});
    await SDB.saveSetting('updates',all);
    try{updateUpdatesBadge();}catch(e){}
  }catch(e){}
};

/* 1) تسجيل التحديثات الجاهزة اللي ركبتها — بيتحقق مرة لكل واحد */
setTimeout(async function(){
  try{
    if(!me||!isOwner())return;
    var checks=[
      ['💰 عملاتي وباقات الشحن','إضافة نظام عملات كامل: شحن بفودافون كاش (9 باقات بمكافآت متدرجة)، رفع صورة التحويل من داخل الموقع، وإشعار فوري عند استلام العملات.'],
      ['🛒 متجر سونيك','افتتاح متجر المميزات: إطار الصورة وتميّز الاسم — بالشراء بالعملات من "عملاتي".'],
      ['👑 تميّز باسمك — اشتراك شهري','اشترك بـ 130 عملة وشهر كامل تغيّر فيه نمط اسمك بلا حدود، أو جرّبه مجاناً 48 ساعة بربط حساب جوجل (فرصة واحدة).'],
      ['🖼️ إطار الصورة بالعملات','ميزة الإطار بقت من متجر سونيك: 100 عملة لمدة 30 يوم — تُفعّل وتنتهي تلقائياً.']
    ];
    for(var i=0;i<checks.length;i++)await autoUpdate(checks[i][0],checks[i][1]);
  }catch(e){}
},4000);

/* 2) تصفير البادج لما الإدارة تفتح صفحة التحديثات زي الأعضاء */
var _oru=window.renderUpdatesPage;
window.renderUpdatesPage=async function(){
  try{LS.setItem('updates_seen',String(Date.now()));}catch(e){}
  setTimeout(function(){try{updateUpdatesBadge();}catch(e){}},200);
  return _oru?await _oru():undefined;
};

/* 3) تجميل زرار "إضافة تحديث جديد": شكل موحد أنضف */
var _rup=window.renderUpdatesPage;
window.renderUpdatesPage=async function(){
  var r=await _rup();
  try{
    var box=el('updatesBody');
    if(!box)return r;
    var btn=box.querySelector('button.lbtn');
    if(btn){
      btn.style.cssText='width:100%;margin-bottom:12px;padding:13px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:bold;cursor:pointer';
      btn.innerText='✏️ إضافة تحديث جديد (للإدارة)';
    }
  }catch(e){}
  return r;
};
})();
/* ===== تنبيه الاسم داخل قايمة الإعدادات + آخر التحديثات في الأعلى ===== */
(function(){
if(window._settingsFix)return;window._settingsFix=true;

/* 1) شيل الشريط الأصفر اللي فوق خالص */
try{var b=el('nameWarnBarAll');if(b)b.remove();}catch(e){}
try{var b2=el('nameWarnBar');if(b2)b2.remove();}catch(e){}

/* 2) عنصر "اسمك ظاهر للجميع" في قايمة الإعدادات بـ "اعرف المزيد" */
try{
  var lists=document.querySelectorAll('#s-settings .menu-list');
  var tgt=lists[0];
  if(tgt&&!el('nameWarnMenuItem')){
    var mi=document.createElement('div');
    mi.className='m-item';mi.id='nameWarnMenuItem';
    mi.style.cssText='background:rgba(60,45,10,.5)';
    mi.innerHTML='<span style="color:#ffd54f;font-size:12.5px;font-weight:bold">⚠️ اسمك ظاهر للجميع — الأسماء المخالفة قد تودي إلي الحظر <a href="javascript:void(0)" onclick="event.stopPropagation();showNameWarnModal()" style="color:#ffd54f;text-decoration:underline">اعرف المزيد</a></span><span>👈</span>';
    tgt.insertBefore(mi,tgt.firstChild);
  }
}catch(e){}

/* 3) "آخر التحديثات" تروح لأعلى القايمة */
setInterval(function(){
  try{
    var scr=el('s-settings');if(!scr)return;
    var upd=el('updatesMenuItem');
    var lists=scr.querySelectorAll('.menu-list');
    if(!upd||!lists.length)return;
    var firstList=lists[0];
    if(firstList.firstChild!==upd){
      firstList.insertBefore(upd,firstList.firstChild);
    }
  }catch(e){}
},2000);

/* 4) الشريط الأصفر القديم ميتعودش يظهر */
try{
  if(window.ensureNameBar)window.ensureNameBar=function(){};
}catch(e){}
})();
/* ===== تنبيه الاسم: أعلى الإعدادات + نافذة مطابقة للمرجع ===== */
(function(){
if(window._warnTopFix)return;window._warnTopFix=true;

/* 1) عنصر التنبيه فوق الكل — حتى فوق آخر التحديثات */
setInterval(function(){
  try{
    var scr=el('s-settings');if(!scr)return;
    var mi=el('nameWarnMenuItem');
    var lists=scr.querySelectorAll('.menu-list');
    if(!lists.length)return;
    if(!mi){
      mi=document.createElement('div');
      mi.className='m-item';mi.id='nameWarnMenuItem';
      mi.style.cssText='background:rgba(60,45,10,.5)';
      mi.innerHTML='<span style="color:#ffd54f;font-size:12.5px;font-weight:bold">⚠️ اسمك ظاهر للجميع — الأسماء المخالفة قد تودي إلي الحظر <a href="javascript:void(0)" onclick="event.stopPropagation();showNameWarnModal()" style="color:#ffd54f;text-decoration:underline">اعرف المزيد</a></span><span>👈</span>';
      lists[0].insertBefore(mi,lists[0].firstChild);
    }
    /* يفضل دايماً أول عنصر في أول قايمة */
    var firstList=lists[0];
    if(firstList.firstChild!==mi)firstList.insertBefore(mi,firstList.firstChild);
  }catch(e){}
},2000);

/* 2) نافذة التحذير — بنفس تصميم الصورة المرجعية بالظبط */
window.showNameWarnModal=function(){
  try{
    var old=el('nameWarnModal');if(old)old.remove();
    var m=document.createElement('div');m.id='nameWarnModal';m.className='modal';
    m.style.zIndex='1200';
    m.innerHTML='<div class="m-card2" style="width:340px;text-align:center;padding:24px 18px">'
    +'<div style="width:62px;height:62px;border-radius:50%;background:rgba(255,193,7,.18);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:30px">⚠️</div>'
    +'<h3 style="color:var(--txt);font-size:17px;font-weight:bold;margin-bottom:10px">تنبيه بخصوص اسم المستخدم</h3>'
    +'<p style="font-size:13.5px;color:var(--txt);line-height:2.1;margin-bottom:16px">اسم المستخدم الخاص بك يظهر لكل من في الدردشة. إذا استخدمت اسمًا سيئًا أو مخالفًا للقوانين، فقد يتم حظرك نهائيًا عند مراجعة الإدارة لحسابك.</p>'
    +'<button style="background:var(--acc);color:#fff;width:70%;margin:0 auto;font-size:14px;padding:12px;border-radius:10px" onclick="closeModal(\'nameWarnModal\')">فهمت</button>'
    +'</div>';
    document.body.appendChild(m);
    m.classList.add('open');
  }catch(e){}
};

/* "فهمت" هنا بياقف النافذة بس — مبيوديش لتغيير الاسم (زي المرجعي) */
window.openNameFix=function(){
  try{closeModal('nameWarnModal');}catch(e){}
  try{go('settings',null);}catch(e){}
  setTimeout(function(){
    try{
      el('nameInputWrap').classList.remove('hide');
      el('saveNameBtn').classList.remove('hide');
      el('nameInput').focus();
    }catch(e){}
  },400);
};
})();
/* ===== صفحة التحديثات بنسخة محسنة: تعديل جنب الحذف ===== */
(function(){
if(window._updPageFinal)return;window._updPageFinal=true;
async function _ld(){try{var s=await SDB.loadSettings();return Array.isArray(s.updates)?s.updates:[];}catch(e){return[];}}
async function _sv(a){await SDB.saveSetting('updates',a);}

window.renderUpdatesPage=async function(){
  try{
    if(!me)return;
    var own=isOwner();
    var box=el('updatesBody');if(!box)return;
    box.innerHTML='<div style="text-align:center;color:var(--mut);padding:20px">جاري التحميل...</div>';
    var all=await _ld();
    all.sort(function(a,b){return (b.date||0)-(a.date||0);});
    var list=all.filter(function(u){return own||u.pub!==false;});
    try{LS.setItem('updates_seen',String(Date.now()));}catch(e){}
    try{updateUpdatesBadge();}catch(e){}
    var h='';
    if(own)h+='<button class="lbtn" onclick="updAddOpen()" style="margin-bottom:12px">➕ إضافة تحديث جديد</button>';
    if(!list.length)h+='<div class="empty"><div class="big">🔔</div>لا توجد تحديثات بعد</div>';
    list.forEach(function(u){
      var ownOnly=(u.pub===false);
      var ds=new Date(Number(u.date||Date.now())).toLocaleDateString('ar-EG',{day:'2-digit',month:'2-digit',year:'numeric'});
      h+='<div style="background:var(--card);border:1px solid '+(ownOnly?'var(--yel)':'var(--line)')+';border-right:4px solid '+(ownOnly?'var(--yel)':'var(--grn)')+';border-radius:12px;padding:14px;margin-bottom:10px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="color:var(--acc);font-size:16px">'+escapeHtml(u.title||'')+'</b><span style="font-size:11px;color:var(--mut);white-space:nowrap">'+ds+'</span></div>'
      +(ownOnly?'<div style="font-size:11px;color:var(--yel);font-weight:bold;margin-top:4px">🔒 خاص بالإدارة فقط</div>':'')
      +'<div style="font-size:14px;line-height:2;color:var(--txt);margin-top:8px;white-space:pre-line">'+escapeHtml(u.body||'')+'</div>';
      if(own){
        h+='<div style="display:flex;gap:8px;margin-top:10px">'
        +'<button class="ebtn" onclick="updEditOpen(\''+u.id+'\')">✏️ تعديل</button>'
        +'<button class="xbtn" onclick="updDel(\''+u.id+'\')">🗑️ حذف</button>'
        +'<button class="ebtn" style="background:#8b5cf6" onclick="updToggle(\''+u.id+'\')">'+(ownOnly?'🌍 إظهار للجميع':'🔒 إخفاء')+'</button>'
        +'</div>';
      }
      h+='</div>';
    });
    box.innerHTML=h;
  }catch(e){}
};

/* نافذة التعديل */
window.updEditOpen=function(id){
  if(!isOwner())return toast('لصاحب الموقع فقط');
  (async function(){
    try{
      var all=await _ld();
      var u=all.find(function(x){return x.id===id;});
      if(!u)return toast('التحديث غير موجود');
      var f=el('updFormModal');if(f)f.remove();
      f=document.createElement('div');f.id='updFormModal';f.className='modal';
      f.innerHTML='<div class="m-card2" style="width:330px"><h3>✏️ تعديل التحديث</h3>'
      +'<input id="updTitle" placeholder="عنوان التحديث" value="'+String(u.title||'').replace(/"/g,'&quot;')+'" style="width:100%;padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--txt);border-radius:8px;font-size:13px">'
      +'<textarea id="updBody" placeholder="اكتب تفاصيل التحديث..." style="width:100%;min-height:90px;background:var(--bg);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:10px;font-size:13px;resize:none;margin-top:8px">'+escapeHtml(u.body||'')+'</textarea>'
      +'<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:10px 0;cursor:pointer"><input type="checkbox" id="updPriv" '+(u.pub===false?'checked':'')+'> 🔒 خاص بصاحب الموقع فقط</label>'
      +'<button style="background:var(--grn);color:#fff" onclick="updEditSave(\''+id+'\')">💾 حفظ التعديل</button>'
      +'<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'updFormModal\')">إلغاء</button></div>';
      f.onclick=function(e){if(e.target===f)closeModal('updFormModal');};
      document.body.appendChild(f);
      f.classList.add('open');
    }catch(e){toast('خطأ: '+e.message);}
  })();
};

window.updEditSave=async function(id){
  if(!isOwner())return;
  try{
    var t=el('updTitle').value.trim(),b=el('updBody').value.trim();
    if(!t)return toast('اكتب العنوان');
    if(!b)return toast('اكتب التفاصيل');
    var priv=el('updPriv').checked;
    var all=await _ld();
    all.forEach(function(u){
      if(u.id===id){u.title=t;u.body=b;u.pub=!priv;u.edited=true;}
    });
    await _sv(all);
    closeModal('updFormModal');
    toast('✅ تم حفظ التعديل');
    renderUpdatesPage();
  }catch(e){toast('خطأ: '+e.message);}
};
})();
/* ===== ✨ قلم الألوان: رسايلك بتدرج متوهج — زي المرجع ===== */
(function(){
if(window._penDone)return;window._penDone=true;

var COLORS=[
 {n:'بنفسجي',c1:'#8B5CF6',c2:'#D946EF'},
 {n:'نيون وردي',c1:'#FF3EF5',c2:'#FF71CE'},
 {n:'سماوي',c1:'#00E5FF',c2:'#7CFFCB'},
 {n:'أخضر',c1:'#00E676',c2:'#B2FF59'},
 {n:'ذهبي',c1:'#FFD700',c2:'#FF9F43'},
 {n:'أحمر',c1:'#FF4E6A',c2:'#FF2E88'},
 {n:'أزرق',c1:'#4A90FF',c2:'#00E0FF'},
 {n:'برتقالي',c1:'#FFB300',c2:'#FF6A00'}
];
window._PEN_COLORS=COLORS;

/* لون العضو المحفوظ */
function myGrad(){try{var c=COLORS.find(function(x){return x.n===(me&&me.penColor);});return c||null;}catch(e){return null;}}

/* 1) بناء القلم جنب الكاميرا */
function buildPen(){
  try{
    var camLabel=document.querySelector('label[for="imgInput"]');
    if(!camLabel||el('penColorBtn'))return;
    var wrap=camLabel.parentElement;
    var btn=document.createElement('button');
    btn.id='penColorBtn';
    btn.className='ic-btn';
    btn.style.cssText='cursor:pointer;flex-shrink:0;position:relative;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;margin-right:6px';
    btn.title='لون رسائلك';
    btn.onclick=function(e){e.preventDefault();e.stopPropagation();openPenPalette();};
    wrap.insertBefore(btn,camLabel);
    updatePenLook();
  }catch(e){}
}
function updatePenLook(){
  try{
    var btn=el('penColorBtn');if(!btn||!me)return;
    var g=myGrad();
    if(g){
      btn.innerHTML='🪄';
      btn.style.background='linear-gradient(135deg,'+g.c1+','+g.c2+')';
      btn.style.boxShadow='0 0 10px '+g.c1+'88';
      btn.style.border='2px solid '+g.c2;
    }else{
      btn.innerHTML='🪄';
      btn.style.background='var(--card2)';
      btn.style.boxShadow='none';
      btn.style.border='1px dashed var(--line)';
    }
    /* الحقل نفسه يتلون */
    var inp=el('msgInput');
    if(inp){
      var row=inp.closest('.chat-input');
      if(row){
        if(g){
          row.style.border='2px solid transparent';
          row.style.backgroundImage='linear-gradient(var(--card),var(--card)),linear-gradient(135deg,'+g.c1+','+g.c2+')';
          row.style.backgroundOrigin='border-box';
          row.style.backgroundClip='padding-box,border-box';
          row.style.boxShadow='0 0 12px '+g.c1+'44';
        }else{
          row.style.border='';
          row.style.backgroundImage='';
          row.style.boxShadow='';
        }
      }
    }
  }catch(e){}
}

/* 2) قايمة الألوان */
function openPenPalette(){
  try{
    var old=el('penPalette');if(old)old.remove();
    var g=myGrad();
    var m=document.createElement('div');m.id='penPalette';m.className='modal';
    var h='<div class="m-card2" style="width:310px"><h3>✨ لون رسائلك</h3>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    COLORS.forEach(function(c){
      var sel=g&&g.n===c.n;
      h+='<div onclick="pickPenColor(\''+c.n+'\')" style="cursor:pointer;border:2px solid '+(sel?'#fff':'transparent')+';border-radius:14px;padding:10px;text-align:center;background:var(--bg)">';
      h+='<div style="height:34px;border-radius:18px;background:linear-gradient(135deg,'+c.c1+','+c.c2+');margin-bottom:6px;box-shadow:0 0 10px '+c.c1+'66"></div>';
      h+='<div style="font-size:12px;font-weight:bold;color:var(--txt)">'+c.n+(sel?' ✅':'')+'</div></div>';
    });
    h+='</div>';
    h+='<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="pickPenColor(null)">❌ من غير لون (عادي)</button></div>';
    m.innerHTML=h;
    m.onclick=function(e){if(e.target===m)closeModal('penPalette');};
    document.body.appendChild(m);
    m.classList.add('open');
  }catch(e){}
}
window.pickPenColor=function(n){
  updateMe({penColor:n||null}).then(function(){
    closeModal('penPalette');
    toast(n?('✨ رسايلك بقت بلون: '+n):'رجعت الرسايل عادية');
    updatePenLook();
  });
};

/* 3) الرسايل المرسلة بتاخد التدرج */
var _apP=window.appendMsg;
window.appendMsg=function(m){
  var r=_apP(m);
  try{
    if(m&&m.from===me.name&&m.type==='text'&&me.penColor){
      var c=COLORS.find(function(x){return x.n===me.penColor;});
      if(c){
        setTimeout(function(){
          var el2=document.querySelector('[data-id="'+m._id+'"]');
          if(el2&&!el2.classList.contains('in')&&!el2.classList.contains('sys')){
            el2.style.border='2px solid transparent';
            el2.style.backgroundImage='linear-gradient(rgba(10,10,25,.72),rgba(10,10,25,.72)),linear-gradient(135deg,'+c.c1+','+c.c2+')';
            el2.style.backgroundOrigin='border-box';
            el2.style.backgroundClip='padding-box,border-box';
            el2.style.boxShadow='0 0 12px '+c.c1+'66,0 0 20px '+c.c2+'33';
            var tk=el2.querySelector('.ticks');
            if(tk)tk.style.color=c.c2;
          }
        },30);
      }
    }
  }catch(e){}
  return r;
};
var _smP=window.subMsgs;
window.subMsgs=async function(){
  var r=await _smP();
  try{
    setTimeout(function(){
      try{
        if(!me||!me.penColor)return;
        var c=COLORS.find(function(x){return x.n===me.penColor;});
        if(!c)return;
        var box=el('chatBox');if(!box)return;
        var bubs=box.querySelectorAll('.bub:not(.in):not(.sys)');
        for(var i=0;i<bubs.length;i++){
          if(bubs[i].getAttribute('data-pen')!=='1'){
            bubs[i].setAttribute('data-pen','1');
            bubs[i].style.border='2px solid transparent';
            bubs[i].style.backgroundImage='linear-gradient(rgba(10,10,25,.72),rgba(10,10,25,.72)),linear-gradient(135deg,'+c.c1+','+c.c2+')';
            bubs[i].style.backgroundOrigin='border-box';
            bubs[i].style.backgroundClip='padding-box,border-box';
            bubs[i].style.boxShadow='0 0 12px '+c.c1+'66,0 0 20px '+c.c2+'33';
            var tk=bubs[i].querySelector('.ticks');
            if(tk)tk.style.color=c.c2;
          }
        }
      }catch(e){}
    },400);
  }catch(e){}
  return r;
};

/* 4) تشغيل القلم: أول ما الشات يفتح + دوري */
var _ouP2=window.openUser;
window.openUser=function(n){var r=_ouP2(n);try{setTimeout(buildPen,400);setTimeout(buildPen,1000);}catch(e){}return r;};
var _jrP=window.joinRoom;
window.joinRoom=async function(rid){var r=await _jrP(rid);try{setTimeout(buildPen,400);setTimeout(buildPen,1000);}catch(e){}return r;};
setInterval(function(){try{if(el('s-chat')&&el('s-chat').classList.contains('active'))buildPen();}catch(e){}},2000);
})();
/* ===== 🪄 قلم ألوان الرسايل: جنب الكاميرا — ظهور مضمون ===== */
(function(){
if(window._penStrong)return;window._penStrong=true;

var COLORS=[
 {n:'بنفسجي',c1:'#8B5CF6',c2:'#D946EF'},
 {n:'نيون وردي',c1:'#FF3EF5',c2:'#FF71CE'},
 {n:'سماوي',c1:'#00E5FF',c2:'#7CFFCB'},
 {n:'أخضر',c1:'#00E676',c2:'#B2FF59'},
 {n:'ذهبي',c1:'#FFD700',c2:'#FF9F43'},
 {n:'أحمر',c1:'#FF4E6A',c2:'#FF2E88'},
 {n:'أزرق',c1:'#4A90FF',c2:'#00E0FF'},
 {n:'برتقالي',c1:'#FFB300',c2:'#FF6A00'}
];
function myGrad(){try{return COLORS.find(function(x){return x.n===(me&&me.penColor);})||null;}catch(e){return null;}}

/* بناء القلم بأكتر من طريقة بحث */
function buildPen(){
  try{
    if(el('penColorBtn'))return updatePenLook();
    var row=el('msgInput');
    if(!row)return;
    row=row.closest('.chat-input');
    if(!row)return;
    var btn=document.createElement('button');
    btn.id='penColorBtn';
    btn.className='ic-btn';
    btn.title='لون رسائلك';
    btn.style.cssText='cursor:pointer;flex-shrink:0;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:16px;margin-right:6px';
    btn.onclick=function(e){e.preventDefault();e.stopPropagation();openPenPalette();};
    /* المكان: جنب الكاميرا لو موجودة، وإلا أول الشريط */
    var cam=row.querySelector('label[for="imgInput"]');
    if(cam)cam.parentElement.insertBefore(btn,cam);
    else row.insertBefore(btn,row.firstChild);
    updatePenLook();
  }catch(e){}
}

function updatePenLook(){
  try{
    var btn=el('penColorBtn');if(!btn)return;
    var g=myGrad();
    if(g){
      btn.innerHTML='🪄';
      btn.style.background='linear-gradient(135deg,'+g.c1+','+g.c2+')';
      btn.style.boxShadow='0 0 10px '+g.c1+'88';
      btn.style.border='2px solid '+g.c2;
    }else{
      btn.innerHTML='🪄';
      btn.style.background='var(--card2)';
      btn.style.boxShadow='none';
      btn.style.border='1px dashed var(--line)';
    }
    var inp=el('msgInput');
    if(inp){
      var row=inp.closest('.chat-input');
      if(row){
        if(g){
          row.style.border='2px solid transparent';
          row.style.backgroundImage='linear-gradient(var(--card),var(--card)),linear-gradient(135deg,'+g.c1+','+g.c2+')';
          row.style.backgroundOrigin='border-box';
          row.style.backgroundClip='padding-box,border-box';
          row.style.boxShadow='0 0 12px '+g.c1+'44';
        }else{
          row.style.border='';row.style.backgroundImage='';row.style.boxShadow='';
        }
      }
    }
  }catch(e){}
}
window.openPenPalette=function(){
  try{
    var old=el('penPalette');if(old)old.remove();
    var g=myGrad();
    var m=document.createElement('div');m.id='penPalette';m.className='modal';
    var h='<div class="m-card2" style="width:310px"><h3>✨ لون رسائلك</h3>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    COLORS.forEach(function(c){
      var sel=g&&g.n===c.n;
      h+='<div onclick="pickPenColor(\''+c.n+'\')" style="cursor:pointer;border:2px solid '+(sel?'#fff':'transparent')+';border-radius:14px;padding:10px;text-align:center;background:var(--bg)">';
      h+='<div style="height:34px;border-radius:18px;background:linear-gradient(135deg,'+c.c1+','+c.c2+');margin-bottom:6px;box-shadow:0 0 10px '+c.c1+'66"></div>';
      h+='<div style="font-size:12px;font-weight:bold;color:var(--txt)">'+c.n+(sel?' ✅':'')+'</div></div>';
    });
    h+='</div><button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="pickPenColor(null)">❌ من غير لون (عادي)</button></div>';
    m.innerHTML=h;
    m.onclick=function(e){if(e.target===m)closeModal('penPalette');};
    document.body.appendChild(m);
    m.classList.add('open');
  }catch(e){}
};

window.pickPenColor=function(n){
  updateMe({penColor:n||null}).then(function(){
    closeModal('penPalette');
    toast(n?('✨ رسايلك بقت بلون: '+n):'رجعت الرسايل عادية');
    updatePenLook();
    /* تلون الرسايل الموجودة فوراً */
    setTimeout(paintAllPen,100);
  });
};

function paintAllPen(){
  try{
    if(!me||!me.penColor)return;
    var c=COLORS.find(function(x){return x.n===me.penColor;});
    if(!c)return;
    var box=el('chatBox');if(!box)return;
    var bubs=box.querySelectorAll('.bub:not(.in):not(.sys)');
    for(var i=0;i<bubs.length;i++){
      bubs[i].style.border='2px solid transparent';
      bubs[i].style.backgroundImage='linear-gradient(rgba(10,10,25,.72),rgba(10,10,25,.72)),linear-gradient(135deg,'+c.c1+','+c.c2+')';
      bubs[i].style.backgroundOrigin='border-box';
      bubs[i].style.backgroundClip='padding-box,border-box';
      bubs[i].style.boxShadow='0 0 12px '+c.c1+'66,0 0 20px '+c.c2+'33';
      var tk=bubs[i].querySelector('.ticks');
      if(tk)tk.style.color=c.c2;
    }
  }catch(e){}
}

/* الرسايل الجديدة تترسم بلونك */
var _apP3=window.appendMsg;
window.appendMsg=function(m){
  var r=_apP3(m);
  try{
    if(m&&m.from===me.name&&me.penColor){
      var c=COLORS.find(function(x){return x.n===me.penColor;});
      if(c)setTimeout(function(){
        var el2=document.querySelector('[data-id="'+m._id+'"]');
        if(el2&&!el2.classList.contains('in')&&!el2.classList.contains('sys')){
          el2.style.border='2px solid transparent';
          el2.style.backgroundImage='linear-gradient(rgba(10,10,25,.72),rgba(10,10,25,.72)),linear-gradient(135deg,'+c.c1+','+c.c2+')';
          el2.style.backgroundOrigin='border-box';
          el2.style.backgroundClip='padding-box,border-box';
          el2.style.boxShadow='0 0 12px '+c.c1+'66,0 0 20px '+c.c2+'33';
          var tk=el2.querySelector('.ticks');
          if(tk)tk.style.color=c.c2;
        }
      },30);
    }
  }catch(e){}
  return r;
};
var _smP3=window.subMsgs;
window.subMsgs=async function(){
  var r=await _smP3();
  try{setTimeout(paintAllPen,400);setTimeout(paintAllPen,1000);}catch(e){}
  return r;
};

/* القلم يتبني أول ما الشات يفتح + مراقبة مستمرة */
var _ouP3=window.openUser;
window.openUser=function(n){var r=_ouP3(n);try{setTimeout(buildPen,300);setTimeout(buildPen,800);setTimeout(buildPen,1500);}catch(e){}return r;};
var _jrP3=window.joinRoom;
window.joinRoom=async function(rid){var r=await _jrP3(rid);try{setTimeout(buildPen,300);setTimeout(buildPen,800);}catch(e){}return r;};
setInterval(function(){
  try{
    if(el('s-chat')&&el('s-chat').classList.contains('active'))buildPen();
  }catch(e){}
},1500);
})();
/* ===== قايمة الألوان المحسنة: 16 لون + معاينة "اكتب رسالتك" جوه كل مربع ===== */
(function(){
if(window._paletteV2)return;window._paletteV2=true;

var COLORS=[
 {n:'نيون وردي',c1:'#FF3EF5',c2:'#FF71CE'},
 {n:'بنفسجي',c1:'#8B5CF6',c2:'#D946EF'},
 {n:'أخضر',c1:'#00E676',c2:'#B2FF59'},
 {n:'سماوي',c1:'#00E5FF',c2:'#7CFFCB'},
 {n:'أحمر',c1:'#FF4E6A',c2:'#FF2E88'},
 {n:'ذهبي',c1:'#FFD700',c2:'#FF9F43'},
 {n:'برتقالي',c1:'#FFB300',c2:'#FF6A00'},
 {n:'أزرق',c1:'#4A90FF',c2:'#00E0FF'},
 {n:'وردي',c1:'#FF6EC7',c2:'#FF9AE0'},
 {n:'مجرة',c1:'#9D6BFF',c2:'#7EE8FF'},
 {n:'زمرد',c1:'#00C965',c2:'#5AE6A0'},
 {n:'شفق',c1:'#00B8D9',c2:'#39FF9E'},
 {n:'ناري',c1:'#FF512F',c2:'#DD2476'},
 {n:'ماسي',c1:'#FFFFFF',c2:'#A8D8FF'},
 {n:'ليلي',c1:'#6C5CE7',c2:'#A29BFE'},
 {n:'غروب',c1:'#FF9966',c2:'#FF5E62'}
];
window._PEN_COLORS2=COLORS;

/* نافذة القايمة الجديدة */
window.openPenPalette=function(){
  try{
    var old=el('penPalette');if(old)old.remove();
    var g=null;
    try{g=COLORS.find(function(x){return x.n===(me&&me.penColor);})||null;}catch(e){}
    var m=document.createElement('div');m.id='penPalette';m.className='modal';
    var h='<div class="m-card2" style="width:320px;max-height:85vh;overflow-y:auto"><h3>✨ لون رسائلك</h3>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    COLORS.forEach(function(c){
      var sel=g&&g.n===c.n;
      h+='<div onclick="pickPenColor(\''+c.n+'\')" style="cursor:pointer;border:2px solid '+(sel?'#fff':'transparent')+';border-radius:14px;padding:10px;text-align:center;background:var(--bg)">';
      /* المعاينة: شكل فقاعة كامل مكتوب فيه "اكتب رسالتك" */
      h+='<div style="border:2px solid transparent;border-radius:14px;padding:8px 6px;background-image:linear-gradient(rgba(10,10,25,.72),rgba(10,10,25,.72)),linear-gradient(135deg,'+c.c1+','+c.c2+');background-origin:border-box;background-clip:padding-box,border-box;box-shadow:0 0 10px '+c.c1+'55;margin-bottom:6px">';
      h+='<div style="background:linear-gradient(135deg,'+c.c1+','+c.c2+');-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:bold;font-size:12px">اكتب رسالتك</div></div>';
      h+='<div style="font-size:11.5px;font-weight:bold;color:var(--txt)">'+c.n+(sel?' ✅':'')+'</div></div>';
    });
    h+='</div>';
    h+='<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="pickPenColor(null)">❌ من غير لون (عادي)</button></div>';
    m.innerHTML=h;
    m.onclick=function(e){if(e.target===m)closeModal('penPalette');};
    document.body.appendChild(m);
    m.classList.add('open');
  }catch(e){}
};

/* التلوين يقرأ من القايمة الجديدة (16 لون) */
function paintAllTxt2(){
  try{
    if(!me||!me.penColor)return;
    var c=COLORS.find(function(x){return x.n===me.penColor;});
    if(!c)return;
    var box=el('chatBox');if(!box)return;
    var bubs=box.querySelectorAll('.bub:not(.in):not(.sys)');
    for(var i=0;i<bubs.length;i++){
      if(bubs[i].querySelector('img')||bubs[i].querySelector('audio'))continue;
      bubs[i].style.border='2px solid transparent';
      bubs[i].style.backgroundImage='linear-gradient(rgba(10,10,25,.72),rgba(10,10,25,.72)),linear-gradient(135deg,'+c.c1+','+c.c2+')';
      bubs[i].style.backgroundOrigin='border-box';
      bubs[i].style.backgroundClip='padding-box,border-box';
      bubs[i].style.boxShadow='0 0 12px '+c.c1+'66,0 0 20px '+c.c2+'33';
      var tk=bubs[i].querySelector('.ticks');
      if(tk)tk.style.color=c.c2;
      /* النص يتدرج */
      var span=bubs[i].querySelector('.penTxt');
      if(!span){
        var nodes=bubs[i].childNodes;
        var tp=[];
        for(var j=0;j<nodes.length;j++){
          if(nodes[j].nodeType===3&&nodes[j].textContent.trim())tp.push(nodes[j]);
        }
        if(tp.length){
          tp.forEach(function(nd){
            var s=document.createElement('span');
            s.className='penTxt';
            s.textContent=nd.textContent;
            bubs[i].replaceChild(s,nd);
          });
          span=bubs[i].querySelector('.penTxt');
        }
      }
      if(span){
        span.style.background='linear-gradient(135deg,'+c.c1+','+c.c2+')';
        span.style.webkitBackgroundClip='text';
        span.style.backgroundClip='text';
        span.style.color='transparent';
        span.style.fontWeight='bold';
        span.style.textShadow='none';
      }
    }
  }catch(e){}
}

/* رسالة جديدة تتلون فوراً */
var _apP4=window.appendMsg;
window.appendMsg=function(m){
  var r=_apP4(m);
  try{setTimeout(paintAllTxt2,60);setTimeout(paintAllTxt2,350);}catch(e){}
  return r;
};
var _smP4=window.subMsgs;
window.subMsgs=async function(){
  var r=await _smP4();
  try{setTimeout(paintAllTxt2,500);setTimeout(paintAllTxt2,1500);}catch(e){}
  return r;
};
setInterval(paintAllTxt2,3000);
var _pp2=window.pickPenColor;
window.pickPenColor=function(n){
  var r=_pp2?_pp2(n):undefined;
  try{setTimeout(paintAllTxt2,300);}catch(e){}
  return r;
};
})();
/* ===== قايمة الألوان المحسنة: من غير ماسي + وضوح أعلى للكل ===== */
(function(){
if(window._paletteV3)return;window._paletteV3=true;

var COLORS=[
 {n:'نيون وردي',c1:'#FF3EF5',c2:'#FF71CE'},
 {n:'بنفسجي',c1:'#A855F7',c2:'#E879F9'},
 {n:'سماوي',c1:'#22D3EE',c2:'#67E8F9'},
 {n:'أخضر',c1:'#22C55E',c2:'#86EFAC'},
 {n:'ذهبي',c1:'#FBBF24',c2:'#FDE047'},
 {n:'أحمر',c1:'#EF4444',c2:'#FB7185'},
 {n:'أزرق',c1:'#3B82F6',c2:'#93C5FD'},
 {n:'برتقالي',c1:'#F97316',c2:'#FDBA74'},
 {n:'مجرة',c1:'#8B5CF6',c2:'#38BDF8'},
 {n:'وردي',c1:'#EC4899',c2:'#F9A8D4'},
 {n:'شفق',c1:'#06B6D4',c2:'#4ADE80'},
 {n:'زمردي',c1:'#10B981',c2:'#6EE7B7'},
 {n:'ناري',c1:'#F43F5E',c2:'#FB923C'},
 {n:'غروب',c1:'#FB7185',c2:'#FDBA74'},
 {n:'ليلي',c1:'#7C3AED',c2:'#C4B5FD'}
];
window._PEN_COLORS3=COLORS;

/* نافذة القايمة بوضوح أعلى: حدود 3px + توهج قوي + نص أكبر */
window.openPenPalette=function(){
  try{
    var old=el('penPalette');if(old)old.remove();
    var g=null;
    try{g=COLORS.find(function(x){return x.n===(me&&me.penColor);})||null;}catch(e){}
    var m=document.createElement('div');m.id='penPalette';m.className='modal';
    var h='<div class="m-card2" style="width:330px;max-height:85vh;overflow-y:auto"><h3>✨ لون رسائلك</h3>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    COLORS.forEach(function(c){
      var sel=g&&g.n===c.n;
      h+='<div onclick="pickPenColor(\''+c.n+'\')" style="cursor:pointer;border:2px solid '+(sel?'#fff':'transparent')+';border-radius:14px;padding:12px 8px;text-align:center;background:var(--bg)">';
      /* المعاينة: خلفية غامقة + حدود سميكة متوهجة قوي */
      h+='<div style="border:3px solid transparent;border-radius:16px;padding:12px 6px;background-image:linear-gradient(rgba(5,5,15,.85),rgba(5,5,15,.85)),linear-gradient(135deg,'+c.c1+','+c.c2+');background-origin:border-box;background-clip:padding-box,border-box;box-shadow:0 0 16px '+c.c1+'99,0 0 30px '+c.c2+'44;margin-bottom:8px">';
      h+='<div style="background:linear-gradient(135deg,'+c.c1+','+c.c2+');-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:900;font-size:14px;text-shadow:none">اكتب رسالتك</div></div>';
      h+='<div style="font-size:12.5px;font-weight:bold;color:var(--txt)">'+c.n+(sel?' ✅':'')+'</div></div>';
    });
    h+='</div>';
    h+='<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="pickPenColor(null)">❌ من غير لون (عادي)</button></div>';
    m.innerHTML=h;
    m.onclick=function(e){if(e.target===m)closeModal('penPalette');};
    document.body.appendChild(m);
    m.classList.add('open');
  }catch(e){}
};

/* الرسايل في الشات بنفس الوضوح العالي */
function paintAllV3(){
  try{
    if(!me||!me.penColor)return;
    var c=COLORS.find(function(x){return x.n===me.penColor;});
    if(!c)return;
    var box=el('chatBox');if(!box)return;
    var bubs=box.querySelectorAll('.bub:not(.in):not(.sys)');
    for(var i=0;i<bubs.length;i++){
      if(bubs[i].querySelector('img')||bubs[i].querySelector('audio'))continue;
      bubs[i].style.border='3px solid transparent';
      bubs[i].style.borderRadius='16px';
      bubs[i].style.backgroundImage='linear-gradient(rgba(5,5,15,.85),rgba(5,5,15,.85)),linear-gradient(135deg,'+c.c1+','+c.c2+')';
      bubs[i].style.backgroundOrigin='border-box';
      bubs[i].style.backgroundClip='padding-box,border-box';
      bubs[i].style.boxShadow='0 0 14px '+c.c1+'88,0 0 28px '+c.c2+'44';
      var tk=bubs[i].querySelector('.ticks');
      if(tk)tk.style.color=c.c2;
      /* النص: أكبر وأوضح بالتدرج */
      var span=bubs[i].querySelector('.penTxt');
      if(!span){
        var nodes=bubs[i].childNodes;
        var tp=[];
        for(var j=0;j<nodes.length;j++){
          if(nodes[j].nodeType===3&&nodes[j].textContent.trim())tp.push(nodes[j]);
        }
        if(tp.length){
          tp.forEach(function(nd){
            var s=document.createElement('span');
            s.className='penTxt';
            s.textContent=nd.textContent;
            bubs[i].replaceChild(s,nd);
          });
          span=bubs[i].querySelector('.penTxt');
        }
      }
      if(span){
        span.style.background='linear-gradient(135deg,'+c.c1+','+c.c2+')';
        span.style.webkitBackgroundClip='text';
        span.style.backgroundClip='text';
        span.style.color='transparent';
        span.style.fontWeight='900';
        span.style.fontSize='17px';
        span.style.textShadow='none';
      }
    }
  }catch(e){}
}

var _apV3=window.appendMsg;
window.appendMsg=function(m){var r=_apV3(m);try{setTimeout(paintAllV3,60);setTimeout(paintAllV3,350);}catch(e){}return r;};
var _smV3=window.subMsgs;
window.subMsgs=async function(){var r=await _smV3();try{setTimeout(paintAllV3,500);setTimeout(paintAllV3,1500);}catch(e){}return r;};
setInterval(paintAllV3,3000);
var _ppV3=window.pickPenColor;
window.pickPenColor=function(n){var r=_ppV3?_ppV3(n):undefined;try{setTimeout(paintAllV3,300);}catch(e){}return r;};
})();
/* ===== الخط أبيض عادي: الحدود والتوهج فقط بالتدرج ===== */
(function(){
if(window._txtWhite)return;window._txtWhite=true;

var COLORS=[
 {n:'نيون وردي',c1:'#FF3EF5',c2:'#FF71CE'},
 {n:'بنفسجي',c1:'#A855F7',c2:'#E879F9'},
 {n:'سماوي',c1:'#22D3EE',c2:'#67E8F9'},
 {n:'أخضر',c1:'#22C55E',c2:'#86EFAC'},
 {n:'ذهبي',c1:'#FBBF24',c2:'#FDE047'},
 {n:'أحمر',c1:'#EF4444',c2:'#FB7185'},
 {n:'أزرق',c1:'#3B82F6',c2:'#93C5FD'},
 {n:'برتقالي',c1:'#F97316',c2:'#FDBA74'},
 {n:'مجرة',c1:'#8B5CF6',c2:'#38BDF8'},
 {n:'وردي',c1:'#EC4899',c2:'#F9A8D4'},
 {n:'شفق',c1:'#06B6D4',c2:'#4ADE80'},
 {n:'زمردي',c1:'#10B981',c2:'#6EE7B7'},
 {n:'ناري',c1:'#F43F5E',c2:'#FB923C'},
 {n:'غروب',c1:'#FB7185',c2:'#FDBA74'},
 {n:'ليلي',c1:'#7C3AED',c2:'#C4B5FD'}
];

function paintWhiteTxt(){
  try{
    if(!me||!me.penColor)return;
    var c=COLORS.find(function(x){return x.n===me.penColor;});
    if(!c)return;
    var box=el('chatBox');if(!box)return;
    var bubs=box.querySelectorAll('.bub:not(.in):not(.sys)');
    for(var i=0;i<bubs.length;i++){
      if(bubs[i].querySelector('img')||bubs[i].querySelector('audio'))continue;
      /* الحدود والتوهج يفضلوا متلونين */
      bubs[i].style.border='3px solid transparent';
      bubs[i].style.borderRadius='16px';
      bubs[i].style.backgroundImage='linear-gradient(rgba(5,5,15,.85),rgba(5,5,15,.85)),linear-gradient(135deg,'+c.c1+','+c.c2+')';
      bubs[i].style.backgroundOrigin='border-box';
      bubs[i].style.backgroundClip='padding-box,border-box';
      bubs[i].style.boxShadow='0 0 14px '+c.c1+'88,0 0 28px '+c.c2+'44';
      /* الخط: أبيض عادي — نشيل أي تدرج قديم */
      var span=bubs[i].querySelector('.penTxt');
      if(span){
        span.style.background='';
        span.style.webkitBackgroundClip='';
        span.style.backgroundClip='';
        span.style.color='#fff';
        span.style.fontWeight='';
        span.style.fontSize='';
        span.style.textShadow='';
      }
      var tk=bubs[i].querySelector('.ticks');
      if(tk)tk.style.color=c.c2;
    }
  }catch(e){}
}

var _apW=window.appendMsg;
window.appendMsg=function(m){var r=_apW(m);try{setTimeout(paintWhiteTxt,60);setTimeout(paintWhiteTxt,350);}catch(e){}return r;};
var _smW=window.subMsgs;
window.subMsgs=async function(){var r=await _smW();try{setTimeout(paintWhiteTxt,500);setTimeout(paintWhiteTxt,1500);}catch(e){}return r;};
setInterval(paintWhiteTxt,3000);
var _ppW=window.pickPenColor;
window.pickPenColor=function(n){var r=_ppW?_ppW(n):undefined;try{setTimeout(paintWhiteTxt,300);}catch(e){}return r;};
})();
/* ===== قلم واضح + عنصر "لون رسايلك" في الإعدادات ===== */
(function(){
if(window._penVisFix)return;window._penVisFix=true;

/* 1) القلم: أكبر وأوضح — أيقونة متوهجة دايماً */
function buildPenV2(){
  try{
    if(el('penColorBtn')){
      /* موجود؟ نخليه أوضح */
      var b=el('penColorBtn');
      b.style.cssText='cursor:pointer;flex-shrink:0;border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:20px;margin-right:8px';
      restylePen(b);
      return;
    }
    var inp=el('msgInput');if(!inp)return;
    var row=inp.closest('.chat-input');if(!row)return;
    var btn=document.createElement('button');
    btn.id='penColorBtn';
    btn.className='ic-btn';
    btn.title='لون رسائلك ✨';
    btn.style.cssText='cursor:pointer;flex-shrink:0;border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:20px;margin-right:8px';
    btn.onclick=function(e){e.preventDefault();e.stopPropagation();openPenPalette();};
    var cam=row.querySelector('label[for="imgInput"]');
    if(cam)cam.parentElement.insertBefore(btn,cam);
    else row.insertBefore(btn,row.firstChild);
    restylePen(btn);
  }catch(e){}
}

function restylePen(btn){
  try{
    var g=null;
    var CL=[{n:'نيون وردي',c1:'#FF3EF5',c2:'#FF71CE'},{n:'بنفسجي',c1:'#A855F7',c2:'#E879F9'},{n:'سماوي',c1:'#22D3EE',c2:'#67E8F9'},{n:'أخضر',c1:'#22C55E',c2:'#86EFAC'},{n:'ذهبي',c1:'#FBBF24',c2:'#FDE047'},{n:'أحمر',c1:'#EF4444',c2:'#FB7185'},{n:'أزرق',c1:'#3B82F6',c2:'#93C5FD'},{n:'برتقالي',c1:'#F97316',c2:'#FDBA74'},{n:'مجرة',c1:'#8B5CF6',c2:'#38BDF8'},{n:'وردي',c1:'#EC4899',c2:'#F9A8D4'},{n:'شفق',c1:'#06B6D4',c2:'#4ADE80'},{n:'زمردي',c1:'#10B981',c2:'#6EE7B7'},{n:'ناري',c1:'#F43F5E',c2:'#FB923C'},{n:'غروب',c1:'#FB7185',c2:'#FDBA74'},{n:'ليلي',c1:'#7C3AED',c2:'#C4B5FD'}];
    try{g=CL.find(function(x){return x.n===(me&&me.penColor);})||null;}catch(e){}
    if(g){
      btn.innerHTML='✨';
      btn.style.background='linear-gradient(135deg,'+g.c1+','+g.c2+')';
      btn.style.boxShadow='0 0 14px '+g.c1+',0 0 26px '+g.c2+'66';
      btn.style.border='2px solid #fff';
    }else{
      /* بدون لون: بتظهر واضحة برضه — بنفسجي فاتح متوهج يدل إنها ميزة */
      btn.innerHTML='✨';
      btn.style.background='linear-gradient(135deg,#8B5CF6,#D946EF)';
      btn.style.boxShadow='0 0 12px rgba(139,92,246,.7)';
      btn.style.border='2px solid rgba(217,70,239,.5)';
    }
  }catch(e){}
}

/* 2) عنصر "لون رسايلك" في قايمة الإعدادات */
function ensureSettingItem(){
  try{
    var scr=el('s-settings');if(!scr)return;
    var lists=scr.querySelectorAll('.menu-list');
    if(!lists.length)return;
    var tgt=lists[0];
    if(el('penColorMenuItem'))return;
    var mi=document.createElement('div');
    mi.className='m-item';mi.id='penColorMenuItem';
    mi.innerHTML='<span>🎨 لون رسايلك <span style="background:linear-gradient(135deg,#FF3EF5,#00E5FF);color:#fff;font-size:10px;font-weight:bold;padding:3px 10px;border-radius:12px;margin-right:6px">✨ جديد</span></span><span>👈</span>';
    mi.onclick=function(){openPenPalette();};
    tgt.insertBefore(mi,tgt.firstChild);
  }catch(e){}
}

/* 3) شغّال دائم */
setInterval(function(){
  try{
    if(el('s-chat')&&el('s-chat').classList.contains('active'))buildPenV2();
    ensureSettingItem();
  }catch(e){}
},1500);
var _saPV=window.startAll;
window.startAll=async function(){
  var r=await _saPV();
  try{setTimeout(ensureSettingItem,800);}catch(e){}
  return r;
};
})();
/* ===== 🎨 لون رسايلك — النظام الكامل النظيف ===== */
(function(){
if(window._penSysV1)return;window._penSysV1=true;
var COST=100,DAYS=30;

var COLORS=[
 {n:'بنفسجي',c1:'#A855F7',c2:'#E879F9'},
 {n:'نيون وردي',c1:'#FF3EF5',c2:'#FF71CE'},
 {n:'أخضر',c1:'#22C55E',c2:'#86EFAC'},
 {n:'سماوي',c1:'#22D3EE',c2:'#67E8F9'},
 {n:'أحمر',c1:'#EF4444',c2:'#FB7185'},
 {n:'ذهبي',c1:'#FBBF24',c2:'#FDE047'},
 {n:'برتقالي',c1:'#F97316',c2:'#FDBA74'},
 {n:'أزرق',c1:'#3B82F6',c2:'#93C5FD'},
 {n:'مجرة',c1:'#8B5CF6',c2:'#38BDF8'},
 {n:'وردي',c1:'#EC4899',c2:'#F9A8D4'},
 {n:'زمردي',c1:'#10B981',c2:'#6EE7B7'},
 {n:'شفق',c1:'#06B6D4',c2:'#4ADE80'},
 {n:'ناري',c1:'#F43F5E',c2:'#FB923C'},
 {n:'غروب',c1:'#FB7185',c2:'#FDBA74'},
 {n:'ليلي',c1:'#7C3AED',c2:'#C4B5FD'},
 {n:'سماوي غامق',c1:'#0EA5E9',c2:'#38BDF8'}
];
window._PENC=COLORS;

function penActive(){try{return me&&me.penColorExp&&me.penColorExp>Date.now();}catch(e){return false;}}
function penAdmin(){try{return me&&(isOwnerName(me.name)||isAdmin());}catch(e){return false;}}

/* 1) القايمة المنبثقة (القلم) — زي الصورة بالظبط */
window.openPenPalette=function(){
  if(!me)return toast('سجل دخولك أولاً');
  var old=el('penPalette');if(old)old.remove();
  var g=null;try{g=COLORS.find(function(x){return x.n===me.penColor;})||null;}catch(e){}
  var m=document.createElement('div');m.id='penPalette';m.className='modal';
  var h='<div class="m-card2" style="width:320px;max-height:85vh;overflow-y:auto"><h3>✨ لون رسائلك</h3>'
  +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
  COLORS.forEach(function(c){
    var sel=g&&g.n===c.n;
    h+='<div onclick="pickPenApply(\''+c.n+'\')" style="cursor:pointer;border:2px solid '+(sel?'#fff':'transparent')+';border-radius:14px;padding:12px 8px;text-align:center;background:var(--bg)">';
    h+='<div style="border:2.5px solid transparent;border-radius:14px;padding:10px 6px;background-image:linear-gradient(rgba(5,5,15,.85),rgba(5,5,15,.85)),linear-gradient(135deg,'+c.c1+','+c.c2+');background-origin:border-box;background-clip:padding-box,border-box;box-shadow:0 0 14px '+c.c1+'88;margin-bottom:7px">';
    h+='<div style="background:linear-gradient(135deg,'+c.c1+','+c.c2+');-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:900;font-size:13.5px">اكتب رسالتك</div></div>';
    h+='<div style="font-size:12px;font-weight:bold;color:var(--txt)">'+c.n+(sel?' ✅':'')+'</div></div>';
  });
  h+='</div>';
  if(!penAdmin()&&!penActive())h+='<button style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-weight:900" onclick="closeModal(\'penPalette\');go(\'pencolor\',null)">🪙 اشترك بـ '+COST+' عملة — شهر كامل</button>';
  h+='<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="pickPenColor(null)">❌ من غير لون (عادي)</button></div>';
  m.innerHTML=h;
  m.onclick=function(e){if(e.target===m)closeModal('penPalette');};
  document.body.appendChild(m);
  m.classList.add('open');
};

window.pickPenApply=function(n){
  if(!me)return;
  var c=COLORS.find(function(x){return x.n===n;});
  if(!c)return;
  if(!penAdmin()&&!penActive()){
    if((me.coins||0)<COST){toast('🪙 العملات غير كافية — يرجي الشحن (ناقصك '+(COST-(me.coins||0))+' عملة)');return;}
    if(!confirm('اشتراك لون الرسايل بـ '+COST+' عملة لمدة '+DAYS+' يوم؟'))return;
    updateMe({coins:(me.coins||0)-COST,penColorExp:Date.now()+DAYS*86400000,penColor:n}).then(function(){
      closeModal('penPalette');
      toast('🎉 تم الاشتراك! شهر كامل');
      updatePenLook();paintPenAll();renderShop();
    });
    return;
  }
  updateMe({penColor:n}).then(function(){
    closeModal('penPalette');
    toast('✨ رسايلك بقت بلون: '+n);
    updatePenLook();paintPenAll();
  });
};
window.pickPenColor=function(n){
  if(n===null){updateMe({penColor:null}).then(function(){closeModal('penPalette');toast('رجعت الرسايل عادية');updatePenLook();});return;}
  pickPenApply(n);
};
window.buyPenColor=function(){
  if((me.coins||0)<COST)return toast('🪙 العملات غير كافية — يرجي الشحن');
  if(!confirm('اشتراك لون الرسايل بـ '+COST+' عملة لمدة '+DAYS+' يوم؟'))return;
  updateMe({coins:(me.coins||0)-COST,penColorExp:Date.now()+DAYS*86400000}).then(function(){
    toast('🎉 تم الاشتراك! شهر كامل');
    renderPenColorPage();renderShop();
  });
};

/* 2) القلم في الشات */
function buildPen(){
  try{
    if(el('penColorBtn'))return restylePen();
    var inp=el('msgInput');if(!inp)return;
    var row=inp.closest('.chat-input');if(!row)return;
    var btn=document.createElement('button');
    btn.id='penColorBtn';btn.className='ic-btn';btn.title='لون رسائلك ✨';
    btn.style.cssText='cursor:pointer;flex-shrink:0;border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:20px;margin-right:8px';
    btn.onclick=function(e){e.preventDefault();e.stopPropagation();openPenPalette();};
    var cam=row.querySelector('label[for="imgInput"]');
    if(cam)cam.parentElement.insertBefore(btn,cam);else row.insertBefore(btn,row.firstChild);
    restylePen();
  }catch(e){}
}
function restylePen(){
  try{
    var btn=el('penColorBtn');if(!btn)return;
    var g=null;try{g=COLORS.find(function(x){return x.n===(me&&me.penColor);})||null;}catch(e){}
    btn.innerHTML='✨';
    if(g){
      btn.style.background='linear-gradient(135deg,'+g.c1+','+g.c2+')';
      btn.style.boxShadow='0 0 14px '+g.c1+',0 0 26px '+g.c2+'66';
      btn.style.border='2px solid #fff';
    }else{
      btn.style.background='linear-gradient(135deg,#8B5CF6,#D946EF)';
      btn.style.boxShadow='0 0 12px rgba(139,92,246,.7)';
      btn.style.border='2px solid rgba(217,70,239,.5)';
    }
    var inp=el('msgInput');
    if(inp){
      var row=inp.closest('.chat-input');
      if(row){
        if(g){
          row.style.border='2px solid transparent';
          row.style.backgroundImage='linear-gradient(var(--card),var(--card)),linear-gradient(135deg,'+g.c1+','+g.c2+')';
          row.style.backgroundOrigin='border-box';row.style.backgroundClip='padding-box,border-box';
          row.style.boxShadow='0 0 12px '+g.c1+'44';
        }else{row.style.border='';row.style.backgroundImage='';row.style.boxShadow='';}
      }
    }
  }catch(e){}
}

/* 3) صفحة كاملة في الإعدادات */
try{
  var mi=document.createElement('div');mi.id='penColorMenuItem';mi.className='m-item';
  mi.innerHTML='<span>🎨 لون رسايلك <span style="background:linear-gradient(135deg,#FF3EF5,#00E5FF);color:#fff;font-size:10px;font-weight:bold;padding:3px 10px;border-radius:12px;margin-right:6px">✨ جديد</span></span><span>👈</span>';
  mi.onclick=function(){go('pencolor',null);};
  var lists=document.querySelectorAll('#s-settings .menu-list');
  if(lists.length&&!el('penColorMenuItem'))lists[0].insertBefore(mi,lists[0].firstChild);
}catch(e){}
if(!el('s-pencolor')){
  var scr=document.createElement('div');scr.className='screen';scr.id='s-pencolor';
  scr.innerHTML='<div class="sub-title" onclick="go(\'settings\')">➔ لون رسايلك</div><div id="penScreenBody" style="padding:4px"></div>';
  var content=document.querySelector('.content');
  var ref=el('s-settings');
  if(ref&&ref.parentElement)content.insertBefore(scr,ref);else content.appendChild(scr);
}
window.renderPenColorPage=function(){
  try{
    var box=el('penScreenBody');if(!box||!me)return;
    var coins=(me.coins)||0;
    var g=null;try{g=COLORS.find(function(x){return x.n===me.penColor;})||null;}catch(e){}
    var h='';
    h+='<div style="background:radial-gradient(ellipse at top,#2a1044,#141038);border-radius:18px;padding:22px 14px;text-align:center;margin-bottom:12px;border:1px solid rgba(139,92,246,.3)">';
    h+='<div style="font-size:17px;font-weight:900;color:#fff">🎨 لون رسايلك</div>';
    h+='<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:5px">رسايلك تطلع بإطار متوهج بلونك في كل الشاتات</div>';
    h+='<div style="margin-top:14px;display:inline-block;padding:12px 24px;border-radius:18px;font-weight:900;font-size:15px;color:#fff;';
    if(g){h+='border:3px solid transparent;background-image:linear-gradient(rgba(10,10,25,.85),rgba(10,10,25,.85)),linear-gradient(135deg,'+g.c1+','+g.c2+');background-origin:border-box;background-clip:padding-box,border-box;box-shadow:0 0 18px '+g.c1+'99';}
    else{h+='background:var(--card2);border:2px dashed var(--line);';}
    h+='">اكتب رسالتك</div></div>';
    if(penAdmin()){h+='<div style="background:rgba(139,92,246,.12);border:1px solid #8B5CF6;border-radius:12px;padding:10px;margin-bottom:12px;text-align:center;font-size:12.5px;color:#c4b5fd;font-weight:bold">👑 إدارة — مجاني دائماً</div>';}
    else if(penActive()){h+='<div style="background:rgba(34,211,238,.12);border:1px solid #22d3ee;border-radius:12px;padding:10px;margin-bottom:12px;text-align:center;font-size:13px;color:#22d3ee;font-weight:bold">✅ اشتراكك نشط — متبقي '+Math.ceil((me.penColorExp-Date.now())/86400000)+' يوم</div>';}
    else{h+='<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px;display:flex;align-items:center;gap:12px"><div style="font-size:26px">🎨</div><div style="flex:1"><div style="font-weight:bold;font-size:14px">اشتراك شهري</div><div style="font-size:11px;color:var(--mut);margin-top:2px">فعّل اللون شهر كامل وغيّره براحتك</div></div><button class="adm-btn" style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-weight:900;border-radius:12px;padding:8px 14px;flex-shrink:0" onclick="buyPenColor()">🪙 '+COST+'</button></div>';}
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    COLORS.forEach(function(c){
      var sel=g&&g.n===c.n;
      h+='<div onclick="pickPenApply(\''+c.n+'\')" style="cursor:pointer;border:2px solid '+(sel?'#fff':'var(--line)')+';border-radius:14px;padding:12px 8px;text-align:center;background:var(--card)">';
      h+='<div style="border:2.5px solid transparent;border-radius:14px;padding:10px 6px;background-image:linear-gradient(rgba(5,5,15,.85),rgba(5,5,15,.85)),linear-gradient(135deg,'+c.c1+','+c.c2+');background-origin:border-box;background-clip:padding-box,border-box;box-shadow:0 0 14px '+c.c1+'77;margin-bottom:7px">';
      h+='<div style="background:linear-gradient(135deg,'+c.c1+','+c.c2+');-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:900;font-size:13.5px">اكتب رسالتك</div></div>';
      h+='<div style="font-size:12.5px;font-weight:bold;color:var(--txt)">'+c.n+(sel?' ✅':'')+'</div></div>';
    });
    h+='</div>';
    box.innerHTML=h;
  }catch(e){}
};

/* 4) المتجر: منتج ثالث */
var _rsP=window.renderShop;
window.renderShop=function(){
  var r=_rsP?_rsP():undefined;
  try{
    var box=el('shopBody');if(!box||!me)return r;
    var divs=box.querySelectorAll('div');
    for(var i=0;i<divs.length;i++){
      var t=divs[i].innerText||'';
      if(t.indexOf('تميّز الاسم')>-1&&t.indexOf('اسمك ملون')>-1&&divs[i].style.display&&divs[i].style.display.indexOf('flex')>-1){
        var row=divs[i];
        var coins=(me.coins)||0;
        var penA=penActive();
        var h='<div style="background:var(--card);border:1px solid '+(penA?'var(--grn)':'var(--line)')+';border-radius:14px;padding:14px;display:flex;align-items:center;gap:12px;margin-top:10px">';
        h+='<div style="width:52px;height:52px;border-radius:12px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0">🎨</div>';
        h+='<div style="flex:1;min-width:0"><div style="font-weight:bold;font-size:14px;color:var(--txt)">🎨 لون رسايلك</div>';
        h+='<div style="font-size:11px;color:var(--mut);margin-top:3px">رسايلك بإطار متوهج بلون تختاره — 30 يوم</div>';
        if(penA)h+='<div style="font-size:11px;color:var(--grn);font-weight:bold;margin-top:4px">✅ مُفعّل — متبقي '+Math.ceil((me.penColorExp-Date.now())/86400000)+' يوم</div>';
        h+='</div><div style="flex-shrink:0">';
        if(penA)h+='<div style="font-size:11px;color:var(--grn);font-weight:bold">✅</div>';
        else if(coins>=COST)h+='<button class="adm-btn" style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-weight:900;border-radius:12px;padding:8px 14px" onclick="go(\'pencolor\',null)">🪙 '+COST+'</button>';
        else h+='<div style="font-size:11px;color:var(--red);text-align:center;font-weight:bold">'+COST+'<div style="font-size:9px">ناقص '+(COST-coins)+'</div></div>';
        h+='</div></div>';
        row.insertAdjacentHTML('afterend',h);
        break;
      }
    }
  }catch(e){}
  return r;
};

/* 5) تلوين الرسايل: حدود متوهجة + خط أبيض عادي */
function paintPenAll(){
  try{
    if(!me||!me.penColor)return;
    var c=COLORS.find(function(x){return x.n===me.penColor;});
    if(!c)return;
    var box=el('chatBox');if(!box)return;
    var bubs=box.querySelectorAll('.bub:not(.in):not(.sys)');
    for(var i=0;i<bubs.length;i++){
      if(bubs[i].querySelector('img')||bubs[i].querySelector('audio'))continue;
      bubs[i].style.border='3px solid transparent';
      bubs[i].style.borderRadius='16px';
      bubs[i].style.backgroundImage='linear-gradient(rgba(5,5,15,.85),rgba(5,5,15,.85)),linear-gradient(135deg,'+c.c1+','+c.c2+')';
      bubs[i].style.backgroundOrigin='border-box';
      bubs[i].style.backgroundClip='padding-box,border-box';
      bubs[i].style.boxShadow='0 0 14px '+c.c1+'88,0 0 28px '+c.c2+'44';
      var tk=bubs[i].querySelector('.ticks');
      if(tk)tk.style.color=c.c2;
      var sp=bubs[i].querySelector('.penTxt');
      if(sp){sp.style.background='';sp.style.color='';sp.style.webkitBackgroundClip='';}
    }
  }catch(e){}
}
var _apP5=window.appendMsg;
window.appendMsg=function(m){var r=_apP5(m);try{setTimeout(paintPenAll,60);setTimeout(paintPenAll,350);}catch(e){}return r;};
var _smP5=window.subMsgs;
window.subMsgs=async function(){var r=await _smP5();try{setTimeout(paintPenAll,500);setTimeout(paintPenAll,1500);}catch(e){}return r;};
setInterval(paintPenAll,3000);

/* 6) انتهاء الاشتراك + الربط */
setInterval(async function(){
  try{
    if(!me||!me.penColorExp)return;
    if(Date.now()>me.penColorExp){
      await updateMe({penColor:null,penColorExp:null});
      toast('⏰ انتهى اشتراك لون الرسايل');
    }
  }catch(e){}
},60000);
var _goPC=window.go;
window.go=function(s,nv,fb){
  var r=_goPC(s,nv,fb);
  try{
    if(s==='pencolor')renderPenColorPage();
    if(s==='chat'){setTimeout(buildPen,400);setTimeout(buildPen,1200);}
  }catch(e){}
  return r;
};
var _saPC=window.startAll;
window.startAll=async function(){var r=await _saPC();try{setTimeout(buildPen,1500);}catch(e){}return r;};
setInterval(function(){try{if(el('s-chat')&&el('s-chat').classList.contains('active'))buildPen();}catch(e){}},2000);
})();
/* ===== فتح الإطارات للمشتركين (اشتراك frameExp) ===== */
(function(){
if(window._framesForSubs)return;window._framesForSubs=true;

/* هل العضو له حق استخدام الإطارات؟ */
function canUseFrames(){
  try{
    if(!me)return false;
    return penAdminLike()||(me.frameExp&&me.frameExp>Date.now());
  }catch(e){return false;}
}
function penAdminLike(){try{return isOwnerName(me.name)||isAdmin();}catch(e){return false;}}

/* 1) فتح دالة setFrame: المشترك مسموح له */
var _sfO=window.setFrame;
window.setFrame=async function(url){
  if(!canUseFrames())return toast('🔒 ميزة الإطار تتطلب اشتراك — اشترِ من متجر سونيك');
  await updateMe({frame:url||null});
  try{
    var fresh=await SDB.getUser(me.name);
    if(fresh){me=Object.assign({},me,fresh);usersCache[me.name]=me;}
  }catch(e){}
  toast(url?'تم تعيين الإطار ✅':'تم إزالة الإطار');
  try{updateProfile();}catch(e){}
  try{renderOnline();}catch(e){}
  try{initFrames();}catch(e){}
};

/* 2) شاشة الإطارات: المشترك يشوفها من غير زرار الحذف والرفع (دي للإدارة) */
var _ifO=window.initFrames;
window.initFrames=async function(){
  try{
    var grid=el('framesGrid');if(!grid)return;
    grid.innerHTML='<div style="text-align:center;color:var(--mut);grid-column:1/-1">جاري التحميل...</div>';
    var d=await sb.from('frames').select('*').order('id',{ascending:true});
    if(d.error){grid.innerHTML='<div style="text-align:center;color:var(--red);grid-column:1/-1">خطأ: '+d.error.message+'</div>';return;}
    window.allFrames=d.data||[];
    if(!window.allFrames.length){
      grid.innerHTML='<div style="text-align:center;color:var(--mut);grid-column:1/-1;padding:20px">لا توجد إطارات حالياً — تابعنا قريباً</div>';
      return;
    }
    var isAdminU=penAdminLike();
    var h='';
    window.allFrames.forEach(function(fr){
      var sel=(me&&me.frame===fr.url);
      h+='<div style="position:relative;background:var(--card2);border:2px solid '+(sel?'var(--grn)':'var(--line)')+';border-radius:12px;padding:12px 8px;text-align:center;cursor:pointer" onclick="setFrame(\''+fr.url.replace(/'/g,"\\'")+'\')">';
      h+='<div style="width:70px;height:70px;margin:0 auto 6px;position:relative">';
      h+='<div class="u-ava" style="width:42px;height:42px;position:absolute;top:14px;left:14px;z-index:1">👨</div>';
      h+='<img src="'+fr.url+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:2" onerror="this.style.display=\'none\'"></div>';
      if(sel)h+='<div style="font-size:10px;color:var(--grn);font-weight:bold">✅ مُعيّن</div>';
      if(isAdminU)h+='<button class="xbtn" style="position:absolute;top:4px;left:4px;padding:2px 6px;font-size:10px" onclick="event.stopPropagation();delFrame('+fr.id+')">✕</button>';
      h+='</div>';
    });
    /* زرار الرفع للإدارة فقط */
    if(isAdminU)h+='<div style="background:var(--card2);border:2px dashed var(--line);border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:32px;min-height:110px;color:var(--acc)" onclick="document.getElementById(\'frameInput\').click()">➕</div>';
    grid.innerHTML=h;
  }catch(e){}
};

/* 3) عنصر "إطار الصورة" يظهر للمشتركين في الإعدادات */
setInterval(function(){
  try{
    if(!me)return;
    var fm=el('frameMenuItem');
    if(fm)fm.style.display=canUseFrames()?'flex':'none';
  }catch(e){}
},2000);

/* 4) عند انتهاء الاشتراك: الإطار يتعمل Reset (زي ما هو في باتش المتجر) */
setInterval(async function(){
  try{
    if(!me||!me.frameExp)return;
    if(Date.now()>me.frameExp){
      await updateMe({frameExp:null,framesUnlocked:false,frame:null});
      toast('⏰ انتهت مدة الإطار — جددها من متجر سونيك');
      try{initFrames();}catch(e){}
      try{updateProfile();renderOnline();}catch(e){}
    }
  }catch(e){}
},60000);
})();
/* ===== إصلاح: الإطار المُعيّن يظهر فوراً حول الصورة ===== */
(function(){
if(window._frameShowFix)return;window._frameShowFix=true;

/* 1) ترقية getAvatarHTML: الإطار يظهر لكل من عنده frameExp نشط (مش بس الإدارة) */
window.getAvatarHTML=function(u,size){
  size=size||46;
  var ava=getAvatar(u);
  var hasFrame=false;
  try{
    hasFrame=u&&u.frame&&(
      isOwnerName(u.name)||isAdmin()||(u.role&&(u.role.indexOf('إدارة')>-1||u.role.indexOf('سوبر')>-1))||
      (u.frameExp&&u.frameExp>Date.now())
    );
  }catch(e){}
  if(hasFrame){
    return '<div class="ava-frame-wrap" style="width:'+(size+14)+'px;height:'+(size+14)+'px"><div class="u-ava" style="width:'+size+'px;height:'+size+'px">'+ava+'</div><img class="frame-img" src="'+u.frame+'" style="position:absolute;inset:-4px;width:calc(100% + 8px);height:calc(100% + 8px);object-fit:contain;pointer-events:none;z-index:3"></div>';
  }
  return '<div class="u-ava" style="width:'+size+'px;height:'+size+'px">'+ava+'</div>';
};

/* 2) إعادة رسم فورية بعد تعيين الإطار */
var _sfN=window.setFrame;
window.setFrame=async function(url){
  var r=await _sfN(url);
  try{
    /* نحدّث الكاش ونرسم كل حاجة فوراً */
    var fresh=await SDB.getUser(me.name);
    if(fresh){me=Object.assign({},me,fresh);usersCache[me.name]=me;}
    try{updateProfile();}catch(e){}
    try{renderOnline();}catch(e){}
    try{renderMsgs();}catch(e){}
    try{refreshChatHeader(usersCache[chat&&chat.id]||me);}catch(e){}
    try{initFrames();}catch(e){}
  }catch(e){}
  return r;
};

/* 3) فحص دوري: أي مكان فيه أفاتار من غير إطار وهو مطلوب = يترسم */
setInterval(function(){
  try{
    if(!me||!me.frame)return;
    /* شاشة أونلاين */
    var box=el('usersList');
    if(box&&box.innerHTML&&box.innerHTML.indexOf('ava-frame-wrap')===-1&&box.innerHTML.indexOf('u-ava')>-1){
      try{renderOnline();}catch(e){}
    }
    /* البروفايل الشخصي في الإعدادات */
    try{updateProfile();}catch(e){}
  }catch(e){}
},5000);
})();
/* ===== إضافة 10 ألوان جديدة لنظام لون الرسايل ===== */
(function(){
if(window._penExtra)return;window._penExtra=true;
var COST=100,DAYS=30;
var EXTRA=[
 {n:'توتي',c1:'#E040FB',c2:'#7C4DFF'},
 {n:'فيروزي',c1:'#00BFA5',c2:'#00E5FF'},
 {n:'ليموني',c1:'#C6FF00',c2:'#AEEA00'},
 {n:'بنفسجي غامق',c1:'#6200EA',c2:'#B388FF'},
 {n:'برتقالي ناري',c1:'#FF6D00',c2:'#FFAB40'},
 {n:'سماوي غامق',c1:'#0288D1',c2:'#4FC3F7'},
 {n:'وردي نيون',c1:'#F50057',c2:'#FF4081'},
 {n:'لازوردي',c1:'#2962FF',c2:'#82B1FF'},
 {n:'عسلي',c1:'#FFA726',c2:'#FFD180'},
 {n:'أرجواني',c1:'#AA00FF',c2:'#EA80FC'}
];
/* الدمج: الألوان الـ16 القديمة + الـ10 الجديدة = 26 */
window._PENC=(window._PENC||[]).concat(EXTRA);

function penActive(){try{return me&&me.penColorExp&&me.penColorExp>Date.now();}catch(e){return false;}}
function penAdmin(){try{return me&&(isOwnerName(me.name)||isAdmin());}catch(e){return false;}}
function findC(n){try{return window._PENC.find(function(x){return x.n===n;})||null;}catch(e){return null;}}

/* 1) القايمة المنبثقة (القلم) — تقرأ من المصفوفة الكاملة 26 */
window.openPenPalette=function(){
  if(!me)return toast('سجل دخولك أولاً');
  var old=el('penPalette');if(old)old.remove();
  var g=findC(me.penColor);
  var m=document.createElement('div');m.id='penPalette';m.className='modal';
  var h='<div class="m-card2" style="width:320px;max-height:85vh;overflow-y:auto"><h3>✨ لون رسائلك</h3>'
  +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
  window._PENC.forEach(function(c){
    var sel=g&&g.n===c.n;
    h+='<div onclick="pickPenApply(\''+c.n+'\')" style="cursor:pointer;border:2px solid '+(sel?'#fff':'transparent')+';border-radius:14px;padding:12px 8px;text-align:center;background:var(--bg)">';
    h+='<div style="border:2.5px solid transparent;border-radius:14px;padding:10px 6px;background-image:linear-gradient(rgba(5,5,15,.85),rgba(5,5,15,.85)),linear-gradient(135deg,'+c.c1+','+c.c2+');background-origin:border-box;background-clip:padding-box,border-box;box-shadow:0 0 14px '+c.c1+'88;margin-bottom:7px">';
    h+='<div style="background:linear-gradient(135deg,'+c.c1+','+c.c2+');-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:900;font-size:13.5px">اكتب رسالتك</div></div>';
    h+='<div style="font-size:12px;font-weight:bold;color:var(--txt)">'+c.n+(sel?' ✅':'')+'</div></div>';
  });
  h+='</div>';
  if(!penAdmin()&&!penActive())h+='<button style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-weight:900" onclick="closeModal(\'penPalette\');go(\'pencolor\',null)">🪙 اشترك بـ '+COST+' عملة — شهر كامل</button>';
  h+='<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="pickPenColor(null)">❌ من غير لون (عادي)</button></div>';
  m.innerHTML=h;
  m.onclick=function(e){if(e.target===m)closeModal('penPalette');};
  document.body.appendChild(m);
  m.classList.add('open');
};

/* 2) صفحة الإعدادات الكاملة — 26 لون */
window.renderPenColorPage=function(){
  try{
    var box=el('penScreenBody');if(!box||!me)return;
    var coins=(me.coins)||0;
    var g=findC(me.penColor);
    var h='';
    h+='<div style="background:radial-gradient(ellipse at top,#2a1044,#141038);border-radius:18px;padding:22px 14px;text-align:center;margin-bottom:12px;border:1px solid rgba(139,92,246,.3)">';
    h+='<div style="font-size:17px;font-weight:900;color:#fff">🎨 لون رسايلك</div>';
    h+='<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:5px">رسايلك تطلع بإطار متوهج بلونك في كل الشاتات</div>';
    h+='<div style="margin-top:14px;display:inline-block;padding:12px 24px;border-radius:18px;font-weight:900;font-size:15px;color:#fff;';
    if(g){h+='border:3px solid transparent;background-image:linear-gradient(rgba(10,10,25,.85),rgba(10,10,25,.85)),linear-gradient(135deg,'+g.c1+','+g.c2+');background-origin:border-box;background-clip:padding-box,border-box;box-shadow:0 0 18px '+g.c1+'99';}
    else{h+='background:var(--card2);border:2px dashed var(--line);';}
    h+='">اكتب رسالتك</div></div>';
    if(penAdmin()){h+='<div style="background:rgba(139,92,246,.12);border:1px solid #8B5CF6;border-radius:12px;padding:10px;margin-bottom:12px;text-align:center;font-size:12.5px;color:#c4b5fd;font-weight:bold">👑 إدارة — مجاني دائماً</div>';}
    else if(penActive()){h+='<div style="background:rgba(34,211,238,.12);border:1px solid #22d3ee;border-radius:12px;padding:10px;margin-bottom:12px;text-align:center;font-size:13px;color:#22d3ee;font-weight:bold">✅ اشتراكك نشط — متبقي '+Math.ceil((me.penColorExp-Date.now())/86400000)+' يوم</div>';}
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    window._PENC.forEach(function(c){
      var sel=g&&g.n===c.n;
      h+='<div onclick="pickPenApply(\''+c.n+'\')" style="cursor:pointer;border:2px solid '+(sel?'#fff':'var(--line)')+';border-radius:14px;padding:12px 8px;text-align:center;background:var(--card)">';
      h+='<div style="border:2.5px solid transparent;border-radius:14px;padding:10px 6px;background-image:linear-gradient(rgba(5,5,15,.85),rgba(5,5,15,.85)),linear-gradient(135deg,'+c.c1+','+c.c2+');background-origin:border-box;background-clip:padding-box,border-box;box-shadow:0 0 14px '+c.c1+'77;margin-bottom:7px">';
      h+='<div style="background:linear-gradient(135deg,'+c.c1+','+c.c2+');-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:900;font-size:13.5px">اكتب رسالتك</div></div>';
      h+='<div style="font-size:12.5px;font-weight:bold;color:var(--txt)">'+c.n+(sel?' ✅':'')+'</div></div>';
    });
    h+='</div>';
    box.innerHTML=h;
  }catch(e){}
};

/* 3) منطق الاختيار (يشمل الاشتراك) — يقرأ من المصفوفة الكاملة */
window.pickPenApply=function(n){
  if(!me)return;
  var c=findC(n);if(!c)return;
  if(!penAdmin()&&!penActive()){
    if((me.coins||0)<COST){toast('🪙 العملات غير كافية — يرجي الشحن (ناقصك '+(COST-(me.coins||0))+' عملة)');return;}
    if(!confirm('اشتراك لون الرسايل بـ '+COST+' عملة لمدة '+DAYS+' يوم؟'))return;
    updateMe({coins:(me.coins||0)-COST,penColorExp:Date.now()+DAYS*86400000,penColor:n}).then(function(){
      closeModal('penPalette');
      toast('🎉 تم الاشتراك! شهر كامل');
      updatePenLook();paintPenAll();try{renderShop();}catch(e){}
    });
    return;
  }
  updateMe({penColor:n}).then(function(){
    closeModal('penPalette');
    toast('✨ رسايلك بقت بلون: '+n);
    updatePenLook();paintPenAll();
  });
};

/* 4) القلم يعرف الألوان الجديدة */
window.restylePen=function(){
  try{
    var btn=el('penColorBtn');if(!btn)return;
    var g=findC(me&&me.penColor);
    btn.innerHTML='✨';
    if(g){
      btn.style.background='linear-gradient(135deg,'+g.c1+','+g.c2+')';
      btn.style.boxShadow='0 0 14px '+g.c1+',0 0 26px '+g.c2+'66';
      btn.style.border='2px solid #fff';
    }else{
      btn.style.background='linear-gradient(135deg,#8B5CF6,#D946EF)';
      btn.style.boxShadow='0 0 12px rgba(139,92,246,.7)';
      btn.style.border='2px solid rgba(217,70,239,.5)';
    }
  }catch(e){}
};

/* 5) تلوين الرسايل يقرأ من المصفوفة الكاملة */
window.paintPenAll=function(){
  try{
    if(!me||!me.penColor)return;
    var c=findC(me.penColor);
    if(!c)return;
    var box=el('chatBox');if(!box)return;
    var bubs=box.querySelectorAll('.bub:not(.in):not(.sys)');
    for(var i=0;i<bubs.length;i++){
      if(bubs[i].querySelector('img')||bubs[i].querySelector('audio'))continue;
      bubs[i].style.border='3px solid transparent';
      bubs[i].style.borderRadius='16px';
      bubs[i].style.backgroundImage='linear-gradient(rgba(5,5,15,.85),rgba(5,5,15,.85)),linear-gradient(135deg,'+c.c1+','+c.c2+')';
      bubs[i].style.backgroundOrigin='border-box';
      bubs[i].style.backgroundClip='padding-box,border-box';
      bubs[i].style.boxShadow='0 0 14px '+c.c1+'88,0 0 28px '+c.c2+'44';
      var tk=bubs[i].querySelector('.ticks');
      if(tk)tk.style.color=c.c2;
      var sp=bubs[i].querySelector('.penTxt');
      if(sp){sp.style.background='';sp.style.color='';sp.style.webkitBackgroundClip='';}
    }
  }catch(e){}
};
})();
/* ===== توست مباشر: تم تغيير لون الخط ===== */
(function(){
if(window._toastFinal)return;window._toastFinal=true;

/* دالة توست مضمونة 100% — مستقلة عن أي كود تاني */
window.showLineToast=function(msg){
  try{
    var t=document.createElement('div');
    t.innerText=msg;
    t.style.cssText='position:fixed;top:15px;left:50%;transform:translateX(-50%);background:#22c55e;color:#fff;padding:12px 22px;border-radius:22px;z-index:99999;font-size:14px;font-weight:bold;box-shadow:0 4px 14px rgba(0,0,0,.5);text-align:center;max-width:85%';
    document.body.appendChild(t);
    setTimeout(function(){t.remove();},2500);
  }catch(e){}
};

/* نعترض اختيار اللون في كل الطرق الممكنة */
window._interceptPick=function(n){
  try{
    if(n)window.showLineToast('✅ تم تغيير لون الخط بنجاح');
    else window.showLineToast('↩️ رجعت اللون العادي');
  }catch(e){}
};

/* 1) في القايمة المنبثقة */
var _ppa2=window.pickPenApply;
window.pickPenApply=function(n){
  var r=_ppa2?_ppa2(n):undefined;
  setTimeout(function(){window._interceptPick(n);},80);
  return r;
};

/* 2) في الصفحة الكاملة */
var _ppsc=window.pickPenScreenColor;
window.pickPenScreenColor=function(n){
  var r=_ppsc?_ppsc(n):undefined;
  setTimeout(function(){window._interceptPick(n);},80);
  return r;
};

/* 3) من زرار "من غير لون" */
var _ppc3=window.pickPenColor;
window.pickPenColor=function(n){
  var r=_ppc3?_ppc3(n):undefined;
  setTimeout(function(){window._interceptPick(n);},80);
  return r;
};
})();
/* ===== تلوين الرسايل في كل الشاتات: خاص + الغرف ===== */
(function(){
if(window._allChatsFix)return;window._allChatsFix=true;

var COLORS=[
 {n:'نيون وردي',c1:'#FF3EF5',c2:'#FF71CE'},{n:'بنفسجي',c1:'#A855F7',c2:'#E879F9'},
 {n:'سماوي',c1:'#22D3EE',c2:'#67E8F9'},{n:'أخضر',c1:'#22C55E',c2:'#86EFAC'},
 {n:'ذهبي',c1:'#FBBF24',c2:'#FDE047'},{n:'أحمر',c1:'#EF4444',c2:'#FB7185'},
 {n:'أزرق',c1:'#3B82F6',c2:'#93C5FD'},{n:'برتقالي',c1:'#F97316',c2:'#FDBA74'},
 {n:'مجرة',c1:'#8B5CF6',c2:'#38BDF8'},{n:'وردي',c1:'#EC4899',c2:'#F9A8D4'},
 {n:'شفق',c1:'#06B6D4',c2:'#4ADE80'},{n:'زمردي',c1:'#10B981',c2:'#6EE7B7'},
 {n:'ناري',c1:'#F43F5E',c2:'#FB923C'},{n:'غروب',c1:'#FB7185',c2:'#FDBA74'},
 {n:'ليلي',c1:'#7C3AED',c2:'#C4B5FD'},{n:'توتي',c1:'#E040FB',c2:'#7C4DFF'},
 {n:'فيروزي',c1:'#00BFA5',c2:'#00E5FF'},{n:'ليموني',c1:'#C6FF00',c2:'#AEEA00'},
 {n:'بنفسجي غامق',c1:'#6200EA',c2:'#B388FF'},{n:'برتقالي ناري',c1:'#FF6D00',c2:'#FFAB40'},
 {n:'سماوي غامق',c1:'#0288D1',c2:'#4FC3F7'},{n:'وردي نيون',c1:'#F50057',c2:'#FF4081'},
 {n:'لازوردي',c1:'#2962FF',c2:'#82B1FF'},{n:'عسلي',c1:'#FFA726',c2:'#FFD180'},
 {n:'أرجواني',c1:'#AA00FF',c2:'#EA80FC'},{n:'سماوي غامق 2',c1:'#0288D1',c2:'#4FC3F7'}
];

function paintEverywhere(){
  try{
    if(!me||!me.penColor)return;
    var c=COLORS.find(function(x){return x.n===me.penColor;});
    if(!c)return;
    /* كل الفقاعات بتاعة أنا — في الخاص والغرف على السواء */
    var bubs=document.querySelectorAll('.bub:not(.in):not(.sys)');
    for(var i=0;i<bubs.length;i++){
      var b=bubs[i];
      if(b.querySelector('img')||b.querySelector('audio'))continue;
      b.style.border='3px solid transparent';
      b.style.borderRadius='16px';
      b.style.backgroundImage='linear-gradient(rgba(5,5,15,.85),rgba(5,5,15,.85)),linear-gradient(135deg,'+c.c1+','+c.c2+')';
      b.style.backgroundOrigin='border-box';
      b.style.backgroundClip='padding-box,border-box';
      b.style.boxShadow='0 0 14px '+c.c1+'88,0 0 28px '+c.c2+'44';
      var tk=b.querySelector('.ticks');
      if(tk)tk.style.color=c.c2;
      /* الخط أبيض */
      var sp=b.querySelector('.penTxt');
      if(sp){sp.style.background='';sp.style.color='#fff';sp.style.webkitBackgroundClip='';}
    }
  }catch(e){}
}

/* بعد أي رسالة جديدة — في أي شات */
var _apAC=window.appendMsg;
window.appendMsg=function(m){
  var r=_apAC(m);
  try{setTimeout(paintEverywhere,60);setTimeout(paintEverywhere,350);}catch(e){}
  return r;
};
/* بعد فتح أي شات */
var _smAC=window.subMsgs;
window.subMsgs=async function(){
  var r=await _smAC();
  try{setTimeout(paintEverywhere,500);setTimeout(paintEverywhere,1500);setTimeout(paintEverywhere,3000);}catch(e){}
  return r;
};
/* دوري مستمر */
setInterval(paintEverywhere,2500);
/* بعد اختيار لون جديد */
var _ppAC=window.pickPenColor;
window.pickPenColor=function(n){var r=_ppAC?_ppAC(n):undefined;try{setTimeout(paintEverywhere,300);}catch(e){}return r;};
var _ppaAC=window.pickPenApply;
window.pickPenApply=function(n){var r=_ppaAC?_ppaAC(n):undefined;try{setTimeout(paintEverywhere,300);}catch(e){}return r;};
})();
/* ===== 🖼️ خلفية الصفحة الافتراضية + تغييرها لكل عضو ===== */
(function(){
if(window._pageBgNew)return;window._pageBgNew=true;
var DEFAULT_BG='https://cdn.phototourl.com/member/2026-10-04-7ae8f3b0-456e-41c0-9065-572be6aaad49.jpg';

/* 1) الخلفية الافتراضية: لكل الأعضاء (تتحفظ محلياً أول دخول) */
(function(){
  try{
    if(!LS.getItem('page_bg'))LS.setItem('page_bg',DEFAULT_BG);
  }catch(e){}
})();

/* 2) إضافة عنصر تغيير الخلفية في إعدادات المظهر */
try{
  var scr=el('s-appearance');
  if(scr&&!el('pageBgItem')){
    var row=document.createElement('div');
    row.className='set-row';row.id='pageBgItem';
    row.style.display='block';
    row.innerHTML='<h4>🖼️ خلفية الموقع</h4>'
    +'<p>اختار خلفية تخصك — ليك انت بس</p>'
    +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px">'
    +'<button class="adm-btn" onclick="document.getElementById(\'pageBgPickInput\').click()">📷 اختيار خلفية</button>'
    +'<button class="adm-btn red" onclick="resetPageBgDefault()">↩️ رجوع الافتراضية</button>'
    +'<input type="file" id="pageBgPickInput" accept="image/*,.gif" style="display:none" onchange="setMyPageBg(event)">'
    +'</div>';
    /* نحطها أول إعدادات المظهر */
    var first=scr.querySelector('.set-row');
    if(first)scr.insertBefore(row,first);else scr.appendChild(row);
  }
}catch(e){}

/* 3) تغيير الخلفية الشخصية (للكل عضو) */
window.setMyPageBg=function(e){
  var f=e.target.files[0];if(!f)return;
  toast('⏳ جاري تغيير الخلفية...');
  compressImg(f,function(dataUrl){
    try{
      LS.setItem('page_bg',dataUrl);
      applyPageBg();
      forceRepaint();
      toast('🖼️ تم تغيير خلفيتك ✅');
    }catch(e){toast('الصورة كبيرة — جرب صورة أصغر');}
  });
  e.target.value='';
};

/* 4) رجوع الخلفية الافتراضية */
window.resetPageBgDefault=function(){
  try{
    LS.setItem('page_bg',DEFAULT_BG);
    applyPageBg();
    forceRepaint();
    toast('↩️ رجعت الخلفية الافتراضية');
  }catch(e){}
};

/* 5) التأكد إن applyPageBg بتحترم اختيار العضو (لو هو غيرها تظهر خلفيته) */
var _apb=window.applyPageBg;
window.applyPageBg=function(){
  var r=_apb?_apb():undefined;
  try{
    var bg=LS.getItem('page_bg');
    if(bg){
      var dim=(LS.getItem('page_dim')||40)/100;
      document.body.style.backgroundImage='linear-gradient(rgba(0,0,0,'+dim+'),rgba(0,0,0,'+dim+')),url('+bg+')';
      document.body.style.backgroundSize='cover';
      document.body.style.backgroundPosition='center';
      document.body.style.backgroundAttachment='scroll';
    }
  }catch(e){}
  return r;
};
})();
/* ===== إصلاح الإيموجي الشامل: أي إيموجي قديم أو جديد يظهر على أي جهاز ===== */
(function(){
  /* 1) تحميل خط الإيموجي العالمي (بيحمل بس الرموز المستخدمة - خفيف) */
  if(!document.getElementById('notoEmojiFont')){
    var l=document.createElement('link');
    l.id='notoEmojiFont';
    l.rel='stylesheet';
    l.href='https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap';
    document.head.appendChild(l);
  }

  /* 2) تطبيق الخط على كل عناصر الموقع — الإيموجي اللي الجهاز مش يعرفه يتسحب من الخط */
  var old=document.getElementById('emojiFontFix');
  if(old)old.remove();
  var st=document.createElement('style');
  st.id='emojiFontFix';
  st.textContent="body,div,span,p,b,strong,h1,h2,h3,h4,label,button,a,td,th,li,input,textarea,select,.bub,.chat-box,.chat-input,.chat-input input,.u-name,.u-card,.m-card,.m-last,.m-name,.m-card2,.w-body,.w-name,.w-comment,.w-time,.set-row,.m-item,.reply-bar,#replyText,.st-txt,.reaction-btn,.mention,.typing-indicator,.msg-menu,.chat-menu,.modal,.empty,.log-row,.w-post,.w-btn,.lpB,.lpT,.lpCard,.lpFAQ,.nbadge,.m-badge,.ticks,.watermark,#chatStatus,#chatName,#chatMenu,#storyViewBox,#storyReplyInput,#msgInput,#announceBannerText,#announceBanner,#currentAnnounce,#scText,#stText,#stTxArea{font-family:system-ui,-apple-system,sans-serif,'Noto Color Emoji'!important}";
  document.head.appendChild(st);

  /* 3) أي رسالة جديدة تتعمل بعدين بياخد نفس الخط أوتوماتيك من الـ CSS فوق */
})();
/* ===== 🎁 إرسال هدية عملات داخل الشات ===== */
(function(){
if(window._giftSys)return;window._giftSys=true;
var MIN_GIFT=10;

/* 1) زرار الهدية في قائمة الشات (الخاص فقط) */
var _tcG=window.toggleChatMenu;
window.toggleChatMenu=function(e){
  try{
    if(e)e.stopPropagation();
    var menu=el('chatMenu');
    if(!menu)return _tcG?_tcG(e):undefined;
    if(chat&&chat.type==='user'){
      var _mm=(me&&me.allowMedia===false)?'<button onclick="toggleMediaPerm()" id="mediaPermBtn">🖼️ '+(me.mediaBlock&&me.mediaBlock[chat.id]?'السماح بالوسائط':'منع الوسائط')+'</button>':'';
      menu.innerHTML=_mm
      +'<button onclick="openGiftModal()">🎁 إرسال هدية عملات</button>'
      +'<button onclick="openReport()">🚨 إبلاغ الإدارة</button>'
      +'<button onclick="toggleChatSearch()">🔍 بحث في المحادثة</button>'
      +'<button onclick="delChat()">🗑️ حذف المحادثة</button>'
      +'<button onclick="blockTarget()" id="chatBlockBtn">⛔ حظر المستخدم</button>';
    }else{
      menu.innerHTML='<button onclick="toggleChatSearch()">🔍 بحث في المحادثة</button>';
    }
    menu.classList.toggle('open');
  }catch(err){if(_tcG)_tcG(e);}
};

/* 2) نافذة الهدية */
window.openGiftModal=function(){
  if(!chat||chat.type!=='user')return toast('افتح محادثة خاصة أولاً');
  if(isBlockedByMe(chat.id))return toast('⛔ حظرت هذا المستخدم');
  var coins=(me.coins)||0;
  var old=el('giftModal');if(old)old.remove();
  var m=document.createElement('div');m.id='giftModal';m.className='modal';
  m.innerHTML='<div class="m-card2" style="width:320px">'
  +'<h3 style="color:#FFD700">🎁 إرسال هدية</h3>'
  +'<p style="font-size:12.5px;text-align:center;color:var(--txt)">هديتك لـ <b style="color:var(--acc)">'+escapeHtml(getMsgName(chat.id))+'</b></p>'
  +'<input id="giftAmount" type="number" min="'+MIN_GIFT+'" placeholder="عدد العملات (من '+MIN_GIFT+')" style="width:100%;padding:12px;background:var(--bg);border:2px solid #FFD700;color:var(--txt);border-radius:12px;font-size:18px;font-weight:900;text-align:center">'
  +'<div style="font-size:11px;color:var(--mut);text-align:center;margin:6px 0">رصيدك: 🪙 '+coins+' عملة</div>'
  +'<div style="display:flex;gap:6px;justify-content:center;margin-bottom:8px">'
  +'<button class="adm-btn" style="background:var(--card2);color:var(--txt)" onclick="el(\'giftAmount\').value=50">50</button>'
  +'<button class="adm-btn" style="background:var(--card2);color:var(--txt)" onclick="el(\'giftAmount\').value=100">100</button>'
  +'<button class="adm-btn" style="background:var(--card2);color:var(--txt)" onclick="el(\'giftAmount\').value=250">250</button>'
  +'<button class="adm-btn" style="background:var(--card2);color:var(--txt)" onclick="el(\'giftAmount\').value=500">500</button>'
  +'</div>'
  +'<button style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-weight:900" onclick="sendGift()">🎁 إرسال الهدية</button>'
  +'<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'giftModal\')">إلغاء</button></div>';
  m.onclick=function(e){if(e.target===m)closeModal('giftModal');};
  document.body.appendChild(m);
  m.classList.add('open');
};

/* 3) تنفيذ الإرسال */
window.sendGift=async function(){
  if(!chat||chat.type!=='user')return;
  var amt=parseInt(el('giftAmount').value);
  if(isNaN(amt)||amt<MIN_GIFT)return toast('أقل هدية: '+MIN_GIFT+' عملة');
  var coins=(me.coins)||0;
  if(coins<amt)return toast('🪙 عملاتك مش كفاية — رصيدك '+coins);
  var to=chat.id;
  if(!confirm('إرسال هدية بـ '+amt+' عملة لـ '+getMsgName(to)+'؟'))return;
  closeModal('giftModal');
  /* الخصم والإضافة */
  await updateMe({coins:coins-amt});
  var u=await SDB.getUser(to);
  if(!u)return toast('العضو غير موجود');
  await SDB.patchUser(to,{coins:((u.coins)||0)+amt});
  /* رسالة الهدية في الشات */
  var convId=curConvId();
  var m={_id:'m'+Date.now()+'g'+Math.random().toString(36).slice(2),_conv:convId,from:me.name,data:'',type:'text',time:Date.now(),replyTo:null,edited:false,deleted:false,read:false,reactions:{},meta:{gift:true,amount:amt}};
  msgsCache.push(m);appendMsg(m);scrollChat();
  await SDB.addMsg(m);
  await SDB.upsertConv(convId,{a:me.name,b:to,t:Date.now(),lastFrom:me.name,lastMsg:'🎁 هدية '+amt+' عملة'});
  /* إشعار فوري للمستلم */
  try{
    var arr=(await SDB.loadSettings()).gift_notices;
    arr=Array.isArray(arr)?arr:[];
    arr.push({id:'gn'+Date.now(),to:to,amount:amt,from:me.name,time:Date.now()});
    if(arr.length>200)arr=arr.slice(-200);
    await SDB.saveSetting('gift_notices',arr);
  }catch(e){}
  toast('🎁 تم إرسال هدية '+amt+' عملة!');
  try{logActivity('gift','هدية '+amt+' عملة من '+me.name+' إلى '+to);}catch(e){}
};

/* 4) عرض رسالة الهدية بشكل ذهبي فخم */
var _rmcG=window.renderMsgContent;
window.renderMsgContent=function(m){
  try{
    if(m&&m.meta&&m.meta.gift&&!m.deleted){
      var isMine=(m.from===me.name);
      var html='<div style="background:linear-gradient(135deg,#3a2a00,#1a1400);border:2px solid #FFD700;border-radius:18px;padding:16px;text-align:center;min-width:190px;box-shadow:0 0 18px rgba(255,215,0,.35)">';
      html+='<div style="font-size:40px;margin-bottom:4px">🎁</div>';
      html+='<div style="font-size:17px;font-weight:900;color:#FFD700">هدية '+m.meta.amount+' عملة</div>';
      html+='<div style="font-size:11px;color:rgba(255,215,0,.7);margin-top:4px">'+(isMine?'أرسلتها لـ '+escapeHtml(getMsgName(chat&&chat.id||'')):'وصلتك هدية! 🎉')+'</div>';
      html+='</div>';
      if(m.from===me.name)html+=' <span class="ticks '+(m.read?'read':'')+'">'+(m.read?'✓✓':'✓')+'</span>';
      return html;
    }
  }catch(e){}
  return _rmcG?_rmcG(m):'';
};

/* 5) استلام الإشعار: فوري بالفحص السريع + نافذة ذهبية */
var _lastGiftChk=0;
window.checkGiftNotices=async function(){
  try{
    if(!me)return;
    var now=Date.now();
    if(now-_lastGiftChk<8000)return;
    _lastGiftChk=now;
    var s=await SDB.loadSettings();
    var arr=Array.isArray(s.gift_notices)?s.gift_notices:[];
    var mine=arr.filter(function(x){return x&&x.to===me.name;});
    if(!mine.length)return;
    var rest=arr.filter(function(x){return !(x&&x.to===me.name);});
    await SDB.saveSetting('gift_notices',rest);
    var old=el('giftNoticeModal');if(old)old.remove();
    var m=document.createElement('div');m.id='giftNoticeModal';m.className='modal';
    var list='';
    mine.forEach(function(x){
      list+='<div style="background:linear-gradient(135deg,#3a2a00,#1a1400);border:2px solid #FFD700;border-radius:14px;padding:14px;margin-bottom:8px;text-align:center">'
      +'<div style="font-size:34px">🎁</div>'
      +'<div style="font-size:16px;font-weight:900;color:#FFD700">وصلتك هدية بـ '+x.amount+' عملة!</div>'
      +'<div style="font-size:12px;color:rgba(255,215,0,.8);margin-top:4px">من: '+escapeHtml(getMsgName(x.from))+'</div></div>';
    });
    m.innerHTML='<div class="m-card2" style="width:320px"><h3 style="color:#FFD700">🎁 هدايا وصلتك</h3>'+list
    +'<button style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111" onclick="closeModal(\'giftNoticeModal\')">شكراً! 🎉</button></div>';
    m.onclick=function(e){if(e.target===m)closeModal('giftNoticeModal');};
    document.body.appendChild(m);
    m.classList.add('open');
    if(me.sndNotif!==false)try{beep(1200);}catch(e){}
  }catch(e){}
};
var _saGN=window.startAll;
window.startAll=async function(){var r=await _saGN();try{checkGiftNotices();}catch(e){}return r;};
setInterval(function(){try{checkGiftNotices();}catch(e){}},15000);
})();
/* ===== 📊 سجل المعاملات (صرف/هدايا/مشتريات) ===== */
(function(){
if(window._transLog)return;window._transLog=true;

/* 1) دالة تسجيل موحدة */
window.logTrans=function(type,amount,detail,other){
  try{
    var all=JSON.parse(LS.getItem('trans_log_'+me.name)||'[]');
    all.push({type:type,amount:amount,detail:detail||'',other:other||'',time:Date.now()});
    if(all.length>200)all=all.slice(-200);
    LS.setItem('trans_log_'+me.name,JSON.stringify(all));
  }catch(e){}
};

/* 2) التسجيل تلقائي مع كل عملية */

/* أ) الهدايا المرسلة */
var _sgT=window.sendGift;
window.sendGift=async function(){
  var to=chat&&chat.id;
  var amt=parseInt(el('giftAmount')?el('giftAmount').value:0);
  var r=await _sgT();
  try{if(to&&amt>=10)logTrans('gift_sent',amt,'هدية مرسلة',to);}catch(e){}
  return r;
};
/* الهدايا المستلمة: عند الفحص */
var _cgn=window.checkGiftNotices;
window.checkGiftNotices=async function(){
  try{
    if(me){
      var s=await SDB.loadSettings();
      var arr=Array.isArray(s.gift_notices)?s.gift_notices:[];
      var mine=arr.filter(function(x){return x&&x.to===me.name;});
      mine.forEach(function(x){
        try{
          var all=JSON.parse(LS.getItem('trans_log_'+me.name)||'[]');
          all.push({type:'gift_recv',amount:x.amount,detail:'هدية مستلمة',other:x.from||'',time:x.time||Date.now()});
          LS.setItem('trans_log_'+me.name,JSON.stringify(all));
        }catch(e){}
      });
    }
  }catch(e){}
  return _cgn?await _cgn():undefined;
};

/* ب) مشتريات المتجر */
var _bp=window.buyProduct;
window.buyProduct=async function(k){
  var names={frame:'إطار حول صورتك',name:'تميّز الاسم',hide:'الوضع المخفي',namecolor:'ألوان الاسم',framesFree:'قسم الجيمنج VIP'};
  var costs={frame:100,name:130,hide:80,namecolor:60,framesFree:150};
  var r=await _bp(k);
  try{if(names[k])logTrans('buy',costs[k],'شراء: '+names[k],'');}catch(e){}
  return r;
};

/* ج) اشتراك لون الرسايل */
var _ppsT=window.pickPenScreenColor;
window.pickPenScreenColor=function(n){
  var before=(me&&me.coins)||0;
  var r=_ppsT?_ppsT(n):undefined;
  setTimeout(function(){
    try{
      var after=(me&&me.coins)||0;
      if(after<before)logTrans('buy',before-after,'اشتراك: لون الرسايل','');
    }catch(e){}
  },2000);
  return r;
};

/* د) اشتراك تميّز الاسم بالعملات */
var _pna=window._payNameSub;
window._payNameSub=function(i){
  var r=_pna?_pna(i):undefined;
  try{setTimeout(function(){logTrans('buy',130,'اشتراك: تميّز الاسم','');},2000);}catch(e){}
  return r;
};

/* هـ) شحن عملات (لما الإدارة توافق) */
var _apT3=window.approveTopup;
window.approveTopup=async function(id,amount,user){
  var r=await _apT3(id,amount,user);
  try{
    var all=JSON.parse(LS.getItem('trans_log_'+user)||'[]');
    var d=await sb.from('topup_requests').select('price').eq('id',id).limit(1);
    var price=(d.data&&d.data[0]&&d.data[0].price)||0;
    all.push({type:'topup',amount:amount,detail:'شحن ('+price+' جنيه)',other:'',time:Date.now()});
    if(all.length>200)all=all.slice(-200);
    LS.setItem('trans_log_'+user,JSON.stringify(all));
  }catch(e){}
  return r;
};

/* 3) الشاشة */
if(!el('s-translog')){
  var scr=document.createElement('div');
  scr.className='screen';scr.id='s-translog';
  scr.innerHTML='<div class="sub-title" onclick="go(\'settings\')">➔ سجل المعاملات</div><div id="transBody" style="padding:4px"></div>';
  var content=document.querySelector('.content');
  var ref=el('s-settings');
  if(ref&&ref.parentElement)content.insertBefore(scr,ref);
  else content.appendChild(scr);
}

try{
  var lists=document.querySelectorAll('#s-settings .menu-list');
  var tgt=lists[0];
  if(tgt&&!el('transMenuItem')){
    var mi=document.createElement('div');
    mi.className='m-item';mi.id='transMenuItem';
    mi.innerHTML='<span>📊 سجل المعاملات</span><span>👈</span>';
    mi.onclick=function(){go('translog',null);};
    tgt.insertBefore(mi,tgt.firstChild);
  }
}catch(e){}

window.renderTransLog=function(){
  try{
    var box=el('transBody');if(!box||!me)return;
    var all=[];
    try{all=JSON.parse(LS.getItem('trans_log_'+me.name)||'[]');}catch(e){}
    all.sort(function(a,b){return (b.time||0)-(a.time||0);});
    var h='';
    var totalIn=0,totalOut=0;
    all.forEach(function(x){
      if(x.type==='topup'||x.type==='gift_recv')totalIn+=x.amount;
      else totalOut+=x.amount;
    });
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">';
    h+='<div style="background:linear-gradient(135deg,#064e3b,#022c22);border:1px solid var(--grn);border-radius:14px;padding:14px;text-align:center"><div style="font-size:11px;color:#86efac">إجمالي المستلم 📥</div><div style="font-size:22px;font-weight:900;color:#22c55e;margin-top:4px">🪙 '+totalIn+'</div></div>';
    h+='<div style="background:linear-gradient(135deg,#4c1d1d,#2c0a0a);border:1px solid var(--red);border-radius:14px;padding:14px;text-align:center"><div style="font-size:11px;color:#fca5a5">إجمالي المصروف 📤</div><div style="font-size:22px;font-weight:900;color:#e64553;margin-top:4px">🪙 '+totalOut+'</div></div>';
    h+='</div>';
    if(!all.length){
      h+='<div class="empty"><div class="big">📊</div>لا توجد معاملات بعد<br>اشحن أو اشترِ وسيظهر السجل هنا</div>';
    }else{
      h+='<div style="display:flex;flex-direction:column;gap:8px">';
      all.forEach(function(x){
        var isIn=(x.type==='topup'||x.type==='gift_recv');
        var icon=isIn?'📥':'📤';
        var color=isIn?'var(--grn)':'var(--red)';
        var sign=isIn?'+':'-';
        var label='';
        if(x.type==='gift_sent')label='🎁 هدية مرسلة';
        else if(x.type==='gift_recv')label='🎁 هدية مستلمة';
        else if(x.type==='buy')label='🛒 عملية شراء';
        else if(x.type==='topup')label='💎 شحن عملات';
        var d=new Date(x.time);
        var ds=d.toLocaleDateString('ar-EG',{day:'2-digit',month:'2-digit'})+' • '+d.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
        h+='<div style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;display:flex;align-items:center;gap:10px">';
        h+='<span style="font-size:20px">'+icon+'</span>';
        h+='<div style="flex:1;min-width:0"><div style="font-weight:bold;font-size:13px;color:var(--txt)">'+label+'</div>';
        h+='<div style="font-size:11px;color:var(--mut);margin-top:2px">'+ds+(x.other?' • من/إلى: '+escapeHtml(getMsgName(x.other)):'')+'</div></div>';
        h+='<div style="font-size:15px;font-weight:900;color:'+color+'">'+sign+x.amount+' 🪙</div></div>';
      });
      h+='</div>';
    }
    box.innerHTML=h;
  }catch(e){}
};

var _goTL=window.go;
window.go=function(s,nv,fb){
  var r=_goTL(s,nv,fb);
  try{if(s==='translog')renderTransLog();}catch(e){}
  return r;
};
})();
/* ===== 🔴 نقطة حمراء لسجل المعاملات (هدايا ووصولات جديدة) ===== */
(function(){
if(window._transBadge)return;window._transBadge=true;

/* 1) إضافة النقطة لعنصر السجل */
function ensureDot(){
  try{
    var mi=el('transMenuItem');
    if(!mi||el('transRedDot'))return;
    var d=document.createElement('span');
    d.id='transRedDot';
    d.style.cssText='position:absolute;top:-4px;left:-8px;min-width:16px;height:16px;background:#e64553;color:#fff;border-radius:10px;font-size:9px;font-weight:bold;line-height:16px;text-align:center;padding:0 4px;display:none;border:2px solid var(--card)';
    mi.style.position='relative';
    mi.appendChild(d);
  }catch(e){}
}

/* 2) تحديث العداد: معاملات جديدة بعد آخر فتح للسجل */
window.updateTransBadge=function(){
  try{
    if(!me)return;
    var all=[];
    try{all=JSON.parse(LS.getItem('trans_log_'+me.name)||'[]');}catch(e){}
    var seen=parseInt(LS.getItem('trans_seen_'+me.name)||'0');
    var n=0;
    all.forEach(function(x){if((x.time||0)>seen)n++;});
    var d=el('transRedDot');
    if(d){if(n>0){d.style.display='block';d.innerText=n;}else d.style.display='none';}
  }catch(e){}
};

/* 3) فتح السجل = التصفير */
var _goT=window.go;
window.go=function(s,nv,fb){
  var r=_goT(s,nv,fb);
  try{
    if(s==='translog'){
      LS.setItem('trans_seen_'+me.name,String(Date.now()));
      setTimeout(function(){updateTransBadge();},300);
      try{renderTransLog();}catch(e){}
    }
  }catch(e){}
  return r;
};

/* 4) كل عملية تسجيل جديدة = النقطة تظهر فوراً */
var _ltO=window.logTrans;
window.logTrans=function(type,amount,detail,other){
  var r=_ltO?_ltO(type,amount,detail,other):undefined;
  try{
    /* نمرر وقت العملية نفسه (مش الوقت الحالي) عشان العداد يعد صح */
    var all=[];
    try{all=JSON.parse(LS.getItem('trans_log_'+me.name)||'[]');}catch(e){}
    var latest=0;
    all.forEach(function(x){if((x.time||0)>latest)latest=x.time;});
    var seen=parseInt(LS.getItem('trans_seen_'+me.name)||'0');
    if(latest>seen){
      var d=el('transRedDot');
      if(d){
        var n=0;
        all.forEach(function(x){if((x.time||0)>seen)n++;});
        d.style.display='block';d.innerText=n;
      }
    }
  }catch(e){}
  return r;
};

/* 5) تشغيل مستمر */
setInterval(function(){try{ensureDot();updateTransBadge();}catch(e){}},5000);
var _saTB=window.startAll;
window.startAll=async function(){var r=await _saTB();try{ensureDot();updateTransBadge();}catch(e){}return r;};
})();
/* ===== تصحيح: النقطة جنب نص "سجل المعاملات" ===== */
(function(){
if(window._dotFix)return;window._dotFix=true;

function placeDot(){
  try{
    var mi=el('transMenuItem');
    if(!mi)return;
    /* ننشئها لو مش موجودة */
    var d=el('transRedDot');
    if(!d){
      d=document.createElement('b');
      d.id='transRedDot';
      document.body.appendChild(d);
    }
    /* النمط: جوه السطر جنب النص */
    d.style.cssText='display:none;min-width:17px;height:17px;background:#e64553;color:#fff;border-radius:9px;font-size:9px;font-weight:bold;line-height:17px;text-align:center;padding:0 4px;margin-right:6px;vertical-align:middle;position:static';
    /* نحطها جنب كلمة "سجل المعاملات" — جوه أول span */
    var span=mi.querySelector('span');
    if(span&&d.parentElement!==span){
      /* نشيلها من أي مكان تاني */
      if(d.parentElement)d.parentElement.removeChild(d);
      span.appendChild(d);
    }
    updateTransBadge();
  }catch(e){}
}

/* نعيد ربط الدوال القديمة بالتصحيح */
window.updateTransBadge=function(){
  try{
    if(!me)return;
    placeDot();
    var all=[];
    try{all=JSON.parse(LS.getItem('trans_log_'+me.name)||'[]');}catch(e){}
    var seen=parseInt(LS.getItem('trans_seen_'+me.name)||'0');
    var n=0;
    all.forEach(function(x){if((x.time||0)>seen)n++;});
    var d=el('transRedDot');
    if(d){if(n>0){d.style.display='inline-block';d.innerText=n;}else d.style.display='none';}
  }catch(e){}
};

/* نقل النقطة لو القايمة اترسمت من جديد */
setInterval(function(){try{placeDot();}catch(e){}},3000);
})();
/* ===== 🔒 حاجز الاشتراك: غير المشترك ممنوع يختار لون أصلاً ===== */
(function(){
if(window._penLock)return;window._penLock=true;
var COST=100,DAYS=30;

function isSub(){try{return me&&(me.penColorExp&&me.penColorExp>Date.now());}catch(e){return false;}}
function isAdminU(){try{return me&&(isOwnerName(me.name)||isAdmin());}catch(e){return false;}}

/* 1) قفل pickPenApply (القايمة المنبثقة) */
var _ppaL=window.pickPenApply;
window.pickPenApply=function(n){
  try{
    if(n&&n!==null&&!isAdminU()&&!isSub()){
      toast('🪙 لون الرسايل يتطلب اشتراك شهري — '+COST+' عملة من "عملاتي"');
      return;
    }
  }catch(e){}
  return _ppaL?_ppaL(n):undefined;
};

/* 2) قفل pickPenScreenColor (الصفحة الكاملة) */
var _ppsL=window.pickPenScreenColor;
window.pickPenScreenColor=function(n){
  try{
    if(n&&n!==null&&!isAdminU()&&!isSub()){
      var coins=(me&&me.coins)||0;
      if(coins>=COST){
        if(!confirm('تفعيل لون الرسايل بـ '+COST+' عملة لمدة '+DAYS+' يوم؟\nرصيدك: 🪙 '+coins))return;
        updateMe({coins:coins-COST,penColorExp:Date.now()+DAYS*86400000}).then(function(){
          toast('🎉 تم الاشتراك! شهر كامل — اختار اللون اللي يعجبك ✨');
          try{renderPenColorPage();}catch(e){}
        });
        return;
      }else{
        toast('🪙 العملات غير كافية — يرجي الشحن (تحتاج '+COST+' عملة من "عملاتي")');
        return;
      }
    }
  }catch(e){}
  return _ppsL?_ppsL(n):undefined;
};

/* 3) قفل pickPenColor (زرار من غير لون + أي طريقة تانية) */
var _ppcL=window.pickPenColor;
window.pickPenColor=function(n){
  try{
    /* لو اختار "بدون لون" وهو مش مشترك = مسموح (رجوع عادي) */
    if(n&&n!==null&&!isAdminU()&&!isSub()){
      toast('🪙 لون الرسايل يتطلب اشتراك شهري — '+COST+' عملة من "عملاتي"');
      return;
    }
  }catch(e){}
  return _ppcL?_ppcL(n):undefined;
};

/* 4) مزيل: لو عضو غير مشترك معاه لون من الطلات القديمة → يتشال */
setInterval(async function(){
  try{
    if(!me)return;
    if(!isAdminU()&&!isSub()&&me.penColor){
      await updateMe({penColor:null});
      toast('⚠️ لون الرسايل يحتاج اشتراك — انتهى أو غير مفعل');
    }
  }catch(e){}
},15000);
})();
/* ===== 🗑️ الزائر مؤقت: الخروج = حذف كل حاجة بتاعته نهائياً ===== */
(function(){
if(window._guestWipe)return;window._guestWipe=true;

function isGuest(){try{return me&&me.role==='زائر';}catch(e){return false;}}

/* 1) تأكيد الخروج للزائر */
var _loG=window.logout;
window.logout=function(){
  if(isGuest()){
    if(!confirm('أنت داخل كزائر 🚪\nعند الخروج سيتم حذف:\n• اسمك وقصصك ورسائلك نهائياً\n• كل ما يخص حسابك\n\nهل أنت متأكد؟'))return;
    wipeGuest();
  }
  return _loG?_loG():undefined;
};

/* 2) الحذف الشامل */
window.wipeGuest=async function(){
  try{
    var n=me.name;
    toast('⏳ جاري حذف بيانات الزائر...');
    /* رسايله ومحادثاته */
    var cs=await sb.from('convs').select('id').or('user_a.eq.'+n+',user_b.eq.'+n);
    for(var i=0;i<(cs.data||[]).length;i++){
      try{await SDB.delConvMsgs(cs.data[i].id);}catch(e){}
      try{await SDB.delConv(cs.data[i].id);}catch(e){}
    }
    /* حالاته وقصصه وإطاراته وأي صفوف تانية باسمه */
    try{await sb.from('stories').delete().eq('author',n);}catch(e){}
    try{await sb.from('reports').delete().eq('from_user',n);}catch(e){}
    try{await sb.from('name_warnings').delete().eq('user',n);}catch(e){}
    try{await sb.from('device_logins').delete().eq('name',n);}catch(e){}
    try{await sb.from('passwords').delete().eq('name',n);}catch(e){}
    /* حسابه نفسه من قايمة المستخدمين */
    try{await SDB.delUserRow(n);}catch(e){}
    /* تنظيف الكاش المحلي بتاعه على الجهاز */
    try{LS.removeItem('trans_log_'+n);}catch(e){}
    try{LS.removeItem('users_cache');LS.setItem('users_cache','{}');}catch(e){}
    toast('🗑️ تم حذف بيانات الزائر نهائياً');
    logActivity('guest_delete','حساب زائر تم حذفه: '+n);
  }catch(e){}
};

/* 3) منع الزائر من مميزات العضوية (زي ما هو متفق) */
try{
  var _rgG=window.register;
}catch(e){}
try{
  /* الزائر ميفتحش صفحات الاشتراك والمتجر */
  var _goG=window.go;
  window.go=function(s,nv,fb){
    try{
      if(me&&me.role==='زائر'&&(s==='wallet'||s==='shop'||s==='pencolor'||s==='namestyle'||s==='msgstyle')){
        toast('👥 المميزات دي للأعضاء المسجلين — سجل عضوية مجانية!');
        return _goG('settings',null);
      }
    }catch(e){}
    return _goG(s,nv,fb);
  };
}catch(e){}

/* 4) تحذير للزائر أول ما يدخل (مرة واحدة) */
var _enG=window.enter;
window.enter=async function(u){
  var r=await _enG(u);
  try{
    if(u&&u.role==='زائر'&&!LS.getItem('guest_warned')){
      LS.setItem('guest_warned','1');
      setTimeout(function(){
        var m=document.createElement('div');m.id='guestWarnModal';m.className='modal';
        m.innerHTML='<div class="m-card2" style="width:320px"><h3>👥 دخول الزوار</h3>'
        +'<p style="font-size:13px;color:var(--txt);text-align:center;line-height:2">أنت داخل كـ<b style="color:var(--yel)">زائر مؤقت</b>'
        +'<br>عند خروجك سيتم حذف اسمك ورسائلك وكل ما يخص حسابك <b>نهائياً</b></p>'
        +'<p style="font-size:12px;color:var(--mut);text-align:center">💡 سجل عضوية مجانية للحفاظ على حسابك دائماً</p>'
        +'<button style="background:var(--acc);color:#fff" onclick="closeModal(\'guestWarnModal\')">فهمت</button>'
        +'<button style="background:var(--grn);color:#fff" onclick="closeModal(\'guestWarnModal\');logout();authTab(\'register\',document.querySelectorAll(\'.auth-tab\')[2])" >👤 سجل عضوية مجانية</button></div>';
        m.onclick=function(e){if(e.target===m)closeModal('guestWarnModal');};
        document.body.appendChild(m);
        m.classList.add('open');
      },1200);
    }
  }catch(e){}
  return r;
};
try{LS.removeItem('guest_warned');}catch(e){}
})();
/* ===== ✨ تأثير دخول فخم: اسم العضو يظهر للجميع عند دخوله ===== */
(function(){
if(window._entryFx)return;window._entryFx=true;

/* مراقبة دخول الأعضاء: من تغيرات الحضور */
var _knownUsers={};
setInterval(function(){
  try{
    if(!me)return;
    for(var k in usersCache){
      var u=usersCache[k];
      if(k===me.name)continue;
      var wasIn=_knownUsers[k];
      var nowIn=isOnline(u);
      _knownUsers[k]=nowIn;
      /* أول مرة يبقى أونلاين بعد ما كان أوفلاين = دخل الآن */
      if(nowIn&&!wasIn&&!u._announced){
        u._announced=true;
        showEntryEffect(u);
      }
      if(!nowIn)u._announced=false;
    }
  }catch(e){}
},3000);

/* تأثير الدخول: بانر ينزل من فوق لكل الأعضاء */
function showEntryEffect(u){
  try{
    var n=el('entryFx');
    if(n)n.remove();
    var isVip=false;
    try{isVip=(u.welcome_pack_used===true)||(u.frameExp&&u.frameExp>Date.now());}catch(e){}
    var fx=el('s-chat')&&el('s-chat').classList.contains('active')?el('s-chat'):document.body;
    var banner=document.createElement('div');
    banner.id='entryFx';
    /* ستايل مختلف: عادي = أزرق، VIP (باقة ترحيب) = ذهبي فخم */
    var bg=isVip?'linear-gradient(90deg,#78350f,#b45309,#78350f)':'linear-gradient(90deg,#1e3a8a,#3b82f6,#1e3a8a)';
    var border=isVip?'2px solid #FFD700':'2px solid rgba(255,255,255,.3)';
    banner.style.cssText='position:absolute;top:0;left:0;right:0;z-index:450;background:'+bg+';border-bottom:'+border+';padding:10px 14px;display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,.5);animation:entrySlideDown .6s ease forwards;overflow:hidden';
    banner.innerHTML='<div style="font-size:22px;animation:wpBounce 1.2s infinite">✨</div>'
    +getAvatarHTML(u,38)
    +'<div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:900;color:#fff;text-shadow:0 1px 4px #000">✨ دخل الآن</div>'
    +'<div style="font-size:12px;margin-top:2px">'+styleName(u)+'</div></div>'
    +(isVip?'<span style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-size:10px;font-weight:900;padding:4px 10px;border-radius:12px;flex-shrink:0">👑 VIP</span>':'');
    fx.appendChild(banner);
    if(me.sndOther!==false&&me.sndNotif!==false)try{beep(800);}catch(e){}
    setTimeout(function(){
      try{banner.style.animation='entrySlideUp .5s ease forwards';}catch(e){}
      setTimeout(function(){try{banner.remove();}catch(e){}},600);
    },4000);
  }catch(e){}
}

/* الأنيميشن: ينزل من فوق ويطلع تاني */
try{
  var st=document.createElement('style');
  st.textContent='@keyframes entrySlideDown{0%{transform:translateY(-100%);opacity:0}100%{transform:translateY(0);opacity:1}}'
  +'@keyframes entrySlideUp{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-100%);opacity:0}}'
  +'.entryFxHost{position:relative}';
  document.head.appendChild(st);
}catch(e){}

/* الشات لازم يستقبل البانر جواه */
var _ouE=window.openUser;
window.openUser=function(n){var r=_ouE(n);try{el('s-chat').classList.add('entryFxHost');}catch(e){}return r;};
var _jrE=window.joinRoom;
window.joinRoom=async function(rid){var r=await _jrE(rid);try{el('s-chat').classList.add('entryFxHost');}catch(e){}return r;};

/* دخولك أنت: برضه بيظهر للآخرين بآخر ما يدخل حد (يظهر ليك انت برضه عند دخولك شخص بعدك) */
var _enE=window.enter;
window.enter=async function(u){
  var r=await _enE(u);
  try{
    if(u){_knownUsers[u.name]=true;u._announced=true;}
  }catch(e){}
  return r;
};
})();
/* ===== ✨ تأثير دخول فخم: الكل يشوف نفسه + VIP لصاحب الموقع والإدارة ===== */
(function(){
if(window._entryFx2)return;window._entryFx2=true;

/* أنيميشن مرة واحدة */
try{
  var st=document.createElement('style');
  st.textContent='@keyframes entrySlideDown{0%{transform:translateY(-100%);opacity:0}100%{transform:translateY(0);opacity:1}}'
  +'@keyframes entrySlideUp{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-100%);opacity:0}}'
  +'@keyframes entryGlow{0%,100%{box-shadow:0 4px 20px rgba(0,0,0,.5)}50%{box-shadow:0 4px 34px rgba(255,215,0,.7)}}'
  +'.entryFxHost{position:relative}';
  document.head.appendChild(st);
}catch(e){}

function fxHost(){
  try{
    var c=el('s-chat');
    if(c&&c.classList.contains('active')&&!c.classList.contains('entryFxHost'))c.classList.add('entryFxHost');
    return el('s-chat')&&el('s-chat').classList.contains('active')?el('s-chat'):document.body;
  }catch(e){return document.body;}
}

/* بانر الدخول — يتأقلم حسب مكانة العضو */
window.showEntryEffect=function(u){
  try{
    var old=el('entryFx');
    if(old)old.remove();
    var host=fxHost();
    var isOwnerU=isOwnerName(u.name);
    var isAdminU=false;
    try{isAdminU=(u.role&&(u.role.indexOf('إدارة')>-1||u.role.indexOf('سوبر')>-1));}catch(e){}
    var isVip=false;
    try{isVip=(u.welcome_pack_used===true)||(u.frameExp&&u.frameExp>Date.now());}catch(e){}

    var bg,border,title,badge;
    if(isOwnerU){
      /* 👑 صاحب الموقع: دخول ملكي فخم — ذهبي متوهج */
      bg='linear-gradient(90deg,#78350f,#d97706,#fbbf24,#d97706,#78350f)';
      border='2px solid #FFD700';
      title='👑 دخل الملك 👑';
      badge='<span style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-size:10px;font-weight:900;padding:4px 12px;border-radius:12px;flex-shrink:0;animation:entryGlow 1.5s infinite">👑 VIP صاحب الموقع</span>';
    }else if(isAdminU){
      bg='linear-gradient(90deg,#4c1d95,#7c3aed,#4c1d95)';
      border='2px solid #A78BFA';
      title='🛡️ دخلت الإدارة';
      badge='<span style="background:#7C3AED;color:#fff;font-size:10px;font-weight:900;padding:4px 10px;border-radius:12px;flex-shrink:0">🛡️ إدارة</span>';
    }else if(isVip){
      bg='linear-gradient(90deg,#78350f,#b45309,#78350f)';
      border='2px solid #FFD700';
      title='✨ دخل الآن';
      badge='<span style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-size:10px;font-weight:900;padding:4px 10px;border-radius:12px;flex-shrink:0">👑 VIP</span>';
    }else{
      bg='linear-gradient(90deg,#1e3a8a,#3b82f6,#1e3a8a)';
      border='2px solid rgba(255,255,255,.3)';
      title='✨ دخل الآن';
      badge='';
    }

    var banner=document.createElement('div');
    banner.id='entryFx';
    banner.style.cssText='position:absolute;top:0;left:0;right:0;z-index:450;background:'+bg+';border-bottom:'+border+';padding:12px 14px;display:flex;align-items:center;gap:10px;animation:entrySlideDown .6s ease forwards'+(isOwnerU?',entryGlow 1.5s infinite 0.6s':'')+';overflow:hidden';
    banner.innerHTML='<div style="font-size:22px;animation:wpBounce 1.2s infinite">'+(isOwnerU?'👑':'✨')+'</div>'
    +getAvatarHTML(u,38)
    +'<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:900;color:#fff;text-shadow:0 1px 4px #000">'+title+'</div>'
    +'<div style="font-size:12.5px;margin-top:2px">'+styleName(u)+'</div></div>'
    +badge;
    host.appendChild(banner);
    if(me&&me.sndNotif!==false)try{beep(isOwnerU?1200:800);}catch(e){}
    setTimeout(function(){
      try{banner.style.animation='entrySlideUp .5s ease forwards';}catch(e){}
      setTimeout(function(){try{banner.remove();}catch(e){}},600);
    },isOwnerU?5000:4000);
  }catch(e){}
};

/* 1) لما أنا أدخل: أشوف دخولي بنفسي ✨ */
var _enE=window.enter;
window.enter=async function(u){
  var r=await _enE(u);
  try{
    if(u){
      u._announced=true;
      setTimeout(function(){
        try{
          /* لو الشات مفتوح يظهر جواه، وإلا فوق الصفحة كلها */
          el('s-chat').classList.add('entryFxHost');
          showEntryEffect(u);
        }catch(e){}
      },1500);
    }
  }catch(e){}
  return r;
};
/* وعند استرجاع الجلسة كمان */
try{
  var _smE=window.subMsgs;
  window.subMsgs=async function(){
    var r=await _smE();
    try{
      if(me&&!window._myEntryShown){
        window._myEntryShown=true;
        setTimeout(function(){try{showEntryEffect(me);}catch(e){}},800);
      }
    }catch(e){}
    return r;
  };
}catch(e){}

/* 2) لما أعضاء تانية تدخل: الجميع يشوف (زي السابق) */
var _knownUsers2={};
setInterval(function(){
  try{
    if(!me)return;
    for(var k in usersCache){
      if(k===me.name)continue;
      var u=usersCache[k];
      var wasIn=_knownUsers2[k];
      var nowIn=isOnline(u);
      _knownUsers2[k]=nowIn;
      if(nowIn&&!wasIn&&!u._announced){
        u._announced=true;
        showEntryEffect(u);
      }
      if(!nowIn)u._announced=false;
    }
  }catch(e){}
},3000);
})();
/* ===== ✨ تأثير دخول: للمشتركين والإدارة وصاحب الموقع فقط ===== */
(function(){
if(window._entryFx3)return;window._entryFx3=true;

try{
  var st=document.createElement('style');
  st.textContent='@keyframes entrySlideDown{0%{transform:translateY(-100%);opacity:0}100%{transform:translateY(0);opacity:1}}'
  +'@keyframes entrySlideUp{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-100%);opacity:0}}'
  +'@keyframes entryGlow{0%,100%{box-shadow:0 4px 20px rgba(0,0,0,.5)}50%{box-shadow:0 4px 34px rgba(255,215,0,.7)}}'
  +'.entryFxHost{position:relative}';
  document.head.appendChild(st);
}catch(e){}

/* مين له حق تأثير الدخول؟ */
function hasEntryFx(u){
  try{
    if(!u)return false;
    if(isOwnerName(u.name))return true;
    if(u.role&&(u.role.indexOf('إدارة')>-1||u.role.indexOf('سوبر')>-1))return true;
    if(u.welcome_pack_used===true)return true;
    if(u.frameExp&&u.frameExp>Date.now())return true;
    if(u.nameStyleExp&&u.nameStyleExp>Date.now())return true;
    if(u.penColorExp&&u.penColorExp>Date.now())return true;
    if(u.vipExp&&u.vipExp>Date.now())return true;
    return false;
  }catch(e){return false;}
}

function fxHost(){
  try{
    var c=el('s-chat');
    if(c&&c.classList.contains('active')&&!c.classList.contains('entryFxHost'))c.classList.add('entryFxHost');
    return (el('s-chat')&&el('s-chat').classList.contains('active'))?el('s-chat'):document.body;
  }catch(e){return document.body;}
}

window.showEntryEffect=function(u){
  try{
    /* 🔒 الفلتر: العضو العادي ملهوش تأثير */
    if(!hasEntryFx(u))return;
    var old=el('entryFx');
    if(old)old.remove();
    var host=fxHost();
    var isOwnerU=isOwnerName(u.name);
    var isAdminU=false;
    try{isAdminU=(u.role&&(u.role.indexOf('إدارة')>-1||u.role.indexOf('سوبر')>-1));}catch(e){}

    var bg,border,title,badge;
    if(isOwnerU){
      bg='linear-gradient(90deg,#78350f,#d97706,#fbbf24,#d97706,#78350f)';
      border='2px solid #FFD700';
      title='👑 دخل الملك 👑';
      badge='<span style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-size:10px;font-weight:900;padding:4px 12px;border-radius:12px;flex-shrink:0;animation:entryGlow 1.5s infinite">👑 VIP صاحب الموقع</span>';
    }else if(isAdminU){
      bg='linear-gradient(90deg,#4c1d95,#7c3aed,#4c1d95)';
      border='2px solid #A78BFA';
      title='🛡️ دخلت الإدارة';
      badge='<span style="background:#7C3AED;color:#fff;font-size:10px;font-weight:900;padding:4px 10px;border-radius:12px;flex-shrink:0">🛡️ إدارة</span>';
    }else{
      bg='linear-gradient(90deg,#78350f,#b45309,#78350f)';
      border='2px solid #FFD700';
      title='✨ دخل الآن';
      badge='<span style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-size:10px;font-weight:900;padding:4px 10px;border-radius:12px;flex-shrink:0">👑 VIP</span>';
    }

    var banner=document.createElement('div');
    banner.id='entryFx';
    banner.style.cssText='position:absolute;top:0;left:0;right:0;z-index:450;background:'+bg+';border-bottom:'+border+';padding:12px 14px;display:flex;align-items:center;gap:10px;animation:entrySlideDown .6s ease forwards'+(isOwnerU?',entryGlow 1.5s infinite 0.6s':'')+';overflow:hidden';
    banner.innerHTML='<div style="font-size:22px;animation:wpBounce 1.2s infinite">'+(isOwnerU?'👑':'✨')+'</div>'
    +getAvatarHTML(u,38)
    +'<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:900;color:#fff;text-shadow:0 1px 4px #000">'+title+'</div>'
    +'<div style="font-size:12.5px;margin-top:2px">'+styleName(u)+'</div></div>'
    +badge;
    host.appendChild(banner);
    if(me&&me.sndNotif!==false)try{beep(isOwnerU?1200:800);}catch(e){}
    setTimeout(function(){
      try{banner.style.animation='entrySlideUp .5s ease forwards';}catch(e){}
      setTimeout(function(){try{banner.remove();}catch(e){}},600);
    },isOwnerU?5000:4000);
  }catch(e){}
};

/* دخولي أنا: يظهر بس لو عندي حق (مشترك/إدارة/مالك) */
var _enE3=window.enter;
window.enter=async function(u){
  var r=await _enE3(u);
  try{
    if(u&&hasEntryFx(u)){
      u._announced=true;
      setTimeout(function(){
        try{
          el('s-chat').classList.add('entryFxHost');
          showEntryEffect(u);
        }catch(e){}
      },1500);
    }
  }catch(e){}
  return r;
};
var _smE3=window.subMsgs;
window.subMsgs=async function(){
  var r=await _smE3();
  try{
    if(me&&!window._myEntryShown&&hasEntryFx(me)){
      window._myEntryShown=true;
      setTimeout(function(){try{showEntryEffect(me);}catch(e){}},800);
    }
  }catch(e){}
  return r;
};

/* الأعضاء التانيين: بس اللي عندهم حق */
var _known3={};
setInterval(function(){
  try{
    if(!me)return;
    for(var k in usersCache){
      if(k===me.name)continue;
      var u=usersCache[k];
      var wasIn=_known3[k];
      var nowIn=isOnline(u);
      _known3[k]=nowIn;
      if(nowIn&&!wasIn&&!u._announced){
        u._announced=true;
        if(hasEntryFx(u))showEntryEffect(u);
      }
      if(!nowIn)u._announced=false;
    }
  }catch(e){}
},3000);
})();
/* ===== ✨ تأثير دخول عالمي: الجميع يشوف الجميع — المشتركين والإدارة والمالك فقط ===== */
(function(){
if(window._entryFx4)return;window._entryFx4=true;

/* الأنيميشن */
try{
  var st=document.createElement('style');
  st.textContent='@keyframes entrySlideDown{0%{transform:translateY(-100%);opacity:0}100%{transform:translateY(0);opacity:1}}'
  +'@keyframes entrySlideUp{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-100%);opacity:0}}'
  +'@keyframes entryGlow{0%,100%{box-shadow:0 4px 20px rgba(0,0,0,.5)}50%{box-shadow:0 4px 34px rgba(255,215,0,.7)}}'
  +'.entryFxHost{position:relative}';
  document.head.appendChild(st);
}catch(e){}

function hasEntryFx(u){
  try{
    if(!u)return false;
    if(isOwnerName(u.name))return true;
    if(u.role&&(u.role.indexOf('إدارة')>-1||u.role.indexOf('سوبر')>-1))return true;
    if(u.welcome_pack_used===true)return true;
    if(u.frameExp&&u.frameExp>Date.now())return true;
    if(u.nameStyleExp&&u.nameStyleExp>Date.now())return true;
    if(u.penColorExp&&u.penColorExp>Date.now())return true;
    if(u.vipExp&&u.vipExp>Date.now())return true;
    return false;
  }catch(e){return false;}
}

/* المضيف: يعرض البانر على أي شاشة مفتوحة حالياً */
function fxHost(){
  try{
    var c=el('s-chat');
    if(c&&c.classList.contains('active')&&!c.classList.contains('entryFxHost'))c.classList.add('entryFxHost');
    return (el('s-chat')&&el('s-chat').classList.contains('active'))?el('s-chat'):document.body;
  }catch(e){return document.body;}
}

window.showEntryEffect=function(u){
  try{
    if(!hasEntryFx(u))return;
    var old=el('entryFx');
    if(old)old.remove();
    var host=fxHost();
    var isOwnerU=isOwnerName(u.name);
    var isAdminU=false;
    try{isAdminU=(u.role&&(u.role.indexOf('إدارة')>-1||u.role.indexOf('سوبر')>-1));}catch(e){}

    var bg,border,title,badge;
    if(isOwnerU){
      bg='linear-gradient(90deg,#78350f,#d97706,#fbbf24,#d97706,#78350f)';
      border='2px solid #FFD700';
      title='👑 دخل الملك 👑';
      badge='<span style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-size:10px;font-weight:900;padding:4px 12px;border-radius:12px;flex-shrink:0;animation:entryGlow 1.5s infinite">👑 VIP صاحب الموقع</span>';
    }else if(isAdminU){
      bg='linear-gradient(90deg,#4c1d95,#7c3aed,#4c1d95)';
      border='2px solid #A78BFA';
      title='🛡️ دخلت الإدارة';
      badge='<span style="background:#7C3AED;color:#fff;font-size:10px;font-weight:900;padding:4px 10px;border-radius:12px;flex-shrink:0">🛡️ إدارة</span>';
    }else{
      bg='linear-gradient(90deg,#78350f,#b45309,#78350f)';
      border='2px solid #FFD700';
      title='✨ دخل الآن';
      badge='<span style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-size:10px;font-weight:900;padding:4px 10px;border-radius:12px;flex-shrink:0">👑 VIP</span>';
    }

    var banner=document.createElement('div');
    banner.id='entryFx';
    banner.style.cssText='position:absolute;top:0;left:0;right:0;z-index:450;background:'+bg+';border-bottom:'+border+';padding:12px 14px;display:flex;align-items:center;gap:10px;animation:entrySlideDown .6s ease forwards'+(isOwnerU?',entryGlow 1.5s infinite 0.6s':'')+';overflow:hidden';
    banner.innerHTML='<div style="font-size:22px;animation:wpBounce 1.2s infinite">'+(isOwnerU?'👑':'✨')+'</div>'
    +getAvatarHTML(u,38)
    +'<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:900;color:#fff;text-shadow:0 1px 4px #000">'+title+'</div>'
    +'<div style="font-size:12.5px;margin-top:2px">'+styleName(u)+'</div></div>'
    +badge;
    host.appendChild(banner);
    if(me&&me.sndNotif!==false)try{beep(isOwnerU?1200:800);}catch(e){}
    setTimeout(function(){
      try{banner.style.animation='entrySlideUp .5s ease forwards';}catch(e){}
      setTimeout(function(){try{banner.remove();}catch(e){}},600);
    },isOwnerU?5000:4000);
  }catch(e){}
};

/* 1) دخولي أنا: يظهرلي + (الآخرون هيشوفوه من مراقبة الحضور) */
var _enE4=window.enter;
window.enter=async function(u){
  var r=await _enE4(u);
  try{
    if(u&&hasEntryFx(u)){
      u._announced=true;
      setTimeout(function(){
        try{showEntryEffect(u);}catch(e){}
      },1500);
    }
  }catch(e){}
  return r;
};

/* 2) عند استرجاع الجلسة: دخولي يظهر برضه */
var _smE4=window.subMsgs;
window.subMsgs=async function(){
  var r=await _smE4();
  try{
    if(me&&!window._myEntryShown2&&hasEntryFx(me)){
      window._myEntryShown2=true;
      setTimeout(function(){try{showEntryEffect(me);}catch(e){}},900);
    }
  }catch(e){}
  return r;
};

/* 3) الأعضاء التانيين: الجميع يشوف دخولهم (بما إنهم مشتركين) */
var _known4={};
setInterval(function(){
  try{
    if(!me)return;
    for(var k in usersCache){
      if(k===me.name)continue;
      var u=usersCache[k];
      var wasIn=_known4[k];
      var nowIn=isOnline(u);
      _known4[k]=nowIn;
      if(nowIn&&!wasIn&&!u._announced){
        u._announced=true;
        showEntryEffect(u);
      }
      if(!nowIn)u._announced=false;
    }
  }catch(e){}
},3000);
})();
/* ===== 📊 توسيع جدول الأعضاء: ظهور عمود التحكم كامل ===== */
(function(){
if(window._tableFix)return;window._tableFix=true;

var _cssAdded=false;
function fixTable(){
  try{
    var panel=el('ap-members');
    if(!panel)return;
    /* إضافة الستايل مرة واحدة */
    if(!_cssAdded){
      _cssAdded=true;
      var st=document.createElement('style');
      st.textContent='#ap-members .adm-sec{overflow-x:auto!important;-webkit-overflow-scrolling:touch}'
      +'#ap-members table{min-width:520px!important;font-size:10.5px!important}'
      +'#ap-members th,#ap-members td{padding:5px 4px!important;white-space:nowrap!important}'
      /* تصغير الأعمدة غير المهمة */
      +'#ap-members th:nth-child(4),#ap-members td:nth-child(4){font-size:9px!important;padding:5px 2px!important}'
      +'#ap-members th:nth-child(5),#ap-members td:nth-child(5){font-size:9px!important;padding:5px 2px!important}'
      +'#ap-members th:nth-child(6),#ap-members td:nth-child(6){font-size:9px!important;padding:5px 2px!important}'
      /* عمود التحكم: أزرار مضغوطة */
      +'#ap-members td:last-child button{padding:3px 6px!important;font-size:10px!important;margin:1px!important}';
      document.head.appendChild(st);
    }
  }catch(e){}
}

var _rmF=window.renderMembers;
window.renderMembers=function(){
  var r=_rmF?_rmF():undefined;
  try{setTimeout(fixTable,50);}catch(e){}
  return r;
};
var _atF=window.adminTab;
window.adminTab=function(tab,e){
  var r=_atF?_atF(tab,e):undefined;
  try{if(tab==='members')setTimeout(fixTable,100);}catch(e){}
  return r;
};
setInterval(function(){try{if(el('ap-members')&&el('ap-members').classList.contains('open'))fixTable();}catch(e){}},3000);
})();
/* ===== 🗑️ إزالة كارت إكس أو القديم نهائياً ===== */
(function(){
if(window._oxKill)return;window._oxKill=true;

function killOX(){
  try{
    var scr=el('s-games');
    if(!scr)return;
    /* نلف على كل الكروت ونشيل اللي نصه فيه إكس أو */
    var cards=scr.querySelectorAll('.r-card');
    for(var i=0;i<cards.length;i++){
      var t=cards[i].innerText||'';
      if(t.indexOf('إكس أو')>-1||t.indexOf('(OX)')>-1||t.indexOf('اللعبة الكلاسيكية')>-1){
        cards[i].remove();
      }
    }
  }catch(e){}
}

/* نشيله فوراً + بعد كل فتح للألعاب + مراقبة مستمرة */
killOX();
var _goK=window.go;
window.go=function(s,nv,fb){
  var r=_goK(s,nv,fb);
  try{if(s==='games')setTimeout(killOX,100);}catch(e){}
  return r;
};
setInterval(killOX,2000);
})();
/* ===== 🔒 استقبال الوسائط: مقفول افتراضياً للجميع ===== */
(function(){
if(window._mediaOffDefault)return;window._mediaOffDefault=true;

/* 1) عند الدخول أو استرجاع الجلسة: لو العضو عمّر ما فتحها بنفسه → نقفلها له */
var _enM=window.enter;
window.enter=async function(u){
  var r=await _enM(u);
  try{
    if(u&&u.media_opt_in!==true&&u.allowMedia!==true){
      u.allowMedia=false;
      await updateMe({allowMedia:false});
    }
  }catch(e){}
  return r;
};

/* 2) واجهة الخصوصية: السويتش يظهر الوضع الصح */
var _apM=window.applyPrefsUI;
window.applyPrefsUI=function(){
  var r=_apM?_apM():undefined;
  try{
    if(me&&el('pMedia'))el('pMedia').checked=(me.allowMedia===true||me.media_opt_in===true);
  }catch(e){}
  return r;
};

/* 3) حماية إضافية: العضو اللي مقفولة عنه ميقدرش يستقبل فعلياً — فحص عند الوصول */
var _rmcM=window.renderMsgContent;
window.renderMsgContent=function(m){
  try{
    /* لو الرسالة صورة/صوت ووصلت لعضو الوسائط مقفولة عنه → رسالة بدلها */
    if(me&&m&&m.from!==me.name&&!m.deleted&&(m.type==='image'||m.type==='audio')){
      var canReceive=(me.allowMedia===true||me.media_opt_in===true);
      if(!canReceive){
        var html='<div style="background:var(--card2);border:1px dashed var(--line);border-radius:14px;padding:12px;text-align:center;min-width:150px">';
        html+='<div style="font-size:26px;margin-bottom:4px">🔒</div>';
        html+='<div style="font-size:12px;font-weight:bold;color:var(--mut)">وسائط مقفلة</div>';
        html+='<div style="font-size:10px;color:var(--mut);margin-top:2px">فعّل استقبال الوسائط من الخصوصية لعرضها</div></div>';
        return html;
      }
    }
  }catch(e){}
  return _rmcM?_rmcM(m):'';
};

/* 4) لما يفتحها من الخصوصية: نجدد الحالة */
try{
  var pM=el('pMedia');
  if(pM){
    pM.addEventListener('change',async function(){
      try{
        await updateMe({allowMedia:this.checked,media_opt_in:this.checked});
        toast(this.checked?'✅ تم فتح استقبال الوسائط':'🔒 تم قفل استقبال الوسائط');
      }catch(e){}
    });
  }
}catch(e){}
})();
/* ===== 🗑️ إزالة إكس أو نهائياً: عبر onclick (مضمون 100%) ===== */
(function(){
if(window._oxKill2)return;window._oxKill2=true;

function killOX2(){
  try{
    /* البحث بالـ onclick — أدق من النص */
    var all=document.querySelectorAll('.r-card');
    for(var i=0;i<all.length;i++){
      var oc=all[i].getAttribute('onclick')||'';
      if(oc.indexOf('openOX')>-1){
        all[i].remove();
      }
    }
    /* نسخة إضافية: أي عنصر في شاشة الألعاب مرتبط بالأوكس */
    var scr=el('s-games');
    if(scr){
      var all2=scr.querySelectorAll('[onclick*="openOX"]');
      for(var j=0;j<all2.length;j++){
        var card=all2[j].closest('.r-card')||all2[j];
        card.remove();
      }
    }
  }catch(e){}
}

killOX2();
var _goK2=window.go;
window.go=function(s,nv,fb){
  var r=_goK2(s,nv,fb);
  try{if(s==='games')setTimeout(killOX2,80);}catch(e){}
  return r;
};
setInterval(killOX2,1500);

/* زرار openOX نفسه معطل */
window.openOX=function(){toast('🎮 اللعبة اتشالت — الألعاب الجديدة متاحة في القايمة');};
})();
/* ================================================================
   🏅 نظام الشارات النهائي — يلغي كل النسخ القديمة + شريط تقدم
   ================================================================ */
(function(){
if(window._badgeSysFinal)return;window._badgeFinalCancel=true;

/* ---------- 1) تعطيل كل دوال الشارات القديمة نهائياً ---------- */
window._badgesSys=function(){return null};
window._badgeSeed=function(){return null};
window._badgeSeedBtn=function(){return null};
window._bdDrawFix=function(){return null};
window._bdV3=function(){return null};
window._badgeFinal=function(){return null};
window.renderBadges=function(){try{if(el('badgesBody'))el('badgesBody').innerHTML='';}catch(e){}};
window.renderBadgesV3=function(){};
window.uploadBadge=function(){toast('استخدم زرار الإضافة الجديد 👇');};
window.buyBadge=function(){toast('استخدم زرار الشراء الجديد 👇');};
window.equipBadge=function(){toast('استخدم زرار التفعيل الجديد 👇');};
window.delBadge=function(){toast('استخدم زرار الحذف الجديد 👇');};
window.removeMyBadge=function(){window.removeBadgeNew();};

/* ---------- 2) قايمة الشارات الجاهزة ---------- */
var BADGES=[
 {url:'https://cdn.phototourl.com/member/2026-10-06-26f9a1ae-1457-4c9b-9bea-03567f26c789.webp',name:'شارة التاج',rarity:'أسطوري',price:3000},
 {url:'https://cdn.phototourl.com/member/2026-10-06-24861af8-abb4-4ef1-b0bf-41e07fe04505.gif',name:'شارة الذهب المتحركة',rarity:'ملكي',price:5000},
 {url:'https://cdn.phototourl.com/member/2026-10-06-9997f140-f8f2-491b-9bf2-244a717ab531.webp',name:'شارة الفيصل',rarity:'أسطوري',price:3000},
 {url:'https://cdn.phototourl.com/member/2026-10-06-9665b5e0-9b56-41fc-9916-72f86bbf2c9b.gif',name:'شارة الملكة المتحركة',rarity:'ملكي',price:5000}
];

/* ---------- 3) شريط التقدم ---------- */
function showBdProgress(show){
  try{
    var old=el('bdProgressNew');
    if(show&&!old){
      var p=document.createElement('div');
      p.id='bdProgressNew';
      p.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;background:var(--card);border:2px solid #FFD700;border-radius:16px;padding:20px;width:280px;text-align:center';
      p.innerHTML='<div style="font-size:15px;font-weight:bold;color:var(--txt);margin-bottom:10px">🏅 جاري إضافة الشارات...</div>'
      +'<div style="background:var(--bg);border-radius:10px;overflow:hidden;height:14px"><div id="bdProgressFillN" style="height:100%;width:0;background:linear-gradient(90deg,#FFD700,#FF9800);transition:width .3s"></div></div>'
      +'<div id="bdProgressTxtN" style="font-size:11px;color:var(--mut);margin-top:8px">0%</div>';
      document.body.appendChild(p);
    }else if(!show&&old){
      old.remove();
    }
  }catch(e){}
}
function setBdProgress(pct,txt){
  try{
    var f=el('bdProgressFillN'),t=el('bdProgressTxtN');
    if(f)f.style.width=pct+'%';
    if(t)t.innerText=txt;
  }catch(e){}
}

/* ---------- 4) إضافة الشارات الجاهزة ---------- */
window.addReadyBadgesNew=function(){
  if(!isAdmin())return toast('للإدارة فقط');
  showBdProgress(true);
  setBdProgress(0,'بدء الإضافة...');
  var added=0,skipped=0,idx=0;
  function next(){
    if(idx>=BADGES.length){
      setBdProgress(100,'تم! ✅');
      setTimeout(function(){
        showBdProgress(false);
        toast('🏅 تمت إضافة '+added+' شارة'+(skipped?' (و'+skipped+' موجودة)':''));
        renderBadgesNew();
      },700);
      return;
    }
    var b=BADGES[idx];
    sb.from('badges').select('id').eq('url',b.url).limit(1).then(function(chk){
      if(chk.data&&chk.data.length){
        skipped++;idx++;setBdProgress(Math.round(idx/BADGES.length*100),'فحص '+idx+'/'+BADGES.length);next();
      }else{
        sb.from('badges').insert({url:b.url,name:b.name,rarity:b.rarity,price:b.price,created:Date.now()}).then(function(){
          added++;idx++;setBdProgress(Math.round(idx/BADGES.length*100),'إضافة '+idx+'/'+BADGES.length);next();
        });
      }
    });
  }
  next();
};

/* ---------- 5) إضافة شارة من الجهاز (بدون ضغط — GIF سليمة) ---------- */
window.addManualBadgeNew=function(e){
  var f=e.target.files[0];if(!f)return;
  if(!isAdmin())return;
  var name=prompt('اسم الشارة:','شارة جديدة');if(name===null){e.target.value='';return;}
  var rarity=prompt('الندرة (عادي / أسطوري / ملكي / ملكي VIP):','أسطوري');if(rarity===null){e.target.value='';return;}
  var price=parseInt(prompt('السعر بالعملات:','3000'));if(isNaN(price)||price<=0)price=3000;
  showBdProgress(true);setBdProgress(15,'جاري الرفع...');
  var ext=(f.type==='image/gif')?'.gif':(f.type==='image/webp')?'.webp':'.png';
  var fname='badge_'+Date.now()+ext;
  sb.storage.from('stories').upload(fname,f,{cacheControl:'31536000',upsert:false}).then(function(r){
    if(r.error){showBdProgress(false);return toast('فشل الرفع');}
    setBdProgress(70,'جاري الحفظ...');
    var url=sb.storage.from('stories').getPublicUrl(fname).data.publicUrl;
    sb.from('badges').insert({url:url,name:name,rarity:rarity,price:price,created:Date.now()}).then(function(r2){
      showBdProgress(false);
      if(r2.error)return toast('خطأ: '+r2.error.message);
      toast('🏅 تمت إضافة الشارة!');
      renderBadgesNew();
    });
  });
  e.target.value='';
};

/* ---------- 6) الشراء والتفعيل والحذف ---------- */
window.buyBadgeNew=async function(id){
  if(!me)return;
  var d=await sb.from('badges').select('*').eq('id',id).limit(1);
  var bd=d.data&&d.data[0];if(!bd)return;
  var coins=(me.coins)||0;
  if(coins<(bd.price||0))return toast('🪙 العملات غير كافية — ناقصك '+((bd.price||0)-coins)+' عملة');
  if(!confirm('شراء شارة «'+(bd.name||'')+'» بـ '+(bd.price||0)+' عملة؟'))return;
  await updateMe({coins:coins-(bd.price||0)});
  var owned=(me.my_badges||[]);owned.push(id);
  await updateMe({my_badges:owned,active_badge:id,active_badge_url:bd.url});
  try{logTrans('buy',bd.price||0,'شراء شارة: '+(bd.name||''),'');}catch(e){}
  toast('🏅 تم شراء الشارة وتفعيلها!');
  renderBadgesNew();
};
window.equipBadgeNew=async function(id){
  var d=await sb.from('badges').select('*').eq('id',id).limit(1);
  var bd=d.data&&d.data[0];if(!bd)return;
  await updateMe({active_badge:id,active_badge_url:bd.url});
  toast('🏅 تم تفعيل الشارة');
  renderBadgesNew();
};
window.removeBadgeNew=async function(){
  await updateMe({active_badge:null,active_badge_url:null});
  renderBadgesNew();
};
window.delBadgeNew=async function(id){
  if(!isAdmin())return;
  if(!confirm('حذف هذه الشارة نهائياً؟'))return;
  await sb.from('badges').delete().eq('id',id);
  renderBadgesNew();
};

/* ---------- 7) الشاشة ---------- */
if(!el('s-badgesNew')){
  var scr=document.createElement('div');
  scr.className='screen';scr.id='s-badgesNew';
  scr.innerHTML='<div class="sub-title" onclick="go(\'settings\')">➔ متجر الشارات</div><div id="badgesBodyNew" style="padding:4px"></div>';
  var content=document.querySelector('.content');
  var ref=el('s-settings');
  if(ref&&ref.parentElement)content.insertBefore(scr,ref);
  else content.appendChild(scr);
}

/* ---------- 8) رسم المتجر ---------- */
window.renderBadgesNew=async function(){
  try{
    var box=el('badgesBodyNew');if(!box||!me)return;
    var coins=(me.coins)||0;
    var admin=isOwnerName(me.name)||isAdmin();
    var h='';
    h+='<div style="background:radial-gradient(ellipse at top,#1a1a4e,#0a0a20);border-radius:18px;padding:20px 14px;text-align:center;margin-bottom:12px;border:1px solid rgba(255,215,0,.3)">';
    h+='<div style="font-size:17px;font-weight:900;color:#FFD700">🏅 متجر الشارات</div>';
    h+='<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:5px">اشترِ شارتك لتظهر جنب اسمك في كل الموقع ✨</div>';
    if(me.active_badge_url){
      h+='<div style="margin-top:10px;display:inline-flex;align-items:center;gap:8px;background:var(--card2);border:1px solid #FFD700;border-radius:20px;padding:6px 14px">';
      h+='<img src="'+me.active_badge_url+'" style="width:26px;height:26px;object-fit:contain">';
      h+='<button onclick="removeBadgeNew()" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:12px">✕ إزالة</button></div>';
    }
    h+='<div style="margin-top:10px"><span style="background:rgba(255,215,0,.12);border:1px solid #FFD700;border-radius:14px;padding:8px 18px;display:inline-block;cursor:pointer" onclick="go(\'wallet\',null)"><span style="font-size:17px;font-weight:900;color:#FFD700">🪙 '+coins+'</span></span></div></div>';
    if(admin){
      h+='<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">'
      +'<button class="lbtn" style="margin:0;background:linear-gradient(135deg,#8B5CF6,#6D28D9)" onclick="addReadyBadgesNew()">🏅 إضافة الشارات الأربعة الجاهزة</button>'
      +'<button class="lbtn" style="margin:0;background:linear-gradient(135deg,#3B82F6,#1D4ED8)" onclick="document.getElementById(\'badgeManualNew\').click()">➕ إضافة شارة من جهازك</button>'
      +'<input type="file" id="badgeManualNew" accept="image/*,.gif,.webp" style="display:none" onchange="addManualBadgeNew(event)">'
      +'</div>';
    }
    h+='<div id="badgesGridNew" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div style="text-align:center;color:var(--mut);grid-column:1/-1">جاري التحميل...</div></div>';
    box.innerHTML=h;

    var d=await sb.from('badges').select('*').order('id',{ascending:true});
    if(d.error){
      var g=el('badgesGridNew');
      if(g)g.innerHTML='<div style="color:var(--red);grid-column:1/-1;text-align:center;font-size:12px">⚠️ '+d.error.message+'<br><span style="font-size:10px">نفّذ في Supabase SQL: alter table badges disable row level security;</span></div>';
      return;
    }
    var list=(d.data||[]);
    var grid=el('badgesGridNew');if(!grid)return;
    var g='';
    if(!list.length)g+='<div style="text-align:center;color:var(--mut);grid-column:1/-1;padding:20px">لا توجد شارات — الإدارة تضيفها من الزرار فوق</div>';
    list.forEach(function(bd){
      var owned=(me.my_badges||[]).indexOf(bd.id)>-1;
      var eq=(me.active_badge===bd.id);
      var rar=bd.rarity||'عادي';
      var rc={'عادي':'#94a3b8','أسطوري':'#FFD700','ملكي':'#EC4899','ملكي VIP':'#FF2E88','ملكي VIP فخم':'#D946EF'}[rar]||'#94a3b8';
      g+='<div style="background:var(--card);border:2px solid '+(eq?'#FFD700':'var(--line)')+';border-radius:16px;padding:12px;text-align:center;position:relative">';
      g+='<span style="position:absolute;top:-8px;right:8px;background:'+rc+';color:'+(rar==='عادي'?'#fff':'#111')+';font-size:9px;font-weight:bold;padding:2px 10px;border-radius:10px">'+rar+'</span>';
      if(admin)g+='<button class="xbtn" style="position:absolute;top:4px;left:4px" onclick="delBadgeNew('+bd.id+')">✕</button>';
      g+='<div style="width:80px;height:80px;margin:8px auto;background:radial-gradient(circle,'+rc+'22,transparent 70%);border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden">';
      g+='<img src="'+bd.url+'" style="max-width:100%;max-height:100%;object-fit:contain"></div>';
      g+='<div style="font-weight:bold;font-size:13px;color:var(--txt)">'+escapeHtml(bd.name||'')+'</div>';
      if(eq){g+='<div style="margin-top:8px;padding:9px;background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;border-radius:10px;font-size:12px;font-weight:900">✅ مُفعّلة</div>';}
      else if(owned){g+='<div style="margin-top:8px;padding:9px;background:var(--grn);color:#fff;border-radius:10px;font-size:12px;font-weight:bold;cursor:pointer" onclick="equipBadgeNew('+bd.id+')">✅ استخدمها</div>';}
      else{g+='<div style="margin-top:8px;padding:9px;background:linear-gradient(90deg,#00A8FF,#0071D4);color:#fff;border-radius:10px;font-size:12px;font-weight:bold;cursor:pointer" onclick="buyBadgeNew('+bd.id+')">🛒 اشترِ الآن</div>';}
      g+='</div>';
    });
    grid.innerHTML=g;
  }catch(e){console.error('badgesNew',e);}
};

/* ---------- 9) عنصر الإعدادات ---------- */
try{
  var lists=document.querySelectorAll('#s-settings .menu-list');
  var tgt=lists[0];
  if(tgt&&!el('badgesMenuItemNew')){
    var mi=document.createElement('div');
    mi.className='m-item';mi.id='badgesMenuItemNew';
    mi.innerHTML='<span>🏅 متجر الشارات</span><span>👈</span>';
    mi.onclick=function(){go('badgesNew',null);};
    tgt.insertBefore(mi,tgt.firstChild);
  }
}catch(e){}

/* ---------- 10) الشارة جنب الاسم ---------- */
var _snBN=window.styleName;
window.styleName=function(u){
  var base=_snBN(u);
  try{
    if(u&&u.active_badge_url){
      return base+' <img src="'+u.active_badge_url+'" style="width:18px;height:18px;object-fit:contain;vertical-align:middle;margin-right:3px;filter:drop-shadow(0 0 4px rgba(255,215,0,.5))">';
    }
  }catch(e){}
  return base;
};

/* ---------- 11) الربط ---------- */
var _goBN=window.go;
window.go=function(s,nv,fb){
  var r=_goBN(s,nv,fb);
  try{if(s==='badgesNew')renderBadgesNew();}catch(e){}
  return r;
};
})();
/* ===== ✅ التوثيق: شارة التوثيق + الظهور دائماً في الأوائل ===== */
(function(){
if(window._verifySys)return;window._verifySys=true;

/* 1) زرار التوثيق في قائمة العضو (للإدارة) */
try{
  var um=document.getElementById('userModal');
  if(um&&!el('verifyUserBtn')){
    var btn=document.createElement('button');
    btn.id='verifyUserBtn';
    btn.style.cssText='background:linear-gradient(135deg,#3B82F6,#1D4ED8);color:#fff';
    btn.innerHTML='✅ توثيق العضو / إلغاء التوثيق';
    btn.onclick=async function(){
      if(!isAdmin())return toast('ممنوع');
      var n=umTarget;
      if(isOwnerName(n))return toast('👑 صاحب الموقع موثق دائماً');
      var u=await SDB.getUser(n);
      if(!u)return toast('العضو غير موجود');
      if(u.verified===true){
        await SDB.patchUser(n,{verified:false,verified_badge:null});
        toast('❌ تم إلغاء التوثيق لـ '+n);
      }else{
        var url=prompt('رابط صورة التوثيق (اتركه فاضي للصورة الافتراضية ✅):');
        var badgeUrl=url||'https://cdn.phototourl.com/member/2026-10-06-26f9a1ae-1457-4c9b-9bea-03567f26c789.webp';
        await SDB.patchUser(n,{verified:true,verified_badge:badgeUrl});
        toast('✅ تم توثيق '+n);
      }
      try{logActivity('verify','توثيق/إلغاء توثيق: '+n);}catch(e){}
      closeModal('userModal');
      refreshUsers();
    };
    var closeBtn=um.querySelector('button[onclick="closeModal(\'userModal\')"]');
    um.insertBefore(btn,closeBtn);
  }
}catch(e){}

/* 2) التوثيق جنب الاسم في كل الموقع (شارة ✅ صغيرة) */
var _snV=window.styleName;
window.styleName=function(u){
  var base=_snV(u);
  try{
    if(u&&u.verified===true){
      var badge=u.verified_badge||'';
      if(badge){
        return base+' <img src="'+badge+'" style="width:15px;height:15px;object-fit:contain;vertical-align:middle;margin-right:2px;filter:drop-shadow(0 0 3px rgba(59,130,246,.6))">';
      }
      return base+' <span style="display:inline-flex;width:13px;height:13px;background:linear-gradient(135deg,#3B82F6,#1D4ED8);border-radius:50%;color:#fff;font-size:9px;font-weight:900;align-items:center;justify-content:center;vertical-align:middle;margin-right:2px">✓</span>';
    }
  }catch(e){}
  return base;
};

/* 3) الموثقين دايماً في الأوائل — ترتيب قايمة المتصلين */
var _roV=window.renderOnline;
window.renderOnline=function(){
  var r=_roV();
  try{
    /* بعد الرسم: نعيد ترتيب الكروت — الموثق فوق */
    var box=el('usersList');
    if(!box)return r;
    var cards=[];
    var kids=[];
    for(var i=0;i<box.children.length;i++)kids.push(box.children[i]);
    /* نفصل: الموثقين أولاً ثم الباقي بنفس ترتيبهم */
    var verified=[],others=[],promos=[];
    kids.forEach(function(child){
      var oc=child.getAttribute&&child.getAttribute('onclick')||'';
      var nm='';
      try{
        var m2=oc.match(/openUser\('([^']+)'\)/);
        if(m2)nm=m2[1];
      }catch(e){}
      var u=nm?usersCache[nm]:null;
      if(child.id==='emptyPromo'||child.id==='richListBox'){promos.push(child);return;}
      if(u&&u.verified===true)verified.push(child);
      else others.push(child);
    });
    if(verified.length&&others.length){
      box.innerHTML='';
      verified.forEach(function(c){box.appendChild(c);});
      others.forEach(function(c){box.appendChild(c);});
      promos.forEach(function(c){box.insertBefore(c,box.firstChild);});
    }
  }catch(e){}
  return r;
};

/* 4) التوثيق يظهر في البروفايل كمان (بجانب الاسم) */
var _oupV=window.openUserProfile;
window.openUserProfile=function(name){
  var r=_oupV(name);
  try{
    setTimeout(function(){
      var u=usersCache[name]||{};
      var nm=el('upName');
      if(nm&&u.verified===true&&!nm.querySelector('.verifyBadge')){
        var b=document.createElement('span');
        b.className='verifyBadge';
        if(u.verified_badge){
          b.innerHTML=' <img src="'+u.verified_badge+'" style="width:18px;height:18px;object-fit:contain;vertical-align:middle;filter:drop-shadow(0 0 3px rgba(59,130,246,.6))">';
        }else{
          b.innerHTML=' <span style="display:inline-flex;width:16px;height:16px;background:linear-gradient(135deg,#3B82F6,#1D4ED8);border-radius:50%;color:#fff;font-size:10px;font-weight:900;align-items:center;justify-content:center;vertical-align:middle">✓</span>';
        }
        nm.appendChild(b);
      }
    },400);
  }catch(e){}
  return r;
};
})();
/* ===== 🧹 إزالة زرار "الشارات الأربعة الجاهزة" ===== */
(function(){
if(window._seedBtnOff)return;window._seedBtnOff=true;

/* تعطيل دالة التسجيل التلقائي */
window.seedBadgesFinal=function(){toast('✅ الشارات الأربعة تم إضافتها من قبل');};
window.seedBadgesNow=function(){toast('✅ الشارات الأربعة تم إضافتها من قبل');};
window.addReadyBadgesNew=function(){toast('✅ الشارات الأربعة تم إضافتها من قبل');};
window.addReadyBadges=function(){toast('✅ الشارات الأربعة تم إضافتها من قبل');};

/* إزالة أي زرار تسجيل ظاهر في متجر الشارات */
setInterval(function(){
  try{
    var box=el('badgesBodyNew')||el('badgesBody2')||el('badgesBody');
    if(!box)return;
    var btns=box.querySelectorAll('button.lbtn');
    for(var i=0;i<btns.length;i++){
      var t=btns[i].innerText||'';
      if(t.indexOf('الشارات الأربعة')>-1||t.indexOf('الشارات الأربع')>-1){
        btns[i].remove();
      }
    }
  }catch(e){}
},1500);
})();
/* ===== 🏅 متجر سونيك: إضافة الشارات + توسيع باقات الشحن ===== */
(function(){
if(window._shopBadge)return;window._shopBadge=true;
var BADGE_COST=500;

/* 1) منتج الشارات في متجر سونيك (تحت لون رسايلك) */
var _rsB=window.renderShop;
window.renderShop=function(){
  var r=_rsB?_rsB():undefined;
  try{
    var box=el('shopBody');if(!box||!me)return r;
    setTimeout(function(){
      try{
        var box2=el('shopBody');if(!box2||box2.querySelector('.shopBadgeRow'))return;
        /* نحدد آخر صف (لون رسايلك) ونحط بعده */
        var divs=box2.querySelectorAll('div');
        var lastProd=null;
        for(var i=0;i<divs.length;i++){
          var t=divs[i].innerText||'';
          if(t.indexOf('لون رسايلك')>-1&&t.indexOf('رسايلك بإطار')>-1){
            lastProd=divs[i];break;
          }
        }
        if(!lastProd)return;
        var coins=(me.coins)||0;
        var badgeActive=(me.badgeExp&&me.badgeExp>Date.now())||(me.active_badge_url&&me.active_badge_url.length>0);
        var h='<div class="shopBadgeRow" style="background:var(--card);border:1px solid '+(badgeActive?'var(--grn)':'var(--line)')+';border-radius:14px;padding:14px;display:flex;align-items:center;gap:12px;margin-top:10px">';
        h+='<div style="width:52px;height:52px;border-radius:12px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0">🏅</div>';
        h+='<div style="flex:1;min-width:0"><div style="font-weight:bold;font-size:14px;color:var(--txt)">🏅 شارة حصرية</div>';
        h+='<div style="font-size:11px;color:var(--mut);margin-top:3px">شارات فخمة تظهر في البروفايل — 30 يوم</div>';
        if(badgeActive)h+='<div style="font-size:11px;color:var(--grn);font-weight:bold;margin-top:4px">✅ مُفعّل — اخترها من متجر الشارات</div>';
        h+='</div><div style="flex-shrink:0">';
        if(badgeActive)h+='<div style="font-size:11px;color:var(--grn);font-weight:bold">✅</div>';
        else if(coins>=BADGE_COST)h+='<button class="adm-btn" style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-weight:900;border-radius:12px;padding:8px 14px" onclick="buyShopBadge()">🪙 '+BADGE_COST+'</button>';
        else h+='<div style="font-size:11px;color:var(--red);text-align:center;font-weight:bold">'+BADGE_COST+'<div style="font-size:9px">ناقص '+(BADGE_COST-coins)+'</div></div>';
        h+='</div></div>';
        lastProd.insertAdjacentHTML('afterend',h);
      }catch(e){}
    },120);
  }catch(e){}
  return r;
};

/* شراء شارة من المتجر = فتح حق الشارات 30 يوم */
window.buyShopBadge=function(){
  if((me.coins||0)<BADGE_COST)return toast('🪙 العملات غير كافية — يرجي الشحن');
  if(!confirm('فتح ميزة الشارات بـ '+BADGE_COST+' عملة لمدة 30 يوم؟'))return;
  updateMe({coins:(me.coins||0)-BADGE_COST,badgeExp:Date.now()+30*86400000}).then(function(){
    toast('🎉 تم فتح ميزة الشارات! اخترها من متجر الشارات');
    try{renderShop();}catch(e){}
  });
};

/* حصار الشارات: اللي مشتركش مينفعش يشتري منها */
var _bb2=window.buyBadge2b;
window.buyBadge2b=async function(id){
  try{
    if(!isAdmin()&&!(me&&me.badgeExp&&me.badgeExp>Date.now())){
      return toast('🔒 الشارات تتطلب اشتراك — فعّلها من متجر سونيك (500 عملة)');
    }
  }catch(e){}
  return _bb2?_bb2(id):undefined;
};
var _bb3=window.buyBadgeNew;
window.buyBadgeNew=async function(id){
  try{
    if(!isAdmin()&&!(me&&me.badgeExp&&me.badgeExp>Date.now())){
      return toast('🔒 الشارات تتطلب اشتراك — فعّلها من متجر سونيك (500 عملة)');
    }
  }catch(e){}
  return _bb3?_bb3(id):undefined;
};

/* 2) توسيع باقات الشحن (مسافات أوسع) */
var _rwW2=window.renderWallet;
window.renderWallet=function(){
  var r=_rwW2?_rwW2():undefined;
  try{
    setTimeout(function(){
      try{
        var box=el('walletBody');if(!box)return;
        var grid=box.querySelector('div[style*="grid-template-columns:1fr 1fr"]');
        if(grid){
          grid.style.gap='12px';
          var cards=grid.children;
          for(var i=0;i<cards.length;i++){
            cards[i].style.padding='14px 10px';
            cards[i].style.minHeight='110px';
          }
        }
      }catch(e){}
    },100);
  }catch(e){}
  return r;
};
})();
/* ===== 💰 باقات شحن إضافية: من 600 لـ 1500 عملة ===== */
(function(){
if(window._packsExtra)return;window._packsExtra=true;
var EXTRA=[
 {coins:600,price:240,bonus:120},
 {coins:700,price:280,bonus:150},
 {coins:800,price:320,bonus:190},
 {coins:900,price:360,bonus:240},
 {coins:1000,price:400,bonus:300},
 {coins:1250,price:500,bonus:400},
 {coins:1500,price:600,bonus:525}
];

/* ندمجها مع الباقات الحالية (اللي من الباتش القديم ممكن تكون بأسماء مختلفة — نتعامل مع الكل) */
function getAllPacks(){
  try{
    var out=[];
    /* الباقات الأساسية الموجودة في شاشة عملاتي */
    var basic=[
      [100,40,0],[150,60,5],[200,80,10],[250,100,20],[300,120,30],[350,140,45],
      [400,160,60],[450,180,80],[500,200,100]
    ];
    basic.forEach(function(p){out.push({coins:p[0],price:p[1],bonus:p[2]});});
    EXTRA.forEach(function(p){out.push(p);});
    /* نحذف المكرر */
    var seen={},final=[];
    out.forEach(function(p){
      var k=p.coins+'_'+p.price;
      if(!seen[k]){seen[k]=1;final.push(p);}
    });
    return final;
  }catch(e){return EXTRA;}
}

/* إعادة رسم شبكة الباقات في عملاتي: كل الباقات مع بعض */
var _rwX=window.renderWallet;
window.renderWallet=function(){
  var r=_rwX?_rwX():undefined;
  try{
    setTimeout(function(){
      try{
        var box=el('walletBody');if(!box)return;
        var grid=box.querySelector('div[style*="grid-template-columns:1fr 1fr"]');
        if(!grid)return;
        var packs=getAllPacks();
        var h='';
        packs.forEach(function(p,idx){
          var total=p.coins+p.bonus;
          var isBig=p.coins>=800;
          var isMax=(idx===packs.length-1);
          h+='<div onclick="openPackPayExtra('+p.coins+','+p.price+','+p.bonus+')" style="background:var(--card);border:2px solid '+(isMax?'#FFD700':'var(--line)')+';border-radius:14px;padding:12px;text-align:center;cursor:pointer;position:relative'+(isMax?';box-shadow:0 0 16px rgba(255,215,0,.35)':'')+'">';
          if(p.bonus>0)h+='<span style="position:absolute;top:-8px;right:10px;background:var(--grn);color:#fff;font-size:9px;font-weight:bold;padding:2px 8px;border-radius:8px">🎁 +'+p.bonus+' مجاناً</span>';
          if(isMax)h+='<span style="position:absolute;top:-8px;left:10px;background:#FFD700;color:#111;font-size:9px;font-weight:bold;padding:2px 8px;border-radius:8px">👑 الأضخم</span>';
          h+='<div style="font-size:20px;font-weight:900;color:#FFD700;margin-top:'+(p.bonus>0?'6px':'2px')+'">🪙 '+total+'</div>';
          if(p.bonus>0)h+='<div style="font-size:10px;color:var(--mut)">'+p.coins+' + '+p.bonus+' هدية</div>';
          else h+='<div style="font-size:10px;color:var(--mut)">'+p.coins+' عملة</div>';
          h+='<div style="font-size:15px;font-weight:900;color:var(--txt);margin-top:6px">'+p.price+' جنيه</div></div>';
        });
        grid.innerHTML=h;
      }catch(e){}
    },100);
  }catch(e){}
  return r;
};

/* نافذة الدفع للباقات الجديدة */
window.openPackPayExtra=function(coins,price,bonus){
  if(!me)return toast('سجل دخولك أولاً');
  var total=coins+bonus;
  var old=el('buyCoinsModal');if(old)old.remove();
  var m=document.createElement('div');m.id='buyCoinsModal';m.className='modal';
  m.innerHTML='<div class="m-card2" style="width:330px;max-height:88vh;overflow-y:auto">'
  +'<h3 style="color:#FFD700">🪙 شراء '+total+' عملة</h3>'
  +'<div style="background:var(--bg);border-radius:12px;padding:10px;text-align:center;margin-bottom:8px">'
  +'<div style="font-size:13px;color:var(--mut)">'+coins+' عملة'+(bonus>0?' <b style="color:var(--grn)">+ '+bonus+' هدية 🎁</b>':'')+'</div>'
  +'<div style="font-size:26px;font-weight:900;color:var(--txt);margin-top:4px">'+price+' جنيه</div></div>'
  +'<p style="font-size:13px;text-align:center;color:var(--txt)">حوّل <b style="color:#FFD700">'+price+' جنيه</b> على فودافون كاش:</p>'
  +'<div onclick="copyVoda()" style="background:var(--bg);border:2px dashed #FFD700;border-radius:12px;padding:12px;text-align:center;cursor:pointer">'
  +'<div style="font-size:22px;font-weight:900;color:#FFD700;direction:ltr">01013255816</div>'
  +'<div style="font-size:11px;color:var(--mut);margin-top:4px">📊 اضغط للنسخ 📋</div></div>'
  +'<div style="font-size:12px;color:var(--txt);text-align:center;margin:10px 0 6px">بعد التحويل، ارفع صورة الإيصال:</div>'
  +'<input type="file" id="topupImg" accept="image/*" style="display:none" onchange="previewTopup(event)">'
  +'<label for="topupImg" id="topupImgLabel" style="width:100%;min-height:70px;background:var(--bg);border:2px dashed var(--line);border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:24px;margin-bottom:6px">📷 ارفع صورة التحويل</label>'
  +'<textarea id="topupNote" placeholder="ملاحظة (اختياري)..." style="width:100%;background:var(--bg);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px;font-size:12px;min-height:40px;resize:none;margin-bottom:6px"></textarea>'
  +'<button style="background:var(--grn);color:#fff" onclick="submitPackExtra('+coins+','+price+','+bonus+')">✅ إرسال الطلب للإدارة</button>'
  +'<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'buyCoinsModal\')">إغلاق</button></div>';
  m.onclick=function(e){if(e.target===m)closeModal('buyCoinsModal');};
  document.body.appendChild(m);
  m.classList.add('open');
};

window.submitPackExtra=async function(coins,price,bonus){
  if(!window._topupImg)return toast('📷 ارفع صورة التحويل الأول');
  var note=(el('topupNote')?el('topupNote').value.trim():'');
  toast('⏳ جاري الإرسال...');
  var url=await uploadMedia(window._topupImg,'.jpg');
  if(!url)return toast('فشل رفع الصورة');
  var total=coins+bonus;
  var r=await sb.from('topup_requests').insert({
    user:me.name,amount:total,price:price,img:url,
    note:(note?note+' | ':'')+'باقة '+coins+'+'+bonus,
    status:'pending',time:Date.now()
  });
  if(r&&r.error)return toast('❌ خطأ: '+r.error.message);
  window._topupImg=null;
  closeModal('buyCoinsModal');
  toast('✅ وصل طلبك — تستلم '+total+' عملة بعد التأكيد');
  try{renderWallet();}catch(e){}
};

/* توست ذهبي للباقة الأضخم */
var _lastBig=0;
})();
/* ===== ✨ نظام الدخول النهائي: للمشتركين والإدارة والمالك فقط ===== */
(function(){
if(window._entryFinal)return;window._entryFinal=true;

/* 1) تعطيل كل الأنظمة القديمة: نتأكد إن كل عضو "أُعلن عنه" عشان حلقات المراقبة القديمة ما تشتغلش */
setInterval(function(){
  try{
    for(var k in usersCache){
      var u=usersCache[k];
      /* العلم القديم _announced = true دائماً → الأنظمة القديمة صامتة */
      if(u._announced!==true)u._announced=true;
    }
  }catch(e){}
},1000);

/* 2) تعطيل بانرات الأنظمة القديمة لو ظهرت */
setInterval(function(){
  try{
    /* بانرات الأنظمة القديمة بتتعرّف بـ id entryFx — بنتحقق: لو العضو العادي مملوكها نشيلها */
    var b=el('entryFx');
    if(b&&b.getAttribute('data-final')!=='1'){
      /* بنشوف مين صاحب البانر من اسمه جواه */
      var txt=b.innerText||'';
      /* البانرات القديمة لعضو عادي = بنشيلها */
      var isVipBanner=(txt.indexOf('VIP')>-1||txt.indexOf('الملك')>-1||txt.indexOf('الإدارة')>-1);
      if(!isVipBanner){b.remove();}
      else{b.setAttribute('data-final','1');}
    }
  }catch(e){}
},500);

/* 3) الأنيميشن */
try{
  var st=document.createElement('style');
  st.textContent='@keyframes entrySlideDownF{0%{transform:translateY(-100%);opacity:0}100%{transform:translateY(0);opacity:1}}'
  +'@keyframes entrySlideUpF{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-100%);opacity:0}}'
  +'@keyframes entryGlowF{0%,100%{box-shadow:0 4px 20px rgba(0,0,0,.5)}50%{box-shadow:0 4px 34px rgba(255,215,0,.7)}}'
  +'.entryFxHost{position:relative}';
  document.head.appendChild(st);
}catch(e){}

/* 4) فلتر صارم: مين له تأثير دخول؟ */
function canHaveEntryFx(u){
  try{
    if(!u)return false;
    if(isOwnerName(u.name))return true;                    /* 👑 المالك */
    if(isAdmin())return true;                               /* 🛡️ الإدارة */
    if(u.role&&u.role.indexOf('سوبر')>-1)return true;       /* ⭐ سوبر */
    /* أي اشتراك نشط */
    if(u.penColorExp&&u.penColorExp>Date.now())return true; /* 🎨 لون الرسايل */
    if(u.nameStyleExp&&u.nameStyleExp>Date.now())return true;/* 👑 تميّز الاسم */
    if(u.frameExp&&u.frameExp>Date.now())return true;       /* 🖼️ الإطار */
    if(u.badgeExp&&u.badgeExp>Date.now())return true;       /* 🏅 الشارات */
    if(u.vipExp&&u.vipExp>Date.now())return true;           /* 💎 VIP */
    if(u.welcome_pack_used===true)return true;              /* 🎁 باقة الترحيب */
    return false;                                           /* ❌ عضو عادي: لا شيء */
  }catch(e){return false;}
}

function fxHost(){
  try{
    var c=el('s-chat');
    if(c&&c.classList.contains('active')&&!c.classList.contains('entryFxHost'))c.classList.add('entryFxHost');
    return (el('s-chat')&&el('s-chat').classList.contains('active'))?el('s-chat'):document.body;
  }catch(e){return document.body;}
}

/* 5) التأثير النهائي */
window.showEntryEffectFinal=function(u){
  try{
    /* الفلتر الصارم أولاً */
    if(!canHaveEntryFx(u))return;
    var old=el('entryFxFinal');
    if(old)old.remove();
    var host=fxHost();
    var isOwnerU=isOwnerName(u.name);
    var isAdminU=false;
    try{isAdminU=(u.role&&(u.role.indexOf('إدارة')>-1||u.role.indexOf('سوبر')>-1));}catch(e){}

    var bg,border,title,badge,dur;
    if(isOwnerU){
      bg='linear-gradient(90deg,#78350f,#d97706,#fbbf24,#d97706,#78350f)';
      border='2px solid #FFD700';
      title='👑 دخل الملك 👑';
      badge='<span style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-size:10px;font-weight:900;padding:4px 12px;border-radius:12px;flex-shrink:0;animation:entryGlowF 1.5s infinite">👑 VIP صاحب الموقع</span>';
      dur=5000;
    }else if(isAdminU){
      bg='linear-gradient(90deg,#4c1d95,#7c3aed,#4c1d95)';
      border='2px solid #A78BFA';
      title='🛡️ دخلت الإدارة';
      badge='<span style="background:#7C3AED;color:#fff;font-size:10px;font-weight:900;padding:4px 10px;border-radius:12px;flex-shrink:0">🛡️ إدارة</span>';
      dur=4500;
    }else{
      bg='linear-gradient(90deg,#78350f,#b45309,#78350f)';
      border='2px solid #FFD700';
      title='✨ دخل الآن';
      badge='<span style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-size:10px;font-weight:900;padding:4px 10px;border-radius:12px;flex-shrink:0">👑 VIP</span>';
      dur=4000;
    }

    var banner=document.createElement('div');
    banner.id='entryFxFinal';
    banner.setAttribute('data-final','1');
    banner.style.cssText='position:absolute;top:0;left:0;right:0;z-index:450;background:'+bg+';border-bottom:'+border+';padding:12px 14px;display:flex;align-items:center;gap:10px;animation:entrySlideDownF .6s ease forwards'+(isOwnerU?',entryGlowF 1.5s infinite 0.6s':'')+';overflow:hidden';
    banner.innerHTML='<div style="font-size:22px;animation:wpBounce 1.2s infinite">'+(isOwnerU?'👑':'✨')+'</div>'
    +getAvatarHTML(u,38)
    +'<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:900;color:#fff;text-shadow:0 1px 4px #000">'+title+'</div>'
    +'<div style="font-size:12.5px;margin-top:2px">'+styleName(u)+'</div></div>'
    +badge;
    host.appendChild(banner);
    if(me&&me.sndNotif!==false)try{beep(isOwnerU?1200:800);}catch(e){}
    setTimeout(function(){
      try{banner.style.animation='entrySlideUpF .5s ease forwards';}catch(e){}
      setTimeout(function(){try{banner.remove();}catch(e){}},600);
    },dur);
  }catch(e){}
};

/* 6) المراقبة الجديدة: بعلم منفصل _announced2 */
var _track2={};
setInterval(function(){
  try{
    if(!me)return;
    for(var k in usersCache){
      var u=usersCache[k];
      var wasIn=_track2[k];
      var nowIn=isOnline(u);
      _track2[k]=nowIn;
      if(nowIn&&!wasIn&&!u._announced2){
        u._announced2=true;
        showEntryEffectFinal(u);
      }
      if(!nowIn)u._announced2=false;
    }
  }catch(e){}
},3000);

/* 7) دخولي أنا: يظهر لو معايا الحق فقط */
var _enF=window.enter;
window.enter=async function(u){
  var r=await _enF(u);
  try{
    if(u&&canHaveEntryFx(u)){
      u._announced2=true;
      setTimeout(function(){
        try{el('s-chat').classList.add('entryFxHost');}catch(e){}
        setTimeout(function(){showEntryEffectFinal(u);},200);
      },1500);
    }
  }catch(e){}
  return r;
};
/* استرجاع الجلسة */
var _smF=window.subMsgs;
window.subMsgs=async function(){
  var r=await _smF();
  try{
    if(me&&!window._myEntryFinal&&canHaveEntryFx(me)){
      window._myEntryFinal=true;
      setTimeout(function(){showEntryEffectFinal(me);},900);
    }
  }catch(e){}
  return r;
};
})();
/* ===== ✨ تأثير الدخول النهائي: مرة واحدة فقط عند فتح الموقع ===== */
(function(){
if(window._entryOnce)return;window._entryOnce=true;

/* الأنيميشن */
try{
  var st=document.createElement('style');
  st.textContent='@keyframes entrySlideDown2{0%{transform:translateY(-100%);opacity:0}100%{transform:translateY(0);opacity:1}}'
  +'@keyframes entrySlideUp2{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-100%);opacity:0}}'
  +'@keyframes entryGlow2{0%,100%{box-shadow:0 4px 20px rgba(0,0,0,.5)}50%{box-shadow:0 4px 34px rgba(255,215,0,.7)}}'
  +'.entryFxHost{position:relative}';
  document.head.appendChild(st);
}catch(e){}

/* مين له تأثير؟ */
function canEntryFx(u){
  try{
    if(!u)return false;
    if(isOwnerName(u.name))return true;
    if(isAdmin())return true;
    if(u.role&&u.role.indexOf('سوبر')>-1)return true;
    if(u.penColorExp&&u.penColorExp>Date.now())return true;
    if(u.nameStyleExp&&u.nameStyleExp>Date.now())return true;
    if(u.frameExp&&u.frameExp>Date.now())return true;
    if(u.badgeExp&&u.badgeExp>Date.now())return true;
    if(u.vipExp&&u.vipExp>Date.now())return true;
    if(u.welcome_pack_used===true)return true;
    return false;
  }catch(e){return false;}
}

function fxHost(){
  try{
    var c=el('s-chat');
    if(c&&c.classList.contains('active')&&!c.classList.contains('entryFxHost'))c.classList.add('entryFxHost');
    return (el('s-chat')&&el('s-chat').classList.contains('active'))?el('s-chat'):document.body;
  }catch(e){return document.body;}
}

/* التأثير */
window.showEntryOnce=function(u){
  try{
    if(!canEntryFx(u))return;
    /* حماية من التكرار: مفيش بانر تاني في نفس الدقيقة */
    var now=Date.now();
    if(window._lastEntryFx&&now-window._lastEntryFx<60000)return;
    window._lastEntryFx=now;
    var old=el('entryFxOnce');
    if(old)old.remove();

    var host=fxHost();
    var isOwnerU=isOwnerName(u.name);
    var isAdminU=false;
    try{isAdminU=(u.role&&(u.role.indexOf('إدارة')>-1||u.role.indexOf('سوبر')>-1));}catch(e){}

    var bg,border,title,badge,dur;
    if(isOwnerU){
      bg='linear-gradient(90deg,#78350f,#d97706,#fbbf24,#d97706,#78350f)';
      border='2px solid #FFD700';
      title='👑 دخل الملك 👑';
      badge='<span style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-size:10px;font-weight:900;padding:4px 12px;border-radius:12px;flex-shrink:0;animation:entryGlow2 1.5s infinite">👑 VIP صاحب الموقع</span>';
      dur=5000;
    }else if(isAdminU){
      bg='linear-gradient(90deg,#4c1d95,#7c3aed,#4c1d95)';
      border='2px solid #A78BFA';
      title='🛡️ دخلت الإدارة';
      badge='<span style="background:#7C3AED;color:#fff;font-size:10px;font-weight:900;padding:4px 10px;border-radius:12px;flex-shrink:0">🛡️ إدارة</span>';
      dur=4500;
    }else{
      bg='linear-gradient(90deg,#78350f,#b45309,#78350f)';
      border='2px solid #FFD700';
      title='✨ دخل الآن';
      badge='<span style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-size:10px;font-weight:900;padding:4px 10px;border-radius:12px;flex-shrink:0">👑 VIP</span>';
      dur=4000;
    }

    var banner=document.createElement('div');
    banner.id='entryFxOnce';
    banner.setAttribute('data-final','1');
    banner.style.cssText='position:absolute;top:0;left:0;right:0;z-index:450;background:'+bg+';border-bottom:'+border+';padding:12px 14px;display:flex;align-items:center;gap:10px;animation:entrySlideDown2 .6s ease forwards'+(isOwnerU?',entryGlow2 1.5s infinite 0.6s':'')+';overflow:hidden';
    banner.innerHTML='<div style="font-size:22px;animation:wpBounce 1.2s infinite">'+(isOwnerU?'👑':'✨')+'</div>'
    +getAvatarHTML(u,38)
    +'<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:900;color:#fff;text-shadow:0 1px 4px #000">'+title+'</div>'
    +'<div style="font-size:12.5px;margin-top:2px">'+styleName(u)+'</div></div>'
    +badge;
    host.appendChild(banner);
    if(me&&me.sndNotif!==false)try{beep(isOwnerU?1200:800);}catch(e){}
    setTimeout(function(){
      try{banner.style.animation='entrySlideUp2 .5s ease forwards';}catch(e){}
      setTimeout(function(){try{banner.remove();}catch(e){}},600);
    },dur);
  }catch(e){}
};

/* ⭐ النظام: مرة واحدة بس عند فتح الموقع */
var _saE=window.startAll;
window.startAll=async function(){
  var r=await _saE();
  try{
    /* بعد ثانية ونص من فتح الموقع — للتأثير الخاص بيك أنت */
    setTimeout(function(){
      if(me&&canEntryFx(me))showEntryOnce(me);
    },1500);
    /* ولو عضو مشترك تاني دخل في نفس اللحظة — يظهر ليك برضه (مرة واحدة) */
    setTimeout(function(){
      try{
        for(var k in usersCache){
          if(k===me.name)continue;
          var u=usersCache[k];
          if(canEntryFx(u)&&isOnline(u)){
            showEntryOnce(u);
            break; /* واحد بس */
          }
        }
      }catch(e){}
    },2500);
  }catch(e){}
  return r;
};

/* ⛔ تعطيل التكرار: بطلنا مراقبة الأونلاين خالص — ده كان سبب التكرار */
window.showEntryEffect=function(){};
window.showEntryEffectFinal=function(){};
})();
/* ===== 🎁 ترحيب يودي للعروض + تبديل المتاجر + تثبيت سونيك فوق ===== */
(function(){
if(window._navFixFinal)return;window._navFixFinal=true;

/* 1) نافذة الترحيب: زرارها يودي لصفحة عملاتي (العروض) بدل ما يفتح دفع */
var _wpE=window.openWPPack;
window.openWPPack=function(){
  var r=_wpE?_wpE():undefined;
  try{
    setTimeout(function(){
      var m=el('wpModal');
      if(!m)return;
      var btns=m.querySelectorAll('button');
      for(var i=0;i<btns.length;i++){
        var t=btns[i].innerText||'';
        if(t.indexOf('ادفع')>-1||t.indexOf('اشحن')>-1){
          /* نستبدل الزرار: يودي لصفحة العروض (عملاتي) */
          btns[i].innerHTML='🛒 اذهب إلى العروض والدفع';
          btns[i].onclick=function(){
            closeModal('wpModal');
            try{go('wallet',null);}catch(e){}
          };
          break;
        }
      }
    },60);
  }catch(e){}
  return r;
};

/* لو نافذة الترحيب مقفولة والباقة شغالة: زرار يظهر في عملاتي فوق الباقات */
try{
  var _rwW3=window.renderWallet;
  window.renderWallet=function(){
    var r=_rwW3?_rwW3():undefined;
    try{
      setTimeout(function(){
        try{
          var box=el('walletBody');
          if(!box||!me)return;
          if(me.welcome_pack_used===true)return;
          if(Date.now()>Date.now()+6.5*86400000)return;
          if(el('wpOfferRow'))return;
          /* نلاقي عنوان الباقات ونحط العرض قبلته */
          var divs=box.querySelectorAll('div');
          for(var i=0;i<divs.length;i++){
            var t=divs[i].innerText||'';
            if(t.indexOf('باقات الشحن')>-1&&t.indexOf('مكافآت')>-1){
              var offer=document.createElement('div');
              offer.id='wpOfferRow';
              offer.style.cssText='background:linear-gradient(135deg,#1d4ed8,#7c3aed);border:2px solid #FFD700;border-radius:14px;padding:12px;margin-bottom:10px;display:flex;align-items:center;gap:10px;cursor:pointer';
              offer.onclick=function(){openWPPack();};
              offer.innerHTML='<div style="font-size:26px">🎁</div>'
              +'<div style="flex:1"><div style="color:#fff;font-weight:900;font-size:13.5px">🎉 باقة هدربا — أول شحنة</div>'
              +'<div style="color:#fde047;font-size:11px;margin-top:2px">150ج = 375 عملة + 🖼️ إطار 7 أيام</div></div>'
              +'<span style="background:#FFD700;color:#111;font-size:11px;font-weight:900;padding:5px 12px;border-radius:10px">اذهب</span>';
              divs[i].parentElement.insertBefore(offer,divs[i]);
              break;
            }
          }
        }catch(e){}
      },150);
    }catch(e){}
    return r;
  };
}catch(e){}

/* 2) تبديل المتاجر في قايمة الإعدادات: شارات مكان سونيك + سونيك فوق الكل */
var _reorderDone=false;
function reorderMenus(){
  try{
    var scr=el('s-settings');
    if(!scr)return;
    var shopItem=el('shopMenuItem');
    var badgeItem=el('badgesMenuItemNew');
    if(!shopItem||!badgeItem)return;
    /* نضمن إنهم في نفس القايمة */
    var list=shopItem.parentElement;
    if(list!==badgeItem.parentElement){
      list.insertBefore(badgeItem,shopItem);
    }
    /* نبدل المكانين: الشارات في مكان سونيك الأصلي */
    var shopParent=shopItem.parentElement;
    var badgeParent=badgeItem.parentElement;
    /* نضمن إن متجر سونيك أول عنصر في أول قايمة */
    var firstList=document.querySelectorAll('#s-settings .menu-list')[0];
    if(firstList&&firstList.firstChild!==shopItem){
      firstList.insertBefore(shopItem,firstList.firstChild);
    }
    _reorderDone=true;
  }catch(e){}
}
setInterval(reorderMenus,2000);
setTimeout(reorderMenus,1000);

/* 3) تأمين: متجر سونيك مينزلش — إجبار النظام على رجوعه فوق */
var _goSF=window.go;
window.go=function(s,nv,fb){
  var r=_goSF(s,nv,fb);
  try{
    if(s==='settings')setTimeout(reorderMenus,150);
  }catch(e){}
  return r;
};
})();
(function(){
  /* ===== إزالة متجر سونيك + الويب + عملاتي نهائياً ===== */

  /* 1) شيل عنصر المتجر من قايمة الإعدادات */
  try{
    var sm=el('shopMenuItem');
    if(sm)sm.remove();
  }catch(e){}

  /* 2) شيل عنصر أثرياء الموقع */
  try{
    var ri=el('richMenuItem');
    if(ri)ri.remove();
  }catch(e){}

  /* 3) شيل شاشة المتجر نفسها */
  try{
    var ss=el('s-shop');
    if(ss)ss.remove();
  }catch(e){}

  /* 4) شيل شاشة الأثرياء */
  try{
    var rs=el('s-richlist');
    if(rs)rs.remove();
  }catch(e){}

  /* 5) شيل شاشة عملاتي لو موجودة */
  try{
    var ws=el('s-wallet');
    if(ws)ws.remove();
  }catch(e){}

  /* 6) اقفل أي دالة متجر عشان متشتغلش غلط لو اتنده */
  window.renderShop=function(){};
  window.renderWallet=function(){};
  window.renderRichList=function(){};
  window.buyProduct=function(){toast('🛒 المتجر مقفل حالياً');};
  window.buyShopFrame=function(){toast('🛒 المتجر مقفل حالياً');};
  window.openPackPay=function(){};
  window.getRichCoins=function(){return Promise.resolve([]);};

  /* 7) افتح قسم الألعاب للكل (كان مقفول VIP) */
  try{
    delete window.go;
  }catch(e){}

  /* 8) لو بفتح صفحة قديمة فيها shop أو wallet أو richlist → رجعه للإعدادات */
  try{
    var scr=document.querySelector('.screen.active');
    if(scr&&(scr.id==='s-shop'||scr.id==='s-richlist'||scr.id==='s-wallet')){
      go('settings',null,true);
    }
  }catch(e){}

  /* 9) راقب لو أي كود قديم حاول يفتح المتجر → ارجعه للإعدادات */
  var _goFix=window.go;
  window.go=function(s,nv,fb){
    if(s==='shop'||s==='richlist'||s==='wallet'){
      toast('🛒 المتجر مقفل حالياً');
      s='settings';
    }
    return _goFix(s,nv,fb);
  };

  /* 10) إعادة الفحص كل شوية (لو أي كود قديم رجّع العناصر) */
  setInterval(function(){
    try{
      var a=el('shopMenuItem');
      if(a)a.remove();
      var b=el('richMenuItem');
      if(b)b.remove();
    }catch(e){}
  },3000);

  toast('🛒 تم إزالة متجر سونيك');
})();
(function(){
  /* ===== 🏅 إصلاح شامل لنظام الشارات ===== */
  if(window._badgeConfirmFix)return;window._badgeConfirmFix=true;

  /* ---------- نافذة تأكيد الشراء الجميلة ---------- */
  window.buyBadgeNew=async function(id){
    if(!me)return;
    try{
      var d=await sb.from('badges').select('*').eq('id',id).limit(1);
      var bd=d.data&&d.data[0];if(!bd)return;
      var coins=(me.coins)||0;
      var price=(bd.price||0);
      var miss=price-coins;
      var old=el('buyBadgeConfirm');if(old)old.remove();
      var m=document.createElement('div');m.id='buyBadgeConfirm';m.className='modal';
      m.innerHTML='<div class="m-card2" style="width:320px">'
      +'<h3 style="color:#FFD700">🛒 تأكيد الشراء</h3>'
      +'<div style="background:var(--bg);border-radius:12px;padding:14px;text-align:center">'
      +'<img src="'+bd.url+'" style="width:70px;height:70px;object-fit:contain">'
      +'<div style="font-weight:bold;font-size:15px;color:var(--txt);margin-top:6px">'+escapeHtml(bd.name||'شارة')+'</div>'
      +'<div style="font-size:11px;color:var(--mut)">'+escapeHtml(bd.rarity||'')+'</div>'
      +'<div style="font-size:20px;font-weight:900;color:#FFD700;margin-top:8px">🪙 '+price+'</div></div>'
      +'<div style="font-size:12px;color:var(--txt);text-align:center">رصيدك الحالي: <b style="color:#FFD700">🪙 '+coins+'</b></div>'
      +(miss>0
        ?'<div style="background:rgba(230,69,83,.15);border:1px solid var(--red);border-radius:10px;padding:10px;text-align:center;color:var(--red);font-weight:bold;font-size:13px;margin-top:6px">❌ العملات غير كافية — ناقصك '+miss+' عملة<br><span style="font-size:11px">اشحن من "عملاتي" 💜</span></div>'
        :'<div style="font-size:14px;color:var(--txt);text-align:center;font-weight:bold;margin-top:6px">هل أنت راغب في الشراء؟</div>')
      +'<button style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111" onclick="confirmBuyBadgeNew('+id+','+price+')">✅ حسناً — اشترِ</button>'
      +'<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'buyBadgeConfirm\')">❌ إلغاء</button></div>';
      m.onclick=function(e){if(e.target===m)closeModal('buyBadgeConfirm');};
      document.body.appendChild(m);
      m.classList.add('open');
    }catch(e){toast('خطأ: '+e.message);}
  };

  /* ---------- تنفيذ الشراء بعد "حسناً" ---------- */
  window.confirmBuyBadgeNew=async function(id,price){
    try{
      var d=await sb.from('badges').select('*').eq('id',id).limit(1);
      var bd=d.data&&d.data[0];if(!bd)return;
      var coins=(me.coins)||0;
      if(coins<price){
        closeModal('buyBadgeConfirm');
        return toast('❌ ناقصك '+(price-coins)+' عملة — اشحن من عملاتي 💜');
      }
      closeModal('buyBadgeConfirm');
      toast('⏳ جاري الشراء...');
      await updateMe({coins:coins-price});
      var owned=(me.my_badges||[]);owned.push(id);
      await updateMe({my_badges:owned,active_badge:id,active_badge_url:bd.url});
      try{logTrans('buy',price,'شراء شارة: '+(bd.name||''),'');}catch(e){}
      toast('🏅 تم شراء الشارة وتفعيلها! 🎉');
      renderBadgesNew();
    }catch(e){toast('خطأ: '+e.message);}
  };

  /* ---------- قفل رسايل "الشارات تتطلب اشتراك" القديمة ---------- */
  var _tst=window.toast;
  window.toast=function(msg){
    var t=String(msg||'');
    if(t.indexOf('تتطلب اشتراك')>-1||t.indexOf('فعّلها من متجر')>-1||t.indexOf('مقفل')>-1)return;
    return _tst(msg);
  };

  /* ---------- منع فتح شاشة الشارات القديمة (s-badges القديمة) ---------- */
  var _goB=window.go;
  window.go=function(s,nv,fb){
    if(s==='badges'){s='badgesNew';}
    return _goB(s,nv,fb);
  };
})();
(function(){
  /* ===== تعديل زرار حسناً + تلوين حسب الرصيد ===== */
  if(window._badgeBtnColor)return;window._badgeBtnColor=true;

  /* 1) النافذة: زرار "حسناً" رمادي لو ناقص — ملون لو كفاية */
  var _bbnPrev=window.buyBadgeNew;
  window.buyBadgeNew=async function(id){
    if(!me)return;
    try{
      var d=await sb.from('badges').select('*').eq('id',id).limit(1);
      var bd=d.data&&d.data[0];if(!bd)return;
      var coins=(me.coins)||0;
      var price=(bd.price||0);
      var miss=price-coins;
      var canAfford=(coins>=price);
      var old=el('buyBadgeConfirm');if(old)old.remove();
      var m=document.createElement('div');m.id='buyBadgeConfirm';m.className='modal';
      m.innerHTML='<div class="m-card2" style="width:320px">'
      +'<h3 style="color:#FFD700">🛒 تأكيد الشراء</h3>'
      +'<div style="background:var(--bg);border-radius:12px;padding:14px;text-align:center">'
      +'<img src="'+bd.url+'" style="width:70px;height:70px;object-fit:contain">'
      +'<div style="font-weight:bold;font-size:15px;color:var(--txt);margin-top:6px">'+escapeHtml(bd.name||'شارة')+'</div>'
      +'<div style="font-size:11px;color:var(--mut)">'+escapeHtml(bd.rarity||'')+'</div>'
      +'<div style="font-size:20px;font-weight:900;color:#FFD700;margin-top:8px">🪙 '+price+'</div></div>'
      +'<div style="font-size:12px;color:var(--txt);text-align:center">رصيدك الحالي: <b style="color:#FFD700">🪙 '+coins+'</b></div>'
      +(miss>0
        ?'<div style="background:rgba(230,69,83,.15);border:1px solid var(--red);border-radius:10px;padding:10px;text-align:center;color:var(--red);font-weight:bold;font-size:13px;margin-top:6px">❌ العملات غير كافية — ناقصك '+miss+' عملة<br><span style="font-size:11px">اشحن من "عملاتي" 💜</span></div>'
        :'<div style="font-size:14px;color:var(--txt);text-align:center;font-weight:bold;margin-top:6px">هل أنت راغب في الشراء؟</div>')
      +'<button id="bdOkBtn" '+(canAfford
        ?'style="background:linear-gradient(135deg,#FFD700,#FF9800);color:#111;font-weight:bold" onclick="confirmBuyBadgeNew('+id+','+price+')"'
        :'style="background:var(--card2);color:#8b99a7;cursor:not-allowed;opacity:.55;border:1px solid var(--line)" disabled')
      +'>حسناً</button>'
      +'<button style="background:transparent;color:var(--mut);border:1px solid var(--line)!important" onclick="closeModal(\'buyBadgeConfirm\')">إلغاء</button></div>';
      m.onclick=function(e){if(e.target===m)closeModal('buyBadgeConfirm');};
      document.body.appendChild(m);
      m.classList.add('open');
    }catch(e){toast('خطأ: '+e.message);}
  };

  /* 2) العضو واقف على النافذة وجمع عملات → الزرار يحيا تلقائياً */
  setInterval(function(){
    try{
      var m=el('buyBadgeConfirm');
      if(!m||!m.classList.contains('open'))return;
      var btn=el('bdOkBtn');
      if(!btn||!btn.disabled)return;
      /* نجيب أحدث رصيد من السيرفر */
      SDB.getUser(me.name).then(function(u){
        if(!u)return;
        var cur=(u.coins)||0;
        if(usersCache[me.name])usersCache[me.name].coins=cur;
        /* نقرأ السعر من نص العنوان في النافذة */
        var prcEl=m.querySelector('[style*="#FFD700"][style*="20px"]');
        var price=prcEl?parseInt(prcEl.innerText.replace(/[^0-9]/g,'')):0;
        if(price&&cur>=price){
          /* بقى معاه فلوس! نفعّل الزرار ونلونه */
          btn.disabled=false;
          btn.style.background='linear-gradient(135deg,#FFD700,#FF9800)';
          btn.style.color='#111';
          btn.style.cursor='pointer';
          btn.style.opacity='1';
          btn.style.border='none';
          btn.removeAttribute('disabled');
          btn.onclick=function(){confirmBuyBadgeNew((btn._bid||0),price);};
          btn._bid=window._lastBadgeId||0;
          /* تحديث رسالة الرصيع */
          var err=m.querySelector('[style*="rgba(230,69,83"]');
          if(err)err.outerHTML='<div style="font-size:14px;color:var(--txt);text-align:center;font-weight:bold;margin-top:6px">هل أنت راغب في الشراء؟</div>';
          var bal=m.querySelector('[style*="رصيدك"]');
          if(bal)bal.innerHTML='رصيدك الحالي: <b style="color:#FFD700">🪙 '+cur+'</b>';
          toast('🎉 وصلتك العملات — تقدر تشتري دلوقتي!');
        }
      }).catch(function(){});
    }catch(e){}
  },4000);
})();
/* ===== 🎨 شريط الكتابة + الصور بلون رسايلك ===== */
(function(){
if(window._penBarImg)return;window._penBarImg=true;

function myG(){
  try{
    if(!me||!me.penColor)return null;
    return (window._PENC||[]).find(function(x){return x.n===me.penColor;})||null;
  }catch(e){return null;}
}

/* 1) شريط الكتابة كله بلونك */
window.stylePenBar=function(){
  try{
    var g=myG();
    var inp=el('msgInput');if(!inp)return;
    var send=document.querySelector('#s-chat .ic-btn[onclick="sendMsg()"]');
    /* نطلع من حقل الكتابة لحد الحاوية اللي فيها زرار الإرسال */
    var row=null,cur=inp.parentElement,lv=0;
    while(cur&&lv<6&&cur!==document.body){
      if(cur.id==='s-chat'||(cur.classList&&cur.classList.contains('screen')))break;
      if(!row&&send&&cur.contains(send))row=cur;
      cur=cur.parentElement;lv++;
    }
    if(!row)row=inp.closest('.chat-input')||inp.parentElement;
    if(row){
      if(g){
        row.style.border='3px solid transparent';
        row.style.borderRadius='18px';
        row.style.backgroundImage='linear-gradient(rgba(10,10,25,.92),rgba(10,10,25,.92)),linear-gradient(135deg,'+g.c1+','+g.c2+')';
        row.style.backgroundOrigin='border-box';
        row.style.backgroundClip='padding-box,border-box';
        row.style.boxShadow='0 0 14px '+g.c1+'88,0 0 28px '+g.c2+'44';
      }else{
        row.style.border='';row.style.backgroundImage='';row.style.boxShadow='';row.style.borderRadius='';
      }
    }
    /* زرار الإرسال يبقى بلونك بدل الأزرق */
    if(send){
      if(g){
        send.style.background='linear-gradient(135deg,'+g.c1+','+g.c2+')';
        send.style.boxShadow='0 0 12px '+g.c1+'99';
        send.style.border='none';
      }else{
        send.style.background='';send.style.boxShadow='';send.style.border='';
      }
    }
    /* حقل الكتابة شفاف عشان لون الشريط يبان */
    if(g){inp.style.background='transparent';inp.style.color='#fff';}
    else{inp.style.background='';inp.style.color='';}
  }catch(e){}
};

/* 2) الصور بلونك بدل الأزرق */
window.paintPenImages=function(){
  try{
    var g=myG();if(!g)return;
    var box=el('chatBox');if(!box)return;
    var bubs=box.querySelectorAll('.bub:not(.in):not(.sys)');
    for(var i=0;i<bubs.length;i++){
      var b=bubs[i];
      /* ندور على صورة حقيقية (مش ستيكر ولا صورة مصغرة في الرد) */
      var hasImg=null,imgs=b.querySelectorAll('img');
      for(var k=0;k<imgs.length;k++){
        if(!imgs[k].closest('.reply-bar')&&!imgs[k].classList.contains('stick')){hasImg=imgs[k];break;}
      }
      if(!hasImg)continue;
      b.style.border='3px solid transparent';
      b.style.borderRadius='16px';
      b.style.backgroundImage='linear-gradient(rgba(5,5,15,.85),rgba(5,5,15,.85)),linear-gradient(135deg,'+g.c1+','+g.c2+')';
      b.style.backgroundOrigin='border-box';
      b.style.backgroundClip='padding-box,border-box';
      b.style.boxShadow='0 0 14px '+g.c1+'88,0 0 28px '+g.c2+'44';
      var tk=b.querySelector('.ticks');
      if(tk)tk.style.color=g.c2;
    }
  }catch(e){}
};

/* 3) التشغيل: مع كل رسالة + فتح الشات + إرسال صورة + دوري */
var _apBI=window.appendMsg;
window.appendMsg=function(m){var r=_apBI(m);try{setTimeout(function(){stylePenBar();paintPenImages();},80);}catch(e){}return r;};
var _smBI=window.subMsgs;
window.subMsgs=async function(){var r=await _smBI();try{setTimeout(stylePenBar,300);setTimeout(paintPenImages,500);setTimeout(paintPenImages,1500);}catch(e){}return r;};
var _ouBI=window.openUser;
window.openUser=function(n){var r=_ouBI(n);try{setTimeout(stylePenBar,400);setTimeout(stylePenBar,1200);}catch(e){}return r;};
var _jrBI=window.joinRoom;
window.joinRoom=async function(rid){var r=await _jrBI(rid);try{setTimeout(stylePenBar,400);}catch(e){}return r;};
var _ciBI=window.confirmImage;
window.confirmImage=async function(){var r=await _ciBI();try{setTimeout(paintPenImages,300);setTimeout(paintPenImages,900);}catch(e){}return r;};
setInterval(function(){try{stylePenBar();paintPenImages();}catch(e){}},2500);
})();
/* ===== 🔒 الوسائط: منع الصور وقت الإرسال + إلغاء فقاعات "وسائط مقفلة" نهائياً ===== */
(function(){
if(window._mediaSendBlock2)return;window._mediaSendBlock2=true;

/* 1) هل المستهدف صوره مقفولة؟ (في الخاص فقط) */
function _imgLocked(){
  try{
    if(!me||!chat||chat.type!=='user')return false;
    var tu=usersCache[chat.id];
    if(!tu)return false;
    return !(tu.allowMedia===true||tu.media_opt_in===true);
  }catch(e){return false;}
}

/* 2) منع إرسال الصور: المرسل هو اللي يوصله الإشعار والصورة متتبعتش */
var _siB=window.sendImage;
window.sendImage=function(e){
  try{
    if(_imgLocked()){
      toast('⛔ هذا المستخدم لا يسمح باستقبال الصور');
      if(e&&e.target)e.target.value='';
      return;
    }
  }catch(e){}
  return _siB?_siB(e):undefined;
};

/* 3) تأمين إضافي: لو نافذة الصورة كانت مفتوحة قبل التغيير — الإرسال نفسه ممنوع */
var _ciB=window.confirmImage;
window.confirmImage=async function(){
  try{
    if(_imgLocked()){
      pendingImg=null;
      if(el('imgCaption'))el('imgCaption').value='';
      closeModal('imgModal');
      toast('⛔ هذا المستخدم لا يسمح باستقبال الصور');
      return;
    }
  }catch(e){}
  return _ciB?await _ciB():undefined;
};

/* 4) الصوت: متاح دايماً للجميع — مش متمنع خالص */
/* 5) إلغاء فقاعات "وسائط مقفلة": الصور والصوت بتظهر عادي دايماً */
var _rmcB=window.renderMsgContent;
window.renderMsgContent=function(m){
  try{
    if(me&&m&&m.from!==me.name&&!m.deleted&&(m.type==='image'||m.type==='audio')
       &&!(me.allowMedia===true||me.media_opt_in===true)){
      var oA=me.allowMedia,oO=me.media_opt_in;
      me.allowMedia=true;me.media_opt_in=true;
      var out=_rmcB(m);
      me.allowMedia=oA;me.media_opt_in=oO;
      return out;
    }
  }catch(e){}
  return _rmcB?_rmcB(m):'';
};
})();
/* ===== 🗑️ حذف عضوية بالاسم (حتى لو أوفلاين) — في لوحة الأعضاء ===== */
(function(){
if(window._delUserField)return;window._delUserField=true;

/* 1) إضافة الحقل جنب حقل إضافة العملات */
function ensureField(){
  try{
    var memPanel=el('ap-members');
    if(!memPanel||el('delUserBySearch'))return;
    /* نلاقي صف إضافة العملات ونحط تحته */
    var rows=memPanel.querySelectorAll('.adm-row');
    var coinsRow=null;
    for(var i=0;i<rows.length;i++){
      var t=rows[i].innerText||'';
      if(t.indexOf('إضافة عملات')>-1||rows[i].querySelector('#addCoinsName')){coinsRow=rows[i];break;}
    }
    var row=document.createElement('div');
    row.className='adm-row';row.id='delUserBySearch';
    row.style.marginTop='8px';
    row.innerHTML='<input id="delUserName" placeholder="اسم العضوية المراد حذفها (حتى لو أوفلاين)" style="flex:1"><button class="adm-btn" style="background:#dc2626;color:#fff" onclick="deleteUserByName()">🗑️ حذف</button>';
    if(coinsRow)coinsRow.parentElement.insertBefore(row,coinsRow.nextSibling);
    else{
      var searchRow=memPanel.querySelector('.adm-row');
      if(searchRow)searchRow.parentElement.insertBefore(row,searchRow.nextSibling);
      else memPanel.appendChild(row);
    }
  }catch(e){}
}

/* 2) تنفيذ الحذف الشامل */
window.deleteUserByName=async function(){
  if(!isAdmin())return toast('ممنوع — للإدارة فقط');
  var n=el('delUserName')?el('delUserName').value.trim():'';
  if(!n)return toast('اكتب اسم العضوية');
  if(isOwnerName(n))return toast('⛔ لا يمكن حذف صاحب الموقع');
  var u=await SDB.getUser(n);
  if(!u)return toast('❌ العضوية غير موجودة: '+n);
  if(!confirm('حذف عضوية «'+n+'» نهائياً؟\n\nسيتم حذف:\n• الحساب وكلمة المرور\n• كل محادثاته ورسائله\n• حالاته وقصصه\n• سجل دخوله\n\n⚠️ لا يمكن التراجع!'))return;
  toast('⏳ جاري الحذف...');
  /* حذف كل محادثاته ورسايله */
  try{
    var cs=await sb.from('convs').select('id').or('user_a.eq.'+n+',user_b.eq.'+n);
    for(var i=0;i<(cs.data||[]).length;i++){
      try{await SDB.delConvMsgs(cs.data[i].id);}catch(e){}
      try{await SDB.delConv(cs.data[i].id);}catch(e){}
    }
  }catch(e){}
  /* حالاته */
  try{await sb.from('stories').delete().eq('author',n);}catch(e){}
  /* سجل دخوله */
  try{await sb.from('device_logins').delete().eq('name',n);}catch(e){}
  /* كلمة مروره */
  try{await sb.from('passwords').delete().eq('name',n);}catch(e){}
  /* البلاغات اللي عنده */
  try{await sb.from('reports').delete().eq('target',n);}catch(e){}
  /* الحساب نفسه */
  try{await SDB.delUserRow(n);}catch(e){}
  /* من الكاش المحلي */
  try{delete usersCache[n];}catch(e){}
  try{LS.removeItem('trans_log_'+n);}catch(e){}
  try{logActivity('delete_account','حذف عضوية: '+n);}catch(e){}
  el('delUserName').value='';
  toast('🗑️ تم حذف عضوية «'+n+'» نهائياً');
  try{refreshUsers();}catch(e){}
  try{renderMembers();}catch(e){}
};

/* 3) تشغيل مستمر عشان الحقل ميفقدش مكانه */
setInterval(function(){try{ensureField();}catch(e){}},2500);
var _atD=window.adminTab;
window.adminTab=function(tab,e){
  var r=_atD?_atD(tab,e):undefined;
  try{if(tab==='members')setTimeout(ensureField,200);}catch(e){}
  return r;
};
})();
/* ===== 🛑 إيقاف اهتزاز الرسايل والحركة القسرية نهائياً ===== */
(function(){
if(window._stopShake)return;window._stopShake=true;

/* 1) القضاء على حركة النزول القسرية: نشيل الحاجة اللي بتسحب الشات لتحت كل نص ثانية
   بنقفل سلوك scrollTop المؤقت — الشات ينزل بس عند رسالة جديدة حقيقية أو لما تدوس ⬇️ */

/* أ) نخلي دالة scrollChat تنزل مرة واحدة بس ومتكررش */
var _scO=window.scrollChat;
window.scrollChat=function(){
  try{
    var b=el('chatBox');
    if(!b||userScrolledUp)return;
    b.scrollTop=b.scrollHeight; /* مرة واحدة مباشرة — من غير مؤقتات متكررة */
    return;
  }catch(e){}
  return _scO?_scO():undefined;
};

/* ب) نقفل سهم النزول: دوسة واحدة تظبط المكان — من غير 500ms و 2000ms التكرار */
try{
  var sdb=el('scrollDownBtn');
  if(sdb){
    sdb.onclick=function(){
      try{
        userScrolledUp=false;
        var b=el('chatBox');
        b.scrollTop=b.scrollHeight;
      }catch(e){}
    };
  }
}catch(e){}

/* 2) إيقاف كل حلقات التلوين الدورية اللي بتعمل النبض:
   بنعترض setInterval نفسه — أي محاولة تكرار تلوين أو حركة كل 2-3 ثواني بتفشل بصمت */
var _badIntervals=[
  'paintEverywhere','paintAllTxt2','paintAllV3','paintWhiteTxt','paintPenAll',
  'paintPenImages','stylePenBar'
];
var _origSI=window.setInterval;
window.setInterval=function(fn,delay){
  try{
    /* لو الدالة المكتوب اسمها جوه الكود من الحاجات اللي عايزين نوقفها → نرجع رقم وهمي */
    var src='';
    try{src=String(fn);}catch(e){}
    for(var i=0;i<_badIntervals.length;i++){
      if(src.indexOf(_badIntervals[i])>-1&&delay>=2000&&delay<=5000){
        return 999999+i; /* رقم وهمي — clearInterval هيتجاهله */
      }
    }
  }catch(e){}
  return _origSI.apply(this,arguments);
};

/* 3) قتل المؤقتات اللي اشتغلت قبل الباتش: بنمشي على كل المؤقتات النشطة */
/* (الحلقات القديمة اشتغلت من أول تحميل — بنقفلها بالمراقبة: أي تغيير ستايل متكرر على نفس الفقاعة بنمنعه) */
var _lastStyles={};
var _obs=new MutationObserver(function(muts){
  try{
    for(var i=0;i<muts.length;i++){
      var t=muts[i].target;
      if(!t||!t.style)continue;
      /* لو فقاعة رسالة بتتغير ستايلها أكتر من مرة = ده النبض → بنثبت آخر حالة */
      var id=t.getAttribute&&t.getAttribute('data-id');
      if(id){
        var key=id+'_'+(t.className||'');
        var sig=(t.style.backgroundImage||'')+'|'+(t.style.boxShadow||'')+'|'+(t.style.border||'');
        if(_lastStyles[key]&&_lastStyles[key]!==sig){
          /* اتغيرت من غير رسالة جديدة = نبض → نرجع آخر حالة ثابتة */
          var saved=_lastStyles[key].split('|');
          t.style.backgroundImage=saved[0];
          t.style.boxShadow=saved[1];
          t.style.border=saved[2];
        }else{
          _lastStyles[key]=sig;
        }
      }
    }
  }catch(e){}
});
try{
  var cb=el('chatBox');
  if(cb)_obs.observe(cb,{attributes:true,attributeFilter:['style'],subtree:true,childList:true});
}catch(e){}

/* 4) إيقاف الحارس الذكي (آخر رسالة مثبتة) — ده اللي بيمنعك تطلع فوق */
try{
  /* دالة _down بتنادي كل 600ms — بنعطل تأثيرها عبر تعطيل التصحيح */
  var cb2=el('chatBox');
  if(cb2){
    var _realScroll=null;
    cb2.addEventListener('scroll',function(e){
      /* منع أي تصحيح قسري: لو المستخدم عمل scroll يدوي → مفيش حاجة تحركه */
    },true);
  }
}catch(e){}

/* 5) إيقاف دوال التصحيح القسرية مباشرة (لو كانت معرفة كـ window) */
try{window._down=function(){};}catch(e){}
try{if(typeof _down!=='undefined'){try{_down=function(){};}catch(e){}}}catch(e){}

/* 6) التلوين مرة واحدة فقط: بنعيد تلوين الرسايل مرة واحدة بعد فتح الشات — بدون تكرار */
function paintOnce(){
  try{
    if(!me||!me.penColor)return;
    var c=(window._PENC||[]).find(function(x){return x.n===me.penColor;});
    if(!c)return;
    var box=el('chatBox');if(!box)return;
    var bubs=box.querySelectorAll('.bub:not(.in):not(.sys)');
    for(var i=0;i<bubs.length;i++){
      var b=bubs[i];
      if(b.querySelector('img')||b.querySelector('audio'))continue;
      b.style.border='3px solid transparent';
      b.style.borderRadius='16px';
      b.style.backgroundImage='linear-gradient(rgba(5,5,15,.85),rgba(5,5,15,.85)),linear-gradient(135deg,'+c.c1+','+c.c2+')';
      b.style.backgroundOrigin='border-box';
      b.style.backgroundClip='padding-box,border-box';
      b.style.boxShadow='0 0 14px '+c.c1+'88,0 0 28px '+c.c2+'44';
      var tk=b.querySelector('.ticks');
      if(tk)tk.style.color=c.c2;
    }
  }catch(e){}
}
var _smSP=window.subMsgs;
window.subMsgs=async function(){
  var r=await _smSP();
  try{setTimeout(paintOnce,600);}catch(e){}
  return r;
};
var _apSP=window.appendMsg;
window.appendMsg=function(m){
  var r=_apSP(m);
  try{
    if(m&&m.from===me.name&&me.penColor){
      setTimeout(paintOnce,150); /* مرة واحدة بعد الرسالة الجديدة — خلاص */
    }
  }catch(e){}
  return r;
};

/* 7) رسالة تأكيد */
setTimeout(function(){try{console.log('✅ تثبيت الرسايل: تم');}catch(e){}},1000);
})();
/* ===== 🛑 إيقاف اهتزاز الرسايل والحركة القسرية نهائياً ===== */
(function(){
if(window._stopShake)return;window._stopShake=true;

/* 1) القضاء على حركة النزول القسرية: نشيل الحاجة اللي بتسحب الشات لتحت كل نص ثانية
   بنقفل سلوك scrollTop المؤقت — الشات ينزل بس عند رسالة جديدة حقيقية أو لما تدوس ⬇️ */

/* أ) نخلي دالة scrollChat تنزل مرة واحدة بس ومتكررش */
var _scO=window.scrollChat;
window.scrollChat=function(){
  try{
    var b=el('chatBox');
    if(!b||userScrolledUp)return;
    b.scrollTop=b.scrollHeight; /* مرة واحدة مباشرة — من غير مؤقتات متكررة */
    return;
  }catch(e){}
  return _scO?_scO():undefined;
};

/* ب) نقفل سهم النزول: دوسة واحدة تظبط المكان — من غير 500ms و 2000ms التكرار */
try{
  var sdb=el('scrollDownBtn');
  if(sdb){
    sdb.onclick=function(){
      try{
        userScrolledUp=false;
        var b=el('chatBox');
        b.scrollTop=b.scrollHeight;
      }catch(e){}
    };
  }
}catch(e){}

/* 2) إيقاف كل حلقات التلوين الدورية اللي بتعمل النبض:
   بنعترض setInterval نفسه — أي محاولة تكرار تلوين أو حركة كل 2-3 ثواني بتفشل بصمت */
var _badIntervals=[
  'paintEverywhere','paintAllTxt2','paintAllV3','paintWhiteTxt','paintPenAll',
  'paintPenImages','stylePenBar'
];
var _origSI=window.setInterval;
window.setInterval=function(fn,delay){
  try{
    /* لو الدالة المكتوب اسمها جوه الكود من الحاجات اللي عايزين نوقفها → نرجع رقم وهمي */
    var src='';
    try{src=String(fn);}catch(e){}
    for(var i=0;i<_badIntervals.length;i++){
      if(src.indexOf(_badIntervals[i])>-1&&delay>=2000&&delay<=5000){
        return 999999+i; /* رقم وهمي — clearInterval هيتجاهله */
      }
    }
  }catch(e){}
  return _origSI.apply(this,arguments);
};

/* 3) قتل المؤقتات اللي اشتغلت قبل الباتش: بنمشي على كل المؤقتات النشطة */
/* (الحلقات القديمة اشتغلت من أول تحميل — بنقفلها بالمراقبة: أي تغيير ستايل متكرر على نفس الفقاعة بنمنعه) */
var _lastStyles={};
var _obs=new MutationObserver(function(muts){
  try{
    for(var i=0;i<muts.length;i++){
      var t=muts[i].target;
      if(!t||!t.style)continue;
      /* لو فقاعة رسالة بتتغير ستايلها أكتر من مرة = ده النبض → بنثبت آخر حالة */
      var id=t.getAttribute&&t.getAttribute('data-id');
      if(id){
        var key=id+'_'+(t.className||'');
        var sig=(t.style.backgroundImage||'')+'|'+(t.style.boxShadow||'')+'|'+(t.style.border||'');
        if(_lastStyles[key]&&_lastStyles[key]!==sig){
          /* اتغيرت من غير رسالة جديدة = نبض → نرجع آخر حالة ثابتة */
          var saved=_lastStyles[key].split('|');
          t.style.backgroundImage=saved[0];
          t.style.boxShadow=saved[1];
          t.style.border=saved[2];
        }else{
          _lastStyles[key]=sig;
        }
      }
    }
  }catch(e){}
});
try{
  var cb=el('chatBox');
  if(cb)_obs.observe(cb,{attributes:true,attributeFilter:['style'],subtree:true,childList:true});
}catch(e){}

/* 4) إيقاف الحارس الذكي (آخر رسالة مثبتة) — ده اللي بيمنعك تطلع فوق */
try{
  /* دالة _down بتنادي كل 600ms — بنعطل تأثيرها عبر تعطيل التصحيح */
  var cb2=el('chatBox');
  if(cb2){
    var _realScroll=null;
    cb2.addEventListener('scroll',function(e){
      /* منع أي تصحيح قسري: لو المستخدم عمل scroll يدوي → مفيش حاجة تحركه */
    },true);
  }
}catch(e){}

/* 5) إيقاف دوال التصحيح القسرية مباشرة (لو كانت معرفة كـ window) */
try{window._down=function(){};}catch(e){}
try{if(typeof _down!=='undefined'){try{_down=function(){};}catch(e){}}}catch(e){}

/* 6) التلوين مرة واحدة فقط: بنعيد تلوين الرسايل مرة واحدة بعد فتح الشات — بدون تكرار */
function paintOnce(){
  try{
    if(!me||!me.penColor)return;
    var c=(window._PENC||[]).find(function(x){return x.n===me.penColor;});
    if(!c)return;
    var box=el('chatBox');if(!box)return;
    var bubs=box.querySelectorAll('.bub:not(.in):not(.sys)');
    for(var i=0;i<bubs.length;i++){
      var b=bubs[i];
      if(b.querySelector('img')||b.querySelector('audio'))continue;
      b.style.border='3px solid transparent';
      b.style.borderRadius='16px';
      b.style.backgroundImage='linear-gradient(rgba(5,5,15,.85),rgba(5,5,15,.85)),linear-gradient(135deg,'+c.c1+','+c.c2+')';
      b.style.backgroundOrigin='border-box';
      b.style.backgroundClip='padding-box,border-box';
      b.style.boxShadow='0 0 14px '+c.c1+'88,0 0 28px '+c.c2+'44';
      var tk=b.querySelector('.ticks');
      if(tk)tk.style.color=c.c2;
    }
  }catch(e){}
}
var _smSP=window.subMsgs;
window.subMsgs=async function(){
  var r=await _smSP();
  try{setTimeout(paintOnce,600);}catch(e){}
  return r;
};
var _apSP=window.appendMsg;
window.appendMsg=function(m){
  var r=_apSP(m);
  try{
    if(m&&m.from===me.name&&me.penColor){
      setTimeout(paintOnce,150); /* مرة واحدة بعد الرسالة الجديدة — خلاص */
    }
  }catch(e){}
  return r;
};

/* 7) رسالة تأكيد */
setTimeout(function(){try{console.log('✅ تثبيت الرسايل: تم');}catch(e){}},1000);
})();
