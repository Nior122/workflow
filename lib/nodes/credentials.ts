/**
 * Simulated Credentials system.
 *
 * Every integration node can declare a `credential` field with a `credentialProvider`.
 * No real tokens or OAuth secrets ever exist — accounts are human-readable stand-ins
 * stored in localStorage / uiStore so users can pick an existing account or run a
 * simulated "Connect account" OAuth flow in the inspector.
 */

export type SimulatedCredential = {
  id: string;
  provider: string;
  label: string;
  accountHint: string;
  connectedAt: string;
};

export const DEFAULT_CREDENTIALS: readonly SimulatedCredential[] = [
  { id: "cred-gmail", provider: "gmail", label: "Gmail — nior@example.com", accountHint: "nior@example.com", connectedAt: "2026-10-01" },
  { id: "cred-outlook", provider: "outlook", label: "Outlook — ops@flowforge.dev", accountHint: "ops@flowforge.dev", connectedAt: "2026-10-01" },
  { id: "cred-whatsapp", provider: "whatsapp", label: "WhatsApp Cloud — +234 803 555 0192", accountHint: "+234 803 555 0192", connectedAt: "2026-10-01" },
  { id: "cred-telegram", provider: "telegram", label: "Telegram Bot — @FlowForgeOpsBot", accountHint: "@FlowForgeOpsBot", connectedAt: "2026-10-01" },
  { id: "cred-slack", provider: "slack", label: "Slack — FlowForge HQ", accountHint: "flowforge-hq.slack.com", connectedAt: "2026-10-01" },
  { id: "cred-discord", provider: "discord", label: "Discord — Community Guild", accountHint: "FlowForge Community", connectedAt: "2026-10-01" },
  { id: "cred-twilio", provider: "twilio", label: "Twilio SMS — +1 (415) 555-0138", accountHint: "AC89f2...sim", connectedAt: "2026-10-01" },
  { id: "cred-facebook", provider: "facebook", label: "Facebook Page — FlowForge Official", accountHint: "page_884120", connectedAt: "2026-10-01" },
  { id: "cred-instagram", provider: "instagram", label: "Instagram Business — @flowforge.hq", accountHint: "@flowforge.hq", connectedAt: "2026-10-01" },
  { id: "cred-x", provider: "x", label: "X (Twitter) — @flowforge_dev", accountHint: "@flowforge_dev", connectedAt: "2026-10-01" },
  { id: "cred-youtube", provider: "youtube", label: "YouTube Channel — FlowForge Studio", accountHint: "UC_flowforge", connectedAt: "2026-10-01" },
  { id: "cred-linkedin", provider: "linkedin", label: "LinkedIn — FlowForge Company Page", accountHint: "urn:li:organization:40912", connectedAt: "2026-10-01" },
  { id: "cred-teams", provider: "teams", label: "Microsoft Teams — Engineering Tenant", accountHint: "eng@flowforge.onmicrosoft.com", connectedAt: "2026-10-01" },
  { id: "cred-mailchimp", provider: "mailchimp", label: "Mailchimp — Newsletter Audience (us14)", accountHint: "audience_91a2", connectedAt: "2026-10-01" },
  { id: "cred-stripe", provider: "stripe", label: "Stripe — Acme USD Live (Simulated)", accountHint: "acct_1SimStripe99", connectedAt: "2026-10-01" },
  { id: "cred-paystack", provider: "paystack", label: "Paystack — Lagos Merchant NGN", accountHint: "pk_sim_paystack_ngn", connectedAt: "2026-10-01" },
  { id: "cred-flutterwave", provider: "flutterwave", label: "Flutterwave — Pan-Africa Gateway", accountHint: "FLWPUBK_SIM_882", connectedAt: "2026-10-01" },
  { id: "cred-shopify", provider: "shopify", label: "Shopify — flowforge-merch.myshopify.com", accountHint: "flowforge-merch", connectedAt: "2026-10-01" },
  { id: "cred-woocommerce", provider: "woocommerce", label: "WooCommerce — store.flowforge.dev", accountHint: "ck_sim_woo_441", connectedAt: "2026-10-01" },
  { id: "cred-postgres", provider: "postgres", label: "Postgres — prod-replica.db.internal:5432", accountHint: "app_writer@prod_db", connectedAt: "2026-10-01" },
  { id: "cred-mysql", provider: "mysql", label: "MySQL — billing-cluster.internal:3306", accountHint: "billing_rw", connectedAt: "2026-10-01" },
  { id: "cred-mongodb", provider: "mongodb", label: "MongoDB Atlas — cluster0.flowforge.mongodb.net", accountHint: "atlas-rw", connectedAt: "2026-10-01" },
  { id: "cred-supabase", provider: "supabase", label: "Supabase — xkqzv-flowforge.supabase.co", accountHint: "service_role_sim", connectedAt: "2026-10-01" },
  { id: "cred-firebase", provider: "firebase", label: "Firebase — flowforge-prod-99a", accountHint: "firebase-adminsdk-sim", connectedAt: "2026-10-01" },
  { id: "cred-redis", provider: "redis", label: "Upstash Redis — eu-west-1.upstash.io:6379", accountHint: "default@upstash", connectedAt: "2026-10-01" },
  { id: "cred-airtable", provider: "airtable", label: "Airtable — Product Operations Workspace", accountHint: "pat_sim_airtable", connectedAt: "2026-10-01" },
  { id: "cred-google", provider: "google", label: "Google Workspace — nior@example.com", accountHint: "nior@example.com", connectedAt: "2026-10-01" },
  { id: "cred-notion", provider: "notion", label: "Notion — FlowForge Wiki Integration", accountHint: "ntn_sim_workspace", connectedAt: "2026-10-01" },
  { id: "cred-dropbox", provider: "dropbox", label: "Dropbox — Team Shared Vault", accountHint: "team@flowforge.dev", connectedAt: "2026-10-01" },
  { id: "cred-aws", provider: "aws", label: "AWS IAM — s3-automation-role (eu-west-1)", accountHint: "AKIASIM000FLOWFORGE", connectedAt: "2026-10-01" },
  { id: "cred-pinecone", provider: "pinecone", label: "Pinecone — docs-embeddings-1536 (us-east-1)", accountHint: "pcsk_sim_index", connectedAt: "2026-10-01" },
  { id: "cred-hubspot", provider: "hubspot", label: "HubSpot CRM — Portal #294810", accountHint: "pat-na1-sim", connectedAt: "2026-10-01" },
  { id: "cred-salesforce", provider: "salesforce", label: "Salesforce — na139.salesforce.com", accountHint: "ops@flowforge.sf", connectedAt: "2026-10-01" },
  { id: "cred-trello", provider: "trello", label: "Trello — Engineering Board", accountHint: "@nior_trello", connectedAt: "2026-10-01" },
  { id: "cred-asana", provider: "asana", label: "Asana — Product Roadmap Workspace", accountHint: "nior@example.com", connectedAt: "2026-10-01" },
  { id: "cred-jira", provider: "jira", label: "Jira Cloud — flowforge.atlassian.net", accountHint: "eng@flowforge.dev", connectedAt: "2026-10-01" },
  { id: "cred-clickup", provider: "clickup", label: "ClickUp — Sprint Team Space", accountHint: "pk_sim_clickup", connectedAt: "2026-10-01" },
  { id: "cred-calendly", provider: "calendly", label: "Calendly — calendly.com/nior-demo", accountHint: "nior@example.com", connectedAt: "2026-10-01" },
  { id: "cred-zoom", provider: "zoom", label: "Zoom Pro — meetings@flowforge.dev", accountHint: "meetings@flowforge.dev", connectedAt: "2026-10-01" },
  { id: "cred-typeform", provider: "typeform", label: "Typeform — Customer Discovery Forms", accountHint: "tfp_sim_token", connectedAt: "2026-10-01" },
  { id: "cred-github", provider: "github", label: "GitHub App — @Nior122/workflow", accountHint: "Nior122", connectedAt: "2026-10-01" },
  { id: "cred-openai", provider: "openai", label: "OpenAI — org-flowforge (sk-sim...9f2a)", accountHint: "org-flowforge", connectedAt: "2026-10-01" },
  { id: "cred-anthropic", provider: "anthropic", label: "Anthropic — Console Workspace (sk-ant-sim...)", accountHint: "anthropic-prod", connectedAt: "2026-10-01" },
  { id: "cred-gemini", provider: "gemini", label: "Google AI Studio — Gemini API (AIzaSim...)", accountHint: "gemini-studio", connectedAt: "2026-10-01" },
  { id: "cred-openrouter", provider: "openrouter", label: "OpenRouter — Unified Router Key", accountHint: "sk-or-v1-sim", connectedAt: "2026-10-01" },
  { id: "cred-groq", provider: "groq", label: "GroqCloud — LPU Inference Key", accountHint: "gsk_sim_groq", connectedAt: "2026-10-01" },
  { id: "cred-ollama", provider: "ollama", label: "Ollama Local — http://127.0.0.1:11434", accountHint: "local-daemon", connectedAt: "2026-10-01" },
];

