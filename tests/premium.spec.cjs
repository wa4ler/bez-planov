const {test,expect}=require('@playwright/test');
function future(days){const d=new Date();d.setDate(d.getDate()+days);const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())}
async function begin(page){await page.goto('/');await page.locator('.hero-cta-row [data-action="new"]').click()}
async function next(page){await page.locator('#nextStep').click()}
async function rate(page,p,key,val){await page.locator('#taste'+(p===0?'One':'Two')+' [data-pref="'+key+'"][data-rating="'+val+'"]').click()}
test('Hand-painted hero, all eight illustrated districts, and district selection work',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.hero-art')).toBeVisible();
 await expect.poll(()=>page.locator('.hero-art').evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);
 await expect(page.locator('.hero-art')).toHaveAttribute('src','./assets/hero-moscow.webp');
 await page.locator('[data-screen="discover"]:visible').first().click();
 await expect(page.locator('#page-discover')).toBeVisible();
 await expect(page.locator('.district-card')).toHaveCount(8);
 const cards=page.locator('.district-card img');
 expect(await cards.count()).toBe(8);
 await expect.poll(()=>cards.first().evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);
 await page.locator('.district-card[data-district="zamos"] .district-action').click();
 await expect(page.locator('#page-wizard')).toBeVisible();
 await expect(page.locator('#districtSelectionNote')).toContainText('Замоскворечье');
 await page.screenshot({path:'test-results/premium-discover-'+test.info().project.name.replace(/\W/g,'-')+'.png',fullPage:true});
});
test('16 interests, free answers, visited exclusions and desired venue appear in result',async({page})=>{
 await begin(page);
 await page.locator('#dateStart').fill(future(9));
 await page.locator('#dateEnd').fill(future(9));
 await page.locator('#budgetAmount').fill('16000');
 await next(page);
 await expect(page.locator('#tasteOne .taste-row')).toHaveCount(16);
 await expect(page.locator('#tasteOne .taste-row:not([hidden])')).toHaveCount(10);
 await page.locator('#tasteOne [data-action="expand-tastes"]').click();
 await expect(page.locator('#tasteOne .taste-row:not([hidden])')).toHaveCount(16);
 await rate(page,0,'art','2');await rate(page,0,'coffee','2');
 await page.locator('#likesOne').fill('Люблю музеи, но не люблю долгие прогулки.');
 await next(page);
 await page.locator('#tasteTwo [data-action="expand-tastes"]').click();
 await rate(page,1,'art','1');await rate(page,1,'coffee','1');
 await page.locator('#likesTwo').fill('Хочу красивую галерею и уютное кафе.');
 await next(page);
 await page.locator('#goalChoices [data-value="learn"]').click();
 await next(page);
 await page.locator('#alreadyVisited').fill('Патриаршие пруды');
 await page.locator('#dreamPlaces').fill('Третьяковская галерея');
 await next(page);
 await expect(page.locator('#recognizedPreview')).toBeVisible();
 await page.locator('#finishPlan').click();
 await expect(page.locator('#page-result')).toBeVisible();
 await expect(page.locator('#wishStatus')).toContainText('Третьяковская');
 await expect(page.locator('#dayResult')).not.toContainText('Патриаршие пруды');
 await expect(page.locator('#planCover')).toBeVisible();
 await expect(page.locator('#dayResult .day-header img')).toBeVisible();
 const limits=await page.locator('#planStats .stat').allTextContents();
 expect(limits.join(' ')).toContain('16 000');
 await page.screenshot({path:'test-results/premium-result-'+test.info().project.name.replace(/\W/g,'-')+'.png',fullPage:true});
});
test('Calendar export contains complete selected dates and print contains every day',async({page})=>{
 await page.goto('/');
 await page.locator('.hero-cta-row [data-action="new"]').click();
 await page.locator('[data-choice="peopleMode"] [data-value="solo"]').click();
 await page.locator('#dateStart').fill(future(8));
 await page.locator('#dateEnd').fill(future(10));
 await next(page);
 await rate(page,0,'walk','2');await rate(page,0,'nature','1');
 await next(page);
 await page.locator('#goalChoices [data-value="rest"]').click();
 await next(page);await next(page);
 await page.locator('#finishPlan').click();
 await expect(page.locator('#daysTabs .day-tab')).toHaveCount(3);
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#exportCalendar').click()]);
 expect(download.suggestedFilename()).toBe('bez-planov-marshrut.ics');
 const [popup]=await Promise.all([page.waitForEvent('popup'),page.locator('#printItinerary').click()]);
 await expect(popup.locator('h2')).toHaveCount(3);
 await popup.close();
});
test('Memories are private, persisted across reloads, and deleted when confirmed',async({page})=>{
 await page.goto('/');
 await page.locator('[data-screen="library"]:visible').first().click();
 await page.locator('#memoryDate').fill(future(-2));
 await page.locator('#memoryText').fill('Наш прекрасный вечер у реки, после музея.');
 await page.locator('#memoryForm button[type="submit"]').click();
 await expect(page.locator('#memoriesList')).toContainText('Наш прекрасный вечер');
 await page.reload();
 await page.locator('[data-screen="library"]:visible').first().click();
 await expect(page.locator('#memoriesList')).toContainText('Наш прекрасный вечер');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('[data-action="clear-local"]').click();
 await expect(page.locator('#memoriesList')).not.toContainText('Наш прекрасный вечер');
});
test('Mobile all screens remain in viewport without horizontal overflow',async({page})=>{
 await page.goto('/');
 for(const name of ['home','discover','library','wizard']){
  if(name==='wizard')await page.locator('[data-action="new"]').first().click();
  else await page.locator('[data-screen="'+name+'"]:visible').first().click();
  await expect(page.locator('#page-'+name)).toBeVisible();
  const sizes=await page.evaluate(()=>({view:innerWidth,scroll:document.documentElement.scrollWidth}));
  expect(sizes.scroll,'Page '+name+' should not overflow horizontally').toBeLessThanOrEqual(sizes.view+2);
 }
});
