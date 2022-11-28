import { Graph, graphFromEdges, terminalNodes } from '../../../icc-x-api/utils/graph-utils'
import { expect } from 'chai'
import { setEquals } from '../../../icc-x-api/utils/collection-utils'

function graphEquals(graphA: Graph, graphB: Graph): boolean {
  if (!setEquals(new Set(Object.keys(graphA)), new Set(Object.keys(graphA)))) {
    return false
  }
  return Object.keys(graphA).every((key) => setEquals(graphA[key], graphB[key]))
}

describe('Terminal nodes', function () {
  it('should match expected', function () {
    // Online representation of graph https://www.plantuml.com/plantuml/svg/LSux2e8n00FWFQVuHnLw1Ud3jlRHta7GJHsqtby9MPm-I234ljVbjJwFEtQ7_MRCSNDmrCi0JwCyoOAWFjA4H3CoZVACGgkSgBIX_TdHwS3G_bHkRy_hx-4N
    const graph = graphFromEdges([
      ['A', 'B'],
      ['A', 'C'],
      ['B', 'D'],
      ['B', 'E'],
      ['B', 'I'],
      ['C', 'C'],
      // NO D,
      ['E', 'F'],
      ['F', 'G'],
      ['G', 'E'],
      ['G', 'H'],
      // NO H,
      ['I', 'J'],
      ['I', 'N'],
      ['J', 'K'],
      ['K', 'K'],
      ['K', 'L'],
      ['L', 'M'],
      ['M', 'I'],
      ['N', 'L'],
    ])
    const copy = Object.entries(graph).reduce<Graph>((acc, [node, edges]) => {
      acc[node] = new Set(Array.from(edges))
      return acc
    }, {})
    expect(graphEquals(graph, copy)).to.be.true
    const terminals = terminalNodes(graph)
    expect(graphEquals(graph, copy)).to.be.true
    expect(terminals).to.have.length(4)
    expect(terminals).to.contain('C')
    expect(terminals).to.contain('D')
    expect(terminals).to.contain('H')
    const alternatives = new Set(['I', 'J', 'K', 'L', 'M', 'N'])
    expect(Array.from(terminals).filter((x) => alternatives.has(x))).to.have.length(1)
  })
})
