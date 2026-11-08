const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalizeCell,RULE_VERSION}=require('../src/framework/assist-normalization');
const rule=(format,extra={})=>({id:'sample',kind:'date',format,...extra});
const list=sep=>({id:'list_demo',kind:'list',list_separator:sep});
const code=expected=>error=>error.code===expected;

test('Assistant date DMY is explicit, stable and validates Gregorian leap days',()=>{
 const r=rule('DD/MM/YYYY');
 const a=normalizeCell(' 12/03/1956 ',r);
 assert.equal(a.status,'normalized');
 assert.deepEqual(a.normalized,{
  type:'assistant_temporal_bounds',calendar:'gregorian',precision:'day',
  earliest:'1956-03-12',latest:'1956-03-12',qualifier:'exact_as_declared'
 });
 assert.equal(a.source_text,' 12/03/1956 ');
 assert.deepEqual(normalizeCell(' 12/03/1956 ',r),a);
 assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.normalized));
 assert.equal(RULE_VERSION,'0.1.0');
 assert.equal(normalizeCell('29/02/1900',r).status,'quarantined');
 assert.equal(normalizeCell('29/02/2000',r).status,'normalized');
 assert.equal(normalizeCell('31/04/1956',r).status,'quarantined');
});
test('Assistant French month-year preserves month precision and leap boundaries',()=>{
 const r=rule('FR_MONTH_YEAR');
 const a=normalizeCell('mars 1956',r);
 assert.equal(a.normalized.earliest,'1956-03-01');
 assert.equal(a.normalized.latest,'1956-03-31');
 assert.equal(a.normalized.precision,'month');
 const f=normalizeCell('février 1956',r);
 assert.equal(f.normalized.latest,'1956-02-29');
 assert.deepEqual(normalizeCell('fevrier 1956',r).normalized,f.normalized);
 assert.equal(normalizeCell('février 1957',r).normalized.latest,'1957-02-28');
 assert.equal(normalizeCell('13ème mois 1956',r).status,'quarantined');
});
test('Approximate year remains quarantined without explicitly confirmed radius',()=>{
 const unspecified=normalizeCell('vers 1950',rule('FR_MONTH_YEAR'));
 assert.equal(unspecified.status,'quarantined');
 assert.equal(unspecified.diagnostic.code,'ASSIST_APPROXIMATION_REQUIRES_POLICY');
 const r=rule('CIRCA_YEAR',{year_radius:3});
 const a=normalizeCell('vers 1950',r);
 assert.deepEqual(a.normalized,{
  type:'assistant_temporal_bounds',calendar:'gregorian',precision:'approximate_year',
  earliest:'1947-01-01',latest:'1953-12-31',qualifier:'circa_with_explicit_radius'
 });
 assert.equal(normalizeCell('vers 0002',rule('CIRCA_YEAR',{year_radius:3})).status,'quarantined');
 assert.throws(()=>normalizeCell('vers 1950',rule('CIRCA_YEAR',{year_radius:0})),code('ASSIST_DATE_RULE_INVALID'));
});
test('Unconfirmed slash dates and unrecognized values never get guessed',()=>{
 const a=normalizeCell('12/03/1956',rule('FR_MONTH_YEAR'));
 assert.equal(a.status,'quarantined');
 assert.equal(a.diagnostic.code,'ASSIST_DATE_ORDER_REQUIRES_POLICY');
 assert.equal(normalizeCell('03/12/1956',rule('DD/MM/YYYY')).normalized.earliest,'1956-12-03');
 assert.equal(normalizeCell('au printemps 1956',rule('FR_MONTH_YEAR')).status,'quarantined');
});
test('A list separator is an explicit cell rule, never inferred from comma',()=>{
 const original='attaque; sabotage';
 const r=list(';');
 const a=normalizeCell(original,r);
 assert.equal(a.status,'normalized');
 assert.deepEqual(a.normalized.items,['attaque','sabotage']);
 assert.equal(a.source_text,original);
 assert.deepEqual(normalizeCell(original,r),a);
 assert.ok(Object.isFrozen(a.normalized.items));
 assert.deepEqual(normalizeCell(original,list(',')).normalized.items,[original]);
 assert.equal(normalizeCell('attaque;;sabotage',r).diagnostic.code,'ASSIST_LIST_AMBIGUOUS');
 assert.equal(normalizeCell('attaque;\nsabotage',r).status,'quarantined');
});
test('Invalid rules and unsafe cells are never silently accepted',()=>{
 assert.throws(()=>normalizeCell('test',{kind:'list',list_separator:';'}),code('ASSIST_RULE_INVALID'));
 assert.throws(()=>normalizeCell('test',list('\n')),code('ASSIST_LIST_RULE_INVALID'));
 assert.throws(()=>normalizeCell('test',{...rule('DD/MM/YYYY'),extra:'hidden'}),code('ASSIST_DATE_RULE_INVALID'));
 assert.equal(normalizeCell('',list(';')).diagnostic.code,'ASSIST_CELL_EMPTY');
 assert.equal(normalizeCell('x\0y',list(';')).diagnostic.code,'ASSIST_CELL_NUL');
 assert.equal(normalizeCell('x'.repeat(16385),list(';')).diagnostic.code,'ASSIST_CELL_LENGTH');
});
