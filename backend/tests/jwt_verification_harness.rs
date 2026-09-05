//! Phase 4b-4 prep: proves the real JWT accept/reject path is testable
//! locally, without a real Okta tenant, before `appfw_runtime::auth`'s
//! `RuntimeJwtExtractor`/`verify_token` are ported off the framework.
//!
//! `okta_jwt_verifier::Verifier::new(issuer)` does no OIDC discovery -- it
//! makes exactly one GET to `{issuer}/v1/keys` expecting `{"keys": [...]}`
//! (confirmed by reading the crate's own src/lib.rs). That makes it fully
//! mockable with a bare HTTP server serving one JSON endpoint; nothing here
//! is Okta-account-specific. This harness uses `mockito` to serve that
//! endpoint and a static test RSA keypair (generated once via `openssl`,
//! not a secret -- it never leaves this test) to sign tokens.
//!
//! This file does not import anything from the `backend` crate itself: it
//! only proves the third-party verifier's behavior, matching the exact
//! construction (`Verifier::new(..).client_id(..).audience(..)`) that
//! `appfw_runtime::auth::verify_token` uses. Porting `verify_token` itself
//! is a separate, later task.

use std::collections::HashSet;

use jsonwebtoken::{encode, EncodingKey, Header};
use okta_jwt_verifier::{DefaultClaims, Verifier};
use serde::Serialize;
use serde_json::json;

// Generated via:
//   openssl genrsa -out priv.pem 2048
//   openssl rsa -in priv.pem -traditional -out priv_pkcs1.pem
// Test-only keypair; never used outside this file.
const TEST_RSA_PRIVATE_KEY_PEM: &str = "-----BEGIN RSA PRIVATE KEY-----
MIIEogIBAAKCAQEAlyH4hYGR8Bx1FC9vycb/moYZhxzYujEw9AkhReKF7WRZPpPO
/wwzaLonil27Y9jRk70liNGFpsKloEJR0nWPGR00vlhMf/B8PTMUe4PPeLNwawze
T8qmvaNyRvIhaJYWwIWwY30c80XDs18WnFMJFBc/auw/t86h6IGgEOS0+rMJ+WHt
SsU9MgMjILXnwbpdD2TKgVMBzPFbXnZj/1YKy3YTdg8xY2uJ/odRsU7YkW5u6M6J
/4ksWnTlGr54ZvnHoYa9GgPNu+rAXJx/y0Q1n7kwPQtO5LxsIEoRD70EHV0NgSbq
X5+HI2uNivnTtH6YCvu6qGJSiyaVuA4cW2fN/QIDAQABAoIBAAN3TPrK2Oz3yhuX
ZunqvWvuzWES4UmL3UKLfw7aPhYOqhlMTH/+6KLrOgLrWWPV0iCgQt8bZwRHDINb
YgMAnTKHP/Fplv+MJV1F8Z9Pi4+KFfbuiZ6s2BwbRoCoBuoeHxF1P3FYqjROEknn
0V3ubZPfYJ30IxX1EDOD3Yblp9zj+zwaUexgwQIbuYr+VzngNPduDqihoXOIfixR
x19oswrD7xo1Nr/Mg2F2K71rXL3wnXQ1N6CzABoJLo/mVKYkGtmjrWNRNtQnhdRj
7hu/9tWQ6kr6bJ6fONEPhrtAwWOdHJU2u6g89Eo3n+HRUgWVglbwRUI+KA59AeDB
SK2HCSECgYEAzKZVAme5ZacKKbotmLHJfb5wQlAzspWacc6Y7VrJk6LbPjbAQSJ9
Ki/W11tuAfe1sZunSO637tYI+wUSFMw2CfhV2pZis6XNs5cGKI7YCZiaAQlpq5sN
nuo/EXZ1DeGUf49G2zMgzELU/RQdjU8oTqakQaQ/MUVHNziQ5W2xvCUCgYEAvQ35
U1kjHGDG9TC6sBx4piYHbE+7UGFrZsiXgwtpz/1YmUS0dcl86BKONUC9jaZD1Ce8
1BI+SGl2M9JpsrnOTXWppC0ASg439tCHb/zg6ohFiCFIy9FKEHEWchhuhDj5EFvv
PYHlAYiLTk1vzf3b1dWsxb7qBQ8v3vbcLsj4NvkCgYA3miGSq7fVhJLgT3M//13t
SiaZ/cxuAvOZZDZslrQZ5q+Gsb1+dO5o3eKTVIYJBtJY1R+YUzOqMoDyIqiM+gbc
oppA74cVpEDFQI0ty9GqmcmN6o7JTzFeMeq8xeB7ywRbvAPWXofUt3vC3wpAcHdV
FzWdmBCLRHVa7YWAsFMP+QKBgBIU0A/EqrMAHoc8zd4iGvfpEzSsu4GIj7kY3kTO
RqR52otuIsRRLP0VKTy2oGp3yGz2D/1IcWSDkaaLLUjGtJB7/GmTVD/A9GFKuGlh
ijFkLyJB7LBxp9/CsR7gb1F+EXQbFtqPHdPztz8Z8OOGsAvXj9qp08AAH9f3TD+9
QOAhAoGAQRZS/ruInS+G06YAV+BoI63ZJFH4frLuRn0uYWATYjP66Okd1W59Ki6R
eGffVDMvuz7QNGK1XJPOh3AEsilBMMQlhwrcppUFE+WBY87oTdMIoTlcHIFsplgc
vnEJvacgUic9IRAAMVmblJ6+mnzlgERxeTDsudA6OlsrePYDjG0=
-----END RSA PRIVATE KEY-----
";

