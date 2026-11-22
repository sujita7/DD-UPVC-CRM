import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

# ── Color Palette ───────────────────────────────────────────────────────────
NAVY = colors.HexColor("#10243D")
NAVY_LIGHT = colors.HexColor("#183653")
BLUE = colors.HexColor("#3978F6")
INK = colors.HexColor("#182538")
MUTED = colors.HexColor("#5A6B82")
LINE = colors.HexColor("#E2E8F0")
BG_LIGHT = colors.HexColor("#F8FAFC")
BG_CARD = colors.HexColor("#EDF2F7")
GREEN = colors.HexColor("#16845B")
GREEN_BG = colors.HexColor("#E5F7EF")
AMBER = colors.HexColor("#B7791F")
RED = colors.HexColor("#C2414B")

class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and print total page count."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(MUTED)

        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 755, "ARCIOX ERP — Production Hosting & Infrastructure Requirements")
            self.drawRightString(558, 755, "Confidential & Proprietary")
            self.setStrokeColor(LINE)
            self.setLineWidth(0.6)
            self.line(54, 748, 558, 748)

        # Footer (all pages)
        self.setStrokeColor(LINE)
        self.setLineWidth(0.6)
        self.line(54, 45, 558, 45)
        self.drawString(54, 32, "ARCIOX Windows & Doors ERP • System Architecture Specification")
        self.drawRightString(558, 32, f"Page {self._pageNumber} of {total_pages}")
        self.restoreState()


