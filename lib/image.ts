import type {Quality} from './inspection';
export const MAX_IMAGE_BYTES=10*1024*1024;
export async function prepareImage(file:File):Promise<{image:string;ocrImage:string;quality:Quality;scale:number}>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Please upload JPG, PNG, JPEG, or WebP.');
 if(file.size>MAX_IMAGE_BYTES)throw new Error('Please choose an image smaller than 10 MB.');
 const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
 const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
 const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!(png||jpg||webp))throw new Error('The file is not a readable supported image.');
 const image=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('This image could not be read.'));r.readAsDataURL(file)});
 const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('This image is damaged or unsupported.'));i.src=image});
 if(img.naturalWidth*img.naturalHeight>40_000_000)throw new Error('Please resize this image below 40 megapixels.');
 const canvas=document.createElement('canvas'),scale=Math.min(1,2400/Math.max(img.naturalWidth,img.naturalHeight));
 canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);const ctx=canvas.getContext('2d')!;
 ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
 const small=document.createElement('canvas');small.width=256;small.height=Math.max(1,Math.round(256*img.naturalHeight/img.naturalWidth));const s=small.getContext('2d')!;s.drawImage(canvas,0,0,small.width,small.height);
 const pixels=s.getImageData(0,0,small.width,small.height).data,gray:number[]=[];let sum=0,squares=0;
 for(let i=0;i<pixels.length;i+=4){const y=.299*pixels[i]+.587*pixels[i+1]+.114*pixels[i+2];gray.push(y);sum+=y;squares+=y*y;}
 const brightness=sum/gray.length,contrast=Math.sqrt(Math.max(0,squares/gray.length-brightness*brightness));let sharpness=0,n=0;
 for(let y=1;y<small.height-1;y++)for(let x=1;x<255;x++){const i=y*256+x;const l=4*gray[i]-gray[i-1]-gray[i+1]-gray[i-256]-gray[i+256];sharpness+=l*l;n++;}
 sharpness/=Math.max(n,1);const warnings:string[]=[];
 if(Math.min(img.naturalWidth,img.naturalHeight)<600)warnings.push('Low resolution: small declaration text may be difficult to read.');
 if(brightness<65)warnings.push('Poor lighting: the image appears dark.');
 if(contrast<22)warnings.push('Low contrast: text may blend into the background.');
 if(sharpness<90)warnings.push('Soft detail: the image may be blurred or contain little visible text.');
 return {image,ocrImage:canvas.toDataURL('image/png'),scale,quality:{width:img.naturalWidth,height:img.naturalHeight,warnings,brightness,contrast,sharpness}};
}
