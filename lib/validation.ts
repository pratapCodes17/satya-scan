import {z} from 'zod';
import {RULES,refreshInspection,canFinalize,type Inspection} from './inspection';
const box=z.object({x0:z.number().nonnegative(),y0:z.number().nonnegative(),x1:z.number().nonnegative(),y1:z.number().nonnegative()});
const review=z.object({value:z.string().max(1000),remark:z.string().trim().min(3).max(2000),decision:z.enum(['confirm','retain','notApplicable']),at:z.string().datetime()});
const schema=z.object({id:z.string().uuid(),product:z.string().trim().min(1).max(150),inspector:z.string().trim().min(1).max(100),createdAt:z.string().datetime(),mode:z.enum(['demo','ocr']),imageName:z.string().max(200),imageWidth:z.number().positive().max(40000),imageHeight:z.number().positive().max(40000),ocr:z.object({text:z.string().max(60000),lines:z.array(z.object({text:z.string().max(2000),confidence:z.number().min(0).max(100),bbox:box.optional()})).max(3000)}),quality:z.object({width:z.number().positive(),height:z.number().positive(),warnings:z.array(z.string().max(300)).max(10),brightness:z.number().finite(),contrast:z.number().finite(),sharpness:z.number().finite()}),config:z.object({version:z.literal('demo-prescreen-v1'),minimumConfidence:z.enum(['High','Medium']),rules:z.array(z.object({id:z.enum(['manufacturer','netQuantity','mrp','batch','consumerCare','visibility']),active:z.boolean()})).length(6)}),reviews:z.object({manufacturer:review.optional(),netQuantity:review.optional(),mrp:review.optional(),batch:review.optional(),consumerCare:review.optional(),visibility:review.optional()}),remarks:z.string().max(4000),acknowledged:z.literal(true)});
export function validateFinalization(input:unknown):Inspection{
 const parsed=schema.parse(input);if(new Set(parsed.config.rules.map(r=>r.id)).size!==6)throw new Error('Each configured check must occur once.');
 const config={...parsed.config,rules:parsed.config.rules.map(r=>({...RULES.find(a=>a.id===r.id)!,active:r.active}))};
 const record=refreshInspection({...parsed,config,image:'/api/inspections/'+parsed.id+'/image',fields:[],checks:[],status:'CHECK'} as Inspection);
 if(!canFinalize(record))throw new Error('Review all uncertain checks, enter your name, and acknowledge the result before finalizing.');
 return {...record,finalizedAt:new Date().toISOString()};
}
