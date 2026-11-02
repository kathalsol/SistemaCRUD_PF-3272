from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_session
from app.models import Cliente
from app.schemas import ClienteActualizar, ClienteRespuesta

router = APIRouter()

@router.put("/{cliente_id}", response_model=ClienteRespuesta)
def editar_cliente(
    cliente_id: int,
    datos: ClienteActualizar,
    session: Session = Depends(get_session),
) -> Cliente:
    cliente = session.get(Cliente, cliente_id)
    if cliente is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente no encontrado")

    for campo, valor in datos.model_dump().items():
        setattr(cliente, campo, valor)

    session.commit()
    session.refresh(cliente)
    return cliente