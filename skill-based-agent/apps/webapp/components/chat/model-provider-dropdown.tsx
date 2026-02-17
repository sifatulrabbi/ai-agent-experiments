"use client";

import { useEffect, useState } from "react";
import { CheckIcon, ChevronDownIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AIModelProviderEntry } from "@/components/chat/model-catalog";

interface ModelProviderDropdownProps {
  disabled?: boolean;
  maxLabelLength?: number;
  onChange: (selection: { modelId: string; providerId: string }) => void;
  providers: AIModelProviderEntry[];
  triggerMode?: "default" | "icon" | "pill";
  value: { modelId: string; providerId: string };
}

function parseModelLabel(modelLabel: string) {
  if (modelLabel.includes(": ")) {
    return modelLabel.split(": ")[1];
  }
  return modelLabel;
}

export function ModelProviderDropdown({
  disabled,
  maxLabelLength,
  onChange,
  providers,
  triggerMode = "default",
  value,
}: ModelProviderDropdownProps) {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const selectedProvider = providers.find(
    (provider) => provider.id === value.providerId,
  );
  const selectedModel = selectedProvider?.models.find(
    (model) => model.id === value.modelId,
  );
  const modelLabel = selectedModel ? selectedModel.name : "Select model";
  const triggerLabel = parseModelLabel(modelLabel);
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

  function clampLabel(label: string): string {
    if (!maxLabelLength || label.length <= maxLabelLength) {
      return label;
    }

    return `${label.slice(0, Math.max(0, maxLabelLength - 1))}\u2026`;
  }

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateMobileState = () => setIsMobileViewport(mediaQuery.matches);

    updateMobileState();
    mediaQuery.addEventListener("change", updateMobileState);

    return () => {
      mediaQuery.removeEventListener("change", updateMobileState);
    };
  }, []);

  const contentAlign = isMobileViewport ? "center" : "start";
  const contentSide = isMobileViewport ? "top" : "bottom";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Select model"
          className={
            triggerMode === "icon"
              ? "h-8 w-8 px-0"
              : "h-8 max-w-25 md:max-w-55 justify-between gap-2 text-xs"
          }
          disabled={disabled}
          size="sm"
          type="button"
          variant="outline"
        >
          {triggerMode === "icon" ? (
            <SparklesIcon className="size-4" />
          ) : (
            <>
              <span className="truncate">{clampLabel(triggerLabel)}</span>
              <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={contentAlign}
        className="max-h-[70vh] w-[calc(100vw-2rem)] max-w-[24rem] sm:max-h-(--radix-dropdown-menu-content-available-height) sm:w-80 sm:max-w-none"
        side={contentSide}
        sideOffset={8}
      >
        <DropdownMenuLabel>Choose provider and model</DropdownMenuLabel>
        {isMobileViewport
          ? providers.map((provider) => (
              <div key={provider.id}>
                <DropdownMenuLabel className="text-muted-foreground px-2 py-1 text-xs">
                  {provider.name}
                </DropdownMenuLabel>
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
                <DropdownMenuSeparator />
              </div>
            ))
          : providers.map((provider) => (
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
                <DropdownMenuSubContent className="max-h-[24rem] w-[min(20rem,calc(100vw-1rem))] overflow-y-auto sm:w-80">
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
                          onChange({
                            modelId: model.id,
                            providerId: provider.id,
                          })
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
