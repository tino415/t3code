import { useClientSettings } from "./useSettings";

export function useOpenInEditorEnabled(): boolean {
  return useClientSettings((settings) => settings.openInEditorEnabled);
}
