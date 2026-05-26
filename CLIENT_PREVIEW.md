# Share With A Client Without A Domain

You have three practical options.

## Option 1: Free Hosted URL

Best for a client review.

Use a host like Render or Railway. They give you a public URL such as:

```text
https://one-stop-burger-shop.onrender.com
```

No domain is needed. The project already includes `render.yaml`, `Dockerfile`, and a health check for this.

## Option 2: Temporary Local Preview Link

Best for quick same-day review.

Use a tunnel tool like Cloudflare Tunnel, LocalTunnel, or ngrok. You run the site on your laptop, then the tool gives you a temporary public URL.

Important: your laptop and server must stay running while the client views it.

## Option 3: Send Screenshots Or Screen Recording

Best if the client only needs design approval.

This does not test ordering or forms, but it is fast and does not require hosting.

## Payment Status

Cash on Delivery works as a normal order status.

Easypaisa and Bank Transfer work as manual verification flows:

- customer pays in their own app
- customer enters only the transaction/reference ID
- the order is saved as `awaiting-payment-verification`

The website does not automatically receive money yet. For real automatic online payment, the restaurant needs an official Easypaisa merchant integration or bank payment gateway.
