
const APP_VERSION='4.0.0';
const VERSION_FILE='./version.json';
const STORAGE_KEY='finusLuckyDrawPro30';
const PREVIOUS_KEY='finusLuckyDrawPro30Previous';
const STAFF_PASSWORD='2026';
const ADMIN_PASSWORD='jun0725';

const palette={milk:'#eadfd2',cream:'#f4ece4',gold:'#d9bd8b',mocha:'#9b806f',blush:'#d9c3b9',sage:'#c8c9b7',stone:'#c8c0b8',ivory:'#fffaf3'};

const defaults={
  eventEnabled:true,
  startDate:'2026-09-15',
  endDate:'2026-10-31',
  expiryDate:'2026-12-10',
  texts:{
    heroTitle:'週年驚喜抽',
    heroSubtitle:'ANNIVERSARY LUCKY DRAW',
    staffTitle:'店員解鎖',
    drawTitle:'祝你好運',
    spinButton:'開始抽獎',
    drawNote:'單次消費滿 $2,000，即可獲得一次抽獎機會。',
    resultTitle:'恭喜獲得',
    specialTitle:'今日幸運獎！',
    resultBadge:'會員電子優惠券',
    footer:'每份驚喜，都是 FINUS 的心意。'
  },
  effects:{
    countdown:true,tick:true,sound:true,confetti:true,gold:true,
    vibration:false,logo:true,background:true,quote:false,test:false
  },
  prizes:[
    {id:'p50',name:'$50',displayCount:6,probability:95,eligible:true,color:'milk',special:false,dailyMax:0,totalMax:0,guaranteeAfter:0},
    {id:'p100',name:'$100',displayCount:3,probability:5,eligible:true,color:'gold',special:true,dailyMax:0,totalMax:0,guaranteeAfter:0},
    {id:'p500',name:'$500',displayCount:1,probability:0,eligible:false,color:'mocha',special:true,dailyMax:0,totalMax:0,guaranteeAfter:0}
  ],
  quotes:[
    '今天運氣不錯，記得保持帥氣。',
    '換了新髮型，也帶走一點好運。',
    '新的髮型，新的好運。'
  ],
  records:[]
};

const $=id=>document.getElementById(id);
const clone=value=>JSON.parse(JSON.stringify(value));

function loadData(){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
    return {
      ...clone(defaults),
      ...saved,
      texts:{...defaults.texts,...(saved.texts||{})},
      effects:{...defaults.effects,...(saved.effects||{})},
      prizes:Array.isArray(saved.prizes)&&saved.prizes.length?saved.prizes:clone(defaults.prizes),
      quotes:Array.isArray(saved.quotes)&&saved.quotes.length?saved.quotes:clone(defaults.quotes),
      records:Array.isArray(saved.records)?saved.records:[]
    };
  }catch{
    return clone(defaults);
  }
}

let data=loadData();
let rotation=0;
let spinning=false;
let tickTimer;
let adminTimer;
let tapCount=0;
let tapTimer;

const screens={
  staff:$('staffScreen'),
  draw:$('drawScreen'),
  result:$('resultScreen'),
  admin:$('adminScreen')
};

function saveData(backup=true){
  if(backup){
    localStorage.setItem(PREVIOUS_KEY,localStorage.getItem(STORAGE_KEY)||JSON.stringify(defaults));
  }
  localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
}

function showScreen(name){
  Object.values(screens).forEach(el=>el.classList.remove('active'));
  screens[name].classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
}

function dateLabel(iso){
  const [y,m,d]=iso.split('-');
  return `${m}.${d}`;
}


function showToast(message){
  let toast=document.querySelector('.mobile-save-toast');
  if(!toast){
    toast=document.createElement('div');
    toast.className='mobile-save-toast';
    document.body.appendChild(toast);
  }
  toast.textContent=message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer=setTimeout(()=>toast.classList.remove('show'),1800);
}

function closeKeyboard(){
  const active=document.activeElement;
  if(active&&['INPUT','SELECT','TEXTAREA'].includes(active.tagName)) active.blur();
}

