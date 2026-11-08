/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { getRoutes } = require('expo-router/build/getRoutesCore');
const { getReactNavigationConfig } = require('expo-router/build/getReactNavigationConfig');
process.chdir(path.resolve(__dirname, '..'));
const keys = fs.readdirSync('app', { recursive: true }).filter(file => /\.[tj]sx?$/.test(file)).map(file => './' + file.replaceAll('\\', '/'));
const context = () => ({ default: function Screen() { return null; } });
context.keys = () => keys;
const config = getReactNavigationConfig(getRoutes(context, { platform: 'android', skipGenerated: true, ignoreEntryPoints: true, getSystemRoute: () => { throw new Error('Unexpected generated route'); } }), true);
assert.equal(config.screens.index, '');
for (const route of ['welcome', '(auth)/login', 'onboarding/index']) assert.ok(Object.hasOwn(config.screens, route));
function load(file, mocks) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: module.exports, module, require: name => { assert.ok(name in mocks, name); return mocks[name]; } });
  return module.exports;
}
async function main() {
  for (const scenario of [
    { name: 'fresh install', token: null, seen: null, expected: '/welcome' },
    { name: 'returning signed-out user', token: null, seen: 'seen', expected: '/(auth)/login' },
    { name: 'existing saved session', token: 'test-token', seen: null, expected: '/onboarding' },
    { name: 'saved session with preference write failure', token: 'test-token', writeError: true, expected: '/onboarding' },
    { name: 'token storage read failure', tokenError: true, expected: '/(auth)/login' },
    { name: 'welcome preference read failure', token: null, seenError: true, expected: '/(auth)/login' },
  ]) {
    let seen = scenario.seen, state = null, effect;
    const service = load('src/services/welcome.service.ts', {
      '@react-native-async-storage/async-storage': { getItem: async () => { if (scenario.seenError) throw Error('unavailable'); return seen; }, setItem: async (key, value) => { if (scenario.writeError) throw Error('unavailable'); seen = value; } },
      'expo-secure-store': { getItemAsync: async () => { if (scenario.tokenError) throw Error('unavailable'); return scenario.token; } },
    });
    const Screen = load('app/index.tsx', {
      react: { useState: () => [state, value => { state = value; }], useEffect: fn => { effect = fn; } },
      'react/jsx-runtime': require('react/jsx-runtime'), 'expo-router': { Redirect: function Redirect() {} },
      'react-native': { View: 'View', ActivityIndicator: 'ActivityIndicator' },
      '../src/services/welcome.service': service,
      '../src/context/ThemeContext': { useTheme: () => ({ colors: { background: '#fff', primary: '#000' } }) },
    }).default;
    Screen(); const cleanup = effect(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(Screen().props.href, scenario.expected);
    if (scenario.token && !scenario.writeError) assert.equal(seen, 'seen');
    cleanup(); console.log(`PASS: ${scenario.name} opens ${scenario.expected}`);
  }
  for (const token of [null, 'test-token']) {
    let seen = null;
    const service = load('src/services/welcome.service.ts', {
      '@react-native-async-storage/async-storage': { getItem: async () => seen, setItem: async (key, value) => { assert.equal(key, '@AIMS_welcome_seen_v1'); seen = value; } },
      'expo-secure-store': { getItemAsync: async () => token },
    });
    assert.equal(await service.finishWelcome(), token ? '/onboarding' : '/(auth)/login');
    assert.equal(seen, 'seen');
    assert.equal(await service.resolveLaunchDestination(), token ? '/onboarding' : '/(auth)/login');
    console.log(`PASS: finished/skipped tour persists without bypassing ${token ? 'student onboarding' : 'sign-in'}`);
  }
  const storageFailure = load('src/services/welcome.service.ts', {
    '@react-native-async-storage/async-storage': { setItem: async () => { throw Error('unavailable'); } },
    'expo-secure-store': { getItemAsync: async () => null },
  });
  assert.equal(await storageFailure.finishWelcome(), '/(auth)/login');
  console.log('PASS: preference write failure does not trap a user in the tour');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
