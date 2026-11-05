/**
 * ALN Historical Operations Dataset API v1
 * Aggregate Statistics
 * GET /api/v1/stats
 */

const {
  getDataset,
  filterOperations,
  computeStats,
  buildEnvelope,
  setStandardHeaders
} = require('./data-service');
const { validateOperationsQuery } = require('./validator');

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
    const query = req.query || {};

    // Validate query parameters strictly if provided (ALNOP-005, ALNOP-006)
    if (Object.keys(query).length > 0) {
      const validation = validateOperationsQuery(query);
      if (!validation.valid) {
        return res.status(validation.status).json({
          status: 'error',
          error: validation.error,
          message: validation.message
        });
      }
    }

    // Filter if query params specified (e.g., stats only for a given wilaya or year)
    const operations = Object.keys(query).length > 0 ? filterOperations(dataset, query) : dataset;
    const stats = computeStats(operations);

    return res.status(200).json(buildEnvelope({
      data: stats,
      total: operations.length,
      count: 1,
      query
    }));
  } catch (err) {
    console.error('API Stats error:', err);
    // ALNOP-009: Sanitize 500 error response
    return res.status(500).json({
      status: 'error',
      error: 'Internal Server Error',
      message: 'Une erreur interne est survenue lors du traitement de la requête.'
    });
  }
};
