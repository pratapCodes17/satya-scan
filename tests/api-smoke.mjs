import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {refreshInspection,defaultConfig} from '../lib/inspection.ts';
const origin=process.argv[2]??'http://localhost:5173';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw new Error('This fixture-creating test is restricted to the local prototype.');
const samples=JSON.parse(readFileSync('public/samples/metadata.json','utf8')).products;
const ids=[];
for(let i=0;i<samples.length;i++){
 const s=samples[i],id=crypto.randomUUID(),at=new Date().toISOString();
 let r=refreshInspection({id,product:s.product+' · local verification',inspector:'Prototype test',createdAt:at,mode:'demo',imageName:s.image,imageWidth:1200,imageHeight:1400,image:'',ocr:{text:s.text,lines:s.lines.map(({text,confidence,bbox})=>({text,confidence,bbox}))},quality:{width:1200,height:1400,warnings:[],brightness:230,contrast:60,sharpness:1000},config:structuredClone(defaultConfig),fields:[],checks:[],status:'CHECK',reviews:{},remarks:'Local verification record.',acknowledged:true});
 const image='data:image/png;base64,'+readFileSync('public/samples/'+s.image).toString('base64');
 if(i>0){const rejected=await fetch(origin+'/api/inspections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({record:r,image})});assert.equal(rejected.status,400,'Unreviewed uncertain fields must be rejected');}
 for(const c of r.checks.filter(c=>c.reviewRequired))r.reviews[c.id]={value:c.value,remark:'Reviewed the label; retain this finding for inspector follow-up.',decision:'retain',at};
 r=refreshInspection(r);
 const request=()=>fetch(origin+'/api/inspections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({record:r,image})});
 const response=await request();assert.equal(response.status,201,await response.clone().text());const saved=await response.json();assert.equal(saved.status,['PASS','CHECK','NOT DETECTED'][i]);assert.ok(saved.finalizedAt);
 const duplicate=await request();assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).finalizedAt,saved.finalizedAt);
 const reopened=await (await fetch(origin+'/api/inspections/'+id)).json();assert.deepEqual(reopened,saved);
 const imageRes=await fetch(origin+reopened.image);assert.equal(imageRes.status,200);assert.deepEqual(Buffer.from(await imageRes.arrayBuffer()),readFileSync('public/samples/'+s.image));
 assert.deepEqual(reopened.config,r.config);assert.deepEqual(reopened.reviews,r.reviews);assert.deepEqual(reopened.ocr,r.ocr);ids.push(id);
 console.log(s.product+': '+saved.status+'; finalized, image and original OCR retained, reopened, duplicate retry safe.');
}
const history=await (await fetch(origin+'/api/inspections')).json();for(const id of ids)assert.equal(history.filter(r=>r.id===id).length,1);
assert.equal((await fetch(origin+'/api/inspections/nonexistent')).status,404);
mkdirSync('work/tests',{recursive:true});writeFileSync('work/tests/api-results.json',JSON.stringify({passed:true,ids,checks:['three statuses','required reviews','finalization','history','reopening','image bytes','rule snapshots','review preservation','idempotent retries','404']},null,2));
console.log('API smoke checks passed. Test data exists only in the local preview database.');

