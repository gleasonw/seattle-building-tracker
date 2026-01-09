"use client";

import { Filter } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import SortControls from "./SortControls";

interface SortOption {
  key: string;
  label: string;
}

interface MobileFiltersProps {
  children: React.ReactNode;
  sortOptions?: SortOption[];
  currentSort?: string;
  currentOrder?: string;
}

export default function MobileFilters({
  children,
  sortOptions,
  currentSort,
  currentOrder,
}: MobileFiltersProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors">
            <Filter className="w-5 h-5" />
            <span className="font-medium">Filters</span>
          </button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-full sm:max-w-md p-0 overflow-y-auto"
        >
          <VisuallyHidden.Root>
            <SheetTitle>Filters</SheetTitle>
          </VisuallyHidden.Root>
          <div className="p-6 space-y-8">
            {children}
            {sortOptions && sortOptions.length > 0 && (
              <SortControls
                sortOptions={sortOptions}
                currentSort={currentSort}
                currentOrder={currentOrder}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
