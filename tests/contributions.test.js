const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHandler}=require('../api/contributions');
const {mailConfig}=require('../src/server/mail');
function payload(overrides={}){return {kind:'correction',title:'Correction synthétique',operation:'OP_1954_001',
  description:'Exemple fictif de validation',citation:'Référence de test p. 12',consent:true,
  submissionId:'00000000-0000-4000-8000-000000000001',...overrides};}
function response(){return {headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},
  status(c){this.statusCode=c;return this;},json(b){this.body=b;return this;},end(){return this;}};}
function request(body=payload(),overrides={}){return {method:'POST',headers:{origin:'https://alnop.vercel.app','content-type':'application/json','x-forwarded-for':'127.0.0.1'},body,...overrides};}
function setup(sendMail=async()=>({accepted:['maintainer@example.org']})){
  const sent=[];
  const handler=createHandler({mailer:()=>({config:{user:'sender@example.org',to:'maintainer@example.org'},
    transporter:{sendMail:async mail=>{sent.push(mail);return sendMail(mail);}}})});
  return {handler,sent};
}
test('SMTP proposal: fixed recipient, no required identity, reference and complete attachment',async()=>{
  const {handler,sent}=setup();const res=response();await handler(request(payload({to:'attacker@example.org'})),res);
  assert.equal(res.statusCode,200);assert.equal(res.body.status,'sent_for_review');assert.match(res.body.reference,/^ALNOP-/);
  assert.equal(sent[0].to,'maintainer@example.org');assert.equal(sent[0].replyTo,undefined);
  assert.match(sent[0].attachments[0].content,/OP_1954_001/);assert.match(sent[0].text,/revue humaine/);
  const proposal=JSON.parse(sent[0].attachments[1].content);
  assert.equal(proposal.kind,'correction');assert.equal(proposal.to,undefined);assert.equal(proposal.replyTo,undefined);
});
test('SMTP failure or rejected recipients never produce success',async()=>{
  for(const sendMail of [async()=>{throw Error('private SMTP error');},async()=>({accepted:[]})]){
    const {handler}=setup(sendMail);const res=response();await handler(request(),res);
    assert.equal(res.statusCode,503);assert.equal(res.body.success,false);assert.doesNotMatch(JSON.stringify(res.body),/private/);
  }
  const handler=createHandler({mailer:()=>{throw Error('missing secret');}});const res=response();await handler(request(),res);assert.equal(res.statusCode,503);
});
test('Concurrent identical requests send once, only after SMTP acceptance',async()=>{
  let release;const {handler,sent}=setup(()=>new Promise(resolve=>release=resolve));
  const first=response(),second=response();const a=handler(request(),first),b=handler(request(),second);
  assert.equal(first.body,undefined);assert.equal(second.body,undefined);assert.equal(sent.length,1);
  release({accepted:['maintainer@example.org']});await Promise.all([a,b]);assert.deepEqual(first.body,second.body);
  const changed=response();await handler(request(payload({title:'Changed'})),changed);assert.equal(changed.statusCode,409);
});
test('Each proposal type enforces its own IDs, sources, consent and size rules',async()=>{
  const cases=[{operation:'OP_2099_999'},{consent:false},{replyTo:'a@example.org\r\nBcc:x@example.org'},
    {website:'spam'},{kind:'duplicate',secondOperation:'OP_1954_001'},
    {kind:'new-source',citation:'',missing:'No source'},
    {kind:'new-operation'}, {title:'Header\r\ninjection'}, {description:'x'.repeat(6001)},
    {submissionId:'invalid'}, {kind:'place-name',placeName:''}];
  for(const invalid of cases){const {handler,sent}=setup();const res=response();await handler(request(payload(invalid)),res);assert.equal(res.statusCode,400,JSON.stringify(invalid).slice(0,100));assert.equal(sent.length,0);}
  for(const kind of ['new-operation','correction','new-source','duplicate','historical-dispute','place-name']){
    const {handler}=setup();const res=response();await handler(request(payload({kind,
      operation:kind==='new-operation'?'':'OP_1954_001',
      ...(kind==='duplicate'?{secondOperation:'OP_1954_003'}:{}),...(kind==='place-name'?{placeName:'Lieu fictif'}:{})})),res);
    assert.equal(res.statusCode,200,kind);
  }
});
test('Method, CORS, JSON type and per-instance rate limit',async()=>{
  const {handler}=setup();
  for(const [req,status]of [[request(undefined,{method:'GET'}),405],
    [request(undefined,{method:'OPTIONS'}),204],
    [request(undefined,{headers:{origin:'https://unrelated.example','content-type':'application/json'}}),403],
    [request(undefined,{headers:{'content-type':'text/plain'}}),415]]){
    const res=response();await handler(req,res);assert.equal(res.statusCode,status);
  }
  for(let i=0;i<6;i++){
    const res=response();await handler(request(payload({submissionId:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`})),res);
    assert.equal(res.statusCode,i===5?429:200);
  }
});
test('Mail configuration requires a server secret and validates TLS and ports',()=>{
  assert.throws(()=>mailConfig({}),/CONFIGURATION/);
  assert.throws(()=>mailConfig({SMTP_PASS:'test',SMTP_PORT:'invalid'}));
  assert.equal(mailConfig({SMTP_PASS:'test'}).transport.tls.rejectUnauthorized,true);
  assert.equal(mailConfig({SMTP_PASS:'test',SMTP_PORT:'587'}).transport.requireTLS,true);
});
