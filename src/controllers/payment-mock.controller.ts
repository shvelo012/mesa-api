import { Request, Response } from "express";
import { z } from "zod";
import { setMockOutcome } from "../lib/payments/mock";

/**
 * Fake-bank hosted page — only mounted when PAYMENT_MOCK=1.
 * Shows Pay / Decline buttons. Each button records the outcome, fires the
 * normal bank-style callback to our own webhook, then redirects back like a
 * real bank would. Lets you click through the entire flow with no credentials.
 */
export function mockBankPage(req: Request, res: Response) {
  const order = String(req.query.order ?? "");
  const provider = String(req.query.provider ?? "tbc");
  const returnUrl = String(req.query.return ?? "/");
  if (!order) { res.status(400).send("Missing order"); return; }

  const safe = (s: string) => s.replace(/[<>"']/g, "");
  res.type("html").send(`<!doctype html><html><head><meta charset="utf-8">
<title>Mock Bank — Mesa</title>
<style>body{font-family:system-ui;max-width:420px;margin:80px auto;text-align:center}
button{font-size:16px;padding:12px 24px;margin:8px;border:0;border-radius:8px;cursor:pointer}
.pay{background:#16a34a;color:#fff}.decline{background:#dc2626;color:#fff}
code{background:#f1f5f9;padding:2px 6px;border-radius:4px}</style></head>
<body>
<h2>🏦 Mock Bank</h2>
<p>Order <code>${safe(order)}</code> · provider <code>${safe(provider)}</code></p>
<button class="pay" onclick="finish(true)">Pay</button>
<button class="decline" onclick="finish(false)">Decline</button>
<p id="msg"></p>
<script>
async function finish(paid){
  document.getElementById('msg').textContent = 'Processing…';
  await fetch('/api/payments/mock/set',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({order:${JSON.stringify(order)},paid})});
  await fetch('/api/payments/callback/'+${JSON.stringify(provider)},{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({payId:${JSON.stringify(order)}})});
  window.location.href = ${JSON.stringify(returnUrl)};
}
</script>
</body></html>`);
}

const setSchema = z.object({ order: z.string().min(1), paid: z.boolean() });

export function mockSetOutcome(req: Request, res: Response) {
  const parsed = setSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  setMockOutcome(parsed.data.order, parsed.data.paid);
  res.json({ ok: true });
}
