const {test,expect}=require('@playwright/test');
test('Cinematic homepage matches the approved dark photographic direction and works on phones',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/Свидания/}).first()).toBeVisible();
 await expect(page.locator('#dateGridHome .date-card')).toHaveCount(10);
 await expect(page.locator('#dateGridHome .date-card img')).toHaveCount(10);
 await expect(page.locator('.hero-art')).toHaveAttribute('src','./assets/dates/picnic.webp');
 await expect.poll(()=>page.locator('.hero-art').evaluate(i=>i.complete&&i.naturalWidth>=1600)).toBe(true);
 const width=await page.evaluate(()=>({window:innerWidth,scroll:document.documentElement.scrollWidth}));
 expect(width.scroll).toBeLessThanOrEqual(width.window+2);
 await page.screenshot({path:'test-results/cinematic-home-'+test.info().project.name.replace(/\W/g,'-')+'.png',fullPage:true});
});
test('Date mood filters and search actually filter the displayed cards',async({page})=>{
 await page.goto('/');
 await page.locator('[data-idea-filter="active"][data-where="Home"]').click();
 await expect(page.locator('#dateGridHome .date-card:visible')).toHaveCount(3);
 await page.locator('[data-idea-filter="all"][data-where="Home"]').click();
 await page.locator('#ideaSearchHome').fill('планетарий');
 await expect(page.locator('#dateGridHome .date-card:visible')).toHaveCount(1);
 await expect(page.locator('#dateGridHome .date-card[data-idea="planetarium"]')).toBeVisible();
 await page.locator('#ideaSearchHome').fill('нет такого');
 await expect(page.locator('#emptyHome')).toBeVisible();
});
test('Save and remove favorite ideas locally without a fake account',async({page})=>{
 await page.goto('/');
 const heart=page.locator('#dateGridHome [data-action="date-like"][data-idea="cinema"]');
 await heart.click();
 await expect(heart).toHaveAttribute('aria-pressed','true');
 await page.locator('[data-screen="library"]:visible').first().click();
 await expect(page.locator('#savedDateIdeas')).toContainText('Кино');
 await page.reload();
 await page.locator('[data-screen="library"]:visible').first().click();
 await expect(page.locator('#savedDateIdeas')).toContainText('Кино');
 await page.locator('#savedDateIdeas [data-action="date-like"][data-idea="cinema"]').click();
 await expect(page.locator('#savedDateIdeas')).not.toContainText('Кино');
});
test('Selecting a date idea opens the real two-partner wizard without inventing bookings',async({page})=>{
 await page.goto('/');
 await page.locator('#dateGridHome [data-action="date-idea"][data-idea="cafe"]').click();
 await expect(page.locator('#page-wizard')).toBeVisible();
 await expect(page.locator('#districtSelectionNote')).toContainText('Кафе');
 await expect(page.locator('.couples-only-note')).toContainText('двоих');
 await expect(page.locator('[data-choice="peopleMode"]')).toHaveCount(0);
 const state=await page.evaluate(()=>({
   mode:draft.peopleMode,partySize:draft.partySize,
   first:draft.profiles[0].ratings.coffee??null,
   second:draft.profiles[1].ratings.coffee??null,
   shared:draft.perfectDay
 }));
 expect(state).toEqual({mode:'couple',partySize:2,first:null,second:null,shared:'Хотим попробовать: Кафе и кофейни.'});
 await page.locator('#dateStart').fill('2027-02-18');
 await page.locator('#dateEnd').fill('2027-02-19');
 await page.locator('#nextStep').click();
 await expect(page.locator('#tasteOne [data-pref="coffee"][data-rating="1"]')).toHaveAttribute('aria-pressed','false');
 // Each partner must independently give at least two answers; choosing a card does not answer for them.
 await page.locator('#tasteOne [data-pref="coffee"][data-rating="1"]').click();
 await page.locator('#tasteOne [data-pref="art"][data-rating="1"]').click();
 await page.locator('#nextStep').click();
 await expect(page.locator('[data-step="2"]')).toBeVisible();
});
test('Both participants remain required even when restoring an old solo draft',async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>{
   draft.peopleMode='solo';draft.partySize=1;persistDraft();
 });
 await page.reload();
 await page.locator('[data-action="new"]:visible').first().click();
 const state=await page.evaluate(()=>({mode:draft.peopleMode,people:draft.partySize,steps:effectiveStepList()}));
 expect(state).toEqual({mode:'couple',people:2,steps:[0,1,2,3,4,5]});
});

test('Deleting personal browser data also removes favorite date categories',async({page})=>{
 await page.goto('/');
 await page.locator('#dateGridHome [data-action="date-like"][data-idea="cinema"]').click();
 await expect(page.locator('#dateGridHome [data-action="date-like"][data-idea="cinema"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('[data-screen="library"]:visible').first().click();
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('[data-action="clear-local"]').click();
 await expect(page.locator('#savedDateIdeas')).not.toContainText('Кино');
 await page.reload();
 await page.locator('[data-screen="library"]:visible').first().click();
 await expect(page.locator('#savedDateIdeas')).not.toContainText('Кино');
});
test('Planner rejects solo and group modes while public launch is couples-only',async({page})=>{
 await page.goto('/');
 const errors=await page.evaluate(()=>{
  const c=buildDefault();
  const a={...c,peopleMode:'solo',partySize:1};
  const b={...c,peopleMode:'group',partySize:4};
  const two={...c,peopleMode:'couple',partySize:2};
  return [validateConfig(a),validateConfig(b),validateConfig(two)];
 });
 expect(errors[0]).toContain('для двоих');
 expect(errors[1]).toContain('для двоих');
 expect(errors[2]).toBe('');
});

test('All thirteen approved high-resolution photographs actually decode',async({page,request})=>{
 await page.goto('/');
 const names=['bowling','cafe','cinema','culture','dinner','memories','our-route','our-tastes','picnic','planetarium','spa','walk','workshop'];
 const results=await page.evaluate(async(names)=>Promise.all(names.map(async(name)=>{
  const image=new Image();image.src='./assets/dates/'+name+'.webp';
  try{await image.decode();return {name,width:image.naturalWidth,height:image.naturalHeight}}catch(e){return {name,width:0,height:0,error:String(e)}}
 })),names);
 for(const result of results){
  expect(result.width,result.name+' did not decode').toBeGreaterThanOrEqual(1600);
  expect(result.height,result.name+' unexpectedly lost detail').toBeGreaterThanOrEqual(900);
 }
});
