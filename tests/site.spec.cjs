const {test,expect}=require('@playwright/test');
function datePlus(days){
  const d=new Date();d.setDate(d.getDate()+days);
  const pad=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}
async function step(page){await page.locator('#nextStep').click()}
async function giveRatings(page,index,ratings){
  for(const [k,v] of Object.entries(ratings)){
    await page.locator('#taste'+(index===0?'One':'Two')+' [data-pref="'+k+'"][data-rating="'+v+'"]').click();
  }
}
test.beforeEach(async ({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
  page._clientErrors=errors;
});
test.afterEach(async ({page},testInfo)=>{
  expect(page._clientErrors||[],'Browser errors: '+testInfo.title).toEqual([]);
});
test('Homepage loads without horizontal overflow and opens wizard',async({page})=>{
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Не просто выйти');
  await expect(page.locator('.hero-art')).toBeVisible();
  await page.screenshot({path:'test-results/home-'+test.info().project.name.replace(/\W/g,'-')+'.png',fullPage:true});
  const width=await page.evaluate(()=>({screen:window.innerWidth,page:document.documentElement.scrollWidth}));
  expect(width.page).toBeLessThanOrEqual(width.screen+2);
  await page.locator('.hero-cta-row [data-action="new"]').click();
  await expect(page.locator('#page-wizard')).toBeVisible();
  await expect(page.locator('#stepCount')).toHaveText('01');
});

test('Couple: distinct preferences, booked event, multi-day output, favorites and saved plan',async({page},testInfo)=>{
  await page.goto('/');
  await page.locator('.hero-cta-row [data-action="new"]').click();
  const from=datePlus(10),to=datePlus(12);
  await page.locator('#dateStart').fill(from);
  await page.locator('#dateEnd').fill(to);
  await page.locator('#budgetAmount').fill('12000');
  await step(page);
  await expect(page.locator('[data-step="1"]')).toBeVisible();
  await page.screenshot({path:'test-results/profile-'+testInfo.project.name.replace(/\W/g,'-')+'.png',fullPage:true});
  await page.locator('#nameOne').fill('Алекс');
  await giveRatings(page,0,{food:2,art:2,walk:1,views:1});
  await page.locator('#likesOne').fill('Люблю маленькие кофейни, необычные улочки и музеи.');
  await step(page);
  await expect(page.locator('[data-step="2"]')).toBeVisible();
  await page.locator('#nameTwo').fill('Саша');
  await giveRatings(page,1,{food:2,art:-3,nature:2,views:1});
  await page.locator('#likesTwo').fill('Хочется погулять в парках и найти красивый вид.');
  await step(page);
  await expect(page.locator('[data-step="3"]')).toBeVisible();
  await page.screenshot({path:'test-results/mood-'+testInfo.project.name.replace(/\W/g,'-')+'.png',fullPage:true});
  await page.locator('#goalChoices [data-value="talk"]').click();
  await page.locator('#goalChoices [data-value="photo"]').click();
  await page.locator('#perfectDay').fill('Вкусный завтрак, красивые места, разговоры без спешки.');
  await step(page);
  await expect(page.locator('[data-step="4"]')).toBeVisible();
  await page.locator('#startLocation').fill('Парк культуры');
  await step(page);
  await expect(page.locator('[data-step="5"]')).toBeVisible();
  await page.locator('#eventName').fill('Билеты на концерт');
  await page.locator('#eventDate').fill(from);
  await page.locator('#eventTime').fill('18:00');
  await page.locator('#eventCost').fill('3000');
  await page.locator('#eventPaid').check();
  await page.locator('#eventAddress').fill('улица Арбат, Москва');
  await page.locator('#addEvent').click();
  await expect(page.locator('#eventList')).toContainText('Билеты на концерт');
  await page.locator('#finishPlan').click();
  await expect(page.locator('#page-result')).toBeVisible();
  await expect(page.locator('#daysTabs .day-tab')).toHaveCount(3);
  await expect(page.locator('#dayResult')).toContainText('Билеты на концерт');
  await expect(page.locator('#dayResult')).toContainText('По интересам обоих');
  await expect(page.locator('#dayResult')).not.toContainText('Третьяковская галерея');
  await page.locator('#savePlan').click();
  await expect(page.locator('#savePlan')).toHaveText('✓ Сохранено');
  await page.locator('[data-screen="library"]:visible').first().click();
  await expect(page.locator('#savedPlansList')).toContainText('3 дня');
  await page.locator('[data-action="open-saved"]').first().click();
  await expect(page.locator('#page-result')).toBeVisible();
  await expect(page.locator('#daysTabs .day-tab')).toHaveCount(3);
  await page.waitForTimeout(450);
  await page.screenshot({path:'test-results/couple-'+testInfo.project.name.replace(/\W/g,'-')+'.png',fullPage:true});
});
test('Solo flow skips partner and can select whole-period budget',async({page})=>{
  await page.goto('/');
  await page.locator('.hero-cta-row [data-action="new"]').click();
  await page.locator('[data-choice="peopleMode"] [data-value="solo"]').click();
  await page.locator('#dateStart').fill(datePlus(5));
  await page.locator('#dateEnd').fill(datePlus(6));
  await page.locator('#budgetAmount').fill('9000');
  await page.locator('#budgetScope').selectOption('total');
  await step(page);
  await giveRatings(page,0,{nature:2,walk:1});
  await step(page);
  await expect(page.locator('[data-step="3"]')).toBeVisible();
  await page.locator('#goalChoices [data-value="rest"]').click();
  await step(page);
  await step(page);
  await expect(page.locator('[data-step="5"]')).toBeVisible();
  await page.locator('#finishPlan').click();
  await expect(page.locator('#page-result')).toBeVisible();
  await expect(page.locator('#matchSection')).toBeHidden();
  await expect(page.locator('#daysTabs .day-tab')).toHaveCount(2);
});
test('Hard restriction removes museum suggestions for both-person plan',async({page})=>{
  await page.goto('/');
  await page.locator('.hero-cta-row [data-action="new"]').click();
  await page.locator('#dateStart').fill(datePlus(1));
  await page.locator('#dateEnd').fill(datePlus(1));
  await step(page);
  await giveRatings(page,0,{art:2,history:2});
  await step(page);
  await giveRatings(page,1,{art:-3,history:-3,food:2});
  await step(page);
  await page.locator('#goalChoices [data-value="learn"]').click();
  await step(page);
  await step(page);
  await page.locator('#finishPlan').click();
  await expect(page.locator('#page-result')).toBeVisible();
  await expect(page.locator('#dayResult')).not.toContainText('Третьяковская галерея');
  await expect(page.locator('#dayResult')).not.toContainText('ГМИИ имени А. С. Пушкина');
});

test('Personal profile persists between new routes and can be cleared locally',async({page})=>{
  await page.goto('/');
  await page.locator('.hero-cta-row [data-action="new"]').click();
  await page.locator('#dateStart').fill(datePlus(7));
  await page.locator('#dateEnd').fill(datePlus(8));
  await step(page);
  await page.locator('#nameOne').fill('Маша');
  await giveRatings(page,0,{nature:2,food:1});
  await page.locator('#likesOne').fill('Люблю уютные кофейни и парки.');
  await page.locator('[data-screen="library"]:visible').first().click();
  await expect(page.locator('#profileSummary')).toContainText('Маша');
  await expect(page.locator('#profileSummary')).toContainText('Парки и природа');
  await page.locator('[data-action="edit-draft"]').click();
  await expect(page.locator('[data-step="1"]')).toBeVisible();
  await expect(page.locator('#nameOne')).toHaveValue('Маша');
  await page.locator('[data-screen="home"]').first().click();
  await page.locator('[data-action="new"]').first().click();
  await expect(page.locator('#nameOne')).toHaveValue('Маша');
  await expect(page.locator('#tasteOne [data-pref="nature"][data-rating="2"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-screen="library"]:visible').first().click();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-action="clear-local"]').click();
  await expect(page.locator('#profileSummary')).not.toContainText('Маша');
  await expect(page.locator('#savedPlansList')).toContainText('Ваша история начинается здесь');
});
test('Planned preferences honor avoidance and secure map links',async({page})=>{
  await page.goto('/');
  await page.locator('.hero-cta-row [data-action="new"]').click();
  await page.locator('#dateStart').fill(datePlus(4));
  await page.locator('#dateEnd').fill(datePlus(4));
  await step(page);
  await giveRatings(page,0,{food:2,nature:2,walk:1});
  await step(page);
  await giveRatings(page,1,{nature:2,food:1,history:-3});
  await step(page);
  await page.locator('#goalChoices [data-value="rest"]').click();
  await step(page);await step(page);
  await page.locator('#finishPlan').click();
  await expect(page.locator('#page-result')).toBeVisible();
  await expect(page.locator('#dayResult a[href*="yandex.ru/maps"]')).not.toHaveCount(0);
  await expect(page.locator('#dayResult a[href*="google.com/maps"]')).not.toHaveCount(0);
  await page.locator('[data-action="toggle-lock"]').first().click();
  await expect(page.locator('[data-action="swap-menu"]').first()).toBeDisabled();
  await page.locator('[data-action="toggle-lock"]').first().click();
  await expect(page.locator('[data-action="swap-menu"]').first()).toBeEnabled();
  await page.locator('[data-action="feedback-no"]').first().click();
  await expect(page.locator('#page-result')).toBeVisible();
  await page.locator('[data-screen="library"]:visible').first().click();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-action="reset-feedback"]').click();
  await expect(page.locator('#toast')).toContainText('Все места снова доступны');
});
