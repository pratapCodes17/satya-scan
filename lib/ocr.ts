import type {OcrResult} from './inspection';
export async function readLabel(image:string,scale:number,progress:(label:string,amount:number)=>void,signal:AbortSignal):Promise<OcrResult>{
 const {createWorker}=await import('tesseract.js');
 if(signal.aborted)throw new Error('Analysis cancelled.');
 let worker:Awaited<ReturnType<typeof createWorker>>|undefined,closed=false;
 let timeout:ReturnType<typeof setTimeout>|undefined;
 let abort:()=>void=()=>{};
 const cancelled=new Promise<never>((_,reject)=>{abort=()=>{void worker?.terminate();reject(new Error('Analysis cancelled.'))};signal.addEventListener('abort',abort,{once:true})});
 const timedOut=new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Text recognition took too long. Try a smaller, clearer label image.')),120000)});
 try{
  const creation=createWorker('eng',1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr',langPath:'/ocr',logger:m=>{if(!signal.aborted&&!closed)progress(m.status==='recognizing text'?'Reading package text':'Preparing OCR engine',m.status==='recognizing text'?20+Math.round(m.progress*60):12)},errorHandler:()=>{}}).then(w=>{if(closed){void w.terminate();}else worker=w;return w;});
  worker=await Promise.race([creation,cancelled,timedOut]);
  if(signal.aborted)throw new Error('Analysis cancelled.');
  await worker.setParameters({tessedit_pageseg_mode:'11' as import('tesseract.js').PSM,user_defined_dpi:'300'});
  const {data}=await Promise.race([worker.recognize(image,{}, {text:true,blocks:true}),cancelled,timedOut]);
  const lines=(data.blocks??[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines)).map(l=>({text:l.text.trim(),confidence:l.confidence,bbox:{x0:l.bbox.x0/scale,y0:l.bbox.y0/scale,x1:l.bbox.x1/scale,y1:l.bbox.y1/scale}})).filter(l=>l.text);
  if(!data.text.trim())throw new Error('No readable text was detected. Please upload a clearer, closer photo of the label.');
  return {text:data.text,lines};
 }catch(error){if(signal.aborted)throw new Error('Analysis cancelled.');if(error instanceof Error&&/No readable|took too long/.test(error.message))throw error;throw new Error('OCR could not read this image. Check the connection, then try a clearer label photo or a prepared demo.');}
 finally{closed=true;clearTimeout(timeout);signal.removeEventListener('abort',abort);await worker?.terminate().catch(()=>{});}
}
