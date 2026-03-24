import type {
  Field,
  KeyName,
  ObjectifyOptions,
  Prettify,
  Result,
  Row,
  RuntimeField,
  RuntimeGroupField,
  RuntimeKeyField,
} from "../types";

const DEFAULT_OPTIONS: Required<ObjectifyOptions> = {
  object: false,
  allowNulls: false,
  flattenSingleField: true,
  separator: "-",
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
  options: { object: true; allowNulls?: boolean; flattenSingleField?: boolean; separator?: string },
): Record<PropertyKey, Prettify<R>>;
export function objectify<R = unknown, T extends Row = Row>(
  data: T[],
  fields: Field<R, T>[],
  options?: {
    object?: false;
    allowNulls?: boolean;
    flattenSingleField?: boolean;
    separator?: string;
  },
): Prettify<R>[];
export function objectify<R = unknown>(
  data: Row[],
  fields: Field<R>[],
  options: { object: true; allowNulls?: boolean; flattenSingleField?: boolean; separator?: string },
): Record<PropertyKey, Prettify<R>>;
export function objectify<R = unknown>(
  data: Row[],
  fields: Field<R>[],
  options?: {
    object?: false;
    allowNulls?: boolean;
    flattenSingleField?: boolean;
    separator?: string;
  },
): Prettify<R>[];
export function objectify<R = unknown, T extends Row = Row>(
  data: T[],
  fields: RuntimeField<T>[],
  options: ObjectifyOptions = DEFAULT_OPTIONS,
): Result<Prettify<R>> {
  return objectifyInternal<R, T>(data, fields, options);
}

/**
 * Internal runtime implementation that operates on simplified field types.
 */
function objectifyInternal<R = unknown, T extends Row = Row>(
  data: T[],
  fields: RuntimeField<T>[],
  options: ObjectifyOptions = DEFAULT_OPTIONS,
): Result<Prettify<R>> {
  const resolvedOptions = resolveOptions(options);
  const { object } = resolvedOptions;

  if (!Array.isArray(fields) || fields.length === 0) {
    return (object ? {} : []) as Result<Prettify<R>>;
  }

  const [rootField, ...restFields] = fields;
  const rootName = getFieldName(rootField);
  const rootIsHidden = isHiddenField(rootField);
  const result = createResultContainer(fields, rootIsHidden, resolvedOptions);
  const groups = groupRowsByKey(data, rootField, resolvedOptions);

  for (const [keyValue, rows] of groups) {
    const groupedObject = buildGroupedObject(rows, fields, resolvedOptions);
    appendToResult(
      result,
      groupedObject,
      rootName,
      keyValue,
      restFields,
      resolvedOptions,
      rootIsHidden,
    );
  }

  if (!Array.isArray(result)) {
    return result as Record<PropertyKey, Prettify<R>>;
  }
  return result as Prettify<R>[];
}

/**
 * Merges caller options with library defaults.
 */
function resolveOptions(options: ObjectifyOptions = DEFAULT_OPTIONS): Required<ObjectifyOptions> {
  return { ...DEFAULT_OPTIONS, ...options };
}

/**
 * Chooses array vs object output container for the current run.
 */
function createResultContainer<T extends Row>(
  fields: RuntimeField<T>[],
  rootIsHidden: boolean,
  options: Required<ObjectifyOptions>,
): unknown[] | Record<PropertyKey, unknown> {
  const { object, flattenSingleField } = options;
  const shouldUseObjectResult =
    object && (rootIsHidden || !flattenSingleField || hasMultipleFields(fields));
  return shouldUseObjectResult ? {} : [];
}

/**
 * Builds one grouped output object from a set of grouped rows.
 */
function buildGroupedObject<T extends Row = Row>(
  rows: T[],
  fields: RuntimeField<T>[],
  options: Required<ObjectifyOptions>,
): Record<PropertyKey, unknown> {
  const firstRow = rows[0];
  const groupedObject: Record<PropertyKey, unknown> = {};

  for (const field of fields) {
    if (Array.isArray(field)) {
      const [rawGroupField, nestedFields] = field;
      const groupField = rawGroupField as RuntimeGroupField;
      groupedObject[getGroupName(groupField)] = buildNestedGroupValue(
        rows,
        nestedFields,
        groupField,
        options,
      );
      continue;
    }

    if (isHiddenField(field)) {
      continue;
    }

    const fieldName = getFieldName(field);
    if (fieldName !== undefined) {
      groupedObject[fieldName] = getFieldValue(firstRow, field, options.separator);
    }
  }

  return groupedObject;
}

