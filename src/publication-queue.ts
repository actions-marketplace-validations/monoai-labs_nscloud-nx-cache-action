const DEFAULT_PUBLICATION_CONCURRENCY = 10;

/** A job's hold on one unit of publication concurrency. */
export interface PublicationSlot {
  /** Runs `work` without holding the slot, then waits for a slot again. */
  idle<T>(work: () => Promise<T>): Promise<T>;
}

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

  async add(hash: string, publish: (slot: PublicationSlot) => Promise<void>): Promise<void> {
    if (this.jobs.has(hash)) {
      return;
    }

    await this.acquire();

    // A concurrent request may have admitted the same hash while this request waited.
    if (this.jobs.has(hash)) {
      this.release();
      return;
    }

    const slot: PublicationSlot = {
      idle: async (work) => {
        this.release();
        try {
          return await work();
        } finally {
          await this.acquire();
        }
      },
    };
    const job = Promise.resolve()
      .then(() => publish(slot))
      .catch(() => {
        this.failed = true;
      })
      .finally(() => {
        this.jobs.delete(hash);
        this.release();
      });
    this.jobs.set(hash, job);
  }

  private acquire(): Promise<void> {
    if (this.active < this.concurrency) {
      this.active++;

      return Promise.resolve();
    }

    return new Promise<void>((resolve) => this.waiting.push(resolve));
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
