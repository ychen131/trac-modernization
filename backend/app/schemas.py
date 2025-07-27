
from pydantic import BaseModel, validator
from typing import Optional, List

class TicketModel(BaseModel):
    """Individual ticket model with validation."""
    id: int
    summary: str
    status: str
    priority: str
    reporter: str
    owner: str
    created: int
    
    @validator('summary')
    def summary_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Summary cannot be empty')
        return v.strip()
    
    @validator('status')
    def status_must_be_valid(cls, v):
        valid_statuses = ['new', 'assigned', 'accepted', 'closed', 'reopened']
        if v not in valid_statuses:
            # In a real app, you might want to log this or handle it more strictly
            pass
        return v

class TicketCreateRequest(BaseModel):
    """Request model for creating tickets."""
    summary: str
    description: Optional[str] = ""
    priority: Optional[str] = "medium"
    component: Optional[str] = "general"
    status: Optional[str] = "new"
    
    @validator('summary')
    def summary_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Summary cannot be empty')
        return v.strip()
    
    @validator('priority')
    def priority_must_be_valid(cls, v):
        if v:
            valid_priorities = ['low', 'medium', 'high', 'critical']
            if v not in valid_priorities:
                raise ValueError(f'Priority must be one of: {", ".join(valid_priorities)}')
        return v or "medium"
    
    @validator('status')
    def status_must_be_valid(cls, v):
        if v:
            valid_statuses = ['new', 'assigned', 'accepted', 'closed', 'reopened']
            if v not in valid_statuses:
                raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v or "new"

class TicketCreateResponse(BaseModel):
    """Response model for ticket creation."""
    status: str
    message: str
    ticket: TicketModel

class TicketsResponse(BaseModel):
    """Response model for tickets endpoint."""
    status: str
    user_id: str
    user_email: str
    tickets: List[TicketModel]
    total_count: int
    message: Optional[str] = None

class TicketUpdateRequest(BaseModel):
    """Request model for updating tickets."""
    status: Optional[str] = None
    priority: Optional[str] = None
    owner: Optional[str] = None
    summary: Optional[str] = None
    description: Optional[str] = None
    
    @validator('status')
    def status_must_be_valid(cls, v):
        if v:
            valid_statuses = ['new', 'assigned', 'accepted', 'closed', 'reopened']
            if v not in valid_statuses:
                raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v
    
    @validator('priority')
    def priority_must_be_valid(cls, v):
        if v:
            valid_priorities = ['low', 'medium', 'high', 'critical']
            if v not in valid_priorities:
                raise ValueError(f'Priority must be one of: {", ".join(valid_priorities)}')
        return v
    
    @validator('summary')
    def summary_must_not_be_empty(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError('Summary cannot be empty')
        return v.strip() if v else v

class TicketUpdateResponse(BaseModel):
    """Response model for ticket updates."""
    status: str
    message: str
    ticket: TicketModel

class TicketDeleteResponse(BaseModel):
    """Response model for ticket deletion."""
    status: str
    message: str
    deleted_ticket_id: int

class ClerkUser(BaseModel):
    """User information from Clerk authentication."""
    user_id: str
    email: str
    first_name: str
    last_name: str

class AttachmentModel(BaseModel):
    """Individual attachment model with validation."""
    filename: str
    size: int
    description: Optional[str] = ""
    author: str
    uploaded: int
    
    @validator('filename')
    def filename_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Filename cannot be empty')
        return v.strip()

class AttachmentCreateResponse(BaseModel):
    """Response model for attachment creation."""
    status: str
    message: str
    attachment: AttachmentModel

class AttachmentListResponse(BaseModel):
    """Response model for listing attachments."""
    status: str
    ticket_id: int
    attachments: List[AttachmentModel]
    total_count: int 