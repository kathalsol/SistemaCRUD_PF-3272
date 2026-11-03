from fastapi import APIRouter

from app.routers import crear, consultar, editar, eliminar

router = APIRouter(tags=["Clientes"])
for operation in (crear, consultar, editar, eliminar):
    router.include_router(operation.router, prefix="/api/clientes")
