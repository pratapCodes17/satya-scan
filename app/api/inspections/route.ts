import {storage} from '@/lib/database';
import {validateFinalization} from '@/lib/validation';
import {inspectionInsert,resultEventInserts,saveToDatabase} from '@/lib/image-storage';
import {canAccessInspection,currentUser,sameOrigin} from '@/lib/auth';
import {defaultConfig,type AuditActor,type Inspection} from '@/lib/inspection';
import {Buffer} from 'node:buffer';
type StoredInspection={record:string;ownerUserId:string|null};
function object(value:unknown):Record<string,unknown>|null{return typeof value==='object'&&value!==null&&!Array.isArray(value)?value as Record<string,unknown>:null}
function actor(user:{id:string;displayName:string;role:'ADMIN'|'INSPECTOR'}):AuditActor{return {userId:user.id,displayName:user.displayName,role:user.role}}
function addAudit(record:Inspection,user:{id:string;displayName:string;role:'ADMIN'|'INSPECTOR'}):Inspection{const reviewer=actor(user),finalizedAt=record.finalizedAt??new Date().toISOString();return {...record,finalizedAt,audit:{version:1,owner:reviewer,creator:reviewer,reviewer,createdAt:record.createdAt,finalizedAt,ruleSnapshot:structuredClone(record.config),resultHistory:[{event:'ANALYZED',at:record.createdAt,status:record.status,actor:reviewer},{event:'FINALIZED',at:finalizedAt,status:record.status,actor:reviewer}]}}}
export async function GET(request:Request){try{const user=await currentUser(request);if(!user)return Response.json({error:'Sign in is required to view inspection history.'},{status:401});const {DB}=storage();const query=`SELECT inspections.id, inspections.product, inspections.created_at AS createdAt, inspections.finalized_at AS finalizedAt, inspections.status, inspections.mode, inspections.owner_user_id AS ownerUserId,
COALESCE(owner.display_name,'Legacy record') AS ownerName, COALESCE(creator.display_name,'Unrecorded') AS creatorName, COALESCE(reviewer.display_name,'Unrecorded') AS reviewerName,
CASE WHEN inspections.owner_user_id IS NULL THEN 1 ELSE 0 END AS legacy
FROM inspections
LEFT JOIN users AS owner ON owner.id = inspections.owner_user_id
LEFT JOIN users AS creator ON creator.id = inspections.created_by_user_id
LEFT JOIN users AS reviewer ON reviewer.id = inspections.reviewer_user_id`;
const rows=user.role==='ADMIN'?await DB.prepare(query+' ORDER BY inspections.created_at DESC LIMIT 500').all():await DB.prepare(query+' WHERE inspections.owner_user_id = ? ORDER BY inspections.created_at DESC LIMIT 500').bind(user.id).all();return Response.json(rows.results,{headers:{'Cache-Control':'no-store'}})}catch(error){console.error('History unavailable',error);return Response.json({error:'History is temporarily unavailable. Please retry.'},{status:503})}}
export async function POST(request:Request){
 const user=await currentUser(request);if(!user)return Response.json({error:'Sign in is required to save an inspection.'},{status:401});
 if(!sameOrigin(request))return Response.json({error:'Please save from the inspection workspace.'},{status:403});
 if(Number(request.headers.get('content-length')??0)>15_000_000)return Response.json({error:'Image exceeds the upload limit.'},{status:413});
 let payload:{record:unknown;image:unknown};
 try{const body=await request.text();if(body.length>15_000_000)return Response.json({error:'Image exceeds the upload limit.'},{status:413});payload=JSON.parse(body);}catch{return Response.json({error:'Unable to read this inspection. Please try again.'},{status:400})}
 const submitted=object(payload.record);if(!submitted)return Response.json({error:'Unable to read this inspection. Please try again.'},{status:400});
 let record;try{record=addAudit(validateFinalization({...submitted,inspector:user.displayName,config:user.role==='INSPECTOR'?structuredClone(defaultConfig):submitted.config}),user);}catch{return Response.json({error:'Please complete the reviewer name, required reviews and final acknowledgement. Check field and remark lengths.'},{status:400})}
 if(Buffer.byteLength(JSON.stringify(record),'utf8')>1_500_000)return Response.json({error:'This inspection contains too much extracted text. Please use a closer photo of the product label.'},{status:413});
 const match=typeof payload.image==='string'&&payload.image.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
 if(!match)return Response.json({error:'Please include a supported image.'},{status:400});
 let bytes:Uint8Array;try{bytes=Buffer.from(match[2],'base64');}catch{return Response.json({error:'The image data could not be read.'},{status:400})}
 if(bytes.length>10*1024*1024)return Response.json({error:'Please choose an image smaller than 10 MB.'},{status:413});
 const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!(match[1]==='image/png'&&png||match[1]==='image/jpeg'&&jpg||match[1]==='image/webp'&&webp))return Response.json({error:'The image format does not match its contents.'},{status:400});
 try{const {DB,BUCKET}=storage();const existing=await DB.prepare('SELECT record, owner_user_id AS ownerUserId FROM inspections WHERE id = ?').bind(record.id).first<StoredInspection>();if(existing){if(canAccessInspection(user,existing.ownerUserId))return Response.json(JSON.parse(existing.record));return Response.json({error:'An inspection with this identifier already exists.'},{status:409});}
 if(BUCKET){
  await BUCKET.put('inspections/'+record.id,bytes,{httpMetadata:{contentType:match[1]}});
  await DB.batch([inspectionInsert(DB,record,user.id,user.id,user.id),...resultEventInserts(DB,record)]);
 }else{
  try{await saveToDatabase(DB,record,match[1],match[2],user.id,user.id,user.id);}catch(error){const previous=await DB.prepare('SELECT record, owner_user_id AS ownerUserId FROM inspections WHERE id = ?').bind(record.id).first<StoredInspection>();if(previous&&canAccessInspection(user,previous.ownerUserId))return Response.json(JSON.parse(previous.record));throw error;}
 }
 return Response.json(record,{status:201});
 }catch(error){console.error('Inspection save unavailable',error);return Response.json({error:'Unable to save this inspection. Your review is still on screen; please retry.'},{status:503})}
}
