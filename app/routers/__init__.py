from fastapi import APIRouter

from app.routers import crear, consultar, editar, eliminar

router = APIRouter(prefix="/api/clientes", tags=["Clientes"])
router.include_router(crear.router)
router.include_router(consultar.router)
router.include_router(editar.router)
router.include_router(eliminar.router)
