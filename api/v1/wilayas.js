/**
 * ALN Historical Operations Dataset API v1
 * Historical Wilayas & Autonomous Zones Reference Directory
 * GET /api/v1/wilayas
 */

const {
  WILAYAS,
  getDataset,
  getOperationCategory,
  buildEnvelope,
  setStandardHeaders
} = require('./data-service');

module.exports = (req, res) => {
  setStandardHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      status: 'error',
      error: 'Method Not Allowed',
      message: 'Seules les requêtes GET sont supportées sur cette ressource.'
    });
  }

  try {
    const dataset = getDataset();

    // Calculate live counts per wilaya
    const counts = {};
    WILAYAS.forEach(w => { counts[w.id] = 0; });
    dataset.forEach(op => {
      const cat = getOperationCategory(op);
      if (counts[cat.code] !== undefined) {
        counts[cat.code]++;
      }
    });

    const wilayasList = WILAYAS.map(w => ({
      code: w.id,
      label_fr: w.label_fr,
      label_ar: w.label_ar,
      color: w.color,
      operations_count: counts[w.id] || 0
    }));

    return res.status(200).json(buildEnvelope({
      data: wilayasList,
      total: wilayasList.length,
      count: wilayasList.length
    }));
  } catch (err) {
    console.error('API Wilayas error:', err);
    // ALNOP-009: Sanitize 500 error response
    return res.status(500).json({
      status: 'error',
      error: 'Internal Server Error',
      message: 'Une erreur interne est survenue lors du traitement de la requête.'
    });
  }
};
