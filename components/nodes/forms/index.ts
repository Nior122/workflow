import type { ComponentType } from "react";
import type { NodeConfig, NodeType } from "@/types/nodes";
import type { ConfigFormProps } from "./types";
import {
  ManualTriggerForm,
  ScheduleTriggerForm,
  WebhookTriggerForm,
} from "./trigger-forms";
import {
  AiPromptForm,
  ConditionForm,
  DelayForm,
  HttpRequestForm,
  TextFormatterForm,
  TransformForm,
} from "./action-forms";
import { EmailForm, LogForm, SheetsForm, SlackForm } from "./output-forms";

/**
 * Every node type's config form, keyed by NodeType.
 *
 * Values are typed against the full NodeConfig union rather than per-type generics
 * because React renders them through one dynamic lookup; each form narrows its own
 * props internally and only ever receives the config for its own type.
 */
type FormComponent = ComponentType<ConfigFormProps<NodeConfig>>;

export const CONFIG_FORMS: Readonly<Record<NodeType, FormComponent>> = {
  "trigger.manual": ManualTriggerForm as FormComponent,
  "trigger.webhook": WebhookTriggerForm as FormComponent,
  "trigger.schedule": ScheduleTriggerForm as FormComponent,
  "action.aiPrompt": AiPromptForm as FormComponent,
  "action.httpRequest": HttpRequestForm as FormComponent,
  "action.transform": TransformForm as FormComponent,
  "action.condition": ConditionForm as FormComponent,
  "action.delay": DelayForm as FormComponent,
  "action.textFormatter": TextFormatterForm as FormComponent,
  "output.email": EmailForm as FormComponent,
  "output.slack": SlackForm as FormComponent,
  "output.sheets": SheetsForm as FormComponent,
  "output.log": LogForm as FormComponent,
};

export type { ConfigFormProps };
