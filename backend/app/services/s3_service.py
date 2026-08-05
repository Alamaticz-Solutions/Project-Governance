"""S3 storage for meeting artifacts (raw uploads and generated BPMN files)."""
import boto3
from botocore.exceptions import ClientError
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

_s3_client = None


def get_s3_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
    return _s3_client


def upload_file(file_bytes: bytes, key: str, content_type: str = "application/octet-stream") -> str:
    """Uploads bytes to S3 under `key` and returns the object's URL."""
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


def get_file_bytes(key: str) -> bytes:
    """Fetches an object's bytes back from S3."""
    client = get_s3_client()
    try:
        response = client.get_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
        return response["Body"].read()
    except ClientError as e:
        logger.error(f"S3 fetch failed for key {key}: {e}")
        raise
