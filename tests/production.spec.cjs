const {test,expect}=require('@playwright/test');
const live=process.env.LIVE_AUDIT==='1';
test.skip(!live,'Production audit runs after main is deployed');
test('Cloudflare actually serves the premium site and end-user flow works',async({page},info)=>{
 test.setTimeout(220000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 let deployed=false,reason='';
 for(let i=0;i<12;i++){
  try{
   await page.goto('https://bez-planov.pages.dev/',{waitUntil:'domcontentloaded',timeout:25000});
   const h=await page.locator('h1').first().textContent({timeout:10000});
   if(h?.includes('Не просто выйти')){deployed=true;break}
   reason='Homepage still serves old version: '+h?.slice(0,60);
  }catch(e){reason=String(e).slice(0,180)}
  await page.waitForTimeout(10000);
 }
 expect(deployed,'Cloudflare deployment not verified: '+reason).toBe(true);
 await expect(page.locator('.hero-art')).toBeVisible();
 await expect.poll(()=>page.locator('.hero-art').evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);
 await page.screenshot({path:'test-results/live-home-'+info.project.name.replace(/\W/g,'-')+'.png',fullPage:true});
 await page.locator('[data-screen="discover"]:visible').first().click();
 await expect(page.locator('.district-card')).toHaveCount(8);
 await page.screenshot({path:'test-results/live-discover-'+info.project.name.replace(/\W/g,'-')+'.png',fullPage:true});
 await page.locator('[data-action="new"]:visible').first().click();
 await expect(page.locator('#page-wizard')).toBeVisible();
 const future=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
 await page.locator('#dateStart').fill(future(7));
 await page.locator('#dateEnd').fill(future(8));
 await page.locator('#nextStep').click();
 await page.locator('#tasteOne [data-pref="food"][data-rating="2"]').click();
 await page.locator('#tasteOne [data-pref="walk"][data-rating="1"]').click();
 await page.locator('#nextStep').click();
 await page.locator('#tasteTwo [data-pref="art"][data-rating="2"]').click();
 await page.locator('#tasteTwo [data-pref="nature"][data-rating="1"]').click();
 await page.locator('#nextStep').click();
 await page.locator('#goalChoices [data-value="rest"]').click();
 await page.locator('#nextStep').click();
 await page.locator('#nextStep').click();
 await page.locator('#finishPlan').click();
 await expect(page.locator('#page-result')).toBeVisible();
 await expect(page.locator('#daysTabs button')).toHaveCount(2);
 await expect(page.locator('#planCover img')).toBeVisible();
 await page.screenshot({path:'test-results/live-result-'+info.project.name.replace(/\W/g,'-')+'.png',fullPage:true});
 expect(errors,'Browser JavaScript errors').toEqual([]);
});
