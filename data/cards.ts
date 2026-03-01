import type { Card } from '@/lib/types';

export const CARDS: Card[] = [
  // ===== PHISHING - EASY =====
  {
    id: 'p-easy-001',
    type: 'email',
    difficulty: 'easy',
    isPhishing: true,
    from: 'security@paypa1.com',
    subject: 'Urgent: Your Account Has Been Suspended',
    body: `Dear Valued Customer,

We have detected unusual activity on your PayPal account. To protect your account from unauthorized access, it has been temporarily suspended.

To restore access immediately, please verify your information by clicking the link below:

http://paypal-account-restore.net/verify?token=8x2mK9pL

This link will expire in 24 hours. Failure to verify will result in permanent account closure.

PayPal Security Team`,
    clues: [
      'Sender domain is "paypa1.com" — note the "1" instead of "l"',
      'Threatening language: "permanent account closure" creates panic',
      'Generic greeting "Dear Valued Customer" — PayPal uses your name',
      'Link points to paypal-account-restore.net, not paypal.com',
    ],
    highlights: [
      'Dear Valued Customer',
      'temporarily suspended',
      'http://paypal-account-restore.net/verify?token=8x2mK9pL',
      'permanent account closure',
    ],
    explanation:
      "Classic impersonation. The sender swapped the lowercase 'l' for the number '1' in the domain. PayPal always addresses you by name and links only to paypal.com.",
  },
  {
    id: 'p-easy-002',
    type: 'sms',
    difficulty: 'easy',
    isPhishing: true,
    from: '+1 (829) 554-7831',
    body: `CONGRATULATIONS! You've been selected as our weekly prize winner. Claim your $750 Amazon Gift Card before it expires:

amzn-giftwinner.com/claim/GC847291

Offer expires in 2 hours. Reply STOP to unsubscribe.`,
    clues: [
      "Unsolicited prize — you didn't enter any contest",
      'Fake urgency: "expires in 2 hours"',
      'Domain is "amzn-giftwinner.com" not amazon.com',
      'Unknown phone number, not an Amazon short code',
    ],
    highlights: [
      'CONGRATULATIONS!',
      'amzn-giftwinner.com/claim/GC847291',
      'expires in 2 hours',
    ],
    explanation:
      "If you didn't enter a contest, you didn't win one. The 'Reply STOP' text is designed to look legitimate. The link leads to a credential harvesting or malware page.",
  },
  {
    id: 'p-easy-003',
    type: 'email',
    difficulty: 'easy',
    isPhishing: true,
    from: 'refunds@irs-gov-refund.com',
    subject: 'Federal Tax Refund: $1,247.00 Awaiting Deposit',
    body: `Notice from Internal Revenue Service

A federal tax refund of $1,247.00 has been issued to your account. To receive your refund via direct deposit, you must verify your banking information within 5 business days.

Submit your banking details here:
https://irs-gov-refund.com/claim?ref=TX-2025-84721

Note: Failure to claim within 5 days will result in forfeiture of funds.

Internal Revenue Service
U.S. Department of the Treasury`,
    clues: [
      'The IRS never initiates contact via email — only by postal mail',
      'Domain is "irs-gov-refund.com" not irs.gov',
      'Asks you to submit banking information via a link',
      'Fake urgency: "5-day forfeiture" threat',
    ],
    highlights: [
      'verify your banking information',
      'https://irs-gov-refund.com/claim?ref=TX-2025-84721',
      'Failure to claim within 5 days will result in forfeiture of funds',
    ],
    explanation:
      'The IRS does not email taxpayers to initiate contact — they send letters. The real IRS domain is irs.gov. Refunds are processed through your already-filed return, not via a link.',
  },
  {
    id: 'p-easy-004',
    type: 'sms',
    difficulty: 'easy',
    isPhishing: true,
    from: '+1 (473) 920-1847',
    body: `Your [Bank] verification code is 847291. NEVER share this code. If you didn't request this, call us at 1-800-555-0192 to secure your account.`,
    clues: [
      'Placeholder "[Bank]" not replaced — indicates a template-based fraud operation',
      "Unsolicited code you didn't request",
      'Callback number you were not given before — could be a vishing setup',
      'Real banks send codes from short codes, not full 10-digit numbers',
    ],
    highlights: [
      '[Bank]',
      'call us at 1-800-555-0192',
    ],
    explanation:
      "This is a precursor to a vishing attack. The fraudster triggers a real password reset, sends you the code, then calls pretending to be the bank asking for it to 'verify your identity.'",
  },

  // ===== PHISHING - MEDIUM =====
  {
    id: 'p-med-001',
    type: 'email',
    difficulty: 'medium',
    isPhishing: true,
    from: 'helpdesk@microsoft-support-center.net',
    subject: 'Action Required: Microsoft 365 Password Expiring in 24 Hours',
    body: `IT Security Notification

Your Microsoft 365 password is scheduled to expire in 24 hours.

To continue accessing your email and applications without interruption, please update your password now:

https://m365-password-update.microsoft-support-center.net/renew

If you have already updated your password, please disregard this message.

IT Helpdesk
Microsoft 365 Support`,
    clues: [
      'Domain is "microsoft-support-center.net" — not microsoft.com',
      'Microsoft 365 password resets are done through your own org portal',
      'The link contains "microsoft" as a subdomain but the real domain is microsoft-support-center.net',
      "No personalization — doesn't mention your name or organization",
    ],
    highlights: [
      'expire in 24 hours',
      'https://m365-password-update.microsoft-support-center.net/renew',
    ],
    explanation:
      'Subdomain trick: m365-password-update.microsoft-support-center.net looks official at a glance, but the actual domain is microsoft-support-center.net. Microsoft sends password notices from microsoft.com domains.',
  },
  {
    id: 'p-med-002',
    type: 'sms',
    difficulty: 'medium',
    isPhishing: true,
    from: '+1 (855) 293-7748',
    body: `USPS ALERT: Your package (9400111102568327) could not be delivered due to an incomplete address. Update your delivery info to avoid return:

usps-redelivery.net/update/940011

$0.30 address validation fee required.`,
    clues: [
      'Real USPS domain is usps.com — not usps-redelivery.net',
      'USPS does not text payment requests via link',
      'Small fee ($0.30) is designed to seem too cheap to question — they want your card details',
      'Sent from a full phone number, not the official USPS short code 28777',
    ],
    highlights: [
      'usps-redelivery.net/update/940011',
      '$0.30 address validation fee required',
    ],
    explanation:
      "USPS smishing is extremely common. The small fee is a hook — the goal is your payment card details, not $0.30. USPS sends tracking texts from 28777 (ATUSPS), not random numbers.",
  },
  {
    id: 'p-med-003',
    type: 'email',
    difficulty: 'medium',
    isPhishing: true,
    from: 'noreply@secure-chasealert.com',
    subject: 'Important: Suspicious Transaction Detected on Your Account',
    body: `Chase Online Security Alert

We detected a suspicious charge of $284.99 from ONLINE-RETAILER on your Chase account ending in 4832.

If you do not recognize this transaction, please verify your identity immediately:

Verify Identity → secure-chasealert.com/verify

If you authorized this charge, no action is needed.

Chase Online Security`,
    clues: [
      'Domain is "secure-chasealert.com" — Chase emails come from chase.com',
      'Chase does not send credential verification links via email',
      'The "Verify Identity" link goes to the same fake domain',
      'Creating fear about a fake transaction to prompt immediate action',
    ],
    highlights: [
      'suspicious charge of $284.99',
      'verify your identity immediately',
      'secure-chasealert.com/verify',
    ],
    explanation:
      "Chase's real domain is chase.com. Your real bank's fraud team calls you — they don't send links to re-enter credentials. If you get a fraud alert, log in directly via your bank's app or website.",
  },
  {
    id: 'p-med-004',
    type: 'email',
    difficulty: 'medium',
    isPhishing: true,
    from: 'noreply@zoom-security-update.com',
    subject: 'Your Zoom account has been temporarily suspended',
    body: `Zoom Security Notice

Your Zoom account (alex@example.com) has been temporarily suspended due to a violation of our Terms of Service.

To appeal this decision and restore access within 24 hours, please verify your identity:

Restore Account → zoom-security-update.com/restore

If you believe this is an error, contact support@zoom-security-update.com

Zoom Trust & Safety`,
    clues: [
      "Domain is \"zoom-security-update.com\" — Zoom's real domain is zoom.us",
      'Vague "Terms of Service violation" with no specifics — designed to cause anxiety',
      'Urgent 24-hour restoration window',
      'Support email is on the same fake domain',
    ],
    highlights: [
      'violation of our Terms of Service',
      'zoom-security-update.com/restore',
      'restore access within 24 hours',
      'support@zoom-security-update.com',
    ],
    explanation:
      "Zoom phishing targeting your credentials. Real Zoom communications come from @zoom.us domains. The vague violation reason is intentional — it makes you anxious without giving details you could verify.",
  },

  // ===== PHISHING - HARD =====
  {
    id: 'p-hard-001',
    type: 'email',
    difficulty: 'hard',
    isPhishing: true,
    from: 'ceo@acmecorp-global.com',
    subject: 'Urgent — Wire Transfer Needed Today',
    body: `Hey,

I'm currently in Singapore for a client meeting and my phone isn't working properly — please don't call, just respond here.

I need you to process a wire transfer of $47,500 to our new vendor. I've been trying to get this done all morning and it's holding up the deal.

Beneficiary: Meridian Trade Ltd
Account: 8847291034
Routing: 021000089

I'll explain everything when I'm back. This is time-sensitive — can you get this done in the next hour?

Thanks
Michael (sent from my personal email while traveling)`,
    clues: [
      'CEO emailing from an external domain, not the company domain',
      "Requests you don't call — prevents verification",
      'Classic BEC pattern: travel excuse + urgent wire + new vendor',
      'Pressure to act within an hour with no documentation or purchase order',
    ],
    highlights: [
      "please don't call",
      'wire transfer of $47,500',
      'can you get this done in the next hour?',
    ],
    explanation:
      "Business Email Compromise (BEC). The attacker impersonates an executive, creates urgency, and blocks verbal verification. Always verify wire transfers via a known phone number — never by replying to the email.",
  },
  {
    id: 'p-hard-002',
    type: 'email',
    difficulty: 'hard',
    isPhishing: true,
    from: 'events@linkedin-notifications.net',
    subject: 'Alex, your talk at SFISSA is getting attention',
    body: `Hi Alex,

Your recent presentation at the South Florida ISSA chapter generated significant interest. Several members have asked us to share your slides.

We've created a shared link on our platform for easy access:

View & Download Your Slides →
linkedin-notifications.net/slides/sfissa-alex-c

You can also see who viewed your content from this link. The link expires in 48 hours.

LinkedIn Events Team`,
    clues: [
      'Domain is "linkedin-notifications.net" — LinkedIn emails come from linkedin.com',
      'Uses specific personal details scraped from your public LinkedIn profile',
      '"See who viewed your content" is curiosity bait',
      'Fake 48-hour urgency',
    ],
    highlights: [
      'linkedin-notifications.net/slides/sfissa-alex-c',
      'See who viewed your content',
      'The link expires in 48 hours',
    ],
    explanation:
      "Spear phishing using OSINT. The attacker found your SFISSA involvement on LinkedIn and crafted a targeted message. LinkedIn notifications come from @linkedin.com — this domain leads to a credential harvesting page.",
  },

  // ===== LEGIT - EASY =====
  {
    id: 'l-easy-001',
    type: 'email',
    difficulty: 'easy',
    isPhishing: false,
    from: 'shipment-tracking@amazon.com',
    subject: 'Your package is on the way',
    body: `Hello Alex,

Your order has shipped and is on its way.

Order #113-8472901-9384726
Estimated delivery: Thursday, February 27

Items in this shipment:
• Anker 737 Power Bank (PowerCore 26K) — Qty: 1

Track your package:
https://www.amazon.com/progress-tracker/package?ref=pe_2374520_444738770

Thank you for shopping with us.
Amazon.com`,
    clues: [],
    explanation:
      'Legitimate Amazon shipping email. The sender domain is amazon.com, your name is used, the order number is specific, and the tracking link goes to amazon.com. No credential requests, no urgency.',
  },
  {
    id: 'l-easy-002',
    type: 'sms',
    difficulty: 'easy',
    isPhishing: false,
    from: 'Uber',
    body: `Your Tuesday evening trip receipt from Uber.

Total: $14.20
Driver: Marco G.
Route: Brickell → Wynwood

See your full receipt:
riders.uber.com/trips/abc123def456

Thanks for riding with Uber!`,
    clues: [],
    explanation:
      "Legitimate Uber receipt SMS. Comes from the 'Uber' alphanumeric sender ID, contains specific trip details (driver name, route, exact cost), and links to riders.uber.com.",
  },

  // ===== LEGIT - MEDIUM =====
  {
    id: 'l-med-001',
    type: 'email',
    difficulty: 'medium',
    isPhishing: false,
    from: 'noreply@github.com',
    subject: '[GitHub] A new public key was added to your account',
    body: `Hey jrivera,

A new public key was added to your GitHub account.

Key fingerprint: SHA256:j4KmRx29pLbNqA8cT7wYeI5mDv2oXH3sUf6gZk1BWtE

If you added this key, you can ignore this message.

If you did NOT add this key, please remove it from your account settings and consider changing your password immediately:
https://github.com/settings/keys

— The GitHub Team`,
    clues: [],
    explanation:
      "Legitimate GitHub security notification. Comes from noreply@github.com, addresses your username (not 'valued customer'), provides the actual key fingerprint, and links to github.com/settings.",
  },
  {
    id: 'l-med-002',
    type: 'email',
    difficulty: 'medium',
    isPhishing: false,
    from: 'no_reply@email.apple.com',
    subject: 'Your receipt from Apple',
    body: `Receipt
Apple ID: alex@example.com
Billed to: Visa ···· 4921
Date: 26 Feb 2026

Screens for the Home App          $4.99
Subtotal:                         $4.99
Tax:                              $0.35
Order Total:                      $5.34

Document No.: M2B4K9X7R3

If you didn't make this purchase, or if you believe an unauthorized person is accessing your account, go to iforgot.apple.com.

Apple`,
    clues: [],
    explanation:
      "Legitimate Apple receipt. Comes from email.apple.com (Apple's email domain), shows your actual Apple ID, includes a specific app name and document number, and links only to apple.com domains.",
  },
  {
    id: 'l-med-003',
    type: 'email',
    difficulty: 'medium',
    isPhishing: false,
    from: 'dse@docusign.net',
    subject: 'Alex Chen, please DocuSign this document',
    body: `Please DocuSign this document

Hello Alex Chen,

Innovative Security Partners has sent you a document to review and sign.

Document: 2026 Consulting Agreement — ISP / A. Chen
Envelope ID: 3F7A2D-9841B-C3D1E-74829

REVIEW DOCUMENT

This link is valid for 30 days. Do not share this email.

Do Not Share: This email contains a secure link to DocuSign. Please do not share this email, link, or access code with anyone.`,
    clues: [],
    explanation:
      "Legitimate DocuSign notification. Comes from dse@docusign.net (DocuSign's sending domain), includes your full name, a specific envelope ID, and the name of the sending organization.",
  },
  {
    id: 'l-med-004',
    type: 'email',
    difficulty: 'medium',
    isPhishing: false,
    from: 'jobs-noreply@linkedin.com',
    subject: 'Alex, 3 new jobs match your profile',
    body: `Hi Alex,

Based on your profile, these jobs may interest you:

Senior Security Engineer — CrowdStrike
Miami, FL · $145K–$175K · Posted 2 days ago

Cloud Security Architect — Palo Alto Networks
Remote · $160K–$195K · Posted 5 days ago

Information Security Manager — Citrix
Fort Lauderdale, FL · $130K–$155K · Posted 1 week ago

View all recommended jobs on LinkedIn

Unsubscribe from job alerts · Help Center
LinkedIn Corporation, 1000 West Maude Avenue, Sunnyvale, CA 94085`,
    clues: [],
    explanation:
      'Legitimate LinkedIn job alert. Comes from jobs-noreply@linkedin.com, uses your name, shows real company names with salary ranges, and includes a physical mailing address (required by CAN-SPAM). No credential requests.',
  },

  // ===== LEGIT - HARD =====
  {
    id: 'l-hard-001',
    type: 'email',
    difficulty: 'hard',
    isPhishing: false,
    from: 'account-security-noreply@accountprotection.microsoft.com',
    subject: 'Microsoft account security alert',
    body: `Microsoft account

Unusual sign-in activity

We detected something unusual about a recent sign-in to the Microsoft account alex@example.com.

Sign-in details
Country/Region:  Brazil
IP address:      189.14.x.x
Date:            26 Feb 2026, 04:17 UTC
Platform:        Windows
Browser:         Chrome

If this was you, you can safely ignore this email.

If this wasn't you, your account may be compromised. Please review your recent activity:
https://account.microsoft.com/activity

Microsoft will never ask for your password in an email.

The Microsoft account team`,
    clues: [],
    explanation:
      "Legitimate Microsoft security alert. The sender domain 'accountprotection.microsoft.com' is a real Microsoft domain. It includes specific sign-in details and links only to account.microsoft.com. Note the explicit statement: 'Microsoft will never ask for your password in an email.'",
  },
  {
    id: 'l-hard-002',
    type: 'email',
    difficulty: 'hard',
    isPhishing: false,
    from: 'service@paypal.com',
    subject: 'You received a payment',
    body: `Hi Alex,

You've got money!

Marcus T. sent you $125.00.

Note from Marcus: "Half of dinner from Saturday — thanks!"

Your new PayPal balance: $312.47

This payment is now available in your PayPal account. You can transfer it to your bank or spend it using PayPal.

View your balance

Didn't expect this payment? If you have concerns, visit our Resolution Center.

PayPal`,
    clues: [],
    explanation:
      'Legitimate PayPal notification. Comes from service@paypal.com, addresses you by name, includes a specific payment amount and sender name with a personal note, and shows your current balance. No links asking for credentials.',
  },
  {
    id: 'l-hard-003',
    type: 'email',
    difficulty: 'hard',
    isPhishing: false,
    from: 'statements@bankofamerica.com',
    subject: 'Your statement for account ending in 7291 is ready',
    body: `Bank of America
Online Banking

Your February 2026 statement is ready to view.

Account: Advantage Banking ···· 7291
Statement period: Jan 28 – Feb 27, 2026

To view your statement, sign in to Online Banking at bankofamerica.com and go to Statements & Documents.

We do not include direct links to statements in email for your security.

Questions? Call the number on the back of your card.

Bank of America`,
    clues: [],
    explanation:
      "Legitimate Bank of America statement notice. Critically, it includes NO clickable link to the statement — it tells you to log in directly at bankofamerica.com. This is a hallmark of a legitimate bank email. It also explicitly explains why there's no link.",
  },
  {
    id: 'l-hard-004',
    type: 'sms',
    difficulty: 'hard',
    isPhishing: false,
    from: '28777',
    body: `USPS: Expected delivery update for 9400111102568327641248.

Your package is out for delivery. Estimated by 8:00 PM today.

Track at usps.com/track

-USPS`,
    clues: [],
    explanation:
      "Legitimate USPS tracking SMS. Sent from 28777 (ATUSPS — the official USPS short code), includes a real 22-digit tracking number, and links only to usps.com. No payment request, no urgency tactics.",
  },

  // ===== PHISHING - EASY (additional) =====
  {
    id: 'p-easy-005',
    type: 'email',
    difficulty: 'easy',
    isPhishing: true,
    from: 'billing@netflixaccounts.info',
    subject: 'Action Required: Your Netflix Payment Failed',
    body: `Dear Netflix Member,

We were unable to process your payment for this billing cycle. Your account will be suspended within 24 hours unless you update your payment method.

Update Payment Now:
http://netflix-billing-update.com/payment?id=NF8472910

To avoid any service interruption, please act immediately.

Netflix Support`,
    clues: [
      'Domain is "netflixaccounts.info" — Netflix emails come from netflix.com',
      'Generic greeting "Dear Netflix Member" — Netflix uses your name',
      'Link goes to netflix-billing-update.com, not netflix.com',
      '24-hour suspension threat creates false urgency',
    ],
    highlights: [
      'Dear Netflix Member',
      'suspended within 24 hours',
      'http://netflix-billing-update.com/payment?id=NF8472910',
    ],
    explanation:
      "Netflix phishing is extremely common. The real Netflix domain is netflix.com and they address you by your account name. Payment issues are managed through your account settings at netflix.com — not via emailed links.",
  },
  {
    id: 'p-easy-006',
    type: 'sms',
    difficulty: 'easy',
    isPhishing: true,
    from: '+1 (312) 874-9021',
    body: `Google Alert: Your account was signed in from a new device in Romania. If this wasn't you, secure your account immediately:

goog-account-verify.com/secure

Reply STOP to opt out.`,
    clues: [
      'Domain is "goog-account-verify.com" — Google security alerts come from accounts.google.com',
      'Real Google alerts are sent via email to your Gmail, not random SMS',
      'Sent from a 10-digit number, not a Google short code',
      '"Reply STOP" is designed to appear like a legitimate alert service',
    ],
    highlights: [
      'goog-account-verify.com/secure',
    ],
    explanation:
      "Google does not send security alerts via SMS to random numbers. Real sign-in alerts go to your Gmail or through the Google app. The 'goog-' prefix is meant to look familiar at a glance.",
  },

  // ===== PHISHING - MEDIUM (additional) =====
  {
    id: 'p-med-005',
    type: 'email',
    difficulty: 'medium',
    isPhishing: true,
    from: 'hr-payroll@acmecorp-hr.net',
    subject: 'Action Required: Update Your Direct Deposit Information',
    body: `Human Resources — Payroll Department

We are migrating to a new payroll system and require all employees to verify their direct deposit banking information by end of business Friday.

Update your banking details here:
https://acmecorp-hr.net/payroll/update

Employees who do not update by the deadline will experience a delay in their next paycheck.

HR Payroll Team
Acme Corporation`,
    clues: [
      'Domain is "acmecorp-hr.net" — check your actual company domain',
      'Legitimate HR payroll changes go through your internal HRIS system (Workday, ADP, etc.), not a link',
      'End-of-week deadline creates urgency without justification',
      'Threat of delayed paycheck pressures quick action without verification',
    ],
    highlights: [
      'by end of business Friday',
      'https://acmecorp-hr.net/payroll/update',
      'delay in their next paycheck',
    ],
    explanation:
      "Payroll diversion is a high-value BEC attack. Attackers spoof or compromise HR addresses and redirect employee direct deposits to attacker-controlled accounts. Always verify payroll changes through your official HR system or by calling HR directly.",
  },
  {
    id: 'p-med-006',
    type: 'email',
    difficulty: 'medium',
    isPhishing: true,
    from: 'noreply@docusign-secure.net',
    subject: 'You have a pending document awaiting your signature',
    body: `DocuSign Electronic Signature

Hello,

A document has been shared with you for electronic signature. This document requires your signature before the deadline.

Document: Contractor Agreement — Final
Sent by: Legal Department

REVIEW DOCUMENT →
docusign-secure.net/sign/doc?id=AB7291C

This link expires in 72 hours.

DocuSign, Inc.`,
    clues: [
      'Domain is "docusign-secure.net" — legitimate DocuSign emails come from docusign.net or docusign.com',
      'No sender name or organization — just "Legal Department"',
      'No Envelope ID included (real DocuSign emails always include one)',
      '"docusign-secure.net" — adding "secure" to a domain is a common phishing tactic',
    ],
    highlights: [
      'Hello,',
      'Legal Department',
      'docusign-secure.net/sign/doc?id=AB7291C',
    ],
    explanation:
      "DocuSign phishing is common because people are conditioned to click signature links quickly. Real DocuSign emails come from docusign.net or docusign.com and always include a specific Envelope ID and the full name of the sending organization.",
  },

  // ===== PHISHING - HARD (additional) =====
  {
    id: 'p-hard-003',
    type: 'email',
    difficulty: 'hard',
    isPhishing: true,
    from: 'noreply@github.com',
    subject: '[GitHub] Please verify your email address',
    body: `Hey jrivera,

Please verify your email address to continue using GitHub.

Verify email address →
https://github-email-verify.com/verify?token=3k9mXpL2qR8

If you didn't request this, you can ignore this email.

Thanks,
The GitHub Team`,
    clues: [
      'The link goes to "github-email-verify.com" — not github.com',
      'Real GitHub verification links go to github.com/users/confirm_email/...',
      "The sender display name shows noreply@github.com but check the actual header — it's spoofed",
      "Unexpected verification request you didn't initiate",
    ],
    highlights: [
      'https://github-email-verify.com/verify?token=3k9mXpL2qR8',
    ],
    explanation:
      "This is hard because the 'from' looks like GitHub. But the link domain is github-email-verify.com — completely different from github.com. GitHub's own verification emails link to github.com paths. Always hover over links before clicking.",
  },
  {
    id: 'p-hard-004',
    type: 'email',
    difficulty: 'hard',
    isPhishing: true,
    from: 'invoices@delta-tech-supplies.com',
    subject: 'Invoice #INV-2026-0394 — Updated Banking Details',
    body: `Hi,

Please find attached Invoice #INV-2026-0394 for $12,840.00 related to the Q1 hardware order.

Please note: Our banking details have recently changed. Please update your records and process this payment to our new account:

Bank: First National Commercial Bank
Account Name: Delta Tech Supplies LLC
Account Number: 7749302841
Routing: 026013576

Please disregard previous banking details. Contact us if you have any questions.

Regards,
Accounts Receivable
Delta Tech Supplies`,
    clues: [
      'Unsolicited change of banking details mid-relationship is a classic vendor fraud signal',
      'No verification mechanism offered — just "trust us"',
      'The email asks you to discard previously verified banking info',
      'No invoice attachment or verifiable order reference beyond the invoice number',
    ],
    highlights: [
      'Our banking details have recently changed',
      'Please disregard previous banking details',
      'Account Number: 7749302841',
    ],
    explanation:
      "Vendor payment fraud: attackers compromise or spoof a known supplier's email and redirect payments to attacker accounts. Always verify banking detail changes via a known phone number from your records — not from the email itself.",
  },
  {
    id: 'p-hard-005',
    type: 'email',
    difficulty: 'hard',
    isPhishing: true,
    from: 'it-helpdesk@yourdomain-support.com',
    subject: 'Ticket #HD-48291: Remote Session Required to Complete Security Patch',
    body: `IT Helpdesk — Ticket #HD-48291

Hi,

We are rolling out a critical security patch (MS-2026-0312) to all endpoints. Your device has been flagged as pending.

To complete the update without disrupting your work, our technician will need remote access to your machine.

Please call our helpdesk line to schedule the session:
1-800-555-0284

Alternatively, download the remote access tool here:
https://yourdomain-support.com/patch/remote-agent.exe

Ticket will auto-close in 48 hours if no action taken.

IT Helpdesk`,
    clues: [
      'Domain "yourdomain-support.com" is external — your IT helpdesk uses an internal domain',
      'Legitimate patches are deployed silently via MDM/SCCM — IT does not email you to schedule them',
      'Asking you to download a remote access .exe from an external link is a major red flag',
      'The callback number is unverified — could connect to the attacker',
    ],
    highlights: [
      'https://yourdomain-support.com/patch/remote-agent.exe',
      'download the remote access tool',
      '1-800-555-0284',
    ],
    explanation:
      "Tech support social engineering. Real IT teams deploy patches via management tools — they do not email employees and ask them to download remote access software. Calling the provided number connects you to the attacker, not your IT team.",
  },

  // ===== LEGIT - EASY (additional) =====
  {
    id: 'l-easy-003',
    type: 'email',
    difficulty: 'easy',
    isPhishing: false,
    from: 'no-reply@accounts.google.com',
    subject: 'Security alert: New sign-in to your Google Account',
    body: `New sign-in
alex@example.com

Your Google Account was just signed in to from a new Windows device.

If this was you, you don't need to do anything.

If this wasn't you, your account may be compromised. Check your Google Account.

You received this email to let you know about important changes to your Google Account and services.`,
    clues: [],
    explanation:
      'Legitimate Google security alert. Comes from no-reply@accounts.google.com, addresses your specific account, contains no clickable links asking for credentials, and no urgency tactics. Google sends these as informational notices.',
  },
  {
    id: 'l-easy-004',
    type: 'email',
    difficulty: 'easy',
    isPhishing: false,
    from: 'no-reply@spotify.com',
    subject: 'Your Spotify receipt',
    body: `Your receipt

Alex C.
alex@example.com

Spotify Premium Individual
Feb 28, 2026

Amount charged: $11.99
Payment: Visa ···· 3847

Next billing date: Mar 28, 2026

Questions? Visit spotify.com/account

Thanks for being a Premium member.`,
    clues: [],
    explanation:
      'Legitimate Spotify billing receipt. Comes from no-reply@spotify.com, uses your name, shows your masked payment card, a specific billing amount, and links only to spotify.com. No credential requests.',
  },

  // ===== LEGIT - MEDIUM (additional) =====
  {
    id: 'l-med-005',
    type: 'email',
    difficulty: 'medium',
    isPhishing: false,
    from: 'notifications@slack.com',
    subject: 'Alex, you have unread messages in SFISSA Slack',
    body: `Hi Alex,

You have unread messages waiting in SFISSA:

#general — 4 new messages
#events — 2 new messages
@Mike Rivera mentioned you in #general

View messages in Slack →

You're receiving this because you have email notifications enabled.
Manage notification preferences`,
    clues: [],
    explanation:
      "Legitimate Slack notification. Comes from notifications@slack.com, addresses you by name, references your specific workspace and real channel names, and links to the Slack app. No credential requests or urgency.",
  },
  {
    id: 'l-med-006',
    type: 'sms',
    difficulty: 'medium',
    isPhishing: false,
    from: 'Twilio Verify',
    body: `Your Coinbase verification code is: 847291

This code expires in 10 minutes. Do not share this code with anyone, including Coinbase support.`,
    clues: [],
    explanation:
      "Legitimate 2FA SMS from Coinbase via Twilio. The alphanumeric sender ID is identifiable, the message explicitly says do not share the code (including with support), and there are no links. You only receive this when you initiate a login.",
  },

  // ===== LEGIT - HARD (additional) =====
  {
    id: 'l-hard-005',
    type: 'email',
    difficulty: 'hard',
    isPhishing: false,
    from: 'aws-billing-information@amazon.com',
    subject: 'Your AWS bill is ready',
    body: `Amazon Web Services

Hello Alex Chen,

Your AWS bill for February 2026 is now available.

Account ID: 847291038475
Total amount due: $143.72
Payment method: Visa ···· 4921
Payment date: March 1, 2026

Services:
EC2 (us-east-1):    $87.14
S3:                 $12.40
Route 53:           $9.00
CloudFront:         $35.18

View your invoice in the AWS Billing Console:
https://console.aws.amazon.com/billing

AWS — Amazon Web Services`,
    clues: [],
    explanation:
      'Legitimate AWS billing email. Comes from aws-billing-information@amazon.com, includes your full name and account ID, itemizes specific service charges, and links only to console.aws.amazon.com. AWS billing emails never ask for payment via a separate link.',
  },
  {
    id: 'l-hard-006',
    type: 'email',
    difficulty: 'hard',
    isPhishing: false,
    from: 'noreply@notify.cloudflare.com',
    subject: "Action required: Your domain alexchen.io's SSL certificate",
    body: `Cloudflare

Hi Alex,

This is a reminder that the SSL/TLS certificate for alexchen.io is managed by Cloudflare and is set to auto-renew.

No action is required on your part. This notification is for your records.

Certificate details:
Domain: alexchen.io
Issuer: Cloudflare, Inc.
Expiry: May 14, 2026
Auto-renew: Enabled

Manage your SSL settings in the Cloudflare dashboard:
https://dash.cloudflare.com

Cloudflare, Inc.`,
    clues: [],
    explanation:
      'Legitimate Cloudflare notification. Comes from noreply@notify.cloudflare.com (Cloudflare\'s sending domain), references your specific domain, explicitly states "no action required," and links only to dash.cloudflare.com. No credential requests.',
  },
];

export function getShuffledDeck(size: number): Card[] {
  const deck = [...CARDS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, size);
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateToSeed(dateStr: string): number {
  return dateStr.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 0);
}

export function getDailyDeck(): Card[] {
  const d = new Date();
  const today = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const rand = mulberry32(dateToSeed(today));
  const shuffled = [...CARDS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 10);
}
