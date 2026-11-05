/**
 * ALN Historical Operations Dataset (1954–1962)
 * Core Data Service for REST API v1
 * Portable module: Node.js / Express / Vercel Serverless
 */

const fs = require('fs');
const path = require('path');

// Wilayas & Autonomous Zones Definitions
const WILAYAS = [
  { id: 'W1', label_fr: 'Wilaya I (Aurès)', label_ar: 'الولاية الأولى (الأوراس - النمامشة)', color: '#c0392b', pattern: /Wilaya I|Zone I|Aurès|Nemencha/i },
  { id: 'W2', label_fr: 'Wilaya II (Nord-Constantinois)', label_ar: 'الولاية الثانية (الشمال القسنطيني)', color: '#2c3e50', pattern: /Wilaya II|Zone II|Nord-Constantinois/i },
  { id: 'W3', label_fr: 'Wilaya III (Kabylie)', label_ar: 'الولاية الثالثة (القبائل)', color: '#27ae60', pattern: /Wilaya III|Zone III|Kabylie/i },
  { id: 'W4', label_fr: 'Wilaya IV (Algérois)', label_ar: 'الولاية الرابعة (الجزائر والوسط)', color: '#16a085', pattern: /Wilaya IV|Zone IV|Algérois|Ouarsenis/i },
  { id: 'ZAA', label_fr: 'Zone Autonome d\'Alger', label_ar: 'المنطقة المستقلة للعاصمة (ZAA)', color: '#e74c3c', pattern: /Zone autonome d'Alger|ZAA/i },
  { id: 'ZAO', label_fr: 'Zone Autonome d\'Oran (ZAO)', label_ar: 'المنطقة المستقلة لوهران (ZAO)', color: '#0ea5e9', pattern: /Zone Autonome d'Oran|ZAO/i },
  { id: 'W5', label_fr: 'Wilaya V (Oranie)', label_ar: 'الولاية الخامسة (الغرب الوهراني)', color: '#2980b9', pattern: /Wilaya V|Zone V|Oranie/i },
  { id: 'W6', label_fr: 'Wilaya VI (Sahara)', label_ar: 'الولاية السادسة (الصحراء)', color: '#f39c12', pattern: /Wilaya VI|Zone VI|Sahara/i },
  { id: 'EMG', label_fr: 'Base de l\'Est & EMG', label_ar: 'قاعدة الشرق وهيئة الأركان (EMG)', color: '#d35400', pattern: /Base de l'Est|Armée des Frontières|EMG/i },
  { id: 'W7', label_fr: '7e Wilaya (Fédération de France)', label_ar: 'الولاية السابعة (فيدرالية جبهة التحرير بفرنسا)', color: '#8e44ad', pattern: /Fédération de France|7e Wilaya|Wilaya VII\b/i }
];

let cachedDataset = null;

/**
 * Safely load and cache the dataset JSON from filesystem
 */
function getDataset() {
  if (cachedDataset) {
    return cachedDataset;
  }

  const candidatePaths = [
    path.join(process.cwd(), 'docs/data/operations_fln_1954_1962.json'),
    path.join(process.cwd(), 'operations_fln_1954_1962.json'),
    path.join(__dirname, '../../docs/data/operations_fln_1954_1962.json'),
    path.join(__dirname, '../../operations_fln_1954_1962.json'),
    path.join(__dirname, '../data/operations_fln_1954_1962.json')
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      try {
        const raw = fs.readFileSync(candidate, 'utf8');
        const parsed = JSON.parse(raw);
        cachedDataset = Array.isArray(parsed) ? parsed : (parsed.operations || []);
        return cachedDataset;
      } catch (err) {
        console.error(`Failed to parse dataset from ${candidate}:`, err.message);
      }
    }
  }

  throw new Error('Dataset file operations_fln_1954_1962.json could not be located on disk.');
}

/**
 * Determine primary Wilaya category and code for an operation
 */
function getOperationCategory(op) {
  if(op.canonical_metadata){
    const territories=op.canonical_metadata.territories||[];
    const primary=territories.find(t=>t.role==='primary');
    if(primary){const def=WILAYAS.find(w=>w.id===primary.territory_id);return {code:primary.territory_id,
      label_fr:primary.names.fr,label_ar:primary.names.ar||primary.names.fr,color:def?.color||'#64748b'};}
    return {code:'OTHER',label_fr:territories.length>1?'Multiterritoriale':'Attribution non déterminée',
      label_ar:territories.length>1?'متعددة الأقاليم':'إسناد غير محدد',color:'#64748b'};
  }
  const w = op.wilaya_concernee || '';
  const r = (op.localisation && op.localisation.region_ou_ville) || '';

  let catId = 'OTHER';

  // 1. 7e Wilaya (Fédération de France) - strictly metropolitan France
  if (/Fédération de France|7e Wilaya|Wilaya VII\b/i.test(w) || (/France métropolitaine/i.test(r) && !/Algérie|Wilaya/i.test(w))) {
    catId = 'W7';
  } else if (/Zone Autonome d'Oran|\bZAO\b/i.test(w)) {
    catId = 'ZAO';
  } else if (/Zone autonome d'Alger|\bZAA\b/i.test(w)) {
    catId = 'ZAA';
  } else if (/^Armée des Frontières|^Base de l'Est/i.test(w)) {
    catId = 'EMG';
  } else if (/Wilaya I\b|Zone I\b|Aurès|Nemencha/i.test(w) && !/Wilaya II|Wilaya III|Wilaya IV|Wilaya V|Wilaya VI/i.test(w)) {
    catId = 'W1';
  } else if (/Wilaya II\b|Zone II\b|Nord-Constantinois|Constantine/i.test(w) && !/Wilaya I\b|Wilaya III\b|Wilaya IV\b|Wilaya V/i.test(w)) {
    catId = 'W2';
  } else if (/Wilaya III\b|Zone III\b|Kabylie/i.test(w) && !/Wilaya I\b|Wilaya II\b|Wilaya IV\b|Wilaya V/i.test(w)) {
    catId = 'W3';
  } else if (/Wilaya IV\b|Zone IV\b|Algérois|Ouarsenis/i.test(w) && !/Wilaya I\b|Wilaya II\b|Wilaya III\b|Wilaya V/i.test(w)) {
    catId = 'W4';
  } else if (/Wilaya V\b|Zone V\b|Oranie/i.test(w) && !/Wilaya I\b|Wilaya II\b|Wilaya III\b|Wilaya VI/i.test(w)) {
    catId = 'W5';
  } else if (/Wilaya VI\b|Zone VI\b|Sahara/i.test(w) && !/Wilaya I\b|Wilaya II\b|Wilaya III\b|Wilaya IV\b|Wilaya V/i.test(w)) {
    catId = 'W6';
  } else if (/Base de l'Est|Armée des Frontières|EMG/i.test(w)) {
    catId = 'EMG';
  } else if (/Wilaya I\b|Zone I\b/i.test(w)) {
    catId = 'W1';
  } else if (/Wilaya II\b|Zone II\b|Constantine/i.test(w)) {
    catId = 'W2';
  } else if (/Wilaya III\b|Zone III\b/i.test(w)) {
    catId = 'W3';
  } else if (/Wilaya IV\b|Zone IV\b/i.test(w)) {
    catId = 'W4';
  } else if (/Wilaya V\b|Zone V\b/i.test(w)) {
    catId = 'W5';
  } else if (/Wilaya VI\b|Zone VI\b/i.test(w)) {
    catId = 'W6';
  }

  const def = WILAYAS.find(item => item.id === catId);
  return {
    code: catId,
    label_fr: def ? def.label_fr : catId,
    label_ar: def ? def.label_ar : catId,
    color: def ? def.color : '#c0392b'
  };
}

/**
 * Determine primary and secondary territorial affiliations for an operation (ALNOP-007)
 * Preserves backward compatibility of primary category while exposing inter-wilaya / joint actions.
 */
function getTerritorialAffiliations(op) {
  const primaryCat = getOperationCategory(op);
  if(op.canonical_metadata)return {primary:primaryCat,affiliations:(op.canonical_metadata.territories||[]).map(t=>({
    code:t.territory_id,label_fr:t.names.fr,label_ar:t.names.ar||t.names.fr,
    color:WILAYAS.find(w=>w.id===t.territory_id)?.color||'#64748b',role:t.role,source_basis:'canonical_review',source_ids:t.source_ids}))};
  const w = op.wilaya_concernee || '';

  const affiliations = [
    {
      code: primaryCat.code,
      label_fr: primaryCat.label_fr,
      label_ar: primaryCat.label_ar,
      color: primaryCat.color,
      role: 'primary',
      source_basis: 'wilaya_concernee_primary'
    }
  ];

  // Detect secondary cross-wilaya / joint actions without altering primary attribution
  WILAYAS.forEach(wilaya => {
    if (wilaya.id !== primaryCat.code) {
      if (wilaya.pattern && wilaya.pattern.test(w)) {
        affiliations.push({
          code: wilaya.id,
          label_fr: wilaya.label_fr,
          label_ar: wilaya.label_ar,
          color: wilaya.color,
          role: 'joint_or_adjacent',
          source_basis: 'explicit_mention_in_wilaya_concernee'
        });
      }
    }
  });

  return {
    primary: primaryCat,
    affiliations
  };
}

/**
 * Text normalization helper (Unicode accents and Arabic diacritics stripping)
 * Handles Tashkeel, Tatweel, Alef variants, Ta Marbuta, Ya/Alef Maksura and Latin accents
 */
function normalizeString(str) {
  if (!str) return '';
  return String(str)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[إأآا\u0671]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[يى]/g, 'ي')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Filter dataset by arbitrary query parameters
 */
function filterOperations(ops, query = {}) {
  let filtered = [...ops];

  // 1. Filter by ID (exact or flexible match: OP_1954_001, OP-1954-001, ALN-1954-001)
  if (query.id) {
    const rawId = String(query.id).trim().toUpperCase();
    const normalizedTarget = rawId.replace(/^ALN[-_]/i, 'OP_').replace(/-/g, '_');
    filtered = filtered.filter(op => {
      const curId = (op.id || '').toUpperCase();
      return curId === rawId || curId === normalizedTarget || curId.replace(/-/g, '_') === normalizedTarget;
    });
    return filtered;
  }

  // 2. Filter by Wilaya (supports code like W1, W2 or label string, or comma-separated: W1,W3)
  if (query.wilaya) {
    const wilayaTokens = String(query.wilaya).split(',').map(w => w.trim().toUpperCase());
    filtered = filtered.filter(op => {
      const cat = getOperationCategory(op);
      return wilayaTokens.includes(cat.code) || wilayaTokens.some(tok => normalizeString(op.wilaya_concernee).includes(normalizeString(tok)));
    });
  }

  // 3. Filter by Year (e.g. 1954, 1955, etc. or comma-separated)
  if (query.year && query.year !== 'all') {
    const years = String(query.year).split(',').map(y => y.trim());
    filtered = filtered.filter(op => {
      const opYear = (op.date_debut || '').substring(0, 4);
      return years.includes(opYear);
    });
  }

  // 4. Date ranges (date_from, date_to)
  if (query.date_from) {
    filtered = filtered.filter(op => (op.date_debut || '') >= query.date_from);
  }
  if (query.date_to) {
    filtered = filtered.filter(op => (op.date_debut || '') <= query.date_to);
  }

  // 5. Filter by Action Type
  if (query.type && query.type !== 'all') {
    const normType = normalizeString(query.type);
    filtered = filtered.filter(op => normalizeString(op.type_action).includes(normType));
  }

  // 6. Full-text search (q or search)
  const searchTerm = query.q || query.search;
  if (searchTerm) {
    const normSearch = normalizeString(searchTerm);
    filtered = filtered.filter(op => {
      const matchName = normalizeString(op.nom_operation).includes(normSearch);
      const matchDesc = normalizeString(op.description).includes(normSearch);
      const matchLieu = normalizeString(op.localisation && op.localisation.region_ou_ville).includes(normSearch);
      const matchImpact = normalizeString(op.impact_strategique).includes(normSearch);
      const matchId = normalizeString(op.id).includes(normSearch);
      const matchCmd = Array.isArray(op.commandement_aln) && op.commandement_aln.some(c => normalizeString(c).includes(normSearch));
      const matchWilaya = normalizeString(op.wilaya_concernee).includes(normSearch);
      const matchSources = Array.isArray(op.sources) && op.sources.some(s => normalizeString(s.titre).includes(normSearch) || normalizeString(s.auteur).includes(normSearch));
      return matchName || matchDesc || matchLieu || matchImpact || matchId || matchCmd || matchWilaya || matchSources;
    });
  }

  // 7. Sort (ALNOP-014: deterministic sort with canonical ID tie-breaker)
  const sort = query.sort || 'date_asc';
  filtered.sort((a, b) => {
    const dateA = a.date_debut || '';
    const dateB = b.date_debut || '';
    const dateCmp = sort === 'date_desc' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
    if (dateCmp !== 0) return dateCmp;
    // Tie-breaker: unique ID ensures stable pagination without shifts or duplicates
    const idA = a.id || '';
    const idB = b.id || '';
    return idA.localeCompare(idB);
  });

  return filtered;
}

/**
 * Convert operations to standard GeoJSON FeatureCollection
 */
function toGeoJSON(operations) {
  const features = operations.map(op => {
    const coords = (op.localisation && op.localisation.coordonnees_approximatives) || {};
    const terr = getTerritorialAffiliations(op);

    const hasCoords = coords.latitude != null && coords.longitude != null;
    const geometry = hasCoords
      ? {
          type: 'Point',
          coordinates: [coords.longitude, coords.latitude]
        }
      : null;

    return {
      type: 'Feature',
      id: op.id,
      geometry,
      properties: {
        id: op.id,
        nom_operation: op.nom_operation,
        date_debut: op.date_debut,
        date_fin: op.date_fin,
        wilaya_concernee: op.wilaya_concernee,
        wilaya_code: terr.primary.code,
        wilaya_label_fr: terr.primary.label_fr,
        wilaya_label_ar: terr.primary.label_ar,
        wilaya_color: terr.primary.color,
        primary_affiliation: terr.primary.code,
        territorial_affiliations: terr.affiliations,
        type_action: op.type_action,
        region_ou_ville: (op.localisation && op.localisation.region_ou_ville) || '',
        description: op.description,
        impact_strategique: op.impact_strategique,
        commandement_aln: op.commandement_aln || [],
        bilan_et_pertes: op.bilan_et_pertes || {},
        sources: op.sources || []
      }
    };
  });

  return {
    type: 'FeatureCollection',
    properties: {
      generated_at: new Date().toISOString(),
      dataset_version: '1.0.0',
      total_features: features.length,
      license: 'https://creativecommons.org/licenses/by/4.0/',
      attribution: 'Ghemri M. (ALN Historical Operations Dataset)',
      documentation: 'https://alnop.vercel.app/api/docs',
      pagination: {
        paginated: false,
        note: 'GeoJSON format exports all matching features without pagination for GIS cartographic mapping.'
      }
    },
    features
  };
}

/**
 * Compute aggregate statistics over a set of operations (ALNOP-008)
 */
function computeStats(operations) {
  const total = operations.length;
  const byYear = {};
  const byWilaya = {};
  const byActionType = {};

  // Initialize years 1954..1962
  for (let y = 1954; y <= 1962; y++) {
    byYear[String(y)] = 0;
  }

  // Initialize wilayas
  WILAYAS.forEach(w => {
    byWilaya[w.id] = {
      code: w.id,
      label_fr: w.label_fr,
      label_ar: w.label_ar,
      color: w.color,
      count: 0
    };
  });

  operations.forEach(op => {
    // Year
    const y = (op.date_debut || '').substring(0, 4);
    if (byYear[y] !== undefined) {
      byYear[y]++;
    } else if(op.canonical_metadata) {
      byYear.unknown=(byYear.unknown||0)+1;
    }

    // Wilaya (counts based on primary category)
    const cat = getOperationCategory(op);
    if (byWilaya[cat.code]) {
      byWilaya[cat.code].count++;
    }else if(op.canonical_metadata){
      byWilaya[cat.code]={code:cat.code,label_fr:cat.label_fr,label_ar:cat.label_ar,color:cat.color,count:1};
    }

    // Action type
    const act = (op.type_action || 'Non qualifié').trim();
    byActionType[act] = (byActionType[act] || 0) + 1;
  });

  const sortedActions = Object.entries(byActionType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));

  return {
    total_operations: total,
    dataset_version: '1.0.0',
    dataset_scope: `Corpus de recherche historique documenté (${total} opérations)`,
    coverage_note: `Statistiques établies sur le corpus de recherche documenté (${total} opérations historiques). Ce jeu de données ne constitue pas un recensement exhaustif de l'ensemble des actions de la Guerre de Libération nationale.`,
    by_year: byYear,
    by_wilaya: byWilaya,
    top_action_types: sortedActions
  };
}

/**
 * Standard HTTP response envelope with metadata and attribution (ALNOP-008)
 */
function buildEnvelope({ data, total, count, page, limit, query = {} }) {
  const meta = {
    api_version: 'v1',
    dataset_version: '1.0.0',
    status: 'success',
    total: total !== undefined ? total : (Array.isArray(data) ? data.length : 1),
    count: count !== undefined ? count : (Array.isArray(data) ? data.length : 1),
    coverage_note: "Corpus de recherche historique documenté (1954–1962). Non exhaustif.",
    license: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Ghemri M. (ALN Historical Operations Dataset)',
    documentation: 'https://alnop.vercel.app/api/docs',
    timestamp: new Date().toISOString()
  };

  if (page !== undefined && limit !== undefined) {
    meta.page = Number(page);
    meta.limit = Number(limit);
    meta.total_pages = Math.ceil(meta.total / meta.limit) || 1;
  }

  if (Object.keys(query).length > 0) {
    meta.applied_filters = query;
  }

  return {
    meta,
    data
  };
}

/**
 * Set universal CORS and Edge CDN Cache headers
 */
function setStandardHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

module.exports = {
  WILAYAS,
  getDataset,
  getOperationCategory,
  getTerritorialAffiliations,
  normalizeString,
  filterOperations,
  toGeoJSON,
  computeStats,
  buildEnvelope,
  setStandardHeaders
};
