from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from typing import List, Optional
from trac.env import Environment
import os
import mimetypes
import urllib.parse
import hashlib

from .. import schemas, security
from ..crud import attachments as crud_attachments, tickets as crud_tickets
from ..core.dependencies import get_trac_env

router = APIRouter()

@router.get(
    "/tickets/{ticket_id}/attachments",
    response_model=schemas.AttachmentListResponse,
    tags=["Attachments"]
)
async def get_ticket_attachments(
    ticket_id: int,
    user: schemas.ClerkUser = Depends(security.require_auth),
    env: Environment = Depends(get_trac_env)
):
    ticket_data = await crud_tickets.check_ticket_ownership(env, ticket_id, user)
    
    if ticket_data is None:
        if crud_tickets.get_ticket_by_id(env, ticket_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Ticket {ticket_id} not found")
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    attachments = crud_attachments.get_attachments_for_ticket(env, ticket_id)
    return schemas.AttachmentListResponse(
        status="success",
        ticket_id=ticket_id,
        attachments=[schemas.AttachmentModel(**attachment) for attachment in attachments],
        total_count=len(attachments)
    )

@router.get(
    "/tickets/{ticket_id}/attachments/{filename}/download",
    tags=["Attachments"]
)
async def download_ticket_attachment(
    ticket_id: int,
    filename: str,
    user: schemas.ClerkUser = Depends(security.require_auth),
    env: Environment = Depends(get_trac_env)
):
    ticket_data = await crud_tickets.check_ticket_ownership(env, ticket_id, user)
    
    if ticket_data is None:
        if crud_tickets.get_ticket_by_id(env, ticket_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Ticket {ticket_id} not found")
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    if not crud_attachments.get_attachment_by_filename(env, ticket_id, filename):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Attachment '{filename}' not found for ticket {ticket_id}")

    ticket_id_str = str(ticket_id)
    hash_obj = hashlib.sha1(ticket_id_str.encode('utf-8'))
    hash_hex = hash_obj.hexdigest()
    
    filename_hash = hashlib.sha1(filename.encode('utf-8')).hexdigest()
    if '.' in filename:
        extension = filename.rsplit('.', 1)[1]
        hashed_filename = f"{filename_hash}.{extension}"
    else:
        hashed_filename = filename_hash
    
    attachments_dir = os.path.join(env.path, "attachments")
    file_path = os.path.join(attachments_dir, "ticket", hash_hex[0:3], hash_hex, hashed_filename)

    if not os.path.isfile(file_path):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Attachment file '{filename}' not found on server")

    content_type, _ = mimetypes.guess_type(filename)
    if content_type is None:
        content_type = "application/octet-stream"

    try:
        ascii_filename = filename.encode('ascii').decode('ascii')
        content_disposition = f"attachment; filename=\"{ascii_filename}\""
    except UnicodeEncodeError:
        encoded_filename = urllib.parse.quote(filename.encode('utf-8'))
        content_disposition = f"attachment; filename*=UTF-8''{encoded_filename}"

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=content_type,
        headers={
            "Content-Disposition": content_disposition,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

@router.post(
    "/tickets/{ticket_id}/attachments",
    response_model=schemas.AttachmentCreateResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Attachments"]
)
async def upload_ticket_attachment(
    ticket_id: int,
    file: UploadFile = File(...),
    description: Optional[str] = "",
    user: schemas.ClerkUser = Depends(security.require_auth),
    env: Environment = Depends(get_trac_env)
):
    # File validation
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    ALLOWED_MIME_TYPES = {
        "image/png", "image/jpeg", "image/jpg", "image/gif",
        "application/pdf", "text/plain", 
        "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/zip", "application/x-zip-compressed"
    }

    if not file.size or file.size > MAX_FILE_SIZE:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File size limit exceeded")
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "File type not allowed")
    if not file.filename or not os.path.basename(file.filename).strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid filename")

    ticket_data = await crud_tickets.check_ticket_ownership(env, ticket_id, user)
    if ticket_data is None:
        if crud_tickets.get_ticket_by_id(env, ticket_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Ticket {ticket_id} not found")
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    if crud_attachments.get_attachment_by_filename(env, ticket_id, os.path.basename(file.filename).strip()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File with this name already exists for this ticket")

    try:
        attachment = crud_attachments.create_attachment(env, ticket_id, file, description, user)
    except IOError as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(e))

    return schemas.AttachmentCreateResponse(
        status="success",
        message="File uploaded successfully",
        attachment=attachment
    )

@router.delete(
    "/tickets/{ticket_id}/attachments/{filename}",
    tags=["Attachments"]
)
async def delete_ticket_attachment(
    ticket_id: int,
    filename: str,
    user: schemas.ClerkUser = Depends(security.require_auth),
    env: Environment = Depends(get_trac_env)
):
    ticket_data = await crud_tickets.check_ticket_ownership(env, ticket_id, user)
    
    if ticket_data is None:
        if crud_tickets.get_ticket_by_id(env, ticket_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Ticket {ticket_id} not found")
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    if not crud_attachments.get_attachment_by_filename(env, ticket_id, filename):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Attachment '{filename}' not found for ticket {ticket_id}")

    if not crud_attachments.delete_attachment_from_db(env, ticket_id, filename):
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to delete attachment from database")
    
    return {
        "status": "success",
        "message": "Attachment deleted successfully",
        "filename": filename,
        "ticket_id": ticket_id
    } 