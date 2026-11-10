const {test,expect}=require('@playwright/test');
const photos=['cafe','cinema','spa','walk','culture','bowling','dinner','planetarium','picnic','workshop','memories','our-route','our-tastes'];
test('All thirteen original cinematic photos exist at full resolution and decode',async({page,request})=>{
 await page.goto('/');
 for(const file of photos){
  const response=await request.get('/assets/dates/'+file+'.webp');
  expect(response.ok(),'Missing '+file).toBe(true);
  expect(response.headers()['content-type']).toMatch(/image\/webp/i);
  const bytes=await response.body();
  expect(bytes.length,'Suspiciously small photo: '+file).toBeGreaterThan(100000);
  const result=await page.evaluate(async name=>{
   const img=new Image();img.src='/assets/dates/'+name+'.webp';
   await img.decode();
   return {width:img.naturalWidth,height:img.naturalHeight};
  },file);
  expect(result.width,file+' width').toBeGreaterThanOrEqual(1600);
  expect(result.height,file+' height').toBeGreaterThanOrEqual(900);
 }
});
test('Every discover district has a high-quality photograph, not a placeholder drawing',async({page})=>{
 await page.goto('/');
 await page.locator('[data-screen="discover"]:visible').first().click();
 const imgs=page.locator('.mood-district img');
 await expect(imgs).toHaveCount(8);
 for(let i=0;i<8;i++){
  const img=imgs.nth(i);await img.scrollIntoViewIfNeeded();
  await expect.poll(()=>img.evaluate(e=>e.complete&&e.naturalWidth>=1600)).toBe(true);
  await expect(img).toHaveAttribute('src',/assets\/dates\/.+\.webp/);
 }
 await page.screenshot({path:'test-results/cinematic-districts-'+test.info().project.name.replace(/\W/g,'-')+'.png',fullPage:true});
});
