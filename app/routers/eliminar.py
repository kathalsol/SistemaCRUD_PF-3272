from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from sqlalchemy.orm import Session

from app.database import get_session
from app.models import Cliente

router = APIRouter()


@router.delete(
    "/{cliente_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses={404: {"description": "Cliente no encontrado"}},
)
def eliminar_cliente(
    cliente_id: int = Path(gt=0, le=9223372036854775807),
    session: Session = Depends(get_session),
) -> Response:
    cliente = session.get(Cliente, cliente_id)
    if cliente is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado",
        )

    session.delete(cliente)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
