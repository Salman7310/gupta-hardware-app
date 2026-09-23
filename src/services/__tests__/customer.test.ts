import { CustomerBook, emptyCustomerDraft, validateCustomerDraft } from '../customer';
import { fixedClock, InMemoryCustomerRepository, SequentialIdGenerator } from '../../testing/fakes';

const NOW = 1_700_000_000_000;

const draft = (over = {}) => ({ ...emptyCustomerDraft(), name: 'Sharma Builders', ...over });

function build() {
  const customers = new InMemoryCustomerRepository();
  const book = new CustomerBook(
    customers,
    new SequentialIdGenerator('c'),
    fixedClock(NOW),
    'shop-1',
  );
  return { customers, book };
}

describe('the customer book', () => {
  it('needs a name and nothing else', () => {
    const result = validateCustomerDraft(draft());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Sharma Builders');
    expect(result.value.phone).toBeNull();
    expect(result.value.gstin).toBeNull();
  });

  it('refuses a customer with no name', () => {
    const result = validateCustomerDraft(draft({ name: '   ' }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.name).toMatch(/name/i);
  });

  it('keeps a phone number but forgives how it was typed', () => {
    const result = validateCustomerDraft(draft({ phone: '98765 43210' }));

    expect(result.ok && result.value.phone).toBe('9876543210');
  });

  it('refuses a phone number that is not a number', () => {
    const result = validateCustomerDraft(draft({ phone: 'call the office' }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.phone).toMatch(/digits/i);
  });

  it('upper-cases a GSTIN and checks its length', () => {
    const good = validateCustomerDraft(draft({ gstin: '09abcde1234f1z5' }));
    expect(good.ok && good.value.gstin).toBe('09ABCDE1234F1Z5');

    const bad = validateCustomerDraft(draft({ gstin: '09ABCDE' }));
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    // A wrong GSTIN on a bill is the customer's tax credit lost.
    expect(bad.error.gstin).toMatch(/15/);
  });

  it('writes a customer the shop can find again', async () => {
    const { book } = build();

    const saved = await book.save(draft({ phone: '9876543210' }));
    expect(saved.ok).toBe(true);

    const found = await book.search('sharma');
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe('Sharma Builders');
    expect(found[0].updatedAt).toBe(NOW);
  });

  it('lists everyone when nothing has been typed to search on', async () => {
    const { book } = build();
    await book.save(draft({ name: 'Sharma Builders' }));
    await book.save(draft({ name: 'Verma Interiors' }));

    expect(await book.search('   ')).toHaveLength(2);
  });

  it('edits in place rather than making a second customer', async () => {
    const { book, customers } = build();
    const first = await book.save(draft());
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const edited = await book.save(draft({ phone: '9999999999' }), first.value);

    expect(edited.ok && edited.value.id).toBe(first.value.id);
    expect(await customers.list()).toHaveLength(1);
  });
});