function versionCompare(a,b){
  const A=String(a).split('.').map(Number),B=String(b).split('.').map(Number);
  for(let i=0;i<Math.max(A.length,B.length);i++){
    const x=A[i]||0,y=B[i]||0;
    if(x>y)return 1;
    if(x<y)return -1;
  }
  return 0;
}

async function fetchLatestVersion(){
  const response=await fetch(`${VERSION_FILE}?t=${Date.now()}`,{cache:'no-store'});
  if(!response.ok) throw new Error('version fetch failed');
  return response.json();
}

async function clearWebCaches(){
  if('serviceWorker' in navigator){
    const registrations=await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(reg=>reg.unregister()));
  }
  if('caches' in window){
    const keys=await caches.keys();
    await Promise.all(keys.map(key=>caches.delete(key)));
  }
}

function applySettings(){
  if($('versionBadge')) $('versionBadge').textContent=APP_VERSION;
  if($('currentVersion')) $('currentVersion').textContent=APP_VERSION;
  $('heroTitle').textContent=data.texts.heroTitle;
  $('heroSubtitle').textContent=data.texts.heroSubtitle;
  $('staffTitle').textContent=data.texts.staffTitle;
  $('drawTitle').textContent=data.texts.drawTitle;
  $('spinBtn').textContent=data.texts.spinButton;
  $('drawNote').textContent=data.texts.drawNote;
  $('resultBadge').textContent=data.texts.resultBadge;
  $('footerText').textContent=data.texts.footer;
  $('eventDates').textContent=`${dateLabel(data.startDate)} — ${dateLabel(data.endDate)}`;
  $('expiryText').textContent=data.expiryDate.replaceAll('-','/');
  document.body.classList.toggle('no-bg',!data.effects.background);
  $('brand').classList.remove('animate');
  if(data.effects.logo) requestAnimationFrame(()=>$('brand').classList.add('animate'));
  drawWheel();
}

function visibleSegments(){
  const pool=data.prizes
    .filter(prize=>Number(prize.displayCount)>0)
    .map(prize=>({prize,count:Math.max(0,Number(prize.displayCount)||0)}));

  const total=pool.reduce((sum,item)=>sum+item.count,0);
  if(!total) return [];

  // 讓不同獎項盡量平均打散，不把相同獎項全部擠在一起。
  const result=[];
  let lastId=null;

  while(result.length<total){
    const candidates=pool
      .filter(item=>item.count>0)
      .sort((a,b)=>{
        if(a.prize.id===lastId && b.prize.id!==lastId) return 1;
        if(b.prize.id===lastId && a.prize.id!==lastId) return -1;
        if(a.prize.eligible!==b.prize.eligible) return a.prize.eligible?-1:1;
        return b.count-a.count;
      });

    const next=candidates[0];
    if(!next) break;
    result.push(next.prize);
    next.count--;
    lastId=next.prize.id;
  }

  // 將僅展示的大獎盡量安排在接近 11 點鐘方向，視覺更有記憶點。
  const showcaseIndex=result.findIndex(prize=>!prize.eligible && Number(prize.displayCount)>0);
  if(showcaseIndex>=0 && result.length>=8){
    const targetIndex=Math.max(0,Math.round(result.length*0.90)%result.length);
    const [showcase]=result.splice(showcaseIndex,1);
    result.splice(targetIndex,0,showcase);
  }

  return result;
}

function todayKey(){
  return new Date().toISOString().slice(0,10);
}

function countPrize(prize,scope='all'){
  return data.records.filter(record=>{
    if(record.prizeId!==prize.id) return false;
    return scope==='all'||record.date===todayKey();
  }).length;
}

function capReached(prize){
  return (Number(prize.dailyMax)>0&&countPrize(prize,'today')>=Number(prize.dailyMax))
    ||(Number(prize.totalMax)>0&&countPrize(prize,'all')>=Number(prize.totalMax));
}

function missesSince(prize){
  let misses=0;
  for(let i=data.records.length-1;i>=0;i--){
    if(data.records[i].prizeId===prize.id) break;
    misses++;
  }
  return misses;
}

