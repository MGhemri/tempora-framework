const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'tests/browser',workers:1,use:{baseURL:'http://127.0.0.1:8765',
  viewport:{width:390,height:844}},webServer:{command:'python -m http.server 8765 --bind 127.0.0.1 --directory docs',
    url:'http://127.0.0.1:8765/contribute.html',reuseExistingServer:false}});
