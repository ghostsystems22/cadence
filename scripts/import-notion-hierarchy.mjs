import fs from 'node:fs';
const base='http://172.17.0.1:8181/api';
const preview=JSON.parse(fs.readFileSync('/root/cadence/imports/cadence-import-preview.json'));
const raw=JSON.parse(fs.readFileSync('/root/cadence/imports/notion-tasks-raw.json'));
const children=JSON.parse(fs.readFileSync('/root/cadence/imports/notion-child-tasks-resolved.json'));
const childById=new Map(children.map(x=>[x.id,x]));
const post=async(table,fields)=>{const r=await fetch(`${base}/${encodeURIComponent(table)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({fields})});if(!r.ok)throw Error(`${table}: ${r.status} ${await r.text()}`);return r.json()};
const boot=await (await fetch(`${base}/bootstrap`)).json();
const noteId=(r)=>String(r.fields?.Notes||'').match(/Notion ID: ([\w-]+)/)?.[1];
const existing={projects:new Map(boot.Projects.map(r=>[r.fields.Name,r])), milestones:new Map(boot.Milestones.map(r=>[noteId(r),r])), tasks:new Map(boot.Tasks.map(r=>[noteId(r),r]))};
const normalize=s=>String(s||'').trim();
const sourceById=new Map(raw.map(r=>[r.id,r]));
const mainById=new Map();
for(const t of preview.tasks) mainById.set(t['Notion ID'],t);
const maxDue=(project)=>preview.tasks.filter(t=>normalize(t.ProjectName)===normalize(project)).map(t=>t['Due Date']).filter(Boolean).sort().at(-1)||null;
const projectByName=new Map();
for(const p of preview.projects){let r=existing.projects.get(p.name);if(!r){const fields={Name:p.name,Status:'Actif','Target End':maxDue(p.name)||undefined,Notes:`Imported from Notion. Notion ID: ${p.notionId}`};r=await post('Projects',fields)}projectByName.set(normalize(p.name),r)}
const parentBySourceId=new Map(); let counts={projects:0,milestones:0,parents:0,children:0,skipped:0};
for(const t of preview.tasks){const project=projectByName.get(normalize(t.ProjectName));if(!project){counts.skipped++;continue}let milestone=existing.milestones.get(t['Notion ID']);if(!milestone){milestone=await post('Milestones',{Name:normalize(t.Name),Project:[project.id],Date:t['Due Date']||undefined,Notes:`Notion URL: ${t['Notion URL']}\nNotion ID: ${t['Notion ID']}`});counts.milestones++}let parent=existing.tasks.get(t['Notion ID']);if(!parent){parent=await post('Tasks',{Name:normalize(t.Name),Type:'Jalon',Status:t.Status,Priority:t.Priority,'Deadline Mode':t['Due Date']?'Fixe':'Héritée','Due Date':t['Due Date']||undefined,Project:[project.id],Milestone:[milestone.id],Tags:t.Tags?.length?t.Tags:undefined,Notes:`Main task / milestone imported from Notion.\nNotion URL: ${t['Notion URL']}\nNotion ID: ${t['Notion ID']}`});counts.parents++}parentBySourceId.set(t['Notion ID'],{parent,project})}
for(const [sourceId,{parent,project}] of parentBySourceId){const source=sourceById.get(sourceId);for(const ref of source?.properties?.['Sub Tasks ']?.relation||[]){const child=childById.get(ref.id);if(!child?.title){counts.skipped++;continue}if(existing.tasks.has(ref.id))continue;await post('Tasks',{Name:child.title,Status:'Backlog',Project:[project.id],Parent:[parent.id],Notes:`Child task imported from Notion.\nNotion ID: ${ref.id}\nParent Notion ID: ${sourceId}`});counts.children++}}
counts.projects=projectByName.size;console.log(JSON.stringify(counts));