'use strict';
/* One flow, two profiles. OAuth tokens and credentials never enter this file. */
const el=id=>document.getElementById(id);
const esc=escapeHTML;
const ARROW='<svg class="arrow-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const WORKSPACE_KEY='bezPlanovWorkspaceV1';
const TOP_PREFS=['food','walk','art','history','nature','romance','activity','unusual','views','cinema'];
let user=null,revision=0,workspace=loadGuest(),draft=normalDraft(workspace.draft),plan=null,dayIndex=0,step=1,swapIndex=null;
let syncTimer=null,saving=false,dirty=false,editSerial=0,conflict=null,sessionReady=false,toastTimer=null;
let authConfig={providers:{yandex:false,mailru:false,vk:false}};
let authConfigState='loading',sessionExpired=false;
const uiIcon=key=>'<svg class="ui-icon" aria-hidden="true"><use href="/assets/icons.svg#'+key+'"></use></svg>';
const IDEAS=[
 {id:'romance',title:'Свидание с искрой',tag:'Для особенного вечера',image:'dinner',tags:['romantic'],text:'Красивый ужин, городские огни и время поговорить.',prompt:'романтическую атмосферу, красивый ужин и прогулку'},
 {id:'coffee',title:'Кофе и целый день впереди',tag:'Без спешки',image:'cafe',tags:['cozy','outdoor'],text:'Маленькие кофейни, любимые разговоры и новый район.',prompt:'кофе, уютные места и неспешную прогулку'},
 {id:'culture',title:'Впечатления на двоих',tag:'Открыть что-то новое',image:'culture',tags:['culture'],text:'Искусство, неожиданные открытия и общий повод удивиться.',prompt:'музеи, искусство и новые впечатления'},
 {id:'sunset',title:'Поймать свой закат',tag:'Больше города',image:'picnic',tags:['romantic','outdoor'],text:'Вода, красивые виды и вечер, который хочется запомнить.',prompt:'прогулку у воды, красивые виды и время вдвоём'},
 {id:'stars',title:'Чуть ближе к звёздам',tag:'Смотреть шире',image:'planetarium',tags:['culture','romantic'],text:'Космос, необычные впечатления и ощущение маленького приключения.',prompt:'планетарий, науку и необычные впечатления'},
 {id:'slow',title:'Выдохнуть. Вместе.',tag:'Только ваш ритм',image:'walk',tags:['cozy','outdoor'],text:'Зелёные места, спокойный маршрут и побольше пауз.',prompt:'парки, природу и спокойный отдых'},
 {id:'cinema',title:'Город как в кино',tag:'Вечерняя история',image:'cinema',tags:['culture','romantic'],text:'Культурный вечер и улицы, по которым приятно идти вдвоём.',prompt:'кино, историю и атмосферные прогулки'},
 {id:'weekend',title:'Маленькое путешествие',tag:'На день или выходные',image:'our-route',tags:['outdoor','cozy'],text:'Знакомая Москва с нового ракурса. В удобном вам темпе.',prompt:'городскую архитектуру, прогулки и новые районы'}
];
const AREA_PHOTOS={center:'culture',zamos:'cafe',gorky:'picnic',arbat:'walk',patriki:'dinner',city:'our-tastes',vdnh:'planetarium',kolomenskoye:'our-route'};
function moodPhoto(cfg,area){return '/assets/dates/'+(IDEAS.find(x=>x.id===cfg?.themeId)?.image||AREA_PHOTOS[area]||'our-route')+'.webp'}
let planBaseline=null,identityChanging=false,identityEpoch=0;
function fingerprint(p){return p?JSON.stringify({config:p.config,days:p.days}):null}
function backupData(){return {workspace:clone(workspace),activePlan:plan?clone(plan):null}}
function busyIdentity(on){if(on){identityEpoch++;saving=false;clearTimeout(syncTimer)}identityChanging=on;document.querySelectorAll('.site-header,.site-footer,#mobileNav').forEach(node=>{node.inert=on;node.setAttribute('aria-busy',String(on))});document.querySelector('main').inert=on;el('accountOpen').disabled=on;el('startPlan').disabled=on;document.querySelector('main').setAttribute('aria-busy',String(on))}
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
function keepActive(){try{if(plan)sessionStorage.setItem(activeKey(),JSON.stringify({plan,baseline:planBaseline}));return true}catch{notify('Не удалось запомнить открытый маршрут. Сохраните его в кабинете.');return false}}
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
 if(!user||!dirty||saving||conflict||identityChanging)return;
 if(!sessionReady)return;
 saving=true;const accountID=user.id,epoch=identityEpoch,recoveryKey=pendingKey(),serial=editSerial,body=JSON.stringify({state:workspace,revision});
 try{const data=await api('/api/state',{method:'PUT',body});if(user?.id!==accountID||identityChanging||epoch!==identityEpoch)return;revision=data.revision;if(serial===editSerial){dirty=false;try{sessionStorage.removeItem(recoveryKey)}catch{}el('syncNotice').hidden=true;el('draftStatus').textContent='Сохранено в общем кабинете';el('accountSync').textContent='Сохранено. Изменения доступны вам обоим.'}}
 catch(e){
  if(user?.id!==accountID||identityChanging||epoch!==identityEpoch)return;
  if(e.status===401)sessionExpired=true;
  if(e.status===409){conflict={state:normalState(e.data.state),revision:e.data.revision};showSync('Партнёр обновил кабинет. Ваши правки остаются в открытом окне. Выберите, как продолжить.','<button class="text-button" data-act="merge-conflict">Сохранить мои маршруты отдельно</button><button class="text-button" data-act="load-conflict">Открыть изменения партнёра</button><button class="text-button" data-act="backup">Скачать мои правки</button>')}
  else {showSync(e.status===401?'Вход истёк. Скачайте ваши правки и войдите снова.':'Не удалось синхронизировать кабинет. Ваши правки остаются в открытом окне — скачайте резервную копию.',(e.status===401?'<button class="text-button" data-act="relogin">Сохранить правки и войти снова</button>':'<button class="text-button" data-act="retry-sync">Повторить</button>')+'<button class="text-button" data-act="backup">Скачать мои правки</button>');el('draftStatus').textContent='Ожидает синхронизации';el('accountSync').textContent='Есть несинхронизированные изменения.'}
 }finally{if(epoch===identityEpoch){saving=false;if(user?.id===accountID&&!identityChanging&&dirty&&!conflict&&serial!==editSerial)syncTimer=setTimeout(syncState,300)}}
}
async function initAccount(){
 const results=await Promise.allSettled([api('/api/auth/config'),api('/api/session')]);
 if(results[0].status==='fulfilled'){authConfig=results[0].value;authConfigState='ready'}else authConfigState='unavailable';
 if(results[1].status==='fulfilled'&&results[1].value.user){
  const data=results[1].value;user=data.user;sessionExpired=false;revision=data.revision;workspace=normalState(data.state);draft=normalDraft(workspace.draft);
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
 const hash=location.hash.slice(1),match=hash.match(/^plan\/([1234])$/);let page=match?'planner':['home','ideas','route','account'].includes(hash)?hash:'home';
 if(page==='route'&&!plan){if(!sessionReady)return;startNew();return}
 document.querySelectorAll('main>.view').forEach(v=>v.hidden=v.id!==page);document.body.dataset.screen=page;
 if(page==='planner'){setStep(Number(match[1]));fillFields()}
 if(page==='route')renderRoute();if(page==='account')renderAccount();
 document.querySelectorAll('[data-nav]').forEach(a=>a.setAttribute('aria-current',a.dataset.nav===(page==='planner'?'route':page)?'page':'false'));
 el('accountOpen').setAttribute('aria-current',page==='account'?'page':'false');renderResume();window.scrollTo({top:0,behavior:'auto'});
}
const STEPS=[null,
 ['Когда ваш день?','Выберите даты и комфортный бюджет на двоих.'],
 ['Начнём с ваших желаний','Что радует именно вас? Достаточно хотя бы одного интереса.'],
 ['А что нравится партнёру?','Пусть у каждого будет свой голос. Совпадать во всём не обязательно.'],
 ['Сделаем день удобным','Остались время, темп и ваши уже купленные билеты.']
];
function setStep(n){
 step=n;document.querySelectorAll('.flow-step').forEach(s=>s.hidden=Number(s.dataset.step)!==n);
 document.querySelectorAll('[data-progress]').forEach(s=>{s.setAttribute('aria-current',Number(s.dataset.progress)===n?'step':'false');s.classList.toggle('complete',Number(s.dataset.progress)<n)});
 el('flowTitle').textContent=STEPS[n][0];el('flowDescription').textContent=STEPS[n][1];el('flowCount').textContent='Шаг '+n+' из 4';
 el('prevStep').hidden=n===1;el('nextStep').hidden=n===4;el('generatePlan').hidden=n!==4;el('wizardError').textContent='';
 el('stepHint').textContent=['','Дальше — ваши вкусы','Дальше — взгляд партнёра','Дальше — детали дня','Впереди ваш маршрут'][n];
 el('flowArt').src='/assets/dates/'+['','our-route','cafe','our-tastes','walk'][n]+'.webp';
 el('flowArtTitle').innerHTML=['','Начинается<br>ваша история.','Маленькие радости.<br>Ваши, настоящие.','Два разных вкуса.<br>Один общий день.','Не спешить.<br>Быть вместе.'][n];
 el('flowArtNote').textContent=['','Один вечер или несколько дней — найдём ваш формат.','Выбирайте то, что действительно хочется. Нейтральные пункты можно пропустить.','Учитываем интересы обоих. Запрет любого из вас важен для общего плана.','Включим ваши события и оставим место для пауз.'][n];
 if(n===4)renderReview();renderTheme();
}
function goToStep(target){
 if(target>step)for(let i=1;i<target;i++){const error=stepError(i);if(error){navigate('planner',i);setTimeout(()=>showError(error),0);return}}
 navigate('planner',target);
}
function renderResume(){const x=el('resumePlanBanner');x.hidden=!plan;if(plan)x.innerHTML='<p>Ваш '+(plan.days.length===1?'день':'маршрут')+' на '+esc(dateLabel(plan.config.from))+' уже собран.</p><button type="button" class="text-button" data-go="route">Вернуться к маршруту →</button>'}
function renderTheme(){const theme=IDEAS.find(x=>x.id===draft.themeId);el('themeBadge').hidden=!theme;if(theme)el('themeBadge').innerHTML=uiIcon('spark')+'<span>Начали с настроения «'+esc(theme.title)+'». Дальше важны ответы каждого.</span><button type="button" class="text-button" data-act="clear-theme">Убрать</button>'}
function ideaCards(list){return list.map(x=>'<article class="idea-card" data-tags="'+x.tags.join(' ')+'" data-search="'+esc((x.title+' '+x.text+' '+x.prompt).toLowerCase())+'"><button type="button" class="idea-button" data-act="choose-idea" data-idea="'+x.id+'" aria-label="Выбрать настроение: '+esc(x.title)+'"><img class="idea-photo" src="/assets/dates/'+x.image+'.webp" width="1672" height="941" loading="lazy" alt="Иллюстрация настроения: '+esc(x.title)+'"><span class="idea-info"><span class="idea-tag">'+esc(x.tag)+'</span><strong>'+esc(x.title)+'</strong><small>'+esc(x.text)+'</small></span></button></article>').join('')}
function initDesign(){
 el('homeIdeas').innerHTML=ideaCards(IDEAS.slice(0,4));el('ideasGrid').innerHTML=ideaCards(IDEAS);
 window.BPExperience?.mountPreviewMap(el('exampleMap'));
 el('ideaFilters').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;el('ideaFilters').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));filterIdeas()});
 el('ideaSearch').addEventListener('input',filterIdeas);
 if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-inview');observer.unobserve(entry.target)}}),{threshold:.08});document.querySelectorAll('[data-reveal]').forEach(x=>observer.observe(x))}
}
function filterIdeas(){const filter=el('ideaFilters').querySelector('[aria-pressed=true]')?.dataset.filter||'all',needle=el('ideaSearch').value.trim().toLowerCase();let count=0;el('ideasGrid').querySelectorAll('.idea-card').forEach(card=>{const on=(filter==='all'||card.dataset.tags.split(' ').includes(filter))&&(!needle||card.dataset.search.includes(needle));card.hidden=!on;if(on)count++});el('ideasEmpty').hidden=count>0}
function chooseIdea(id){const theme=IDEAS.find(x=>x.id===id);if(!theme)return;if(!draft.themeId)draft.themeBaseText=draft.perfectDay;draft.themeId=id;draft.perfectDay=[draft.themeBaseText, 'Хотим '+theme.prompt].filter(Boolean).join('; ');fillFields();persist();navigate('planner',1);notify('Настроение выбрано. Теперь учтём вас обоих.')}

