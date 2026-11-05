const {createHash}=require('node:crypto');
const {createMailer}=require('../src/server/mail');
const corpus=require('../docs/data/operations_fln_1954_1962.json');
const ids=new Set(corpus.operations.map(op=>op.id));
const kinds=new Set(['new-operation','correction','new-source','duplicate','historical-dispute','place-name']);
function validate(body){
  if(!body || typeof body!=='object' || Array.isArray(body))return 'INVALID_BODY';
  if(Buffer.byteLength(JSON.stringify(body))>32000)return 'TOO_LARGE';
  for(const [key,max] of Object.entries({title:160,description:6000,citation:3000,missing:1500,
    eventDate:100,eventPlace:300,placeName:300,replyTo:254,operation:80,secondOperation:80})){
    if(body[key]!==undefined && (typeof body[key]!=='string'||body[key].length>max))return 'INVALID_FIELD';
  }
  if(!kinds.has(body.kind)||!body.title?.trim()||!body.description?.trim()||body.consent!==true)return 'REQUIRED_FIELD';
  if(body.locale!==undefined&&!['fr','ar'].includes(body.locale))return 'INVALID_LANGUAGE';
  if(/[\r\n]/.test(body.title))return 'INVALID_TITLE';
  if(!body.citation?.trim()&&!body.missing?.trim())return 'SOURCE_REQUIRED';
  if(body.kind==='new-source'&&!body.citation?.trim())return 'SOURCE_REQUIRED';
  if(['correction','new-source','duplicate','historical-dispute'].includes(body.kind)&&!ids.has(body.operation))return 'INVALID_OPERATION';
  if(body.kind==='place-name' && (!body.placeName?.trim() || (body.operation&&!ids.has(body.operation))))return 'INVALID_PLACE';
  if(body.kind==='duplicate'&&(!ids.has(body.secondOperation)||body.operation===body.secondOperation))return 'INVALID_DUPLICATE';
  if(body.kind==='new-operation'&&(body.operation||body.secondOperation))return 'NEW_OPERATION_HAS_ID';
  if(body.kind!=='duplicate'&&body.secondOperation)return 'UNEXPECTED_SECOND_OPERATION';
  if(body.replyTo && !/^[^\s<>(),;:@]+(?:\.[^\s<>(),;:@]+)*@[^\s<>(),;:@]+\.[^\s<>(),;:@]+$/.test(body.replyTo))return 'INVALID_EMAIL';
  if(typeof body.submissionId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.submissionId))return 'INVALID_SUBMISSION_ID';
  if(body.website)return 'SPAM';
  return null;
}
function message(body,reference){
  const fields=[['Type',body.kind],['Titre',body.title],['Fiche',body.operation],['Deuxième fiche',body.secondOperation],
    ['Date/période',body.eventDate],['Lieu',body.eventPlace],['Toponyme',body.placeName],
    ['Description',body.description],['Sources',body.citation],['Absence de source',body.missing]];
  return `Proposition ALNOP — ${reference}\nStatut : proposée, revue humaine requise. Aucune publication automatique.\n\n`+
    fields.filter(([,v])=>v).map(([label,value])=>`${label}\n${value}`).join('\n\n')+'\n';
}
function createHandler({mailer=createMailer,now=Date.now}={}){
  const attempts=new Map(),submissions=new Map();
  return async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
    res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
    const origin=req.headers?.origin;
    const allowed=new Set(['https://alnop.vercel.app','https://mghemri.github.io',
      ...(process.env.VERCEL_URL?['https://'+process.env.VERCEL_URL]:[])]);
    if(origin && !allowed.has(origin) && !(process.env.NODE_ENV!=='production'&&/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)))
      return res.status(403).json({success:false,error:{code:'ORIGIN_DENIED'}});
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    if(req.method==='OPTIONS')return res.status(204).end();
    if(req.method!=='POST')return res.status(405).json({success:false,error:{code:'METHOD_NOT_ALLOWED'}});
    if(!/^application\/json(?:;|$)/i.test(req.headers?.['content-type']||''))return res.status(415).json({success:false,error:{code:'JSON_REQUIRED'}});
    const invalid=validate(req.body);
    if(invalid)return res.status(invalid==='TOO_LARGE'?413:400).json({success:false,error:{code:invalid}});
    const time=now();
    for(const [key,value]of submissions)if(time-value.created>600000)submissions.delete(key);
    const body=req.body;
    const digest=createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const existing=submissions.get(body.submissionId);
    if(existing){
      if(existing.digest!==digest)return res.status(409).json({success:false,error:{code:'SUBMISSION_CHANGED'}});
      const result=await existing.promise;return res.status(result.status).json(result.body);
    }
    const ip=String(req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
    for(const [key,times]of attempts)if(times.every(t=>time-t>=600000))attempts.delete(key);
    const recent=(attempts.get(ip)||[]).filter(t=>time-t<600000);
    if(recent.length>=5 || submissions.size>=1000 || attempts.size>=5000){res.setHeader('Retry-After','600');return res.status(429).json({success:false,error:{code:'RATE_LIMITED'}});}
    attempts.set(ip,[...recent,time]);
    const reference='ALNOP-'+body.submissionId;
    const promise=(async()=>{
      try{
        const {config,transporter}=mailer();
        const text=message(body,reference);
        const proposal=Object.fromEntries(['kind','title','description','citation','missing','operation','secondOperation','eventDate','eventPlace','placeName','locale','submissionId']
          .filter(key=>body[key]!==undefined).map(key=>[key,body[key]]));
        const receipt=await transporter.sendMail({from:{name:'ALNOP Contributions',address:config.user},to:config.to,
          ...(body.replyTo?{replyTo:body.replyTo}:{}),subject:`[ALNOP Contribution] ${body.kind} — ${body.title}`,
          messageId:`<${body.submissionId}@connect-gm.com>`,text,
          attachments:[{filename:'alnop-proposition.md',content:text,contentType:'text/markdown; charset=utf-8'},
            {filename:'alnop-proposition.json',content:JSON.stringify(proposal,null,2)+'\n',contentType:'application/json; charset=utf-8'}]});
        if(!receipt.accepted?.length)throw new Error('SMTP_REJECTED');
        return {status:200,body:{success:true,reference,status:'sent_for_review'}};
      }catch{
        return {status:503,body:{success:false,error:{code:'DELIVERY_UNAVAILABLE'}}};
      }
    })();
    submissions.set(body.submissionId,{digest,created:time,promise});
    const result=await promise;
    if(result.status!==200)submissions.delete(body.submissionId);
    return res.status(result.status).json(result.body);
  };
}
module.exports=createHandler();module.exports.createHandler=createHandler;module.exports.validate=validate;
