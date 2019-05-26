
(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
(function () {
	'use strict';

	function noop() {}

	function assign(tar, src) {
		for (const k in src) tar[k] = src[k];
		return tar;
	}

	function add_location(element, file, line, column, char) {
		element.__svelte_meta = {
			loc: { file, line, column, char }
		};
	}

	function run(fn) {
		return fn();
	}

	function blank_object() {
		return Object.create(null);
	}

	function run_all(fns) {
		fns.forEach(run);
	}

	function is_function(thing) {
		return typeof thing === 'function';
	}

	function safe_not_equal(a, b) {
		return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}

	function validate_store(store, name) {
		if (!store || typeof store.subscribe !== 'function') {
			throw new Error(`'${name}' is not a store with a 'subscribe' method`);
		}
	}

	function subscribe(component, store, callback) {
		const unsub = store.subscribe(callback);

		component.$$.on_destroy.push(unsub.unsubscribe
			? () => unsub.unsubscribe()
			: unsub);
	}

	function create_slot(definition, ctx, fn) {
		if (definition) {
			const slot_ctx = get_slot_context(definition, ctx, fn);
			return definition[0](slot_ctx);
		}
	}

	function get_slot_context(definition, ctx, fn) {
		return definition[1]
			? assign({}, assign(ctx.$$scope.ctx, definition[1](fn ? fn(ctx) : {})))
			: ctx.$$scope.ctx;
	}

	function get_slot_changes(definition, ctx, changed, fn) {
		return definition[1]
			? assign({}, assign(ctx.$$scope.changed || {}, definition[1](fn ? fn(changed) : {})))
			: ctx.$$scope.changed || {};
	}

	function append(target, node) {
		target.appendChild(node);
	}

	function insert(target, node, anchor) {
		target.insertBefore(node, anchor || null);
	}

	function detach(node) {
		node.parentNode.removeChild(node);
	}

	function element(name) {
		return document.createElement(name);
	}

	function svg_element(name) {
		return document.createElementNS('http://www.w3.org/2000/svg', name);
	}

	function text(data) {
		return document.createTextNode(data);
	}

	function space() {
		return text(' ');
	}

	function empty() {
		return text('');
	}

	function listen(node, event, handler, options) {
		node.addEventListener(event, handler, options);
		return () => node.removeEventListener(event, handler, options);
	}

	function attr(node, attribute, value) {
		if (value == null) node.removeAttribute(attribute);
		else node.setAttribute(attribute, value);
	}

	function set_attributes(node, attributes) {
		for (const key in attributes) {
			if (key === 'style') {
				node.style.cssText = attributes[key];
			} else if (key in node) {
				node[key] = attributes[key];
			} else {
				attr(node, key, attributes[key]);
			}
		}
	}

	function children(element) {
		return Array.from(element.childNodes);
	}

	function claim_element(nodes, name, attributes, svg) {
		for (let i = 0; i < nodes.length; i += 1) {
			const node = nodes[i];
			if (node.nodeName === name) {
				for (let j = 0; j < node.attributes.length; j += 1) {
					const attribute = node.attributes[j];
					if (!attributes[attribute.name]) node.removeAttribute(attribute.name);
				}
				return nodes.splice(i, 1)[0]; // TODO strip unwanted attributes
			}
		}

		return svg ? svg_element(name) : element(name);
	}

	function claim_text(nodes, data) {
		for (let i = 0; i < nodes.length; i += 1) {
			const node = nodes[i];
			if (node.nodeType === 3) {
				node.data = data;
				return nodes.splice(i, 1)[0];
			}
		}

		return text(data);
	}

	function custom_event(type, detail) {
		const e = document.createEvent('CustomEvent');
		e.initCustomEvent(type, false, false, detail);
		return e;
	}

	let current_component;

	function set_current_component(component) {
		current_component = component;
	}

	function get_current_component() {
		if (!current_component) throw new Error(`Function called outside component initialization`);
		return current_component;
	}

	function onMount(fn) {
		get_current_component().$$.on_mount.push(fn);
	}

	function onDestroy(fn) {
		get_current_component().$$.on_destroy.push(fn);
	}

	function createEventDispatcher() {
		const component = current_component;

		return (type, detail) => {
			const callbacks = component.$$.callbacks[type];

			if (callbacks) {
				// TODO are there situations where events could be dispatched
				// in a server (non-DOM) environment?
				const event = custom_event(type, detail);
				callbacks.slice().forEach(fn => {
					fn.call(component, event);
				});
			}
		};
	}

	function setContext(key, context) {
		get_current_component().$$.context.set(key, context);
	}

	function getContext(key) {
		return get_current_component().$$.context.get(key);
	}

	const dirty_components = [];

	const resolved_promise = Promise.resolve();
	let update_scheduled = false;
	const binding_callbacks = [];
	const render_callbacks = [];
	const flush_callbacks = [];

	function schedule_update() {
		if (!update_scheduled) {
			update_scheduled = true;
			resolved_promise.then(flush);
		}
	}

	function add_render_callback(fn) {
		render_callbacks.push(fn);
	}

	function flush() {
		const seen_callbacks = new Set();

		do {
			// first, call beforeUpdate functions
			// and update components
			while (dirty_components.length) {
				const component = dirty_components.shift();
				set_current_component(component);
				update(component.$$);
			}

			while (binding_callbacks.length) binding_callbacks.shift()();

			// then, once components are updated, call
			// afterUpdate functions. This may cause
			// subsequent updates...
			while (render_callbacks.length) {
				const callback = render_callbacks.pop();
				if (!seen_callbacks.has(callback)) {
					callback();

					// ...so guard against infinite loops
					seen_callbacks.add(callback);
				}
			}
		} while (dirty_components.length);

		while (flush_callbacks.length) {
			flush_callbacks.pop()();
		}

		update_scheduled = false;
	}

	function update($$) {
		if ($$.fragment) {
			$$.update($$.dirty);
			run_all($$.before_render);
			$$.fragment.p($$.dirty, $$.ctx);
			$$.dirty = null;

			$$.after_render.forEach(add_render_callback);
		}
	}

	let outros;

	function group_outros() {
		outros = {
			remaining: 0,
			callbacks: []
		};
	}

	function check_outros() {
		if (!outros.remaining) {
			run_all(outros.callbacks);
		}
	}

	function on_outro(callback) {
		outros.callbacks.push(callback);
	}

	function get_spread_update(levels, updates) {
		const update = {};

		const to_null_out = {};
		const accounted_for = { $$scope: 1 };

		let i = levels.length;
		while (i--) {
			const o = levels[i];
			const n = updates[i];

			if (n) {
				for (const key in o) {
					if (!(key in n)) to_null_out[key] = 1;
				}

				for (const key in n) {
					if (!accounted_for[key]) {
						update[key] = n[key];
						accounted_for[key] = 1;
					}
				}

				levels[i] = n;
			} else {
				for (const key in o) {
					accounted_for[key] = 1;
				}
			}
		}

		for (const key in to_null_out) {
			if (!(key in update)) update[key] = undefined;
		}

		return update;
	}

	function mount_component(component, target, anchor) {
		const { fragment, on_mount, on_destroy, after_render } = component.$$;

		fragment.m(target, anchor);

		// onMount happens after the initial afterUpdate. Because
		// afterUpdate callbacks happen in reverse order (inner first)
		// we schedule onMount callbacks before afterUpdate callbacks
		add_render_callback(() => {
			const new_on_destroy = on_mount.map(run).filter(is_function);
			if (on_destroy) {
				on_destroy.push(...new_on_destroy);
			} else {
				// Edge case - component was destroyed immediately,
				// most likely as a result of a binding initialising
				run_all(new_on_destroy);
			}
			component.$$.on_mount = [];
		});

		after_render.forEach(add_render_callback);
	}

	function destroy(component, detaching) {
		if (component.$$) {
			run_all(component.$$.on_destroy);
			component.$$.fragment.d(detaching);

			// TODO null out other refs, including component.$$ (but need to
			// preserve final state?)
			component.$$.on_destroy = component.$$.fragment = null;
			component.$$.ctx = {};
		}
	}

	function make_dirty(component, key) {
		if (!component.$$.dirty) {
			dirty_components.push(component);
			schedule_update();
			component.$$.dirty = blank_object();
		}
		component.$$.dirty[key] = true;
	}

	function init(component, options, instance, create_fragment, not_equal$$1, prop_names) {
		const parent_component = current_component;
		set_current_component(component);

		const props = options.props || {};

		const $$ = component.$$ = {
			fragment: null,
			ctx: null,

			// state
			props: prop_names,
			update: noop,
			not_equal: not_equal$$1,
			bound: blank_object(),

			// lifecycle
			on_mount: [],
			on_destroy: [],
			before_render: [],
			after_render: [],
			context: new Map(parent_component ? parent_component.$$.context : []),

			// everything else
			callbacks: blank_object(),
			dirty: null
		};

		let ready = false;

		$$.ctx = instance
			? instance(component, props, (key, value) => {
				if ($$.ctx && not_equal$$1($$.ctx[key], $$.ctx[key] = value)) {
					if ($$.bound[key]) $$.bound[key](value);
					if (ready) make_dirty(component, key);
				}
			})
			: props;

		$$.update();
		ready = true;
		run_all($$.before_render);
		$$.fragment = create_fragment($$.ctx);

		if (options.target) {
			if (options.hydrate) {
				$$.fragment.l(children(options.target));
			} else {
				$$.fragment.c();
			}

			if (options.intro && component.$$.fragment.i) component.$$.fragment.i();
			mount_component(component, options.target, options.anchor);
			flush();
		}

		set_current_component(parent_component);
	}

	class SvelteComponent {
		$destroy() {
			destroy(this, true);
			this.$destroy = noop;
		}

		$on(type, callback) {
			const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
			callbacks.push(callback);

			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		$set() {
			// overridden by instance, if it has props
		}
	}

	class SvelteComponentDev extends SvelteComponent {
		constructor(options) {
			if (!options || (!options.target && !options.$$inline)) {
				throw new Error(`'target' is a required option`);
			}

			super();
		}

		$destroy() {
			super.$destroy();
			this.$destroy = () => {
				console.warn(`Component was already destroyed`); // eslint-disable-line no-console
			};
		}
	}

	function noop$1() {}

	function run$1(fn) {
		return fn();
	}

	function run_all$1(fns) {
		fns.forEach(run$1);
	}

	function is_function$1(thing) {
		return typeof thing === 'function';
	}

	function safe_not_equal$1(a, b) {
		return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}

	/**
	 * Creates a `Readable` store that allows reading by subscription.
	 * @param value initial value
	 * @param start start and stop notifications for subscriptions
	 */
	function readable(value, start) {
	    return {
	        subscribe: writable(value, start).subscribe,
	    };
	}
	/**
	 * Create a `Writable` store that allows both updating and reading by subscription.
	 * @param value initial value
	 * @param start start and stop notifications for subscriptions
	 */
	function writable(value, start = noop$1) {
	    let stop;
	    const subscribers = [];
	    function set(new_value) {
	        if (safe_not_equal$1(value, new_value)) {
	            value = new_value;
	            if (!stop) {
	                return; // not ready
	            }
	            subscribers.forEach((s) => s[1]());
	            subscribers.forEach((s) => s[0](value));
	        }
	    }
	    function update(fn) {
	        set(fn(value));
	    }
	    function subscribe$$1(run$$1, invalidate = noop$1) {
	        const subscriber = [run$$1, invalidate];
	        subscribers.push(subscriber);
	        if (subscribers.length === 1) {
	            stop = start(set) || noop$1;
	        }
	        run$$1(value);
	        return () => {
	            const index = subscribers.indexOf(subscriber);
	            if (index !== -1) {
	                subscribers.splice(index, 1);
	            }
	            if (subscribers.length === 0) {
	                stop();
	            }
	        };
	    }
	    return { set, update, subscribe: subscribe$$1 };
	}
	/**
	 * Derived value store by synchronizing one or more readable stores and
	 * applying an aggregation function over its input values.
	 * @param stores input stores
	 * @param fn function callback that aggregates the values
	 * @param initial_value when used asynchronously
	 */
	function derived(stores, fn, initial_value) {
	    const single = !Array.isArray(stores);
	    const stores_array = single
	        ? [stores]
	        : stores;
	    const auto = fn.length < 2;
	    return readable(initial_value, (set) => {
	        let inited = false;
	        const values = [];
	        let pending = 0;
	        let cleanup = noop$1;
	        const sync = () => {
	            if (pending) {
	                return;
	            }
	            cleanup();
	            const result = fn(single ? values[0] : values, set);
	            if (auto) {
	                set(result);
	            }
	            else {
	                cleanup = is_function$1(result) ? result : noop$1;
	            }
	        };
	        const unsubscribers = stores_array.map((store, i) => store.subscribe((value) => {
	            values[i] = value;
	            pending &= ~(1 << i);
	            if (inited) {
	                sync();
	            }
	        }, () => {
	            pending |= (1 << i);
	        }));
	        inited = true;
	        sync();
	        return function stop() {
	            run_all$1(unsubscribers);
	            cleanup();
	        };
	    });
	}

	const LOCATION = {};
	const ROUTER = {};

	/**
	 * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/history.js
	 *
	 * https://github.com/reach/router/blob/master/LICENSE
	 * */

	function getLocation(source) {
	  return {
	    ...source.location,
	    state: source.history.state,
	    key: (source.history.state && source.history.state.key) || "initial"
	  };
	}

	function createHistory(source, options) {
	  const listeners = [];
	  let location = getLocation(source);

	  return {
	    get location() {
	      return location;
	    },

	    listen(listener) {
	      listeners.push(listener);

	      const popstateListener = () => {
	        location = getLocation(source);
	        listener({ location, action: "POP" });
	      };

	      source.addEventListener("popstate", popstateListener);

	      return () => {
	        source.removeEventListener("popstate", popstateListener);

	        const index = listeners.indexOf(listener);
	        listeners.splice(index, 1);
	      };
	    },

	    navigate(to, { state, replace = false } = {}) {
	      state = { ...state, key: Date.now() + "" };
	      // try...catch iOS Safari limits to 100 pushState calls
	      try {
	        if (replace) {
	          source.history.replaceState(state, null, to);
	        } else {
	          source.history.pushState(state, null, to);
	        }
	      } catch (e) {
	        source.location[replace ? "replace" : "assign"](to);
	      }

	      location = getLocation(source);
	      listeners.forEach(listener => listener({ location, action: "PUSH" }));
	    }
	  };
	}

	// Stores history entries in memory for testing or other platforms like Native
	function createMemorySource(initialPathname = "/") {
	  let index = 0;
	  const stack = [{ pathname: initialPathname, search: "" }];
	  const states = [];

	  return {
	    get location() {
	      return stack[index];
	    },
	    addEventListener(name, fn) {},
	    removeEventListener(name, fn) {},
	    history: {
	      get entries() {
	        return stack;
	      },
	      get index() {
	        return index;
	      },
	      get state() {
	        return states[index];
	      },
	      pushState(state, _, uri) {
	        const [pathname, search = ""] = uri.split("?");
	        index++;
	        stack.push({ pathname, search });
	        states.push(state);
	      },
	      replaceState(state, _, uri) {
	        const [pathname, search = ""] = uri.split("?");
	        stack[index] = { pathname, search };
	        states[index] = state;
	      }
	    }
	  };
	}

	// Global history uses window.history as the source if available,
	// otherwise a memory history
	const canUseDOM = Boolean(
	  typeof window !== "undefined" &&
	    window.document &&
	    window.document.createElement
	);
	const globalHistory = createHistory(canUseDOM ? window : createMemorySource());
	const { navigate } = globalHistory;

	/**
	 * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/utils.js
	 *
	 * https://github.com/reach/router/blob/master/LICENSE
	 * */

	const paramRe = /^:(.+)/;

	const SEGMENT_POINTS = 4;
	const STATIC_POINTS = 3;
	const DYNAMIC_POINTS = 2;
	const SPLAT_PENALTY = 1;
	const ROOT_POINTS = 1;

	/**
	 * Check if `string` starts with `search`
	 * @param {string} string
	 * @param {string} search
	 * @return {boolean}
	 */
	function startsWith(string, search) {
	  return string.substr(0, search.length) === search;
	}

	/**
	 * Check if `segment` is a root segment
	 * @param {string} segment
	 * @return {boolean}
	 */
	function isRootSegment(segment) {
	  return segment === "";
	}

	/**
	 * Check if `segment` is a dynamic segment
	 * @param {string} segment
	 * @return {boolean}
	 */
	function isDynamic(segment) {
	  return paramRe.test(segment);
	}

	/**
	 * Check if `segment` is a splat
	 * @param {string} segment
	 * @return {boolean}
	 */
	function isSplat(segment) {
	  return segment[0] === "*";
	}

	/**
	 * Split up the URI into segments delimited by `/`
	 * @param {string} uri
	 * @return {string[]}
	 */
	function segmentize(uri) {
	  return (
	    uri
	      // Strip starting/ending `/`
	      .replace(/(^\/+|\/+$)/g, "")
	      .split("/")
	  );
	}

	/**
	 * Strip `str` of potential start and end `/`
	 * @param {string} str
	 * @return {string}
	 */
	function stripSlashes(str) {
	  return str.replace(/(^\/+|\/+$)/g, "");
	}

	/**
	 * Score a route depending on how its individual segments look
	 * @param {object} route
	 * @param {number} index
	 * @return {object}
	 */
	function rankRoute(route, index) {
	  const score = route.default
	    ? 0
	    : segmentize(route.path).reduce((score, segment) => {
	        score += SEGMENT_POINTS;

	        if (isRootSegment(segment)) {
	          score += ROOT_POINTS;
	        } else if (isDynamic(segment)) {
	          score += DYNAMIC_POINTS;
	        } else if (isSplat(segment)) {
	          score -= SEGMENT_POINTS + SPLAT_PENALTY;
	        } else {
	          score += STATIC_POINTS;
	        }

	        return score;
	      }, 0);

	  return { route, score, index };
	}

	/**
	 * Give a score to all routes and sort them on that
	 * @param {object[]} routes
	 * @return {object[]}
	 */
	function rankRoutes(routes) {
	  return (
	    routes
	      .map(rankRoute)
	      // If two routes have the exact same score, we go by index instead
	      .sort((a, b) =>
	        a.score < b.score ? 1 : a.score > b.score ? -1 : a.index - b.index
	      )
	  );
	}

	/**
	 * Ranks and picks the best route to match. Each segment gets the highest
	 * amount of points, then the type of segment gets an additional amount of
	 * points where
	 *
	 *  static > dynamic > splat > root
	 *
	 * This way we don't have to worry about the order of our routes, let the
	 * computers do it.
	 *
	 * A route looks like this
	 *
	 *  { path, default, value }
	 *
	 * And a returned match looks like:
	 *
	 *  { route, params, uri }
	 *
	 * @param {object[]} routes
	 * @param {string} uri
	 * @return {?object}
	 */
	function pick(routes, uri) {
	  let match;
	  let default_;

	  const [uriPathname] = uri.split("?");
	  const uriSegments = segmentize(uriPathname);
	  const isRootUri = uriSegments[0] === "";
	  const ranked = rankRoutes(routes);

	  for (let i = 0, l = ranked.length; i < l; i++) {
	    const route = ranked[i].route;
	    let missed = false;

	    if (route.default) {
	      default_ = {
	        route,
	        params: {},
	        uri
	      };
	      continue;
	    }

	    const routeSegments = segmentize(route.path);
	    const params = {};
	    const max = Math.max(uriSegments.length, routeSegments.length);
	    let index = 0;

	    for (; index < max; index++) {
	      const routeSegment = routeSegments[index];
	      const uriSegment = uriSegments[index];

	      if (isSplat(routeSegment)) {
	        // Hit a splat, just grab the rest, and return a match
	        // uri:   /files/documents/work
	        // route: /files/* or /files/*splatname
	        const splatName = routeSegment === '*' ? '*' : routeSegment.slice(1);

	        params[splatName] = uriSegments
	          .slice(index)
	          .map(decodeURIComponent)
	          .join("/");
	        break;
	      }

	      if (uriSegment === undefined) {
	        // URI is shorter than the route, no match
	        // uri:   /users
	        // route: /users/:userId
	        missed = true;
	        break;
	      }

	      let dynamicMatch = paramRe.exec(routeSegment);

	      if (dynamicMatch && !isRootUri) {
	        const value = decodeURIComponent(uriSegment);
	        params[dynamicMatch[1]] = value;
	      } else if (routeSegment !== uriSegment) {
	        // Current segments don't match, not dynamic, not splat, so no match
	        // uri:   /users/123/settings
	        // route: /users/:id/profile
	        missed = true;
	        break;
	      }
	    }

	    if (!missed) {
	      match = {
	        route,
	        params,
	        uri: "/" + uriSegments.slice(0, index).join("/")
	      };
	      break;
	    }
	  }

	  return match || default_ || null;
	}

	/**
	 * Check if the `path` matches the `uri`.
	 * @param {string} path
	 * @param {string} uri
	 * @return {?object}
	 */
	function match(route, uri) {
	  return pick([route], uri);
	}

	/**
	 * Add the query to the pathname if a query is given
	 * @param {string} pathname
	 * @param {string} [query]
	 * @return {string}
	 */
	function addQuery(pathname, query) {
	  return pathname + (query ? `?${query}` : "");
	}

	/**
	 * Resolve URIs as though every path is a directory, no files. Relative URIs
	 * in the browser can feel awkward because not only can you be "in a directory",
	 * you can be "at a file", too. For example:
	 *
	 *  browserSpecResolve('foo', '/bar/') => /bar/foo
	 *  browserSpecResolve('foo', '/bar') => /foo
	 *
	 * But on the command line of a file system, it's not as complicated. You can't
	 * `cd` from a file, only directories. This way, links have to know less about
	 * their current path. To go deeper you can do this:
	 *
	 *  <Link to="deeper"/>
	 *  // instead of
	 *  <Link to=`{${props.uri}/deeper}`/>
	 *
	 * Just like `cd`, if you want to go deeper from the command line, you do this:
	 *
	 *  cd deeper
	 *  # not
	 *  cd $(pwd)/deeper
	 *
	 * By treating every path as a directory, linking to relative paths should
	 * require less contextual information and (fingers crossed) be more intuitive.
	 * @param {string} to
	 * @param {string} base
	 * @return {string}
	 */
	function resolve(to, base) {
	  // /foo/bar, /baz/qux => /foo/bar
	  if (startsWith(to, "/")) {
	    return to;
	  }

	  const [toPathname, toQuery] = to.split("?");
	  const [basePathname] = base.split("?");
	  const toSegments = segmentize(toPathname);
	  const baseSegments = segmentize(basePathname);

	  // ?a=b, /users?b=c => /users?a=b
	  if (toSegments[0] === "") {
	    return addQuery(basePathname, toQuery);
	  }

	  // profile, /users/789 => /users/789/profile
	  if (!startsWith(toSegments[0], ".")) {
	    const pathname = baseSegments.concat(toSegments).join("/");

	    return addQuery((basePathname === "/" ? "" : "/") + pathname, toQuery);
	  }

	  // ./       , /users/123 => /users/123
	  // ../      , /users/123 => /users
	  // ../..    , /users/123 => /
	  // ../../one, /a/b/c/d   => /a/b/one
	  // .././one , /a/b/c/d   => /a/b/c/one
	  const allSegments = baseSegments.concat(toSegments);
	  const segments = [];

	  allSegments.forEach(segment => {
	    if (segment === "..") {
	      segments.pop();
	    } else if (segment !== ".") {
	      segments.push(segment);
	    }
	  });

	  return addQuery("/" + segments.join("/"), toQuery);
	}

	/**
	 * Combines the `basepath` and the `path` into one path.
	 * @param {string} basepath
	 * @param {string} path
	 */
	function combinePaths(basepath, path) {
	  return `${stripSlashes(
    path === "/" ? basepath : `${stripSlashes(basepath)}/${stripSlashes(path)}`
  )}/*`;
	}

	/**
	 * Decides whether a given `event` should result in a navigation or not.
	 * @param {object} event
	 */
	function shouldNavigate(event) {
	  return (
	    !event.defaultPrevented &&
	    event.button === 0 &&
	    !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
	  );
	}

	/* node_modules/svelte-routing/src/Router.svelte generated by Svelte v3.4.2 */

	function create_fragment(ctx) {
		var current;

		const default_slot_1 = ctx.$$slots.default;
		const default_slot = create_slot(default_slot_1, ctx, null);

		return {
			c: function create() {
				if (default_slot) default_slot.c();
			},

			l: function claim(nodes) {
				if (default_slot) default_slot.l(nodes);
			},

			m: function mount(target, anchor) {
				if (default_slot) {
					default_slot.m(target, anchor);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (default_slot && default_slot.p && changed.$$scope) {
					default_slot.p(get_slot_changes(default_slot_1, ctx, changed, null), get_slot_context(default_slot_1, ctx, null));
				}
			},

			i: function intro(local) {
				if (current) return;
				if (default_slot && default_slot.i) default_slot.i(local);
				current = true;
			},

			o: function outro(local) {
				if (default_slot && default_slot.o) default_slot.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (default_slot) default_slot.d(detaching);
			}
		};
	}

	function instance($$self, $$props, $$invalidate) {
		let $base, $location, $routes;

		

	  let { basepath = "/", url = null } = $$props;

	  const locationContext = getContext(LOCATION);
	  const routerContext = getContext(ROUTER);

	  const routes = writable([]); validate_store(routes, 'routes'); subscribe($$self, routes, $$value => { $routes = $$value; $$invalidate('$routes', $routes); });
	  const activeRoute = writable(null);
	  let hasActiveRoute = false; // Used in SSR to synchronously set that a Route is active.

	  // If locationContext is not set, this is the topmost Router in the tree.
	  // If the `url` prop is given we force the location to it.
	  const location =
	    locationContext ||
	    writable(url ? { pathname: url } : globalHistory.location); validate_store(location, 'location'); subscribe($$self, location, $$value => { $location = $$value; $$invalidate('$location', $location); });

	  // If routerContext is set, the routerBase of the parent Router
	  // will be the base for this Router's descendants.
	  // If routerContext is not set, the path and resolved uri will both
	  // have the value of the basepath prop.
	  const base = routerContext
	    ? routerContext.routerBase
	    : writable({
	        path: basepath,
	        uri: basepath
	      }); validate_store(base, 'base'); subscribe($$self, base, $$value => { $base = $$value; $$invalidate('$base', $base); });

	  const routerBase = derived([base, activeRoute], ([base, activeRoute]) => {
	    // If there is no activeRoute, the routerBase will be identical to the base.
	    if (activeRoute === null) {
	      return base;
	    }

	    const { path: basepath } = base;
	    const { route, uri } = activeRoute;
	    // Remove the potential /* or /*splatname from
	    // the end of the child Routes relative paths.
	    const path = route.default ? basepath : route.path.replace(/\*.*$/, "");

	    return { path, uri };
	  });

	  function registerRoute(route) {
	    const { path: basepath } = $base;
	    let { path } = route;

	    // We store the original path in the _path property so we can reuse
	    // it when the basepath changes. The only thing that matters is that
	    // the route reference is intact, so mutation is fine.
	    route._path = path;
	    route.path = combinePaths(basepath, path);

	    if (typeof window === "undefined") {
	      // In SSR we should set the activeRoute immediately if it is a match.
	      // If there are more Routes being registered after a match is found,
	      // we just skip them.
	      if (hasActiveRoute) {
	        return;
	      }

	      const matchingRoute = match(route, $location.pathname);
	      if (matchingRoute) {
	        activeRoute.set(matchingRoute);
	        $$invalidate('hasActiveRoute', hasActiveRoute = true);
	      }
	    } else {
	      routes.update(rs => {
	        rs.push(route);
	        return rs;
	      });
	    }
	  }

	  function unregisterRoute(route) {
	    routes.update(rs => {
	      const index = rs.indexOf(route);
	      rs.splice(index, 1);
	      return rs;
	    });
	  }

	  if (!locationContext) {
	    // The topmost Router in the tree is responsible for updating
	    // the location store and supplying it through context.
	    onMount(() => {
	      const unlisten = globalHistory.listen(history => {
	        location.set(history.location);
	      });

	      return unlisten;
	    });

	    setContext(LOCATION, location);
	  }

	  setContext(ROUTER, {
	    activeRoute,
	    base,
	    routerBase,
	    registerRoute,
	    unregisterRoute
	  });

		let { $$slots = {}, $$scope } = $$props;

		$$self.$set = $$props => {
			if ('basepath' in $$props) $$invalidate('basepath', basepath = $$props.basepath);
			if ('url' in $$props) $$invalidate('url', url = $$props.url);
			if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
		};

		$$self.$$.update = ($$dirty = { $base: 1, $routes: 1, $location: 1 }) => {
			if ($$dirty.$base) { {
	        const { path: basepath } = $base;
	        routes.update(rs => {
	          rs.forEach(r => (r.path = combinePaths(basepath, r._path)));
	          return rs;
	        });
	      } }
			if ($$dirty.$routes || $$dirty.$location) { {
	        const bestMatch = pick($routes, $location.pathname);
	        activeRoute.set(bestMatch);
	      } }
		};

		return {
			basepath,
			url,
			routes,
			location,
			base,
			$$slots,
			$$scope
		};
	}

	class Router extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance, create_fragment, safe_not_equal, ["basepath", "url"]);
		}

		get basepath() {
			throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set basepath(value) {
			throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get url() {
			throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set url(value) {
			throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* node_modules/svelte-routing/src/Route.svelte generated by Svelte v3.4.2 */

	// (35:0) {#if $activeRoute !== null && $activeRoute.route === route}
	function create_if_block(ctx) {
		var current_block_type_index, if_block, if_block_anchor, current;

		var if_block_creators = [
			create_if_block_1,
			create_else_block
		];

		var if_blocks = [];

		function select_block_type(ctx) {
			if (ctx.component !== null) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c: function create() {
				if_block.c();
				if_block_anchor = empty();
			},

			l: function claim(nodes) {
				if_block.l(nodes);
				if_block_anchor = empty();
			},

			m: function mount(target, anchor) {
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);
				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(changed, ctx);
				} else {
					group_outros();
					on_outro(() => {
						if_blocks[previous_block_index].d(1);
						if_blocks[previous_block_index] = null;
					});
					if_block.o(1);
					check_outros();

					if_block = if_blocks[current_block_type_index];
					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					}
					if_block.i(1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},

			i: function intro(local) {
				if (current) return;
				if (if_block) if_block.i();
				current = true;
			},

			o: function outro(local) {
				if (if_block) if_block.o();
				current = false;
			},

			d: function destroy(detaching) {
				if_blocks[current_block_type_index].d(detaching);

				if (detaching) {
					detach(if_block_anchor);
				}
			}
		};
	}

	// (38:2) {:else}
	function create_else_block(ctx) {
		var current;

		const default_slot_1 = ctx.$$slots.default;
		const default_slot = create_slot(default_slot_1, ctx, null);

		return {
			c: function create() {
				if (default_slot) default_slot.c();
			},

			l: function claim(nodes) {
				if (default_slot) default_slot.l(nodes);
			},

			m: function mount(target, anchor) {
				if (default_slot) {
					default_slot.m(target, anchor);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (default_slot && default_slot.p && changed.$$scope) {
					default_slot.p(get_slot_changes(default_slot_1, ctx, changed, null), get_slot_context(default_slot_1, ctx, null));
				}
			},

			i: function intro(local) {
				if (current) return;
				if (default_slot && default_slot.i) default_slot.i(local);
				current = true;
			},

			o: function outro(local) {
				if (default_slot && default_slot.o) default_slot.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (default_slot) default_slot.d(detaching);
			}
		};
	}

	// (36:2) {#if component !== null}
	function create_if_block_1(ctx) {
		var switch_instance_anchor, current;

		var switch_instance_spread_levels = [
			ctx.routeParams
		];

		var switch_value = ctx.component;

		function switch_props(ctx) {
			let switch_instance_props = {};
			for (var i = 0; i < switch_instance_spread_levels.length; i += 1) {
				switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
			}
			return {
				props: switch_instance_props,
				$$inline: true
			};
		}

		if (switch_value) {
			var switch_instance = new switch_value(switch_props(ctx));
		}

		return {
			c: function create() {
				if (switch_instance) switch_instance.$$.fragment.c();
				switch_instance_anchor = empty();
			},

			l: function claim(nodes) {
				if (switch_instance) switch_instance.$$.fragment.l(nodes);
				switch_instance_anchor = empty();
			},

			m: function mount(target, anchor) {
				if (switch_instance) {
					mount_component(switch_instance, target, anchor);
				}

				insert(target, switch_instance_anchor, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var switch_instance_changes = changed.routeParams ? get_spread_update(switch_instance_spread_levels, [
					ctx.routeParams
				]) : {};

				if (switch_value !== (switch_value = ctx.component)) {
					if (switch_instance) {
						group_outros();
						const old_component = switch_instance;
						on_outro(() => {
							old_component.$destroy();
						});
						old_component.$$.fragment.o(1);
						check_outros();
					}

					if (switch_value) {
						switch_instance = new switch_value(switch_props(ctx));

						switch_instance.$$.fragment.c();
						switch_instance.$$.fragment.i(1);
						mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
					} else {
						switch_instance = null;
					}
				}

				else if (switch_value) {
					switch_instance.$set(switch_instance_changes);
				}
			},

			i: function intro(local) {
				if (current) return;
				if (switch_instance) switch_instance.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				if (switch_instance) switch_instance.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(switch_instance_anchor);
				}

				if (switch_instance) switch_instance.$destroy(detaching);
			}
		};
	}

	function create_fragment$1(ctx) {
		var if_block_anchor, current;

		var if_block = (ctx.$activeRoute !== null && ctx.$activeRoute.route === ctx.route) && create_if_block(ctx);

		return {
			c: function create() {
				if (if_block) if_block.c();
				if_block_anchor = empty();
			},

			l: function claim(nodes) {
				if (if_block) if_block.l(nodes);
				if_block_anchor = empty();
			},

			m: function mount(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				if (ctx.$activeRoute !== null && ctx.$activeRoute.route === ctx.route) {
					if (if_block) {
						if_block.p(changed, ctx);
						if_block.i(1);
					} else {
						if_block = create_if_block(ctx);
						if_block.c();
						if_block.i(1);
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				} else if (if_block) {
					group_outros();
					on_outro(() => {
						if_block.d(1);
						if_block = null;
					});

					if_block.o(1);
					check_outros();
				}
			},

			i: function intro(local) {
				if (current) return;
				if (if_block) if_block.i();
				current = true;
			},

			o: function outro(local) {
				if (if_block) if_block.o();
				current = false;
			},

			d: function destroy(detaching) {
				if (if_block) if_block.d(detaching);

				if (detaching) {
					detach(if_block_anchor);
				}
			}
		};
	}

	function instance$1($$self, $$props, $$invalidate) {
		let $activeRoute;

		

	  let { path = "", component = null } = $$props;

	  const { registerRoute, unregisterRoute, activeRoute } = getContext(ROUTER); validate_store(activeRoute, 'activeRoute'); subscribe($$self, activeRoute, $$value => { $activeRoute = $$value; $$invalidate('$activeRoute', $activeRoute); });

	  const route = {
	    path,
	    // If no path prop is given, this Route will act as the default Route
	    // that is rendered if no other Route in the Router is a match.
	    default: path === ""
	  };
	  let routeParams = {};

	  registerRoute(route);

	  // There is no need to unregister Routes in SSR since it will all be
	  // thrown away anyway.
	  if (typeof window !== "undefined") {
	    onDestroy(() => {
	      unregisterRoute(route);
	    });
	  }

		let { $$slots = {}, $$scope } = $$props;

		$$self.$set = $$props => {
			if ('path' in $$props) $$invalidate('path', path = $$props.path);
			if ('component' in $$props) $$invalidate('component', component = $$props.component);
			if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
		};

		$$self.$$.update = ($$dirty = { $activeRoute: 1 }) => {
			if ($$dirty.$activeRoute) { if ($activeRoute && $activeRoute.route === route) {
	        $$invalidate('routeParams', routeParams = $activeRoute.params);
	      } }
		};

		return {
			path,
			component,
			activeRoute,
			route,
			routeParams,
			$activeRoute,
			$$slots,
			$$scope
		};
	}

	class Route extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$1, create_fragment$1, safe_not_equal, ["path", "component"]);
		}

		get path() {
			throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set path(value) {
			throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get component() {
			throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set component(value) {
			throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* node_modules/svelte-routing/src/Link.svelte generated by Svelte v3.4.2 */

	const file = "node_modules/svelte-routing/src/Link.svelte";

	function create_fragment$2(ctx) {
		var a, current, dispose;

		const default_slot_1 = ctx.$$slots.default;
		const default_slot = create_slot(default_slot_1, ctx, null);

		var a_levels = [
			{ href: ctx.href },
			{ "aria-current": ctx.ariaCurrent },
			ctx.props
		];

		var a_data = {};
		for (var i = 0; i < a_levels.length; i += 1) {
			a_data = assign(a_data, a_levels[i]);
		}

		return {
			c: function create() {
				a = element("a");

				if (default_slot) default_slot.c();
				this.h();
			},

			l: function claim(nodes) {
				a = claim_element(nodes, "A", { href: true, "aria-current": true }, false);
				var a_nodes = children(a);

				if (default_slot) default_slot.l(a_nodes);
				a_nodes.forEach(detach);
				this.h();
			},

			h: function hydrate() {
				set_attributes(a, a_data);
				add_location(a, file, 40, 0, 1249);
				dispose = listen(a, "click", ctx.onClick);
			},

			m: function mount(target, anchor) {
				insert(target, a, anchor);

				if (default_slot) {
					default_slot.m(a, null);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (default_slot && default_slot.p && changed.$$scope) {
					default_slot.p(get_slot_changes(default_slot_1, ctx, changed, null), get_slot_context(default_slot_1, ctx, null));
				}

				set_attributes(a, get_spread_update(a_levels, [
					(changed.href) && { href: ctx.href },
					(changed.ariaCurrent) && { "aria-current": ctx.ariaCurrent },
					(changed.props) && ctx.props
				]));
			},

			i: function intro(local) {
				if (current) return;
				if (default_slot && default_slot.i) default_slot.i(local);
				current = true;
			},

			o: function outro(local) {
				if (default_slot && default_slot.o) default_slot.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(a);
				}

				if (default_slot) default_slot.d(detaching);
				dispose();
			}
		};
	}

	function instance$2($$self, $$props, $$invalidate) {
		let $base, $location;

		

	  let { to = "#", replace = false, state = {}, getProps = () => ({}) } = $$props;

	  const { base } = getContext(ROUTER); validate_store(base, 'base'); subscribe($$self, base, $$value => { $base = $$value; $$invalidate('$base', $base); });
	  const location = getContext(LOCATION); validate_store(location, 'location'); subscribe($$self, location, $$value => { $location = $$value; $$invalidate('$location', $location); });
	  const dispatch = createEventDispatcher();

	  let href, isPartiallyCurrent, isCurrent, props;

	  function onClick(event) {
	    dispatch("click", event);

	    if (shouldNavigate(event)) {
	      event.preventDefault();
	      // Don't push another entry to the history stack when the user
	      // clicks on a Link to the page they are currently on.
	      const shouldReplace = $location.pathname === href || replace;
	      navigate(href, { state, replace: shouldReplace });
	    }
	  }

		let { $$slots = {}, $$scope } = $$props;

		$$self.$set = $$props => {
			if ('to' in $$props) $$invalidate('to', to = $$props.to);
			if ('replace' in $$props) $$invalidate('replace', replace = $$props.replace);
			if ('state' in $$props) $$invalidate('state', state = $$props.state);
			if ('getProps' in $$props) $$invalidate('getProps', getProps = $$props.getProps);
			if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
		};

		let ariaCurrent;

		$$self.$$.update = ($$dirty = { to: 1, $base: 1, $location: 1, href: 1, isCurrent: 1, getProps: 1, isPartiallyCurrent: 1 }) => {
			if ($$dirty.to || $$dirty.$base) { $$invalidate('href', href = to === "/" ? $base.uri : resolve(to, $base.uri)); }
			if ($$dirty.$location || $$dirty.href) { $$invalidate('isPartiallyCurrent', isPartiallyCurrent = startsWith($location.pathname, href)); }
			if ($$dirty.href || $$dirty.$location) { $$invalidate('isCurrent', isCurrent = href === $location.pathname); }
			if ($$dirty.isCurrent) { $$invalidate('ariaCurrent', ariaCurrent = isCurrent ? "page" : undefined); }
			if ($$dirty.getProps || $$dirty.$location || $$dirty.href || $$dirty.isPartiallyCurrent || $$dirty.isCurrent) { $$invalidate('props', props = getProps({
	        location: $location,
	        href,
	        isPartiallyCurrent,
	        isCurrent
	      })); }
		};

		return {
			to,
			replace,
			state,
			getProps,
			base,
			location,
			href,
			props,
			onClick,
			ariaCurrent,
			$$slots,
			$$scope
		};
	}

	class Link extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$2, create_fragment$2, safe_not_equal, ["to", "replace", "state", "getProps"]);
		}

		get to() {
			throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set to(value) {
			throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get replace() {
			throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set replace(value) {
			throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get state() {
			throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set state(value) {
			throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get getProps() {
			throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set getProps(value) {
			throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src/components/NavLink.svelte generated by Svelte v3.4.2 */

	// (14:0) <Link {to} {getProps}>
	function create_default_slot(ctx) {
		var current;

		const default_slot_1 = ctx.$$slots.default;
		const default_slot = create_slot(default_slot_1, ctx, null);

		return {
			c: function create() {
				if (default_slot) default_slot.c();
			},

			l: function claim(nodes) {
				if (default_slot) default_slot.l(nodes);
			},

			m: function mount(target, anchor) {
				if (default_slot) {
					default_slot.m(target, anchor);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (default_slot && default_slot.p && changed.$$scope) {
					default_slot.p(get_slot_changes(default_slot_1, ctx, changed, null), get_slot_context(default_slot_1, ctx, null));
				}
			},

			i: function intro(local) {
				if (current) return;
				if (default_slot && default_slot.i) default_slot.i(local);
				current = true;
			},

			o: function outro(local) {
				if (default_slot && default_slot.o) default_slot.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (default_slot) default_slot.d(detaching);
			}
		};
	}

	function create_fragment$3(ctx) {
		var current;

		var link = new Link({
			props: {
			to: ctx.to,
			getProps: getProps,
			$$slots: { default: [create_default_slot] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		return {
			c: function create() {
				link.$$.fragment.c();
			},

			l: function claim(nodes) {
				link.$$.fragment.l(nodes);
			},

			m: function mount(target, anchor) {
				mount_component(link, target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var link_changes = {};
				if (changed.to) link_changes.to = ctx.to;
				if (changed.getProps) link_changes.getProps = getProps;
				if (changed.$$scope) link_changes.$$scope = { changed, ctx };
				link.$set(link_changes);
			},

			i: function intro(local) {
				if (current) return;
				link.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				link.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				link.$destroy(detaching);
			}
		};
	}

	function getProps({ location, href, isPartiallyCurrent, isCurrent }) {
	  const isActive = href === '/' ? isCurrent : isPartiallyCurrent || isCurrent;
	  // The object returned here is spread on the anchor element's attributes
	  if (isActive) {
	    return { class: 'active' };
	  }
	  return {};
	}

	function instance$3($$self, $$props, $$invalidate) {
		let { to = '' } = $$props;

		let { $$slots = {}, $$scope } = $$props;

		$$self.$set = $$props => {
			if ('to' in $$props) $$invalidate('to', to = $$props.to);
			if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
		};

		return { to, $$slots, $$scope };
	}

	class NavLink extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$3, create_fragment$3, safe_not_equal, ["to"]);
		}

		get to() {
			throw new Error("<NavLink>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set to(value) {
			throw new Error("<NavLink>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src/routes/Home.svelte generated by Svelte v3.4.2 */

	const file$1 = "src/routes/Home.svelte";

	function create_fragment$4(ctx) {
		var h1, t0, t1, p, t2;

		return {
			c: function create() {
				h1 = element("h1");
				t0 = text("Home");
				t1 = space();
				p = element("p");
				t2 = text("Welcome to my website");
				this.h();
			},

			l: function claim(nodes) {
				h1 = claim_element(nodes, "H1", {}, false);
				var h1_nodes = children(h1);

				t0 = claim_text(h1_nodes, "Home");
				h1_nodes.forEach(detach);
				t1 = claim_text(nodes, "\n");

				p = claim_element(nodes, "P", {}, false);
				var p_nodes = children(p);

				t2 = claim_text(p_nodes, "Welcome to my website");
				p_nodes.forEach(detach);
				this.h();
			},

			h: function hydrate() {
				add_location(h1, file$1, 0, 0, 0);
				add_location(p, file$1, 1, 0, 14);
			},

			m: function mount(target, anchor) {
				insert(target, h1, anchor);
				append(h1, t0);
				insert(target, t1, anchor);
				insert(target, p, anchor);
				append(p, t2);
			},

			p: noop,
			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(h1);
					detach(t1);
					detach(p);
				}
			}
		};
	}

	class Home extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$4, safe_not_equal, []);
		}
	}

	/* src/routes/About.svelte generated by Svelte v3.4.2 */

	const file$2 = "src/routes/About.svelte";

	function create_fragment$5(ctx) {
		var h1, t0, t1, p, t2;

		return {
			c: function create() {
				h1 = element("h1");
				t0 = text("About");
				t1 = space();
				p = element("p");
				t2 = text("I like to code");
				this.h();
			},

			l: function claim(nodes) {
				h1 = claim_element(nodes, "H1", { class: true }, false);
				var h1_nodes = children(h1);

				t0 = claim_text(h1_nodes, "About");
				h1_nodes.forEach(detach);
				t1 = claim_text(nodes, "\n");

				p = claim_element(nodes, "P", {}, false);
				var p_nodes = children(p);

				t2 = claim_text(p_nodes, "I like to code");
				p_nodes.forEach(detach);
				this.h();
			},

			h: function hydrate() {
				h1.className = "svelte-1440tcg";
				add_location(h1, file$2, 7, 0, 123);
				add_location(p, file$2, 8, 0, 138);
			},

			m: function mount(target, anchor) {
				insert(target, h1, anchor);
				append(h1, t0);
				insert(target, t1, anchor);
				insert(target, p, anchor);
				append(p, t2);
			},

			p: noop,
			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(h1);
					detach(t1);
					detach(p);
				}
			}
		};
	}

	class About extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$5, safe_not_equal, []);
		}
	}

	/* src/routes/Blog.svelte generated by Svelte v3.4.2 */

	const file$3 = "src/routes/Blog.svelte";

	// (10:6) <Link to="first">
	function create_default_slot_6(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Today I did something cool");
			},

			l: function claim(nodes) {
				t = claim_text(nodes, "Today I did something cool");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (13:6) <Link to="second">
	function create_default_slot_5(ctx) {
		var t;

		return {
			c: function create() {
				t = text("I did something awesome today");
			},

			l: function claim(nodes) {
				t = claim_text(nodes, "I did something awesome today");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (16:6) <Link to="third">
	function create_default_slot_4(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Did something sweet today");
			},

			l: function claim(nodes) {
				t = claim_text(nodes, "Did something sweet today");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (20:2) <Route path="first">
	function create_default_slot_3(ctx) {
		var p, t;

		return {
			c: function create() {
				p = element("p");
				t = text("I did something cool today. Lorem ipsum dolor sit amet, consectetur\n      adipisicing elit. Quisquam rerum asperiores, ex animi sunt ipsum. Voluptas\n      sint id hic. Vel neque maxime exercitationem facere culpa nisi, nihil\n      incidunt quo nostrum, beatae dignissimos dolores natus quaerat! Quasi sint\n      praesentium inventore quidem, deserunt atque ipsum similique dolores\n      maiores expedita, qui totam. Totam et incidunt assumenda quas explicabo\n      corporis eligendi amet sint ducimus, culpa fugit esse. Tempore dolorum sit\n      perspiciatis corporis molestias nemo, veritatis, asperiores earum! Ex\n      repudiandae aperiam asperiores esse minus veniam sapiente corrupti alias\n      deleniti excepturi saepe explicabo eveniet harum fuga numquam nostrum\n      adipisci pariatur iusto sint, impedit provident repellat quis?");
				this.h();
			},

			l: function claim(nodes) {
				p = claim_element(nodes, "P", {}, false);
				var p_nodes = children(p);

				t = claim_text(p_nodes, "I did something cool today. Lorem ipsum dolor sit amet, consectetur\n      adipisicing elit. Quisquam rerum asperiores, ex animi sunt ipsum. Voluptas\n      sint id hic. Vel neque maxime exercitationem facere culpa nisi, nihil\n      incidunt quo nostrum, beatae dignissimos dolores natus quaerat! Quasi sint\n      praesentium inventore quidem, deserunt atque ipsum similique dolores\n      maiores expedita, qui totam. Totam et incidunt assumenda quas explicabo\n      corporis eligendi amet sint ducimus, culpa fugit esse. Tempore dolorum sit\n      perspiciatis corporis molestias nemo, veritatis, asperiores earum! Ex\n      repudiandae aperiam asperiores esse minus veniam sapiente corrupti alias\n      deleniti excepturi saepe explicabo eveniet harum fuga numquam nostrum\n      adipisci pariatur iusto sint, impedit provident repellat quis?");
				p_nodes.forEach(detach);
				this.h();
			},

			h: function hydrate() {
				add_location(p, file$3, 20, 4, 376);
			},

			m: function mount(target, anchor) {
				insert(target, p, anchor);
				append(p, t);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(p);
				}
			}
		};
	}

	// (35:2) <Route path="second">
	function create_default_slot_2(ctx) {
		var p, t;

		return {
			c: function create() {
				p = element("p");
				t = text("I did something awesome today. Lorem ipsum dolor sit amet, consectetur\n      adipisicing elit. Repudiandae enim quasi animi, vero deleniti dignissimos\n      sapiente perspiciatis. Veniam, repellendus, maiores.");
				this.h();
			},

			l: function claim(nodes) {
				p = claim_element(nodes, "P", {}, false);
				var p_nodes = children(p);

				t = claim_text(p_nodes, "I did something awesome today. Lorem ipsum dolor sit amet, consectetur\n      adipisicing elit. Repudiandae enim quasi animi, vero deleniti dignissimos\n      sapiente perspiciatis. Veniam, repellendus, maiores.");
				p_nodes.forEach(detach);
				this.h();
			},

			h: function hydrate() {
				add_location(p, file$3, 35, 4, 1274);
			},

			m: function mount(target, anchor) {
				insert(target, p, anchor);
				append(p, t);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(p);
				}
			}
		};
	}

	// (42:2) <Route path="third">
	function create_default_slot_1(ctx) {
		var p, t;

		return {
			c: function create() {
				p = element("p");
				t = text("I did something sweet today. Lorem ipsum dolor sit amet, consectetur\n      adipisicing elit. Modi ad voluptas rem consequatur commodi minima\n      doloribus veritatis nam, quas, culpa autem repellat saepe quam deleniti\n      maxime delectus fuga totam libero sit neque illo! Sapiente consequatur rem\n      minima expedita nemo blanditiis, aut veritatis alias nostrum vel? Esse\n      molestias placeat, doloribus commodi.");
				this.h();
			},

			l: function claim(nodes) {
				p = claim_element(nodes, "P", {}, false);
				var p_nodes = children(p);

				t = claim_text(p_nodes, "I did something sweet today. Lorem ipsum dolor sit amet, consectetur\n      adipisicing elit. Modi ad voluptas rem consequatur commodi minima\n      doloribus veritatis nam, quas, culpa autem repellat saepe quam deleniti\n      maxime delectus fuga totam libero sit neque illo! Sapiente consequatur rem\n      minima expedita nemo blanditiis, aut veritatis alias nostrum vel? Esse\n      molestias placeat, doloribus commodi.");
				p_nodes.forEach(detach);
				this.h();
			},

			h: function hydrate() {
				add_location(p, file$3, 42, 4, 1541);
			},

			m: function mount(target, anchor) {
				insert(target, p, anchor);
				append(p, t);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(p);
				}
			}
		};
	}

	// (5:0) <Router>
	function create_default_slot$1(ctx) {
		var h1, t0, t1, ul, li0, t2, li1, t3, li2, t4, t5, t6, current;

		var link0 = new Link({
			props: {
			to: "first",
			$$slots: { default: [create_default_slot_6] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		var link1 = new Link({
			props: {
			to: "second",
			$$slots: { default: [create_default_slot_5] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		var link2 = new Link({
			props: {
			to: "third",
			$$slots: { default: [create_default_slot_4] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		var route0 = new Route({
			props: {
			path: "first",
			$$slots: { default: [create_default_slot_3] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		var route1 = new Route({
			props: {
			path: "second",
			$$slots: { default: [create_default_slot_2] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		var route2 = new Route({
			props: {
			path: "third",
			$$slots: { default: [create_default_slot_1] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		return {
			c: function create() {
				h1 = element("h1");
				t0 = text("Blog");
				t1 = space();
				ul = element("ul");
				li0 = element("li");
				link0.$$.fragment.c();
				t2 = space();
				li1 = element("li");
				link1.$$.fragment.c();
				t3 = space();
				li2 = element("li");
				link2.$$.fragment.c();
				t4 = space();
				route0.$$.fragment.c();
				t5 = space();
				route1.$$.fragment.c();
				t6 = space();
				route2.$$.fragment.c();
				this.h();
			},

			l: function claim(nodes) {
				h1 = claim_element(nodes, "H1", {}, false);
				var h1_nodes = children(h1);

				t0 = claim_text(h1_nodes, "Blog");
				h1_nodes.forEach(detach);
				t1 = claim_text(nodes, "\n\n  ");

				ul = claim_element(nodes, "UL", {}, false);
				var ul_nodes = children(ul);

				li0 = claim_element(ul_nodes, "LI", {}, false);
				var li0_nodes = children(li0);

				link0.$$.fragment.l(li0_nodes);
				li0_nodes.forEach(detach);
				t2 = claim_text(ul_nodes, "\n    ");

				li1 = claim_element(ul_nodes, "LI", {}, false);
				var li1_nodes = children(li1);

				link1.$$.fragment.l(li1_nodes);
				li1_nodes.forEach(detach);
				t3 = claim_text(ul_nodes, "\n    ");

				li2 = claim_element(ul_nodes, "LI", {}, false);
				var li2_nodes = children(li2);

				link2.$$.fragment.l(li2_nodes);
				li2_nodes.forEach(detach);
				ul_nodes.forEach(detach);
				t4 = claim_text(nodes, "\n\n  ");
				route0.$$.fragment.l(nodes);
				t5 = claim_text(nodes, "\n  ");
				route1.$$.fragment.l(nodes);
				t6 = claim_text(nodes, "\n  ");
				route2.$$.fragment.l(nodes);
				this.h();
			},

			h: function hydrate() {
				add_location(h1, file$3, 5, 2, 87);
				add_location(li0, file$3, 8, 4, 113);
				add_location(li1, file$3, 11, 4, 189);
				add_location(li2, file$3, 14, 4, 269);
				add_location(ul, file$3, 7, 2, 104);
			},

			m: function mount(target, anchor) {
				insert(target, h1, anchor);
				append(h1, t0);
				insert(target, t1, anchor);
				insert(target, ul, anchor);
				append(ul, li0);
				mount_component(link0, li0, null);
				append(ul, t2);
				append(ul, li1);
				mount_component(link1, li1, null);
				append(ul, t3);
				append(ul, li2);
				mount_component(link2, li2, null);
				insert(target, t4, anchor);
				mount_component(route0, target, anchor);
				insert(target, t5, anchor);
				mount_component(route1, target, anchor);
				insert(target, t6, anchor);
				mount_component(route2, target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var link0_changes = {};
				if (changed.$$scope) link0_changes.$$scope = { changed, ctx };
				link0.$set(link0_changes);

				var link1_changes = {};
				if (changed.$$scope) link1_changes.$$scope = { changed, ctx };
				link1.$set(link1_changes);

				var link2_changes = {};
				if (changed.$$scope) link2_changes.$$scope = { changed, ctx };
				link2.$set(link2_changes);

				var route0_changes = {};
				if (changed.$$scope) route0_changes.$$scope = { changed, ctx };
				route0.$set(route0_changes);

				var route1_changes = {};
				if (changed.$$scope) route1_changes.$$scope = { changed, ctx };
				route1.$set(route1_changes);

				var route2_changes = {};
				if (changed.$$scope) route2_changes.$$scope = { changed, ctx };
				route2.$set(route2_changes);
			},

			i: function intro(local) {
				if (current) return;
				link0.$$.fragment.i(local);

				link1.$$.fragment.i(local);

				link2.$$.fragment.i(local);

				route0.$$.fragment.i(local);

				route1.$$.fragment.i(local);

				route2.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				link0.$$.fragment.o(local);
				link1.$$.fragment.o(local);
				link2.$$.fragment.o(local);
				route0.$$.fragment.o(local);
				route1.$$.fragment.o(local);
				route2.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(h1);
					detach(t1);
					detach(ul);
				}

				link0.$destroy();

				link1.$destroy();

				link2.$destroy();

				if (detaching) {
					detach(t4);
				}

				route0.$destroy(detaching);

				if (detaching) {
					detach(t5);
				}

				route1.$destroy(detaching);

				if (detaching) {
					detach(t6);
				}

				route2.$destroy(detaching);
			}
		};
	}

	function create_fragment$6(ctx) {
		var current;

		var router = new Router({
			props: {
			$$slots: { default: [create_default_slot$1] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		return {
			c: function create() {
				router.$$.fragment.c();
			},

			l: function claim(nodes) {
				router.$$.fragment.l(nodes);
			},

			m: function mount(target, anchor) {
				mount_component(router, target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var router_changes = {};
				if (changed.$$scope) router_changes.$$scope = { changed, ctx };
				router.$set(router_changes);
			},

			i: function intro(local) {
				if (current) return;
				router.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				router.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				router.$destroy(detaching);
			}
		};
	}

	class Blog extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$6, safe_not_equal, []);
		}
	}

	/* src/App.svelte generated by Svelte v3.4.2 */

	const file$4 = "src/App.svelte";

	// (23:6) <NavLink to="/">
	function create_default_slot_3$1(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Home");
			},

			l: function claim(nodes) {
				t = claim_text(nodes, "Home");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (24:6) <NavLink to="about">
	function create_default_slot_2$1(ctx) {
		var t;

		return {
			c: function create() {
				t = text("About");
			},

			l: function claim(nodes) {
				t = claim_text(nodes, "About");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (25:6) <NavLink to="blog">
	function create_default_slot_1$1(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Blog");
			},

			l: function claim(nodes) {
				t = claim_text(nodes, "Blog");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (21:2) <Router {url}>
	function create_default_slot$2(ctx) {
		var nav, t0, t1, t2, div, t3, t4, current;

		var navlink0 = new NavLink({
			props: {
			to: "/",
			$$slots: { default: [create_default_slot_3$1] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		var navlink1 = new NavLink({
			props: {
			to: "about",
			$$slots: { default: [create_default_slot_2$1] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		var navlink2 = new NavLink({
			props: {
			to: "blog",
			$$slots: { default: [create_default_slot_1$1] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		var route0 = new Route({
			props: { path: "about", component: About },
			$$inline: true
		});

		var route1 = new Route({
			props: { path: "blog", component: Blog },
			$$inline: true
		});

		var route2 = new Route({
			props: { path: "/", component: Home },
			$$inline: true
		});

		return {
			c: function create() {
				nav = element("nav");
				navlink0.$$.fragment.c();
				t0 = space();
				navlink1.$$.fragment.c();
				t1 = space();
				navlink2.$$.fragment.c();
				t2 = space();
				div = element("div");
				route0.$$.fragment.c();
				t3 = space();
				route1.$$.fragment.c();
				t4 = space();
				route2.$$.fragment.c();
				this.h();
			},

			l: function claim(nodes) {
				nav = claim_element(nodes, "NAV", { class: true }, false);
				var nav_nodes = children(nav);

				navlink0.$$.fragment.l(nav_nodes);
				t0 = claim_text(nav_nodes, "\n      ");
				navlink1.$$.fragment.l(nav_nodes);
				t1 = claim_text(nav_nodes, "\n      ");
				navlink2.$$.fragment.l(nav_nodes);
				nav_nodes.forEach(detach);
				t2 = claim_text(nodes, "\n    ");

				div = claim_element(nodes, "DIV", { class: true }, false);
				var div_nodes = children(div);

				route0.$$.fragment.l(div_nodes);
				t3 = claim_text(div_nodes, "\n      ");
				route1.$$.fragment.l(div_nodes);
				t4 = claim_text(div_nodes, "\n      ");
				route2.$$.fragment.l(div_nodes);
				div_nodes.forEach(detach);
				this.h();
			},

			h: function hydrate() {
				nav.className = "svelte-xvzyu0";
				add_location(nav, file$4, 21, 4, 502);
				div.className = "svelte-xvzyu0";
				add_location(div, file$4, 26, 4, 642);
			},

			m: function mount(target, anchor) {
				insert(target, nav, anchor);
				mount_component(navlink0, nav, null);
				append(nav, t0);
				mount_component(navlink1, nav, null);
				append(nav, t1);
				mount_component(navlink2, nav, null);
				insert(target, t2, anchor);
				insert(target, div, anchor);
				mount_component(route0, div, null);
				append(div, t3);
				mount_component(route1, div, null);
				append(div, t4);
				mount_component(route2, div, null);
				current = true;
			},

			p: function update(changed, ctx) {
				var navlink0_changes = {};
				if (changed.$$scope) navlink0_changes.$$scope = { changed, ctx };
				navlink0.$set(navlink0_changes);

				var navlink1_changes = {};
				if (changed.$$scope) navlink1_changes.$$scope = { changed, ctx };
				navlink1.$set(navlink1_changes);

				var navlink2_changes = {};
				if (changed.$$scope) navlink2_changes.$$scope = { changed, ctx };
				navlink2.$set(navlink2_changes);

				var route0_changes = {};
				if (changed.About) route0_changes.component = About;
				route0.$set(route0_changes);

				var route1_changes = {};
				if (changed.Blog) route1_changes.component = Blog;
				route1.$set(route1_changes);

				var route2_changes = {};
				if (changed.Home) route2_changes.component = Home;
				route2.$set(route2_changes);
			},

			i: function intro(local) {
				if (current) return;
				navlink0.$$.fragment.i(local);

				navlink1.$$.fragment.i(local);

				navlink2.$$.fragment.i(local);

				route0.$$.fragment.i(local);

				route1.$$.fragment.i(local);

				route2.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				navlink0.$$.fragment.o(local);
				navlink1.$$.fragment.o(local);
				navlink2.$$.fragment.o(local);
				route0.$$.fragment.o(local);
				route1.$$.fragment.o(local);
				route2.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(nav);
				}

				navlink0.$destroy();

				navlink1.$destroy();

				navlink2.$destroy();

				if (detaching) {
					detach(t2);
					detach(div);
				}

				route0.$destroy();

				route1.$destroy();

				route2.$destroy();
			}
		};
	}

	function create_fragment$7(ctx) {
		var div, current;

		var router = new Router({
			props: {
			url: ctx.url,
			$$slots: { default: [create_default_slot$2] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		return {
			c: function create() {
				div = element("div");
				router.$$.fragment.c();
				this.h();
			},

			l: function claim(nodes) {
				div = claim_element(nodes, "DIV", { class: true }, false);
				var div_nodes = children(div);

				router.$$.fragment.l(div_nodes);
				div_nodes.forEach(detach);
				this.h();
			},

			h: function hydrate() {
				div.className = "svelte-xvzyu0";
				add_location(div, file$4, 19, 0, 475);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				mount_component(router, div, null);
				current = true;
			},

			p: function update(changed, ctx) {
				var router_changes = {};
				if (changed.url) router_changes.url = ctx.url;
				if (changed.$$scope) router_changes.$$scope = { changed, ctx };
				router.$set(router_changes);
			},

			i: function intro(local) {
				if (current) return;
				router.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				router.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				router.$destroy();
			}
		};
	}

	function instance$4($$self, $$props, $$invalidate) {
		

	  // Used for SSR. A falsy value is ignored by the Router.
	  let { url = '' } = $$props;

		$$self.$set = $$props => {
			if ('url' in $$props) $$invalidate('url', url = $$props.url);
		};

		return { url };
	}

	class App extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$4, create_fragment$7, safe_not_equal, ["url"]);
		}

		get url() {
			throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set url(value) {
			throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* eslint-disable no-new */

	new App({
	  target: document.getElementById('app'),
	  hydrate: true,
	});

}());
//# sourceMappingURL=bundle.js.map
