export type Status = 'PASS' | 'CHECK' | 'NOT DETECTED' | 'NOT APPLICABLE';
export type Confidence = 'High' | 'Medium' | 'Low';
export type FieldKey = 'manufacturer'|'address'|'netQuantity'|'mrp'|'batch'|'packed'|'consumerCare';
export type RuleKey = FieldKey|'visibility';
export type Box = {x0:number;y0:number;x1:number;y1:number};
export type OcrLine = {text:string;confidence:number;bbox?:Box};
export type OcrResult = {text:string;lines:OcrLine[]};
export type Quality = {width:number;height:number;warnings:string[];brightness:number;contrast:number;sharpness:number};
export type Field = {key:FieldKey;name:string;value:string;confidence:Confidence;evidence:string;line:number;box?:Box;ambiguous?:boolean};
export type Review = {value:string;remark:string;decision:'confirm'|'retain'|'notApplicable';at:string};
export type Rule = {id:RuleKey;name:string;active:boolean;description:string};
export type Config = {version:string;minimumConfidence:'High'|'Medium';rules:Rule[]};
export type Check = {id:RuleKey;name:string;status:Status;value:string;reason:string;confidence:Confidence;reviewRequired:boolean;review?:Review;evidence:string;line:number;box?:Box};
export type AuditActor = {userId:string;displayName:string;role:'ADMIN'|'INSPECTOR'};
export type ResultHistoryEvent = {event:'ANALYZED'|'FINALIZED'|'LEGACY_IMPORT';at:string;status:Status;actor:AuditActor|null};
export type InspectionAudit = {version:1;legacy?:boolean;owner:AuditActor|null;creator:AuditActor|null;reviewer:AuditActor|null;createdAt:string;finalizedAt:string|null;ruleSnapshot:Config|null;resultHistory:ResultHistoryEvent[]};
export type Inspection = {id:string;product:string;inspector:string;createdAt:string;finalizedAt?:string;mode:'demo'|'ocr';image:string;imageName:string;imageWidth:number;imageHeight:number;ocr:OcrResult;quality:Quality;fields:Field[];checks:Check[];status:Status;config:Config;reviews:Partial<Record<RuleKey,Review>>;remarks:string;acknowledged:boolean;audit?:InspectionAudit};
export const disclaimer='Satya Scan provides AI-assisted inspection and pre-screening. Final regulatory determination remains with the authorized inspector/compliance authority.';
export const RULES:Rule[]=[
 {id:'manufacturer',name:'Manufacturer / packer / importer',active:true,description:'Detect a named manufacturer, packer or importer. Presence check only.'},
 {id:'netQuantity',name:'Net quantity',active:true,description:'Detect a positive quantity with a recognized unit. No category-specific legal interpretation.'},
 {id:'mrp',name:'MRP / declared price',active:true,description:'Detect a positive price explicitly labeled MRP or maximum retail price.'},
 {id:'batch',name:'Batch / identification',active:true,description:'Detect an explicitly labeled batch or lot identifier. Applicability depends on product category.'},
 {id:'consumerCare',name:'Consumer care',active:true,description:'Detect a consumer-care contact number or email. Does not verify reachability.'},
 {id:'visibility',name:'Declaration readability',active:true,description:'Flag image-quality warnings or uncertain detected text. Physical visibility requires human review.'}
];
export const defaultConfig:Config={version:'demo-prescreen-v1',minimumConfidence:'High',rules:RULES};
const specs:{key:FieldKey;name:string;pattern:RegExp}[]=[
 {key:'manufacturer',name:'Manufacturer / packer / importer',pattern:/(?:manufactur(?:ed\s*(?:&|and)\s*packed\s*by|ed\s*by|er)|mfd\.?\s*(?:by)?|packed\s*by|packer|imported\s*by|importer)\s*[:.\-]?\s*(.*)/i},
 {key:'address',name:'Address',pattern:/(?:registered\s*office|address)\s*[:.\-]?\s*(.*)/i},
 {key:'netQuantity',name:'Net quantity',pattern:/(?:net\s*(?:quantity|qty\.?|weight|wt\.?)|quantity)\s*[:.\-]?\s*(.*)/i},
 {key:'mrp',name:'MRP / declared price',pattern:/(?:\bM\.?\s*R\.?\s*P\.?\b|maximum\s*retail\s*price)\s*[:.\-]?\s*(.*)/i},
 {key:'batch',name:'Batch / identification',pattern:/^(?:batch|lot)\b\s*(?:no\.?|number|code|#)?\s*[:.\-]?\s*(.*)/i},
 {key:'packed',name:'Manufacturing / packing date',pattern:/^(?:packed(?!\s*by)(?:\s*on)?|manufactured(?!\s*by)(?:\s*on)?|mfg\.?\s*(?:date)?|date\s*of\s*(?:manufacture|packing))\s*[:.\-]?\s*(.*)/i},
 {key:'consumerCare',name:'Consumer care',pattern:/(?:consumer\s*(?:care|helpline)|customer\s*(?:care|service)|helpline|toll\s*free)\s*[:.\-]?\s*(.*)/i}
];
export function confidence(score:number):Confidence{return score>=85?'High':score>=60?'Medium':'Low'}
export function extractFields(ocr:OcrResult):Field[]{
 return specs.map(spec=>{
  const i=ocr.lines.findIndex(l=>spec.pattern.test(l.text));
  if(i<0)return {key:spec.key,name:spec.name,value:'',confidence:'Low',evidence:'',line:-1};
  const line=ocr.lines[i];let value=line.text.match(spec.pattern)?.[1]?.trim()??'';let evidence=line.text;let score=line.confidence;let box=line.bbox;
  // A label-only line may continue below; never consume a different declaration.
  if(!value&&ocr.lines[i+1]&&!specs.some(s=>s.pattern.test(ocr.lines[i+1].text))){const next=ocr.lines[i+1];value=next.text.trim();evidence+='\n'+next.text;score=Math.min(score,next.confidence);if(box&&next.bbox)box={x0:Math.min(box.x0,next.bbox.x0),y0:Math.min(box.y0,next.bbox.y0),x1:Math.max(box.x1,next.bbox.x1),y1:Math.max(box.y1,next.bbox.y1)};}
  if(spec.key==='packed'&&/^by\b/i.test(value))value='';
  const candidates=ocr.lines.filter(l=>spec.pattern.test(l.text)).map(l=>l.text.match(spec.pattern)?.[1]?.trim().toLowerCase()).filter(Boolean);
  const ambiguous=new Set(candidates).size>1;
  return {key:spec.key,name:spec.name,value,confidence:ambiguous?'Low':confidence(score),evidence,line:i,box,ambiguous};
 });
}
export function validFormat(key:RuleKey,value:string){
 if(!value.trim()||/\?/.test(value))return false;
 if(key==='netQuantity')return /\b\d+(?:\.\d+)?\s*(?:kg|g|mg|ml|l|litres?|liters?|grams?|kilograms?|units?|pieces?|pcs|nos)\b/i.test(value)&&parseFloat(value.replace(/[^\d.]/g,''))>0;
 if(key==='mrp'){const match=value.match(/(?:₹|rs\.?|inr)\s*(\d+(?:[,.]\d+)*)(?:\s|\/|$|\()/i)??value.match(/^(\d+(?:[,.]\d+)*)(?:\s|\/|$|\()/);return !!match&&Number(match[1].replace(/,/g,''))>0;}
 if(key==='consumerCare')return /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value)||/(?:\+?\d[\d ()-]{5,}\d)/.test(value)&&value.replace(/\D/g,'').length>=7;
 if(key==='batch')return /^[a-z0-9][a-z0-9\-/. ]{0,49}$/i.test(value);
 return value.trim().length>=3;
}
export function evaluate(fields:Field[],quality:Quality,config:Config,reviews:Inspection['reviews']={}):Check[]{
 return config.rules.map(rule=>{
  const field=fields.find(f=>f.key===rule.id), review=reviews[rule.id];
  const value=review?.decision==='confirm'?review.value:field?.value??'';
  let status:Status='PASS',reason='';
  const conf=field?.confidence??(quality.warnings.length?'Low':'High');
  if(!rule.active){status='NOT APPLICABLE';reason='Excluded by this inspection’s configured demo rule set.';}
  else if(review?.decision==='notApplicable'){status='NOT APPLICABLE';reason='Inspector marked this check not applicable: '+review.remark;}
  else if(rule.id==='visibility'){
   if(review?.decision==='confirm'){reason='Readability verified manually by the inspector. Original image-quality findings are retained.';}
   else if(quality.warnings.length||fields.some(f=>f.value&&f.confidence!=='High')){status='CHECK';reason='Image quality or uncertain text requires visual review; hidden or curved declarations are not automatically assessed.';}
   else{reason='No basic image-quality warning; detected declarations have high extraction confidence. Inspect the full package before final determination.';}
  }else if(!value){status='NOT DETECTED';reason='No supporting '+rule.name.toLowerCase()+' was detected in this image. This does not establish absence from the package.';}
  else if(!validFormat(rule.id,value)){status='CHECK';reason='The detected value is incomplete or does not match the configured demo format. Verify the original label.';}
  else if(review?.decision==='confirm'){reason='Value verified manually by the inspector. The original extraction remains available as evidence.';}
  else if(field?.ambiguous){status='CHECK';reason='Multiple different declarations were detected for this field. The first candidate is shown; review all original OCR text before confirming.';}
  else if(conf==='Low'||(config.minimumConfidence==='High'&&conf==='Medium')){status='CHECK';reason='Text was detected with '+conf.toLowerCase()+' extraction confidence. Manual verification is required.';}
  else{reason='Information detected and matches this configured presence / format check. This is not a legal compliance determination.';}
  return {id:rule.id,name:rule.name,status,value,reason,confidence:conf,reviewRequired:rule.active&&(status==='CHECK'||status==='NOT DETECTED')&&!review,review,evidence:field?.evidence??'',line:field?.line??-1,box:field?.box};
 });
}
export function overall(checks:Check[]):Status{const statuses=checks.map(c=>c.status);return statuses.includes('NOT DETECTED')?'NOT DETECTED':statuses.includes('CHECK')?'CHECK':statuses.includes('PASS')?'PASS':'NOT APPLICABLE'}
export function counts(checks:Check[]){return {pass:checks.filter(c=>c.status==='PASS').length,check:checks.filter(c=>c.status==='CHECK').length,missing:checks.filter(c=>c.status==='NOT DETECTED').length,na:checks.filter(c=>c.status==='NOT APPLICABLE').length}}
export function refreshInspection(item:Inspection):Inspection{const fields=extractFields(item.ocr);const checks=evaluate(fields,item.quality,item.config,item.reviews);return {...item,fields,checks,status:overall(checks)}}
export function canFinalize(item:Inspection){return !!item.inspector.trim()&&item.acknowledged&&!item.checks.some(c=>c.reviewRequired)&&item.checks.some(c=>c.status!=='NOT APPLICABLE')}
