import { type Dispatch, type SetStateAction, useCallback, useMemo } from 'react';
import { Product } from '../models/product';
import { BillLineField, DimensionField } from '../services/bill';
import { LineEntry } from './useLineEntry';

interface LineErrors {
  readonly lines: Readonly<Record<string, string>>;
  readonly form?: string;
}

export type LineCommands = Pick<
  LineEntry,
  | 'addProduct'
  | 'removeLine'
  | 'setLineField'
  | 'addDimension'
  | 'removeDimension'
  | 'setDimensionField'
  | 'setMeasuring'
>;

/**
 * A document's line-editing commands, each of which also clears the error it
 * has just made out of date.
 *
 * Errors are set when Save is pressed. Until this, nothing cleared them but a
 * successful save, so "Enter a quantity." stayed under a line that plainly had
 * one and a total beside it — which reads as a second, unexplained problem and
 * is exactly what a shopkeeper with a customer waiting cannot work out.
 *
 * `alsoClear` names errors that depend on the whole document rather than one
 * field — an overpayment is measured against the total, so any change to the
 * lines makes it stale. Pass a constant, so the commands stay stable.
 */
export function useLineCommands<E extends LineErrors>(
  entry: LineEntry,
  setErrors: Dispatch<SetStateAction<E>>,
  alsoClear: readonly (keyof E)[] = [],
): LineCommands {
  const { addProduct, removeLine, setLineField, addDimension, removeDimension, setDimensionField, setMeasuring } =
    entry;

  const clear = useCallback(
    (lineKey?: string) => {
      setErrors((current) => {
        let next = current;
        if (lineKey !== undefined && current.lines[lineKey] !== undefined) {
          const lines = Object.fromEntries(
            Object.entries(current.lines).filter(([key]) => key !== lineKey),
          );
          next = { ...next, lines };
        }
        if (next.form !== undefined) next = { ...next, form: undefined };
        for (const field of alsoClear) {
          if (next[field] !== undefined) next = { ...next, [field]: undefined };
        }
        return next;
      });
    },
    [setErrors, alsoClear],
  );

  return useMemo(
    () => ({
      addProduct: (product: Product) => {
        addProduct(product);
        clear();
      },
      removeLine: (key: string) => {
        removeLine(key);
        clear(key);
      },
      setLineField: (key: string, field: BillLineField, value: string) => {
        setLineField(key, field, value);
        clear(key);
      },
      addDimension: (lineKey: string) => {
        addDimension(lineKey);
        clear(lineKey);
      },
      removeDimension: (lineKey: string, dimensionKey: string) => {
        removeDimension(lineKey, dimensionKey);
        clear(lineKey);
      },
      setDimensionField: (
        lineKey: string,
        dimensionKey: string,
        field: DimensionField,
        value: string,
      ) => {
        setDimensionField(lineKey, dimensionKey, field, value);
        clear(lineKey);
      },
      setMeasuring: (lineKey: string, measured: boolean) => {
        setMeasuring(lineKey, measured);
        clear(lineKey);
      },
    }),
    [addProduct, removeLine, setLineField, addDimension, removeDimension, setDimensionField, setMeasuring, clear],
  );
}
