const { createClient } = window.supabase;

const URL="https://ynwxoperwcnfaovrqkft.supabase.co";
const KEY="sb_publishable_HaL3A1nOF-1kVlEBgOGuLw_HNLDXzWj";
const supabase=createClient(URL,KEY);

const state={user:null,profile:null,mode:"login",page:"home",feed:"for_you",lookId:null,body:"standard",category:"model",cats:[],options:[],countries:[],interests:[],selected:new Set(),referenceId:null};

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const escapeAttr=esc;
const fmt=n=>{n=Number(n||0);return n>=1e6?(n/1e6).toFixed(1)+"M":n>=1e3?(n/1e3).toFixed(1)+"K":String(n)};

function bind(){
  $$('[data-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;$$('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));$('#username').classList.toggle('hidden',state.mode!=="signup")});
  $('#authForm').onsubmit=auth;
  $('#logout').onclick=()=>supabase.auth.signOut();
  $$('[data-page]').forEach(b=>b.onclick=()=>go(b.dataset.page));
  $$('[data-feed]').forEach(b=>b.onclick=async()=>{state.feed=b.dataset.feed;$$('[data-feed]').forEach(x=>x.classList.toggle('active',x===b));await loadFeed()});
  $$('[data-discovery]').forEach(b=>b.onclick=async()=>{$$('[data-discovery]').forEach(x=>x.classList.toggle('active',x===b));await discovery(b.dataset.discovery)});
  $('#saveDraft').onclick=saveDraft;
  $('#uploadReferenceBtn').onclick=uploadReference;
  $('#applyReferenceBtn').onclick=applyReference;
  $('#renderLook').onclick=renderLook;
  $('#publishLook').onclick=openPublish;
  $('#closeDialog').onclick=()=>$('#publishDialog').close();
  $('#confirmPublish').onclick=publishLook;
  $('#markRead').onclick=async()=>{await supabase.rpc('mark_all_notifications_read');await activity()};
  $('#activityBtn').onclick=()=>document.querySelector('.right')?.scrollIntoView({behavior:'smooth'});
}

async function auth(e){
  e.preventDefault();$('#authMsg').textContent='WORKING...';
  const email=$('#email').value.trim(),password=$('#password').value,username=$('#username').value.trim();
  if(state.mode==='signup'){
    const {data,error}=await supabase.auth.signUp({email,password,options:{data:{username}}});
    if(error){$('#authMsg').textContent=error.message;return}
    if(data.session?.user){await enter(data.session.user);return}
    $('#authMsg').textContent='ACCOUNT CREATED. CHECK EMAIL IF CONFIRMATION IS REQUIRED.';
  }else{
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error)$('#authMsg').textContent=error.message;else if(data.user)await enter(data.user);
  }
}

async function enter(user){
  state.user=user;$('#login').classList.add('hidden');$('#app').classList.remove('hidden');
  const {data}=await supabase.from('profiles').select('id,username,display_name,reputation_tier,country_id').eq('id',user.id).maybeSingle();state.profile=data;
  await Promise.allSettled([loadFeed(),miniCharts(),activity(),loadCatalog(),loadCountries(),loadInterests()]);
}
function leave(){state.user=null;$('#app').classList.add('hidden');$('#login').classList.remove('hidden')}

function go(p){
  state.page=p;['home','explore','create','charts','companies','profile'].forEach(x=>$('#'+x+'Page').classList.toggle('hidden',x!==p));
  $$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===p));$('#pageTitle').textContent=p.toUpperCase();
  if(p==='explore')discovery('trending');if(p==='create')studio();if(p==='charts')charts();if(p==='companies')companies();if(p==='profile')profile();
}

