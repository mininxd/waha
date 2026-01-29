import { SqlKVRepository } from '@waha/core/storage/sql/SqlKVRepository';
import { Sqlite3JsonQuery } from '@waha/core/storage/sqlite3/Sqlite3JsonQuery';
import { sleep } from '@waha/utils/promiseTimeout';
import Knex from 'knex';

/**
 * Key value repository with extra metadata
 */
export class Sqlite3KVRepository<Entity> extends SqlKVRepository<Entity> {
  protected knex: Knex.Knex;
  protected jsonQuery = new Sqlite3JsonQuery();

  constructor(knex: Knex.Knex) {
    super(knex);
  }

  protected async upsertBatch(entities: Entity[]): Promise<void> {
    await super.upsertBatch(entities);
    // Give some time to the Node.js loop because we're using sync better-sqlite
    if (entities.length >= this.UPSERT_BATCH_SIZE) {
      await sleep(1);
    }
  }
}
