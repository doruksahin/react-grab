/**
 * deep-context plugin for react-grab
 *
 * Enriches the agent context with inspector-log-style deep data:
 * - Full React fiber tree (props, hooks, contexts, owner)
 * - CSS layout metrics (display, width, height, gap, rect)
 * - Accessibility data (role, aria-*, tabIndex)
 * - Service/state management extraction (impair-compatible)
 * - Viewport + breakpoint info
 *
 * This replaces the shallow "HTML + component stack" output with
 * a structured JSON block that gives AI agents 10x more context.
 */

import type { Plugin, AgentContext, PluginConfig, ReactGrabAPI } from '../../types.js'

// ─── Configuration ─────────────────────────────────────────────────────────

export interface DeepContextConfig {
  /**
   * Max depth for serializing props/hooks values.
   * 0 = full expansion, 2 = summarize nested objects.
   * @default 2
   */
  serializeDepth?: number

  /**
   * Max ancestors to walk in the React fiber tree.
   * @default 15
   */
  maxAncestors?: number

  /**
   * Which enrichment sections to include.
   * @default all enabled
   */
  sections?: {
    react?: boolean
    layout?: boolean
    a11y?: boolean
    viewport?: boolean
    dataAttributes?: boolean
    services?: boolean
  }

  /**
   * Custom service extractor for state management libraries.
   * Called with the DOM element; should return a serializable object
   * representing the service/store state tree.
   *
   * For impair-based apps, use the built-in impairExtractor.
   */
  serviceExtractor?: (el: Element) => Record<string, unknown> | null
}

const DEFAULT_CONFIG: Required<DeepContextConfig> = {
  serializeDepth: 2,
  maxAncestors: 15,
  sections: {
    react: true,
    layout: true,
    a11y: true,
    viewport: true,
    dataAttributes: true,
    services: true,
  },
  serviceExtractor: () => null,
}

// ─── Value Serializer (depth-limited) ──────────────────────────────────────

function safeSerialize(val: unknown, depth: number, maxDepth: number): unknown {
  if (val === null || val === undefined) return val
  const t = typeof val
  if (t === 'string') return (val as string).length > 150 ? (val as string).slice(0, 150) + '…' : val
  if (t === 'number' || t === 'boolean') return val
  if (t === 'function') return '[fn]'
  if (t === 'symbol') return `[Symbol(${(val as symbol).description})]`

  const obj = val as Record<string, unknown>
  if (obj.$$typeof) return '[ReactElement]'
  if ((obj as unknown as Node).nodeType) return '[DOMNode]'

  if (depth >= maxDepth) {
    return Array.isArray(val) ? `[Array(${val.length})]` : '[Object]'
  }

  if (Array.isArray(val)) {
    if (val.length > 5) return `[Array(${val.length})]`
    return val.map((v) => safeSerialize(v, depth + 1, maxDepth))
  }

  const keys = Object.keys(obj)
  if (keys.length > 10) return `[Object(${keys.length} keys)]`
  const result: Record<string, unknown> = {}
  for (const key of keys) {
    result[key] = safeSerialize(obj[key], depth + 1, maxDepth)
  }
  return result
}

// ─── React Fiber Internals ─────────────────────────────────────────────────

interface ReactFiber {
  type: unknown
  return: ReactFiber | null
  child: ReactFiber | null
  index: number
  key: string | null
  memoizedProps: Record<string, unknown> | null
  memoizedState: unknown
  dependencies: { firstContext: ContextDep | null } | null
  stateNode: Element | null
  _debugSource: { fileName: string; lineNumber: number } | null
  _debugOwner: ReactFiber | null
  queue: unknown
}

interface HookNode {
  memoizedState: unknown
  queue: unknown
  next: HookNode | null
}

interface ContextDep {
  context: {
    _currentValue: unknown
    displayName?: string
    Provider?: { _context?: { displayName?: string } }
  }
  next: ContextDep | null
}