/**
 * Builds the value for a nested group field.
 */
function buildNestedGroupValue<R = unknown, T extends Row = Row>(
  rows: T[],
  nestedFields: RuntimeField<T>[],
  groupField: RuntimeGroupField,
  options: Required<ObjectifyOptions>,
): unknown {
  const groupOptions = getGroupOptions(groupField, options);
  // Keep `object` explicit so TypeScript resolves overloads correctly.
  if (groupOptions.object) {
    return objectifyInternal<R, T>(rows, nestedFields, { ...groupOptions, object: true });
  }

  return objectifyInternal<R, T>(rows, nestedFields, { ...groupOptions, object: false });
}

/**
 * Appends one grouped object to the final result container.
 */
function appendToResult<T extends Row = Row>(
  result: unknown[] | Record<PropertyKey, unknown>,
  groupedObject: Record<PropertyKey, unknown>,
  keyName: PropertyKey | undefined,
  keyValue: PropertyKey,
  restFields: RuntimeField<T>[],
  options: Required<ObjectifyOptions>,
  rootIsHidden: boolean,
): void {
  const { allowNulls } = options;
  if (!shouldIncludeGroup(keyName, keyValue, allowNulls)) {
    return;
  }

  //When output is an array, we push the grouped object to the result.
  if (Array.isArray(result)) {
    appendToArrayResult(result, groupedObject, keyName, restFields, rootIsHidden, options);
    return;
  }

  //When output is an object, we append the grouped object to the result with the key value.
  appendToObjectResult(result, groupedObject, keyName, keyValue);
}

/**
 * Returns whether the current group should be emitted or skipped.
 */
function shouldIncludeGroup(
  keyName: PropertyKey | undefined,
  keyValue: PropertyKey,
  allowNulls: boolean,
): boolean {
  // Keep keyless groups; otherwise treat null/undefined identically via allowNulls.
  return keyName === undefined || allowNulls || keyValue != null;
}

/**
 * Pushes one normalized value into array output mode.
 */
function appendToArrayResult<T extends Row = Row>(
  result: unknown[],
  groupedObject: Record<PropertyKey, unknown>,
  keyName: PropertyKey | undefined,
  restFields: RuntimeField<T>[],
  rootIsHidden: boolean,
  options: Required<ObjectifyOptions>,
): void {
  result.push(resolveArrayValue(groupedObject, keyName, restFields, rootIsHidden, options));
}

/**
 * Resolves how a grouped object is represented in array mode.
 */
function resolveArrayValue<T extends Row = Row>(
  groupedObject: Record<PropertyKey, unknown>,
  keyName: PropertyKey | undefined,
  restFields: RuntimeField<T>[],
  rootIsHidden: boolean,
  { flattenSingleField }: Required<ObjectifyOptions>,
): unknown {
  if (keyName === undefined) return groupedObject;

  if (rootIsHidden) {
    if (flattenSingleField && !hasMultipleFields(restFields, 1)) {
      const singleKey = getFirstVisibleFieldName(restFields);
      return singleKey !== undefined ? groupedObject[singleKey] : groupedObject;
    }
    return groupedObject;
  }

  const hasNestedFields = hasMultipleFields(restFields, 0);
  if (flattenSingleField) {
    return hasNestedFields ? groupedObject : groupedObject[keyName];
  }
  return groupedObject;
}

/**
 * Finds the first visible(not hidden) field name among nested fields.
 */
function getFirstVisibleFieldName<T extends Row>(
  fields: RuntimeField<T>[],
): PropertyKey | undefined {
  for (const field of fields) {
    if (Array.isArray(field)) {
      return undefined;
    }
    if (typeof field === "string") {
      return field;
    }
    if (!field?.hide) {
      return getFieldName(field);
    }
  }
  return undefined;
}

/**
 * Appends one object to the final result container.
 */
