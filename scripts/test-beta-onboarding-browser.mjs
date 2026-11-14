// Exercise App routing and the actual Onboarding/SignIn/ModLinkDrop components.
// Home, native IPC, permission UI and media seats are controlled test seams.
// CSS and FirstLight are mocked: this suite makes no visual or device-permission claims.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const mocks={
  nativeInvoke:`export const invoke=(command,args)=>window.testInvoke(command,args);`,
  workspace:`export const setActiveEndpointId=id=>{window.activeEndpoint=id;};`,
  Home:`import React from 'react';export function Home(props){window.homeProps=props;return <section><h1>Saved workspace Home</h1><output>{props.endpoints.map(e=>e.id).join(',')}</output><button onClick={()=>props.onAddEndpoint('server')}>Connect a server</button><button onClick={()=>props.onAddEndpoint()}>Add workspace</button><button onClick={props.onSignOut}>Sign out</button></section>;}`,
  FirstLight:`import React from 'react';export const firstLightDone=()=>window.fixture.firstLightDone;export function FirstLight({onDone}){window.firstLightMounts=(window.firstLightMounts??0)+1;return <section><h1>Permissions setup</h1><button onClick={onDone}>Continue permissions</button></section>;}`,
  ModSeat:`import React from 'react';export function ModSeat({link,onLeave}){window.openedMod=link;return <section><h1>Invitation control seat</h1><button onClick={onLeave}>Leave invitation</button></section>;}`,
  SetsDevelopmentRoom:`import React from 'react';export const SetsDevelopmentRoom=()=> <h1>Unexpected development room</h1>;`,
  opener:`export const openUrl=async url=>{window.openedUrls.push(url);};`,
  appIdentifier:`export const getIdentifier=async()=>{window.appIdentifierReads=(window.appIdentifierReads??0)+1;return window.fixture.appIdentifier??'app.liveroom.studio.sets-v2-dev';};`,
};
const bundles=new Map();
function bundleFor(env={}){
 const key=JSON.stringify(env);
 if(!bundles.has(key))bundles.set(key,build({
  stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import App from './src/App';import {Onboarding} from './src/views/Onboarding';const root=createRoot(document.getElementById('root'));window.renderDirect=props=>root.render(<Onboarding {...props} onConnected={()=>{}}/>);root.render(<App/>);`,resolveDir:root,loader:'tsx'},
  bundle:true,write:false,format:'iife',platform:'browser',define:{'import.meta.env':key},
  plugins:[{name:'beta-entry-fixture',setup(b){
    b.onResolve({filter:/\.css$/},()=>({path:'css',namespace:'mock'}));
    b.onResolve({filter:/^@tauri-apps\/api\/app$/},()=>({path:'appIdentifier',namespace:'mock'}));
    b.onResolve({filter:/nativeInvoke|lib\/workspace|views\/(Home|FirstLight|ModSeat|SetsDevelopmentRoom)$|plugin-opener/},args=>{
      const key=args.path.endsWith('plugin-opener')?'opener':Object.keys(mocks).find(key=>args.path.endsWith('/'+key));
      return key?{path:key,namespace:'mock'}:undefined;
    });
    b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='css'?'':mocks[args.path],loader:'tsx',resolveDir:root}));
  }}],
 }));
 return bundles.get(key);
}
const bundle=await bundleFor();
const module=process.env.PRODUCER_PLAYWRIGHT_MODULE;
const {chromium}=await import(module?(module.startsWith('file:')?module:pathToFileURL(resolve(module)).href):new URL('../tools/producer-mcp/node_modules/playwright-core/index.mjs',import.meta.url).href);
const browser=await chromium.launch({headless:true,...(process.env.PRODUCER_TEST_CHROME?{executablePath:process.env.PRODUCER_TEST_CHROME}:{channel:process.env.PRODUCER_BROWSER_CHANNEL??'chrome'})});
const boomin={id:'brand',kind:'connected',name:'Boomin brand',brand_slug:'beta',base_url:'https://api.example.test'};
const owned={id:'owned',kind:'independent',name:'Existing server',base_url:'https://owned.example.test'};
const results=[];
async function pageFor(options={},env=null){
  const page=await browser.newPage();page.setDefaultTimeout(8000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<div id="root"></div>');
  await page.evaluate(options=>{
    window.fixture={endpoints:[],firstLightDone:true,...options};window.calls=[];window.openedUrls=[];
    // Hold the native boundary open to exercise actual pending React states.
    // Releasing one command is one-shot; it never authenticates outside this page.
    window.pendingIpc=Object.create(null);
    window.releaseIpc=(command,error)=>{
      const pending=window.pendingIpc[command];
      if(!pending)throw Error('No pending fixture IPC: '+command);
      delete window.pendingIpc[command];
      window.fixture.deferCommands=(window.fixture.deferCommands??[]).filter(value=>value!==command);
      if(error)pending.reject(Error(error));else pending.resolve();
    };
    if(window.fixture.native!==false)window.__TAURI_INTERNALS__={};
    const values=new Map(window.fixture.returning?[['producer.signedin.v1','1']]:[]);
    Object.defineProperty(window,'localStorage',{value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},configurable:true});
    window.testInvoke=async(command,args)=>{
      window.calls.push({command,args});const f=window.fixture;
      if(command==='ui_log')return;
      if(f.deferCommands?.includes(command))await new Promise((resolve,reject)=>{
        if(window.pendingIpc[command])throw Error('Duplicate pending fixture IPC: '+command);
        window.pendingIpc[command]={resolve,reject};
      });
      if(command==='live_set_v2_smoke_enabled')return false;
      if(command==='list_endpoints'){if(f.listError)throw Error('Endpoint storage unavailable');return [...f.endpoints];}
      if(command==='boomin_request_otp')return {};
      if(command==='boomin_connect'){
        if(f.connectError)throw Error('Test verification failed');
        if(f.noBrands)throw Error('this account has no workspace yet — create one in the Boomin web app first');
        if(f.multipleBrands)return {needs_brand:true,brands:[{slug:'first',name:'First brand'},{slug:'second',name:'Second brand'}]};
        f.endpoints.push({id:'connected-beta',kind:'connected',name:'Beta account',base_url:'https://api.example.test'});return f.omitEndpointId?{}:{id:'connected-beta'};
      }
      if(command==='boomin_select_brand'){const id='brand-'+args.brandSlug;f.endpoints.push({id,kind:'connected',name:args.brandSlug,base_url:'https://api.example.test'});return f.omitEndpointId?{}:{id};}
      if(command==='network_status')return {membership:f.membership==='new'?null:{status:'active'}};
      if(command==='network_join')return {joined:true};
      if(command==='add_endpoint'){f.endpoints.push({id:'added-owned',kind:'independent',name:args.name,base_url:args.baseUrl});return {id:'added-owned'};}
      if(command==='remove_endpoint'){f.endpoints=f.endpoints.filter(e=>e.id!==args.endpointId);return;}
      throw Error('Unexpected test IPC: '+command);
    };
  },options);
  const compiled=env===null?bundle:await bundleFor(env);
  await page.addScriptTag({content:compiled.outputFiles[0].text});
  return {page,errors};
}
// Liveroom is self-hosted only: every entry is the "Connect your server" form.
// Boomin's hosted sign-in (email code, workspaces, network listing) is not
// reachable, so nothing here may call a boomin_* command.
const ENTRY='Connect your server';
async function serverEntry(page){
  await page.getByRole('heading',{name:ENTRY,exact:true}).waitFor();
  for(const label of ['Server URL','Primary token'])assert.equal(await page.getByLabel(label,{exact:true}).count(),1);
  assert.equal(await page.getByLabel('Email',{exact:true}).count(),0);
  assert.equal(await page.getByText(/Boomin/).count(),0);
}
const noBoomin=page=>page.evaluate(()=>window.calls.every(c=>!c.command.startsWith('boomin_')&&!c.command.startsWith('network_')));
async function fillServer(page,url='https://liveroom-server.example.test'){
  await page.getByLabel('Server URL',{exact:true}).fill(url);
  await page.getByLabel('Primary token',{exact:true}).fill('synthetic-token');
}
try{
  for(const returning of [false,true]){
    const {page,errors}=await pageFor({returning});await serverEntry(page);
    assert.equal(await page.getByRole('button',{name:'Back',exact:true}).count(),0);
    assert.equal(await page.evaluate(()=>window.calls.filter(c=>!['list_endpoints','live_set_v2_smoke_enabled'].includes(c.command)).length),0);
    assert.deepEqual(errors,[]);results.push(returning?'returning entry opens the server form':'fresh entry opens the server form with no hosted sign-in');await page.close();
  }
  {
    const {page}=await pageFor();await serverEntry(page);await fillServer(page);
    await page.getByRole('button',{name:'Verify & connect',exact:true}).click();await page.getByRole('heading',{name:'Saved workspace Home'}).waitFor();
    assert.deepEqual(await page.evaluate(()=>window.calls.filter(c=>c.command==='add_endpoint').map(c=>c.args)),[{kind:'independent',name:'liveroom-server.example.test',baseUrl:'https://liveroom-server.example.test',token:'synthetic-token'}]);
    assert.deepEqual(await page.evaluate(()=>window.fixture.endpoints.map(e=>e.id)),['added-owned']);
    assert.equal(await noBoomin(page),true);results.push('server URL and primary token register one independent endpoint and enter Home');await page.close();
  }
  {
    const {page}=await pageFor({deferCommands:['add_endpoint']});await serverEntry(page);await fillServer(page);
    await page.getByRole('button',{name:'Verify & connect',exact:true}).click();await page.waitForFunction(()=>!!window.pendingIpc.add_endpoint);
    assert.equal(await page.getByRole('button',{name:'Verifying…',exact:true}).isDisabled(),true);
    await page.evaluate(()=>window.releaseIpc('add_endpoint','Synthetic server rejected the token'));
    const alert=page.getByRole('alert');await alert.waitFor();assert.match(await alert.textContent(),/Synthetic server rejected the token/);
    assert.equal(await page.getByRole('button',{name:'Verify & connect',exact:true}).isEnabled(),true);
    assert.equal(await page.getByRole('heading',{name:'Saved workspace Home'}).count(),0);
    results.push('pending verification disables submit; a rejected server is announced and the form recovers');await page.close();
  }
  {
    const {page}=await pageFor({endpoints:[owned]});await page.getByRole('heading',{name:'Saved workspace Home'}).waitFor();
    await page.getByRole('button',{name:'Connect a server',exact:true}).click();await serverEntry(page);
    await fillServer(page,'https://second.example.test');await page.getByRole('button',{name:'Verify & connect',exact:true}).click();
    await page.getByRole('heading',{name:'Saved workspace Home'}).waitFor();
    assert.deepEqual(await page.evaluate(()=>window.fixture.endpoints.map(e=>e.id)),['owned','added-owned']);
    assert.equal(await noBoomin(page),true);results.push('existing owned server enters Home and can connect another server');await page.close();
  }
  {
    const {page}=await pageFor({endpoints:[owned]});await page.getByRole('heading',{name:'Saved workspace Home'}).waitFor();
    await page.getByRole('button',{name:'Add workspace',exact:true}).click();await serverEntry(page);
    await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('heading',{name:'Saved workspace Home'}).waitFor();
    assert.deepEqual(await page.evaluate(()=>window.fixture.endpoints.map(e=>e.id)),['owned']);results.push('adding a workspace from Home can go back without changes');await page.close();
  }
  {
    const {page}=await pageFor();await serverEntry(page);await page.getByRole('button',{name:'Self-hosting guide',exact:true}).click();
    await page.waitForFunction(()=>window.openedUrls.length===1);
    assert.match(await page.evaluate(()=>window.openedUrls[0]),/^https:\/\/github\.com\/313imverymellodet\/liveroom\/blob\/main\/server\/SELF_HOSTING\.md$/);
    results.push('self-hosting guide opens the Liveroom repository');await page.close();
  }
  {
    const {page}=await pageFor();await serverEntry(page);
    const disclosure=page.getByRole('button',{name:'Open a mod link',exact:true});
    assert.equal(await disclosure.getAttribute('aria-expanded'),'false');assert.equal(await page.getByLabel('Mod link',{exact:true}).count(),0);
    await disclosure.press('Enter');assert.equal(await disclosure.getAttribute('aria-expanded'),'true');
    const invitation=page.getByLabel('Mod link',{exact:true});await invitation.fill('https://host.example.test/connect/mod/gm_synthetic_invitation');await invitation.press('Enter');
    await page.getByRole('heading',{name:'Invitation control seat'}).waitFor();assert.equal(await page.evaluate(()=>window.openedMod.origin),'https://host.example.test');
    await page.getByRole('button',{name:'Leave invitation'}).click();await serverEntry(page);
    results.push('a mod link opens an account-free control seat and returns to the server form');await page.close();
  }
  {
    const {page}=await pageFor({listError:true});await serverEntry(page);results.push('endpoint lookup failure still offers the server form');await page.close();
  }
  for(const keepOwned of [false,true]){
    const {page}=await pageFor({returning:true,endpoints:keepOwned?[boomin,owned]:[boomin]});await page.getByRole('heading',{name:'Saved workspace Home'}).waitFor();await page.getByRole('button',{name:'Sign out',exact:true}).click();
    if(keepOwned){await page.getByRole('heading',{name:'Saved workspace Home'}).waitFor();await page.waitForFunction(()=>window.homeProps.endpoints.length===1);assert.equal(await page.evaluate(()=>window.homeProps.endpoints[0].id),'owned');}
    else await serverEntry(page);
    assert.deepEqual(await page.evaluate(()=>window.calls.filter(c=>c.command==='remove_endpoint').map(c=>c.args.endpointId)),['brand']);
    results.push(keepOwned?'signing out of a legacy hosted workspace keeps owned servers':'signing out of the last legacy hosted workspace returns to the server form');await page.close();
  }
  {
    const {page}=await pageFor({firstLightDone:false,endpoints:[owned]});await page.getByRole('heading',{name:'Permissions setup'}).waitFor();await page.getByRole('button',{name:'Continue permissions'}).click();await page.getByRole('heading',{name:'Saved workspace Home'}).waitFor();results.push('FirstLight remains ahead of normal routing');await page.close();
  }
  for(const appIdentifier of ['app.liveroom.studio.sets-v2-dev','app.liveroom.studio.windows-network-dev']){
    const {page,errors}=await pageFor({endpoints:[boomin,owned],appIdentifier},{DEV:true,VITE_PRODUCER_ENTRY_REVIEW:'1'});
    await serverEntry(page);
    assert.equal(await page.getByRole('heading',{name:'Saved workspace Home'}).count(),0);
    assert.equal(await page.evaluate(()=>window.firstLightMounts??0),0);
    await page.waitForFunction(()=>window.calls.some(call=>call.command==='ui_log'&&call.args.line.startsWith('[entry-review]')));
    await page.getByRole('button',{name:'Back to studio',exact:true}).click();await page.getByRole('heading',{name:'Saved workspace Home'}).waitFor();
    assert.deepEqual(await page.evaluate(()=>window.fixture.endpoints),[boomin,owned]);
    assert.equal(await page.getByRole('button',{name:'Back to studio',exact:true}).count(),0);
    assert.equal(await page.evaluate(()=>window.appIdentifierReads),1);
    assert.equal(await page.evaluate(()=>window.calls.every(call=>['list_endpoints','live_set_v2_smoke_enabled','ui_log'].includes(call.command))),true);
    assert.deepEqual(errors,[]);results.push(appIdentifier.endsWith('windows-network-dev')?'Windows development entry review exits to the unchanged saved workspace':'Mac development entry review exits to the unchanged saved workspace');await page.close();
  }
  {
    const {page}=await pageFor({endpoints:[boomin],firstLightDone:false},{DEV:true,VITE_PRODUCER_ENTRY_REVIEW:'1'});
    await serverEntry(page);
    assert.equal(await page.evaluate(()=>window.firstLightMounts??0),0);assert.equal(await page.getByRole('heading',{name:'Permissions setup'}).count(),0);
    assert.deepEqual(await page.evaluate(()=>window.fixture.endpoints),[boomin]);
    results.push('development entry review never mounts FirstLight even when setup was not marked complete');await page.close();
  }
  for(const scenario of [
    {label:'unknown bundle',env:{DEV:true,VITE_PRODUCER_ENTRY_REVIEW:'1'},appIdentifier:'app.liveroom.studio',identifierReads:1},
    {label:'production build',env:{DEV:false,VITE_PRODUCER_ENTRY_REVIEW:'1'},appIdentifier:'app.liveroom.studio.sets-v2-dev',identifierReads:0},
    {label:'missing DEV flag',env:{VITE_PRODUCER_ENTRY_REVIEW:'1'},appIdentifier:'app.liveroom.studio.sets-v2-dev',identifierReads:0},
  ]){
    const {page,errors}=await pageFor({endpoints:[boomin,owned],appIdentifier:scenario.appIdentifier},scenario.env);
    await page.getByRole('heading',{name:'Saved workspace Home'}).waitFor();
    assert.equal(await page.getByRole('heading',{name:ENTRY,exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'Back to studio',exact:true}).count(),0);
    assert.deepEqual(await page.evaluate(()=>window.fixture.endpoints),[boomin,owned]);
    assert.equal(await page.evaluate(()=>window.appIdentifierReads??0),scenario.identifierReads);
    assert.equal(await page.evaluate(()=>window.calls.some(call=>call.command==='ui_log')),false);
    assert.equal(await page.evaluate(()=>window.calls.every(call=>['list_endpoints','live_set_v2_smoke_enabled'].includes(call.command))),true);
    assert.deepEqual(errors,[]);results.push(`entry review flag is refused for ${scenario.label}; saved Home remains available`);await page.close();
  }
  console.log(`PASS: ${results.length} self-hosted entry cases using actual App and onboarding components; no real servers, endpoint changes, devices or media.`);
  for(const result of results)console.log('PASS '+result);
}finally{await browser.close();}
