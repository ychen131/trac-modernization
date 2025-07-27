from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from trac.env import Environment

from .. import schemas, security
from ..crud import tickets as crud_tickets
from ..core.dependencies import get_trac_env

router = APIRouter()

@router.get(
    "/tickets",
    response_model=schemas.TicketsResponse,
    tags=["Tickets"]
)
async def get_tickets(
    user: schemas.ClerkUser = Depends(security.require_auth),
    env: Environment = Depends(get_trac_env)
):
    tickets = crud_tickets.get_tickets_for_user(env, user)
    return schemas.TicketsResponse(
        status="success",
        user_id=user.user_id,
        user_email=user.email,
        tickets=[schemas.TicketModel(**ticket) for ticket in tickets],
        total_count=len(tickets)
    )

@router.post(
    "/tickets",
    response_model=schemas.TicketCreateResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Tickets"]
)
async def create_ticket(
    ticket_data: schemas.TicketCreateRequest,
    user: schemas.ClerkUser = Depends(security.require_auth),
    env: Environment = Depends(get_trac_env)
):
    created_ticket = crud_tickets.create_new_ticket(env, ticket_data, user)
    return schemas.TicketCreateResponse(
        status="success",
        message="Ticket created successfully",
        ticket=created_ticket
    )

@router.patch(
    "/tickets/{ticket_id}",
    response_model=schemas.TicketUpdateResponse,
    tags=["Tickets"]
)
async def update_ticket(
    ticket_id: int,
    update_data: schemas.TicketUpdateRequest,
    user: schemas.ClerkUser = Depends(security.require_auth),
    env: Environment = Depends(get_trac_env)
):
    ticket_data = await crud_tickets.check_ticket_ownership(env, ticket_id, user)
    
    if ticket_data is None:
        if crud_tickets.get_ticket_by_id(env, ticket_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Ticket {ticket_id} not found")
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    updated_ticket = crud_tickets.update_ticket_in_db(env, ticket_id, update_data)
    if updated_ticket is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No valid fields provided for update")

    return schemas.TicketUpdateResponse(
        status="success",
        message="Ticket updated successfully",
        ticket=updated_ticket
    )

@router.delete(
    "/tickets/{ticket_id}",
    response_model=schemas.TicketDeleteResponse,
    tags=["Tickets"]
)
async def delete_ticket(
    ticket_id: int,
    user: schemas.ClerkUser = Depends(security.require_auth),
    env: Environment = Depends(get_trac_env)
):
    ticket_data = await crud_tickets.check_ticket_ownership(env, ticket_id, user)

    if ticket_data is None:
        if crud_tickets.get_ticket_by_id(env, ticket_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Ticket {ticket_id} not found")
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    if not crud_tickets.delete_ticket_from_db(env, ticket_id):
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to delete ticket")

    return schemas.TicketDeleteResponse(
        status="success",
        message="Ticket deleted successfully",
        deleted_ticket_id=ticket_id
    ) 