def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom typography styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=NAVY,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=MUTED,
        spaceAfter=15
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=NAVY,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=NAVY_LIGHT,
        spaceBefore=10,
        spaceAfter=5,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=INK,
        spaceAfter=5
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=3
    )

    callout_style = ParagraphStyle(
        'Callout_Text',
        parent=body_style,
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=NAVY_LIGHT
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=INK
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=NAVY
    )

    story = []

    # ── HEADER BANNER ────────────────────────────────────────────────────────
    banner_data = [
        [
            Paragraph("<b>ARCIOX</b> <font size=8 color='#9DB0C7'>WINDOWS & DOORS ERP</font>", ParagraphStyle('B1', fontName='Helvetica-Bold', fontSize=14, textColor=colors.white, leading=16)),
            Paragraph("<font size=8 color='#CBD5E1'>DOCUMENT SPECIFICATION: PRD-HOST-2026<br/>STATUS: PRODUCTION READY</font>", ParagraphStyle('B2', fontName='Helvetica', fontSize=8, textColor=colors.white, alignment=2, leading=11))
        ]
    ]
    banner_table = Table(banner_data, colWidths=[280, 224])
    banner_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), NAVY),
        ('PADDING', (0,0), (-1,-1), 12),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 12),
    ]))
    story.append(banner_table)
    story.append(Spacer(1, 15))

    # ── TITLE & OVERVIEW ────────────────────────────────────────────────────
    story.append(Paragraph("Production Hosting & Infrastructure Requirements", title_style))
    story.append(Paragraph("Complete architectural guide, hardware sizing, database cluster prerequisites, network security, domain configuration, third-party services, and estimated costing for enterprise production deployment.", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=LINE, spaceBefore=4, spaceAfter=14))

    # ── 1. ARCHITECTURE OVERVIEW ─────────────────────────────────────────────
    story.append(Paragraph("1. System Architecture Overview", h1_style))
    story.append(Paragraph(
        "ARCIOX ERP is built on a modern, decoupled 3-tier MERN architecture designed for high availability, low latency, and zero downtime updates:",
        body_style
    ))

    arch_data = [
        [Paragraph("Tier", table_header_style), Paragraph("Component", table_header_style), Paragraph("Technology Stack", table_header_style), Paragraph("Production Role", table_header_style)],
        [Paragraph("Frontend", table_cell_bold), Paragraph("Admin Web Portal", table_cell_style), Paragraph("React 18 + Vite + AntD", table_cell_style), Paragraph("Static build served via Nginx with HTTP/2 and Brotli/Gzip caching.", table_cell_style)],
        [Paragraph("Backend", table_cell_bold), Paragraph("REST API Engine", table_cell_style), Paragraph("Node.js 20+ / Express", table_cell_style), Paragraph("Stateful worker processes managed by PM2 with auto-restart & clustering.", table_cell_style)],
        [Paragraph("Database", table_cell_bold), Paragraph("Primary Data Store", table_cell_style), Paragraph("MongoDB Atlas (M10+) / Mongo 7.0+", table_cell_style), Paragraph("Document store with replica sets, automated daily snapshots, and TLS encryption.", table_cell_style)],
        [Paragraph("Reverse Proxy", table_cell_bold), Paragraph("Gateway & Security", table_cell_style), Paragraph("Nginx + Let's Encrypt SSL", table_cell_style), Paragraph("SSL termination, rate limiting, security headers, reverse proxy to Node API.", table_cell_style)]
    ]
    t_arch = Table(arch_data, colWidths=[65, 105, 115, 219])
    t_arch.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('GRID', (0,0), (-1,-1), 0.5, LINE),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_arch)
    story.append(Spacer(1, 14))

    # ── 2. MODULE & FUNCTIONAL COVERAGE ──────────────────────────────────────
    story.append(Paragraph("2. Scope of Modules & Feature Workloads", h1_style))
    story.append(Paragraph(
        "The hosting infrastructure must comfortably support simultaneous operations across 5 operational core departments without CPU choking or memory leakage:",
        body_style
    ))

    modules_data = [
        [Paragraph("Department", table_header_style), Paragraph("Modules Included", table_header_style), Paragraph("Database & Memory Profile", table_header_style)],
        [Paragraph("Commercial", table_cell_bold), Paragraph("CRM & Leads, Quotations & Costing, Proforma Invoices, Sales Orders", table_cell_style), Paragraph("Read/Write heavy during business hours; PDF generation compute spikes.", table_cell_style)],
        [Paragraph("Operations", table_cell_bold), Paragraph("Production Job Cards, Inventory & Stock Movement, Purchases, Delivery & Sites", table_cell_style), Paragraph("Frequent transactional updates for stock movements and stage transitions.", table_cell_style)],
        [Paragraph("Finance", table_cell_bold), Paragraph("Tax Invoices, Payment Register, Operating Expenses, Analytics & Reports", table_cell_style), Paragraph("Strict consistency, invoice numbering atomicity, and reconciliation queries.", table_cell_style)],
        [Paragraph("People / HR", table_cell_bold), Paragraph("Employees, Daily Attendance, Working-Day Calendar, Monthly Payroll Calculator", table_cell_style), Paragraph("Monthly payroll calculation batch runs, overtime indexing, attendance roster.", table_cell_style)],
        [Paragraph("Management", table_cell_bold), Paragraph("To-Do Task Register (due dates, status auto-delay, notes), Settings", table_cell_style), Paragraph("Task status polling, real-time date/time comparison, notifications.", table_cell_style)]
    ]
    t_mod = Table(modules_data, colWidths=[80, 220, 204])
    t_mod.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY_LIGHT),
        ('GRID', (0,0), (-1,-1), 0.5, LINE),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_mod)
    story.append(Spacer(1, 14))

    # ── 3. HARDWARE & SERVER SIZING ──────────────────────────────────────────
    story.append(Paragraph("3. Hardware & VPS Sizing Recommendations", h1_style))
    story.append(Paragraph(
        "Depending on the expected employee team size and daily transaction frequency, choose from the verified server profiles below:",
        body_style
    ))

    hw_data = [
        [Paragraph("Specification", table_header_style), Paragraph("Tier 1: Starter (1-20 Users)", table_header_style), Paragraph("Tier 2: Business (20-100 Users)", table_header_style), Paragraph("Tier 3: Enterprise (100+ Users)", table_header_style)],
        [Paragraph("vCPU Cores", table_cell_bold), Paragraph("2 vCPU Cores", table_cell_style), Paragraph("4 vCPU Cores", table_cell_style), Paragraph("8 vCPU Cores", table_cell_style)],
        [Paragraph("RAM (Memory)", table_cell_bold), Paragraph("4 GB RAM", table_cell_style), Paragraph("8 GB RAM (Recommended)", table_cell_style), Paragraph("16 GB - 32 GB RAM", table_cell_style)],
        [Paragraph("Storage (NVMe)", table_cell_bold), Paragraph("50 GB NVMe SSD", table_cell_style), Paragraph("100 GB - 150 GB NVMe SSD", table_cell_style), Paragraph("250 GB+ NVMe SSD + S3 Storage", table_cell_style)],
        [Paragraph("Bandwidth", table_cell_bold), Paragraph("2 TB / month", table_cell_style), Paragraph("4 TB / month", table_cell_style), Paragraph("Unmetered / 10 Gbps Uplink", table_cell_style)],
        [Paragraph("Recommended Host", table_cell_bold), Paragraph("Hostinger KVM 2 / Hetzner CPX21", table_cell_style), Paragraph("Hostinger KVM 4 / DigitalOcean Droplet", table_cell_style), Paragraph("AWS EC2 c6i.2xlarge / Hetzner Dedicated", table_cell_style)],
        [Paragraph("Target Workload", table_cell_bold), Paragraph("Single factory / branch", table_cell_style), Paragraph("Multi-branch, 50 daily invoices, live punches", table_cell_style), Paragraph("Multi-company, high concurrency", table_cell_style)]
    ]
    t_hw = Table(hw_data, colWidths=[100, 134, 135, 135])
    t_hw.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('GRID', (0,0), (-1,-1), 0.5, LINE),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_hw)
    story.append(Spacer(1, 14))

    # Page Break for clean layout
    story.append(PageBreak())

    # ── 4. SOFTWARE STACK & OS PREREQUISITES ─────────────────────────────────
    story.append(Paragraph("4. Operating System & Software Prerequisites", h1_style))
    story.append(Paragraph("Every production VPS must be prepared with the following certified operating system packages:", body_style))

    os_items = [
        "<b>Operating System:</b> Ubuntu Server 22.04 LTS or Ubuntu Server 24.04 LTS (64-bit x86_64).",
        "<b>Node.js Runtime:</b> Node.js v20.x LTS (Active LTS) installed via NodeSource official repository.",
        "<b>Package Manager:</b> npm (v10+) or pnpm for consistent, zero-bloat lockfile installation.",
        "<b>Process Manager:</b> PM2 (Production Process Manager) with cluster mode, auto-startup (`pm2 startup`), and log rotation (`pm2-logrotate`).",
        "<b>Web Server & Reverse Proxy:</b> Nginx (v1.18+) configured with gzip compression, secure headers, and upstream proxy pass.",
        "<b>SSL Security Certificate:</b> Let's Encrypt Certbot (`certbot python3-certbot-nginx`) for automated TLS 1.3 certificates and 90-day auto-renewals.",
        "<b>Build Utilities:</b> Git, curl, ufw (Uncomplicated Firewall), fail2ban (brute force protection), and htop (system monitor)."
    ]
    for it in os_items:
        story.append(Paragraph(f"• {it}", bullet_style))
    story.append(Spacer(1, 12))

    # ── 5. DATABASE INFRASTRUCTURE (MONGODB ATLAS) ───────────────────────────
    story.append(Paragraph("5. Database Infrastructure (MongoDB Atlas vs Self-Hosted)", h1_style))
    story.append(Paragraph(
        "ARCIOX ERP relies on MongoDB for flexible, nested document handling (Quotations with line items, Attendance logs, Nested employee salary structures).",
        body_style
    ))

    db_data = [
        [Paragraph("Dimension", table_header_style), Paragraph("Option A: MongoDB Atlas (Recommended)", table_header_style), Paragraph("Option B: Self-Hosted on VPS", table_header_style)],
        [Paragraph("Cluster Tier", table_cell_bold), Paragraph("Shared M0 (Free dev) → Dedicated M10 / M20 (Prod)", table_cell_style), Paragraph("MongoDB Community Server 7.0+", table_cell_style)],
        [Paragraph("High Availability", table_cell_bold), Paragraph("3-node replica set with auto-failover built in", table_cell_style), Paragraph("Single node by default; manual replica set setup", table_cell_style)],
        [Paragraph("Automated Backups", table_cell_bold), Paragraph("Continuous point-in-time recovery & daily snapshots", table_cell_style), Paragraph("Must configure bash cron + `mongodump` to S3", table_cell_style)],
        [Paragraph("Security & Access", table_cell_bold), Paragraph("IP Access List (Whitelist) / VPC Peering / TLS 1.3", table_cell_style), Paragraph("Firewall port 27017 bind to 127.0.0.1 only", table_cell_style)],
        [Paragraph("Pricing Impact", table_cell_bold), Paragraph("M0: ₹0/mo | M10: ~$57/mo (~₹4,800/mo)", table_cell_style), Paragraph("Included inside VPS hosting cost", table_cell_style)]
    ]
    t_db = Table(db_data, colWidths=[90, 210, 204])
    t_db.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('GRID', (0,0), (-1,-1), 0.5, LINE),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_db)

    # Database callout note
    callout_data = [[
        Paragraph("<b>CRITICAL ATLAS SETTING:</b> In MongoDB Atlas Console → <i>Network Access</i>, you must add the Static Public IPv4 of your VPS host with description 'Production Web Server'. Never leave 0.0.0.0/0 permanently in production.", callout_style)
    ]]
    t_call = Table(callout_data, colWidths=[504])
    t_call.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_CARD),
        ('LINELEFT', (0,0), (0,0), 3, AMBER),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(Spacer(1, 6))
    story.append(t_call)
    story.append(Spacer(1, 14))

    # ── 6. DOMAIN, DNS & REVERSE PROXY CONFIGURATION ──────────────────────────
    story.append(Paragraph("6. Domain, DNS Records & Nginx Architecture", h1_style))
    story.append(Paragraph("A custom branded domain (e.g., <code>erp.yourcompany.com</code>) is required for SSL cookies and mobile access:", body_style))

    dns_data = [
        [Paragraph("Record Type", table_header_style), Paragraph("Host / Name", table_header_style), Paragraph("Points To (Target)", table_header_style), Paragraph("TTL", table_header_style)],
        [Paragraph("A Record", table_cell_bold), Paragraph("erp (or @)", table_cell_style), Paragraph("VPS Public IPv4 (e.g. 194.164.xx.xx)", table_cell_style), Paragraph("300 / Auto", table_cell_style)],
        [Paragraph("CNAME", table_cell_bold), Paragraph("www.erp", table_cell_style), Paragraph("erp.yourcompany.com", table_cell_style), Paragraph("300 / Auto", table_cell_style)],
        [Paragraph("CAA Record", table_cell_bold), Paragraph("@", table_cell_style), Paragraph("0 issue \"letsencrypt.org\"", table_cell_style), Paragraph("3600", table_cell_style)]
    ]
    t_dns = Table(dns_data, colWidths=[80, 100, 240, 84])
    t_dns.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY_LIGHT),
        ('GRID', (0,0), (-1,-1), 0.5, LINE),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_dns)
    story.append(Spacer(1, 14))

    # ── 7. ENVIRONMENT VARIABLES & SECRETS ───────────────────────────────────
    story.append(Paragraph("7. Production Environment Configuration (.env)", h1_style))
    story.append(Paragraph("The backend directory must contain a production-secured <code>.env</code> file with non-default cryptographic keys:", body_style))

    env_items = [
        "<code>PORT=5000</code> — Port bound locally to 127.0.0.1 for Nginx reverse proxy.",
        "<code>NODE_ENV=production</code> — Enables Express production optimizations and secure cookie flags.",
        "<code>MONGO_URI=mongodb+srv://&lt;user&gt;:&lt;password&gt;@cluster0...mongodb.net/arciox_erp?retryWrites=true&w=majority</code>",
        "<code>JWT_SECRET=&lt;min-64-character-random-hex-string&gt;</code> — Generates authorization tokens.",
        "<code>JWT_EXPIRES_IN=7d</code> — User session lifetime.",
        "<code>COOKIE_SECRET=&lt;random-32-character-secret&gt;</code> — Protects signed cookies.",
        "<code>CLIENT_URL=https://erp.yourcompany.com</code> — Exact domain for strict CORS origin validation.",
        "<code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code> — Transactional email credentials."
    ]
    for it in env_items:
        story.append(Paragraph(f"• {it}", bullet_style))
    story.append(Spacer(1, 12))

    # Page Break for clean layout
    story.append(PageBreak())

    # ── 8. EXTERNAL INTEGRATIONS & THIRD-PARTY SERVICES ──────────────────────
    story.append(Paragraph("8. Third-Party Integrations & Cost Analysis", h1_style))
    story.append(Paragraph("To activate automated WhatsApp messaging, PDF generation, and salary payment notifications, consider these services:", body_style))

    tp_data = [
        [Paragraph("Integration", table_header_style), Paragraph("Provider Options", table_header_style), Paragraph("Purpose / Workflow", table_header_style), Paragraph("Cost in INR (Approx)", table_header_style)],
        [
            Paragraph("WhatsApp Automation", table_cell_bold),
            Paragraph("Meta WhatsApp Cloud API (Direct)", table_cell_style),
            Paragraph("Auto-send invoices, proformas, quotation PDFs directly to client WhatsApp.", table_cell_style),
            Paragraph("Free setup + 1,000 free chats/mo.<br/>~₹0.35 per utility invoice message.", table_cell_style)
        ],
        [
            Paragraph("Transactional Email", table_cell_bold),
            Paragraph("Brevo (Sendinblue) / SendGrid / Postmark", table_cell_style),
            Paragraph("Salary paid notifications to employees, quotation emails to clients.", table_cell_style),
            Paragraph("Free for 300 emails/day.<br/>Paid tier: ~₹1,200 - ₹1,800/mo.", table_cell_style)
        ],
        [
            Paragraph("Offsite Backups", table_cell_bold),
            Paragraph("AWS S3 / Cloudflare R2 / Google Drive", table_cell_style),
            Paragraph("Daily zipped MongoDB dumps stored securely outside the server host.", table_cell_style),
            Paragraph("Cloudflare R2: ₹0 (under 10GB).<br/>AWS S3: ~₹150 - ₹300/mo.", table_cell_style)
        ],
        [
            Paragraph("Domain Name", table_cell_bold),
            Paragraph("Namecheap / Hostinger / GoDaddy", table_cell_style),
            Paragraph(".com or .in domain for professional web access and SSL certification.", table_cell_style),
            Paragraph("~₹800 to ₹1,200 / year (~₹100/mo).", table_cell_style)
        ]
    ]
    t_tp = Table(tp_data, colWidths=[90, 110, 184, 120])
    t_tp.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('GRID', (0,0), (-1,-1), 0.5, LINE),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_tp)
    story.append(Spacer(1, 14))

    # ── 9. PRODUCTION SECURITY & HARDENING CHECKLIST ─────────────────────────
    story.append(Paragraph("9. Production Security & Hardening Checklist", h1_style))
    story.append(Paragraph("Before going live, the following security controls must be enabled:", body_style))

    sec_items = [
        "<b>SSH Hardening:</b> Disable root login (`PermitRootLogin no`) and password authentication (`PasswordAuthentication no`); enforce Ed25519 SSH keys.",
        "<b>Firewall (UFW):</b> Allow only Port 22 (SSH), Port 80 (HTTP), and Port 443 (HTTPS). Block Port 5000 and Port 27017 from public internet.",
        "<b>Fail2ban:</b> Automatically ban IP addresses after 5 consecutive failed SSH or login attempts.",
        "<b>SSL Strictness:</b> Enforce HTTP to HTTPS 301 permanent redirect and enable HSTS (HTTP Strict Transport Security) in Nginx.",
        "<b>Express Hardening:</b> Helmet HTTP headers enabled, Rate Limiter (`express-rate-limit`) active on `/api/*`, and CORS locked to `CLIENT_URL`."
    ]
    for it in sec_items:
        story.append(Paragraph(f"☑ {it}", bullet_style))
    story.append(Spacer(1, 14))

    # ── 10. ESTIMATED MONTHLY HOSTING BUDGET ─────────────────────────────────
    story.append(Paragraph("10. Estimated Monthly Hosting Budget Breakdown", h1_style))
    story.append(Paragraph("Total cost breakdown for small to medium enterprise deployment in Indian Rupees (INR) and USD:", body_style))

    cost_data = [
        [Paragraph("Item / Service", table_header_style), Paragraph("Option 1: Budget Pro (Recommended)", table_header_style), Paragraph("Option 2: Cloud Dedicated", table_header_style)],
        [Paragraph("VPS Server", table_cell_bold), Paragraph("Hostinger KVM 2 / KVM 4: <b>₹499 – ₹899 / mo</b>", table_cell_style), Paragraph("AWS EC2 / DO Droplet: <b>₹2,400 – ₹4,500 / mo</b>", table_cell_style)],
        [Paragraph("MongoDB Database", table_cell_bold), Paragraph("Atlas M0 (Free Tier): <b>₹0 / mo</b>", table_cell_style), Paragraph("Atlas Dedicated M10: <b>~₹4,800 / mo</b>", table_cell_style)],
        [Paragraph("Domain Name", table_cell_bold), Paragraph(".in or .com Domain: <b>~₹90 / mo</b> (billed yearly)", table_cell_style), Paragraph("Branded Domain: <b>~₹100 / mo</b>", table_cell_style)],
        [Paragraph("SSL Certificate", table_cell_bold), Paragraph("Let's Encrypt Wildcard: <b>₹0 / Free</b>", table_cell_style), Paragraph("Commercial / Cloudflare SSL: <b>₹0 / Free</b>", table_cell_style)],
        [Paragraph("WhatsApp Messages", table_cell_bold), Paragraph("Meta Cloud API: <b>₹200 – ₹500 / mo</b> (per usage)", table_cell_style), Paragraph("AiSensy / Wati: <b>₹1,500 – ₹2,500 / mo</b>", table_cell_style)],
        [Paragraph("Transactional Email", table_cell_bold), Paragraph("Brevo Free Tier: <b>₹0 / mo</b>", table_cell_style), Paragraph("SendGrid Starter: <b>~₹1,200 / mo</b>", table_cell_style)],
        [Paragraph("Offsite S3 Backups", table_cell_bold), Paragraph("Cloudflare R2: <b>₹0 / mo</b>", table_cell_style), Paragraph("AWS S3 + Glacier: <b>~₹250 / mo</b>", table_cell_style)],
        [
            Paragraph("<b>TOTAL MONTHLY ESTIMATE</b>", table_header_style),
            Paragraph("<b>₹789 – ₹1,489 / month</b> (~$9 – $18 USD)", table_header_style),
            Paragraph("<b>₹10,250 – ₹13,550 / month</b> (~$120 – $160 USD)", table_header_style)
        ]
    ]
    t_cost = Table(cost_data, colWidths=[120, 192, 192])
    t_cost.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('GRID', (0,0), (-1,-1), 0.5, LINE),
        ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.white, BG_LIGHT]),
        ('BACKGROUND', (0,-1), (-1,-1), NAVY_LIGHT),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_cost)
    story.append(Spacer(1, 14))

    # ── 11. STEP-BY-STEP DEPLOYMENT ROADMAP ──────────────────────────────────
    story.append(Paragraph("11. Production Go-Live Deployment Steps", h1_style))
    steps = [
        "<b>Step 1 — Server Provisioning:</b> Purchase an Ubuntu 22.04 / 24.04 VPS (Hostinger KVM 2 or KVM 4). Note down its Static Public IP.",
        "<b>Step 2 — Security Setup:</b> Create sudo user, configure SSH keys, set up UFW firewall (`ufw allow 22, 80, 443`).",
        "<b>Step 3 — Database Provisioning:</b> Create MongoDB Atlas cluster. Whitelist VPS IP and save the connection string.",
        "<b>Step 4 — Repository & Dependencies:</b> Clone repository to <code>/var/www/arciox-erp</code>. Run <code>npm install</code> in both backend and admin.",
        "<b>Step 5 — Environment Config:</b> Create <code>backend/.env</code> with production Mongo URI, JWT secrets, and domain URL.",
        "<b>Step 6 — Process Manager (PM2):</b> Launch backend via <code>pm2 start src/index.js --name \"arciox-api\"</code> and configure <code>pm2 startup</code>.",
        "<b>Step 7 — Frontend Production Build:</b> Run <code>npm run build</code> in <code>admin/</code> to generate production static files in <code>admin/dist</code>.",
        "<b>Step 8 — Nginx Reverse Proxy:</b> Configure Nginx to serve <code>admin/dist</code> on root and proxy <code>/api</code> requests to <code>http://127.0.0.1:5000</code>.",
        "<b>Step 9 — SSL Activation:</b> Run <code>certbot --nginx -d erp.yourdomain.com</code> to activate HTTPS with automatic renewal.",
        "<b>Step 10 — Verification & Verification:</b> Verify Login, Customer creation, Quotations, Payroll, Attendance, and To-Do Tasks."
    ]
    for s in steps:
        story.append(Paragraph(f"• {s}", bullet_style))

    # Build the document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully built at: {filename}")

if __name__ == "__main__":
    output_pdf = os.path.abspath("ARCIOX_ERP_Production_Hosting_Requirements.pdf")
    build_pdf(output_pdf)

