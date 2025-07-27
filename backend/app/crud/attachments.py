import os
import time
import hashlib
import logging
import shutil
from typing import List, Dict, Any, Optional

from trac.env import Environment
from .. import schemas
from fastapi import UploadFile

logger = logging.getLogger(__name__)

def get_attachments_for_ticket(env: Environment, ticket_id: int) -> List[Dict[str, Any]]:
    """Retrieve attachments for a given ticket from the Trac database."""
    with env.db_transaction as db:
        cursor = db.cursor()
        cursor.execute("""
            SELECT filename, size, description, author, time
            FROM attachment 
            WHERE type = %s AND id = %s
            ORDER BY time DESC 
            LIMIT 20
        """, ("ticket", ticket_id))
        
        attachments = []
        for row in cursor.fetchall():
            raw_timestamp = row[4]
            uploaded_timestamp = int(time.time())
            if raw_timestamp is not None:
                try:
                    timestamp_int = int(raw_timestamp)
                    if timestamp_int > 9999999999:
                        uploaded_timestamp = timestamp_int // 1000000
                    else:
                        uploaded_timestamp = timestamp_int
                    if uploaded_timestamp < 946684800 or uploaded_timestamp > 2524608000:
                        logger.warning(f"Invalid timestamp {uploaded_timestamp} for attachment {row[0]}, using current time")
                        uploaded_timestamp = int(time.time())
                except (ValueError, TypeError) as e:
                    logger.warning(f"Failed to parse timestamp {raw_timestamp} for attachment {row[0]}: {e}")
            
            attachments.append({
                "filename": row[0],
                "size": row[1],
                "description": row[2],
                "author": row[3],
                "uploaded": uploaded_timestamp
            })
    return attachments

def get_attachment_by_filename(env: Environment, ticket_id: int, filename: str) -> Optional[Dict[str, Any]]:
    """Get a single attachment by its filename."""
    with env.db_transaction as db:
        cursor = db.cursor()
        cursor.execute("""
            SELECT filename, size, description, author
            FROM attachment 
            WHERE type = %s AND id = %s AND filename = %s
        """, ("ticket", ticket_id, filename))
        
        attachment_row = cursor.fetchone()
        if not attachment_row:
            return None
        
        return {
            'filename': attachment_row[0],
            'size': attachment_row[1],
            'description': attachment_row[2],
            'author': attachment_row[3]
        }

def create_attachment(env: Environment, ticket_id: int, file: UploadFile, description: str, user: schemas.ClerkUser) -> schemas.AttachmentModel:
    """Create a new attachment for a ticket."""
    
    # Sanitize filename
    safe_filename = os.path.basename(file.filename).strip()

    # Hashing for directory and filename
    ticket_id_str = str(ticket_id)
    hash_obj = hashlib.sha1(ticket_id_str.encode('utf-8'))
    hash_hex = hash_obj.hexdigest()
    
    upload_dir = os.path.join(env.path, "attachments", "ticket", hash_hex[0:3], hash_hex)
    os.makedirs(upload_dir, exist_ok=True)
    
    filename_hash = hashlib.sha1(safe_filename.encode('utf-8')).hexdigest()
    if '.' in safe_filename:
        extension = safe_filename.rsplit('.', 1)[1]
        hashed_filename = f"{filename_hash}.{extension}"
    else:
        hashed_filename = filename_hash
    
    file_path = os.path.join(upload_dir, hashed_filename)
    
    current_time = int(time.time() * 1000000)
    
    with env.db_transaction as db:
        # Save file to disk
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            logger.error(f"Failed to save file {file_path}: {str(e)}")
            raise IOError("Failed to save uploaded file")

        # Insert attachment record into database
        cursor = db.cursor()
        cursor.execute("""
            INSERT INTO attachment (type, id, filename, size, time, description, author)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            "ticket",
            ticket_id_str,
            safe_filename,
            file.size,
            current_time,
            description or "",
            user.email
        ))
        logger.info(f"Uploaded attachment '{safe_filename}' to ticket {ticket_id} by user {user.email}")
        
    return schemas.AttachmentModel(
        filename=safe_filename,
        size=file.size,
        description=description or "",
        author=user.email,
        uploaded=current_time // 1000000
    )

def delete_attachment_from_db(env: Environment, ticket_id: int, filename: str) -> bool:
    """Delete an attachment from the Trac database and filesystem."""
    
    # Hashing for directory and filename
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

    with env.db_transaction as db:
        cursor = db.cursor()
        cursor.execute("""
            DELETE FROM attachment 
            WHERE type = %s AND id = %s AND filename = %s
        """, ("ticket", ticket_id, filename))
        
        if cursor.rowcount == 0:
            return False

        if os.path.isfile(file_path):
            try:
                os.unlink(file_path)
                logger.info(f"Deleted attachment file: {file_path}")
            except OSError as e:
                logger.error(f"Failed to delete attachment file {file_path}: {str(e)}")
        else:
            logger.warning(f"Attachment file not found on disk during deletion: {file_path}")
            
    return True 