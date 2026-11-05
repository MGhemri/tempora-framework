/**
 * ALN Historical Operations Dataset API v1
 * Root Information & Service Index
 * GET /api/v1
 */

const { getDataset, buildEnvelope, setStandardHeaders } = require('./data-service');

module.exports = (req, res) => {
  setStandardHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      status: 'error',
      error: 'Method Not Allowed',
      message: 'Seules les requêtes GET sont supportées sur cette API.'
    });
  }

  try {
    const dataset = getDataset();
    const serviceInfo = {
      title: "API des Opérations Militaires de l'ALN (1954–1962)",
      title_ar: "واجهة برمجة تطبيقات العمليات العسكرية لجيش التحرير الوطني (1954–1962)",
      version: "v1.0.0",
      description: "API REST publique fournissant un accès programmatique aux 263 opérations militaires documentées de la Guerre de Libération Nationale algérienne.",
      total_operations: dataset.length,
      license: "Creative Commons Attribution 4.0 International (CC BY 4.0)",
      attribution: "Ghemri M. (ALN Historical Operations Dataset)",
      documentation: "https://github.com/MGhemri/aln-historical-operations-dataset/blob/main/API.md",
      endpoints: {
        operations: {
          path: "/api/v1/operations",
          description: "Recherche et filtrage multi-critères des opérations (wilaya, annee, type, texte, pagination, GeoJSON).",
          methods: ["GET"],
          examples: [
            "/api/v1/operations?year=1956",
            "/api/v1/operations?wilaya=W1",
            "/api/v1/operations?q=souika",
            "/api/v1/operations?format=geojson"
          ]
        },
        operation_by_id: {
          path: "/api/v1/operations/:id",
          description: "Récupération d'une opération par son identifiant unique (ex: ALN-1956-0042).",
          methods: ["GET"],
          example: "/api/v1/operations/ALN-1956-0042"
        },
        stats: {
          path: "/api/v1/stats",
          description: "Métriques agrégées (répartition par wilaya, chronologie annuelle, typologies).",
          methods: ["GET"],
          example: "/api/v1/stats"
        },
        wilayas: {
          path: "/api/v1/wilayas",
          description: "Référentiel des 10 Wilayas et Zones Autonomes historiques (codes, libellés FR/AR, couleurs).",
          methods: ["GET"],
          example: "/api/v1/wilayas"
        }
      }
    };

    return res.status(200).json(buildEnvelope({ data: serviceInfo, total: dataset.length, count: 1 }));
  } catch (err) {
    console.error('API Index error:', err);
    return res.status(500).json({
      status: 'error',
      error: 'Internal Server Error',
      message: err.message
    });
  }
};
