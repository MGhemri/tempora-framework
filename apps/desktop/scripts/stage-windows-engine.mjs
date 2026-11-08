import { mkdirSync, cpSync, copyFileSync, rmSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'src-tauri', 'resources', 'engine');
if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw Error('Windows x64 staging must run on a Windows x64 runner');
}
if (!process.execPath.toLowerCase().endsWith('node.exe')) throw Error('Expected official Node.exe runtime');
const pkg = JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
if (pkg.dependencies['tempora-framework'] !== '3.0.0') throw Error('Engine pin must be 3.0.0');
if (existsSync(out)) rmSync(out, { recursive:true, force:true });
mkdirSync(out,{recursive:true});
writeFileSync(join(out,'package.json'),JSON.stringify({name:'tempora-desktop-engine-runtime',version:'0.1.0',private:true,dependencies:{'tempora-framework':'3.0.0'}},null,2)+'\n');
copyFileSync(process.execPath,join(out,'node.exe'));
copyFileSync(join(root,'bridge','worker.cjs'),join(out,'worker.cjs'));
cpSync(join(root,'bridge','visualization'),join(out,'visualization'),{recursive:true});
const npm = process.env.npm_execpath;
if (!npm) throw Error('Run via npm script for exact npm CLI path');
const options = ['--workspaces=false','--ignore-scripts','--omit=dev','--no-audit','--no-fund','--package-lock=true'];
const result=spawnSync(process.execPath,[npm,'install',...options],{cwd:out,stdio:'inherit',shell:false});
if (result.status !== 0) throw Error('Runtime dependency installation failed');
if (!existsSync(join(out,'package-lock.json'))) throw Error('Missing runtime dependency lockfile');
const audit=spawnSync(process.execPath,[npm,'audit','--omit=dev','--audit-level=high'],{cwd:out,stdio:'inherit',shell:false});
if (audit.status !== 0) throw Error('Runtime dependency security audit failed; do not package vulnerable engine');
const engine = JSON.parse(readFileSync(join(out,'node_modules','tempora-framework','package.json'),'utf8'));
if (engine.version !== '3.0.0' || engine.private === true) throw Error('Unexpected installed TEMPORA Engine');
const result1=spawnSync(join(out,'node.exe'),[join(out,'worker.cjs')],{
 cwd:out,encoding:'utf8',timeout:15000,env:{...process.env,NODE_OPTIONS:'',NODE_PATH:''},
 input:JSON.stringify({protocol_version:'1.0.0',request_id:'windows_smoke',operation:'health',payload:{}})+'\n'
});
if (result1.status !== 0 || JSON.parse(result1.stdout.trim()).result?.engine_version !== '3.0.0') {
 throw Error('Bundled runtime smoke failed: ' + result1.stderr);
}
const digest = name => createHash('sha256').update(readFileSync(join(out,name))).digest('hex');
const inventory=[];
for (const entry of Object.keys(JSON.parse(readFileSync(join(out,'package-lock.json'),'utf8')).packages).filter(x=>x.startsWith('node_modules/')).sort()) {
 const p=join(out,entry,'package.json');
 if (!existsSync(p)) throw Error('Missing package manifest: '+entry);
 const info=JSON.parse(readFileSync(p,'utf8'));
 if (!info.license) throw Error('Dependency missing declared license: '+entry);
 inventory.push({name:info.name,version:info.version,license:info.license});
}
const manifest={target:'windows-x64',engine:'tempora-framework@3.0.0',node:process.version,
 lock_sha256:digest('package-lock.json'),dependencies:inventory,
 node_sha256:digest('node.exe'),worker_sha256:digest('worker.cjs'),
 visualization_contract_sha256:digest('visualization/contracts.cjs'),
 visualization_session_sha256:digest('visualization/session.cjs'),
 visualization_projection_sha256:digest('visualization/projections.cjs'),
 visualization_algorithms_sha256:digest('visualization/algorithms.cjs'),
 visualization_exporter_sha256:digest('visualization/exporter.cjs'),
 visualization_graph_navigation_sha256:digest('visualization/graph-navigation.cjs'),
 visualization_snapshots_sha256:digest('visualization/snapshots.cjs'),
 visualization_chronos_filter_sha256:digest('visualization/chronos-filter.cjs')};
writeFileSync(join(out,'runtime-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
