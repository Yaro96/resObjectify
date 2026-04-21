import type {
  CombinedFieldOptions,
  DefaultString,
  Field,
  FieldsBuilder,
  GroupFieldOptions,
  KeyField,
  KeyFieldOptions,
  Row,
  RuntimeCombinedField,
  RuntimeField,
  RuntimeGroupField,
  RuntimeKeyField,
  RuntimeSingleField,
} from "../types";

/**
 * Creates a fluent builder for composing `Fields` definitions.
 */
export function fieldsBuilder<R = Row, T = Row>(): FieldsBuilder<R, T> {
  const fields: RuntimeField<T>[] = [];

  /**
   * Adds a key field using either shorthand or object form.
   */
  const field = ((
    field: KeyField<R, T>,
    asOrOptions?: PropertyKey | string[] | KeyFieldOptions,
    options?: KeyFieldOptions,
  ) => {
    const isOptions =
      typeof asOrOptions === "object" && asOrOptions !== null && !Array.isArray(asOrOptions);
    const resolvedAs = isOptions ? undefined : (asOrOptions as PropertyKey);
    const resolvedOptions = isOptions ? asOrOptions : options;

    // Normalize overload inputs into a single key-field shape.
    const entry = newField<R, T>(field, resolvedAs, resolvedOptions);
    fields.push(entry);
    return api;
  }) as FieldsBuilder<R, T>["field"];

  /**
   * Adds a nested group and collects its child fields from a nested builder.
   */
  const group = ((
    name: RuntimeGroupField,
    optionsOrBuild: GroupFieldOptions | ((builder: FieldsBuilder<R, T>) => FieldsBuilder<R, T>),
    build?: (builder: FieldsBuilder<R, T>) => FieldsBuilder<R, T>,
  ) => {
    const options = typeof optionsOrBuild === "object" ? optionsOrBuild : undefined;
    const buildFn = typeof optionsOrBuild === "function" ? optionsOrBuild : build;
    if (!buildFn) {
      throw new Error("Group builder requires a builder callback.");
    }
    const nested = buildFn(fieldsBuilder<R, T>()).build() as unknown as RuntimeField<T>[];
    const groupField = newGroup(name, options);
    fields.push([groupField, nested]);
    return api;
  }) as FieldsBuilder<R, T>["group"];

  /**
   * Adds a combined key field (`keys`) definition.
   */
  const combinedField = ((keys, as, options?: CombinedFieldOptions) => {
    const entry: RuntimeCombinedField<T> = {
      keys: [...keys],
      as: as as DefaultString,
    };
    if (options) {
      Object.assign(entry, options);
    }
    fields.push(entry);
    return api;
  }) as FieldsBuilder<R, T>["combinedField"];

  /**
   * Returns a snapshot of currently collected field definitions.
   */
  const build: FieldsBuilder<R, T>["build"] = () => {
    return [...fields] as unknown as Field<R, T>[];
  };

  const api: FieldsBuilder<R, T> = { field, combinedField, group, build };
  return api;
}

/**
 * Normalizes key field shorthand into object form when needed.
 */
function newField<R = Row, T = Row>(
  key: KeyField<R, T>,
  as?: PropertyKey,
  options?: KeyFieldOptions,
): RuntimeKeyField<T> {
  if (as === undefined && options === undefined) {
    return key as RuntimeKeyField<T>;
  }

  const entry: RuntimeSingleField<T> | RuntimeCombinedField<T> =
    typeof key === "object"
      ? ({ ...key } as RuntimeSingleField<T> | RuntimeCombinedField<T>)
      : { key };
  if (as !== undefined) {
    entry.as = as as DefaultString;
  }
  if (options !== undefined) {
    Object.assign(entry, options);
  }
  return entry;
}

/**
 * Normalizes group shorthand into object form when options are provided.
 */
function newGroup(groupField: RuntimeGroupField, options?: GroupFieldOptions): RuntimeGroupField {
  if (!options) {
    return groupField;
  }

  const entry: RuntimeGroupField =
    typeof groupField === "object" ? groupField : { name: groupField };
  return { ...entry, ...options };
}
