import { emptyProductDraft } from '../product';
import { ProductCatalogue } from '../product-catalogue';
import { previewProductImport } from '../product-import';
import {
  fixedClock,
  InMemoryProductRepository,
  InMemoryStockMovementRepository,
  SequentialIdGenerator,
} from '../../testing/fakes';

const NOW = 1_700_000_000_000;

function build() {
  const products = new InMemoryProductRepository();
  const stock = new InMemoryStockMovementRepository();
  const catalogue = new ProductCatalogue(
    products,
    stock,
    new SequentialIdGenerator('p'),
    fixedClock(NOW),
    'shop-1',
  );
  return { products, stock, catalogue };
}

const draft = (over = {}) => ({
  ...emptyProductDraft(),
  name: 'Vitrified tile 2x2',
  salePrice: '450',
  ...over,
});

describe('ProductCatalogue', () => {
  it('saves a new product with the shop id and a fresh id', async () => {
    const { catalogue, products } = build();
    const result = await catalogue.save(draft(), null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.shopId).toBe('shop-1');
    expect(result.value.updatedAt).toBe(NOW);
    expect(await products.list()).toHaveLength(1);
  });

  it('keeps the id when editing, so history still points at it', async () => {
    const { catalogue, products } = build();
    const created = await catalogue.save(draft(), null);
    if (!created.ok) throw new Error('setup failed');

    const edited = await catalogue.save(draft({ salePrice: '475' }), created.value);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.value.id).toBe(created.value.id);
    expect(edited.value.salePrice.paise).toBe(47500);
    expect(await products.list()).toHaveLength(1);
  });

  it('writes nothing when the draft is invalid', async () => {
    const { catalogue, products } = build();
    const result = await catalogue.save(draft({ salePrice: '' }), null);

    expect(result.ok).toBe(false);
    expect(await products.list()).toHaveLength(0);
  });

  it('records stock as a movement rather than a total', async () => {
    const { catalogue, stock } = build();
    const created = await catalogue.save(draft(), null);
    if (!created.ok) throw new Error('setup failed');

    await catalogue.recordStock(created.value, 40, 'opening');
    await catalogue.recordStock(created.value, -12, 'sale');
    await catalogue.recordStock(created.value, 25, 'purchase');

    expect(await stock.stockFor(created.value.id)).toBe(53);
    expect(stock.movements).toHaveLength(3);
  });

  it('imports the valid rows and their opening stock, skipping the rest', async () => {
    const { catalogue, products, stock } = build();
    const preview = previewProductImport(
      [
        'Name,Unit,Rate,Opening stock',
        'Vitrified tile 2x2,box,450,40',
        ',box,450,10',
        'Wall putty 40kg,bag,620,25',
      ].join('\n'),
    );

    const imported = await catalogue.importRows(preview.rows);

    expect(imported).toBe(2);
    const saved = await products.list();
    expect(saved.map((p) => p.name)).toEqual(['Vitrified tile 2x2', 'Wall putty 40kg']);
    expect(await stock.stockFor(saved[0].id)).toBe(40);
    expect(await stock.stockFor(saved[1].id)).toBe(25);
  });
});