const SIMPLE_FIELDS=['dateStart','dateEnd','budgetAmount','budgetScope','journeyMode','transportReserve','hotelReserve','overnightStay','hotelAddress','dayStart','dayEnd','pace','transport','startLocation','walkingLevel','venuePreference','foodNeeds','alreadyVisited','dreamPlaces','stepFree'];
const FIELD_KEYS={dateStart:'from',dateEnd:'to'};
const PROFILE_FIELDS={nameOne:[0,'name'],likesOne:[0,'likes'],avoidOne:[0,'avoid'],nameTwo:[1,'name'],likesTwo:[1,'likes'],avoidTwo:[1,'avoid']};
function fillFields(){
 for(const id of SIMPLE_FIELDS){const x=el(id),value=draft[FIELD_KEYS[id]||id];if(x.type==='checkbox')x.checked=!!value;else x.value=value??''}
 for(const [id,[i,key]]of Object.entries(PROFILE_FIELDS))el(id).value=draft.profiles[i][key]||'';
 el('budgetAll').checked=draft.budgetCovers==='all';el('eventDate').value=el('eventDate').value||draft.from;renderTastes();reflectFields();renderEvents();
 el('draftStatus').textContent=user?(dirty?'Ожидает синхронизации':'Общий черновик пары'):'Черновик на этом устройстве';
}
function renderTastes(){
 const icons={food:'food',walk:'route',art:'museum',history:'museum',nature:'leaf',romance:'heart',activity:'ticket',unusual:'spark',views:'sun',cinema:'ticket',coffee:'coffee',architecture:'museum',science:'spark',water:'route',shopping:'gift',photography:'camera'};
 [0,1].forEach(i=>{const selected=Object.keys(draft.profiles[i].ratings),keys=[...new Set([...TOP_PREFS,...selected])];
 el(i?'tasteTwo':'tasteOne').innerHTML=keys.filter(k=>PREF_BY_KEY[k]).map(k=>{const rating=Number(draft.profiles[i].ratings[k]||0),p=PREF_BY_KEY[k];return '<div class="taste-row"><div class="taste-title">'+uiIcon(icons[k]||'spark')+'<span>'+esc(p.title)+'</span></div><div class="taste-controls" role="group" aria-label="'+esc(p.title)+'">'+[[2,'Нравится'],[-3,'Не предлагать']].map(([v,label])=>'<button type="button" class="taste '+(rating===v?(v>0?'liked':'avoided'):'')+'" data-act="rating" data-person="'+i+'" data-pref="'+k+'" data-rating="'+v+'" aria-label="'+esc(p.title+': '+label)+'" aria-pressed="'+(rating===v)+'">'+label+'</button>').join('')+'</div></div>'}).join('');
 })
}

