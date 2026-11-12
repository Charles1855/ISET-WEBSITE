/* =========================================================
   ISET mail backend
   Receives the website enquiry form (JSON) and sends it by
   email using Nodemailer over SMTP.
   ========================================================= */
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");

const PORT = process.env.PORT || 3000;

/* ---------- Config check: fail early with a clear message ---------- */
const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_TO"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("Missing required environment variables: " + missing.join(", "));
  console.error("Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

/* ---------- SMTP transporter ---------- */
const smtpPort = Number(process.env.SMTP_PORT);
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465, // 465 = implicit TLS, 587/2525 = STARTTLS
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
});

const MAIL_FROM = process.env.MAIL_FROM || `"ISET Website" <${process.env.SMTP_USER}>`;
const AUTO_REPLY = String(process.env.AUTO_REPLY).toLowerCase() === "true";

/* ---------- Helpers ---------- */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Remove line breaks so user input can never inject extra email headers
function oneLine(str) {
  return String(str).replace(/[\r\n]+/g, " ").trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(body) {
  const data = {
    name: oneLine(body.name || ""),
    email: oneLine(body.email || ""),
    organisation: oneLine(body.organisation || ""),
    interest: oneLine(body.interest || ""),
    message: String(body.message || "").trim(),
  };
  const errors = {};

  if (data.name.length < 2 || data.name.length > 100) errors.name = "Please enter your full name.";
  if (!EMAIL_RE.test(data.email) || data.email.length > 254) errors.email = "Please enter a valid email address.";
  if (!data.interest || data.interest.length > 120) errors.interest = "Please choose what you are interested in.";
  if (data.organisation.length > 150) errors.organisation = "Organisation name is too long.";
  if (data.message.length > 3000) errors.message = "Message is too long (max 3000 characters).";

  return { data, errors };
}

/* ---------- App ---------- */
const app = express();
app.set("trust proxy", 1); // needed behind Render/Railway/Nginx so rate limiting sees the real IP
app.use(helmet());
app.use(express.json({ limit: "10kb" }));

app.use(
  cors({
    origin: function (origin, cb) {
      // No Origin header = curl/Postman/server-to-server, allow it
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Origin not allowed by CORS"));
    },
    methods: ["POST", "GET"],
  })
);

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 enquiries per IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests. Please try again in a few minutes." },
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/contact", contactLimiter, async (req, res) => {
  // Honeypot: real visitors never see/fill this field, bots usually do.
  // Pretend success so the bot learns nothing.
  if (req.body && req.body.website) return res.json({ ok: true });

  const { data, errors } = validate(req.body || {});
  if (Object.keys(errors).length) {
    return res.status(400).json({ ok: false, error: "Please check the form and try again.", errors });
  }

  const orgLine = data.organisation ? `Organisation: ${data.organisation}\n` : "";
  const text =
    `New enquiry from the ISET website\n\n` +
    `Name: ${data.name}\n` +
    `Email: ${data.email}\n` +
    orgLine +
    `Interested in: ${data.interest}\n\n` +
    `Message:\n${data.message || "(no message)"}\n`;

  const html =
    `<h2 style="margin:0 0 12px;font-family:Arial,sans-serif;color:#123A52">New enquiry from the ISET website</h2>` +
    `<table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">` +
    `<tr><td style="padding:4px 12px 4px 0;color:#55625C">Name</td><td>${escapeHtml(data.name)}</td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#55625C">Email</td><td>${escapeHtml(data.email)}</td></tr>` +
    (data.organisation
      ? `<tr><td style="padding:4px 12px 4px 0;color:#55625C">Organisation</td><td>${escapeHtml(data.organisation)}</td></tr>`
      : "") +
    `<tr><td style="padding:4px 12px 4px 0;color:#55625C">Interested in</td><td>${escapeHtml(data.interest)}</td></tr>` +
    `</table>` +
    `<p style="font-family:Arial,sans-serif;font-size:14px;margin:16px 0 4px;color:#55625C">Message</p>` +
    `<p style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap;margin:0">${escapeHtml(
      data.message || "(no message)"
    )}</p>`;

  try {
    await transporter.sendMail({
      from: MAIL_FROM,
      to: process.env.MAIL_TO,
      replyTo: `"${data.name.replace(/"/g, "")}" <${data.email}>`, // hitting Reply goes to the visitor
      subject: `ISET website enquiry: ${data.interest} (${data.name})`,
      text,
      html,
    });

    if (AUTO_REPLY) {
      // Failure here must not fail the request: the main email already went through
      transporter
        .sendMail({
          from: MAIL_FROM,
          to: data.email,
          subject: "Thank you for contacting ISET",
          text:
            `Dear ${data.name},\n\nThank you for your interest in the Integrative Sports-Education Trust (ISET). ` +
            `We have received your enquiry and a member of our team will be in touch shortly.\n\n` +
            `Kind regards,\nISET`,
        })
        .catch((err) => console.error("Auto-reply failed:", err.message));
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Mail send failed:", err.message); // real reason stays in the server log
    return res.status(502).json({
      ok: false,
      error: "We could not send your message right now. Please try again later.",
    });
  }
});

// Handles the CORS rejection above and any other unexpected error cleanly
app.use((err, req, res, next) => {
  if (err && err.message === "Origin not allowed by CORS") {
    return res.status(403).json({ ok: false, error: "Origin not allowed." });
  }
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ ok: false, error: "Invalid request." });
  }
  console.error(err);
  res.status(500).json({ ok: false, error: "Server error." });
});

app.listen(PORT, () => {
  console.log(`ISET mail backend running on port ${PORT}`);
  transporter
    .verify()
    .then(() => console.log("SMTP connection OK"))
    .catch((err) => console.error("SMTP check failed (emails will not send):", err.message));
});
