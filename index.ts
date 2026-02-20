type Row = Record<string, unknown>;

type KeyField = string | {
  key: string;
  as?: string;
  json?: boolean;
}

type GroupField = string | {
  name: string;
  object?: boolean;
}

type Field = KeyField | [GroupField, Fields];

export type Fields = [KeyField, ...Field[]];

export function objectify(data: Row[], fields: Fields, object = false) {
  return recursion(data, fields, object);
}

function recursion(
  data: Row[],
  fields: Fields,
  object = false,
  index = 0,
  parents: string[] = [],
) {
  // If the fields is a single field or object is false, group the result in an array, otherwise group the result in an object
  const result: unknown[] | Record<string, unknown> =
    fields.length === 1 || !object ? [] : {};
  const added: unknown[] = [];

  const [keyField, ...restFields] = fields;

  for (let i = index; i < data.length; i++) {
    const key = getKeyField(keyField);
    const name = getFieldName(keyField);

    if (!checkParents(data, i, index, parents) || added.includes(data[i][key]))
      continue;

    const obj: Record<string, unknown> = {};
    for (const field of fields) {
      if (!Array.isArray(field)) {
        obj[getFieldName(field)] = getFieldValue(data[i], field);
      } else {
        const [groupField, nestedFields] = field;
        const nestedObject = isObject(groupField, object);
        obj[getGroupName(groupField)] = recursion(
          data,
          nestedFields,
          nestedObject,
          i,
          [...parents, key],
        );
      }
    }
    added.push(data[i][key]);

    if (obj[name] != null) {
      if (Array.isArray(result)) {
        result.push(restFields.length ? obj : obj[name]);
      } else {
        result[data[i][key] as string] = obj;
      }
    }
  }
  return result;
}

function getKeyField(field: KeyField) {
  return typeof field === "string" ? field : field.key;
}

function getFieldName(field: KeyField) {
  return typeof field === "string" ? field : (field.as ?? field.key);
}

function getFieldValue(row: Row, field: KeyField): unknown {
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

/**
 * Checks if the parent keys of the current row are the same as the parent keys of the base row
 * @param data - The data to check
 * @param currentIndex - The current index
 * @param baseIndex - The base index
 * @param parentKeys - The parents to check
 * @returns True if the parents are the same, false otherwise
 */
function checkParents(
  data: Row[],
  currentIndex: number,
  baseIndex: number,
  parentKeys: string[],
) {
  for (const parent of parentKeys) {
    if (data[currentIndex][parent] !== data[baseIndex][parent]) return false;
  }
  return true;
}
