/**
 * OpenAI Structured Outputs accepts an object schema only when every property
 * is required and additional properties are forbidden. Check that contract
 * offline so a live Codex run cannot be the first place a schema defect appears.
 */
export function strictObjectSchemaFailures(schema) {
  const failures = []

  function visit(node, location) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return

    const types = Array.isArray(node.type) ? node.type : [node.type]
    const objectTyped = types.includes('object')
    const declaresProperties = Object.hasOwn(node, 'properties')
    if (objectTyped || declaresProperties) {
      if (!objectTyped) failures.push(`${location}: properties require type object`)
      if (node.additionalProperties !== false) {
        failures.push(`${location}: additionalProperties must be false`)
      }

      const properties =
        node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
          ? Object.keys(node.properties).sort()
          : null
      if (!properties) failures.push(`${location}: properties must be an object`)
      const required = Array.isArray(node.required) ? [...node.required].sort() : null
      if (!required) {
        failures.push(`${location}: required must list every property`)
      } else if (properties) {
        const duplicates = required.filter((key, index) => required.indexOf(key) !== index)
        if (duplicates.length) {
          failures.push(`${location}: required repeats ${[...new Set(duplicates)].join(', ')}`)
        }
        const missing = properties.filter((key) => !required.includes(key))
        const unknown = required.filter((key) => !properties.includes(key))
        if (missing.length) failures.push(`${location}: required is missing ${missing.join(', ')}`)
        if (unknown.length) failures.push(`${location}: required names unknown ${unknown.join(', ')}`)
      }

      if (properties) {
        for (const [key, child] of Object.entries(node.properties)) {
          visit(child, `${location}.properties.${key}`)
        }
      }
    }

    if (node.items) visit(node.items, `${location}.items`)
    for (const [index, child] of (node.prefixItems ?? []).entries()) {
      visit(child, `${location}.prefixItems[${index}]`)
    }
    for (const keyword of ['allOf', 'anyOf', 'oneOf']) {
      for (const [index, child] of (node[keyword] ?? []).entries()) {
        visit(child, `${location}.${keyword}[${index}]`)
      }
    }
    for (const keyword of ['if', 'then', 'else', 'not', 'contains', 'propertyNames']) {
      if (node[keyword]) visit(node[keyword], `${location}.${keyword}`)
    }
    for (const keyword of ['$defs', 'definitions', 'dependentSchemas', 'patternProperties']) {
      for (const [key, child] of Object.entries(node[keyword] ?? {})) {
        visit(child, `${location}.${keyword}.${key}`)
      }
    }
  }

  visit(schema, '$')
  return failures
}
