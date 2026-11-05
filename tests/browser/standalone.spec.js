const corpusCount=require('../../docs/data/operations_fln_1954_1962.json').operations.length;
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test.use({baseURL:'https://alnop.vercel.app',acceptDownloads:true});
test.beforeEach(async({page})=>{
  await page.route('https://alnop.vercel.app/**',async route=>{
    const url=new URL(route.request().url());
    const pathname=url.pathname==='/documentation'?'/documentation/index.html':url.pathname==='/api/docs'?'/documentation/api.html':url.pathname;
    const response=await route.fetch({url:'http://127.0.0.1:8765'+pathname+url.search});
    await route.fulfill({response});
  });
  const vendor={
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js':'leaflet/dist/leaflet.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css':'leaflet/dist/leaflet.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js':'leaflet.markercluster/dist/leaflet.markercluster.js',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css':'leaflet.markercluster/dist/MarkerCluster.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css':'leaflet.markercluster/dist/MarkerCluster.Default.css',
    'https://cdn.jsdelivr.net/npm/chart.js':'chart.js/dist/chart.umd.js'
  };
  for(const [url,file] of Object.entries(vendor))await page.route(url,route=>route.fulfill({path:path.join(__dirname,'../../node_modules',file)}));
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await page.route('https://fonts.gstatic.com/**',route=>route.abort());
  await page.route('**/*tile.openstreetmap.org/**',route=>route.abort());
});
async function noRepositoryLinks(page){
  expect(await page.locator('a[href]').evaluateAll(links=>links.map(a=>a.href)
    .filter(h=>/^https?:\/\/(www\.)?(github\.com|raw\.githubusercontent\.com)\//.test(h)))).toEqual([]);
}
for(const width of [360,390,1280])test(`Vercel ${width}px: atlas navigation and local documentation`,async({page})=>{
  await page.setViewportSize({width,height:844});
  await page.goto('/index.html');
  await expect(page.locator('.op-card')).toHaveCount(corpusCount);
  await noRepositoryLinks(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  for(const id of ['documentation-link','contribute-link','methodology-btn','api-btn']){
    const box=await page.locator('#'+id).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
    expect(box.y+box.height).toBeLessThanOrEqual((await page.locator('.app-header').boundingBox()).height);
  }
  if(width<769){await page.locator('#tab-list-btn').click();await expect(page.locator('.op-card').first()).toBeVisible();await page.locator('#tab-map-btn').click();}
  await page.locator('#methodology-btn').click();
  await expect(page.locator('#methodology-modal')).toHaveClass(/open/);
  await expect(page.locator('#methodology-modal a[href="documentation/methodology.html"]').first()).toBeVisible();
  await noRepositoryLinks(page);await page.keyboard.press('Escape');
  await page.locator('#lang-toggle-btn').click();await noRepositoryLinks(page);
  await expect(page.locator('#detail-drawer')).toBeHidden();
  if(width<769)await expect(page.locator('#sidebar')).toBeHidden();
  await page.screenshot({path:`test-results/standalone-atlas-${width}.png`,fullPage:true});
  await page.locator('#documentation-link').click();await expect(page.locator('h1:visible')).toContainText('Documentation');
  await noRepositoryLinks(page);
  for(const slug of ['methodology','api','contributing','editorial','conduct','entities','api-v2','releases','observatory']){
    const response=await page.goto(`/documentation/${slug}.html`);expect(response.ok()).toBeTruthy();
    await noRepositoryLinks(page);
    await expect(page.locator('main')).not.toContainText(/Ghemri/i);
    if(slug==='methodology'){
      await expect(page.getByRole('heading',{name:'Citation académique recommandée'})).toBeVisible();
      await expect(page.locator('main')).toContainText('contact@connect-gm.com');
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  }
});
test('Documentation links survive clean URLs and the API documentation alias',async({page})=>{
  await page.goto('/documentation');
  await expect(page.locator('a[href="methodology.html"]')).toHaveJSProperty('href','https://alnop.vercel.app/documentation/methodology.html');
  await page.locator('a[href="methodology.html"]').click();await expect(page.locator('h1')).toBeVisible();
  await page.goto('/api/docs');
  await expect(page.locator('a[href="index.html"]')).toHaveJSProperty('href','https://alnop.vercel.app/documentation/index.html');
});
test('Vercel rewrites dynamically inserted documentation links and disables repository links',async({page})=>{
  await page.goto('/contribute.html');
  await page.evaluate(()=>{
    for(const file of ['METHODOLOGIE.md','unknown']){
      const a=document.createElement('a');a.id='injected-'+file;
      a.href='https://github.com/MGhemri/aln-historical-operations-dataset/blob/main/'+file;
      a.textContent=file;document.body.append(a);
    }
  });
  await expect(page.locator('[id="injected-METHODOLOGIE.md"]')).toHaveAttribute('href',/\/documentation\/methodology.html$/);
  await expect(page.locator('#injected-unknown')).toBeHidden();await noRepositoryLinks(page);
});
test('Vercel contribution stays local before and after preview and language changes',async({page})=>{
  await page.goto('/contribute.html');await noRepositoryLinks(page);
  await page.locator('#title').fill('Proposition de test');await page.locator('#description').fill('Description synthétique');
  await page.locator('#citation').fill('Référence synthétique');await page.locator('#consent').check();
  await page.locator('button[type=submit]').click();await expect(page.locator('#review')).toBeVisible();
  await expect(page.locator('#github')).toBeHidden();await expect(page.locator('#download')).toBeVisible();
  await noRepositoryLinks(page);await expect(page.locator('[data-t="notSubmitted"]')).not.toContainText('GitHub');
  await page.locator('#language').click();await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await page.locator('button[type=submit]').click();await noRepositoryLinks(page);
  const download=page.waitForEvent('download');await page.locator('#download').click();expect((await download).suggestedFilename()).toBe('alnop-proposition.md');
  await page.screenshot({path:'test-results/standalone-contribution-ar.png',fullPage:true});
});
test('Direct contribution waits for SMTP confirmation and prevents double send',async({page})=>{
  let complete,requests=0,payload;
  await page.route('https://alnop.vercel.app/api/contributions',async route=>{
    requests++;payload=route.request().postDataJSON();await new Promise(resolve=>complete=resolve);
    await route.fulfill({json:{success:true,reference:'ALNOP_TEST_REFERENCE',status:'sent_for_review'}});
  });
  await page.goto('/contribute.html');await page.locator('#title').fill('Proposition synthétique');
  await page.locator('#description').fill('Test sans fait historique');await page.locator('#citation').fill('Référence synthétique');
  await page.locator('#consent').check();await page.locator('button[type=submit]').click();
  await page.locator('#send-proposal').click();await expect(page.locator('#send-proposal')).toBeDisabled();
  await expect(page.locator('#delivery-status')).toContainText('Envoi en cours');
  expect(payload.operation).toBeUndefined();expect(payload.replyTo).toBe('');
  complete();await expect(page.locator('#delivery-status')).toContainText('ALNOP_TEST_REFERENCE');
  await expect(page.locator('#delivery-status')).toContainText('pas encore publiée');expect(requests).toBe(1);
  await expect(page.locator('#send-proposal')).toBeDisabled();await noRepositoryLinks(page);
});
test('SMTP error keeps proposal and enables a retry; Arabic response is translated',async({page})=>{
  let failed=true;const sent=[];
  await page.route('https://alnop.vercel.app/api/contributions',async route=>{
    sent.push(route.request().postDataJSON());
    await route.fulfill({status:failed?503:200,json:failed?{success:false,error:{code:'DELIVERY_UNAVAILABLE'}}:{success:true,reference:'ALNOP_RETRY'}});
  });
  await page.goto('/contribute.html');await page.locator('#language').click();
  await page.locator('#title').fill('مقترح تجريبي');await page.locator('#description').fill('وصف تجريبي غير تاريخي');
  await page.locator('#citation').fill('مرجع تجريبي');await page.locator('#consent').check();
  await page.locator('button[type=submit]').click();await page.locator('#send-proposal').click();
  await expect(page.locator('#delivery-error')).toContainText('لم يتم تأكيد');
  await expect(page.locator('#summary')).toContainText('مقترح تجريبي');await expect(page.locator('#send-proposal')).toBeEnabled();
  failed=false;await page.locator('#send-proposal').click();await expect(page.locator('#delivery-status')).toContainText('ALNOP_RETRY');
  expect(sent[0].submissionId).toBe(sent[1].submissionId);
  await page.screenshot({path:'test-results/smtp-contribution-ar.png',fullPage:true});
});
test('A reviewed synthetic addition reaches the atlas, statistics and FR/AR detail without a fake point',async({page})=>{
  const {withProposal,approve}=require('../helpers/corpus');
  const {publishedLegacy}=require('../../src/publication');
  const {corpus,operation}=withProposal();approve(operation);
  operation.description.fr='<img src=x onerror="window.testInjected=true"> Texte synthétique.';
  await page.route('https://alnop.vercel.app/data/operations_fln_1954_1962.json',route=>route.fulfill({json:publishedLegacy(corpus)}));
  await page.setViewportSize({width:390,height:844});await page.goto('/index.html');
  await expect(page.locator('.op-card')).toHaveCount(corpusCount+1);
  await page.locator('#stats-btn').click();await expect(page.locator('#kpi-total-ops')).toHaveText(String(corpusCount+1));
  await expect(page.locator('#kpi-geocoded')).toHaveText(`${corpusCount} / ${corpusCount+1}`);
  expect(await page.evaluate(()=>state.charts.wilayas.data.datasets[0].data.reduce((a,b)=>a+b,0))).toBe(corpusCount+1);
  await page.keyboard.press('Escape');await page.locator('#tab-list-btn').click();
  await page.locator('#search-input').fill('Événement fictif');
  await page.locator(`.op-card[data-id="${operation.id}"]`).click();
  await expect(page.locator('#drawer-territories')).toContainText('Wilaya I');
  await expect(page.locator('#drawer-territories')).toContainText('Wilaya III');
  await expect(page.locator('.review-provenance')).toContainText('TEST_SYNTHETIC_REVIEWER');
  expect(await page.locator('#drawer-content img').count()).toBe(0);
  expect(await page.evaluate(()=>window.testInjected)).toBeUndefined();
  expect(await page.evaluate(()=>markerMap.has('TEST_SYNTHETIC_001'))).toBe(false);
  await page.locator('#lang-toggle-btn').click();
  await expect(page.locator('.drawer-title')).toHaveText(operation.title.ar);
  await noRepositoryLinks(page);
  await page.screenshot({path:'test-results/canonical-reviewed-fixture-ar.png',fullPage:true});
});
test('A reviewed record with a documented point creates a new map marker',async({page})=>{
  const {withProposal,approve}=require('../helpers/corpus');const {publishedLegacy}=require('../../src/publication');
  const {corpus,operation}=withProposal();approve(operation);
  operation.locations=[{label:'Lieu synthétique',geometry:{type:'Point',coordinates:[3,36]},geometry_role:'approximate_site',review_status:'reviewed'}];
  await page.route('https://alnop.vercel.app/data/operations_fln_1954_1962.json',route=>route.fulfill({json:publishedLegacy(corpus)}));
  await page.goto('/index.html');await expect(page.locator('.op-card')).toHaveCount(corpusCount+1);
  expect(await page.evaluate(()=>markerMap.has('TEST_SYNTHETIC_001'))).toBe(true);
});

for(const width of [390,1280])test(`Reviewed contradictory assertions remain distinct, safe and navigable at ${width}px in FR/AR`,async({page})=>{
  const {withClaims}=require('../helpers/claims');const {publishedLegacy}=require('../../src/publication');
  const corpus=withClaims({reviewed:true});
  const attack='<img src=x onerror="window.claimInjected=true">';
  corpus.claims[0].value={fr:'Version A '+attack,ar:'الرواية أ'};
  corpus.claims[1].value={fr:'Version B',ar:'الرواية ب'};
  corpus.sources.at(-2).title='Référence A '+attack;
  corpus.claims[0].evidence[0].quotation=attack;
  corpus.claims[0].review_history[0].reference='https://github.com/example/test/pull/1';
  await page.route('https://alnop.vercel.app/data/operations_fln_1954_1962.json',route=>route.fulfill({json:publishedLegacy(corpus)}));
  await page.setViewportSize({width,height:844});await page.goto('/index.html');
  await expect(page.locator('.op-card')).toHaveCount(corpusCount);
  if(width<769)await page.locator('#tab-list-btn').click();
  await page.locator('.op-card').first().click();
  await expect(page.locator('.scientific-claim')).toHaveCount(2);
  await expect(page.locator('#claim-CLM_TEST_A')).toContainText('Version A');
  await expect(page.locator('#claim-CLM_TEST_B')).toContainText('Version B');
  await expect(page.locator('#claim-CLM_TEST_A')).toContainText('p. 12');
  await expect(page.locator('#claim-CLM_TEST_B')).toContainText('chap. 2');
  await expect(page.locator('.claim-status').first()).toHaveText('Contestation documentaire enregistrée');
  await page.locator('#claim-CLM_TEST_A .claim-jump').click();
  await expect(page.locator('#claim-CLM_TEST_B')).toBeFocused();
  await expect(page.locator('#detail-drawer')).toBeVisible();
  expect(await page.locator('.scientific-claims img').count()).toBe(0);
  expect(await page.evaluate(()=>window.claimInjected)).toBeUndefined();
  await noRepositoryLinks(page);
  await page.locator('#lang-toggle-btn').click();
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(page.locator('#claim-CLM_TEST_A .claim-value')).toContainText('الرواية أ');
  await expect(page.locator('#claim-CLM_TEST_B .claim-value')).toContainText('الرواية ب');
  await expect(page.locator('#claims-heading')).toHaveText('الإفادات الموثقة والاختلافات');
  await page.locator('#claim-CLM_TEST_A').scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  expect(await page.locator('#drawer-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
  await noRepositoryLinks(page);
  await page.screenshot({path:`test-results/claims-reviewed-ar-${width}.png`,fullPage:true});
});

test('Proposed assertions stay invisible and provenance documentation is available locally',async({page})=>{
  const {withClaims}=require('../helpers/claims');const {publishedLegacy}=require('../../src/publication');
  await page.route('https://alnop.vercel.app/data/operations_fln_1954_1962.json',route=>route.fulfill({json:publishedLegacy(withClaims())}));
  await page.goto('/index.html');await expect(page.locator('.op-card')).toHaveCount(corpusCount);
  await page.locator('#tab-list-btn').click();await page.locator('.op-card').first().click();
  await expect(page.locator('.scientific-claims')).toHaveCount(0);
  await page.goto('/documentation/dictionary.html');
  await page.getByRole('link',{name:'la politique de provenance'}).click();
  await expect(page.locator('h1')).toHaveText('Assertions, sources et contradictions');
  await expect(page.locator('main')).not.toContainText(/Ghemri/i);await noRepositoryLinks(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

for(const width of [390,1280])test(`Release archives are readable, downloadable and cited in FR/AR at ${width}px`,async({page})=>{
  const {releaseFixture}=require('../helpers/releases'),{result,files}=releaseFixture();
  await page.route('https://alnop.vercel.app/data/releases/**',route=>{
    const pathname=new URL(route.request().url()).pathname,key='docs'+pathname;
    if(!files[key])return route.fulfill({status:404,body:'Not found'});
    return route.fulfill({body:files[key],contentType:key.endsWith('.zip')?'application/zip':key.endsWith('.json')?'application/json':'text/plain; charset=utf-8'});
  });
  await page.setViewportSize({width,height:844});await page.goto('/releases.html');
  await expect(page.locator('.release-card')).toHaveCount(1);await expect(page.locator('#release-status')).toContainText(result.metadata.id);
  await expect(page.locator('.release-card')).toContainText('263');await expect(page.locator('.release-card h3')).toHaveText('Citation académique recommandée');
  await expect(page.locator('.release-card')).not.toContainText(/Ghemri/i);await noRepositoryLinks(page);
  const waiting=page.waitForEvent('download');await page.getByRole('link',{name:'Télécharger l’archive ZIP'}).click();const download=await waiting;
  expect(download.suggestedFilename()).toBe('alnop-'+result.metadata.id+'.zip');
  // Verify mocked bytes through fetch; a separate unmocked HTTP test checks the saved download.
  const digest=await page.evaluate(async href=>{const bytes=await(await fetch(href)).arrayBuffer();return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');},download.url());
  expect(digest).toBe(result.metadata.archive_sha256);
  await page.locator('#release-language').click();await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(page.locator('h1')).toHaveText('إصدارات البيانات');await expect(page.locator('.release-card h3')).toHaveText('الاستشهاد الأكاديمي المقترح');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await noRepositoryLinks(page);
  await page.screenshot({path:`test-results/releases-ar-${width}.png`,fullPage:true});
});

test('Release page reports failed loading honestly and translates the error',async({page})=>{
  await page.route('https://alnop.vercel.app/data/releases/index.json',route=>route.fulfill({status:503,body:'Unavailable'}));
  await page.goto('/releases.html');await expect(page.locator('#release-status')).toContainText('Impossible de charger');
  await expect(page.locator('.release-card')).toHaveCount(0);await page.locator('#release-language').click();
  await expect(page.locator('#release-status')).toContainText('تعذر تحميل');
});

test('A real HTTP download preserves the published archive byte for byte',async({page})=>{
  const metadata=require('../../data/releases/data-2026.11.1.json');
  await page.goto('http://127.0.0.1:8765/releases.html');await expect(page.locator('.release-card')).toHaveCount(1);
  const waiting=page.waitForEvent('download');await page.getByRole('link',{name:'Télécharger l’archive ZIP'}).click();const download=await waiting;
  const bytes=require('node:fs').readFileSync(await download.path());expect(require('../../src/canonical').hash(bytes)).toBe(metadata.archive_sha256);
});

for(const width of [390,1280])test(`Documentary observatory preserves uncertainty and FR/AR navigation at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:844});await page.goto('/observatory.html');
  await expect(page.locator('#metric-total_operations')).toHaveText('263');
  await expect(page.locator('#metric-without_identified_primary_source')).toHaveText('263');
  await expect(page.locator('#metric-pending')).toHaveText('Non mesuré');
  await page.locator('#obs-group').selectOption('territory');await page.locator('#obs-apply').click();
  await expect(page.locator('tr[data-key="territory:W1"] td').first()).toHaveText('0');
  await expect(page.locator('tr[data-key="unassigned"] td').first()).toHaveText('263');
  await expect(page.locator('#obs-group-notice')).toContainText('ne doivent pas être additionnées');
  await page.locator('#obs-language').click();await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(page.locator('h1')).toHaveText('مرصد التوثيق');await expect(page.locator('#metric-pending')).toHaveText('غير مقاس');
  await expect(page.locator('#obs-from')).toHaveAccessibleName('ابتداءً من');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await noRepositoryLinks(page);
  await page.locator('#obs-summary-title').scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/observatory-${width}-ar.png`});
});

test('Empty selections export reproducible JSON/CSV and preserve history and validation states',async({page})=>{
  await page.goto('/observatory.html?from=1900&to=1900');await expect(page.locator('#metric-total_operations')).toHaveText('0');
  await expect(page.locator('#obs-status')).toContainText('Aucune fiche actuellement recensée');
  const jsonWaiting=page.waitForEvent('download');await page.locator('#obs-export-json').click();const json=await jsonWaiting;
  const report=JSON.parse(require('node:fs').readFileSync(await json.path(),'utf8'));
  expect(report.meta.filters).toEqual({from:'1900',to:'1900'});expect(report.meta.dataset_release).toBe('data-2026.11.1');
  expect(report.data.pending_contributions).toBeNull();expect(report.data.groups.year.find(r=>r.key==='year:1900').note).toBe('no_current_record');
  const csvWaiting=page.waitForEvent('download');await page.locator('#obs-export-csv').click();const csv=await csvWaiting;
  const bytes=require('node:fs').readFileSync(await csv.path(),'utf8');expect(bytes.charCodeAt(0)).toBe(0xfeff);expect(bytes).toContain('not_measured');expect(bytes).toContain('data-2026.11.1');
  await page.locator('#obs-reset').click();await expect(page.locator('#metric-total_operations')).toHaveText('263');
  await page.goBack();await expect(page.locator('#metric-total_operations')).toHaveText('0');
  await page.locator('#obs-from').fill('1956-02-30');await page.locator('#obs-apply').click();
  await expect(page.locator('#obs-error')).toContainText('Filtres invalides');await expect(page.locator('#obs-results')).toBeHidden();
  await page.locator('#obs-language').click();await expect(page.locator('#obs-error')).toContainText('غير صالحة');
});

test('The observatory refuses mismatched source bytes and never displays unverified totals',async({page})=>{
  const content=require('node:fs').readFileSync(require('node:path').join(__dirname,'../../docs/data/canonical/sources.json'),'utf8')+' ';
  await page.route('https://alnop.vercel.app/data/canonical/sources.json',route=>route.fulfill({body:content,contentType:'application/json'}));
  await page.goto('/observatory.html');await expect(page.locator('#obs-error')).toContainText('Impossible de vérifier');
  await expect(page.locator('#obs-results')).toBeHidden();await expect(page.locator('#obs-apply')).toBeDisabled();
  await page.locator('#obs-language').click();await expect(page.locator('#obs-error')).toContainText('تعذر التحقق');
});

test('Native additions update observatory metrics without HTML injection or a fake primary classification',async({page})=>{
  const {withProposal,approve}=require('../helpers/corpus'),{corpus,operation}=withProposal();approve(operation);
  const attack='<img src=x onerror="window.obsInjected=true">';operation.event_type=[attack];corpus.vocabularies.event_types.push(attack);
  const files=require('../../scripts/build-canonical').artifacts(corpus,{allowSynthetic:true});
  await page.route('https://alnop.vercel.app/data/canonical/**',route=>{
    const name=new URL(route.request().url()).pathname.split('/').pop();return files[name]?route.fulfill({body:files[name],contentType:'application/json'}):route.fulfill({status:404});
  });
  await page.goto('/observatory.html');await expect(page.locator('#metric-total_operations')).toHaveText('264');
  await expect(page.locator('#metric-without_identified_primary_source')).toHaveText('264');
  await page.locator('#obs-group').selectOption('type');await page.locator('#obs-apply').click();
  await expect(page.locator('#obs-table')).toContainText(attack);expect(await page.locator('main img').count()).toBe(0);
  expect(await page.evaluate(()=>window.obsInjected)).toBeUndefined();await noRepositoryLinks(page);
});

for(const width of [390,1280])test(`Manual comparison ${width}px: complete selectors, sources, precision and FR/AR`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto('/compare.html');await expect(page.locator('#cmp-apply')).toBeEnabled();
 await expect(page.locator('#cmp-left option')).toHaveCount(corpusCount+1);await expect(page.locator('#cmp-results')).toBeHidden();
 await page.locator('#cmp-left').selectOption('OP_1954_001');await page.locator('#cmp-right').selectOption('OP_1954_002');await page.locator('#cmp-apply').click();
 await expect(page.locator('.cmp-record')).toHaveCount(2);await expect(page.locator('#cmp-records')).toContainText('Point représentatif');await expect(page.locator('#cmp-records')).toContainText('Aucune assertion structurée publiée');
 await noRepositoryLinks(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#cmp-language').click();await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.locator('#cmp-records')).toContainText('الترجمة غير متوفرة');
 await expect(page.locator('#cmp-left option')).toHaveCount(corpusCount+1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Manual comparison exports reproducible selected records, supports search, reset and browser history',async({page})=>{
 await page.goto('/compare.html?left=OP_1954_001');await expect(page.locator('.cmp-record')).toHaveCount(1);
 const waiting=page.waitForEvent('download');await page.locator('#cmp-export').click();const download=await waiting;
 const output=JSON.parse(require('node:fs').readFileSync(await download.path(),'utf8'));
 expect(output.data.operations.map(o=>o.id)).toEqual(['OP_1954_001']);expect(output.meta.dataset_release).toBe('data-2026.11.1');expect(output.meta.model_sha256).toMatch(/^[a-f0-9]{64}$/);expect(output.meta.requires_human_review).toBe(true);
 expect(output.data.sources.map(s=>s.source_id).sort()).toEqual(output.data.operations[0].source_ids.slice().sort());
 await page.locator('#cmp-search-right').fill('OP_1954_002');await expect(page.locator('#cmp-right option')).toHaveCount(2);
 await page.locator('#cmp-right').selectOption('OP_1954_002');await page.locator('#cmp-apply').click();await expect(page.locator('.cmp-record')).toHaveCount(2);
 await page.locator('#cmp-reset').click();await expect(page.locator('#cmp-results')).toBeHidden();await expect(page.locator('#cmp-left')).toHaveValue('');
 await page.goBack();await expect(page.locator('.cmp-record')).toHaveCount(2);await expect(page.locator('#cmp-right')).toHaveValue('OP_1954_002');
});

test('Manual comparison rejects unknown, repeated, duplicate and unsafe selections without fetching their paths',async({page})=>{
 for(const query of ['left=OP_ABSENT','left=OP_1954_001&right=OP_1954_001','left=OP_1954_001&left=OP_1954_002','left=../../secret','right=OP_1954_001']){
  await page.goto('/compare.html?'+query);await expect(page.locator('#cmp-error')).toContainText('Sélection invalide');await expect(page.locator('#cmp-results')).toBeHidden();
 }
 await page.locator('#cmp-language').click();await expect(page.locator('#cmp-error')).toContainText('غير صالح');
});

for(const file of ['data/canonical/claims.json','assistance-model.js'])test(`Manual comparison refuses altered ${file}`,async({page})=>{
 const body=require('node:fs').readFileSync(require('node:path').join(__dirname,'../../docs',file),'utf8')+' ';
 await page.route('https://alnop.vercel.app/'+file+'*',route=>route.fulfill({body,contentType:file.endsWith('.js')?'application/javascript':'application/json'}));
 await page.goto('/compare.html?left=OP_1954_001');await expect(page.locator('#cmp-error')).toContainText('Impossible de vérifier');await expect(page.locator('#cmp-results')).toBeHidden();await expect(page.locator('#cmp-apply')).toBeDisabled();
});

test('Manual comparison displays reviewed synthetic claim ranges, contexts and evidence without HTML injection',async({page})=>{
 const corpus=require('../helpers/claims').withClaims({reviewed:true});const attack='<img src=x onerror="window.cmpInjected=true">';
 corpus.claims[0].value={type:'interval',lower:10,upper:20};corpus.claims[0].context={scope:attack,population:'TEST participants',time_scope:'entire_event',valid_from:null,valid_to:null};
 const files=require('../../scripts/build-canonical').artifacts(corpus,{allowSynthetic:true});
 await page.route('https://alnop.vercel.app/data/canonical/**',route=>{const file=new URL(route.request().url()).pathname.split('/').pop();return route.fulfill({body:files[file],contentType:'application/json'});});
 await page.goto('/compare.html?left=OP_1954_001');await expect(page.locator('#cmp-records')).toContainText('10 — 20');await expect(page.locator('#cmp-records')).toContainText(attack);await expect(page.locator('#cmp-records')).toContainText('p. 12 (exemple fictif)');await expect(page.locator('#cmp-records')).toContainText('Contradiction déjà enregistrée');
 expect(await page.locator('main img').count()).toBe(0);expect(await page.evaluate(()=>window.cmpInjected)).toBeUndefined();await expect(page.locator('#cmp-release')).toContainText('Snapshot non associé');
});

test('Manual comparison resolves every artifact under the GitHub Pages project prefix',async({page})=>{
 await page.route('https://mghemri.github.io/aln-historical-operations-dataset/**',async route=>{const u=new URL(route.request().url());const response=await route.fetch({url:'http://127.0.0.1:8765'+u.pathname.replace('/aln-historical-operations-dataset','')+u.search});await route.fulfill({response});});
 await page.goto('https://mghemri.github.io/aln-historical-operations-dataset/compare.html?left=OP_1954_001&right=OP_1954_002&lang=ar');
 await expect(page.locator('.cmp-record')).toHaveCount(2);await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.locator('#cmp-records a').last()).toHaveAttribute('href',/contribute.html\?/);
});

function entityReaderFiles(){
 const {entity,approve,withEntities}=require('../helpers/entities'),c=withEntities(),place=approve(entity('place','A')),other=approve(entity('place','B')),person=approve(entity('person','P')),organization=approve(entity('organization','O'));
 place.relations=[{type:'same_as',target_id:other.id,source_ids:place.source_ids,review_history:place.review_history}];
 other.geometry={type:'Point',coordinates:[3,36]};other.geometry_role='approximate_site';other.geometry_source_ids=other.source_ids;
 person.names.push({...person.names[0],value:'<img src=x onerror="window.entInjected=true">',role:'historical_name',valid_from:'1954-01-01',valid_to:'1962-12-31'});
 c.places.push(place,other);c.persons.push(person,entity('person','DRAFT'));c.organizations.push(organization);
 const {operation,corpus:proposal}=require('../helpers/corpus').withProposal();require('../helpers/corpus').approve(operation);operation.participants=[{entity_id:person.id,role:'TEST rôle',source_ids:operation.source_ids},{entity_id:organization.id,role:'TEST organisation',source_ids:operation.source_ids}];operation.locations[0].place_id=place.id;operation.locations[0].source_ids=operation.source_ids;
 c.operations.push(operation);c.sources.push(proposal.sources.find(s=>s.source_id===operation.source_ids[0]));
 return require('../../scripts/build-canonical').artifacts(c,{allowSynthetic:true});
}
async function routeEntities(page){const files=entityReaderFiles(),search=require('../../scripts/build-entity-search').artifacts(files);await page.route('https://alnop.vercel.app/data/entity-search/**',route=>{const file='docs'+new URL(route.request().url()).pathname;return route.fulfill({body:search[file],contentType:'application/json'});});await page.route('https://alnop.vercel.app/data/canonical/**',route=>{const file=new URL(route.request().url()).pathname.split('/').pop();return route.fulfill({body:files[file],contentType:'application/json'});});}

for(const width of [390,1280])test(`Entity reader ${width}px: honest empty registries and FR/AR navigation`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto('/entities.html');await expect(page.locator('#ent-apply')).toBeEnabled();await expect(page.locator('#ent-status')).toContainText('Aucune entrée publiée actuellement');await expect(page.locator('#ent-list li')).toHaveCount(0);await expect(page.locator('#ent-detail')).toBeHidden();
 for(const kind of ['person','organization','place']){await page.locator('#ent-kind').selectOption(kind);await page.locator('#ent-apply').click();await expect(page.locator('#ent-status')).toContainText('Aucune entrée publiée');}
 await page.locator('#ent-language').click();await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.locator('#ent-status')).toContainText('لا توجد مدخلات منشورة');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await noRepositoryLinks(page);
});

test('Entity reader retains sourced names, relations, geometry precision and explicit operation links in exports',async({page})=>{
 await page.setViewportSize({width:390,height:844});await routeEntities(page);await page.goto('/entities.html?id=PLC_TEST_A');await expect(page.locator('#ent-detail')).toBeVisible();await expect(page.locator('#ent-content')).toContainText('Aucune géométrie documentée');await expect(page.locator('#ent-content')).toContainText('TEST_SYNTHETIC_001');await expect(page.locator('#ent-content')).toContainText('Identité commune revue');
 const waiting=page.waitForEvent('download');await page.locator('#ent-export').click();const d=await waiting,output=JSON.parse(require('node:fs').readFileSync(await d.path(),'utf8'));expect(output.data.entity.id).toBe('PLC_TEST_A');expect(output.data.linked_operations).toHaveLength(1);expect(output.data.sources).toHaveLength(2);expect(output.meta.dataset_release).toBeNull();
 await page.locator('#ent-content a[href*="id=PLC_TEST_B"]').click();await expect(page.locator('#ent-content')).toContainText('Site approximatif');await expect(page.locator('#ent-content')).toContainText('Aucune fiche publiée explicitement reliée');
 await page.goto('/entities.html?id=PER_TEST_P');await expect(page.locator('#ent-content')).toContainText('<img src=x');await expect(page.locator('#ent-content')).toContainText('1954-01-01');expect(await page.locator('main img').count()).toBe(0);expect(await page.evaluate(()=>window.entInjected)).toBeUndefined();await noRepositoryLinks(page);
 await page.goto('/entities.html?id=ORG_TEST_O&lang=ar');await expect(page.locator('#ent-content')).toContainText('TEST_SYNTHETIC_001');await expect(page.locator('#ent-detail')).toContainText('الترجمة غير متوفرة');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Entity reader searches variants, filters by kind and restores browser history',async({page})=>{
 await routeEntities(page);await page.goto('/entities.html');await expect(page.locator('#ent-list li')).toHaveCount(4);await page.locator('#ent-kind').selectOption('person');await page.locator('#ent-q').fill('img src');await page.locator('#ent-apply').click();await expect(page.locator('#ent-list li')).toHaveCount(1);await page.locator('#ent-list a').click();await expect(page.locator('#ent-detail')).toBeVisible();await page.locator('#ent-reset').click();await expect(page.locator('#ent-list li')).toHaveCount(4);await expect(page.locator('#ent-detail')).toBeHidden();await page.goBack();await expect(page.locator('#ent-detail')).toBeVisible();await page.locator('#ent-language').click();await expect(page.locator('html')).toHaveAttribute('dir','rtl');
});

test('Entity reader rejects malformed links and excludes drafts even when their ID is known',async({page})=>{
 await routeEntities(page);for(const q of ['id=PER_TEST_DRAFT','id=PER_ABSENT']){await page.goto('/entities.html?'+q);await expect(page.locator('#ent-error')).toContainText('Entrée absente');await expect(page.locator('#ent-detail')).toBeHidden();}
 for(const q of ['kind=other','id=../../secret','kind=person&id=PLC_TEST_A','kind=person&kind=place']){await page.goto('/entities.html?'+q);await expect(page.locator('#ent-error')).toContainText('Paramètres invalides');await expect(page.locator('#ent-detail')).toBeHidden();}
});

test('Entity reader refuses altered registry bytes and shows no partial results',async({page})=>{
 await page.route('https://alnop.vercel.app/data/canonical/persons.json',route=>route.fulfill({body:'{"entities":[]} ',contentType:'application/json'}));await page.goto('/entities.html');await expect(page.locator('#ent-error')).toContainText('Impossible de vérifier');await expect(page.locator('#ent-list li')).toHaveCount(0);await expect(page.locator('#ent-apply')).toBeDisabled();await page.locator('#ent-language').click();await expect(page.locator('#ent-error')).toContainText('تعذر التحقق');
});

test('Entity reader works under the GitHub Pages prefix with direct Arabic links',async({page})=>{
 await page.route('https://mghemri.github.io/aln-historical-operations-dataset/**',async route=>{const u=new URL(route.request().url());const response=await route.fetch({url:'http://127.0.0.1:8765'+u.pathname.replace('/aln-historical-operations-dataset','')+u.search});await route.fulfill({response});});await page.goto('https://mghemri.github.io/aln-historical-operations-dataset/entities.html?kind=place&lang=ar');await expect(page.locator('#ent-apply')).toBeEnabled();await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.locator('#ent-status')).toContainText('لا توجد مدخلات منشورة');
});

test('Entity search starts without the full corpus and finds Oran and akid Lotfi as unreviewed mentions',async({page})=>{
 const paths=[];page.on('request',r=>paths.push(new URL(r.url()).pathname));await page.setViewportSize({width:390,height:844});await page.goto('/entities.html');await expect(page.locator('#ent-apply')).toBeEnabled();expect(paths.some(p=>/\/(operations|sources)\.json$/.test(p))).toBe(false);expect(paths.some(p=>p.includes('/entity-search/'))).toBe(false);
 await page.locator('#ent-kind').selectOption('place');await page.locator('#ent-q').fill('Oran');await page.locator('#ent-apply').click();await expect(page.locator('#ent-mention-count')).toContainText('28');await expect(page.locator('#ent-mention-list li')).toHaveCount(10);await expect(page.locator('#ent-mentions')).toContainText('ne constituent pas des identités revues');await page.locator('#ent-next').click();await expect(page.locator('#ent-page')).toHaveText('2 / 3');
 await page.locator('#ent-kind').selectOption('person');await page.locator('#ent-q').fill('akid lotfi');await page.locator('#ent-apply').click();await expect(page.locator('#ent-mention-count')).toContainText('13');await expect(page.locator('#ent-mention-list')).toContainText('Lotfi');await expect(page.locator('#ent-mention-list')).toContainText('Champ commandement');expect(paths.some(p=>/\/(operations|sources)\.json$/.test(p))).toBe(false);
 await page.locator('#ent-language').click();await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.locator('#ent-mention-count')).toContainText('13');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await noRepositoryLinks(page);
});

test('Entity search rejects a stale or altered mention index',async({page})=>{
 await page.route('https://alnop.vercel.app/data/entity-search/index.json',route=>route.fulfill({body:'{"version":"entity-mentions-v1","operations":[]}',contentType:'application/json'}));await page.goto('/entities.html?kind=place&q=Oran');await expect(page.locator('#ent-error')).toContainText('Impossible de vérifier');await expect(page.locator('#ent-mentions')).toBeHidden();
});

test('Entity search loads verified source and operation details only when a reviewed entry is opened',async({page})=>{
 await routeEntities(page);const paths=[];page.on('request',r=>paths.push(new URL(r.url()).pathname));await page.goto('/entities.html');await expect(page.locator('#ent-apply')).toBeEnabled();expect(paths.some(p=>/\/(operations|sources)\.json$/.test(p))).toBe(false);await page.locator('#ent-list a[href*="id=PLC_TEST_A"]').click();await expect(page.locator('#ent-detail')).toBeVisible();expect(paths.some(p=>p.endsWith('/operations.json'))).toBe(true);expect(paths.some(p=>p.endsWith('/sources.json'))).toBe(true);
});

test('TEMPORA profile documentation is local and internal implementation reports are excluded',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/documentation/framework.html');await expect(page.getByRole('heading',{level:1,name:'TEMPORA — Framework pour les corpus historiques'})).toBeVisible();await noRepositoryLinks(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/documentation/model.html');await expect(page.getByRole('heading',{level:1,name:'TEMPORA — Modèle canonique v3 et migration'})).toBeVisible();await noRepositoryLinks(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const schema=await page.evaluate(async()=>{const response=await fetch('../schemas/tempora/v3/corpus.schema.json');return {ok:response.ok,body:await response.json()};});expect(schema.ok).toBe(true);expect(schema.body.$id).toBe('urn:tempora:schema:3.0.0:corpus');
 await page.goto('/documentation/ingestion.html');await expect(page.getByRole('heading',{level:1,name:'TEMPORA — Import local et prévisualisation'})).toBeVisible();await noRepositoryLinks(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const assets=await page.evaluate(async()=>Promise.all(['../schemas/tempora.ingestion-mapping.schema.json','../profiles/alnop/imports/csv.json'].map(async url=>{const r=await fetch(url);return {status:r.status,value:await r.json()};})));expect(assets.map(a=>a.status)).toEqual([200,200]);expect(assets[0].value.$id).toBe('urn:tempora:ingestion-mapping:1.0.0');expect(assets[1].value.format).toBe('csv');
 await page.goto('/documentation/');await expect(page.locator('a[href="framework.html"]:visible')).toHaveCount(1);await expect(page.locator('a[href="progress.html"]')).toHaveCount(0);
 const statuses=await page.evaluate(async()=>Promise.all(['PHASE_0_AUDIT.md','PHASE_1_PROGRESS.md','PHASE_2_PROGRESS.md','CDC_STATUS.md','documentation/progress.html'].map(async file=>(await fetch('../'+file)).status)));expect(statuses).toEqual([404,404,404,404,404]);
});

for(const width of [390,1280])test(`TEMPORA portal and host-specific documentation at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.goto('/documentation/');
 await expect(page.getByRole('heading',{name:'Documentation ALNOP',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Documentation TEMPORA',exact:true})).toBeHidden();
 await noRepositoryLinks(page);
 await page.goto('/index.html');await expect(page.locator('.brand-title')).toContainText('ALNOP');await expect(page.locator('.brand-subtitle')).toContainText('TEMPORA');
 await page.route('https://mghemri.github.io/aln-historical-operations-dataset/**',async route=>{
  const url=new URL(route.request().url());let relative=url.pathname.replace('/aln-historical-operations-dataset/','');
  if(!relative||relative==='index.html')relative='tempora.html';
  const response=await route.fetch({url:'http://127.0.0.1:8765/'+relative});await route.fulfill({response});
 });
 await page.goto('https://mghemri.github.io/aln-historical-operations-dataset/');
 await expect(page.getByRole('heading',{level:1,name:'TEMPORA',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('link',{name:'Explorer son atlas sur GitHub Pages'}).click();await expect(page.locator('.op-card')).toHaveCount(corpusCount);
 await page.goto('https://mghemri.github.io/aln-historical-operations-dataset/documentation/index.html');
 await expect(page.getByRole('heading',{name:'Documentation TEMPORA',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Documentation ALNOP',exact:true})).toBeHidden();
 await expect(page.locator('[data-atlas-link]')).toHaveAttribute('href','https://mghemri.github.io/aln-historical-operations-dataset/atlas.html');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
