import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class JobCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=50)
    skills: List[str] = Field(default_factory=list)
    experience_min: Optional[int] = Field(None, ge=0)
    experience_max: Optional[int] = Field(None, ge=0)
    education: Optional[str] = None
    location: Optional[str] = None
    remote_allowed: bool = False
    salary_min: Optional[float] = Field(None, ge=0)
    salary_max: Optional[float] = Field(None, ge=0)


class JobUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    skills: Optional[List[str]] = None
    experience_min: Optional[int] = None
    experience_max: Optional[int] = None
    education: Optional[str] = None
    location: Optional[str] = None
    remote_allowed: Optional[bool] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    tenant_id: uuid.UUID
    title: str
    description: str
    requirements: dict = {}
    skills: List[str] = []
    experience_min: Optional[int] = None
    experience_max: Optional[int] = None
    education: Optional[str] = None
    location: Optional[str] = None
    remote_allowed: bool = False
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    status: str = "draft"
    created_by: Optional[uuid.UUID] = None
    published_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
