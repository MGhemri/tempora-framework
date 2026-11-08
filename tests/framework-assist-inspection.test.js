const {test}=require('node:test'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {inspectDelimitedSample,MAX_SAMPLE_BYTES}=require('../src/framework/assist-inspection');
const inspect=s=>inspectDelimitedSample(Buffer.from(s,'utf8'));
const code=expected=>error=>error.code===expected;

test('Assistant CSV sample inspection is deterministic, immutable and explicitly unconfirmed',()=>{
 const input=Buffer.from('id;title;date\r\nA1;Été;12/03/1956\r\nA2;Mars;mars 1956\r\n','utf8');
 const unchanged=Buffer.from(input),a=inspectDelimitedSample(input);
 assert.deepEqual(input,unchanged);
 assert.deepEqual(inspectDelimitedSample(input),a);
 assert.equal(a.encoding,'UTF-8');
 assert.equal(a.sample_sha256,createHash('sha256').update(input).digest('hex'));
 assert.equal(a.suggested_delimiter,';');
 assert.equal(a.selected_delimiter,null);
 assert.equal(a.suggestion_status,'requires_confirmation');
 assert.deepEqual(a.candidates[0].header_values,['id','title','date']);
 assert.deepEqual(a.candidates[0].row_start_lines,[1,2,3]);
 assert.equal(a.candidates[0].consistent_data_rows,2);
 assert.equal(a.canonical_validated,false);
 assert.equal(Object.isFrozen(a),true);
 assert.equal(Object.isFrozen(a.candidates),true);
 assert.equal(Object.isFrozen(a.candidates[0].header_values),true);
});
test('Assistant recognizes tab candidate but never claims data was normalized',()=>{
 const a=inspect('id\ttitle\nA\tFictional operation\nB\tSecond event\n');
 assert.equal(a.suggested_delimiter,'\t');
 assert.equal(a.selected_delimiter,null);
 assert.equal(a.format_family,'delimited_text_candidate');
 assert.equal(Object.hasOwn(a,'normalized_rows'),false);
});
test('Single column and delimiter ties are ambiguous, not guessed',()=>{
 const a=inspect('title\nfirst\nsecond\n');
 assert.equal(a.suggested_delimiter,null);
 assert.equal(a.suggestion_status,'ambiguous');
 assert.equal(a.selected_delimiter,null);
 const b=inspect('id;name,date\nA;B,C\nD;E,F\n');
 assert.equal(b.suggested_delimiter,null);
 assert.equal(b.suggestion_status,'ambiguous');
});
test('BOM and quoted multi-line cell preserve original source line locators',()=>{
 const a=inspect('\uFEFFid,name,date\r\nA,"Fictional\r\nevent",1956\r\nB,Next,1957\r\n');
 assert.equal(a.encoding,'UTF-8 BOM');
 assert.equal(a.suggested_delimiter,',');
 assert.deepEqual(a.candidates[0].row_start_lines,[1,2,4]);
 assert.equal(a.candidates[0].rows_observed,3);
});
test('Unsafe or duplicate headers are visible, not silently repaired',()=>{
 const a=inspect('id,id\n1,2\n');
 assert.equal(a.suggested_delimiter,',');
 assert.deepEqual(a.candidates[0].header_issues,['AMBIGUOUS_OR_UNSAFE_HEADER']);
 const unsafe=inspect('__proto__,title\nA,fictional\n');
 assert.deepEqual(unsafe.candidates[0].header_issues,['AMBIGUOUS_OR_UNSAFE_HEADER']);
});
test('Invalid bytes, NUL, limits and invalid configuration fail closed',()=>{
 assert.throws(()=>inspectDelimitedSample(Buffer.from([0xff,0xfe])),code('ASSIST_UTF8_INVALID'));
 assert.throws(()=>inspect('id,name\na,\u0000'),code('ASSIST_NUL'));
 assert.throws(()=>inspectDelimitedSample(Buffer.alloc(MAX_SAMPLE_BYTES+1,0x61)),code('ASSIST_SAMPLE_SIZE'));
 assert.throws(()=>inspectDelimitedSample(Buffer.from('')),code('ASSIST_SAMPLE_SIZE'));
 assert.throws(()=>inspectDelimitedSample('id,title'),code('ASSIST_BYTES_REQUIRED'));
 assert.throws(()=>inspectDelimitedSample(Buffer.from('id,name'),{maxRows:999}),code('ASSIST_ROWS_LIMIT'));
 assert.throws(()=>inspectDelimitedSample(Buffer.from('id,name'),{path:'/secrets'}),code('ASSIST_OPTIONS'));
});
