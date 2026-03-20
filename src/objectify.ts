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
  fields: Field<R, T>[],
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

function resolveOptions(options: ObjectifyOptions = DEFAULT_OPTIONS): Required<ObjectifyOptions> {
  return { ...DEFAULT_OPTIONS, ...options };
}

function createResultContainer<R, T extends Row>(
  fields: Field<R, T>[],
  rootIsHidden: boolean,
  options: Required<ObjectifyOptions>,
): unknown[] | Record<PropertyKey, unknown> {
  const { object, flattenSingleField } = options;
  const shouldUseObjectResult =
    object && (rootIsHidden || !flattenSingleField || hasMultipleFields(fields));
  return shouldUseObjectResult ? {} : [];
}

function buildGroupedObject<R = unknown, T extends Row = Row>(
  rows: T[],
  fields: Field<R, T>[],
  options: Required<ObjectifyOptions>,
): Record<PropertyKey, unknown> {
  const firstRow = rows[0];
  const groupedObject: Record<PropertyKey, unknown> = {};

  for (const field of fields) {
    if (Array.isArray(field)) {
      const [rawGroupField, nestedFields] = field;
      const groupField = rawGroupField as SimpleGroupField;
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
      groupedObject[fieldName] = getFieldValue(firstRow, field);
    }
  }

  return groupedObject;
}

function buildNestedGroupValue<R = unknown, T extends Row = Row>(
  rows: T[],
  nestedFields: Field<R, T>[],
  groupField: SimpleGroupField,
  options: Required<ObjectifyOptions>,
): unknown {
  const groupOptions = getGroupOptions(groupField, options);

  if (groupOptions.object) {
    return objectify<R, T>(rows, nestedFields, { ...groupOptions, object: true });
  }

  return objectify<R, T>(rows, nestedFields, { ...groupOptions, object: false });
}

function appendToResult<R = unknown, T extends Row = Row>(
  result: unknown[] | Record<PropertyKey, unknown>,
  groupedObject: Record<PropertyKey, unknown>,
  keyName: PropertyKey | undefined,
  keyValue: PropertyKey,
  restFields: Field<R, T>[],
  options: Required<ObjectifyOptions>,
  rootIsHidden: boolean,
): void {
  const { allowNulls } = options;
  if (!shouldIncludeGroup(keyName, keyValue, allowNulls)) {
    return;
  }

  if (Array.isArray(result)) {
    appendToArrayResult(result, groupedObject, keyName, restFields, rootIsHidden, options);
    return;
  }

  appendToObjectResult(result, groupedObject, keyName, keyValue);
}

function shouldIncludeGroup(
  keyName: PropertyKey | undefined,
  keyValue: PropertyKey,
  allowNulls: boolean,
): boolean {
  // Keep keyless groups; otherwise treat null/undefined identically via allowNulls.
  return keyName === undefined || allowNulls || keyValue != null;
}

function appendToArrayResult<R = unknown, T extends Row = Row>(
  result: unknown[],
  groupedObject: Record<PropertyKey, unknown>,
  keyName: PropertyKey | undefined,
  restFields: Field<R, T>[],
  rootIsHidden: boolean,
  options: Required<ObjectifyOptions>,
): void {
  result.push(resolveArrayValue(groupedObject, keyName, restFields, rootIsHidden, options));
}

function resolveArrayValue<R = unknown, T extends Row = Row>(
  groupedObject: Record<PropertyKey, unknown>,
  keyName: PropertyKey | undefined,
  restFields: Field<R, T>[],
  rootIsHidden: boolean,
  { flattenSingleField }: Required<ObjectifyOptions>,
): unknown {
  if (keyName === undefined) return groupedObject;

  if (rootIsHidden) {
    if (flattenSingleField && hasMultipleFields(restFields, 1)) {
      return groupedObject;
    }
    if (flattenSingleField) {
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

function getFirstVisibleFieldName<R, T extends Row>(
  fields: Field<R, T>[],
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

function appendToObjectResult(
  result: Record<PropertyKey, unknown>,
  groupedObject: Record<PropertyKey, unknown>,
  keyName: PropertyKey | null | undefined,
  keyValue: PropertyKey,
): void {
  if (keyName === undefined) {
    Object.assign(result, groupedObject);
    return;
  }
  result[keyValue] = groupedObject;
}

/**
 * Groups rows by the provided key while preserving insertion order.
 */
function groupRowsByKey<R, T extends Row>(
  rows: T[],
  keyField: Field<R, T>,
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

function resolveKeyValue<R, T extends Row>(
  row: T,
  keyField: Field<R, T>,
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
function getFieldKey<R, T extends Row>(
  field: Field<R, T> | KeyField<R, T>,
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

function getSeparator<R, T extends Row>(
  field: Field<R, T> | KeyField<R, T>,
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
  return field?.hide ?? false;
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
    const values: string[] = [];
    for (const k of key) {
      values.push(String(row[k]));
    }
    return values.join((field as CombinedField<R, T>)?.separator ?? "|");
  }

  if ((field as SingleField<R, T>).json) {
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
function getGroupName(field: SimpleGroupField): PropertyKey {
  if (typeof field === "string" || typeof field === "number" || typeof field === "symbol") {
    return field;
  }
  return field.name;
}

/**
 * Resolves whether a group should be emitted as object or array.
 */
function getGroupOptions(
  field: SimpleGroupField,
  defaultValue: Required<ObjectifyOptions>,
): Required<ObjectifyOptions> {
  if (typeof field !== "object") {
    return defaultValue;
  }
  return { ...defaultValue, ...field };
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