function getReactFiber(el: Element): ReactFiber | null {
  const keys = Object.keys(el)
  for (const key of keys) {
    if (key.startsWith('__reactFiber$')) {
      return (el as unknown as Record<string, ReactFiber>)[key]
    }
  }
  return null
}

function isComponentFiber(fiber: ReactFiber): boolean {
  return !!fiber.type && typeof fiber.type !== 'string'
}

function fiberName(fiber: ReactFiber): string | null {
  const type = fiber.type
  if (!type || typeof type === 'string') return null

  // Check SWC refresh map
  const map = (window as unknown as Record<string, WeakMap<object, string>>).__inspectorRefreshMap
  if (map) {
    const mapped = map.get(type as object)
    if (mapped && mapped !== 'default') return mapped
  }

  if (typeof type === 'function') {
    return (type as { displayName?: string; name?: string }).displayName ||
           (type as { name?: string }).name || null
  }
  const typed = type as { render?: { displayName?: string; name?: string }; type?: unknown }
  if (typed.render) return typed.render.displayName || typed.render.name || null
  if (typed.type) return fiberName({ type: typed.type } as ReactFiber)
  return null
}

function findComponentFiber(fiber: ReactFiber): ReactFiber | null {
  let cur: ReactFiber | null = fiber
  while (cur) {
    if (isComponentFiber(cur)) return cur
    cur = cur.return
  }
  return null
}

// ─── Hook Classifier ───────────────────────────────────────────────────────

type HookKind = 'state' | 'ref' | 'memo' | 'callback' | 'effect' | 'id' | 'unknown'

function classifyHook(hook: HookNode): HookKind {
  const ms = hook.memoizedState
  const q = hook.queue

  if (ms !== null && typeof ms === 'object' && !Array.isArray(ms)) {
    const obj = ms as Record<string, unknown>
    if ('create' in obj && 'tag' in obj) return 'effect'
    if (q === null) {
      const keys = Object.keys(obj)
      if (keys.length === 1 && keys[0] === 'current') return 'ref'
    }
  }

  if (Array.isArray(ms) && ms.length === 2 && Array.isArray(ms[1])) {
    return typeof ms[0] === 'function' ? 'callback' : 'memo'
  }

  if (q !== null && typeof q === 'object' && 'dispatch' in (q as Record<string, unknown>)) {
    return 'state'
  }

  if (typeof ms === 'string' && ms.charAt(0) === ':') return 'id'

  return 'unknown'
}

// ─── Extractors ────────────────────────────────────────────────────────────

interface AncestryItem {
  name: string
  index?: number
  key?: string
  file?: string
  line?: number
  renders?: string
}

function extractAncestry(fiber: ReactFiber, maxCount: number): AncestryItem[] | null {
  const chain: AncestryItem[] = []
  let cur: ReactFiber | null = fiber
  while (cur && chain.length < maxCount) {
    if (isComponentFiber(cur)) {
      const name = fiberName(cur) || '<anonymous>'
      const item: AncestryItem = { name }

      if (cur._debugSource) {
        item.file = cur._debugSource.fileName
        item.line = cur._debugSource.lineNumber
      }
      item.index = cur.index
      if (cur.key != null) item.key = String(cur.key)

      // Find the host element this component renders
      let child = cur.child
      while (child && typeof child.type !== 'string') child = child.child
      if (child && typeof child.type === 'string') {
        item.renders = child.type as string
      }

      chain.push(item)
    }
    cur = cur.return
  }
  return chain.length > 0 ? chain : null
}

function extractProps(fiber: ReactFiber, maxDepth: number): Record<string, unknown> | null {
  if (!fiber.memoizedProps) return null
  const result: Record<string, unknown> = {}
  let count = 0
  for (const key of Object.keys(fiber.memoizedProps)) {
    if (key === 'children') continue
    if (count >= 20) { result['…'] = 'truncated'; break }
    result[key] = safeSerialize(fiber.memoizedProps[key], 0, maxDepth)
    count++
  }
  return count > 0 ? result : null
}

interface HookEntry {
  hook: string
  index: number
  value?: unknown
  current?: unknown
}

