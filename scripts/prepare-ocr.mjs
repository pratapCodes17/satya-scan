import {mkdirSync,copyFileSync,readdirSync} from 'node:fs';
mkdirSync('public/ocr',{recursive:true});
copyFileSync('node_modules/tesseract.js/dist/worker.min.js','public/ocr/worker.min.js');
for(const file of readdirSync('node_modules/tesseract.js-core').filter(f=>f.includes('.wasm')))copyFileSync('node_modules/tesseract.js-core/'+file,'public/ocr/'+file);
copyFileSync('node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz','public/ocr/eng.traineddata.gz');
copyFileSync('node_modules/tesseract.js/LICENSE.md','public/ocr/LICENSE-tesseract.txt');
copyFileSync('node_modules/tesseract.js-core/LICENSE','public/ocr/LICENSE-core.txt');
copyFileSync('node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt','public/ocr/worker.min.js.LICENSE.txt');
console.log('Self-hosted OCR engine and English model prepared.');
