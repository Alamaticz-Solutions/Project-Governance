//! Signed, tamper-evident keyset pagination cursors.
//!
//! A keyset cursor is a client-supplied string that says "resume after this row." Because
//! clients can freely edit strings they hold, the wire format is signed (HMAC-SHA256) and
//! verified on decode using a constant-time comparison, and the signing key resolution is
//! fail-closed: any environment other than local development must have an explicit signing key
//! configured, or cursor operations refuse to work at all. See the module's design spec for the
//! full rationale; do not simplify the key resolution or the comparison.

use crate::data::query_ir::SortDirection;
use crate::data::query_ir_validation::value_kind;
use crate::routes::app_error::AppError;
use crate::platform::runtime::query_filter::{conjunction_token, filter_token};
use serde_json::{json, Value};

#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct KeysetCursor {
    pub field: String,
    pub direction: String,
    pub value: serde_json::Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tiebreaker: Option<KeysetTiebreaker>,
}

#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct KeysetTiebreaker {
    pub field: String,
    pub value: serde_json::Value,
}

/// Dev-only default signing key. Only used when ENV_NAME is `local` or unset (developer
/// workstations / tests); managed environments MUST set APP_CURSOR_SIGNING_KEY.
const DEV_CURSOR_SIGNING_KEY: &str = "appfw-local-dev-cursor-signing-key-do-not-use-in-prod";
const CURSOR_SIGNING_KEY_ENV: &str = "APP_CURSOR_SIGNING_KEY";

pub fn ensure_keyset_sort(
    primary_key_name: &str,
    sort: Option<serde_json::Value>,
) -> Result<serde_json::Value, AppError> {
    let sort = match sort {
        None => {
            if primary_key_name.trim().is_empty() {
                return Err(AppError::Validation(
                    "keyset pagination requires a primary key sort field".to_string(),
                ));
            }
            return Ok(json!({ primary_key_name: "asc" }));
        }
        Some(value) => value,
    };

    let mut object = normalize_sort_object(sort)?;
    if object.len() != 1 {
        return Err(AppError::Validation(
            "keyset pagination currently supports exactly one sort field".to_string(),
        ));
    }

    let sort_field = object.keys().next().cloned().expect("exactly one entry");

    if sort_field == primary_key_name || primary_key_name.trim().is_empty() {
        return Ok(Value::Object(object));
    }

    let tiebreaker_direction = object
        .values()
        .next()
        .map(SortDirection::from_value)
        .unwrap_or(SortDirection::Asc);
    object.insert(
        primary_key_name.to_string(),
        json!(tiebreaker_direction.as_str()),
    );
    Ok(Value::Object(object))
}

fn normalize_sort_object(
    value: serde_json::Value,
) -> Result<serde_json::Map<String, serde_json::Value>, AppError> {
    match value {
        Value::Object(map) => {
            if map.is_empty() {
                Err(AppError::Validation(
                    "keyset pagination requires a sort".to_string(),
                ))
            } else {
                Ok(map)
            }
        }
        Value::String(text) => {
            if text.trim().is_empty() {
                return Err(AppError::Validation(
                    "keyset pagination requires a sort".to_string(),
                ));
            }
            match serde_json::from_str::<Value>(&text) {
                Ok(parsed) => match parsed {
                    Value::Object(map) if !map.is_empty() => Ok(map),
                    other => Err(AppError::Validation(format!(
                        "keyset sort must be a JSON object or a JSON-encoded object string, got {}",
                        value_kind(&other)
                    ))),
                },
                Err(error) => Err(AppError::Validation(format!(
                    "keyset sort string is not valid JSON: {error}"
                ))),
            }
        }
        other => Err(AppError::Validation(format!(
            "keyset sort must be a JSON object or a JSON-encoded object string, got {}",
            value_kind(&other)
        ))),
    }
}

