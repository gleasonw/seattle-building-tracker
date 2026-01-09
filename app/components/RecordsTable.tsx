"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BuildingPermit } from "@/server/src/db/schema";
import { ArrowDown, ArrowDownUp, ArrowUp } from "lucide-react";

interface Record {
  permitNum: string;
  appliedDate: string | null;
  completedDate: string | null;
  housingUnitsAdded: number | null;
  originalAddress1: string | null;
  permitTypeMapped: string | null;
  description: string | null;
  link: string | null;
  estProjectCost: string | null;
  latitude: string | null;
  longitude: string | null;
}

type SortField =
  | "appliedDate"
  | "completedDate"
  | "housingUnitsAdded"
  | "permitNum";

type ExtraFieldKey = keyof BuildingPermit;

interface DateColumn {
  key: "appliedDate" | "completedDate";
  label: string;
}

interface Props {
  records: (Record & Partial<BuildingPermit>)[];
  initialParams: {
    sortBy?: string;
    sortOrder?: string;
  };
  dateColumns?: DateColumn[];
  extraFields?: Array<{
    key: ExtraFieldKey;
    label: string;
    sortable?: boolean;
  }>;
}

function SortIcon({
  field,
  sortBy,
  sortOrder,
}: {
  field: string;
  sortBy?: string;
  sortOrder?: string;
}) {
  if (sortBy !== field)
    return (
      <span className="text-gray-400">
        <ArrowDownUp size={12} />
      </span>
    );
  return sortOrder === "asc" ? (
    <span className="text-blue-600">
      <ArrowUp size={12} />
    </span>
  ) : (
    <span className="text-blue-600">
      <ArrowDown size={12} />
    </span>
  );
}

export default function RecordsTable({
  records,
  initialParams,
  dateColumns = [],
  extraFields = [],
}: Props) {
  const searchParams = useSearchParams();

  const { sortBy, sortOrder } = initialParams;

  const createSortUrl = (field: string) => {
    const newOrder = sortBy === field && sortOrder === "desc" ? "asc" : "desc";
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("sortBy", field);
    newParams.set("sortOrder", newOrder);
    return `?${newParams.toString()}`;
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto shadow-md rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="text-left p-4 font-semibold text-sm">
                <Link
                  href={createSortUrl("permitNum")}
                  className="hover:text-blue-600 flex items-center gap-1"
                  scroll={false}
                >
                  Permit Number{" "}
                  <SortIcon
                    field="permitNum"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                  />
                </Link>
              </th>
              {dateColumns.map((dateCol) => (
                <th
                  key={dateCol.key}
                  className="text-left p-4 font-semibold text-sm"
                >
                  <Link
                    href={createSortUrl(dateCol.key)}
                    className="hover:text-blue-600 flex items-center gap-1"
                    scroll={false}
                  >
                    {dateCol.label}{" "}
                    <SortIcon
                      field={dateCol.key}
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                    />
                  </Link>
                </th>
              ))}
              <th className="text-left p-4 font-semibold text-sm">Address</th>
              <th className="text-right p-4 font-semibold text-sm">
                <Link
                  href={createSortUrl("housingUnitsAdded")}
                  className="hover:text-blue-600 flex items-center justify-end gap-1"
                  scroll={false}
                >
                  <SortIcon
                    field="housingUnitsAdded"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                  />{" "}
                  Units
                </Link>
              </th>
              {extraFields.map((field) => (
                <th
                  key={field.key}
                  className="text-left p-4 font-semibold text-sm"
                >
                  {field.sortable ? (
                    <Link
                      href={createSortUrl(field.key)}
                      className="hover:text-blue-600 flex items-center gap-1"
                      scroll={false}
                    >
                      {field.label}{" "}
                      <SortIcon
                        field={field.key}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </Link>
                  ) : (
                    field.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.length > 0 ? (
              records.map((record) => (
                <tr
                  key={record.permitNum}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="p-4 text-sm">
                    {record.link ? (
                      <a
                        href={record.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-blue-600 hover:underline"
                      >
                        {record.permitNum}
                      </a>
                    ) : (
                      <span className="font-mono text-gray-900">
                        {record.permitNum}
                      </span>
                    )}
                  </td>
                  {dateColumns.map((dateCol) => (
                    <td key={dateCol.key} className="p-4 text-sm">
                      {record[dateCol.key]
                        ? new Date(record[dateCol.key]!).toLocaleDateString()
                        : "-"}
                    </td>
                  ))}
                  <td className="p-4 text-sm max-w-md">
                    <div className="truncate">
                      {record.originalAddress1 ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            record.originalAddress1 + ", Seattle, WA"
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {record.originalAddress1}
                        </a>
                      ) : (
                        "-"
                      )}
                    </div>
                    {record.description && (
                      <div className="text-xs text-gray-500 truncate mt-1">
                        {record.description}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-sm text-right tabular-nums font-medium">
                    {record.housingUnitsAdded?.toLocaleString() || 0}
                  </td>
                  {extraFields.map((field) => (
                    <td key={field.key} className="p-4 text-sm">
                      {record[field.key] !== null &&
                      record[field.key] !== undefined
                        ? String(record[field.key])
                        : "-"}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={3 + dateColumns.length + extraFields.length}
                  className="p-8 text-center text-gray-500"
                >
                  No records found for the selected criteria
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-3">
        {records.length > 0 ? (
          records.map((record) => (
            <div
              key={record.permitNum}
              className="bg-white rounded-lg shadow p-4 border border-gray-200"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  {record.link ? (
                    <a
                      href={record.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-blue-600 hover:underline block truncate"
                    >
                      {record.permitNum}
                    </a>
                  ) : (
                    <span className="font-mono text-sm text-gray-900 block truncate">
                      {record.permitNum}
                    </span>
                  )}
                </div>
                <div className="ml-2 text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                  {record.housingUnitsAdded?.toLocaleString() || 0} units
                </div>
              </div>

              {record.originalAddress1 && (
                <div className="mb-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      record.originalAddress1 + ", Seattle, WA"
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline line-clamp-2"
                  >
                    {record.originalAddress1}
                  </a>
                </div>
              )}

              {record.description && (
                <div className="text-xs text-gray-500 mb-2 line-clamp-2">
                  {record.description}
                </div>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                {dateColumns.map(
                  (dateCol) =>
                    record[dateCol.key] && (
                      <div key={dateCol.key}>
                        <span className="font-medium">{dateCol.label}:</span>{" "}
                        {new Date(record[dateCol.key]!).toLocaleDateString()}
                      </div>
                    )
                )}
              </div>

              {extraFields.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  {extraFields.map((field) => (
                    <div key={field.key} className="text-xs text-gray-600">
                      <span className="font-medium">{field.label}:</span>{" "}
                      {record[field.key] !== null &&
                      record[field.key] !== undefined
                        ? String(record[field.key])
                        : "-"}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow">
            No records found for the selected criteria
          </div>
        )}
      </div>
    </div>
  );
}