function appendToObjectResult(
  result: Record<PropertyKey, unknown>,
  obj: Record<PropertyKey, unknown>,
  keyName: PropertyKey | null | undefined,
  keyValue: PropertyKey,
): void {
  if (keyName === undefined) {
    Object.assign(result, obj);
    return;
  }
  result[keyValue] = obj;
}

/**
 * Groups rows by the provided key while preserving insertion order.
 */
function groupRowsByKey<T extends Row>(
  rows: T[],
  keyField: RuntimeField<T>,
  options: Required<ObjectifyOptions>,
): Map<PropertyKey, T[]> {
  const groups = new Map<PropertyKey, T[]>();
  for (const row of rows) {
    const keyValue = resolveKeyValue(row, keyField, options) as PropertyKey;
    const group = groups.get(keyValue);
    if (group) {
      group.push(row);
    } else {
      groups.set(keyValue, [row]);
    }
  }
  return groups;
}

/**
 * Resolves a row key value used for grouping.
 */
function resolveKeyValue<T extends Row>(
  row: T,
  keyField: RuntimeField<T>,
  { separator, allowNulls }: Required<ObjectifyOptions>,
): unknown {
  const key = getFieldKey(keyField);
  const effectiveSeparator = getSeparator(keyField, separator);
  if (key === undefined) {
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
      combinedKey += `${String(value)}${effectiveSeparator}`;
    }
    return combinedKey.slice(0, -effectiveSeparator.length);
  }
  return row[key];
}

/**
 * Resolves the source key from either shorthand or object field syntax.
 */
function getFieldKey<T extends Row>(
  field: RuntimeField<T> | RuntimeKeyField<T>,
): KeyName<T> | KeyName<T>[] | undefined {
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

/**
 * Resolves the separator for combined key/value fields.
 */
function getSeparator<T extends Row>(
  field: RuntimeField<T> | RuntimeKeyField<T>,
  defaultValue: string,
): string {
  if (Array.isArray(field) || typeof field === "string") {
    return defaultValue;
  }
  if ("keys" in field) {
    return field.separator ?? defaultValue;
  }
  return defaultValue;
}

/**
 * Resolves the output property name for a key field.
 */
function getFieldName<T extends Row>(field: RuntimeField<T>): PropertyKey | undefined {
  if (Array.isArray(field)) {
    return undefined;
  }
  if (typeof field === "string") {
    return field;
  }

  const namedField = field as { as?: PropertyKey; key?: PropertyKey };
  return namedField.as ?? namedField.key;
}

/**
 * Returns whether a key field is marked as hidden.
 */
function isHiddenField<T extends Row>(field: RuntimeField<T>): boolean {
  if (Array.isArray(field) || typeof field === "string") {
    return false;
  }
  return field?.hide ?? false;
}

/**
 * Reads a row value and optionally parses it as JSON.
 */
function getFieldValue<T extends Row>(
  row: T,
  field: RuntimeKeyField<T>,
  separator: string,
): unknown {
  if (typeof field === "string") {
    return row[field];
  }

  const key = getFieldKey(field);
  if (key === undefined) {
    return undefined;
  }

  if (Array.isArray(key)) {
    const values: string[] = [];
    for (const k of key) {
      values.push(String(row[k]));
    }
    return values.join(getSeparator(field, separator));
  }

  if ("json" in field && field.json) {
    try {
      return JSON.parse(row[key] as string);
    } catch (error) {
      console.error(`"${row[key]}" is not a valid JSON`, error);
      return null;
    }
  }

  return row[key];
}

/**
 * Resolves the output name for a group field definition.
 */
function getGroupName(field: RuntimeGroupField): PropertyKey {
  if (typeof field === "string" || typeof field === "number" || typeof field === "symbol") {
    return field;
  }
  return field.name;
}

/**
 * Resolves whether a group should be emitted as object or array.
 */
function getGroupOptions(
  field: RuntimeGroupField,
  defaultValue: Required<ObjectifyOptions>,
): Required<ObjectifyOptions> {
  if (typeof field !== "object") {
    return defaultValue;
  }
  return { ...defaultValue, ...field };
}

/**
 * Checks if a field list effectively contains more than `threshold` visible fields.
 */
function hasMultipleFields<T extends Row>(
  fields: RuntimeField<T>[],
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
