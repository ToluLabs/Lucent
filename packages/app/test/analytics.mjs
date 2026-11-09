import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  analyticsAllowed, analyticsConfig, buildAnalyticsPayload, flushAnalytics,
  safeAttribution, safePath, setAnalyticsPreference, trackEvent, trackPageview, trackedAction, trackConfirmed,
} from '../lib/analytics.ts';

const store = new Map();
const storage = { getItem: key => store.get(key) ?? null, setItem: (k,v) => store.set(k,String(v)), removeItem: k => store.delete(k) };
const loc = { protocol: 'https:', hostname: 'www.lucent-pay.xyz', pathname: '/send', search: '?address=PRIVATE&amount=123&utm_source=scf&utm_campaign=scf46&secret=PRIVATE' };
const browser = new EventTarget();
globalThis.window = browser;
globalThis.location = loc;
globalThis.localStorage = storage;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { doNotTrack: '0', globalPrivacyControl: false } });
process.env.NODE_ENV = 'production';
process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = 'true';
process.env.NEXT_PUBLIC_ANALYTICS_HOSTNAME = loc.hostname;
process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID = '00000000-0000-4000-8000-000000000001';
const cfg = analyticsConfig();
assert.ok(cfg);
assert.equal(analyticsAllowed(), true);
assert.equal(safePath('/send?address=PRIVATE#secret'), '/send');
assert.equal(safePath('/user/PRIVATE'), '/other');
assert.deepEqual(safeAttribution('?utm_source=secret@example.com&utm_campaign=PRIVATE'), {});
assert.deepEqual(safeAttribution('?utm_source=scf&utm_campaign=scf46'), { source:'scf', campaign:'scf46' });
const payload = buildAnalyticsPayload(cfg, '/send?amount=123#secret', loc.search, 'transfer_confirmed', {
  action:'transfer', amount:'123', address:'PRIVATE', error:'PRIVATE', proof:'PRIVATE', txHash:'PRIVATE', mode:'manual', arbitrary:'PRIVATE',
});
assert.deepEqual(payload, {
  website:cfg.website, hostname:cfg.hostname, url:'/send', title:'Lucent /send', referrer:'', name:'transfer_confirmed',
  data:{ network:'testnet', source:'scf', campaign:'scf46', action:'transfer', mode:'manual' },
});
assert.equal(buildAnalyticsPayload(cfg, '/', '', 'PRIVATE'), null);
assert.equal(trackedAction('/auditor', 'execute'), null);
assert.equal(trackedAction('/escrow', 'fund-123'), null);
assert.equal(trackedAction('/payroll', 'cancel-PRIVATE'), null);
assert.equal(trackedAction('/send', 'send'), 'transfer');

let received = [];
window.umami = { track: p => { received.push(p); } };
trackPageview('/send'); trackPageview('/send');
assert.equal(received.length, 1, 'No Strict Mode / onReady duplicate pageview');
loc.pathname = '/home'; trackPageview('/home');
loc.pathname = '/send'; trackPageview('/send');
assert.equal(received.length, 3, 'Returning to a previous route is another visit');

for (const block of ['disabled','internal']) {
  received=[];
  assert.equal(setAnalyticsPreference(block,true),true);
  trackEvent('transfer_confirmed'); flushAnalytics();
  assert.equal(received.length,0);
  assert.equal(analyticsAllowed(),false);
  setAnalyticsPreference(block,false);
}
for (const signal of ['doNotTrack','globalPrivacyControl']) {
  navigator[signal] = signal === 'doNotTrack' ? '1' : true;
  assert.equal(analyticsAllowed(),false);
  navigator[signal] = signal === 'doNotTrack' ? '0' : false;
}
store.set('umami.disabled','1'); assert.equal(analyticsAllowed(),false); store.clear();
loc.hostname='preview.example.com'; assert.equal(analyticsAllowed(),false); loc.hostname=cfg.hostname;
process.env.NODE_ENV='development'; assert.equal(analyticsAllowed(),false); process.env.NODE_ENV='production';
process.env.NEXT_PUBLIC_ANALYTICS_ENABLED='false'; assert.equal(analyticsAllowed(),false); process.env.NEXT_PUBLIC_ANALYTICS_ENABLED='true';
process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL='https://user:SECRET@stats.example.com/script.js'; assert.equal(analyticsConfig(),null);
process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL='http://stats.example.com/script.js'; assert.equal(analyticsConfig(),null);
delete process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL;

// Queued events are bounded, drained once, and discarded on opt-out.
received=[]; delete window.umami;
for(let i=0;i<50;i++) trackEvent('deposit_confirmed');
window.umami={track:p=>received.push(p)}; flushAnalytics(); flushAnalytics();
assert.equal(received.length,32);
received=[]; delete window.umami; trackEvent('deposit_confirmed');
setAnalyticsPreference('disabled',true); setAnalyticsPreference('disabled',false);
window.umami={track:p=>received.push(p)}; flushAnalytics();
assert.equal(received.length,0);
window.umami={track:()=>{throw new Error('transport down');}};
assert.doesNotThrow(()=>trackEvent('transfer_confirmed'));
window.umami={track:()=>Promise.reject(new Error('transport rejected'))};
trackEvent('transfer_confirmed'); await new Promise(r=>setTimeout(r,0));
globalThis.localStorage={getItem:()=>{throw Error('storage blocked');}};
assert.equal(analyticsAllowed(),false);
globalThis.localStorage=storage;

// Exercise the shared confirmation boundary used by all instrumented chain calls.
received=[]; window.umami={track:p=>received.push(p)};
await assert.rejects(()=>trackConfirmed('deposit_confirmed',async()=>{throw Error('chain rejected');}));
assert.equal(received.length,0);
let resolveSubmission;
const pending=trackConfirmed('deposit_confirmed',()=>new Promise(resolve=>{resolveSubmission=resolve;}));
assert.equal(received.length,0,'No success event before chain success');
const result={hash:'public-test-hash',status:'SUCCESS'};
resolveSubmission(result);
assert.equal(await pending,result,'Original SDK result is preserved');
assert.equal(received.length,1);
assert.equal(received[0].name,'deposit_confirmed');
assert.ok(!JSON.stringify(received).includes('public-test-hash'));
window.umami={track:()=>{throw Error('analytics down');}};
assert.equal(await trackConfirmed('deposit_confirmed',async()=>result),result);

// Privacy-critical loader contract: all initialization/autocapture stays off.
const component=readFileSync(new URL('../components/analytics/Analytics.tsx',import.meta.url),'utf8');
assert.ok(component.includes('data-auto-track="false"'));
assert.ok(component.includes('referrerPolicy="no-referrer"'));
assert.ok(!component.includes('data-performance='));
assert.ok(!component.includes('data-errors='));
console.log('analytics: payload privacy, production/host gates, opt-out, DNT/GPC, dedupe, queue, transport failure and confirmed-chain integration passed');
