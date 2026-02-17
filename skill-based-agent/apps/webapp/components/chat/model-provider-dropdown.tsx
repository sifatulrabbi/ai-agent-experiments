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
  const tokenFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    notation: "compact",
  });
  const priceFormatter = new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
    style: "currency",
  });

  function formatTokens(value: number): string {
    return `${tokenFormatter.format(value)} tokens`;
  }

  function formatPricePerMillion(value: number | null): string {
    if (value === null) {
      return "N/A";
    }

    return `${priceFormatter.format(value)}/1M`;
  }

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
      <DropdownMenuContent align="start" className="w-80">
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
            <DropdownMenuSubContent className="w-80">
              <DropdownMenuLabel>{provider.name} models</DropdownMenuLabel>
              {provider.models.map((model) => {
                const isSelected =
                  provider.id === value.providerId &&
                  model.id === value.modelId;

                return (
                  <DropdownMenuItem
                    className="items-start gap-2 py-2.5"
                    key={`${provider.id}-${model.id}`}
                    onSelect={() =>
                      onChange({ modelId: model.id, providerId: provider.id })
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{model.name}</div>
                      <div className="pt-0.5 text-[11px] text-muted-foreground">
                        {`Total ${formatTokens(model.contextLimits.total)} | In ${formatTokens(model.contextLimits.maxInput)} | Out ${formatTokens(model.contextLimits.maxOutput)}`}
                      </div>
                      <div className="pt-0.5 text-[11px] text-muted-foreground">
                        {`Price In ${formatPricePerMillion(model.pricing.inputUsdPerMillion)} | Out ${formatPricePerMillion(model.pricing.outputUsdPerMillion)}`}
                      </div>
                    </div>
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
