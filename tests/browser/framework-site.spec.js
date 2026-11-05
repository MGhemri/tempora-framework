const {test,expect}=require('@playwright/test');

for(const width of [360,390,1280]){
  test('TEMPORA guides and navigation at '+width+'px',async({page})=>{
    await page.setViewportSize({width,height:850});
    await page.goto('/index.html');
    await expect(page.getByRole('heading',{level:1,name:'TEMPORA — Framework pour les corpus historiques'})).toBeVisible();
    const menu=page.getByRole('button',{name:'Menu',exact:true});
    const guides=page.getByRole('navigation',{name:'Guides TEMPORA'});
    if(width<900){
      await expect(menu).toBeVisible();
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded','true');
      await page.keyboard.press('Escape');
      await expect(menu).toBeFocused();
      await menu.click();
    }
    await guides.getByRole('link',{name:'API REST v3'}).click();
    await expect(page.getByRole('heading',{level:1,name:'API REST v3'})).toBeVisible();
    const contract=await page.request.get('/openapi/v3.json');
    expect(contract.ok()).toBe(true);
    expect((await contract.json()).openapi).toBe('3.1.0');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
