# ISET mail backend

Receives the website enquiry form and emails it to ISET using Nodemailer (SMTP).

## Run it locally

```bash
cd backend
npm install
copy .env.example .env      # Windows (use "cp" on Mac/Linux)
# open .env and fill in SMTP_USER, SMTP_PASS, MAIL_TO, MAIL_FROM
npm start
```

Check it: open http://localhost:3000/api/health, you should see `{"ok":true}`.
Then open the website with VS Code Live Server (http://127.0.0.1:5500) and submit the form.

## Endpoints

| Method | Path          | Purpose                     |
|--------|---------------|-----------------------------|
| GET    | /api/health   | Is the server up?           |
| POST   | /api/contact  | Send an enquiry (JSON body) |

Body: `name`, `email`, `interest` (required), `organisation`, `message` (optional).

## Built-in protections

- CORS allow-list (`ALLOWED_ORIGINS`): only your site can call the API from a browser
- Rate limit: 5 enquiries per IP per 15 minutes
- Server-side validation (never trust the browser)
- Honeypot field to catch simple bots
- HTML escaped in the email, line breaks stripped from headers (no header injection)
- SMTP password lives only in `.env` on the server, never in the website code

## Deploying (important)

GitHub Pages can only host the website. This backend must run on a separate server,
then its URL goes in `js/script.js` (the `API_URL` line).

Warning: free Render web services block outbound SMTP ports 25, 465 and 587, so Gmail SMTP
will time out there. Options:
1. A paid host or VPS where port 587 is open, or
2. An SMTP relay on port 2525 (e.g. Brevo: `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=2525`).
   No code change needed, only the `.env` values. Test it after deploying.
