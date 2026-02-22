type Row = Record<PropertyKey, unknown>;

type KeyName<T = Row> = Extract<keyof T, string>;

type ExtractKeys<T> = T extends readonly (infer U)[]
  ? ExtractKeys<U>
  : T extends object
  ? {
    [K in keyof T & string]:
    | K
    | (T[K] extends object ? `${K}.${ExtractKeys<T[K]>}` : K)
  }[keyof T & string]
  : never;

type KeyField<R = Row, T = Row> = KeyName<T> | {
  key: KeyName<T>;
  as?: ExtractKeys<R>;
  json?: boolean;
}

type GroupField<R = Row> = ExtractKeys<R> | {
  name: ExtractKeys<R>;
  object?: boolean;
}

type Field<R = Row, T = Row> = KeyField<R, T> | [GroupField<R>, Fields<R, T>];

export type Fields<R = Row, T = Row> = [KeyField<R, T>, ...Field<R, T>[]]

type Result<T = unknown> = T[] | Record<PropertyKey, T>;


export function objectify<R = unknown, T extends Row = Row>(
  data: T[],
  fields: Fields<R, T>,
  object: true,
): Record<PropertyKey, R>;
export function objectify<R = unknown, T extends Row = Row>(
  data: T[],
  fields: Fields<R, T>,
  object?: false,
): R[];
export function objectify<R = unknown>(
  data: Row[],
  fields: Fields<R>,
  object: true,
): Record<PropertyKey, R>;
export function objectify<R = unknown>(
  data: Row[],
  fields: Fields<R>,
  object?: false,
): R[];
export function objectify<R = unknown>(
  data: Row[],
  fields: Fields<R>,
  object = false,
): Result<R> {
  // If the fields is a single field or object is false, group the result in an array, otherwise group the result in an object
  const result: unknown[] | Record<PropertyKey, unknown> =
    fields.length === 1 || !object ? [] : {};

  const [keyField, ...restFields] = fields;
  const key = getKeyField(keyField);
  const name = getFieldName(keyField);
  // Pre-group by the current key so each recursion only sees its parent slice,
  // which removes the need for parent checks or duplicate tracking.
  const groups = groupByKey(data, key);

  for (const [keyValue, rows] of groups) {
    const row = rows[0];
    const obj: Record<string, unknown> = {};

    for (const field of fields) {
      // If the field is not an array, it is a key field, so we can get the value from the row
      if (!Array.isArray(field)) {
        obj[getFieldName(field)] = getFieldValue(row, field);
      } else { // If the field is an array, it is a group field, so we need to objectify the nested fields recursively
        const [groupField, nestedFields] = field;
        const nestedObject = isObject(groupField, object);
        obj[getGroupName(groupField)] = nestedObject
          ? objectify(rows, nestedFields, true)
          : objectify(rows, nestedFields, false);
      }
    }

    if (obj[name] != null) {
      // If the result is an array, we need to push the object to the array
      if (Array.isArray(result)) {
        result.push(restFields.length ? obj : obj[name]);
      } else { // If the result is an object, we need to set the object to the key
        result[keyValue as PropertyKey] = obj;
      }
    }
  }

  if (object) {
    return result as Record<PropertyKey, R>;
  }
  return result as R[];
}

// Groups rows by the current key, preserving first-seen order.
function groupByKey<T extends Row>(
  rows: T[],
  key: KeyName<T>,
): Map<unknown, T[]> {
  const groups = new Map<unknown, T[]>();
  for (const row of rows) {
    const keyValue = row[key];
    const group = groups.get(keyValue);
    if (group) {
      group.push(row);
    } else {
      groups.set(keyValue, [row]);
    }
  }
  return groups;
}

function getKeyField<T extends Row>(field: KeyField<T>): KeyName<T> {
  return (typeof field === "string" ? field : field.key) as KeyName<T>;
}

function getFieldName<T extends Row>(field: KeyField<T>) {
  return typeof field === "string" ? field : (field.as ?? field.key);
}

function getFieldValue<T extends Row>(row: T, field: KeyField<T>): unknown {
  if (typeof field === "string") {
    return row[field];
  }
  const key = getKeyField(field);
  if (field.json) {
    try {
      return JSON.parse(row[key] as string);
    } catch (error) {
      console.error(`"${row[key]}" is not a valid JSON`, error);
      return null;
    }
  }
  return row[key];
}

function getGroupName(field: GroupField) {
  return typeof field === "string" ? field : field.name;
}

function isObject(field: GroupField, defaultValue: boolean) {
  return typeof field === "string"
    ? defaultValue
    : (field.object ?? defaultValue);
}
