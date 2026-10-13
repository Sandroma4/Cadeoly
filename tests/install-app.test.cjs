const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function render({ mode = 'browser', ios = false, native = false, referrer = '' } = {}) {
  const state = [];
  let index = 0;
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('src/components/ui/InstallApp.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require: name => name === 'react' ? {
      useState: initial => { const key = index++; if (!(key in state)) state[key] = initial; return [state[key], value => { state[key] = value; }]; },
      useEffect: effect => effect(),
    } : name === 'next-intl' ? { useTranslations: () => key => key } : require(name),
    navigator: { standalone: ios },
    document: { documentElement: { dataset: { native: native ? 'android' : undefined } }, referrer },
    window: {
      matchMedia: query => ({ matches: query.includes(`display-mode: ${mode}`), addEventListener() {}, removeEventListener() {} }),
      addEventListener() {}, removeEventListener() {},
    },
  });
  module.exports.InstallApp({});
  index = 0;
  return module.exports.InstallApp({});
}

test('installation control remains available in a regular browser', () => {
  assert.notEqual(render(), null);
});
for (const options of [
  { mode: 'standalone' }, { mode: 'minimal-ui' }, { mode: 'fullscreen' },
  { ios: true }, { native: true }, { referrer: 'android-app://app.cadeoly/' },
]) {
  test(`installation control is absent in installed app ${JSON.stringify(options)}`, () => {
    assert.equal(render(options), null);
  });
}
