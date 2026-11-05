# OpenAPI document validation

`openapi-3.1-schema.json` is the OpenAPI Initiative's published schema downloaded from:
https://spec.openapis.org/oas/3.1/schema/2025-09-15

It is stored locally so unit tests require no external network. The document schema validates the OpenAPI structure; separate Ajv tests validate actual API responses against the component schemas. Specification: https://spec.openapis.org/oas/v3.1.0

The test binds the schema's default `#meta` dynamic reference to its existing `$defs/schema` declaration to work around Ajv's handling of nested dynamic anchors. The downloaded schema remains unmodified on disk. The component schemas are compiled and response-validated separately.

Upstream license: Apache-2.0, copied alongside as `LICENSE.OpenAPI.txt`. This does not change ALNOP's data license.
