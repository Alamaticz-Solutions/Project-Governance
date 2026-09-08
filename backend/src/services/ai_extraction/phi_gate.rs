//! Pre-egress PHI/PII classification gate (spec 004's "single OpenAI egress
//! point" requirement -- spec 004 identifies this as the pre-egress control
//! blocking AI extraction; this module is it). Runs on every document's
//! extracted text BEFORE any content reaches `openai_client` -- see
//! `super::extract_intake`/`extract_team_fields`, the only two call sites
//! that ever construct an outbound OpenAI request, both of which check
//! `scan().is_empty()` first and refuse to proceed otherwise.
//!
//! Heuristic, not exhaustive: regex/keyword pattern matching, the same
//! honesty posture already established elsewhere in this product for this
//! exact class of tool -- `frontend/scripts/check-phi-lint.mjs`'s own doc
//! comment: "a clean run is not proof of no PHI/PII... treat it as a
//! tripwire". A false negative here is possible (PHI phrased in a way none
//! of these patterns catch); a false positive blocks a legitimate document
//! and asks a human to redact and paste text instead -- the safe failure
//! direction for a healthcare governance product.

use std::sync::LazyLock;

use regex::Regex;

#[derive(Debug, Clone, serde::Serialize)]
pub struct PhiFinding {
    /// Machine-readable finding kind (`ssn`, `mrn`, `dob`, `patient_name_field`,
    /// `email`, `phone`), never the matched text itself.
    pub kind: &'static str,
    /// One-line human description, safe to show in a UI block message --
    /// never includes the matched substring.
    pub description: &'static str,
}

/// US Social Security Number, with or without dashes (###-##-####).
static SSN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\b\d{3}-?\d{2}-?\d{4}\b").expect("ssn regex"));

/// "MRN", "Medical Record Number/No." followed by a run of digits.
static MRN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b(?:mrn|medical\s+record\s+(?:number|no\.?))\s*[:#]?\s*\d{4,}")
        .expect("mrn regex")
});

/// "DOB" / "Date of Birth" followed by anything date-shaped.
static DOB: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b(?:dob|date\s+of\s+birth)\s*[:]?\s*\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}")
        .expect("dob regex")
});

/// Explicit "Patient Name:" / "Patient:" label -- the field itself is the
/// signal, regardless of what follows it.
static PATIENT_NAME_FIELD: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\bpatient\s*(?:name)?\s*:\s*\S").expect("patient name field regex")
});

/// Email address.
static EMAIL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b").expect("email regex"));

/// US-shaped phone number.
static PHONE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b").expect("phone regex")
});

/// Scan `text` for PHI/PII indicators. An empty result means "no indicator
/// matched" -- NOT "confirmed free of PHI"; see the module doc comment.
/// Findings never carry the matched substring, only the pattern kind, so a
/// finding is always safe to log/return without itself becoming a leak.
pub fn scan(text: &str) -> Vec<PhiFinding> {
    let mut findings = Vec::new();
    if SSN.is_match(text) {
        findings.push(PhiFinding {
            kind: "ssn",
            description: "Contains a Social Security Number-shaped value",
        });
    }
    if MRN.is_match(text) {
        findings.push(PhiFinding {
            kind: "mrn",
            description: "Contains a Medical Record Number label",
        });
    }
    if DOB.is_match(text) {
        findings.push(PhiFinding {
            kind: "dob",
            description: "Contains a Date of Birth label",
        });
    }
    if PATIENT_NAME_FIELD.is_match(text) {
        findings.push(PhiFinding {
            kind: "patient_name_field",
            description: "Contains an explicit \"Patient Name\" field",
        });
    }
    if EMAIL.is_match(text) {
        findings.push(PhiFinding {
            kind: "email",
            description: "Contains an email address",
        });
    }
    if PHONE.is_match(text) {
        findings.push(PhiFinding {
            kind: "phone",
            description: "Contains a phone number-shaped value",
        });
    }
    findings
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clean_business_text_has_no_findings() {
        let text = "This project proposes migrating the intake portal to a new \
                     governance workflow engine, reducing manual review time by 30%.";
        assert!(scan(text).is_empty());
    }

    #[test]
    fn ssn_is_detected() {
        let findings = scan("Employee SSN: 123-45-6789 on file.");
        assert!(findings.iter().any(|f| f.kind == "ssn"));
    }

    #[test]
    fn ssn_without_dashes_is_detected() {
        let findings = scan("SSN 123456789 recorded.");
        assert!(findings.iter().any(|f| f.kind == "ssn"));
    }

    #[test]
    fn mrn_label_is_detected() {
        let findings = scan("MRN: 00482913, admitted for review.");
        assert!(findings.iter().any(|f| f.kind == "mrn"));
    }

    #[test]
    fn dob_label_is_detected() {
        let findings = scan("Date of Birth: 04/12/1985");
        assert!(findings.iter().any(|f| f.kind == "dob"));
    }

    #[test]
    fn patient_name_field_is_detected() {
        let findings = scan("Patient Name: Jordan Casey");
        assert!(findings.iter().any(|f| f.kind == "patient_name_field"));
    }

    #[test]
    fn email_is_detected() {
        let findings = scan("Contact the sponsor at alex.sponsor@abchealth.com for details.");
        assert!(findings.iter().any(|f| f.kind == "email"));
    }

    #[test]
    fn phone_is_detected() {
        let findings = scan("Reach the requestor at (555) 123-4567.");
        assert!(findings.iter().any(|f| f.kind == "phone"));
    }

    #[test]
    fn findings_never_carry_the_matched_text() {
        let findings = scan("SSN: 123-45-6789");
        for f in &findings {
            assert!(!f.description.contains("123-45-6789"));
        }
    }
}
