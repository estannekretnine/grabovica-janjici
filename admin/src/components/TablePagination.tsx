/** Uobičajene vrednosti za broj redova po strani. */
export const TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

type TablePaginationProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Za jedinstvene `id` na stranici sa više paginatora. */
  idPrefix?: string;
};

export function TablePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  idPrefix = "pg",
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, totalItems);

  return (
    <div className="table-pagination" role="navigation" aria-label="Paginacija tabele">
      <div className="table-pagination-info muted">
        {totalItems === 0 ? (
          "Nema stavki"
        ) : (
          <>
            Prikaz <strong>{from}</strong>–<strong>{to}</strong> od <strong>{totalItems}</strong>
          </>
        )}
      </div>
      <label className="table-pagination-size">
        <span className="muted">Po strani:</span>
        <select
          id={`${idPrefix}-page-size`}
          value={pageSize}
          onChange={(e) => {
            const n = Number(e.target.value);
            onPageSizeChange(Number.isFinite(n) ? n : 25);
            onPageChange(1);
          }}
        >
          {TABLE_PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <div className="table-pagination-nav">
        <button type="button" disabled={safePage <= 1} onClick={() => onPageChange(1)} aria-label="Prva strana">
          ««
        </button>
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Prethodna strana"
        >
          «
        </button>
        <span className="muted table-pagination-page">
          Strana {safePage} / {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Sledeća strana"
        >
          »
        </button>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label="Poslednja strana"
        >
          »»
        </button>
      </div>
    </div>
  );
}
