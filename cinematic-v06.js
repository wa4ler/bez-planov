'use strict';
/* Couples-only cinematic date gallery. Progressive enhancement over v0.5 planner. */
const DATE_THEME_STORE='bezPlanovSavedThemesV06';
const DATE_THEMES={
 cafe:{title:'Кафе и кофейни',interest:'coffee',photo:'cafe.webp'},
 cinema:{title:'Кино',interest:'cinema',photo:'cinema.webp'},
 spa:{title:'СПА и релакс',interest:'romance',photo:'spa.webp'},
 walk:{title:'Прогулки по городу',interest:'walk',photo:'walk.webp'},
 culture:{title:'Музеи и выставки',interest:'art',photo:'culture.webp'},
 bowling:{title:'Боулинг',interest:'activity',photo:'bowling.webp'},
 dinner:{title:'Романтический ужин',interest:'food',photo:'dinner.webp'},
 planetarium:{title:'Планетарий',interest:'science',photo:'planetarium.webp'},
 picnic:{title:'Пикники и закаты',interest:'nature',photo:'picnic.webp'},
 workshop:{title:'Мастер-классы',interest:'unusual',photo:'workshop.webp'}
};
const filterState={Home:'all',Discover:'all'};
function savedDateThemes(){
 try{
  const ids=JSON.parse(localStorage.getItem(DATE_THEME_STORE)||'[]');
  return Array.isArray(ids)?[...new Set(ids.filter(x=>!!DATE_THEMES[x]))]:[];
 }catch(e){return []}
}
function storeDateThemes(ids){
 try{localStorage.setItem(DATE_THEME_STORE,JSON.stringify(ids));return true}catch(e){
  notify('Браузер не разрешил сохранить эту идею');return false
 }
}
function reflectDateHearts(){
 const liked=new Set(savedDateThemes());
 document.querySelectorAll('[data-action="date-like"]').forEach(b=>{
  const on=liked.has(b.dataset.idea);
  b.setAttribute('aria-pressed',String(on));
  b.classList.toggle('is-liked',on);
  const title=DATE_THEMES[b.dataset.idea]?.title||'идею';
  b.setAttribute('aria-label',(on?'Удалить из любимых идей: ':'Добавить в любимые идеи: ')+title);
 });
}
function renderSavedDateIdeas(){
 const node=document.getElementById('savedDateIdeas');if(!node)return;
 const ids=savedDateThemes();
 node.innerHTML=ids.length?ids.map(id=>{
  const t=DATE_THEMES[id];
  return '<div class="saved-date-idea"><img src="./assets/dates/'+t.photo+'" width="58" height="43" loading="lazy" alt="">'+
    '<button data-action="date-idea" data-idea="'+id+'" type="button">'+escapeHTML(t.title)+'</button>'+
    '<button type="button" data-action="date-like" data-idea="'+id+'" aria-label="Убрать из любимых: '+escapeHTML(t.title)+'">×</button></div>';
 }).join(''):'<p class="empty-memory">Пока нет любимых идей. Отметьте сердечком то, что хотите попробовать вместе.</p>';
 reflectDateHearts();
}
function toggleDateLike(id){
 if(!DATE_THEMES[id])return;
 const ids=savedDateThemes(),already=ids.includes(id);
 const next=already?ids.filter(x=>x!==id):[...ids,id];
 if(storeDateThemes(next)){reflectDateHearts();renderSavedDateIdeas();notify(already?'Идея убрана из избранного':'Идея сохранена для вас двоих ♥')}
}
function openDateTheme(id){
 const theme=DATE_THEMES[id];
 if(!theme)return;
 freshWizard();
 // If the chosen idea is in the advanced interest set, reveal its controls
 // for both participants instead of hiding the very topic they selected.
 if(PREFS.findIndex(x=>x.key===theme.interest)>=10){
  expandedTastes[0]=true;expandedTastes[1]=true;
 }
 // The old draft may come from a prelaunch solo/group experiment.
 draft.peopleMode='couple';draft.partySize=2;
 // Browsing an idea is a shared suggestion, NOT consent from both partners.
 // Put it into an editable free-text wish, leaving all individual ratings untouched.
 draft.perfectDay='Хотим попробовать: '+theme.title+'.';
 cfgToFields();persistDraft();goStep(0);showPage('wizard');
 const note=$('districtSelectionNote');
 if(note){
  note.textContent='♥ Вы выбрали «'+theme.title+'». Это только начало: каждый из вас сможет изменить свои предпочтения.';
  note.hidden=false;
 }
 notify('Направление «'+theme.title+'» добавлено к подбору');
}
function applyIdeaFilters(where){
 const grid=document.getElementById('dateGrid'+where),search=document.getElementById('ideaSearch'+where);
 if(!grid)return;
 const needle=(search?.value||'').toLocaleLowerCase('ru-RU').trim();
 let visible=0;
 grid.querySelectorAll('.date-card').forEach(card=>{
  const tag=(card.dataset.tags||'').split(' ');
  const matchMood=filterState[where]==='all'||tag.includes(filterState[where]);
  const matchText=!needle||(card.dataset.name||'').toLocaleLowerCase('ru-RU').includes(needle);
  const show=matchMood&&matchText;
  card.hidden=!show;
  if(show)visible++;
 });
 const empty=document.getElementById('empty'+where);
 if(empty)empty.hidden=visible>0;
 document.querySelectorAll('[data-where="'+where+'"][data-idea-filter]').forEach(b=>{
  const active=b.dataset.ideaFilter===filterState[where];
  b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));
 });
}
function showCinematicNav(pageName){
 document.querySelectorAll('.header [data-screen]').forEach(button=>{
  button.setAttribute('aria-current',button.dataset.screen===pageName?'page':'false');
 });
}
const originalCinematicShowPage=showPage;
showPage=function(pageName){originalCinematicShowPage(pageName);showCinematicNav(pageName)};
const originalCinematicRenderLibrary=renderLibrary;
renderLibrary=function(){originalCinematicRenderLibrary();renderSavedDateIdeas()};
function initCinematic(){
 document.querySelectorAll('[data-idea-filter]').forEach(b=>{
  b.addEventListener('click',()=>{
   const where=b.dataset.where;
   if(!(where in filterState))return;
   filterState[where]=b.dataset.ideaFilter;
   applyIdeaFilters(where);
  });
 });
 for(const where of Object.keys(filterState)){
  const input=document.getElementById('ideaSearch'+where);
  if(input)input.addEventListener('input',()=>applyIdeaFilters(where));
  applyIdeaFilters(where);
 }
 document.addEventListener('click',event=>{
  const element=event.target.closest('[data-action="date-idea"],[data-action="date-like"]');
  if(!element)return;
  if(element.dataset.action==='date-idea')openDateTheme(element.dataset.idea);
  else toggleDateLike(element.dataset.idea);
 });
 reflectDateHearts();showCinematicNav('home');
}
document.addEventListener('DOMContentLoaded',initCinematic);