pub fn apply_keyset_cursor_filter(
    filter: Option<serde_json::Value>,
    sort: &serde_json::Value,
    after: Option<&str>,
) -> Result<Option<serde_json::Value>, AppError> {
    let after = match after {
        None => return Ok(filter),
        Some(value) => value,
    };

    let cursor = decode_keyset_cursor(after)?;

    let sort_object = sort.as_object().ok_or_else(|| {
        AppError::Validation("keyset pagination requires an object sort".to_string())
    })?;
    let (field, direction_value) = sort_object.iter().next().ok_or_else(|| {
        AppError::Validation("keyset pagination requires a sort field".to_string())
    })?;
    let direction = SortDirection::from_value(direction_value);

    if cursor.field != *field || cursor.direction != direction.as_str() {
        return Err(AppError::Validation(
            "keyset cursor does not match the requested sort".to_string(),
        ));
    }

    let strict_op = match direction {
        SortDirection::Asc => filter_token::GREATER_THAN,
        SortDirection::Desc => filter_token::LESS_THAN,
    };

    let cursor_filter = match &cursor.tiebreaker {
        None => json!({ field: { strict_op: cursor.value.clone() } }),
        Some(tiebreaker) => json!({
            conjunction_token::OR: [
                { field: { strict_op: cursor.value.clone() } },
                {
                    conjunction_token::AND: [
                        { field: { filter_token::EQUALS: cursor.value.clone() } },
                        { tiebreaker.field.clone(): { strict_op: tiebreaker.value.clone() } }
                    ]
                }
            ]
        }),
    };

    match filter {
        None | Some(Value::Null) => Ok(Some(cursor_filter)),
        Some(existing_filter) => Ok(Some(json!({
            conjunction_token::AND: [existing_filter, cursor_filter]
        }))),
    }
}

pub fn encode_keyset_cursor(
    field: &str,
    direction: crate::data::query_ir::SortDirection,
    value: serde_json::Value,
) -> Result<String, AppError> {
    encode_keyset_cursor_struct(&KeysetCursor {
        field: field.to_string(),
        direction: direction.as_str().to_string(),
        value,
        tiebreaker: None,
    })
}

/// Encode a keyset cursor that carries a primary-key tiebreaker. Use whenever the sort field is
/// not the primary key, so pagination over non-unique columns stays correct.
/// Decode/filter already handle a tiebreaker cursor (see `cursor.tiebreaker`
/// in `keyset_cursor_filter`); this encode side is tested (roundtrip below)
/// but has no caller yet -- no current query sorts by a non-unique field.
#[allow(dead_code)]
pub fn encode_keyset_cursor_with_tiebreaker(
    field: &str,
    direction: crate::data::query_ir::SortDirection,
    value: serde_json::Value,
    tiebreaker_field: &str,
    tiebreaker_value: serde_json::Value,
) -> Result<String, AppError> {
    encode_keyset_cursor_struct(&KeysetCursor {
        field: field.to_string(),
        direction: direction.as_str().to_string(),
        value,
        tiebreaker: Some(KeysetTiebreaker {
            field: tiebreaker_field.to_string(),
            value: tiebreaker_value,
        }),
    })
}

fn encode_keyset_cursor_struct(cursor: &KeysetCursor) -> Result<String, AppError> {
    let payload = serde_json::to_vec(cursor)
        .map_err(|error| AppError::DataAccess(format!("failed to encode cursor: {error}")))?;
    let key = cursor_signing_key()?;
    let signature = cursor_hmac(&key, &payload);

    // Opaque, tamper-evident wire format: base64url(payload) "." base64url(hmac_sha256(payload)).
    use base64::Engine as _;
    let payload_b64 = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&payload);
    let signature_b64 = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(signature);
    Ok(format!("{payload_b64}.{signature_b64}"))
}

pub fn decode_keyset_cursor(value: &str) -> Result<KeysetCursor, AppError> {
    use base64::Engine as _;

    let (payload_b64, signature_b64) = value
        .split_once('.')
        .ok_or_else(|| AppError::Validation("invalid keyset cursor".to_string()))?;

    let payload = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload_b64)
        .map_err(|_| AppError::Validation("invalid keyset cursor".to_string()))?;
    let signature = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(signature_b64)
        .map_err(|_| AppError::Validation("invalid keyset cursor".to_string()))?;

    let key = cursor_signing_key()?;
    let expected = cursor_hmac(&key, &payload);
    if !constant_time_eq(&expected, &signature) {
        return Err(AppError::Validation("invalid keyset cursor".to_string()));
    }

    let cursor: KeysetCursor = serde_json::from_slice(&payload)
        .map_err(|_| AppError::Validation("invalid keyset cursor".to_string()))?;

    if cursor.direction != SortDirection::Asc.as_str()
        && cursor.direction != SortDirection::Desc.as_str()
    {
        return Err(AppError::Validation("invalid keyset cursor".to_string()));
    }

    Ok(cursor)
}

