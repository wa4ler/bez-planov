'use strict';
/*
Без планов · локальное ядро v0.4
Нет онлайн-ИИ, актуальных цен и проверки билетов. Дорога — только оценка.
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
 {key:'cinema',icon:'◈',title:'Кино и театр',sub:'Культурный вечер с билетами'},
 {key:'coffee',icon:'☕',title:'Кофейни и завтраки',sub:'Уютная пауза с любимым напитком'},
 {key:'architecture',icon:'⌂',title:'Городская архитектура',sub:'Фасады, детали и старые улицы'},
 {key:'science',icon:'✺',title:'Наука и космос',sub:'Планетарии и интерактивные выставки'},
 {key:'water',icon:'≈',title:'Река и набережные',sub:'Красивые виды у воды'},
 {key:'shopping',icon:'◇',title:'Магазины и маркеты',sub:'Необычные товары и маленькие находки'},
 {key:'photography',icon:'◉',title:'Фотопрогулки',sub:'Эстетичные места для снимков'}
];
const PREF_BY_KEY=Object.fromEntries(PREFS.map(x=>[x.key,x]));
const VIEW_IDS=new Set(['floating-bridge','patriarshy-bridge','panorama360','shevchenko','bagration','sun-moscow','moscow-city','christ-savior','kolom-river','krymskaya','frunzenskaya']);
const CINEMA_IDS=new Set(['khudozhestvenny']);
const HIGH_IDS=new Set(['panorama360','sun-moscow']);
const ANIMALS_IDS=new Set(['moscow-zoo','moskvarium']);
const COFFEE_IDS=new Set(['vokrug-sveta','depo-lesnaya','afimall-food','usachevsky','pushkin-cafe','varenichnaya']);
const ARCH_IDS=new Set(['gum','red-square','st-basil','nikolskaya','arbat-old','ascension','palace-alexei','vdnh-arch','moscow-city','christ-savior','ordynka','pyatnitskaya']);
const SCIENCE_IDS=new Set(['planetarium','cosmos','vdnh-park','moskvarium']);
const WATER_IDS=new Set(['floating-bridge','zaryadye','krymskaya','frunzenskaya','patriarshy-bridge','kolom-river','shevchenko','bagration','neskuchny']);
const SHOPPING_IDS=new Set(['gum','afimall','arbat-old','depo-lesnaya','vokrug-sveta']);
const PHOTO_IDS=new Set([...VIEW_IDS,'zaryadye','patriarch-ponds','gorky-park','muzeon','vdnh-park','kolom-park']);
const PLACE_TAG_CACHE=new Map();
const PLACE_ALIASES={
 'tretyakov':['третьяковка','третьяковскую'],
 'ges2':['гэс-2','гэс 2','гэс'],
 'gorky-park':['парк горького','парк горький'],
 'planetarium':['планетарий'],
 'moskvarium':['москвариум'],
 'moscow-zoo':['зоопарк'],
 'moscow-city':['москва-сити','москва сити'],
 'history-museum':['исторический музей'],
 'red-square':['красная площадь'],
 'vdnh-park':['вднх'],
 'panorama360':['панорама360','панорама 360'],
 'sun-moscow':['солнце москвы'],
 'arbat-old':['старый арбат'],
 'patriarch-ponds':['патриаршие пруды','патрики']
};
function normalizePlaceQuery(t){return String(t||'').toLowerCase().replace(/ё/g,'е').replace(/[«»"“”.,!?:;()\n]/g,' ').replace(/\s+/g,' ').trim()}
function mentionedPlaceIds(text){
 const full=normalizePlaceQuery(text);
 if(!full)return [];
 const words=full.split(' ');
 function containsName(name){
   const needle=normalizePlaceQuery(name);
   if(needle.length<3)return false;
   // ГУМ and ВДНХ must match as words, not substrings of other text.
   return needle.length<5?words.includes(needle):full.includes(needle);
 }
 return Object.keys(PLACES).filter(id=>{
   const place=PLACES[id];
   return [place.name,...(PLACE_ALIASES[id]||[])].some(containsName);
 });
}
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
 if(COFFEE_IDS.has(p.id))xs.add('coffee');
 if(ARCH_IDS.has(p.id))xs.add('architecture');
 if(SCIENCE_IDS.has(p.id))xs.add('science');
 if(WATER_IDS.has(p.id))xs.add('water');
 if(SHOPPING_IDS.has(p.id))xs.add('shopping');
 if(PHOTO_IDS.has(p.id))xs.add('photography');
 const out=[...xs];
 PLACE_TAG_CACHE.set(p.id,out);
 return out;
}
function cleanText(s,max=850){return String(s??'').trim().slice(0,max)}
function escapeHTML(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function formatMoney(n){return new Intl.NumberFormat('ru-RU').format(Math.round(Number(n)||0))+' ₽'}
function dateAtNoon(s){return new Date(s+'T12:00:00')}
function localISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
const MAX_PLAN_DAYS=31;
function datesBetween(from,to){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(to||''))return [];
 const start=dateAtNoon(from),end=dateAtNoon(to),out=[];
 if(!Number.isFinite(+start)||!Number.isFinite(+end)||localISO(start)!==from||localISO(end)!==to||end<start)return [];
 for(let d=new Date(start);d<=end&&out.length<=MAX_PLAN_DAYS;d.setDate(d.getDate()+1))out.push(localISO(d));
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
  venuePreference:'any',restrictions:[],foodNeeds:'',stepFree:false,hotelAddress:'',events:[],
  alreadyVisited:'',dreamPlaces:'',preferredDistrict:null
 };
}
function personName(profile,i,groupMode){return cleanText(profile.name,35)||(groupMode==='group'?'Участник '+(i+1):i===0?'Вы':'Партнёр')}
const SIGNAL_WORDS=[
 {key:'food',rx:/кафе|кофе|кофейн|кофей|завтрак|ресторан|обед|ужин|гастро|вкусн|ед[аыу]|пицц|бар[уы]?\b|вино/i},
 {key:'walk',rx:/гуля|прогул|пешком|улиц|переул|набережн|дворик/i},
 {key:'art',rx:/музе|выстав|галере|искусств|картин/i},
 {key:'history',rx:/истори|старин|архитектур|собор|дворц|храм/i},
 {key:'activity',rx:/развлеч|квест|игр[уаы]|активн|аттракцион|боулинг|картинг|каток/i},
 {key:'nature',rx:/природ|(?:^|[^а-я])парк|(?:^|[^а-я])лес|зелень|саду|сада|сквер|пикник|закат|зоопарк|животн|аквариум/i},
 {key:'romance',rx:/романт|уют|красив|атмосфер|свидан|спа|массаж|релакс/i},
 {key:'unusual',rx:/необыч|нов[оы]е|удив|космос|планетар|эксперимент|мастер-класс|гончар|керамик/i},
 {key:'views',rx:/вид[ыа]|панорам|крыше|высот|смотров/i},
 {key:'cinema',rx:/кино|театр|спектакл/i},
 {key:'coffee',rx:/кофейн|кофей|кофе|капучино|латте|завтрак/i},
 {key:'architecture',rx:/архитектур|фасад|старинн.*дом|здани|усадьб/i},
 {key:'science',rx:/наук|космос|планетар|астроном/i},
 {key:'water',rx:/рек[аеу]|набережн|у воды|лодк/i},
 {key:'shopping',rx:/магазин|шопинг|маркет|покупк/i},
 {key:'photography',rx:/фотограф|фотографир|снимк|фотопрогулк/i}
];
const TEXT_RESTRICTIONS=[
 {key:'crowds',rx:/толп|очеред|много людей|людн/i},
 {key:'noise',rx:/шум|громк/i},
 {key:'expensive',rx:/(?:^|[^а-я])дорог|больш[ие] траты/i},
 {key:'longwalk',rx:/долг[а-я]* прогул|много ходить|далеко пешком|10 км|устал[а-я]* ходить/i},
 {key:'outdoors',rx:/холод|мерзн|дожд|долго на улице/i},
 {key:'heights',rx:/высот/i},
 {key:'animals',rx:/зоопарк|животн|аквариум/i}
];
const RESTRICTION_LABELS={crowds:'Избегать толп и очередей',noise:'Меньше шума',expensive:'Избегать дорогих мест',longwalk:'Меньше ходьбы',outdoors:'Меньше времени на улице',heights:'Без высоты',animals:'Без зоопарков и аквариумов',aimless:'Без бесцельных прогулок'};
function textSignals(cfg){
 const people=cfg.peopleMode==='solo'?cfg.profiles.slice(0,1):cfg.profiles;
 const restrictions=new Set(cfg.restrictions||[]);
 const negation=/(?:не\s+(?:люблю|нрав\S*|хочу|интересно|переношу)|ненавиж|избегаю|терпеть\s+не\s+могу|никаких|без\s|боюсь|страх)/i;
 function parse(raw,negativeDefault){
   const positive=new Set(),negative=new Set();
   const parts=String(raw||'').split(/[,.!?;\n]|\s+(?:но|однако|зато)\s+|\s+(?=без\s)|\s+и\s+(?=(?:не\s|без\s|боюсь|избегаю|люблю|хочу|нрав))/i).map(s=>s.trim()).filter(Boolean);
   for(const part of parts){
     const fearNegated=/не\s+боюсь|нет\s+страха/i.test(part);
     const isNegative=negativeDefault||(!fearNegated&&negation.test(part));
     const localRestrictions=[];
     for(const r of TEXT_RESTRICTIONS){
       const negativeContext=isNegative||(/устаю|быстро\s+устал|тяжело\s+ходить|мерзну/i.test(part)&&['longwalk','outdoors'].includes(r.key));
       if(r.rx.test(part)&&negativeContext&&!(r.key==='heights'&&fearNegated)){
         restrictions.add(r.key);localRestrictions.push(r.key);
       }
     }
     if(isNegative&&/без\s+цели|бесцельн|просто\s+ходить/i.test(part)){restrictions.add('aimless');localRestrictions.push('aimless')}
     // A specific objection ("дорогие рестораны") is not a ban on all food.
     // Apply this only in the same clause; a separate "не люблю кафе" still wins.
     const narrow={expensive:['food'],noise:['food','activity'],crowds:['walk'],longwalk:['walk'],outdoors:['nature','walk'],heights:['views'],animals:['nature'],aimless:['walk']};
     const narrowed=new Set(localRestrictions.flatMap(k=>narrow[k]||[]));
     for(const w of SIGNAL_WORDS)if(w.rx.test(part)){
       if(isNegative){if(!narrowed.has(w.key))negative.add(w.key)}
       else if(!fearNegated)positive.add(w.key);
     }
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
 const avoid=new Set([...peopleAvoid.flat(),...sharedAvoid]);
 const pos=new Set([...peoplePositive.flat(),...sharedPositive].filter(x=>!avoid.has(x)));
 const names=[...pos].map(k=>PREF_BY_KEY[k]?.title).filter(Boolean);
 const banned=[...avoid].map(k=>PREF_BY_KEY[k]?.title).filter(Boolean);
 return {positive:[...pos],avoid:[...avoid],peoplePositive,peopleAvoid,sharedPositive,sharedAvoid,
   restrictions:[...restrictions],restrictionLabels:[...restrictions].map(k=>RESTRICTION_LABELS[k]).filter(Boolean),recognized:names,avoided:banned};
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
 if(cfg.alreadyVisited && mentionedPlaceIds(cfg.alreadyVisited).includes(p.id) && !mentionedPlaceIds(cfg.dreamPlaces).includes(p.id))return false;
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
 if(mentionedPlaceIds(cfg.dreamPlaces).includes(p.id))score+=65;
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
 // Commitments are funded first, then the remaining flexible budget is shared.
 const dates=datesBetween(cfg.from,cfg.to);
 const required=Array.from({length:n},(_,i)=>dayReserve(cfg,i,n).total+
   (cfg.events||[]).filter(e=>e.date===dates[i]).reduce((s,e)=>s+bookingCost(e),0));
 const left=amount-required.reduce((s,x)=>s+x,0),base=Math.floor(left/n);
 return required[index]+base+(index<((left%n)+n)%n?1:0);
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
 const base=cfg.preferredDistrict||areaFromText(cfg.startLocation)||areaFromText(cfg.hotelAddress);
 const wishIds=mentionedPlaceIds(cfg.dreamPlaces);
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
     if(x.places.some(p=>wishIds.includes(p.id)&&!(used[x.id]>0)))v+=35;
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
 if(d.length>MAX_PLAN_DAYS)return 'Период пока ограничен '+MAX_PLAN_DAYS+' днём.';
 if(cfg.from<localISO(new Date()))return 'Поставьте сегодняшнюю или будущую дату.';
 if(cfg.peopleMode!=='couple'||cfg.partySize!==2)return 'Пока создаём маршруты только для двоих.';
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
/* The scheduler uses editorial points and conservative estimates, never live
   directions, opening hours, accessibility or ticket availability. */
