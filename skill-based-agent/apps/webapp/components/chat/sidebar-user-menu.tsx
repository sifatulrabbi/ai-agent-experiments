"use client";

import Link from "next/link";
import { ChevronUpIcon, SettingsIcon, LayoutDashboardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SidebarUserMenuProps {
  userName?: string | null;
  userEmail?: string | null;
}

export function SidebarUserMenu({ userName, userEmail }: SidebarUserMenuProps) {
  const label = userName?.trim() || userEmail || "Current user";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="w-full justify-between"
          size="sm"
          type="button"
          variant="outline"
        >
          <span className="truncate">{label}</span>
          <ChevronUpIcon className="size-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutDashboardIcon className="size-4" />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <SettingsIcon className="size-4" />
            Settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