async function loadFeed(){
  const rpc=state.feed==='following'?'get_following_feed':'get_for_you_feed';
  const {data,error}=await supabase.rpc(rpc,{p_limit:30,p_offset:0});
  if(error){$('#feed').innerHTML='<div class="msg">'+esc(error.message)+'</div>';return}
  const rows=data||[];
  const ids=[...new Set(rows.map(x=>x.look_id).filter(Boolean))];
  let previews={};
  if(ids.length){const r=await supabase.from('looks').select('id,preview_svg,ai_preview_url,preview_url').in('id',ids);(r.data||[]).forEach(x=>previews[x.id]=x.ai_preview_url?`<img src="${escapeAttr(x.ai_preview_url)}" alt="ARToF look">`:(x.preview_url?`<img src="${escapeAttr(x.preview_url)}" alt="ARToF look">`:x.preview_svg))}
  $('#feed').innerHTML=rows.length?rows.map(p=>post(p,previews[p.look_id])).join(''):'<div class="post"><div class="postHead"><strong>YOUR FEED IS READY</strong></div><div class="postPreview"><div class="placeholder">CREATE YOUR FIRST LOOK OR FOLLOW CREATORS</div></div></div>';
  $$('.like').forEach(b=>b.onclick=()=>like(b.dataset.id));$$('.save').forEach(b=>b.onclick=()=>save(b.dataset.id));$$('.hidePost').forEach(b=>b.onclick=()=>hidePost(b.dataset.id));
}
function post(p,svg){const name=p.author_username?'@'+p.author_username:(p.company_name||'ARTOF');return '<article class="post"><div class="postHead"><div class="creator"><div class="ava"></div><div><strong>'+esc(name)+'</strong><small>'+esc(p.author_reputation_tier||'')+'</small></div></div><button class="hidePost" data-id="'+p.post_id+'">•••</button></div><div class="postPreview">'+(svg||'<div class="placeholder">ARTOF LOOK</div>')+'</div><div class="postActions"><button class="like" data-id="'+p.post_id+'">♡ '+fmt(p.like_count)+'</button><button>◯ '+fmt(p.comment_count)+'</button><button class="save" data-id="'+p.post_id+'">⌑ '+fmt(p.save_count)+'</button></div></article>'}
async function like(id){const q=await supabase.from('post_likes').select('post_id').eq('post_id',id).eq('user_id',state.user.id).maybeSingle();if(q.data)await supabase.from('post_likes').delete().eq('post_id',id).eq('user_id',state.user.id);else await supabase.from('post_likes').insert({post_id:id,user_id:state.user.id});await loadFeed()}
async function save(id){const q=await supabase.from('post_saves').select('post_id').eq('post_id',id).eq('user_id',state.user.id).maybeSingle();if(q.data)await supabase.from('post_saves').delete().eq('post_id',id).eq('user_id',state.user.id);else await supabase.from('post_saves').insert({post_id:id,user_id:state.user.id});await loadFeed()}
async function hidePost(id){await supabase.rpc('set_post_not_interested',{p_post_id:id,p_hidden:true});await loadFeed()}

async function discovery(mode){const {data,error}=await supabase.rpc('get_discovery_creators',{p_mode:mode,p_country_id:null,p_limit:30});$('#creatorGrid').innerHTML=error?'<div class="msg">'+esc(error.message)+'</div>':(data||[]).map(c=>'<div class="card"><div class="ava"></div><h3>@'+esc(c.username)+'</h3><p>'+esc(c.reputation_tier)+' · '+c.published_posts+' LOOKS · '+fmt(c.recent_likes)+' RECENT LIKES</p></div>').join('')||'<div class="msg">NO CREATORS YET.</div>'}

async function loadCatalog(){
  const c=await supabase.from('studio_categories').select('id,slug,label,display_order').eq('active',true).order('display_order');state.cats=c.data||[];
  const o=await supabase.from('studio_options').select('id,category_id,slug,label,display_order').eq('active',true).order('display_order');state.options=o.data||[];
}
async function studio(){
  if(!state.cats.length) await loadCatalog();
  $('#studioCats').innerHTML=state.cats.map(c=>'<button data-cat="'+c.slug+'" class="'+(c.slug===state.category?'active':'')+'">'+esc(c.label)+'</button>').join('');
  $$('#studioCats button').forEach(b=>b.onclick=()=>{state.category=b.dataset.cat;studio()});
  const bp=await supabase.from('body_presets').select('slug,label').eq('active',true).order('display_order');
  $('#bodyPresets').innerHTML=(bp.data||[]).map(x=>'<button data-body="'+x.slug+'" class="'+(x.slug===state.body?'active':'')+'">'+esc(x.label)+'</button>').join('');
  $$('[data-body]').forEach(b=>b.onclick=async()=>{state.body=b.dataset.body;$$('[data-body]').forEach(x=>x.classList.toggle('active',x===b));if(state.lookId){await supabase.rpc('set_look_body_preset',{p_look_id:state.lookId,p_body_preset:state.body,p_body_scale_json:{}});await renderLook()}});
  const cat=state.cats.find(c=>c.slug===state.category);$('#optionsTitle').textContent=(cat?.label||'OPTIONS')+' OPTIONS';
  const opts=state.options.filter(o=>o.category_id===cat?.id);
  $('#studioOptions').innerHTML=opts.map(o=>'<button data-opt="'+o.slug+'">'+esc(o.label)+'</button>').join('')||'<div class="msg">USE A VISUAL REFERENCE FOR THIS CATEGORY.</div>';
  $$('#studioOptions button').forEach(b=>b.onclick=()=>chooseOption(b.dataset.opt));
}
async function saveDraft(){
  const title=$('#lookTitle').value.trim()||'UNTITLED LOOK';$('#studioMsg').textContent='SAVING...';
  if(!state.lookId){const {data,error}=await supabase.from('looks').insert({owner_user_id:state.user.id,title,body_preset:state.body,model_gender:'custom',state:'draft'}).select('id').single();if(error){$('#studioMsg').textContent=error.message;return}state.lookId=data.id}else{const {error}=await supabase.from('looks').update({title}).eq('id',state.lookId);if(error){$('#studioMsg').textContent=error.message;return}}
  $('#renderLook').disabled=false;$('#publishLook').disabled=false;$('#studioMsg').textContent='DRAFT SAVED.';await renderLook()
}
async function chooseOption(slug){
  if(!state.lookId){await saveDraft();if(!state.lookId)return}
  const slot=state.category==='accessories'||state.category==='makeup'?slug:'default';
  const {error}=await supabase.rpc('set_look_studio_option',{p_look_id:state.lookId,p_category_slug:state.category,p_option_slug:slug,p_reference_asset_id:null,p_custom_value_json:{},p_slot_key:slot});
  if(error){$('#studioMsg').textContent=error.message;return}
  await renderLook();
}
async function renderLook(){
  if(!state.lookId)return;$('#studioMsg').textContent='RENDERING...';
  const {data,error}=await supabase.functions.invoke('render-look',{body:{look_id:state.lookId}});
  if(error){$('#studioMsg').textContent=error.message;return}
  $('#renderPreview').innerHTML=data.svg;$('#studioMsg').textContent='ARTOF VECTOR RENDER READY.';
}

