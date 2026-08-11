import type { BookNavigationTarget } from '../books';

type ReadingLocation = {
  bookId: string;
  target: BookNavigationTarget;
};

export class ReadingLocationStack {
  private readonly locations: ReadingLocation[] = [];

  constructor(private readonly maxDepth = 50) {}

  push(location: ReadingLocation): void {
    this.locations.push(location);
    if (this.locations.length > this.maxDepth) {
      this.locations.splice(0, this.locations.length - this.maxDepth);
    }
  }

  pop(bookId: string): BookNavigationTarget | undefined {
    const location = this.locations[this.locations.length - 1];
    if (!location || location.bookId !== bookId) {
      return undefined;
    }
    this.locations.pop();
    return location.target;
  }

  get size(): number {
    return this.locations.length;
  }

  clear(): void {
    this.locations.length = 0;
  }
}
