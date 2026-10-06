import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {refreshInspection,defaultConfig} from '../lib/inspection.ts';
const origin='http://127.0.0.1:8788';
const s=JSON.parse(readFileSync('public/samples/metadata.json','utf8')).products[0];
const original=readFileSync('public/samples/sample1.png');
const id=crypto.randomUUID();
function candidate(tag){const image=Buffer.concat([original,Buffer.alloc(1200000,tag.charCodeAt(0))]);const record=refreshInspection({id,product:'Concurrent storage test '+tag,inspector:'Local verification',createdAt:new Date().toISOString(),mode:'demo',imageName:'multi-chunk-test.png',imageWidth:1200,imageHeight:1400,image:'',ocr:{text:s.text,lines:s.lines},quality:{width:1200,height:1400,warnings:[],brightness:230,contrast:60,sharpness:1000},config:structuredClone(defaultConfig),fields:[],checks:[],status:'CHECK',reviews:{},remarks:'Local test only: padding after the PNG end marker verifies exact byte preservation.',acknowledged:true});return {tag,image,record}}
const inputs=[candidate('A'),candidate('B')];
const responses=await Promise.all(inputs.map(async input=>{const response=await fetch(origin+'/api/inspections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({record:input.record,image:'data:image/png;base64,'+input.image.toString('base64')})});assert.ok([200,201].includes(response.status),await response.clone().text());return response.json()}));
assert.deepEqual(responses[0],responses[1]);
const winner=inputs.find(input=>input.record.product===responses[0].product);
const imageResponse=await fetch(origin+responses[0].image);assert.equal(imageResponse.status,200);assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()),winner.image);
console.log('Database image chunks round-trip exactly; simultaneous same-ID saves return one matching record/image pair.');
