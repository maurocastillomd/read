import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context={};
vm.runInNewContext(await readFile(new URL('./reading-comfort.js',import.meta.url),'utf8'),context);
const {sunTimes,appearance,sanitizePreferences,readPreferences,savePreferences,HOME,STORE}=context.YcaroReadingComfortMath;
const plain=value=>JSON.parse(JSON.stringify(value));
const minuteDistance=(a,b)=>Math.abs(a-new Date(b).getTime())/60000;
test('default automatic schedule is disclosed Jupiter location, readable size and bounded dimming',()=>{
  assert.deepEqual(plain(sanitizePreferences(null)),{mode:'auto',dim:0,warm:true,size:20,autoSize:true,width:'wide',font:'literata',leading:'normal',paper:'paper',align:'justify',location:{latitude:26.9342,longitude:-80.0942,source:'home'}});
});
test('summer Jupiter schedule crosses UTC midnight, still flips at its real sunset',()=>{
  const times=sunTimes('2026-07-12T16:00:00Z',HOME.latitude,HOME.longitude);
  assert.ok(minuteDistance(times.sunrise,'2026-07-12T10:35:00Z')<6);
  assert.ok(minuteDistance(times.sunset,'2026-07-13T00:18:00Z')<6);
  assert.equal(times.isNight,false);
  assert.equal(sunTimes(times.sunset-1,HOME.latitude,HOME.longitude).isNight,false);
  assert.equal(sunTimes(times.sunset,HOME.latitude,HOME.longitude).isNight,true);
  assert.equal(sunTimes('2026-07-13T04:30:00Z',HOME.latitude,HOME.longitude).isNight,true);
});
test('winter Jupiter schedule has shorter daylight and earlier sunset',()=>{
  const winter=sunTimes('2026-12-21T17:00:00Z',HOME.latitude,HOME.longitude);
  const summer=sunTimes('2026-06-21T17:00:00Z',HOME.latitude,HOME.longitude);
  assert.ok(minuteDistance(winter.sunrise,'2026-12-21T12:06:00Z')<7);
  assert.ok(minuteDistance(winter.sunset,'2026-12-21T22:31:00Z')<7);
  assert.ok(summer.sunset-summer.sunrise>winter.sunset-winter.sunrise);
});
test('sunrise changes from night to day, midnight stays night',()=>{
  const day=sunTimes('2026-10-12T16:00:00Z',HOME.latitude,HOME.longitude);
  assert.ok(minuteDistance(day.sunrise,'2026-10-12T11:18:00Z')<7);
  assert.ok(minuteDistance(day.sunset,'2026-10-12T22:56:00Z')<7);
  assert.equal(sunTimes(day.sunrise-1,HOME.latitude,HOME.longitude).isNight,true);
  assert.equal(sunTimes(day.sunrise,HOME.latitude,HOME.longitude).isNight,false);
  assert.equal(sunTimes('2026-10-13T04:00:00Z',HOME.latitude,HOME.longitude).isNight,true);
});
test('sunset estimates use location instead of device DST or timezone',()=>{
  const a=sunTimes('2026-11-01T12:00:00Z',HOME.latitude,HOME.longitude);
  const b=sunTimes('2026-11-01T07:00:00-05:00',HOME.latitude,HOME.longitude);
  assert.deepEqual(plain(a),plain(b));
  assert.ok(a.sunrise<new Date('2026-11-01T12:00:00Z').getTime());
  assert.ok(a.sunset>new Date('2026-11-01T12:00:00Z').getTime());
});
test('eastern dateline calculates sunrise on the preceding UTC date',()=>{
  const now=new Date('2026-03-20T22:00:00Z').getTime();
  const fiji=sunTimes(now,-17.7,178.1);
  assert.equal(fiji.isNight,false);
  assert.ok(fiji.sunrise<now && fiji.sunset>now);
  assert.equal(new Date(fiji.sunrise).getUTCDate(),20);
  assert.equal(new Date(fiji.sunset).getUTCDate(),21);
});
test('polar day and polar night stay explicit instead of NaN or fabricated events',()=>{
  const summer=sunTimes('2026-06-21T12:00:00Z',78.2,15.6);
  const winter=sunTimes('2026-12-21T12:00:00Z',78.2,15.6);
  assert.deepEqual(plain(summer),{sunrise:null,sunset:null,polar:'day',isNight:false});
  assert.deepEqual(plain(winter),{sunrise:null,sunset:null,polar:'night',isNight:true});
});
test('manual night and day override automatic, without changing coordinates',()=>{
  assert.equal(appearance({mode:'night'},'2026-07-12T16:00:00Z').night,true);
  assert.equal(appearance({mode:'day'},'2026-07-12T04:00:00Z').night,false);
  assert.equal(appearance({mode:'auto'},'2026-07-12T04:00:00Z').night,true);
});
test('malformed persisted fields cannot break appearance or create an unreadable dimmer',()=>{
  const p=plain(sanitizePreferences({mode:'sunsetty',dim:999,warm:'false',size:100,location:{latitude:Infinity,longitude:0,source:'device'},extra:'ignored'}));
  assert.equal(p.mode,'auto');assert.equal(p.dim,30);assert.equal(p.warm,true);assert.equal(p.size,20);assert.equal(p.location.source,'home');assert.equal(p.extra,undefined);
  assert.equal(sanitizePreferences({dim:-4}).dim,0);
  assert.equal(sanitizePreferences({dim:NaN}).dim,0);
  assert.equal(sanitizePreferences({dim:'30'}).dim,0);
});
test('valid user location persists and no untrusted location labels are retained',()=>{
  const p=plain(sanitizePreferences({location:{latitude:-33.86,longitude:151.21,source:'device',label:'<script>'},warm:false,size:24}));
  assert.deepEqual(p.location,{latitude:-33.86,longitude:151.21,source:'device'});
  assert.equal(p.warm,false);assert.equal(p.size,24);
});
test('storage failure and corrupted JSON fall back; saved data is sanitized',()=>{
  const broken={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
  assert.equal(readPreferences(broken).mode,'auto');
  assert.equal(readPreferences({getItem:()=>'{bad'}).size,20);
  assert.equal(savePreferences(broken,{mode:'night'}),false);
  let key,saved;
  const storage={setItem(k,v){key=k;saved=v;},getItem(){return saved;}};
  assert.equal(savePreferences(storage,{mode:'night',size:22,dim:123}),true);
  assert.equal(key,STORE);assert.equal(readPreferences(storage).mode,'night');assert.equal(readPreferences(storage).dim,30);
});
test('invalid dates and coordinates fail explicitly',()=>{
  for(const args of [['bad',0,0],[Date.now(),91,0],[Date.now(),0,181]]) assert.throws(()=>sunTimes(...args),{name:'RangeError'});
});

test('adaptive type grows with available width, preserves manual size, and stays bounded',()=>{const size=context.YcaroReadingComfortMath.responsiveSize;assert.equal(size(20,390),20);assert.equal(size(20,700),20);assert.equal(size(20,1260),24);assert.equal(size(20,2240),24);assert.equal(size(20,4000),24);assert.equal(size(22,1260,false),22);assert.equal(size(32,4000),36);});
test('reading width and automatic type survive preference sanitizing',()=>{const p=sanitizePreferences({width:'fill',autoSize:false,size:27});assert.equal(p.width,'fill');assert.equal(p.autoSize,false);assert.equal(p.size,27);assert.equal(sanitizePreferences({width:'unknown',autoSize:'yes'}).width,'wide');});

test('typeface, spacing, page color and alignment survive sanitizing',()=>{const p=sanitizePreferences({font:'iowan',leading:'airy',paper:'sepia',align:'left'});assert.equal(p.font,'iowan');assert.equal(p.leading,'airy');assert.equal(p.paper,'sepia');assert.equal(p.align,'left');const bad=sanitizePreferences({font:'comic',leading:9,paper:'<b>',align:'center'});assert.equal(bad.font,'literata');assert.equal(bad.leading,'normal');assert.equal(bad.paper,'paper');assert.equal(bad.align,'justify');});
