from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Proxmox connection
    proxmox_host: str = "192.168.1.100"
    proxmox_port: int = 8006
    proxmox_verify_ssl: bool = False
    proxmox_token_id: str = "proxkey@pve!proxkey"
    proxmox_token_secret: str = ""
    proxmox_node: str = "pve"

    # SSH to Proxmox host (for pct exec when running remotely)
    proxmox_ssh_user: str = "root"
    proxmox_ssh_password: str = ""
    proxmox_ssh_port: int = 22

    # App settings
    database_url: str = "sqlite:///./proxkey.db"
    secret_key: str = "change-me-in-production"
    cors_origins: str = "http://localhost:5173,http://localhost:8080"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
