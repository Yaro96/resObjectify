import type {
  Field,
  FieldsBuilder,
  GroupField,
  GroupFieldOptions,
  KeyField,
  KeyFieldOptions,
  LeafKeys,
  Row,
  SimpleGroupField,
} from "../types";

/**
 * Creates a fluent builder for composing `Fields` definitions.
 */
export function fieldsBuilder<R = Row, T = Row>(): FieldsBuilder<R, T> {
  const fields: Field<R, T>[] = [];

  const field: FieldsBuilder<R, T>["field"] = (
    field: KeyField<R, T>,
    asOrOptions?: LeafKeys<R> | KeyFieldOptions,
    options?: KeyFieldOptions,
  ) => {
    const isOptions =
      typeof asOrOptions === "object" && asOrOptions !== null && "json" in asOrOptions;
    const resolvedAs = isOptions ? undefined : (asOrOptions as PropertyKey);
    const resolvedOptions = isOptions ? (asOrOptions as KeyFieldOptions) : options;

    // Normalize overload inputs into a single key-field shape.
    const entry = newField<R, T>(field, resolvedAs, resolvedOptions);
    fields.push(entry);
    return api;
  };

  const group: FieldsBuilder<R, T>["group"] = (
    name: GroupField<R> | SimpleGroupField,
    optionsOrBuild: GroupFieldOptions | ((builder: FieldsBuilder<R, T>) => FieldsBuilder<R, T>),
    build?: (builder: FieldsBuilder<R, T>) => FieldsBuilder<R, T>,
  ) => {
    const options = typeof optionsOrBuild === "object" ? optionsOrBuild : undefined;
    const buildFn = typeof optionsOrBuild === "function" ? optionsOrBuild : build;
    if (!buildFn) {
      throw new Error("Group builder requires a builder callback.");
    }
    const nested = buildFn(fieldsBuilder<R, T>()).build();
    const groupField = newGroup(name as SimpleGroupField, options);
    fields.push([groupField as GroupField<R>, nested]);
    return api;
  };

  const build: FieldsBuilder<R, T>["build"] = () => {
    return fields;
  };

  const api: FieldsBuilder<R, T> = { field, group, build };
  return api;
}

/**
 * Normalizes key field shorthand into object form when needed.
 */
function newField<R = Row, T = Row>(
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

/**
 * Normalizes group shorthand into object form when options are provided.
 */
function newGroup(groupField: SimpleGroupField, options?: GroupFieldOptions): SimpleGroupField {
  if (!options) {
    return groupField;
  }

  let entry: SimpleGroupField = typeof groupField === "object" ? groupField : { name: groupField };
  if (options) {
    entry = { ...entry, ...options };
  }
  return entry;
}
