import { useCallback, useMemo, useState } from 'react';
import { Money } from '../core';
import { useContainer } from '../di/provider';
import { BillTotals, CalculatedLine } from '../models/invoice';
import { Product } from '../models/product';
import {
  BillLineDraft,
  BillLineField,
  DimensionField,
  emptyDimensionDraft,
  lineFromProduct,
  toLineItem,
  withMeasuring,
} from '../services/bill';
import { calculateBill } from '../services/bill-calculator';

export interface LineEntry {
  readonly lines: readonly BillLineDraft[];
  /** Recalculated as the shopkeeper types, from the lines that currently read. */
  readonly totals: BillTotals;
  /** The calculated line for each draft line that reads, by key. */
  readonly lineTotals: Readonly<Record<string, CalculatedLine>>;
  readonly isEmpty: boolean;
  addProduct(product: Product): void;
  removeLine(key: string): void;
  setLineField(key: string, field: BillLineField, value: string): void;
  addDimension(lineKey: string): void;
  removeDimension(lineKey: string, dimensionKey: string): void;
  setDimensionField(
    lineKey: string,
    dimensionKey: string,
    field: DimensionField,
    value: string,
  ): void;
  /** Switches a stone line between a typed total and measured pieces. */
  setMeasuring(lineKey: string, measured: boolean): void;
  /** Starts again from a given set of lines — a cleared form, or a quotation. */
  replaceAll(lines: readonly BillLineDraft[]): void;
}

/**
 * The lines of a document being typed, and the running total they come to.
 *
 * Shared by the bill and the quotation, which are entered identically: the
 * same product picker, the same measured pieces, the same per-line discount,
 * the same arithmetic. Two copies of this would mean a fix to the marble entry
 * on one screen silently missing the other, and the two documents disagreeing
 * about a price is the one failure this app cannot afford.
 */
export function useLineEntry(
  billDiscount: Money,
  initial: readonly BillLineDraft[] = [],
): LineEntry {
  const { ids } = useContainer();
  const [lines, setLines] = useState<readonly BillLineDraft[]>(initial);

  // Kept beside their keys, so a row can show its own total even though the
  // calculator only ever sees the lines that currently read.
  const readable = useMemo(
    () => lines.map((line) => ({ key: line.key, item: toLineItem(line) })),
    [lines],
  );

  const totals = useMemo(
    () =>
      calculateBill(
        readable.flatMap((r) => (r.item ? [r.item] : [])),
        billDiscount,
      ),
    [readable, billDiscount],
  );

  const lineTotals = useMemo(() => {
    const byKey: Record<string, CalculatedLine> = {};
    let index = 0;
    for (const entry of readable) {
      if (entry.item) {
        byKey[entry.key] = totals.lines[index];
        index += 1;
      }
    }
    return byKey;
  }, [readable, totals]);

  const addProduct = useCallback(
    (product: Product) => {
      setLines((current) => [...current, lineFromProduct(product, ids.next())]);
    },
    [ids],
  );

  const removeLine = useCallback((key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  }, []);

  const setLineField = useCallback((key: string, field: BillLineField, value: string) => {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, [field]: value } : line)),
    );
  }, []);

  const addDimension = useCallback(
    (lineKey: string) => {
      setLines((current) =>
        current.map((line) =>
          line.key === lineKey
            ? { ...line, dimensions: [...line.dimensions, emptyDimensionDraft(ids.next())] }
            : line,
        ),
      );
    },
    [ids],
  );

  const removeDimension = useCallback((lineKey: string, dimensionKey: string) => {
    setLines((current) =>
      current.map((line) =>
        line.key === lineKey
          ? { ...line, dimensions: line.dimensions.filter((d) => d.key !== dimensionKey) }
          : line,
      ),
    );
  }, []);

  const setDimensionField = useCallback(
    (lineKey: string, dimensionKey: string, field: DimensionField, value: string) => {
      setLines((current) =>
        current.map((line) =>
          line.key === lineKey
            ? {
                ...line,
                dimensions: line.dimensions.map((d) =>
                  d.key === dimensionKey ? { ...d, [field]: value } : d,
                ),
              }
            : line,
        ),
      );
    },
    [],
  );

  const setMeasuring = useCallback(
    (lineKey: string, measured: boolean) => {
      setLines((current) =>
        current.map((line) =>
          line.key === lineKey ? withMeasuring(line, measured, ids.next()) : line,
        ),
      );
    },
    [ids],
  );

  const replaceAll = useCallback((next: readonly BillLineDraft[]) => setLines(next), []);

  return useMemo(
    () => ({
      lines,
      totals,
      lineTotals,
      isEmpty: lines.length === 0,
      addProduct,
      removeLine,
      setLineField,
      addDimension,
      removeDimension,
      setDimensionField,
      setMeasuring,
      replaceAll,
    }),
    [
      lines,
      totals,
      lineTotals,
      addProduct,
      removeLine,
      setLineField,
      addDimension,
      removeDimension,
      setDimensionField,
      setMeasuring,
      replaceAll,
    ],
  );
}
