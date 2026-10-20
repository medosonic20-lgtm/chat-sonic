/* ⚡ شات سونيك — المترجم (Sonic Client)
   بديل مكتبة supabase-js — نفس الأوامر بالظبط لكن بيكلم سيرفر Cloudflare بتاعك */
(function(){
'use strict';
var _base='',_key='';
var _chs=new Set(),_poll=null,_last=0,_tickN=0;

function hdrs(extra){var h={'apikey':_key,'authorization':'Bearer '+_key};if(extra)for(var k in extra)h[k]=extra[k];return h;}
function val2s(v){if(v===true)return '1';if(v===false)return '0';return String(v);}
function encIn(arr){var out=[];for(var i=0;i<arr.length;i++){var v=arr[i];out.push(typeof v==='number'?String(v):'"'+String(v).replace(/"/g,'\\"')+'"');}return out.join(',');}

function _start(){if(_poll)return;_poll=setInterval(_tick,2500);}
async function _tick(){
  _tickN++;
  if(document.hidden&&_tickN%3!==0)return;
  try{
    var r=await fetch(_base+'/rest/v1/_changes?since='+_last,{headers:hdrs()});
    if(!r.ok)return;
    var j=await r.json();var rows=j.rows||[];
    if(rows.length)_last=rows[rows.length-1].id;else _last=j.max||_last;
    if(!rows.length)return;
    var arr=Array.from(_chs);
    for(var i=0;i<arr.length;i++)try{await arr[i]._dispatch(rows);}catch(e){}
  }catch(e){}
}
function Channel(name){this.name=name;this._ons=[];this.state='closed';}
Channel.prototype.on=function(type,opts,cb){this._ons.push({event:(opts&&opts.event)||'*',table:opts&&opts.table,cb:cb});return this;};
Channel.prototype.subscribe=function(cb){this.state='subscribed';_chs.add(this);_start();if(cb)try{cb('SUBSCRIBED');}catch(e){}return this;};
Channel.prototype.unsubscribe=function(){_chs.delete(this);this.state='closed';return Promise.resolve({error:null});};
Channel.prototype._dispatch=async function(rows){
  for(var i=0;i<rows.length;i++){
    var row=rows[i];
    for(var j=0;j<this._ons.length;j++){
      var o=this._ons[j];
      if(!o.table||o.table!==row.tbl)continue;
      if(o.event!=='*'&&o.event!==row.op)continue;
      if(row.op==='DELETE'){o.cb({schema:'public',table:row.tbl,eventType:'DELETE',type:'DELETE',old:row.pk||{},new:{},commit_timestamp:new Date().toISOString()});continue;}
      var pk=row.pk||{};var keys=Object.keys(pk);if(!keys.length)continue;
      var url=_base+'/rest/v1/'+row.tbl+'?';
      if(keys.length===1)url+=keys[0]+'=in.('+encodeURIComponent('"'+String(pk[keys[0]]).replace(/"/g,'\\"')+'"')+')';
      else{var parts=[];for(var k=0;k<keys.length;k++)parts.push(keys[k]+'=eq.'+encodeURIComponent(String(pk[keys[k]])));url+=parts.join('&');}
      try{
        var r=await fetch(url,{headers:hdrs()});
        if(!r.ok)continue;
        var jr=await r.json();
        for(var m=0;m<(jr||[]).length;m++)o.cb({schema:'public',table:row.tbl,eventType:row.op,type:row.op,old:{},new:jr[m],commit_timestamp:new Date().toISOString()});
      }catch(e){}
    }
  }
};

function Bucket(bucket){this._b=bucket;}
Bucket.prototype.upload=async function(path,FileObj,opts){
  try{
    var h=hdrs({'content-type':(FileObj&&FileObj.type)||'application/octet-stream','x-upsert':(opts&&opts.upsert)?'true':'false'});
    if(opts&&opts.cacheControl)h['cachecontrol']=opts.cacheControl;
    var r=await fetch(_base+'/storage/v1/object/'+this._b+'/'+path.split('/').map(encodeURIComponent).join('/'),{method:'POST',headers:h,body:FileObj});
    if(!r.ok){var j=await r.json().catch(function(){return{message:'upload failed'};});return{data:null,error:j};}
    return{data:{path:path,id:'',fullPath:this._b+'/'+path},error:null};
  }catch(e){return{data:null,error:{message:String(e&&e.message||e)}};}
};
Bucket.prototype.getPublicUrl=function(path){return{data:{publicUrl:_base+'/storage/v1/object/public/'+this._b+'/'+path}};};
Bucket.prototype.remove=async function(paths){
  try{
    var r=await fetch(_base+'/storage/v1/object/'+this._b,{method:'DELETE',headers:hdrs({'content-type':'application/json'}),body:JSON.stringify({prefixes:paths})});
    if(!r.ok)return{data:null,error:{message:'remove failed'}};
    return{data:{message:'Deleted'},error:null};
  }catch(e){return{data:null,error:{message:String(e&&e.message||e)}};}
};
Bucket.prototype.download=async function(path){try{var r=await fetch(_base+'/storage/v1/object/public/'+this._b+'/'+path);return{data:await r.blob(),error:null};}catch(e){return{data:null,error:{message:String(e)}};}};
Bucket.prototype.list=function(){return Promise.resolve({data:[],error:null});};
Bucket.prototype.createSignedUrl=function(path){return Promise.resolve({data:{signedUrl:_base+'/storage/v1/object/public/'+this._b+'/'+path},error:null});};

function Q(table){this._t=table;this._m='GET';this._sel=null;this._f=[];this._or=null;this._ord=null;this._lim=null;this._off=null;this._vals=null;this._up=false;this._want=false;this._single=false;this._maybe=false;this._count=null;this._head=false;}
Q.prototype.select=function(cols,opts){this._sel=cols||'*';if(opts){if(opts.count)this._count=opts.count;if(opts.head)this._head=true;}return this;};
Q.prototype.eq=function(c,v){this._f.push([c,'eq',val2s(v)]);return this;};
Q.prototype.neq=function(c,v){this._f.push([c,'neq',val2s(v)]);return this;};
Q.prototype.gt=function(c,v){this._f.push([c,'gt',val2s(v)]);return this;};
Q.prototype.gte=function(c,v){this._f.push([c,'gte',val2s(v)]);return this;};
Q.prototype.lt=function(c,v){this._f.push([c,'lt',val2s(v)]);return this;};
Q.prototype.lte=function(c,v){this._f.push([c,'lte',val2s(v)]);return this;};
Q.prototype.like=function(c,v){this._f.push([c,'like',val2s(v)]);return this;};
Q.prototype.ilike=function(c,v){this._f.push([c,'ilike',val2s(v)]);return this;};
Q.prototype.is=function(c,v){this._f.push([c,'is',(v===null||v==='null')?'null':val2s(v)]);return this;};
Q.prototype.in=function(c,arr){this._f.push([c,'in',encIn(arr||[])]);return this;};
Q.prototype.or=function(s){this._or=s;return this;};
Q.prototype.contains=function(c,v){if(Array.isArray(v))return this.in(c,v);return this.eq(c,v);};
Q.prototype.order=function(col,opts){this._ord=col+'.'+((opts&&opts.ascending===false)?'desc':'asc')+((opts&&opts.nullsFirst)?'.nullsfirst':'');return this;};
Q.prototype.limit=function(n){this._lim=n;return this;};
Q.prototype.range=function(a,b){this._off=a;if(b!=null)this._lim=b-a+1;return this;};
Q.prototype.single=function(){this._single=true;return this;};
Q.prototype.maybeSingle=function(){this._maybe=true;return this;};
Q.prototype.insert=function(v){this._m='POST';this._vals=v;this._want=false;return this;};
Q.prototype.upsert=function(v){this._m='POST';this._vals=v;this._up=true;this._want=false;return this;};
Q.prototype.update=function(v){this._m='PATCH';this._vals=v;this._want=false;return this;};
Q.prototype.delete=function(){this._m='DELETE';this._want=false;return this;};
Q.prototype.then=function(res,rej){return this._exec().then(res,rej);};
Q.prototype.catch=function(rej){return this._exec().catch(rej);};
Q.prototype.finally=function(f){return this._exec().finally(f);};
Q.prototype._exec=async function(){
  try{
    var m=this._m,prefer=[];
    var q={};
    if(this._sel&&this._sel!=='*')q.select=this._sel;
    if(this._count)prefer.push('count=exact');
    if(m==='GET'&&this._head)q.limit='0';
    for(var i=0;i<this._f.length;i++){var f=this._f[i];q[f[0]]=f[1]+'.'+f[2];}
    if(this._or)q['or']=this._or;
    if(this._ord)q.order=this._ord;
    if(this._lim!=null&&!(m==='GET'&&this._head))q.limit=String(this._lim);
    if(this._off!=null)q.offset=String(this._off);
    if(m==='POST'&&this._up)prefer.push('resolution=merge-duplicates');
    prefer.push((m!=='GET'&&this._sel&&this._sel!=='*')?'return=representation':'return=minimal');
    var url=_base+'/rest/v1/'+this._t+'?'+new URLSearchParams(q).toString();
    var opt={method:m,headers:hdrs({'content-type':'application/json',prefer:prefer.filter(Boolean).join(',')})};
    if(m==='POST'||m==='PATCH')opt.body=JSON.stringify(this._vals);
    var r=await fetch(url,opt);
    if(!r.ok){var je=await r.json().catch(function(){return{};});return{data:null,error:{message:je.message||('HTTP '+r.status),details:null,hint:null,code:je.code||''}};}
    var cnt=+(r.headers.get('x-total-count')||0);
    var rows=null;
    if(m==='GET')rows=await r.json();
    else if(this._sel&&this._sel!=='*')rows=await r.json();
    if(this._count)return{data:this._head?null:rows,count:cnt,error:null};
    if(this._single){if(!rows||!rows.length)return{data:null,error:{message:'JSON object requested, multiple (or no) rows returned',code:'PGRST116',details:null,hint:null}};return{data:rows[0],error:null};}
    if(this._maybe)return{data:(rows&&rows[0])||null,error:null};
    return{data:rows,error:null};
  }catch(e){return{data:null,error:{message:String(e&&e.message||e),details:null,hint:null,code:''}};}
};

function Sonic(url){_base=String(url).replace(/\/+$/,'');this.rest=_base;this.storageUrl=_base+'/storage/v1';this._chs=[];}
Sonic.prototype.from=function(t){return new Q(t);};
Sonic.prototype.channel=function(name){var c=new Channel(name);this._chs.push(c);return c;};
Sonic.prototype.getChannels=function(){return this._chs.slice();};
Sonic.prototype.removeChannel=function(ch){try{ch.unsubscribe();}catch(e){}var i=this._chs.indexOf(ch);if(i>-1)this._chs.splice(i,1);return 'closed';};
Sonic.prototype.removeAllChannels=function(){var arr=this._chs.slice();for(var i=0;i<arr.length;i++)this.removeChannel(arr[i]);return Promise.resolve('closed');};
Sonic.prototype.storage={from:function(b){return new Bucket(b);}};
Sonic.prototype.auth={getSession:function(){return Promise.resolve({data:{session:null},error:null});},getUser:function(){return Promise.resolve({data:{user:null},error:null});},onAuthStateChange:function(){return Promise.resolve({data:{subscription:{unsubscribe:function(){}}}});},signOut:function(){return Promise.resolve({error:null});}};

window.supabase={createClient:function(url,key){_key=key||'sonic';return new Sonic(url);}};
})();
