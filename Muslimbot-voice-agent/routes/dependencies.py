from fastapi import HTTPException, Security, status, Header, Depends
from fastapi.security import APIKeyHeader
from typing import Optional
from services.config import KB_BFF_API_KEY, ENVIRONMENT, TENANT_ID

API_KEY_NAME = "X-KB-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

async def verify_kb_api_key(api_key_header: str = Security(api_key_header)) -> str:
    """Verify that the provided API key matches KB_BFF_API_KEY.
    In production, KB_BFF_API_KEY must be configured and matching.
    In development, if KB_BFF_API_KEY is not set, we allow the request.
    """
    if ENVIRONMENT.lower() == "production":
        if not KB_BFF_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Production environment requires KB_BFF_API_KEY to be set.",
            )
        if api_key_header != KB_BFF_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Could not validate credentials"
            )
    else:
        # Development mode
        if KB_BFF_API_KEY and api_key_header != KB_BFF_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Could not validate credentials"
            )
    return api_key_header or ""

async def get_tenant_id(x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-Id")) -> str:
    """Resolve tenant ID per request from header, falling back to env var."""
    return x_tenant_id or TENANT_ID
