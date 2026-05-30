from decimal import Decimal
from uuid import UUID
from datetime import date, datetime


def jsonify(obj):
    """Recursively convert Python types that httpx/JSON can't serialize."""
    if isinstance(obj, dict):
        return {k: jsonify(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [jsonify(v) for v in obj]
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    return obj
