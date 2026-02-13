"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AIModelProviderEntry } from "@/components/chat/model-catalog";

interface ModelProviderDropdownProps {
  disabled?: boolean;
  onChange: (selection: { modelId: string; providerId: string }) => void;
  providers: AIModelProviderEntry[];
  value: { modelId: string; providerId: string };
}

export function ModelProviderDropdown({
  disabled,
  onChange,
  providers,
  value,
}: ModelProviderDropdownProps) {
  const selectedProvider = providers.find(
    (provider) => provider.id === value.providerId,
  );
  const selectedModel = selectedProvider?.models.find(
    (model) => model.id === value.modelId,
  );
  const label = selectedModel ? selectedModel.name : "Select model";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="h-8 max-w-[220px] justify-between gap-2 text-xs"
          disabled={disabled}
          size="sm"
          type="button"
          variant="outline"
        >
          <span className="truncate">{label}</span>
          <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Choose provider and model</DropdownMenuLabel>
        {providers.map((provider) => (
          <DropdownMenuSub key={provider.id}>
            <DropdownMenuSubTrigger className="text-sm">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate">{provider.name}</span>
                {provider.id === selectedProvider?.id ? (
                  <span className="text-muted-foreground text-xs">
                    selected
                  </span>
                ) : null}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-72">
              <DropdownMenuLabel>{provider.name} models</DropdownMenuLabel>
              {provider.models.map((model) => {
                const isSelected =
                  provider.id === value.providerId &&
                  model.id === value.modelId;

                return (
                  <DropdownMenuItem
                    key={`${provider.id}-${model.id}`}
                    onSelect={() =>
                      onChange({ modelId: model.id, providerId: provider.id })
                    }
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {model.name}
                    </span>
                    {isSelected ? <CheckIcon className="size-4" /> : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