// A second, unrelated keypair used only to produce a wrong-signature token.
const OTHER_RSA_PRIVATE_KEY_PEM: &str = "-----BEGIN RSA PRIVATE KEY-----
MIIEoAIBAAKCAQEAjUqQK+IuANjphGnQ3dpo1CmTVv1mRXIZ/5uNBdIDzoLy0/Wd
tRFy7n04TsN2K7RKT1RSOimhO6Tf8LMqCcY1bn2+G/RHtUbhPW2udS5GOL7OV0X/
T4322lM4WTWAbeffAVk5S73hUaR30Bs6dzVx1pfkpz5AQZt3BcwO1Dcaruyg3K6V
rvLx+J+ayBss6jJLv4UvOpEtugTX7i4+QLkZcAadrLFnoZGHGR4uAxG+sdePYnug
CwWnPPGTodbE/vTVR6G8mbb6bCYk2vuREu16HRCFkQU0Jfn8DNe1uWY5tQUTQvwZ
D5g8V79mrW5RuoTyo/XH0Qz7E8ah38FXkToq1QIDAQABAoIBAAC1ZQUIp1kTEr4P
7HTltCzhiymehQrIHbVDHxvuXQfbbu2n3QNGySAaZKk7IGFBEDZW9+qZbC4+ZMPH
l5MLpBefwyT6E/n8FwPAhGV2C/LGPNwB2oaYRv/6oYe2VaSMyyODQl73iXpoAWnR
GSP2kqbphW4JSTfgWGJ2ZC9QRMP9Izu1UQQiXZ1re2Jl09mLD8UR7geJJb5Z/ZIO
XIl8Kte1WU4hl6/iqKka1z4OMKp7DFpNiwc93cHS8bJIYpVyncXKiqPKNw1XMOfb
Y3Jt4YNb6zDfEH2/wVZRrFt+FUaVxGdWVyxHFmLQvSKNj+F82mNP+8BRnM5IR4NO
YE79DmkCgYEAvtrbhWitTki16Wx2vOqptXkABL6KTh2lLp6TqXB4iGazNPfRv3ue
34oHlzyAZs5QeR9yOGvMvdOcPGQYg7mTYr+neh3RB68miyM233N+OheUiLJPcbTO
C99ihIQ55gK2HgX7rg2pHs3xNOYDyZz4dXkULaDQVqMNNdzqn3CGiUcCgYEAvYTF
hH/fieQGJT+yQ9TDR8Ng/80noSthR6bk5OaNKcxsEFD+b29qLjvfy4/3mMtYOQn/
ilIxYh+R8xrjfJkWPcR8x62Z/4v/aJwElj5V2cxJtaJGnPC4VWCZA6R5GYmDJ0Q2
Bk6VSLagBKKGPADvxC21J7a0PKsTakHBurMceQMCgYBBrZ0nrtsc+oanemzuHC8k
xSwNdeiwcyE6BtY30/2Wqwj2rGWg6JDGyoBMOkTRnCQzWm/7HJXLqXu1iJirE/y1
WdDvhD0/0LWJ4idrBBqnMSArXnlaXucdTNVhVwN5tOspL9PplMfjUumz04fwJLWX
73/TJ+kqN1g/dfPDxHx31wKBgFrq5xa5gbPVAF2+QPbpiwVSZaZR9UEMXo7RMd3d
/Lqgpvbs5CLxgC7N6n7tggp7AsfaVA03gRlhq9LEg32ys0jOik4AqnA96Tl2H300
SltB9dp9DwMbOFM9FCr7LF1j6tdbkc9Uw6kuc3XFwj/m8x9aDh4POEgiih3fjeDT
LEWhAn9xRXvcTHq5Rk21o/9LKTnvzp/gm+PnUWotMMpE0/foXlEGKyhewOo7gzGq
YONwoJqTA8UZUZKq/v40rh2FgWp/oTkoKnlCZKSr2mM/Eh8gjKcJUAmCQUl3VVA7
bJzyLutokYI1tvY0MJofrFIvUbDDSLttFmIoBQa1n0/BX4RG
-----END RSA PRIVATE KEY-----
";

