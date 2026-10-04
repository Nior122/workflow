/**
 * Batch C — Data and Storage Node Definitions (13 nodes).
 */

import type { JsonValue } from "@/types/json";
import type { RegistryNodeDef } from "@/types/registry";
import { createSeededFaker } from "../faker-seed";
import { defaultCredentialIdFor } from "../credentials";
import { MAIN_IN, MAIN_OUT, defineRegistryNode } from "../helpers";

export const DATA_NODES: readonly RegistryNodeDef[] = [
  // 52. Postgres
  defineRegistryNode({
    id: "data.postgres",
    label: "Postgres",
    description: "Executes SELECT, INSERT, UPDATE, or DELETE queries against a simulated Postgres database.",
    category: "data",
    subcategory: "Databases",
    keywords: ["postgres", "postgresql", "sql", "database", "query", "select", "insert", "update", "delete"],
    icon: "brand:postgres",
    accent: "#38BDF8",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 540,
    configSchema: [
      {
        key: "credentialId",
        label: "Postgres connection",
        type: "credential",
        credentialProvider: "postgres",
      },
      {
        key: "operation",
        label: "Operation",
        type: "select",
        options: [
          { value: "select", label: "SELECT rows" },
          { value: "insert", label: "INSERT row" },
          { value: "update", label: "UPDATE rows" },
          { value: "delete", label: "DELETE rows" },
        ],
      },
      {
        key: "table",
        label: "Table",
        type: "text",
        required: true,
        placeholder: "public.leads",
      },
      {
        key: "query",
        label: "SQL Query",
        type: "code",
        language: "sql",
        required: true,
        placeholder: "INSERT INTO public.leads (name, email) VALUES ('{{lead.name}}', '{{lead.email}}') RETURNING *;",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("postgres"),
      operation: "insert",
      table: "public.leads",
      query:
        "INSERT INTO public.leads (name, email, company) VALUES ('{{lead.name}}', '{{lead.email}}', '{{lead.company}}') RETURNING id, created_at;",
    },
    sampleOutput: {
      rowCount: 1,
      operation: "insert",
      table: "public.leads",
      rows: [{ id: 1094, name: "Ngozi Eze", email: "ngozi@lagosventures.com", created_at: "2026-10-04T09:00:00Z" }],
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const operation = String(config.operation || "insert");
      const table = String(config.table || "public.leads");
      const renderedSql = ctx.resolveExpression(String(config.query || "SELECT 1;"));
      const rowId = faker.number.int({ min: 1000, max: 9999 });
      const rows = [
        {
          id: rowId,
          table,
          operation,
          created_at: new Date(ctx.now()).toISOString(),
        },
      ];
      return {
        output: {
          ...input,
          rowCount: rows.length,
          operation,
          table,
          sql: renderedSql,
          rows,
        },
        logs: [`Postgres ${operation.toUpperCase()} on ${table} returned ${rows.length} row(s).`],
        meta: { operation, table, rowCount: rows.length },
      };
    },
  }),

  // 53. MySQL
  defineRegistryNode({
    id: "data.mysql",
    label: "MySQL",
    description: "Executes parameterized queries against a simulated MySQL / MariaDB cluster.",
    category: "data",
    subcategory: "Databases",
    keywords: ["mysql", "mariadb", "sql", "database", "query", "table"],
    icon: "brand:mysql",
    accent: "#00758F",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 520,
    configSchema: [
      {
        key: "credentialId",
        label: "MySQL database",
        type: "credential",
        credentialProvider: "mysql",
      },
      {
        key: "query",
        label: "SQL statement",
        type: "code",
        language: "sql",
        required: true,
        placeholder: "SELECT id, email, status FROM customers WHERE status = 'active' LIMIT 10;",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("mysql"),
      query: "SELECT id, email, status FROM customers WHERE status = 'active' LIMIT 5;",
    },
    sampleOutput: {
      affectedRows: 2,
      rows: [
        { id: 401, email: "ada@example.com", status: "active" },
        { id: 402, email: "grace@example.com", status: "active" },
      ],
    },
    simulate: async (input, config, ctx) => {
      const sql = ctx.resolveExpression(String(config.query || "SELECT 1;"));
      return {
        output: {
          ...input,
          affectedRows: 2,
          sql,
          rows: [
            { id: 401, email: "ada@example.com", status: "active" },
            { id: 402, email: "grace@example.com", status: "active" },
          ],
        },
        logs: [`MySQL executed query (${sql.slice(0, 48)}…).`],
        meta: { affectedRows: 2 },
      };
    },
  }),

  // 54. MongoDB
  defineRegistryNode({
    id: "data.mongodb",
    label: "MongoDB",
    description: "Finds, inserts, or updates documents in a MongoDB Atlas collection.",
    category: "data",
    subcategory: "Databases",
    keywords: ["mongodb", "mongo", "nosql", "document", "atlas", "collection"],
    icon: "brand:mongodb",
    accent: "#10B981",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 500,
    configSchema: [
      {
        key: "credentialId",
        label: "MongoDB cluster",
        type: "credential",
        credentialProvider: "mongodb",
      },
      {
        key: "operation",
        label: "Operation",
        type: "select",
        options: [
          { value: "insertOne", label: "insertOne" },
          { value: "find", label: "find" },
          { value: "updateOne", label: "updateOne" },
        ],
      },
      {
        key: "collection",
        label: "Collection",
        type: "text",
        required: true,
        placeholder: "events",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("mongodb"),
      operation: "insertOne",
      collection: "events",
    },
    sampleOutput: {
      acknowledged: true,
      collection: "events",
      insertedId: "67001a9f2b84c10012a4",
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const collection = String(config.collection || "events");
      const operation = String(config.operation || "insertOne");
      const insertedId = faker.database.mongodbObjectId();
      return {
        output: { ...input, acknowledged: true, collection, operation, insertedId },
        logs: [`MongoDB ${operation} on "${collection}" -> ${insertedId}.`],
        meta: { collection, operation, insertedId },
      };
    },
  }),

  // 55. Supabase
  defineRegistryNode({
    id: "data.supabase",
    label: "Supabase",
    description: "Inserts, upserts, or selects rows via the Supabase PostgREST API.",
    category: "data",
    subcategory: "Databases",
    keywords: ["supabase", "postgres", "postgrest", "database", "upsert", "row"],
    icon: "brand:supabase",
    accent: "#3ECF8E",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 480,
    configSchema: [
      {
        key: "credentialId",
        label: "Supabase project",
        type: "credential",
        credentialProvider: "supabase",
      },
      {
        key: "table",
        label: "Table name",
        type: "text",
        required: true,
        placeholder: "profiles",
      },
      {
        key: "operation",
        label: "Operation",
        type: "select",
        options: [
          { value: "upsert", label: "Upsert row" },
          { value: "select", label: "Select rows" },
        ],
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("supabase"),
      table: "profiles",
      operation: "upsert",
    },
    sampleOutput: {
      status: 201,
      table: "profiles",
      data: [{ id: "usr_9941", synced: true }],
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const table = String(config.table || "profiles");
      const operation = String(config.operation || "upsert");
      return {
        output: {
          ...input,
          status: 201,
          table,
          operation,
          data: [{ id: `usr_${faker.string.alphanumeric(6)}`, synced: true }],
        },
        logs: [`Supabase ${operation} on "${table}" succeeded (201).`],
        meta: { table, operation },
      };
    },
  }),

  // 56. Firebase
  defineRegistryNode({
    id: "data.firebase",
    label: "Firebase Firestore",
    description: "Reads or writes documents in a Google Cloud Firestore collection.",
    category: "data",
    subcategory: "Databases",
    keywords: ["firebase", "firestore", "google", "nosql", "document", "collection"],
    icon: "brand:firebase",
    accent: "#FFCA28",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 490,
    configSchema: [
      {
        key: "credentialId",
        label: "Firebase project",
        type: "credential",
        credentialProvider: "firebase",
      },
      {
        key: "collectionPath",
        label: "Collection path",
        type: "text",
        required: true,
        placeholder: "workspaces/default/notifications",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("firebase"),
      collectionPath: "workspaces/default/notifications",
    },
    sampleOutput: {
      documentPath: "workspaces/default/notifications/doc_8812",
      writeTime: "2026-10-04T09:00:00Z",
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const collectionPath = String(config.collectionPath || "notifications");
      const docId = `doc_${faker.string.alphanumeric(6)}`;
      return {
        output: {
          ...input,
          documentPath: `${collectionPath}/${docId}`,
          writeTime: new Date(ctx.now()).toISOString(),
        },
        logs: [`Firestore document written to ${collectionPath}/${docId}.`],
        meta: { collectionPath, docId },
      };
    },
  }),

  // 57. Redis
  defineRegistryNode({
    id: "data.redis",
    label: "Redis",
    description: "Executes GET, SET, INCR, or PUBLISH commands against a Redis instance.",
    category: "data",
    subcategory: "Cache & KV",
    keywords: ["redis", "upstash", "cache", "kv", "key", "ttl", "pubsub"],
    icon: "brand:redis",
    accent: "#DC382D",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 340,
    configSchema: [
      {
        key: "credentialId",
        label: "Redis instance",
        type: "credential",
        credentialProvider: "redis",
      },
      {
        key: "command",
        label: "Command",
        type: "select",
        options: [
          { value: "SET", label: "SET key value" },
          { value: "GET", label: "GET key" },
          { value: "INCR", label: "INCR counter" },
        ],
      },
      {
        key: "key",
        label: "Key",
        type: "expression",
        required: true,
        placeholder: "ratelimit:{{user.email}}",
      },
      {
        key: "value",
        label: "Value",
        type: "expression",
        placeholder: "{{text}}",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("redis"),
      command: "SET",
      key: "session:latest",
      value: "{{text}}",
    },
    sampleOutput: {
      redisResult: "OK",
      command: "SET",
      key: "session:latest",
      ttlSeconds: 3600,
    },
    simulate: async (input, config, ctx) => {
      const command = String(config.command || "SET");
      const key = ctx.resolveExpression(String(config.key || "session:latest"));
      const value = ctx.resolveExpression(String(config.value || ""));
      return {
        output: {
          ...input,
          redisResult: command === "INCR" ? 1 : "OK",
          command,
          key,
          value,
          ttlSeconds: 3600,
        },
        logs: [`Redis ${command} ${key} -> OK.`],
        meta: { command, key },
      };
    },
  }),

  // 58. Airtable
  defineRegistryNode({
    id: "data.airtable",
    label: "Airtable",
    description: "Creates, updates, or searches records in an Airtable base.",
    category: "data",
    subcategory: "Spreadsheets",
    keywords: ["airtable", "base", "table", "record", "create", "update", "search"],
    icon: "brand:airtable",
    accent: "#FCB400",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 560,
    configSchema: [
      {
        key: "credentialId",
        label: "Airtable account",
        type: "credential",
        credentialProvider: "airtable",
      },
      {
        key: "operation",
        label: "Operation",
        type: "select",
        options: [
          { value: "create", label: "Create Record" },
          { value: "update", label: "Update Record" },
          { value: "search", label: "Search Records" },
        ],
      },
      {
        key: "baseName",
        label: "Base / Table",
        type: "text",
        required: true,
        placeholder: "CRM / Deals",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("airtable"),
      operation: "create",
      baseName: "CRM / Deals",
    },
    sampleOutput: {
      airtableRecordId: "rec881920a",
      operation: "create",
      baseName: "CRM / Deals",
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const operation = String(config.operation || "create");
      const baseName = String(config.baseName || "CRM / Deals");
      const airtableRecordId = `rec${faker.string.alphanumeric(10)}`;
      return {
        output: { ...input, airtableRecordId, operation, baseName },
        logs: [`Airtable ${operation} on "${baseName}" -> ${airtableRecordId}.`],
        meta: { operation, baseName, airtableRecordId },
      };
    },
  }),

  // 59. Google Sheets (append, update, lookup)
  defineRegistryNode({
    id: "data.googleSheets",
    label: "Google Sheets",
    description: "Appends a row, updates matching cells, or looks up rows in Google Sheets.",
    category: "data",
    subcategory: "Spreadsheets",
    keywords: ["google", "sheets", "spreadsheet", "append", "update", "lookup", "row"],
    icon: "brand:googlesheets",
    accent: "#34A853",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 580,
    configSchema: [
      {
        key: "credentialId",
        label: "Google account",
        type: "credential",
        credentialProvider: "google",
      },
      {
        key: "operation",
        label: "Operation",
        type: "select",
        options: [
          { value: "append", label: "Append Row" },
          { value: "update", label: "Update Row" },
          { value: "lookup", label: "Lookup Row" },
        ],
      },
      {
        key: "spreadsheet",
        label: "Spreadsheet name",
        type: "text",
        required: true,
        placeholder: "Orders Master 2026",
      },
      {
        key: "columns",
        label: "Column values",
        type: "keyValue",
        keyLabel: "Column",
        valueLabel: "Value",
        placeholder: "{{orderId}}",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("google"),
      operation: "append",
      spreadsheet: "Orders Master 2026",
      columns: [
        { id: "gs-c1", key: "Order", value: "{{orderId}}" },
        { id: "gs-c2", key: "Status", value: "Paid" },
      ],
    },
    sampleOutput: {
      spreadsheet: "Orders Master 2026",
      operation: "append",
      rowIndex: 28,
      row: { Order: "ORD-4821", Status: "Paid" },
    },
    simulate: async (input, config, ctx) => {
      const spreadsheet = String(config.spreadsheet || "Orders Master 2026");
      const operation = String(config.operation || "append");
      const cols = Array.isArray(config.columns)
        ? (config.columns as Array<{ key: string; value: string }>)
        : [];
      const row: Record<string, JsonValue> = {};
      for (const col of cols) {
        if (col.key) row[col.key] = ctx.resolveExpression(String(col.value ?? ""));
      }
      const rowIndex = Math.floor(ctx.random() * 80) + 12;
      return {
        output: { ...input, spreadsheet, operation, rowIndex, row },
        logs: [`Google Sheets (${operation}) on "${spreadsheet}" row #${rowIndex}.`],
        meta: { spreadsheet, operation, rowIndex },
      };
    },
  }),

  // 60. Notion (create page, query database)
  defineRegistryNode({
    id: "data.notion",
    label: "Notion",
    description: "Creates a page in a Notion database or queries database items by filter.",
    category: "data",
    subcategory: "Workspace",
    keywords: ["notion", "page", "database", "wiki", "notes", "query"],
    icon: "brand:notion",
    accent: "#A8A29E",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 560,
    configSchema: [
      {
        key: "credentialId",
        label: "Notion workspace",
        type: "credential",
        credentialProvider: "notion",
      },
      {
        key: "operation",
        label: "Operation",
        type: "select",
        options: [
          { value: "createPage", label: "Create Database Page" },
          { value: "queryDatabase", label: "Query Database" },
        ],
      },
      {
        key: "database",
        label: "Database name",
        type: "text",
        required: true,
        placeholder: "Customer Notes",
      },
      {
        key: "title",
        label: "Page title",
        type: "expression",
        required: true,
        placeholder: "Meeting summary: {{user.name}}",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("notion"),
      operation: "createPage",
      database: "Customer Notes",
      title: "Summary: {{text}}",
    },
    sampleOutput: {
      notionPageId: "ntn_884120a",
      database: "Customer Notes",
      url: "https://notion.so/flowforge/ntn_884120a",
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const database = String(config.database || "Customer Notes");
      const title = ctx.resolveExpression(String(config.title || "Untitled"));
      const notionPageId = `ntn_${faker.string.alphanumeric(8)}`;
      return {
        output: {
          ...input,
          notionPageId,
          database,
          title,
          url: `https://notion.so/flowforge/${notionPageId}`,
        },
        logs: [`Notion page "${title}" created in ${database}.`],
        meta: { notionPageId, database },
      };
    },
  }),

  // 61. Google Drive (upload, download)
  defineRegistryNode({
    id: "data.googleDrive",
    label: "Google Drive",
    description: "Uploads a generated file or downloads file metadata from Google Drive.",
    category: "data",
    subcategory: "Cloud Storage",
    keywords: ["google", "drive", "file", "upload", "download", "storage"],
    icon: "brand:googledrive",
    accent: "#FBBC04",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 600,
    configSchema: [
      {
        key: "credentialId",
        label: "Google Drive account",
        type: "credential",
        credentialProvider: "google",
      },
      {
        key: "operation",
        label: "Operation",
        type: "select",
        options: [
          { value: "upload", label: "Upload File" },
          { value: "download", label: "Download File" },
        ],
      },
      {
        key: "fileName",
        label: "File name",
        type: "expression",
        required: true,
        placeholder: "report-{{run.id}}.json",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("google"),
      operation: "upload",
      fileName: "export-report.json",
    },
    sampleOutput: {
      driveFileId: "1DriveSim88412",
      fileName: "export-report.json",
      webViewLink: "https://drive.google.com/file/d/1DriveSim88412/view",
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const fileName = ctx.resolveExpression(String(config.fileName || "export-report.json"));
      const driveFileId = `1DriveSim${faker.string.alphanumeric(8)}`;
      return {
        output: {
          ...input,
          driveFileId,
          fileName,
          webViewLink: `https://drive.google.com/file/d/${driveFileId}/view`,
        },
        logs: [`Google Drive (${String(config.operation || "upload")}): ${fileName}.`],
        meta: { driveFileId, fileName },
      };
    },
  }),

  // 62. Dropbox
  defineRegistryNode({
    id: "data.dropbox",
    label: "Dropbox",
    description: "Uploads, moves, or creates a shared link for a file in Dropbox.",
    category: "data",
    subcategory: "Cloud Storage",
    keywords: ["dropbox", "file", "storage", "upload", "cloud"],
    icon: "brand:dropbox",
    accent: "#0061FF",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 560,
    configSchema: [
      {
        key: "credentialId",
        label: "Dropbox account",
        type: "credential",
        credentialProvider: "dropbox",
      },
      {
        key: "path",
        label: "Destination path",
        type: "expression",
        required: true,
        placeholder: "/Backups/workflow-output.json",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("dropbox"),
      path: "/Backups/workflow-output.json",
    },
    sampleOutput: {
      dropboxId: "id:sim_dbx_991",
      pathDisplay: "/Backups/workflow-output.json",
      rev: "0159a2b00",
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const pathDisplay = ctx.resolveExpression(String(config.path || "/Backups/workflow-output.json"));
      return {
        output: {
          ...input,
          dropboxId: `id:${faker.string.alphanumeric(10)}`,
          pathDisplay,
        },
        logs: [`Uploaded file to Dropbox ${pathDisplay}.`],
        meta: { pathDisplay },
      };
    },
  }),

  // 63. AWS S3
  defineRegistryNode({
    id: "data.awsS3",
    label: "AWS S3",
    description: "Puts or fetches an object in an Amazon S3 bucket.",
    category: "data",
    subcategory: "Cloud Storage",
    keywords: ["aws", "s3", "bucket", "object", "storage", "cloud"],
    icon: "brand:aws",
    accent: "#FF9900",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 520,
    configSchema: [
      {
        key: "credentialId",
        label: "AWS IAM credential",
        type: "credential",
        credentialProvider: "aws",
      },
      {
        key: "bucket",
        label: "Bucket name",
        type: "text",
        required: true,
        placeholder: "flowforge-artifacts-prod",
      },
      {
        key: "objectKey",
        label: "Object key",
        type: "expression",
        required: true,
        placeholder: "runs/output.json",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("aws"),
      bucket: "flowforge-artifacts-prod",
      objectKey: "runs/output.json",
    },
    sampleOutput: {
      bucket: "flowforge-artifacts-prod",
      key: "runs/output.json",
      etag: '"9b2cf535f27731c974343645a3985328"',
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const bucket = String(config.bucket || "flowforge-artifacts-prod");
      const key = ctx.resolveExpression(String(config.objectKey || "runs/output.json"));
      const etag = `"${faker.string.hexadecimal({ length: 16, prefix: "" })}"`;
      return {
        output: { ...input, bucket, key, etag },
        logs: [`S3 PutObject s3://${bucket}/${key} (${etag}).`],
        meta: { bucket, key, etag },
      };
    },
  }),

  // 64. Pinecone / Vector Store (upsert, query)
  defineRegistryNode({
    id: "data.pinecone",
    label: "Pinecone Vector Store",
    description: "Upserts vector embeddings or performs similarity search in a Pinecone index.",
    category: "data",
    subcategory: "Vector DB",
    keywords: ["pinecone", "vector", "embeddings", "similarity", "rag", "upsert", "query"],
    icon: "lucide:DatabaseZap",
    accent: "#14B8A6",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 540,
    configSchema: [
      {
        key: "credentialId",
        label: "Pinecone index key",
        type: "credential",
        credentialProvider: "pinecone",
      },
      {
        key: "operation",
        label: "Operation",
        type: "select",
        options: [
          { value: "query", label: "Query Top-K Matches" },
          { value: "upsert", label: "Upsert Vectors" },
        ],
      },
      {
        key: "namespace",
        label: "Namespace",
        type: "text",
        required: true,
        placeholder: "kb-docs-v2",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("pinecone"),
      operation: "query",
      namespace: "kb-docs-v2",
    },
    sampleOutput: {
      namespace: "kb-docs-v2",
      operation: "query",
      matches: [
        { id: "vec_101", score: 0.94, text: "Refund SLA is 24 hours for duplicate billing." },
        { id: "vec_102", score: 0.88, text: "Enterprise tier includes dedicated Slack escalation." },
      ],
    },
    simulate: async (input, config) => {
      const namespace = String(config.namespace || "kb-docs-v2");
      const operation = String(config.operation || "query");
      return {
        output: {
          ...input,
          namespace,
          operation,
          matches: [
            { id: "vec_101", score: 0.94, text: "Refund SLA is 24 hours for duplicate billing." },
            { id: "vec_102", score: 0.88, text: "Enterprise tier includes dedicated Slack escalation." },
          ],
        },
        logs: [`Pinecone ${operation} in namespace "${namespace}" returned 2 matches.`],
        meta: { namespace, operation },
      };
    },
  }),
];
