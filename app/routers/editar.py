from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.database import get_session
from app.models import Cliente
from app.schemas import ClienteActualizar, ClienteRespuesta

router = APIRouter()


@router.put(
    "/{cliente_id}",
    response_model=ClienteRespuesta,
    responses={404: {"description": "Cliente no encontrado"}},
)
def editar_cliente(
    datos: ClienteActualizar,
    cliente_id: int = Path(gt=0, le=9223372036854775807),
    session: Session = Depends(get_session),
) -> Cliente:
    cliente = session.get(Cliente, cliente_id)
    if cliente is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado",
        )

    for campo, valor in datos.model_dump(exclude={"codigo_pais"}).items():
        setattr(cliente, campo, valor)

    session.commit()
    session.refresh(cliente)
    return cliente
