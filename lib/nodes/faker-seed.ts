/**
 * Deterministic `@faker-js/faker` factory for node simulations.
 *
 * Importing only `Faker` and the `en` locale keeps the client bundle lean (no 60-locale
 * dictionary payload) while seeding from the engine's injected `random()` makes every
 * unit test and workflow run 100% reproducible.
 */

import { Faker, en } from "@faker-js/faker";

export function createSeededFaker(random: () => number): Faker {
  const faker = new Faker({ locale: [en] });
  const seed = Math.max(1, Math.floor(random() * 1_000_000));
  faker.seed(seed);
  return faker;
}
