import type { DefaultString, GroupFieldOptions, KeyName, Row } from "./types";

/**
 * Runtime-friendly group field variant used by implementation internals.
 */
export type RuntimeGroupField = DefaultString | ({ name: DefaultString } & GroupFieldOptions);

/**
 * Lightweight runtime variant of a single key field.
 *
 * Internal-only: avoids propagating recursive `LeafKeys` inference into
 * implementation signatures that do not need editor-facing autocomplete.
 */
export type RuntimeSingleField<T = Row> = {
  key: KeyName<T>;
  as?: DefaultString;
  json?: boolean;
  hide?: boolean;
};

/**
 * Lightweight runtime variant of a combined key field.
 */
export type RuntimeCombinedField<T = Row> = {
  keys: KeyName<T>[];
  as: DefaultString;
  separator?: string;
  hide?: boolean;
};

/**
 * Lightweight runtime key field (string shorthand or object forms).
 */
export type RuntimeKeyField<T = Row> = KeyName<T> | RuntimeSingleField<T> | RuntimeCombinedField<T>;

/**
 * Lightweight runtime field tree used by implementation internals.
 */
export type RuntimeField<T = Row> = RuntimeKeyField<T> | [RuntimeGroupField, RuntimeField<T>[]];
