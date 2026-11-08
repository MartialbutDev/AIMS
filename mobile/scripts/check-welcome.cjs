/* global __dirname */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), ts = require('typescript'), jsx = require('react/jsx-runtime');
function nodes(tree) { if (!tree || typeof tree !== 'object') return []; return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]; }
function words(tree) { return nodes(tree).flatMap(node => [node.props?.children].flat(Infinity).filter(item => typeof item === 'string')).join(' '); }
function fixture({ replay = false, canGoBack = true, destination = '/(auth)/login', deferred = false } = {}) {
  let cursor = 0, calls = 0, release;
  const hooks = [], actions = [];
  const wait = deferred ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
  const mocks = {
    react: { useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = initial; return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }]; }, useRef(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = { current: initial }; return hooks[i]; }, useEffect() {} },
    'react/jsx-runtime': jsx,
    'react-native': { ActivityIndicator: 'Spinner', ScrollView: 'ScrollView', Text: 'Text', TouchableOpacity: 'Button', View: 'View', useWindowDimensions: () => ({ width: 320, height: 568 }), StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-router': { useLocalSearchParams: () => ({ replay: replay ? '1' : undefined }), router: { canGoBack: () => canGoBack, back: () => actions.push('back'), replace: route => actions.push(route) } },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    '../src/components/common/AppLogo': { __esModule: true, default: 'AppLogo' },
    '../src/context/ThemeContext': { useTheme: () => ({ colors: new Proxy({}, { get: () => '#555555' }), isDark: false }) },
    '../src/services/welcome.service': { finishWelcome: async () => { calls++; await wait; return destination; } },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(root, 'app/welcome.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: name => { assert(name in mocks, name); return mocks[name]; } });
  const render = () => { cursor = 0; return module.exports.default(); };
  const button = label => { const item = nodes(render()).find(node => node.type === 'Button' && (node.props.accessibilityLabel === label || words(node) === label)); assert(item, label); return item.props.onPress; };
  return { render, button, actions, release: () => release?.(), get calls() { return calls; } };
}
async function settle() { await new Promise(resolve => setImmediate(resolve)); }
async function main() {
  const flow = fixture();
  assert(words(flow.render()).includes('Prepare & apply'));
  flow.button('Next')(); assert(words(flow.render()).includes('Track your internship'));
  flow.button('Next')(); assert(words(flow.render()).includes('Complete your journey'));
  flow.button('Back')(); assert(words(flow.render()).includes('Track your internship'));
  flow.button('Next')(); flow.button('Get Started')(); await settle(); assert.deepEqual(flow.actions, ['/(auth)/login']);
  console.log('PASS: three-step progression, Back and Get Started');
  const skip = fixture(); skip.button('Skip')(); await settle(); assert.deepEqual(skip.actions, ['/(auth)/login']);
  console.log('PASS: Skip completes the tour and reaches sign-in');
  const replay = fixture({ replay: true }); replay.button('Next')(); replay.button('Next')(); replay.button('Back to Help')(); await settle(); assert.deepEqual(replay.actions, ['back']);
  const close = fixture({ replay: true }); close.button('Close tour')(); await settle(); assert.deepEqual(close.actions, ['back']);
  console.log('PASS: replay completion and early close return to the previous screen');
  const direct = fixture({ replay: true, canGoBack: false, destination: '/onboarding' }); direct.button('Close tour')(); await settle(); assert.deepEqual(direct.actions, ['/onboarding']);
  console.log('PASS: a replay deep link without history preserves authenticated onboarding routing');
  const duplicate = fixture({ deferred: true }); const finish = duplicate.button('Skip'); finish(); finish(); assert.equal(duplicate.calls, 1); duplicate.release(); await settle(); assert.equal(duplicate.actions.length, 1);
  console.log('PASS: rapid finish taps save and navigate only once');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
