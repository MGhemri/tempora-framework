// Public legacy paths are now projections of the reviewed canonical corpus.
const {run}=require('./build-canonical');
function syncDataset(){run(false);}
if(require.main===module)syncDataset();
module.exports={syncDataset};
