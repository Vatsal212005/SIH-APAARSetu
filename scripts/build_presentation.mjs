import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtime='C:/Users/ironm/.cache/codex-runtimes/codex-primary-runtime/dependencies';
process.env.RUNTIME_NODE_MODULES=runtime+'/node/node_modules';
const skill='C:/Users/ironm/.codex/plugins/cache/openai-primary-runtime/presentations/26.1025.11240/skills/presentations';
const {Presentation,PresentationFile}=await import(pathToFileURL(runtime+'/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs').href);
const build=path.join(root,'runtime','presentation-build');const output=path.join(root,'docs','presentation');
await fs.mkdir(build,{recursive:true});await fs.mkdir(output,{recursive:true});
const evaluation=JSON.parse(await fs.readFile(path.join(root,'docs','evaluation.json'),'utf8'));
const p=Presentation.create({slideSize:{width:1280,height:720}});
const slides=[
 ['APAARSetu','Intelligent student data management, enrolment compliance and academic verification','SIH26263\nSmart India Hackathon 2026\nSynthetic demonstration',null],
 ['Proposed solution and uniqueness','One repository connects institutional submissions with accountable review','Identify duplicate and inconsistent records\nApply centrally authorized intake policies\nExplain every finding with stored evidence\nLet students control credential disclosure','central-dashboard.png'],
 ['Technical approach','Four portals share a versioned API and persistent records','Next.js and strict TypeScript\nFastAPI, SQLAlchemy and Alembic\nSQLite locally with relational constraints\nRule validation and Isolation Forest\nEd25519 signatures with scoped consent',null],
 ['Feasibility and viability','Native Windows operation without paid AI services','100 fictional institutions and 5,000 identities\nCSV/XLSX preview and transactional ingestion\nAutomated authorization and signature tests\nSynthetic hold-out precision '+evaluation.statistical.precision.toFixed(2)+' and recall '+evaluation.statistical.recall.toFixed(2)+'\nProduction requires approved integrations and security assessment',null],
 ['Impact and expected benefits','Administrative visibility with student-controlled disclosure','Earlier visibility of intake discrepancies\nTraceable correction and review decisions\nLimited disclosure to verification recipients\nMeasured workflow evidence from synthetic data','credential-verification.png'],
 ['Research and references','Official identity evidence remains a separate trust boundary','APAAR FAQ: apaar.education.gov.in/faqs\nIsolation Forest: scikit-learn.org\nEd25519: cryptography.io\nFastAPI and SQLAlchemy documentation\nProject evaluation and actual application screenshots\nOfficial APAAR verification unavailable in demonstration mode',null],
];
function text(slide,name,content,x,y,w,h,size,color,bold=false){const box=slide.shapes.add({name,geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});box.text=content;box.text.style={typeface:'Arial',fontSize:size,color,bold};return box;}
for(let i=0;i<slides.length;i++){
 const [title,subtitle,body,image]=slides[i];const s=p.slides.add();s.background.fill=i===0?'#0b203a':'#f7fafc';
 text(s,'title',title,64,55,1140,88,i===0?66:44,i===0?'#ffffff':'#0b203a',true);
 text(s,'subtitle',subtitle,64,157,1100,80,26,i===0?'#9ee5dc':'#28617d');
 text(s,'body',body,64,270,image?505:1110,350,i===5?26:28,i===0?'#e2edf4':'#263d52');
 text(s,'draft-label',`Non-official SIH template draft   ${i+1}/6`,64,668,1140,24,16,i===0?'#b8d1df':'#60758a');
 if(image){const bytes=await fs.readFile(path.join(root,'docs','screenshots',image));s.images.add({blob:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),contentType:'image/png',alt:'Actual APAARSetu browser screenshot',fit:'contain',position:{left:600,top:245,width:620,height:390}});}
 const png=await p.export({slide:s,format:'png',scale:1});await fs.writeFile(path.join(build,`slide-${i+1}.png`),new Uint8Array(await png.arrayBuffer()));
}
const candidate=path.join(build,'candidate.pptx');await(await PresentationFile.exportPptx(p)).save(candidate);
const {finalizePresentation}=await import(pathToFileURL(skill+'/container_tools/artifact_tool_utils.mjs').href);
await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:path.join(output,'APAARSetu-SIH-draft.pptx'),pythonExecutable:runtime+'/python/python.exe',integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit'],explicitTotalSlideCount:6,fontPolicy:{basis:'design',families:['Arial']},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation.json')});
console.log('Six-slide draft exported and rendered.');
