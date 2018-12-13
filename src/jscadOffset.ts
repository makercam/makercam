import { primitives2d } from '@jscad/scad-api'
import makerjs from 'makerjs'

const { polygon } = primitives2d

export function offset(model: makerjs.IModel, offset: number, tolerance: number = 1) {
    const chain = makerjs.model.findSingleChain(model);
    const minimumSpacing = tolerance;
    const divisions = Math.floor(chain.pathLength / minimumSpacing);
    const spacing = chain.pathLength / divisions;
    const keyPoints = makerjs.chain.toKeyPoints(chain, spacing);
    keyPoints.push(keyPoints[0])
    const poly = polygon({
        points: keyPoints
    })
    let points
    if (offset > 0) {
        points = poly.expand(offset, tolerance).getOutlinePaths()
    } else {
        points = poly.contract(Math.abs(offset), tolerance).getOutlinePaths()
    }
    console.log(points)
    // const newModel = new makerjs.models.ConnectTheDots(true, points.map((point: any) => [point._x, point._y]))
    // const newChain = makerjs.model.findSingleChain(newModel);
    // const newKeyPoints = makerjs.chain.toKeyPoints(newChain, 1);
    return new makerjs.models.ConnectTheDots(true, keyPoints)
}