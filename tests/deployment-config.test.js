const {test}=require('node:test'),assert=require('node:assert/strict');
test('Vercel build command respects its 256-character limit and resolves to an existing npm command',()=>{
 const config=require('../vercel.json'),pkg=require('../package.json');
 assert.ok(typeof config.buildCommand==='string'&&config.buildCommand.length<=256);
 const command=/^npm run ([A-Za-z0-9:_-]+)$/.exec(config.buildCommand);assert.ok(command,'Use a short npm command to avoid exceeding the platform limit');
 assert.ok(pkg.scripts[command[1]],'The declared build script must exist');
});
