from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class PaginationParams(BaseModel):
    model_config = ConfigDict(strict=True)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    status_code: int
