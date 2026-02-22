export type Row = Record<PropertyKey, unknown>;

export type KeyName<T = Row> = Extract<keyof T, string>;

export type NestedKeys<T> = T extends readonly (infer U)[]
  ? NestedKeys<U>
  : T extends object
    ? {
        [K in Extract<keyof T, string>]-?: K | NestedKeys<T[K]> | (string & {})
      }[Extract<keyof T, string>]
    : never;

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type Result<T = unknown> = T[] | Record<PropertyKey, T>;

export type KeyField<R = Row, T = Row> = KeyName<T> | {
  key: KeyName<T>;
  as?: NestedKeys<R>;
  json?: boolean;
};

export type GroupField<R = Row> = NestedKeys<R> | {
  name: NestedKeys<R>;
  object?: boolean;
};

export type Field<R = Row, T = Row> = KeyField<R, T> | [GroupField<R>, Fields<R, T>];

export type Fields<R = Row, T = Row> = [KeyField<R, T>, ...Field<R, T>[]];
