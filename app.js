/* Expedite Request Dashboard: app logic (GitHub Pages + Supabase) */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const CFG=window.EXPEDITE_CONFIG||{};
const DAY=864e5, SHORT=7, isSample=false;
const LISTS={
  reason:["Prefab schedule impact","Ops delay / schedule slip","Conflicting dates (PM vs PX vs Hub)","Design change","Material availability","Late request","Other"],
  source:["PM","PX","Hub","Other"],
  comm:["Teams","Email","Text","Phone call","Weekly meeting","Other"],
  approved:["Pending","Yes","No"],
  expedited:["Yes","No"]
};
let ALL=[], PROJ=[], sb=null, editing=null, sort={key:'requested',dir:-1}, canWrite=true;
const F={project:'',pm:'',reason:'',approved:'',from:'',to:''};
const status=t=>$("#status").textContent=t;

/* ---------- helpers ---------- */
const money=n=>"$"+Math.round(n).toLocaleString();
const iso=d=>d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`:"";
const fromIso=s=>{if(!s||typeof s!=="string")return null;const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?new Date(+m[1],m[2]-1,+m[3]):null};
const fmtD=d=>d?d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}):"—";
const avg=a=>{a=a.filter(x=>x!=null);return a.length?a.reduce((s,x)=>s+x,0)/a.length:null};
function el(tag,attrs,txt){const n=document.createElementNS("http://www.w3.org/2000/svg",tag);for(const k in attrs)n.setAttribute(k,attrs[k]);if(txt!=null)n.textContent=txt;return n}
function group(rows,key,val){const m=new Map();rows.forEach(r=>m.set(r[key],(m.get(r[key])||0)+(val?val(r):1)));return [...m].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value)}
function calc(r){r.pulled=(r.orig&&r.exp)?Math.round((r.orig-r.exp)/DAY):null;r.notice=(r.requested&&r.exp)?Math.round((r.exp-r.requested)/DAY):null;return r}
const str=v=>v==null?"":String(v);
function toRow(d){
  return calc({doc:d.id,id:str(d.request_id),pid:str(d.project_id),project:str(d.project_name)||"(no project)",pm:str(d.pm)||"(no PM)",
    by:str(d.requested_by),of:str(d.requested_of),requested:fromIso(d.date_requested),orig:fromIso(d.original_on_site),exp:fromIso(d.expedited_on_site),
    reason:str(d.reason)||"(not set)",source:str(d.date_source)||"(not set)",comm:str(d.communicated)||"(not set)",approved:str(d.approved)||"(not set)",
    approvedBy:str(d.approved_by),expedited:str(d.expedited),cost:Number(d.cost)||0,notes:str(d.notes)});
}
/* ---------- charts ---------- */
function hbar(id,data,{fmt=v=>v,cls="",onClick,selected}={}){
  const box=$(id); box.innerHTML="";
  if(!data.length||data.every(d=>!d.value)){box.innerHTML=ALL.length?'<div class="empty">No requests match these filters.</div>':'<div class="empty">No requests yet. Load your tracker to see this chart.</div>';return}
  const W=Math.max(300,box.clientWidth), labW=Math.min(230,W*.42), rowH=28, H=data.length*rowH+4;
  const max=Math.max(...data.map(d=>d.value)), plot=W-labW-60;
  const svg=el("svg",{viewBox:`0 0 ${W} ${H}`,role:"img"});
  data.forEach((d,i)=>{
    const g=el("g",{class:"row"+(selected===d.label?" sel":""),transform:`translate(0,${i*rowH})`,tabindex:onClick?0:-1});
    const lab=d.label.length>34?d.label.slice(0,32)+"…":d.label;
    const t=el("text",{x:labW-8,y:18,"text-anchor":"end"},lab); t.append(el("title",{},d.label)); g.append(t);
    g.append(el("rect",{class:"bar "+(typeof cls==="function"?cls(d):cls),x:labW,y:6,height:16,rx:3,width:Math.max(2,plot*d.value/max)}));
    g.append(el("text",{class:"num",x:labW+Math.max(2,plot*d.value/max)+6,y:18},fmt(d.value)));
    if(onClick){g.addEventListener("click",()=>onClick(d.label));g.addEventListener("keydown",e=>{if(e.key==="Enter")onClick(d.label)})}
    svg.append(g);
  });
  box.append(svg);
}
function weekly(id,rows){
  const box=$(id); box.innerHTML="";
  const ds=rows.filter(r=>r.requested);
  if(!ds.length){box.innerHTML=ALL.length?'<div class="empty">No dated requests match these filters.</div>':'<div class="empty">No requests yet. Load your tracker to see this chart.</div>';return}
  const wk=d=>{const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return +x};
  const lo=Math.min(...ds.map(r=>wk(r.requested))), hi=Math.max(...ds.map(r=>wk(r.requested)));
  const weeks=[];for(let t=lo;t<=hi;t+=7*DAY){const k=wk(t);if(!weeks.length||weeks[weeks.length-1].t!==k)weeks.push({t:k,n:0,c:0})}
  ds.forEach(r=>{const w=weeks.find(x=>x.t===wk(r.requested));if(w){w.n++;w.c+=r.cost}});
  const W=Math.max(300,box.clientWidth),H=200,pl=30,pb=26,pt=12,plot=W-pl-8,bw=plot/weeks.length;
  const max=Math.max(1,...weeks.map(w=>w.n)), step=max<=5?1:Math.ceil(max/4);
  const y=v=>pt+(H-pt-pb)*(1-v/max);
  const svg=el("svg",{viewBox:`0 0 ${W} ${H}`,role:"img"});
  for(let v=0;v<=max;v+=step){svg.append(el("line",{class:"grid-l",x1:pl,x2:W-8,y1:y(v),y2:y(v)}));svg.append(el("text",{class:"muted num",x:pl-6,y:y(v)+4,"text-anchor":"end"},v))}
  const tip=document.createElement("div");tip.className="tip";tip.hidden=true;box.append(tip);
  const every=Math.ceil(weeks.length/Math.max(1,Math.floor(plot/70)));
  weeks.forEach((w,i)=>{
    const x=pl+i*bw, r=el("rect",{class:"bar",x:x+bw*.15,width:Math.max(1,bw*.7),y:y(w.n),height:Math.max(0,H-pb-y(w.n)),rx:2});
    r.addEventListener("mouseenter",()=>{tip.hidden=false;tip.textContent=`Week of ${new Date(w.t).toLocaleDateString(undefined,{month:"short",day:"numeric"})}: ${w.n} request${w.n===1?"":"s"} · ${money(w.c)}`;
      const px=(x+bw/2)/W*box.clientWidth;tip.style.left=Math.min(box.clientWidth-90,Math.max(90,px))+"px";tip.style.top=(y(w.n)/H*box.clientWidth*H/W)+"px"});
    r.addEventListener("mouseleave",()=>tip.hidden=true);
    svg.append(r);
    if(i%every===0) svg.append(el("text",{class:"muted",x:x+bw/2,y:H-8,"text-anchor":"middle"},new Date(w.t).toLocaleDateString(undefined,{month:"short",day:"numeric"})));
  });
  box.prepend(svg);
}
function noticeBuckets(rows){
  const b=[["0–3 days",0,3],["4–6 days",4,6],["7–13 days",7,13],["14–20 days",14,20],["21+ days",21,1e9]];
  return b.map(([label,lo,hi])=>({label,value:rows.filter(r=>r.notice!=null&&r.notice>=lo&&r.notice<=hi).length}));
}

/* ---------- KPIs ---------- */
function kpis(rows){
  const n=rows.length, ap=rows.filter(r=>r.approved==="Yes").length, pend=rows.filter(r=>r.approved==="Pending").length;
  const cost=rows.reduce((s,r)=>s+r.cost,0), pulled=avg(rows.map(r=>r.pulled)), notice=avg(rows.map(r=>r.notice));
  const withN=rows.filter(r=>r.notice!=null), short=withN.filter(r=>r.notice<SHORT).length;
  const top=group(rows,"reason")[0];
  const items=[
    ["Requests",n,isSample?"sample rows":ALL.length?"in this view":"none loaded yet"],
    ["Approved",n?Math.round(ap/n*100)+"%":"—",`${ap} approved · ${pend} pending`],
    ["Expedite cost",money(cost),n?`${money(cost/n)} per request`:"",true],
    ["Avg days pulled in",pulled==null?"—":pulled.toFixed(1),"original minus new date"],
    ["Avg days of notice",notice==null?"—":notice.toFixed(1),"request to new on-site"],
    ["Short notice",withN.length?Math.round(short/withN.length*100)+"%":"—",`${short} under ${SHORT} days`,true],
    ["Top reason",top?top.value:"—",top?top.label:"",false],
  ];
  const box=$("#kpis");box.innerHTML="";
  items.forEach(([k,v,s,hot])=>{const d=document.createElement("div");d.className="kpi"+(hot?" hot":"");
    const a=document.createElement("span");a.className="k";a.textContent=k;const b=document.createElement("span");b.className="v";b.textContent=v;
    const c=document.createElement("span");c.className="n";c.textContent=s;d.append(a,b,c);box.append(d)});
}

/* ---------- filters ---------- */
const uniq=k=>[...new Set(ALL.map(r=>r[k]))].sort();
function buildFilters(){
  [["#fProject","project"],["#fPM","pm"],["#fReason","reason"],["#fApproved","approved"]].forEach(([sel,k])=>{
    const s=$(sel); s.innerHTML=""; s.append(new Option("All",""));
    const vals=uniq(k); if(F[k]&&!vals.includes(F[k]))vals.push(F[k]);
    vals.forEach(v=>s.append(new Option(v,v))); s.value=F[k];
  });
  $("#fFrom").value=F.from; $("#fTo").value=F.to;
}
function filtered(){
  const from=fromIso(F.from), to=fromIso(F.to);
  return ALL.filter(r=>(!F.project||r.project===F.project)&&(!F.pm||r.pm===F.pm)&&(!F.reason||r.reason===F.reason)&&(!F.approved||r.approved===F.approved)
    &&(!from||(r.requested&&r.requested>=from))&&(!to||(r.requested&&r.requested<=to)));
}
[["#fProject","project"],["#fPM","pm"],["#fReason","reason"],["#fApproved","approved"],["#fFrom","from"],["#fTo","to"]].forEach(([s,k])=>$(s).addEventListener("change",e=>{F[k]=e.target.value;render()}));
$("#reset").onclick=()=>{Object.keys(F).forEach(k=>F[k]="");buildFilters();render()};
function setF(k,v){F[k]=F[k]===v?"":v;buildFilters();render()}

/* ---------- table ---------- */
const TCOLS=[["id","Request"],["project","Project"],["pm","PM"],["requested","Requested"],["orig","Original on-site"],["exp","Expedited on-site"],["pulled","Days pulled in"],["notice","Days notice"],["reason","Reason"],["source","Date source"],["comm","How"],["approved","Approved?"],["cost","Cost"],["notes","Notes"]];
let pendingDelete=null;
function table(rows){
  const th=$("#log thead"),tb=$("#log tbody");th.innerHTML="";tb.innerHTML="";
  const tr=document.createElement("tr");
  TCOLS.forEach(([k,l])=>{const h=document.createElement("th");h.textContent=l;h.tabIndex=0;if(sort.key===k)h.setAttribute("aria-sort",sort.dir>0?"ascending":"descending");
    const go=()=>{sort=sort.key===k?{key:k,dir:-sort.dir}:{key:k,dir:1};table(filtered())};h.onclick=go;h.onkeydown=e=>{if(e.key==="Enter")go()};tr.append(h)});
  if(canWrite){const h=document.createElement("th");h.textContent="";h.style.cursor="default";tr.append(h)}
  th.append(tr);
  const s=[...rows].sort((a,b)=>{let x=a[sort.key],y=b[sort.key];if(x==null||x==="")return 1;if(y==null||y==="")return -1;
    if(x instanceof Date){x=+x;y=+y}return (x>y?1:x<y?-1:0)*sort.dir});
  if(!s.length){const r=document.createElement("tr"),d=document.createElement("td");d.colSpan=TCOLS.length+1;d.className="empty";
    d.textContent=ALL.length?"No requests match these filters.":(canWrite?"No requests yet. Click + New request to log the first one.":"No requests have been logged yet.");r.append(d);tb.append(r);return}
  s.forEach(r=>{const row=document.createElement("tr");
    TCOLS.forEach(([k])=>{const d=document.createElement("td");let v=r[k];
      if(["requested","orig","exp"].includes(k))v=fmtD(v);
      if(k==="cost"){v=r.cost?money(r.cost):"—";d.className="num"}
      if(k==="pulled"||k==="notice"){d.className="num";v=r[k]==null?"—":r[k];if(k==="notice"&&r.notice!=null&&r.notice<SHORT)d.classList.add("short")}
      if(k==="approved"){const t=document.createElement("span");t.className="tag "+v;t.textContent=v;d.append(t)}else d.textContent=v;
      row.append(d)});
    if(canWrite){const d=document.createElement("td");d.className="act";
      const e=document.createElement("button");e.type="button";e.className="btn ghost sm";e.textContent="Edit";e.onclick=()=>openForm(r);
      const x=document.createElement("button");x.type="button";x.className="btn ghost sm";
      const armed=pendingDelete===r.doc; x.textContent=armed?"Confirm delete":"Delete"; if(armed)x.className="btn danger sm";
      x.onclick=async()=>{
        if(pendingDelete!==r.doc){pendingDelete=r.doc;table(filtered());setTimeout(()=>{if(pendingDelete===r.doc){pendingDelete=null;table(filtered())}},4000);return}
        pendingDelete=null;const {error}=await sb.from("requests").delete().eq("id",r.doc);if(error)status("Couldn't delete that request: "+error.message);else{status(`Deleted ${r.id||"request"}.`);await loadAll()}
      };
      d.append(e,x);row.append(d)}
    tb.append(row)});
}

/* ---------- render ---------- */
function render(){
  const rows=filtered();
  const chips=$("#chips");chips.innerHTML="";
  Object.entries(F).filter(([,v])=>v).forEach(([k,v])=>{const b=document.createElement("button");b.className="chip";b.type="button";b.textContent=`${k}: ${v} ✕`;b.onclick=()=>{F[k]="";buildFilters();render()};chips.append(b)});
  kpis(rows);
  hbar("#cReason",group(rows,"reason"),{onClick:v=>setF("reason",v),selected:F.reason});
  hbar("#cCost",group(rows,"reason",r=>r.cost).filter(d=>d.value>0),{fmt:money,cls:"cost"});
  weekly("#cTime",rows);
  hbar("#cComm",group(rows,"comm"));
  hbar("#cSrc",group(rows,"source"));
  hbar("#cProj",group(rows,"project"),{onClick:v=>setF("project",v),selected:F.project});
  hbar("#cNotice",noticeBuckets(rows),{cls:d=>/^[04]–/.test(d.label)?"cost":""});
  table(rows);
}

/* ---------- form ---------- */
function fillSelect(id,opts,blank){const s=$(id);s.innerHTML="";if(blank)s.append(new Option(blank,""));opts.forEach(o=>s.append(typeof o==="string"?new Option(o,o):o))}
fillSelect("#iReason",LISTS.reason,"Choose a reason");fillSelect("#iSource",LISTS.source,"—");fillSelect("#iComm",LISTS.comm,"—");
fillSelect("#iApproved",LISTS.approved);fillSelect("#iExpedited",LISTS.expedited,"—");
function projectOptions(sel){
  const opts=PROJ.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p=>new Option(`${p.name} (${p.pid})`,p.doc));
  opts.push(new Option("+ Add a new project…","__new"));
  fillSelect("#iProject",opts,"Choose a project");$("#iProject").value=sel||"";syncProject();
}
function syncProject(){
  const v=$("#iProject").value;$("#newProj").hidden=v!=="__new";
  const p=PROJ.find(p=>p.doc===v);$("#iPM").textContent=p?p.pm||"—":(v==="__new"?"from new project":"—");
}
$("#iProject").addEventListener("change",syncProject);
function syncCalc(){const r=calc({requested:fromIso($("#iReq").value),orig:fromIso($("#iOrig").value),exp:fromIso($("#iExp").value)});
  $("#iCalc").textContent=`${r.pulled==null?"—":r.pulled} · ${r.notice==null?"—":r.notice}`}
["#iReq","#iOrig","#iExp"].forEach(s=>$(s).addEventListener("input",syncCalc));
function nextId(){let m=0;ALL.forEach(r=>{const x=String(r.id).match(/(\d+)\s*$/);if(x)m=Math.max(m,+x[1])});return "EXP-"+String(m+1).padStart(3,"0")}
function openForm(r){
  editing=r?r.doc:null;$("#formErr").textContent="";
  $("#formTitle").textContent=r?`Edit ${r.id||"request"}`:"New expedite request";$("#saveBtn").textContent=r?"Save changes":"Save request";
  const proj=r?(PROJ.find(p=>p.pid===r.pid)||{}).doc:"";projectOptions(proj);
  ["#nPid","#nName","#nPM"].forEach(s=>$(s).value="");
  $("#iId").value=r?r.id:nextId();$("#iBy").value=r?r.by:"";$("#iOf").value=r?r.of:"";
  $("#iReq").value=r?iso(r.requested):iso(new Date());$("#iOrig").value=r?iso(r.orig):"";$("#iExp").value=r?iso(r.exp):"";
  const sv=(id,v,list)=>$(id).value=list.includes(v)?v:"";
  sv("#iReason",r&&r.reason,LISTS.reason);sv("#iSource",r&&r.source,LISTS.source);sv("#iComm",r&&r.comm,LISTS.comm);
  $("#iApproved").value=r&&LISTS.approved.includes(r.approved)?r.approved:"Pending";sv("#iExpedited",r&&r.expedited,LISTS.expedited);
  $("#iApprovedBy").value=r?r.approvedBy:"";$("#iCost").value=r&&r.cost?r.cost:"";$("#iNotes").value=r?r.notes:"";
  syncCalc();$("#formCard").hidden=false;$("#formCard").scrollIntoView({behavior:"smooth",block:"start"});$("#iId").focus({preventScroll:true});
}
function closeForm(){$("#formCard").hidden=true;editing=null}
$("#newBtn").onclick=()=>openForm(null);$("#cancelBtn").onclick=closeForm;
$("#reqForm").addEventListener("submit",async e=>{
  e.preventDefault();const err=$("#formErr");err.textContent="";
  const id=$("#iId").value.trim(),pv=$("#iProject").value,req=$("#iReq").value,reason=$("#iReason").value;
  if(!id||!pv||!req||!reason){err.textContent="Fill in Request ID, Project, Date requested and Reason.";return}
  if(ALL.some(r=>r.id===id&&r.doc!==editing)){err.textContent=`Request ID ${id} is already used. Pick another.`;return}
  let p=PROJ.find(x=>x.doc===pv);
  $("#saveBtn").disabled=true;
  try{
    if(pv==="__new"){
      const pid=$("#nPid").value.trim(),name=$("#nName").value.trim(),pm=$("#nPM").value.trim();
      if(!pid||!name||!pm){err.textContent="Fill in the new project's ID, name and PM.";return}
      p=PROJ.find(x=>x.pid.toLowerCase()===pid.toLowerCase());
      if(!p){const {data,error}=await sb.from("projects").insert({project_id:pid,name,pm}).select().single();
        if(error){err.textContent="Couldn't add the project: "+error.message;return}
        p={doc:data.id,pid,name,pm};PROJ.push(p)}
    }
    const body={request_id:id,project_id:p.pid,project_name:p.name,pm:p.pm,requested_by:$("#iBy").value.trim(),requested_of:$("#iOf").value.trim(),
      date_requested:req,original_on_site:$("#iOrig").value||null,expedited_on_site:$("#iExp").value||null,reason,date_source:$("#iSource").value,
      communicated:$("#iComm").value,approved:$("#iApproved").value,approved_by:$("#iApprovedBy").value.trim(),expedited:$("#iExpedited").value||null,
      cost:Number($("#iCost").value)||0,notes:$("#iNotes").value.trim()};
    const {error}=editing?await sb.from("requests").update(body).eq("id",editing):await sb.from("requests").insert(body);
    if(error){err.textContent=/duplicate|unique/i.test(error.message)?`Request ID ${id} is already used. Pick another.`:"Couldn't save: "+error.message;return}
    status(`${editing?"Updated":"Saved"} ${id}.`);closeForm();await loadAll();
  }catch(x){err.textContent="Couldn't save. Check your connection and try again."}
  finally{$("#saveBtn").disabled=false}
});


/* ---------- CSV export ---------- */
$("#exportBtn").onclick=()=>{
  const head=["Request ID","Project ID","Project Name","PM","Requested By (Ops)","Requested Of (Prefab)","Date Requested","Original On-Site Date","Expedited On-Site Date","Days Pulled In","Days of Notice","Reason for Expedite","Date Source Used","How Communicated","Approved?","Approved By","Expedited?","Expedite Cost ($)","Notes"];
  const q=v=>{v=v==null?"":String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
  const lines=[head.join(",")].concat(filtered().map(r=>[r.id,r.pid,r.project,r.pm,r.by,r.of,iso(r.requested),iso(r.orig),iso(r.exp),r.pulled??"",r.notice??"",r.reason,r.source,r.comm,r.approved,r.approvedBy,r.expedited,r.cost||"",r.notes].map(q).join(",")));
  const blob=new Blob(["﻿"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`expedite-requests-${iso(new Date())}.csv`;document.body.append(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
};

/* ---------- data ---------- */
function setPill(t,live){$("#srcPill").textContent=t;$("#srcPill").className="pill"+(live?" live":"")}
async function loadAll(){
  const [r,p]=await Promise.all([sb.from("requests").select("*").order("date_requested",{ascending:false}).limit(5000),sb.from("projects").select("*")]);
  if(r.error){setPill("Not connected",false);status("Couldn't load requests: "+r.error.message);return}
  ALL=(r.data||[]).map(toRow);
  PROJ=(p.data||[]).map(x=>({doc:x.id,pid:str(x.project_id),name:str(x.name),pm:str(x.pm)}));
  setPill(`${ALL.length} request${ALL.length===1?"":"s"} · live`,true);
  if(!ALL.length&&!/^(Saved|Updated|Deleted)/.test($("#status").textContent))status("No requests yet. Click + New request to log the first one.");
  if(!$("#formCard").hidden&&$("#iProject").value!=="__new")projectOptions($("#iProject").value);
  buildFilters();render();
}
let channel=null,reloadT=null;
function subscribe(){
  if(channel)return;
  const kick=()=>{clearTimeout(reloadT);reloadT=setTimeout(loadAll,300)};
  channel=sb.channel("expedite-live")
    .on("postgres_changes",{event:"*",schema:"public",table:"requests"},kick)
    .on("postgres_changes",{event:"*",schema:"public",table:"projects"},kick)
    .subscribe();
}

/* ---------- auth ---------- */
const domainOk=e=>!CFG.ALLOWED_DOMAIN||String(e||"").toLowerCase().endsWith("@"+CFG.ALLOWED_DOMAIN.toLowerCase());
function showAuth(msg){$("#app").hidden=true;$("#authCard").hidden=false;$("#authErr").textContent=msg||"";$("#msBtn").hidden=!CFG.MICROSOFT_SIGN_IN}
async function showApp(session){
  const email=session.user.email||"";
  if(!domainOk(email)){await sb.auth.signOut();showAuth(`Use your @${CFG.ALLOWED_DOMAIN} email address.`);return}
  $("#authCard").hidden=true;$("#app").hidden=false;$("#who").textContent=email;$("#newBtn").disabled=false;
  status("");await loadAll();subscribe();
}
$("#authForm").addEventListener("submit",async e=>{
  e.preventDefault();const email=$("#aEmail").value.trim(),password=$("#aPass").value;
  if(!domainOk(email)){$("#authErr").textContent=`Use your @${CFG.ALLOWED_DOMAIN} email address.`;return}
  $("#signInBtn").disabled=true;
  const {error}=await sb.auth.signInWithPassword({email,password});
  $("#signInBtn").disabled=false;
  if(error)$("#authErr").textContent=/confirm/i.test(error.message)?"Check your email and click the confirmation link first.":"Email or password is incorrect.";
});
$("#signUpBtn").onclick=async()=>{
  const email=$("#aEmail").value.trim(),password=$("#aPass").value;
  if(!domainOk(email)){$("#authErr").textContent=`Use your @${CFG.ALLOWED_DOMAIN} email address.`;return}
  if(password.length<8){$("#authErr").textContent="Choose a password with at least 8 characters.";return}
  const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
  if(error){$("#authErr").textContent="Couldn't create the account: "+error.message;return}
  $("#authErr").textContent=data.session?"":"Account created. Check your email for a confirmation link, then sign in.";
};
$("#msBtn").onclick=()=>sb.auth.signInWithOAuth({provider:"azure",options:{scopes:"email",redirectTo:location.origin+location.pathname}});
$("#signOut").onclick=async()=>{await sb.auth.signOut()};

/* ---------- start ---------- */
let rt;window.addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(()=>{if(!$("#app").hidden)render()},150)});
const configured=CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY&&!/YOUR-/.test(CFG.SUPABASE_URL+CFG.SUPABASE_ANON_KEY);
if(!configured||!window.supabase){$("#setupCard").hidden=false;if(configured)$("#setupCard").querySelector("p").textContent="The database library didn't load. Check your internet connection and reload.";return}
sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);
buildFilters();
sb.auth.onAuthStateChange((ev,session)=>{
  if(session&&(ev==="SIGNED_IN"||ev==="INITIAL_SESSION"))showApp(session);
  else if(!session){if(channel){sb.removeChannel(channel);channel=null}ALL=[];showAuth()}
});
})();
