"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import type { WorkspaceNavGroup } from "@/components/layout/WorkspaceSidebar";

export function WorkspaceSearch({ groups }: { groups: WorkspaceNavGroup[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="hidden h-10 w-52 justify-start gap-2 px-3 text-muted-foreground md:inline-flex xl:w-64"
        aria-label="Search workspace pages"
        onClick={() => setOpen(true)}
      >
        <Search aria-hidden className="size-4 shrink-0" />
        <span className="flex-1 text-left">Search</span>
        <kbd className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">⌘ K</kbd>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Search workspace pages"
        onClick={() => setOpen(true)}
      >
        <Search aria-hidden className="size-4" />
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search workspace"
        description="Search pages available to your role."
        className="top-[12vh] w-[calc(100%-2rem)] max-w-xl translate-y-0"
      >
        <Command>
          <CommandInput placeholder="Search pages and modules…" />
          <CommandList>
            <CommandEmpty>No matching pages. Try another search.</CommandEmpty>
            {groups.map((group) => {
              const availableItems = group.items.filter((item) => item.allowed !== false && item.ready !== false);
              if (!availableItems.length) return null;
              return (
                <CommandGroup key={group.label} heading={group.label}>
                  {availableItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <CommandItem
                        key={`${item.href}:${item.label}`}
                        value={`${item.label} ${item.href}`}
                        onSelect={() => navigate(item.href)}
                      >
                        <Icon aria-hidden className="size-4" />
                        <span>{item.label}</span>
                        <CommandShortcut>↵</CommandShortcut>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
