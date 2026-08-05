"""Smart Hybrid Storage for meeting artifacts (AWS S3 with Local Fallback)."""
import boto3
from botocore.exceptions import ClientError
import logging
from pathlib import Path
import os

from app.core.config import settings

logger = logging.getLogger(__name__)

_s3_client = None

# Set up local uploads directory for fallback
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def get_s3_client():
    global _s3_client
    # Only initialize if we actually have AWS keys
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        if _s3_client is None:
            try:
                _s3_client = boto3.client(
                    "s3",
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                    region_name=settings.AWS_REGION,
                )
            except Exception as e:
                logger.warning(f"Failed to initialize S3 client: {e}")
                return None
        return _s3_client
    return None


def upload_file(file_bytes: bytes, key: str, content_type: str = "application/octet-stream") -> str:
    """Try S3 first, seamlessly fallback to local disk on failure or missing keys."""
    client = get_s3_client()
    
    if client:
        try:
            client.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
            )
            return f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"
        except Exception as e:
            logger.warning(f"S3 upload failed, falling back to local storage. Error: {e}")
    else:
        logger.info("No valid AWS credentials found. Using local storage fallback.")

    # Local fallback
    try:
        file_path = UPLOAD_DIR / key
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(file_bytes)
        return f"http://localhost:8000/uploads/{key}"
    except Exception as e:
        logger.error(f"Local fallback upload failed for key {key}: {e}")
        raise


def get_file_bytes(key: str) -> bytes:
    """Try S3 first, fallback to local disk."""
    client = get_s3_client()
    
    if client:
        try:
            response = client.get_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
            return response["Body"].read()
        except Exception as e:
            logger.warning(f"S3 fetch failed, trying local fallback. Error: {e}")
            
    # Local fallback
    file_path = UPLOAD_DIR / key
    try:
        with open(file_path, "rb") as f:
            return f.read()
    except Exception as e:
        logger.error(f"Local fallback fetch failed for key {key}: {e}")
        raise
