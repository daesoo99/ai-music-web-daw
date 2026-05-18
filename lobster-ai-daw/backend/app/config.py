from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    ACESTEP_API_URL: str = "http://127.0.0.1:8001"
    BACKEND_PORT: int = 8002
    BACKEND_HOST: str = "127.0.0.1"
    
    # Paths (Relative to backend root)
    DATA_DIR: str = "data"
    PROJECTS_DIR: str = "data/projects"
    STEMS_DIR: str = "data/stems"
    EXPORTS_DIR: str = "data/exports"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
