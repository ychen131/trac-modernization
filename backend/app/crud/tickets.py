import time
import logging
from typing import List, Dict, Any, Optional

from trac.env import Environment
from .. import schemas

logger = logging.getLogger(__name__)

def get_tickets_for_user(env: Environment, user: schemas.ClerkUser) -> List[Dict[str, Any]]:
    """Retrieve tickets for a given user from the Trac database."""
    with env.db_transaction as db:
        cursor = db.cursor()
        cursor.execute("""
            SELECT id, summary, status, priority, reporter, owner, time
            FROM ticket 
            WHERE owner = %s OR reporter = %s
            ORDER BY time DESC 
            LIMIT 20
        """, (user.email, user.email))
        
        tickets = []
        for row in cursor.fetchall():
            raw_timestamp = row[6]
            created_timestamp = raw_timestamp
            
            if raw_timestamp is not None:
                try:
                    timestamp_int = int(raw_timestamp)
                    if timestamp_int > 9999999999:
                        created_timestamp = timestamp_int // 1000000
                    else:
                        created_timestamp = timestamp_int
                    
                    if created_timestamp < 946684800 or created_timestamp > 2524608000:
                        logger.warning(f"Invalid timestamp {created_timestamp} for ticket {row[0]}, using current time")
                        created_timestamp = int(time.time())
                except (ValueError, TypeError) as e:
                    logger.warning(f"Failed to parse timestamp {raw_timestamp} for ticket {row[0]}: {e}")
                    created_timestamp = int(time.time())
            else:
                created_timestamp = int(time.time())
            
            tickets.append({
                "id": row[0],
                "summary": row[1],
                "status": row[2],
                "priority": row[3],
                "reporter": row[4],
                "owner": row[5],
                "created": created_timestamp
            })
    return tickets

def create_new_ticket(env: Environment, ticket_data: schemas.TicketCreateRequest, user: schemas.ClerkUser) -> schemas.TicketModel:
    """Create a new ticket in the Trac database."""
    with env.db_transaction as db:
        cursor = db.cursor()
        current_time = int(time.time() * 1000000)
        
        cursor.execute("""
            INSERT INTO ticket (type, time, changetime, component, priority, owner, reporter, status, summary, description)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            "task",
            current_time,
            current_time,
            ticket_data.component,
            ticket_data.priority,
            "",
            user.email,
            ticket_data.status,
            ticket_data.summary,
            ticket_data.description
        ))
        
        ticket_id = cursor.lastrowid
        logger.info(f"Created ticket {ticket_id} for user {user.email}")
    
    return schemas.TicketModel(
        id=ticket_id,
        summary=ticket_data.summary,
        status=ticket_data.status,
        priority=ticket_data.priority,
        reporter=user.email,
        owner="",
        created=current_time // 1000000
    )

def update_ticket_in_db(env: Environment, ticket_id: int, update_data: schemas.TicketUpdateRequest) -> Optional[schemas.TicketModel]:
    """Update a ticket in the Trac database."""
    update_fields = []
    update_values = []

    if update_data.status is not None:
        update_fields.append("status = %s")
        update_values.append(update_data.status)
    if update_data.priority is not None:
        update_fields.append("priority = %s")
        update_values.append(update_data.priority)
    if update_data.owner is not None:
        update_fields.append("owner = %s")
        update_values.append(update_data.owner)
    if update_data.summary is not None:
        update_fields.append("summary = %s")
        update_values.append(update_data.summary)
    if update_data.description is not None:
        update_fields.append("description = %s")
        update_values.append(update_data.description)

    if not update_fields:
        return None

    current_time = int(time.time() * 1000000)
    update_fields.append("changetime = %s")
    update_values.append(current_time)
    update_values.append(ticket_id)

    with env.db_transaction as db:
        cursor = db.cursor()
        update_query = f"UPDATE ticket SET {', '.join(update_fields)} WHERE id = %s"
        cursor.execute(update_query, update_values)

        cursor.execute("""
            SELECT id, summary, status, priority, reporter, owner, time
            FROM ticket 
            WHERE id = %s
        """, (ticket_id,))
        
        updated_row = cursor.fetchone()
        if not updated_row:
            return None
        
        raw_timestamp = updated_row[6]
        created_timestamp = int(time.time())
        if raw_timestamp is not None:
            try:
                timestamp_int = int(raw_timestamp)
                if timestamp_int > 9999999999:
                    created_timestamp = timestamp_int // 1000000
                else:
                    created_timestamp = timestamp_int
            except (ValueError, TypeError):
                pass
        
        return schemas.TicketModel(
            id=updated_row[0],
            summary=updated_row[1],
            status=updated_row[2],
            priority=updated_row[3],
            reporter=updated_row[4],
            owner=updated_row[5],
            created=created_timestamp
        )

def delete_ticket_from_db(env: Environment, ticket_id: int) -> bool:
    """Delete a ticket from the Trac database."""
    with env.db_transaction as db:
        cursor = db.cursor()
        cursor.execute("DELETE FROM ticket WHERE id = %s", (ticket_id,))
        return cursor.rowcount > 0

def get_ticket_by_id(env: Environment, ticket_id: int) -> Optional[Dict[str, Any]]:
    """Get a single ticket by its ID."""
    with env.db_transaction as db:
        cursor = db.cursor()
        cursor.execute("""
            SELECT id, summary, status, priority, reporter, owner, time, description
            FROM ticket 
            WHERE id = %s
        """, (ticket_id,))
        
        ticket_row = cursor.fetchone()
        if not ticket_row:
            return None
        
        return {
            'id': ticket_row[0],
            'summary': ticket_row[1],
            'status': ticket_row[2],
            'priority': ticket_row[3],
            'reporter': ticket_row[4],
            'owner': ticket_row[5],
            'time': ticket_row[6],
            'description': ticket_row[7] if len(ticket_row) > 7 else ""
        } 