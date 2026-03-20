import type {
  CombinedField,
  Field,
  KeyField,
  KeyName,
  ObjectifyOptions,
  Prettify,
  Result,
  Row,
  SimpleGroupField,
  SingleField,
} from "../types";

const DEFAULT_OPTIONS: Required<ObjectifyOptions> = {
  object: false,
  allowNulls: false,
  flattenSingleField: true,
};

/**
 * Transforms flat rows into nested objects/arrays based on a field definition.
 *
 * When `object` is `true`, top-level output is keyed by the first field value.
 * Otherwise the output is an array.
 */
export function objectify<R = unknown, T extends Row = Row>(
  data: T[],
  fields: Field<R, T>[],
  options: { object: true; allowNulls?: boolean; flattenSingleField?: boolean },
): Record<PropertyKey, Prettify<R>>;
export function objectify<R = unknown, T extends Row = Row>(
  data: T[],
  fields: Field<R, T>[],
  options?: { object?: false; allowNulls?: boolean; flattenSingleField?: boolean },
): Prettify<R>[];
export function objectify<R = unknown>(
  data: Row[],
  fields: Field<R>[],
  options: { object: true; allowNulls?: boolean; flattenSingleField?: boolean },
): Record<PropertyKey, Prettify<R>>;
export function objectify<R = unknown>(
  data: Row[],
  fields: Field<R>[],
  options?: { object?: false; allowNulls?: boolean; flattenSingleField?: boolean },
): Prettify<R>[];
export function objectify<R = unknown, T extends Row = Row>(
  data: T[],
  fields: Field<R, T>[],
  options: ObjectifyOptions = DEFAULT_OPTIONS,
): Result<Prettify<R>> {
  const resolvedOptions: Required<ObjectifyOptions> = { ...DEFAULT_OPTIONS, ...options };
  const { object, allowNulls, flattenSingleField } = resolvedOptions;

  if (!Array.isArray(fields) || fields.length === 0) {
    return (object ? {} : []) as Result<Prettify<R>>;
  }

  const [keyField, ...restFields] = fields;
  const key = getFieldKey(keyField);
  const name = getFieldName(keyField);
  const isHiddenRootKey = isHiddenField(keyField);
  const separator = getFieldSeparator(keyField);
  // Keep single visible root-key selections as arrays, but hidden roots should still map in object mode.
  const shouldUseObjectResult =
    object && (isHiddenRootKey || !flattenSingleField || hasMultipleFields(fields));
  const result: unknown[] | Record<PropertyKey, unknown> = shouldUseObjectResult ? {} : [];
  // Pre-group by the current key so each recursion only sees its parent slice,
  // which removes the need for parent checks or duplicate tracking.
  const groups = groupByKey(data, key, separator, allowNulls);

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
          ? objectify(rows, nestedFields, { object: true, allowNulls, flattenSingleField })
          : objectify(rows, nestedFields, { object: false, allowNulls });

        // If the field is not an array, it is a key field, so we can get the value from the row
      } else if (fieldName !== undefined && !isHiddenField(field)) {
        obj[fieldName] = getFieldValue(row, field);
      }
    }
    appendToResult(result, obj, name, keyValue, restFields, resolvedOptions, isHiddenRootKey);
  }

  if (!Array.isArray(result)) {
    return result as Record<PropertyKey, Prettify<R>>;
  }
  return result as Prettify<R>[];
}

function appendToResult<R = unknown, T extends Row = Row>(
  result: unknown[] | Record<PropertyKey, unknown>,
  obj: Record<PropertyKey, unknown>,
  keyName: PropertyKey | undefined,
  keyValue: PropertyKey,
  restFields: Field<R, T>[],
  options: Required<ObjectifyOptions>,
  isHiddenRootKey: boolean,
): void {
  const { allowNulls } = options;
  // Keep keyless groups; otherwise treat null/undefined identically via allowNulls.
  const hasKeyValue = keyName === undefined || allowNulls || keyValue != null;
  if (!hasKeyValue) {
    return;
  }

  if (Array.isArray(result)) {
    appendToArrayResult(result, obj, keyName, restFields, isHiddenRootKey);
    return;
  }

  appendToObjectResult(result, obj, keyName, keyValue);
}

function appendToArrayResult<R = unknown, T extends Row = Row>(
  result: unknown[],
  obj: Record<PropertyKey, unknown>,
  keyName: PropertyKey | undefined,
  restFields: Field<R, T>[],
  isHiddenRootKey: boolean,
): void {
  const hasNestedFields = hasMultipleFields(restFields, 0);
  // In array mode, single visible key selections emit key value; otherwise emit full objects.
  const shouldPushWholeObject = keyName === undefined || isHiddenRootKey || hasNestedFields;
  result.push(shouldPushWholeObject ? obj : obj[keyName]);
}

function appendToObjectResult(
  result: Record<PropertyKey, unknown>,
  obj: Record<PropertyKey, unknown>,
  keyName: PropertyKey | null | undefined,
  keyValue: PropertyKey,
): void {
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
  allowNulls = false,
): Map<PropertyKey, T[]> {
  const groups = new Map<PropertyKey, T[]>();
  for (const row of rows) {
    const keyValue = getKeyValue(row, key, separator, allowNulls) as PropertyKey;
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
  allowNulls = false,
): unknown {
  if (key === undefined || key === null) {
    return undefined;
  }
  if (Array.isArray(key)) {
    let combinedKey = "";
    for (const k of key) {
      const value = row[k];
      // Treat null/undefined identically via allowNulls.
      if (!allowNulls && value == null) {
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
function getFieldName<R, T extends Row>(field: Field<R, T>): PropertyKey | undefined {
  if (Array.isArray(field)) {
    return undefined;
  }
  if (typeof field === "string") {
    return field;
  }

  const namedField = field as { as?: PropertyKey; key?: PropertyKey };
  return namedField.as ?? namedField.key;
}

function isHiddenField<R, T extends Row>(field: Field<R, T>): boolean {
  if (Array.isArray(field) || typeof field === "string") {
    return false;
  }
  return Boolean((field as { hide?: boolean }).hide);
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

function hasMultipleFields<R, T extends Row>(
  fields: Field<R, T>[],
  threshold: number = 1,
): boolean {
  let count = 0;
  for (const field of fields) {
    if (Array.isArray(field)) {
      return true;
    }
    if (typeof field === "string" || !field?.hide) {
      count++;
    }
  }
  return count > threshold;
}
