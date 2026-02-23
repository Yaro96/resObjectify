import type {
  Field,
  FieldsBuilder,
  GroupField,
  LeafKeys,
  SimpleGroupField,
  Fields,
  KeyField,
  KeyName,
  Prettify,
  Result,
  Row,
  KeyFieldOptions,
  GroupFieldOptions,
  DefaultString,
} from "./types";

export type { Fields, FieldsBuilder } from "./types";

export function fieldsBuilder<R = Row, T = Row>(): FieldsBuilder<R, T> {
  const fields: Field<R, T>[] = [];

  function newField(
    key: KeyField<R, T>,
    as?: PropertyKey,
    options?: KeyFieldOptions,
  ): KeyField<R, T> {
    if (!as && !options) {
      return key;
    }

    let entry: KeyField<R, T> = typeof key === "object" ? key : { key };
    if (as !== undefined) {
      entry = { ...entry, as: as as LeafKeys<R> };
    }
    if (options !== undefined) {
      entry = { ...entry, ...options };
    }
    return entry;
  }

  function newGroup(
    name: GroupField<R>,
    options?: GroupFieldOptions,
  ): GroupField<R> {
    if (!options) {
      return name;
    }
    return { ...name, ...options };
  }

  const field: FieldsBuilder<R, T>["field"] = (
    field: KeyField<R, T>,
    asOrOptions?: LeafKeys<R> | KeyFieldOptions,
    options?: KeyFieldOptions,
  ) => {
    const isOptions = typeof asOrOptions === "object"
      && asOrOptions !== null
      && "json" in asOrOptions;
    const resolvedAs = isOptions ? undefined : (asOrOptions as PropertyKey);
    const resolvedOptions = isOptions ? (asOrOptions as KeyFieldOptions) : options;

    //Create the new field entry
    const entry = newField(field, resolvedAs, resolvedOptions);
    fields.push(entry);
    return api;
  };

  const group: FieldsBuilder<R, T>["group"] = (
    name: GroupField<R>,
    optionsOrBuild: GroupFieldOptions | ((builder: FieldsBuilder<R, T>) => FieldsBuilder<R, T>),
    build?: (builder: FieldsBuilder<R, T>) => FieldsBuilder<R, T>,
  ) => {
    const options = typeof optionsOrBuild === "object" ? optionsOrBuild : undefined;
    const buildFn = typeof optionsOrBuild === "function" ? optionsOrBuild : build;
    if (!buildFn) {
      throw new Error("Group builder requires a builder callback.");
    }
    const nested = buildFn(fieldsBuilder<R, T>()).build();
    const groupField = newGroup(name, options);
    fields.push([groupField, nested]);
    return api;
  };

  const build: FieldsBuilder<R, T>["build"] = () => {
    if (fields.length === 0 || Array.isArray(fields[0])) {
      throw new Error("Fields builder requires the first field to be a key field.");
    }
    return fields as Fields<R, T>;
  };

  const api: FieldsBuilder<R, T> = { field, group, build };
  return api;
}

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
