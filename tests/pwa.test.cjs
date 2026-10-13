const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
test('manifest screenshots exist with accurate dimensions and device formats', async () => {
  const ts = require('typescript');
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('src/app/manifest.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, { exports: module.exports, module });
  const manifest = module.exports.default();
  assert.deepEqual(Array.from(manifest.screenshots, shot => shot.form_factor).sort(), ['narrow', 'wide']);
  for (const shot of manifest.screenshots) {
    const metadata = await require('sharp')('public' + shot.src).metadata();
    assert.equal(`${metadata.width}x${metadata.height}`, shot.sizes);
    assert.equal(metadata.format, 'jpeg');
  }
});
function worker(fetch){const handlers={};const calls=[];vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{self:{location:{origin:'https://cadeoly.test'},addEventListener:(name,fn)=>handlers[name]=fn},URL,Response,fetch,caches:{open:async()=>({match:async path=>{calls.push(path);return new Response('offline') }})}});return {handlers,calls};}
test('offline worker leaves private data, actions and external requests alone',()=>{const {handlers,calls}=worker(()=>{throw Error('should not fetch')});for(const request of [{url:'https://cadeoly.test/api/auth/session',method:'GET',mode:'cors'},{url:'https://cadeoly.test/fr/dashboard',method:'POST',mode:'navigate'},{url:'https://cadeoly.test/fr/dashboard?_rsc=123',method:'GET',mode:'cors'},{url:'https://other.test/',method:'GET',mode:'navigate'}])handlers.fetch({request,respondWith:()=>assert.fail('unexpected interception')});assert.equal(calls.length,0);});
test('failed document navigation uses a public localized offline page',async()=>{const {handlers,calls}=worker(async()=>{throw Error('offline')});for(const lang of ['fr','en']){let response;handlers.fetch({request:{url:'https://cadeoly.test/'+lang+'/dashboard',method:'GET',mode:'navigate'},respondWith:p=>response=p});assert.equal(await (await response).text(),'offline');assert.equal(calls.at(-1),'/offline-'+lang+'.html');}});
