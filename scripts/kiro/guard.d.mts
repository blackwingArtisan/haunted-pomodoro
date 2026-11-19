// Types for scripts/kiro/guard.mjs, which stays plain JavaScript so Kiro can run it with node alone.
export interface ToolCallEvent {
  hook_event_name?: string;
  cwd?: string;
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}
export function blockReason(event: ToolCallEvent): string | null;
