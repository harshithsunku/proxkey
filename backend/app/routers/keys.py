"""SSH public key CRUD endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from ..database import get_session
from ..models import SSHKey, SSHKeyCreate, SSHKeyRead, AuditLog
from ..services.injector import compute_fingerprint

router = APIRouter(prefix="/api/keys", tags=["keys"])


@router.get("", response_model=list[SSHKeyRead])
def list_keys(session: Session = Depends(get_session)):
    """List all stored SSH public keys."""
    return session.exec(select(SSHKey).order_by(SSHKey.created_at.desc())).all()


@router.get("/{key_id}", response_model=SSHKeyRead)
def get_key(key_id: int, session: Session = Depends(get_session)):
    """Get a single SSH public key by ID."""
    key = session.get(SSHKey, key_id)
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    return key


@router.post("", response_model=SSHKeyRead, status_code=201)
def create_key(data: SSHKeyCreate, session: Session = Depends(get_session)):
    """Store a new SSH public key."""
    # Validate key format
    parts = data.public_key.strip().split()
    if len(parts) < 2 or not parts[0].startswith("ssh-"):
        raise HTTPException(status_code=422, detail="Invalid SSH public key format")

    # Check for duplicate
    existing = session.exec(
        select(SSHKey).where(SSHKey.public_key == data.public_key.strip())
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Key already exists with name '{existing.name}'")

    fingerprint = compute_fingerprint(data.public_key)
    key = SSHKey(
        name=data.name,
        public_key=data.public_key.strip(),
        fingerprint=fingerprint,
        is_default=data.is_default,
    )

    # If this key is set as default, unset other defaults
    if key.is_default:
        for k in session.exec(select(SSHKey).where(SSHKey.is_default == True)).all():
            k.is_default = False
            session.add(k)

    session.add(key)
    session.add(AuditLog(action="key_created", target=key.name, detail=f"fingerprint={fingerprint}"))
    session.commit()
    session.refresh(key)
    return key


@router.put("/{key_id}", response_model=SSHKeyRead)
def update_key(key_id: int, data: SSHKeyCreate, session: Session = Depends(get_session)):
    """Update an existing SSH public key."""
    key = session.get(SSHKey, key_id)
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")

    key.name = data.name
    key.public_key = data.public_key.strip()
    key.fingerprint = compute_fingerprint(data.public_key)
    key.is_default = data.is_default

    if key.is_default:
        for k in session.exec(select(SSHKey).where(SSHKey.is_default == True, SSHKey.id != key_id)).all():
            k.is_default = False
            session.add(k)

    session.add(key)
    session.commit()
    session.refresh(key)
    return key


@router.delete("/{key_id}", status_code=204)
def delete_key(key_id: int, session: Session = Depends(get_session)):
    """Delete an SSH public key."""
    key = session.get(SSHKey, key_id)
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")

    session.add(AuditLog(action="key_deleted", target=key.name))
    session.delete(key)
    session.commit()
