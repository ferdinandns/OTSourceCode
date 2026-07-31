'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface Option { value: string; label: string; }

export function MultiSelect({ options, selected, onChange, placeholder }: {
  options: Option[]; selected: string[]; onChange: (val: string[]) => void; placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);

  const allSelected = options.length > 0 && selected.length === options.length;

  const handleSelectAll = () => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(options.map((o) => o.value));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto min-h-10 bg-white border-gray-300 text-gray-900 hover:bg-gray-50 hover:text-gray-900"
        >
          <div className="flex flex-wrap gap-1">
            {selected.length === 0 && <span className="text-gray-500">{placeholder}</span>}
            {selected.map((val) => (
              <Badge
                key={val}
                variant="secondary"
                className="mr-1 mb-1 bg-gray-100 text-gray-900 border border-gray-200"
              >
                {options.find((o) => o.value === val)?.label}
                <span
                  role="button"
                  tabIndex={0}
                  className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 cursor-pointer inline-flex items-center justify-center text-gray-500 hover:text-gray-900"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation(); // Prevents the parent popover button from toggling
                    onChange(selected.filter((i) => i !== val));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onChange(selected.filter((i) => i !== val));
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </span>
              </Badge>
            ))}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-gray-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0 bg-white border border-gray-200 shadow-md opacity-100 z-50"
      >
        <Command className="bg-white">
          <CommandInput placeholder="Cari..." className="text-gray-900" />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-sm text-gray-500">Tidak ditemukan.</CommandEmpty>
            {options.length > 0 && (
              <CommandGroup>
                <CommandItem
                  onSelect={handleSelectAll}
                  className="font-medium !text-gray-900 data-[selected=true]:bg-gray-100 data-[selected=true]:text-gray-900"
                >
                  <Check className={cn("!text-gray-900  mr-2 h-4 w-4", allSelected ? "opacity-100" : "opacity-0")} />
                  {allSelected ? "Batalkan semua" : "Pilih semua"}
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={() => {
                    onChange(selected.includes(option.value)
                      ? selected.filter((item) => item !== option.value)
                      : [...selected, option.value]);
                  }}
                  className="!text-gray-900 data-[selected=true]:bg-gray-100 data-[selected=true]:text-gray-900"
                >
                  <Check className={cn("!text-gray-900 mr-2 h-4 w-4", selected.includes(option.value) ? "opacity-100" : "opacity-0")} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}