function activeEligiblePrizes(){
  return data.prizes.filter(prize=>prize.eligible&&Number(prize.probability)>0&&!capReached(prize));
}

function choosePrize(){
  const active=activeEligiblePrizes();
  const guaranteed=active
    .filter(prize=>Number(prize.guaranteeAfter)>0&&missesSince(prize)>=Number(prize.guaranteeAfter))
    .sort((a,b)=>Number(b.guaranteeAfter)-Number(a.guaranteeAfter));
  if(guaranteed.length) return guaranteed[0];

  const total=active.reduce((sum,p)=>sum+Number(p.probability||0),0);
  let roll=Math.random()*total;
  for(const prize of active){
    roll-=Number(prize.probability||0);
    if(roll<=0) return prize;
  }
  return active.at(-1);
}

const NS='http://www.w3.org/2000/svg';

function polar(angle,radius=220){
  const rad=(angle-90)*Math.PI/180;
  return {x:250+radius*Math.cos(rad),y:250+radius*Math.sin(rad)};
}

function arcPath(start,end){
  const a=polar(start),b=polar(end);
  return `M250 250 L${a.x} ${a.y} A220 220 0 0 1 ${b.x} ${b.y} Z`;
}

function drawWheel(){
  const svg=$('wheelSvg');
  svg.innerHTML='';
  const segments=visibleSegments();
  if(!segments.length) return;

  const slice=360/segments.length;

  segments.forEach((prize,index)=>{
    const start=index*slice;
    const end=start+slice;
    const middle=start+slice/2;

    const path=document.createElementNS(NS,'path');
    path.setAttribute('d',arcPath(start,end));
    path.setAttribute('fill',palette[prize.color]||palette.milk);
    path.setAttribute('stroke','#cdbdad');
    path.setAttribute('stroke-width','1.15');
    if(prize.special) path.classList.add('featured-segment');
    svg.appendChild(path);

    // 文字永遠保持正向閱讀，避免下半圈倒著看。
    const point=polar(middle,154);
    const text=document.createElementNS(NS,'text');
    text.setAttribute('x',point.x);
    text.setAttribute('y',point.y+7);
    text.setAttribute('text-anchor','middle');
    text.setAttribute('dominant-baseline','middle');
    text.setAttribute('fill','#3d2e27');
    text.setAttribute('font-family','Georgia');
    text.setAttribute('font-size',segments.length>=12?'18':segments.length>=10?'21':'24');
    text.setAttribute('font-weight',prize.special?'700':'500');

    let readableRotation=middle;
    if(readableRotation>90 && readableRotation<270) readableRotation+=180;
    text.setAttribute('transform',`rotate(${readableRotation},${point.x},${point.y})`);

    if(prize.special) text.classList.add('featured-label');
    if(!prize.eligible) text.classList.add('display-only-label');
    text.textContent=prize.name;
    svg.appendChild(text);
  });

  const innerRing=document.createElementNS(NS,'circle');
  innerRing.setAttribute('cx','250');
  innerRing.setAttribute('cy','250');
  innerRing.setAttribute('r','220');
  innerRing.setAttribute('fill','none');
  innerRing.setAttribute('stroke','rgba(143,102,54,.55)');
  innerRing.setAttribute('stroke-width','3');
  svg.appendChild(innerRing);
}

function visualIndexFor(prize){
  const segments=visibleSegments();
  const matches=segments.map((p,i)=>p.id===prize.id?i:-1).filter(i=>i>=0);
  return {index:matches[Math.floor(Math.random()*matches.length)],count:segments.length};
}

function playTone(freq=660,duration=.6,volume=.1){
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    const ctx=new AC();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.frequency.value=freq;
    gain.gain.setValueAtTime(.0001,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume,ctx.currentTime+.02);
    gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime+duration+.05);
  }catch{}
}

function pointerTick(){
  if(!data.effects.tick) return;
  $('pointer').classList.remove('tick');
  void $('pointer').offsetWidth;
  $('pointer').classList.add('tick');
  playTone(310,.05,.025);
}

