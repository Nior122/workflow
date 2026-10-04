# FlowForge — 90+ Node Library & AI Agent Expansion Plan (`NODES_PLAN.md`)

> **Living inventory.** Tracks every node across Batches A–F plus the existing 14 v1 nodes.
> Status values: `planned` · `built` · `tested`.
>
> **Current total:** **144 nodes** across 6 batches (33 Triggers · 18 Messaging/Outputs · 13 Data & Storage · 16 Business & Productivity · 27 Logic/Utility · 37 AI & Agent Sub-Nodes).
>
> The 14 original v1 engine nodes are the *same* definitions, migrated onto the declarative
> registry surface: `trigger.manual`, `trigger.webhook`, `trigger.schedule`, `action.aiPrompt`,
> `action.aiAgent`, `action.httpRequest`, `action.transform`, `action.condition`, `action.delay`,
> `action.textFormatter`, `output.email`, `output.slack`, `output.sheets`, `output.log`.
> Saved workflows keep working: `type` ids are unchanged, so a graph from before the expansion
> still loads, validates and runs.

---

## Summary by Batch

| Batch | Focus | Count | Planned | Built | Tested |
| --- | --- | ---: | ---: | ---: | ---: |
| **A** | Triggers | 33 | 0 | 33 | **33** |
| **B** | Messaging, Social & Outputs | 18 | 0 | 18 | **18** |
| **C** | Data & Storage | 13 | 0 | 13 | **13** |
| **D** | Business & Productivity | 16 | 0 | 16 | **16** |
| **E** | Logic, Flow Control & Utility | 27 | 0 | 27 | **27** |
| **F** | AI Chains, Agents, Models, Memory & Tools | 37 | 0 | 37 | **37** |
| **Total** | **All Batches** | **144** | **0** | **144** | **144** |

> **Status: complete.** Every node in this file is `tested`: `lib/nodes/__tests__/registry-144.test.ts`
> executes all 144 definitions through the real engine and asserts the batch counts above, the
> registry validator returns zero errors, and `listAllNodeDefs().length === 144`.

---

## Batch A — Triggers (33 nodes)

