const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'tests/browser',testMatch:'framework-site.spec.js',workers:1,
  use:{baseURL:'http://127.0.0.1:8765',viewport:{width:390,height:844}},
  webServer:{command:'node scripts/serve-docs.js',url:'http://127.0.0.1:8765/',reuseExistingServer:false}});
