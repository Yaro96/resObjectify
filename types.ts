/**
 * Generic object-like row shape used across the library.
 */
export type Row = Record<PropertyKey, unknown>;

/**
 * String-only key names for a given row type.
 */
export type KeyName<T = Row> = Extract<keyof T, string>;

/**
 * Fallback string type used when strict key extraction resolves to `never`.
 */
export type DefaultString = string & {};

/**
 * Extracts the element type from readonly arrays/tuples.
 */
type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;
type StringKey<K> = Extract<K, string>;

/**
 * Values treated as terminal leaves during key-path discovery.
 */
type Primitives = string | number | boolean | null | undefined | Date;
type Array = readonly unknown[];
type Object = Record<PropertyKey, unknown>;
type ChildPart<T> = Extract<T, Array | Object>;

/**
 * Detects whether a type has a broad index signature.
 */
type HasIndexSignature<T> = string extends keyof T
  ? true
  : number extends keyof T
    ? true
    : symbol extends keyof T
      ? true
      : false;

/**
 * Recursively collects keys whose values end at primitive leaves.
 */
type LeafKeysImpl<T> = [T] extends [Primitives]
  ? never
  : [T] extends [Array]
    ? LeafKeysImpl<ArrayElement<T>>
    : [T] extends [Object]
      ? {
          [K in keyof T]-?: T[K] extends Primitives ? StringKey<K> : LeafKeysImpl<ChildPart<T[K]>>;
        }[keyof T]
      : never;

/**
 * Recursively collects keys that point to nested object/array branches.
 */
type BranchKeysImpl<T> = [T] extends [Primitives]
  ? never
  : [T] extends [Array]
    ? BranchKeysImpl<ArrayElement<T>>
    : [T] extends [Object]
      ? HasIndexSignature<T> extends true
        ? BranchKeysImpl<ChildPart<T[keyof T]>>
        : {
            [K in keyof T]-?: T[K] extends Primitives
              ? never
              : StringKey<K> | BranchKeysImpl<ChildPart<T[K]>>;
          }[keyof T]
      : never;

/**
 * Leaf property names for the result type, with a string fallback.
 */
export type LeafKeys<T> = [LeafKeysImpl<T>] extends [never] ? DefaultString : LeafKeysImpl<T>;

/**
 * Branch property names for nested groups, with a string fallback.
 */
export type BranchKeys<T> = [BranchKeysImpl<T>] extends [never] ? DefaultString : BranchKeysImpl<T>;

/**
 * Expands inferred/intersection types into a cleaner object shape.
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * Return type for `objectify`: either an array or keyed object map.
 */
export type Result<T = unknown> = T[] | Record<PropertyKey, T>;

export type SingleField<R = Row, T = Row> = {
  key: KeyName<T>;
  as?: LeafKeys<R>;
  json?: boolean;
  hide?: boolean;
};

export type CombinedField<R = Row, T = Row> = {
  keys: KeyName<T>[];
  as: LeafKeys<R>;
  separator?: string;
  hide?: boolean;
};

/**
 * Selects a source key from a row and optional output behavior.
 */
export type KeyField<R = Row, T = Row> = KeyName<T> | SingleField<R, T> | CombinedField<R, T>;

export type SimpleKeyField =
  | { key: DefaultString; as?: DefaultString; json?: boolean; hide?: boolean }
  | { keys: DefaultString[]; as: DefaultString; separator?: string; hide?: boolean };

/**
 * Describes a nested group in the output object.
 */
export type GroupField<R = Row> =
  | BranchKeys<R>
  | {
      name: BranchKeys<R>;
      object?: boolean;
    };

/**
 * Runtime-friendly group field variant used by builder internals.
 */
export type SimpleGroupField =
  | DefaultString
  | {
      name: DefaultString;
      object?: boolean;
    };

/**
 * Single field definition: direct key field or nested group tuple.
 */
export type Field<R = Row, T = Row> = KeyField<R, T> | [GroupField<R>, Field<R, T>[]];

/**
 * Extra options when defining a key field.
 */
export type KeyFieldOptions = {
  json?: boolean;
  hide?: boolean;
};

/**
 * Extra options when defining a combined key field.
 */
export type CombinedFieldOptions = {
  separator?: string;
  hide?: boolean;
};

/**
 * Extra options when defining a group field.
 */
export type GroupFieldOptions = {
  object?: boolean;
};

export type ObjectifyOptions = {
  object?: boolean;
  allowNulls?: boolean;
};

/**
 * Fluent API used to compose field definitions.
 */
export type FieldsBuilder<R = Row, T = Row> = {
  /**
   * Adds a key field to the current field set.
   */
  field: {
    (field: KeyField<R, T>): FieldsBuilder<R, T>;
    (field: KeyName<T>, as?: LeafKeys<R>, options?: KeyFieldOptions): FieldsBuilder<R, T>;
    (key: KeyName<T>, options?: KeyFieldOptions): FieldsBuilder<R, T>;
  };
  /**
   * Adds a combined key field (`keys`) to the current field set.
   */
  combinedField: (
    keys: KeyName<T>[],
    as: LeafKeys<R>,
    options?: CombinedFieldOptions,
  ) => FieldsBuilder<R, T>;
  /**
   * Adds a nested group with its own child field builder.
   */
  group: {
    (
      name: GroupField<R> | SimpleGroupField,
      fields: (builder: FieldsBuilder<R, T>) => FieldsBuilder<R, T>,
    ): FieldsBuilder<R, T>;
    (
      name: GroupField<R> | SimpleGroupField,
      options: GroupFieldOptions,
      fields: (builder: FieldsBuilder<R, T>) => FieldsBuilder<R, T>,
    ): FieldsBuilder<R, T>;
  };
  /**
   * Finalizes and returns the accumulated field definition tuple.
   */
  build(): Field<R, T>[];
};