| # | Node ID | Label | Category | Subcategory | Node Kind | Status |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `trigger.manual` | Manual Trigger | `trigger` | Core | `trigger` | `tested` |
| 2 | `trigger.webhook` | Webhook | `trigger` | Core | `trigger` | `tested` |
| 3 | `trigger.schedule` | Schedule (Cron) | `trigger` | Core | `trigger` | `tested` |
| 4 | `trigger.chatMessage` | Chat Message | `trigger` | Core | `trigger` | `tested` |
| 5 | `trigger.formSubmission` | Form Submission | `trigger` | Core | `trigger` | `tested` |
| 6 | `trigger.whatsappMessage` | WhatsApp Message Received | `trigger` | Messaging | `trigger` | `tested` |
| 7 | `trigger.telegramMessage` | Telegram Message Received | `trigger` | Messaging | `trigger` | `tested` |
| 8 | `trigger.gmailNewEmail` | Gmail New Email | `trigger` | Email | `trigger` | `tested` |
| 9 | `trigger.outlookNewEmail` | Outlook New Email | `trigger` | Email | `trigger` | `tested` |
| 10 | `trigger.facebookPageComment` | Facebook Page Comment | `trigger` | Social | `trigger` | `tested` |
| 11 | `trigger.facebookLeadForm` | Facebook Lead Form | `trigger` | Social | `trigger` | `tested` |
| 12 | `trigger.instagramNewComment` | Instagram New Comment | `trigger` | Social | `trigger` | `tested` |
| 13 | `trigger.instagramNewDm` | Instagram New DM | `trigger` | Social | `trigger` | `tested` |
| 14 | `trigger.slackNewMessage` | Slack New Message | `trigger` | Messaging | `trigger` | `tested` |
| 15 | `trigger.discordNewMessage` | Discord New Message | `trigger` | Messaging | `trigger` | `tested` |
| 16 | `trigger.xNewMention` | X (Twitter) New Mention | `trigger` | Social | `trigger` | `tested` |
| 17 | `trigger.youtubeNewComment` | YouTube New Comment | `trigger` | Social | `trigger` | `tested` |
| 18 | `trigger.linkedinNewMessage` | LinkedIn New Message | `trigger` | Social | `trigger` | `tested` |
| 19 | `trigger.stripePayment` | Stripe Payment Received | `trigger` | Payments | `trigger` | `tested` |
| 20 | `trigger.paystackPayment` | Paystack Payment Received | `trigger` | Payments | `trigger` | `tested` |
| 21 | `trigger.flutterwavePayment` | Flutterwave Payment Received | `trigger` | Payments | `trigger` | `tested` |
| 22 | `trigger.shopifyNewOrder` | Shopify New Order | `trigger` | Commerce | `trigger` | `tested` |
| 23 | `trigger.woocommerceNewOrder` | WooCommerce New Order | `trigger` | Commerce | `trigger` | `tested` |
| 24 | `trigger.googleSheetsNewRow` | Google Sheets New Row | `trigger` | Data | `trigger` | `tested` |
| 25 | `trigger.airtableNewRecord` | Airtable New Record | `trigger` | Data | `trigger` | `tested` |
| 26 | `trigger.notionPageUpdated` | Notion Page Updated | `trigger` | Productivity | `trigger` | `tested` |
| 27 | `trigger.googleDriveNewFile` | Google Drive New File | `trigger` | Storage | `trigger` | `tested` |
| 28 | `trigger.googleCalendarEventStarting` | Google Calendar Event Starting | `trigger` | Productivity | `trigger` | `tested` |
| 29 | `trigger.calendlyNewBooking` | Calendly New Booking | `trigger` | Productivity | `trigger` | `tested` |
| 30 | `trigger.githubEvent` | GitHub Push or Issue Opened | `trigger` | Developer | `trigger` | `tested` |
| 31 | `trigger.rssFeedItem` | RSS Feed Item | `trigger` | Content | `trigger` | `tested` |
| 32 | `trigger.postgresRowInserted` | Postgres Row Inserted | `trigger` | Data | `trigger` | `tested` |
| 33 | `trigger.errorTrigger` | Error Trigger | `trigger` | Core | `trigger` | `tested` |

---

## Batch B — Messaging, Social & Outputs (18 nodes)

| # | Node ID | Label | Category | Subcategory | Node Kind | Status |
| ---: | --- | --- | --- | --- | --- | --- |
| 34 | `action.whatsappSend` | WhatsApp Send Message | `messaging` | Messaging | `action` | `tested` |
| 35 | `action.telegramSend` | Telegram Send Message / Media | `messaging` | Messaging | `action` | `tested` |
| 36 | `action.gmail` | Gmail (Send / Reply / Label / Draft) | `messaging` | Email | `action` | `tested` |
| 37 | `action.outlookSendEmail` | Outlook Send Email | `messaging` | Email | `action` | `tested` |
| 38 | `action.slackSendMessage` | Slack Send Message | `messaging` | Messaging | `action` | `tested` |
| 39 | `action.discordSendMessage` | Discord Send Message | `messaging` | Messaging | `action` | `tested` |
| 40 | `action.twilioSms` | SMS (Twilio) | `messaging` | Messaging | `action` | `tested` |
| 41 | `action.facebookPagePost` | Facebook Page Post | `messaging` | Social | `action` | `tested` |
| 42 | `action.instagramPublishPost` | Instagram Publish Post | `messaging` | Social | `action` | `tested` |
| 43 | `action.xPostTweet` | X Post Tweet | `messaging` | Social | `action` | `tested` |
| 44 | `action.linkedinCreatePost` | LinkedIn Create Post | `messaging` | Social | `action` | `tested` |
| 45 | `action.youtubeReplyComment` | YouTube Reply to Comment | `messaging` | Social | `action` | `tested` |
| 46 | `action.microsoftTeamsMessage` | Microsoft Teams Message | `messaging` | Messaging | `action` | `tested` |
| 47 | `action.mailchimpAddSubscriber` | Mailchimp Add Subscriber | `messaging` | Marketing | `action` | `tested` |
| 48 | `output.email` | Send Email (Legacy Output) | `output` | Email | `output` | `tested` |
| 49 | `output.slack` | Post to Slack (Legacy Output) | `output` | Messaging | `output` | `tested` |
| 50 | `output.sheets` | Append Sheet Row (Legacy Output) | `output` | Data | `output` | `tested` |
| 51 | `output.log` | Log Output | `output` | Core | `output` | `tested` |

