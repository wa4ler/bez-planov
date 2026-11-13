'use strict';
/* One flow, two profiles. OAuth tokens and credentials never enter this file. */
const el=id=>document.getElementById(id);
const esc=escapeHTML;
const ARROW='<svg class="arrow-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const WORKSPACE_KEY='bezPlanovWorkspaceV1';
const TOP_PREFS=['food','walk','art','history','nature','romance','activity','unusual','views','cinema'];
let user=null,revision=0,workspace=loadGuest(),draft=normalDraft(workspace.draft),plan=null,dayIndex=0,step=1,swapIndex=null;
let syncTimer=null,saving=false,dirty=false,editSerial=0,conflict=null,sessionReady=false,toastTimer=null;
let authConfig={providers:{yandex:false,mailru:false}};
let planBaseline=null,identityChanging=false;
function fingerprint(p){return p?JSON.stringify({config:p.config,days:p.days}):null}
function backupData(){return {workspace:clone(workspace),activePlan:plan?clone(plan):null}}
function busyIdentity(on){identityChanging=on;document.querySelector('main').inert=on;el('accountOpen').disabled=on;el('startPlan').disabled=on;document.querySelector('main').setAttribute('aria-busy',String(on))}
function protectActive(nextState){
 if(!plan||!planBaseline)return;const remote=nextState.plans.find(p=>p.id===plan.id);
 if(fingerprint(remote)===planBaseline)return;
 if(remote&&fingerprint(plan)===planBaseline){plan=clone(remote);planBaseline=fingerprint(remote)}
 else{plan={...clone(plan),id:crypto.randomUUID(),createdAt:new Date().toISOString()};planBaseline=null;notify('Общий маршрут изменился. Ваш открытый вариант оставлен отдельной копией.')}
 keepActive();if(!el('route').hidden)renderRoute();
}
function safeJSON(key,fallback,storage=localStorage){try{return JSON.parse(storage.getItem(key)||'null')??fallback}catch{return fallback}}
function validPlan(p){
 const validDate=s=>typeof s==='string'&&datesBetween(s,s).length===1;
 return !!(p&&typeof p.id==='string'&&p.config&&validDate(p.config.from)&&validDate(p.config.to)&&Array.isArray(p.config.profiles)&&p.config.profiles.length===2&&p.config.profiles.every(x=>x&&typeof x==='object')&&Number.isFinite(p.config.budgetAmount)&&Array.isArray(p.days)&&p.days.length&&p.days.length<=31&&p.days.every(d=>d&&AREA_BY_ID[d.areaId]&&validDate(d.date)&&Array.isArray(d.stops)&&d.stops.every(s=>s&&['place','fixed','break'].includes(s.kind)&&typeof s.id==='string'&&Number.isFinite(minutes(s.time))&&Number.isFinite(Number(s.duration))&&Number(s.duration)>0&&(s.kind!=='place'||PLACES[s.id]))));
}
function normalState(s){return {draft:s?.draft&&typeof s.draft==='object'?s.draft:null,plans:(Array.isArray(s?.plans)?s.plans:[]).filter(validPlan).slice(0,40),favorites:(Array.isArray(s?.favorites)?s.favorites:[]).filter(x=>typeof x==='string'&&PLACES[x])}}
function loadGuest(){
 const current=safeJSON(WORKSPACE_KEY,null);if(current)return normalState(current);
 // Import older local plans without changing or removing their source keys.
 return normalState({draft:safeJSON('bezPlanovDraftV4',null),plans:safeJSON('bezPlanovPlansV4',[]),favorites:safeJSON('bezPlanovFavoritesV4',[])});
}
function normalDraft(raw){
 const base=buildDefault();if(!raw||typeof raw!=='object')return {...base,goals:['talk']};
 const result={...base,...raw,peopleMode:'couple',partySize:2};
 result.profiles=[0,1].map(i=>({...base.profiles[i],...(raw.profiles?.[i]||{}),ratings:{...(raw.profiles?.[i]?.ratings||{})}}));
 for(const k of ['events','restrictions','goals'])if(!Array.isArray(result[k]))result[k]=[];
 if(!result.goals.length)result.goals=['talk'];return result;
}
function notify(message){clearTimeout(toastTimer);el('toast').textContent=message;el('toast').hidden=false;toastTimer=setTimeout(()=>el('toast').hidden=true,4200)}
function activeKey(){return 'bezPlanovActiveV1:'+ (user?.id||'guest')}
function keepActive(){try{if(plan)sessionStorage.setItem(activeKey(),JSON.stringify({plan,baseline:planBaseline}))}catch{notify('Не удалось запомнить открытый маршрут. Сохраните его в кабинете.')}}
function pendingKey(){return 'bezPlanovPendingV1:'+user?.id}
function persist(){
 workspace.draft=clone(draft);editSerial++;
 if(!user){try{localStorage.setItem(WORKSPACE_KEY,JSON.stringify(workspace));return true}catch{notify('Не удалось сохранить: память браузера недоступна. Скачайте план в календарь.');return false}}
 dirty=true;try{sessionStorage.setItem(pendingKey(),JSON.stringify(workspace))}catch{}
 el('draftStatus').textContent='Сохраняем изменения…';clearTimeout(syncTimer);syncTimer=setTimeout(syncState,650);return true;
}
async function api(path,options={}){
 const response=await fetch(path,{credentials:'same-origin',signal:AbortSignal.timeout(8000),...options,headers:{'Content-Type':'application/json',...options.headers}});
 let data;try{data=await response.json()}catch{throw new Error('Сервис временно недоступен. Ваши изменения остаются на устройстве.')}
 if(!response.ok){const e=new Error(data.message||'Не удалось сохранить изменения. Попробуйте ещё раз.');e.status=response.status;e.data=data;throw e}return data;
}
function showSync(message,buttons=''){
 el('syncNotice').innerHTML='<p>'+esc(message)+'</p>'+buttons;el('syncNotice').hidden=false;
}
async function syncState(){
 if(!user||!dirty||saving||conflict)return;
 if(!sessionReady)return;
 saving=true;const serial=editSerial,body=JSON.stringify({state:workspace,revision});
 try{const data=await api('/api/state',{method:'PUT',body});revision=data.revision;if(serial===editSerial){dirty=false;try{sessionStorage.removeItem(pendingKey())}catch{}el('syncNotice').hidden=true;el('draftStatus').textContent='Сохранено в общем кабинете';el('accountSync').textContent='Сохранено. Изменения доступны вам обоим.'}}
 catch(e){
  if(e.status===409){conflict={state:normalState(e.data.state),revision:e.data.revision};showSync('Партнёр обновил кабинет. Ваши правки остаются в открытом окне. Выберите, как продолжить.','<button class="text-button" data-act="merge-conflict">Сохранить мои маршруты отдельно</button><button class="text-button" data-act="load-conflict">Открыть изменения партнёра</button><button class="text-button" data-act="backup">Скачать мои правки</button>')}
  else {showSync(e.status===401?'Вход истёк. Скачайте ваши правки и войдите снова.':'Не удалось синхронизировать кабинет. Ваши правки остаются в открытом окне — скачайте резервную копию.','<button class="text-button" data-act="retry-sync">Повторить</button><button class="text-button" data-act="backup">Скачать мои правки</button>');el('draftStatus').textContent='Ожидает синхронизации';el('accountSync').textContent='Есть несинхронизированные изменения.'}
 }finally{saving=false;if(dirty&&!conflict&&serial!==editSerial)syncTimer=setTimeout(syncState,300)}
}
async function initAccount(){
 const results=await Promise.allSettled([api('/api/auth/config'),api('/api/session')]);
 if(results[0].status==='fulfilled')authConfig=results[0].value;
 if(results[1].status==='fulfilled'&&results[1].value.user){
  const data=results[1].value;user=data.user;revision=data.revision;workspace=normalState(data.state);draft=normalDraft(workspace.draft);
  const pending=safeJSON(pendingKey(),null,sessionStorage);
  if(pending){conflict={state:clone(workspace),revision};workspace=normalState(pending);draft=normalDraft(workspace.draft);dirty=true;showSync('Здесь остались ваши несинхронизированные правки. Сохраните их отдельно или откройте общие данные.','<button class="text-button" data-act="merge-conflict">Сохранить мои маршруты отдельно</button><button class="text-button" data-act="load-conflict">Открыть общие данные</button><button class="text-button" data-act="backup">Скачать мои правки</button>')}
 }
 sessionReady=true;
 const restored=safeJSON(activeKey(),null,sessionStorage);if(validPlan(restored?.plan)){plan=restored.plan;planBaseline=restored.baseline??null;protectActive(workspace)}else if(validPlan(restored)){plan=restored;planBaseline=fingerprint(workspace.plans.find(p=>p.id===plan.id))}
 fillFields();renderAccount();renderLocation();
 const params=new URLSearchParams(location.search);if(params.has('auth')){if(params.get('auth')!=='success')notify('Вход не завершён. Попробуйте ещё раз или продолжите без входа.');history.replaceState(null,'',location.pathname+location.hash)}
 busyIdentity(false);
}
function navigate(page,n){const hash=page==='planner'?'#plan/'+(n||step):'#'+page;if(location.hash===hash)renderLocation();else location.hash=hash}
function renderLocation(){
 const hash=location.hash.slice(1),match=hash.match(/^plan\/([123])$/);let page=match?'planner':['home','route','account'].includes(hash)?hash:'home';
 if(page==='route'&&!plan)page='home';
 document.querySelectorAll('main>.view').forEach(v=>v.hidden=v.id!==page);
 if(page==='planner'){setStep(Number(match[1]));fillFields()}
 if(page==='route')renderRoute();if(page==='account')renderAccount();
 el('accountOpen').setAttribute('aria-current',page==='account'?'page':'false');window.scrollTo({top:0,behavior:'instant'});
}
const STEPS=[null,['Когда ваш день?','Один вечер или несколько дней — начнём с простого.'],['Два разных вкуса','Каждый выбирает своё. Мы найдём, где ваши желания встречаются.'],['Остались детали','Темп, удобное время и то, что уже запланировано.']];
function setStep(n){step=n;document.querySelectorAll('.flow-step').forEach(s=>s.hidden=Number(s.dataset.step)!==n);document.querySelectorAll('[data-progress]').forEach(s=>{s.setAttribute('aria-current',Number(s.dataset.progress)===n?'step':'false');s.classList.toggle('complete',Number(s.dataset.progress)<n)});el('flowTitle').textContent=STEPS[n][0];el('flowDescription').textContent=STEPS[n][1];el('prevStep').hidden=n===1;el('nextStep').hidden=n===3;el('generatePlan').hidden=n!==3;el('wizardError').textContent='';if(n===3)renderReview()}
const SIMPLE_FIELDS=['dateStart','dateEnd','budgetAmount','budgetScope','journeyMode','transportReserve','hotelReserve','overnightStay','hotelAddress','dayStart','dayEnd','pace','transport','startLocation','walkingLevel','venuePreference','foodNeeds','alreadyVisited','dreamPlaces','stepFree'];
const FIELD_KEYS={dateStart:'from',dateEnd:'to'};
const PROFILE_FIELDS={nameOne:[0,'name'],likesOne:[0,'likes'],avoidOne:[0,'avoid'],nameTwo:[1,'name'],likesTwo:[1,'likes'],avoidTwo:[1,'avoid']};
function fillFields(){
 for(const id of SIMPLE_FIELDS){const x=el(id),value=draft[FIELD_KEYS[id]||id];if(x.type==='checkbox')x.checked=!!value;else x.value=value??''}
 for(const [id,[i,key]]of Object.entries(PROFILE_FIELDS))el(id).value=draft.profiles[i][key]||'';
 el('budgetAll').checked=draft.budgetCovers==='all';el('eventDate').value=el('eventDate').value||draft.from;renderTastes();reflectFields();renderEvents();
 el('draftStatus').textContent=user?(dirty?'Ожидает синхронизации':'Общий черновик пары'):'Черновик на этом устройстве';
}
function renderTastes(){[0,1].forEach(i=>{
 const selected=Object.keys(draft.profiles[i].ratings);const keys=[...new Set([...TOP_PREFS,...selected])];
 el(i?'tasteTwo':'tasteOne').innerHTML=keys.filter(k=>PREF_BY_KEY[k]).map(k=>{const rating=Number(draft.profiles[i].ratings[k]||0),p=PREF_BY_KEY[k],state=rating>0?'нравится':rating<0?'не предлагать':'не выбрано';return '<button type="button" class="taste '+(rating>0?'liked':rating<0?'avoided':'')+'" data-act="rating" data-person="'+i+'" data-pref="'+k+'" data-rating="'+rating+'" aria-label="'+esc(p.title+': '+state)+'" aria-pressed="'+(rating!==0)+'"><span class="rating-mark" aria-hidden="true">'+(rating>0?'♥':rating<0?'×':'○')+'</span>'+esc(p.title)+'</button>'}).join('');
 })}