function extractHooks(fiber: ReactFiber, maxDepth: number): HookEntry[] | null {
  if (!fiber.memoizedState || typeof fiber.type === 'string') return null
  const ms = fiber.memoizedState as HookNode
  if (typeof ms !== 'object' || !('queue' in ms)) return null

  const states: HookEntry[] = []
  let hook: HookNode | null = ms
  let index = 0
  while (hook && index < 30) {
    const kind = classifyHook(hook)
    if (kind === 'state') {
      states.push({ hook: 'state', index, value: safeSerialize(hook.memoizedState, 0, maxDepth) })
    } else if (kind === 'ref') {
      const ref = hook.memoizedState as { current: unknown }
      states.push({ hook: 'ref', index, current: safeSerialize(ref.current, 0, maxDepth) })
    } else if (kind === 'memo') {
      const memo = hook.memoizedState as [unknown, unknown[]]
      states.push({ hook: 'memo', index, value: safeSerialize(memo[0], 0, maxDepth) })
    }
    hook = hook.next
    index++
  }
  return states.length > 0 ? states : null
}

function extractContexts(fiber: ReactFiber, maxDepth: number): Array<{ name: string; value: unknown }> | null {
  if (!fiber.dependencies?.firstContext) return null
  let dep: ContextDep | null = fiber.dependencies.firstContext
  const contexts: Array<{ name: string; value: unknown }> = []
  let seen = 0
  while (dep && seen < 10) {
    const ctx = dep.context
    if (ctx) {
      const name = ctx.displayName ||
                   ctx.Provider?._context?.displayName ||
                   '<unnamed>'
      contexts.push({ name, value: safeSerialize(ctx._currentValue, 0, maxDepth) })
    }
    dep = dep.next
    seen++
  }
  return contexts.length > 0 ? contexts : null
}

// ─── Full React Extraction ─────────────────────────────────────────────────

interface ReactData {
  component: string | null
  props: Record<string, unknown> | null
  hooks: HookEntry[] | null
  contexts: Array<{ name: string; value: unknown }> | null
  ancestry: AncestryItem[] | null
  owner: string | null
  ownerProps: Record<string, unknown> | null
}

function extractReactData(el: Element, config: Required<DeepContextConfig>): ReactData | null {
  try {
    const fiber = getReactFiber(el)
    if (!fiber) return null
    const comp = findComponentFiber(fiber)
    return {
      component: comp ? (fiberName(comp) || '<anonymous>') : null,
      props: comp ? extractProps(comp, config.serializeDepth) : null,
      hooks: comp ? extractHooks(comp, config.serializeDepth) : null,
      contexts: comp ? extractContexts(comp, config.serializeDepth) : null,
      ancestry: extractAncestry(fiber, config.maxAncestors),
      owner: comp?._debugOwner ? (fiberName(comp._debugOwner) || '<anonymous>') : null,
      ownerProps: comp?._debugOwner ? extractProps(comp._debugOwner, config.serializeDepth) : null,
    }
  } catch {
    return null
  }
}

// ─── Layout Extraction ─────────────────────────────────────────────────────

interface LayoutData {
  display: string
  width: number
  height: number
  gap?: number
  rect: { x: number; y: number; width: number; height: number }
}

function extractLayout(el: Element): LayoutData {
  const style = getComputedStyle(el)
  const rect = el.getBoundingClientRect()
  const data: LayoutData = {
    display: style.display,
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
  }
  const gap = parseFloat(style.gap)
  if (!isNaN(gap) && gap > 0) data.gap = gap
  return data
}

// ─── Accessibility Extraction ──────────────────────────────────────────────

interface A11yData {
  role: string | null
  ariaLabel: string | null
  ariaAttributes: Record<string, string>
  tabIndex: number | null
}

