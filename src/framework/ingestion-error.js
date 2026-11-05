class IngestionError extends Error {
 constructor(code,message,details=[]){super(message);this.name='IngestionError';this.code=code;this.details=details;}
}
const fail=(code,message,details)=>{throw new IngestionError(code,message,details);};
module.exports={IngestionError,fail};
