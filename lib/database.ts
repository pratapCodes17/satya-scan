import {env} from 'cloudflare:workers';
export function storage(){const runtime=env as unknown as {DB:D1Database;BUCKET?:R2Bucket};if(!runtime.DB)throw new Error('Storage unavailable');return runtime;}
