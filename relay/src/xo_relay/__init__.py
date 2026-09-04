"""xo_relay - the fixed-egress relay between XoLogic's Product API and NetSuite / Shopify.

Read-only against XO. Writes flow inward only (NetSuite via SuiteTalk REST or CSV,
Shopify via the existing Matrixify pipeline). See relay/README.md.
"""

__version__ = "0.1.0"
