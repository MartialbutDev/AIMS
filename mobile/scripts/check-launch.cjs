const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { getRoutes } = require('expo-router/build/getRoutesCore');
const { getReactNavigationConfig } = require('expo-router/build/getReactNavigationConfig');

process.chdir(path.resolve(__dirname, '..'));

// Use Expo Router itself to verify the Android route graph has a launch URL.
const keys = fs.readdirSync('app', { recursive: true })
  .filter(file => /\.[tj]sx?$/.test(file))
  .map(file => './' + file.replaceAll('\\', '/'));
const context = () => ({ default: function Screen() { return null; } });
context.keys = () => keys;
const routes = getRoutes(context, {
  platform: 'android', skipGenerated: true, ignoreEntryPoints: true,
  getSystemRoute: () => { throw new Error('Unexpected generated route'); },
});
const config = getReactNavigationConfig(routes, true);
assert.equal(config.screens.index, '', 'The / URL must have a launch screen');
assert.ok(Object.hasOwn(config.screens, '(auth)/login'));
assert.ok(Object.hasOwn(config.screens, 'onboarding/index'));

const compiled = ts.transpileModule(fs.readFileSync('app/index.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

async function main() {
  for (const scenario of [
    { name: 'fresh install', token: null, expected: '/(auth)/login' },
    { name: 'saved session', token: 'test-token', expected: '/onboarding' },
    { name: 'storage read failure', error: true, expected: '/(auth)/login' },
  ]) {
    let state = null;
    let effect;
    const module = { exports: {} };
    const mocks = {
      react: { useState: () => [state, value => { state = value; }], useEffect: fn => { effect = fn; } },
      'react/jsx-runtime': require('react/jsx-runtime'),
      'expo-router': { Redirect: function Redirect() {} },
      'expo-secure-store': { getItemAsync: () => scenario.error
        ? Promise.reject(new Error('unavailable')) : Promise.resolve(scenario.token) },
      'react-native': { View: 'View', ActivityIndicator: 'ActivityIndicator' },
      '../src/context/ThemeContext': { useTheme: () => ({ colors: { background: '#fff', primary: '#000' } }) },
    };
    vm.runInNewContext(compiled, {
      exports: module.exports,
      require: name => { assert.ok(name in mocks, name); return mocks[name]; },
    });
    const Screen = module.exports.default;
    Screen();
    const cleanup = effect();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(Screen().props.href, scenario.expected);
    cleanup();
    console.log(`PASS: ${scenario.name} opens ${scenario.expected}`);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
