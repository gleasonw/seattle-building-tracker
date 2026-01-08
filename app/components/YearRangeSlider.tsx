"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/slider";

interface YearRangeSliderProps {
  minYear: number;
  maxYear: number;
  startYear: number;
  endYear: number;
  onChange: (start: number, end: number) => void;
  onApply?: () => void;
}

export default function YearRangeSlider({
  minYear,
  maxYear,
  startYear,
  endYear,
  onChange,
}: YearRangeSliderProps) {
  const [localValues, setLocalValues] = useState<number[]>([
    startYear,
    endYear,
  ]);

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
          {localValues[0]} - {localValues[1]}
        </span>
        <span className="text-xs text-gray-500">
          {localValues[1] - localValues[0] + 1} years
        </span>
      </div>

      <Slider
        min={minYear}
        max={maxYear}
        step={1}
        value={localValues}
        onValueChange={(values) => {
          setLocalValues(values);
          onChange(values[0], values[1]);
        }}
        className="w-full"
      />
    </div>
  );
}
