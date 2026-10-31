// Scopes compiled Tailwind CSS to the plugin's own elements.
//
// Obsidian loads styles.css into the whole app, so the reset and utilities
// must only reach elements inside `.tasks-table-scope`. Three more changes keep
// the plugin and Obsidian's and the theme's rules apart:
// - Cascade layers are removed. Obsidian's styles are unlayered, and unlayered
//   rules win over layered ones whatever their specificity.
// - The scope selector is `:is(.tasks-table-scope, #tasks-table-scope)`, which
//   matches the class but counts as an ID. Rules such as
//   `.theme-dark button:not(.clickable-icon)` then lose to the plugin's rules.
// - Keyframes get a prefix, so `spin` or `pulse` never replace Obsidian's own.

export const scopeClassName = 'tasks-table-scope'

const scope = `:is(.${scopeClassName}, #${scopeClassName})`

// Selectors that mean "the document root" become the scope element itself.
const rootSelectorPattern = /^(?::root|:host|html|body)(?=$|[:.[])/u

const scopeSelector = (selector) => {
  const trimmed = selector.trim()

  if (rootSelectorPattern.test(trimmed)) {
    return trimmed.replace(rootSelectorPattern, scope)
  }

  return `${scope} ${trimmed}`
}

const isInsideKeyframes = (node) => {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && /keyframes$/iu.test(parent.name)) {
      return true
    }
  }
  return false
}

const isNestedRule = (rule) => rule.parent?.type === 'rule'

const keyframesPrefix = 'tasks-table-'

const prefixKeyframes = (root) => {
  const names = new Set()
  root.walkAtRules(/keyframes$/iu, (atRule) => {
    names.add(atRule.params)
    atRule.params = keyframesPrefix + atRule.params
  })
  if (names.size === 0) {
    return
  }

  const escaped = [...names].map((name) => name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
  const pattern = new RegExp(`(^|[\\s,])(${escaped.join('|')})(?=$|[\\s,])`, 'gu')
  // Tailwind keeps animations in `--animate-*` theme variables too.
  root.walkDecls(/^(?:(?:-webkit-)?animation(?:-name)?|--animate-.+)$/iu, (declaration) => {
    declaration.value = declaration.value.replace(pattern, `$1${keyframesPrefix}$2`)
  })
}

export const scopeCss = () => ({
  postcssPlugin: 'tasks-table-scope-css',
  OnceExit(root) {
    // Unwrap innermost layers first, so nested layers unwrap cleanly.
    let layers = []
    do {
      layers = []
      root.walkAtRules('layer', (atRule) => {
        layers.push(atRule)
      })
      for (const layer of layers.reverse()) {
        if (layer.nodes && layer.nodes.length > 0) {
          layer.replaceWith(layer.nodes)
        } else {
          layer.remove()
        }
      }
    } while (layers.length > 0)

    root.walkRules((rule) => {
      if (isInsideKeyframes(rule)) {
        return
      }

      if (isNestedRule(rule)) {
        throw new Error(
          `Nested CSS rule "${rule.selector}" cannot be scoped. Enable Tailwind's optimizer.`,
        )
      }

      rule.selectors = [...new Set(rule.selectors.map(scopeSelector))]
    })

    prefixKeyframes(root)
  },
})
scopeCss.postcss = true
