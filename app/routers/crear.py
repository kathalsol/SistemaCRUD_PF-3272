from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_session
from app.models import Cliente
from app.schemas import ClienteCrear, ClienteRespuesta

router = APIRouter()


@router.post("", response_model=ClienteRespuesta, status_code=status.HTTP_201_CREATED)
def crear_cliente(
    datos: ClienteCrear, session: Session = Depends(get_session)
) -> Cliente:
    cliente = Cliente(**datos.model_dump(exclude={"codigo_pais"}))
    session.add(cliente)
    session.commit()
    session.refresh(cliente)
    return cliente
