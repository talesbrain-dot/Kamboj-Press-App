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


def verify_connection(sa_info: dict, folder_id: str) -> dict:
    """Confirm the service account can see the folder. Returns folder metadata."""
    drive, _ = _services(sa_info)
    try:
        meta = drive.files().get(
            fileId=folder_id,
            fields="id,name,mimeType,owners(emailAddress,displayName)",
            supportsAllDrives=True,
        ).execute()
    except HttpError as e:
        status = getattr(e.resp, "status", None)
        if status == 404:
            raise GDriveError(
                "Folder nahi mila. Confirm: (1) folder ID sahi hai, "
                "(2) folder service-account email ke saath share kiya hai (Editor access)."
            )
        if status == 403:
            raise GDriveError(
                "Permission denied. Folder ko service-account email ke saath "
                "Editor access pe share karein."
            )
        raise GDriveError(f"Drive API error: {e}")
    if meta.get("mimeType") != "application/vnd.google-apps.folder":
        raise GDriveError("Yeh ID ek folder ki nahi hai. Sahi Drive folder ID dijiye.")
    return meta


def ensure_spreadsheet(sa_info: dict, folder_id: str, sheet_id: Optional[str], title: str) -> str:
    """Return a valid spreadsheet id. If `sheet_id` is provided and still exists,
    reuse it. Else create a fresh sheet inside the folder."""
    drive, sheets = _services(sa_info)

    if sheet_id:
        try:
            drive.files().get(fileId=sheet_id, fields="id,trashed", supportsAllDrives=True).execute()
            return sheet_id
        except HttpError:
            sheet_id = None  # gone — recreate

    body = {
        "name": title,
        "mimeType": "application/vnd.google-apps.spreadsheet",
        "parents": [folder_id],
    }
    try:
        f = drive.files().create(body=body, fields="id", supportsAllDrives=True).execute()
    except HttpError as e:
        raise GDriveError(f"Sheet create failed: {e}")
    return f["id"]


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
