const {test,expect}=require('@playwright/test');

async function inspectGallery(page,url,outputName){
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.locator('[data-screen="discover"]:visible').first().click();
 const imgs=page.locator('#page-discover .district-card .district-visual img');
 await expect(imgs).toHaveCount(8);
 const results=[];
 for(let i=0;i<8;i++){
  const img=imgs.nth(i);
  await img.scrollIntoViewIfNeeded();
  await expect.poll(()=>img.evaluate(el=>el.complete&&el.naturalWidth>0),{timeout:18000,intervals:[100,300,500,1000]}).toBe(true);
  results.push(await img.evaluate(el=>({src:el.currentSrc,width:el.naturalWidth,height:el.naturalHeight,complete:el.complete})));
 }
 await page.evaluate(()=>scrollTo(0,0));
 await page.waitForTimeout(450);
 await page.screenshot({path:'test-results/gallery-complete-'+outputName+'-'+test.info().project.name.replace(/\W/g,'-')+'.png',fullPage:true});
 expect(results.length).toBe(8);
 for(const [idx,item] of results.entries())expect(item.width,'Art '+idx+': '+item.src).toBeGreaterThan(100);
}

test('All eight local district art files decode and render after scrolling',async({page})=>{
 await inspectGallery(page,'/','local');
});
test('All eight published Cloudflare illustrations load in actual browser',async({page})=>{
 await inspectGallery(page,'https://bez-planov.pages.dev/','cloudflare');
});
