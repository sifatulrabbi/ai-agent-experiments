"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import {
  CheckIcon,
  PaperclipIcon,
  BrainIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import type { AIModelProviderEntry } from "@/components/chat/model-catalog";
import { getModelById } from "@/components/chat/model-catalog";
import { ModelProviderDropdown } from "@/components/chat/model-provider-dropdown";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useThreadUiStore } from "@/components/chat/thread-ui-store";
import type { ThreadStatus } from "@/components/chat/thread-ui-shared";

interface ThreadPromptInputProps {
  disabled?: boolean;
  modelSelection: { modelId: string; providerId: string };
  onModelChange: (selection: { modelId: string; providerId: string }) => void;
  onStop: () => void;
  onSubmit: (payload: { text: string }) => Promise<void> | void;
  onThinkingBudgetChange: (budget: string) => void;
  providers: AIModelProviderEntry[];
  status: ThreadStatus;
  thinkingBudget: string;
}

function PromptActionRow({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

export function ThreadPromptInput({
  disabled,
  modelSelection,
  onModelChange,
  onStop,
  onSubmit,
  onThinkingBudgetChange,
  providers,
  status,
  thinkingBudget,
}: ThreadPromptInputProps) {
  const isDeepResearchEnabled = useThreadUiStore(
    (state) => state.deepResearchEnabled,
  );
  const isImageCreationEnabled = useThreadUiStore(
    (state) => state.imageCreationEnabled,
  );
  const setDeepResearchEnabled = useThreadUiStore(
    (state) => state.setDeepResearchEnabled,
  );
  const setImageCreationEnabled = useThreadUiStore(
    (state) => state.setImageCreationEnabled,
  );

  const selectedModel = useMemo(
    () =>
      getModelById(
        providers,
        modelSelection.providerId,
        modelSelection.modelId,
      ),
    [modelSelection.modelId, modelSelection.providerId, providers],
  );
  const availablestrings = useMemo(
    () => selectedModel?.reasoning.budgets ?? [],
    [selectedModel],
  );
  const supportsThinking = availablestrings.some((budget) => budget !== "none");

  useEffect(() => {
    if (!selectedModel) {
      return;
    }

    if (!selectedModel.reasoning.budgets.includes(thinkingBudget)) {
      onThinkingBudgetChange(selectedModel.reasoning.defaultValue);
    }
  }, [onThinkingBudgetChange, selectedModel, thinkingBudget]);

  return (
    <div className="sticky bottom-0 bg-background pt-2 pb-4">
      <PromptInput onSubmit={onSubmit}>
        <PromptInputBody>
          <PromptInputTextarea placeholder="Ask anything..." />
        </PromptInputBody>

        <PromptInputFooter>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" type="button" variant="outline">
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 p-3">
                <div className="space-y-2">
                  <PromptActionRow label="Attach files">
                    <Button disabled size="sm" type="button" variant="outline">
                      <PaperclipIcon className="size-4" />
                      Attach
                    </Button>
                  </PromptActionRow>
                  <PromptActionRow label="Deep Research">
                    <Switch
                      checked={isDeepResearchEnabled}
                      onCheckedChange={setDeepResearchEnabled}
                    />
                  </PromptActionRow>
                  <PromptActionRow label="Image creation">
                    <Switch
                      checked={isImageCreationEnabled}
                      onCheckedChange={setImageCreationEnabled}
                    />
                  </PromptActionRow>
                </div>
              </PopoverContent>
            </Popover>

            <ModelProviderDropdown
              disabled={disabled}
              maxLabelLength={28}
              onChange={onModelChange}
              providers={providers}
              triggerMode="pill"
              value={modelSelection}
            />

            {supportsThinking ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="h-8 w-8 px-0 sm:hidden"
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <BrainIcon className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {availablestrings.map((budget) => (
                      <DropdownMenuItem
                        className="flex items-center justify-between gap-2"
                        key={budget}
                        onSelect={() => onThinkingBudgetChange(budget)}
                      >
                        <span>
                          {budget === "none"
                            ? "None"
                            : `${budget[0]?.toUpperCase()}${budget.slice(1)}`}
                        </span>
                        {budget === thinkingBudget ? (
                          <CheckIcon className="size-4 text-muted-foreground" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Select
                  onValueChange={(value) =>
                    onThinkingBudgetChange(value as string)
                  }
                  value={thinkingBudget}
                >
                  <SelectTrigger
                    className="hidden h-8 w-30 gap-2 rounded-md text-xs sm:flex"
                    size="sm"
                  >
                    <BrainIcon className="size-3.5" />
                    <SelectValue placeholder="Thinking" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {availablestrings.map((budget) => (
                      <SelectItem key={budget} value={budget}>
                        {budget === "none"
                          ? "None"
                          : `${budget[0]?.toUpperCase()}${budget.slice(1)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : null}
          </div>

          <PromptInputSubmit
            disabled={disabled}
            onStop={onStop}
            status={status}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