function pointForStop(stop){
 if(!stop)return null;
 if(stop.kind==='place')return PLACES[stop.id]?.coordinates||null;
 if(stop.kind==='break')return stop.coordinates||null;
 const named=mentionedPlaceIds((stop.address||'')+' '+(stop.name||''));
 return named.length===1?PLACES[named[0]]?.coordinates||null:null;
}
function distanceKm(a,b){
 if(!a||!b)return null;
 const rad=x=>x*Math.PI/180,dLat=rad(b[0]-a[0]),dLon=rad(b[1]-a[1]);
 const h=Math.sin(dLat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLon/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
function estimateTravel(from,to,cfg){
 const mode=cfg.transport||'walk';
 if(!from||!to||to.kind==='break')return {minutes:0,distanceKm:0,mode,approximate:true,basis:'same-location'};
 const a=pointForStop(from),b=pointForStop(to),straight=distanceKm(a,b);
 if(straight===null)return {minutes:mode==='foot'?45:35,distanceKm:null,mode,approximate:true,basis:'buffer-unknown',note:'Адрес не распознан: заложен запас, дорогу нужно проверить.'};
 const km=straight*1.35;
 let duration;
 if(mode==='foot'||km<0.6)duration=km/(cfg.walkingLevel==='low'?3.2:4)*60+5;
 else if(mode==='car'||mode==='taxi')duration=12+km/20*60;
 else duration=15+km/22*60;
 return {minutes:Math.max(5,Math.ceil(duration/5)*5),distanceKm:Math.round(km*10)/10,mode,approximate:true,basis:'editorial-distance',note:'Оценка по приблизительным точкам, без дорожной сети, пробок и расписаний.'};
}
function dayCapacity(cfg){
 const hours=(minutes(cfg.dayEnd)-minutes(cfg.dayStart))/60;
 const preferred=cfg.pace==='slow'?3:cfg.pace==='active'?5:4;
 return Math.min(cfg.walkingLevel==='low'?3:preferred,Math.max(1,Math.floor(hours/1.5)));
}
function reserveSlots(cfg,anchors){
 const start=minutes(cfg.dayStart),end=minutes(cfg.dayEnd),slots=[];
 let cursor=start,previous=null;
 for(const anchor of anchors.slice().sort((a,b)=>minutes(a.time)-minutes(b.time))){
  if(minutes(anchor.time)>cursor)slots.push({from:cursor,to:minutes(anchor.time),previous,next:anchor});
  cursor=Math.max(cursor,minutes(anchor.time)+Number(anchor.duration));previous=anchor;
 }
 if(cursor<end)slots.push({from:cursor,to:end,previous,next:null});
 return slots;
}
function mealDescription(cfg,signals){
 const caution=cfg.foodNeeds||isHardNo(cfg,'food',signals);
 return caution?'Самостоятельный перекус или еда с собой. Подходящие меню и аллергены не проверены; заведение не назначаем.':'Время на обед или ужин: выберите кафе самостоятельно или возьмите еду с собой. Сумма — резерв, не цена заведения.';
}
function planBreaks(cfg,anchors,index,available,signals){
 const start=minutes(cfg.dayStart),end=minutes(cfg.dayEnd),length=end-start,breaks=[],warnings=[];
 const requests=[];
 if(length>=300)requests.push({purpose:'meal',target:start+Math.min(150,Math.floor(length/3)),duration:45});
 if(length>=360)requests.push({purpose:'rest',target:start+270,duration:20});
 if(length>=570)requests.push({purpose:'meal',target:start+450,duration:45});
 let allowance=available;
 for(const [i,req] of requests.entries()){
  const gaps=reserveSlots(cfg,anchors.concat(breaks)).map(g=>{
   // A pause stays at the previous location; leave time to reach the next ticket.
   const buffer=g.next&&g.next.kind!=='break'?estimateTravel(g.previous||{kind:'fixed',name:'Место паузы'},g.next,cfg).minutes:0;
   return {...g,to:g.to-buffer};
  }).filter(g=>g.to-g.from>=req.duration);
  const fits=gaps.map(g=>({time:Math.max(g.from,Math.min(req.target,g.to-req.duration)),gap:g}));
  fits.sort((a,b)=>Math.abs(a.time-req.target)-Math.abs(b.time-req.target));
  if(!fits.length){warnings.push('Не удалось выделить '+(req.purpose==='meal'?'45 минут на питание':'паузу на отдых')+' между закреплёнными событиями. Проверьте плотность дня.');continue}
  const meal=req.purpose==='meal',desired=Number.isFinite(Number(cfg.mealReserve))?Math.max(0,Number(cfg.mealReserve)):1000;
  const cost=meal?Math.min(desired,Math.max(0,allowance)):0;
  const budgetWarning=meal&&cost<desired?'Резерв на питание меньше '+formatMoney(desired)+'. Еда с собой или дополнительные расходы требуют вашего решения.':'';
  allowance-=cost;
  breaks.push({kind:'break',id:'break-'+datesBetween(cfg.from,cfg.to)[index]+'-'+req.purpose+'-'+i,purpose:req.purpose,
   name:meal?'Пауза на питание':'Отдых без спешки',time:clock(fits[0].time),duration:req.duration,cost,locked:false,
   description:meal?mealDescription(cfg,signals):'Присядьте, отдохните и оцените самочувствие. При усталости сократите оставшуюся программу.',priceType:'budget-allowance',budgetWarning});
 }
 return {breaks,warnings,cost:breaks.reduce((s,b)=>s+b.cost,0)};
}
function walkingAtPlace(stop){
 const p=stop.kind==='place'?PLACES[stop.id]:null;
 return p?.tags.includes('walk')?Math.min(3,p.minutes*0.035):0;
}
function hydrateBreakPoints(stops){
 let previousPoint=null;
 for(const stop of stops){
  if(stop.kind==='break'){stop.coordinates=previousPoint?previousPoint.slice():null;continue}
  previousPoint=pointForStop(stop);
 }
 return stops;
}
function dayTravel(stops,cfg){
 const ordered=hydrateBreakPoints(stops.map(clone).sort((a,b)=>minutes(a.time)-minutes(b.time))),legs=[];
 for(let i=1;i<ordered.length;i++){
  const leg=estimateTravel(ordered[i-1],ordered[i],cfg);
  if(leg.minutes)legs.push({fromId:ordered[i-1].id,toId:ordered[i].id,...leg});
 }
 return legs;
}
function walkingTotal(stops,cfg){
 const legs=dayTravel(stops,cfg);
 return Math.round((stops.reduce((s,x)=>s+walkingAtPlace(x),0)+legs.reduce((s,l)=>s+(cfg.transport==='foot'?(l.distanceKm||0):Math.min(l.distanceKm||0,0.6)),0))*10)/10;
}
function originLegForDay(day,cfg){
 const address=itineraryOrigin(day,cfg),first=day.stops[0];
 if(!address||!first)return null;
 const leg=estimateTravel({kind:'fixed',name:'Старт',address},first,cfg);
 return leg.minutes?{fromId:'origin',toId:first.id,...leg}:null;
}
function scheduleProblems(day,cfg){
 const sorted=hydrateBreakPoints(day.stops.map(clone).sort((a,b)=>minutes(a.time)-minutes(b.time))),errors=[];
 for(let i=0;i<sorted.length;i++){
  const s=sorted[i],start=minutes(s.time),end=start+Number(s.duration);
  if(!Number.isFinite(start)||end>minutes(cfg.dayEnd)||start<minutes(cfg.dayStart))errors.push('Остановка выходит за границы дня.');
  if(i){const prev=sorted[i-1],required=estimateTravel(prev,s,cfg).minutes;
   if(start<minutes(prev.time)+Number(prev.duration)+required)errors.push('Не хватает времени между остановками.');
  }
 }
 const origin=originLegForDay({...day,stops:sorted},cfg);
 if(origin&&minutes(sorted[0].time)<minutes(cfg.dayStart)+origin.minutes)errors.push('Не хватает времени от места старта до первой остановки.');
 const limit=cfg.walkingLevel==='low'?3:cfg.walkingLevel==='high'?11:7;
 if(origin&&cfg.transport==='foot'&&walkingTotal(sorted,cfg)+(origin.distanceKm||0)>limit)errors.push('Путь от старта превышает выбранную пешую нагрузку.');
 return [...new Set(errors)];
}
function decorateDay(day,cfg,warnings=[]){
 hydrateBreakPoints(day.stops);
 day.travel=dayTravel(day.stops,cfg);day.walkingEstimateKm=walkingTotal(day.stops,cfg);
 const origin=originLegForDay(day,cfg);
 if(origin){day.travel.unshift(origin);day.walkingEstimateKm=Math.round((day.walkingEstimateKm+(cfg.transport==='foot'?(origin.distanceKm||0):Math.min(origin.distanceKm||0,0.6)))*10)/10}
 const walkingLimit=cfg.walkingLevel==='low'?3:cfg.walkingLevel==='high'?11:7;
 day.warnings=[...new Set([...warnings,...scheduleProblems(day,cfg),
  ...(day.walkingEstimateKm>walkingLimit?['Закреплённая программа превышает выбранную пешую нагрузку. Добавьте транспорт или сократите остановки.']:[]),
  ...(day.travel.some(l=>l.basis==='buffer-unknown')?['Часть адресов не распознана: время дороги заложено запасом, проверьте его в картах.']:[]),
  ...(cfg.stepFree?['Безбарьерность входов и переходов не проверена.']:[])])];
 day.estimateNote='Расстояния и дорога приблизительны. Часы работы, цены и доступность не проверены.';
 return day;
}
function chooseStopsForDay(area,cfg,signals,feedback,usage,index,dayBudget,events){
 const available=dayBudget.available,pool=area.places.filter(p=>placeEligible(p,cfg,signals,feedback));
 const wished=mentionedPlaceIds(cfg.dreamPlaces),max=Math.max(0,dayCapacity(cfg)-events.length);
 const booked=events.map(e=>e.kind==='place'?clone(e):({kind:'fixed',id:e.id,name:e.name,address:e.address,date:e.date,time:e.time,duration:Number(e.duration),cost:Number(e.cost),paid:!!e.paid,includeBudget:!!e.includeBudget,locked:true}));
 const lockedCost=booked.filter(s=>s.kind==='place').reduce((s,x)=>s+priceAllowance(PLACES[x.id],cfg.partySize),0);
 const pausePlan=planBreaks(cfg,booked,index,Math.max(0,available-lockedCost),signals),anchors=booked.concat(pausePlan.breaks).sort((a,b)=>minutes(a.time)-minutes(b.time));
 const chosen=[];let spent=lockedCost+pausePlan.cost;
 const timeSlots=reserveSlots(cfg,anchors).map(s=>({...s,cursor:s.from}));
 const walkingLimit=cfg.walkingLevel==='low'?3:cfg.walkingLevel==='high'?11:7;
 const activeLimit=cfg.pace==='slow'?250:cfg.pace==='active'?500:380;
 for(const slot of timeSlots){
  let previous=slot.previous;
  if(!previous&&cleanText(index>0&&cfg.overnightStay?cfg.hotelAddress:cfg.startLocation)){
   previous={kind:'fixed',id:'origin',address:index>0&&cfg.overnightStay?cfg.hotelAddress:cfg.startLocation,name:'Старт'};
  }
  while(chosen.length<max){
   hydrateBreakPoints(anchors.concat(chosen).sort((a,b)=>minutes(a.time)-minutes(b.time)));
   const benefits=cfg.profiles.map(p=>chosen.reduce((s,stop)=>s+placeTags(PLACES[stop.id]).filter(k=>rated(p,k)>0).length,0));
   const focus=benefits[0]<=benefits[1]?0:1;
   const candidates=pool.map(p=>{
    const stop={kind:'place',id:p.id,duration:p.minutes},leg=estimateTravel(previous,stop,cfg),arrival=slot.cursor+leg.minutes;
    const onward=slot.next?estimateTravel(stop,slot.next,cfg).minutes:0;
    return {p,stop,leg,arrival,onward};
   }).filter(x=>{
    if(chosen.some(s=>s.id===x.p.id)||booked.some(s=>s.id===x.p.id))return false;
    if(spent+priceAllowance(x.p,cfg.partySize)>available)return false;
    if(x.arrival+x.p.minutes+x.onward>slot.to)return false;
    const candidate={...x.stop,time:clock(x.arrival)},all=anchors.concat(chosen,candidate).sort((a,b)=>minutes(a.time)-minutes(b.time));
    if(scheduleProblems({date:datesBetween(cfg.from,cfg.to)[index],stops:all},cfg).length)return false;
    if(walkingTotal(all,cfg)>walkingLimit)return false;
    return chosen.reduce((s,p)=>s+p.duration,0)+x.p.minutes<=activeLimit;
   });
   if(!candidates.length)break;
   candidates.sort((a,b)=>{
    const score=x=>placeScore(x.p,cfg,signals,usage,index,focus,feedback)-x.leg.minutes*0.22+(wished.includes(x.p.id)?30:0);
    return score(b)-score(a)||a.p.id.localeCompare(b.p.id);
   });
   const pick=candidates[0],stop={...pick.stop,time:clock(pick.arrival),locked:false};
   chosen.push(stop);spent+=priceAllowance(pick.p,cfg.partySize);usage[pick.p.id]=(usage[pick.p.id]||0)+1;
   slot.cursor=pick.arrival+pick.p.minutes;previous=stop;
  }
 }
 let stops=chosen.concat(anchors).sort((a,b)=>minutes(a.time)-minutes(b.time));
 const meaningful=stops.filter(s=>s.kind!=='break'),lastEnd=meaningful.reduce((n,s)=>Math.max(n,minutes(s.time)+s.duration),0);
 // A short available programme may finish early; do not keep an isolated late dinner.
 stops=stops.filter(s=>s.kind!=='break'||(meaningful.length&&minutes(s.time)<=lastEnd+45));
 const warnings=pausePlan.warnings.concat(stops.filter(s=>s.kind==='break'&&s.budgetWarning).map(s=>s.budgetWarning));
 if(!chosen.length&&!booked.length)warnings.push('В каталоге нет подходящих остановок по этим ограничениям. Измените предпочтения или выберите места самостоятельно.');
 return {stops,availableBudget:available,plannedAllowance:stops.reduce((sum,s)=>sum+(s.kind==='place'?priceAllowance(PLACES[s.id],cfg.partySize):s.kind==='break'?s.cost:0),0),warnings};
}
function generateItinerary(cfg,priorFeedback){
 const error=validateConfig(cfg);if(error)throw new Error(error);
 const dates=datesBetween(cfg.from,cfg.to),signals=textSignals(cfg),feedback=priorFeedback||getFeedback(),areas=chooseAreas(cfg,dates,signals,feedback),usage={};
 const days=dates.map((date,i)=>{
  const events=cfg.events.filter(e=>e.date===date),budget=budgetForDay(cfg,i,dates.length,events),area=AREA_BY_ID[areas[i]];
  const planned=chooseStopsForDay(area,cfg,signals,feedback,usage,i,budget,events);
  return decorateDay({date,areaId:area.id,limit:budget.total,reserve:budget.reserve,eventBudget:budget.eventCost,stops:planned.stops},cfg,planned.warnings);
 });
 const wished=mentionedPlaceIds(cfg.dreamPlaces),included=days.flatMap(d=>d.stops).filter(s=>s.kind==='place').map(s=>s.id);
 return {schema:6,id:String(Date.now())+'-'+Math.random().toString(36).slice(2,7),createdAt:new Date().toISOString(),config:clone(cfg),days,signals,
  meta:{engine:'local',catalog:'editorial',priceType:'budget-allowance',travelType:'editorial-estimate',wishlistMatched:wished.filter(id=>included.includes(id)),wishlistMissed:wished.filter(id=>!included.includes(id))}};
}
function countedEventSpend(day){return day.stops.filter(s=>s.kind==='fixed').reduce((n,s)=>n+bookingCost(s),0)}
function daySpending(day,cfg){
 const place=day.stops.filter(s=>s.kind==='place').reduce((n,s)=>n+priceAllowance(PLACES[s.id]||{cost:0},cfg.partySize),0);
 const fixed=countedEventSpend(day);
 const reserved=day.reserve?.total||0,breaks=day.stops.filter(s=>s.kind==='break').reduce((s,b)=>s+Math.max(0,Number(b.cost)||0),0);
 return {place,fixed,reserved,breaks,total:place+fixed+reserved+breaks};
}
function totalSpend(plan){return plan.days.reduce((s,day)=>s+daySpending(day,plan.config).total,0)}
function totalLimit(cfg,days){return cfg.budgetAmount*(cfg.budgetScope==='daily'?days:1)}
function mapLink(address){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address||'Москва')}
function mapLinkYandex(address){return 'https://yandex.ru/maps/?text='+encodeURIComponent(address||'Москва')}
function itineraryOrigin(day,cfg){
 // Explicit starting point is used as a map search hint, not as a time estimate.
 if(cfg.overnightStay&&day.date>cfg.from&&cleanText(cfg.hotelAddress,180))
   return cleanText(cfg.hotelAddress,180);
 return cleanText(cfg.startLocation,120)||(cfg.overnightStay?cleanText(cfg.hotelAddress,180):'');
}
function dayMap(day,cfg){
 const addresses=day.stops.map(s=>s.kind==='fixed'?s.address:PLACES[s.id]?.address).filter(Boolean);
 const userOrigin=itineraryOrigin(day,cfg);
 const points=userOrigin?[userOrigin,...addresses]:addresses;
 if(!points.length)return 'https://www.google.com/maps';
 if(points.length===1)return mapLink(points[0]);
 const mode=cfg.transport==='car'||cfg.transport==='taxi'?'driving':cfg.transport==='walk'?'transit':'walking';
 let url='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(points[0])+
  '&destination='+encodeURIComponent(points[points.length-1])+'&travelmode='+mode;
 if(points.length>2)url+='&waypoints='+encodeURIComponent(points.slice(1,-1).join('|'));
 return url;
}
function candidateFits(plan,dayIndex,stopIndex,p){
 const day=clone(plan.days[dayIndex]),cfg=plan.config,old=day.stops[stopIndex];
 day.stops[stopIndex]={...old,id:p.id,duration:p.minutes};
 if(daySpending(day,cfg).total>day.limit)return false;
 if(totalSpend({...plan,days:plan.days.map((d,i)=>i===dayIndex?day:d)})>totalLimit(cfg,plan.days.length))return false;
 return !scheduleProblems(day,cfg).length&&walkingTotal(day.stops,cfg)<=(cfg.walkingLevel==='low'?3:cfg.walkingLevel==='high'?11:7);
}
function alternativesFor(plan,dayIndex,stopIndex,feedback){
 const day=plan.days[dayIndex],st=day?.stops[stopIndex];
 if(!st||st.kind!=='place'||st.locked)return [];
 const area=AREA_BY_ID[day.areaId],cfg=plan.config,signals=plan.signals||textSignals(cfg),prior=feedback||getFeedback();
 const used={};for(const d of plan.days)for(const s of d.stops)if(s.kind==='place'&&s.id!==st.id)used[s.id]=(used[s.id]||0)+1;
 const oldTags=placeTags(PLACES[st.id]);
 return area.places.filter(p=>p.id!==st.id&&!day.stops.some(s=>s.kind==='place'&&s.id===p.id)&&placeEligible(p,cfg,signals,prior)&&candidateFits(plan,dayIndex,stopIndex,p))
  .sort((a,b)=>(placeScore(b,cfg,signals,used,dayIndex,null,prior)+placeTags(b).filter(t=>oldTags.includes(t)).length*4)
    -(placeScore(a,cfg,signals,used,dayIndex,null,prior)+placeTags(a).filter(t=>oldTags.includes(t)).length*4)).slice(0,5);
}
function safeSwapStop(plan,dayIndex,stopIndex,placeId,feedback){
 if(!alternativesFor(plan,dayIndex,stopIndex,feedback).some(p=>p.id===placeId))throw new Error('Замена не помещается в расписание, бюджет или ограничения.');
 const next=clone(plan),day=next.days[dayIndex],p=PLACES[placeId];
 day.stops[stopIndex]={...day.stops[stopIndex],id:p.id,duration:p.minutes};
 decorateDay(day,next.config,(day.warnings||[]).filter(w=>!w.startsWith('Не хватает времени')));
 return next;
}
function rebuildDay(plan,dayIndex,feedback){
 const next=clone(plan),cfg=next.config,day=next.days[dayIndex];
 if(!day)throw new Error('День не найден.');
 const anchors=day.stops.filter(s=>s.kind==='fixed'||(s.kind==='place'&&s.locked)),prior=feedback||getFeedback(),signals=textSignals(cfg),usage={};
 for(let i=0;i<next.days.length;i++)if(i!==dayIndex)for(const stop of next.days[i].stops)if(stop.kind==='place')usage[stop.id]=(usage[stop.id]||0)+1;
 let area=AREA_BY_ID[day.areaId];
 if(!anchors.length){
  const candidates=AREAS.filter(a=>a.id!==area.id&&areaQuality(a,cfg,signals,prior)>-900);
  candidates.sort((a,b)=>areaQuality(b,cfg,signals,prior)-areaQuality(a,cfg,signals,prior));
  area=candidates.find(a=>cfg.journeyMode!=='connected'||NEARBY[day.areaId]?.includes(a.id))||candidates[0]||area;
 }
 const budget=budgetForDay(cfg,dayIndex,next.days.length,anchors.filter(s=>s.kind==='fixed'));
 const excluded={...prior};for(const s of day.stops)if(s.kind==='place'&&!s.locked)excluded[s.id]='no';
 let built=chooseStopsForDay(area,cfg,signals,excluded,usage,dayIndex,budget,anchors);
 if(!built.stops.some(s=>s.kind==='place')&&!anchors.length)built=chooseStopsForDay(area,cfg,signals,prior,usage,dayIndex,budget,anchors);
 day.areaId=area.id;day.stops=built.stops;next.signals=signals;decorateDay(day,cfg,built.warnings);
 if(daySpending(day,cfg).total>day.limit)throw new Error('Пересборка превышает бюджет дня.');
 return next;
}
function hasRealOverlap(stops){
 const sorted=stops.slice().sort((a,b)=>minutes(a.time)-minutes(b.time));
 return sorted.some((s,i)=>i>0&&minutes(s.time)<minutes(sorted[i-1].time)+Number(sorted[i-1].duration));
}
