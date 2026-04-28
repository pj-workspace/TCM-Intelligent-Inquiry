export type Agent = {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  tool_names: string[];
  default_kb_id?: string | null;
};

export type KnowledgeBaseLite = { id: string; name: string };

export type AgentFormData = {
  name: string;
  description: string;
  system_prompt: string;
  tool_names: string[];
  default_kb_id: string;
};
