/**
 * ALN Historical Operations Dataset API v1
 * Single Operation by ID
 * GET /api/v1/operations/:id
 */

const {
  getDataset,
  getTerritorialAffiliations,
  buildEnvelope,
  setStandardHeaders
} = require('../data-service');

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
    const id = req.query.id;

    if (!id) {
      return res.status(400).json({
        status: 'error',
        error: 'Bad Request',
        message: 'Le paramètre ID d\'opération est requis.'
      });
    }

    const rawId = String(id).trim().toUpperCase();
    const normalizedTarget = rawId.replace(/^ALN[-_]/i, 'OP_').replace(/-/g, '_');
    const op = dataset.find(item => {
      const curId = (item.id || '').toUpperCase();
      return curId === rawId || curId === normalizedTarget || curId.replace(/-/g, '_') === normalizedTarget;
    });

    if (!op) {
      return res.status(404).json({
        status: 'error',
        error: 'Not Found',
        message: `Aucune opération trouvée avec l'identifiant '${rawId}'.`
      });
    }

    const terr = getTerritorialAffiliations(op);
    const enrichedOp = {
      ...op,
      wilaya_code: terr.primary.code,
      wilaya_label_fr: terr.primary.label_fr,
      wilaya_label_ar: terr.primary.label_ar,
      wilaya_color: terr.primary.color,
      primary_affiliation: terr.primary.code,
      territorial_affiliations: terr.affiliations
    };

    return res.status(200).json(buildEnvelope({
      data: enrichedOp,
      total: 1,
      count: 1,
      query: { id: rawId }
    }));
  } catch (err) {
    console.error('API Single Operation error:', err);
    // ALNOP-009: Sanitize 500 error response
    return res.status(500).json({
      status: 'error',
      error: 'Internal Server Error',
      message: 'Une erreur interne est survenue lors du traitement de la requête.'
    });
  }
};
