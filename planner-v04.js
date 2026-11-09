'use strict';
/*
Без планов · локальное ядро v0.4
Нет онлайн-ИИ, актуальных цен, проверки билетов и дорожной математики.
Плановый резерв в карточке места ≠ подтверждённая стоимость.
*/
const PREFS=[
 {key:'food',icon:'☕',title:'Вкусная еда',sub:'Кафе, гастрономия и рестораны'},
 {key:'walk',icon:'🚶',title:'Прогулки',sub:'Улицы, переулки и набережные'},
 {key:'art',icon:'🎨',title:'Искусство',sub:'Галереи и выставки'},
 {key:'history',icon:'🏛',title:'История и архитектура',sub:'Старинные дома, музеи и легенды'},
 {key:'activity',icon:'🎟',title:'Развлечения',sub:'Интерактив и новые ощущения'},
 {key:'nature',icon:'🌿',title:'Парки и природа',sub:'Тишина и зелёные места'},
 {key:'romance',icon:'♥',title:'Атмосферные места',sub:'Уют, красота, свидания'},
 {key:'unusual',icon:'✦',title:'Необычное',sub:'Места, где ещё не бывали'},
 {key:'views',icon:'◉',title:'Красивые виды',sub:'Панорамы, мосты и город сверху'},
 {key:'cinema',icon:'◈',title:'Кино и театр',sub:'Культурный вечер с билетами'}
];
const PREF_BY_KEY=Object.fromEntries(PREFS.map(x=>[x.key,x]));
const VIEW_IDS=new Set(['floating-bridge','patriarshy-bridge','panorama360','shevchenko','bagration','sun-moscow','moscow-city','christ-savior','kolom-river','krymskaya','frunzenskaya']);
const CINEMA_IDS=new Set(['khudozhestvenny']);
const HIGH_IDS=new Set(['panorama360','sun-moscow']);
const ANIMALS_IDS=new Set(['moscow-zoo','moskvarium']);
const PLACE_TAG_CACHE=new Map();
const STORE_PLANS='bezPlanovPlansV4';
const STORE_FAV='bezPlanovFavoritesV4';
const STORE_DRAFT='bezPlanovDraftV4';
const STORE_FEEDBACK='bezPlanovFeedbackV4';
const STORE_PREVIOUS='bezPlanovPlansV3';