function outsideEvents(){return draft.events.filter(e=>e.date<draft.from||e.date>draft.to)}
function reflectFields(){
 const dates=datesBetween(draft.from,draft.to),count=dates.length;el('dateStart').min=localISO(new Date());el('dateEnd').min=draft.from;el('multiDayOptions').hidden=count<2;
 el('rangeInfo').textContent=count&&count<=31?count+' '+dayWord(count)+' · '+dateLabel(draft.from)+(count>1?' — '+dateLabel(draft.to):''):'Выберите период от 1 до 31 дня.';
 el('reserveFields').hidden=draft.budgetCovers!=='all';el('hotelFields').hidden=!draft.overnightStay;el('hotelBudgetLabel').hidden=draft.budgetCovers!=='all';
 el('eventDate').min=draft.from;el('eventDate').max=draft.to;el('paidBudgetField').hidden=!el('eventPaid').checked;
 const outside=outsideEvents();el('dateConflict').hidden=!outside.length;
 el('dateConflict').innerHTML=outside.length?'Закреплённые события вне выбранных дат: '+outside.map(e=>esc(e.name)+' ('+esc(dateLabel(e.date))+')').join(', ')+'. Они сохранены. <button type="button" class="text-button" data-act="include-events">Вернуть даты с событиями</button>':'';
}
function fieldChanged(e){
 const x=e.target;if(PROFILE_FIELDS[x.id]){const [i,key]=PROFILE_FIELDS[x.id];draft.profiles[i][key]=x.value}
 else if(SIMPLE_FIELDS.includes(x.id)){const key=FIELD_KEYS[x.id]||x.id;draft[key]=x.type==='checkbox'?x.checked:x.type==='number'?Number(x.value):x.value;if(x.id==='dateStart'&&draft.to<draft.from){draft.to=draft.from;el('dateEnd').value=draft.to}}
 else if(x.id==='budgetAll')draft.budgetCovers=x.checked?'all':'activities';
 else if(x.id==='eventPaid'){reflectFields();return}else return;
 reflectFields();persist();if(step===3)renderReview();
}
function stepError(n){
 if(n===1){const ds=datesBetween(draft.from,draft.to);if(!ds.length||ds.length>31)return 'Выберите правильные даты: от одного до 31 дня.';if(draft.from<localISO(new Date()))return 'Выберите сегодняшнюю или будущую дату.';if(outsideEvents().length)return 'Закреплённые события сохранены, но находятся вне периода. Верните даты с событиями или удалите их в разделе билетов.';if(!Number.isFinite(draft.budgetAmount)||draft.budgetAmount<500||draft.budgetAmount>10000000)return 'Укажите бюджет от 500 до 10 000 000 ₽.';if(draft.budgetCovers==='all'&&(!Number.isFinite(draft.transportReserve)||draft.transportReserve<0||!Number.isFinite(draft.hotelReserve)||draft.hotelReserve<0))return 'Резервы на дорогу и ночёвку не могут быть отрицательными.'}
 if(n===2)for(let i=0;i<2;i++){const p=draft.profiles[i];if(!Object.values(p.ratings).some(v=>Number(v)>0)&&(p.likes+' '+p.dream).trim().length<10)return (i?'Партнёру':'Вам')+' нужно выбрать хотя бы один интерес или рассказать о желаниях словами.'}
 return '';
}
function showError(text){el('wizardError').textContent=text;el('wizardError').focus()}
function startNew(fresh=false){
 if(fresh){if(draft.events.length&&!window.confirm('Начать новый подбор без билетов? Закреплённые события текущего черновика будут сброшены. Сохранённые маршруты останутся.'))return;const previous=draft;draft=normalDraft(null);for(const key of ['profiles','foodNeeds','walkingLevel','venuePreference','transport','stepFree','alreadyVisited','dreamPlaces','restrictions'])draft[key]=clone(previous[key]);plan=null;planBaseline=null;try{sessionStorage.removeItem(activeKey())}catch{}}
 fillFields();persist();navigate('planner',1);
}
function renderEvents(){el('eventList').innerHTML=draft.events.map(e=>'<div class="event-row '+(outsideEvents().includes(e)?'conflict':'')+'"><div><strong>'+esc(e.name)+'</strong><p>'+esc(dateLabel(e.date))+' · '+esc(e.time)+' · '+esc(e.duration)+' мин · '+esc(formatMoney(e.cost))+(e.paid?' · оплачено':'')+'</p></div><button type="button" data-act="remove-event" data-id="'+esc(e.id)+'" aria-label="Удалить событие '+esc(e.name)+'">×</button></div>').join('')}
function addEvent(){
 const e={id:'event-'+crypto.randomUUID(),name:cleanText(el('eventName').value,110),date:el('eventDate').value,time:el('eventTime').value,duration:Number(el('eventDuration').value),cost:Number(el('eventCost').value),address:cleanText(el('eventAddress').value,180),paid:el('eventPaid').checked,includeBudget:el('eventCostIncluded').checked};
 let error='';if(!e.name)error='Введите название события.';else if(!datesBetween(draft.from,draft.to).includes(e.date))error='Событие должно входить в выбранные даты.';else if(!Number.isFinite(minutes(e.time))||minutes(e.time)+e.duration>1440)error='Проверьте время и длительность.';else if(!Number.isFinite(e.cost)||e.cost<0||e.cost>10000000)error='Укажите корректную стоимость.';else if(draft.events.length>=20)error='Можно закрепить до 20 событий.';else if(overlappingEvents([...draft.events,e]))error='Это время пересекается с другим закреплённым событием.';
 el('eventError').textContent=error;if(error)return;
 draft.events.push(e);el('eventName').value='';el('eventAddress').value='';el('eventCost').value='0';el('eventPaid').checked=false;el('eventCostIncluded').checked=false;reflectFields();renderEvents();renderReview();persist();notify('Событие закреплено');
}
function renderReview(){
 const signals=textSignals(draft),positive=signals.positive.map(k=>PREF_BY_KEY[k]?.title).filter(Boolean),restrictions=signals.restrictionLabels||[];
 el('review').innerHTML='<strong>Всё готово к вашему дню</strong><p>'+esc(draft.profiles.map((p,i)=>p.name||(i?'Партнёр':'Вы')).join(' и '))+' · '+esc(el('rangeInfo').textContent)+' · бюджет '+esc(formatMoney(draft.budgetAmount))+(draft.budgetScope==='daily'?' в день':' на период')+'</p>'+(positive.length?'<p>Распознали в пожеланиях: '+esc(positive.join(', '))+'.</p>':'')+(restrictions.length?'<p>Исключаем: '+esc(restrictions.join(', '))+'.</p>':'')+(draft.events.length?'<p>Закреплено событий: '+draft.events.length+'.</p>':'')+'<p>Сверьте ответы выше. Неизвестные пожелания останутся заметками — алгоритм пока понимает ограниченный словарь.</p>';
}
function generate(e){
 e.preventDefault();for(const n of [1,2]){const error=stepError(n);if(error){navigate('planner',n);setTimeout(()=>showError(error),0);return}}
 if(el('eventName').value.trim()){showError('Вы начали вводить событие. Нажмите «Добавить событие», чтобы сохранить его, или очистите название.');return}
 const error=validateConfig(draft);if(error){showError(error);return}
 try{plan=generateItinerary(clone(draft),{});planBaseline=null;plan.initialDays=clone(plan.days);plan.versions=[];dayIndex=0;swapIndex=null;persist();keepActive();navigate('route')}catch(error){showError(error.message)}
}
function planName(p){return p.days.length===1?'Ваш день в Москве':p.days.length+' '+dayWord(p.days.length)+' в Москве'}
function stopName(s){return s.kind==='place'?(PLACES[s.id]?.name||'Место из прежнего маршрута'):s.name||'Перерыв'}
function prepareHistory(){if(!plan.initialDays)plan.initialDays=clone(plan.days);if(!Array.isArray(plan.versions))plan.versions=[]}
function changePlan(next,label){prepareHistory();const history=clone(plan.versions);history.push({label,at:new Date().toISOString(),days:clone(plan.days)});const original=clone(plan.initialDays);plan=next;plan.initialDays=original;plan.versions=history.slice(-8);plan.updatedAt=new Date().toISOString();swapIndex=null;keepActive();renderRoute()}
function renderRoute(){
 if(!validPlan(plan))return;prepareHistory();dayIndex=Math.min(dayIndex,plan.days.length-1);
 const cfg=plan.config;el('routeTitle').textContent=planName(plan);el('routeSubtitle').textContent=dateLabel(cfg.from)+(cfg.from!==cfg.to?' — '+dateLabel(cfg.to):'')+' · '+cfg.profiles.map((p,i)=>p.name||(i?'Партнёр':'Вы')).join(' и ');
 el('routeStorageNote').textContent=user?'Общий кабинет пары':'Без входа · на этом устройстве';
 el('routeSummary').innerHTML='<div><strong>'+esc(formatMoney(totalSpend(plan)))+'</strong><span>ориентир на двоих</span></div><div><strong>'+esc(formatMoney(totalLimit(cfg,plan.days.length)))+'</strong><span>ваш бюджет</span></div><div><strong>'+plan.days.length+' '+dayWord(plan.days.length)+'</strong><span>в вашем темпе</span></div>';
 const saved=workspace.plans.find(p=>p.id===plan.id);el('savePlan').textContent=saved&&JSON.stringify(saved.days)===JSON.stringify(plan.days)?'✓ Маршрут сохранён':'Сохранить маршрут';
 el('undoPlan').disabled=!plan.versions.length;el('restoreOriginal').disabled=JSON.stringify(plan.initialDays)===JSON.stringify(plan.days);
 el('dayChooser').hidden=plan.days.length<2;el('routeDay').innerHTML=plan.days.map((d,i)=>'<option value="'+i+'">День '+(i+1)+' · '+esc(shortDate(d.date))+'</option>').join('');el('routeDay').value=dayIndex;
 renderDay();
}
function renderDay(){
 const day=plan.days[dayIndex],cfg=plan.config,sum=daySpending(day,cfg),area=AREA_BY_ID[day.areaId];
 el('dayHeading').innerHTML='<h2>'+esc(area.name)+'</h2><p>'+esc(shortDate(day.date))+' · '+esc(area.subtitle)+'</p>';
 el('dayWarnings').innerHTML=(day.warnings||[]).map(w=>'<p>'+esc(w)+'</p>').join('');
 el('timeline').innerHTML=day.stops.map((s,i)=>{
  const p=s.kind==='place'?PLACES[s.id]:null,fixed=s.kind==='fixed',isBreak=s.kind==='break';
  const cost=p?priceAllowance(p,cfg.partySize):Number(s.cost)||0;
  const details=p?p.description:s.description||(fixed?'Ваше событие. Время и содержание не меняются автоматически.':'Время для отдыха.');
  const link=p?.address||(fixed?s.address:'');const official=p?PLACE_LINKS[p.id]:null;
  const choices=swapIndex===i?alternativesFor(plan,dayIndex,i,{}):[];
  const leg=day.travel?.find(x=>x.toId===s.id);
  const travel=leg?(leg.distanceKm!==null?'Около '+leg.distanceKm+' км · ':'')+'≈ '+leg.minutes+' мин. '+(leg.note||'Предварительная оценка дороги, проверьте по карте.') : '';
  return '<article class="stop '+esc(s.kind)+'" data-stop-id="'+esc(s.id)+'"><span class="stop-time">'+esc(s.time)+'</span><i class="stop-dot" aria-hidden="true"></i><div class="stop-card"><div class="stop-type">'+(fixed?'Закреплено'+(s.paid?' · оплачено':''):isBreak?(s.purpose==='meal'?'Время поесть':'Без спешки'):esc(TAGS[p?.tags[0]]||'Впечатление')+(s.locked?' · закреплено':''))+'</div><h3>'+esc(stopName(s))+'</h3><p>'+esc(details)+'</p><div class="stop-meta"><span>'+esc(s.duration)+' мин</span><span>'+(fixed&&s.paid?'Оплачено: ':'Резерв: ')+esc(formatMoney(cost))+(fixed&&s.paid&&!s.includeBudget?' · вне бюджета':'')+'</span></div>'+(link||p?'<div class="stop-tools">'+(link?'<a href="'+esc(mapLinkYandex(link))+'" target="_blank" rel="noopener noreferrer">На карте '+ARROW+'</a>':'')+(official?.reservation||official?.website?'<a href="'+esc(official.reservation||official.website)+'" target="_blank" rel="noopener noreferrer">'+(official.reservation?'Бронирование':'Сайт места')+' '+ARROW+'</a>':'')+(p?'<button type="button" data-act="swap-menu" data-index="'+i+'" '+(s.locked?'disabled':'')+'>Заменить</button><button type="button" data-act="lock" data-index="'+i+'">'+(s.locked?'Открепить':'Закрепить')+'</button>':'')+'</div>':'')+(swapIndex===i?'<div class="swap-options">'+(choices.length?choices.map(q=>'<button type="button" data-act="swap" data-index="'+i+'" data-place="'+esc(q.id)+'">'+esc(q.name)+'<small>Резерв '+esc(formatMoney(priceAllowance(q,cfg.partySize)))+' · '+q.minutes+' мин</small></button>').join(''):'<p>Подходящей замены с учётом времени, бюджета и запретов нет.</p>')+'</div>':'')+'</div>'+(travel?'<p class="journey">До этой остановки: '+esc(travel)+'</p>':'')+'</article>';
 }).join('')||'<div class="empty-plans"><h3>Мест по этим условиям не нашлось</h3><p>Попробуйте изменить интересы, время или бюджет.</p></div>';
 const total=sum.total;el('dayInfo').innerHTML='<h3>Бюджет этого дня</h3><p class="cost-total">'+esc(formatMoney(total))+'</p><p class="field-hint">Ориентир, не предложение заведения</p><ul class="cost-list"><li><span>Места</span><span>'+esc(formatMoney(sum.place))+'</span></li><li><span>Закреплённые билеты</span><span>'+esc(formatMoney(sum.fixed))+'</span></li><li><span>Питание и паузы</span><span>'+esc(formatMoney(sum.breaks||0))+'</span></li><li><span>Дорога и проживание</span><span>'+esc(formatMoney(sum.reserved))+'</span></li><li><strong>Выделено на день</strong><strong>'+esc(formatMoney(day.limit))+'</strong></li></ul><a class="button primary" href="'+esc(dayMap(day,cfg))+'" target="_blank" rel="noopener noreferrer">Открыть путь в картах '+ARROW+'</a>'+(cfg.foodNeeds?'<p class="field-hint">Ваши пожелания к питанию: '+esc(cfg.foodNeeds)+'. Меню и аллергены проверьте отдельно.</p>':'')+(cfg.stepFree?'<p class="field-hint">Доступность входов без ступеней не проверена.</p>':'')+(cfg.overnightStay&&dayIndex<plan.days.length-1?'<p class="field-hint">Ночёвка: '+esc(cfg.hotelAddress||'адрес ещё не указан')+'. Жильё не забронировано.</p>':'')+'<p class="field-hint">Время в пути приблизительное. Часы работы, очереди и билеты не проверены онлайн.</p>';
}
async function savePlan(asCopy=false){
 if(!plan)return;protectActive(workspace);prepareHistory();if(asCopy){plan=clone(plan);plan.id=crypto.randomUUID();plan.createdAt=new Date().toISOString()}
 if(workspace.plans.length>=40&&!workspace.plans.some(p=>p.id===plan.id)){notify('В кабинете уже 40 маршрутов. Удалите ненужный или скачайте план в календарь.');return}
 const previousPlans=workspace.plans,previousBaseline=planBaseline;workspace.plans=[clone(plan),...workspace.plans.filter(p=>p.id!==plan.id)];planBaseline=fingerprint(plan);const ok=persist();if(!ok){workspace.plans=previousPlans;planBaseline=previousBaseline}keepActive();renderRoute();renderAccount();
 if(!ok)return;if(user){await syncState();notify(dirty?'Маршрут сохранён на устройстве и ожидает синхронизации':'Маршрут сохранён в общем кабинете')}else notify('Маршрут сохранён на этом устройстве. Исходная версия тоже сохранена.');
}
function renderAccount(){
 el('accountGuest').hidden=!!user;el('accountMember').hidden=!user;el('accountTitle').innerHTML=user?'Ваш общий<br><em>кабинет.</em>':'Один вход.<br><em>Ваши общие планы.</em>';
 for(const [id,key]of [['loginYandex','yandex'],['loginMailru','mailru']]){const enabled=!!authConfig.providers?.[key];el(id).setAttribute('aria-disabled',String(!enabled));el(id).tabIndex=enabled?0:-1}
 el('authStatus').textContent=authConfig.providers?.yandex||authConfig.providers?.mailru?'Выберите один аккаунт, которым вы оба будете пользоваться.':'Вход пока готовится к запуску. Сейчас можно составить и сохранить маршрут на этом устройстве.';
 if(user){el('accountEmail').textContent=user.email||'Общий кабинет';el('pairNames').textContent=draft.profiles.map((p,i)=>p.name||(i?'Партнёр':'Вы')).join(' и ');el('guestImport').hidden=!loadGuest().plans.length}
 el('savedNote').textContent=user?'Общие планы для вас обоих.':'Без входа маршруты доступны только в этом браузере.';
 el('savedPlans').innerHTML=workspace.plans.length?workspace.plans.map(p=>'<article class="saved-plan"><p class="eyebrow">'+p.days.length+' '+dayWord(p.days.length)+'</p><h3>'+esc(planName(p))+'</h3><p>'+esc(dateLabel(p.config.from))+(p.config.to!==p.config.from?' — '+esc(dateLabel(p.config.to)):'')+'</p><p>Ориентир: '+esc(formatMoney(totalSpend(p)))+' на двоих</p><div class="saved-actions"><button type="button" class="button secondary" data-act="open-plan" data-id="'+esc(p.id)+'">Открыть</button><button type="button" class="text-button" data-act="delete-plan" data-id="'+esc(p.id)+'">Удалить</button></div></article>').join(''):'<div class="empty-plans"><h3>Здесь будет ваш первый маршрут</h3><p>Выберите даты и интересы — и сохраните понравившийся день.</p></div>';
}
function downloadText(filename,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function icsEscape(t){return String(t||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,')}
function exportCalendar(){
 if(!plan)return;const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Bez Planov//Couple planner//RU','CALSCALE:GREGORIAN'];
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z/,'Z');
 for(const day of plan.days)for(const s of day.stops){const time=minutes(s.time),asUTC=n=>new Date(day.date+'T'+clock(n)+':00+03:00').toISOString().replace(/[-:]/g,'').replace(/\.\d+Z/,'Z');lines.push('BEGIN:VEVENT','UID:'+icsEscape(plan.id+'-'+day.date+'-'+s.id)+'@bez-planov.pages.dev','DTSTAMP:'+stamp,'DTSTART:'+asUTC(time),'DTEND:'+asUTC(Math.min(1439,time+Number(s.duration))),'SUMMARY:'+icsEscape(stopName(s)),'LOCATION:'+icsEscape(s.kind==='place'?PLACES[s.id]?.address:s.address||'Москва'),'DESCRIPTION:'+icsEscape('Предварительный план. Проверьте часы работы, стоимость и билеты.'),'END:VEVENT')}
 lines.push('END:VCALENDAR');
 // RFC 5545: fold at 75 UTF-8 octets without splitting a character.
 const folded=lines.map(line=>{let out='',chunk='',bytes=0;for(const char of line){const size=new TextEncoder().encode(char).length;if(bytes+size>75){out+=chunk+'\r\n';chunk=' ';bytes=1}chunk+=char;bytes+=size}return out+chunk}).join('\r\n')+'\r\n';
 downloadText('bez-planov-marshrut.ics',folded,'text/calendar;charset=utf-8');notify('Календарь скачан. На iPhone откройте файл и добавьте события.');
}
async function share(){if(!plan)return;const text=plan.days.map((d,i)=>'День '+(i+1)+' · '+dateLabel(d.date)+'\n'+d.stops.map(s=>s.time+' '+stopName(s)).join('\n')).join('\n\n')+'\n\nБез планов. Цены и расписания нужно проверить.';try{if(navigator.share)await navigator.share({title:'Наш маршрут',text});else{await navigator.clipboard.writeText(text);notify('План скопирован')}}catch(e){if(e.name!=='AbortError')downloadText('nash-marshrut.txt',text,'text/plain;charset=utf-8')}}
async function refreshSession(){
 if(!user||dirty||saving||conflict||!sessionReady||identityChanging)return;
 const accountID=user.id,serial=editSerial;
 try{const data=await api('/api/session');
  if(user?.id!==accountID||editSerial!==serial||dirty||saving||conflict||identityChanging)return;
  if(!data.user){showSync('Вход истёк. Скачайте текущие правки, затем выйдите и войдите снова.','<button class="text-button" data-act="backup">Скачать мои правки</button><button class="text-button" data-act="expired-logout">Выйти</button>');return}
  if(data.revision!==revision){const next=normalState(data.state);protectActive(next);revision=data.revision;workspace=next;draft=normalDraft(workspace.draft);if(!el('account').hidden)renderAccount();if(!el('planner').hidden)fillFields();notify('Кабинет обновлён: есть изменения партнёра')}
 }catch{}
}
async function logout(){
 if(dirty){await syncState();if(dirty){notify('Перед выходом сохраните или скачайте несинхронизированные правки.');return}}
 busyIdentity(true);try{await api('/api/logout',{method:'POST',body:'{}'});try{sessionStorage.removeItem(activeKey());sessionStorage.removeItem(pendingKey())}catch{}user=null;workspace=loadGuest();draft=normalDraft(workspace.draft);plan=null;planBaseline=null;revision=0;conflict=null;dirty=false;el('syncNotice').hidden=true;fillFields();renderAccount();navigate('account');notify('Вы вышли из общего кабинета')}catch{notify('Не удалось выйти. Проверьте соединение и попробуйте снова.')}finally{busyIdentity(false)}
}
function resolveConflict(merge){
 if(!conflict)return;const mine=clone(workspace),latest=normalState(conflict.state);revision=conflict.revision;conflict=null;
 if(merge){const combined=[...latest.plans];for(const p of mine.plans){const same=combined.find(x=>x.id===p.id);if(!same)combined.push(p);else if(JSON.stringify(same)!==JSON.stringify(p))combined.push({...p,id:crypto.randomUUID()})}if(plan&&!combined.some(x=>JSON.stringify(x.days)===JSON.stringify(plan.days)))combined.push({...clone(plan),id:crypto.randomUUID()});if(combined.length>40){downloadText('bez-planov-moya-kopiya.json',JSON.stringify(backupData(),null,2),'application/json');notify('Копия скачана: в кабинете не хватает места для всех версий.');conflict={state:latest,revision};return}if(JSON.stringify(mine.draft)!==JSON.stringify(latest.draft))downloadText('bez-planov-moya-anketa.json',JSON.stringify(backupData(),null,2),'application/json');draft=normalDraft(latest.draft);workspace={...latest,plans:combined,draft:clone(draft),favorites:[...new Set([...latest.favorites,...mine.favorites])]};persist();syncState()}
 else {downloadText('bez-planov-moi-pravki.json',JSON.stringify(backupData(),null,2),'application/json');workspace=latest;draft=normalDraft(workspace.draft);dirty=false;try{sessionStorage.removeItem(pendingKey())}catch{}plan=null;planBaseline=null;try{sessionStorage.removeItem(activeKey())}catch{}el('syncNotice').hidden=true;fillFields();navigate('account');notify('Общие данные открыты. Ваши прежние правки скачаны отдельным файлом.')}
 renderAccount();
}
async function importGuest(){if(!user)return;const guest=loadGuest(),newPlans=guest.plans.filter(p=>!workspace.plans.some(q=>q.id===p.id));if(workspace.plans.length+newPlans.length>40){notify('В общем кабинете не хватает места для переноса всех маршрутов.');return}workspace.plans.push(...clone(newPlans));persist();await syncState();renderAccount();notify(dirty?'Перенос ожидает синхронизации':'Маршруты перенесены в общий кабинет')}
function handleClick(e){
 const button=e.target.closest('[data-act],[data-go]');if(!button)return;if(button.dataset.go){navigate(button.dataset.go);return}
 const a=button.dataset.act,i=Number(button.dataset.index);
 if(a==='rating'){const person=Number(button.dataset.person),k=button.dataset.pref,current=Number(draft.profiles[person].ratings[k]||0),next=current>0?-3:current<0?0:2;if(next)draft.profiles[person].ratings[k]=next;else delete draft.profiles[person].ratings[k];renderTastes();persist()}
 if(a==='remove-event'&&window.confirm('Удалить закреплённое событие «'+(draft.events.find(x=>x.id===button.dataset.id)?.name||'')+'» из анкеты?')){draft.events=draft.events.filter(x=>x.id!==button.dataset.id);renderEvents();reflectFields();renderReview();persist()}
 if(a==='include-events'){const dates=[draft.from,draft.to,...draft.events.map(e=>e.date)].sort();draft.from=dates[0];draft.to=dates[dates.length-1];fillFields();persist()}
 if(a==='swap-menu'){swapIndex=swapIndex===i?null:i;renderDay()}
 if(a==='swap'){try{changePlan(safeSwapStop(plan,dayIndex,i,button.dataset.place,{}),'Замена остановки');notify('Остановка заменена. Исходный маршрут сохранён.')}catch(error){notify(error.message)}}
 if(a==='lock'){const next=clone(plan);next.days[dayIndex].stops[i].locked=!next.days[dayIndex].stops[i].locked;changePlan(next,'Закрепление остановки')}
 if(a==='open-plan'){const p=workspace.plans.find(p=>p.id===button.dataset.id);if(p){plan=clone(p);planBaseline=fingerprint(p);dayIndex=0;swapIndex=null;keepActive();navigate('route')}}
 if(a==='delete-plan'&&window.confirm('Удалить сохранённый маршрут?')){workspace.plans=workspace.plans.filter(p=>p.id!==button.dataset.id);persist();renderAccount()}
 if(a==='retry-sync')syncState();if(a==='merge-conflict')resolveConflict(true);if(a==='load-conflict')resolveConflict(false);if(a==='backup')downloadText('bez-planov-moi-pravki.json',JSON.stringify(backupData(),null,2),'application/json');if(a==='expired-logout')logout();
}
function bind(){
 document.addEventListener('click',handleClick);document.querySelectorAll('.oauth').forEach(link=>link.addEventListener('click',e=>{if(link.getAttribute('aria-disabled')==='true'){e.preventDefault();return}if(!user&&plan&&!workspace.plans.some(p=>p.id===plan.id)){if(workspace.plans.length>=40){e.preventDefault();notify('Сохраните открытый маршрут или освободите место перед входом.');return}workspace.plans.unshift(clone(plan));if(!persist()){e.preventDefault();return}}}));el('planForm').addEventListener('input',fieldChanged);el('planForm').addEventListener('change',fieldChanged);el('planForm').addEventListener('submit',generate);
 el('startPlan').onclick=()=>startNew();el('newPlan').onclick=()=>startNew(true);el('continueGuest').onclick=()=>startNew();el('prevStep').onclick=()=>navigate('planner',Math.max(1,step-1));el('nextStep').onclick=()=>{const error=stepError(step);if(error){showError(error);return}navigate('planner',Math.min(3,step+1))};
 el('addEvent').onclick=addEvent;el('editPlan').onclick=()=>{draft=normalDraft(clone(plan.config));fillFields();persist();navigate('planner',1)};el('savePlan').onclick=()=>savePlan();el('saveCopy').onclick=()=>savePlan(true);el('routeDay').onchange=()=>{dayIndex=Number(el('routeDay').value);swapIndex=null;renderDay()};
 el('rebuildDay').onclick=()=>{try{changePlan(rebuildDay(plan,dayIndex,{}),'Другой вариант дня');notify('Предложили другой вариант. Закреплённые события сохранены.')}catch(e){notify(e.message)}};
 el('undoPlan').onclick=()=>{prepareHistory();const previous=plan.versions.pop();if(!previous)return;plan.days=clone(previous.days);keepActive();renderRoute();notify('Изменение отменено')};el('restoreOriginal').onclick=()=>{const next=clone(plan);next.days=clone(plan.initialDays);changePlan(next,'Возврат к исходному');notify('Исходный маршрут восстановлен')};
 el('exportCalendar').onclick=exportCalendar;el('sharePlan').onclick=share;el('logout').onclick=logout;el('editPreferences').onclick=()=>{fillFields();navigate('planner',2)};el('importGuest').onclick=importGuest;
 window.addEventListener('hashchange',renderLocation);window.addEventListener('focus',refreshSession);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshSession()});setInterval(refreshSession,30000);
 window.addEventListener('beforeunload',e=>{if(user&&dirty){e.preventDefault();e.returnValue=''}});
}
busyIdentity(true);bind();fillFields();renderAccount();renderLocation();initAccount().catch(()=>{sessionReady=true;busyIdentity(false);notify('Вход временно недоступен. Можно продолжить без регистрации.')});