---

## Batch C — Data & Storage (13 nodes)

| # | Node ID | Label | Category | Subcategory | Node Kind | Status |
| ---: | --- | --- | --- | --- | --- | --- |
| 52 | `data.postgres` | Postgres (Select / Insert / Update / Delete) | `data` | Databases | `action` | `tested` |
| 53 | `data.mysql` | MySQL | `data` | Databases | `action` | `tested` |
| 54 | `data.mongodb` | MongoDB | `data` | Databases | `action` | `tested` |
| 55 | `data.supabase` | Supabase | `data` | Databases | `action` | `tested` |
| 56 | `data.firebase` | Firebase Firestore | `data` | Databases | `action` | `tested` |
| 57 | `data.redis` | Redis | `data` | Cache & KV | `action` | `tested` |
| 58 | `data.airtable` | Airtable (Create / Update / Search) | `data` | Spreadsheets | `action` | `tested` |
| 59 | `data.googleSheets` | Google Sheets (Append / Update / Lookup) | `data` | Spreadsheets | `action` | `tested` |
| 60 | `data.notion` | Notion (Create Page / Query DB) | `data` | Workspace | `action` | `tested` |
| 61 | `data.googleDrive` | Google Drive (Upload / Download) | `data` | Cloud Storage | `action` | `tested` |
| 62 | `data.dropbox` | Dropbox | `data` | Cloud Storage | `action` | `tested` |
| 63 | `data.awsS3` | AWS S3 | `data` | Cloud Storage | `action` | `tested` |
| 64 | `data.pinecone` | Pinecone Vector Store (Upsert / Query) | `data` | Vector DB | `action` | `tested` |

---

## Batch D — Business & Productivity (16 nodes)

| # | Node ID | Label | Category | Subcategory | Node Kind | Status |
| ---: | --- | --- | --- | --- | --- | --- |
| 65 | `action.stripe` | Stripe (Create Customer / Invoice) | `business` | Payments | `action` | `tested` |
| 66 | `action.paystack` | Paystack (Initialize / Verify) | `business` | Payments | `action` | `tested` |
| 67 | `action.flutterwave` | Flutterwave | `business` | Payments | `action` | `tested` |
| 68 | `action.shopify` | Shopify (Update Order / Create Product) | `business` | Commerce | `action` | `tested` |
| 69 | `action.woocommerce` | WooCommerce | `business` | Commerce | `action` | `tested` |
| 70 | `action.hubspot` | HubSpot (Create Contact / Deal) | `business` | CRM | `action` | `tested` |
| 71 | `action.salesforce` | Salesforce | `business` | CRM | `action` | `tested` |
| 72 | `action.trello` | Trello (Create Card) | `business` | Project Mgmt | `action` | `tested` |
| 73 | `action.asana` | Asana | `business` | Project Mgmt | `action` | `tested` |
| 74 | `action.jira` | Jira | `business` | Project Mgmt | `action` | `tested` |
| 75 | `action.clickup` | ClickUp | `business` | Project Mgmt | `action` | `tested` |
| 76 | `action.googleCalendar` | Google Calendar (Create Event) | `business` | Scheduling | `action` | `tested` |
| 77 | `action.calendly` | Calendly | `business` | Scheduling | `action` | `tested` |
| 78 | `action.zoom` | Zoom (Create Meeting) | `business` | Video | `action` | `tested` |
| 79 | `action.googleDocs` | Google Docs | `business` | Documents | `action` | `tested` |
| 80 | `action.typeform` | Typeform | `business` | Forms | `action` | `tested` |

