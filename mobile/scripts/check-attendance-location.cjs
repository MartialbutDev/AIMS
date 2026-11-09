/* global __dirname */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const ROOT=path.resolve(__dirname,'..'),ts=require(ROOT+'/node_modules/typescript'),jsx=require(ROOT+'/node_modules/react/jsx-runtime'),results=[];
function load(file,mocks,extra={}){const module={exports:{}};const source=ts.transpileModule(fs.readFileSync(path.join(ROOT,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(source,{module,exports:module.exports,require:name=>{assert(name in mocks,'Unmocked dependency '+name);return mocks[name]},console,...extra});return module.exports}
const accuracy=load('src/utils/locationAccuracy.ts',{});
for(const [value,caution]of[[0,false],[25,false],[100,false],[100.01,true],[500,true],[null,true],[undefined,true],[-1,true],[NaN,true],[Infinity,true]])assert.equal(accuracy.assessLocationAccuracy(value).caution,caution);
results.push({test:'Accuracy threshold boundaries and missing/invalid readings',passed:true});
function nodes(tree){if(!tree||typeof tree!=='object')return[];return[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)]}
async function scenario(file,{metres=25,confirm=true,addressFailure=false,denied=false}={}){
 const state=[],alerts=[],writes=[];let cursor=0;
 const hook={useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v}]},useRef(initial){const i=cursor++;if(!(i in state))state[i]={current:initial};return state[i]}};
 const native={Alert:{alert:(title,message,buttons,options)=>alerts.push({title,message,buttons,options})},StyleSheet:{create:x=>x},Platform:{OS:'android'},ActivityIndicator:'ActivityIndicator',ScrollView:'ScrollView',Text:'Text',TextInput:'TextInput',TouchableOpacity:'TouchableOpacity',View:'View',Image:'Image'};
 const theme={useTheme:()=>({isDark:false,colors:new Proxy({},{get:()=> '#555555'})})};
 const notice=load('src/components/LocationAccuracyNotice.tsx',{'react/jsx-runtime':jsx,'react-native':native,'@expo/vector-icons':{Ionicons:'Icon'},'../context/ThemeContext':theme,'../utils/locationAccuracy':accuracy});
 const location={Accuracy:{High:4},requestForegroundPermissionsAsync:async()=>({status:denied?'denied':'granted'}),getCurrentPositionAsync:async()=>({coords:{latitude:1.234567,longitude:2.345678,accuracy:metres}}),reverseGeocodeAsync:async()=>{if(addressFailure)throw Error('Synthetic address lookup failure');return[{name:'SAMPLE location'}]}};
 class Form{constructor(){this.fields={}}append(k,v){this.fields[k]=v}}
 const mocks={'react/jsx-runtime':jsx,react:hook,'react-native':native,'@expo/vector-icons':{Ionicons:'Icon'},'expo-router':{router:{push(){},replace(){}},useLocalSearchParams:()=>({id:'synthetic-dtr'})},'expo-status-bar':{StatusBar:'StatusBar'},'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:0})},'@react-native-community/datetimepicker':{default:'DateTimePicker',__esModule:true},'expo-image-picker':{CameraType:{front:'front'},requestCameraPermissionsAsync:async()=>({status:'granted'}),launchCameraAsync:async()=>({canceled:false,assets:[{uri:'file:///SAMPLE_QA_photo.jpg'}]})},'expo-location':location,'../../../src/context/ThemeContext':theme,'../../../src/services/dtr.service':{dtrService:{beginCapture:async()=>({capture_token:'synthetic-capture'}),createDTR:async body=>{writes.push(body.fields);return{id:'synthetic-dtr'}},recordTimeOut:async(id,body)=>{assert.equal(id,'synthetic-dtr');writes.push(body.fields)}}},'../../../src/components/LocationAccuracyNotice':notice,'../../../src/utils/locationAccuracy':accuracy};
 const Screen=load('app/(student)/dtr/'+file,mocks,{FormData:Form}).default;const render=()=>{cursor=0;return Screen()};let tree=render();const pick=nodes(tree).find(n=>n.props?.onPress?.name==='pickImage');assert(pick,'Photo capture action missing');await pick.props.onPress();tree=render();
 const summary=nodes(tree).find(n=>n.type===notice.LocationAccuracyNotice);
 if(denied){assert(!summary);assert.equal(writes.length,0);return{denied:true}}
 assert(summary);assert.equal(summary.props.accuracy,metres);if(addressFailure)assert(JSON.stringify(tree).includes('Address unavailable'));
 const submit=nodes(tree).find(n=>['handleTimeIn','handleTimeOut'].includes(n.props?.onPress?.name));assert(submit);const pending=submit.props.onPress();await Promise.resolve();
 if(accuracy.assessLocationAccuracy(metres).caution){assert.equal(writes.length,0);const alert=alerts.find(a=>a.title==='Check location accuracy');assert(alert);await submit.props.onPress();assert.equal(alerts.filter(a=>a.title==='Check location accuracy').length,1,'Duplicate tap must not add another confirmation');if(confirm)alert.buttons.find(b=>b.text==='Submit this reading').onPress();else alert.buttons.find(b=>b.text==='Go back').onPress()}
 await pending;assert.equal(writes.length,accuracy.assessLocationAccuracy(metres).caution&&!confirm?0:1);
 if(writes.length){assert.equal(writes[0].latitude,'1.234567');assert.equal(writes[0].longitude,'2.345678');if(addressFailure)assert.equal(writes[0].location_address,'Address unavailable')}
 if(!confirm){tree=render();const again=nodes(tree).find(n=>['handleTimeIn','handleTimeOut'].includes(n.props?.onPress?.name));const next=again.props.onPress();await Promise.resolve();const alerts2=alerts.filter(a=>a.title==='Check location accuracy');assert.equal(alerts2.length,2,'Cancel must release the submission guard');alerts2[1].buttons.find(b=>b.text==='Go back').onPress();await next;assert.equal(writes.length,0)}
 return{writes:writes.length}
}
(async()=>{for(const file of['new.tsx','time-out.tsx']){
 for(const [label,opts]of[['accurate capture',{metres:25}],['poor reading cancelled',{metres:500,confirm:false}],['poor reading explicitly confirmed',{metres:500}],['unknown accuracy cancelled',{metres:null,confirm:false}],['address lookup unavailable',{metres:25,addressFailure:true}],['permission denied',{denied:true}]]){await scenario(file,opts);results.push({test:file+' — '+label,passed:true})}
 }console.log(JSON.stringify(results));console.log('PASS: attendance capture, accuracy confirmation and duplicate-submission checks')})().catch(e=>{console.error(e.stack);process.exitCode=1});

