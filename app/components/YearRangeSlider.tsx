"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/slider";

interface YearRangeSliderProps {
  minYear: number;
  maxYear: number;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  onChange: (startDate: string, endDate: string) => void;
  onApply?: () => void;
}

export default function YearRangeSlider({
  minYear,
  maxYear,
  startDate,
  endDate,
  onChange,
}: YearRangeSliderProps) {
  const startYear = new Date(startDate).getFullYear();
  const endYear = new Date(endDate).getFullYear();

  const [localValues, setLocalValues] = useState<number[]>([
    startYear,
    endYear,
  ]);

  const [showExactDates, setShowExactDates] = useState(false);
  const [localStartDate, setLocalStartDate] = useState(startDate);
  const [localEndDate, setLocalEndDate] = useState(endDate);

  const handleYearChange = (start: number, end: number) => {
    // When slider changes, update to Jan 1 - Dec 31 of those years
    const newStartDate = `${start}-01-01`;
    const newEndDate = `${end}-12-31`;
    setLocalStartDate(newStartDate);
    setLocalEndDate(newEndDate);
    onChange(newStartDate, newEndDate);
  };

  const handleExactDateChange = (startDate: string, endDate: string) => {
    // Update slider years to match the date inputs
    const newStartYear = new Date(startDate).getFullYear();
    const newEndYear = new Date(endDate).getFullYear();
    setLocalValues([newStartYear, newEndYear]);
    setLocalStartDate(startDate);
    setLocalEndDate(endDate);
    onChange(startDate, endDate);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
          {localValues[0]} - {localValues[1]}
        </span>
        <button
          type="button"
          onClick={() => setShowExactDates(!showExactDates)}
          className="text-xs text-blue-600 hover:underline"
        >
          {showExactDates ? "Hide" : "Show"} exact dates
        </button>
      </div>

      <Slider
        min={minYear}
        max={maxYear}
        step={1}
        value={localValues}
        onValueChange={(values) => {
          setLocalValues(values);
        }}
        onValueCommit={(values) => {
          handleYearChange(values[0], values[1]);
        }}
        className="w-full"
      />

      {showExactDates && (
        <div className="flex gap-2 items-center mt-2">
          <div className="flex flex-col flex-1">
            <label className="text-xs text-gray-600 mb-1">Start Date</label>
            <input
              type="date"
              value={localStartDate}
              onChange={(e) => {
                const newValue = e.target.value;
                if (newValue && newValue <= localEndDate) {
                  handleExactDateChange(newValue, localEndDate);
                }
              }}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col flex-1">
            <label className="text-xs text-gray-600 mb-1">End Date</label>
            <input
              type="date"
              value={localEndDate}
              onChange={(e) => {
                const newValue = e.target.value;
                if (newValue && newValue >= localStartDate) {
                  handleExactDateChange(localStartDate, newValue);
                }
              }}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
