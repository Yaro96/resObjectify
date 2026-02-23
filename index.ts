import type {
  SimpleGroupField,
  Fields,
  KeyField,
  KeyName,
  Prettify,
  Result,
  Row,
} from "./types";

export type { Fields } from "./types";

export function objectify<R = unknown, T = Row>(
  data: T[],
  fields: Fields<R, T>,
  object: true,
): Record<PropertyKey, Prettify<R>>;
export function objectify<R = unknown, T = Row>(
  data: T[],
  fields: Fields<R, T>,
  object?: false,
): Prettify<R>[];
export function objectify<R = unknown>(
  data: Row[],
  fields: Fields<R>,
  object: true,
): Record<PropertyKey, Prettify<R>>;
export function objectify<R = unknown>(
  data: Row[],
  fields: Fields<R>,
  object?: false,
): Prettify<R>[];
export function objectify<R = unknown>(
  data: Row[],
  fields: Fields<R>,
  object = false,
): Result<Prettify<R>> {
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
    const obj: Record<PropertyKey, unknown> = {};

    for (const field of fields) {
      // If the field is not an array, it is a key field, so we can get the value from the row
      if (!Array.isArray(field)) {
        const fieldName = getFieldName(field);
        obj[fieldName] = getFieldValue(row, field);
      } else { // If the field is an array, it is a group field, so we need to objectify the nested fields recursively
        const [rawGroupField, nestedFields] = field;
        const groupField = rawGroupField as SimpleGroupField;
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
    return result as Record<PropertyKey, Prettify<R>>;
  }
  return result as Prettify<R>[];
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

function getKeyField<R, T extends Row>(field: KeyField<R, T>): KeyName<T> {
  return (typeof field === "string" ? field : field.key) as KeyName<T>;
}

function getFieldName<R, T extends Row>(field: KeyField<R, T>): PropertyKey {
  return (typeof field === "string" ? field : (field.as ?? field.key)) as PropertyKey;
}

function getFieldValue<R, T extends Row>(row: T, field: KeyField<R, T>): unknown {
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

function getGroupName(field: SimpleGroupField): PropertyKey {
  if (typeof field === "string" || typeof field === "number" || typeof field === "symbol") {
    return field;
  }
  return field.name;
}

function isObject(field: SimpleGroupField, defaultValue: boolean) {
  if (typeof field !== "object" || field == null) {
    return defaultValue;
  }
  return field.object ?? defaultValue;
}
