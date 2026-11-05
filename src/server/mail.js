const nodemailer=require('nodemailer');
function mailConfig(env=process.env){
  const host=env.SMTP_HOST || 'mail.connect-gm.com';
  const port=Number(env.SMTP_PORT || 465);
  const user=env.SMTP_USER || 'dataset@connect-gm.com';
  if(!env.SMTP_PASS || !Number.isInteger(port) || port<1 || port>65535 || /[\r\n]/.test(host+user))
    throw new Error('SMTP_CONFIGURATION_MISSING');
  return {user,to:env.CONTRIBUTION_DEST || env.CONTACT_DEST || 'dataset@connect-gm.com, contact@connect-gm.com',
    transport:{host,port,secure:port===465,auth:{user,pass:env.SMTP_PASS},requireTLS:port!==465,
      connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000,tls:{rejectUnauthorized:true}}};
}
function createMailer(env=process.env){
  const config=mailConfig(env);
  return {config,transporter:nodemailer.createTransport(config.transport)};
}
module.exports={mailConfig,createMailer};