function startTicks(){
  if(!data.effects.tick) return;
  let delay=70;
  let elapsed=0;
  const loop=()=>{
    pointerTick();
    elapsed+=delay;
    delay=Math.min(430,delay*1.12);
    if(elapsed<5100) tickTimer=setTimeout(loop,delay);
  };
  loop();
}

function stopTicks(){
  clearTimeout(tickTimer);
}

function runCountdown(){
  if(!data.effects.countdown) return Promise.resolve();
  return new Promise(resolve=>{
    const overlay=$('countdownOverlay');
    const span=overlay.querySelector('span');
    const values=['3','2','1'];
    let index=0;
    overlay.classList.add('show');

    const step=()=>{
      span.textContent=values[index];
      span.style.animation='none';
      void span.offsetWidth;
      span.style.animation='pop .75s';
      index++;
      if(index<values.length){
        setTimeout(step,760);
      }else{
        setTimeout(()=>{
          overlay.classList.remove('show');
          resolve();
        },760);
      }
    };
    step();
  });
}

function launchConfetti(special){
  if(!data.effects.confetti) return;
  const layer=$('confettiLayer');
  layer.innerHTML='';
  const count=special?56:30;
  for(let i=0;i<count;i++){
    const bit=document.createElement('i');
    bit.style.left=Math.random()*100+'vw';
    bit.style.setProperty('--x',(Math.random()*190-95)+'px');
    bit.style.setProperty('--r',(Math.random()*720-360)+'deg');
    bit.style.animationDelay=(Math.random()*.25)+'s';
    bit.style.background=i%3===0?'#c5a063':i%3===1?'#8e7a6c':'#eadbc4';
    layer.appendChild(bit);
  }
  setTimeout(()=>layer.innerHTML='',2400);
}

function validate(){
  const displayTotal=data.prizes.reduce((sum,p)=>sum+Number(p.displayCount||0),0);
  const probTotal=data.prizes.filter(p=>p.eligible).reduce((sum,p)=>sum+Number(p.probability||0),0);
  if(data.prizes.length<2) return '至少保留兩個獎項。';
  if(displayTotal<8||displayTotal>12) return '顯示總格數必須是 8～12 格。';
  if(Math.abs(probTotal-100)>.001) return '可中獎獎項的機率總和必須等於 100%。';
  if(!data.prizes.some(p=>p.eligible&&Number(p.probability)>0)) return '至少要有一個可中獎獎項。';
  if(data.startDate>data.endDate) return '活動開始日不能晚於結束日。';
  if(data.expiryDate<data.endDate) return '優惠券期限不能早於活動結束日。';
  return '';
}

$('staffLoginBtn').onclick=()=>{
  if(!data.eventEnabled){
    $('staffMessage').textContent='活動目前未開放。';
    return;
  }
  if($('staffPassword').value===STAFF_PASSWORD){
    $('staffPassword').value='';
    $('staffMessage').textContent='';
    showScreen('draw');
  }else{
    $('staffMessage').textContent='密碼錯誤。';
  }
};

$('staffPassword').onkeydown=e=>{
  if(e.key==='Enter') $('staffLoginBtn').click();
};

