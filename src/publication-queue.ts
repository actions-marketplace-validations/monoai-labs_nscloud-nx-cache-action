const DEFAULT_PUBLICATION_CONCURRENCY = 10;

/** Bounds admitted work and waits for shared durability separately from local acceptance. */
export class PublicationQueue {
  private readonly jobs = new Map<string, Promise<void>>();
  private readonly waiting: (() => void)[] = [];
  private active = 0;
  private failed = false;
  private readonly concurrency: number;

  constructor(concurrency = DEFAULT_PUBLICATION_CONCURRENCY) {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new Error('Invalid publication concurrency');
    }

    this.concurrency = concurrency;
  }

  async add(hash: string, publish: () => Promise<void>): Promise<void> {
    if (this.jobs.has(hash)) {
      return;
    }

    if (this.active >= this.concurrency) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      this.active++;
    }

    // A concurrent request may have admitted the same hash while this request waited.
    if (this.jobs.has(hash)) {
      this.release();
      return;
    }

    const job = Promise.resolve()
      .then(publish)
      .catch(() => {
        this.failed = true;
      })
      .finally(() => {
        this.jobs.delete(hash);
        this.release();
      });
    this.jobs.set(hash, job);
  }

  private release() {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.active--;
    }
  }

  async drain(): Promise<void> {
    while (this.jobs.size || this.waiting.length) {
      await Promise.all(this.jobs.values());
    }

    if (this.failed) {
      throw new Error('Cache publication failed');
    }
  }
}
