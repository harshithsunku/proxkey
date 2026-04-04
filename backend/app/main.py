"""ProxKey — SSH Key Manager for Proxmox LXC & VMs."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .database import init_db
from .routers import hosts, keys, deploy, hooks

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="ProxKey",
    description="SSH Key Manager for Proxmox LXC & VMs",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(hosts.router)
app.include_router(keys.router)
app.include_router(deploy.router)
app.include_router(hooks.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}