function outsideEvents(){return draft.events.filter(e=>e.date<draft.from||e.date>draft.to)}
function reflectFields(){
 const dates=datesBetween(draft.from,draft.to),count=dates.length;el('dateStart').min=localISO(new Date());el('dateEnd').min=draft.from;el('multiDayOptions').hidden=count<2;
 el('rangeInfo').textContent=count&&count<=31?count+' '+dayWord(count)+' · '+dateLabel(draft.from)+(count>1?' — '+dateLabel(draft.to):''):'Выберите период от 1 до 31 дня.';
 el('reserveFields').hidden=draft.budgetCovers!=='all';el('hotelFields').hidden=!draft.overnightStay;el('hotelBudgetLabel').hidden=draft.budgetCovers!=='all';
 el('eventDate').min=draft.from;el('eventDate').max=draft.to;el('paidBudgetField').hidden=!el('eventPaid').checked;
 const outside=outsideEvents();el('dateConflict').hidden=!outside.length;
 el('dateConflict').innerHTML=outside.length?'<strong>У вас есть планы за пределами новых дат</strong><p>Мы сохранили события. Добавьте их даты в период или уберите только запись из этого маршрута.</p>'+outside.map(e=>'<div class="event-row"><div><strong>'+esc(e.name)+'</strong><p>'+esc(dateLabel(e.date))+(e.paid?' · уже оплачено':'')+'</p></div><button type="button" data-act="remove-event" data-id="'+esc(e.id)+'">Убрать из плана</button></div>').join('')+'<button type="button" class="text-button" data-act="include-events">Включить даты событий</button>':'';
}
function fieldChanged(e){
 const x=e.target;if(PROFILE_FIELDS[x.id]){const [i,key]=PROFILE_FIELDS[x.id];draft.profiles[i][key]=x.value}
 else if(SIMPLE_FIELDS.includes(x.id)){const key=FIELD_KEYS[x.id]||x.id;draft[key]=x.type==='checkbox'?x.checked:x.type==='number'?Number(x.value):x.value;if(x.id==='dateStart'&&draft.to<draft.from){draft.to=draft.from;el('dateEnd').value=draft.to}}
 else if(x.id==='budgetAll')draft.budgetCovers=x.checked?'all':'activities';
 else if(x.id==='eventPaid'){reflectFields();return}else return;
 reflectFields();persist();if(step===4)renderReview();
}
function stepError(n){
 if(n===1){const ds=datesBetween(draft.from,draft.to);if(!ds.length||ds.length>31)return 'Выберите правильные даты: от одного до 31 дня.';if(draft.from<localISO(new Date()))return 'Выберите сегодняшнюю или будущую дату.';if(outsideEvents().length)return 'События сохранены, но находятся вне периода. Включите их даты или уберите запись из этого плана — варианты показаны рядом с датами.';if(!Number.isFinite(draft.budgetAmount)||draft.budgetAmount<500||draft.budgetAmount>10000000)return 'Укажите бюджет от 500 до 10 000 000 ₽.';if(draft.budgetCovers==='all'&&(!Number.isFinite(draft.transportReserve)||draft.transportReserve<0||!Number.isFinite(draft.hotelReserve)||draft.hotelReserve<0))return 'Резервы на дорогу и ночёвку не могут быть отрицательными.'}
 if(n===2||n===3){const i=n-2,p=draft.profiles[i];if(!Object.values(p.ratings).some(v=>Number(v)>0)&&(p.likes+' '+p.dream).trim().length<10)return (i?'Партнёру':'Вам')+' нужно выбрать хотя бы один интерес или рассказать о желаниях словами.'}
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
 const signals=textSignals(draft),positive=signals.positive.map(k=>PREF_BY_KEY[k]?.title).filter(Boolean),restrictions=[...new Set([...(signals.restrictionLabels||[]),...draft.profiles.flatMap(p=>Object.keys(p.ratings).filter(k=>p.ratings[k]<0).map(k=>PREF_BY_KEY[k]?.title)).filter(Boolean)])];
 el('review').innerHTML='<strong>Давайте соберём это в ваш день</strong><p>'+esc(draft.profiles.map((p,i)=>p.name||(i?'Партнёр':'Вы')).join(' и '))+' · '+esc(el('rangeInfo').textContent)+'</p><p>Ваш бюджет: '+esc(formatMoney(draft.budgetAmount))+(draft.budgetScope==='daily'?' в день':' на весь период')+' на двоих. Пробный подбор — без оплаты.</p>'+(draft.events.length?'<p>Закреплённых событий: '+draft.events.length+'. Сохраним их время.</p>':'')+'<details><summary>Как учтём ваши пожелания</summary>'+(positive.length?'<p>Из свободных ответов распознали: '+esc(positive.join(', '))+'.</p>':'<p>Основой станут ваши выбранные интересы.</p>')+(restrictions.length?'<p>Не предлагаем: '+esc(restrictions.join(', '))+'.</p>':'')+'<p>Неизвестные пожелания останутся заметками. Проверьте результат: отдельные слова могут быть поняты неточно.</p></details>';
}