function extractA11y(el: Element): A11yData | null {
  const ariaAttrs: Record<string, string> = {}
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i]
    if (attr.name.startsWith('aria-')) {
      ariaAttrs[attr.name] = attr.value
    }
  }
  const role = el.getAttribute('role')
  const ariaLabel = el.getAttribute('aria-label')
  const tabIndex = (el as HTMLElement).tabIndex

  if (!role && !ariaLabel && Object.keys(ariaAttrs).length === 0 && tabIndex === -1) {
    return null
  }

  return {
    role,
    ariaLabel,
    ariaAttributes: ariaAttrs,
    tabIndex: tabIndex !== -1 ? tabIndex : null,
  }
}

// ─── Viewport Extraction ───────────────────────────────────────────────────

interface ViewportData {
  width: number
  height: number
  breakpoint: string
}

function extractViewport(): ViewportData {
  const w = window.innerWidth
  let bp = 'xs'
  if (w >= 1536) bp = '2xl'
  else if (w >= 1280) bp = 'xl'
  else if (w >= 1024) bp = 'lg'
  else if (w >= 768) bp = 'md'
  else if (w >= 640) bp = 'sm'
  return { width: w, height: window.innerHeight, breakpoint: bp }
}

// ─── Data Attributes ───────────────────────────────────────────────────────

function extractDataAttributes(el: Element): Record<string, string> | null {
  const result: Record<string, string> = {}
  let count = 0
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i]
    if (attr.name.startsWith('data-') && !attr.name.startsWith('data-insp')) {
      const key = attr.name.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      result[key] = attr.value
      count++
    }
  }
  return count > 0 ? result : null
}

// ─── Null Omission ─────────────────────────────────────────────────────────

function omitNulls<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result = {} as Partial<T>
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (obj[key] != null) result[key] = obj[key]
  }
  return result
}

// ─── Deep Context JSON Builder ─────────────────────────────────────────────

interface DeepContextEntry {
  react?: Partial<ReactData>
  layout?: LayoutData
  a11y?: A11yData
  viewport?: ViewportData
  dataAttributes?: Record<string, string>
  services?: Record<string, unknown>
}

function buildDeepContext(el: Element, config: Required<DeepContextConfig>): DeepContextEntry {
  const sections = config.sections
  const entry: DeepContextEntry = {}

  if (sections.react) {
    const reactData = extractReactData(el, config)
    if (reactData) entry.react = omitNulls(reactData as unknown as Record<string, unknown>) as unknown as Partial<ReactData>
  }

  if (sections.layout) {
    entry.layout = extractLayout(el)
  }

  if (sections.a11y) {
    const a11y = extractA11y(el)
    if (a11y) entry.a11y = a11y
  }

  if (sections.viewport) {
    entry.viewport = extractViewport()
  }

  if (sections.dataAttributes) {
    const data = extractDataAttributes(el)
    if (data) entry.dataAttributes = data
  }

  if (sections.services && config.serviceExtractor) {
    const services = config.serviceExtractor(el)
    if (services) entry.services = services
  }

  return entry
}

// ─── Impair Service Extractor (built-in, for impair-based apps) ────────────

/**
 * Extracts impair service state from React fiber hooks.
 *
 * impair's `useService()` stores a useMemo hook with:
 *   memoizedState = [readonlyProxy, [ServiceClass, Container]]
 *
 * We detect this by checking if deps[1] has a `.resolve()` method (DI Container).
 */
export function impairExtractor(el: Element): Record<string, unknown> | null {
  const fiber = getReactFiber(el)
  if (!fiber) return null

  const services: Record<string, unknown> = {}
  const visited = new Set<string>()

  // Walk up the fiber tree to find all service hooks
  let cur: ReactFiber | null = fiber
  while (cur) {
    if (isComponentFiber(cur) && cur.memoizedState) {
      const ms = cur.memoizedState as HookNode
      if (typeof ms === 'object' && 'queue' in ms) {
        let hook: HookNode | null = ms
        while (hook) {
          extractServiceFromHook(hook, services, visited)
          hook = hook.next
        }
      }
    }
    cur = cur.return
  }

  return Object.keys(services).length > 0 ? services : null
}

