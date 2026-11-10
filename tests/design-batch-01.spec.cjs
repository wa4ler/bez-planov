const {test,expect}=require('@playwright/test');
const assetBase='/assets/design-v1/';
const designAssets=[
 '01-hero-couple-moscow.svg','02-how-it-works.svg','03-route-map.svg',
 '04-memories-library.svg','05-interests.svg','06-pace.svg',
 '07-transport.svg','08-actions.svg','09-decorative-texture.svg',
 '10-insights.svg'
];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('All ten bespoke assets are served with full SVG source and decode',async({page,request})=>{
 await page.goto('/');
 for(const filename of designAssets){
  const r=await request.get(assetBase+filename);
  expect(r.status(),'Asset not found: '+filename).toBe(200);
  const contents=await r.text();
  expect(contents.length,'Asset suspiciously short: '+filename).toBeGreaterThan(200);
  expect(contents).toMatch(/<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  expect(contents).toMatch(/<\/svg>\s*$/);
 }
 const imageNames=designAssets.slice(0,4).concat(designAssets[8]);
 const decoding=await page.evaluate(async names=>{
   return Promise.all(names.map(async name=>{
     const img=new Image();
     img.src='/assets/design-v1/'+name;
     try{
       await img.decode();
       return {name,valid:img.naturalWidth>0,height:img.naturalHeight};
     }catch(e){return {name,valid:false,problem:String(e)}}
   }));
 },imageNames);
 expect(decoding.every(x=>x.valid),JSON.stringify(decoding)).toBe(true);
});

test('Premium images are embedded on real pages and remain distinct',async({page})=>{
 await page.goto('/');
 const hero=page.locator('.hero-art');
 await expect(hero).toBeVisible();
 await expect(hero).toHaveAttribute('src','./assets/design-v1/01-hero-couple-moscow.svg');
 await expect.poll(()=>hero.evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);
 await expect(page.locator('.story-premium-art img')).toHaveAttribute('src','./assets/design-v1/02-how-it-works.svg');
 await expect.poll(()=>page.locator('.story-premium-art img').evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);
 await page.locator('[data-screen="library"]:visible').first().click();
 const library=page.locator('.library-premium-art img');
 await expect(library).toBeVisible();
 await expect.poll(()=>library.evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);
 await page.screenshot({path:'test-results/design-library-'+test.info().project.name.replace(/\W/g,'-')+'.png',fullPage:true});
});

test('Scalable interest icons and 3 pace icons render as SVG symbols',async({page})=>{
 await page.goto('/');
 await page.locator('[data-action="new"]:visible').first().click();
 await page.locator('#dateStart').fill((()=>{let d=new Date();d.setDate(d.getDate()+5);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})());
 await page.locator('#nextStep').click();
 await expect(page.locator('#tasteOne .interest-svg')).toHaveCount(16);
 await expect(page.locator('#tasteOne [data-pref="food"] .interest-svg use')).toHaveAttribute('href','./assets/design-v1/05-interests.svg#food');
 const example=page.locator('#tasteOne .interest-svg').first();
 await expect(example).toBeVisible();
 await expect.poll(()=>example.evaluate(svg=>svg.getBBox().width)).toBeGreaterThan(0);
 await page.locator('#tasteOne [data-pref="food"][data-rating="2"]').click();
 await page.locator('#tasteOne [data-pref="nature"][data-rating="1"]').click();
 await page.locator('#nextStep').click();
 await page.locator('#tasteTwo [data-pref="art"][data-rating="2"]').click();
 await page.locator('#tasteTwo [data-pref="food"][data-rating="1"]').click();
 await page.locator('#nextStep').click();
 await expect(page.locator('[data-choice="pace"] .pace-svg')).toHaveCount(3);
 await expect.poll(()=>page.locator('[data-choice="pace"] .pace-svg').first().evaluate(svg=>svg.getBBox().width)).toBeGreaterThan(0);
});

test('Transport illustration buttons really update planner state and persist',async({page})=>{
 await page.goto('/');
 await page.locator('[data-action="new"]:visible').first().click();
 const when=new Date();when.setDate(when.getDate()+6);
 const pad=v=>String(v).padStart(2,'0');
 await page.locator('#dateStart').fill(when.getFullYear()+'-'+pad(when.getMonth()+1)+'-'+pad(when.getDate()));
 await page.locator('#nextStep').click();
 await page.locator('#tasteOne [data-pref="food"][data-rating="2"]').click();
 await page.locator('#tasteOne [data-pref="walk"][data-rating="1"]').click();
 await page.locator('#nextStep').click();
 await page.locator('#tasteTwo [data-pref="art"][data-rating="2"]').click();
 await page.locator('#tasteTwo [data-pref="food"][data-rating="1"]').click();
 await page.locator('#nextStep').click();
 await page.locator('#goalChoices [data-value="talk"]').click();
 await page.locator('#nextStep').click();
 await expect(page.locator('[data-transport-mode]')).toHaveCount(4);
 await page.locator('[data-transport-mode="taxi"]').click();
 await expect(page.locator('#transport')).toHaveValue('taxi');
 await expect(page.locator('[data-transport-mode="taxi"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#transport').selectOption('car');
 await expect(page.locator('[data-transport-mode="car"]')).toHaveAttribute('aria-pressed','true');
 await page.reload();
 await page.locator('[data-action="new"]:visible').first().click();
 await expect(page.locator('#transport')).toHaveValue('car');
});

test('Results embed vector route artwork and insight icons',async({page})=>{
 await page.goto('/');
 await page.locator('[data-action="new"]:visible').first().click();
 await page.locator('[data-choice="peopleMode"] [data-value="solo"]').click();
 const day=new Date();day.setDate(day.getDate()+7);
 await page.locator('#dateStart').fill(day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0'));
 await page.locator('#nextStep').click();
 await page.locator('#tasteOne [data-pref="nature"][data-rating="2"]').click();
 await page.locator('#tasteOne [data-pref="walk"][data-rating="1"]').click();
 await page.locator('#nextStep').click();
 await page.locator('#goalChoices [data-value="rest"]').click();
 await page.locator('#nextStep').click();
 await page.locator('#nextStep').click();
 await page.locator('#finishPlan').click();
 await expect(page.locator('#page-result')).toBeVisible();
 await expect(page.locator('#planCover img')).toHaveAttribute('src','./assets/design-v1/03-route-map.svg');
 await expect(page.locator('#planStats .insight-stat-icon')).toHaveCount(4);
 await expect.poll(()=>page.locator('#planStats .insight-stat-icon').first().evaluate(svg=>svg.getBBox().width)).toBeGreaterThan(0);
 await page.screenshot({path:'test-results/design-result-'+test.info().project.name.replace(/\W/g,'-')+'.png',fullPage:true});
});

test('No horizontal scrollbar on premium mobile screens',async({page})=>{
 await page.goto('/');
 for(const route of ['home','discover','library']){
   await page.locator('[data-screen="'+route+'"]:visible').first().click();
   await expect(page.locator('#page-'+route)).toBeVisible();
   const width=await page.evaluate(()=>({viewport:window.innerWidth,scroll:document.documentElement.scrollWidth}));
   expect(width.scroll,'Overflow in '+route).toBeLessThanOrEqual(width.viewport+2);
 }
});
