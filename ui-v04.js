'use strict';
/* Интерфейс v0.4. Никакие текстовые ответы не отправляются на сервер. */
const $=(id)=>document.getElementById(id);
const RATINGS=[{value:2,label:'Очень люблю',symbol:'♥'},{value:1,label:'Подойдёт',symbol:'✓'},{value:-3,label:'Точно не моё',symbol:'×'}];
const TITLES=[
 ['Начнём с главного.','Когда, с кем и на какую сумму вы хотите отправиться?'],
 ['У каждого — свой вкус.','Начнём с того, что по-настоящему нравится вам.'],
 ['Теперь — взгляд второго.','Его интересы так же важны для вашего общего маршрута.'],
 ['Важны не только места.','Как вы хотите чувствовать себя в эти дни?'],
 ['Сохраним ваш комфорт.','Проверим практические детали, которые меняют маршрут.'],
 ['Остались ваши планы.','Закрепим билеты и посмотрим, что мы о вас узнали.']
];
let draft=buildDefault();
let currentStep=0;
let currentPlan=null;
let currentDay=0;
let openSwap=null;
let toastTimer=null;
let lastFeedbackRefresh=false;
function notify(message){
 const el=$('toast');el.textContent=message;el.hidden=false;clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>{el.hidden=true},4200);
}
function showPage(name){
 for(const id of ['home','wizard','result','library','discover'])$('page-'+id).hidden=id!==name;
 if(name==='library')renderLibrary();
 window.scrollTo(0,0);
}
function personRatingsRendered(person){
 return PREFS.map(p=>{
   const selected=rated(draft.profiles[person],p.key);
   return '<div class="taste-row"><div class="taste-label"><span class="taste-icon">'+p.icon+'</span><div><strong>'+escapeHTML(p.title)+'</strong><small>'+escapeHTML(p.sub)+'</small></div></div>'+
   '<div class="taste-options" role="group" aria-label="'+escapeHTML(p.title)+'">'+RATINGS.map(r=>
     '<button type="button" class="taste-btn'+(selected===r.value?' selected':'')+'" data-action="rating" data-person="'+person+'" data-pref="'+p.key+'" data-rating="'+r.value+'" aria-pressed="'+(selected===r.value)+'" title="'+escapeHTML(r.label)+'" aria-label="'+escapeHTML(p.title)+': '+escapeHTML(r.label)+'">'+r.symbol+'</button>'
   ).join('')+'</div></div>';
 }).join('');
}
function renderTaste(){
 $('tasteOne').innerHTML=personRatingsRendered(0);
 $('tasteTwo').innerHTML=personRatingsRendered(1);
}
const FIELD_MAP={
 dateStart:'from',dateEnd:'to',budgetAmount:'budgetAmount',budgetScope:'budgetScope',partySize:'partySize',
 transportReserve:'transportReserve',hotelReserve:'hotelReserve',overnightStay:'overnightStay',nameOne:'profile1name',likesOne:'profile1likes',
 dreamOne:'profile1dream',avoidOne:'profile1avoid',nameTwo:'profile2name',likesTwo:'profile2likes',
 dreamTwo:'profile2dream',avoidTwo:'profile2avoid',surpriseLevel:'surpriseLevel',
 perfectDay:'perfectDay',badDay:'badDay',dayStart:'dayStart',dayEnd:'dayEnd',
 startLocation:'startLocation',transport:'transport',walkingLevel:'walkingLevel',
 venuePreference:'venuePreference',foodNeeds:'foodNeeds',stepFree:'stepFree',hotelAddress:'hotelAddress',alreadyVisited:'alreadyVisited',dreamPlaces:'dreamPlaces'
};
const NUMERIC_KEYS=new Set(['budgetAmount','partySize','transportReserve','hotelReserve','surpriseLevel']);
function fieldToCfg(id,value){
 const k=FIELD_MAP[id];if(!k)return;
 if(k.startsWith('profile')){
   const m=k.match(/^profile([12])(.*)$/);if(m){
     draft.profiles[Number(m[1])-1][m[2]]=cleanText(value,m[2]==='name'?35:m[2]==='likes'?650:350);
   }
 }else draft[k]=NUMERIC_KEYS.has(k)?Number(value):(k==='stepFree'||k==='overnightStay')?!!value:value;
}
function cfgToFields(){
 for(const [id,key] of Object.entries(FIELD_MAP)){
   const element=$(id);if(!element)continue;
   let val;
   if(key.startsWith('profile')){
     const m=key.match(/^profile([12])(.*)$/);val=draft.profiles[Number(m[1])-1][m[2]]||'';
   }else val=draft[key];
   if(element.type==='checkbox')element.checked=!!val;else element.value=val??'';
 }
 ['peopleMode','journeyMode','budgetCovers','pace'].forEach(k=>{
   document.querySelectorAll('[data-choice="'+k+'"] [data-value]').forEach(b=>{
     const active=b.dataset.value===draft[k];
     b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
   });
 });
 document.querySelectorAll('[data-single="occasion"] .select-chip').forEach(b=>{
   b.classList.toggle('active',b.dataset.value===draft.occasion);
   b.setAttribute('aria-pressed',String(b.dataset.value===draft.occasion));
 });
 ['goals','restrictions'].forEach(key=>document.querySelectorAll('[data-multi="'+key+'"] .select-chip').forEach(b=>{
   const on=draft[key].includes(b.dataset.value);b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));
 }));
 renderTaste();reflectMode();reflectBudget();reflectDates();renderEvents();
}
function reflectMode(){
 // Launch scope: exclusively a pair, not solo or group.
 draft.peopleMode='couple';draft.partySize=2;
 $('partySizeField').hidden=true;
 $('personOneTitle').textContent='А что нравится вам?';
}
function reflectBudget(){
 $('reserveInputs').hidden=draft.budgetCovers!=='all';
 $('hotelReserveField').hidden=!draft.overnightStay;
 $('hotelAddressField').hidden=!draft.overnightStay;
}
function reflectDates(){
 const dates=datesBetween(draft.from,draft.to);
 $('dateStart').min=localISO(new Date());$('dateEnd').min=draft.from||localISO(new Date());
 if(dates.length&&dates.length<=14){
   const total=draft.budgetAmount*(draft.budgetScope==='daily'?dates.length:1);
   $('rangeInfo').textContent=dates.length+' '+dayWord(dates.length)+' · '+dateLabel(dates[0])+(dates.length>1?' — '+dateLabel(dates[dates.length-1]):'')+' · бюджет на период '+formatMoney(total);
 }else $('rangeInfo').textContent='Выберите период от одного до 14 дней.';
 $('districtSelectionNote').hidden=!draft.preferredDistrict;
 if(draft.preferredDistrict)$('districtSelectionNote').textContent='✦ Вы начали с района «'+AREA_BY_ID[draft.preferredDistrict]?.name+'». Это предпочтение для начала путешествия.';
 $('eventDate').min=draft.from;$('eventDate').max=draft.to;
 if(!dates.includes($('eventDate').value))$('eventDate').value=draft.from;
}
function effectiveStepList(){return [0,1,2,3,4,5]}
function goStep(n){
 currentStep=n;
 document.querySelectorAll('.wizard-step').forEach(s=>s.hidden=Number(s.dataset.step)!==n);
 const steps=effectiveStepList();
 const idx=steps.indexOf(n);
 const ix=Math.max(0,idx);
 $('wizardTitle').textContent=TITLES[n][0];
 $('wizardSubtitle').textContent=TITLES[n][1];
 $('stepCount').textContent=String(ix+1).padStart(2,'0');
 document.querySelector('.wizard-counter span').textContent='из '+String(steps.length).padStart(2,'0');
 const pct=100*(ix+1)/steps.length;
 $('wizardProgress').querySelector('span').style.width=pct+'%';
 $('wizardProgress').setAttribute('aria-valuemax',String(steps.length));
 $('wizardProgress').setAttribute('aria-valuenow',String(ix+1));
 $('prevStep').hidden=ix===0;
 $('nextStep').hidden=n===5;$('finishPlan').hidden=n!==5;
 $('wizardError').textContent='';
 if(n===5){renderEvents();renderReview()}
 window.scrollTo(0,0);
}
function firstStepValidation(){
 const ds=datesBetween(draft.from,draft.to);
 if(!ds.length)return 'Выберите правильные даты начала и окончания.';
 if(ds.length>14)return 'Пока доступен период не более 14 дней.';
 if(draft.from<localISO(new Date()))return 'Дата начала не может быть в прошлом.';
 if(!Number.isFinite(draft.budgetAmount)||draft.budgetAmount<500||draft.budgetAmount>10000000)return 'Укажите бюджет от 500 до 10 000 000 ₽.';
 if(draft.budgetCovers==='all'&&(!Number.isFinite(draft.transportReserve)||draft.transportReserve<0||!Number.isFinite(draft.hotelReserve)||draft.hotelReserve<0))return 'Укажите неотрицательный резерв на транспорт и ночёвки.';
 return '';
}
function profileValidation(idx){
 const p=draft.profiles[idx];
 const answered=Object.values(p.ratings).filter(x=>[2,1,-3].includes(Number(x))).length;
 return answered>=2||cleanText(p.likes).length>=15||cleanText(p.dream).length>=15?
   '':'Отметьте хотя бы два предпочтения или расскажите о своих интересах своими словами (от 15 символов).';
}
function validateStep(n){
 if(n===0)return firstStepValidation();
 if(n===1)return profileValidation(0);
 if(n===2)return profileValidation(1);
 if(n===3)return draft.goals.length||draft.perfectDay.length>=20?'':'Выберите хотя бы одну цель или опишите идеальный день (от 20 символов).';
 if(n===4){
   const a=minutes(draft.dayStart),b=minutes(draft.dayEnd);
   if(!Number.isFinite(a)||!Number.isFinite(b)||b-a<120||b-a>840)return 'Выберите время на прогулку от 2 до 14 часов.';
 }
 return '';
}
function nextStep(){
 const error=validateStep(currentStep);if(error){$('wizardError').textContent=error;return}
 const steps=effectiveStepList();
 goStep(steps[Math.min(steps.length-1,steps.indexOf(currentStep)+1)]);
 persistDraft();
}
function prevStep(){
 const steps=effectiveStepList();goStep(steps[Math.max(0,steps.indexOf(currentStep)-1)]);
}
function persistDraft(){writeStore(STORE_DRAFT,draft)}
function freshWizard(){
 const current=clone(draft);
 const hasDraft=Object.values(current.profiles[0].ratings||{}).length>0||
   current.events.length>0||current.perfectDay.length>0;
 if(!$('page-wizard').hidden&&hasDraft&&
   !window.confirm('Начать новый маршрут? Мы сохраним ваши предпочтения, но даты и закреплённые события будут сброшены.'))return;
 draft=buildDefault();
 // Product promise: a couple should not have to teach the planner about themselves every time.
 const keep=['profiles','foodNeeds','restrictions','walkingLevel',
   'alreadyVisited','dreamPlaces',
   'venuePreference','transport','stepFree','startLocation','hotelAddress'];
 for(const key of keep)draft[key]=clone(current[key]);
 cfgToFields();persistDraft();goStep(0);showPage('wizard');
 if(current.profiles.some(p=>Object.keys(p.ratings||{}).length||p.likes))
   notify('Ваши вкусы сохранены, осталось выбрать новые даты');
}
function editWizard(){
 if(!currentPlan)return;
 draft=clone(currentPlan.config);
 cfgToFields();goStep(0);showPage('wizard');
}
function makeEvent(){
 $('eventError').textContent='';
 const name=cleanText($('eventName').value,110);
 const date=$('eventDate').value,time=$('eventTime').value,duration=Number($('eventDuration').value);
 const cost=Number($('eventCost').value),address=cleanText($('eventAddress').value,180);
 const paid=$('eventPaid').checked,includeBudget=$('eventCostIncluded').checked;
 if(!name){$('eventError').textContent='Укажите название события.';return}
 if(!datesBetween(draft.from,draft.to).includes(date)){$('eventError').textContent='Дата события должна входить в выбранный период.';return}
 if(!Number.isFinite(minutes(time))||minutes(time)+duration>1440){$('eventError').textContent='Проверьте время события.';return}
 if(!Number.isFinite(cost)||cost<0||cost>10000000){$('eventError').textContent='Введите корректную стоимость.';return}
 if(draft.events.length>=20){$('eventError').textContent='Можно добавить не более 20 событий.';return}
 const event={id:'e'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name,date,time,duration,cost,address,paid,includeBudget};
 if(overlappingEvents([...draft.events,event])){$('eventError').textContent='В этот день уже есть событие на такое время. Скорректируйте время или длительность.';return}
 draft.events.push(event);
 $('eventName').value='';$('eventCost').value='0';$('eventAddress').value='';
 $('eventPaid').checked=false;$('eventCostIncluded').checked=false;
 persistDraft();renderEvents();renderReview();
 notify('Событие закреплено в анкете');
}
function renderEvents(){
 $('eventList').innerHTML=draft.events.length?draft.events.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)).map(e=>
  '<div class="event-item"><div><strong>🔒 '+escapeHTML(e.name)+'</strong><span>'+escapeHTML(dateLabel(e.date))+' · '+escapeHTML(e.time)+' · '+escapeHTML(String(e.duration))+' мин · '+formatMoney(e.cost)+(e.paid?' · оплачено':' · к оплате')+'</span></div>'+
  '<button type="button" class="button button-outline button-small" data-action="remove-event" data-id="'+escapeHTML(e.id)+'" aria-label="Удалить событие '+escapeHTML(e.name)+'">✕</button></div>'
 ).join(''):'<div class="field-note">Пока ничего не закреплено — этот шаг можно пропустить.</div>';
}
function renderReview(){
 const pair=pairStats(draft),signal=textSignals(draft);
 const eligible=[...new Set(AREAS.flatMap(a=>a.places).filter(p=>placeEligible(p,draft,signal,getFeedback())).map(p=>p.id))];
 let bar='<div class="pair-preview">'+
  '<div class="pair-number"><strong>'+pair.mutual+'</strong><span>Общих предпочтений</span></div>'+
  '<div class="pair-number"><strong>'+pair.one+'</strong><span>Интересов одного</span></div>'+
  '<div class="pair-number"><strong>'+pair.clash+'</strong><span>Противоречий</span></div></div>';
 if(pair.solo)bar='<div class="review-info">Маршрут будет учитывать ваши личные интересы и ограничения.</div>';
 $('pairPreview').innerHTML=bar+
  '<div style="margin-top:12px">'+pair.common.slice(0,5).map(t=>'<span class="preview-tag">♥ '+escapeHTML(t)+'</span>').join('')+'</div>';
 $('recognizedPreview').innerHTML=signal.recognized.length||signal.avoided.length?
   '<strong>Что удалось распознать из свободных ответов:</strong><br>'+
   (signal.recognized.length?'Интересно: '+signal.recognized.map(escapeHTML).join(', ')+'. ':'')+
   (signal.avoided.length?'Не предлагать: '+signal.avoided.map(escapeHTML).join(', ')+'. ':''):
   'Ваши тексты сохранены как пожелания. Надёжно извлечь конкретные предпочтения из них пока не удалось — в локальном режиме нет полноценного ИИ.';
 $('reviewInfo').innerHTML=
  '<strong>Подборка:</strong> '+eligible.length+' доступных в каталоге мест с учётом отмеченных исключений. '+
  'Маршрут на '+datesBetween(draft.from,draft.to).length+' '+dayWord(datesBetween(draft.from,draft.to).length)+'. '+
  (draft.stepFree?'<br><strong>Внимание:</strong> безбарьерность объектов не подтверждена. ':'')+
  (draft.foodNeeds?'<br><strong>Питание:</strong> особые требования не могут быть проверены автоматически. ':'')+
  (pair.clash?'<br><strong>Разногласия:</strong> категории с пометкой «точно нет» у любого участника исключаются.':'');
}
function updateSavedCount(){const n=getSaved().length;$('savedNumber').textContent=n?'('+n+')':''}
function startPlan(){
 draft.peopleMode='couple';draft.partySize=2;
 if(currentStep!==5)return;
 const err=validateConfig(draft);
 if(err){$('wizardError').textContent=err;return}
 try{
  currentPlan=generateItinerary(draft,getFeedback());
  currentDay=0;openSwap=null;
  persistDraft();
  showPage('result');renderResult();
 }catch(e){$('wizardError').textContent=e.message||'Не удалось собрать маршрут.'}
}
function savedIsSame(){
 const p=getSaved().find(x=>x.id===currentPlan?.id);
 return p&&JSON.stringify(p)===JSON.stringify(currentPlan);
}
function renderResult(){
 const plan=currentPlan;if(!plan)return;
 const cfg=plan.config,days=plan.days;
 $('resultsTitle').textContent=days.length===1?'Один день, который ваш.':'Ваши '+days.length+' '+dayWord(days.length)+' в Москве.';
 $('resultsSubtitle').textContent=dateLabel(cfg.from)+(days.length>1?' — '+dateLabel(cfg.to):'')+
  ' · '+(cfg.peopleMode==='solo'?'Для себя':cfg.peopleMode==='group'?'Для компании':'Для двоих')+
  ' · '+(cfg.journeyMode==='connected'?'Связанное путешествие':'Отдельные маршруты');
 const spots=days.reduce((s,d)=>s+d.stops.filter(x=>x.kind==='place').length,0);
 const paid=days.reduce((s,d)=>s+d.stops.filter(x=>x.kind==='fixed'&&x.paid).reduce((a,e)=>a+e.cost,0),0);
 $('planStats').innerHTML=[
  [days.length+' '+dayWord(days.length),'В вашем путешествии'],
  [spots+' + '+cfg.events.length,'Места + закреплённые события'],
  [formatMoney(totalSpend(plan)),'План: места, билеты и резерв'],
  [formatMoney(totalLimit(cfg,days.length)),'Общий лимит бюджета']
 ].map(a=>'<div class="stat"><strong>'+escapeHTML(a[0])+'</strong><span>'+escapeHTML(a[1])+'</span></div>').join('');
 if(cfg.peopleMode==='solo')$('matchSection').hidden=true;
 else{
  $('matchSection').hidden=false;
  const info=pairStats(cfg),total=info.mutual+info.one+info.clash||1;
  $('matchExplanation').textContent=info.mutual?
    'Нашли '+info.mutual+' '+(info.mutual===1?'общий интерес':'общих интереса')+'. Они в приоритете; личные вкусы тоже не теряем.':
    'Общих отмеченных интересов пока нет. Не заставляем одного уступать: чередуем доступные интересы обоих, избегая запретов.';
  const bars=[['Любят оба',info.mutual,'#548568'],['Нравится одному',info.one,'#c69b80'],['Есть запрет',info.clash,'#9ab4a1']];
  $('matchGraphic').innerHTML=bars.map(b=>
   '<div class="match-bar-row"><span>'+b[0]+'</span><div class="match-bar"><span style="width:'+(b[1]/total*100)+'%;background:'+b[2]+'"></span></div><b>'+b[1]+'</b></div>'
  ).join('')+'<div class="match-tags">'+(info.common.slice(0,4).map(x=>'<span>♥ '+escapeHTML(x)+'</span>').join('')||'<span>Отметьте взаимные интересы в анкете</span>')+'</div>';
 }
 $('daysTabs').innerHTML=days.map((d,i)=>
  '<button role="tab" type="button" aria-selected="'+(i===currentDay)+'" class="day-tab'+(i===currentDay?' active':'')+'" data-action="day" data-index="'+i+'">День '+(i+1)+'<small>'+escapeHTML(shortDate(d.date))+'</small></button>'
 ).join('');
 $('savePlan').textContent=savedIsSame()?'✓ Сохранено':'♡ Сохранить';
 $('accommodationSummary').hidden=!(cfg.overnightStay&&cfg.hotelAddress);
 if(cfg.hotelAddress){
  $('accommodationSummary').innerHTML='<strong>⌂ Ваша база на время поездки:</strong> '+escapeHTML(cfg.hotelAddress)+
   '. Это ваша заметка; расстояния и ночёвка не проверены. '+(cfg.budgetCovers==='all'?'Бюджет включает заданный вами резерв на ночёвки.':'Стоимость жилья не входит в бюджет.');
 }
 renderDay();
}
function costLine(day,cfg){
 const sum=daySpending(day,cfg);
 return '<div class="budget-legend"><span>Остановки: '+formatMoney(sum.place)+'</span><span>Билеты: '+formatMoney(sum.fixed)+'</span></div>'+
  (sum.reserved?'<div class="budget-legend"><span>Резерв на дорогу и жильё</span><span>'+formatMoney(sum.reserved)+'</span></div>':'');
}
function renderDay(){
 const plan=currentPlan;if(!plan)return;
 const day=plan.days[currentDay],cfg=plan.config,area=AREA_BY_ID[day.areaId],signals=plan.signals||textSignals(cfg),feedback=getFeedback();
 const sum=daySpending(day,cfg),percentage=day.limit?Math.min(100,sum.total/day.limit*100):0;
 const favorites=getFavorites();
 const stops=day.stops.map((s,i)=>{
   const fixed=s.kind==='fixed',p=fixed?null:PLACES[s.id];
   if(!fixed&&!p)return '';
   const name=fixed?s.name:p.name,description=fixed?
    (s.address?'Событие по вашему плану: '+s.address:'Событие из вашей анкеты с фиксированным временем.'):
    p.description;
   const price=fixed?(bookingCounted(s)?formatMoney(s.cost)+' в лимите':formatMoney(s.cost)+' вне лимита'):formatMoney(priceAllowance(p,cfg.partySize));
   const why=fixed?'Закреплено вами · время и содержание не меняются автоматически':personEvidence(p,cfg,signals);
   const mapAddress=fixed?s.address:p.address;
   const placeLink=fixed?null:PLACE_LINKS[p.id];
   const placeIcon=fixed?'🎟':(PREF_BY_KEY[p.tags[0]]?.icon||'✧');
   const isFavorite=!fixed&&favorites.includes(p.id),swapOpen=openSwap===currentDay+':'+i;
   const alt=swapOpen?alternativesFor(plan,currentDay,i,feedback):[];
   const altHTML=swapOpen?
    '<div class="swap-list"><strong style="font-size:11px">Другие варианты в районе</strong>'+
    (alt.length?alt.map(q=>'<button type="button" class="swap-option" data-action="swap" data-index="'+i+'" data-place="'+escapeHTML(q.id)+'">'+escapeHTML(q.name)+
       '<small>Резерв '+formatMoney(priceAllowance(q,cfg.partySize))+' · '+escapeHTML(q.minutes)+' мин на месте</small></button>').join(''):
       '<p class="field-note">Не нашлось подходящей замены с учётом бюджета и исключений.</p>')+'</div>':'';
   return '<div class="stop'+(fixed?' fixed':'')+'">'+
    '<div class="stop-time">'+escapeHTML(s.time)+'</div><span class="stop-dot"></span>'+
    '<article class="stop-box"><div class="stop-head"><div><span class="stop-overline">'+(fixed?'🔒 Ваше событие':escapeHTML(TAGS[p.tags[0]]||'Впечатление'))+'</span>'+
    '<h4>'+escapeHTML(name)+'</h4></div><span class="stop-visual" aria-hidden="true">'+(s.locked&&!fixed?'🔒':placeIcon)+'</span></div>'+
    '<p>'+escapeHTML(description)+'</p>'+
    '<div class="stop-chips"><span>≈ '+escapeHTML(String(s.duration))+' мин на месте</span><span>'+escapeHTML(price)+'</span>'+
    (fixed&&s.paid?'<span>Уже оплачено</span>':'')+'</div>'+
    '<div class="stop-why">'+escapeHTML(why)+'</div>'+
    '<div class="stop-tools">'+(mapAddress?'<a class="tool-link" href="'+escapeHTML(mapLinkYandex(mapAddress))+'" target="_blank" rel="noopener noreferrer">Яндекс.Карты ↗</a><a class="tool-link" href="'+escapeHTML(mapLink(mapAddress))+'" target="_blank" rel="noopener noreferrer">Google Maps ↗</a>':'')+
    (placeLink?.reservation?'<a class="tool-link" href="'+escapeHTML(placeLink.reservation)+'" target="_blank" rel="noopener noreferrer">Бронь на сайте ↗</a>':placeLink?.website?'<a class="tool-link" href="'+escapeHTML(placeLink.website)+'" target="_blank" rel="noopener noreferrer">Сайт заведения ↗</a>':'')+
    (!fixed?'<button type="button" class="tool-link" data-action="swap-menu" data-index="'+i+'" '+(s.locked?'disabled':'')+'>Заменить</button>'+
      '<button type="button" class="tool-link'+(s.locked?' active':'')+'" data-action="toggle-lock" data-index="'+i+'">'+(s.locked?'Открепить':'Закрепить')+'</button>'+
      '<button type="button" class="tool-link'+(isFavorite?' active':'')+'" data-action="favorite" data-place="'+escapeHTML(p.id)+'">'+(isFavorite?'♥ В избранном':'♡ В избранное')+'</button>'+
      '<button type="button" class="tool-link" data-action="feedback-no" data-index="'+i+'">Не подходит</button>':'')+
    '</div>'+altHTML+'</article></div>';
 }).join('');
 const calendarText='День '+(currentDay+1)+' · '+shortDate(day.date);
 const overnight=cfg.overnightStay&&plan.days.length>1&&currentDay<plan.days.length-1?
   '<div class="overnight"><div class="overnight-icon">☾</div><div><strong>Ночёвка после '+escapeHTML(shortDate(day.date))+'</strong><p>'+
   (cfg.hotelAddress?escapeHTML(cfg.hotelAddress):'Место проживания пока не указано — внесите его в анкету.')+
   '</p><small>'+(day.reserve?.nightly?'Заложенный вами резерв: '+formatMoney(day.reserve.nightly):'Проживание не включено в расчёт расходов')+
   '. Бронирование не выполняется.</small></div></div>':'';
 $('dayResult').innerHTML=
  '<div class="day-layout"><article class="panel day-panel">'+
   '<div class="day-header"><div><div class="overline">'+escapeHTML(calendarText)+'</div><h3>'+escapeHTML(area.name)+'</h3><p>'+escapeHTML(area.subtitle)+'</p></div>'+
   '<span class="day-label">'+day.stops.length+' '+(day.stops.length===1?'остановка':day.stops.length<5?'остановки':'остановок')+'</span></div>'+
   '<div class="day-balance"><strong>Почему этот район?</strong> Здесь есть места, которые соответствуют вашим отмеченным интересам. '+
   (cfg.journeyMode==='connected'?'Следующие дни подбираются с учётом предыдущего района. ':'Каждый день выбирается отдельно. ')+
   (day.stops.some(s=>s.kind==='fixed')?'Учтены закреплённые события. ':'')+
   'Это тематическая группировка, а не расчёт кратчайшего пути.</div>'+
   '<div class="stop-list">'+(stops||'<div class="empty-library"><span>◈</span>При этих ограничениях не осталось подходящих мест в нашей подборке. Измените интересы или бюджет — мы не будем подставлять случайные варианты.</div>')+'</div>'+overnight+'</article>'+
   '<aside class="panel day-sidebar"><div class="overline">Ваш день</div><h3>Бюджет и путь</h3>'+
    '<p>Плановые суммы для '+cfg.partySize+' '+(cfg.partySize===1?'человека':'человек')+'. Не цены, полученные онлайн.</p>'+
    '<div class="day-total">'+formatMoney(sum.total)+'</div><div class="budget-track"><span style="width:'+percentage+'%"></span></div>'+
    '<div class="budget-legend"><span>Лимит: '+formatMoney(day.limit)+'</span><span>Остаток: '+formatMoney(Math.max(0,day.limit-sum.total))+'</span></div>'+
    costLine(day,cfg)+
    (itineraryOrigin(day,cfg)?'<div class="route-origin-note"><strong>Старт маршрута:</strong> '+escapeHTML(itineraryOrigin(day,cfg))+
    '<small>Указан в ссылке на карты; точное время от места старта не рассчитано.</small></div>':'')+
    '<a class="button button-primary" href="'+escapeHTML(dayMap(day,cfg))+'" target="_blank" rel="noopener noreferrer">Открыть маршрут в картах ↗</a>'+
    '<button type="button" class="button button-outline" data-action="reroll-day">↻ Пересобрать этот день</button>'+
    '<div class="sidebar-note"><strong>План, а не обещание</strong> Время остановок предварительное: на переезды между ними заложен буфер, а реальное время в пути не рассчитывается. Часы работы, билеты и погоду проверьте самостоятельно.'+
    (cfg.stepFree?'<br><br><strong>Важно:</strong> доступность без ступеней не проверена.':'')+
    (cfg.foodNeeds?'<br><br><strong>Питание:</strong> '+escapeHTML(cfg.foodNeeds)+'. Меню и аллергены не проверены.':'')+
    '</div></aside></div>';
}
function saveCurrent(){
 if(!currentPlan)return;
 const plans=getSaved().filter(x=>x.id!==currentPlan.id);
 plans.unshift(clone(currentPlan));
 if(!writeStore(STORE_PLANS,plans.slice(0,40))){notify('Не удалось сохранить: память браузера недоступна');return}
 updateSavedCount();$('savePlan').textContent='✓ Сохранено';notify('Маршрут сохранён на этом устройстве');
}
function shareCurrent(){
 if(!currentPlan)return;
 const cfg=currentPlan.config;
 let text='БЕЗ ПЛАНОВ · '+dateLabel(cfg.from)+(cfg.from!==cfg.to?' — '+dateLabel(cfg.to):'')+'\n';
 text+=currentPlan.days.map((day,i)=>'ДЕНЬ '+(i+1)+' · '+AREA_BY_ID[day.areaId].name+'\n'+
  day.stops.map(s=>'  '+s.time+' · '+(s.kind==='fixed'?s.name:PLACES[s.id]?.name||'Место')+
  (s.kind==='fixed'?' 🔒':'')).join('\n')).join('\n\n');
 text+='\n\nПлановые расходы: '+formatMoney(totalSpend(currentPlan))+
  '\nЦены, расписания и доступность перед поездкой нужно проверить.';
 if(navigator.share){
  navigator.share({title:'Наш маршрут · Без планов',text}).catch(()=>{});
 }else if(navigator.clipboard?.writeText){
  navigator.clipboard.writeText(text).then(()=>notify('Маршрут скопирован текстом'),()=>window.prompt('Скопируйте маршрут',text));
 }else window.prompt('Скопируйте маршрут',text);
}
function reassignTimes(day,cfg){
 const fixed=day.stops.filter(s=>s.kind==='fixed');
 const recomputed=reserveSlots(cfg,fixed).map(x=>({...x,cursor:x.from}));
 const suggested=day.stops.filter(s=>s.kind==='place');
 const occupied=[];
 for(const s of suggested){
   const duration=Number(s.duration)||PLACES[s.id]?.minutes||60;
   let slot=recomputed.find(x=>x.cursor+duration<=x.to);
   if(!slot){occupied.push(s);continue}
   s.time=clock(slot.cursor);s.duration=duration;slot.cursor+=duration+20;
 }
 day.stops=day.stops.slice().sort((a,b)=>minutes(a.time)-minutes(b.time));
}
function toggleLock(i){
 const s=currentPlan.days[currentDay]?.stops[i];
 if(!s||s.kind!=='place')return;
 s.locked=!s.locked;openSwap=null;renderResult();
}
function swapPlace(i,id){
 const day=currentPlan.days[currentDay],old=day?.stops[i],candidate=PLACES[id];
 if(!old||old.kind!=='place'||old.locked||!candidate)return;
 if(!alternativesFor(currentPlan,currentDay,i,getFeedback()).some(x=>x.id===id)){notify('Замена больше не подходит по условиям');return}
 old.id=id;old.duration=candidate.minutes;
 openSwap=null;renderResult();notify('Остановку заменили, закреплённое время сохранилось');
}
function rerollDay(){
 const day=currentPlan.days[currentDay],cfg=currentPlan.config;
 const fixed=day.stops.filter(s=>s.kind==='fixed');
 const locked=day.stops.filter(s=>s.kind==='place'&&s.locked);
 if(locked.length){notify('Сначала открепите выбранные остановки: они должны остаться неизменными');return}
 const feedback=getFeedback(),signals=textSignals(cfg),usage={};
 for(let i=0;i<currentPlan.days.length;i++)if(i!==currentDay)
   for(const s of currentPlan.days[i].stops)if(s.kind==='place')usage[s.id]=(usage[s.id]||0)+1;
 const scored=AREAS.map(a=>({a,score:areaQuality(a,cfg,signals,feedback)}))
   .filter(x=>x.score>-900).sort((a,b)=>b.score-a.score);
 let selected=AREA_BY_ID[day.areaId];
 if(!fixed.length){
   const other=scored.filter(x=>x.a.id!==day.areaId);
   const nearby=cfg.journeyMode==='connected'?other.filter(x=>NEARBY[day.areaId]?.includes(x.a.id)):[];
   selected=(nearby[0]||other[0])?.a||selected;
 }
 const limit=budgetForDay(cfg,currentDay,currentPlan.days.length,fixed);
 let rebuilt=chooseStopsForDay(selected,cfg,signals,feedback,usage,currentDay,limit,fixed);
 if(selected.id===day.areaId){
   // On the same neighborhood, rotate the unlocked recommendations instead of reproducing an identical list.
   const excluded={...feedback};
   for(const stop of day.stops)if(stop.kind==='place')excluded[stop.id]='no';
   const alternate=chooseStopsForDay(selected,cfg,signals,excluded,usage,currentDay,limit,fixed);
   if(alternate.stops.some(s=>s.kind==='place'))rebuilt=alternate;
 }
 const previous=day.stops.map(s=>s.id).join(',');
 const next=rebuilt.stops.map(s=>s.id).join(',');
 if((selected.id===day.areaId&&previous===next)||
     (!rebuilt.stops.some(s=>s.kind==='place')&&day.stops.some(s=>s.kind==='place'))){
   notify('Других вариантов по вашим ограничениям в подборке пока нет');
   return;
 }
 day.areaId=selected.id;day.stops=rebuilt.stops;currentPlan.signals=signals;
 openSwap=null;renderResult();notify('Предложили другой вариант дня с учётом ваших интересов');
}
function markNotForUs(index){
 const day=currentPlan.days[currentDay],s=day?.stops[index];
 if(!s||s.kind!=='place'||s.locked){notify('Сначала открепите остановку');return}
 const feedback=getFeedback();feedback[s.id]='no';
 if(!writeStore(STORE_FEEDBACK,feedback)){notify('Не удалось сохранить отзыв');return}
 const alt=alternativesFor(currentPlan,currentDay,index,feedback);
 if(alt.length){s.id=alt[0].id;s.duration=alt[0].minutes}
 else day.stops.splice(index,1);
 renderResult();notify('Учли ваш отзыв. Это место больше не предложим в этом браузере');
}
function toggleFavorite(id){
 if(!PLACES[id])return;
 const favorites=getFavorites();
 const next=favorites.includes(id)?favorites.filter(x=>x!==id):favorites.concat(id);
 if(!writeStore(STORE_FAV,next))notify('Не удалось сохранить избранное');
 if(!$('page-library').hidden)renderLibrary();else renderDay();
}
function normalizeLegacy(p){
 const cfg=buildDefault();Object.assign(cfg,p.config||{});
 cfg.peopleMode='couple';cfg.partySize=2;
 cfg.profiles=[{name:'',ratings:{},likes:'',dream:'',avoid:''},{name:'',ratings:{},likes:'',dream:'',avoid:''}];
 cfg.from=p.config?.from||p.days[0]?.date||cfg.from;
 cfg.to=p.config?.to||p.days[p.days.length-1]?.date||cfg.from;
 cfg.events=[];
 const days=(p.days||[]).map((d,i)=>({
  date:d.date,areaId:d.areaId,limit:Number(d.budget)||cfg.budgetAmount,reserve:{nightly:0,transport:0,total:0},
  stops:(d.stops||[]).filter(s=>PLACES[s.id]).map(s=>({kind:'place',id:s.id,time:s.time,duration:PLACES[s.id].minutes,locked:!!s.locked}))
 }));
 return {schema:4,id:'legacy-'+p.id,config:cfg,days,signals:textSignals(cfg),createdAt:p.createdAt||new Date().toISOString(),meta:{engine:'legacy'}};
}
function renderLibrary(){
 const plans=getSaved().filter(p=>!p.config?.peopleMode||p.config.peopleMode==='couple'),favs=getFavorites(),legacy=getLegacy();
 $('savedPlansList').innerHTML=plans.length||legacy.length?
  plans.map(p=>'<div class="saved-entry"><div><h4>'+escapeHTML(p.days.length===1?'День в Москве':p.days.length+' '+dayWord(p.days.length)+' в Москве')+'</h4>'+
   '<p>'+escapeHTML(dateLabel(p.config.from))+(p.config.to!==p.config.from?' — '+escapeHTML(dateLabel(p.config.to)):'')+
   ' · '+formatMoney(totalSpend(p))+'</p></div><div class="entry-buttons">'+
   '<button type="button" class="button button-primary button-small" data-action="open-saved" data-id="'+escapeHTML(p.id)+'">Открыть</button>'+
   '<button type="button" class="button button-outline button-small" data-action="remove-saved" data-id="'+escapeHTML(p.id)+'">Удалить</button></div></div>').join('')+
   legacy.map(p=>'<div class="saved-entry"><div><h4>Старый маршрут · версия 0.3</h4><p>'+
    escapeHTML(p.days.length+' '+dayWord(p.days.length))+' · '+formatMoney(p.days.reduce((s,d)=>s+(d.stops||[]).reduce((n,st)=>n+priceAllowance(PLACES[st.id]||{cost:0},Number(p.config.groupSize)||2),0),0))+'</p></div>'+
    '<div class="entry-buttons"><button type="button" class="button button-outline button-small" data-action="open-legacy" data-id="'+escapeHTML(String(p.id))+'">Посмотреть</button></div></div>').join(''):
  '<div class="empty-library"><span>⌁</span><strong>Ваша история начинается здесь</strong><p>Создайте маршрут и сохраните его.</p></div>';
 $('favoritePlacesList').innerHTML=favs.length?favs.map(id=>{
   const p=PLACES[id];return '<div class="favorite-entry"><div><h4>'+escapeHTML(p.name)+'</h4><p>'+escapeHTML(p.address)+'</p>'+
    '<a class="tool-link" href="'+escapeHTML(mapLink(p.address))+'" rel="noopener noreferrer" target="_blank">На карте ↗</a></div>'+
    '<button type="button" class="button button-outline button-small" data-action="favorite" data-place="'+escapeHTML(id)+'">♥</button></div>';
 }).join(''):'<div class="empty-library"><span>♡</span><strong>Пока нет любимых мест</strong><p>Добавляйте места прямо из маршрута.</p></div>';
 const participants=(draft.peopleMode==='solo'?draft.profiles.slice(0,1):draft.profiles)
   .map((p,i)=>personName(p,i,draft.peopleMode));
 const liked=PREFS.filter(p=>draft.profiles.some(pr=>rated(pr,p.key)>0)).map(p=>p.title);
 $('profileSummary').innerHTML='<div class="profile-chips">'+
   participants.map(n=>'<span>'+escapeHTML(n)+'</span>').join('')+
   liked.slice(0,6).map(n=>'<span>♥ '+escapeHTML(n)+'</span>').join('')+
   '</div>';
}
function openSaved(id,isLegacy){
 const p=isLegacy?getLegacy().find(x=>String(x.id)===id):getSaved().find(x=>x.id===id);
 if(!p){notify('Не удалось найти маршрут');return}
 currentPlan=isLegacy?normalizeLegacy(p):clone(p);
 currentDay=0;openSwap=null;
 showPage('result');renderResult();
}
function removeSaved(id){
 if(!window.confirm('Удалить этот сохранённый маршрут?'))return;
 if(!writeStore(STORE_PLANS,getSaved().filter(x=>x.id!==id)))return;
 renderLibrary();updateSavedCount();notify('Маршрут удалён');
}
function handleGlobalClick(e){
 const screen=e.target.closest('[data-screen]');
 if(screen){showPage(screen.dataset.screen);return}
 const b=e.target.closest('[data-action]');if(!b)return;
 const action=b.dataset.action;
 if(action==='new'){freshWizard();return}
 if(action==='district'){
   const district=b.dataset.district;
   if(!AREA_BY_ID[district])return;
   freshWizard();draft.preferredDistrict=district;persistDraft();
   $('districtSelectionNote').textContent='✦ Начнём с района «'+AREA_BY_ID[district].name+'». Вы сможете изменить старт и остальные настройки.';
   $('districtSelectionNote').hidden=false;
   notify('Выбран район: '+AREA_BY_ID[district].name);
   return;
 }
 if(action==='edit-draft'){cfgToFields();goStep(1);showPage('wizard');return}
 if(action==='reset-feedback'){
   if(!window.confirm('Сбросить все отметки «не подходит» для мест?'))return;
   if(writeStore(STORE_FEEDBACK,{}))notify('Все места снова доступны для подбора');
   return;
 }
 if(action==='clear-local'){
   if(!window.confirm('Удалить ответы анкеты, избранное, отзывы и все сохранённые маршруты из этого браузера?'))return;
   for(const key of [STORE_PLANS,STORE_FAV,STORE_DRAFT,STORE_FEEDBACK,STORE_PREVIOUS,'bezPlanovPlans','bezPlanovMomentsV05','bezPlanovSavedThemesV06','bezPlanovSavedThemesV06'])
     localStorage.removeItem(key);
   draft=buildDefault();cfgToFields();updateSavedCount();renderLibrary();
   notify('Локальные данные удалены');
   return;
 }
 if(action==='example'){
  $('howItWorks').scrollIntoView({behavior:'smooth'});return;
 }
 if(action==='rating'){
  const p=Number(b.dataset.person),key=b.dataset.pref,value=Number(b.dataset.rating);
  if(!PREF_BY_KEY[key]||!draft.profiles[p])return;
  if(rated(draft.profiles[p],key)===value)delete draft.profiles[p].ratings[key];
  else draft.profiles[p].ratings[key]=value;
  renderTaste();persistDraft();return;
 }
 if(action==='remove-event'){draft.events=draft.events.filter(x=>x.id!==b.dataset.id);renderEvents();renderReview();persistDraft();return}
 if(action==='day'){currentDay=Number(b.dataset.index);openSwap=null;renderResult();return}
 if(action==='swap-menu'){const i=Number(b.dataset.index);openSwap=openSwap===currentDay+':'+i?null:currentDay+':'+i;renderDay();return}
 if(action==='swap'){swapPlace(Number(b.dataset.index),b.dataset.place);return}
 if(action==='toggle-lock'){toggleLock(Number(b.dataset.index));return}
 if(action==='reroll-day'){rerollDay();return}
 if(action==='feedback-no'){markNotForUs(Number(b.dataset.index));return}
 if(action==='favorite'){toggleFavorite(b.dataset.place);return}
 if(action==='open-saved'){openSaved(b.dataset.id,false);return}
 if(action==='open-legacy'){openSaved(b.dataset.id,true);return}
 if(action==='remove-saved'){removeSaved(b.dataset.id)}
}
function handleFormClick(e){
 const b=e.target.closest('[data-value]');if(!b)return;
 const group=b.closest('[data-choice],[data-single],[data-multi]');
 if(!group)return;
 if(group.hasAttribute('data-choice')){
  const key=group.dataset.choice;
  if(!hasOwn(draft,key))return;
  draft[key]=b.dataset.value;
  if(key==='peopleMode')draft.partySize=draft.peopleMode==='solo'?1:draft.peopleMode==='couple'?2:Number($('partySize').value)||3;
  for(const sibling of group.querySelectorAll('[data-value]')){
   const active=sibling===b;sibling.classList.toggle('active',active);
   sibling.setAttribute('aria-pressed',String(active));
  }
  reflectMode();reflectBudget();reflectDates();
 }else if(group.hasAttribute('data-single')){
  const key=group.dataset.single;
  draft[key]=b.dataset.value;
  group.querySelectorAll('[data-value]').forEach(sib=>{
    const active=sib===b;sib.classList.toggle('active',active);sib.setAttribute('aria-pressed',String(active));
  });
 }else if(group.hasAttribute('data-multi')){
  const key=group.dataset.multi;
  const values=draft[key],v=b.dataset.value;
  if(values.includes(v))draft[key]=values.filter(x=>x!==v);
  else{
   const limit=Number(group.dataset.limit)||Infinity;
   if(values.length>=limit){notify('Можно выбрать не более '+limit+' вариантов');return}
   draft[key].push(v);
  }
  const active=draft[key].includes(v);b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
 }
 persistDraft();
}
function handleField(e){
 const target=e.target;
 if(!FIELD_MAP[target.id])return;
 const value=target.type==='checkbox'?target.checked:target.value;
 fieldToCfg(target.id,value);
 if(target.id==='dateStart'){
  $('dateEnd').min=draft.from;
  if(draft.to<draft.from){draft.to=draft.from;$('dateEnd').value=draft.to}
  draft.events=draft.events.filter(x=>x.date>=draft.from&&x.date<=draft.to);
 }else if(target.id==='dateEnd'){
  draft.events=draft.events.filter(x=>x.date>=draft.from&&x.date<=draft.to);
 }
 if(target.id==='overnightStay')reflectBudget();
 if(target.id==='peopleMode')reflectMode();
 if(['dateStart','dateEnd','budgetAmount','budgetScope'].includes(target.id))reflectDates();
 persistDraft();
}
function init(){
 const previous=readObject(STORE_DRAFT);
 if(previous&&previous.profiles&&Array.isArray(previous.profiles)&&previous.profiles.length===2){
  draft={...buildDefault(),...previous,profiles:previous.profiles.map(p=>({...buildDefault().profiles[0],...p}))};
  if(!datesBetween(draft.from,draft.to).length||draft.from<localISO(new Date())){draft.from=localISO(new Date());draft.to=draft.from;draft.events=[]}
 }else draft=buildDefault();
 // Keep existing answers while enforcing the two-person launch experience.
 draft.peopleMode='couple';draft.partySize=2;
 cfgToFields();goStep(0);updateSavedCount();
 document.addEventListener('click',handleGlobalClick);
 $('wizard').addEventListener('click',handleFormClick);
 $('wizard').addEventListener('input',handleField);
 $('wizard').addEventListener('change',handleField);
 $('wizard').addEventListener('submit',e=>{e.preventDefault();startPlan()});
 $('nextStep').addEventListener('click',nextStep);
 $('prevStep').addEventListener('click',prevStep);
 $('addEvent').addEventListener('click',makeEvent);
 $('editPlan').addEventListener('click',editWizard);
 $('savePlan').addEventListener('click',saveCurrent);
 $('sharePlan').addEventListener('click',shareCurrent);
}
document.addEventListener('DOMContentLoaded',init);