$('spinBtn').onclick=async()=>{
  if(spinning) return;

  const prize=choosePrize();
  if(!prize){
    alert('目前沒有可抽出的獎項，請管理者檢查機率或上限設定。');
    return;
  }

  spinning=true;
  $('spinBtn').disabled=true;
  await runCountdown();

  const segment=visualIndexFor(prize);
  const slice=360/segment.count;
  const center=segment.index*slice+slice/2;
  const current=((rotation%360)+360)%360;
  const target=360-center;
  rotation+=(7+Math.floor(Math.random()*2))*360+((target-current+360)%360);

  startTicks();
  $('wheelSvg').style.transform=`rotate(${rotation}deg)`;

  setTimeout(()=>{
    stopTicks();

    $('resultPrize').textContent=prize.name;
    $('resultTitle').textContent=prize.special?data.texts.specialTitle:data.texts.resultTitle;
    $('resultEyebrow').textContent=prize.special?'LUCKY PRIZE':'CONGRATULATIONS';
    $('resultScreen').classList.toggle('special',prize.special&&data.effects.gold);

    if(data.effects.quote){
      $('luckyQuote').hidden=false;
      $('luckyQuote').textContent=data.quotes[Math.floor(Math.random()*data.quotes.length)];
    }else{
      $('luckyQuote').hidden=true;
    }

    if(!data.effects.test){
      data.records.push({
        time:new Date().toISOString(),
        date:todayKey(),
        prizeId:prize.id,
        prizeName:prize.name
      });
      saveData(false);
    }

    if(data.effects.vibration&&navigator.vibrate){
      navigator.vibrate(prize.special?[70,50,130]:60);
    }
    if(data.effects.sound){
      playTone(prize.special?880:660,.65,.12);
    }

    launchConfetti(prize.special);
    $('couponSent').checked=false;
    $('nextBtn').disabled=true;
    showScreen('result');
    spinning=false;
  },5600);
};

$('couponSent').onchange=()=>{
  $('nextBtn').disabled=!$('couponSent').checked;
};

$('nextBtn').onclick=()=>{
  $('spinBtn').disabled=false;
  showScreen('staff');
};

$('logoTap').onclick=()=>{
  tapCount++;
  clearTimeout(tapTimer);
  tapTimer=setTimeout(()=>tapCount=0,900);

  if(tapCount>=3){
    tapCount=0;
    $('adminPassword').value='';
    $('adminLoginMessage').textContent='';
    $('adminDialog').showModal();
  }
};

$('adminCancelBtn').onclick=()=>$('adminDialog').close();

$('adminLoginBtn').onclick=()=>{
  if($('adminPassword').value===ADMIN_PASSWORD){
    $('adminDialog').close();
    fillAdmin();
    showScreen('admin');
    resetAdminTimer();
  }else{
    $('adminLoginMessage').textContent='管理者密碼錯誤。';
  }
};

function resetAdminTimer(){
  clearTimeout(adminTimer);
  adminTimer=setTimeout(()=>{
    if($('adminScreen').classList.contains('active')){
      showScreen('staff');
      alert('管理後台已自動登出。');
    }
  },1800000);
}

document.addEventListener('click',()=>{
  if($('adminScreen').classList.contains('active')) resetAdminTimer();
});

document.querySelectorAll('.tab').forEach(button=>{
  button.onclick=()=>{
    document.querySelectorAll('.tab,.pane').forEach(el=>el.classList.remove('active'));
    button.classList.add('active');
    document.querySelector(`[data-pane="${button.dataset.tab}"]`).classList.add('active');
  };
});

function summarize(records){
  const counts={};
  records.forEach(record=>counts[record.prizeName]=(counts[record.prizeName]||0)+1);
  return counts;
}

function fillAdmin(){
  const today=todayKey();
  const now=new Date();
  const monday=new Date(now);
  monday.setDate(now.getDate()-((now.getDay()+6)%7));
  monday.setHours(0,0,0,0);

  $('todayTotal').textContent=data.records.filter(r=>r.date===today).length;
  $('weekTotal').textContent=data.records.filter(r=>new Date(r.time)>=monday).length;
  $('allTotal').textContent=data.records.length;

  $('prizeStats').innerHTML='';
  const counts=summarize(data.records);
  data.prizes.forEach(prize=>{
    const article=document.createElement('article');
    article.innerHTML=`<span>${prize.name}</span><strong>${counts[prize.name]||0}</strong>`;
    $('prizeStats').appendChild(article);
  });

  $('startDate').value=data.startDate;
  $('endDate').value=data.endDate;
  $('expiryDate').value=data.expiryDate;
  $('eventEnabled').checked=data.eventEnabled;

  const textMap={
    textHeroTitle:'heroTitle',
    textHeroSubtitle:'heroSubtitle',
    textStaffTitle:'staffTitle',
    textDrawTitle:'drawTitle',
    textSpinButton:'spinButton',
    textDrawNote:'drawNote',
    textResultTitle:'resultTitle',
    textSpecialTitle:'specialTitle',
    textResultBadge:'resultBadge',
    textFooter:'footer'
  };
  Object.entries(textMap).forEach(([id,key])=>$(id).value=data.texts[key]);

  const effectMap={
    effectCountdown:'countdown',
    effectTick:'tick',
    effectSound:'sound',
    effectConfetti:'confetti',
    effectGold:'gold',
    effectVibration:'vibration',
    effectLogo:'logo',
    effectBackground:'background',
    effectQuote:'quote',
    effectTest:'test'
  };
  Object.entries(effectMap).forEach(([id,key])=>$(id).checked=data.effects[key]);

  renderPrizeEditor();
}

