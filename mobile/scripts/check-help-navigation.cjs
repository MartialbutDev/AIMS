/* global __dirname */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),ts=require('typescript'),jsx=require('react/jsx-runtime');
function load(file,mocks){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:name=>{assert(name in mocks,name);return mocks[name];}});return module.exports;}
function nodes(n){return !n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)];}
async function main(){
  const {StackRouter}=await import('@react-navigation/routers');
  const stack=StackRouter({initialRouteName:'dashboard'}),options={routeNames:['dashboard','settings','about','help'],routeParamList:{},routeGetIdList:{}};
  let state=stack.getInitialState(options),calls=0,fallbacks=0,focused=true;
  const dispatch=action=>{const next=stack.getStateForAction(state,action,options);assert(next,`Unhandled ${action.type}`);state=next;};
  let focus;
  const {useSafeBack: createBack}=load('src/hooks/useSafeBack.ts',{
    react:{useRef:value=>({current:value}),useCallback:fn=>fn},
    'expo-router':{useFocusEffect:fn=>{focus=fn;fn();},useNavigation:()=>({isFocused:()=>focused,canGoBack:()=>state.index>0,goBack:()=>{calls++;dispatch({type:'GO_BACK'});}}),router:{replace:route=>{assert.equal(route,'/(student)/dashboard');fallbacks++;dispatch({type:'REPLACE',payload:{name:'dashboard'}});}}}
  });
  for(const name of ['settings','about','help'])dispatch({type:'PUSH',payload:{name}});
  const initial=JSON.stringify(state),goBack=createBack();
  // Tour replay is local modal state, so opening and closing cannot change route history.
  let cursor=0;const hooks=[];const colors=new Proxy({},{get:()=> '#000080'});
  const {default:Help}=load('app/(student)/settings/help-support.tsx',{
    react:{useState:initial=>{const i=cursor++;if(!(i in hooks))hooks[i]=initial;return[hooks[i],value=>{hooks[i]=value;}];}},
    'react/jsx-runtime':jsx,'react-native':{Modal:'Modal',Text:'Text',TextInput:'TextInput',TouchableOpacity:'Button',View:'View'},
    'expo-router':{router:{push:()=>{throw Error('Replay must not push a root route');}}},
    '@expo/vector-icons':{Ionicons:'Icon'},'../../../src/context/ThemeContext':{useTheme:()=>({colors})},
    '../../../src/constants/app':{APP_VERSION:'test',APP_BUILD:'test'},
    '../../../src/components/WelcomeTour':{__esModule:true,default:'WelcomeTour'},
    '../../../src/components/account/AccountUI':{AccountPage:'Page',AccountHero:'Hero',Panel:'Panel',SectionLabel:'SectionLabel',MenuRow:'MenuRow',ui:{}}
  });
  const render=()=>{cursor=0;return nodes(Help());};
  for(let round=0;round<3;round++){
    render().find(n=>n.type==='MenuRow'&&n.props.title==='Replay the welcome tour').props.onPress();
    assert.equal(render().find(n=>n.type==='Modal').props.visible,true);
    if(round===0)render().find(n=>n.type==='WelcomeTour').props.onClose();
    else render().find(n=>n.type==='Modal').props.onRequestClose();
    assert.equal(render().find(n=>n.type==='Modal').props.visible,false);assert.equal(JSON.stringify(state),initial);
  }
  goBack();goBack();assert.equal(calls,1);assert.equal(state.routes[state.index].name,'about');
  focus();goBack();assert.equal(state.routes[state.index].name,'settings');
  focus();goBack();assert.equal(state.routes[state.index].name,'dashboard');
  focus();goBack();assert.equal(calls,3);assert.equal(fallbacks,1);
  focus();focused=false;goBack();assert.equal(fallbacks,1);
  console.log('PASS: Help replay/close and Android modal back preserve history across repeated tours');
  console.log('PASS: Help → About → Settings → Dashboard handles each back action; rapid taps are ignored');
  console.log('PASS: empty history uses Dashboard fallback; unfocused screens do not navigate');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
