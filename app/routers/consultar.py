from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_session
from app.models import Cliente
from app.schemas import ClienteRespuesta

router = APIRouter()


@router.get("", response_model=list[ClienteRespuesta])
def listar_clientes(session: Session = Depends(get_session)) -> list[Cliente]:
    return list(session.scalars(select(Cliente).order_by(Cliente.id)))


@router.get(
    "/{cliente_id}",
    response_model=ClienteRespuesta,
    responses={404: {"description": "Cliente no encontrado"}},
)
def consultar_cliente(
    cliente_id: int = Path(gt=0, le=9223372036854775807),
    session: Session = Depends(get_session),
) -> Cliente:
    cliente = session.get(Cliente, cliente_id)
    if cliente is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado",
        )
    return cliente