async function uploadReference(){
  const file=$('#referenceFile').files?.[0];
  const status=$('#referenceStatus');
  if(!file){status.textContent='SELECT A JPEG, PNG OR WEBP.';return}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){status.textContent='UNSUPPORTED IMAGE TYPE.';return}
  if(file.size>20*1024*1024){status.textContent='REFERENCE MUST BE 20MB OR SMALLER.';return}
  if(!state.lookId){await saveDraft();if(!state.lookId)return}
  status.textContent='UPLOADING REFERENCE...';
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
  const path=`users/${state.user.id}/${crypto.randomUUID()}.${ext}`;
  const up=await supabase.storage.from('references').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
  if(up.error){status.textContent=up.error.message;return}
  const category=$('#referenceCategory').value;
  const reg=await supabase.rpc('register_reference_asset',{p_storage_path:path,p_mime_type:file.type,p_size_bytes:file.size,p_reference_type:'visual_upload',p_target_category:category,p_look_id:state.lookId});
  if(reg.error){status.textContent=reg.error.message;return}
  state.referenceId=reg.data;
  status.textContent='VALIDATING REFERENCE...';
  const proc=await supabase.functions.invoke('process-reference',{body:{reference_asset_id:state.referenceId}});
  if(proc.error){status.textContent=proc.error.message;return}
  const att=await supabase.rpc('attach_reference_to_look',{p_look_id:state.lookId,p_reference_asset_id:state.referenceId,p_slot_key:'default'});
  if(att.error){status.textContent=att.error.message;return}
  status.textContent='REFERENCE READY · '+category;
  $('#applyReferenceBtn').disabled=false;
}

async function applyReference(){
  const status=$('#referenceStatus');
  if(!state.lookId||!state.referenceId){status.textContent='UPLOAD A REFERENCE FIRST.';return}
  $('#applyReferenceBtn').disabled=true;status.textContent='RECREATING REFERENCE IN ARTOF STYLE...';
  const res=await supabase.functions.invoke('generate-reference-look',{body:{look_id:state.lookId,reference_asset_id:state.referenceId}});
  if(res.error){status.textContent=res.error.message;$('#applyReferenceBtn').disabled=false;return}
  if(!res.data?.preview_url){status.textContent='VISUAL GENERATION PROVIDER IS NOT CONFIGURED OR RETURNED NO PREVIEW.';$('#applyReferenceBtn').disabled=false;return}
  $('#renderPreview').innerHTML='<div class="ai-raster-preview"><img src="'+escapeAttr(res.data.preview_url)+'" alt="Generated ARToF look"></div>';
  status.textContent='REFERENCE APPLIED · ARTOF PREVIEW READY';$('#applyReferenceBtn').disabled=false;
}

