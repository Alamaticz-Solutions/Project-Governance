//! Decode an uploaded document into plain text, before the PHI gate ever
//! sees it. Supports `.txt` (direct UTF-8) and `.pdf` (via `pdf-extract`,
//! pure Rust, no system dependency). `.docx` is NOT supported yet -- Dev's
//! own upload UI advertised "PDF, DOCX, TXT"; DOCX was dropped from this
//! port's initial scope rather than adding a heavier dependency
//! mid-session. A caller can still paste text directly (`payload.text`),
//! which every gate form and the intake screen already support as the
//! primary path.

use base64::Engine as _;

#[derive(Debug, thiserror::Error)]
pub enum ExtractError {
    #[error("no text or file content was provided")]
    Empty,
    #[error("file content was not valid base64")]
    InvalidBase64,
    #[error(".txt content was not valid UTF-8")]
    InvalidUtf8,
    #[error("failed to extract text from the PDF: {0}")]
    PdfExtraction(String),
    #[error("unsupported file type `{0}` -- upload a .txt or .pdf, or paste text directly")]
    UnsupportedType(String),
}

/// `payload` shape (matches what `AIPopulationDropzone` sends): either
/// `{ "text": "..." }` (pasted text, no file), or
/// `{ "filename": "...", "mime_type": "...", "content_base64": "..." }`
/// (an uploaded file). `filename`'s extension is the fallback classifier
/// when `mime_type` is absent or generic (`application/octet-stream`).
pub fn extract_text(payload: &serde_json::Value) -> Result<String, ExtractError> {
    if let Some(text) = payload.get("text").and_then(|v| v.as_str()) {
        let trimmed = text.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
        }
    }

    let Some(content_base64) = payload.get("content_base64").and_then(|v| v.as_str()) else {
        return Err(ExtractError::Empty);
    };
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(content_base64)
        .map_err(|_| ExtractError::InvalidBase64)?;

    let filename = payload
        .get("filename")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let mime_type = payload
        .get("mime_type")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let extension = filename
        .rsplit('.')
        .next()
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();

    let is_pdf = mime_type == "application/pdf" || extension == "pdf";
    let is_txt = mime_type.starts_with("text/") || extension == "txt";

    if is_pdf {
        return pdf_extract::extract_text_from_mem(&bytes)
            .map_err(|e| ExtractError::PdfExtraction(e.to_string()));
    }
    if is_txt {
        return String::from_utf8(bytes).map_err(|_| ExtractError::InvalidUtf8);
    }
    if extension == "docx" {
        return Err(ExtractError::UnsupportedType("docx".to_string()));
    }
    Err(ExtractError::UnsupportedType(
        if extension.is_empty() {
            mime_type.to_string()
        } else {
            extension
        },
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn pasted_text_passes_through_trimmed() {
        let out = extract_text(&json!({ "text": "  Hello world  \n" })).unwrap();
        assert_eq!(out, "Hello world");
    }

    #[test]
    fn empty_text_falls_through_to_missing_content() {
        let err = extract_text(&json!({ "text": "   " })).unwrap_err();
        assert!(matches!(err, ExtractError::Empty));
    }

    #[test]
    fn txt_file_decodes_as_utf8() {
        let encoded = base64::engine::general_purpose::STANDARD.encode(b"plain text content");
        let out = extract_text(&json!({
            "filename": "notes.txt",
            "mime_type": "text/plain",
            "content_base64": encoded
        }))
        .unwrap();
        assert_eq!(out, "plain text content");
    }

    #[test]
    fn docx_is_explicitly_unsupported() {
        let encoded = base64::engine::general_purpose::STANDARD.encode(b"not a real docx");
        let err = extract_text(&json!({
            "filename": "proposal.docx",
            "content_base64": encoded
        }))
        .unwrap_err();
        assert!(matches!(err, ExtractError::UnsupportedType(ref t) if t == "docx"));
    }

    #[test]
    fn unknown_type_is_rejected() {
        let encoded = base64::engine::general_purpose::STANDARD.encode(b"???");
        let err = extract_text(&json!({
            "filename": "image.png",
            "content_base64": encoded
        }))
        .unwrap_err();
        assert!(matches!(err, ExtractError::UnsupportedType(_)));
    }

    #[test]
    fn invalid_base64_is_rejected() {
        let err = extract_text(&json!({
            "filename": "notes.txt",
            "content_base64": "not-valid-base64!!"
        }))
        .unwrap_err();
        assert!(matches!(err, ExtractError::InvalidBase64));
    }
}
