/**
 * ALN Historical Operations Dataset API v1
 * Query Parameters Validation & Sanitization (ALNOP-005, ALNOP-006)
 */

/**
 * Validate query parameters for operations & stats endpoints
 * @param {Object} query - Incoming req.query object
 * @returns {{ valid: boolean, status?: number, error?: string, message?: string }}
 */
function validateOperationsQuery(query = {}) {
  // 1. Validate 'limit' (ALNOP-005)
  if (query.limit !== undefined && query.limit !== '') {
    const rawLimit = String(query.limit).trim();
    if (!/^\d+$/.test(rawLimit)) {
      return {
        valid: false,
        status: 400,
        error: 'Bad Request',
        message: "Le paramètre 'limit' doit être un nombre entier positif compris entre 1 et 300."
      };
    }
    const numLimit = parseInt(rawLimit, 10);
    if (numLimit < 1 || numLimit > 300) {
      return {
        valid: false,
        status: 400,
        error: 'Bad Request',
        message: "Le paramètre 'limit' doit être compris entre 1 et 300."
      };
    }
  }

  // 2. Validate 'page' (ALNOP-005)
  if (query.page !== undefined && query.page !== '') {
    const rawPage = String(query.page).trim();
    if (!/^\d+$/.test(rawPage)) {
      return {
        valid: false,
        status: 400,
        error: 'Bad Request',
        message: "Le paramètre 'page' doit être un nombre entier strictement positif (>= 1)."
      };
    }
    const numPage = parseInt(rawPage, 10);
    if (numPage < 1) {
      return {
        valid: false,
        status: 400,
        error: 'Bad Request',
        message: "Le paramètre 'page' doit être supérieur ou égal à 1."
      };
    }
  }

  // 3. Validate 'year' (ALNOP-006)
  if (query.year !== undefined && query.year !== '' && query.year !== 'all') {
    const rawYears = String(query.year).split(',').map(y => y.trim());
    for (const y of rawYears) {
      if (!/^\d{4}$/.test(y)) {
        return {
          valid: false,
          status: 400,
          error: 'Bad Request',
          message: `Le paramètre 'year' contient une valeur d'année invalide ('${y}'). Format attendu : 4 chiffres (ex: 1954) ou années séparées par des virgules.`
        };
      }
    }
  }

  // 4. Validate 'date_from' & 'date_to' syntax (ALNOP-006)
  const dateRegex = /^\d{4}(-\d{2}(-\d{2})?)?$/;
  if (query.date_from !== undefined && query.date_from !== '') {
    const dFrom = String(query.date_from).trim();
    if (!dateRegex.test(dFrom)) {
      return {
        valid: false,
        status: 400,
        error: 'Bad Request',
        message: `Le paramètre 'date_from' ('${dFrom}') doit respecter le format YYYY, YYYY-MM ou YYYY-MM-DD.`
      };
    }
  }
  if (query.date_to !== undefined && query.date_to !== '') {
    const dTo = String(query.date_to).trim();
    if (!dateRegex.test(dTo)) {
      return {
        valid: false,
        status: 400,
        error: 'Bad Request',
        message: `Le paramètre 'date_to' ('${dTo}') doit respecter le format YYYY, YYYY-MM ou YYYY-MM-DD.`
      };
    }
  }

  // 5. Inverted chronological range check (ALNOP-006)
  if (query.date_from && query.date_to) {
    const dFrom = String(query.date_from).trim();
    const dTo = String(query.date_to).trim();
    if (dFrom > dTo) {
      return {
        valid: false,
        status: 400,
        error: 'Bad Request',
        message: "Incohérence chronologique : la date de début 'date_from' ne peut pas être postérieure à la date de fin 'date_to'."
      };
    }
  }

  // 6. Validate 'sort' (ALNOP-006)
  if (query.sort !== undefined && query.sort !== '') {
    const rawSort = String(query.sort).trim().toLowerCase();
    if (rawSort !== 'date_asc' && rawSort !== 'date_desc') {
      return {
        valid: false,
        status: 400,
        error: 'Bad Request',
        message: `Le paramètre 'sort' ('${query.sort}') est invalide. Valeurs autorisées : 'date_asc' ou 'date_desc'.`
      };
    }
  }

  // 7. Validate 'format' (ALNOP-004)
  if (query.format !== undefined && query.format !== '') {
    const rawFormat = String(query.format).trim().toLowerCase();
    if (rawFormat !== 'json' && rawFormat !== 'geojson') {
      return {
        valid: false,
        status: 400,
        error: 'Bad Request',
        message: `Le format '${query.format}' n'est pas supporté. Formats acceptés : 'json' ou 'geojson'.`
      };
    }
  }

  return { valid: true };
}

module.exports = {
  validateOperationsQuery
};
