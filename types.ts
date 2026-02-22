export type Row = Record<PropertyKey, unknown>;

export type KeyName<T = Row> = Extract<keyof T, string>;


type IndexValue<T> = string extends keyof T
  ? T[string]
  : number extends keyof T
    ? T[number]
    : symbol extends keyof T
      ? T[symbol]
      : never;

type Prev = [never, 0, 1, 2, 3, 4, 5];

export type NestedKeys<T, D extends number = 5> = D extends 0
  ? never
  : T extends readonly (infer U)[]
    ? NestedKeys<U, Prev[D]>
    : T extends object
      ? string extends keyof T
        ? NestedKeys<IndexValue<T>, Prev[D]>
        : {
            [K in Extract<keyof T, string>]-?: K | NestedKeys<T[K], Prev[D]> | (string & {})
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