function extractServiceFromHook(
  hook: HookNode,
  services: Record<string, unknown>,
  visited: Set<string>,
): void {
  const ms = hook.memoizedState
  if (!Array.isArray(ms) || ms.length !== 2) return
  const [proxy, deps] = ms as [unknown, unknown[]]
  if (!Array.isArray(deps) || deps.length !== 2) return

  const serviceClass = deps[0] as { name?: string }
  const container = deps[1] as { resolve?: unknown }
  if (!serviceClass?.name || typeof container?.resolve !== 'function') return

  const name = serviceClass.name
  if (visited.has(name)) return
  visited.add(name)

  // Extract state vs derived from the proxy
  const state: Record<string, unknown> = {}
  const derived: Record<string, unknown> = {}

  try {
    const proto = Object.getPrototypeOf(proxy)
    const keys = Object.keys(proxy as object)

    for (const key of keys) {
      state[key] = safeSerialize((proxy as Record<string, unknown>)[key], 0, 1)
    }

    // Getters on prototype = derived properties
    if (proto) {
      const descriptors = Object.getOwnPropertyDescriptors(proto)
      for (const [key, desc] of Object.entries(descriptors)) {
        if (key === 'constructor') continue
        if (desc.get && !keys.includes(key)) {
          try {
            derived[key] = safeSerialize(desc.get.call(proxy), 0, 1)
          } catch {
            derived[key] = '[error]'
          }
        }
      }
    }
  } catch {
    // Proxy access failed
  }

  services[name] = omitNulls({
    state: Object.keys(state).length > 0 ? state : null,
    derived: Object.keys(derived).length > 0 ? derived : null,
  })
}

// ─── Plugin Definition ─────────────────────────────────────────────────────

export const createDeepContextPlugin = (userConfig: DeepContextConfig = {}): Plugin => {
  const config: Required<DeepContextConfig> = {
    ...DEFAULT_CONFIG,
    ...userConfig,
    sections: { ...DEFAULT_CONFIG.sections, ...userConfig.sections },
  }

  return {
    name: 'deep-context',

    setup(_api: ReactGrabAPI): PluginConfig {
      return {
        hooks: {
          /**
           * Enriches copy content with deep context JSON block.
           * When the user copies an element, the clipboard gets:
           *   1. Original HTML snippet + stack (from react-grab core)
           *   2. Appended structured JSON with react/layout/a11y/services data
           */
          transformCopyContent: async (content: string, elements: Element[]): Promise<string> => {
            if (elements.length === 0) return content

            const el = elements[0]
            const deepContext = buildDeepContext(el, config)

            if (Object.keys(deepContext).length === 0) return content

            return `${content}\n\n<!-- deep-context -->\n${JSON.stringify(deepContext, null, 2)}`
          },

          /**
           * THE KEY HOOK: Enriches agent context before it's sent to Claude Code.
           *
           * This transforms the AgentContext.content from shallow snippets to
           * rich JSON entries, giving the AI agent dramatically more context
           * about the selected element(s).
           */
          transformAgentContext: async (
            context: AgentContext,
            elements: Element[],
          ): Promise<AgentContext> => {
            if (elements.length === 0) return context

            const enrichedContent = await Promise.all(
              elements.map(async (el, i) => {
                const deepContext = buildDeepContext(el, config)
                const original = context.content[i] || ''

                if (Object.keys(deepContext).length === 0) return original

                // Combine the original snippet with structured deep context
                return `${original}\n\n<deep-context>\n${JSON.stringify(deepContext, null, 2)}\n</deep-context>`
              }),
            )

            return {
              ...context,
              content: enrichedContent,
            }
          },
        },
      }
    },
  }
}

/**
 * Pre-configured plugin for impair-based apps.
 * Includes service state extraction out of the box.
 */
export const createImpairDeepContextPlugin = (
  userConfig: Omit<DeepContextConfig, 'serviceExtractor'> = {},
): Plugin => {
  return createDeepContextPlugin({
    ...userConfig,
    serviceExtractor: impairExtractor,
  })
}
