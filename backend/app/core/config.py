from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "HR Recruitment Agent Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database (SQLite for local dev, PostgreSQL for production)
    DATABASE_URL: str = "sqlite:///./hr_recruitment.db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    SECRET_KEY: str = "hr-recruitment-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: str = '["http://localhost:3000"]'

    @property
    def cors_origins_list(self) -> List[str]:
        return json.loads(self.CORS_ORIGINS)

    # AI Services
    OPENAI_API_KEY: str = ""
    PINECONE_API_KEY: str = ""
    PINECONE_ENVIRONMENT: str = "us-east-1"

    # AWS S3
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    S3_BUCKET_NAME: str = "hr-recruitment-resumes"

    # Email (SMTP — works with Gmail app password)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""  # your Gmail address
    SMTP_PASSWORD: str = ""  # Gmail app password (not regular password)
    FROM_EMAIL: str = ""  # sender email (same as SMTP_USER for Gmail)
    COMPANY_NAME: str = "HR Recruitment Platform"

    # Policy Gate thresholds
    CONFIDENCE_THRESHOLD: float = 0.6
    BIAS_ALERT_THRESHOLD: float = 0.1
    DISPARATE_IMPACT_MIN: float = 0.8
    DISPARATE_IMPACT_MAX: float = 1.25

    # Frontend URL (for email links)
    APP_BASE_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