function renderPrizeEditor(){
  const editor=$('prizeEditor');
  editor.innerHTML='';

  data.prizes.forEach((prize,index)=>{
    const card=document.createElement('div');
    card.className='prize-card';
    card.innerHTML=`
      <div class="prize-grid">
        <label>獎項名稱<input class="p-name" data-i="${index}" value="${prize.name.replaceAll('"','&quot;')}"></label>
        <label>顯示格數<input class="p-display" data-i="${index}" type="number" min="0" max="12" value="${prize.displayCount}"></label>
        <label>真實機率 %<input class="p-probability" data-i="${index}" type="number" min="0" max="100" step=".1" value="${prize.probability}"></label>
        <label>顏色<select class="p-color" data-i="${index}">
          ${Object.keys(palette).map(color=>`<option value="${color}" ${color===prize.color?'selected':''}>${color}</option>`).join('')}
        </select></label>
      </div>
      <div class="prize-flags">
        <label class="switch-row">可中獎<input class="p-eligible" data-i="${index}" type="checkbox" ${prize.eligible?'checked':''}></label>
        <label class="switch-row">特別獎<input class="p-special" data-i="${index}" type="checkbox" ${prize.special?'checked':''}></label>
      </div>
      <div class="prize-limits">
        <label>每日最多（0＝不限）<input class="p-daily" data-i="${index}" type="number" min="0" value="${prize.dailyMax||0}"></label>
        <label>活動最多（0＝不限）<input class="p-total" data-i="${index}" type="number" min="0" value="${prize.totalMax||0}"></label>
        <label>保底間隔（0＝關閉）<input class="p-guarantee" data-i="${index}" type="number" min="0" value="${prize.guaranteeAfter||0}"></label>
      </div>
      <div class="prize-actions">
        <button class="btn secondary move-up" data-i="${index}" type="button">上移</button>
        <button class="btn secondary move-down" data-i="${index}" type="button">下移</button>
        <button class="btn danger remove-prize" data-i="${index}" type="button">刪除</button>
      </div>
    `;
    editor.appendChild(card);
  });

  editor.querySelectorAll('input,select').forEach(el=>{
    el.oninput=syncPrizeEditor;
    el.onchange=syncPrizeEditor;
  });

  editor.querySelectorAll('.remove-prize').forEach(button=>{
    button.onclick=()=>{
      if(data.prizes.length<=2){
        alert('至少保留兩個獎項。');
        return;
      }
      if(confirm('確定刪除此獎項？')){
        data.prizes.splice(Number(button.dataset.i),1);
        renderPrizeEditor();
      }
    };
  });

  editor.querySelectorAll('.move-up').forEach(button=>{
    button.onclick=()=>{
      const i=Number(button.dataset.i);
      if(i>0){
        [data.prizes[i-1],data.prizes[i]]=[data.prizes[i],data.prizes[i-1]];
        renderPrizeEditor();
      }
    };
  });

  editor.querySelectorAll('.move-down').forEach(button=>{
    button.onclick=()=>{
      const i=Number(button.dataset.i);
      if(i<data.prizes.length-1){
        [data.prizes[i+1],data.prizes[i]]=[data.prizes[i],data.prizes[i+1]];
        renderPrizeEditor();
      }
    };
  });

  updateTotals();
}

