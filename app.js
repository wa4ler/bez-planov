'use strict';
/* Без планов · v0.3. Редакционная база и локальный алгоритм, не онлайн-ИИ. */

const P = (id,name,tags,cost,minutes,description,address) =>
  ({id,name,tags,cost,minutes,description,address});
const AREAS = [
  {id:'center',name:'Сердце Москвы',subtitle:'Красная площадь, Никольская и Зарядье',places:[
    P('red-square','Красная площадь',['history','walk','romance'],0,50,'Погуляйте среди архитектуры, с которой начинается знакомство с Москвой.','Красная площадь, Москва'),
    P('gum','ГУМ',['history','walk'],0,45,'Исторические торговые ряды и узнаваемые интерьеры.','Красная площадь, 3, Москва'),
    P('nikolskaya','Никольская улица',['walk','romance'],0,40,'Пешеходная улица с красивыми фасадами и городской атмосферой.','Никольская улица, Москва'),
    P('vokrug-sveta','Фудхолл «Вокруг света»',['food','unusual'],2200,65,'Несколько гастрономических направлений в одном месте.','Никольская улица, 10, Москва'),
    P('history-museum','Государственный исторический музей',['history','art'],2200,90,'Погружение в историю страны. Условия посещения уточните заранее.','Красная площадь, 1, Москва'),
    P('zaryadye','Парк «Зарядье»',['nature','walk','unusual'],0,65,'Ландшафтный парк в самом центре города.','улица Варварка, 6, Москва'),
    P('floating-bridge','Парящий мост',['romance','walk','unusual'],0,30,'Виды на реку и набережные Москвы.','Парк Зарядье, Москва'),
    P('st-basil','Собор Василия Блаженного · снаружи',['history','art'],0,30,'Осмотрите архитектуру собора снаружи; вход внутрь требует отдельной проверки.','Красная площадь, 7, Москва')
  ]},
  {id:'zamos',name:'Замоскворечье',subtitle:'Искусство, тихие улицы и остров',places:[
    P('tretyakov','Третьяковская галерея',['art','history'],2000,105,'Одна из главных художественных коллекций Москвы.','Лаврушинский переулок, 10, Москва'),
    P('ordynka','Большая Ордынка',['walk','history'],0,45,'Камерные переулки, усадьбы и историческая застройка.','Большая Ордынка, Москва'),
    P('pyatnitskaya','Пятницкая улица',['walk','romance'],0,55,'Прогулка среди старых московских фасадов.','Пятницкая улица, Москва'),
    P('bjorn','Ресторан Björn',['food','romance','unusual'],5200,80,'Гастрономическая остановка; стоимость и бронирование обязательно уточняйте.','Пятницкая улица, 3/4, строение 1, Москва'),
    P('bolotnaya','Болотная площадь',['walk','history'],0,40,'Площадь и вид на центр через реку.','Болотная площадь, Москва'),
    P('ges2','Дом культуры «ГЭС-2»',['art','unusual'],0,90,'Современное культурное пространство. Уточните программу и порядок входа.','Болотная набережная, 15, Москва'),
    P('patriarshy-bridge','Патриарший мост',['walk','romance'],0,35,'Панорама реки и городских куполов.','Патриарший мост, Москва')
  ]},
  {id:'gorky',name:'Парки и Хамовники',subtitle:'Парк Горького, набережные и музеи',places:[
    P('muzeon','Парк искусств «Музеон»',['art','walk','nature'],0,60,'Уличное искусство и спокойные аллеи.','Крымский Вал, 2, Москва'),
    P('krymskaya','Крымская набережная',['walk','romance'],0,45,'Широкая набережная для прогулки без спешки.','Крымская набережная, Москва'),
    P('gorky-park','Парк Горького',['walk','nature','activity'],0,75,'Пространство для прогулки и отдыха у воды.','Крымский Вал, 9, Москва'),
    P('neskuchny','Нескучный сад',['nature','romance','walk'],0,75,'Тихие дорожки и зелёные склоны в центре мегаполиса.','Нескучный сад, Москва'),
    P('museum-moscow','Музей Москвы',['history','art'],1400,75,'Выставки об истории и современной жизни столицы.','Зубовский бульвар, 2, Москва'),
    P('usachevsky','Усачёвский рынок',['food','unusual'],2300,65,'Гастрономическая остановка с разными форматами еды.','улица Усачёва, 26, Москва'),
    P('frunzenskaya','Фрунзенская набережная',['walk','romance'],0,50,'Прогулка вдоль Москвы-реки с видами на город.','Фрунзенская набережная, Москва')
  ]},
  {id:'arbat',name:'Арбат и бульвары',subtitle:'Исторические улицы и культурные открытия',places:[
    P('arbat-old','Старый Арбат',['walk','history','romance'],0,60,'Пешеходная улица с музыкантами и историческими домами.','улица Арбат, Москва'),
    P('pushkin-house','Мемориальная квартира А. С. Пушкина',['history','art'],1000,65,'Дом-музей на Арбате. Расписание уточните перед посещением.','улица Арбат, 53, Москва'),
    P('varenichnaya','«Вареничная № 1» на Арбате',['food'],1700,70,'Непринуждённый обед в районе Старого Арбата.','улица Арбат, Москва, Вареничная №1'),
    P('gogol-blvd','Гоголевский бульвар',['nature','walk','romance'],0,50,'Аллеи, городская архитектура и спокойный маршрут.','Гоголевский бульвар, Москва'),
    P('pushkin-art','ГМИИ имени А. С. Пушкина',['art','history'],1900,95,'Музей мирового искусства. Билеты и часы нужно проверить.','улица Волхонка, 12, Москва'),
    P('christ-savior','Храм Христа Спасителя · снаружи',['history','walk'],0,35,'Архитектурная доминанта и панорамы поблизости.','улица Волхонка, 15, Москва'),
    P('khudozhestvenny','Кинотеатр «Художественный»',['activity','romance','history'],2200,120,'Исторический кинотеатр; выберите подходящий сеанс заранее.','Арбатская площадь, 14, Москва')
  ]},
  {id:'patriki',name:'Патриаршие и Тверская',subtitle:'Тихие пруды, театр и городские истории',places:[
    P('patriarch-ponds','Патриаршие пруды',['walk','romance','nature'],0,55,'Неспешная прогулка по одному из атмосферных районов Москвы.','Патриаршие пруды, Москва'),
    P('bulgakov','Музей М. А. Булгакова',['history','art','unusual'],1100,70,'Место, связанное с литературной историей города.','Большая Садовая улица, 10, Москва'),
    P('planetarium','Московский планетарий',['unusual','activity'],2500,95,'Космическое приключение, требующее проверки сеансов.','Садовая-Кудринская улица, 5, строение 1, Москва'),
    P('tverskoy-blvd','Тверской бульвар',['walk','romance'],0,45,'Один из красивейших участков Бульварного кольца.','Тверской бульвар, Москва'),
    P('pushkin-cafe','Кафе «Пушкинъ»',['food','romance'],5500,80,'Атмосферный ресторан в историческом стиле; бронирование и цены уточняйте.','Тверской бульвар, 26А, Москва'),
    P('hermitage-garden','Сад «Эрмитаж»',['nature','walk','romance'],0,60,'Уютный сад для небольшой паузы в городской суете.','улица Каретный Ряд, 3, Москва'),
    P('depo-lesnaya','Гастромаркет «Депо»',['food','unusual'],2400,70,'Большой выбор гастрономических форматов в одном пространстве.','Лесная улица, 20, Москва'),
    P('moscow-zoo','Московский зоопарк',['nature','activity'],2600,105,'Знакомство с обитателями зоопарка; проверьте режим работы.','Большая Грузинская улица, 1, Москва')
  ]},
  {id:'city',name:'Москва-Сити',subtitle:'Высота, огни и Москва-река',places:[
    P('moscow-city','Деловой центр «Москва-Сити»',['walk','unusual'],0,45,'Небоскрёбы и современная архитектура Москвы.','Пресненская набережная, Москва'),
    P('afimall','ТРЦ «Афимолл Сити»',['activity','walk'],0,55,'Пространство для отдыха и прогулки в городе.','Пресненская набережная, 2, Москва'),
    P('afimall-food','Фуд-корт «Афимолл Сити»',['food'],1900,65,'Перерыв на еду с выбором заведения на месте.','Афимолл Сити, Москва'),
    P('panorama360','Смотровая площадка PANORAMA360',['unusual','romance','activity'],4400,90,'Панорамные виды на столицу; бронируйте билеты заранее.','Пресненская набережная, 12, Москва'),
    P('bagration','Мост Багратион',['walk','history'],0,35,'Пешеходный мост над Москвой-рекой.','Мост Багратион, Москва'),
    P('shevchenko','Набережная Тараса Шевченко',['walk','romance'],0,60,'Красивые виды на небоскрёбы с другого берега.','набережная Тараса Шевченко, Москва'),
    P('krasnaya-presnya','Парк «Красная Пресня»',['nature','walk'],0,60,'Зелёный отдых недалеко от делового центра.','Мантулинская улица, 5, Москва')
  ]},
  {id:'vdnh',name:'ВДНХ и Останкино',subtitle:'Большая прогулка и научные открытия',places:[
    P('vdnh-arch','Арка главного входа ВДНХ',['history','walk'],0,30,'Парадное начало прогулки по знаменитому комплексу.','проспект Мира, 119, Москва'),
    P('vdnh-park','ВДНХ',['walk','history','nature'],0,80,'Знаменитые павильоны, площади и длинные аллеи.','проспект Мира, 119, Москва'),
    P('cosmos','Центр «Космонавтика и авиация»',['history','unusual','art'],1800,100,'Экспозиция о космосе в павильоне «Космос».','ВДНХ, павильон 34, Москва'),
    P('moskvarium','Москвариум',['activity','nature','unusual'],5500,115,'Океанариум на ВДНХ; актуальные цены и сеансы проверьте.','ВДНХ, Москвариум, Москва'),
    P('sun-moscow','Колесо обозрения «Солнце Москвы»',['activity','romance'],2600,60,'Посмотрите на город с высоты. Работа зависит от условий.','2-я Останкинская улица, 3, Москва'),
    P('botanical','Главный ботанический сад РАН',['nature','walk'],0,90,'Просторное место для прогулок среди зелени.','Ботаническая улица, 4, Москва'),
    P('moscow-sky','Ресторан «Московское небо»',['food','romance'],4400,80,'Пауза на обед или ужин на территории ВДНХ.','ВДНХ, ресторан Московское небо, Москва')
  ]},
  {id:'kolomenskoye',name:'Коломенское',subtitle:'Парки, деревянная архитектура и история',places:[
    P('kolom-park','Музей-заповедник «Коломенское»',['nature','walk','history'],0,70,'Исторический парк с большими открытыми пространствами.','проспект Андропова, 39, Москва'),
    P('ascension','Церковь Вознесения в Коломенском · снаружи',['history','art'],0,40,'Памятник архитектуры на высоком берегу реки.','Коломенское, церковь Вознесения, Москва'),
    P('palace-alexei','Дворец царя Алексея Михайловича',['history','art','unusual'],2200,85,'Историческая реконструкция дворцового комплекса.','проспект Андропова, 39, Москва'),
    P('gol-os','Голосов овраг',['nature','unusual','walk'],0,70,'Необычный природный ландшафт парка; учитывайте погоду.','Голосов овраг, Коломенское, Москва'),
    P('kolom-river','Набережная в Коломенском',['walk','romance','nature'],0,55,'Виды на Москву-реку и спокойная прогулка.','Коломенское, набережная Москвы-реки, Москва'),
    P('kazan-church','Казанская церковь в Коломенском · снаружи',['history','art'],0,40,'Архитектура XVII века среди зелени заповедника.','Коломенское, Казанская церковь, Москва')
  ]}
];
const AREA_BY_ID = Object.fromEntries(AREAS.map(a=>[a.id,a]));
const PLACES = Object.fromEntries(AREAS.flatMap(a=>a.places.map(p=>[p.id,p])));
const TAGS = {food:'Кафе и еда',walk:'Прогулки',art:'Искусство',history:'История',activity:'Развлечения',nature:'Природа',romance:'Атмосфера',unusual:'Необычное'};
const MODE = {connected:'Единое путешествие',independent:'Отдельные дни'};
const PACE = {slow:3,balanced:4,active:5};
const DATA_KEY = 'bezPlanovPlansV3';
const FAVORITES_KEY = 'bezPlanovFavoritesV3';
let currentPlan = null;
let currentDay = 0;
let openSwap = null;
let currentStep = 1;

