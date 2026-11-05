const profile = require('../framework/profile');
const canonical = require('../framework/canonical');
const ingestion = require('../framework/ingestion');
const analysis = require('../framework/analysis');
const review = require('../framework/editorial-review');
const publication = require('../framework/publication');
const store = require('../framework/publication-store');
const {loadProfile} = require('../framework/profile-loader');
const {createPublishedCatalog} = require('../framework/published-catalog');
const {createPublishedHandler} = require('../framework/published-api');

module.exports = Object.freeze({
  profiles: Object.freeze({resolve:profile.resolveProfile,load:loadProfile,Error:profile.ProfileError}),
  canonical: Object.freeze({validateCorpus:canonical.validateCorpus,validateObject:canonical.validateObject,
    stringify:canonical.canonicalStringify,digest:canonical.digest,Error:canonical.CanonicalError}),
  ingestion: Object.freeze({createCorpus:ingestion.createWorkingCorpus,preview:ingestion.prepareImport,
    accept:ingestion.acceptImport,Error:ingestion.IngestionError}),
  analysis: Object.freeze({analyze:analysis.analyze,compareCoverage:analysis.compareCoverage}),
  review: Object.freeze({policy:review.reviewPolicy,digest:review.contentDigest,append:review.recordDecision,
    verify:review.verifyReviewJournal,eligibility:review.validatePublicationEligibility}),
  publication: Object.freeze({build:publication.buildPublicationArtifacts,verify:publication.verifyPublicationArtifacts,
    verifyDirectory:store.verifyPublicationDirectory,createStore:store.createPublicationStore}),
  api: Object.freeze({createCatalog:createPublishedCatalog,createHandler:createPublishedHandler})
});
