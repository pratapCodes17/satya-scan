import { storage } from '@/lib/database';
import { canAccessInspection, currentUser } from '@/lib/auth';
import type { AuditActor, Inspection } from '@/lib/inspection';

type DetailRow = { record:string; ownerUserId:string|null; createdByUserId:string|null; reviewerUserId:string|null; createdAt:string; finalizedAt:string|null; ownerName:string|null; ownerRole:string|null; creatorName:string|null; creatorRole:string|null; reviewerName:string|null; reviewerRole:string|null };
function actor(id:string|null,name:string|null,role:string|null):AuditActor|null{return id&&name?{userId:id,displayName:name,role:role==='ADMIN'?'ADMIN':'INSPECTOR'}:null}
function addLegacyAudit(record:Inspection,row:DetailRow):Inspection{if(record.audit)return record;const owner=actor(row.ownerUserId,row.ownerName,row.ownerRole),creator=actor(row.createdByUserId,row.creatorName,row.creatorRole),reviewer=actor(row.reviewerUserId,row.reviewerName,row.reviewerRole),finalizedAt=record.finalizedAt??row.finalizedAt;return {...record,audit:{version:1,legacy:true,owner,creator,reviewer,createdAt:record.createdAt??row.createdAt,finalizedAt:finalizedAt??null,ruleSnapshot:record.config??null,resultHistory:[{event:'LEGACY_IMPORT',at:finalizedAt??row.createdAt,status:record.status,actor:reviewer??creator??owner}]}}}

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const user=await currentUser(request);if(!user)return Response.json({error:'Sign in is required to open inspections.'},{status:401});const {id}=await params;const row=await storage().DB.prepare(`SELECT inspections.record, inspections.owner_user_id AS ownerUserId, inspections.created_by_user_id AS createdByUserId, inspections.reviewer_user_id AS reviewerUserId, inspections.created_at AS createdAt, inspections.finalized_at AS finalizedAt,
owner.display_name AS ownerName, owner.role AS ownerRole, creator.display_name AS creatorName, creator.role AS creatorRole, reviewer.display_name AS reviewerName, reviewer.role AS reviewerRole
FROM inspections
LEFT JOIN users AS owner ON owner.id = inspections.owner_user_id
LEFT JOIN users AS creator ON creator.id = inspections.created_by_user_id
LEFT JOIN users AS reviewer ON reviewer.id = inspections.reviewer_user_id
WHERE inspections.id = ?`).bind(id).first<DetailRow>();if(!row||!canAccessInspection(user,row.ownerUserId))return Response.json({error:'Inspection not found.'},{status:404});return Response.json(addLegacyAudit(JSON.parse(row.record) as Inspection,row),{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Unable to open this inspection. Please retry.'},{status:503})}}
