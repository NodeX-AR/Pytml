"""Pytml 2.5 browser helpers.

The CDN runtime injects an equivalent in-memory module before user code runs.
"""
from .ui import (
    Event, Element, Joystick, element, get, query, query_all, joystick, sleep, timeout,
    interval, clear_timeout, clear_interval, clipboard_copy, clipboard_read,
    alert, confirm, download, gamepads, storage_get, storage_set, storage_remove, install
)