export function credentialsForProvider(
  provider: string,
  all: readonly SimulatedCredential[] = DEFAULT_CREDENTIALS,
): SimulatedCredential[] {
  const normalized = provider.trim().toLowerCase();
  const matched = all.filter((entry) => entry.provider.toLowerCase() === normalized);
  if (matched.length > 0) return matched;
  return [
    {
      id: `cred-${normalized}-default`,
      provider: normalized,
      label: `${provider} — demo@flowforge.dev`,
      accountHint: "demo@flowforge.dev",
      connectedAt: "2026-10-01",
    },
  ];
}

/**
 * Credentials added through the simulated "Connect account" flow.
 *
 * Session-scoped on purpose: nothing here is a real secret, and keeping the store in
 * a module-level array (rather than localStorage) means a reload always returns to a
 * clean, predictable set of demo accounts.
 */
const sessionCredentials: SimulatedCredential[] = [];

let credentialCounter = 0;

export function listCredentialsByProvider(provider: string): SimulatedCredential[] {
  return credentialsForProvider(provider, [
    ...DEFAULT_CREDENTIALS,
    ...sessionCredentials,
  ]);
}

export function addSimulatedCredential(input: {
  provider: string;
  label: string;
  accountHint: string;
  connectedAt?: string;
}): SimulatedCredential {
  credentialCounter += 1;
  const credential: SimulatedCredential = {
    id: `cred-${input.provider.toLowerCase()}-session-${credentialCounter}`,
    provider: input.provider.trim().toLowerCase(),
    label: input.label,
    accountHint: input.accountHint,
    connectedAt: input.connectedAt ?? new Date().toISOString().slice(0, 10),
  };
  sessionCredentials.push(credential);
  return credential;
}

export function listAllCredentials(): SimulatedCredential[] {
  return [...DEFAULT_CREDENTIALS, ...sessionCredentials];
}

/** Test hook: clears credentials added through the simulated connect flow. */
export function resetSessionCredentials(): void {
  sessionCredentials.length = 0;
  credentialCounter = 0;
}

export function defaultCredentialIdFor(provider: string): string {
  return credentialsForProvider(provider)[0].id;
}
