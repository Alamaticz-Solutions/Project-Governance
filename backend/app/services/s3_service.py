"""S3 storage for meeting artifacts (raw uploads and generated BPMN files)."""
import boto3
from botocore.exceptions import ClientError
import logging
import os

from app.core.config import settings

logger = logging.getLogger(__name__)

_s3_client = None


def is_s3_configured() -> bool:
    """Check if AWS credentials are provided and not the default placeholders."""
    return bool(
        settings.AWS_ACCESS_KEY_ID 
        and settings.AWS_ACCESS_KEY_ID != "your-aws-access-key"
        and settings.AWS_SECRET_ACCESS_KEY
        and settings.AWS_SECRET_ACCESS_KEY != "your-aws-secret"
    )


def get_s3_client():
    global _s3_client
    if _s3_client is None:
        if is_s3_configured():
            _s3_client = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION,
            )
    return _s3_client


def upload_file(file_bytes: bytes, key: str, content_type: str = "application/octet-stream") -> str:
    """Uploads bytes to S3 under `key` and returns the object's URL. Falls back to local storage if S3 is not configured."""
    if is_s3_configured():
        client = get_s3_client()
        try:
            client.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
            )
        except ClientError as e:
            logger.error(f"S3 upload failed for key {key}: {e}")
            raise
        return f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"
    else:
        logger.info(f"S3 not configured, storing locally for key: {key}")
        local_dir = os.path.join(os.getcwd(), "uploads")
        local_path = os.path.join(local_dir, key)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(file_bytes)
        # Using a mock S3-like local URL that can be identified if needed
        return f"file://{local_path.replace(chr(92), '/')}"


def get_file_bytes(key: str) -> bytes:
    """Fetches an object's bytes back from S3. Falls back to local storage if S3 is not configured."""
    if is_s3_configured():
        client = get_s3_client()
        try:
            response = client.get_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
            return response["Body"].read()
        except ClientError as e:
            logger.error(f"S3 fetch failed for key {key}: {e}")
            raise
    else:
        local_dir = os.path.join(os.getcwd(), "uploads")
        local_path = os.path.join(local_dir, key)
        if os.path.exists(local_path):
            with open(local_path, "rb") as f:
                return f.read()
        else:
            logger.error(f"Local file not found for key: {key}")
            raise Exception(f"Local file not found for key: {key}")
