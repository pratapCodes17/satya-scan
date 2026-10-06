import type {Inspection} from './inspection';
// Base64 pieces stay below D1's 2 MB row limit, including for 10 MB uploads.
// The record and all pieces commit together; retries never replace a saved image.
export function inspectionInsert(db:D1Database,record:Inspection,ownerUserId:string,createdByUserId:string,reviewerUserId:string){return db.prepare('INSERT INTO inspections (id, product, created_at, status, mode, record, owner_user_id, created_by_user_id, reviewer_user_id, finalized_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(record.id,record.product,record.createdAt,record.status,record.mode,JSON.stringify(record),ownerUserId,createdByUserId,reviewerUserId,record.finalizedAt??null)}
export function resultEventInserts(db:D1Database,record:Inspection){return (record.audit?.resultHistory??[]).map(event=>db.prepare('INSERT INTO inspection_result_events (id, inspection_id, event_type, status, recorded_at, actor_user_id, actor_display_name) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(),record.id,event.event,event.status,event.at,event.actor?.userId??null,event.actor?.displayName??'Legacy record'))}
export async function saveToDatabase(db:D1Database,record:Inspection,contentType:string,base64:string,ownerUserId:string,createdByUserId:string,reviewerUserId:string){
 const statements=[inspectionInsert(db,record,ownerUserId,createdByUserId,reviewerUserId),...resultEventInserts(db,record)];const size=512*1024;
 for(let offset=0,part=0;offset<base64.length;offset+=size,part++)statements.push(db.prepare('INSERT INTO inspection_images (inspection_id, part, content_type, data) VALUES (?, ?, ?, ?)').bind(record.id,part,contentType,base64.slice(offset,offset+size)));
 await db.batch(statements);
}
export async function readDatabaseImage(db:D1Database,id:string){
 const {results}=await db.prepare('SELECT part, content_type, data FROM inspection_images WHERE inspection_id = ? ORDER BY part').bind(id).all<{part:number;content_type:string;data:string}>();
 if(!results.length)return null;
 if(results.some((part,index)=>part.part!==index))throw new Error('Incomplete image');
 return {contentType:results[0].content_type,base64:results.map(p=>p.data).join('')};
}
