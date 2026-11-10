const {test,expect}=require('@playwright/test');
const photos=[
 '01-hero-original-poster','02-preferences-concept','03-route-evening','04-library-memories',
 '05-inspiration-rooftop','06-cafe-date','07-cinema-date','08-spa-date',
 '09-promenade-date','10-museum-date','11-pottery-date','12-bowling-strike',
 '13-dinner-date','14-planetarium-date','15-picnic-date'
];
test('Every approved full-resolution scene is present, decodes, and is used in the site',async({page,request})=>{
 await page.goto('/');
 const results=[];
 for(const name of photos){
  const response=await request.get('/assets/approved/'+name+'.webp');
  expect(response.status(),'Missing artwork: '+name).toBe(200);
  const bytes=await response.body();expect(bytes.byteLength).toBeGreaterThan(90000);
  results.push(name);
 }
 const decoded=await page.evaluate(async names=>{
  return Promise.all(names.map(async name=>{
   const img=new Image();img.src='/assets/approved/'+name+'.webp';
   try{await img.decode();return {name,width:img.naturalWidth,height:img.naturalHeight,ok:true}}
   catch(e){return {name,ok:false,error:String(e)}}
  }));
 },photos);
 expect(decoded.every(x=>x.ok&&x.width>=1500&&x.height>=900),JSON.stringify(decoded)).toBe(true);
 await expect(page.locator('.hero-art')).toHaveAttribute('src','./assets/approved/05-inspiration-rooftop.webp');
 await expect(page.locator('.editorial-tile img')).toHaveCount(3);
 await expect(page.locator('#planCover img')).toHaveAttribute('src','./assets/approved/03-route-evening.webp');
 await expect(page.locator('.approved-library-banner img')).toHaveAttribute('src','./assets/approved/04-library-memories.webp');
 await page.locator('[data-screen="discover"]:visible').first().click();
 await expect(page.locator('.idea-card')).toHaveCount(10);
 const refs=await page.locator('.idea-card img').evaluateAll(xs=>xs.map(e=>e.getAttribute('src')));
 expect(new Set(refs).size).toBe(10);
 await page.screenshot({path:'test-results/approved-ideas-'+test.info().project.name.replace(/\W/g,'-')+'.png',fullPage:true});
});
test('Date idea card starts the real couples questionnaire with both tastes selected',async({page})=>{
 await page.goto('/');
 await page.locator('[data-screen="discover"]:visible').first().click();
 await page.locator('.idea-card[data-interest="cinema"]').click();
 await expect(page.locator('#page-wizard')).toBeVisible();
 await expect(page.locator('.couple-only-note')).toBeVisible();
 const values=await page.evaluate(()=>({mode:draft.peopleMode,size:draft.partySize,one:draft.profiles[0].ratings.cinema,two:draft.profiles[1].ratings.cinema}));
 expect(values).toEqual({mode:'couple',size:2,one:2,two:2});
});
test('Legacy saved solo config is converted to the only supported format: two people',async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>{
   const cfg=buildDefault();
   cfg.peopleMode='solo';cfg.partySize=1;
   localStorage.setItem(STORE_DRAFT,JSON.stringify(cfg));
 });
 await page.reload();
 const state=await page.evaluate(()=>({mode:draft.peopleMode,size:draft.partySize,profiles:draft.profiles.length}));
 expect(state).toEqual({mode:'couple',size:2,profiles:2});
 await page.locator('[data-action="new"]:visible').first().click();
 await expect(page.locator('[data-choice="peopleMode"]')).toHaveCount(0);
 await expect(page.locator('.couple-only-note')).toContainText('Два человека');
});
test('Cinematic image cards remain within viewport, and library art loads on mobile',async({page})=>{
 await page.goto('/');
 for(const name of ['home','discover','library']){
  await page.locator('[data-screen="'+name+'"]:visible').first().click();
  await expect(page.locator('#page-'+name)).toBeVisible();
  const dims=await page.evaluate(()=>({view:innerWidth,scroll:document.documentElement.scrollWidth}));
  expect(dims.scroll,'Unexpected horizontal scroll on '+name).toBeLessThanOrEqual(dims.view+2);
 }
 const banner=page.locator('.approved-library-banner img');
 await banner.scrollIntoViewIfNeeded();
 await expect.poll(()=>banner.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
});