function syncPrizeEditor(){
  document.querySelectorAll('.p-name').forEach(el=>data.prizes[+el.dataset.i].name=el.value);
  document.querySelectorAll('.p-display').forEach(el=>data.prizes[+el.dataset.i].displayCount=Number(el.value||0));
  document.querySelectorAll('.p-probability').forEach(el=>data.prizes[+el.dataset.i].probability=Number(el.value||0));
  document.querySelectorAll('.p-color').forEach(el=>data.prizes[+el.dataset.i].color=el.value);
  document.querySelectorAll('.p-eligible').forEach(el=>data.prizes[+el.dataset.i].eligible=el.checked);
  document.querySelectorAll('.p-special').forEach(el=>data.prizes[+el.dataset.i].special=el.checked);
  document.querySelectorAll('.p-daily').forEach(el=>data.prizes[+el.dataset.i].dailyMax=Number(el.value||0));
  document.querySelectorAll('.p-total').forEach(el=>data.prizes[+el.dataset.i].totalMax=Number(el.value||0));
  document.querySelectorAll('.p-guarantee').forEach(el=>data.prizes[+el.dataset.i].guaranteeAfter=Number(el.value||0));
  updateTotals();
}

function updateTotals(){
  const display=data.prizes.reduce((sum,p)=>sum+Number(p.displayCount||0),0);
  const probability=data.prizes.filter(p=>p.eligible).reduce((sum,p)=>sum+Number(p.probability||0),0);

  $('displayTotal').textContent=`${display} 格`;
  $('displayTotal').style.color=display>=8&&display<=12?'#3d2e27':'#9e4e45';

  $('probabilityTotal').textContent=`${Math.round(probability*10)/10}%`;
  $('probabilityTotal').style.color=Math.abs(probability-100)<.001?'#3d2e27':'#9e4e45';
}

$('addPrizeBtn').onclick=()=>{
  data.prizes.push({
    id:'p'+Date.now(),
    name:'新獎項',
    displayCount:1,
    probability:0,
    eligible:false,
    color:'cream',
    special:false,
    dailyMax:0,
    totalMax:0,
    guaranteeAfter:0
  });
  renderPrizeEditor();
};

$('saveDashboardBtn').onclick=()=>{
  data.startDate=$('startDate').value;
  data.endDate=$('endDate').value;
  data.expiryDate=$('expiryDate').value;
  data.eventEnabled=$('eventEnabled').checked;

  const error=validate();
  if(error){
    $('adminMessage').textContent=error;
    return;
  }
  saveData();
  
$('checkUpdateBtn').onclick=async()=>{
  $('versionNote').textContent='正在檢查線上版本…';
  $('checkUpdateBtn').disabled=true;
  try{
    const info=await fetchLatestVersion();
    $('latestVersion').textContent=info.version||'未知';
    if(versionCompare(info.version,APP_VERSION)>0){
      $('versionNote').textContent=info.notes||`發現新版 ${info.version}`;
      $('applyUpdateBtn').hidden=false;
      showToast('發現新版本');
    }else{
      $('versionNote').textContent='目前已是最新版。';
      $('applyUpdateBtn').hidden=true;
      showToast('目前已是最新版');
    }
  }catch{
    $('versionNote').textContent='無法讀取版本資訊，請確認 version.json 已上傳。';
  }finally{
    $('checkUpdateBtn').disabled=false;
  }
};

$('applyUpdateBtn').onclick=async()=>{
  if(!confirm('更新前會保留目前設定與統計。現在重新載入最新版？'))return;
  showToast('正在更新…');
  await clearWebCaches();
  location.replace(`${location.pathname}?updated=${Date.now()}`);
};

$('forceReloadBtn').onclick=async()=>{
  if(!confirm('清除網站快取並重新載入？本機獎項設定與統計會保留。'))return;
  await clearWebCaches();
  location.replace(`${location.pathname}?refresh=${Date.now()}`);
};


applySettings();
  $('adminMessage').textContent='活動設定已儲存。';showToast('活動設定已儲存');closeKeyboard();
};

