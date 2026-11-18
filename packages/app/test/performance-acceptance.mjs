/** Isolated production browser benchmark: no wallet extension, signing or private browser data. */
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
const app=resolve(process.env.PERF_APP_ROOT??resolve(import.meta.dirname,'..'));
const require=createRequire(resolve(app,'package.json'));
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:app,stdio:'ignore'});
let browser;const rows=[];const errors=[];const navigation=[];
try {
 let ready=false;
 for(let i=0;i<100;i++){try{if((await fetch(base,{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 if(!ready)throw Error('Production server did not start');
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 for(const condition of [{name:'fast',cpu:1,latency:0},{name:'slow-network-cpu4',cpu:4,latency:150}]) {
  for(const route of ['/','/docs','/home']) {
   for(let sample=0;sample<3;sample++) {
    const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await context.addInitScript(()=>{
     localStorage.setItem('lucent:analytics:internal','1');localStorage.setItem('lucent:wallet:manually-disconnected','1');
     window.__perf={longTasks:[],lcp:null};
     new PerformanceObserver(list=>window.__perf.longTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});
     new PerformanceObserver(list=>window.__perf.lcp=list.getEntries().at(-1)?.startTime).observe({type:'largest-contentful-paint',buffered:true});
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push({route,message:error.message}));
    const cdp=await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:condition.cpu});
    if(condition.latency)await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:condition.latency,downloadThroughput:200000,uploadThroughput:93750});
    for(const cache of ['cold','warm']) {
     if(cache==='cold')await page.goto(base+route,{waitUntil:'load',timeout:90000});else await page.reload({waitUntil:'load',timeout:90000});
     await page.getByRole('heading',{level:1}).first().waitFor();await page.waitForTimeout(500);
     const metrics=await page.evaluate(()=>{
      const n=performance.getEntriesByType('navigation')[0];const resources=performance.getEntriesByType('resource');const js=resources.filter(r=>r.name.includes('/_next/')&&new URL(r.name).pathname.endsWith('.js'));
      return {domContentLoadedMs:n.domContentLoadedEventEnd,loadMs:n.loadEventEnd,lcpMs:window.__perf.lcp,jsTransferBytes:js.reduce((s,r)=>s+r.transferSize,0),jsDecodedBytes:js.reduce((s,r)=>s+r.decodedBodySize,0),jsRequests:js.length,totalResourceRequests:resources.length,rpcResourceRequests:resources.filter(r=>r.name.includes("soroban-testnet.stellar.org")).length,longTasks:window.__perf.longTasks.length,blockingMs:window.__perf.longTasks.reduce((s,n)=>s+Math.max(0,n-50),0)};
     });
     rows.push({condition:condition.name,route,cache,sample,...metrics});
    }
    if(route==='/home') {
     const durationMs=await page.evaluate(()=>new Promise((resolve,reject)=>{
      const link=document.querySelector('a[href="/docs"]');if(!link){reject(Error('Documentation link missing'));return;}
      const start=performance.now();const timeout=setTimeout(()=>{observer.disconnect();reject(Error('Navigation timeout'));},60000);
      const observer=new MutationObserver(()=>{
       if(location.pathname==='/docs'&&document.querySelector('h1')?.textContent==='Build with Lucent.') {
        observer.disconnect();clearTimeout(timeout);requestAnimationFrame(()=>resolve(performance.now()-start));
       }
      });observer.observe(document.body,{subtree:true,childList:true});link.click();
     }));
     navigation.push({condition:condition.name,sample,from:'/home',to:'/docs',durationMs});
    }
    await context.close();
   }
   console.log(`Measured ${condition.name} ${route}`);
  }
 }
 const report={date:'2026-11-18',conditions:'Production, disconnected wallet, isolated contexts, three cold/warm pairs per route; same Chrome and viewport; slow case 150ms latency, 1.6Mbps down, 750kbps up, 4x CPU slowdown. Emulation is not a physical low-powered device.',rows,navigation,errors};
 await writeFile(process.env.PERF_REPORT??'/tmp/lucent-browser-performance.json',JSON.stringify(report,null,2)+'\n');
 if(errors.length)throw Error(`Browser runtime errors: ${errors.length}`);
}finally{await browser?.close();server.kill();}