async function openPublish(){
  $('#country').innerHTML=state.countries.map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('');
  $('#interestTags').innerHTML=state.interests.map(i=>'<button type="button" data-interest="'+i.id+'">'+esc(i.name)+'</button>').join('');
  $$('#interestTags button').forEach(b=>b.onclick=()=>{const id=Number(b.dataset.interest);b.classList.toggle('active');b.classList.contains('active')?state.selected.add(id):state.selected.delete(id)});
  $('#publishDialog').showModal();
}
async function publishLook(){
  if(!state.lookId)return;const {data:postId,error}=await supabase.rpc('publish_look',{p_look_id:state.lookId,p_caption:$('#caption').value.trim(),p_country_id:Number($('#country').value),p_visibility:'public'});if(error){alert(error.message);return}
  const ids=[...state.selected].slice(0,8);if(ids.length){await supabase.from('post_interests').insert(ids.map(interest_id=>({post_id:postId,interest_id})))}
  $('#publishDialog').close();state.lookId=null;state.referenceId=null;state.selected.clear();$('#renderLook').disabled=true;$('#publishLook').disabled=true;$('#applyReferenceBtn').disabled=true;$('#lookTitle').value='';$('#renderPreview').innerHTML='<div class="placeholder">SAVE A DRAFT TO GENERATE THE FIRST ARTOF RENDER</div>';go('home');await loadFeed()
}
async function loadCountries(){const {data}=await supabase.from('countries').select('id,name').eq('enabled',true).order('name');state.countries=data||[]}
async function loadInterests(){const {data}=await supabase.from('interests').select('id,name').eq('active',true).order('name');state.interests=data||[]}

async function charts(){const {data,error}=await supabase.from('weekly_creator_stats').select('global_rank,valid_likes,week_start,profiles!inner(username,reputation_tier)').eq('state','published').order('week_start',{ascending:false}).order('global_rank').limit(50);$('#charts').innerHTML=error?'<div class="msg">'+esc(error.message)+'</div>':(data||[]).map(r=>'<div class="chartRow"><span class="rank">'+String(r.global_rank||'-').padStart(2,'0')+'</span><div><strong>@'+esc(r.profiles.username)+'</strong><small>'+esc(r.profiles.reputation_tier)+'</small></div><strong>'+fmt(r.valid_likes)+' LIKES</strong></div>').join('')||'<div class="msg">CHARTS WILL POPULATE WITH WEEKLY ACTIVITY.</div>'}
async function miniCharts(){const {data}=await supabase.from('weekly_creator_stats').select('global_rank,valid_likes,profiles!inner(username)').eq('state','published').order('week_start',{ascending:false}).order('global_rank').limit(5);$('#miniCharts').innerHTML=(data||[]).map(r=>'<div class="mini"><span>'+r.global_rank+'</span><b>@'+esc(r.profiles.username)+'</b><span>'+fmt(r.valid_likes)+'</span></div>').join('')||'<div class="msg">NO CHART DATA YET.</div>'}
async function companies(){const {data,error}=await supabase.from('companies').select('name,username,company_type').eq('state','active').order('created_at',{ascending:false}).limit(30);$('#companies').innerHTML=error?'<div class="msg">'+esc(error.message)+'</div>':(data||[]).map(c=>'<div class="card"><h3>'+esc(c.name)+'</h3><p>@'+esc(c.username)+' · '+esc(c.company_type||'COMPANY')+'</p></div>').join('')||'<div class="msg">NO COMPANIES YET.</div>'}
async function activity(){const {data}=await supabase.from('activity_feed').select('notification_type,actor_username,actor_company_name,read_at').order('created_at',{ascending:false}).limit(10);$('#activity').innerHTML=(data||[]).map(n=>'<div class="activity '+(n.read_at?'':'unread')+'">'+esc(n.actor_username?'@'+n.actor_username:(n.actor_company_name||'ARTOF'))+' · '+esc((n.notification_type||'ACTIVITY').replaceAll('_',' '))+'</div>').join('')||'<div class="msg">NO ACTIVITY YET.</div>'}
async function profile(){$('#profileHeader').innerHTML='<h1>'+esc(state.profile?.display_name||'CREATOR')+'</h1><p>@'+esc(state.profile?.username||'')+' · '+esc(state.profile?.reputation_tier||'NEW CREATOR')+'</p>';const {data}=await supabase.from('looks').select('title,state,body_preset,render_state,preview_svg,ai_preview_url,preview_url').eq('owner_user_id',state.user.id).order('created_at',{ascending:false}).limit(20);$('#myLooks').innerHTML=(data||[]).map(l=>'<div class="card">'+(l.ai_preview_url?'<div style="height:180px;overflow:hidden"><img src="'+escapeAttr(l.ai_preview_url)+'" style="width:100%;height:100%;object-fit:contain"></div>':(l.preview_svg?'<div style="height:180px;overflow:hidden">'+l.preview_svg+'</div>':''))+'<h3>'+esc(l.title||'UNTITLED LOOK')+'</h3><p>'+esc(l.state)+' · '+esc(l.body_preset)+' · '+esc(l.render_state)+'</p></div>').join('')||'<div class="msg">CREATE YOUR FIRST LOOK.</div>'}

bind();
const {data:{session}}=await supabase.auth.getSession();if(session?.user)await enter(session.user);
supabase.auth.onAuthStateChange(async(_e,s)=>{if(s?.user&&!state.user)await enter(s.user);if(!s?.user&&state.user)leave()});
