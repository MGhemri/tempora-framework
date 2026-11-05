/**
 * ALN Historical Operations Dataset API v1
 * Operations Collection & Filtering
 * GET /api/v1/operations
 */

const {
  getDataset,
  filterOperations,
  toGeoJSON,
  getTerritorialAffiliations,
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

    // Validate query parameters strictly (ALNOP-005, ALNOP-006)
    const validation = validateOperationsQuery(query);
    if (!validation.valid) {
      return res.status(validation.status).json({
        status: 'error',
        error: validation.error,
        message: validation.message
      });
    }

    // 1. Single operation query via ?id=OP_...
    if (query.id) {
      const rawId = String(query.id).trim().toUpperCase();
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

      // Enrich with Wilaya metadata & territorial affiliations (ALNOP-007)
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
    }

    // 2. Filter dataset based on query
    const filtered = filterOperations(dataset, query);

    // 3. GeoJSON Format requested (?format=geojson)
    // Note (ALNOP-004): GeoJSON format returns all filtered features without pagination for GIS cartographic mapping.
    if (String(query.format).toLowerCase() === 'geojson') {
      res.setHeader('Content-Type', 'application/geo+json; charset=utf-8');
      const geojson = toGeoJSON(filtered);
      return res.status(200).json(geojson);
    }

    // 4. Standard JSON with pagination
    const totalMatching = filtered.length;
    let limit = query.limit !== undefined && query.limit !== '' ? parseInt(query.limit, 10) : 50;
    if (isNaN(limit) || limit <= 0) limit = 50;
    if (limit > 300) limit = 300;

    let page = query.page !== undefined && query.page !== '' ? parseInt(query.page, 10) : 1;
    if (isNaN(page) || page <= 0) page = 1;

    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    // Enrich each operation with category tags & multi-affiliations (ALNOP-007)
    const enrichedPaginated = paginated.map(op => {
      const terr = getTerritorialAffiliations(op);
      return {
        ...op,
        wilaya_code: terr.primary.code,
        wilaya_label_fr: terr.primary.label_fr,
        wilaya_label_ar: terr.primary.label_ar,
        wilaya_color: terr.primary.color,
        primary_affiliation: terr.primary.code,
        territorial_affiliations: terr.affiliations
      };
    });

    const cleanQuery = { ...query };
    delete cleanQuery.limit;
    delete cleanQuery.page;

    return res.status(200).json(buildEnvelope({
      data: enrichedPaginated,
      total: totalMatching,
      count: enrichedPaginated.length,
      page,
      limit,
      query: cleanQuery
    }));
  } catch (err) {
    console.error('API Operations error:', err);
    // ALNOP-009: Sanitize 500 error response to prevent leaking internal error details
    return res.status(500).json({
      status: 'error',
      error: 'Internal Server Error',
      message: 'Une erreur interne est survenue lors du traitement de la requête.'
    });
  }
};