$('savePrizesBtn').onclick=()=>{
  syncPrizeEditor();
  const error=validate();
  if(error){
    $('adminMessage').textContent=error;
    return;
  }
  saveData();
  drawWheel();
  fillAdmin();
  $('adminMessage').textContent='獎項設定已儲存。';showToast('獎項設定已儲存');closeKeyboard();
};

$('saveContentBtn').onclick=()=>{
  data.texts={
    heroTitle:$('textHeroTitle').value,
    heroSubtitle:$('textHeroSubtitle').value,
    staffTitle:$('textStaffTitle').value,
    drawTitle:$('textDrawTitle').value,
    spinButton:$('textSpinButton').value,
    drawNote:$('textDrawNote').value,
    resultTitle:$('textResultTitle').value,
    specialTitle:$('textSpecialTitle').value,
    resultBadge:$('textResultBadge').value,
    footer:$('textFooter').value
  };
  saveData();
  applySettings();
  $('adminMessage').textContent='文字已儲存。';showToast('文字已儲存');closeKeyboard();
};

$('saveEffectsBtn').onclick=()=>{
  data.effects={
    countdown:$('effectCountdown').checked,
    tick:$('effectTick').checked,
    sound:$('effectSound').checked,
    confetti:$('effectConfetti').checked,
    gold:$('effectGold').checked,
    vibration:$('effectVibration').checked,
    logo:$('effectLogo').checked,
    background:$('effectBackground').checked,
    quote:$('effectQuote').checked,
    test:$('effectTest').checked
  };
  saveData();
  applySettings();
  $('adminMessage').textContent='特效設定已儲存。';showToast('特效設定已儲存');closeKeyboard();
};

function downloadFile(name,text,type){
  const blob=new Blob([text],{type});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download=name;
  link.click();
  URL.revokeObjectURL(url);
}

$('exportCsvBtn').onclick=()=>{
  const rows=[
    ['日期','時間','獎項'],
    ...data.records.map(record=>[
      record.date,
      new Date(record.time).toLocaleTimeString('zh-TW'),
      record.prizeName
    ])
  ];
  const csv='\ufeff'+rows.map(row=>row.map(cell=>`"${String(cell).replaceAll('"','""')}"`).join(',')).join('\n');
  downloadFile('FINUS-抽獎紀錄.csv',csv,'text/csv;charset=utf-8');
};

$('exportJsonBtn').onclick=()=>{
  downloadFile('FINUS-設定.json',JSON.stringify(data,null,2),'application/json');
};

$('importJsonInput').onchange=async event=>{
  try{
    const imported=JSON.parse(await event.target.files[0].text());
    localStorage.setItem(PREVIOUS_KEY,JSON.stringify(data));
    data=imported;
    saveData(false);
    applySettings();
    fillAdmin();
    $('adminMessage').textContent='設定已匯入。';
  }catch{
    $('adminMessage').textContent='JSON 格式錯誤。';
  }
};

$('restorePreviousBtn').onclick=()=>{
  const previous=localStorage.getItem(PREVIOUS_KEY);
  if(!previous){
    alert('沒有上一版設定。');
    return;
  }
  if(confirm('確定還原上一版設定？')){
    data=JSON.parse(previous);
    saveData(false);
    applySettings();
    fillAdmin();
  }
};

$('resetTodayBtn').onclick=()=>{
  if(confirm('確定重設今日統計？')){
    const today=todayKey();
    data.records=data.records.filter(record=>record.date!==today);
    saveData(false);
    fillAdmin();
  }
};

$('resetAllBtn').onclick=()=>{
  if(confirm('確定清除全部統計？')){
    data.records=[];
    saveData(false);
    fillAdmin();
  }
};

$('restoreDefaultsBtn').onclick=()=>{
  if(confirm('確定恢復 FINUS 預設？')){
    localStorage.setItem(PREVIOUS_KEY,JSON.stringify(data));
    data=clone(defaults);
    saveData(false);
    applySettings();
    fillAdmin();
  }
};

$('adminLogoutBtn').onclick=()=>{
  clearTimeout(adminTimer);
  showScreen('staff');
};

applySettings();

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}

document.addEventListener('click',event=>{
  if(event.target.matches('button,.tab')) closeKeyboard();
});
