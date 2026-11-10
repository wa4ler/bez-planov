'use strict';
/* Без планов · premium visual and product layer 0.5
   This file adds genuine, local-first functionality. No fake AI or live availability. */

const iconSVG=(name,cls='ui-icon')=>'<svg class="'+cls+'" aria-hidden="true"><use href="./assets/icons.svg#'+name+'"></use></svg>';
const districtImage=id=>'./assets/areas/'+(AREA_BY_ID[id]?id:'center')+'.svg';
const MOMENTS_STORE='bezPlanovMomentsV05';
const expandedTastes={0:false,1:false};
const extraLabels={food:'food',walk:'route',art:'museum',history:'museum',activity:'ticket',
nature:'leaf',romance:'heart',unusual:'spark',views:'sun',cinema:'ticket',coffee:'coffee',
architecture:'museum',science:'spark',water:'route',shopping:'gift',photography:'camera'};
const introTips=[
 ['calendar','От одного вечера до 14 дней. Указывайте общий бюджет на всю компанию, не на человека.'],
 ['heart','Всё просто: «♥» — приоритет, «✓» — приятно, «×» — не предлагать. Пустое значение означает «не знаю».'],
 ['heart','Пусть второй человек ответит самостоятельно. «Точно нет» у любого из вас — общий запрет.'],
 ['spark','Отмечайте эмоции и то, ради чего вы вообще выбираетесь из дома. Это влияет на подбор.'],
 ['route','Адрес старта, пешая нагрузка, уже знакомые места и купленные билеты помогают избежать нелепых маршрутов.'],
 ['shield','Сверьте свои пожелания. Мы не создадим неподходящее место ради красивых цифр.']
];
function iconText(name,txt){return iconSVG(name)+ '<span>'+escapeHTML(txt)+'</span>'}
function refreshMobileNavigation(active){
 document.querySelectorAll('.mobile-bottom-nav [data-screen]').forEach(b=>
  b.setAttribute('aria-current',b.dataset.screen===active?'page':'false'));
}
const originalShowPage=showPage;
showPage=function(name){
 originalShowPage(name);
 refreshMobileNavigation(name);
};
// An illustrated transport picker mirrors the native select; both change the same configuration.
function synchronizeTransportChoices(){
 const select=$('transport');if(!select)return;
 document.querySelectorAll('[data-transport-mode]').forEach(b=>{
  const selected=b.dataset.transportMode===select.value;
  b.classList.toggle('active',selected);
  b.setAttribute('aria-pressed',String(selected));
 });
}
const originalCfgToFields=cfgToFields;
cfgToFields=function(){
 originalCfgToFields();
 synchronizeTransportChoices();
};
const originalRenderTaste=renderTaste;
renderTaste=function(){
 originalRenderTaste();
 for(const [person,id] of [[0,'tasteOne'],[1,'tasteTwo']]){
  const root=$(id);if(!root)continue;
  const list=root.querySelectorAll('.taste-row');
  const expand=expandedTastes[person];
  list.forEach((row,i)=>{row.classList.toggle('premium-extra',i>=10);row.hidden=i>=10&&!expand});
  if(list.length>10){
   const btn=document.createElement('button');btn.type='button';btn.className='expand-tastes';
   btn.dataset.action='expand-tastes';btn.dataset.person=person;
   btn.setAttribute('aria-expanded',String(expand));
   btn.textContent=(expand?'Скрыть дополнительные интересы':'Показать ещё '+(list.length-10)+' интересов')+(expand?' ↑':' ↓');
   root.appendChild(btn);
  }
 }
};
const originalGoStep=goStep;
goStep=function(n){
 originalGoStep(n);
 const step=document.querySelector('.wizard-step[data-step="'+n+'"]');
 if(step&&!step.querySelector('.premium-question-tip')){
  const [icon,text]=introTips[n];
  const container=document.createElement('div');
  container.className='premium-question-tip';
  container.innerHTML=iconSVG(icon)+'<span>'+escapeHTML(text)+'</span>';
  const description=step.querySelector('.section-description');
  if(description)description.insertAdjacentElement('afterend',container);
 }
 // Big-form progress is functional: show actual count including skipped solo step.
};
const originalRenderReview=renderReview;
renderReview=function(){
 originalRenderReview();
 const recognized=$('recognizedPreview');
 if(!recognized)return;
 const wished=mentionedPlaceIds(draft.dreamPlaces||'');
 const visited=mentionedPlaceIds(draft.alreadyVisited||'');
 if(!wished.length&&!visited.length)return;
 const summary=document.createElement('div');
 summary.className='premium-question-tip';summary.style.marginTop='16px';
 summary.innerHTML=iconSVG('pin')+'<span>'+escapeHTML(
  'Из ваших названий мест распознано '+wished.length+' желаний и '+visited.length+' уже посещённых мест. Неизвестные названия останутся текстовыми заметками. Часть желаний может не попасть в маршрут из-за бюджета, запретов или времени.'
 )+'</span>';
 recognized.insertAdjacentElement('afterend',summary);
};
const originalRenderResult=renderResult;
renderResult=function(){
 originalRenderResult();
 if(!currentPlan)return;
 const cfg=currentPlan.config;
 const days=currentPlan.days.length;
 // Icons are SVG symbols, not font glyphs; they remain sharp on Retina displays.
 const iconIds=['date','location','budget','budget'];
 $('planStats').querySelectorAll('.stat').forEach((item,i)=>{
  const mark=document.createElementNS('http://www.w3.org/2000/svg','svg');
  mark.setAttribute('class','insight-stat-icon');
  mark.setAttribute('aria-hidden','true');
  const use=document.createElementNS('http://www.w3.org/2000/svg','use');
  use.setAttribute('href','./assets/design-v1/10-insights.svg#'+(iconIds[i]||'details'));
  mark.appendChild(use);
  item.prepend(mark);
 });
 const pair=pairStats(cfg);
 const who=cfg.peopleMode==='solo'?'вашим личным интересам':cfg.peopleMode==='couple'?'вашим общим и индивидуальным желаниям':'пожеланиям компании';
 $('planCoverText').textContent='Мы собрали '+days+' '+dayWord(days)+' по '+who+
  ', с учётом темпа, ограничений и бюджета. Остановки можно менять, а оплаченные события останутся на своих местах.';
 const common=pair.common.slice(0,3);
 const signals=currentPlan.signals||textSignals(cfg);
 const labels=common.length?common:signals.recognized.slice(0,3);
 const pills=labels.length?labels:['Ваш ритм','Ваш бюджет','Без запрещённых мест'];
 $('planInterestPills').innerHTML=pills.map(s=>'<span>✳ '+escapeHTML(s)+'</span>').join('');
 const wishes=mentionedPlaceIds(cfg.dreamPlaces||'');
 const matched=currentPlan.days.flatMap(d=>d.stops).filter(s=>s.kind==='place'&&wishes.includes(s.id));
 const review=document.getElementById('wishStatus');
 if(review)review.remove();
 if(wishes.length){
  const node=document.createElement('div');node.id='wishStatus';node.className='wish-status';
  const missing=wishes.filter(id=>!matched.some(s=>s.id===id));
  node.innerHTML='<strong>'+iconSVG('spark')+' Ваш список желаний: '+(wishes.length-missing.length)+' из '+wishes.length+' известных мест включено</strong>'+
   (missing.length?'<p>Не получилось включить сейчас: '+missing.map(id=>escapeHTML(PLACES[id].name)).join(', ')+'. Возможные причины: стоимость, расписание, запрет категории или нехватка времени.</p>':
    '<p>Включили: '+wishes.map(id=>escapeHTML(PLACES[id].name)).join(', ')+'.</p>');
  $('planCover').insertAdjacentElement('afterend',node);
 }
 // Make the active day accessible while preserving the tab semantics.
 $('daysTabs').querySelectorAll('button').forEach(tab=>tab.setAttribute('tabindex',tab.getAttribute('aria-selected')==='true'?'0':'-1'));
};
const originalRenderDay=renderDay;
renderDay=function(){
 originalRenderDay();
 if(!currentPlan)return;
 const day=currentPlan.days[currentDay],cfg=currentPlan.config;
 const header=document.querySelector('#dayResult .day-header');
 if(header){
  header.querySelectorAll('img').forEach(x=>x.remove());
  const img=document.createElement('img');
  img.src=districtImage(day.areaId);
  img.alt='';img.loading='lazy';img.width=620;img.height=485;
  header.prepend(img);
 }
 const stops=Array.from(document.querySelectorAll('#dayResult .stop'));
 stops.forEach((el,i)=>{
   const s=day.stops[i];if(!s)return;
   const visual=el.querySelector('.stop-visual');
   if(visual){
     const tag=s.kind==='fixed'?'calendar':(PLACES[s.id]?.tags[0]||'unusual');
     const sprite=s.kind==='fixed'?'08-actions.svg':'05-interests.svg';
     visual.innerHTML='<svg class="design-icon" aria-hidden="true"><use href="./assets/design-v1/'+sprite+'#'+escapeHTML(tag)+'"></use></svg>';
   }
   const why=el.querySelector('.stop-why');
   if(why&&s.kind==='place'&&mentionedPlaceIds(cfg.dreamPlaces).includes(s.id)){
     why.textContent+=' · ✦ Вы просили включить именно это место';
   }
   if(i<day.stops.length-1){
     const next=day.stops[i+1];
     const slack=minutes(next.time)-minutes(s.time)-(Number(s.duration)||0);
     if(slack>0){
       const travel=document.createElement('div');
       travel.className='stop-journey-message';
       travel.innerHTML=iconSVG('route')+'<span>Между остановками заложено '+slack+' мин. Это резерв, не рассчитанное время пути.</span>';
       el.insertAdjacentElement('afterend',travel);
     }
   }
 });
 const aside=document.querySelector('#dayResult .day-sidebar');
 if(aside){
  const old=aside.querySelector('.route-sketch');if(old)old.remove();
  const route=document.createElement('div');
  route.className='route-sketch';
  const stopsDay=day.stops.length;
  const length=Math.min(stopsDay,8);
  if(length){
   const points=Array.from({length},(_,i)=>{
    const x=26+i*36;
    const y=55+Math.sin(i*1.5)*26;
    return {x,y,num:i+1};
   });
   const line=points.map((p,i)=>(i?'L':'M')+' '+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');
   route.innerHTML='<h4>'+iconSVG('route')+' Порядок остановок</h4>'+
    '<svg viewBox="0 0 '+Math.max(280,(length-1)*36+55)+' 120" role="img" aria-label="Условная схема последовательности остановок, не географическая карта">'+
    '<path d="'+line+'" stroke="#a3c3a5" stroke-width="4" stroke-dasharray="5 7" fill="none" stroke-linecap="round"/>'+
    points.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="14" fill="#244b3b" stroke="#f4e4cb" stroke-width="3"/>'+
      '<text x="'+p.x+'" y="'+(p.y+4)+'" fill="white" text-anchor="middle" font-size="11" font-family="sans-serif" font-weight="bold">'+p.num+'</text>').join('')+
    '</svg><small>Это схема порядка, не карта и не масштаб. Для дороги воспользуйтесь ссылкой на карты выше.</small>';
   const note=aside.querySelector('.sidebar-note');
   if(note)aside.insertBefore(route,note);
   else aside.appendChild(route);
  }
 }
};
const originalRenderLibrary=renderLibrary;
renderLibrary=function(){
 originalRenderLibrary();
 renderMemories();
};
function readMemories(){return readArray(MOMENTS_STORE).filter(v=>v&&typeof v.text==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.date))}
function renderMemories(){
 const list=$('memoriesList');if(!list)return;
 const memories=readMemories().slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
 list.innerHTML=memories.length?memories.map(m=>
  '<article class="memory-card"><strong>♡ '+escapeHTML(dateLabel(m.date))+'</strong><p>'+escapeHTML(m.text)+'</p>'+
  '<button type="button" class="button-text" data-action="delete-memory" data-id="'+escapeHTML(m.id)+'">Удалить запись</button></article>'
 ).join(''):'<div class="empty-memory">Пока здесь тихо. Когда случится что-то хорошее, сохраните это своими словами.</div>';
}
function addMemory(e){
 e.preventDefault();
 const date=$('memoryDate').value,text=cleanText($('memoryText').value,650);
 if(!date||!datesBetween(date,date).length){notify('Укажите дату воспоминания');return}
 if(text.length<5){notify('Расскажите о воспоминании хотя бы в нескольких словах');return}
 const current=readMemories();
 current.unshift({id:String(Date.now())+'-'+Math.random().toString(36).slice(2,6),date,text});
 if(!writeStore(MOMENTS_STORE,current.slice(0,80))){notify('Не удалось сохранить запись');return}
 $('memoryText').value='';renderMemories();notify('Момент сохранён ♡');
}
function exportCalendar(){
 if(!currentPlan)return;
 const cfg=currentPlan.config;
 function icsEscape(x){return String(x||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')}
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','CALSCALE:GREGORIAN','METHOD:PUBLISH','PRODID:-//BEZPLANOV//RUSSIAN ITINERARY//RU'];
 for(const day of currentPlan.days){
  for(const s of day.stops){
   const p=s.kind==='place'?PLACES[s.id]:null;
   const title=s.kind==='place'?p?.name:s.name;
   const addr=s.kind==='place'?p?.address:s.address;
   if(!title)continue;
   const start=minutes(s.time),end=start+(Number(s.duration)||60);
   // Convert Moscow-local event times to UTC so calendars in other time zones
   // display the correct local instant, without relying on VTIMEZONE support.
   const asUTC=ns=>{
     const hh=String(Math.floor(ns/60)).padStart(2,'0'),mm=String(ns%60).padStart(2,'0');
     return new Date(day.date+'T'+hh+':'+mm+':00+03:00').toISOString()
       .replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
   };
   lines.push('BEGIN:VEVENT','UID:'+icsEscape(currentPlan.id+'-'+day.date+'-'+s.id)+'@bez-planov.pages.dev',
     'DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z/,'Z'),
     'DTSTART:'+asUTC(start),
     'DTEND:'+asUTC(Math.min(end,1439)),
     'SUMMARY:'+icsEscape('Без планов · '+title),
     'DESCRIPTION:'+icsEscape('Планируемое посещение. Проверьте время работы и билеты.'),
     'LOCATION:'+icsEscape(addr||'Москва'),'END:VEVENT');
  }
 }
 lines.push('END:VCALENDAR');
 const blob=new Blob([lines.join('\r\n')],{type:'text/calendar;charset=utf-8'});
 const url=URL.createObjectURL(blob);const link=document.createElement('a');
 link.href=url;link.download='bez-planov-marshrut.ics';document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
 notify('Файл календаря подготовлен. На iPhone откройте его из «Файлов», чтобы добавить события.');
}
function printAllDays(){
 if(!currentPlan)return;
 const plan=currentPlan,cfg=plan.config;
 const rows=plan.days.map((day,i)=>
  '<h2>День '+(i+1)+' · '+escapeHTML(dateLabel(day.date))+' — '+escapeHTML(AREA_BY_ID[day.areaId]?.name||'Москва')+'</h2>'+
  '<table><tr><th>Время</th><th>Место</th><th>Ориентир</th></tr>'+
  day.stops.map(s=>{
   const p=s.kind==='place'?PLACES[s.id]:null;
   return '<tr><td>'+escapeHTML(s.time)+'</td><td>'+escapeHTML(p?.name||s.name||'')+'<br><small>'+
    escapeHTML(p?.address||s.address||'')+'</small></td><td>'+escapeHTML(s.kind==='place'?formatMoney(priceAllowance(p,cfg.partySize)):s.paid?'Оплачено':formatMoney(s.cost))+'</td></tr>';
  }).join('')+'</table>'
 ).join('');
 const html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Без планов — программа поездки</title>'+
  '<style>body{font:14px/1.6 Arial,sans-serif;padding:30px;max-width:900px;margin:auto;color:#173d33}h1{font-size:27px}h2{margin-top:32px}table{border-collapse:collapse;width:100%;margin-bottom:14px}td,th{border-bottom:1px solid #ddd;padding:10px;text-align:left;vertical-align:top}small{color:#567}p{color:#567}@media print{body{padding:0}}</style></head><body>'+
  '<h1>Без планов · ваши дни в Москве</h1><p>Период: '+escapeHTML(dateLabel(cfg.from))+' — '+escapeHTML(dateLabel(cfg.to))+
  ' · Бюджет '+formatMoney(totalLimit(cfg,plan.days.length))+'</p>'+rows+
  '<p>Важно: суммы ориентировочные, часы работы и дорогу проверьте самостоятельно. Результат составлен локальным алгоритмом.</p>'+
  '</body></html>';
 const win=window.open('','_blank');
 if(!win){notify('Браузер заблокировал окно печати. Разрешите всплывающие окна.');return}
 win.document.open();win.document.write(html);win.document.close();
 win.focus();setTimeout(()=>{try{win.print()}catch(e){}},400);
}
function usePremium(){
 const root=document.body;
 document.querySelectorAll('.mobile-bottom-nav [data-screen]').forEach(b=>b.setAttribute('aria-current',b.dataset.screen==='home'?'page':'false'));
 $('exportCalendar').addEventListener('click',exportCalendar);
 synchronizeTransportChoices();
 $('transport').addEventListener('change',synchronizeTransportChoices);
 document.querySelectorAll('[data-transport-mode]').forEach(b=>{
  b.addEventListener('click',()=>{
   const el=$('transport');
   el.value=b.dataset.transportMode;
   el.dispatchEvent(new Event('change',{bubbles:true}));
   synchronizeTransportChoices();
  });
 });
 $('printItinerary').addEventListener('click',printAllDays);
 $('memoryDate').value=localISO(new Date());
 $('memoryForm').addEventListener('submit',addMemory);
 document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-action="expand-tastes"]');
  if(btn){
   const p=Number(btn.dataset.person);
   expandedTastes[p]=!expandedTastes[p];
   renderTaste();return;
  }
  const remove=e.target.closest('[data-action="delete-memory"]');
  if(remove){
   if(!window.confirm('Удалить это воспоминание?'))return;
   if(writeStore(MOMENTS_STORE,readMemories().filter(m=>m.id!==remove.dataset.id))){
     renderMemories();notify('Воспоминание удалено');
   }return;
  }

 },true);
}
document.addEventListener('DOMContentLoaded',usePremium);