function placeTags(p){
 if(PLACE_TAG_CACHE.has(p.id))return PLACE_TAG_CACHE.get(p.id);
 const xs=new Set(p.tags);
 if(VIEW_IDS.has(p.id))xs.add('views');
 if(CINEMA_IDS.has(p.id))xs.add('cinema');
 const out=[...xs];
 PLACE_TAG_CACHE.set(p.id,out);
 return out;
}
function cleanText(s,max=850){return String(s??'').trim().slice(0,max)}
function escapeHTML(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function formatMoney(n){return new Intl.NumberFormat('ru-RU').format(Math.round(Number(n)||0))+' ₽'}
function dateAtNoon(s){return new Date(s+'T12:00:00')}
function localISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function datesBetween(from,to){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(to||''))return [];
 const start=dateAtNoon(from),end=dateAtNoon(to),out=[];
 if(!Number.isFinite(+start)||!Number.isFinite(+end)||localISO(start)!==from||localISO(end)!==to||end<start)return [];
 for(let d=new Date(start);d<=end&&out.length<15;d.setDate(d.getDate()+1))out.push(localISO(d));
 return out;
}
function dateLabel(s){return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long'}).format(dateAtNoon(s))}
function shortDate(s){return new Intl.DateTimeFormat('ru-RU',{weekday:'short',day:'numeric',month:'short'}).format(dateAtNoon(s))}
function dayWord(n){const v=n%100;return v>10&&v<15?'дней':n%10===1?'день':[2,3,4].includes(n%10)?'дня':'дней'}
function minutes(t){const s=String(t||'').split(':');const h=Number(s[0]),m=Number(s[1]);return Number.isInteger(h)&&Number.isInteger(m)&&h>=0&&h<=23&&m>=0&&m<=59?h*60+m:NaN}
function clock(n){return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function readArray(key){try{const a=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(a)?a:[]}catch(e){return []}}
function readObject(key){try{const a=JSON.parse(localStorage.getItem(key)||'{}');return a&&typeof a==='object'&&!Array.isArray(a)?a:{}}catch(e){return {}}}
function writeStore(key,val){try{localStorage.setItem(key,JSON.stringify(val));return true}catch(e){return false}}
function getSaved(){return readArray(STORE_PLANS).filter(p=>p&&p.config&&Array.isArray(p.days))}
function getFavorites(){return readArray(STORE_FAV).filter(x=>typeof x==='string'&&PLACES[x])}
function getFeedback(){return readObject(STORE_FEEDBACK)}
function getLegacy(){return readArray(STORE_PREVIOUS).filter(p=>p&&p.config&&Array.isArray(p.days))}
function clone(x){return JSON.parse(JSON.stringify(x))}
function hasOwn(obj,key){return Object.prototype.hasOwnProperty.call(obj,key)}
function buildDefault(){
 return {
  from:localISO(new Date()),to:localISO(new Date()),peopleMode:'couple',partySize:2,journeyMode:'connected',
  budgetAmount:10000,budgetScope:'daily',budgetCovers:'activities',transportReserve:500,hotelReserve:3000,overnightStay:false,
  profiles:[
   {name:'',ratings:{},likes:'',dream:'',avoid:''},
   {name:'',ratings:{},likes:'',dream:'',avoid:''}
  ],
  occasion:'just',goals:[],pace:'balanced',surpriseLevel:50,perfectDay:'',badDay:'',
  dayStart:'11:00',dayEnd:'21:00',startLocation:'',transport:'walk',walkingLevel:'medium',
  venuePreference:'any',restrictions:[],foodNeeds:'',stepFree:false,hotelAddress:'',events:[]
 };
}
function personName(profile,i,groupMode){return cleanText(profile.name,35)||(groupMode==='group'?'Участник '+(i+1):i===0?'Вы':'Партнёр')}
const SIGNAL_WORDS=[
 {key:'food',rx:/кофе|кофейн|кофей|завтрак|ресторан|обед|ужин|гастро|вкусн|ед[аыу]|пицц|бар[уы]?\b|вино/i},
 {key:'walk',rx:/гуля|прогул|пешком|улиц|переул|набережн|дворик/i},
 {key:'art',rx:/музе|выстав|галере|искусств|картин/i},
 {key:'history',rx:/истори|старин|архитектур|собор|дворц|храм/i},
 {key:'activity',rx:/развлеч|квест|игр[уаы]|активн|аттракцион/i},
 {key:'nature',rx:/природ|пар[к][аеу]?|лес|зелень|саду|сада|сквер/i},
 {key:'romance',rx:/романт|уют|красив|атмосфер|свидан/i},
 {key:'unusual',rx:/необыч|нов[оы]е|удив|космос|планетар|эксперимент/i},
 {key:'views',rx:/вид[ыа]|панорам|крыше|высот|смотров/i},
 {key:'cinema',rx:/кино|театр|спектакл/i}
];
const TEXT_RESTRICTIONS=[
 {key:'crowds',rx:/толп|очеред|много людей|людн/i},
 {key:'noise',rx:/шум|громк/i},
 {key:'expensive',rx:/дорог|слишком дорог|больш[ие] траты/i},
 {key:'longwalk',rx:/долг[а-я]* прогул|много ходить|далеко пешком|10 км|устал[а-я]* ходить/i},
 {key:'outdoors',rx:/холод|мерзн|дожд|долго на улице/i},
 {key:'heights',rx:/боюсь высот|страх высот/i},
 {key:'animals',rx:/зоопарк|животн|аквариум/i}
];
function textSignals(cfg){
 const people=cfg.peopleMode==='solo'?cfg.profiles.slice(0,1):cfg.profiles;
 const restrictions=new Set(cfg.restrictions||[]);
 const negation=/(?:не\s+(?:люблю|нравится|хочу|интересно|переношу)|ненавиж|избегаю|терпеть\s+не\s+могу|никаких)/i;
 function parse(raw,negativeDefault){
   const positive=new Set(),negative=new Set();
   const parts=String(raw||'').split(/[,.!?;\n]|\s+но\s+|\s+однако\s+/i).map(s=>s.trim()).filter(Boolean);
   for(const part of parts){
     const isNegative=negativeDefault||negation.test(part);
     for(const w of SIGNAL_WORDS)if(w.rx.test(part))(isNegative?negative:positive).add(w.key);
     for(const r of TEXT_RESTRICTIONS)if(r.rx.test(part))restrictions.add(r.key);
     if(/без\s+цели|бесцельн|просто\s+ходить/i.test(part))restrictions.add('aimless');
   }
   return {positive:[...positive],negative:[...negative]};
 }
 const personal=people.map(p=>{
   const a=parse((p.likes||'')+'; '+(p.dream||''),false),b=parse(p.avoid,true);
   return {positive:[...new Set([...a.positive,...b.positive])],
     negative:[...new Set([...a.negative,...b.negative])]};
 });
 const sharedA=parse(cfg.perfectDay,false),sharedB=parse(cfg.badDay,true);
 const sharedPositive=[...new Set([...sharedA.positive,...sharedB.positive])];
 const sharedAvoid=[...new Set([...sharedA.negative,...sharedB.negative])];
 const peoplePositive=personal.map(p=>p.positive),peopleAvoid=personal.map(p=>p.negative);
 const notHard={
   longwalk:['walk'],outdoors:['nature'],crowds:['walk'],noise:['food'],expensive:['food'],
   heights:['views'],aimless:['walk']
 };
 for(const key of restrictions)for(const interest of notHard[key]||[]){
   for(const arr of peopleAvoid){const i=arr.indexOf(interest);if(i>=0)arr.splice(i,1)}
   const j=sharedAvoid.indexOf(interest);if(j>=0)sharedAvoid.splice(j,1);
 }
 const avoid=new Set([...peopleAvoid.flat(),...sharedAvoid]);
 const pos=new Set([...peoplePositive.flat(),...sharedPositive].filter(x=>!avoid.has(x)));
 const names=[...pos].map(k=>PREF_BY_KEY[k]?.title).filter(Boolean);
 const banned=[...avoid].map(k=>PREF_BY_KEY[k]?.title).filter(Boolean);
 return {positive:[...pos],avoid:[...avoid],peoplePositive,peopleAvoid,sharedPositive,sharedAvoid,
   restrictions:[...restrictions],recognized:names,avoided:banned};
}
function rated(profile,key){const n=Number(profile?.ratings?.[key]);return [2,1,-3].includes(n)?n:0}
function isHardNo(cfg,key,signal){
 if(signal.avoid.includes(key))return true;
 return (cfg.peopleMode==='solo'?cfg.profiles.slice(0,1):cfg.profiles).some(p=>rated(p,key)===-3);
}
function pairStats(cfg){
 const a=cfg.profiles[0],b=cfg.profiles[1],signals=textSignals(cfg);
 let mutual=0,clash=0,one=0;
 const common=[],different=[],conflicts=[];
 function level(profile,index,key){
   const exact=rated(profile,key);
   if(exact===-3||signals.peopleAvoid[index]?.includes(key))return -3;
   return exact|| (signals.peoplePositive[index]?.includes(key)?1:0);
 }
 for(const p of PREFS){
   const x=level(a,0,p.key),y=cfg.peopleMode==='solo'?0:level(b,1,p.key);
   if(x>0&&y>0){mutual++;common.push(p.title)}
   else if((x>0&&y===0)||(y>0&&x===0)){one++;different.push(p.title)}
   else if((x>0&&y===-3)||(y>0&&x===-3)){clash++;conflicts.push(p.title)}
 }
 return {mutual,one,clash,common,different,conflicts,solo:cfg.peopleMode==='solo'};
}
function placeEligible(p,cfg,signals,feedback){
 const tags=placeTags(p),meta=PLACE_INFO[p.id]||{};
 if(tags.some(k=>isHardNo(cfg,k,signals)))return false;
 if((cfg.venuePreference==='indoor-only'&&!meta.indoor)||(cfg.venuePreference==='outdoor-only'&&!meta.outdoor))return false;
 if(signals.restrictions.includes('heights')&&HIGH_IDS.has(p.id))return false;
 if(signals.restrictions.includes('animals')&&ANIMALS_IDS.has(p.id))return false;
 if(feedback[p.id]==='no')return false;
 // Dietary restrictions cannot be asserted satisfied by this catalog.
 if(/аллерг|целиак|веган|вегетари|халяль|кошер|без глютен/i.test(cfg.foodNeeds)&&p.tags.includes('food'))return false;
 return true;
}
function placeScore(p,cfg,signals,usage,dayIndex,personFocus,feedback){
 if(!placeEligible(p,cfg,signals,feedback))return -Infinity;
 const tags=placeTags(p);
 let score=1;
 const profiles=cfg.peopleMode==='solo'?cfg.profiles.slice(0,1):cfg.profiles;
 const likes=profiles.map((profile,i)=>tags.reduce((s,k)=>s+(rated(profile,k)===2?5:rated(profile,k)===1?2:0)+(rated(profile,k)===0&&signals.peoplePositive?.[i]?.includes(k)?2:0),0));
 score+=likes.reduce((s,v)=>s+v,0);
 if(likes.length>1&&likes[0]>0&&likes[1]>0)score+=6;
 if(likes.length>1&&personFocus!=null&&likes[personFocus]>0&&likes[1-personFocus]===0)score+=7;
 if(tags.some(t=>signals.positive.includes(t)))score+=3;
 const goals=cfg.goals||[];
 if(goals.includes('talk')&&(tags.includes('food')||tags.includes('romance')))score+=4;
 if(goals.includes('wow')&&(tags.includes('unusual')||tags.includes('views')))score+=5;
 if(goals.includes('rest')&&(tags.includes('nature')||tags.includes('romance')))score+=4;
 if(goals.includes('laugh')&&tags.includes('activity'))score+=5;
 if(goals.includes('photo')&&(tags.includes('views')||tags.includes('walk')))score+=4;
 if(goals.includes('learn')&&(tags.includes('history')||tags.includes('art')))score+=4;
 if(goals.includes('romance')&&(tags.includes('romance')||tags.includes('views')))score+=4;
 if(goals.includes('move')&&(tags.includes('activity')||tags.includes('walk')))score+=4;
 if(['date','anniversary','surprise'].includes(cfg.occasion)&&tags.includes('romance'))score+=2;
 if(cfg.surpriseLevel>=75&&tags.includes('unusual'))score+=3;
 if(cfg.surpriseLevel<=25&&tags.includes('walk'))score+=1;
 const meta=PLACE_INFO[p.id]||{};
 if(signals.restrictions.includes('crowds')&&meta.crowded)score-=15;
 if(signals.restrictions.includes('noise')&&tags.includes('activity'))score-=4;
 if(signals.restrictions.includes('expensive')&&p.cost>2500)score-=10;
 if((signals.restrictions.includes('outdoors')||cfg.venuePreference==='mostly-indoor')&&meta.outdoor)score-=6;
 if(cfg.venuePreference==='mostly-outdoor'&&meta.indoor)score-=4;
 if(cfg.walkingLevel==='low'&&tags.includes('walk'))score-=8;
 if(signals.restrictions.includes('longwalk')&&tags.includes('walk'))score-=8;
 if(signals.restrictions.includes('aimless')&&tags.includes('walk'))score-=5;
 if(feedback[p.id]==='yes')score+=7;
 score-=Math.min(usage[p.id]||0,4)*20;
 // Keep cross-day variety: don't let an accidental catalog order dominate.
 score+=Math.min(3,(dayIndex%3));
 return score;
}
function priceAllowance(p,party){return Math.round(Math.max(0,p.cost)*party/2/50)*50}
function bookingCounted(e){return !e.paid||e.includeBudget}
function bookingCost(e){return bookingCounted(e)?Math.max(0,Number(e.cost)||0):0}
function dayReserve(cfg,index,numDays){
 const nightly=(cfg.budgetCovers==='all'&&cfg.overnightStay&&index<numDays-1)?Number(cfg.hotelReserve)||0:0;
 const transport=cfg.budgetCovers==='all'?Number(cfg.transportReserve)||0:0;
 return {nightly,transport,total:nightly+transport};
}
function dayLimit(cfg,index,n){
 const amount=Math.round(cfg.budgetAmount);
 if(cfg.budgetScope==='daily')return amount;
 const base=Math.floor(amount/n);
 return base+(index<amount%n?1:0);
}
function budgetForDay(cfg,index,n,dayEvents){
 const total=dayLimit(cfg,index,n),reserve=dayReserve(cfg,index,n);
 const events=dayEvents.reduce((s,e)=>s+bookingCost(e),0);
 return {total,reserve,eventCost:events,available:total-reserve.total-events};
}
function areaFromText(text){
 const t=(text||'').toLowerCase();
 const tests=[
  [/красн|охотн|николь|китай|лубян|заряд|гум|варварк/, 'center'],
  [/трет|пятниц|новокузнец|ордын|замоск|болотн/, 'zamos'],
  [/парк культур|горьк|фрунзен|октябрьск|музеон|нескуч/, 'gorky'],
  [/арбат|кропоткин|смоленск|волхонк|гоголев/, 'arbat'],
  [/твер|патриар|маяк|пушкинск|баррикад|белорус|садов/, 'patriki'],
  [/делов|выставочн|сити|международн|преснен/, 'city'],
  [/вднх|останкин|ботанич|космонавт|проспект мира/, 'vdnh'],
  [/коломенск|каширск|андропов/, 'kolomenskoye']
 ];
 for(const [rx,id] of tests)if(rx.test(t))return id;
 return null;
}
function areaQuality(area,cfg,signals,feedback){
 const eligible=area.places.filter(p=>placeEligible(p,cfg,signals,feedback));
 if(!eligible.length)return -999;
 const scores=eligible.map(p=>placeScore(p,cfg,signals,{},0,null,feedback)).sort((a,b)=>b-a);
 return scores.slice(0,5).reduce((s,n)=>s+n,0)/Math.max(1,Math.min(5,scores.length))
   +Math.min(4,eligible.length)*1.2;
}
const NEARBY={
 center:['zamos','arbat','patriki','gorky'],zamos:['center','gorky','arbat'],
 gorky:['zamos','arbat','center','city'],arbat:['center','gorky','patriki','city'],
 patriki:['arbat','center','city'],city:['arbat','patriki','gorky'],vdnh:['patriki','center'],kolomenskoye:['zamos','gorky']
};
function chooseAreas(cfg,dates,signals,feedback){
 const scores=Object.fromEntries(AREAS.map(a=>[a.id,areaQuality(a,cfg,signals,feedback)]));
 const base=areaFromText(cfg.startLocation)||areaFromText(cfg.hotelAddress);
 const used={},selected=[];
 for(let i=0;i<dates.length;i++){
  const dayEvents=cfg.events.filter(e=>e.date===dates[i]);
  const eventArea=dayEvents.map(e=>areaFromText(e.address+' '+e.name)).find(Boolean);
  let candidates=AREAS.filter(a=>scores[a.id]>-900);
  if(!candidates.length)candidates=AREAS.slice();
  candidates.sort((a,b)=>{
   const value=x=>{
     const n=used[x.id]||0;
     let v=scores[x.id]-n*35;
     if(i===0&&base===x.id)v+=18;
     if(eventArea===x.id)v+=60;
     if(cfg.journeyMode==='connected'&&i>0&&NEARBY[selected[i-1]]?.includes(x.id))v+=14;
     if(cfg.journeyMode==='independent'&&n===0)v+=6;
     return v;
   };
   return value(b)-value(a)||AREAS.indexOf(a)-AREAS.indexOf(b);
  });
  selected.push(candidates[0].id);used[candidates[0].id]=(used[candidates[0].id]||0)+1;
 }
 return selected;
}
function bookedEventValid(e,cfg){
 if(!e||!cleanText(e.name,110))return false;
 if(!datesBetween(cfg.from,cfg.to).includes(e.date))return false;
 const start=minutes(e.time),duration=Number(e.duration),cost=Number(e.cost);
 return Number.isFinite(start)&&Number.isInteger(duration)&&duration>=15&&duration<=480&&start+duration<=1440&&
  Number.isFinite(cost)&&cost>=0&&cost<=10000000;
}
function overlappingEvents(events){
 const byDay={};
 for(const e of events){
  (byDay[e.date]??=[]).push(e);
 }
 for(const list of Object.values(byDay)){
  list.sort((a,b)=>minutes(a.time)-minutes(b.time));
  for(let i=1;i<list.length;i++){
   if(minutes(list[i].time)<minutes(list[i-1].time)+Number(list[i-1].duration))return true;
  }
 }
 return false;
}
function validateConfig(cfg){
 const d=datesBetween(cfg.from,cfg.to);
 if(!d.length)return 'Выберите даты начала и окончания.';
 if(d.length>14)return 'Период пока ограничен 14 днями.';
 if(cfg.from<localISO(new Date()))return 'Поставьте сегодняшнюю или будущую дату.';
 if(!['couple','solo','group'].includes(cfg.peopleMode))return 'Выберите формат компании.';
 if(cfg.peopleMode==='group'&&!(cfg.partySize>=3&&cfg.partySize<=6))return 'Укажите число участников от 3 до 6.';
 if(!Number.isFinite(cfg.budgetAmount)||cfg.budgetAmount<500||cfg.budgetAmount>10000000)return 'Укажите бюджет от 500 до 10 000 000 ₽.';
 if(!['daily','total'].includes(cfg.budgetScope))return 'Выберите режим бюджета.';
 const start=minutes(cfg.dayStart),end=minutes(cfg.dayEnd);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end-start<120||end-start>840)return 'Выберите продолжительность дня от 2 до 14 часов.';
 if(!['slow','balanced','active'].includes(cfg.pace))return 'Выберите темп.';
 if(!['any','indoor-only','outdoor-only','mostly-indoor','mostly-outdoor'].includes(cfg.venuePreference))return 'Выберите формат мест.';
 if(!Array.isArray(cfg.events)||cfg.events.length>20)return 'Можно закрепить до 20 событий.';
 if(cfg.events.some(e=>!bookedEventValid(e,cfg)))return 'Проверьте дату, время, стоимость и длительность закреплённых событий.';
 if(overlappingEvents(cfg.events))return 'В закреплённых событиях есть пересечение по времени. Исправьте его.';
 if(cfg.events.some(e=>minutes(e.time)<start||minutes(e.time)+Number(e.duration)>end))
   return 'Закреплённое событие находится за пределами выбранного времени дня. Вернитесь к настройке часов или измените время события.';
 if(cfg.budgetCovers==='all'&&(!Number.isFinite(cfg.transportReserve)||cfg.transportReserve<0||!Number.isFinite(cfg.hotelReserve)||cfg.hotelReserve<0))return 'Введите корректный резерв на транспорт и ночёвки.';
 for(let i=0;i<d.length;i++){
  const budget=budgetForDay(cfg,i,d.length,cfg.events.filter(e=>e.date===d[i]));
  if(budget.available<0)return 'Бюджета на '+dateLabel(d[i])+' не хватает на ваши закреплённые расходы и резерв. Увеличьте лимит или скорректируйте суммы.';
 }
 return '';
}
function personEvidence(p,cfg,signals){
 const tags=placeTags(p),profiles=cfg.peopleMode==='solo'?cfg.profiles.slice(0,1):cfg.profiles;
 const matches=profiles.map((person,i)=>({i,name:personName(person,i,cfg.peopleMode),keys:tags.filter(k=>rated(person,k)>0||signals.peoplePositive?.[i]?.includes(k))}));
 const clauses=[];
 if(matches.length>1&&matches.every(x=>x.keys.length))clauses.push('По интересам обоих');
 else{
  const who=matches.filter(x=>x.keys.length);
  if(who.length)clauses.push('Учитывает интересы: '+who.map(x=>x.name).join(' и '));
 }
 const typed=tags.filter(x=>signals.positive.includes(x));
 if(typed.length)clauses.push('Созвучно вашим свободным ответам');
 if(cfg.goals.includes('photo')&&tags.includes('views'))clauses.push('Для красивых видов');
 if(cfg.goals.includes('rest')&&tags.includes('nature'))clauses.push('Для спокойного отдыха');
 if(cfg.goals.includes('learn')&&(tags.includes('art')||tags.includes('history')))clauses.push('Чтобы узнать новое');
 if(cfg.goals.includes('talk')&&tags.includes('food'))clauses.push('Время поговорить');
 if(cfg.goals.includes('romance')&&tags.includes('romance'))clauses.push('Для особенной атмосферы');
 return clauses.length?clauses.slice(0,2).join(' · '):'Подходит под выбранный формат дня и ограничения';
}
function dayCapacity(cfg){
 const hours=(minutes(cfg.dayEnd)-minutes(cfg.dayStart))/60;
 const preferred=cfg.pace==='slow'?3:cfg.pace==='balanced'?4:5;
 const mobility=cfg.walkingLevel==='low'?Math.min(3,preferred):preferred;
 return Math.min(mobility,Math.max(1,Math.floor(hours/1.65)));
}
function reserveSlots(cfg,events){
 const start=minutes(cfg.dayStart),end=minutes(cfg.dayEnd);
 const breaks=events.map(e=>({start:minutes(e.time),end:minutes(e.time)+Number(e.duration)})).sort((a,b)=>a.start-b.start);
 const slots=[];
 let cursor=start;
 for(const e of breaks){
   if(e.start>=cursor+35)slots.push({from:cursor,to:Math.min(e.start-20,end)});
   cursor=Math.max(cursor,e.end+20);
 }
 if(cursor<end-35)slots.push({from:cursor,to:end});
 return slots.filter(s=>s.to-s.from>=35);
}
function chooseStopsForDay(area,cfg,signals,feedback,usage,index,dayBudget,events){
 const available=dayBudget.available;
 const pool=area.places.filter(p=>placeEligible(p,cfg,signals,feedback));
 const max=Math.max(0,dayCapacity(cfg)-events.length);
 const booked=events.map(e=>({kind:'fixed',id:e.id,name:e.name,address:e.address,date:e.date,time:e.time,duration:Number(e.duration),cost:Number(e.cost),paid:!!e.paid,includeBudget:!!e.includeBudget,locked:true}));
 const slots=reserveSlots(cfg,events);
 const chosen=[];
 let spent=0,slotIndex=0;
 const timeSlots=slots.map(s=>({...s,cursor:s.from}));
 while(chosen.length<max&&timeSlots.length){
   let slot=timeSlots[slotIndex];
   if(!slot){slotIndex=0;slot=timeSlots[0]}
   const personFocus=(chosen.length+index)%Math.max(1,cfg.peopleMode==='solo'?1:2);
   const unused=pool.filter(p=>!(usage[p.id]>0));
   const candidates=pool.filter(p=>{
     if(chosen.some(s=>s.id===p.id))return false;
     if(unused.length>=max-chosen.length&&usage[p.id]>0)return false;
     const cost=priceAllowance(p,cfg.partySize);
     if(spent+cost>available)return false;
     const length=p.minutes+(cfg.transport==='foot'?25:20);
     return length<=slot.to-slot.cursor;
   });
   if(!candidates.length){timeSlots.splice(slotIndex,1);if(slotIndex>=timeSlots.length)slotIndex=0;continue}
   candidates.sort((a,b)=>placeScore(b,cfg,signals,usage,index,personFocus,feedback)-
     placeScore(a,cfg,signals,usage,index,personFocus,feedback)||area.places.indexOf(a)-area.places.indexOf(b));
   let place=candidates[0];
   // Avoid filling every slot with walk-only activities.
   if(chosen.length>=1&&chosen.every(s=>PLACES[s.id]?.tags.includes('walk'))&&
       place.tags.includes('walk')&&candidates.some(p=>!p.tags.includes('walk')))
       place=candidates.find(p=>!p.tags.includes('walk'));
   const cost=priceAllowance(place,cfg.partySize);
   chosen.push({kind:'place',id:place.id,time:clock(slot.cursor),duration:place.minutes,locked:false});
   spent+=cost;usage[place.id]=(usage[place.id]||0)+1;
   slot.cursor+=place.minutes+(cfg.transport==='foot'?25:20);
   slotIndex=(slotIndex+1)%timeSlots.length;
 }
 const stops=chosen.concat(booked).sort((a,b)=>minutes(a.time)-minutes(b.time)|| (a.kind==='fixed'?-1:1));
 return {stops,availableBudget:available,plannedAllowance:spent};
}
function generateItinerary(cfg,priorFeedback){
 const error=validateConfig(cfg);if(error)throw new Error(error);
 const dates=datesBetween(cfg.from,cfg.to),signals=textSignals(cfg);
 const feedback=priorFeedback||getFeedback(),areas=chooseAreas(cfg,dates,signals,feedback);
 const usage={};
 const days=dates.map((date,i)=>{
   const events=cfg.events.filter(e=>e.date===date);
   const budget=budgetForDay(cfg,i,dates.length,events);
   const area=AREA_BY_ID[areas[i]];
   const planned=chooseStopsForDay(area,cfg,signals,feedback,usage,i,budget,events);
   return {date,areaId:area.id,limit:budget.total,reserve:budget.reserve,eventBudget:budget.eventCost,stops:planned.stops};
 });
 return {schema:4,id:String(Date.now())+'-'+Math.random().toString(36).slice(2,7),
   createdAt:new Date().toISOString(),config:clone(cfg),days,signals,
   meta:{engine:'local',catalog:'editorial',priceType:'budget-allowance'}};
}
function countedEventSpend(day){return day.stops.filter(s=>s.kind==='fixed').reduce((n,s)=>n+bookingCost(s),0)}
function daySpending(day,cfg){
 const place=day.stops.filter(s=>s.kind==='place').reduce((n,s)=>n+priceAllowance(PLACES[s.id]||{cost:0},cfg.partySize),0);
 const fixed=countedEventSpend(day);
 const reserved=day.reserve?.total||0;
 return {place,fixed,reserved,total:place+fixed+reserved};
}
function totalSpend(plan){return plan.days.reduce((s,day)=>s+daySpending(day,plan.config).total,0)}
function totalLimit(cfg,days){return cfg.budgetAmount*(cfg.budgetScope==='daily'?days:1)}
function mapLink(address){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address||'Москва')}
function mapLinkYandex(address){return 'https://yandex.ru/maps/?text='+encodeURIComponent(address||'Москва')}
function dayMap(day,cfg){
 const addresses=day.stops.map(s=>s.kind==='fixed'?s.address:PLACES[s.id]?.address).filter(Boolean);
 if(!addresses.length)return 'https://www.google.com/maps';
 if(addresses.length===1)return mapLink(addresses[0]);
 const mode=cfg.transport==='car'||cfg.transport==='taxi'?'driving':cfg.transport==='walk'?'transit':'walking';
 let url='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(addresses[0])+
  '&destination='+encodeURIComponent(addresses[addresses.length-1])+'&travelmode='+mode;
 if(addresses.length>2)url+='&waypoints='+encodeURIComponent(addresses.slice(1,-1).join('|'));
 return url;
}
function alternativesFor(plan,dayIndex,stopIndex,feedback){
 const day=plan.days[dayIndex],st=day?.stops[stopIndex];
 if(!st||st.kind!=='place'||st.locked)return [];
 const area=AREA_BY_ID[day.areaId],cfg=plan.config,signals=plan.signals||textSignals(cfg);
 const capacity=day.limit-daySpending(day,cfg).total+priceAllowance(PLACES[st.id],cfg.partySize);
 const used={};for(const d of plan.days)for(const s of d.stops)if(s.kind==='place'&&s.id!==st.id)used[s.id]=(used[s.id]||0)+1;
 const old=PLACES[st.id],oldTags=placeTags(old);
 return area.places.filter(p=>
   p.id!==st.id&&!day.stops.some(s=>s.id===p.id)&&placeEligible(p,cfg,signals,feedback||getFeedback())&&
   priceAllowance(p,cfg.partySize)<=capacity&&p.minutes<=(st.duration||old.minutes))
  .sort((a,b)=>(placeScore(b,cfg,signals,used,dayIndex,null,feedback||getFeedback())+placeTags(b).filter(t=>oldTags.includes(t)).length*4)
    -(placeScore(a,cfg,signals,used,dayIndex,null,feedback||getFeedback())+placeTags(a).filter(t=>oldTags.includes(t)).length*4))
  .slice(0,5);
}
function hasRealOverlap(stops){
 const sorted=stops.slice().sort((a,b)=>minutes(a.time)-minutes(b.time));
 return sorted.some((s,i)=>i>0&&minutes(s.time)<minutes(sorted[i-1].time)+Number(sorted[i-1].duration));
}