// n/e for TEST_RSA_PRIVATE_KEY_PEM, base64url-encoded (no padding), computed via:
//   openssl rsa -in priv.pem -noout -modulus
const TEST_RSA_N: &str = "lyH4hYGR8Bx1FC9vycb_moYZhxzYujEw9AkhReKF7WRZPpPO_wwzaLonil27Y9jRk70liNGFpsKloEJR0nWPGR00vlhMf_B8PTMUe4PPeLNwawzeT8qmvaNyRvIhaJYWwIWwY30c80XDs18WnFMJFBc_auw_t86h6IGgEOS0-rMJ-WHtSsU9MgMjILXnwbpdD2TKgVMBzPFbXnZj_1YKy3YTdg8xY2uJ_odRsU7YkW5u6M6J_4ksWnTlGr54ZvnHoYa9GgPNu-rAXJx_y0Q1n7kwPQtO5LxsIEoRD70EHV0NgSbqX5-HI2uNivnTtH6YCvu6qGJSiyaVuA4cW2fN_Q";
const TEST_RSA_E: &str = "AQAB";
const TEST_KID: &str = "test-key-1";

fn jwks_body() -> String {
    json!({
        "keys": [{
            "kty": "RSA",
            "alg": "RS256",
            "kid": TEST_KID,
            "use": "sig",
            "e": TEST_RSA_E,
            "n": TEST_RSA_N,
        }]
    })
    .to_string()
}

#[derive(Serialize)]
struct TestClaims {
    iss: String,
    sub: String,
    aud: String,
    exp: usize,
    iat: usize,
}

fn sign_with(pem: &str, kid: &str, claims: &TestClaims) -> String {
    let mut header = Header::new(jsonwebtoken::Algorithm::RS256);
    header.kid = Some(kid.to_string());
    let key = EncodingKey::from_rsa_pem(pem.as_bytes()).expect("valid PKCS1 RSA PEM");
    encode(&header, claims, &key).expect("token signs")
}

fn now() -> usize {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as usize
}

/// Starts a mock server serving `/v1/keys` with the test JWKS, matching
/// `okta_jwt_verifier`'s default (undiscoverable, hardcoded) endpoint path.
async fn mock_jwks_server() -> mockito::ServerGuard {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("GET", "/v1/keys")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(jwks_body())
        .create_async()
        .await;
    server
}

