'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {previewNormalization}=require('../src/framework/assist-preview');
const mapping={mapping_schema_version:'1.0.0',id:'assistant-csv-review',version:'1.0.0',
 profile_id:'synthetic-history',profile_version:'1.0.0',format:'csv',delimiter:',',
 fields:{id:'/id',title:{en:'/title'},start_date:'/date'}};
const bindings=[
 {source_column:'id',target_field:'id',state:'confirmed_by_user'},
 {source_column:'title',target_field:'title.en',state:'confirmed_by_user'},
 {source_column:'date',target_field:'start_date',state:'confirmed_by_user'}
];
const rule={source_column:'date',rule:{id:'human-date-1',kind:'date',format:'DD/MM/YYYY'}};
function run(csv,rules=[rule]){
 const bytes=Buffer.from(csv);
 return previewNormalization({bytes,mapping,bindings,rules,
 source_sha256:createHash('sha256').update(bytes).digest('hex')});
}
const code=x=>e=>e.code===x;
test('dry-run: deterministic normalization, quarantine, read-only provenance and no acceptance',()=>{
 const csv='id,title,date\n1,Fictional,12/03/1956\n2,Imaginary,31/02/1956\n';
 const before=Buffer.from(csv),a=run(csv),b=run(csv);
 assert.deepEqual(a,b);
 assert.equal(a.scope,'normalization_dry_run_only');
 assert.equal(a.source_modified,false);
 assert.equal(a.canonical_validated,false);
 assert.equal(a.import_performed,false);
 assert.equal(a.batch_accepted,false);
 assert.equal(a.total_rows,2);
 assert.equal(a.summary.normalized,1);
 assert.equal(a.summary.quarantined,1);
 assert.equal(a.summary.unconfigured,4);
 assert.equal(a.rows[0].entries[2].normalized.earliest,'1956-03-12');
 assert.equal(a.rows[1].entries[2].diagnostic_code,'ASSIST_DATE_UNRECOGNIZED');
 assert.equal(before.toString(),csv);
});
test('dry-run: explicit rules only, source bytes and quoted source cell intact',()=>{
 const csv='id,title,date\n1,"Hello, world",février 1956\n';
 const a=run(csv,[{source_column:'date',rule:{id:'manual-month',kind:'date',format:'FR_MONTH_YEAR'}}]);
 assert.equal(a.rows[0].entries[1].source_text,'Hello, world');
 assert.equal(a.rows[0].entries[2].normalized.latest,'1956-02-29');
 assert.equal(run(csv,[]).summary.unconfigured,3);
 assert.equal(run(csv,[]).summary.normalized,0);
});
test('dry-run: width errors quarantine and CSV parser rejects malformed quoting',()=>{
 const a=run('id,title,date\n1,missing\n');
 assert.equal(a.summary.rows_with_structure_errors,1);
 assert.equal(a.summary.quarantined,1);
 assert.throws(()=>run('id,title,date\n1,"unfinished,12/03/1956\n'),code('ASSIST_PREVIEW_CSV_SYNTAX'));
});
test('dry-run: strict rule ownership, no unknown source field, no duplicate rules',()=>{
 assert.throws(()=>run('id,title,date\n1,A,12/03/1956\n',[{source_column:'secret',rule:rule.rule}]),code('ASSIST_PREVIEW_RULE'));
 assert.throws(()=>run('id,title,date\n1,A,12/03/1956\n',[rule,rule]),code('ASSIST_PREVIEW_RULE'));
 assert.throws(()=>run('id,title,date\n1,A,12/03/1956\n',[{source_column:'date',rule:{id:'bad',kind:'date',format:'AUTO'}}]),code('ASSIST_DATE_RULE_INVALID'));
});
test('dry-run: bounded to 64 rows and marks incomplete, never acceptance',()=>{
 const csv='id,title,date\n'+Array.from({length:70},(_,i)=>(i+1)+',Test,12/03/1956\n').join('');
 const a=run(csv);
 assert.equal(a.total_rows,70);
 assert.equal(a.displayed_rows,64);
 assert.equal(a.preview_complete,false);
 assert.equal(a.note,'PREVIEW_TRUNCATED_NO_ACCEPTANCE');
 assert.equal(a.batch_accepted,false);
});
test('dry-run: wrong fingerprint and bytes are rejected',()=>{
 const bytes=Buffer.from('id,title,date\n1,A,12/03/1956\n');
 assert.throws(()=>previewNormalization({bytes,mapping,bindings,rules:[rule],
   source_sha256:'0'.repeat(64)}),code('ASSIST_PREVIEW_SOURCE_CHANGED'));
});
