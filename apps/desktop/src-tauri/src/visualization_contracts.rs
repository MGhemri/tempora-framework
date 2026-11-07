// TVRW J1A: derived-only serialization tests for the optional Tauri adapter.
// No IPC handlers and no scientific computations in Rust; this intentionally
// cannot modify canonical TEMPORA objects or alter the current Tauri runtime.
#[cfg(test)]
mod tests {
    use serde::{Deserialize, Serialize};
    use serde_json::{json, Value};

    #[derive(Serialize, Deserialize, PartialEq, Eq, Debug)]
    #[serde(deny_unknown_fields)]
    struct TypedRef {
        kind: String,
        namespace: String,
        id: String,
    }

    #[test]
    fn typed_reference_roundtrip_preserves_triplet_and_disallows_unknown_fields() {
        let source = json!({
            "kind":"event","namespace":"SYNTHETIC_HISTORY","id":"EVENT_001"
        });
        let parsed: TypedRef = serde_json::from_value(source.clone()).unwrap();
        assert_eq!(serde_json::to_value(parsed).unwrap(), source);
        assert!(serde_json::from_value::<TypedRef>(
            json!({"kind":"event","namespace":"SYNTHETIC_HISTORY","id":"EVENT_001","path":"C:/private"})
        ).is_err());
    }

    #[test]
    fn versioned_projection_envelope_preserves_digests_and_noncanonical_mode() {
        let envelope = json!({
            "projection_schema_version":"1.0.0",
            "algorithm":{"id":"tvrw.synthetic-list","version":"1.0.0","parameters_sha256":"a".repeat(64)},
            "corpus":{"canonical_sha256":"b".repeat(64),"schema_version":"3.0.0","profile_id":"synthetic-history"},
            "source":{"engine_version":"3.0.0","generated_at":"2026-11-07T00:00:00Z","mode":"validated"},
            "scope":{"filters":{},"total_matched":2,"returned":1,"truncated":true},
            "diagnostics":[],
            "result":[{"id":"EVENT_001"}],
            "scientific_sha256":"c".repeat(64)
        });
        let encoded = serde_json::to_vec(&envelope).unwrap();
        let decoded: Value = serde_json::from_slice(&encoded).unwrap();
        assert_eq!(decoded, envelope);
        assert_eq!(decoded["scope"]["truncated"], true);
        assert_eq!(decoded["source"]["mode"], "validated");
    }
}
