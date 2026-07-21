/**
 * Ambient module declaration for `d3-force-3d`.
 *
 * `d3-force-3d` is the 2D/3D-capable port of d3-force that powers the
 * `react-force-graph-2d` simulation. The package ships no TypeScript
 * types of its own, so this file declares just the surface we use in
 * `GraphCanvas`:
 *
 * - `ForceNode`: the shape the simulation mutates onto every node
 *   during init — `x`, `y` are positions, `vx`/`vy` are velocities
 *   for the verlet integrator, `fx`/`fy` are optional fixed positions
 *   (cleared by setting back to `null`), and `index` is the position
 *   of the node in the input array (used as the default link `id`
 *   accessor).
 *
 * - `ForceLink`: the shape we pass in to `forceLink.links()`. Either
 *   endpoint can be a string/number id (what `buildGraphData`
 *   produces) or a node reference (what `react-force-graph-2d`
 *   rewrites it to at runtime). The `id()` setter lets us teach the
 *   force how to map an endpoint back to a node.
 *
 * - `forceManyBody` / `forceLink` / `forceCollide`: the three forces
 *   we use. `ManyBodyForce` is the per-node repulsion (negative
 *   strength = push apart). `LinkForce` is the spring between
 *   connected nodes (distance + strength). `CollideForce` is the
 *   per-node radius that prevents overlap.
 *
 * We deliberately don't declare `forceCenter`, `forceRadial`,
 * `forceX`, `forceY`, or `forceSimulation` — those aren't used here
 * and would just add maintenance surface.
 */
declare module "d3-force-3d" {
  /**
   * Shape the d3-force simulation writes onto every node in the
   * simulation. These fields are mutated in place — read them to
   * observe the current state, write to `fx`/`fy` to pin a node, and
   * clear the pin by setting back to `null`.
   */
  interface ForceNode {
    /** Index of the node in the input array (assigned by d3-force). */
    index?: number;
    /** Current x-coordinate in graph space. */
    x?: number;
    /** Current y-coordinate in graph space. */
    y?: number;
    /** Current velocity on the x-axis (verlet integrator). */
    vx?: number;
    /** Current velocity on the y-axis (verlet integrator). */
    vy?: number;
    /**
     * Optional fixed x-coordinate. Set to a number to pin the node;
     * set to `null` to unpin and let the simulation resume control.
     */
    fx?: number | null;
    /** Optional fixed y-coordinate. See `fx` for semantics. */
    fy?: number | null;
  }

  /**
   * Edge between two nodes in the simulation. `source`/`target` may
   * be string ids, number ids, or node references — the link force
   * normalizes whichever shape we hand it via the `id()` accessor.
   */
  interface ForceLink<Node extends ForceNode = ForceNode> {
    source: string | number | Node;
    target: string | number | Node;
  }

  /**
   * Base shape for every force returned by d3-force-3d: a callable
   * that the simulation invokes each tick with the current alpha,
   * plus an `initialize` hook the simulation calls once when nodes
   * are bound.
   */
  interface ForceFn<Node extends ForceNode = ForceNode> {
    (alpha: number): void;
    initialize?: (nodes: Node[], random?: () => number) => void;
  }

  /**
   * Many-body (charge) force. Applies a per-node repulsion so the
   * graph spreads out — negative `strength` pushes nodes apart,
   * positive `strength` pulls them together. The default d3 value
   * is `-30`; we override it in `graphConfig.ts` to pack the graph
   * tighter.
   */
  interface ManyBodyForce<Node extends ForceNode = ForceNode> {
    (alpha: number): void;
    initialize?: (nodes: Node[], random?: () => number) => void;
    /**
     * Per-node force magnitude. Negative values repel, positive
     * values attract. Pass a constant number; we don't use a
     * per-node accessor here.
     */
    strength(strength: number): ManyBodyForce<Node>;
  }

  /**
   * Link (spring) force. Pulls connected nodes toward each other at
   * the configured `distance` with the configured `strength`.
   */
  interface LinkForce<Node extends ForceNode = ForceNode> {
    (alpha: number): void;
    initialize?: (nodes: Node[], random?: () => number) => void;
    /** Replace the link list the force operates on. */
    links(links: ForceLink<Node>[]): LinkForce<Node>;
    /**
     * Teach the force how to resolve a link endpoint back to its
     * node. `react-force-graph-2d` wires this up by default using
     * `node.id`, so we don't call it ourselves — but the declaration
     * is here because the underlying d3-force API exposes it.
     */
    id(
      idAccessor: (node: Node, index: number, nodes: Node[]) => string | number,
    ): LinkForce<Node>;
    /**
     * Spring stiffness. Higher values pull harder toward `distance`.
     * Accepts a constant or a per-link callback.
     */
    strength(
      strength:
        | number
        | ((
            link: ForceLink<Node>,
            i: number,
            links: ForceLink<Node>[],
          ) => number),
    ): LinkForce<Node>;
    /**
     * Target spring length in graph units. Accepts a constant or a
     * per-link callback. Default is 30; we shrink it in
     * `graphConfig.ts` so connected nodes sit closer.
     */
    distance(
      distance:
        | number
        | ((
            link: ForceLink<Node>,
            i: number,
            links: ForceLink<Node>[],
          ) => number),
    ): LinkForce<Node>;
  }

  /**
   * Collision force. Treats each node as a disc of the given radius
   * and prevents them from overlapping. We use it as a soft floor
   * on how close labels / circles can get, so the graph never
   * collapses into an unreadable blob.
   */
  interface CollideForce<Node extends ForceNode = ForceNode> {
    (alpha: number): void;
    initialize?: (nodes: Node[], random?: () => number) => void;
    /**
     * Per-node collision radius. Accepts a constant or a per-node
     * callback that returns a radius from the node itself.
     */
    radius(radius: number | ((node: Node) => number)): CollideForce<Node>;
  }

  /** Build a many-body (charge) force. See `ManyBodyForce`. */
  export function forceManyBody<
    Node extends ForceNode = ForceNode,
  >(): ManyBodyForce<Node>;
  /** Build a link (spring) force. See `LinkForce`. */
  export function forceLink<
    Node extends ForceNode = ForceNode,
  >(): LinkForce<Node>;
  /** Build a collision force. See `CollideForce`. */
  export function forceCollide<
    Node extends ForceNode = ForceNode,
  >(): CollideForce<Node>;
}
