const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
function future(days){
 const d=new Date();d.setDate(d.getDate()+days);
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
test('Recognizes short exact landmark names without accidental substring matches',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(()=>({
   yes:mentionedPlaceIds('Были в ГУМ, мечтаем попасть на ВДНХ и в ГЭС-2'),
   no:mentionedPlaceIds('Изучаем гуманитарные дисциплины')
 }));
 expect(result.yes).toEqual(expect.arrayContaining(['gum','vdnh-park','ges2']));
 expect(result.no).not.toContain('gum');
});

test('Route link starts at the requested address; subsequent overnight days start at hotel',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(()=>{
   const cfg=buildDefault();cfg.from='2027-02-10';cfg.to='2027-02-12';
   cfg.startLocation='метро Тверская';cfg.hotelAddress='Гостиница у Кремля, Москва';cfg.overnightStay=true;
   const first={date:'2027-02-10',stops:[{kind:'place',id:'gum',time:'11:00',duration:45},{kind:'place',id:'zaryadye',time:'12:05',duration:65}]};
   const second={...first,date:'2027-02-11'};
   return {
     originFirst:itineraryOrigin(first,cfg),
     originSecond:itineraryOrigin(second,cfg),
     urlFirst:dayMap(first,cfg),
     urlSecond:dayMap(second,cfg)
   };
 });
 expect(result.originFirst).toBe('метро Тверская');
 expect(result.originSecond).toBe('Гостиница у Кремля, Москва');
 expect(new URL(result.urlFirst).searchParams.get('origin')).toBe('метро Тверская');
 expect(new URL(result.urlSecond).searchParams.get('origin')).toBe('Гостиница у Кремля, Москва');
 expect(new URL(result.urlFirst).searchParams.get('waypoints')).toContain('Красная площадь');
});

test('Exported ICS uses UTC instants, preserving Moscow event times abroad',async({page})=>{
 await page.goto('/');
 await page.locator('.hero-cta-row [data-action="new"]').click();

 const day=future(9);
 await page.locator('#dateStart').fill(day);
 await page.locator('#dateEnd').fill(day);
 await page.locator('#nextStep').click();
 await page.locator('#tasteOne [data-pref="walk"][data-rating="2"]').click();
 await page.locator('#tasteOne [data-pref="nature"][data-rating="1"]').click();
 await page.locator('#nextStep').click();
 await page.locator('#tasteTwo [data-pref="food"][data-rating="2"]').click();
 await page.locator('#tasteTwo [data-pref="art"][data-rating="1"]').click();
 await page.locator('#nextStep').click();
 await page.locator('#goalChoices [data-value="rest"]').click();
 await page.locator('#nextStep').click();
 await page.locator('#startLocation').fill('метро Тверская');
 await page.locator('#nextStep').click();
 await page.locator('#finishPlan').click();
 await expect(page.locator('#page-result')).toBeVisible();
 await expect(page.locator('.route-origin-note')).toContainText('метро Тверская');
 const mapHref=await page.locator('#dayResult .day-sidebar a[href*="google.com/maps/dir"]').getAttribute('href');
 expect(new URL(mapHref).searchParams.get('origin')).toBe('метро Тверская');
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#exportCalendar').click()]);
 const ics=await fs.readFile(await download.path(),'utf8');
 expect(ics).toContain('BEGIN:VCALENDAR');
 expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
 expect(ics).not.toContain('DTSTART;TZID=');
 const formatted=day.replace(/-/g,'');
 expect(ics).toContain('DTSTART:'+formatted+'T080000Z');
});