function $(id){return document.getElementById(id)}
function safe(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function money(n){return new Intl.NumberFormat('ru-RU').format(Math.round(Number(n)||0))+' ₽'}
function daysWord(n){return n%10===1&&n%100!==11?'день':([2,3,4].includes(n%10)&&![12,13,14].includes(n%100)?'дня':'дней')}
function dateObj(s){return new Date(s+'T12:00:00')}
function isoLocal(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function dateLabel(s){return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long'}).format(dateObj(s))}
function shortDate(s){return new Intl.DateTimeFormat('ru-RU',{weekday:'short',day:'numeric',month:'short'}).format(dateObj(s))}
function dayDates(from,to){
  const start=dateObj(from),end=dateObj(to),result=[];
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime()))return [];
  for(let t=new Date(start);t<=end&&result.length<=14;t.setDate(t.getDate()+1))result.push(isoLocal(t));
  return result;
}
function readJSON(key){try{const x=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(x)?x:[]}catch(e){return []}}
function saveJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(e){alert('Не удалось записать данные в память браузера.');return false}}
function getSaved(){return readJSON(DATA_KEY)}
function getFavorites(){return readJSON(FAVORITES_KEY).filter(x=>PLACES[x])}
function setScreen(name){
  ['home','builder','results','saved'].forEach(id=>{$('view-'+id).hidden=id!==name});
  if(name==='saved')renderLibrary();
  document.querySelectorAll('[data-screen]').forEach(b=>{if(b.classList.contains('navlink'))b.setAttribute('aria-current',b.dataset.screen===name?'page':'false')});
  window.scrollTo({top:0,behavior:'instant'});
}
function startBuilder(){
  changeStep(1);
  setScreen('builder');
}
function changeStep(n){
  currentStep=n;
  $('stepOne').hidden=n!==1;
  $('stepTwo').hidden=n!==2;
  $('progressOne').classList.toggle('on',true);
  $('progressTwo').classList.toggle('on',n===2);
  $('stepBack').hidden=n===1;
  $('stepNext').hidden=n===2;
  $('buildNow').hidden=n===1;
  $('plannerError').textContent='';
  if(n===2)window.scrollTo({top:0,behavior:'instant'});
}
function selectedInterests(){return Array.from(document.querySelectorAll('[data-interest][aria-pressed="true"]')).map(b=>b.dataset.interest)}
function budgetPerDay(cfg,dayIndex,numDays){
  if(cfg.budgetScope==='daily')return cfg.budgetAmount;
  const base=Math.floor(cfg.budgetAmount/numDays);
  return base+(dayIndex<cfg.budgetAmount%numDays?1:0);
}
function estimatedCost(place,party){return Math.round(place.cost*party/2/50)*50}
function validateFirst(){
  const from=$('dateFrom').value,to=$('dateTo').value;
  const days=dayDates(from,to);
  if(!from||!to)return 'Укажите дату начала и окончания.';
  if(!days.length||to<from)return 'Дата окончания должна быть не раньше даты начала.';
  if(days.length>14)return 'Сейчас можно выбрать период до 14 дней включительно.';
  const today=isoLocal(new Date());
  if(from<today)return 'Выберите сегодняшнюю или будущую дату.';
  const amount=Number($('budgetAmount').value);
  if(!Number.isFinite(amount)||amount<500||amount>10000000)return 'Укажите бюджет от 500 до 10 000 000 ₽.';
  const total=$('budgetScope').value==='daily'?amount*days.length:amount;
  if(total/days.length<500)return 'На каждый день должно приходиться хотя бы 500 ₽. Увеличьте бюджет.';
  return '';
}
function updatePeriod(){
  const days=dayDates($('dateFrom').value,$('dateTo').value);
  const valid=days.length>0&&days.length<=14&&$('dateTo').value>=$('dateFrom').value;
  const amount=Number($('budgetAmount').value)||0;
  const count=days.length;
  $('periodNote').textContent=valid?
    (count===1?'Один день':count+' '+(count%10===1&&count%100!==11?'день':([2,3,4].includes(count%10)&&![12,13,14].includes(count%100)?'дня':'дней')))+' · '+dateLabel(days[0])+(count>1?' — '+dateLabel(days[count-1]):'')+' · бюджет всего '+money($('budgetScope').value==='daily'?amount*count:amount):
    'Выберите период от 1 до 14 дней включительно.';
}
function readConfig(){
  return {
    from:$('dateFrom').value,to:$('dateTo').value,
    budgetAmount:Number($('budgetAmount').value),
    budgetScope:$('budgetScope').value,
    groupSize:Number($('groupSize').value),
    journeyMode:$('journeyMode').value,
    interests:selectedInterests(),
    pace:$('pace').value,
    startTime:Number($('startTime').value),
    startPoint:$('startPoint').value.trim(),
    transport:$('transport').value
  };
}
function areaHint(text){
  const t=text.toLowerCase();
  const match=[
    [/красн|охотн|китай|лубян|заряд|гум/, 'center'],
    [/трет|пятниц|новокузнец|ордын|замоск/, 'zamos'],
    [/парк культур|горьк|фрунзен|октябрьск|музеон/, 'gorky'],
    [/арбат|кропоткин|смоленск/, 'arbat'],
    [/твер|патриар|маяк|пушкинск|баррикад|белорус/, 'patriki'],
    [/делов|выставочн|сити|международн/, 'city'],
    [/вднх|останкин|ботанич/, 'vdnh'],
    [/коломенск|каширск/, 'kolomenskoye']
  ];
  const hit=match.find(x=>x[0].test(t));return hit?hit[1]:null;
}
function areaSelections(cfg,n){
  const score=a=>a.places.reduce((s,p)=>s+p.tags.filter(t=>cfg.interests.includes(t)).length,0);
  const ranked=AREAS.slice().sort((a,b)=>score(b)-score(a)||AREAS.indexOf(a)-AREAS.indexOf(b));
  const hinted=areaHint(cfg.startPoint);
  if(hinted){const i=ranked.findIndex(a=>a.id===hinted);if(i>0)ranked.unshift(ranked.splice(i,1)[0])}
  if(cfg.journeyMode==='independent')return Array.from({length:n},(_,i)=>ranked[i%ranked.length]);
  const geographic=['center','zamos','gorky','arbat','patriki','city','vdnh','kolomenskoye'];
  const start=geographic.indexOf(ranked[0].id);
  return Array.from({length:n},(_,i)=>AREA_BY_ID[geographic[(start+i)%geographic.length]]);
}
function stopScore(p,cfg,usage){
  const matched=p.tags.filter(t=>cfg.interests.includes(t)).length;
  return matched*18 + (p.tags.includes('walk')?3:0) + (p.tags.includes('food')?2:0)
    - (usage[p.id]||0)*18;
}
function buildDay(area,cfg,date,limit,usage){
  const max=Math.min(PACE[cfg.pace],cfg.startTime>=15?3:5);
  const pool=area.places.map((p,order)=>({p,order,score:stopScore(p,cfg,usage)}))
    .sort((a,b)=>b.score-a.score||a.order-b.order);
  const chosen=[];
  let spend=0;
  const chosenTags=new Set();
  function take(entry){
    chosen.push(entry);
    spend+=estimatedCost(entry.p,cfg.groupSize);
    entry.p.tags.forEach(x=>chosenTags.add(x));
  }
  const food=pool.find(e=>e.p.tags.includes('food')&&estimatedCost(e.p,cfg.groupSize)<=limit&&
    cfg.startTime<=12&&max>=3);
  if(food)take(food);
  while(chosen.length<max){
    const remaining=pool.filter(e=>!chosen.includes(e)&&spend+estimatedCost(e.p,cfg.groupSize)<=limit);
    if(!remaining.length)break;
    remaining.sort((a,b)=>(b.score+(b.p.tags.some(t=>!chosenTags.has(t))?6:0))-
      (a.score+(a.p.tags.some(t=>!chosenTags.has(t))?6:0))||a.order-b.order);
    take(remaining[0]);
  }
  if(!chosen.length)return {date,areaId:area.id,stops:[],budget:limit};
  chosen.sort((a,b)=>a.order-b.order);
  let time=cfg.startTime*60;
  const stops=chosen.map(e=>{
    const h=Math.floor(time/60),m=time%60;
    const result={id:e.p.id,locked:false,time:String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')};
    time+=e.p.minutes+20;
    usage[e.p.id]=(usage[e.p.id]||0)+1;
    return result;
  });
  return {date,areaId:area.id,stops,budget:limit};
}
function generatePlan(){
  const cfg=readConfig(),dates=dayDates(cfg.from,cfg.to);
  const areas=areaSelections(cfg,dates.length);
  const usage={};
  const days=dates.map((date,i)=>buildDay(areas[i],cfg,date,budgetPerDay(cfg,i,dates.length),usage));
  return {id:String(Date.now())+'-'+Math.random().toString(36).slice(2,8),createdAt:new Date().toISOString(),config:cfg,days};
}
function recalculateTimes(day,cfg){
  let mins=cfg.startTime*60;
  day.stops.forEach(s=>{
    s.time=String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');
    mins+=(PLACES[s.id]?PLACES[s.id].minutes:60)+20;
  });
}
function totalDay(day,cfg){return day.stops.reduce((s,stop)=>s+estimatedCost(PLACES[stop.id]||{cost:0},cfg.groupSize),0)}
function totalPlan(plan){return plan.days.reduce((s,d)=>s+totalDay(d,plan.config),0)}
function totalBudget(plan){return plan.config.budgetAmount*(plan.config.budgetScope==='daily'?plan.days.length:1)}
function mapSearch(p){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.address)}
function mapRoute(day,cfg){
  const p=day.stops.map(x=>PLACES[x.id]).filter(Boolean);
  if(!p.length)return 'https://www.google.com/maps';
  if(p.length===1)return mapSearch(p[0]);
  let url='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(p[0].address)+'&destination='+encodeURIComponent(p[p.length-1].address)+'&travelmode='+(cfg.transport==='car'||cfg.transport==='taxi'?'driving':'walking');
  if(p.length>2)url+='&waypoints='+encodeURIComponent(p.slice(1,-1).map(x=>x.address).join('|'));
  return url;
}
function formatTime(t){return t}
function renderResult(){
  if(!currentPlan)return;
  const plan=currentPlan,cfg=plan.config,days=plan.days;
  $('planHeading').textContent=days.length===1?'Один день в Москве':'Ваши '+days.length+' дней в Москве';
  $('planSubtitle').textContent=dateLabel(cfg.from)+(days.length>1?' — '+dateLabel(cfg.to):'')+' · '+MODE[cfg.journeyMode]+' · '+cfg.groupSize+' чел.'+(cfg.startPoint?' · старт: '+cfg.startPoint:'');
  const total=totalPlan(plan),max=totalBudget(plan);
  $('resultStats').innerHTML=
    '<div class="summary-stat"><strong>'+days.length+'</strong><span>Дней путешествия</span></div>'+
    '<div class="summary-stat"><strong>'+days.reduce((s,d)=>s+d.stops.length,0)+'</strong><span>Остановок в программе</span></div>'+
    '<div class="summary-stat"><strong>'+money(total)+'</strong><span>Плановые траты на места</span></div>'+
    '<div class="summary-stat"><strong>'+money(max)+'</strong><span>Ваш общий лимит</span></div>';
  $('daysNav').innerHTML=days.map((day,i)=>
    '<button type="button" role="tab" aria-selected="'+(i===currentDay)+'" class="day-tab'+(i===currentDay?' active':'')+'" data-action="choose-day" data-index="'+i+'">День '+(i+1)+'<small>'+safe(shortDate(day.date))+'</small></button>'
  ).join('');
  renderDay();
  const saved=getSaved().find(x=>x.id===plan.id);
  $('saveCurrent').textContent=saved&&JSON.stringify(saved)===JSON.stringify(plan)?'✓ Сохранено':(saved?'♡ Сохранить изменения':'♡ Сохранить');
}
function renderDay(){
  const plan=currentPlan;if(!plan)return;
  const day=plan.days[currentDay],cfg=plan.config,area=AREA_BY_ID[day.areaId];
  const total=totalDay(day,cfg),percent=Math.min(100,day.budget?total/day.budget*100:0);
  const favs=getFavorites();
  const stops=day.stops.map((st,i)=>{
    const p=PLACES[st.id];if(!p)return '';
    const isFav=favs.includes(p.id),swapOpen=openSwap===currentDay+':'+i;
    const remaining=day.budget-total;
    const candidates=area.places.filter(q=>q.id!==p.id&&!day.stops.some(s=>s.id===q.id)&&
      estimatedCost(q,cfg.groupSize)-estimatedCost(p,cfg.groupSize)<=remaining)
      .sort((a,b)=>(b.tags.filter(t=>p.tags.includes(t)).length)-(a.tags.filter(t=>p.tags.includes(t)).length))
      .slice(0,3);
    const choices=swapOpen?'<div class="swap-options"><strong style="font-size:11px">Выберите замену в этом районе</strong>'+
      (candidates.length?candidates.map(q=>
        '<button type="button" class="swap-option" data-action="apply-swap" data-stop="'+i+'" data-new="'+safe(q.id)+'">'+safe(q.name)+
        '<small>Ориентир '+money(estimatedCost(q,cfg.groupSize))+' · '+safe(q.minutes)+' мин на месте</small></button>').join(''):
        '<div class="empty-note">В выбранном бюджете другие места этого района не найдены. Попробуйте изменить бюджет или интересы.</div>')+
      '</div>':'';
    return '<div class="stop-item">'+
      '<div class="stop-clock">'+safe(formatTime(st.time))+'</div><span class="stop-pin"></span>'+
      '<article class="stop-main"><div class="stop-topline"><div>'+
        '<span class="stop-type">'+safe(TAGS[p.tags[0]]||'Впечатления')+'</span>'+
        '<h4>'+safe(p.name)+'</h4></div><span style="font-size:19px">'+(st.locked?'🔒':'✧')+'</span></div>'+
        '<p>'+safe(p.description)+'</p>'+
        '<div class="stop-meta"><span>≈ '+safe(p.minutes)+' мин на месте</span><span>План: '+money(estimatedCost(p,cfg.groupSize))+'</span></div>'+
        '<div class="stop-actions">'+
        '<a href="'+safe(mapSearch(p))+'" target="_blank" rel="noopener noreferrer" class="text-btn" aria-label="Показать на карте '+safe(p.name)+'">На карте ↗</a>'+
        '<button type="button" class="text-btn" data-action="swap-menu" data-stop="'+i+'" '+(st.locked?'disabled title="Сначала открепите остановку"':'')+'>Заменить</button>'+
        '<button type="button" class="text-btn'+(st.locked?' active':'')+'" data-action="toggle-lock" data-stop="'+i+'">'+(st.locked?'Открепить':'Закрепить')+'</button>'+
        '<button type="button" class="text-btn'+(isFav?' active':'')+'" data-action="toggle-favorite" data-place="'+safe(p.id)+'" aria-pressed="'+isFav+'">'+(isFav?'♥ В избранном':'♡ В избранное')+'</button>'+
        '</div>'+choices+'</article></div>';
  }).join('');
  $('dayContent').innerHTML=
    '<div class="day-layout"><article class="surface day-card"><div class="day-card-head"><div>'+
      '<span class="eyebrow">День '+(currentDay+1)+' · '+safe(shortDate(day.date))+'</span>'+
      '<h3>'+safe(area.name)+'</h3><p>'+safe(area.subtitle)+'</p></div><span class="day-badge">'+day.stops.length+' мест</span></div>'+
      '<div class="stop-list">'+(stops||'<p>Для выбранного бюджета не удалось подобрать места. Попробуйте увеличить бюджет.</p>')+'</div></article>'+
      '<aside class="surface day-aside"><span class="eyebrow">День '+(currentDay+1)+'</span><h3>Расходы и маршрут</h3>'+
      '<p>Плановые суммы на посещения и еду для '+cfg.groupSize+' чел.</p>'+
      '<div class="day-spend">'+money(total)+'</div>'+
      '<div class="money-track"><span style="width:'+percent+'%"></span></div>'+
      '<div class="legend"><span>Бюджет дня: '+money(day.budget)+'</span><span>Остаток: '+money(Math.max(0,day.budget-total))+'</span></div>'+
      '<a class="btn" href="'+safe(mapRoute(day,cfg))+'" target="_blank" rel="noopener noreferrer">Открыть маршрут в картах ↗</a>'+
      '<div class="note-box"><strong>Перед выходом</strong><br>Порядок остановок ориентировочный, время указано без расчёта реального пути. Проверяйте часы работы и билеты. Такси, транспорт, проживание и покупки не включены в бюджет.</div>'+
      '</aside></div>';
}
function copyPlanSummary(){
  if(!currentPlan)return;
  const plan=currentPlan;
  const text='Без планов · '+plan.days.length+' дн. в Москве\n'+
    plan.days.map((d,i)=>
      'День '+(i+1)+' · '+dateLabel(d.date)+' · '+AREA_BY_ID[d.areaId].name+'\n'+
      d.stops.map(s=>'• '+s.time+' '+(PLACES[s.id]||{}).name).join('\n')).join('\n\n')+
    '\n\nОриентир по расходам: '+money(totalPlan(plan))+
    '\nДанные и цены требуют проверки.';
  if(navigator.share){
    navigator.share({title:'Без планов · маршрут по Москве',text}).catch(()=>{});
  }else if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(()=>alert('Текст маршрута скопирован. Сохранённые планы остаются только на этом устройстве.'))
      .catch(()=>window.prompt('Скопируйте маршрут:',text));
  }else window.prompt('Скопируйте маршрут:',text);
}
function saveCurrent(){
  if(!currentPlan)return;
  const plans=getSaved().filter(p=>p.id!==currentPlan.id);
  plans.unshift(JSON.parse(JSON.stringify(currentPlan)));
  if(saveJSON(DATA_KEY,plans.slice(0,30))){
    $('saveCurrent').textContent='✓ Сохранено';
    updateSavedCount();
  }
}
function updateSavedCount(){
  const n=getSaved().length;
  $('savedCount').textContent=n?'('+n+')':'';
}
function renderLibrary(){
  const plans=getSaved(),favs=getFavorites();
  $('savedPlans').innerHTML=plans.length?plans.map(p=>{
    if(!p||!p.config||!Array.isArray(p.days))return '';
    return '<div class="saved-item"><div><h4>'+safe(p.days.length===1?'День в Москве':'Путешествие на '+p.days.length+' '+daysWord(p.days.length))+'</h4>'+
      '<p>'+safe(dateLabel(p.config.from))+(p.days.length>1?' — '+safe(dateLabel(p.config.to)):'')+
      ' · '+money(totalPlan(p))+'</p></div>'+
      '<div class="saved-actions"><button class="btn small" type="button" data-action="open-saved" data-id="'+safe(p.id)+'">Открыть</button>'+
      '<button class="btn small warn" type="button" data-action="delete-saved" data-id="'+safe(p.id)+'">Удалить</button></div></div>';
  }).join(''):'<div class="empty-state"><span class="icon">🗺️</span><strong>Здесь будут ваши приключения</strong><p>Создайте первый маршрут и сохраните его.</p></div>';
  $('favoritePlaces').innerHTML=favs.length?favs.map(id=>{
    const p=PLACES[id];return '<div class="favorite-item"><div><h4>'+safe(p.name)+'</h4><p>'+safe(TAGS[p.tags[0]])+'</p>'+
      '<a href="'+safe(mapSearch(p))+'" target="_blank" rel="noopener noreferrer" class="text-btn">Открыть на карте ↗</a></div>'+
      '<button type="button" class="btn small warn" data-action="toggle-favorite" data-place="'+safe(id)+'">Убрать</button></div>';
  }).join(''):'<div class="empty-state"><span class="icon">♡</span><strong>Пока ничего нет</strong><p>Добавляйте понравившиеся места из маршрута.</p></div>';
}
function restoreConfig(cfg){
  ['from','to'].forEach((x,i)=>{$(i?'dateTo':'dateFrom').value=cfg[x]});
  $('budgetAmount').value=cfg.budgetAmount;
  $('budgetScope').value=cfg.budgetScope;
  $('groupSize').value=cfg.groupSize;
  $('journeyMode').value=cfg.journeyMode;
  $('pace').value=cfg.pace;
  $('startTime').value=cfg.startTime;
  $('startPoint').value=cfg.startPoint||'';
  $('transport').value=cfg.transport;
  document.querySelectorAll('[data-interest]').forEach(b=>b.setAttribute('aria-pressed',cfg.interests.includes(b.dataset.interest)));
  updatePeriod();
}
function handleClick(e){
  const screen=e.target.closest('[data-screen]');
  if(screen){setScreen(screen.dataset.screen);return}
  const start=e.target.closest('[data-action="start"]');
  if(start){startBuilder();return}
  const button=e.target.closest('[data-action]');
  if(!button)return;
  const action=button.dataset.action,idx=Number(button.dataset.stop);
  if(action==='choose-day'){currentDay=Number(button.dataset.index);openSwap=null;renderResult();return}
  if(action==='toggle-lock'){
    const s=currentPlan.days[currentDay].stops[idx];if(!s)return;
    s.locked=!s.locked;openSwap=null;renderResult();return;
  }
  if(action==='swap-menu'){openSwap=openSwap===currentDay+':'+idx?null:currentDay+':'+idx;renderDay();return}
  if(action==='apply-swap'){
    const day=currentPlan.days[currentDay],next=PLACES[button.dataset.new],old=day.stops[idx];
    if(!old||old.locked||!next||day.stops.some(s=>s.id===next.id))return;
    const projected=totalDay(day,currentPlan.config)-estimatedCost(PLACES[old.id],currentPlan.config.groupSize)+estimatedCost(next,currentPlan.config.groupSize);
    if(projected>day.budget){alert('Выбранная остановка превышает бюджет дня.');return}
    old.id=next.id;recalculateTimes(day,currentPlan.config);openSwap=null;renderResult();return;
  }
  if(action==='toggle-favorite'){
    const id=button.dataset.place;if(!PLACES[id])return;
    const xs=getFavorites(),next=xs.includes(id)?xs.filter(x=>x!==id):xs.concat(id);
    saveJSON(FAVORITES_KEY,next);
    if(!$('view-saved').hidden)renderLibrary();else renderDay();
    return;
  }
  if(action==='open-saved'){
    const p=getSaved().find(x=>x.id===button.dataset.id);
    if(!p||!p.config||!Array.isArray(p.days))return;
    currentPlan=JSON.parse(JSON.stringify(p));currentDay=0;openSwap=null;restoreConfig(currentPlan.config);
    setScreen('results');renderResult();return;
  }
  if(action==='delete-saved'){
    if(!window.confirm('Удалить этот сохранённый маршрут?'))return;
    saveJSON(DATA_KEY,getSaved().filter(x=>x.id!==button.dataset.id));
    updateSavedCount();renderLibrary();
  }
}
function init(){
  const today=isoLocal(new Date());
  $('dateFrom').min=today;$('dateTo').min=today;
  $('dateFrom').value=today;$('dateTo').value=today;
  updatePeriod();
  updateSavedCount();
  document.addEventListener('click',handleClick);
  document.querySelectorAll('[data-interest]').forEach(b=>b.addEventListener('click',()=>{
    b.setAttribute('aria-pressed',b.getAttribute('aria-pressed')!=='true');
  }));
  ['dateFrom','dateTo','budgetAmount','budgetScope'].forEach(id=>$(id).addEventListener('change',()=>{
    if(id==='dateFrom'){$('dateTo').min=$('dateFrom').value;if($('dateTo').value<$('dateFrom').value)$('dateTo').value=$('dateFrom').value}
    updatePeriod();
  }));
  $('budgetAmount').addEventListener('input',updatePeriod);
  $('stepNext').addEventListener('click',()=>{
    const error=validateFirst();if(error){$('plannerError').textContent=error;return}
    changeStep(2);
  });
  $('stepBack').addEventListener('click',()=>changeStep(1));
  $('plannerForm').addEventListener('submit',e=>{
    e.preventDefault();
    const error=validateFirst()||(!selectedInterests().length?'Выберите хотя бы один интерес.':'');
    if(error){$('plannerError').textContent=error;if(currentStep===2&&error!=='Выберите хотя бы один интерес.')changeStep(1),$('plannerError').textContent=error;return}
    currentPlan=generatePlan();currentDay=0;openSwap=null;setScreen('results');renderResult();
  });
  $('saveCurrent').addEventListener('click',saveCurrent);
  $('shareCurrent').addEventListener('click',copyPlanSummary);
  $('editCurrent').addEventListener('click',()=>{if(currentPlan)restoreConfig(currentPlan.config);startBuilder()});
  $('newCurrent').addEventListener('click',startBuilder);
}
document.addEventListener('DOMContentLoaded',init);
