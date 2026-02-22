export type Row = Record<PropertyKey, unknown>;

export type KeyName<T = Row> = Extract<keyof T, string>;


type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;
type ObjectPart<T> = Extract<T, object>;
type ArrayPart<T> = Extract<ObjectPart<T>, readonly unknown[]>;
type NonArrayObjectPart<T> = Exclude<ObjectPart<T>, readonly unknown[]>;

type HasIndexSignature<T> =
  string extends keyof T ? true :
  number extends keyof T ? true :
  symbol extends keyof T ? true :
  false;

export type LeafKeys<T> = [T] extends [readonly (infer U)[]]
  ? LeafKeys<U>
  : [T] extends [object]
  ? HasIndexSignature<T> extends true
    ? LeafKeys<T[keyof T]>
    : {
      [K in keyof T]-?: [ObjectPart<T[K]>] extends [never]
        ? K
        : LeafKeys<NonArrayObjectPart<T[K]>> | LeafKeys<ArrayElement<ArrayPart<T[K]>>>
    }[keyof T]
  : (string & {});

export type BranchKeys<T> = [T] extends [readonly (infer U)[]]
  ? BranchKeys<U>
  : [T] extends [object]
  ? HasIndexSignature<T> extends true
    ? BranchKeys<T[keyof T]>
    : {
      [K in keyof T]-?: [ObjectPart<T[K]>] extends [never]
        ? never
        : K | BranchKeys<NonArrayObjectPart<T[K]>> | BranchKeys<ArrayElement<ArrayPart<T[K]>>>
    }[keyof T]
  : (string & {});

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

export type Field<R = Row, T = Row> = KeyField<R, T> | [GroupField<R>, Fields<R, T>];

export type Fields<R = Row, T = Row> = [KeyField<R, T>, ...Field<R, T>[]];
