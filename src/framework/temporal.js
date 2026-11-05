const {validDay}=require('./profile');
function bounds(raw){
 if(raw===null)return {earliest:null,latest:null,precision:'unknown'};
 if(typeof raw!=='string'||!/^\d{4}(-\d{2}){0,2}$/.test(raw))throw new Error('Unsupported Gregorian date');
 const [year,month,day]=raw.split('-').map(Number);if(year<1||month<1||month>12)throw new Error('Invalid Gregorian date');
 const leap=year%4===0&&(year%100!==0||year%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 if(raw.split('-').length===3&&(!Number.isInteger(day)||day<1||day>days[month-1]))throw new Error('Invalid Gregorian date');
 const y=String(year).padStart(4,'0'),m=String(month||1).padStart(2,'0');
 const earliest=`${y}-${m}-${String(day||1).padStart(2,'0')}`;
 const latest=day?earliest:`${y}-${String(month||12).padStart(2,'0')}-${month?days[month-1]:31}`;
 if(!validDay(earliest)||!validDay(latest))throw new Error('Invalid Gregorian date');
 return {earliest,latest,precision:day?'day':month?'month':'year'};
}
function temporal(raw){const b=bounds(raw);return {kind:{day:'exact',month:'month',year:'year',unknown:'unknown'}[b.precision],calendar:'gregorian',original:raw,...b,certainty:'unknown'};}
function temporalErrors(t){
 const errors=[];if(!t||typeof t!=='object')return ['Temporal expression must be an object'];
 if(t.calendar!=='gregorian')errors.push('Unsupported calendar');
 for(const d of [t.earliest,t.latest])if(d!==null&&!validDay(d))errors.push('Invalid Gregorian day');
 if(errors.length)return errors;
 if(t.earliest&&t.latest&&t.earliest>t.latest)errors.push('Inverted temporal bounds');
 if(t.kind==='unknown'&&(t.earliest!==null||t.latest!==null||t.precision!=='unknown'))errors.push('Unknown date must retain unknown bounds');
 if(t.kind==='before'&&(t.earliest!==null||t.latest===null||t.precision!=='range'))errors.push('Before requires only an upper exclusive bound');
 if(t.kind==='after'&&(t.latest!==null||t.earliest===null||t.precision!=='range'))errors.push('After requires only a lower exclusive bound');
 if(['exact','year','month'].includes(t.kind)){
  const precision={exact:'day',year:'year',month:'month'}[t.kind];
  if(!t.earliest||!t.latest||t.precision!==precision)errors.push('Date kind and precision disagree');
  else {try{const b=bounds(t.earliest.slice(0,{day:10,month:7,year:4}[precision]));if(b.earliest!==t.earliest||b.latest!==t.latest)errors.push('Date bounds disagree with precision');}catch{errors.push('Invalid partial date');}}
 }
 if(t.kind==='interval'&&((!t.earliest&&!t.latest)||t.precision!=='range'))errors.push('Interval requires a known bound and range precision');
 return errors;
}
function temporalRelation(a,b){
 if(temporalErrors(a).length||temporalErrors(b).length)throw new Error('Invalid temporal expression');
 if(a.kind==='unknown'||b.kind==='unknown')return 'indeterminate';
 if(a.latest&&b.earliest&&(a.latest<b.earliest||(a.latest===b.earliest&&(a.kind==='before'||b.kind==='after'))))return 'before';
 if(b.latest&&a.earliest&&(b.latest<a.earliest||(b.latest===a.earliest&&(b.kind==='before'||a.kind==='after'))))return 'after';
 if(a.kind==='exact'&&b.kind==='exact'&&a.earliest===b.earliest)return 'contemporary';
 if(a.earliest&&a.latest&&b.earliest&&b.latest)return 'overlap';
 return 'indeterminate';
}
module.exports={temporal,bounds,temporalErrors,temporalRelation};