fn cursor_signing_key() -> Result<Vec<u8>, AppError> {
    let configured = std::env::var(CURSOR_SIGNING_KEY_ENV).ok();
    let env_name = std::env::var("ENV_NAME").ok();
    resolve_cursor_signing_key(configured.as_deref(), env_name.as_deref())
}

/// A "managed" environment is any deployment whose ENV_NAME is set to something other than
/// `local`. When ENV_NAME is unset (developer workstations / unit tests) the context is treated
/// as local and the dev default key is permitted. Any real deployment sets ENV_NAME, which forces
/// an explicit signing key -- fail-closed.
fn resolve_cursor_signing_key(
    configured_key: Option<&str>,
    env_name: Option<&str>,
) -> Result<Vec<u8>, AppError> {
    if let Some(key) = configured_key {
        if !key.trim().is_empty() {
            return Ok(key.as_bytes().to_vec());
        }
    }

    let managed = match env_name {
        Some(value) => !value.trim().eq_ignore_ascii_case("local"),
        None => false,
    };
    if managed {
        Err(AppError::Validation(format!(
            "{CURSOR_SIGNING_KEY_ENV} must be set in managed environments"
        )))
    } else {
        Ok(DEV_CURSOR_SIGNING_KEY.as_bytes().to_vec())
    }
}

