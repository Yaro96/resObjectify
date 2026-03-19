import type {
  CombinedField,
  Field,
  KeyField,
  KeyName,
  Prettify,
  Result,
  Row,
  SimpleGroupField,
  SimpleKeyField,
  SingleField,
} from "../types";

/**
 * Transforms flat rows into nested objects/arrays based on a field definition.
 *
 * When `object` is `true`, top-level output is keyed by the first field value.
 * Otherwise the output is an array.
 */
export function objectify<R = unknown, T = Row>(
  data: T[],
  fields: Field<R, T>[],
  object: true,
): Record<PropertyKey, Prettify<R>>;
export function objectify<R = unknown, T = Row>(
  data: T[],
  fields: Field<R, T>[],
  object?: false,
): Prettify<R>[];
export function objectify<R = unknown>(
  data: Row[],
  fields: Field<R>[],
  object: true,
): Record<PropertyKey, Prettify<R>>;
export function objectify<R = unknown>(
  data: Row[],
  fields: Field<R>[],
  object?: false,
): Prettify<R>[];
export function objectify<R = unknown>(
  data: Row[],
  fields: Field<R>[],
  object = false,
): Result<Prettify<R>> {
  if (!Array.isArray(fields) || fields.length === 0) {
    return (object ? {} : []) as Result<Prettify<R>>;
  }

  const [keyField, ...restFields] = fields;
  const key = getFieldKey(keyField);
  const name = getFieldName(keyField);
  const separator = getFieldSeparator(keyField);
  // Keep single root-key selections as arrays, but allow keyless group-only selections to be objects in object mode.
  const shouldUseObjectResult = object && (fields.length > 1 || name === undefined);
  const result: unknown[] | Record<PropertyKey, unknown> = shouldUseObjectResult ? {} : [];
  // Pre-group by the current key so each recursion only sees its parent slice,
  // which removes the need for parent checks or duplicate tracking.
  const groups = groupByKey(data, key, separator);

  for (const [keyValue, rows] of groups) {
    const row = rows[0];
    const obj: Record<PropertyKey, unknown> = {};

    for (const field of fields) {
      const fieldName = getFieldName(field);
      // If the field is an array, it is a group field, so we need to objectify the nested fields recursively
      if (Array.isArray(field)) {
        const [rawGroupField, nestedFields] = field;
        const groupField = rawGroupField as SimpleGroupField;
        const nestedObject = isObject(groupField, object);
        obj[getGroupName(groupField)] = nestedObject
          ? objectify(rows, nestedFields, true)
          : objectify(rows, nestedFields, false);

        // If the field is not an array, it is a key field, so we can get the value from the row
      } else if (fieldName !== undefined && fieldName !== null) {
        obj[fieldName] = getFieldValue(row, field);
      }
    }
    appendToResult(result, obj, name, keyValue as PropertyKey, restFields.length > 0);
  }

  if (!Array.isArray(result)) {
    return result as Record<PropertyKey, Prettify<R>>;
  }
  return result as Prettify<R>[];
}

function appendToResult(
  result: unknown[] | Record<PropertyKey, unknown>,
  obj: Record<PropertyKey, unknown>,
  keyName: PropertyKey | null | undefined,
  keyValue: PropertyKey,
  hasNestedFields: boolean,
): void {
  // Skip if key name is undefined (keyless grouping) or key value is null/undefined.
  const hasKeyValue = keyName === undefined || keyValue != null;
  if (!hasKeyValue) {
    return;
  }

  if (Array.isArray(result)) {
    // In array mode, single visible key selections emit key value; otherwise emit full objects.
    const shouldPushWholeObject = keyName === undefined || keyName === null || hasNestedFields;
    result.push(shouldPushWholeObject ? obj : obj[keyName]);
    return;
  }

  // In object mode without a root key, emit the aggregated object itself.
  if (keyName === undefined) {
    Object.assign(result, obj);
    return;
  }

  // In object mode with a root key, group output by the computed key value.
  result[keyValue] = obj;
}

/**
 * Groups rows by the provided key while preserving insertion order.
 */
function groupByKey<T extends Row>(
  rows: T[],
  key?: KeyName<T> | KeyName<T>[],
  separator?: string,
): Map<unknown, T[]> {
  const groups = new Map<unknown, T[]>();
  for (const row of rows) {
    const keyValue = getKeyValue(row, key, separator);
    const group = groups.get(keyValue);
    if (group) {
      group.push(row);
    } else {
      groups.set(keyValue, [row]);
    }
  }
  return groups;
}

function getKeyValue<T extends Row>(
  row: T,
  key?: KeyName<T> | KeyName<T>[],
  separator: string = "|",
): unknown {
  if (key === undefined || key === null) {
    return undefined;
  }
  if (Array.isArray(key)) {
    let combinedKey = "";
    for (const k of key) {
      const value = row[k];
      // Keep existing skip semantics for missing grouping values.
      if (value == null) {
        return undefined;
      }
      combinedKey += `${String(value)}${separator}`;
    }
    return combinedKey.slice(0, -separator.length);
  }
  return row[key];
}

/**
 * Resolves the source key from either shorthand or object field syntax.
 */
function getFieldKey<R, T extends Row>(field: Field<R, T>): KeyName<T> | KeyName<T>[] | undefined {
  if (Array.isArray(field)) {
    return undefined;
  }
  if (typeof field === "string") {
    return field;
  }
  if ("keys" in field) {
    return field.keys;
  }
  return field.key;
}

function getFieldSeparator<R, T extends Row>(field: Field<R, T>): string | undefined {
  if (Array.isArray(field) || typeof field === "string" || !("keys" in field)) {
    return undefined;
  }
  return field.separator;
}

/**
 * Resolves the output property name for a key field.
 */
function getFieldName<R, T extends Row>(field: Field<R, T>): PropertyKey | null | undefined {
  if (Array.isArray(field)) {
    return undefined;
  }
  if (typeof field === "string") {
    return field;
  }

  const simpleField = field as SimpleKeyField;
  if (simpleField.hide) {
    return null;
  }
  if ("keys" in simpleField) {
    return simpleField.as;
  }
  return simpleField.as ?? simpleField.key;
}

/**
 * Reads a row value and optionally parses it as JSON.
 */
function getFieldValue<R, T extends Row>(row: T, field: KeyField<R, T>): unknown {
  if (typeof field === "string") {
    return row[field];
  }
  const key = getFieldKey(field);

  if (key === undefined) {
    return undefined;
  }

  if (Array.isArray(key)) {
    //Combined field
    const values: string[] = [];
    for (const k of key) {
      values.push(String(row[k]));
    }
    return values.join((field as CombinedField<R, T>)?.separator ?? "|");
  }

  //Single field
  if (!Array.isArray(key)) {
    if ((field as SingleField<R, T>)?.json) {
      try {
        return JSON.parse(row[key] as string);
      } catch (error) {
        console.error(`"${row[key]}" is not a valid JSON`, error);
        return null;
      }
    }
    return row[key];
  }
}

/**
 * Resolves the output name for a group field definition.
 */
function getGroupName(field: SimpleGroupField): PropertyKey {
  if (typeof field === "string" || typeof field === "number" || typeof field === "symbol") {
    return field;
  }
  return field.name;
}

/**
 * Resolves whether a group should be emitted as object or array.
 */
function isObject(field: SimpleGroupField, defaultValue: boolean) {
  if (typeof field !== "object" || field == null) {
    return defaultValue;
  }
  return field.object ?? defaultValue;
}