---

## Batch E — Logic, Flow Control & Utility (25 nodes)

| # | Node ID | Label | Category | Subcategory | Node Kind | Status |
| ---: | --- | --- | --- | --- | --- | --- |
| 81 | `action.condition` | IF / Filter Condition | `logic` | Branching | `logic` | `tested` |
| 82 | `logic.switch` | Switch (Multi-Output) | `logic` | Branching | `logic` | `tested` |
| 83 | `logic.merge` | Merge (Wait All / Append / Combine) | `logic` | Flow Control | `logic` | `tested` |
| 84 | `logic.loopOverItems` | Loop Over Items | `logic` | Flow Control | `logic` | `tested` |
| 85 | `logic.splitOut` | Split Out | `logic` | Items | `logic` | `tested` |
| 86 | `logic.aggregate` | Aggregate | `logic` | Items | `logic` | `tested` |
| 87 | `logic.filter` | Filter Items | `logic` | Items | `logic` | `tested` |
| 88 | `logic.sort` | Sort Items | `logic` | Items | `logic` | `tested` |
| 89 | `logic.limit` | Limit Items | `logic` | Items | `logic` | `tested` |
| 90 | `logic.removeDuplicates` | Remove Duplicates | `logic` | Items | `logic` | `tested` |
| 91 | `action.delay` | Wait / Delay | `logic` | Flow Control | `logic` | `tested` |
| 92 | `logic.waitForApproval` | Wait for Human Approval | `logic` | Human-in-Loop | `logic` | `tested` |
| 93 | `action.transform` | Set / Edit Fields (Transform) | `logic` | Data Shaping | `logic` | `tested` |
| 94 | `logic.code` | Code (JavaScript) | `logic` | Custom Code | `logic` | `tested` |
| 95 | `action.httpRequest` | HTTP Request | `logic` | Network | `action` | `tested` |
| 96 | `action.textFormatter` | Text Formatter | `logic` | Transform | `action` | `tested` |
| 97 | `logic.dateTime` | Date & Time | `logic` | Utility | `logic` | `tested` |
| 98 | `logic.jsonCodec` | JSON Parse / Stringify | `logic` | Utility | `logic` | `tested` |
| 99 | `logic.htmlExtract` | HTML Extract | `logic` | Utility | `logic` | `tested` |
| 100 | `logic.markdownToHtml` | Markdown to HTML | `logic` | Utility | `logic` | `tested` |
| 101 | `logic.cryptoHash` | Crypto / Hash | `logic` | Utility | `logic` | `tested` |
| 102 | `logic.compareDatasets` | Compare Datasets | `logic` | Items | `logic` | `tested` |
| 103 | `output.respondToWebhook` | Respond to Webhook | `logic` | Network | `output` | `tested` |
| 104 | `logic.executeSubWorkflow` | Execute Sub-Workflow | `logic` | Flow Control | `logic` | `tested` |
| 105 | `logic.stopAndError` | Stop and Error | `logic` | Flow Control | `logic` | `tested` |
| 106 | `logic.noOp` | No-Op | `logic` | Utility | `logic` | `tested` |
| 107 | `logic.stickyNote` | Sticky Note (Annotation) | `logic` | Annotation | `logic` | `tested` |

---

## Batch F — AI Chains, Agents, Chat Models, Memory & Tools (35+ nodes)

