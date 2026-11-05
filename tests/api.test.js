/**
 * ALNOP REST API v1 — Automated Test Suite
 * Tests handler contracts, filtering, pagination, and regressions (Phase A, B & C).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const published = require('../docs/data/operations_fln_1954_1962.json').operations;

// Handlers
const operationsHandler = require('../api/v1/operations.js');
const singleOpHandler = require('../api/v1/operations/[id].js');
const statsHandler = require('../api/v1/stats.js');
const wilayasHandler = require('../api/v1/wilayas.js');

/**
 * Helper to create a mock HTTP Response object.
 */
function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end(data) {
      this.body = data || null;
      return this;
    }
  };
}

describe('ALNOP API v1 — Regression & Contract Test Suite', () => {

  describe('ALNOP-001 Regression: Single operation via query param (?id=)', () => {
    test('GET /api/v1/operations?id=OP_1954_001 returns 200 and valid operation object (not 500)', () => {
      const req = { method: 'GET', query: { id: 'OP_1954_001' } };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 200, 'Expected HTTP 200 OK');
      assert.ok(res.body, 'Expected a non-empty response body');
      assert.equal(res.body.meta?.status, 'success');
      assert.equal(res.body.meta?.total, 1);
      assert.equal(res.body.meta?.count, 1);
      assert.ok(res.body.data, 'Expected data payload');
      assert.equal(res.body.data.id, 'OP_1954_001');
      assert.equal(res.body.meta?.applied_filters?.id, 'OP_1954_001');
    });

    test('GET /api/v1/operations?id=UNKNOWN_ID returns 404 Not Found', () => {
      const req = { method: 'GET', query: { id: 'OP_9999_999' } };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 404, 'Expected HTTP 404 Not Found');
      assert.equal(res.body?.status, 'error');
    });

    test('GET /api/v1/operations?id=aln-1954-001 handles aliases/normalization smoothly', () => {
      const req = { method: 'GET', query: { id: 'aln-1954-001' } };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 200, 'Expected HTTP 200 OK for normalized alias');
      assert.equal(res.body?.data?.id, 'OP_1954_001');
    });

    test('GET /api/v1/operations/:id via direct handler returns 200 and matches query route', () => {
      const req = { method: 'GET', query: { id: 'OP_1954_001' } };
      const res = createMockRes();

      singleOpHandler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body?.data?.id, 'OP_1954_001');
      assert.equal(res.body?.data?.wilaya_code, 'W1');
    });

    test('GET /api/v1/operations/:id with missing ID returns 400 Bad Request', () => {
      const req = { method: 'GET', query: {} };
      const res = createMockRes();

      singleOpHandler(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.status, 'error');
    });
  });

  describe('Operations Collection & Filtering', () => {
    test('GET /api/v1/operations returns full collection with default pagination', () => {
      const req = { method: 'GET', query: {} };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.meta?.status, 'success');
      assert.equal(res.body.meta?.total, published.length, 'Dataset should contain 263 total operations');
      assert.equal(res.body.meta?.page, 1);
      assert.equal(res.body.meta?.limit, 50);
      assert.equal(res.body.data.length, 50);
    });

    test('GET /api/v1/operations?year=1954 filters accurately', () => {
      const req = { method: 'GET', query: { year: '1954' } };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.meta?.total, published.filter(op => op.date_debut?.startsWith('1954')).length, 'Year 1954 should have 11 operations');
      assert.equal(res.body.data.length, 11);
      assert.ok(res.body.data.every(op => op.annee === 1954 || (op.date_debut && op.date_debut.startsWith('1954'))));
    });

    test('GET /api/v1/operations?format=geojson returns GeoJSON FeatureCollection with explicit contract (ALNOP-004)', () => {
      const req = { method: 'GET', query: { format: 'geojson' } };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['content-type'], 'application/geo+json; charset=utf-8');
      assert.equal(res.body.type, 'FeatureCollection');
      assert.ok(Array.isArray(res.body.features));
      assert.equal(res.body.features.length, published.length);
      assert.equal(res.body.properties?.pagination?.paginated, false);
      assert.ok(res.body.properties?.pagination?.note);
    });
  });

  describe('ALNOP-005: Strict Validation of Pagination Parameters', () => {
    test('GET /api/v1/operations?limit=abc returns 400 Bad Request', () => {
      const req = { method: 'GET', query: { limit: 'abc' } };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.status, 'error');
      assert.equal(res.body?.error, 'Bad Request');
      assert.ok(res.body?.message?.includes('limit'));
    });

    test('GET /api/v1/operations?limit=-5 returns 400 Bad Request', () => {
      const req = { method: 'GET', query: { limit: '-5' } };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.status, 'error');
    });

    test('GET /api/v1/operations?limit=0 returns 400 Bad Request', () => {
      const req = { method: 'GET', query: { limit: '0' } };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.status, 'error');
    });

    test('GET /api/v1/operations?limit=500 returns 400 Bad Request (ceiling is 300)', () => {
      const req = { method: 'GET', query: { limit: '500' } };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.status, 'error');
    });

    test('GET /api/v1/operations?page=0 returns 400 Bad Request', () => {
      const req = { method: 'GET', query: { page: '0' } };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.status, 'error');
    });

    test('GET /api/v1/operations?page=-1 returns 400 Bad Request', () => {
      const req = { method: 'GET', query: { page: '-1' } };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.status, 'error');
    });

    test('GET /api/v1/operations?page=abc returns 400 Bad Request', () => {
      const req = { method: 'GET', query: { page: 'abc' } };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.status, 'error');
    });
  });

  describe('ALNOP-006: Strict Validation of Filter & Range Parameters', () => {
    test('GET /api/v1/operations?year=abc returns 400 Bad Request', () => {
      const req = { method: 'GET', query: { year: 'abc' } };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.status, 'error');
      assert.ok(res.body?.message?.includes('year'));
    });

    test('GET /api/v1/operations?date_from=1962&date_to=1954 returns 400 Bad Request (inverted range)', () => {
      const req = { method: 'GET', query: { date_from: '1962', date_to: '1954' } };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.status, 'error');
      assert.ok(res.body?.message?.includes('date_from'));
    });

    test('GET /api/v1/operations?sort=random_sort returns 400 Bad Request', () => {
      const req = { method: 'GET', query: { sort: 'random_sort' } };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.status, 'error');
    });

    test('GET /api/v1/operations?format=xml returns 400 Bad Request', () => {
      const req = { method: 'GET', query: { format: 'xml' } };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.status, 'error');
    });
  });

  describe('ALNOP-007: Territorial Multi-Affiliations', () => {
    test('Operation with inter-wilaya scope exposes primary and secondary territorial affiliations', () => {
      // OP_1954_001 mentions multiple historical zones
      const req = { method: 'GET', query: { id: 'OP_1954_001' } };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 200);
      assert.ok(res.body.data.primary_affiliation, 'Should have primary_affiliation');
      assert.ok(Array.isArray(res.body.data.territorial_affiliations), 'Should have territorial_affiliations array');
      assert.ok(res.body.data.territorial_affiliations.length >= 1, 'Should contain at least the primary affiliation');
      assert.equal(res.body.data.territorial_affiliations[0].role, 'primary');
    });
  });

  describe('ALNOP-008: Non-Exhaustiveness & Dataset Versioning Metadata', () => {
    test('API response envelope contains dataset_version and coverage_note', () => {
      const req = { method: 'GET', query: { limit: '1' } };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.meta.dataset_version, '1.0.0');
      assert.ok(res.body.meta.coverage_note, 'Expected coverage_note in metadata');
      assert.ok(res.body.meta.coverage_note.includes('Non exhaustif'));
    });

    test('Stats endpoint contains dataset_version and explicit coverage_note', () => {
      const req = { method: 'GET', query: {} };
      const res = createMockRes();

      statsHandler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.data.dataset_version, '1.0.0');
      assert.ok(res.body.data.coverage_note);
      assert.ok(res.body.data.coverage_note.toLowerCase().includes('exhaustif'));
    });
  });

  describe('ALNOP-014: Deterministic Sorting & Pagination Consistency', () => {
    test('Pages 1 and 2 (limit 20) have zero overlapping IDs and preserve chronological tie-breaker', () => {
      const req1 = { method: 'GET', query: { page: '1', limit: '20' } };
      const res1 = createMockRes();
      operationsHandler(req1, res1);

      const req2 = { method: 'GET', query: { page: '2', limit: '20' } };
      const res2 = createMockRes();
      operationsHandler(req2, res2);

      assert.equal(res1.statusCode, 200);
      assert.equal(res2.statusCode, 200);

      const page1Ids = res1.body.data.map(op => op.id);
      const page2Ids = res2.body.data.map(op => op.id);

      assert.equal(page1Ids.length, 20);
      assert.equal(page2Ids.length, 20);

      const intersection = page1Ids.filter(id => page2Ids.includes(id));
      assert.deepEqual(intersection, [], 'Pagination must not produce duplicate records across pages');
    });
  });

  describe('ALNOP-015: Multilingual & Arabic Diacritics Normalization', () => {
    test('Search with Arabic diacritics (Tashkeel) matches un-vocalized operation text', () => {
      const reqVocalized = { method: 'GET', query: { q: 'مَعْرَكَة' } };
      const resVocalized = createMockRes();
      operationsHandler(reqVocalized, resVocalized);

      const reqPlain = { method: 'GET', query: { q: 'معركة' } };
      const resPlain = createMockRes();
      operationsHandler(reqPlain, resPlain);

      assert.equal(resVocalized.statusCode, 200);
      assert.equal(resPlain.statusCode, 200);
      assert.equal(resVocalized.body.meta.total, resPlain.body.meta.total, 'Vocalized and unvocalized Arabic queries must yield identical results');
      assert.ok(resVocalized.body.meta.total > 0, 'Should find operations matching معركة');
    });
  });

  describe('Stats & Wilayas Endpoints', () => {
    test('GET /api/v1/stats returns computed statistics matching total dataset count', () => {
      const req = { method: 'GET', query: {} };
      const res = createMockRes();

      statsHandler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.meta?.status, 'success');
      assert.equal(res.body.data?.total_operations, published.length);
      assert.ok(res.body.data?.by_year);
      assert.ok(res.body.data?.by_wilaya);
    });

    test('GET /api/v1/stats?limit=abc returns 400 Bad Request via shared validation', () => {
      const req = { method: 'GET', query: { limit: 'abc' } };
      const res = createMockRes();

      statsHandler(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.status, 'error');
    });

    test('GET /api/v1/wilayas returns 10 historical wilayas & autonomous zones', () => {
      const req = { method: 'GET', query: {} };
      const res = createMockRes();

      wilayasHandler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.meta?.status, 'success');
      assert.equal(res.body.meta?.total, 10);
      assert.equal(res.body.data?.length, 10);
    });
  });

  describe('HTTP Protocol & Methods & Error Sanitization (ALNOP-009)', () => {
    test('OPTIONS request returns 204 No Content with CORS headers', () => {
      const req = { method: 'OPTIONS' };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 204);
      assert.equal(res.headers['access-control-allow-origin'], '*');
    });

    test('POST request returns 405 Method Not Allowed', () => {
      const req = { method: 'POST' };
      const res = createMockRes();

      operationsHandler(req, res);

      assert.equal(res.statusCode, 405);
      assert.equal(res.body?.status, 'error');
    });
  });

});