function generate(e){
 e.preventDefault();if(step<4){const error=stepError(step);if(error){showError(error);return}navigate('planner',step+1);return}for(const n of [1,2,3]){const error=stepError(n);if(error){navigate('planner',n);setTimeout(()=>showError(error),0);return}}
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
function renderDayContent(){
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
 const total=sum.total;el('dayInfo').innerHTML='<h3>Расходы вашего дня</h3><p class="cost-total">'+esc(formatMoney(total))+'</p><p class="field-hint">Ориентир, не предложение заведения</p><ul class="cost-list"><li><span>Места</span><span>'+esc(formatMoney(sum.place))+'</span></li><li><span>Закреплённые билеты</span><span>'+esc(formatMoney(sum.fixed))+'</span></li><li><span>Питание и паузы</span><span>'+esc(formatMoney(sum.breaks||0))+'</span></li><li><span>Дорога и проживание</span><span>'+esc(formatMoney(sum.reserved))+'</span></li><li><strong>Выделено на день</strong><strong>'+esc(formatMoney(day.limit))+'</strong></li></ul><a class="button primary" href="'+esc(dayMap(day,cfg))+'" target="_blank" rel="noopener noreferrer">Открыть путь в картах '+ARROW+'</a>'+(cfg.foodNeeds?'<p class="field-hint">Ваши пожелания к питанию: '+esc(cfg.foodNeeds)+'. Меню и аллергены проверьте отдельно.</p>':'')+(cfg.stepFree?'<p class="field-hint">Доступность входов без ступеней не проверена.</p>':'')+(cfg.overnightStay&&dayIndex<plan.days.length-1?'<p class="field-hint">Ночёвка: '+esc(cfg.hotelAddress||'адрес ещё не указан')+'. Жильё не забронировано.</p>':'')+'<p class="field-hint">Время в пути приблизительное. Часы работы, очереди и билеты не проверены онлайн.</p>';
}
function renderDay(){
 renderDayContent();const day=plan.days[dayIndex];
 el('routeCover').src=moodPhoto(plan.config,day.areaId);
 el('timeline').querySelectorAll('.stop').forEach((card,index)=>{const stop=day.stops[index];if(stop?.kind!=='place'||!PLACES[stop.id])return;
 const tools=card.querySelector('.stop-tools');if(!tools)return;
 const reason=document.createElement('p');reason.className='stop-reason';reason.innerHTML=uiIcon('check')+esc(personEvidence(PLACES[stop.id],plan.config,plan.signals||textSignals(plan.config)));tools.before(reason);
 const b=document.createElement('button');b.type='button';b.dataset.act='favorite';b.dataset.place=stop.id;b.setAttribute('aria-pressed',String(workspace.favorites.includes(stop.id)));b.innerHTML=uiIcon('heart')+(workspace.favorites.includes(stop.id)?'В избранном':'Сохранить место');tools.append(b);
 });
 window.BPExperience?.mountMap(el('routeMap'),day,plan.config,{cardsRoot:el('timeline')});
}
async function savePlan(asCopy=false){
 if(!plan)return;protectActive(workspace);prepareHistory();if(asCopy){plan=clone(plan);plan.id=crypto.randomUUID();plan.createdAt=new Date().toISOString()}
 if(workspace.plans.length>=40&&!workspace.plans.some(p=>p.id===plan.id)){notify('В кабинете уже 40 маршрутов. Удалите ненужный или скачайте план в календарь.');return}
 const previousPlans=workspace.plans,previousBaseline=planBaseline;workspace.plans=[clone(plan),...workspace.plans.filter(p=>p.id!==plan.id)];planBaseline=fingerprint(plan);const ok=persist();if(!ok){workspace.plans=previousPlans;planBaseline=previousBaseline}keepActive();renderRoute();renderAccount();
 if(!ok)return;if(user){await syncState();notify(dirty?'Маршрут ожидает синхронизации. Пока он в открытом окне — скачайте копию правок.':'Маршрут сохранён в общем кабинете')}else notify('Маршрут сохранён на этом устройстве. Исходная версия тоже сохранена.');
}
function renderAccount(){
 el('accountGuest').hidden=!!user;el('accountMember').hidden=!user;
 el('accountTitle').textContent='Кабинет пары';
 el('accountLead').textContent=user?'Маршруты, любимые места и предпочтения — всё в одном кабинете.':'Сначала можно без входа: ваши сохранённые дни останутся на этом устройстве.';
 for(const [id,key]of [['loginYandex','yandex'],['loginMailru','mailru'],['loginVk','vk']]){const enabled=authConfigState==='ready'&&!!authConfig.providers?.[key];el(id).setAttribute('aria-disabled',String(!enabled));el(id).tabIndex=enabled?0:-1}
 el('authStatus').textContent=authConfigState==='unavailable'?'Не удалось проверить доступность входа. Повторите проверку или пока продолжите без регистрации.':authConfigState==='loading'?'Проверяем доступность входа…':Object.values(authConfig.providers||{}).some(Boolean)?'Для общего кабинета на двух устройствах выбирайте один и тот же аккаунт одного сервиса.':'Общий вход пока готовится к запуску. Уже можно попробовать маршрут и сохранить его на этом устройстве.';
 el('retryAuth').hidden=authConfigState!=='unavailable';
 if(user){el('accountEmail').textContent=user.email||user.name||(user.provider==='vk'?'Аккаунт ВКонтакте':'Общий кабинет');el('guestImport').hidden=!loadGuest().plans.length}
 el('pairNames').textContent=draft.profiles.map((p,i)=>p.name||(i?'Партнёр':'Вы')).join(' и ');
 el('savedNote').textContent=user?'Общие планы, доступные вам обоим.':'Без входа эти планы доступны только в этом браузере.';
 el('savedPlans').innerHTML=workspace.plans.length?workspace.plans.map(p=>'<article class="saved-plan"><img class="saved-plan-image" src="'+moodPhoto(p.config,p.days[0].areaId)+'" width="1672" height="941" loading="lazy" alt="Иллюстрация настроения маршрута"><div class="saved-plan-body"><p class="eyebrow">'+p.days.length+' '+dayWord(p.days.length)+' · '+(p.initialDays?'Исходник сохранён':'Сохранённый план')+'</p><h3>'+esc(planName(p))+'</h3><p>'+esc(dateLabel(p.config.from))+(p.config.to!==p.config.from?' — '+esc(dateLabel(p.config.to)):'')+'</p><p>Расходы на двоих: ≈ '+esc(formatMoney(totalSpend(p)))+'</p><div class="saved-actions"><button type="button" class="button secondary" data-act="open-plan" data-id="'+esc(p.id)+'">Открыть маршрут '+ARROW+'</button><button type="button" class="text-button" data-act="delete-plan" data-id="'+esc(p.id)+'">Удалить</button></div></div></article>').join(''):'<div class="empty-plans">'+uiIcon('book')+'<h3>У вашей следующей истории пока нет плана</h3><p>Соберите день под вас двоих и сохраните его здесь. К нему можно вернуться и всё поменять.</p><button type="button" class="button primary" data-act="begin">Собрать первый маршрут '+ARROW+'</button></div>';
 renderFavorites();
}
function renderFavorites(){el('favoritePlaces').innerHTML=workspace.favorites.length?workspace.favorites.map(id=>{const p=PLACES[id];return '<article class="favorite-place"><span>'+esc(TAGS[p.tags[0]]||'Место для двоих')+'</span><h3>'+esc(p.name)+'</h3><p>'+esc(p.address)+'</p><div class="favorite-actions"><button class="text-button" type="button" data-act="wish-place" data-place="'+id+'">Хочу в маршрут →</button><button class="text-button" type="button" data-act="favorite" data-place="'+id+'" aria-label="Убрать '+esc(p.name)+' из избранного">Убрать</button></div></article>'}).join(''):'<div class="empty-plans">'+uiIcon('heart')+'<h3>Места, к которым хочется вернуться</h3><p>Нажмите «Сохранить место» в маршруте. Так идеи на следующий день останутся под рукой.</p></div>'}
async function retryAuth(){authConfigState='loading';renderAccount();try{authConfig=await api('/api/auth/config');authConfigState='ready'}catch{authConfigState='unavailable'}renderAccount()}

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
 const accountID=user.id,epoch=identityEpoch,serial=editSerial;
 try{const data=await api('/api/session');
  if(user?.id!==accountID||epoch!==identityEpoch||editSerial!==serial||dirty||saving||conflict||identityChanging)return;
  if(!data.user){sessionExpired=true;showSync('Вход истёк. Скачайте текущие правки, затем выйдите и войдите снова.','<button class="text-button" data-act="backup">Скачать мои правки</button><button class="text-button" data-act="relogin">Войти снова</button>');return}
  if(data.revision!==revision){const next=normalState(data.state);protectActive(next);revision=data.revision;workspace=next;draft=normalDraft(workspace.draft);if(!el('account').hidden)renderAccount();if(!el('planner').hidden)fillFields();notify('Кабинет обновлён: есть изменения партнёра')}
 }catch{}
}
async function logout(){
 if(sessionExpired){await relogin();return}
 if(dirty){await syncState();if(dirty){notify('Перед выходом сохраните или скачайте несинхронизированные правки.');return}}
 busyIdentity(true);try{await api('/api/logout',{method:'POST',body:'{}'});try{sessionStorage.removeItem(activeKey());sessionStorage.removeItem(pendingKey())}catch{}user=null;workspace=loadGuest();draft=normalDraft(workspace.draft);plan=null;planBaseline=null;revision=0;conflict=null;dirty=false;el('syncNotice').hidden=true;fillFields();renderAccount();navigate('account');notify('Вы вышли из общего кабинета')}catch{notify('Не удалось выйти. Проверьте соединение и попробуйте снова.')}finally{busyIdentity(false)}
}
async function relogin(){
 clearTimeout(syncTimer);
 // Keep private recovery data under the previous account ID; never import it into a guest/other account.
 if(!user){navigate('account');return}
 let downloadedBackup=false;try{sessionStorage.setItem(pendingKey(),JSON.stringify(workspace));if(!keepActive())throw new Error('Active route backup unavailable')}catch{downloadText('bez-planov-moi-pravki.json',JSON.stringify(backupData(),null,2),'application/json');downloadedBackup=true}
 busyIdentity(true);try{await api('/api/logout',{method:'POST',body:'{}'});user=null;workspace=loadGuest();draft=normalDraft(workspace.draft);plan=null;planBaseline=null;revision=0;dirty=false;conflict=null;sessionExpired=false;el('syncNotice').hidden=true;fillFields();renderAccount();navigate('account');notify(downloadedBackup?'Резервная копия правок скачана. Теперь войдите в свой аккаунт.':'Войдите в тот же аккаунт — восстановим ваши несинхронизированные правки.')}catch{notify('Не удалось открыть повторный вход. Скачайте копию правок и попробуйте снова.')}finally{busyIdentity(false)}
}
function resolveConflict(merge){
 if(!conflict)return;const mine=clone(workspace),latest=normalState(conflict.state);revision=conflict.revision;conflict=null;
 if(merge){const combined=[...latest.plans];for(const p of mine.plans){const same=combined.find(x=>x.id===p.id);if(!same)combined.push(p);else if(JSON.stringify(same)!==JSON.stringify(p))combined.push({...p,id:crypto.randomUUID()})}if(plan&&!combined.some(x=>JSON.stringify(x.days)===JSON.stringify(plan.days)))combined.push({...clone(plan),id:crypto.randomUUID()});if(combined.length>40){downloadText('bez-planov-moya-kopiya.json',JSON.stringify(backupData(),null,2),'application/json');notify('Копия скачана: в кабинете не хватает места для всех версий.');conflict={state:latest,revision};return}if(JSON.stringify(mine.draft)!==JSON.stringify(latest.draft))downloadText('bez-planov-moya-anketa.json',JSON.stringify(backupData(),null,2),'application/json');draft=normalDraft(latest.draft);workspace={...latest,plans:combined,draft:clone(draft),favorites:[...new Set([...latest.favorites,...mine.favorites])]};persist();syncState()}
 else {downloadText('bez-planov-moi-pravki.json',JSON.stringify(backupData(),null,2),'application/json');workspace=latest;draft=normalDraft(workspace.draft);dirty=false;try{sessionStorage.removeItem(pendingKey())}catch{}plan=null;planBaseline=null;try{sessionStorage.removeItem(activeKey())}catch{}el('syncNotice').hidden=true;fillFields();navigate('account');notify('Общие данные открыты. Ваши прежние правки скачаны отдельным файлом.')}
 renderAccount();
}
async function importGuest(){if(!user)return;const guest=loadGuest(),newPlans=guest.plans.filter(p=>!workspace.plans.some(q=>q.id===p.id));if(workspace.plans.length+newPlans.length>40){notify('В общем кабинете не хватает места для переноса всех маршрутов.');return}workspace.plans.push(...clone(newPlans));persist();await syncState();renderAccount();notify(dirty?'Перенос ожидает синхронизации':'Маршруты перенесены в общий кабинет')}
function handleClick(e){
 if(identityChanging){e.preventDefault();return}
 const nav=e.target.closest('[data-nav="route"]');if(nav&&!plan){e.preventDefault();startNew();return}
 const button=e.target.closest('[data-act],[data-go]');if(!button)return;if(button.dataset.go){navigate(button.dataset.go);return}
 const a=button.dataset.act,i=Number(button.dataset.index);
 if(a==='begin'){startNew();return}
 if(a==='go-step'){goToStep(Number(button.dataset.step));return}
 if(a==='show-example'||a==='show-faq'){navigate('home');setTimeout(()=>el(a==='show-example'?'exampleSection':'faqSection').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'}),30);return}
 if(a==='choose-idea'){chooseIdea(button.dataset.idea);return}
 if(a==='clear-theme'){draft.perfectDay=draft.themeBaseText||'';delete draft.themeId;delete draft.themeBaseText;persist();renderTheme();return}
 if(a==='rating'){const person=Number(button.dataset.person),k=button.dataset.pref,v=Number(button.dataset.rating),next=Number(draft.profiles[person].ratings[k]||0)===v?0:v;if(next)draft.profiles[person].ratings[k]=next;else delete draft.profiles[person].ratings[k];renderTastes();persist();document.querySelector('[data-person="'+person+'"][data-pref="'+k+'"][data-rating="'+v+'"]').focus({preventScroll:true})}
 if(a==='remove-event'){const event=draft.events.find(x=>x.id===button.dataset.id);if(event&&window.confirm('Убрать «'+event.name+'» только из этого плана? '+(event.paid?'Событие уже оплачено. ':'')+'Бронь и оплата у организатора сохранятся.')){draft.events=draft.events.filter(x=>x.id!==button.dataset.id);renderEvents();reflectFields();renderReview();persist()}}
 if(a==='include-events'){const dates=[draft.from,draft.to,...draft.events.map(e=>e.date)].sort();draft.from=dates[0];draft.to=dates[dates.length-1];fillFields();persist()}
 if(a==='swap-menu'){swapIndex=swapIndex===i?null:i;renderDay()}
 if(a==='swap'){try{changePlan(safeSwapStop(plan,dayIndex,i,button.dataset.place,{}),'Замена остановки');notify('Остановка заменена. Исходный маршрут сохранён.')}catch(error){notify(error.message)}}
 if(a==='lock'){const next=clone(plan);next.days[dayIndex].stops[i].locked=!next.days[dayIndex].stops[i].locked;changePlan(next,'Закрепление остановки')}
 if(a==='favorite'){const id=button.dataset.place;if(!PLACES[id])return;const before=workspace.favorites.slice();if(workspace.favorites.includes(id))workspace.favorites=workspace.favorites.filter(x=>x!==id);else if(workspace.favorites.length<150)workspace.favorites.push(id);else{notify('В избранном уже 150 мест. Уберите ненужное, чтобы добавить новое.');return}if(!persist()){workspace.favorites=before;if(!el('route').hidden)renderDay();if(!el('account').hidden)renderAccount();return}if(!el('route').hidden)renderDay();if(!el('account').hidden)renderAccount();notify(workspace.favorites.includes(id)?'Место сохранено для следующего раза':'Место убрано из избранного')}
 if(a==='wish-place'){const place=PLACES[button.dataset.place];if(!place)return;if(!mentionedPlaceIds(draft.dreamPlaces).includes(place.id))draft.dreamPlaces=cleanText([draft.dreamPlaces,place.name].filter(Boolean).join(', '),650);fillFields();persist();navigate('planner',1);notify('Место добавлено в пожелания. Подберём день с учётом вас обоих.')}
 if(a==='open-plan'){const p=workspace.plans.find(p=>p.id===button.dataset.id);if(p){plan=clone(p);planBaseline=fingerprint(p);dayIndex=0;swapIndex=null;keepActive();navigate('route')}}
 if(a==='delete-plan'&&window.confirm('Удалить сохранённый маршрут с этого списка? Это не отменяет ваши бронирования.')){const before=workspace.plans;workspace.plans=workspace.plans.filter(p=>p.id!==button.dataset.id);if(!persist())workspace.plans=before;renderAccount()}
 if(a==='retry-auth')retryAuth();if(a==='retry-sync')syncState();if(a==='merge-conflict')resolveConflict(true);if(a==='load-conflict')resolveConflict(false);if(a==='backup')downloadText('bez-planov-moi-pravki.json',JSON.stringify(backupData(),null,2),'application/json');if(a==='expired-logout')logout();if(a==='relogin')relogin();
}

function updateViewport(){
 const viewport=window.visualViewport;
 const textInput=document.activeElement?.matches('input:not([type=checkbox]),textarea,select');
 const reduced=viewport?window.innerHeight-viewport.height:0;
 const zoomed=viewport&&viewport.scale>1.15;
 document.documentElement.classList.toggle('keyboard-open',!!textInput&&!zoomed&&(reduced>120||window.innerHeight<360));
}
function bind(){
 document.querySelector('.skip').addEventListener('click',e=>{e.preventDefault();const target=document.querySelector('main>.view:not([hidden]) h1')||el('main');target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'auto'})});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){const menu=document.querySelector('.more-menu[open]');if(menu){menu.open=false;menu.querySelector('summary').focus();e.preventDefault()}}});
 document.addEventListener('click',handleClick);document.querySelectorAll('.oauth').forEach(link=>link.addEventListener('click',e=>{if(link.getAttribute('aria-disabled')==='true'){e.preventDefault();return}if(!user&&plan&&!workspace.plans.some(p=>p.id===plan.id)){if(workspace.plans.length>=40){e.preventDefault();notify('Сохраните открытый маршрут или освободите место перед входом.');return}workspace.plans.unshift(clone(plan));if(!persist()){e.preventDefault();return}}}));el('planForm').addEventListener('input',fieldChanged);el('planForm').addEventListener('change',fieldChanged);el('planForm').addEventListener('submit',generate);
 el('startPlan').onclick=()=>startNew();el('newPlan').onclick=()=>startNew(true);el('continueGuest').onclick=()=>startNew();el('prevStep').onclick=()=>navigate('planner',Math.max(1,step-1));el('nextStep').onclick=()=>{const error=stepError(step);if(error){showError(error);return}navigate('planner',Math.min(4,step+1))};
 el('addEvent').onclick=addEvent;el('editPlan').onclick=()=>{draft=normalDraft(clone(plan.config));fillFields();persist();navigate('planner',1)};el('savePlan').onclick=()=>savePlan();el('saveCopy').onclick=()=>savePlan(true);el('routeDay').onchange=()=>{dayIndex=Number(el('routeDay').value);swapIndex=null;renderDay()};
 el('rebuildDay').onclick=()=>{try{changePlan(rebuildDay(plan,dayIndex,{}),'Другой вариант дня');notify('Предложили другой вариант. Закреплённые события сохранены.')}catch(e){notify(e.message)}};
 el('undoPlan').onclick=()=>{prepareHistory();const previous=plan.versions.pop();if(!previous)return;plan.days=clone(previous.days);keepActive();renderRoute();notify('Изменение отменено')};el('restoreOriginal').onclick=()=>{const next=clone(plan);next.days=clone(plan.initialDays);changePlan(next,'Возврат к исходному');notify('Исходный маршрут восстановлен')};
 el('exportCalendar').onclick=exportCalendar;el('sharePlan').onclick=share;el('logout').onclick=logout;el('editPreferences').onclick=()=>{fillFields();navigate('planner',2)};el('importGuest').onclick=importGuest;
 window.visualViewport?.addEventListener('resize',updateViewport);window.addEventListener('resize',updateViewport);document.addEventListener('focusin',updateViewport);document.addEventListener('focusout',()=>setTimeout(updateViewport,150));window.addEventListener('hashchange',renderLocation);window.addEventListener('focus',refreshSession);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshSession()});setInterval(refreshSession,30000);
 window.addEventListener('beforeunload',e=>{if(user&&dirty){e.preventDefault();e.returnValue=''}});
}
busyIdentity(true);bind();initDesign();fillFields();renderAccount();renderLocation();initAccount().catch(()=>{sessionReady=true;busyIdentity(false);notify('Вход временно недоступен. Можно продолжить без регистрации.')});
