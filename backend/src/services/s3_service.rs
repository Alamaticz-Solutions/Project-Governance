use aws_config::BehaviorVersion;
use aws_sdk_s3::{Client, primitives::ByteStream};
use uuid::Uuid;

use crate::{config::AppConfig, error::{AppError, AppResult}};

pub struct S3Service {
    client: Client,
    bucket_name: String,
}

impl S3Service {
    pub async fn new(config: &AppConfig) -> Self {
        let aws_config = aws_config::load_defaults(BehaviorVersion::latest()).await;
        let client = Client::new(&aws_config);
        
        Self {
            client,
            // Fallback to a default bucket if not set in config, or we can add it to config
            bucket_name: "governance-attachments".to_string(), 
        }
    }

    pub async fn upload_file(&self, file_name: &str, content_type: &str, data: Vec<u8>) -> AppResult<String> {
        let key = format!("{}-{}", Uuid::new_v4(), file_name);
        
        self.client
            .put_object()
            .bucket(&self.bucket_name)
            .key(&key)
            .content_type(content_type)
            .body(ByteStream::from(data))
            .send()
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("S3 upload failed: {}", e)))?;

        // Return the S3 URL
        Ok(format!("s3://{}/{}", self.bucket_name, key))
    }

    pub async fn get_presigned_url(&self, key: &str) -> AppResult<String> {
        let presigned_request = self.client
            .get_object()
            .bucket(&self.bucket_name)
            .key(key)
            .presigned(aws_sdk_s3::presigning::PresigningConfig::expires_in(std::time::Duration::from_secs(3600)).unwrap())
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to generate presigned URL: {}", e)))?;

        Ok(presigned_request.uri().to_string())
    }
}
