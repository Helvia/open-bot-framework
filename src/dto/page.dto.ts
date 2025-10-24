export class PaginatedTransform<S, T> {
    constructor(countResult: [S[], number], page: number, pageSize: number, transformer: (domain: S) => T) {
        this.items = countResult[0].map(transformer);
        this.page = page;
        this.pageSize = pageSize;
        this.total = countResult[1];
    }
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

export class Paginated<T> {
    constructor(countResult: [T[], number], page: number, pageSize: number) {
        this.items = countResult[0];
        this.page = page;
        this.pageSize = pageSize;
        this.total = countResult[1];
    }
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}
