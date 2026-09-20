import hashlib
import json
import logging
import requests

logger = logging.getLogger(__name__)

KV_BUCKET = "Jot8gVLJp1RNeoVKYQSPFD"
BASE_KV_URL = f"https://kvdb.io/{KV_BUCKET}"

def _storage_key(identifier: str) -> str:
    norm = str(identifier).strip().lower()
    return "usr_" + hashlib.sha256(norm.encode("utf-8")).hexdigest()[:24]

def save_cloud_user(identifier: str, user_data: dict) -> bool:
    """Persists user authentication record to cloud sync store across serverless containers."""
    key = _storage_key(identifier)
    try:
        payload = json.dumps(user_data)
        res = requests.post(f"{BASE_KV_URL}/{key}", data=payload, timeout=2.5)
        if res.status_code in [200, 201]:
            logger.info("Successfully synced user %s to cloud store", identifier)
            return True
        logger.warning("Cloud store write returned %s for %s", res.status_code, identifier)
    except Exception as e:
        logger.warning("Cloud store write error for %s: %s", identifier, str(e))
    return False

def get_cloud_user(identifier: str) -> dict | None:
    """Retrieves user authentication record from cloud sync store across serverless containers."""
    key = _storage_key(identifier)
    try:
        res = requests.get(f"{BASE_KV_URL}/{key}", timeout=2.5)
        if res.status_code == 200 and res.text:
            return res.json()
    except Exception as e:
        logger.warning("Cloud store read error for %s: %s", identifier, str(e))
    return None

def delete_cloud_user(identifier: str) -> bool:
    """Deletes user authentication record from cloud sync store."""
    key = _storage_key(identifier)
    try:
        res = requests.delete(f"{BASE_KV_URL}/{key}", timeout=2.5)
        return res.status_code in [200, 204, 404]
    except Exception as e:
        logger.warning("Cloud store delete error for %s: %s", identifier, str(e))
    return False

