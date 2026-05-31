"""
NIC E-Invoice API client (sandbox + production).
Docs: https://einv-apisandbox.nic.in
"""
import httpx
from app.config import settings


class NICClient:
    def __init__(self):
        self.base = settings.nic_einvoice_base_url
        self.gstin = settings.nic_gstin

    async def _get_token(self) -> str:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base}/eivital/v1.04/auth",
                json={
                    "UserName": settings.nic_username,
                    "Password": settings.nic_password,
                    "AppKey": "NIC_APP_KEY",
                    "ForceRefreshAccessToken": True,
                },
                headers={"Gstin": self.gstin},
            )
            resp.raise_for_status()
            data = resp.json()
            return data["Data"]["AuthToken"]

    def _get_our_settings(self) -> dict:
        from app.db.client import get_db
        result = get_db().table("company_settings").select("*").limit(1).execute()
        return result.data[0] if result.data else {}

    def _build_irn_payload(self, invoice: dict) -> dict:
        """Map invoice dict to NIC IRN request schema."""
        company = invoice["companies"]
        items = invoice["invoice_items"]
        our = self._get_our_settings()

        item_list = []
        for idx, item in enumerate(items, 1):
            item_list.append({
                "SlNo": str(idx),
                "PrdDesc": item["description"],
                "IsServc": "N",
                "HsnCd": item["hsn_code"],
                "Qty": float(item["qty"]),
                "Unit": item["uom"],
                "UnitPrice": float(item["rate"]),
                "TotAmt": float(item["amount"]),
                "AssAmt": float(item["amount"]),
                "GstRt": float(item["gst_rate"]),
                "CgstAmt": float(item["cgst_amt"]),
                "SgstAmt": float(item["sgst_amt"]),
                "IgstAmt": float(item["igst_amt"]),
                "TotItemVal": float(item["amount"]) + float(item["cgst_amt"]) + float(item["sgst_amt"]) + float(item["igst_amt"]),
            })

        return {
            "Version": "1.1",
            "TranDtls": {"TaxSch": "GST", "SupTyp": "B2B"},
            "DocDtls": {
                "Typ": "INV",
                "No": invoice["inv_no"],
                "Dt": invoice["date"],
            },
            "SellerDtls": {
                "Gstin": our.get("gstin", settings.nic_gstin),
                "LglNm": our.get("name", "Our Company"),
                "Addr1": our.get("address", "Our Address"),
                "Loc": our.get("city", "Our City"),
                "Pin": 400001,
                "Stcd": our.get("state_code", "27"),
            },
            "BuyerDtls": {
                "Gstin": company.get("gstin", "URP"),
                "LglNm": company["name"],
                "Pos": invoice["place_of_supply"],
                "Addr1": company.get("address", ""),
                "Loc": company.get("city", ""),
                "Pin": int(company.get("pincode", "400001") or "400001"),
                "Stcd": company["state_code"],
            },
            "ValDtls": {
                "AssVal": float(invoice["taxable_amt"]),
                "CgstVal": float(invoice["cgst"]),
                "SgstVal": float(invoice["sgst"]),
                "IgstVal": float(invoice["igst"]),
                "TotInvVal": float(invoice["total"]),
            },
            "ItemList": item_list,
        }

    async def generate_irn(self, invoice: dict) -> dict:
        token = await self._get_token()
        payload = self._build_irn_payload(invoice)
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base}/eicore/v1.03/Invoice",
                json=payload,
                headers={"Gstin": self.gstin, "user_name": settings.nic_username, "AuthToken": token},
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("Status") != 1:
                raise ValueError(data.get("ErrorDetails", data))
            return data["Data"]

    async def cancel_irn(self, irn: str, reason: str) -> dict:
        token = await self._get_token()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base}/eicore/v1.03/Invoice/Cancel",
                json={"Irn": irn, "CnlRsn": "1", "CnlRem": reason},
                headers={"Gstin": self.gstin, "user_name": settings.nic_username, "AuthToken": token},
            )
            resp.raise_for_status()
            return resp.json()

    async def generate_ewaybill(self, invoice: dict, ewb_req: dict) -> dict:
        token = await self._get_token()
        payload = {
            "Irn": invoice.get("irn", ""),
            "Distance": ewb_req.get("distance_km", 0),
            "TransMode": ewb_req.get("mode_of_trans", "road"),
            "VehNo": ewb_req.get("vehicle_no", ""),
            "VehType": "R",
        }
        if ewb_req.get("transporter_id"):
            payload["TransId"] = ewb_req["transporter_id"]

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base}/eiewb/v1.03/ewaybill/inter/",
                json=payload,
                headers={"Gstin": self.gstin, "user_name": settings.nic_username, "AuthToken": token},
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("Status") != 1:
                raise ValueError(data.get("ErrorDetails", data))
            return data["Data"]


