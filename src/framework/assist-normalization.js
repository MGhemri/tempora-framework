'use strict';
// TEMPORA Assistant M1.3a: private, pure, explicitly configured cell normalization.
// It cannot authorize an import, change evidence, or interpret historical certainty.
const RULE_VERSION='0.1.0';
const MONTHS=Object.freeze({
  janvier:1,fevrier:2,mars:3,avril:4,mai:5,juin:6,
  juillet:7,aout:8,septembre:9,octobre:10,novembre:11,decembre:12
});
const LOCALE='fr';
function fail(code){const error=new Error(code);error.code=code;throw error;}
function plainObject(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function normalizedKey(v){return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function year(y){return Number.isSafeInteger(y)&&y>=1&&y<=9999;}
function leap(y){return y%4===0&&(y%100!==0||y%400===0);}
function monthDays(y,m){return [31,leap(y)?29:28,31,30,31,30,31,31,30,31,30,31][m-1];}
function iso(y,m,d){return String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');}
function quarantine(source,rule,code){
  return Object.freeze({status:'quarantined',source_text:source,
    rule_id:rule.id,rule_version:RULE_VERSION,
    diagnostic:Object.freeze({code,severity:'requires_human_review'})});
}
function success(source,rule,value){
  return Object.freeze({status:'normalized',source_text:source,
    rule_id:rule.id,rule_version:RULE_VERSION,normalized:Object.freeze(value)});
}
function verifyRule(rule){
  if(!plainObject(rule)||typeof rule.id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(rule.id))
    fail('ASSIST_RULE_INVALID');
  if(rule.kind==='date'){
    if(!['DD/MM/YYYY','FR_MONTH_YEAR','CIRCA_YEAR'].includes(rule.format))
      fail('ASSIST_DATE_RULE_INVALID');
    const keys=rule.format==='CIRCA_YEAR'?['id','kind','format','year_radius']:['id','kind','format'];
    if(Object.keys(rule).some(k=>!keys.includes(k)))fail('ASSIST_DATE_RULE_INVALID');
    if(rule.format==='CIRCA_YEAR'&&
      (!Number.isSafeInteger(rule.year_radius)||rule.year_radius<1||rule.year_radius>20))
      fail('ASSIST_DATE_RULE_INVALID');
  }else if(rule.kind==='list'){
    if(Object.keys(rule).some(k=>!['id','kind','list_separator'].includes(k))||
       ![';',',','|'].includes(rule.list_separator))
      fail('ASSIST_LIST_RULE_INVALID');
  }else fail('ASSIST_RULE_INVALID');
}
function temporalValue(first,last,precision,qualifier){
  return {type:'assistant_temporal_bounds',calendar:'gregorian',precision,
    earliest:first,latest:last,qualifier};
}
function normalizeDate(text,rule){
  if(rule.format==='DD/MM/YYYY'){
    const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
    if(!m)return null;
    const d=Number(m[1]),mo=Number(m[2]),y=Number(m[3]);
    if(!year(y)||mo<1||mo>12||d<1||d>monthDays(y,mo))return null;
    return temporalValue(iso(y,mo,d),iso(y,mo,d),'day','exact_as_declared');
  }
  if(rule.format==='FR_MONTH_YEAR'){
    const m=/^([A-Za-zÀ-ÿ]+)\s+(\d{4})$/u.exec(text);
    if(!m)return null;
    const mo=MONTHS[normalizedKey(m[1])],y=Number(m[2]);
    if(!year(y)||!mo)return null;
    return temporalValue(iso(y,mo,1),iso(y,mo,monthDays(y,mo)),'month','month_as_declared');
  }
  // Approximation requires the explicit radius chosen by a human, never guessed.
  const m=/^vers\s+(\d{4})$/iu.exec(text);
  if(!m)return null;
  const y=Number(m[1]),r=rule.year_radius;
  if(!year(y)||!year(y-r)||!year(y+r))return null;
  return temporalValue(iso(y-r,1,1),iso(y+r,12,31),'approximate_year','circa_with_explicit_radius');
}
function normalizeCell(raw,rule){
  verifyRule(rule);
  if(typeof raw!=='string')return quarantine(raw,rule,'ASSIST_CELL_NOT_TEXT');
  if(raw.length>16384)return quarantine(raw,rule,'ASSIST_CELL_LENGTH');
  if(raw.includes('\0'))return quarantine(raw,rule,'ASSIST_CELL_NUL');
  const source=raw,trimmed=raw.trim();
  if(!trimmed)return quarantine(source,rule,'ASSIST_CELL_EMPTY');
  if(rule.kind==='date'){
    const value=normalizeDate(trimmed,rule);
    if(value)return success(source,rule,value);
    if(/^vers\s+\d{4}$/iu.test(trimmed)&&rule.format!=='CIRCA_YEAR')
      return quarantine(source,rule,'ASSIST_APPROXIMATION_REQUIRES_POLICY');
    if(/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)&&rule.format!=='DD/MM/YYYY')
      return quarantine(source,rule,'ASSIST_DATE_ORDER_REQUIRES_POLICY');
    return quarantine(source,rule,'ASSIST_DATE_UNRECOGNIZED');
  }
  // Separator means list syntax *within* a decoded CSV or XLSX cell, not a CSV delimiter.
  const items=source.split(rule.list_separator).map(v=>v.trim());
  if(items.some(x=>!x||x.includes('\r')||x.includes('\n')))
    return quarantine(source,rule,'ASSIST_LIST_AMBIGUOUS');
  return success(source,rule,{type:'string_list',items:Object.freeze(items)});
}
module.exports=Object.freeze({normalizeCell,RULE_VERSION});