fn cursor_hmac(key: &[u8], payload: &[u8]) -> Vec<u8> {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("HMAC accepts keys of any length");
    mac.update(payload);
    mac.finalize().into_bytes().to_vec()
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::query_ir::SortDirection;
    use serde_json::json;

    #[test]
    fn keyset_sort_defaults_to_primary_key() {
        assert_eq!(
            ensure_keyset_sort("id", None).expect("default sort"),
            json!({ "id": "asc" })
        );
    }

    #[test]
    fn keyset_sort_requires_exactly_one_field() {
        assert!(ensure_keyset_sort("id", Some(json!({}))).is_err());
        assert!(ensure_keyset_sort("id", Some(json!({ "id": "asc", "name": "asc" }))).is_err());
    }

    #[test]
    fn keyset_cursor_filter_merges_existing_filter() {
        let cursor =
            encode_keyset_cursor("id", SortDirection::Asc, json!("account-2")).expect("cursor");
        let filter = apply_keyset_cursor_filter(
            Some(json!({ "name": { "_starts": "A" } })),
            &json!({ "id": "asc" }),
            Some(&cursor),
        )
        .expect("cursor filter");

        assert_eq!(
            filter,
            Some(json!({
                "_and": [
                    { "name": { "_starts": "A" } },
                    { "id": { "_gt": "account-2" } }
                ]
            }))
        );
    }

    #[test]
    fn keyset_cursor_filter_uses_less_than_for_desc_sort() {
        let cursor =
            encode_keyset_cursor("created_at", SortDirection::Desc, json!(100)).expect("cursor");
        let filter =
            apply_keyset_cursor_filter(None, &json!({ "created_at": "desc" }), Some(&cursor))
                .expect("cursor filter");

        assert_eq!(filter, Some(json!({ "created_at": { "_lt": 100 } })));
    }

    #[test]
    fn keyset_cursor_must_match_requested_sort() {
        let cursor =
            encode_keyset_cursor("id", SortDirection::Asc, json!("account-2")).expect("cursor");
        let err = apply_keyset_cursor_filter(None, &json!({ "name": "asc" }), Some(&cursor))
            .expect_err("cursor should not match sort");

        assert!(err.to_string().contains("cursor does not match"));
    }

    #[test]
    fn keyset_cursor_decode_rejects_invalid_payloads() {
        assert!(decode_keyset_cursor("not-json").is_err());
        assert!(
            decode_keyset_cursor(r#"{"field":"id","direction":"sideways","value":1}"#).is_err()
        );
    }

    #[test]
    fn keyset_sort_appends_primary_key_tiebreaker_for_non_unique_field() {
        let sort = ensure_keyset_sort("id", Some(json!({ "created_at": "desc" })))
            .expect("sort with tiebreaker");
        let obj = sort.as_object().expect("object sort");
        let keys: Vec<&String> = obj.keys().collect();
        assert_eq!(keys, vec![&"created_at".to_string(), &"id".to_string()]);
        assert_eq!(obj["created_at"], json!("desc"));
        assert_eq!(obj["id"], json!("desc"));
    }

    #[test]
    fn keyset_sort_leaves_primary_key_sort_untouched() {
        let sort = ensure_keyset_sort("id", Some(json!({ "id": "asc" }))).expect("pk sort");
        assert_eq!(sort, json!({ "id": "asc" }));
    }

    #[test]
    fn keyset_cursor_filter_uses_compound_predicate_with_tiebreaker() {
        let cursor = encode_keyset_cursor_with_tiebreaker(
            "created_at",
            SortDirection::Desc,
            json!("2026-01-01"),
            "id",
            json!("account-9"),
        )
        .expect("cursor with tiebreaker");

        let filter = apply_keyset_cursor_filter(
            None,
            &json!({ "created_at": "desc", "id": "desc" }),
            Some(&cursor),
        )
        .expect("cursor filter");

        assert_eq!(
            filter,
            Some(json!({
                "_or": [
                    { "created_at": { "_lt": "2026-01-01" } },
                    {
                        "_and": [
                            { "created_at": { "_eq": "2026-01-01" } },
                            { "id": { "_lt": "account-9" } }
                        ]
                    }
                ]
            }))
        );
    }

    #[test]
    fn keyset_cursor_sign_verify_roundtrips() {
        let cursor =
            encode_keyset_cursor("id", SortDirection::Asc, json!("account-7")).expect("encode");
        assert!(cursor.contains('.'));
        assert!(!cursor.contains("\"field\""));

        let decoded = decode_keyset_cursor(&cursor).expect("decode");
        assert_eq!(decoded.field, "id");
        assert_eq!(decoded.direction, "asc");
        assert_eq!(decoded.value, json!("account-7"));
        assert_eq!(decoded.tiebreaker, None);
    }

    #[test]
    fn keyset_cursor_with_tiebreaker_roundtrips() {
        let cursor = encode_keyset_cursor_with_tiebreaker(
            "created_at",
            SortDirection::Desc,
            json!("2026-01-01"),
            "id",
            json!("account-9"),
        )
        .expect("encode");
        let decoded = decode_keyset_cursor(&cursor).expect("decode");
        let tiebreaker = decoded.tiebreaker.expect("tiebreaker present");
        assert_eq!(tiebreaker.field, "id");
        assert_eq!(tiebreaker.value, json!("account-9"));
    }

    #[test]
    fn keyset_cursor_rejects_tampered_payload() {
        let cursor =
            encode_keyset_cursor("id", SortDirection::Asc, json!("account-7")).expect("encode");

        let (payload, signature) = cursor.split_once('.').expect("dot-delimited cursor");
        let mut tampered_payload: Vec<char> = payload.chars().collect();
        let last = tampered_payload.len() - 1;
        tampered_payload[last] = if tampered_payload[last] == 'A' {
            'B'
        } else {
            'A'
        };
        let tampered: String = tampered_payload.into_iter().collect();
        let forged = format!("{tampered}.{signature}");

        assert!(decode_keyset_cursor(&forged).is_err());
    }

    #[test]
    fn keyset_cursor_rejects_tampered_signature() {
        use base64::Engine as _;
        let cursor =
            encode_keyset_cursor("id", SortDirection::Asc, json!("account-7")).expect("encode");
        let (payload, _signature) = cursor.split_once('.').expect("dot-delimited cursor");
        let forged_sig = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(cursor_hmac(b"attacker-key", payload.as_bytes()));
        let forged = format!("{payload}.{forged_sig}");
        assert!(decode_keyset_cursor(&forged).is_err());
    }

    #[test]
    fn cursor_signing_key_gate_is_fail_closed_in_managed_envs() {
        assert!(resolve_cursor_signing_key(None, Some("compose")).is_err());
        assert!(resolve_cursor_signing_key(Some("   "), Some("prod")).is_err());

        assert_eq!(
            resolve_cursor_signing_key(Some("managed-secret"), Some("prod")).expect("explicit key"),
            b"managed-secret".to_vec()
        );

        assert_eq!(
            resolve_cursor_signing_key(None, Some("local")).expect("dev default"),
            DEV_CURSOR_SIGNING_KEY.as_bytes().to_vec()
        );
        assert_eq!(
            resolve_cursor_signing_key(None, None).expect("dev default"),
            DEV_CURSOR_SIGNING_KEY.as_bytes().to_vec()
        );
    }
}
