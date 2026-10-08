"""QML Encoding Lab API: the app, CORS and one router (mountable in Qrious)."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import lab
from .encoders import ENCODERS

MAX_NUMBERS = 16  # the upload rule allows at most 16 columns

Number = Annotated[float, Field(allow_inf_nan=False)]
EncodingName = Literal["basis", "angle", "amplitude", "iqp", "hamiltonian"]
assert set(EncodingName.__args__) == set(ENCODERS)


class ColumnStat(BaseModel):
    min: Number
    max: Number
    median: Number


class RowRequest(BaseModel):
    row: list[Number] = Field(min_length=1, max_length=MAX_NUMBERS)
    column_stats: list[ColumnStat]


class EncodeRequest(RowRequest):
    encoding: EncodingName


def stats_for(req: RowRequest) -> list[dict]:
    if len(req.column_stats) != len(req.row):
        raise HTTPException(400, "The row and its column stats must have the same length.")
    return [s.model_dump() for s in req.column_stats]


router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict:
    return {"ok": True}


@router.post("/encode")
def encode(req: EncodeRequest) -> dict:
    return lab.encode(req.encoding, req.row, stats_for(req))


@router.post("/compare")
def compare(req: RowRequest) -> list[dict]:
    return lab.compare(req.row, stats_for(req))


def allowed_origins() -> list[str]:
    """FRONTEND_ORIGIN may hold one URL or several separated by commas."""
    raw = os.environ.get("FRONTEND_ORIGIN", "")
    return [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]


@asynccontextmanager
async def lifespan(_: FastAPI):
    lab.warm_up()
    yield


app = FastAPI(title="QML Encoding Lab", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
app.include_router(router)
