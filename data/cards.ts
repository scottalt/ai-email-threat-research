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

Your Zoom account (scott@example.com) has been temporarily suspended due to a violation of our Terms of Service.

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
    explanation:
      "Business Email Compromise (BEC). The attacker impersonates an executive, creates urgency, and blocks verbal verification. Always verify wire transfers via a known phone number — never by replying to the email.",
  },
  {
    id: 'p-hard-002',
    type: 'email',
    difficulty: 'hard',
    isPhishing: true,
    from: 'events@linkedin-notifications.net',
    subject: 'Scott, your talk at SFISSA is getting attention',
    body: `Hi Scott,

Your recent presentation at the South Florida ISSA chapter generated significant interest. Several members have asked us to share your slides.

We've created a shared link on our platform for easy access:

View & Download Your Slides →
linkedin-notifications.net/slides/sfissa-scott-a

You can also see who viewed your content from this link. The link expires in 48 hours.

LinkedIn Events Team`,
    clues: [
      'Domain is "linkedin-notifications.net" — LinkedIn emails come from linkedin.com',
      'Uses specific personal details scraped from your public LinkedIn profile',
      '"See who viewed your content" is curiosity bait',
      'Fake 48-hour urgency',
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
    body: `Hello Scott,

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
    body: `Hey scottalt,

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
Apple ID: scott@example.com
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
    subject: 'Scott Altiparmak, please DocuSign this document',
    body: `Please DocuSign this document

Hello Scott Altiparmak,

Innovative Security Partners has sent you a document to review and sign.

Document: 2026 Consulting Agreement — ISP / S. Altiparmak
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
    subject: 'Scott, 3 new jobs match your profile',
    body: `Hi Scott,

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

We detected something unusual about a recent sign-in to the Microsoft account scott@example.com.

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
    body: `Hi Scott,

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
];

export function getShuffledDeck(size: number): Card[] {
  return [...CARDS].sort(() => Math.random() - 0.5).slice(0, size);
}
