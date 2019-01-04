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
    layers?: string[],
    feedRate: number,
    plungeRate: number
}

export interface IPocketOperation extends IOperation {
    type: 'pocket'
    depth: number
    depthPerPass: number
    tolerance: number
    stockToLeave: number
}

export interface IParallelOperation extends IOperation {
    type: 'parallel'
    depth: number
    depthPerPass: number
    tolerance: number
    stockToLeave: number
}

export interface IContourOperation extends IOperation {
    type: 'contour'
    depth: number
    depthPerPass: number
    tolerance: number
    outside: boolean
    tabs?: ITabOptions
}

export interface ITraceOperation extends IOperation {
    type: 'trace'
    depth: number
    depthPerPass: number
    tolerance: number
}

export type IAnyOperation = IParallelOperation | IPocketOperation | IContourOperation | ITraceOperation

export function pocketOperation(tool: ITool, depth: number, zSafe: number, feedRate: number, layers?: string[], depthPerPass?: number, plungeRate?: number, tolerance?: number, stockToLeave?: number): IPocketOperation {
    return {
        type: 'pocket',
        layers,
        tool,
        zSafe,
        feedRate,
        depth,
        depthPerPass: depthPerPass === undefined ? depth : depthPerPass,
        plungeRate: plungeRate === undefined ? Math.round(feedRate / 3) : plungeRate,
        tolerance: tolerance === undefined ? 0.01 : tolerance,
        stockToLeave: stockToLeave === undefined ? 0 : stockToLeave
    }
}

export function contourOperation(tool: ITool, depth: number, zSafe: number, feedRate: number, outside: boolean, layers?: string[], depthPerPass?: number, plungeRate?: number, tolerance?: number): IContourOperation {
    return {
        type: 'contour',
        layers,
        tool,
        zSafe,
        feedRate,
        depth,
        depthPerPass: depthPerPass === undefined ? depth : depthPerPass,
        plungeRate: plungeRate === undefined ? Math.round(feedRate / 3) : plungeRate,
        tolerance: tolerance === undefined ? 0.01 : tolerance,
        outside
    }
}

export function traceOperation(tool: ITool, depth: number, zSafe: number, feedRate: number, layers?: string[], depthPerPass?: number, plungeRate?: number, tolerance?: number): ITraceOperation {
    return {
        type: 'trace',
        layers,
        tool,
        zSafe,
        feedRate,
        depth,
        depthPerPass: depthPerPass === undefined ? depth : depthPerPass,
        plungeRate: plungeRate === undefined ? Math.round(feedRate / 3) : plungeRate,
        tolerance: tolerance === undefined ? 0.01 : tolerance
    }
}

export function parallelOperation(tool: ITool, depth: number, zSafe: number, feedRate: number, layers?: string[], depthPerPass?: number, plungeRate?: number, tolerance?: number, stockToLeave?: number): IParallelOperation {
    return {
        type: 'parallel',
        layers,
        tool,
        zSafe,
        feedRate,
        depth,
        depthPerPass: depthPerPass === undefined ? depth : depthPerPass,
        plungeRate: plungeRate === undefined ? Math.round(feedRate / 3) : plungeRate,
        tolerance: tolerance === undefined ? 0.01 : tolerance,
        stockToLeave: stockToLeave === undefined ? 0 : stockToLeave
    }
}

export function trace(model: maker.IModel, operation: ITraceOperation) {
    const { plungeRate, feedRate, depth, depthPerPass, zSafe, tolerance } = operation
    const points = mk.toKeyPoints(model, tolerance)
    openjscam.rapid({ z: zSafe })
    for (var pass = 1; pass <= Math.ceil(depth / depthPerPass); pass++) {
        let z = pass * depthPerPass
        if (z > depth) {
            z = depth
        }
        openjscam.rapid({ x: points[0][0], y: points[0][1] })
        openjscam.feed(plungeRate)
        openjscam.cut({ z: -z })
        openjscam.feed(feedRate)
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

function dist(from: maker.IPoint, to: maker.IPoint) {
    return Math.pow(from[0] - to[0], 2) + Math.pow(from[1] - to[1], 2);
}

function pocket(model: maker.IModel, operation: IPocketOperation) {
    const { stockToLeave, plungeRate, feedRate, depth, depthPerPass, zSafe, tolerance, tool: { diameter: toolDiameter} } = operation
    const toolRadius = toolDiameter / 2
    const inset = toolRadius + stockToLeave
    const insets: maker.IModel[] = []
    let lastInset = mk.clipperOffset(model, -inset, 2, tolerance || 0.1)
    while (Object.keys(lastInset.models!).length > 0) {
        insets.push(lastInset)
        lastInset = mk.clipperOffset(model, -toolRadius * (insets.length + 1), 2, tolerance || 0.1)
    }
    insets.reverse()
    const all: maker.IPoint[] = insets.reduce((memo: maker.IPoint[], inset, i) => {
        const points = mk.toKeyPoints(inset, tolerance)
        if (i === 0) return memo.concat(points)
        const min: any = {
            distance: Infinity,
            point: null
        }
        points.forEach(point => {
            const distance = dist(point, memo[memo.length - 1])
            if (distance < min.distance) {
                min.distance = distance
                min.point = point
            }
        })
        const index = points.indexOf(min.point)
        return memo.concat(points.slice(index), points.slice(0, index + 1))
    }, [])
    openjscam.rapid({ z: zSafe })
    for (var pass = 1; pass <= Math.ceil(depth / depthPerPass); pass++) {
        let z = pass * depthPerPass
        if (z > depth) {
            z = depth
        }
        openjscam.rapid({ x: all[0][0], y: all[0][1] })
        openjscam.feed(plungeRate)
        openjscam.cut({ z: -z })
        openjscam.feed(feedRate)
        all.map((point) => {
            openjscam.cut({ x: point[0], y: point[1] })
        })
        openjscam.rapid({ z: zSafe })
    }
    return new maker.models.ConnectTheDots(false, all)
}

function parallel(model: maker.IModel, operation: IParallelOperation) {
    const { stockToLeave, feedRate, plungeRate, depth, depthPerPass, zSafe, tolerance, tool: { diameter: toolDiameter} } = operation
    const toolRadius = toolDiameter / 2
    const inset = toolRadius + stockToLeave
    const insetted = mk.clipperOffset(model, -inset, 2, tolerance)
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
                openjscam.feed(plungeRate)
                openjscam.cut({ z: -z })
                openjscam.feed(feedRate)
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

function contour(model: maker.IModel, operation: IContourOperation) {
    const { outside, depth, depthPerPass, feedRate, plungeRate, tabs, zSafe, tolerance, tool: { diameter: toolDiameter} } = operation
    const toolRadius = toolDiameter / 2
    let offsetted = mk.clipperOffset(model, outside ? toolRadius : -toolRadius, 2, tolerance)
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
        if (tabs !== undefined) {
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
        if (operation.layers === undefined) {
            operation.layers = Object.keys(chains)
        }
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
                    } else if (operation.type === 'parallel') {
                        const id = `parallel_${Object.keys(outModels).length}_${operation.id}`
                        outModels[id] = parallel(
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