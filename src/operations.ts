/// <reference path="./index.d.ts" />
import * as openjscam from '@makercam/openjscam'
import * as maker from 'makerjs'

import mk from './make'

export interface ITool {
    diameter: number
}

export interface ITabOptions {
    amount: number
    width: number
    height: number
}

export interface IOperation {
    id?: string
    tool: ITool,
    zSafe: number,
    layers: string[],
    feedRate: number,
    plungeRate: number
}

export interface IPocketOperation extends IOperation {
    type: 'pocket'
    tolerance: number
    stockToLeave: number
    depth: number
    depthPerPass: number
}

export interface IContourOperation extends IOperation {
    type: 'contour'
    tolerance: number
    outside: boolean
    depth: number
    depthPerPass: number
    tabs?: ITabOptions
}

export interface ITraceOperation extends IOperation {
    type: 'trace'
    tolerance: number
    depth: number
    depthPerPass: number
}

export type IAnyOperation = IPocketOperation | IContourOperation | ITraceOperation

export function trace(model: maker.IModel, operation: ITraceOperation) {
    const { depth, depthPerPass, zSafe, tolerance } = operation
    const points = mk.toKeyPoints(model, tolerance)
    openjscam.rapid({ z: zSafe })
    for (var pass = 1; pass <= Math.ceil(depth / depthPerPass); pass++) {
        let z = pass * depthPerPass
        if (z > depth) {
            z = depth
        }
        openjscam.rapid({ x: points[0][0], y: points[0][1] })
        openjscam.cut({ z: -z })
        points.map((point) => {
            openjscam.cut({ x: point[0], y: point[1] })
        })
        openjscam.rapid({ z: zSafe })
    }
    return {
        models: {
            contour: model
        }
    }
}

export function pocket(model: maker.IModel, operation: IPocketOperation) {
    const { stockToLeave, depth, depthPerPass, zSafe, tolerance, tool: { diameter: toolDiameter} } = operation
    const toolRadius = toolDiameter / 2
    const inset = toolRadius + stockToLeave
    const insetted = mk.clipperOffset(model, -inset, 2, tolerance || 0.1)
    if (Object.keys(insetted.models!).length === 0) {
        return {}
    }
    const rasters: any = {
        models: {}
    }
    Object.keys(insetted.models!).forEach(id => {
        const raster = mk.raster(insetted.models![id], toolRadius)
        rasters[id] = raster
        openjscam.rapid({ z: zSafe })
        for (var pass = 1; pass <= Math.ceil(depth / depthPerPass); pass++) {
            let z = pass * depthPerPass
            if (z > depth) {
                z = depth
            }
            Object.values(raster.paths || {}).forEach((path: any) => {
                openjscam.rapid({
                    x: (path.origin ? path.origin[0] : 0) + (raster.origin ? raster.origin[0] : 0),
                    y: (path.origin ? path.origin[1] : 0) + (raster.origin ? raster.origin[1] : 0),
                })
                openjscam.cut({ z: -z })
                openjscam.cut({
                    x: path.end[0] + raster.origin![0],
                    y: path.end[1] + raster.origin![1]
                })
                openjscam.rapid({ z: zSafe })
            })
        }
    })
    return rasters as maker.IModel
}

export function contour(model: maker.IModel, operation: IContourOperation) {
    const { outside, depth, depthPerPass, feedRate, plungeRate, tabs, zSafe, tolerance, tool: { diameter: toolDiameter} } = operation
    const toolRadius = toolDiameter / 2
    let offsetted = mk.clipperOffset(model, outside ? toolRadius : -toolRadius, 2, operation.tolerance || 0.1)
    if (Object.keys(offsetted.models!).length === 0) {
        return {}
    }
    const chains = maker.model.findChains(offsetted) as maker.IChain[]
    chains.forEach(chain => {
        const points = tabs
            ? maker.chain.toPoints(chain, tolerance)
            : maker.chain.toKeyPoints(chain, tolerance)
        if (chain.endless) {
            points.push(points[0])
        }
        let tabStart: number
        let tabDepth: number
        const cutPoints: maker.IPoint[][] = []
        const tabsPoints: maker.IPoint[][] = []
        if (typeof tabs !== 'undefined') {
            const { amount: amountOfTabs, width: tabWidth, height: tabHeight } = tabs
            tabStart = depth - tabHeight
            const tabInterval = Math.floor(points.length / amountOfTabs)
            let tabDuration = Math.ceil(tabWidth / tolerance)
            tabDepth = depth - tabHeight
            for (let tabIndex = 0; tabIndex < amountOfTabs; tabIndex++) {
                const startOffset = tabInterval * tabIndex
                const endOffset = tabInterval * (tabIndex + 1)
                tabsPoints.push(
                    points.slice(
                        startOffset,
                        startOffset + (tabIndex === 0 ? tabDuration + 1 : tabDuration)
                    )
                )
                cutPoints.push(
                    points.slice(
                        startOffset + (tabIndex === 0 ? tabDuration + 1 : tabDuration),
                        tabIndex === (amountOfTabs - 1) ? undefined : endOffset
                    )
                )
            }
        }
        openjscam.rapid({ z: zSafe })
        openjscam.rapid({ x: points[0][0], y: points[0][1] })
        for (var pass = 1; pass <= Math.ceil(depth / depthPerPass); pass++) {
            let z = pass * depthPerPass
            if (z > depth) {
                z = depth
            }
            if (typeof tabs !== 'undefined' && (pass * depthPerPass) > tabStart!) {
                cutPoints.forEach((cut, cutIndex) => {
                    if (openjscam.state.lastCoord.z !== -tabDepth) {
                        openjscam.feed(plungeRate)
                        openjscam.cut({ z: -tabDepth })
                        openjscam.feed(feedRate)
                    }
                    tabsPoints[cutIndex].forEach((point) => {
                        openjscam.cut({ x: point[0], y: point[1] })
                    })
                    openjscam.feed(plungeRate)
                    openjscam.cut({ z: -z })
                    openjscam.feed(feedRate)
                    cut.forEach((point) => {
                        openjscam.cut({ x: point[0], y: point[1] })
                    })
                })
            } else {
                openjscam.feed(plungeRate)
                openjscam.cut({ z: -z })
                openjscam.feed(feedRate)
                points.forEach((point) => {
                    openjscam.cut({ x: point[0], y: point[1] })
                })
            }
        }
        openjscam.rapid({ z: zSafe })
    })
    return {
        models: {
            contour: offsetted
        }
    }
}

export function cnc(drawing: maker.IModel, operations: IAnyOperation[], outModels: any = {}) {
    const chains: any = maker.model.findChains(drawing, {
        byLayers: true
    })
    operations.forEach((operation) => {
        operation.layers.forEach(layer => {
            if (chains[layer]) {
                const chainsForLayer = chains[layer]
                chainsForLayer.forEach((chain: any) => {
                    const model = maker.chain.toNewModel(chain)
                    if (operation.type === 'pocket') {
                        const id = `pocket_${Object.keys(outModels).length}_${operation.id}`
                        outModels[id] = pocket(
                            maker.cloneObject(model),
                            operation
                        )
                    } else if (operation.type === 'contour') {
                        const id = `contour_${Object.keys(outModels).length}_${operation.id}`
                        outModels[id] = contour(
                            maker.cloneObject(model),
                            operation
                        )
                    } else if (operation.type === 'trace') {
                        const id = `trace_${Object.keys(outModels).length}_${operation.id}`
                        outModels[id] = trace(
                            maker.cloneObject(model),
                            operation
                        )
                    }
                })
            }
        })
    })
    return {
        models: outModels
    } as maker.IModel
}