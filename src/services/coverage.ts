import { unitFor } from '../core';
import { Product } from '../models/product';

const SQFT_SCALE = unitFor('sqft').scale;

/**
 * "How many boxes for a 120 square foot room?" — the question every tile
 * customer asks. Always rounds up: you cannot buy part of a box.
 */
export function boxesForArea(areaSqIn: number, boxCoverageSqIn: number): number | null {
  if (boxCoverageSqIn <= 0 || areaSqIn <= 0) return null;
  return Math.ceil(areaSqIn / boxCoverageSqIn);
}

export function coverageOf(product: Product, boxes: number): number | null {
  return product.boxCoverageSqIn === null ? null : product.boxCoverageSqIn * boxes;
}

/** Square feet, for display only. */
export const sqInToSqFt = (sqIn: number): number => sqIn / SQFT_SCALE;
