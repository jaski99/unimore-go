"""Uniform error handlers and exceptions for UnimoreGo API."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class APIError(HTTPException):
    """Domain-specific HTTP exception carrying an error code and detail."""

    def __init__(
        self,
        status_code: int,
        detail: str,
        code: str = "ERROR",
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.code = code


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Format HTTP exceptions into uniform {detail, code} responses."""
    code = getattr(exc, "code", "HTTP_ERROR")
    if exc.status_code == status.HTTP_404_NOT_FOUND and code == "HTTP_ERROR":
        code = "NOT_FOUND"
    elif exc.status_code == 422 and code == "HTTP_ERROR":
        code = "VALIDATION_ERROR"

    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": str(exc.detail), "code": code},
        headers=exc.headers,
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Format Pydantic validation errors into uniform {detail, code} responses."""
    error_messages = []
    for err in exc.errors():
        loc = " -> ".join(str(item) for item in err.get("loc", []))
        msg = err.get("msg", "Valore non valido")
        error_messages.append(f"{loc}: {msg}" if loc else msg)

    detail = "; ".join(error_messages) if error_messages else "Dati di input non validi."
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={"detail": f"Dati di input non validi: {detail}", "code": "VALIDATION_ERROR"},
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all unhandled exception handler."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Si è verificato un errore interno del server.",
            "code": "INTERNAL_SERVER_ERROR",
        },
    )


def error_response_docs() -> dict[int | str, dict[str, Any]]:
    """OpenAPI error response documentation schema."""
    return {
        404: {
            "description": "Risorsa non trovata (campus o stazione inesistente)",
            "content": {
                "application/json": {
                    "example": {"detail": "Campus non trovato: dief_xyz", "code": "NOT_FOUND"}
                }
            },
        },
        422: {
            "description": "Dati di richiesta non validi",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Dati di input non validi: margin_min: Input should be less than or equal to 60",
                        "code": "VALIDATION_ERROR",
                    }
                }
            },
        },
    }
