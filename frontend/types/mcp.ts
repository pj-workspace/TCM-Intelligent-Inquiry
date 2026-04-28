export type McpServer = {
  id: string;
  name: string;
  url: string;
  description: string;
  enabled: boolean;
  tool_names: string[];
  last_probe_at: string | null;
  last_probe_error: string | null;
};
