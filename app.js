
const KEY='finusPro21',PREV='finusPro21Prev',STAFF='2026',ADMIN='jun0725';
const colors={milk:'#eadfd2',cream:'#f4ece4',gold:'#d9bd8b',mocha:'#9b806f',blush:'#d9c3b9',sage:'#c8c9b7',stone:'#c8c0b8',ivory:'#fffaf3'};
const defaults={
 enabled:true,start:'2026-09-15',end:'2026-10-31',expiry:'2026-12-10',
 texts:{hero:'週年驚喜抽',sub:'ANNIVERSARY LUCKY DRAW',staff:'店員解鎖',draw:'祝你好運',spin:'開始抽獎',note:'單次消費滿 $2,000，可獲得一次抽獎機會',result:'恭喜獲得',special:'今日幸運獎！',badge:'會員電子優惠券',footer:'每份驚喜，都是 FINUS 的心意。'},
 effects:{countdown:true,tick:true,sound:true,confetti:true,gold:true,vibration:false,logo:true,bg:true,quote:false,test:false},
 prizes:[
  {id:'50',name:'$50',displayCount:6,prob:95,eligible:true,color:'milk',special:false,dailyMax:0,totalMax:0,guaranteeAfter:0},
  {id:'100',name:'$100',displayCount:3,prob:5,eligible:true,color:'gold',special:true,dailyMax:0,totalMax:0,guaranteeAfter:0},
  {id:'500',name:'$500',displayCount:1,prob:0,eligible:false,color:'mocha',special:true,dailyMax:0,totalMax:0,guaranteeAfter:0}
 ],
 quotes:['今天運氣不錯，記得保持帥氣。','換了新髮型，也帶走一點好運。','新的髮型，新的好運。'],
 records:[]
};
const $=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x));
function load(){try{let s=JSON.parse(localStorage.getItem(KEY)||'{}');return {...clone(defaults),...s,texts:{...defaults.texts,...(s.texts||{})},effects:{...defaults.effects,...(s.effects||{})},prizes:s.prizes?.length?s.prizes:clone(defaults.prizes),records:s.records||[]}}catch{return clone(defaults)}}
let d=load(),rot=0,spinning=false,timer,adminTimer,taps=0,tapTimer;
const screens={staff:$('staff'),draw:$('draw'),result:$('result'),admin:$('admin')};
function save(backup=true){if(backup)localStorage.setItem(PREV,localStorage.getItem(KEY)||JSON.stringify(defaults));localStorage.setItem(KEY,JSON.stringify(d))}
function show(n){Object.values(screens).forEach(x=>{x.classList.remove('active','entering')});screens[n].classList.add('active','entering');scrollTo({top:0,behavior:'smooth'})}
function dateText(x){let a=x.split('-');return a[1]+'.'+a[2]}
function apply(){heroTitle.textContent=d.texts.hero;heroSub.textContent=d.texts.sub;staffTitle.textContent=d.texts.staff;drawTitle.textContent=d.texts.draw;spin.textContent=d.texts.spin;drawNote.textContent=d.texts.note;resultBadge.textContent=d.texts.badge;footer.textContent=d.texts.footer;dates.textContent=dateText(d.start)+' — '+dateText(d.end);expiryText.textContent=d.expiry.replaceAll('-','/');document.body.classList.toggle('no-bg',!d.effects.bg);brand.classList.remove('animate');if(d.effects.logo)requestAnimationFrame(()=>brand.classList.add('animate'));drawWheel()}
function visibleSegments(){let out=[];d.prizes.forEach(p=>{for(let i=0;i<Math.max(0,+p.displayCount||0);i++)out.push(p)});return out}
function activeEligible(){return d.prizes.filter(p=>p.eligible&&+p.prob>0&&!capReached(p))}
function polar(a,r=220){let x=(a-90)*Math.PI/180;return{x:250+r*Math.cos(x),y:250+r*Math.sin(x)}}function path(a,b){let p=polar(a),q=polar(b);return`M250 250 L${p.x} ${p.y} A220 220 0 0 1 ${q.x} ${q.y} Z`}
function drawWheel(){wheel.innerHTML='';let a=visibleSegments();if(!a.length)return;let s=360/a.length,NS='http://www.w3.org/2000/svg';a.forEach((p,i)=>{let st=i*s,en=st+s,m=st+s/2,x=document.createElementNS(NS,'path');x.setAttribute('d',path(st,en));x.setAttribute('fill',colors[p.color]||colors.milk);x.setAttribute('stroke','#cdbdad');x.setAttribute('stroke-width','1.2');wheel.appendChild(x);let pt=polar(m,154),t=document.createElementNS(NS,'text');t.setAttribute('x',pt.x);t.setAttribute('y',pt.y+6);t.setAttribute('text-anchor','middle');t.setAttribute('fill','#3b2d26');t.setAttribute('font-family','Georgia');t.setAttribute('font-size',p.name.length>9?'15':'22');t.setAttribute('font-weight',p.special?'700':'400');t.setAttribute('transform',`rotate(${m},${pt.x},${pt.y})`);t.textContent=p.name;wheel.appendChild(t)})}
function todayKey(){return new Date().toISOString().slice(0,10)}
function countPrize(p,scope='all'){return d.records.filter(r=>r.prizeId===p.id&&(scope==='all'||r.date===todayKey())).length}
function capReached(p){return (+p.dailyMax>0&&countPrize(p,'today')>=+p.dailyMax)||(+p.totalMax>0&&countPrize(p,'all')>=+p.totalMax)}
function missesSince(p){let n=0;for(let i=d.records.length-1;i>=0;i--){if(d.records[i].prizeId===p.id)break;n++}return n}
function pick(){let list=activeEligible();const guaranteed=list.filter(p=>+p.guaranteeAfter>0&&missesSince(p)>=+p.guaranteeAfter).sort((a,b)=>+b.guaranteeAfter-+a.guaranteeAfter);if(guaranteed.length)return guaranteed[0];let total=list.reduce((s,p)=>s+(+p.prob||0),0),r=Math.random()*total;for(let p of list){r-=+p.prob;if(r<=0)return p}return list.at(-1)}
function idxFor(p){let a=visibleSegments(),m=a.map((x,i)=>x.id===p.id?i:-1).filter(i=>i>=0);return{idx:m[Math.floor(Math.random()*m.length)],count:a.length}}
function tone(f=660,du=.6,v=.1){try{let A=AudioContext||webkitAudioContext,c=new A,o=c.createOscillator(),g=c.createGain();o.frequency.value=f;g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(v,c.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+du);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+du+.05)}catch{}}
function tick(){if(!d.effects.tick)return;pointer.classList.remove('tick');void pointer.offsetWidth;pointer.classList.add('tick');tone(310,.05,.025)}
function ticks(){if(!d.effects.tick)return;let delay=70,e=0;const loop=()=>{tick();e+=delay;delay=Math.min(430,delay*1.12);if(e<5100)timer=setTimeout(loop,delay)};loop()}function stopTicks(){clearTimeout(timer)}
function conf(s){if(!d.effects.confetti)return;confetti.innerHTML='';for(let i=0;i<(s?56:30);i++){let e=document.createElement('i');e.style.left=Math.random()*100+'vw';e.style.setProperty('--x',(Math.random()*190-95)+'px');e.style.setProperty('--r',(Math.random()*720-360)+'deg');e.style.animationDelay=(Math.random()*.25)+'s';e.style.background=i%3==0?'#c5a063':i%3==1?'#8e7a6c':'#eadbc4';confetti.appendChild(e)}setTimeout(()=>confetti.innerHTML='',2400)}
function countdownRun(){if(!d.effects.countdown)return Promise.resolve();return new Promise(res=>{let a=['3','2','1'],i=0,s=countdown.querySelector('span');countdown.classList.add('show');const step=()=>{s.textContent=a[i];s.style.animation='none';void s.offsetWidth;s.style.animation='pop .75s';i++;if(i<a.length)setTimeout(step,760);else setTimeout(()=>{countdown.classList.remove('show');res()},760)};step()})}
function valid(){let display=d.prizes.reduce((a,p)=>a+(+p.displayCount||0),0);let prob=d.prizes.filter(p=>p.eligible).reduce((a,p)=>a+(+p.prob||0),0);if(d.prizes.length<2)return'至少保留兩個獎項';if(display<8||display>12)return'顯示總格數必須是 8～12 格';if(Math.abs(prob-100)>.001)return'可中獎獎項的機率總和必須等於 100%';if(!d.prizes.some(p=>p.eligible&&+p.prob>0))return'至少要有一個可中獎獎項';if(d.start>d.end)return'開始日不能晚於結束日';if(d.expiry<d.end)return'優惠券期限不能早於活動結束日';return''}
staffLogin.onclick=()=>{if(!d.enabled){staffMsg.textContent='活動目前未開放';return}if(staffPw.value===STAFF){staffPw.value='';staffMsg.textContent='';show('draw')}else staffMsg.textContent='密碼錯誤'};staffPw.onkeydown=e=>{if(e.key==='Enter')staffLogin.click()}
spin.onclick=async()=>{if(spinning)return;let p=pick();if(!p){alert('目前沒有可抽出的獎項，請管理者檢查設定。');return}spinning=true;spin.disabled=true;await countdownRun();let x=idxFor(p),s=360/x.count,c=x.idx*s+s/2,cur=((rot%360)+360)%360,target=360-c;rot+=(7+Math.floor(Math.random()*2))*360+((target-cur+360)%360);ticks();wheel.style.transform=`rotate(${rot}deg)`;setTimeout(()=>{stopTicks();resultPrize.textContent=p.name;resultTitle.textContent=p.special?d.texts.special:d.texts.result;resultKicker.textContent=p.special?'LUCKY PRIZE':'CONGRATULATIONS';result.classList.toggle('special',p.special&&d.effects.gold);if(d.effects.quote){quote.hidden=false;quote.textContent=d.quotes[Math.floor(Math.random()*d.quotes.length)]}else quote.hidden=true;if(!d.effects.test){d.records.push({time:new Date().toISOString(),date:todayKey(),prizeId:p.id,name:p.name});save(false)}if(d.effects.vibration&&navigator.vibrate)navigator.vibrate(p.special?[70,50,130]:60);if(d.effects.sound)tone(p.special?880:660,.65,.12);conf(p.special);sent.checked=false;next.disabled=true;show('result');spinning=false},5600)}
sent.onchange=()=>next.disabled=!sent.checked;next.onclick=()=>{spin.disabled=false;show('staff')}
logo.onclick=()=>{taps++;clearTimeout(tapTimer);tapTimer=setTimeout(()=>taps=0,900);if(taps>=3){taps=0;adminPw.value='';adminLoginMsg.textContent='';adminDialog.showModal()}}
adminCancel.onclick=()=>adminDialog.close();adminLogin.onclick=()=>{if(adminPw.value===ADMIN){adminDialog.close();fill();show('admin');resetTimer()}else adminLoginMsg.textContent='管理者密碼錯誤'}
function resetTimer(){clearTimeout(adminTimer);adminTimer=setTimeout(()=>{if(admin.classList.contains('active')){show('staff');alert('管理後台已自動登出')}},300000)}
document.addEventListener('click',()=>{if(admin.classList.contains('active'))resetTimer()})
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button,.pane').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelector(`[data-pane="${b.dataset.tab}"]`).classList.add('active')})
function summary(r){let c={};r.forEach(x=>c[x.name]=(c[x.name]||0)+1);return c}
function fill(){let now=new Date(),day=todayKey(),monday=new Date(now);monday.setDate(now.getDate()-((now.getDay()+6)%7));monday.setHours(0,0,0,0);today.textContent=d.records.filter(x=>x.date===day).length;week.textContent=d.records.filter(x=>new Date(x.time)>=monday).length;total.textContent=d.records.length;prizeStats.innerHTML='';let c=summary(d.records);d.prizes.forEach(p=>{let a=document.createElement('article');a.innerHTML=`<span>${p.name}</span><b>${c[p.name]||0}</b>`;prizeStats.appendChild(a)});startDate.value=d.start;endDate.value=d.end;expiryDate.value=d.expiry;enabled.checked=d.enabled;
[tHero,tSub,tStaff,tDraw,tSpin,tNote,tResult,tSpecial,tBadge,tFooter].forEach((e,i)=>e.value=[d.texts.hero,d.texts.sub,d.texts.staff,d.texts.draw,d.texts.spin,d.texts.note,d.texts.result,d.texts.special,d.texts.badge,d.texts.footer][i]);
[eCountdown,eTick,eSound,eConfetti,eGold,eVibration,eLogo,eBg,eQuote,eTest].forEach((e,i)=>e.checked=[d.effects.countdown,d.effects.tick,d.effects.sound,d.effects.confetti,d.effects.gold,d.effects.vibration,d.effects.logo,d.effects.bg,d.effects.quote,d.effects.test][i]);renderPrizes()}
function renderPrizes(){prizeEditor.innerHTML='';d.prizes.forEach((p,i)=>{let r=document.createElement('div');r.className='prize-row';r.innerHTML=`
<label>名稱<input class="pn" data-i="${i}" value="${p.name}"></label>
<label>顯示格數<input class="pd" data-i="${i}" type="number" min="0" max="12" value="${p.displayCount}"></label>
<label>真實機率 %<input class="pp" data-i="${i}" type="number" min="0" max="100" step=".1" value="${p.prob}"></label>
<label>顏色<select class="pc" data-i="${i}">${Object.keys(colors).map(c=>`<option ${c===p.color?'selected':''}>${c}</option>`).join('')}</select></label>
<label class="switch half">可中獎<input class="pe" data-i="${i}" type="checkbox" ${p.eligible?'checked':''}></label>
<label class="switch half">特別獎<input class="ps" data-i="${i}" type="checkbox" ${p.special?'checked':''}></label>
<label>每日最多（0=不限）<input class="pdm" data-i="${i}" type="number" min="0" value="${p.dailyMax||0}"></label>
<label>活動最多（0=不限）<input class="ptm" data-i="${i}" type="number" min="0" value="${p.totalMax||0}"></label>
<label class="half">保底：連續幾次未中後強制中（0=關閉）<input class="pga" data-i="${i}" type="number" min="0" value="${p.guaranteeAfter||0}"></label>
<button class="danger remove" data-i="${i}">刪除</button>`;prizeEditor.appendChild(r)});prizeEditor.querySelectorAll('input,select').forEach(e=>{e.oninput=sync;e.onchange=sync});prizeEditor.querySelectorAll('.remove').forEach(b=>b.onclick=()=>{if(d.prizes.length<=2)return alert('至少保留兩個獎項');if(confirm('確定刪除？')){d.prizes.splice(+b.dataset.i,1);renderPrizes()}});totalsUpdate()}
function sync(){document.querySelectorAll('.pn').forEach(e=>d.prizes[+e.dataset.i].name=e.value);document.querySelectorAll('.pd').forEach(e=>d.prizes[+e.dataset.i].displayCount=+e.value||0);document.querySelectorAll('.pp').forEach(e=>d.prizes[+e.dataset.i].prob=+e.value||0);document.querySelectorAll('.pc').forEach(e=>d.prizes[+e.dataset.i].color=e.value);document.querySelectorAll('.pe').forEach(e=>d.prizes[+e.dataset.i].eligible=e.checked);document.querySelectorAll('.ps').forEach(e=>d.prizes[+e.dataset.i].special=e.checked);document.querySelectorAll('.pdm').forEach(e=>d.prizes[+e.dataset.i].dailyMax=+e.value||0);document.querySelectorAll('.ptm').forEach(e=>d.prizes[+e.dataset.i].totalMax=+e.value||0);document.querySelectorAll('.pga').forEach(e=>d.prizes[+e.dataset.i].guaranteeAfter=+e.value||0);totalsUpdate()}
function totalsUpdate(){let ds=d.prizes.reduce((a,p)=>a+(+p.displayCount||0),0),ps=d.prizes.filter(p=>p.eligible).reduce((a,p)=>a+(+p.prob||0),0);displayTotal.textContent=ds+' 格';displayTotal.style.color=ds>=8&&ds<=12?'#3b2d26':'#9e4e45';probTotal.textContent=ps+'%';probTotal.style.color=Math.abs(ps-100)<.001?'#3b2d26':'#9e4e45'}
addPrize.onclick=()=>{d.prizes.push({id:'p'+Date.now(),name:'新獎項',displayCount:1,prob:0,eligible:false,color:'cream',special:false,dailyMax:0,totalMax:0,guaranteeAfter:0});renderPrizes()}
saveStats.onclick=()=>{d.start=startDate.value;d.end=endDate.value;d.expiry=expiryDate.value;d.enabled=enabled.checked;let e=valid();if(e)return adminMsg.textContent=e;save();apply();adminMsg.textContent='活動設定已儲存'}
savePrizes.onclick=()=>{sync();let e=valid();if(e)return adminMsg.textContent=e;save();drawWheel();fill();adminMsg.textContent='獎項已儲存'}
saveText.onclick=()=>{d.texts={hero:tHero.value,sub:tSub.value,staff:tStaff.value,draw:tDraw.value,spin:tSpin.value,note:tNote.value,result:tResult.value,special:tSpecial.value,badge:tBadge.value,footer:tFooter.value};save();apply();adminMsg.textContent='文字已儲存'}
saveEffects.onclick=()=>{d.effects={countdown:eCountdown.checked,tick:eTick.checked,sound:eSound.checked,confetti:eConfetti.checked,gold:eGold.checked,vibration:eVibration.checked,logo:eLogo.checked,bg:eBg.checked,quote:eQuote.checked,test:eTest.checked};save();apply();adminMsg.textContent='特效已儲存'}
function dl(n,t,type){let b=new Blob([t],{type}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=n;a.click();URL.revokeObjectURL(u)}
csv.onclick=()=>dl('FINUS-抽獎紀錄.csv','\ufeff'+[['日期','時間','獎項'],...d.records.map(x=>[x.date,new Date(x.time).toLocaleTimeString('zh-TW'),x.name])].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n'),'text/csv')
jsonOut.onclick=()=>dl('FINUS-設定.json',JSON.stringify(d,null,2),'application/json')
jsonIn.onchange=async e=>{try{localStorage.setItem(PREV,JSON.stringify(d));d=JSON.parse(await e.target.files[0].text());save(false);apply();fill();adminMsg.textContent='匯入完成'}catch{adminMsg.textContent='JSON 格式錯誤'}}
restore.onclick=()=>{let p=localStorage.getItem(PREV);if(!p)return alert('沒有上一版');if(confirm('確定還原？')){d=JSON.parse(p);save(false);apply();fill()}}
resetToday.onclick=()=>{if(confirm('重設今日統計？')){let x=todayKey();d.records=d.records.filter(r=>r.date!==x);save(false);fill()}}
resetAll.onclick=()=>{if(confirm('清除全部統計？')){d.records=[];save(false);fill()}}
defaults.onclick=()=>{if(confirm('恢復 FINUS 預設？')){localStorage.setItem(PREV,JSON.stringify(d));d=clone(defaults);save(false);apply();fill()}}
logout.onclick=()=>{clearTimeout(adminTimer);show('staff')}
apply();if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))