| # | Node ID | Label | Category | Subcategory | Node Kind | Status |
| ---: | --- | --- | --- | --- | --- | --- |
| 108 | `action.aiAgent` | AI Agent | `ai` | Agents | `ai-agent` | `tested` |
| 109 | `action.aiPrompt` | Basic LLM Chain (AI Prompt) | `ai` | Chains | `action` | `tested` |
| 110 | `ai.textClassifier` | Text Classifier | `ai` | Chains | `action` | `tested` |
| 111 | `ai.sentimentAnalysis` | Sentiment Analysis | `ai` | Chains | `action` | `tested` |
| 112 | `ai.informationExtractor` | Information Extractor | `ai` | Chains | `action` | `tested` |
| 113 | `ai.summarizer` | Summarizer | `ai` | Chains | `action` | `tested` |
| 114 | `ai.qaChain` | Question and Answer | `ai` | Chains | `action` | `tested` |
| 115 | `ai.embeddings` | Embeddings | `ai` | RAG & Vectors | `action` | `tested` |
| 116 | `ai.documentLoader` | Document Loader | `ai` | RAG & Vectors | `action` | `tested` |
| 117 | `ai.textSplitter` | Text Splitter | `ai` | RAG & Vectors | `action` | `tested` |
| 118 | `ai.vectorStoreRetriever` | Vector Store Retriever | `ai` | RAG & Vectors | `action` | `tested` |
| 119 | `ai.imageGeneration` | Image Generation | `ai` | Multimodal | `action` | `tested` |
| 120 | `ai.speechToText` | Speech to Text | `ai` | Multimodal | `action` | `tested` |
| 121 | `ai.textToSpeech` | Text to Speech | `ai` | Multimodal | `action` | `tested` |
| 122 | `ai.outputParser` | Output Parser (Structured JSON) | `ai` | Parsers | `action` | `tested` |
| 123 | `aiModel.openai` | OpenAI Chat Model | `ai` | Chat Models | `ai-model` | `tested` |
| 124 | `aiModel.anthropic` | Anthropic Claude Model | `ai` | Chat Models | `ai-model` | `tested` |
| 125 | `aiModel.gemini` | Google Gemini Model | `ai` | Chat Models | `ai-model` | `tested` |
| 126 | `aiModel.openrouter` | OpenRouter Chat Model | `ai` | Chat Models | `ai-model` | `tested` |
| 127 | `aiModel.groq` | Groq LPU Model | `ai` | Chat Models | `ai-model` | `tested` |
| 128 | `aiModel.ollama` | Ollama (Local) Model | `ai` | Chat Models | `ai-model` | `tested` |
| 129 | `aiMemory.windowBuffer` | Window Buffer Memory | `ai` | Memory | `ai-memory` | `tested` |
| 130 | `aiMemory.postgres` | Postgres Chat Memory | `ai` | Memory | `ai-memory` | `tested` |
| 131 | `aiMemory.redis` | Redis Chat Memory | `ai` | Memory | `ai-memory` | `tested` |
| 132 | `aiTool.calculator` | Calculator Tool | `ai` | Agent Tools | `ai-tool` | `tested` |
| 133 | `aiTool.webSearch` | Web Search Tool | `ai` | Agent Tools | `ai-tool` | `tested` |
| 134 | `aiTool.wikipedia` | Wikipedia Tool | `ai` | Agent Tools | `ai-tool` | `tested` |
| 135 | `aiTool.httpRequest` | HTTP Request Tool | `ai` | Agent Tools | `ai-tool` | `tested` |
| 136 | `aiTool.code` | Code Execution Tool | `ai` | Agent Tools | `ai-tool` | `tested` |
| 137 | `aiTool.gmail` | Gmail Tool | `ai` | Agent Tools | `ai-tool` | `tested` |
| 138 | `aiTool.googleSheets` | Google Sheets Tool | `ai` | Agent Tools | `ai-tool` | `tested` |
| 139 | `aiTool.postgres` | Postgres SQL Tool | `ai` | Agent Tools | `ai-tool` | `tested` |
| 140 | `aiTool.whatsapp` | WhatsApp Tool | `ai` | Agent Tools | `ai-tool` | `tested` |
| 141 | `aiTool.telegram` | Telegram Tool | `ai` | Agent Tools | `ai-tool` | `tested` |
| 142 | `aiTool.calendar` | Google Calendar Tool | `ai` | Agent Tools | `ai-tool` | `tested` |
| 143 | `aiTool.callWorkflow` | Call Another Workflow Tool | `ai` | Agent Tools | `ai-tool` | `tested` |
| 144 | `aiTool.callAgent` | Call Another Agent Tool | `ai` | Agent Tools | `ai-tool` | `tested` |
