"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BuildingPermit } from "@/server/src/db/schema";

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

interface Props {
  records: (Record & Partial<BuildingPermit>)[];
  initialParams: {
    sortBy?: string;
    sortOrder?: string;
  };
  extraFields?: Array<{
    key: ExtraFieldKey;
    label: string;
  }>;
}

function SortIcon({
  field,
  sortBy,
  sortOrder,
}: {
  field: SortField;
  sortBy?: string;
  sortOrder?: string;
}) {
  if (sortBy !== field) return <span className="text-gray-400">↕</span>;
  return sortOrder === "asc" ? (
    <span className="text-blue-600">↑</span>
  ) : (
    <span className="text-blue-600">↓</span>
  );
}

export default function RecordsTable({
  records,
  initialParams,
  extraFields = [],
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const { sortBy, sortOrder } = initialParams;

  const createSortUrl = (field: SortField) => {
    const newOrder = sortBy === field && sortOrder === "desc" ? "asc" : "desc";
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("sortBy", field);
    newParams.set("sortOrder", newOrder);
    return `?${newParams.toString()}`;
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto shadow-md rounded-lg overflow-hidden">
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
              <th className="text-left p-4 font-semibold text-sm">
                <Link
                  href={createSortUrl("appliedDate")}
                  className="hover:text-blue-600 flex items-center gap-1"
                  scroll={false}
                >
                  Applied Date{" "}
                  <SortIcon
                    field="appliedDate"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                  />
                </Link>
              </th>
              <th className="text-left p-4 font-semibold text-sm">
                <Link
                  href={createSortUrl("completedDate")}
                  className="hover:text-blue-600 flex items-center gap-1"
                  scroll={false}
                >
                  Completed Date{" "}
                  <SortIcon
                    field="completedDate"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                  />
                </Link>
              </th>
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
                  {field.label}
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
                  <td className="p-4 text-sm">
                    {record.appliedDate
                      ? new Date(record.appliedDate).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="p-4 text-sm">
                    {record.completedDate
                      ? new Date(record.completedDate).toLocaleDateString()
                      : "-"}
                  </td>
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
                  colSpan={5 + extraFields.length}
                  className="p-8 text-center text-gray-500"
                >
                  No records found for the selected criteria
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
