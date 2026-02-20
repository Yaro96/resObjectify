type Row = Record<PropertyKey, unknown>;

type KeyName<T extends Row> = Extract<keyof T, string>;

type KeyField<T extends Row> = KeyName<T> | {
  key: KeyName<T>;
  as?: string;
  json?: boolean;
}

type GroupField = string | {
  name: string;
  object?: boolean;
}

type Field<T extends Row> = KeyField<T> | [GroupField, Fields<T>];

export type Fields<T extends Row = Row> = [KeyField<T>, ...Field<T>[]];

type Result<T = unknown> = T[] | Record<PropertyKey, T>;


export function objectify<T = unknown>(
  data: Row[],
  fields: Fields,
  object: true,
): Record<PropertyKey, T>;
export function objectify<T = unknown>(
  data: Row[],
  fields: Fields,
  object?: false,
): T[];
export function objectify<T = unknown>(
  data: Row[],
  fields: Fields,
  object = false,
): Result<T> {
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
    return result as Record<PropertyKey, T>;
  }
  return result as T[];
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
  return typeof field === "string" ? field : field.key;
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
