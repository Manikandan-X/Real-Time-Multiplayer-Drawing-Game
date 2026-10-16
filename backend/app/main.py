from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.dependencies import get_db
from app.routers.room import router as room_router
from app.routers.websocket import router as websocket_router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
)

# ==============================
# CORS Middleware
# ==============================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================
# Register Routers
# ==============================

app.include_router(room_router)
app.include_router(websocket_router)

# ==============================
# Health Endpoints
# ==============================

@app.get("/", tags=["Health"])
def root():
    return {
        "message": "Real-Time Multiplayer Drawing Game API is running",
        "status": "success",
    }


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "application": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@app.get("/health/database", tags=["Health"])
def database_health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": settings.MYSQL_DATABASE,
            "message": "Database connection successful",
        }
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "unhealthy",
                "message": "Database connection failed",
            },
        )