#[tokio::test]
async fn accepts_a_validly_signed_token() {
    let server = mock_jwks_server().await;
    let issuer = server.url();

    let claims = TestClaims {
        iss: issuer.clone(),
        sub: "user-1".to_string(),
        aud: "api://governance".to_string(),
        exp: now() + 3600,
        iat: now(),
    };
    let token = sign_with(TEST_RSA_PRIVATE_KEY_PEM, TEST_KID, &claims);

    let mut aud = HashSet::new();
    aud.insert("api://governance".to_string());

    let verifier = Verifier::new(&issuer).await.expect("verifier builds");
    let result = verifier.audience(aud).verify::<DefaultClaims>(&token).await;

    assert!(
        result.is_ok(),
        "expected a validly signed, unexpired token to be accepted, got: {:?}",
        result.err()
    );
}

#[tokio::test]
async fn rejects_an_expired_token() {
    let server = mock_jwks_server().await;
    let issuer = server.url();

    let claims = TestClaims {
        iss: issuer.clone(),
        sub: "user-1".to_string(),
        aud: "api://governance".to_string(),
        exp: now().saturating_sub(3600), // expired an hour ago
        iat: now().saturating_sub(7200),
    };
    let token = sign_with(TEST_RSA_PRIVATE_KEY_PEM, TEST_KID, &claims);

    let mut aud = HashSet::new();
    aud.insert("api://governance".to_string());

    let verifier = Verifier::new(&issuer).await.expect("verifier builds");
    let result = verifier.audience(aud).verify::<DefaultClaims>(&token).await;

    assert!(result.is_err(), "expected an expired token to be rejected");
}

#[tokio::test]
async fn rejects_a_wrong_signature_token() {
    let server = mock_jwks_server().await;
    let issuer = server.url();

    let claims = TestClaims {
        iss: issuer.clone(),
        sub: "user-1".to_string(),
        aud: "api://governance".to_string(),
        exp: now() + 3600,
        iat: now(),
    };
    // Signed with a DIFFERENT private key than the one whose public
    // components are published in the mocked JWKS -- same `kid`, so the
    // verifier will find a (wrong) matching key and must fail on signature
    // verification, not on "no matching key found".
    let token = sign_with(OTHER_RSA_PRIVATE_KEY_PEM, TEST_KID, &claims);

    let mut aud = HashSet::new();
    aud.insert("api://governance".to_string());

    let verifier = Verifier::new(&issuer).await.expect("verifier builds");
    let result = verifier.audience(aud).verify::<DefaultClaims>(&token).await;

    assert!(
        result.is_err(),
        "expected a token signed with the wrong key to be rejected"
    );
}

#[tokio::test]
async fn rejects_a_wrong_issuer_token() {
    let server = mock_jwks_server().await;
    let issuer = server.url();

    let claims = TestClaims {
        // Claims an issuer that does NOT match the mock server's URL --
        // exactly what `verify_token` pins via `validation.iss`.
        iss: "https://not-the-real-issuer.example.com".to_string(),
        sub: "user-1".to_string(),
        aud: "api://governance".to_string(),
        exp: now() + 3600,
        iat: now(),
    };
    let token = sign_with(TEST_RSA_PRIVATE_KEY_PEM, TEST_KID, &claims);

    let mut aud = HashSet::new();
    aud.insert("api://governance".to_string());

    let verifier = Verifier::new(&issuer).await.expect("verifier builds");
    let result = verifier.audience(aud).verify::<DefaultClaims>(&token).await;

    assert!(
        result.is_err(),
        "expected a token with a mismatched issuer to be rejected"
    );
}

#[tokio::test]
async fn rejects_a_wrong_audience_token() {
    let server = mock_jwks_server().await;
    let issuer = server.url();

    let claims = TestClaims {
        iss: issuer.clone(),
        sub: "user-1".to_string(),
        aud: "api://some-other-audience".to_string(),
        exp: now() + 3600,
        iat: now(),
    };
    let token = sign_with(TEST_RSA_PRIVATE_KEY_PEM, TEST_KID, &claims);

    let mut aud = HashSet::new();
    aud.insert("api://governance".to_string());

    let verifier = Verifier::new(&issuer).await.expect("verifier builds");
    let result = verifier.audience(aud).verify::<DefaultClaims>(&token).await;

    assert!(
        result.is_err(),
        "expected a token with a mismatched audience to be rejected"
    );
}
