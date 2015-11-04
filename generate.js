/* eslint no-use-before-define: [2, "nofunc"] */
'use strict';
const fs = require('fs');
const join = require('path').join;

// rows are represented as an array of three strings: name, type, description
// TODO: make a table of objects like "address" and "amount" that link
// to separate sections rather than getting expanded

function formatTable(rows) {
  const header = ['Name', 'Type', 'Description'];
  const divider = ['----', '----', '-----------'];
  const allRows = [header, divider].concat(rows);
  return allRows.map(row => row.join(' | ')).join('\n');
}

function formatName(path) {
  if (path.length === 0) {
    return '';
  }
  if (path.length === 1) {
    return path[0];
  }
  return '*' + path.slice(0, -1).join('.') + '.* ' + path.slice(-1)[0];
}

function formatType(schema) {
  if (schema.link) {
    return '[' + schema.name + '](#' + schema.link + ')';
  }
  return schema.type || schema.$ref || 'object';
}

function formatRow(schema, path) {
  return [formatName(path), formatType(schema), schema.description];
}

function flatten(arrays) {
  return [].concat.apply([], arrays);
}

function generateRowsForObject(schema, path, schemas) {
  const rows = flatten(Object.keys(schema.properties).sort().map(name =>
    generateRowsForSchema(
      schema.properties[name], path.concat([name]), schemas)));
  return path.length > 0 ? [formatRow(schema, path)].concat(rows) : rows;
}

function generateRowsForArray(schema, path, schemas) {
  const firstRow = formatRow(schema, path);
  if (!schema.items.properties) {
    return [firstRow];
  }
  const newPath = path.slice(0, -1).concat([path.slice(-1)[0] + '[]']);
  return [firstRow].concat(
    generateRowsForSchema(schema.items, newPath, schemas));
}

function generateRowsForCompleteSchema(schema, path, schemas) {
  if (schema.link) {
    return [formatRow(schema, path)];
  }
  if (schema.type === 'array') {
    if (path.length > 0) {
      return generateRowsForArray(schema, path, schemas);
    }
    return generateRowsForSchema(schema.items, path, schemas);
  }
  if (schema.properties) {
    return generateRowsForObject(schema, path, schemas);
  }
  return [formatRow(schema, path)];
}

function assign(destination, source) {
  for (let key in source) {
    if (source.hasOwnProperty(key)) {
      destination[key] = source[key];
    }
  }
  return destination;
}

function completeSchema(schema, schemas) {
  if (schema.$ref) {
    const refSchema = schemas[schema.$ref];
    if (!refSchema) {
      throw new Error('Could not find schema for: ' + schema.$ref);
    }
    const newSchema = assign(assign({}, refSchema), schema);
    console.log(newSchema);
    return newSchema;
  }
  return schema;
}

function generateRowsForSchema(schema, path, schemas) {
  const completedSchema = completeSchema(schema, schemas);
  return generateRowsForCompleteSchema(completedSchema, path, schemas);
}

function recursivelyListDirectory(directory) {
  const filenames = fs.readdirSync(directory);
  let results = [];
  filenames.forEach(filename => {
    const filepath = join(directory, filename);
    const stat = fs.statSync(filepath);
    if (stat && stat.isDirectory()) {
      results = results.concat(recursivelyListDirectory(filepath));
    } else {
      results.push(filepath);
    }
  });
  return results;
}

function loadSchema(filepath) {
  return JSON.parse(fs.readFileSync(filepath));
}

function loadSchemas(schemaDirectory) {
  const filepaths = recursivelyListDirectory(schemaDirectory);
  const schemas = {};
  filepaths.forEach(filepath => {
    if (filepath.endsWith('.json')) {
      const schema = loadSchema(filepath);
      schemas[schema.id || schema.title] = schema;
    }
  });
  return schemas;
}

function main() {
  if (process.argv.length !== 4) {
    console.error('usage: generate SCHEMA [SCHEMASDIR]');
    process.exit(2);
  }
  const filepath = process.argv[2];
  const schemas = process.argv.length > 3 ? loadSchemas(process.argv[3]) : {};
  const schema = loadSchema(filepath);
  console.log(formatTable(generateRowsForSchema(schema, [], schemas)));
}

main();
