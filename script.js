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
