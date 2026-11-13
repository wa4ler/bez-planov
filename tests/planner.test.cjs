const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function engine(){
 const context=vm.createContext({console,localStorage:{getItem(){return null}}});
 for(const filename of ['catalog.js','planner-v04.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',filename),'utf8'),context,{filename});
 return source=>JSON.parse(JSON.stringify(vm.runInContext(source,context)));
}
const setup=`const c=buildDefault();c.from='2090-05-10';c.to=c.from;c.profiles.forEach(p=>p.ratings={art:2,history:2});`;

test('positive wishes never become animal, price or crowd prohibitions',()=>{
 const run=engine();
 for(const text of ['Хочу в зоопарк, люблю животных','Люблю аквариумы','Хочу дорогой ресторан','Люблю людные места']){
  const result=run(`(()=>{${setup}c.profiles[0].likes=${JSON.stringify(text)};const s=textSignals(c);return {restrictions:s.restrictions,zoo:placeEligible(PLACES['moscow-zoo'],c,s,{})}})()`);
  assert.deepEqual(result.restrictions,[],text);assert.equal(result.zoo,true,text);
 }
});
test('negative constraints have clause scope and preserve permitted interests',()=>{
 const run=engine();
 const result=run(`(()=>{${setup}c.profiles[0].likes='Хочу дорогой ресторан без толпы. Люблю животных и не люблю шум';return textSignals(c)})()`);
 assert.deepEqual(result.restrictions.sort(),['crowds','noise']);
 assert.ok(result.positive.includes('food'));assert.ok(result.positive.includes('nature'));
 assert.equal(result.avoid.includes('food'),false);
 const zoo=run(`(()=>{${setup}c.profiles[0].likes='Не хочу в зоопарк, но люблю музеи';const s=textSignals(c);return {s,zoo:placeEligible(PLACES['moscow-zoo'],c,s,{})}})()`);
 assert.equal(zoo.zoo,false);assert.ok(zoo.s.positive.includes('art'));assert.equal(zoo.s.avoid.includes('nature'),false);
});
test('specific price objection is not a global food ban; independent ban is retained',()=>{
 const run=engine();
 const a=run(`(()=>{${setup}c.profiles[0].likes='Не хочу дорогой ресторан, люблю недорогие кафе';return textSignals(c)})()`);
 assert.deepEqual(a.restrictions,['expensive']);assert.ok(a.positive.includes('food'));assert.equal(a.avoid.includes('food'),false);
 const b=run(`(()=>{${setup}c.profiles[0].likes='Не люблю кафе. Избегаю шума';return textSignals(c)})()`);
 assert.ok(b.avoid.includes('food'));
 const fears=run(`['Не боюсь высоты','Боюсь высоты'].map(t=>{const c=buildDefault();c.profiles[0].likes=t;return textSignals(c).restrictions})`);
 assert.deepEqual(fears,[[],['heights']]);
});
test('total budget pays uneven commitments before sharing discretionary money',()=>{
 const run=engine();
 const result=run(`(()=>{${setup}c.to='2090-05-11';c.budgetScope='total';c.budgetAmount=5000;c.events=[{id:'ticket',name:'Билет',date:c.from,time:'12:00',duration:60,cost:3000,paid:false}];const plan=generateItinerary(c,{});return {validation:validateConfig(c),limits:plan.days.map(d=>d.limit),spend:totalSpend(plan),over:plan.days.some(d=>daySpending(d,c).total>d.limit)}})()`);
 assert.equal(result.validation,'');assert.deepEqual(result.limits,[4000,1000]);assert.ok(result.spend<=5000);assert.equal(result.over,false);
});
test('daily budgets remain independent; paid outside budget is excluded',()=>{
 const run=engine();
 const result=run(`(()=>{${setup}c.to='2090-05-11';c.budgetAmount=5000;c.events=[{id:'ticket',name:'Билет',date:c.from,time:'12:00',duration:60,cost:100000,paid:true,includeBudget:false}];return {limits:[dayLimit(c,0,2),dayLimit(c,1,2)],valid:validateConfig(c),cost:bookingCost(c.events[0])}})()`);
 assert.deepEqual(result.limits,[5000,5000]);assert.equal(result.valid,'');assert.equal(result.cost,0);
});
test('required transport, lodging and included tickets cannot exceed the total budget',()=>{
 const run=engine();
 const result=run(`(()=>{${setup}c.to='2090-05-11';c.budgetAmount=5000;c.budgetScope='total';c.budgetCovers='all';c.overnightStay=true;c.hotelReserve=3000;c.transportReserve=500;c.events=[{id:'ticket',name:'Билет',date:c.from,time:'12:00',duration:60,cost:1500,paid:true,includeBudget:true}];return validateConfig(c)})()`);
 assert.match(result,/не хватает/);
});
test('date ranges allow 31 days and reject longer or invalid dates',()=>{
 const run=engine();
 const r=run(`(()=>{${setup}c.to='2090-06-09';const yes=validateConfig(c);c.to='2090-06-10';return {yes,no:validateConfig(c),invalid:datesBetween('2090-02-30','2090-03-01')}})()`);
 assert.equal(r.yes,'');assert.match(r.no,/31/);assert.deepEqual(r.invalid,[]);
});
test('long day contains explicit meal and rest breaks with accounted allowances',()=>{
 const run=engine();
 const result=run(`(()=>{${setup}const plan=generateItinerary(c,{}),d=plan.days[0];return {stops:d.stops,spending:daySpending(d,c),problems:scheduleProblems(d,c),travel:d.travel,walk:d.walkingEstimateKm}})()`);
 assert.ok(result.stops.some(s=>s.kind==='break'&&s.purpose==='meal'));
 assert.ok(result.stops.some(s=>s.kind==='break'&&s.purpose==='rest'));
 assert.ok(result.stops.filter(s=>s.kind==='break').every(s=>s.id&&Number.isFinite(s.cost)));
 assert.equal(result.spending.breaks,result.stops.filter(s=>s.kind==='break').reduce((s,b)=>s+b.cost,0));
 assert.deepEqual(result.problems,[]);
 assert.ok(result.travel.every(l=>l.approximate&&l.basis&&Number.isFinite(l.minutes)));
});
test('allergies and explicit food veto never lead to an unverified restaurant',()=>{
 const run=engine();
 const result=run(`(()=>{${setup}c.foodNeeds='Тяжёлая аллергия на орехи';c.profiles[0].ratings.food=-3;const p=generateItinerary(c,{});return {food:p.days.flatMap(d=>d.stops).filter(s=>s.kind==='place'&&PLACES[s.id].tags.includes('food')),meals:p.days.flatMap(d=>d.stops).filter(s=>s.kind==='break'&&s.purpose==='meal')}})()`);
 assert.deepEqual(result.food,[]);assert.ok(result.meals.length);assert.match(result.meals[0].description,/не проверены/);
});
test('fully anchored long day warns about unavailable breaks and preserves paid event',()=>{
 const run=engine();
 const r=run(`(()=>{${setup}c.events=[{id:'anchor',name:'Оплаченный день',date:c.from,time:'11:00',duration:480,cost:500,paid:true},{id:'anchor2',name:'Оплаченный вечер',date:c.from,time:'19:00',duration:120,cost:500,paid:true}];const p=generateItinerary(c,{});return p.days[0]})()`);
 assert.equal(r.stops.find(s=>s.id==='anchor').time,'11:00');assert.equal(r.stops.find(s=>s.id==='anchor2').time,'19:00');
 assert.ok(r.warnings.some(w=>w.includes('питание')));assert.ok(r.warnings.some(w=>w.includes('отдых')));
});
test('meal and rest pauses leave travel time before tickets at unknown addresses',()=>{
 const run=engine();
 for(const time of ['13:30','14:00','15:00','15:30','16:00']){
  const r=run(`(()=>{${setup}c.events=[{id:'paid',name:'Театр',address:'Неизвестный адрес',date:c.from,time:${JSON.stringify(time)},duration:90,cost:0,paid:true}];const p=generateItinerary(c,{});return {errors:scheduleProblems(p.days[0],c),fixed:p.days[0].stops.find(s=>s.id==='paid')}})()`);
  assert.deepEqual(r.errors,[],time);assert.equal(r.fixed.time,time);
 }
});
test('approximate transport estimate reflects distance and unknown-address buffers',()=>{
 const run=engine();
 const r=run(`(()=>{${setup}const a={kind:'place',id:'red-square'},b={kind:'place',id:'moskvarium'};return {foot:estimateTravel(a,b,{...c,transport:'foot'}),taxi:estimateTravel(a,b,{...c,transport:'taxi'}),unknown:estimateTravel(a,{kind:'fixed',name:'Неизвестный адрес'},c)}})()`);
 assert.ok(r.foot.distanceKm>5);assert.ok(r.foot.minutes>r.taxi.minutes);assert.equal(r.unknown.distanceKm,null);assert.equal(r.unknown.basis,'buffer-unknown');
});
test('start address is included in timing, rough travel and walking constraints',()=>{
 const run=engine();
 const r=run(`(()=>{${setup}c.startLocation='Московский планетарий';const p=generateItinerary(c,{}),d=p.days[0];return {leg:d.travel[0],errors:scheduleProblems(d,c),bad:scheduleProblems({date:c.from,stops:[{kind:'place',id:'red-square',time:'11:00',duration:50}]},{...c,transport:'foot',walkingLevel:'low'})}})()`);
 assert.equal(r.leg.fromId,'origin');assert.deepEqual(r.errors,[]);assert.ok(r.bad.length);
});
test('swap checks incoming and outgoing travel and preserves the original plan',()=>{
 const run=engine();
 const result=run(`(()=>{${setup}const p=generateItinerary(c,{}),before=JSON.stringify(p);for(let i=0;i<p.days[0].stops.length;i++){const alt=alternativesFor(p,0,i,{});if(alt.length){const n=safeSwapStop(p,0,i,alt[0].id,{});return {found:true,originalSame:before===JSON.stringify(p),timeSame:n.days[0].stops[i].time===p.days[0].stops[i].time,problems:scheduleProblems(n.days[0],c),spend:totalSpend(n),limit:totalLimit(c,n.days.length)}}}return {found:false}})()`);
 assert.equal(result.found,true);assert.equal(result.originalSame,true);assert.equal(result.timeSame,true);assert.deepEqual(result.problems,[]);assert.ok(result.spend<=result.limit);
 const distant=run(`(()=>{${setup}c.transport='foot';const p={config:c,days:[{areaId:'patriki',limit:10000,reserve:{total:0},stops:[{kind:'place',id:'planetarium',time:'11:00',duration:95},{kind:'place',id:'bulgakov',time:'12:50',duration:70},{kind:'fixed',id:'paid',name:'Московский планетарий',address:'Московский планетарий',time:'14:30',duration:60}]}]};return candidateFits(p,0,1,PLACES['depo-lesnaya'])})()`);
 assert.equal(distant,false);
});
test('rebuild preserves fixed and locked timestamps without mutating the original',()=>{
 const run=engine();
 const r=run(`(()=>{${setup}c.events=[{id:'paid',name:'Купленный билет',date:c.from,time:'18:00',duration:60,cost:500,paid:true}];const p=generateItinerary(c,{}),first=p.days[0].stops.find(s=>s.kind==='place');first.locked=true;const before=JSON.stringify(p),n=rebuildDay(p,0,{});return {original:before===JSON.stringify(p),lockedOld:first,lockedNew:n.days[0].stops.find(s=>s.id===first.id),paid:n.days[0].stops.find(s=>s.id==='paid'),problems:scheduleProblems(n.days[0],c)}})()`);
 assert.equal(r.original,true);assert.deepEqual(r.lockedNew,r.lockedOld);assert.equal(r.paid.time,'18:00');assert.deepEqual(r.problems,[]);
});
