const corpusCount=require('../../docs/data/operations_fln_1954_1962.json').operations.length;
const {test,expect}=require('@playwright/test');
test.use({baseURL:'https://mghemri.github.io'});
test.beforeEach(async({page})=>{
  await page.route('https://mghemri.github.io/**',async route=>{
    const url=new URL(route.request().url());
    const response=await route.fetch({url:'http://127.0.0.1:8765'+url.pathname+url.search});
    await route.fulfill({response});
  });
});
async function fill(page){
  await page.locator('#title').fill('Proposition synthétique — اختبار');
  await page.locator('#description').fill('Exemple fictif réservé aux tests.');
  await page.locator('#consent').check();
}
test('FR mobile: validation, preview, safe URL and offline download',async({page})=>{
  await page.goto('/contribute.html?id=OP_1954_001');
  await expect(page.locator('#operation')).toHaveValue('OP_1954_001');
  await expect(page.locator('#kind')).toHaveValue('correction');
  await fill(page);await page.locator('button[type=submit]').click();
  await expect(page.locator('#error')).toContainText('Ajoutez une référence');
  await page.locator('#citation').fill('Source fictive de test, page 12.');
  await page.locator('#description').fill('<img src=x onerror="window.injected=true">');
  await page.locator('button[type=submit]').click();
  await expect(page.locator('#review')).toBeVisible();
  expect(await page.evaluate(()=>window.injected)).toBeUndefined();
  expect(await page.locator('#summary img').count()).toBe(0);
  const target=new URL(await page.locator('#github').getAttribute('href'));
  expect(target.origin).toBe('https://github.com');
  expect(target.searchParams.get('body')).toContain('Statut : proposition');
  await page.locator('#description').fill('Exemple fictif réservé aux tests ; date et localisation à vérifier.');
  await page.locator('button[type=submit]').click();
  await page.screenshot({path:'test-results/contribution-fr.png',fullPage:true});
  const downloadPromise=page.waitForEvent('download');await page.locator('#download').click();
  expect((await downloadPromise).suggestedFilename()).toBe('alnop-proposition.md');
  await page.locator('#title').fill('Titre modifié');await expect(page.locator('#review')).toBeHidden();
});
test('AR mobile: RTL, source justification and long proposal fallback',async({page})=>{
  await page.goto('/contribute.html');await page.locator('#language').click();
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(page.locator('html')).toHaveAttribute('lang','ar');
  await fill(page);await page.locator('#missing').fill('لا يتوفر مصدر بعد، يلزم التحقق.');
  await page.locator('button[type=submit]').click();
  await expect(page.locator('#summary')).toContainText('توفير المصادر');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:'test-results/contribution-ar.png',fullPage:true});
  await page.locator('#description').fill('ت'.repeat(5900));
  await page.locator('button[type=submit]').click();
  await expect(page.locator('#long-note')).toBeVisible();
  await expect(page.locator('#github')).toBeHidden();
  await expect(page.locator('#download')).toBeVisible();
});
test('Desktop and keyboard: labels, focus, no horizontal overflow',async({page})=>{
  await page.setViewportSize({width:1280,height:900});await page.goto('/contribute.html');
  await page.keyboard.press('Tab');await expect(page.locator('nav a')).toBeFocused();
  await page.keyboard.press('Tab');await expect(page.locator('#language')).toBeFocused();
  await page.getByLabel('Titre de la proposition').fill('Proposition de test');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
for(const lang of ['fr','ar'])for(const kind of ['new-operation','correction','new-source','duplicate','historical-dispute','place-name']){
  test(`${lang}: adapted fields and preview for ${kind}`,async({page})=>{
    await page.goto('/contribute.html?id=OP_1954_001');
    if(lang==='ar')await page.locator('#language').click();
    await page.locator('#kind').selectOption(kind);
    await fill(page);
    const isNew=kind==='new-operation';
    await expect(page.locator('#operation-group')).toBeVisible({visible:!isNew});
    if(isNew){
      await expect(page.locator('#operation')).toBeDisabled();
      await page.locator('#event-date').fill('1956 (à vérifier)');
      await page.locator('#event-place').fill('Lieu incertain');
    }else await page.locator('#operation').selectOption(kind==='place-name'?'':'OP_1954_001');
    if(kind==='duplicate')await page.locator('#second-operation').selectOption('OP_1954_003');
    if(kind==='place-name')await page.locator('#place-name').fill('Toponyme synthétique / اسم تجريبي');
    await page.locator('#citation').fill('Référence synthétique, page 1');
    await page.locator('button[type=submit]').click();
    await expect(page.locator('#review')).toBeVisible();
    if(isNew)await expect(page.locator('#summary')).not.toContainText('OP_1954_001');
    if(kind==='duplicate')await expect(page.locator('#summary')).toContainText('OP_1954_003');
    await expect(page.locator('#event-group')).toBeVisible({visible:isNew});
    await expect(page.locator('#second-operation-group')).toBeVisible({visible:kind==='duplicate'});
    await expect(page.locator('#place-group')).toBeVisible({visible:kind==='place-name'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    if(isNew || kind==='duplicate')await page.screenshot({path:`test-results/contribution-${kind}-${lang}.png`,fullPage:true});
  });
}
test('Duplicate requires different existing records; made-up IDs cannot be selected',async({page})=>{
  await page.goto('/contribute.html');await page.locator('#kind').selectOption('duplicate');await fill(page);
  await page.locator('#operation').selectOption('OP_1954_001');
  await page.locator('#second-operation').selectOption('OP_1954_001');
  await page.locator('#citation').fill('Source de test');await page.locator('button[type=submit]').click();
  await expect(page.locator('#error')).toContainText('deux fiches différentes');
  await expect(page.locator('#review')).toBeHidden();
  expect(await page.locator('#operation option[value="OP_2099_999"]').count()).toBe(0);
});
test('Adding a source requires a reference and excludes stale hidden values',async({page})=>{
  await page.goto('/contribute.html?id=OP_1954_001');await fill(page);
  await page.locator('#missing').fill('Justification précédente');
  await page.locator('#kind').selectOption('new-source');
  await expect(page.locator('#citation')).toHaveAttribute('required','');
  await expect(page.locator('#missing')).toBeDisabled();
  await page.locator('button[type=submit]').click();await expect(page.locator('#review')).toBeHidden();
  await page.locator('#citation').fill('Référence précise');await page.locator('button[type=submit]').click();
  await expect(page.locator('#summary')).not.toContainText('Justification précédente');
});
test('Dataset failure blocks existing-record edits without blocking new proposals',async({page})=>{
  await page.route('**/data/operations_fln_1954_1962.json',route=>route.abort());
  await page.goto('/contribute.html');await page.locator('#kind').selectOption('correction');
  await expect(page.locator('#error')).toContainText('Impossible de charger');
  await page.locator('#kind').selectOption('new-operation');await fill(page);
  await page.locator('#citation').fill('Référence précise');await page.locator('button[type=submit]').click();
  await expect(page.locator('#review')).toBeVisible();
});
test('Existing-record contribution cannot preview without choosing a record',async({page})=>{
  await page.goto('/contribute.html');await page.locator('#kind').selectOption('correction');
  await fill(page);await page.locator('#citation').fill('Source de test');
  await page.locator('button[type=submit]').click();await expect(page.locator('#review')).toBeHidden();
  await expect(page.locator('#operation')).toHaveAttribute('required','');
});
test('All 263 records, including the last, are reachable for every existing-record type',async({page})=>{
  await page.goto('/contribute.html');
  for(const kind of ['correction','new-source','duplicate','historical-dispute','place-name']){
    await page.locator('#kind').selectOption(kind);
    await expect(page.locator('#operation option')).toHaveCount(corpusCount+1);
    await expect(page.locator('#operation-count')).toContainText(String(corpusCount));
    await page.locator('#operation').selectOption('OP_1962_021');
    await expect(page.locator('#operation-selected')).toContainText('OP_1962_021');
    if(kind==='duplicate'){
      await expect(page.locator('#second-operation option')).toHaveCount(corpusCount+1);
      await page.locator('#second-operation').selectOption('OP_1962_020');
    }
  }
});
test('Search by ID, year, French and Arabic names; preserve choice and reset results',async({page})=>{
  await page.goto('/contribute.html');await page.locator('#kind').selectOption('correction');
  await page.locator('#operation-search').fill('OP_1962_021');
  await expect(page.locator('#operation option')).toHaveCount(2);
  await page.locator('#operation').selectOption('OP_1962_021');
  await page.locator('#operation-search').fill('NO_MATCH_SYNTHETIC');
  await expect(page.locator('#operation-count')).toContainText('Aucune fiche');
  await expect(page.locator('#operation')).toHaveValue('OP_1962_021');
  await page.locator('#operation-search').fill('');await expect(page.locator('#operation option')).toHaveCount(corpusCount+1);
  await page.locator('#operation-search').fill('1954');
  await expect(page.locator('#operation option[value="OP_1954_001"]')).toHaveCount(1);
  await page.locator('#operation-search').fill('Toussaint rouge');
  await expect(page.locator('#operation option[value="OP_1954_001"]')).toHaveCount(1);
  await page.locator('#language').click();await page.locator('#operation-search').fill('الثورة');
  await expect(page.locator('#operation option[value="OP_1954_001"]')).toHaveCount(1);
  await page.locator('#operation-search').fill('');
  await page.screenshot({path:'test-results/searchable-picker-ar.png',fullPage:true});
  await page.locator('#operation-search').fill('1954');await page.locator('#kind').selectOption('new-source');
  await expect(page.locator('#operation-search')).toHaveValue('');
  await expect(page.locator('#operation option')).toHaveCount(corpusCount+1);
});
