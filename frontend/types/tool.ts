export interface ToolArgInfo {
  name: string;
  type: string;
  required: boolean;
  default?: string | number | boolean | null;
  description: string;
}

export type ToolCategory = "knowledge" | "formula" | "web" | "system";

export interface BuiltinToolInfo {
  name: string;
  label: string;
  description: string;
  category: ToolCategory;
  args_schema: ToolArgInfo[];
  used_by_agents: number;
}
