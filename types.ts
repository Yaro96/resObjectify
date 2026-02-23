export type Row = Record<PropertyKey, unknown>;

export type KeyName<T = Row> = Extract<keyof T, string>;


export type DefaultString = string & {};

type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;
type StringKey<K> = Extract<K, string>;

type Primitives = string | number | boolean | null | undefined | Date;
type Array = readonly unknown[];
type Object = Record<PropertyKey, unknown>;
type ChildPart<T> = Extract<T, Array | Object>;
type HasIndexSignature<T> =
  string extends keyof T
    ? true
    : number extends keyof T
      ? true
      : symbol extends keyof T
        ? true
        : false;

export type LeafKeys<T> = [T] extends [Primitives]
  ? never
  : [T] extends [Array]
    ? LeafKeys<ArrayElement<T>>
    : [T] extends [Object]
      ? {
          [K in keyof T]-?: T[K] extends Primitives
            ? (StringKey<K> | DefaultReturn)
            : LeafKeys<ChildPart<T[K]>>;
        }[keyof T]
      : never;


export type BranchKeys<T> = [T] extends [Primitives]
  ? never
  : [T] extends [Array]
    ? BranchKeys<ArrayElement<T>>
    : [T] extends [Object]
      ? HasIndexSignature<T> extends true
        ? BranchKeys<ChildPart<T[keyof T]>>
        : {
            [K in keyof T]-?: T[K] extends Primitives
              ? never
              : StringKey<K> | BranchKeys<ChildPart<T[K]>> | DefaultReturn;
          }[keyof T]
      : never;


export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type Result<T = unknown> = T[] | Record<PropertyKey, T>;

export type KeyField<R = Row, T = Row> = KeyName<T> | {
  key: KeyName<T>;
  as?: LeafKeys<R>;
  json?: boolean;
};

export type GroupField<R = Row> = BranchKeys<R> | {
  name: BranchKeys<R>;
  object?: boolean;
};

export type SimpleGroupField = DefaultString | {
  name: DefaultString;
  object?: boolean;
};

export type Field<R = Row, T = Row> = KeyField<R, T> | [GroupField<R>, Fields<R, T>];

export type Fields<R = Row, T = Row> = [KeyField<R, T>, ...Field<R, T>[]];

export type KeyFieldOptions = {
  json?: boolean;
};

export type GroupFieldOptions = {
  object?: boolean;
};

export type FieldsBuilder<R = Row, T = Row> = {
  field: {
    (field: KeyField<R, T>): FieldsBuilder<R, T>;
    (key: KeyName<T>, as?: LeafKeys<R>, options?: KeyFieldOptions): FieldsBuilder<R, T>;
    (key: KeyName<T>, options?: KeyFieldOptions): FieldsBuilder<R, T>;
  };
  group: {
    (name: GroupField<R>, fields: (builder: FieldsBuilder<R, T>) => FieldsBuilder<R, T>): FieldsBuilder<R, T>;
    (name: GroupField<R>, options: GroupFieldOptions, fields: (builder: FieldsBuilder<R, T>) => FieldsBuilder<R, T>): FieldsBuilder<R, T>;
  };
  build(): Fields<R, T>;
};
