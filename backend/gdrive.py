"""Google Drive / Sheets sync using a Service Account.

The admin uploads a service-account JSON key (created from Google Cloud Console)
and a Drive folder ID (a folder they have shared with the service account email).
We store the parsed JSON and folder ID in MongoDB under a single config document
(`gdrive_config.id = 'default'`). On every sync we:

  - If no spreadsheet_id is saved, create a new Google Sheet inside the folder.
  - Clear & overwrite the sheet with the latest order-summary rows.

This module exposes pure helper functions; the FastAPI routes in server.py
call them via `asyncio.to_thread` because google-api-python-client is sync.
"""
from __future__ import annotations

from typing import Any, Optional
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


class GDriveError(Exception):
    pass


def _services(sa_info: dict):
    try:
        creds = service_account.Credentials.from_service_account_info(sa_info, scopes=SCOPES)
    except Exception as e:
        raise GDriveError(f"Invalid service-account JSON: {e}")
    drive = build("drive", "v3", credentials=creds, cache_discovery=False)
    sheets = build("sheets", "v4", credentials=creds, cache_discovery=False)
    return drive, sheets


def verify_connection(sa_info: dict, spreadsheet_id: str) -> dict:
    """Confirm the service account can read+write the given spreadsheet.

    The user is expected to have created the sheet themselves and shared it
    with the SA email (Editor). Service accounts cannot own files on consumer
    Google accounts (storage-quota error on file create), so we no longer try
    to create new sheets — we only write to user-owned sheets.
    """
    drive, sheets = _services(sa_info)
    sa_email = sa_info.get("client_email", "<unknown>")
    try:
        meta = drive.files().get(
            fileId=spreadsheet_id,
            fields="id,name,mimeType,capabilities(canEdit)",
            supportsAllDrives=True,
        ).execute()
    except HttpError as e:
        status = getattr(e.resp, "status", None)
        if status == 404:
            raise GDriveError(
                f"Sheet nahi mili (404). Steps: (1) Google Drive me ek naya Google "
                f"Sheet banao, (2) usse Share karo → yeh email paste karo "
                f"aur Editor access do: {sa_email}, (3) sheet ka URL/ID copy karke "
                f"yahan paste karo."
            )
        if status == 403:
            raise GDriveError(
                f"Permission denied (403). Sheet ko {sa_email} ke saath Editor "
                f"access pe share karo."
            )
        raise GDriveError(f"Drive API error ({status}): {e}")
    except Exception as e:
        raise GDriveError(f"Drive connection failed: {e}")
    if meta.get("mimeType") != "application/vnd.google-apps.spreadsheet":
        raise GDriveError(
            f"Yeh ID ek Google Sheet ki nahi hai (mimeType: {meta.get('mimeType')}). "
            f"Drive me naya Google Sheet banao aur uska URL/ID dijiye."
        )
    if not (meta.get("capabilities") or {}).get("canEdit"):
        raise GDriveError(
            f"Service account ko Editor access nahi hai. Sheet ko {sa_email} ke "
            f"saath Editor access pe share karo (Viewer kaafi nahi)."
        )
    return meta


def parse_spreadsheet_id(raw: str) -> str:
    """Accept either a raw ID or a Google Sheets URL and return the ID."""
    s = (raw or "").strip()
    if not s:
        return ""
    # URL formats: https://docs.google.com/spreadsheets/d/<ID>/edit ...
    marker = "/spreadsheets/d/"
    if marker in s:
        s = s.split(marker, 1)[1]
        s = s.split("/", 1)[0]
        s = s.split("?", 1)[0]
    return s


def ensure_spreadsheet(sa_info: dict, spreadsheet_id: str) -> str:
    """Confirm the spreadsheet exists and SA can edit it. Returns the same id."""
    meta = verify_connection(sa_info, spreadsheet_id)
    return meta["id"]


def write_rows(sa_info: dict, spreadsheet_id: str, rows: list[list[Any]]) -> dict:
    """Clear sheet1 and write the given matrix of rows starting from A1."""
    _, sheets = _services(sa_info)
    try:
        sheets.spreadsheets().values().clear(
            spreadsheetId=spreadsheet_id,
            range="A1:Z100000",
        ).execute()
        result = sheets.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range="A1",
            valueInputOption="USER_ENTERED",
            body={"values": rows},
        ).execute()
    except HttpError as e:
        raise GDriveError(f"Sheet write failed: {e}")
    return {
        "updated_rows": result.get("updatedRows", 0),
        "updated_cells": result.get("updatedCells", 0),
    }


def sheet_url(spreadsheet_id: str) -> str:
    return f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit"
