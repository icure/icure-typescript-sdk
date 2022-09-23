/**
 * Represents a graph. Each node is associated to a set of nodes that can be directly reached from it in a single step.
 */
export type Graph = { [node: string]: Set<string> }

/**
 * Creates a graph from a series of edges and optionally additional nodes.
 * @param edges edges between nodes, [from, to].
 * @param additionalNodes nodes which do not appear in any edge.
 * @return a graph built using the provided parameters.
 */
export function graphFromEdges(edges: [string, string][], additionalNodes?: string[]): Graph {
  const nodes = edges.reduce<Set<string>>(
    (acc, [edgeFrom, edgeTo]) => {
      acc.add(edgeFrom)
      acc.add(edgeTo)
      return acc
    },
    new Set(additionalNodes ?? [])
  )
  const res = Array.from(nodes).reduce<Graph>(
    (res, node) => {
      res[node] = new Set<string>()
      return res
    },
    {}
  )
  edges.forEach(([edgeFrom, edgeTo]) => {
    if (edgeFrom != edgeTo) {
      res[edgeFrom].add(edgeTo)
    }
  })
  return res
}

/**
 * Returns "terminal" nodes, nodes from which you can't reach anything else. In case of terminal cycles (cycles from which you can't reach any other
 * node outside the cycle) returns a random node part of the cycle as terminal node.
 * @param graph a graph.
 * @return the terminal nodes of the graph.
 */
export function terminalNodes(graph: Graph): Set<string> {
  const acyclicGraph = acyclic(graph)
  return new Set(Object.entries(acyclicGraph).filter(([, v]) => v.size === 0).map(([k,]) => k))
}

/**
 * Returns a new graph where each cycle has been replaced by a single node, with label chosen at random from labels of nodes in the cycle.
 * @param graph a graph.
 * @return a new acyclic version of the graph.
 */
export function acyclic(graph: Graph): Graph {
  const idToName = Object.keys(graph)
  const nameToId: { [name: string]: number } = {}
  idToName.forEach((name, id) => {
    nameToId[name] = id
  })
  const ogAdjacency: number[][] = idToName.map((name) => {
    return Array.from(graph[name]).map((adjacencyName) => nameToId[adjacencyName])
  })
  const { components, adjacencyList } = stronglyConnectedComponents(ogAdjacency)
  const remappedIdToName = components.map((components) => idToName[components[0]])
  const res: Graph = {}
  adjacencyList.forEach((adjacencyList, index) => {
    res[remappedIdToName[index]] = new Set(adjacencyList.filter((x) => x !== index).map((x) => remappedIdToName[x]))
  })
  return res
}

// Implementation from https://github.com/mikolalysenko/strongly-connected-components
function stronglyConnectedComponents(adjList: number[][]): {components: number[][], adjacencyList: number[][]} {
  const numVertices = adjList.length
  const index = new Array(numVertices)
  const lowValue = new Array(numVertices)
  const active = new Array(numVertices)
  const child = new Array(numVertices)
  const scc = new Array(numVertices)
  const sccLinks = new Array(numVertices)

  //Initialize tables
  for(let i=0; i<numVertices; ++i) {
    index[i] = -1
    lowValue[i] = 0
    active[i] = false
    child[i] = 0
    scc[i] = -1
    sccLinks[i] = []
  }

  // The strongConnect function
  let count = 0
  const components: number[][] = []
  const sccAdjList: number[][] = []

  function strongConnect(v: number) {
    // To avoid running out of stack space, this emulates the recursive behaviour of the normal algorithm, effectively using T as the call stack.
    const S = [v], T = [v]
    index[v] = lowValue[v] = count
    active[v] = true
    count += 1
    while(T.length > 0) {
      v = T[T.length-1]
      const e = adjList[v]
      if (child[v] < e.length) { // If we're not done iterating over the children, first try finishing that.
        let i
        for(i=child[v]; i<e.length; ++i) { // Start where we left off.
          const u = e[i]
          if(index[u] < 0) {
            index[u] = lowValue[u] = count
            active[u] = true
            count += 1
            S.push(u)
            T.push(u)
            break // First recurse, then continue here (with the same child!).
            // There is a slight change to Tarjan's algorithm here.
            // Normally, after having recursed, we set lowValue like we do for an active child (although some variants of the algorithm do it slightly differently).
            // Here, we only do so if the child we recursed on is still active.
            // The reasoning is that if it is no longer active, it must have had a lowValue equal to its own index, which means that it is necessarily higher than our lowValue.
          } else if (active[u]) {
            lowValue[v] = Math.min(lowValue[v], lowValue[u])|0
          }
          if (scc[u] >= 0) {
            // Node v is not yet assigned an scc, but once it is that scc can apparently reach scc[u].
            sccLinks[v].push(scc[u])
          }
        }
        child[v] = i // Remember where we left off.
      } else { // If we're done iterating over the children, check whether we have an scc.
        if(lowValue[v] === index[v]) { // NOTTODO: It /might/ be true that T is always a prefix of S (at this point!!!), and if so, this could be used here.
          const component = []
          const links = []
          let linkCount = 0
          for(let i=S.length-1; i>=0; --i) {
            var w = S[i]
            active[w] = false
            component.push(w)
            links.push(sccLinks[w])
            linkCount += sccLinks[w].length
            scc[w] = components.length
            if(w === v) {
              S.length = i
              break
            }
          }
          components.push(component)
          const allLinks = new Array(linkCount)
          for(let i=0; i<links.length; i++) {
            for(let j=0; j<links[i].length; j++) {
              allLinks[--linkCount] = links[i][j]
            }
          }
          sccAdjList.push(allLinks)
        }
        T.pop() // Now we're finished exploring this particular node (normally corresponds to the return statement)
      }
    }
  }

  //Run strong connect starting from each vertex
  for(let i=0; i<numVertices; ++i) {
    if(index[i] < 0) {
      strongConnect(i)
    }
  }

  // Compact sccAdjList
  let newE
  for(let i=0; i<sccAdjList.length; i++) {
    const e = sccAdjList[i]
    if (e.length === 0) continue
    e.sort(function (a,b) { return a-b; })
    newE = [e[0]]
    for(let j=1; j<e.length; j++) {
      if (e[j] !== e[j-1]) {
        newE.push(e[j])
      }
    }
    sccAdjList[i] = newE
  }

  return {components: components, adjacencyList: sccAdjList}
}
